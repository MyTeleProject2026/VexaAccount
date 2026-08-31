-- VexaAccount user profile/security metadata. Kept separate from SSO client state.
CREATE TABLE IF NOT EXISTS vexa_account_security_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0,
  security_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);
