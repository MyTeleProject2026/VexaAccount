const express = require('express');
const { pool } = require('../config/database');
const { withDeadline } = require('../utils/requestDeadline');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');

const router = express.Router();
const AUDIT_LIST_TIMEOUT_MS = 8000;

router.use(requireSuperAdmin);

// Fast, bounded audit reader for the Owner bootstrap path.
// Uses the audit table's monotonic primary key instead of sorting the full
// history by created_at, while preserving the same newest-first response.
router.get('/audit', async (req, res, next) => {
  try {
    const requested = Number(req.query.limit);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? Math.trunc(requested) : 100, 1), 250);
    const [rows] = await withDeadline(pool.query({
      sql: `SELECT id, admin_id, action, resource_type, resource_id,
              ip_address, user_agent, metadata, created_at
         FROM vexa_admin_audit_log
        ORDER BY id DESC
        LIMIT ${limit}`,
      timeout: AUDIT_LIST_TIMEOUT_MS
    }), AUDIT_LIST_TIMEOUT_MS, 'SSO audit query timed out');
    res.json({ success: true, events: rows });
  } catch (error) {
    if (error?.code === 'VEXA_REQUEST_TIMEOUT' || error?.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || /timeout/i.test(String(error?.message || ''))) {
      return res.status(503).json({ success: false, message: 'SSO audit query timed out' });
    }
    next(error);
  }
});

module.exports = router;
