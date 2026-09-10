const express = require('express');
const { pool } = require('../config/database');
const { authUser } = require('../middleware/auth');

const router = express.Router();
const PRIVACY_FIELDS = [
  'location_sharing_enabled',
  'personalization_enabled',
  'activity_history_enabled',
  'push_notifications_enabled',
  'product_updates_enabled',
  'marketing_email_enabled',
  'security_email_enabled'
];
const PRIVACY_ALIASES = {
  locationSharingEnabled: 'location_sharing_enabled',
  personalizationEnabled: 'personalization_enabled',
  activityHistoryEnabled: 'activity_history_enabled',
  pushNotificationsEnabled: 'push_notifications_enabled',
  productUpdatesEnabled: 'product_updates_enabled',
  marketingEmailEnabled: 'marketing_email_enabled',
  securityEmailEnabled: 'security_email_enabled'
};

router.use(authUser);
router.use((req, res, next) => {
  req.userId = req.user.id || req.user.sub;
  next();
});

async function ensure(userId) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vexa_account_privacy_settings (
      user_id BIGINT PRIMARY KEY,
      location_sharing_enabled TINYINT(1) NOT NULL DEFAULT 0,
      personalization_enabled TINYINT(1) NOT NULL DEFAULT 1,
      activity_history_enabled TINYINT(1) NOT NULL DEFAULT 1,
      push_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
      product_updates_enabled TINYINT(1) NOT NULL DEFAULT 1,
      marketing_email_enabled TINYINT(1) NOT NULL DEFAULT 0,
      security_email_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query('INSERT IGNORE INTO vexa_account_privacy_settings(user_id) VALUES(?)', [userId]);
}

function normalizePrivacyBody(body = {}) {
  const normalized = {};
  for (const key of PRIVACY_FIELDS) {
    if (typeof body[key] === 'boolean') normalized[key] = body[key];
  }
  for (const [alias, key] of Object.entries(PRIVACY_ALIASES)) {
    if (typeof body[alias] === 'boolean') normalized[key] = body[alias];
  }
  return normalized;
}

async function updatePrivacy(userId, body) {
  const valuesByField = normalizePrivacyBody(body);
  const fields = Object.keys(valuesByField);
  if (!fields.length) return false;
  const values = fields.map(key => valuesByField[key] ? 1 : 0);
  values.push(userId);
  await pool.query(
    `UPDATE vexa_account_privacy_settings SET ${fields.map(key => `${key}=?`).join(',')} WHERE user_id=?`,
    values
  );
  return true;
}

router.get('/people', async (req, res, next) => {
  try {
    await ensure(req.userId);
    const [settings] = await pool.query(
      'SELECT username,recovery_email FROM vexa_account_center_settings WHERE user_id=?',
      [req.userId]
    );
    const [privacy] = await pool.query(
      `SELECT ${PRIVACY_FIELDS.join(',')} FROM vexa_account_privacy_settings WHERE user_id=?`,
      [req.userId]
    );
    return res.json({ success: true, sharing: { ...(settings[0] || {}), ...(privacy[0] || {}) } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/people', async (req, res, next) => {
  try {
    await ensure(req.userId);
    const body = req.body || {};

    if (Object.prototype.hasOwnProperty.call(body, 'recovery_email')) {
      return res.status(409).json({
        success: false,
        code: 'RECOVERY_EMAIL_VERIFICATION_REQUIRED',
        message: 'Recovery email changes must use the verified recovery-email workflow. Open Recovery and verify the new address with the code sent to it.'
      });
    }

    const profileFields = [];
    const profileValues = [];
    if (Object.prototype.hasOwnProperty.call(body, 'username')) {
      const username = String(body.username || '').trim().toLowerCase();
      if (username && !/^[a-z0-9._-]{3,64}$/.test(username)) {
        return res.status(400).json({
          success: false,
          message: 'Username must be 3-64 characters using letters, numbers, dot, underscore or hyphen.'
        });
      }
      await pool.query('INSERT IGNORE INTO vexa_account_center_settings(user_id) VALUES(?)', [req.userId]);
      profileFields.push('username=?');
      profileValues.push(username || null);
    }

    const privacyFields = [];
    const privacyValues = [];
    for (const key of PRIVACY_FIELDS) {
      if (typeof body[key] === 'boolean') {
        privacyFields.push(`${key}=?`);
        privacyValues.push(body[key] ? 1 : 0);
      }
    }

    if (!profileFields.length && !privacyFields.length) {
      return res.status(400).json({ success: false, message: 'No people or sharing changes supplied' });
    }

    if (profileFields.length) {
      profileValues.push(req.userId);
      await pool.query(
        `UPDATE vexa_account_center_settings SET ${profileFields.join(',')} WHERE user_id=?`,
        profileValues
      );
    }

    if (privacyFields.length) {
      privacyValues.push(req.userId);
      await pool.query(
        `UPDATE vexa_account_privacy_settings SET ${privacyFields.join(',')} WHERE user_id=?`,
        privacyValues
      );
    }

    return res.json({ success: true, message: 'People and sharing settings updated' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username is already in use' });
    }
    return next(error);
  }
});

// Backward-compatible privacy endpoint for existing clients that still call
// /api/account/privacy. It uses the same authenticated privacy store and accepts
// both the canonical snake_case field names and the existing camelCase client names.
router.patch('/privacy', async (req, res, next) => {
  try {
    await ensure(req.userId);
    if (!await updatePrivacy(req.userId, req.body || {})) {
      return res.status(400).json({
        success: false,
        message: 'No valid privacy changes supplied. Privacy values must be boolean.'
      });
    }
    return res.json({ success: true, message: 'Privacy settings updated' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
