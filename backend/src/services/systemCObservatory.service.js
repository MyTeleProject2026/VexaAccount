const { pool } = require('../config/database');

const WINDOW_MINUTES = Math.min(60, Math.max(1, Number(process.env.VEXA_SYSTEM_C_WINDOW_MINUTES || 5)));

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function optionalQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    console.warn('[System C] optional telemetry query unavailable:', error.message);
    return [];
  }
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getDatabaseStatus() {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    const connected = Boolean(rows?.[0]?.ok);
    const statusRows = await optionalQuery(
      "SHOW STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Questions','Com_commit','Com_rollback')"
    );
    const status = Object.fromEntries(statusRows.map((row) => [String(row.Variable_name).toLowerCase(), number(row.Value)]));
    return {
      connected,
      connections: status.threads_connected || 0,
      running: status.threads_running || 0,
      questions: status.questions || 0,
      commits: status.com_commit || 0,
      rollbacks: status.com_rollback || 0,
      error: null,
    };
  } catch (error) {
    console.warn('[System C] database health query failed:', error.message);
    return {
      connected: false,
      connections: 0,
      running: 0,
      questions: 0,
      commits: 0,
      rollbacks: 0,
      error: 'Database health query failed',
    };
  }
}

async function getApplications() {
  try {
    const rows = await query(`
      SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,r.updated_at,
             c.is_active,c.last_used_at,
             (SELECT COUNT(*) FROM sso_sessions s
               WHERE s.client_id=r.client_id
                 AND s.revoked_at IS NULL
                 AND s.expires_at>NOW()) AS active_sessions
        FROM sso_client_registry r
        LEFT JOIN sso_clients c ON c.client_id=r.client_id
       ORDER BY r.display_name ASC
    `);
    return rows.map((row) => ({
      ...row,
      active: Boolean(row.is_active),
      activeSessions: number(row.active_sessions),
    }));
  } catch (error) {
    console.warn('[System C] application telemetry unavailable:', error.message);
    return [];
  }
}

async function getEvents() {
  const telemetry = await optionalQuery(`
    SELECT id,event_type,route,method,status_code,latency_ms,client_id,user_id,created_at
      FROM vexa_observability_events
     ORDER BY created_at DESC
     LIMIT 250
  `);
  const security = await optionalQuery(`
    SELECT id,event_type,client_id,user_id,created_at
      FROM sso_security_events
     ORDER BY created_at DESC
     LIMIT 200
  `);
  const audit = await optionalQuery(`
    SELECT id,action,resource_type,resource_id,created_at
      FROM vexa_admin_audit_log
     ORDER BY created_at DESC
     LIMIT 100
  `);

  return [
    ...telemetry.map((event) => ({ id: `api-${event.id}`, source: 'api-runtime', ...event })),
    ...security.map((event) => ({ id: `sso-${event.id}`, source: 'sso-security', ...event })),
    ...audit.map((event) => ({
      id: `audit-${event.id}`,
      source: 'owner-audit',
      event_type: event.action,
      client_id: event.resource_id,
      created_at: event.created_at,
      resource_type: event.resource_type,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 350);
}

async function getMetrics() {
  try {
    const [totals] = await query(`
      SELECT
        (SELECT COUNT(*) FROM sso_sessions
          WHERE revoked_at IS NULL AND expires_at>NOW()) AS activeSessions,
        (SELECT COUNT(*) FROM sso_consents WHERE revoked_at IS NULL) AS activeConsents,
        (SELECT COUNT(*) FROM sso_security_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL ${WINDOW_MINUTES} MINUTE)) AS securityEventsWindow,
        (SELECT COUNT(*) FROM vexa_observability_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL ${WINDOW_MINUTES} MINUTE)
            AND status_code>=400) AS failuresWindow,
        (SELECT COUNT(*) FROM vexa_observability_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE)) AS apiEventsMinute,
        (SELECT COALESCE(AVG(latency_ms),0) FROM vexa_observability_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE)) AS apiLatencyMs,
        (SELECT COUNT(*) FROM vexa_observability_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE)
            AND status_code BETWEEN 200 AND 399) AS apiSuccessMinute,
        (SELECT COUNT(*) FROM vexa_observability_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE)
            AND status_code>=400) AS apiFailureMinute,
        (SELECT COUNT(*) FROM vexa_observability_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL ${WINDOW_MINUTES} MINUTE)
            AND route LIKE '/api/auth/%'
            AND status_code BETWEEN 200 AND 399) AS identitySuccessWindow,
        (SELECT COUNT(*) FROM vexa_observability_events
          WHERE created_at>=DATE_SUB(NOW(),INTERVAL ${WINDOW_MINUTES} MINUTE)
            AND route LIKE '/api/auth/%'
            AND status_code>=400) AS identityFailureWindow
    `);

    const apiTotal = number(totals?.apiEventsMinute);
    const apiFailures = number(totals?.apiFailureMinute);
    const identitySuccess = number(totals?.identitySuccessWindow);
    const identityFailures = number(totals?.identityFailureWindow);
    const identityTotal = identitySuccess + identityFailures;

    return {
      activeSessions: number(totals?.activeSessions),
      activeConsents: number(totals?.activeConsents),
      securityEventsWindow: number(totals?.securityEventsWindow),
      failuresWindow: number(totals?.failuresWindow),
      apiEventsMinute: apiTotal,
      apiLatencyMs: Math.round(number(totals?.apiLatencyMs)),
      apiSuccessMinute: number(totals?.apiSuccessMinute),
      apiFailureMinute: apiFailures,
      apiSuccessRate: apiTotal ? Math.round(((apiTotal - apiFailures) / apiTotal) * 10000) / 100 : 100,
      identitySuccessWindow: identitySuccess,
      identityFailureWindow: identityFailures,
      identityActivityWindow: identityTotal,
      identityHealth: identityTotal ? Math.round((identitySuccess / identityTotal) * 10000) / 100 : 100,
      windowMinutes: WINDOW_MINUTES,
      available: true,
      error: null,
    };
  } catch (error) {
    console.warn('[System C] metrics telemetry unavailable:', error.message);
    return {
      activeSessions: 0,
      activeConsents: 0,
      securityEventsWindow: 0,
      failuresWindow: 0,
      apiEventsMinute: 0,
      apiLatencyMs: 0,
      apiSuccessMinute: 0,
      apiFailureMinute: 0,
      apiSuccessRate: 100,
      identitySuccessWindow: 0,
      identityFailureWindow: 0,
      identityActivityWindow: 0,
      identityHealth: 0,
      windowMinutes: WINDOW_MINUTES,
      available: false,
      error: 'Metrics telemetry unavailable',
    };
  }
}

async function buildSnapshot() {
  const started = Date.now();
  const [databaseStatus, metrics, applications, events] = await Promise.all([
    getDatabaseStatus(),
    getMetrics(),
    getApplications(),
    getEvents(),
  ]);

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    database: databaseStatus.connected,
    databaseStatus,
    metrics,
    applications,
    events,
  };
}

async function cleanupTelemetry() {
  const days = Math.min(90, Math.max(1, Number(process.env.VEXA_OBSERVABILITY_RETENTION_DAYS || 30)));
  try {
    const result = await pool.query(
      `DELETE FROM vexa_observability_events WHERE created_at < DATE_SUB(NOW(), INTERVAL ${days} DAY)`
    );
    return { deleted: Number(result?.[0]?.affectedRows || 0), retentionDays: days };
  } catch (error) {
    console.warn('[System C] telemetry cleanup skipped:', error.message);
    return { deleted: 0, retentionDays: days, skipped: true };
  }
}

module.exports = { buildSnapshot, cleanupTelemetry, WINDOW_MINUTES };
