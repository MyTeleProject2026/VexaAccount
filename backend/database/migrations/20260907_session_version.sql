ALTER TABLE store_users
  ADD COLUMN session_version INT NOT NULL DEFAULT 1;

UPDATE store_users
SET session_version = 1
WHERE session_version IS NULL;
