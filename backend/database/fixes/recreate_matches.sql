USE mini2026wc;

DROP TABLE IF EXISTS matches;

CREATE TABLE matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  api_match_id BIGINT UNSIGNED NOT NULL,
  competition_code VARCHAR(32) NOT NULL,
  season INT NOT NULL,
  matchday INT NULL,
  stage VARCHAR(64) NULL,
  group_name VARCHAR(32) NULL,
  `utc_date` DATETIME NOT NULL,
  beijing_date DATE NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  display_status VARCHAR(32) NOT NULL,
  home_team_api_id BIGINT UNSIGNED NULL,
  home_team_name VARCHAR(128) NULL,
  home_team_crest VARCHAR(512) NULL,
  away_team_api_id BIGINT UNSIGNED NULL,
  away_team_name VARCHAR(128) NULL,
  away_team_crest VARCHAR(512) NULL,
  home_score INT NULL,
  away_score INT NULL,
  half_time_home_score INT NULL,
  half_time_away_score INT NULL,
  extra_time_home_score INT NULL,
  extra_time_away_score INT NULL,
  penalty_home_score INT NULL,
  penalty_away_score INT NULL,
  winner VARCHAR(32) NULL,
  venue VARCHAR(255) NULL,
  last_updated DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_api_match_id (api_match_id),
  KEY idx_beijing_date (beijing_date),
  KEY idx_status (`status`),
  KEY idx_stage (stage),
  KEY idx_group_name (group_name),
  KEY idx_competition_season (competition_code, season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

