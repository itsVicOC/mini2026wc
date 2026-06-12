import { FootballDataClient } from './footballDataClient.js';
import {
  UNKNOWN_GROUP_NAME,
  normalizeMatch,
  normalizeScorers,
  normalizeStandings,
  normalizeTeam
} from './normalizers.js';
import { getTeamGroupMapFromMatches, upsertMatches } from '../repositories/matchRepository.js';
import { upsertScorers } from '../repositories/scorerRepository.js';
import { clearStandings, upsertStandings } from '../repositories/standingRepository.js';
import { upsertTeams } from '../repositories/teamRepository.js';
import { createSyncLog, finishSyncLog } from '../repositories/syncLogRepository.js';
import { clearCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import { pool } from '../db/pool.js';
import { appConfig } from '../config/app.js';
import { toMysqlDateTime } from '../utils/time.js';

const client = new FootballDataClient();

export async function inspectFootballDataStandings() {
  const response = await client.getStandings();
  return {
    count: response.standings?.length ?? 0,
    summary: summarizeStandingsResponse(response.standings ?? [])
  };
}

export async function syncAll(jobName = 'manual') {
  const results = [];
  results.push(await syncTeams(jobName));
  results.push(await syncMatches(jobName));
  results.push(await syncStandings(jobName));
  results.push(await syncScorers(jobName));
  clearCache();

  await pool.execute(
    `
      UPDATE competitions
      SET last_synced_at = :lastSyncedAt
      WHERE code = :code AND season = :season
    `,
    {
      lastSyncedAt: toMysqlDateTime(new Date()),
      code: appConfig.competitionCode,
      season: appConfig.season
    }
  );

  return results;
}

export async function syncTeams(jobName: string) {
  const logId = await createSyncLog(jobName, 'teams');
  try {
    const response = await client.getTeams();
    const teams = (response.teams ?? [])
      .map((team) => normalizeTeam(team))
      .filter(isPresent);
    const upsertCount = await upsertTeams(teams);
    await finishSyncLog(logId, {
      status: 'success',
      requestCount: 1,
      upsertCount
    });
    return { resource: 'teams', status: 'success', upsertCount };
  } catch (error) {
    return handleSyncError(logId, 'teams', error);
  }
}

export async function syncMatches(jobName: string) {
  const logId = await createSyncLog(jobName, 'matches');
  try {
    const response = await client.getMatches();
    const matches = (response.matches ?? []).map(normalizeMatch);
    const teams = (response.matches ?? [])
      .flatMap((match) => [match.homeTeam, match.awayTeam])
      .map((team) => (team ? normalizeTeam(team) : null))
      .filter(isPresent);
    await upsertTeams(teams);
    const upsertCount = await upsertMatches(matches);
    await finishSyncLog(logId, {
      status: 'success',
      requestCount: 1,
      upsertCount
    });
    clearCache();
    return { resource: 'matches', status: 'success', upsertCount };
  } catch (error) {
    return handleSyncError(logId, 'matches', error);
  }
}

export async function syncStandings(jobName: string) {
  const logId = await createSyncLog(jobName, 'standings');
  try {
    const response = await client.getStandings();
    const { rows, teams } = normalizeStandings(response.standings ?? []);
    const summary = summarizeStandingsResponse(response.standings ?? []);
    logger.info({ jobName, summary }, 'football-data standings response summary');

    let teamGroupMap = await getTeamGroupMapFromMatches();
    if (rows.length > 0 && teamGroupMap.size === 0 && hasUnknownGroups(rows)) {
      logger.info({ jobName }, 'match group map is empty, syncing matches before standings');
      await syncMatches(`${jobName}-matches`);
      teamGroupMap = await getTeamGroupMapFromMatches();
    }

    const resolvedRows = rows.map((row) => ({
      ...row,
      group_name: row.group_name === UNKNOWN_GROUP_NAME
        ? teamGroupMap.get(row.team_api_id) ?? row.group_name
        : row.group_name
    }));

    if (resolvedRows.length > 0 && hasUnknownGroups(resolvedRows)) {
      throw new Error(`Cannot sync standings because some groups are unknown: ${JSON.stringify(summary)}`);
    }

    const resolvedTeams = teams.map((team) => ({
      ...team,
      group_name: team.group_name ?? teamGroupMap.get(team.api_team_id) ?? null
    }));

    await upsertTeams(resolvedTeams);
    await clearStandings();
    const upsertCount = await upsertStandings(normalizeFallbackGroupPositions(resolvedRows));
    await finishSyncLog(logId, {
      status: 'success',
      requestCount: 1,
      upsertCount
    });
    clearCache();
    return { resource: 'standings', status: 'success', upsertCount };
  } catch (error) {
    return handleSyncError(logId, 'standings', error);
  }
}

export async function syncScorers(jobName: string) {
  const logId = await createSyncLog(jobName, 'scorers');
  try {
    const response = await client.getScorers();
    const scorers = normalizeScorers(response.scorers ?? []);
    const upsertCount = await upsertScorers(scorers);
    await finishSyncLog(logId, {
      status: 'success',
      requestCount: 1,
      upsertCount
    });
    clearCache();
    return { resource: 'scorers', status: 'success', upsertCount };
  } catch (error) {
    return handleSyncError(logId, 'scorers', error);
  }
}

async function handleSyncError(logId: number, resource: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn({ resource, error: errorMessage }, 'sync resource failed');
  await finishSyncLog(logId, {
    status: 'failed',
    requestCount: 1,
    upsertCount: 0,
    errorMessage
  });
  return {
    resource,
    status: 'failed',
    upsertCount: 0,
    errorMessage
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function hasUnknownGroups(rows: Array<{ group_name: string }>) {
  return rows.some((row) => row.group_name === UNKNOWN_GROUP_NAME);
}

function normalizeFallbackGroupPositions<T extends {
  group_name: string;
  position: number;
  points: number;
  goal_difference: number;
  goals_for: number;
  won: number;
  goals_against: number;
  team_name: string;
}>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(row.group_name, [...(grouped.get(row.group_name) ?? []), row]);
  }

  return Array.from(grouped.values()).flatMap((groupRows) => {
    if (hasConsecutivePositions(groupRows)) {
      return groupRows;
    }

    return [...groupRows]
      .sort(compareStandingRows)
      .map((row, index) => ({
        ...row,
        position: index + 1
      }));
  });
}

function hasConsecutivePositions(rows: Array<{ position: number }>) {
  const positions = rows.map((row) => row.position).sort((a, b) => a - b);
  return positions.every((position, index) => position === index + 1);
}

function compareStandingRows<T extends {
  points: number;
  goal_difference: number;
  goals_for: number;
  won: number;
  goals_against: number;
  team_name: string;
}>(a: T, b: T) {
  return (
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for ||
    b.won - a.won ||
    a.goals_against - b.goals_against ||
    a.team_name.localeCompare(b.team_name)
  );
}

function summarizeStandingsResponse(standings: Array<{
  stage?: string;
  type?: string;
  group?: string;
  table?: Array<{ group?: string }>;
}>) {
  return standings.map((standing, index) => ({
    index,
    stage: standing.stage ?? null,
    type: standing.type ?? null,
    group: standing.group ?? null,
    tableLength: standing.table?.length ?? 0,
    rowGroups: Array.from(
      new Set((standing.table ?? []).map((row) => row.group).filter(Boolean))
    )
  }));
}
