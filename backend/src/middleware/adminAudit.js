const { pool } = require('../../vexaccount/src/config/database');

function auditAdminAction(action, resourceType = null) {
  return async (req, res, next) => {
    res.on('finish', async () => {
      try {
        if (!req.superAdmin?.adminId) return;
        await pool.query(
          `INSERT INTO vexa_admin_audit_log
           (admin_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.superAdmin.adminId,
            action,
            resourceType,
            req.params.clientId || req.params.id || null,
            req.ip || null,
            String(req.get('user-agent') || '').slice(0, 512) || null,
            JSON.stringify({ method: req.method, path: req.originalUrl, status: res.statusCode })
          ]
        );
      } catch (error) {
        console.error('Admin audit write failed:', error.message);
      }
    });
    next();
  };
}

module.exports = { auditAdminAction };
