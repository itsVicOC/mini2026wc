import { pool } from '../db/pool.js';
import { normalizeGroupName, type MatchRecord } from '../services/normalizers.js';
import { appConfig } from '../config/app.js';
import { isFinished, isLive, isNotStartedOrPending } from '../utils/status.js';
import { toBeijingTimeText } from '../utils/time.js';

export async function upsertMatches(matches: MatchRecord[]) {
  if (matches.length === 0) {
    return 0;
  }

  let count = 0;
  for (const match of matches) {
    await pool.execute(
      `
        INSERT INTO matches (
          api_match_id, competition_code, season, matchday, stage, group_name,
          \`utc_date\`, beijing_date, \`status\`, display_status,
          home_team_api_id, home_team_name, home_team_crest,
          away_team_api_id, away_team_name, away_team_crest,
          home_score, away_score, half_time_home_score, half_time_away_score,
          extra_time_home_score, extra_time_away_score, penalty_home_score, penalty_away_score,
          winner, venue, last_updated
        )
        VALUES (
          :api_match_id, :competition_code, :season, :matchday, :stage, :group_name,
          :utc_date, :beijing_date, :status, :display_status,
          :home_team_api_id, :home_team_name, :home_team_crest,
          :away_team_api_id, :away_team_name, :away_team_crest,
          :home_score, :away_score, :half_time_home_score, :half_time_away_score,
          :extra_time_home_score, :extra_time_away_score, :penalty_home_score, :penalty_away_score,
          :winner, :venue, :last_updated
        )
        ON DUPLICATE KEY UPDATE
          competition_code = VALUES(competition_code),
          season = VALUES(season),
          matchday = VALUES(matchday),
          stage = VALUES(stage),
          group_name = VALUES(group_name),
          \`utc_date\` = VALUES(\`utc_date\`),
          beijing_date = VALUES(beijing_date),
          \`status\` = VALUES(\`status\`),
          display_status = VALUES(display_status),
          home_team_api_id = VALUES(home_team_api_id),
          home_team_name = VALUES(home_team_name),
          home_team_crest = VALUES(home_team_crest),
          away_team_api_id = VALUES(away_team_api_id),
          away_team_name = VALUES(away_team_name),
          away_team_crest = VALUES(away_team_crest),
          home_score = VALUES(home_score),
          away_score = VALUES(away_score),
          half_time_home_score = VALUES(half_time_home_score),
          half_time_away_score = VALUES(half_time_away_score),
          extra_time_home_score = VALUES(extra_time_home_score),
          extra_time_away_score = VALUES(extra_time_away_score),
          penalty_home_score = VALUES(penalty_home_score),
          penalty_away_score = VALUES(penalty_away_score),
          winner = VALUES(winner),
          venue = VALUES(venue),
          last_updated = VALUES(last_updated)
      `,
      match
    );
    count += 1;
  }
  return count;
}

export async function getProgress() {
  const [rows] = await pool.query(
    `
      SELECT \`status\`, COUNT(*) AS count
      FROM matches
      WHERE competition_code = ? AND season = ?
      GROUP BY \`status\`
    `,
    [appConfig.competitionCode, appConfig.season]
  );

  const statusRows = rows as Array<{ status: string; count: number }>;
  const finished = statusRows
    .filter((row) => isFinished(row.status))
    .reduce((sum, row) => sum + Number(row.count), 0);
  const live = statusRows
    .filter((row) => isLive(row.status))
    .reduce((sum, row) => sum + Number(row.count), 0);
  const pending = statusRows
    .filter((row) => isNotStartedOrPending(row.status))
    .reduce((sum, row) => sum + Number(row.count), 0);
  const totalFromDb = statusRows.reduce((sum, row) => sum + Number(row.count), 0);
  const total = Math.max(appConfig.totalMatches, totalFromDb);

  return {
    total,
    finished,
    pending,
    live,
    progressPercent: total > 0 ? Math.round((finished / total) * 100) : 0
  };
}

export async function getTeamGroupMapFromMatches() {
  const [rows] = await pool.execute(
    `
      SELECT team_api_id, group_name, COUNT(*) AS match_count
      FROM (
        SELECT home_team_api_id AS team_api_id, group_name
        FROM matches
        WHERE competition_code = :competitionCode
          AND season = :season
          AND group_name IS NOT NULL
          AND home_team_api_id IS NOT NULL
        UNION ALL
        SELECT away_team_api_id AS team_api_id, group_name
        FROM matches
        WHERE competition_code = :competitionCode
          AND season = :season
          AND group_name IS NOT NULL
          AND away_team_api_id IS NOT NULL
      ) match_groups
      GROUP BY team_api_id, group_name
      ORDER BY team_api_id ASC, match_count DESC
    `,
    {
      competitionCode: appConfig.competitionCode,
      season: appConfig.season
    }
  );

  const map = new Map<number, string>();
  for (const row of rows as Array<{ team_api_id: number; group_name: string }>) {
    const teamId = Number(row.team_api_id);
    const groupName = normalizeGroupName(row.group_name);
    if (groupName && !map.has(teamId)) {
      map.set(teamId, groupName);
    }
  }

  return map;
}

export async function getMatches(params: {
  dateFrom?: string;
  dateTo?: string;
  stage?: string;
  group?: string;
  status?: string;
  knockoutOnly?: boolean;
}) {
  const conditions = ['competition_code = :competitionCode', 'season = :season'];
  const values: Record<string, unknown> = {
    competitionCode: appConfig.competitionCode,
    season: appConfig.season
  };

  const dateFrom = normalizeFilter(params.dateFrom);
  const dateTo = normalizeFilter(params.dateTo);
  const stage = normalizeFilter(params.stage);
  const group = normalizeFilter(params.group);
  const status = normalizeFilter(params.status);

  if (dateFrom) {
    conditions.push('beijing_date >= :dateFrom');
    values.dateFrom = dateFrom;
  }
  if (dateTo) {
    conditions.push('beijing_date <= :dateTo');
    values.dateTo = dateTo;
  }
  if (stage) {
    conditions.push('stage = :stage');
    values.stage = stage;
  }
  if (group) {
    conditions.push('group_name = :groupName');
    values.groupName = group;
  }
  if (status) {
    if (status === 'PENDING') {
      conditions.push("`status` IN ('SCHEDULED', 'TIMED', 'POSTPONED', 'SUSPENDED', 'CANCELLED')");
    } else if (status === 'LIVE') {
      conditions.push("`status` IN ('IN_PLAY', 'LIVE', 'PAUSED')");
    } else {
      conditions.push('`status` = :status');
      values.status = status;
    }
  }
  if (params.knockoutOnly) {
    conditions.push("(stage IS NOT NULL AND stage <> 'GROUP_STAGE')");
  }

  const [rows] = await pool.execute(
    `
      SELECT *
      FROM matches
      WHERE ${conditions.join(' AND ')}
      ORDER BY \`utc_date\` ASC, api_match_id ASC
    `,
    values
  );

  return (rows as DbMatch[]).map(formatMatch);
}

function normalizeFilter(value?: string) {
  if (!value || value === 'undefined' || value === 'null') {
    return undefined;
  }
  return value;
}

export async function getLatestMatchUpdatedAt() {
  const [rows] = await pool.query(
    `
      SELECT MAX(updated_at) AS updated_at
      FROM matches
      WHERE competition_code = ? AND season = ?
    `,
    [appConfig.competitionCode, appConfig.season]
  );
  return (rows as Array<{ updated_at: string | null }>)[0]?.updated_at ?? null;
}

type DbMatch = {
  id: number;
  api_match_id: number;
  matchday: number | null;
  stage: string | null;
  group_name: string | null;
  utc_date: string;
  beijing_date: string;
  status: string;
  display_status: string;
  home_team_api_id: number | null;
  home_team_name: string | null;
  home_team_crest: string | null;
  away_team_api_id: number | null;
  away_team_name: string | null;
  away_team_crest: string | null;
  home_score: number | null;
  away_score: number | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  winner: string | null;
  venue: string | null;
};

function formatMatch(match: DbMatch) {
  return {
    id: match.id,
    apiMatchId: match.api_match_id,
    matchday: match.matchday,
    stage: match.stage,
    group: match.group_name,
    utcDate: match.utc_date,
    beijingDate: match.beijing_date,
    beijingTimeText: toBeijingTimeText(`${match.utc_date.replace(' ', 'T')}Z`),
    status: match.status,
    displayStatus: match.display_status,
    homeTeam: {
      apiTeamId: match.home_team_api_id,
      name: match.home_team_name,
      crest: match.home_team_crest
    },
    awayTeam: {
      apiTeamId: match.away_team_api_id,
      name: match.away_team_name,
      crest: match.away_team_crest
    },
    score: {
      home: match.home_score,
      away: match.away_score,
      penaltyHome: match.penalty_home_score,
      penaltyAway: match.penalty_away_score
    },
    winner: match.winner,
    venue: match.venue
  };
}
