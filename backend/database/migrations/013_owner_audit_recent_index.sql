-- Keep newest-first Owner audit reads index-friendly.
-- The safe audit route orders by the monotonic primary key (id DESC).
-- This secondary index also supports admin-scoped recent-audit queries.
CREATE INDEX idx_vexa_admin_audit_recent ON vexa_admin_audit_log (created_at, id);
