-- VexaAccount owner-controlled platform settings and user account-center preferences.
CREATE TABLE IF NOT EXISTS vexa_platform_settings (
  setting_key VARCHAR(128) NOT NULL,
  setting_value JSON NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
);

CREATE TABLE IF NOT EXISTS vexa_account_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  locale VARCHAR(32) NOT NULL DEFAULT 'en',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  marketing_email_enabled TINYINT(1) NOT NULL DEFAULT 0,
  security_email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

INSERT IGNORE INTO vexa_platform_settings (setting_key, setting_value)
VALUES
 ('ecosystem.scopes', JSON_ARRAY('openid','profile','email','account','session','applications','notifications')),
 ('ecosystem.sso.enabled', JSON_OBJECT('enabled', true)),
 ('ecosystem.registration.mode', JSON_OBJECT('mode','owner_approval')),
 ('ecosystem.session.maxHours', JSON_OBJECT('hours',8));
