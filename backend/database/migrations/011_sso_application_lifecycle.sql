-- Complete application lifecycle states used by the Super Admin registry.
ALTER TABLE sso_client_registry
  MODIFY COLUMN status ENUM('pending','active','disabled','maintenance','rejected','revoked') NOT NULL DEFAULT 'pending';
