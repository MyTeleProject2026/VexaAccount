const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../../vexaccount/src/config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

async function requireUser(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
    const claims = jwt.verify(header.slice(7), JWT_SECRET);
    const userId = claims.sub || claims.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid identity' });
    req.accountUser = { ...claims, userId };
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid or expired session' }); }
}

router.use(requireUser);

router.get('/settings', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT two_factor_enabled, security_notifications_enabled, updated_at FROM vexa_account_security_settings WHERE user_id=? LIMIT 1', [req.accountUser.userId]);
    res.json({ success: true, settings: rows[0] || { two_factor_enabled: false, security_notifications_enabled: true } });
  } catch (error) { next(error); }
});

router.patch('/settings/notifications', async (req, res, next) => {
  try {
    if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ success: false, message: 'enabled must be boolean' });
    await pool.query(`INSERT INTO vexa_account_security_settings (user_id, security_notifications_enabled) VALUES (?, ?) ON DUPLICATE KEY UPDATE security_notifications_enabled=VALUES(security_notifications_enabled)`, [req.accountUser.userId, req.body.enabled ? 1 : 0]);
    res.json({ success: true, security_notifications_enabled: req.body.enabled });
  } catch (error) { next(error); }
});

module.exports = router;
