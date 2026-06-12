import { pool } from '../db/pool.js';
import { appConfig } from '../config/app.js';
import type { ScorerRecord } from '../services/normalizers.js';

export async function upsertScorers(scorers: ScorerRecord[]) {
  if (scorers.length === 0) {
    return 0;
  }

  let count = 0;
  for (const scorer of scorers) {
    await pool.execute(
      `
        INSERT INTO scorers (
          competition_code, season, rank_no, player_api_id, player_name,
          team_api_id, team_name, team_crest, goals, assists, penalties, played_matches
        )
        VALUES (
          :competition_code, :season, :rank_no, :player_api_id, :player_name,
          :team_api_id, :team_name, :team_crest, :goals, :assists, :penalties, :played_matches
        )
        ON DUPLICATE KEY UPDATE
          rank_no = VALUES(rank_no),
          player_api_id = VALUES(player_api_id),
          team_api_id = VALUES(team_api_id),
          team_name = VALUES(team_name),
          team_crest = VALUES(team_crest),
          goals = VALUES(goals),
          assists = VALUES(assists),
          penalties = VALUES(penalties),
          played_matches = VALUES(played_matches)
      `,
      scorer
    );
    count += 1;
  }
  return count;
}

export async function getScorers(limit: number) {
  const safeLimit = Math.max(1, Math.min(100, Number.isFinite(limit) ? Math.floor(limit) : 20));
  const [rows] = await pool.execute(
    `
      SELECT *
      FROM scorers
      WHERE competition_code = :competitionCode AND season = :season
      ORDER BY goals DESC, COALESCE(assists, 0) DESC, rank_no ASC, player_name ASC
      LIMIT ${safeLimit}
    `,
    {
      competitionCode: appConfig.competitionCode,
      season: appConfig.season
    }
  );

  return (rows as DbScorer[]).map((row) => ({
    rank: row.rank_no,
    player: {
      apiPlayerId: row.player_api_id,
      name: row.player_name
    },
    team: {
      apiTeamId: row.team_api_id,
      name: row.team_name,
      crest: row.team_crest
    },
    goals: row.goals,
    assists: row.assists,
    penalties: row.penalties,
    playedMatches: row.played_matches
  }));
}

type DbScorer = {
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
