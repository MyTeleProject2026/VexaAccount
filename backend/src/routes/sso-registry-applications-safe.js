const express = require('express');
const { pool } = require('../config/database');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { normalizeJsonArray } = require('../services/ssoClient.service');

const router = express.Router();
router.use(requireSuperAdmin);

// Fast, bounded registry listing used by the Owner OS bootstrap.
// It preserves the existing response contract while avoiding per-row correlated
// session/refresh-token COUNT subqueries that can hold the request open.
router.get('/applications', auditAdminAction('sso.registry.list', 'sso_application'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,
             r.owner_label,r.description,r.created_at,r.updated_at,
             c.is_active,c.redirect_uris,c.allowed_scopes,c.last_used_at,c.secret_rotated_at
      FROM sso_client_registry r
      LEFT JOIN sso_clients c ON c.client_id=r.client_id
      ORDER BY r.display_name ASC
    `);

    if (!rows.length) {
      return res.json({ success: true, applications: [] });
    }

    const clientIds = rows.map(row => row.client_id).filter(Boolean);
    const placeholders = clientIds.map(() => '?').join(',');

    const [sessionCounts] = await pool.query(`
      SELECT client_id, COUNT(*) AS active_sessions
      FROM sso_sessions
      WHERE client_id IN (${placeholders})
        AND revoked_at IS NULL
        AND expires_at > NOW()
      GROUP BY client_id
    `, clientIds);

    const [refreshCounts] = await pool.query(`
      SELECT client_id, COUNT(*) AS active_refresh_tokens
      FROM sso_refresh_tokens
      WHERE client_id IN (${placeholders})
        AND revoked_at IS NULL
        AND expires_at > NOW()
      GROUP BY client_id
    `, clientIds);

    const sessionsByClient = new Map(sessionCounts.map(row => [row.client_id, Number(row.active_sessions || 0)]));
    const refreshByClient = new Map(refreshCounts.map(row => [row.client_id, Number(row.active_refresh_tokens || 0)]));

    return res.json({
      success: true,
      applications: rows.map(row => ({
        ...row,
        active_sessions: sessionsByClient.get(row.client_id) || 0,
        active_refresh_tokens: refreshByClient.get(row.client_id) || 0,
        redirectUris: normalizeJsonArray(row.redirect_uris),
        allowedScopes: normalizeJsonArray(row.allowed_scopes, ['openid', 'profile', 'email'])
      }))
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
