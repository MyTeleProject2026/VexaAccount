const express = require('express');
const { pool } = require('../config/database');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');

const router = express.Router();
const VALID_STATUSES = new Set(['pending', 'active', 'disabled', 'maintenance', 'rejected', 'revoked']);
const CONTAINING_STATUSES = new Set(['disabled', 'maintenance', 'rejected', 'revoked']);
const clean = (value, max) => { const text = String(value ?? '').trim(); return text ? text.slice(0, max) : null; };

router.use(requireSuperAdmin);

// Compatibility handler for the Owner application's single Save button.
// The canonical registry exposes a dedicated lifecycle endpoint, but the
// existing Save action submits lifecycle status together with registry fields.
// Handle the complete submitted payload before the legacy generic PATCH route
// so none of the visible Save controls are silently ignored.
router.patch('/applications/:clientId', async (req, res, next) => {
  if (req.body?.status === undefined) return next();
  try {
    const status = String(req.body.status || '');
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query(
        'SELECT client_id FROM sso_client_registry WHERE client_id=? LIMIT 1',
        [req.params.clientId]
      );
      if (!existing.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'SSO application not found' });
      }

      await connection.query(
        `UPDATE sso_client_registry
            SET display_name=?, owner_label=?, environment=?, description=?, status=?, updated_at=CURRENT_TIMESTAMP
          WHERE client_id=?`,
        [
          clean(req.body.displayName ?? req.body.name, 255),
          clean(req.body.ownerLabel, 255),
          clean(req.body.environment, 32) || 'production',
          clean(req.body.description, 1000),
          status,
          req.params.clientId
        ]
      );
      await connection.query(
        'UPDATE sso_clients SET is_active=? WHERE client_id=?',
        [status === 'active' ? 1 : 0, req.params.clientId]
      );
      if (CONTAINING_STATUSES.has(status)) {
        await connection.query(
          'UPDATE sso_sessions SET revoked_at=NOW() WHERE client_id=? AND revoked_at IS NULL',
          [req.params.clientId]
        );
        await connection.query(
          'UPDATE sso_refresh_tokens SET revoked_at=NOW() WHERE client_id=? AND revoked_at IS NULL',
          [req.params.clientId]
        );
      }
      await connection.commit();
      res.json({ success: true, message: 'Application configuration and lifecycle status updated', client_id: req.params.clientId, status });
    } catch (error) {
      try { await connection.rollback(); } catch {}
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
