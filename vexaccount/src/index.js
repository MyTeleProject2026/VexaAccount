// vexaccount/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { testConnection } = require('./config/database');
const { pool } = require('./config/database');

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';

app.set('trust proxy', 1);

// Cookie Parser Middleware
app.use(cookieParser());

// CORS – allow all Vexa apps origins
const allowedOrigins = [
  process.env.FRONTEND_USER_URL || 'http://localhost:5173',
  process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://vexastore.onrender.com',
  'https://vexastore-admin.onrender.com',
  'https://vexatrade.onrender.com',
  'https://vexatrade-v.2bd.net',
  'https://www.vexatrade-v.2bd.net',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ✅ IMPORTANT: Auth routes MUST be mounted before other routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'VexaAccount Service is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================================
// ✅ SESSION ROUTES (for account switcher)
// ============================================================

// Check if user has active session
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

// Session login (for account switcher)
app.post('/api/auth/session-login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, name, is_verified, is_active, twofa_enabled FROM store_users WHERE email = ?',
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
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
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

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('vexaccount_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ============================================================
// ✅ SSO PAGE ROUTES
// ============================================================

// ✅ SSO Redirect - Check session first (GET only)
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
      // Invalid session - ignore
    }
  }
  
  res.redirect(`/auth/login-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// ✅ SSO Register - Check session first (GET only)
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
      // Invalid session - ignore
    }
  }
  
  res.redirect(`/auth/register-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// ✅ Login Page
app.get('/auth/login-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// ✅ Register Page
app.get('/auth/register-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// ✅ Account Switcher Page
app.get('/auth/account-switcher', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/account-switcher.html'));
});

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
    console.log(`📱 Frontend User: ${process.env.FRONTEND_USER_URL || 'http://localhost:5173'}`);
    console.log(`⚙️  Frontend Admin: ${process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174'}`);
    console.log(`🔐 SSO Login Page: /auth/login-page`);
    console.log(`🔐 SSO Register Page: /auth/register-page`);
    console.log(`🔄 Account Switcher: /auth/account-switcher`);
    console.log(`📝 POST /api/auth/login → authRoutes`);
  });
}

startServer();
