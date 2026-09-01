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

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function generateOTP() { return String(Math.floor(100000 + Math.random() * 900000)); }

// Existing authentication routes below intentionally preserved; this change removes the insecure JWT fallback secret.
