require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path'); // ✅ ADD THIS
const { testConnection } = require('./config/database');

app.use(cookieParser());
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

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

// Remove this line:
// const cookieParser = require('cookie-parser');

// Add this helper function instead:
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name && value) cookies[name] = decodeURIComponent(value);
  });
  return cookies;
}

// Then in your routes, use:
const cookies = parseCookies(req.headers.cookie);
const sessionToken = cookies.vexaccount_session;

// ✅ Check if user has active session (via cookie)
app.get('/api/auth/session', async (req, res) => {
  try {
    // Get session token from cookie
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

// ✅ Session login (for account switcher)
app.post('/api/auth/session-login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, name, is_verified, is_active FROM store_users WHERE email = ?',
      [email]
    );
    
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account disabled' });
    }

    // Check if authenticator 2FA is enabled
    if (user.twofa_enabled === 1) {
      // Redirect to 2FA page
      return res.json({
        success: true,
        requires2fa: true,
        userId: user.id,
        message: '2FA verification required'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set session cookie (optional - for account switcher)
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

// ✅ Logout (clear session)
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('vexaccount_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ✅ SSO Redirect - Check session first
app.get('/api/auth/login', async (req, res) => {
  const redirectUri = req.query.redirect_uri || process.env.FRONTEND_USER_URL;
  
  // Check if user has active session
  const sessionToken = req.cookies?.vexaccount_session;
  if (sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET);
      const [rows] = await pool.query(
        'SELECT id, email, name, avatar_url FROM store_users WHERE id = ? AND is_active = 1',
        [decoded.id]
      );
      if (rows.length) {
        // User has active session - show account switcher
        return res.redirect(`/auth/account-switcher?redirect_uri=${encodeURIComponent(redirectUri)}`);
      }
    } catch (error) {
      // Invalid session - ignore
    }
  }
  
  // No active session - redirect to login page
  res.redirect(`/auth/login-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// ✅ SSO Register - Check session first
app.get('/api/auth/register', async (req, res) => {
  const redirectUri = req.query.redirect_uri || process.env.FRONTEND_USER_URL;
  
  // Check if user has active session
  const sessionToken = req.cookies?.vexaccount_session;
  if (sessionToken) {
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET);
      const [rows] = await pool.query(
        'SELECT id, email, name, avatar_url FROM store_users WHERE id = ? AND is_active = 1',
        [decoded.id]
      );
      if (rows.length) {
        // User has active session - show account switcher
        return res.redirect(`/auth/account-switcher?redirect_uri=${encodeURIComponent(redirectUri)}`);
      }
    } catch (error) {
      // Invalid session - ignore
    }
  }
  
  // No active session - redirect to register page
  res.redirect(`/auth/register-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// ✅ Account Switcher Page
app.get('/auth/account-switcher', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/account-switcher.html'));
});

// ✅ Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Routes
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
// ✅ SSO PAGE ROUTES – Serve the HTML pages
// ============================================================

// ✅ Login Page Route
app.get('/auth/login-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// ✅ Register Page Route
app.get('/auth/register-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// ✅ SSO Redirect from frontend – goes to login page
app.get('/api/auth/login', (req, res) => {
  const redirectUri = req.query.redirect_uri || process.env.FRONTEND_USER_URL;
  // Redirect to the login page with redirect_uri
  res.redirect(`/auth/login-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// ✅ SSO Redirect from frontend – goes to register page
app.get('/api/auth/register', (req, res) => {
  const redirectUri = req.query.redirect_uri || process.env.FRONTEND_USER_URL;
  res.redirect(`/auth/register-page?redirect_uri=${encodeURIComponent(redirectUri)}`);
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
  });
}

startServer();
