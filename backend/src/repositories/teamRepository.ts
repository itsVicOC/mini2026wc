import { pool } from '../db/pool.js';
import { appConfig } from '../config/app.js';
import type { TeamRecord } from '../services/normalizers.js';
import { isFinished, isLive } from '../utils/status.js';
import { toBeijingTimeText } from '../utils/time.js';

export async function upsertTeams(teams: TeamRecord[]) {
  if (teams.length === 0) {
    return 0;
  }

  let count = 0;
  for (const team of teams) {
    await pool.execute(
      `
        INSERT INTO teams (api_team_id, name, short_name, tla, crest, group_name)
        VALUES (:api_team_id, :name, :short_name, :tla, :crest, :group_name)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          short_name = VALUES(short_name),
          tla = VALUES(tla),
          crest = VALUES(crest),
          group_name = COALESCE(VALUES(group_name), group_name)
      `,
      team
    );
    count += 1;
  }
  return count;
}

export async function getTeamDetail(apiTeamId: number) {
  const [[teamRows], [standingRows], [matchRows], [scorerRows]] = await Promise.all([
    pool.execute(
      `
        SELECT *
        FROM teams
        WHERE api_team_id = :apiTeamId
        LIMIT 1
      `,
      { apiTeamId }
    ),
    pool.execute(
      `
        SELECT *
        FROM standings
        WHERE competition_code = :competitionCode
          AND season = :season
          AND team_api_id = :apiTeamId
        LIMIT 1
      `,
      {
        competitionCode: appConfig.competitionCode,
        season: appConfig.season,
        apiTeamId
      }
    ),
    pool.execute(
      `
        SELECT *
        FROM matches
        WHERE competition_code = :competitionCode
          AND season = :season
          AND (home_team_api_id = :apiTeamId OR away_team_api_id = :apiTeamId)
        ORDER BY \`utc_date\` ASC, api_match_id ASC
      `,
      {
        competitionCode: appConfig.competitionCode,
        season: appConfig.season,
        apiTeamId
      }
    ),
    pool.execute(
      `
        SELECT *
        FROM scorers
        WHERE competition_code = :competitionCode
          AND season = :season
          AND team_api_id = :apiTeamId
        ORDER BY goals DESC, COALESCE(assists, 0) DESC, rank_no ASC, player_name ASC
        LIMIT 10
      `,
      {
        competitionCode: appConfig.competitionCode,
        season: appConfig.season,
        apiTeamId
      }
    )
  ]);

  const team = (teamRows as DbTeam[])[0];
  const standing = (standingRows as DbTeamStanding[])[0] ?? null;
  if (!team && !standing) {
    return null;
  }

  const matches = (matchRows as DbTeamMatch[]).map((match) => formatTeamMatch(match, apiTeamId));
  const finishedMatches = matches.filter((match) => match.isFinished);
  const upcomingMatches = matches.filter((match) => !match.isFinished);
  const liveMatches = matches.filter((match) => match.isLive);

  return {
    team: {
      apiTeamId,
      name: team?.name ?? standing?.team_name ?? null,
      shortName: team?.short_name ?? null,
      tla: team?.tla ?? null,
      crest: team?.crest ?? standing?.team_crest ?? null,
      group: standing?.group_name ?? team?.group_name ?? null
    },
    standing: standing
      ? {
          group: standing.group_name,
          position: standing.position,
          playedGames: standing.played_games,
          won: standing.won,
          draw: standing.draw,
          lost: standing.lost,
          points: standing.points,
          goalsFor: standing.goals_for,
          goalsAgainst: standing.goals_against,
          goalDifference: standing.goal_difference,
          form: standing.form,
          summaryText: buildStandingSummary(standing)
        }
      : null,
    overview: {
      finishedMatches: finishedMatches.length,
      upcomingMatches: upcomingMatches.length,
      liveMatches: liveMatches.length,
      goalsFor: calculateGoals(matches, 'for'),
      goalsAgainst: calculateGoals(matches, 'against')
    },
    matches,
    finishedMatches,
    upcomingMatches,
    scorers: (scorerRows as DbTeamScorer[]).map((scorer) => ({
      rank: scorer.rank_no,
      player: {
        apiPlayerId: scorer.player_api_id,
        name: scorer.player_name
      },
      goals: scorer.goals,
      assists: scorer.assists,
      penalties: scorer.penalties,
      playedMatches: scorer.played_matches
    }))
  };
}

function formatTeamMatch(match: DbTeamMatch, apiTeamId: number) {
  const isHome = Number(match.home_team_api_id) === apiTeamId;
  const teamScore = isHome ? match.home_score : match.away_score;
  const opponentScore = isHome ? match.away_score : match.home_score;
  const isMatchFinished = isFinished(match.status);

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
    venue: match.venue,
    isHome,
    isFinished: isMatchFinished,
    isLive: isLive(match.status),
    canViewDetail: isLive(match.status) || isMatchFinished,
    opponent: {
      apiTeamId: isHome ? match.away_team_api_id : match.home_team_api_id,
      name: isHome ? match.away_team_name : match.home_team_name,
      crest: isHome ? match.away_team_crest : match.home_team_crest
    },
    score: {
      team: teamScore,
      opponent: opponentScore,
      home: match.home_score,
      away: match.away_score,
      penaltyHome: match.penalty_home_score,
      penaltyAway: match.penalty_away_score
    },
    result: formatMatchResult(teamScore, opponentScore, isMatchFinished)
  };
}

function formatMatchResult(teamScore: number | null, opponentScore: number | null, isMatchFinished: boolean) {
  if (!isMatchFinished || teamScore === null || opponentScore === null) {
    return '';
  }
  if (teamScore > opponentScore) {
    return '胜';
  }
  if (teamScore < opponentScore) {
    return '负';
  }
  return '平';
}

function calculateGoals(
  matches: Array<ReturnType<typeof formatTeamMatch>>,
  side: 'for' | 'against'
) {
  return matches
    .filter((match) => match.isFinished)
    .reduce((sum, match) => {
      const value = side === 'for' ? match.score.team : match.score.opponent;
      return sum + (value ?? 0);
    }, 0);
}

function buildStandingSummary(standing: DbTeamStanding) {
  return `目前积 ${standing.points} 分，位列 ${standing.group_name} 第 ${standing.position}`;
}

type DbTeam = {
  api_team_id: number;
  name: string;
  short_name: string | null;
  tla: string | null;
  crest: string | null;
  group_name: string | null;
};

type DbTeamStanding = {
  group_name: string;
  position: number;
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

type DbTeamMatch = {
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
  venue: string | null;
};

type DbTeamScorer = {
  rank_no: number;
  player_api_id: number | null;
  player_name: string;
  goals: number;
  assists: number | null;
  penalties: number | null;
  played_matches: number | null;
};
