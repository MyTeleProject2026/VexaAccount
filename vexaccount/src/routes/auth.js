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
// ✅ UPDATED: Register with extra fields
// ============================================================
router.post('/register', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { 
      email, password, name, 
      firstName, lastName, gender, dob, country 
    } = req.body;

    console.log('📝 [REGISTER] Attempt for:', email);

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password and name required' });
    }

    // Check if user already exists
    const [existing] = await connection.query(
      'SELECT id, is_verified FROM store_users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (existing.length) {
      const user = existing[0];
      if (user.is_verified === 0) {
        // Resend OTP for unverified user
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

    // Create new user with extra fields
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      `INSERT INTO store_users (
        email, password, name, is_verified, 
        first_name, last_name, gender, dob, country, created_at
      ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, NOW())`,
      [
        email.trim().toLowerCase(), hashed, name.trim(),
        firstName || null, lastName || null, gender || null, 
        dob || null, country || null
      ]
    );

    // Generate and send OTP
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

// ... (rest of your auth routes remain unchanged)
module.exports = router;
