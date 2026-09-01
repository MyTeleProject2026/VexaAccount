// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured');

function getToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return req.cookies?.vexaccount_session || null;
}

const authAdmin = (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin' && !['owner', 'super_admin'].includes(decoded.role)) return res.status(403).json({ success: false, message: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
};

const authUser = (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user') return res.status(403).json({ success: false, message: 'User access required' });
    req.user = decoded;
    next();
  } catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
};

module.exports = { authAdmin, authUser };
