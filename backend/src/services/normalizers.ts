import { appConfig } from '../config/app.js';
import type {
  FootballDataMatch,
  FootballDataMatchDetail,
  FootballDataScorer,
  FootballDataStanding,
  FootballDataTeam
} from './footballDataClient.js';
import { parseUtcDateTime, toBeijingDate, toMysqlDateTime } from '../utils/time.js';
import { isLive, toDisplayStatus } from '../utils/status.js';

export type TeamRecord = {
  api_team_id: number;
  name: string;
  short_name: string | null;
  tla: string | null;
  crest: string | null;
  group_name: string | null;
};

export type MatchRecord = {
  api_match_id: number;
  competition_code: string;
  season: number;
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

export type MatchDetailRecord = {
  api_match_id: number;
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
  raw_match_data: string | null;
  detail_synced_at: string;
};

export type StandingRecord = {
  competition_code: string;
  season: number;
  group_name: string;
  position: number;
  team_api_id: number;
  team_name: string;
  team_crest: string | null;
  played_games: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  form: string | null;
};

export type ScorerRecord = {
  competition_code: string;
  season: number;
  rank_no: number;
  player_api_id: number | null;
  player_name: string;
  team_api_id: number | null;
  team_name: string | null;
  team_crest: string | null;
  goals: number;
  assists: number | null;
  penalties: number | null;
  played_matches: number | null;
};

export const UNKNOWN_GROUP_NAME = 'GROUP_UNKNOWN';
const LIVE_STATUS_STALE_MS = 5 * 60 * 60 * 1000;

export function normalizeTeam(team: FootballDataTeam, groupName: string | null = null): TeamRecord | null {
  if (!team.id || !team.name) {
    return null;
  }
  return {
    api_team_id: team.id,
    name: team.name,
    short_name: team.shortName ?? null,
    tla: team.tla ?? null,
    crest: team.crest ?? null,
    group_name: groupName
  };
}

export function normalizeMatch(match: FootballDataMatch): MatchRecord {
  const utcDate = toMysqlDateTime(match.utcDate);
  if (!utcDate) {
    throw new Error(`Invalid match utcDate for match ${match.id}`);
  }
  const status = normalizeMatchStatus(match);

  return {
    api_match_id: match.id,
    competition_code: appConfig.competitionCode,
    season: appConfig.season,
    matchday: match.matchday ?? null,
    stage: match.stage ?? null,
    group_name: normalizeGroupName(match.group),
    utc_date: utcDate,
    beijing_date: toBeijingDate(match.utcDate),
    status,
    display_status: toDisplayStatus(status),
    home_team_api_id: match.homeTeam?.id ?? null,
    home_team_name: match.homeTeam?.name ?? null,
    home_team_crest: match.homeTeam?.crest ?? null,
    away_team_api_id: match.awayTeam?.id ?? null,
    away_team_name: match.awayTeam?.name ?? null,
    away_team_crest: match.awayTeam?.crest ?? null,
    home_score: match.score?.fullTime?.home ?? null,
    away_score: match.score?.fullTime?.away ?? null,
    half_time_home_score: match.score?.halfTime?.home ?? null,
    half_time_away_score: match.score?.halfTime?.away ?? null,
    extra_time_home_score: match.score?.extraTime?.home ?? null,
    extra_time_away_score: match.score?.extraTime?.away ?? null,
    penalty_home_score: match.score?.penalties?.home ?? null,
    penalty_away_score: match.score?.penalties?.away ?? null,
    winner: match.score?.winner ?? null,
    venue: match.venue ?? null,
    last_updated: toMysqlDateTime(match.lastUpdated)
  };
}

function normalizeMatchStatus(match: FootballDataMatch) {
  const status = match.status;
  if (!isLive(status)) {
    return status;
  }

  const kickoffAt = parseUtcDateTime(match.utcDate);
  if (Number.isNaN(kickoffAt.getTime())) {
    return status;
  }

  const hasScore =
    match.score?.fullTime?.home !== null &&
    match.score?.fullTime?.home !== undefined &&
    match.score?.fullTime?.away !== null &&
    match.score?.fullTime?.away !== undefined;
  const elapsedMs = Date.now() - kickoffAt.getTime();

  return hasScore && elapsedMs >= LIVE_STATUS_STALE_MS ? 'FINISHED' : status;
}

export function normalizeMatchDetail(
  match: FootballDataMatchDetail,
  syncedAt = new Date()
): MatchDetailRecord {
  const detailSyncedAt = toMysqlDateTime(syncedAt);
  if (!detailSyncedAt) {
    throw new Error(`Invalid detail synced time for match ${match.id}`);
  }

  return {
    api_match_id: match.id,
    match_minute: match.minute ?? null,
    injury_time_minute: match.injuryTime ?? null,
    attendance_total: match.attendance ?? null,
    home_formation_text: match.homeTeam?.formation ?? null,
    away_formation_text: match.awayTeam?.formation ?? null,
    home_coach_text: match.homeTeam?.coach?.name ?? null,
    away_coach_text: match.awayTeam?.coach?.name ?? null,
    home_statistics_data: toJsonText(match.homeTeam?.statistics),
    away_statistics_data: toJsonText(match.awayTeam?.statistics),
    home_lineup_data: toJsonText(match.homeTeam?.lineup),
    away_lineup_data: toJsonText(match.awayTeam?.lineup),
    home_bench_data: toJsonText(match.homeTeam?.bench),
    away_bench_data: toJsonText(match.awayTeam?.bench),
    goals_data: toJsonText(match.goals),
    bookings_data: toJsonText(match.bookings),
    substitutions_data: toJsonText(match.substitutions),
    penalties_data: toJsonText(match.penalties),
    referees_data: toJsonText(match.referees),
    raw_match_data: toJsonText(match),
    detail_synced_at: detailSyncedAt
  };
}

export function normalizeStandings(standings: FootballDataStanding[]) {
  const rows: StandingRecord[] = [];
  const teams: TeamRecord[] = [];

  for (const standing of standings) {
    if (standing.type && standing.type !== 'TOTAL') {
      continue;
    }
    const table = standing.table ?? [];
    for (const row of table) {
      if (!row.team.id || !row.team.name) {
        continue;
      }
      const groupName = normalizeStandingGroup(standing.group ?? row.group);
      rows.push({
        competition_code: appConfig.competitionCode,
        season: appConfig.season,
        group_name: groupName,
        position: row.position,
        team_api_id: row.team.id,
        team_name: row.team.name,
        team_crest: row.team.crest ?? null,
        played_games: row.playedGames ?? 0,
        won: row.won ?? 0,
        draw: row.draw ?? 0,
        lost: row.lost ?? 0,
        points: row.points ?? 0,
        goals_for: row.goalsFor ?? 0,
        goals_against: row.goalsAgainst ?? 0,
        goal_difference: row.goalDifference ?? 0,
        form: row.form ?? null
      });

      const team = normalizeTeam(row.team, groupName === UNKNOWN_GROUP_NAME ? null : groupName);
      if (team) {
        teams.push(team);
      }
    }
  }

  return { rows, teams };
}

export function normalizeGroupName(group: string | null | undefined) {
  if (!group) {
    return null;
  }

  const normalized = group.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!normalized || normalized === 'GROUP_STAGE' || normalized === 'REGULAR_SEASON') {
    return null;
  }

  const groupLetter = normalized.match(/^(?:GROUP_?|GRP_|GROUPS_)?([A-L])$/);
  if (groupLetter) {
    return `GROUP_${groupLetter[1]}`;
  }

  return null;
}

function normalizeStandingGroup(group: string | undefined) {
  return normalizeGroupName(group) ?? UNKNOWN_GROUP_NAME;
}

export function normalizeScorers(scorers: FootballDataScorer[]) {
  return scorers
    .filter((scorer) => scorer.player?.name)
    .map<ScorerRecord>((scorer, index) => ({
      competition_code: appConfig.competitionCode,
      season: appConfig.season,
      rank_no: index + 1,
      player_api_id: scorer.player?.id ?? null,
      player_name: scorer.player?.name ?? '',
      team_api_id: scorer.team?.id ?? null,
      team_name: scorer.team?.name ?? null,
      team_crest: scorer.team?.crest ?? null,
      goals: scorer.goals ?? 0,
      assists: scorer.assists ?? null,
      penalties: scorer.penalties ?? null,
      played_matches: scorer.playedMatches ?? null
    }));
}

function toJsonText(value: unknown) {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}
