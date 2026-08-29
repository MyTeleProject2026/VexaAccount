const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function requireSuperAdmin(req, res, next) {
  if (!JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured' });
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const token = header.slice(7);
    const claims = jwt.verify(token, JWT_SECRET);
    const role = claims.role || claims.account_role;
    if (!['super_admin', 'owner'].includes(role)) return res.status(403).json({ success: false, message: 'Super Admin privileges required' });
    req.superAdmin = claims;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired administrator session' });
  }
}

module.exports = { requireSuperAdmin };
