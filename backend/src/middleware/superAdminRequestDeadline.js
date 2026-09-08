const DEFAULT_TIMEOUT_MS = 15000;
const ANALYZER_TIMEOUT_MS = 90000;
const KIT_TIMEOUT_MS = 90000;
const DEPLOY_TIMEOUT_MS = 60000;
const SYSTEM_C_TIMEOUT_MS = 15000;

function timeoutFor(path) {
  const value = String(path || '');
  if (value.startsWith('/api/sso-application-analyzer/')) return ANALYZER_TIMEOUT_MS;
  if (value.startsWith('/api/sso-application-kit/')) return KIT_TIMEOUT_MS;
  if (value.startsWith('/api/sso-integration/deploy')) return DEPLOY_TIMEOUT_MS;
  if (value === '/api/system-c/stream') return 0;
  if (value.startsWith('/api/system-c/')) return SYSTEM_C_TIMEOUT_MS;
  if (value.startsWith('/api/auth/super-admin/') || value.startsWith('/api/owner/') || value.startsWith('/api/sso-registry/')) return DEFAULT_TIMEOUT_MS;
  return 0;
}

function superAdminRequestDeadline(req, res, next) {
  const timeoutMs = timeoutFor(req.originalUrl || req.url);
  if (!timeoutMs) return next();

  let finished = false;
  const timer = setTimeout(() => {
    if (finished || res.headersSent) return;
    finished = true;
    res.status(504).json({
      success: false,
      error: 'SUPER_ADMIN_API_TIMEOUT',
      message: 'The Super Admin API operation exceeded its server-side deadline. Please retry.',
    });
  }, timeoutMs);

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
  };

  res.once('finish', finish);
  res.once('close', finish);
  req.once('aborted', finish);
  next();
}

module.exports = { superAdminRequestDeadline, timeoutFor };
