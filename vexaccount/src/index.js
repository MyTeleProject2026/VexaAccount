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
    const { email } = req.body
