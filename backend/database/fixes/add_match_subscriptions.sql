USE mini2026wc;

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
