const express = require('express');
const { pool } = require('../config/database');
const { withDeadline } = require('../utils/requestDeadline');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { normalizeJsonArray } = require('../services/ssoClient.service');
const applicationAssetsRoutes = require('./sso-application-assets');

const router = express.Router();
const REGISTRY_LIST_TIMEOUT_MS = 8000;
router.use(requireSuperAdmin);

router.get('/applications', auditAdminAction('sso.registry.list', 'sso_application'), async (req, res, next) => {
  try {
    const [rows] = await withDeadline(pool.query({
      sql: `
      SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,
             r.owner_label,r.description,r.created_at,r.updated_at,
             c.is_active,c.redirect_uris,c.allowed_scopes,c.last_used_at,c.secret_rotated_at,
             p.application_url,p.framework,p.github_repository,p.github_branch,p.render_service_id,
             p.cloudinary_folder,
             icon.id AS icon_asset_id,icon.public_id AS icon_public_id,icon.secure_url AS icon_url,
             icon.width AS icon_width,icon.height AS icon_height
      FROM sso_client_registry r
      LEFT JOIN sso_clients c ON c.client_id=r.client_id
      LEFT JOIN sso_application_profiles p ON p.client_id=r.client_id
      LEFT JOIN sso_application_assets icon ON icon.client_id=r.client_id AND icon.asset_kind='icon'
      ORDER BY r.display_name ASC
    `,
      timeout: REGISTRY_LIST_TIMEOUT_MS
    }), REGISTRY_LIST_TIMEOUT_MS, 'SSO application registry query timed out');

    return res.json({
      success: true,
      applications: rows.map(row => ({
        ...row,
        redirectUris: normalizeJsonArray(row.redirect_uris),
        allowedScopes: normalizeJsonArray(row.allowed_scopes, ['openid', 'profile', 'email']),
        profile: {
          applicationUrl: row.application_url || null,
          framework: row.framework || null,
          githubRepository: row.github_repository || null,
          githubBranch: row.github_branch || null,
          renderServiceId: row.render_service_id || null,
          cloudinaryFolder: row.cloudinary_folder || `vexaaccount/applications/${row.client_id}`
        },
        icon: row.icon_url ? { id: row.icon_asset_id, publicId: row.icon_public_id, url: row.icon_url, width: row.icon_width, height: row.icon_height } : null
      }))
    });
  } catch (error) {
    if (error?.code === 'VEXA_REQUEST_TIMEOUT' || error?.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || /timeout/i.test(String(error?.message || ''))) {
      return res.status(503).json({ success: false, message: 'SSO application registry query timed out' });
    }
    return next(error);
  }
});

router.patch('/applications/:clientId', auditAdminAction('sso.registry.application.update', 'sso_application'), async (req, res, next) => {
  try {
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) return res.status(400).json({ success: false, message: 'Client ID is required' });

    const body = req.body || {};
    const registryAllowed = ['display_name', 'owner_label', 'environment', 'description', 'status'];
    const updates = [];
    const values = [];
    for (const field of registryAllowed) {
      if (body[field] !== undefined) {
        const value = String(body[field] ?? '').trim();
        if (field === 'status' && !['pending','active','disabled','maintenance','rejected','revoked'].includes(value)) {
          return res.status(400).json({ success: false, message: 'Invalid application status' });
        }
        updates.push(`${field}=?`);
        values.push(value || null);
      }
    }

    const hasRedirectUris = body.redirectUris !== undefined || body.redirect_uris !== undefined;
    const hasAllowedScopes = body.allowedScopes !== undefined || body.allowed_scopes !== undefined;
    const redirectUris = body.redirectUris !== undefined ? body.redirectUris : body.redirect_uris;
    const allowedScopes = body.allowedScopes !== undefined ? body.allowedScopes : body.allowed_scopes;

    if (hasRedirectUris) {
      if (!Array.isArray(redirectUris)) return res.status(400).json({ success: false, message: 'redirectUris must be an array' });
      const normalized = [...new Set(redirectUris.map(v => String(v || '').trim()).filter(Boolean))];
      if (!normalized.length) return res.status(400).json({ success: false, message: 'At least one redirect URI is required' });
      for (const uri of normalized) {
        try {
          const u = new URL(uri);
          if (u.protocol !== 'https:' || u.username || u.password || u.hash) throw new Error('unsafe redirect URI');
        } catch (_) {
          return res.status(400).json({ success: false, message: `Invalid redirect URI: ${uri}` });
        }
      }
    }

    if (hasAllowedScopes) {
      if (!Array.isArray(allowedScopes)) return res.status(400).json({ success: false, message: 'allowedScopes must be an array' });
      const supportedScopes = new Set(['openid','profile','email','account','session','applications','notifications']);
      const normalized = [...new Set(allowedScopes.map(v => String(v || '').trim()).filter(Boolean))];
      const unsupported = normalized.filter(scope => !supportedScopes.has(scope));
      if (unsupported.length) return res.status(400).json({ success: false, message: `Unsupported scope(s): ${unsupported.join(', ')}` });
      if (!normalized.includes('openid')) normalized.unshift('openid');
    }

    if (!updates.length && !hasRedirectUris && !hasAllowedScopes) {
      return res.status(400).json({ success: false, message: 'No supported application fields supplied' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (updates.length) {
        values.push(clientId);
        const [result] = await connection.query(`UPDATE sso_client_registry SET ${updates.join(',')},updated_at=CURRENT_TIMESTAMP WHERE client_id=?`, values);
        if (!result.affectedRows) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: 'SSO application not found' });
        }
      } else {
        const [exists] = await connection.query('SELECT client_id FROM sso_client_registry WHERE client_id=? LIMIT 1', [clientId]);
        if (!exists.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: 'SSO application not found' });
        }
      }
      if (hasRedirectUris || hasAllowedScopes) {
        const clientUpdates = [];
        const clientValues = [];
        if (hasRedirectUris) { clientUpdates.push('redirect_uris=?'); clientValues.push(JSON.stringify([...new Set(redirectUris.map(v => String(v || '').trim()).filter(Boolean))])); }
        if (hasAllowedScopes) {
          const scopes = [...new Set(allowedScopes.map(v => String(v || '').trim()).filter(Boolean))];
          if (!scopes.includes('openid')) scopes.unshift('openid');
          clientUpdates.push('allowed_scopes=?'); clientValues.push(JSON.stringify(scopes));
        }
        clientValues.push(clientId);
        const [result] = await connection.query(`UPDATE sso_clients SET ${clientUpdates.join(',')},updated_at=CURRENT_TIMESTAMP WHERE client_id=?`, clientValues);
        if (!result.affectedRows) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: 'SSO client record not found for application' });
        }
      }
      await connection.commit();
    } catch (error) {
      try { await connection.rollback(); } catch (_) {}
      throw error;
    } finally {
      connection.release();
    }

    res.json({ success: true, message: 'SSO application updated', clientId, ...(hasRedirectUris ? { redirectUris: [...new Set(redirectUris.map(v => String(v || '').trim()).filter(Boolean))] } : {}), ...(hasAllowedScopes ? { allowedScopes: [...new Set(allowedScopes.map(v => String(v || '').trim()).filter(Boolean)).length ? [...new Set(allowedScopes.map(v => String(v || '').trim()).filter(Boolean))] : ['openid'] } : {}) });
  } catch (e) { next(e); }
});

router.use('/', applicationAssetsRoutes);

module.exports = router;
