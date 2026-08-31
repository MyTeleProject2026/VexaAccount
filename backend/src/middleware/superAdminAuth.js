const jwt = require('jsonwebtoken');
const { pool } = require('../../../vexaccount/src/config/database');

const JWT_SECRET = process.env.JWT_SECRET;

async function requireSuperAdmin(req, res, next) {
  if (!JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured' });
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const claims = jwt.verify(header.slice(7), JWT_SECRET);
    const userId = claims.sub || claims.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Administrator identity is missing' });
    const [rows] = await pool.query('SELECT id, user_id, role, is_active FROM vexa_super_admins WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId]);
    if (!rows.length) return res.status(403).json({ success: false, message: 'Super Admin privileges required' });
    req.superAdmin = { ...claims, adminId: rows[0].id, userId: rows[0].user_id, role: rows[0].role };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired administrator session' });
  }
}

module.exports = { requireSuperAdmin };
