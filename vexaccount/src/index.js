// vexaccount/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { testConnection, pool } = require('./config/database');

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';

app.set('trust proxy', 1);

// Cookie Parser
app.use(cookieParser());

// CORS – allow all Vexa apps origins
const allowedOrigins = [
  process.env.FRONTEND_USER_URL || 'https://vexastore.onrender.com',
  process.env.FRONTEND_ADMIN_URL || 'https://vexastore-admin.onrender.com',
  'https://admin.vexatrade-v.2bd.net'
  'https://vexatrade.onrender.com',
  'https://vexatrade-v.2bd.net',
  'https://www.vexatrade-v.2bd.net',
  'https://vexawallet.onrender.com',
  'https://vexabrowser.onrender.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (HTML pages)
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Mount authentication routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'VexaAccount Service is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// ============================================================
// ✅ OTP VERIFY PAGE (Optional – for standalone OTP verification)
// ============================================================
app.get('/auth/otp-verify', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/otp-verify.html'));
});

// ============================================================
// SESSION ROUTES (for account switcher)
// ============================================================

app.get('/api/auth/session', async (req, res) => {
  try {
    const sessionToken = req.cookies?.vexaccount_session;
    if (!sessionToken) {
      return res.json({ success: false, message: 'No session' });
    }

    const decoded = jwt.verify(sessionToken, JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, email, name, avatar_url FROM store_users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length) {
      return res.json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (error) {
    res.json({ success: false, message: 'Invalid session' });
  }
});

app.post('/api/auth/session-login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, name, is_active, twofa_enabled FROM store_users WHERE email = ?',
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account disabled' });
    }

    if (user.twofa_enabled === 1) {
      return res.json({
        success: true,
        requires2fa: true,
        userId: user.id,
        message: '2FA verification required'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('vexaccount_session', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Session login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('vexaccount_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ============================================================
// SSO PAGE ROUTES
// ============================================================

app.get('/api/auth/login', async (req, res) => {
  const redirectUri = req.query.redirect_uri || process.env.FRONTEND_USER_URL;

  const sessionToken = req.cookies?.vexaccount_session;
  if (sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET);
      const [rows] = await pool.query(
        'SELECT id, email, name, avatar_url FROM store_users WHERE id = ? AND is_active = 1',
        [decoded.id]
      );
      if (rows.length) {
        return res.redirect(`/auth/account-switcher?redirect_uri=${encodeURIComponent(redirectUri)}`);
      }
    } catch (error) {
      res.clearCookie('vexaccount_session');
    }
  }

  res.redirect(`/auth/login-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

app.get('/api/auth/register', async (req, res) => {
  const redirectUri = req.query.redirect_uri || process.env.FRONTEND_USER_URL;

  const sessionToken = req.cookies?.vexaccount_session;
  if (sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET);
      const [rows] = await pool.query(
        'SELECT id, email, name, avatar_url FROM store_users WHERE id = ? AND is_active = 1',
        [decoded.id]
      );
      if (rows.length) {
        return res.redirect(`/auth/account-switcher?redirect_uri=${encodeURIComponent(redirectUri)}`);
      }
    } catch (error) {
      res.clearCookie('vexaccount_session');
    }
  }

  res.redirect(`/auth/register-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

app.get('/auth/login-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/auth/register-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

app.get('/auth/account-switcher', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/account-switcher.html'));
});

// ============================================================
// ✅ AUTO-CLEANUP – Delete unverified users after 1 hour
// ============================================================
async function cleanupUnverifiedUsers() {
  try {
    // ✅ Delete unverified users older than 1 hour
    const [result] = await pool.query(
      `DELETE FROM store_users 
       WHERE is_verified = 0 
       AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
    );
    if (result.affectedRows > 0) {
      console.log(`🧹 Cleaned up ${result.affectedRows} unverified users`);
    }

    // ✅ Also clean up expired OTP codes
    const [otpResult] = await pool.query(
      `DELETE FROM otp_codes 
       WHERE expires_at < NOW() 
       AND is_used = 0`
    );
    if (otpResult.affectedRows > 0) {
      console.log(`🧹 Cleaned up ${otpResult.affectedRows} expired OTPs`);
    }

    // ✅ Clean up orphaned OTPs (where user no longer exists)
    const [orphanResult] = await pool.query(
      `DELETE FROM otp_codes 
       WHERE user_id NOT IN (SELECT id FROM store_users)`
    );
    if (orphanResult.affectedRows > 0) {
      console.log(`🧹 Cleaned up ${orphanResult.affectedRows} orphaned OTPs`);
    }

  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  }
}

// ✅ Run cleanup every hour
setInterval(cleanupUnverifiedUsers, 60 * 60 * 1000);

// ✅ Run cleanup on startup (after 5 seconds)
setTimeout(cleanupUnverifiedUsers, 5000);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

async function startServer() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Database connection failed. Exiting...');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`🚀 VexaAccount Service running on port ${PORT}`);
    console.log(`🔐 SSO Login Page: /auth/login-page`);
    console.log(`🔐 SSO Register Page: /auth/register-page`);
    console.log(`🔄 Account Switcher: /auth/account-switcher`);
    console.log(`📧 OTP Verify Page: /auth/otp-verify`);
  });
}

startServer();
