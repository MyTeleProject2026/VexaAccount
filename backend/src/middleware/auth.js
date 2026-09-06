// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured');

function getToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return req.cookies?.vexaccount_session || null;
}

async function requireActiveUser(decoded) {
  const id = decoded.sub || decoded.id;
  if (!id || decoded.role !== 'user') return null;
  const [rows] = await pool.query(
    'SELECT id,email,is_active,session_version FROM store_users WHERE id=? AND is_active=1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function legacyTokenIsCurrent(decoded, activeUser) {
  // JWTs issued before the session-version claim was introduced have no `sv`.
  // They remain valid until their normal expiry, but any session-version bump
  // (logout, password reset/change, deactivation, account deletion, etc.) must
  // invalidate them. The compatibility timestamp is consulted only for those
  // legacy tokens, while current tokens use the cheaper session-version check.
  if (decoded.sv !== undefined && decoded.sv !== null) {
    return Number(decoded.sv) === Number(activeUser.session_version || 1);
  }
  const [rows] = await pool.query(
    'SELECT session_version_changed_at FROM store_users WHERE id=? AND is_active=1 LIMIT 1',
    [activeUser.id]
  );
  const changedAt = rows[0]?.session_version_changed_at
    ? new Date(rows[0].session_version_changed_at).getTime()
    : 0;
  const issuedAt = Number(decoded.iat || 0) * 1000;
  return !changedAt || issuedAt >= changedAt;
}

const authAdmin = (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin' && !['owner', 'super_admin'].includes(decoded.role)) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authUser = async (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const activeUser = await requireActiveUser(decoded);
    if (!activeUser || !(await legacyTokenIsCurrent(decoded, activeUser))) {
      res.clearCookie('vexaccount_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.COOKIE_SAME_SITE || 'lax',
        path: '/'
      });
      return res.status(401).json({ success: false, message: 'Invalid, expired, inactive, or revoked user session' });
    }
    req.user = decoded;
    req.authenticatedUser = activeUser;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { authAdmin, authUser };
