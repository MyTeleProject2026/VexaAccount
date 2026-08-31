-- Account-center passcode enrollment metadata.
ALTER TABLE store_users ADD COLUMN IF NOT EXISTS passcode_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE store_users ADD COLUMN IF NOT EXISTS passcode_hash VARCHAR(255) NULL;
