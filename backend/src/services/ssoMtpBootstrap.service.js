const crypto = require('crypto');
const { pool } = require('../config/database');

const MTP_CLIENT_ID = process.env.MTP2026_SSO_CLIENT_ID || 'vexa_mtp2026-app-launcher_b1f581a66224d89c';
const MTP_CLIENT_SECRET = String(process.env.MTP2026_SSO_CLIENT_SECRET || '').trim();
const MTP_REDIRECT_URI = String(process.env.MTP2026_SSO_REDIRECT_URI || 'https://mtp2026-app-launcher.onrender.com/auth/callback').trim();
const MTP_SCOPES = ['openid', 'profile', 'email', 'account', 'session', 'applications', 'notifications'];

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

async function ensureMtp2026SsoClient() {
  if (!pool) return { configured: false, reason: 'DATABASE_NOT_CONFIGURED' };
  if (!MTP_CLIENT_SECRET) return { configured: false, reason: 'MTP2026_SSO_CLIENT_SECRET_NOT_SET', clientId: MTP_CLIENT_ID };
  if (!MTP_REDIRECT_URI) return { configured: false, reason: 'MTP2026_SSO_REDIRECT_URI_NOT_SET', clientId: MTP_CLIENT_ID };

  const parsed = new URL(MTP_REDIRECT_URI);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('MTP2026_SSO_REDIRECT_URI_MUST_BE_HTTPS');
  }

  const [existing] = await pool.query('SELECT id,client_id FROM sso_clients WHERE client_id=? LIMIT 1', [MTP_CLIENT_ID]);
  if (existing.length) {
    await pool.query(
      `UPDATE sso_clients SET name=?,redirect_uris=?,allowed_scopes=?,updated_at=CURRENT_TIMESTAMP WHERE client_id=?`,
      ['MTP2026 App Launcher', JSON.stringify([MTP_REDIRECT_URI]), JSON.stringify(MTP_SCOPES), MTP_CLIENT_ID]
    );
    await pool.query(
      `INSERT INTO sso_client_registry (client_id,display_name,application_key,environment,status,description)
       VALUES (?,?,?,'production','active',?)
       ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),environment='production',status='active',description=VALUES(description),updated_at=CURRENT_TIMESTAMP`,
      [MTP_CLIENT_ID, 'MTP2026 App Launcher', 'mtp2026-app-launcher', 'MTP2026 application launcher SSO client']
    );
    return { configured: true, created: false, clientId: MTP_CLIENT_ID };
  }

  await pool.query(
    `INSERT INTO sso_clients (client_id,client_secret_hash,name,redirect_uris,allowed_scopes,is_active)
     VALUES (?,?,?,?,?,1)`,
    [MTP_CLIENT_ID, hashSecret(MTP_CLIENT_SECRET), 'MTP2026 App Launcher', JSON.stringify([MTP_REDIRECT_URI]), JSON.stringify(MTP_SCOPES)]
  );
  await pool.query(
    `INSERT INTO sso_client_registry (client_id,display_name,application_key,environment,status,description)
     VALUES (?,?,?,'production','active',?)
     ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),environment='production',status='active',description=VALUES(description),updated_at=CURRENT_TIMESTAMP`,
    [MTP_CLIENT_ID, 'MTP2026 App Launcher', 'mtp2026-app-launcher', 'MTP2026 application launcher SSO client']
  );
  return { configured: true, created: true, clientId: MTP_CLIENT_ID };
}

module.exports = { ensureMtp2026SsoClient };
