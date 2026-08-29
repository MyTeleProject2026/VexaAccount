const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authUser } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const ISSUER = process.env.VEXA_ACCOUNT_ISSUER || 'https://api-vexaaccount.onrender.com';
const CODE_TTL_SECONDS = 300;
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_DAYS = 30;

if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured for VexaAccount SSO');

function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('base64url'); }
function randomToken(bytes = 32) { return crypto.randomBytes(bytes).toString('base64url'); }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function parseJsonArray(value, fallback = []) {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}
async function getClient(clientId) {
  const [rows] = await pool.query('SELECT id, client_id, client_secret_hash, name, redirect_uris, allowed_scopes, is_active FROM sso_clients WHERE client_id = ? LIMIT 1', [clientId]);
  return rows[0] || null;
}
function redirectAllowed(client, redirectUri) { return Boolean(client && client.is_active && redirectUri && parseJsonArray(client.redirect_uris).includes(redirectUri)); }
function clientSecretValid(client, clientSecret) { return Boolean(client && client.client_secret_hash && clientSecret && safeEqual(sha256(clientSecret), client.client_secret_hash)); }

router.get('/.well-known/openid-configuration', (req, res) => res.json({
  issuer: ISSUER, authorization_endpoint: `${ISSUER}/api/sso/authorize`, token_endpoint: `${ISSUER}/api/sso/token`, userinfo_endpoint: `${ISSUER}/api/sso/userinfo`, end_session_endpoint: `${ISSUER}/api/sso/logout`,
  response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], scopes_supported: ['openid', 'profile', 'email'], token_endpoint_auth_methods_supported: ['client_secret_post']
}));

router.get('/authorize', authUser, async (req, res, next) => {
  try {
    const { client_id: clientId, redirect_uri: redirectUri, response_type: responseType, scope = 'openid profile email', state, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod } = req.query;
    if (responseType !== 'code' || !clientId || !redirectUri || !state || !codeChallenge || codeChallengeMethod !== 'S256') return res.status(400).json({ success: false, message: 'Valid authorization code + S256 PKCE parameters are required' });
    const client = await getClient(clientId);
    if (!redirectAllowed(client, redirectUri)) return res.status(400).json({ success: false, message: 'Invalid SSO client or redirect URI' });
    const allowedScopes = new Set(parseJsonArray(client.allowed_scopes, ['openid', 'profile', 'email']));
    const requestedScopes = String(scope).split(/\s+/).filter(Boolean);
    if (requestedScopes.some(s => !allowedScopes.has(s))) return res.status(400).json({ success: false, message: 'Requested scope is not allowed' });
    const code = randomToken(32);
    await pool.query(`INSERT INTO sso_authorization_codes (code_hash, client_id, user_id, redirect_uri, scope, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`, [sha256(code), clientId, req.user.id, redirectUri, requestedScopes.join(' '), codeChallenge, CODE_TTL_SECONDS]);
    const separator = redirectUri.includes('?') ? '&' : '?';
    return res.redirect(`${redirectUri}${separator}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  } catch (error) { next(error); }
});

router.post('/token', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { grant_type: grantType, code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret, code_verifier: codeVerifier, refresh_token: refreshToken } = req.body;
    if (!clientId) return res.status(400).json({ success: false, message: 'client_id is required' });
    const client = await getClient(clientId);
    if (!redirectAllowed(client, redirectUri || client?.redirect_uris ? redirectUri : null)) return res.status(401).json({ success: false, message: 'Invalid client' });
    if (!clientSecretValid(client, clientSecret)) return res.status(401).json({ success: false, message: 'Client authentication failed' });

    if (grantType === 'refresh_token') {
      if (!refreshToken) return res.status(400).json({ success: false, message: 'refresh_token is required' });
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT * FROM sso_refresh_tokens WHERE token_hash = ? AND client_id = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE', [sha256(refreshToken), clientId]);
      if (!rows.length) { await connection.rollback(); return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' }); }
      const session = rows[0];
      await connection.query('UPDATE sso_refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [session.id]);
      const replacement = randomToken(48);
      await connection.query('INSERT INTO sso_refresh_tokens (token_hash, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))', [sha256(replacement), clientId, session.user_id, session.scope, REFRESH_TTL_DAYS]);
      await connection.commit();
      const accessToken = jwt.sign({ sub: session.user_id, client_id: clientId, scope: session.scope, iss: ISSUER, token_type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS });
      return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TTL_SECONDS, refresh_token: replacement, scope: session.scope });
    }

    if (grantType !== 'authorization_code' || !code || !redirectUri || !codeVerifier) return res.status(400).json({ success: false, message: 'authorization_code, code, redirect_uri and code_verifier are required' });
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM sso_authorization_codes WHERE code_hash = ? AND client_id = ? AND redirect_uri = ? AND consumed_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE', [sha256(code), clientId, redirectUri]);
    if (!rows.length) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Invalid or expired authorization code' }); }
    const authorization = rows[0];
    if (!safeEqual(sha256(codeVerifier), authorization.code_challenge)) { await connection.rollback(); return res.status(400).json({ success: false, message: 'PKCE verification failed' }); }
    await connection.query('UPDATE sso_authorization_codes SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL', [authorization.id]);
    const refreshValue = randomToken(48);
    await connection.query('INSERT INTO sso_refresh_tokens (token_hash, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))', [sha256(refreshValue), clientId, authorization.user_id, authorization.scope, REFRESH_TTL_DAYS]);
    await connection.commit();
    const accessToken = jwt.sign({ sub: authorization.user_id, client_id: clientId, scope: authorization.scope, iss: ISSUER, token_type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS });
    return res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TTL_SECONDS, refresh_token: refreshValue, scope: authorization.scope });
  } catch (error) { try { await connection.rollback(); } catch {} next(error); } finally { connection.release(); }
});

router.get('/userinfo', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Bearer token required' });
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    if (decoded.iss !== ISSUER || decoded.token_type !== 'access') return res.status(401).json({ success: false, message: 'Invalid SSO token' });
    const [rows] = await pool.query('SELECT id, email, name, first_name, last_name, avatar_url, phone, country, is_verified FROM store_users WHERE id = ? AND is_active = 1 LIMIT 1', [decoded.sub]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    const user = rows[0]; const scopes = new Set(String(decoded.scope || '').split(/\s+/)); const claims = { sub: String(user.id) };
    if (scopes.has('email')) Object.assign(claims, { email: user.email, email_verified: Boolean(user.is_verified) });
    if (scopes.has('profile')) Object.assign(claims, { name: user.name, given_name: user.first_name, family_name: user.last_name, picture: user.avatar_url, phone_number: user.phone, country: user.country });
    return res.json(claims);
  } catch { return res.status(401).json({ success: false, message: 'Invalid or expired SSO token' }); }
});

router.post('/logout', async (req, res, next) => { try { const token = String(req.body.refresh_token || ''); if (token) await pool.query('UPDATE sso_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [sha256(token)]); return res.json({ success: true, message: 'SSO session revoked' }); } catch (error) { next(error); } });

module.exports = router;
