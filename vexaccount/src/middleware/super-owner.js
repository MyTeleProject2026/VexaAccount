const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';

const PERMISSIONS = {
  super_owner: ['*'],
  sso_admin: ['sso.clients.read','sso.clients.write','sso.events.read','sso.sessions.read','sso.sessions.revoke','sso.consents.read','sso.consents.revoke'],
  security_admin: ['sso.events.read','sso.sessions.read','sso.sessions.revoke','sso.consents.read','sso.consents.revoke'],
  auditor: ['sso.events.read','sso.sessions.read','sso.consents.read']
};

function hasPermission(role, permission) {
  const permissions = PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

function requireSuperOwner(permission) {
  return async (req, res, next) => {
    try {
      const header = req.get('authorization') || '';
      if (!header.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Authentication required' });
      const claims = jwt.verify(header.slice(7), JWT_SECRET);
      const userId = claims.sub || claims.id;
      if (!userId) return res.status(401).json({ success:false, message:'Invalid administrator identity' });
      const [rows] = await pool.query('SELECT role FROM vexa_super_admins WHERE user_id=? AND is_active=1 LIMIT 1', [userId]);
      if (!rows.length || !hasPermission(rows[0].role, permission)) return res.status(403).json({ success:false, message:'Insufficient administrative permission' });
      req.admin = { ...claims, userId, role: rows[0].role };
      next();
    } catch {
      res.status(401).json({ success:false, message:'Invalid or expired session' });
    }
  };
}

module.exports = { requireSuperOwner, hasPermission, PERMISSIONS };