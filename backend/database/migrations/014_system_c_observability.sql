-- System C runtime telemetry. Stores safe operational facts only; never secrets or tokens.
CREATE TABLE IF NOT EXISTS vexa_observability_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(100) NOT NULL,
  route VARCHAR(255) NULL,
  method VARCHAR(10) NULL,
  status_code SMALLINT UNSIGNED NULL,
  latency_ms INT UNSIGNED NULL,
  client_id VARCHAR(128) NULL,
  user_id BIGINT UNSIGNED NULL,
  ip_address VARCHAR(45) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_obs_time (created_at),
  KEY idx_vexa_obs_type_time (event_type, created_at),
  KEY idx_vexa_obs_client_time (client_id, created_at),
  KEY idx_vexa_obs_route_time (route, created_at)
);
