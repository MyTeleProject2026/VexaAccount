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

async function registerClient({ clientId, clientSecret, name, redirectUris, allowedScopes = ['openid', 'profile', 'email'] }) {
  if (!clientId || !name || !Array.isArray(redirectUris) || redirectUris.length === 0) {
    throw new Error('clientId, name and at least one redirect URI are required');
  }
  const secretHash = clientSecret ? hashSecret(clientSecret) : null;
  await pool.query(
    `INSERT INTO sso_clients (client_id, client_secret_hash, name, redirect_uris, allowed_scopes)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), redirect_uris = VALUES(redirect_uris), allowed_scopes = VALUES(allowed_scopes), is_active = 1`,
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

module.exports = { hashSecret, registerClient, getClient };
