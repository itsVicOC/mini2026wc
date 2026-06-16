import { pool } from '../db/pool.js';
import { appConfig } from '../config/app.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { toDisplayStatus } from '../utils/status.js';
import { parseUtcDateTime, toBeijingDateTimeText, toMysqlDateTime } from '../utils/time.js';
import type { ResultSetHeader } from 'mysql2';

const NOTIFY_BEFORE_MINUTES = 5;

export async function upsertMatchSubscription(params: {
  openid: string;
  apiMatchId: number;
  templateId: string;
  expectedUtcDate?: string;
  expectedMatchName?: string;
}) {
  const matchCheck = await getSubscribableMatch(params.apiMatchId, {
    expectedUtcDate: params.expectedUtcDate,
    expectedMatchName: params.expectedMatchName
  });
  if (!matchCheck.ok) {
    throw badRequest(matchCheck.message);
  }

  const match = matchCheck.match;
  const matchTime = parseUtcDateTime(match.utc_date);
  const sendAt = toMysqlDateTime(new Date(matchTime.getTime() - NOTIFY_BEFORE_MINUTES * 60 * 1000));
  if (!sendAt) {
    throw badRequest('比赛开赛时间异常，无法订阅');
  }

  try {
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
  } catch (error) {
    throw badRequest(`订阅保存失败：${formatDatabaseError(error)}`);
  }

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
  const values: Record<string, string | number> = {
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

export async function cancelMatchSubscription(params: {
  openid: string;
  apiMatchId: number;
  templateId: string;
}) {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `
        UPDATE match_subscriptions
        SET \`status\` = 'cancelled', error_message = NULL
        WHERE openid = :openid
          AND api_match_id = :apiMatchId
          AND template_id = :templateId
          AND \`status\` = 'pending'
      `,
      params
    );

    if (result.affectedRows > 0) {
      return {
        apiMatchId: params.apiMatchId,
        status: 'cancelled'
      };
    }

    const [rows] = await pool.execute(
      `
        SELECT \`status\`
        FROM match_subscriptions
        WHERE openid = :openid
          AND api_match_id = :apiMatchId
          AND template_id = :templateId
        LIMIT 1
      `,
      params
    );
    const currentStatus = (rows as Array<{ status: string }>)[0]?.status;
    if (currentStatus === 'sent') {
      throw badRequest('开赛提醒已发送，不能取消');
    }

    return {
      apiMatchId: params.apiMatchId,
      status: 'cancelled'
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'HttpError') {
      throw error;
    }
    throw badRequest(`取消订阅失败：${formatDatabaseError(error)}`);
  }
}

export async function getDueSubscriptions(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const [rows] = await pool.execute(
    `
      SELECT
        s.id AS subscription_id,
        s.openid,
        s.api_match_id,
        m.*
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
    id: row.subscription_id,
    openid: row.openid,
    apiMatchId: row.api_match_id,
    matchStatus: row.status,
    matchName: `${row.home_team_name || '待定'} vs ${row.away_team_name || '待定'}`,
    beijingTimeText: toBeijingDateTimeText(row.utc_date)
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

async function getSubscribableMatch(
  apiMatchId: number,
  expected?: {
    expectedUtcDate?: string;
    expectedMatchName?: string;
  }
) {
  let rows: unknown;
  try {
    const [queryRows] = await pool.execute(
      `
        SELECT *
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
    rows = queryRows;
  } catch (error) {
    throw badRequest(`订阅比赛查询失败：${formatDatabaseError(error)}`);
  }

  const match = (
    rows as Array<{
      api_match_id: number;
      utc_date: string;
      status: string;
      home_team_name: string | null;
      away_team_name: string | null;
    }>
  )[0];
  if (!match) {
    return {
      ok: false as const,
      message: `比赛不存在，请刷新赛程后重试（比赛ID ${apiMatchId}）`
    };
  }
  const dbMatchName = `${match.home_team_name || '待定'} vs ${match.away_team_name || '待定'}`;
  if (expected?.expectedUtcDate && normalizeUtcDateText(expected.expectedUtcDate) !== normalizeUtcDateText(match.utc_date)) {
    return {
      ok: false as const,
      message: `订阅比赛数据不一致，请刷新后重试（比赛ID ${apiMatchId}，页面 ${expected.expectedMatchName || '未知比赛'} ${expected.expectedUtcDate}，数据库 ${dbMatchName} ${match.utc_date}）`
    };
  }
  if (!isSubscribableStatus(match.status)) {
    return {
      ok: false as const,
      message: `比赛状态已更新为${toDisplayStatus(match.status)}，不支持订阅（比赛ID ${apiMatchId}，${dbMatchName}）`
    };
  }
  const matchTime = parseUtcDateTime(match.utc_date);
  if (Number.isNaN(matchTime.getTime())) {
    return {
      ok: false as const,
      message: '比赛开赛时间异常，无法订阅'
    };
  }
  const now = new Date();
  if (matchTime.getTime() <= now.getTime() + NOTIFY_BEFORE_MINUTES * 60 * 1000) {
    return {
      ok: false as const,
      message: `距离开赛不足 ${NOTIFY_BEFORE_MINUTES} 分钟，无法订阅（比赛ID ${apiMatchId}，${dbMatchName}，原始时间 ${match.utc_date}，服务器时间 ${toBeijingDateTimeText(now)}，比赛时间 ${toBeijingDateTimeText(matchTime)}）`
    };
  }
  return {
    ok: true as const,
    match
  };
}

export function isSubscribableStatus(status: string) {
  return ['SCHEDULED', 'TIMED'].includes(status);
}

function normalizeUtcDateText(value: string) {
  const date = parseUtcDateTime(value);
  return Number.isNaN(date.getTime()) ? String(value).trim() : date.toISOString().slice(0, 19);
}

function formatDatabaseError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return '数据库写入异常';
  }

  const detail = error as { code?: string; sqlMessage?: string; message?: string };
  if (detail.code === 'ER_NO_SUCH_TABLE') {
    return '订阅表不存在，请先执行 backend/database/fixes/add_match_subscriptions.sql';
  }
  if (detail.code === 'ER_BAD_FIELD_ERROR') {
    return `订阅表字段不完整，请重新执行订阅表迁移：${detail.sqlMessage || detail.message || detail.code}`;
  }
  if (detail.code === 'ER_NO_REFERENCED_ROW_2') {
    return '比赛数据不存在或外键校验失败，请先同步比赛数据后重试';
  }
  if (detail.code) {
    return `${detail.code}${detail.sqlMessage ? `：${detail.sqlMessage}` : ''}`;
  }
  return detail.message || '数据库写入异常';
}

type DbDueSubscription = {
  subscription_id: number;
  openid: string;
  api_match_id: number;
  utc_date: string;
  home_team_name: string | null;
  away_team_name: string | null;
  status: string;
};
