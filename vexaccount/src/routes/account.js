const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';

function requireUser(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const claims = jwt.verify(header.slice(7), JWT_SECRET);
    const userId = claims.sub || claims.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid identity' });
    req.accountUser = { ...claims, userId };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

router.use(requireUser);

router.get('/profile', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, name, first_name, last_name, avatar_url, phone, country, is_verified, created_at FROM store_users WHERE id=? AND is_active=1 LIMIT 1',
      [req.accountUser.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, profile: rows[0] });
  } catch (error) { next(error); }
});

router.get('/security/settings', async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT twofa_enabled FROM store_users WHERE id=? LIMIT 1', [req.accountUser.userId]);
    if (!users.length) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({
      success: true,
      settings: {
        two_factor_enabled: Boolean(users[0].twofa_enabled)
      }
    });
  } catch (error) { next(error); }
});

module.exports = router;
