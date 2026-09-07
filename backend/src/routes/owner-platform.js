const express = require('express');
const { pool } = require('../config/database');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');

const router = express.Router();
const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'account', 'session', 'applications', 'notifications'];

router.use(requireSuperAdmin);

router.get('/settings', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT setting_key,setting_value,updated_at FROM vexa_platform_settings ORDER BY setting_key');
    const settings = {};
    for (const row of rows) {
      try { settings[row.setting_key] = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value; }
      catch { settings[row.setting_key] = row.setting_value; }
    }
    res.json({ success: true, settings });
  } catch (e) { next(e); }
});

router.put('/settings/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(key)) return res.status(400).json({ success: false, message: 'Invalid setting key' });
    if (req.body.value === undefined) return res.status(400).json({ success: false, message: 'Setting value is required' });
    await pool.query(
      'INSERT INTO vexa_platform_settings(setting_key,setting_value,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by)',
      [key, JSON.stringify(req.body.value), req.superAdmin.userId]
    );
    await pool.query(
      'INSERT INTO vexa_platform_settings(setting_key,setting_value,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)',
      [`audit.last.${key}`, JSON.stringify({ updatedBy: req.superAdmin.userId, at: new Date().toISOString() }), req.superAdmin.userId]
    );
    res.json({ success: true, message: 'Platform setting updated', key, value: req.body.value });
  } catch (e) { next(e); }
});

router.get('/health', async (req, res, next) => {
  try {
    const [db] = await pool.query('SELECT 1 AS ok');
    const [apps] = await pool.query('SELECT COUNT(*) count FROM sso_client_registry');
    const [users] = await pool.query('SELECT COUNT(*) count FROM store_users');
    res.json({ success: true, service: 'VexaAccount', database: db[0]?.ok === 1, applications: Number(apps[0]?.count || 0), users: Number(users[0]?.count || 0), timestamp: new Date().toISOString() });
  } catch (e) { next(e); }
});

router.get('/integration/:clientId', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT r.client_id,r.display_name,r.application_key,r.redirect_uris,r.allowed_scopes,r.status,c.is_active,c.last_used_at FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id WHERE r.client_id=? LIMIT 1',
      [req.params.clientId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Application not found' });
    const application = rows[0];
    res.json({ success: true, application: { ...application, ready: application.status === 'active' && application.is_active === 1, checkedAt: new Date().toISOString() } });
  } catch (e) { next(e); }
});

router.get('/scopes', async (req, res) => res.json({ success: true, scopes: DEFAULT_SCOPES }));

module.exports = router;
