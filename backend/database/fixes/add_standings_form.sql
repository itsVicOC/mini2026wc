USE mini2026wc;

SET @standings_form_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'standings'
    AND COLUMN_NAME = 'form'
);

SET @standings_form_sql = IF(
  @standings_form_exists = 0,
  'ALTER TABLE standings ADD COLUMN form VARCHAR(64) NULL AFTER goal_difference',
  'SELECT ''standings.form already exists'' AS message'
);

PREPARE standings_form_stmt FROM @standings_form_sql;
EXECUTE standings_form_stmt;
DEALLOCATE PREPARE standings_form_stmt;
