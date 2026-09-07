const express = require('express');
const { pool } = require('../config/database');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');

const router = express.Router();

router.use(requireSuperAdmin);

// Fast, bounded audit reader for the Owner bootstrap path.
// Uses the audit table's monotonic primary key instead of sorting the full
// history by created_at, while preserving the same newest-first response.
router.get('/audit', async (req, res, next) => {
  try {
    const requested = Number(req.query.limit);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? Math.trunc(requested) : 100, 1), 250);
    const [rows] = await pool.query(
      `SELECT id, admin_id, action, resource_type, resource_id,
              ip_address, user_agent, metadata, created_at
         FROM vexa_admin_audit_log
        ORDER BY id DESC
        LIMIT ${limit}`
    );
    res.json({ success: true, events: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
