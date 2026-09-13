ALTER TABLE owner_operations
  ADD COLUMN worker_id VARCHAR(128) NULL,
  ADD COLUMN lease_until DATETIME(3) NULL,
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN last_error_code VARCHAR(120) NULL;

CREATE INDEX idx_owner_operations_lease ON owner_operations (status, lease_until);
