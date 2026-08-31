const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function getToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.vexaccount_session || null;
}

function requireSsoUser(req, res, next) {
  if (!JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured' });
  const token = getToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    const userId = claims.sub || claims.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid identity' });
    if (claims.role && claims.role !== 'user' && claims.role !== 'super_admin' && claims.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'User access required' });
    }
    req.user = { ...claims, id: userId };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

module.exports = { requireSsoUser };
