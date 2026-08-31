const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || IS_PRODUCTION;
const COOKIE_SAME_SITE = String(process.env.COOKIE_SAME_SITE || (IS_PRODUCTION ? 'none' : 'lax')).toLowerCase();
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || '').trim() || undefined;

function envFirst(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function configuredCredentials() {
  return {
    email: envFirst('VEXA_SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_EMAIL', 'VEXA_ACCOUNT_SUPER_ADMIN_EMAIL', 'ADMIN_EMAIL').toLowerCase(),
    password: envFirst('VEXA_SUPER_ADMIN_PASSWORD', 'SUPER_ADMIN_PASSWORD', 'VEXA_ACCOUNT_SUPER_ADMIN_PASSWORD', 'ADMIN_PASSWORD'),
    name: envFirst('VEXA_SUPER_ADMIN_NAME', 'SUPER_ADMIN_NAME') || 'VexaAccount Super Admin'
  };
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE === 'none' ? 'none' : COOKIE_SAME_SITE === 'strict' ? 'strict' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
  };
}

function setSessionCookie(res, token) {
  res.cookie('vexaccount_session', token, sessionCookieOptions());
}

async function provisionAdmin(email, displayName) {
  const [users] = await pool.query('SELECT id,email,name,is_verified,is_active FROM store_users WHERE email=? LIMIT 1', [email]);
  let user = users[0];
  if (!user) {
    const [result] = await pool.query(
      'INSERT INTO store_users (email,password,name,is_verified,is_active,created_at) VALUES (?,?,?,?,1,NOW())',
      [email, await bcrypt.hash(`provisioned:${cryptoRandom()}`, 12), displayName, 1]
    );
    user = { id: result.insertId, email, name: displayName, is_verified: 1, is_active: 1 };
  } else if (!user.is_active) {
    throw Object.assign(new Error('Super Admin account is disabled'), { status: 403 });
  }
  await pool.query(
    `INSERT INTO vexa_super_admins (user_id,role,is_active,last_login_at) VALUES (?, 'owner', 1, NOW())
     ON DUPLICATE KEY UPDATE role='owner', is_active=1, last_login_at=NOW()`,
    [user.id]
  );
  return user;
}

function cryptoRandom() {
  return `${Date.now()}-${Math.random()}-${Math.random()}`;
}

router.post('/login', async (req, res, next) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured' });
    const configured = configuredCredentials();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!configured.email || !configured.password) return res.status(503).json({ success: false, message: 'Super Admin credentials are not configured' });
    if (!email || !password || email !== configured.email || password !== configured.password) return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials' });
    const user = await provisionAdmin(email, configured.name);
    const token = jwt.sign({ id: user.id, sub: user.id, email: user.email, role: 'super_admin', admin: true }, JWT_SECRET, { expiresIn: '8h' });
    setSessionCookie(res, token);
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: 'super_admin' } });
  } catch (error) { next(error); }
});

router.get('/session', async (req, res) => {
  try {
    if (!JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured' });
    const token = req.cookies?.vexaccount_session;
    if (!token) return res.json({ success: false, message: 'No Super Admin session' });
    const claims = jwt.verify(token, JWT_SECRET);
    const userId = claims.sub || claims.id;
    const [rows] = await pool.query(`SELECT u.id,u.email,u.name,sa.role,sa.is_active FROM store_users u JOIN vexa_super_admins sa ON sa.user_id=u.id WHERE u.id=? AND u.is_active=1 AND sa.is_active=1 LIMIT 1`, [userId]);
    if (!rows.length) return res.json({ success: false, message: 'Super Admin session required' });
    res.json({ success: true, user: { ...rows[0], role: rows[0].role } });
  } catch { res.json({ success: false, message: 'Invalid Super Admin session' }); }
});

module.exports = router;
