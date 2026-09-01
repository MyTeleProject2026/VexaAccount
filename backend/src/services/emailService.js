const nodemailer = require('nodemailer');

// VexaAccount production email delivery uses Brevo SMTP only.
// Canonical Render environment variables:
//   BREVO_EMAIL       - verified sender email
//   BREVO_SMTP_HOST   - smtp-relay.brevo.com
//   BREVO_SMTP_PORT   - 587 (or 465 for TLS)
//   BREVO_SMTP_USER   - Brevo SMTP login
//   BREVO_SMTP_KEY    - Brevo SMTP key (used as the SMTP password)
//
// BREVO_PASSWORD is intentionally NOT used here. A Brevo API key (for example
// xkeysib-...) is not an SMTP password. Do not put API keys into SMTP_PASS.
// The old SMPT spelling is intentionally not used anymore.
const configuredHost = String(process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const SMTP_HOST = configuredHost.includes('@smtp-brevo.com')
  ? 'smtp-relay.brevo.com'
  : configuredHost;
const SMTP_PORT = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.BREVO_SMTP_USER || process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS || process.env.SMTP_KEY || '').trim();
const FROM_EMAIL = String(process.env.BREVO_EMAIL || process.env.FROM_EMAIL || process.env.GMAIL_USER || '').trim();
const FROM_NAME = String(process.env.MAIL_FROM_NAME || 'VexaAccount').trim();

let smtpTransporter = null;
let transporterConfigKey = '';

function getSmtpTransporter() {
  if (!SMTP_USER || !SMTP_PASS || !FROM_EMAIL) return null;

  const configKey = `${SMTP_HOST}:${SMTP_PORT}:${SMTP_USER}:${FROM_EMAIL}`;
  if (!smtpTransporter || transporterConfigKey !== configKey) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      tls: {
        minVersion: 'TLSv1.2'
      }
    });
    transporterConfigKey = configKey;
  }

  return smtpTransporter;
}

async function sendEmail({ to, subject, html }) {
  const transporter = getSmtpTransporter();

  if (!transporter) {
    const missing = [];
    if (!SMTP_USER) missing.push('BREVO_SMTP_USER');
    if (!SMTP_PASS) missing.push('BREVO_SMTP_KEY');
    if (!FROM_EMAIL) missing.push('BREVO_EMAIL');

    const error = new Error(`Brevo SMTP is not configured: missing ${missing.join(', ')}`);
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html
    });

    console.log('Email accepted by Brevo SMTP:', info.messageId || to);
    return true;
  } catch (error) {
    const details = error.response || error.code || error.message;
    console.error('Brevo SMTP email delivery failed:', details);
    const sendError = new Error(`Email delivery failed: ${details}`);
    sendError.code = 'EMAIL_SEND_FAILED';
    throw sendError;
  }
}

async function sendOtpEmail(to, otp) {
  const html = `<div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b0b;color:#fff"><h2>VexaAccount Verification</h2><p>Your 6-digit verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#06b6d4;margin:16px 0">${otp}</div><p style="color:#cbd5e1">This code expires in 10 minutes.</p></div>`;
  return sendEmail({ to, subject: '🔐 VexaAccount Verification Code', html });
}

async function sendResetEmail(to, resetLink) {
  const html = `<div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b0b;color:#fff"><h2>Reset Your Password</h2><p>Click the link below to reset your password. This link expires in 1 hour.</p><a href="${resetLink}" style="display:inline-block;background:#06b6d4;color:#000;padding:12px 24px;text-decoration:none;border-radius:12px;font-weight:bold;margin:16px 0">Reset Password</a><p style="color:#cbd5e1">If you didn't request this, please ignore this email.</p></div>`;
  return sendEmail({ to, subject: '🔑 VexaAccount Password Reset', html });
}

module.exports = { sendEmail, sendOtpEmail, sendResetEmail };
