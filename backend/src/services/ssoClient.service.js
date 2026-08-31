const crypto = require('crypto');
const { pool } = require('../config/database');

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function normalizeJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function generateClientId(applicationKey) {
  const safeKey = String(applicationKey || 'app').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'app';
  return `vexa_${safeKey}_${crypto.randomBytes(8).toString('hex')}`;
}

function generateClientSecret() {
  return `vxs_${crypto.randomBytes(36).toString('base64url')}`;
}

async function registerClient({ clientId, clientSecret, name, redirectUris, allowedScopes = ['openid', 'profile', 'email'] }) {
  if (!clientId || !clientSecret || !name || !Array.isArray(redirectUris) || redirectUris.length === 0) {
    throw new Error('clientId, clientSecret, name and at least one redirect URI are required');
  }
  const secretHash = hashSecret(clientSecret);
  await pool.query(
    `INSERT INTO sso_clients (client_id, client_secret_hash, name, redirect_uris, allowed_scopes, is_active)
     VALUES (?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE name=VALUES(name), redirect_uris=VALUES(redirect_uris), allowed_scopes=VALUES(allowed_scopes)`,
    [clientId, secretHash, name, JSON.stringify(redirectUris), JSON.stringify(allowedScopes)]
  );
  return getClient(clientId);
}

async function getClient(clientId) {
  const [rows] = await pool.query(
    'SELECT id, client_id, name, redirect_uris, allowed_scopes, is_active, created_at, updated_at FROM sso_clients WHERE client_id = ? LIMIT 1',
    [clientId]
  );
  if (!rows.length) return null;
  const client = rows[0];
  return {
    ...client,
    redirectUris: normalizeJsonArray(client.redirect_uris),
    allowedScopes: normalizeJsonArray(client.allowed_scopes, ['openid', 'profile', 'email'])
  };
}

async function rotateClientSecret(clientId) {
  const secret = generateClientSecret();
  const [result] = await pool.query(
    'UPDATE sso_clients SET client_secret_hash=?, secret_rotated_at=CURRENT_TIMESTAMP, is_active=1 WHERE client_id=?',
    [hashSecret(secret), clientId]
  );
  if (!result.affectedRows) return null;
  return secret;
}

module.exports = {
  hashSecret,
  normalizeJsonArray,
  generateClientId,
  generateClientSecret,
  registerClient,
  getClient,
  rotateClientSecret
};
