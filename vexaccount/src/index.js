require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path'); // ✅ ADD THIS
const { testConnection } = require('./config/database');

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
