import { pool } from '../db/pool.js';
import type { TeamRecord } from '../services/normalizers.js';

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

