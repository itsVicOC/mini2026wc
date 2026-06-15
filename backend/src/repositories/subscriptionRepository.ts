import { pool } from '../db/pool.js';
import { appConfig } from '../config/app.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { toBeijingDateTimeText, toMysqlDateTime } from '../utils/time.js';

const NOTIFY_BEFORE_MINUTES = 5;

export async function upsertMatchSubscription(params: {
  openid: string;
  apiMatchId: number;
  templateId: string;
}) {
  const match = await getSubscribableMatch(params.apiMatchId);
  if (!match) {
    throw badRequest('比赛不存在，或当前状态不支持订阅');
  }

  const matchTime = new Date(`${match.utc_date.replace(' ', 'T')}Z`);
  const sendAt = toMysqlDateTime(new Date(matchTime.getTime() - NOTIFY_BEFORE_MINUTES * 60 * 1000));
  if (!sendAt) {
    throw badRequest('比赛开赛时间异常，无法订阅');
  }

  await pool.execute(
    `
      INSERT INTO match_subscriptions (
        openid, api_match_id, template_id, send_at, \`status\`, error_message, wx_msg_id
      )
      VALUES (:openid, :apiMatchId, :templateId, :sendAt, 'pending', NULL, NULL)
      ON DUPLICATE KEY UPDATE
        send_at = IF(\`status\` = 'sent', send_at, VALUES(send_at)),
        \`status\` = IF(\`status\` = 'sent', \`status\`, 'pending'),
        error_message = IF(\`status\` = 'sent', error_message, NULL),
        wx_msg_id = IF(\`status\` = 'sent', wx_msg_id, NULL)
    `,
    {
      openid: params.openid,
      apiMatchId: params.apiMatchId,
      templateId: params.templateId,
      sendAt
    }
  );

  return {
    apiMatchId: params.apiMatchId,
    status: 'pending',
    sendAt
  };
}

export async function getSubscribedMatchIds(openid: string, apiMatchIds: number[]) {
  if (apiMatchIds.length === 0) {
    return [];
  }

  const placeholders = apiMatchIds.map((_, index) => `:matchId${index}`).join(', ');
  const values: Record<string, unknown> = {
    openid,
    templateId: env.WECHAT_SUBSCRIBE_TEMPLATE_ID
  };
  apiMatchIds.forEach((id, index) => {
    values[`matchId${index}`] = id;
  });

  const [rows] = await pool.execute(
    `
      SELECT api_match_id
      FROM match_subscriptions
      WHERE openid = :openid
        AND template_id = :templateId
        AND \`status\` IN ('pending', 'sent')
        AND api_match_id IN (${placeholders})
    `,
    values
  );

  return (rows as Array<{ api_match_id: number }>).map((row) => Number(row.api_match_id));
}

export async function getDueSubscriptions(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const [rows] = await pool.execute(
    `
      SELECT
        s.id,
        s.openid,
        s.api_match_id,
        m.utc_date,
        m.home_team_name,
        m.away_team_name,
        m.\`status\`
      FROM match_subscriptions s
      INNER JOIN matches m ON m.api_match_id = s.api_match_id
      WHERE s.\`status\` = 'pending'
        AND s.template_id = :templateId
        AND s.send_at <= UTC_TIMESTAMP()
        AND m.competition_code = :competitionCode
        AND m.season = :season
      ORDER BY s.send_at ASC, s.id ASC
      LIMIT ${safeLimit}
    `,
    {
      templateId: env.WECHAT_SUBSCRIBE_TEMPLATE_ID,
      competitionCode: appConfig.competitionCode,
      season: appConfig.season
    }
  );

  return (rows as DbDueSubscription[]).map((row) => ({
    id: row.id,
    openid: row.openid,
    apiMatchId: row.api_match_id,
    matchStatus: row.status,
    matchName: `${row.home_team_name || '待定'} vs ${row.away_team_name || '待定'}`,
    beijingTimeText: toBeijingDateTimeText(`${row.utc_date.replace(' ', 'T')}Z`)
  }));
}

export async function markSubscriptionSent(id: number, wxMsgId: string | null) {
  await pool.execute(
    `
      UPDATE match_subscriptions
      SET \`status\` = 'sent', sent_at = UTC_TIMESTAMP(), wx_msg_id = :wxMsgId, error_message = NULL
      WHERE id = :id
    `,
    { id, wxMsgId }
  );
}

export async function markSubscriptionFailed(id: number, errorMessage: string) {
  await pool.execute(
    `
      UPDATE match_subscriptions
      SET \`status\` = 'failed', error_message = :errorMessage
      WHERE id = :id
    `,
    { id, errorMessage: errorMessage.slice(0, 1000) }
  );
}

async function getSubscribableMatch(apiMatchId: number) {
  const [rows] = await pool.execute(
    `
      SELECT api_match_id, utc_date, \`status\`
      FROM matches
      WHERE api_match_id = :apiMatchId
        AND competition_code = :competitionCode
        AND season = :season
      LIMIT 1
    `,
    {
      apiMatchId,
      competitionCode: appConfig.competitionCode,
      season: appConfig.season
    }
  );

  const match = (rows as Array<{ api_match_id: number; utc_date: string; status: string }>)[0];
  if (!match || !isSubscribableStatus(match.status)) {
    return null;
  }
  const matchTime = new Date(`${match.utc_date.replace(' ', 'T')}Z`).getTime();
  if (!Number.isFinite(matchTime) || matchTime <= Date.now() + NOTIFY_BEFORE_MINUTES * 60 * 1000) {
    return null;
  }
  return match;
}

export function isSubscribableStatus(status: string) {
  return ['SCHEDULED', 'TIMED'].includes(status);
}

type DbDueSubscription = {
  id: number;
  openid: string;
  api_match_id: number;
  utc_date: string;
  home_team_name: string | null;
  away_team_name: string | null;
  status: string;
};
