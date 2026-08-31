-- Complete application lifecycle states used by the Super Admin registry.
ALTER TABLE sso_client_registry
  MODIFY COLUMN status ENUM('pending','active','disabled','maintenance','revoked') NOT NULL DEFAULT 'pending';

UPDATE sso_client_registry
SET status='active'
WHERE status='active';
