// vexaccount/src/routes/auth.js
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

    // Check if Authenticator 2FA is enabled
    if (user.twofa_enabled === 1 && user.twofa_secret) {
      return res.json({
        success: true,
        requiresAuthenticator2fa: true,
        userId: user.id,
        message: 'Authenticator 2FA verification required'
      });
    }

    // Check if Email 2FA is enabled
    if (user.email_2fa_enabled === 1) {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      await pool.query(
        `INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at) 
         VALUES (?, ?, 'email_2fa', ?)
         ON DUPLICATE KEY UPDATE 
           otp_code = VALUES(otp_code), 
           expires_at = VALUES(expires_at)`,
        [user.id, otp, expiresAt]
      );
      
      try {
        await sendOtpEmail(user.email, otp);
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);
      }

      return res.json({
        success: true,
        requiresEmail2fa: true,
        userId: user.id,
        message: 'OTP sent to your email'
      });
    }

    // No 2FA – direct login
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
// POST: Verify Email 2FA
// ============================================================
router.post('/verify-email-2fa', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { userId, email, otp } = req.body;
    
    if (!userId || !email || !otp) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const [otpRows] = await connection.query(
      `SELECT id, expires_at, is_used FROM otp_codes 
       WHERE user_id = ? AND otp_code = ? AND purpose = 'email_2fa' AND is_used = 0 
       ORDER BY id DESC LIMIT 1`,
      [userId, otp]
    );
    
    if (!otpRows.length) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    
    if (new Date() > new Date(otpRows[0].expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }
    
    await connection.query('UPDATE otp_codes SET is_used = 1 WHERE id = ?', [otpRows[0].id]);

    const [userRows] = await connection.query(
      'SELECT id, email, name FROM store_users WHERE id = ?',
      [userId]
    );
    
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = userRows[0];
    
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
  } finally {
    connection.release();
  }
});

// ============================================================
// POST: Resend Email 2FA
// ============================================================
router.post('/resend-email-2fa', async (req, res, next) => {
  try {
    const { userId, email } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    await pool.query(
      `UPDATE otp_codes SET is_used = 1 WHERE user_id = ? AND purpose = 'email_2fa' AND is_used = 0`,
      [userId]
    );
    
    await pool.query(
      `INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at) 
       VALUES (?, ?, 'email_2fa', ?)`,
      [userId, otp, expiresAt]
    );
    
    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      console.error('❌ Failed to resend OTP:', emailError.message);
    }
    
    res.json({ success: true, message: 'OTP resent to your email' });
    
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST: Verify Authenticator 2FA
// ============================================================
router.post('/twofa/verify', async (req, res, next) => {
  try {
    const { userId, token } = req.body;
    
    if (!userId || !token) {
      return res.status(400).json({ success: false, message: 'User ID and token required' });
    }
    
    const [rows] = await pool.query(
      'SELECT id, email, name, twofa_secret FROM store_users WHERE id = ?',
      [userId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = rows[0];
    
    if (!user.twofa_secret) {
      return res.status(400).json({ success: false, message: '2FA not enabled for this user' });
    }
    
    const isValid = authenticator.verify({ token, secret: user.twofa_secret });
    
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid TOTP code' });
    }
    
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    next(error);
  }
});

// ... (rest of auth routes - profile, sessions, connected apps, etc.)
// These remain the same as your existing file

module.exports = router;
