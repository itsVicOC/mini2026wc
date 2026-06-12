import { pool } from '../db/pool.js';
import { appConfig } from '../config/app.js';
import type { StandingRecord } from '../services/normalizers.js';

export async function clearStandings() {
  await pool.execute(
    `
      DELETE FROM standings
      WHERE competition_code = :competitionCode AND season = :season
    `,
    {
      competitionCode: appConfig.competitionCode,
      season: appConfig.season
    }
  );
}

export async function upsertStandings(rows: StandingRecord[]) {
  if (rows.length === 0) {
    return 0;
  }

  let count = 0;
  for (const row of rows) {
    await pool.execute(
      `
        INSERT INTO standings (
          competition_code, season, group_name, position, team_api_id, team_name, team_crest,
          played_games, won, draw, lost, points, goals_for, goals_against, goal_difference, form
        )
        VALUES (
          :competition_code, :season, :group_name, :position, :team_api_id, :team_name, :team_crest,
          :played_games, :won, :draw, :lost, :points, :goals_for, :goals_against, :goal_difference, :form
        )
        ON DUPLICATE KEY UPDATE
          position = VALUES(position),
          team_name = VALUES(team_name),
          team_crest = VALUES(team_crest),
          played_games = VALUES(played_games),
          won = VALUES(won),
          draw = VALUES(draw),
          lost = VALUES(lost),
          points = VALUES(points),
          goals_for = VALUES(goals_for),
          goals_against = VALUES(goals_against),
          goal_difference = VALUES(goal_difference),
          form = VALUES(form)
      `,
      row
    );
    count += 1;
  }
  return count;
}

export async function getStandings(group?: string) {
  const conditions = ['competition_code = :competitionCode', 'season = :season'];
  const values: Record<string, unknown> = {
    competitionCode: appConfig.competitionCode,
    season: appConfig.season
  };
  const normalizedGroup = normalizeFilter(group);
  if (normalizedGroup) {
    conditions.push('(group_name = :groupName OR group_name = :groupNameWithSpace OR group_name = :groupNameWithoutPrefix)');
    values.groupName = normalizedGroup;
    values.groupNameWithSpace = normalizedGroup.replace('_', ' ');
    values.groupNameWithoutPrefix = normalizedGroup.replace('GROUP_', '');
  }

  const [rows] = await pool.execute(
    `
      SELECT *
      FROM standings
      WHERE ${conditions.join(' AND ')}
      ORDER BY group_name ASC, position ASC
    `,
    values
  );

  return (rows as DbStanding[]).map((row) => ({
    group: row.group_name,
    position: row.position,
    team: {
      apiTeamId: row.team_api_id,
      name: row.team_name,
      crest: row.team_crest
    },
    playedGames: row.played_games,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    points: row.points,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDifference: row.goal_difference,
    form: row.form
  }));
}

function normalizeFilter(value?: string) {
  if (!value || value === 'undefined' || value === 'null') {
    return undefined;
  }
  return value;
}

type DbStanding = {
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
