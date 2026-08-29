const express = require('express');
const crypto = require('crypto');
const { pool } = require('../../vexaccount/src/config/database');

const router = express.Router();
const REGISTRY_ADMIN_KEY = process.env.VEXA_SSO_REGISTRY_ADMIN_KEY;

function requireRegistryAdmin(req, res, next) {
  if (!REGISTRY_ADMIN_KEY) return res.status(503).json({ success: false, message: 'SSO registry administration is not configured' });
  const supplied = req.get('x-vexa-registry-key');
  if (!supplied || supplied.length !== REGISTRY_ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(REGISTRY_ADMIN_KEY))) return res.status(403).json({ success: false, message: 'Forbidden' });
  next();
}

router.get('/applications', requireRegistryAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT r.client_id, r.display_name, r.application_key, r.environment, r.status, r.owner_label, r.description, r.created_at, r.updated_at, c.is_active, c.last_used_at, c.secret_rotated_at FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id = r.client_id ORDER BY r.display_name ASC`);
    res.json({ success: true, applications: rows });
  } catch (error) { next(error); }
});

router.patch('/applications/:clientId/status', requireRegistryAdmin, async (req, res, next) => {
  try {
    const status = String(req.body.status || '');
    if (!['active', 'disabled', 'maintenance'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid application status' });
    const [result] = await pool.query('UPDATE sso_client_registry SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?', [status, req.params.clientId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'SSO application not found' });
    await pool.query('UPDATE sso_clients SET is_active = ? WHERE client_id = ?', [status === 'active' ? 1 : 0, req.params.clientId]);
    res.json({ success: true, client_id: req.params.clientId, status });
  } catch (error) { next(error); }
});

module.exports = router;
