CREATE DATABASE IF NOT EXISTS mini2026wc
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE mini2026wc;

CREATE TABLE IF NOT EXISTS competitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  season INT NOT NULL,
  total_matches INT NOT NULL DEFAULT 104,
  start_date DATE NULL,
  end_date DATE NULL,
  last_synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_competition_code_season (code, season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  api_team_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(128) NOT NULL,
  short_name VARCHAR(128) NULL,
  tla VARCHAR(16) NULL,
  crest VARCHAR(512) NULL,
  group_name VARCHAR(32) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_api_team_id (api_team_id),
  KEY idx_group_name (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matches (
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

CREATE TABLE IF NOT EXISTS standings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  competition_code VARCHAR(32) NOT NULL,
  season INT NOT NULL,
  group_name VARCHAR(32) NOT NULL,
  position INT NOT NULL,
  team_api_id BIGINT UNSIGNED NOT NULL,
  team_name VARCHAR(128) NOT NULL,
  team_crest VARCHAR(512) NULL,
  played_games INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  draw INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  goals_for INT NOT NULL DEFAULT 0,
  goals_against INT NOT NULL DEFAULT 0,
  goal_difference INT NOT NULL DEFAULT 0,
  form VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_standing_team (competition_code, season, group_name, team_api_id),
  KEY idx_group_position (group_name, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scorers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  competition_code VARCHAR(32) NOT NULL,
  season INT NOT NULL,
  rank_no INT NOT NULL,
  player_api_id BIGINT UNSIGNED NULL,
  player_name VARCHAR(128) NOT NULL,
  team_api_id BIGINT UNSIGNED NULL,
  team_name VARCHAR(128) NULL,
  team_crest VARCHAR(512) NULL,
  goals INT NOT NULL DEFAULT 0,
  assists INT NULL,
  penalties INT NULL,
  played_matches INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_scorer_player (competition_code, season, player_name, team_name),
  KEY idx_goals (goals),
  KEY idx_rank_no (rank_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(64) NOT NULL,
  resource VARCHAR(64) NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  `status` VARCHAR(32) NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  upsert_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_resource_started_at (resource, started_at),
  KEY idx_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid VARCHAR(128) NOT NULL,
  api_match_id BIGINT UNSIGNED NOT NULL,
  template_id VARCHAR(128) NOT NULL,
  send_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  wx_msg_id VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_openid_match_template (openid, api_match_id, template_id),
  KEY idx_status_send_at (`status`, send_at),
  KEY idx_match_id (api_match_id),
  CONSTRAINT fk_match_subscriptions_match
    FOREIGN KEY (api_match_id)
    REFERENCES matches (api_match_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO competitions (code, name, season, total_matches, start_date, end_date)
VALUES ('WC', 'FIFA World Cup', 2026, 104, '2026-06-11', '2026-07-19')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  total_matches = VALUES(total_matches),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date);
