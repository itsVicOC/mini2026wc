USE mini2026wc;

-- Emergency historical-data fix only.
-- Normal sync must use football-data.org standings[].group as the source of truth.
-- Run this only when old rows were already stored as GROUP_STAGE or GROUP_UNKNOWN.

UPDATE standings s
JOIN (
  SELECT team_api_id, group_name
  FROM (
    SELECT
      team_api_id,
      group_name,
      ROW_NUMBER() OVER (
        PARTITION BY team_api_id
        ORDER BY match_count DESC, group_name ASC
      ) AS rn
    FROM (
      SELECT team_api_id, group_name, COUNT(*) AS match_count
      FROM (
        SELECT home_team_api_id AS team_api_id, group_name
        FROM matches
        WHERE competition_code = 'WC'
          AND season = 2026
          AND group_name IS NOT NULL
          AND group_name <> 'GROUP_STAGE'
          AND home_team_api_id IS NOT NULL
        UNION ALL
        SELECT away_team_api_id AS team_api_id, group_name
        FROM matches
        WHERE competition_code = 'WC'
          AND season = 2026
          AND group_name IS NOT NULL
          AND group_name <> 'GROUP_STAGE'
          AND away_team_api_id IS NOT NULL
      ) match_groups
      GROUP BY team_api_id, group_name
    ) counted_match_groups
  ) ranked_match_groups
  WHERE rn = 1
) fixed ON fixed.team_api_id = s.team_api_id
SET s.group_name = fixed.group_name
WHERE s.competition_code = 'WC'
  AND s.season = 2026
  AND s.group_name IN ('GROUP_STAGE', 'GROUP_UNKNOWN');

UPDATE teams t
JOIN (
  SELECT team_api_id, group_name
  FROM (
    SELECT
      team_api_id,
      group_name,
      ROW_NUMBER() OVER (
        PARTITION BY team_api_id
        ORDER BY match_count DESC, group_name ASC
      ) AS rn
    FROM (
      SELECT team_api_id, group_name, COUNT(*) AS match_count
      FROM (
        SELECT home_team_api_id AS team_api_id, group_name
        FROM matches
        WHERE competition_code = 'WC'
          AND season = 2026
          AND group_name IS NOT NULL
          AND group_name <> 'GROUP_STAGE'
          AND home_team_api_id IS NOT NULL
        UNION ALL
        SELECT away_team_api_id AS team_api_id, group_name
        FROM matches
        WHERE competition_code = 'WC'
          AND season = 2026
          AND group_name IS NOT NULL
          AND group_name <> 'GROUP_STAGE'
          AND away_team_api_id IS NOT NULL
      ) match_groups
      GROUP BY team_api_id, group_name
    ) counted_match_groups
  ) ranked_match_groups
  WHERE rn = 1
) fixed ON fixed.team_api_id = t.api_team_id
SET t.group_name = fixed.group_name;
