const crypto = require('crypto');
const axios = require('axios');
const { pool } = require('../config/database');

const RENDER_API = String(process.env.RENDER_API_URL || 'https://api.render.com').replace(/\/$/, '');
const JWT_SECRET = String(process.env.JWT_SECRET || '');
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured for Owner infrastructure control');

function key() { return crypto.createHash('sha256').update(JWT_SECRET, 'utf8').digest(); }
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
function decrypt(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(row.credential_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.credential_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.credential_ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
function assertKey(value) {
  const token = String(value || '').trim();
  if (!token || token.length < 20 || token.length > 512) throw Object.assign(new Error('A valid Render API key is required'), { status: 400 });
  return token;
}
async function connectionRow(name='primary') {
  const [rows] = await pool.query('SELECT * FROM owner_provider_connections WHERE provider=? AND connection_name=? LIMIT 1', ['render', name]);
  return rows[0] || null;
}
async function saveRenderConnection(apiKey, createdBy, name='primary') {
  const token = assertKey(apiKey);
  const test = await renderRequest(token, 'GET', '/v1/services?limit=1');
  const encrypted = encrypt(token);
  await pool.query(`INSERT INTO owner_provider_connections (provider,connection_name,credential_ciphertext,credential_iv,credential_tag,metadata_json,created_by) VALUES ('render',?,?,?,?,?,?) ON DUPLICATE KEY UPDATE credential_ciphertext=VALUES(credential_ciphertext),credential_iv=VALUES(credential_iv),credential_tag=VALUES(credential_tag),metadata_json=VALUES(metadata_json),created_by=VALUES(created_by),updated_at=CURRENT_TIMESTAMP`, [name, encrypted.ciphertext, encrypted.iv, encrypted.tag, JSON.stringify({ connectedAt: new Date().toISOString(), serviceCount: Array.isArray(test) ? test.length : 0 }), createdBy || null]);
  return { connected: true, serviceCount: Array.isArray(test) ? test.length : 0 };
}
async function renderToken(name='primary') {
  const row = await connectionRow(name);
  if (!row) throw Object.assign(new Error('Render provider is not connected. Use Owner Control Center → Infrastructure → Connect Render.'), { status: 503 });
  return decrypt(row);
}
async function renderRequest(token, method, path, data) {
  try {
    const response = await axios({ method, url: `${RENDER_API}${path}`, data, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 20000 });
    return response.data;
  } catch (error) {
    const status = error.response?.status || 502;
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Render API request failed';
    throw Object.assign(new Error(`Render API: ${message}`), { status });
  }
}
async function listRenderServices() { return renderRequest(await renderToken(), 'GET', '/v1/services?limit=100'); }
async function getRenderEnv(serviceId) { return renderRequest(await renderToken(), 'GET', `/v1/services/${encodeURIComponent(serviceId)}/env-vars?limit=100`); }
async function setRenderEnv(serviceId, keyName, value) {
  const keyValue = String(keyName || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(keyValue)) throw Object.assign(new Error('Invalid environment variable name'), { status: 400 });
  return renderRequest(await renderToken(), 'PUT', `/v1/services/${encodeURIComponent(serviceId)}/env-vars/${encodeURIComponent(keyValue)}`, { value: String(value ?? '') });
}
async function deleteRenderEnv(serviceId, keyName) { return renderRequest(await renderToken(), 'DELETE', `/v1/services/${encodeURIComponent(serviceId)}/env-vars/${encodeURIComponent(keyName)}`); }
async function deployRenderService(serviceId, clearCache=false) { return renderRequest(await renderToken(), 'POST', `/v1/services/${encodeURIComponent(serviceId)}/deploys`, { clearCache: clearCache ? 'clear' : 'do_not_clear' }); }
async function getInfrastructure(clientId) {
  const [rows] = await pool.query(`SELECT i.*,r.display_name,r.application_key,r.status AS application_status FROM owner_application_infrastructure i JOIN sso_client_registry r ON r.client_id=i.client_id WHERE i.client_id=? LIMIT 1`, [clientId]);
  return rows[0] || null;
}
async function saveInfrastructure({ clientId, providerConnectionId, serviceId, serviceName, environmentName, repository, branchName, status='configured' }) {
  if (!clientId || !serviceId) throw Object.assign(new Error('clientId and serviceId are required'), { status: 400 });
  const [result] = await pool.query(`INSERT INTO owner_application_infrastructure (client_id,provider_connection_id,service_id,service_name,environment_name,repository,branch_name,status) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE provider_connection_id=VALUES(provider_connection_id),service_id=VALUES(service_id),service_name=VALUES(service_name),environment_name=VALUES(environment_name),repository=VALUES(repository),branch_name=VALUES(branch_name),status=VALUES(status),updated_at=CURRENT_TIMESTAMP`, [clientId, providerConnectionId || null, serviceId, serviceName || null, environmentName || null, repository || null, branchName || null, status]);
  return getInfrastructure(clientId);
}
module.exports = { saveRenderConnection, listRenderServices, getRenderEnv, setRenderEnv, deleteRenderEnv, deployRenderService, getInfrastructure, saveInfrastructure, connectionRow };
