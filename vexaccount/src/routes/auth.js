const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { sendEmail, sendOtpEmail, sendResetEmail } = require('../services/emailService');
const { authUser } = require('../middleware/auth');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ============================================================
// POST: Register
// ============================================================
router.post('/register', async (req, res, next) => {
  const start = Date.now();
  const connection = await pool.getConnection();
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const [existing] = await connection.query(
      'SELECT id, is_verified FROM store_users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (existing.length) {
      const user = existing[0];
      if (user.is_verified === 0) {
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await connection.query(
          'DELETE FROM otp_codes WHERE user_id = ? AND purpose = "email_verification"',
          [user.id]
        );
        await connection.query(
          `INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at) VALUES (?, ?, 'email_verification', ?)`,
          [user.id, otp, expiresAt]
        );
        try {
          await sendOtpEmail(email, otp);
        } catch (emailError) {
          console.error('❌ Failed to send OTP email:', emailError.message);
        }
        return res.status(409).json({
          success: false,
          message: 'Account already registered but not verified. New OTP sent to your email.',
          action: 'verify'
        });
      }
      return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      `INSERT INTO store_users (email, password, name, is_verified) VALUES (?, ?, ?, 0)`,
      [email.trim().toLowerCase(), hashed, name.trim()]
    );

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await connection.query(
      `INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at) VALUES (?, ?, 'email_verification', ?)`,
      [result.insertId, otp, expiresAt]
    );

    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      console.error('❌ Failed to send OTP email:', emailError.message);
    }

    console.log('⏱️ Registration completed in:', Date.now() - start, 'ms');
    res.json({
      success: true,
      message: 'Registration successful. Please verify your email with OTP.',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    next(error);
  } finally {
    connection.release();
  }
});

// ============================================================
// POST: Verify OTP
// ============================================================
router.post('/verify-otp', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    const [userRows] = await connection.query(
      'SELECT id FROM store_users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [otpRows] = await connection.query(
      `SELECT id, expires_at, is_used FROM otp_codes WHERE user_id = ? AND otp_code = ? AND purpose = 'email_verification' AND is_used = 0 ORDER BY id DESC LIMIT 1`,
      [userRows[0].id, otp]
    );
    if (!otpRows.length) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (new Date() > new Date(otpRows[0].expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    await connection.query('UPDATE otp_codes SET is_used = 1 WHERE id = ?', [otpRows[0].id]);
    await connection.query('UPDATE store_users SET is_verified = 1 WHERE id = ?', [userRows[0].id]);

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// ============================================================
// POST: Resend OTP
// ============================================================
router.post('/resend-otp', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const [userRows] = await connection.query(
      'SELECT id, is_verified FROM store_users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (userRows[0].is_verified === 1) {
      return res.status(400).json({ success: false, message: 'Email already verified. Please login.' });
    }

    const userId = userRows[0].id;
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await connection.query(
      'DELETE FROM otp_codes WHERE user_id = ? AND purpose = "email_verification"',
      [userId]
    );
    await connection.query(
      `INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at) VALUES (?, ?, 'email_verification', ?)`,
      [userId, otp, expiresAt]
    );
    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      console.error('❌ Failed to resend OTP email:', emailError.message);
    }

    res.json({ success: true, message: 'OTP resent to your email.' });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// ============================================================
// POST: Login
// ============================================================
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM store_users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const user = rows[0];
    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account disabled' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, is_verified: user.is_verified }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST: Google Login
// ============================================================
router.post('/google', async (req, res, next) => {
  try {
    const { google_id, email, name } = req.body;
    if (!google_id || !email) {
      return res.status(400).json({ success: false, message: 'Missing Google data' });
    }

    let [rows] = await pool.query(
      'SELECT * FROM store_users WHERE google_id = ? OR email = ?',
      [google_id, email]
    );
    let user;
    if (rows.length) {
      user = rows[0];
      if (!user.google_id) {
        await pool.query('UPDATE store_users SET google_id = ? WHERE id = ?', [google_id, user.id]);
        user.google_id = google_id;
      }
    } else {
      const [result] = await pool.query(
        `INSERT INTO store_users (email, name, google_id, is_verified) VALUES (?, ?, ?, 1)`,
        [email, name || email.split('@')[0], google_id]
      );
      const [newUser] = await pool.query('SELECT * FROM store_users WHERE id = ?', [result.insertId]);
      user = newUser[0];
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST: Forgot Password
// ============================================================
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const [rows] = await pool.query(
      'SELECT id, email FROM store_users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (!rows.length) {
      return res.json({ success: true, message: 'If your email is registered, you will receive a reset link.' });
    }

    const user = rows[0];
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await pool.query(
      `INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at) 
       VALUES (?, ?, 'password_reset', DATE_ADD(NOW(), INTERVAL 1 HOUR))
       ON DUPLICATE KEY UPDATE otp_code = VALUES(otp_code), expires_at = VALUES(expires_at)`,
      [user.id, resetToken]
    );

    const resetLink = `${process.env.FRONTEND_USER_URL || 'https://vexastore.onrender.com'}/reset-password?token=${resetToken}`;

    try {
      await sendResetEmail(email, resetLink);
    } catch (emailError) {
      console.error('❌ Failed to send reset email:', emailError.message);
    }

    res.json({ success: true, message: 'If your email is registered, you will receive a reset link.' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST: Reset Password
// ============================================================
router.post('/reset-password', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ success: false, message: 'Invalid token purpose' });
    }

    const [otpRows] = await connection.query(
      `SELECT id FROM otp_codes WHERE user_id = ? AND otp_code = ? AND purpose = 'password_reset' AND is_used = 0 AND expires_at > NOW()`,
      [decoded.id, token]
    );
    if (!otpRows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await connection.query('UPDATE store_users SET password = ? WHERE id = ?', [hashed, decoded.id]);
    await connection.query('UPDATE otp_codes SET is_used = 1 WHERE id = ?', [otpRows[0].id]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// ============================================================
// GET: User Profile
// ============================================================
router.get('/profile', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      'SELECT id, email, name, avatar_url, phone, bio, is_verified, is_active, created_at, twofa_enabled FROM store_users WHERE id = ?',
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    next(error);
  }
});

// ============================================================
// PUT: Update Profile
// ============================================================
router.put('/profile/full', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone, bio } = req.body;

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(userId);
    await pool.query(
      `UPDATE store_users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [rows] = await pool.query(
      'SELECT id, email, name, avatar_url, phone, bio, is_verified, is_active, created_at, twofa_enabled FROM store_users WHERE id = ?',
      [userId]
    );

    res.json({ success: true, message: 'Profile updated', user: rows[0] });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    next(error);
  }
});

// ============================================================
// PUT: Update Profile Picture
// ============================================================
router.put('/profile/picture', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({ success: false, message: 'Avatar URL is required' });
    }

    await pool.query(
      'UPDATE store_users SET avatar_url = ? WHERE id = ?',
      [avatar_url, userId]
    );

    res.json({ success: true, message: 'Profile picture updated', avatar_url });
  } catch (error) {
    console.error('❌ Avatar update error:', error);
    next(error);
  }
});

// ============================================================
// POST: Change Password
// ============================================================
router.post('/change-password', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const [rows] = await pool.query(
      'SELECT password FROM store_users WHERE id = ?',
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE store_users SET password = ? WHERE id = ?',
      [hashed, userId]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Change password error:', error);
    next(error);
  }
});

// ============================================================
// POST: Resend Verification Email
// ============================================================
router.post('/resend-verification', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      'SELECT email, is_verified FROM store_users WHERE id = ?',
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = rows[0];
    if (user.is_verified === 1) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'DELETE FROM otp_codes WHERE user_id = ? AND purpose = "email_verification"',
      [userId]
    );
    await pool.query(
      `INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at) VALUES (?, ?, 'email_verification', ?)`,
      [userId, otp, expiresAt]
    );
    await sendOtpEmail(user.email, otp);

    res.json({ success: true, message: 'Verification email resent' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 2FA: Generate Secret & QR Code
// ============================================================
router.post('/twofa/generate', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'VexaStore', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    res.json({
      success: true,
      secret,
      qrCode,
    });
  } catch (error) {
    console.error('❌ 2FA generate error:', error);
    next(error);
  }
});

// ============================================================
// 2FA: Verify & Enable
// ============================================================
router.post('/twofa/verify-enable', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { secret, token } = req.body;

    if (!secret || !token) {
      return res.status(400).json({ success: false, message: 'Secret and token required' });
    }

    const isValid = authenticator.verify({ token, secret });
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    await pool.query(
      'UPDATE store_users SET twofa_enabled = 1, twofa_secret = ?, twofa_backup_codes = ? WHERE id = ?',
      [secret, JSON.stringify(backupCodes), userId]
    );

    res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes,
    });
  } catch (error) {
    console.error('❌ 2FA verify-enable error:', error);
    next(error);
  }
});

// ============================================================
// POST: Disable 2FA
// ============================================================
router.post('/twofa/disable', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await pool.query(
      'UPDATE store_users SET twofa_enabled = 0, twofa_secret = NULL, twofa_backup_codes = NULL WHERE id = ?',
      [userId]
    );
    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET: Sessions
// ============================================================
router.get('/sessions', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_agent, ip_address, created_at FROM user_activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    
    res.json({
      success: true,
      data: [
        {
          device: 'Current Device',
          browser: req.headers['user-agent'] || 'VexaStore App',
          ip: req.ip || 'Unknown',
          last_active: new Date().toISOString(),
          is_current: true,
          created_at: rows[0]?.created_at || new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET: Activity Log
// ============================================================
router.get('/activity-log', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT action, ip_address, user_agent, created_at 
       FROM user_activity_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

// ============================================================
// GET: Export Data
// ============================================================
router.get('/export-data', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [userRows] = await pool.query(
      'SELECT id, email, name, avatar_url, phone, bio, is_verified, is_active, created_at FROM store_users WHERE id = ?',
      [userId]
    );
    
    const [activityRows] = await pool.query(
      'SELECT action, ip_address, user_agent, created_at FROM user_activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    
    const exportData = {
      user: userRows[0] || null,
      activity: activityRows || [],
      exported_at: new Date().toISOString(),
    };
    
    res.json({ success: true, data: exportData });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST: Delete Account
// ============================================================
router.post('/delete-account', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { confirm } = req.body;

    if (!confirm || confirm !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Type "DELETE" to confirm' });
    }

    await connection.beginTransaction();

    await connection.query('DELETE FROM otp_codes WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM user_activity_logs WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM user_connected_apps WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM store_users WHERE id = ?', [userId]);

    await connection.commit();

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// ============================================================
// GET: Connected Apps
// ============================================================
router.get('/connected-apps', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [rows] = await pool.query(
      'SELECT app_name, app_slug, status, connected_at, last_used_at FROM user_connected_apps WHERE user_id = ? ORDER BY connected_at DESC',
      [userId]
    );
    
    if (!rows.length) {
      await pool.query(
        `INSERT INTO user_connected_apps (user_id, app_name, app_slug, status, connected_at, last_used_at)
         VALUES (?, 'VexaStore', 'vexastore', 'connected', NOW(), NOW())`,
        [userId]
      );
      
      const [newRows] = await pool.query(
        'SELECT app_name, app_slug, status, connected_at, last_used_at FROM user_connected_apps WHERE user_id = ? ORDER BY connected_at DESC',
        [userId]
      );
      
      return res.json({ success: true, data: newRows });
    }
    
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST: Connect App
// ============================================================
router.post('/connect-app', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { app_name, app_slug } = req.body;
    
    if (!app_name || !app_slug) {
      return res.status(400).json({ success: false, message: 'App name and slug required' });
    }
    
    await pool.query(
      `INSERT INTO user_connected_apps (user_id, app_name, app_slug, status, connected_at, last_used_at)
       VALUES (?, ?, ?, 'connected', NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = 'connected', last_used_at = NOW()`,
      [userId, app_name, app_slug]
    );
    
    res.json({ success: true, message: `App "${app_name}" connected successfully` });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST: Disconnect App
// ============================================================
router.post('/disconnect-app', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { app_slug } = req.body;
    
    if (!app_slug) {
      return res.status(400).json({ success: false, message: 'App slug required' });
    }
    
    await pool.query(
      'UPDATE user_connected_apps SET status = "disconnected", updated_at = NOW() WHERE user_id = ? AND app_slug = ?',
      [userId, app_slug]
    );
    
    res.json({ success: true, message: 'App disconnected successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
