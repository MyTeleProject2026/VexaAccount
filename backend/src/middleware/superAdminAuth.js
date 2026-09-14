const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { withDeadline } = require('../utils/requestDeadline');
const JWT_SECRET = process.env.JWT_SECRET;
const DB_AUTH_TIMEOUT_MS = 8000;
const OWNER_AUTH_CACHE_MS = Math.max(1000, Number(process.env.OWNER_AUTH_CACHE_MS || 5000));
const OWNER_SESSION_COOKIE = 'vexa_owner_session';
const authCache = new Map();

function getToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[OWNER_SESSION_COOKIE] || null;
}

function cacheKey(userId, claims) {
  return `${String(userId)}:${String(claims?.iat || '')}:${String(claims?.exp || '')}:${String(claims?.role || '')}`;
}

function cachedAdmin(key) {
  const entry = authCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    authCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheAdmin(key, value) {
  authCache.set(key, { value, expiresAt: Date.now() + OWNER_AUTH_CACHE_MS });
  if (authCache.size > 100) {
    const oldest = authCache.keys().next().value;
    if (oldest) authCache.delete(oldest);
  }
}

async function requireSuperAdmin(req, res, next) {
  if (!JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured' });
  const token = getToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    const userId = claims.sub || claims.id;
    if (!userId || !['super_admin', 'owner', 'admin'].includes(claims.role)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired administrator session' });
    }

    const key = cacheKey(userId, claims);
    const cached = cachedAdmin(key);
    if (cached) {
      req.superAdmin = { ...claims, ...cached };
      return next();
    }

    const [rows] = await withDeadline(pool.query({
      sql: 'SELECT id,user_id,role,is_active FROM vexa_super_admins WHERE user_id=? AND is_active=1 LIMIT 1',
      values: [userId],
      timeout: DB_AUTH_TIMEOUT_MS
    }), DB_AUTH_TIMEOUT_MS, 'Administrator session verification timed out');
    if (!rows.length || !['owner', 'super_admin', 'admin'].includes(rows[0].role)) {
      return res.status(403).json({ success: false, message: 'Super Admin privileges required' });
    }

    const authorization = { adminId: rows[0].id, userId: rows[0].user_id, role: rows[0].role };
    cacheAdmin(key, authorization);
    req.superAdmin = { ...claims, ...authorization };
    next();
  } catch (error) {
    if (error?.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || error?.code === 'VEXA_REQUEST_TIMEOUT' || /timeout/i.test(String(error?.message||''))) {
      return res.status(503).json({ success: false, message: 'Administrator session verification timed out' });
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired administrator session' });
  }
}

module.exports = { requireSuperAdmin };
