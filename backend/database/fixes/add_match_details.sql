USE mini2026wc;

CREATE TABLE IF NOT EXISTS match_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  api_match_id BIGINT UNSIGNED NOT NULL,
  match_minute INT NULL,
  injury_time_minute INT NULL,
  attendance_total INT NULL,
  home_formation_text VARCHAR(64) NULL,
  away_formation_text VARCHAR(64) NULL,
  home_coach_text VARCHAR(128) NULL,
  away_coach_text VARCHAR(128) NULL,
  home_statistics_data LONGTEXT NULL,
  away_statistics_data LONGTEXT NULL,
  home_lineup_data LONGTEXT NULL,
  away_lineup_data LONGTEXT NULL,
  home_bench_data LONGTEXT NULL,
  away_bench_data LONGTEXT NULL,
  goals_data LONGTEXT NULL,
  bookings_data LONGTEXT NULL,
  substitutions_data LONGTEXT NULL,
  penalties_data LONGTEXT NULL,
  referees_data LONGTEXT NULL,
  raw_match_data LONGTEXT NULL,
  detail_synced_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_match_details_api_match_id (api_match_id),
  KEY idx_detail_synced_at (detail_synced_at),
  CONSTRAINT fk_match_details_match
    FOREIGN KEY (api_match_id)
    REFERENCES matches (api_match_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
