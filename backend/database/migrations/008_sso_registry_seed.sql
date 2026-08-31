-- Canonical registry keys for the Vexa ecosystem.
-- Client credentials and redirect URIs are provisioned separately; this migration only
-- establishes stable application identities for the Super Admin control plane.

INSERT INTO sso_client_registry (client_id, display_name, application_key, environment, status, description)
VALUES
  ('vexatrade', 'VexaTrade', 'vexa-trade', 'production', 'active', 'VexaTrade ecosystem application'),
  ('vexastore', 'VexaStore', 'vexa-store', 'production', 'active', 'VexaStore ecosystem application'),
  ('vexatrade-certificate-system', 'VexaTrade Certificate System', 'vexa-trade-certificate-system', 'production', 'active', 'VexaTrade certificate services'),
  ('vexatrade-ecosystem-site', 'VexaTrade Ecosystem', 'vexa-trade-ecosystem-site', 'production', 'active', 'Vexa ecosystem news and ebooks site')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;
