import { pool } from '../db/pool.js';
import { normalizeGroupName, type MatchDetailRecord, type MatchRecord } from '../services/normalizers.js';
import { appConfig } from '../config/app.js';
import { isFinished, isLive, isNotStartedOrPending } from '../utils/status.js';
import { parseUtcDateTime, toBeijingTimeText, toMysqlDateTime } from '../utils/time.js';

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

export async function upsertMatchDetails(details: MatchDetailRecord[]) {
  if (details.length === 0) {
    return 0;
  }

  let count = 0;
  for (const detail of details) {
    await pool.execute(
      `
        INSERT INTO match_details (
          api_match_id, match_minute, injury_time_minute, attendance_total,
          home_formation_text, away_formation_text, home_coach_text, away_coach_text,
          home_statistics_data, away_statistics_data,
          home_lineup_data, away_lineup_data, home_bench_data, away_bench_data,
          goals_data, bookings_data, substitutions_data, penalties_data, referees_data,
          raw_match_data, detail_synced_at
        )
        VALUES (
          :api_match_id, :match_minute, :injury_time_minute, :attendance_total,
          :home_formation_text, :away_formation_text, :home_coach_text, :away_coach_text,
          :home_statistics_data, :away_statistics_data,
          :home_lineup_data, :away_lineup_data, :home_bench_data, :away_bench_data,
          :goals_data, :bookings_data, :substitutions_data, :penalties_data, :referees_data,
          :raw_match_data, :detail_synced_at
        )
        ON DUPLICATE KEY UPDATE
          match_minute = VALUES(match_minute),
          injury_time_minute = VALUES(injury_time_minute),
          attendance_total = VALUES(attendance_total),
          home_formation_text = VALUES(home_formation_text),
          away_formation_text = VALUES(away_formation_text),
          home_coach_text = VALUES(home_coach_text),
          away_coach_text = VALUES(away_coach_text),
          home_statistics_data = VALUES(home_statistics_data),
          away_statistics_data = VALUES(away_statistics_data),
          home_lineup_data = VALUES(home_lineup_data),
          away_lineup_data = VALUES(away_lineup_data),
          home_bench_data = VALUES(home_bench_data),
          away_bench_data = VALUES(away_bench_data),
          goals_data = VALUES(goals_data),
          bookings_data = VALUES(bookings_data),
          substitutions_data = VALUES(substitutions_data),
          penalties_data = VALUES(penalties_data),
          referees_data = VALUES(referees_data),
          raw_match_data = VALUES(raw_match_data),
          detail_synced_at = VALUES(detail_synced_at)
      `,
      detail
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
  const values: Record<string, string | number> = {
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

export async function getMatchDetailSyncCandidates(params: {
  limit: number;
  finishedLookbackHours: number;
  finishedRefreshMinutes: number;
}) {
  const now = new Date();
  const candidateLimit = Math.max(1, Math.min(50, Math.floor(params.limit * 4)));
  const finishedSince = toMysqlDateTime(
    new Date(now.getTime() - params.finishedLookbackHours * 60 * 60 * 1000)
  );

  const [rows] = await pool.execute(
    `
      SELECT
        m.api_match_id,
        m.\`status\`,
        m.\`utc_date\`,
        d.detail_synced_at
      FROM matches m
      LEFT JOIN match_details d ON d.api_match_id = m.api_match_id
      WHERE m.competition_code = :competitionCode
        AND m.season = :season
        AND (
          m.\`status\` IN ('IN_PLAY', 'LIVE', 'PAUSED')
          OR (m.\`status\` = 'FINISHED' AND m.\`utc_date\` >= :finishedSince)
        )
      ORDER BY
        CASE WHEN m.\`status\` IN ('IN_PLAY', 'LIVE', 'PAUSED') THEN 0 ELSE 1 END ASC,
        COALESCE(d.detail_synced_at, '1970-01-01 00:00:00') ASC,
        m.\`utc_date\` ASC,
        m.api_match_id ASC
      LIMIT ${candidateLimit}
    `,
    {
      competitionCode: appConfig.competitionCode,
      season: appConfig.season,
      finishedSince
    }
  );

  const liveRefreshMs = 50 * 1000;
  const finishedRefreshMs = params.finishedRefreshMinutes * 60 * 1000;

  return (rows as DbMatchDetailSyncCandidate[])
    .filter((row) => {
      if (!row.detail_synced_at) {
        return true;
      }
      const lastSyncedAt = parseUtcDateTime(row.detail_synced_at);
      const elapsedMs = now.getTime() - lastSyncedAt.getTime();
      if (Number.isNaN(elapsedMs)) {
        return true;
      }
      return isLive(row.status)
        ? elapsedMs >= liveRefreshMs
        : elapsedMs >= finishedRefreshMs;
    })
    .slice(0, params.limit)
    .map((row) => ({
      apiMatchId: Number(row.api_match_id),
      status: row.status,
      utcDate: row.utc_date,
      detailSyncedAt: row.detail_synced_at
    }));
}

export async function getMatchDetailByApiId(apiMatchId: number) {
  const [rows] = await pool.execute(
    `
      SELECT
        m.*,
        d.id AS detail_id,
        d.match_minute,
        d.injury_time_minute,
        d.attendance_total,
        d.home_formation_text,
        d.away_formation_text,
        d.home_coach_text,
        d.away_coach_text,
        d.home_statistics_data,
        d.away_statistics_data,
        d.home_lineup_data,
        d.away_lineup_data,
        d.home_bench_data,
        d.away_bench_data,
        d.goals_data,
        d.bookings_data,
        d.substitutions_data,
        d.penalties_data,
        d.referees_data,
        d.detail_synced_at
      FROM matches m
      LEFT JOIN match_details d ON d.api_match_id = m.api_match_id
      WHERE m.competition_code = :competitionCode
        AND m.season = :season
        AND m.api_match_id = :apiMatchId
      LIMIT 1
    `,
    {
      competitionCode: appConfig.competitionCode,
      season: appConfig.season,
      apiMatchId
    }
  );

  const row = (rows as DbMatchDetail[])[0];
  if (!row) {
    return null;
  }

  return formatMatchDetail(row);
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
  half_time_home_score: number | null;
  half_time_away_score: number | null;
  extra_time_home_score: number | null;
  extra_time_away_score: number | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  winner: string | null;
  venue: string | null;
  last_updated: string | null;
};

type DbMatchDetailSyncCandidate = {
  api_match_id: number;
  status: string;
  utc_date: string;
  detail_synced_at: string | null;
};

type DbMatchDetail = DbMatch & {
  detail_id: number | null;
  match_minute: number | null;
  injury_time_minute: number | null;
  attendance_total: number | null;
  home_formation_text: string | null;
  away_formation_text: string | null;
  home_coach_text: string | null;
  away_coach_text: string | null;
  home_statistics_data: string | null;
  away_statistics_data: string | null;
  home_lineup_data: string | null;
  away_lineup_data: string | null;
  home_bench_data: string | null;
  away_bench_data: string | null;
  goals_data: string | null;
  bookings_data: string | null;
  substitutions_data: string | null;
  penalties_data: string | null;
  referees_data: string | null;
  detail_synced_at: string | null;
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
    beijingTimeText: toBeijingTimeText(match.utc_date),
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
      halfTimeHome: match.half_time_home_score,
      halfTimeAway: match.half_time_away_score,
      extraTimeHome: match.extra_time_home_score,
      extraTimeAway: match.extra_time_away_score,
      penaltyHome: match.penalty_home_score,
      penaltyAway: match.penalty_away_score
    },
    winner: match.winner,
    venue: match.venue,
    lastUpdated: match.last_updated,
    canViewDetail: isLive(match.status) || isFinished(match.status)
  };
}

function formatMatchDetail(row: DbMatchDetail) {
  return {
    ...formatMatch(row),
    detail: row.detail_id
      ? {
          matchMinute: row.match_minute,
          injuryTimeMinute: row.injury_time_minute,
          attendanceTotal: row.attendance_total,
          homeFormation: row.home_formation_text,
          awayFormation: row.away_formation_text,
          homeCoach: row.home_coach_text,
          awayCoach: row.away_coach_text,
          statistics: {
            home: parseJsonText(row.home_statistics_data),
            away: parseJsonText(row.away_statistics_data)
          },
          lineups: {
            home: parseJsonText(row.home_lineup_data),
            away: parseJsonText(row.away_lineup_data),
            homeBench: parseJsonText(row.home_bench_data),
            awayBench: parseJsonText(row.away_bench_data)
          },
          events: {
            goals: parseJsonText(row.goals_data) ?? [],
            bookings: parseJsonText(row.bookings_data) ?? [],
            substitutions: parseJsonText(row.substitutions_data) ?? [],
            penalties: parseJsonText(row.penalties_data) ?? []
          },
          referees: parseJsonText(row.referees_data) ?? [],
          detailSyncedAt: row.detail_synced_at
        }
      : null
  };
}

function parseJsonText(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
