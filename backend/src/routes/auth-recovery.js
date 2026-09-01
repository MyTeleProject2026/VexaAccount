const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { sendOtpEmail, sendResetEmail } = require('../services/emailService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured');

const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function setUserSession(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('vexaccount_session', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 604800000,
    path: '/'
  });
  return token;
}

// This route is mounted before the legacy auth router so the critical
// registration/recovery flows have one consistent response contract.
router.post('/register', async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const { email, password, name, firstName, lastName, gender, dob, country } = req.body;
    const e = normalizeEmail(email);

    if (!e || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password and name are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const [existing] = await c.query('SELECT id,is_verified FROM store_users WHERE email=?', [e]);
    if (existing.length) {
      if (existing[0].is_verified === 0) {
        const otp = generateOTP();
        await c.query('DELETE FROM otp_codes WHERE user_id=? AND purpose="email_verification"', [existing[0].id]);
        await c.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_verification", ?)', [existing[0].id, otp, new Date(Date.now() + 600000)]);
        try {
          await sendOtpEmail(e, otp);
          return res.status(200).json({ success: true, action: 'verify', verificationRequired: true, email: e, message: 'Your account already exists but is not verified. A new verification code has been sent.' });
        } catch (error) {
          console.error('Registration OTP delivery error:', error.message);
          return res.status(200).json({ success: true, action: 'verify', verificationRequired: true, email: e, emailDelivery: false, message: 'Your account already exists but is not verified. We could not send the verification email right now. Open verification and use Resend code when email service is available.' });
        }
      }
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign in or reset your password.' });
    }

    const hash = await bcrypt.hash(String(password), 12);
    const [result] = await c.query(
      'INSERT INTO store_users (email,password,name,is_verified,first_name,last_name,gender,dob,country,created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, NOW())',
      [e, hash, String(name).trim(), firstName || null, lastName || null, gender || null, dob || null, country || null]
    );

    const otp = generateOTP();
    await c.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_verification", ?)', [result.insertId, otp, new Date(Date.now() + 600000)]);

    try {
      await sendOtpEmail(e, otp);
      return res.status(201).json({ success: true, action: 'verify', verificationRequired: true, email: e, data: { id: result.insertId }, message: 'Account created successfully. Verify your email to continue.' });
    } catch (error) {
      console.error('Registration OTP delivery error:', error.message);
      return res.status(200).json({ success: true, action: 'verify', verificationRequired: true, email: e, emailDelivery: false, data: { id: result.insertId }, message: 'Account created successfully, but the verification email could not be sent. Continue to verification and use Resend code when email service is available.' });
    }
  } catch (error) {
    next(error);
  } finally {
    c.release();
  }
});

router.post('/resend-otp', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Enter your email address first.' });

    const [users] = await pool.query('SELECT id,is_verified FROM store_users WHERE email=?', [email]);
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'No VexaAccount was found for this email. Please check the email address or register an account.' });
    }
    if (users[0].is_verified) {
      return res.status(409).json({ success: false, message: 'This email is already verified. Please sign in.' });
    }

    const otp = generateOTP();
    await pool.query('DELETE FROM otp_codes WHERE user_id=? AND purpose="email_verification"', [users[0].id]);
    await pool.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_verification", ?)', [users[0].id, otp, new Date(Date.now() + 600000)]);

    try {
      await sendOtpEmail(email, otp);
      return res.json({ success: true, message: 'A new verification code was sent to your email.' });
    } catch (error) {
      console.error('Resend OTP email error:', error.message);
      return res.status(502).json({ success: false, message: 'We could not send the verification email right now. Please try again in a few minutes.' });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Enter your email address first.' });

    const [users] = await pool.query('SELECT id,email FROM store_users WHERE email=?', [email]);
    // Keep account enumeration protection for unknown addresses.
    if (!users.length) {
      return res.json({ success: true, message: 'If this email is registered, you will receive a reset link.' });
    }

    const user = users[0];
    const token = jwt.sign({ id: user.id, email: user.email, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '1h' });
    await pool.query(
      'INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "password_reset", DATE_ADD(NOW(),INTERVAL 1 HOUR)) ON DUPLICATE KEY UPDATE otp_code=VALUES(otp_code),expires_at=VALUES(expires_at),is_used=0',
      [user.id, token]
    );

    const base = String(process.env.FRONTEND_USER_URL || 'https://vexaaccount-management.onrender.com').replace(/\/$/, '');
    const resetLink = `${base}/#/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await sendResetEmail(email, resetLink);
    } catch (error) {
      console.error('Reset email delivery error:', error.message);
      // Do not tell the user a reset email was sent when the provider failed.
      return res.status(502).json({ success: false, message: 'We found your account, but could not send the reset email right now. Please try again in a few minutes.' });
    }

    return res.json({ success: true, message: 'Reset link sent. Check your email and follow the link to choose a new password.' });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const [rows] = await pool.query('SELECT * FROM store_users WHERE email=? LIMIT 1', [email]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });

    const user = rows[0];
    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first.', action: 'verify', email: user.email });
    }
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Your account is disabled. Please contact support.' });

    const valid = await bcrypt.compare(password, user.password || '');
    if (!valid) return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });

    if (user.twofa_enabled === 1 && user.twofa_secret) {
      return res.json({ success: true, requiresAuthenticator2fa: true, userId: user.id, message: 'Authenticator 2FA verification required.' });
    }

    if (user.email_2fa_enabled === 1) {
      const otp = generateOTP();
      await pool.query('UPDATE otp_codes SET is_used=1 WHERE user_id=? AND purpose="email_2fa" AND is_used=0', [user.id]);
      await pool.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_2fa", ?)', [user.id, otp, new Date(Date.now() + 600000)]);
      try {
        await sendOtpEmail(user.email, otp);
      } catch (error) {
        console.error('Email 2FA OTP error:', error.message);
        return res.status(502).json({ success: false, message: 'Your password is correct, but we could not send the sign-in verification code. Please try again.' });
      }
      return res.json({ success: true, requiresEmail2fa: true, userId: user.id, message: 'Sign-in verification code sent to your email.' });
    }

    const token = setUserSession(res, user);
    return res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, is_verified: user.is_verified } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
