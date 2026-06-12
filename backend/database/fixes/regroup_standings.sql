USE mini2026wc;

-- Deprecated intentionally.
-- Do not update standings by row order. Football-data.org standings may not be
-- ordered by real World Cup groups, so row-order regrouping can put teams into
-- the wrong group.
--
-- Use this script instead:
-- backend/database/fixes/update_standings_group_from_matches.sql

SELECT
  'Do not run row-order regrouping. Use update_standings_group_from_matches.sql instead.' AS message;

