const express = require('express');
const { pool } = require('../config/database');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');

const router = express.Router();
const VALID_STATUSES = new Set(['pending', 'active', 'disabled', 'maintenance', 'rejected', 'revoked']);
const CONTAINING_STATUSES = new Set(['disabled', 'maintenance', 'rejected', 'revoked']);

router.use(requireSuperAdmin);

// Compatibility handler for the Owner application's single Save button.
// The canonical registry already exposes a dedicated lifecycle endpoint, but
// the existing Save action also submits status. Handle that payload before the
// legacy generic PATCH route so the visible control cannot silently ignore it.
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
      const [result] = await connection.query(
        'UPDATE sso_client_registry SET status=?,updated_at=CURRENT_TIMESTAMP WHERE client_id=?',
        [status, req.params.clientId]
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'SSO application not found' });
      }
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
      res.json({ success: true, message: 'Application lifecycle status updated', client_id: req.params.clientId, status });
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
