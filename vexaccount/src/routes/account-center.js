const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function requireUser(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
    const claims = jwt.verify(header.slice(7), JWT_SECRET);
    const userId = claims.sub || claims.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid identity' });
    req.accountUser = { ...claims, userId };
    next();
  } catch { return res.status(401).json({ success: false, message: 'Invalid or expired session' }); }
}

router.use(requireUser);

router.get('/apps', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT r.client_id, r.display_name, r.application_key, r.environment, r.status, r.description, c.is_active, c.last_used_at, co.scopes, co.granted_at FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id LEFT JOIN sso_consents co ON co.client_id=r.client_id AND co.user_id=? AND co.revoked_at IS NULL ORDER BY r.display_name ASC`, [req.accountUser.userId]);
    res.json({ success: true, applications: rows });
  } catch (error) { next(error); }
});

router.get('/sessions', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT id, client_id, scope, created_at, last_seen_at, expires_at FROM sso_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at > NOW() ORDER BY last_seen_at DESC`, [req.accountUser.userId]);
    res.json({ success: true, sessions: rows });
  } catch (error) { next(error); }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE id=? AND user_id=? AND revoked_at IS NULL', [req.params.id, req.accountUser.userId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, message: 'Session revoked' });
  } catch (error) { next(error); }
});

router.delete('/apps/:clientId/consent', async (req, res, next) => {
  try {
    const [result] = await pool.query('UPDATE sso_consents SET revoked_at=NOW() WHERE client_id=? AND user_id=? AND revoked_at IS NULL', [req.params.clientId, req.accountUser.userId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Consent not found' });
    await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE client_id=? AND user_id=? AND revoked_at IS NULL', [req.params.clientId, req.accountUser.userId]);
    res.json({ success: true, message: 'Application access revoked' });
  } catch (error) { next(error); }
});

router.get('/security/events', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const [rows] = await pool.query('SELECT id, client_id, event_type, ip_address, user_agent, metadata, created_at FROM sso_security_events WHERE user_id=? ORDER BY created_at DESC LIMIT ?', [req.accountUser.userId, limit]);
    res.json({ success: true, events: rows });
  } catch (error) { next(error); }
});

module.exports = router;
