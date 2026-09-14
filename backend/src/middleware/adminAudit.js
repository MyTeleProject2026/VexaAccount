const { pool } = require('../config/database');

const READ_DEDUPE_MS = 2000;
const recentReads = new Map();

function isRead(req) {
  return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
}

function shouldAuditRead(req, action, resourceType) {
  if (!isRead(req)) return true;
  const key = [req.superAdmin?.adminId || 'unknown', action || '', resourceType || '', req.originalUrl || req.url || ''].join('|');
  const now = Date.now();
  const previous = recentReads.get(key) || 0;
  if (now - previous < READ_DEDUPE_MS) return false;
  recentReads.set(key, now);
  if (recentReads.size > 2000) {
    for (const [k, timestamp] of recentReads) {
      if (now - timestamp >= READ_DEDUPE_MS) recentReads.delete(k);
      if (recentReads.size <= 1500) break;
    }
  }
  return true;
}

function auditAdminAction(action, resourceType = null) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (!req.superAdmin?.adminId || !shouldAuditRead(req, action, resourceType)) return;
      // Audit persistence is deliberately detached from the request lifecycle.
      // A slow audit INSERT must never hold up an Owner control response.
      setImmediate(() => {
        pool.query(
          `INSERT INTO vexa_admin_audit_log
            (admin_id,action,resource_type,resource_id,ip_address,user_agent,metadata)
           VALUES (?,?,?,?,?,?,?)`,
          [
            req.superAdmin.adminId,
            action,
            resourceType,
            req.params.clientId || req.params.id || null,
            req.ip || null,
            String(req.get('user-agent') || '').slice(0, 512) || null,
            JSON.stringify({ method: req.method, path: req.originalUrl, status: res.statusCode })
          ]
        ).catch(error => console.error('Admin audit write failed:', error.message));
      });
    });
    next();
  };
}

module.exports = { auditAdminAction };