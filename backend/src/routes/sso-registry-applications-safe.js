const express = require('express');
const { pool } = require('../config/database');
const { withDeadline } = require('../utils/requestDeadline');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { normalizeJsonArray } = require('../services/ssoClient.service');

const router = express.Router();
const REGISTRY_LIST_TIMEOUT_MS = 8000;
router.use(requireSuperAdmin);

// Fast registry listing used by the Owner OS bootstrap.
// Bootstrap returns only authoritative registry/client configuration. Live
// session and refresh-token counts are deliberately excluded here because
// they are diagnostic data and must never block a successful Owner login.
router.get('/applications', auditAdminAction('sso.registry.list', 'sso_application'), async (req, res, next) => {
  try {
    const [rows] = await withDeadline(pool.query({
      sql: `
      SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,
             r.owner_label,r.description,r.created_at,r.updated_at,
             c.is_active,c.redirect_uris,c.allowed_scopes,c.last_used_at,c.secret_rotated_at
      FROM sso_client_registry r
      LEFT JOIN sso_clients c ON c.client_id=r.client_id
      ORDER BY r.display_name ASC
    `,
      timeout: REGISTRY_LIST_TIMEOUT_MS
    }), REGISTRY_LIST_TIMEOUT_MS, 'SSO application registry query timed out');

    return res.json({
      success: true,
      applications: rows.map(row => ({
        ...row,
        redirectUris: normalizeJsonArray(row.redirect_uris),
        allowedScopes: normalizeJsonArray(row.allowed_scopes, ['openid', 'profile', 'email'])
      }))
    });
  } catch (error) {
    if (error?.code === 'VEXA_REQUEST_TIMEOUT' || error?.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || /timeout/i.test(String(error?.message || ''))) {
      return res.status(503).json({ success: false, message: 'SSO application registry query timed out' });
    }
    return next(error);
  }
});

module.exports = router;
