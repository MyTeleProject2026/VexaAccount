const nodemailer = require('nodemailer');

// VexaAccount production email delivery uses Brevo SMTP.
// IMPORTANT: these names intentionally match the existing Render variables.
// Do not require users to rename/recreate their Render environment variables.
//
// BREVO_EMAIL       = verified sender email
// BREVO_PASSWORD    = legacy/unused API credential; NEVER use as SMTP password
// BREVO_SMTP_HOST   = normally smtp-relay.brevo.com (bad legacy values are normalized)
// BREVO_SMTP_PORT   = normally 587; 2525 is used automatically if 587 times out
// BREVO_SMTP_USER   = Brevo SMTP login
// BREVO_SMTP_KEY    = Brevo SMTP key, used as the SMTP password
//
// Generic SMTP_* variables remain supported as a fallback for compatibility.

function normalizeHost(value) {
  const host = String(value || '').trim();
  if (!host || host.includes('@smtp-brevo.com') || host.includes('@smtp.brevo.com')) {
    return 'smtp-relay.brevo.com';
  }
  return host.replace(/^smtps?:\/\//i, '').replace(/\/$/, '');
}

const SMTP_HOST = normalizeHost(process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST);
const configuredPort = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.BREVO_SMTP_USER || process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(
  process.env.BREVO_SMTP_KEY ||
  process.env.SMTP_PASS ||
  process.env.SMTP_KEY ||
  ''
).trim();
const FROM_EMAIL = String(
  process.env.BREVO_EMAIL ||
  process.env.FROM_EMAIL ||
  process.env.GMAIL_USER ||
  ''
).trim();
const FROM_NAME = String(process.env.MAIL_FROM_NAME || 'VexaAccount').trim();

// Brevo supports 587 and 2525 for normal SMTP submission. If Render/network
// connectivity times out on the configured port, retry on 2525 without
// requiring any Render environment-variable change.
const smtpPorts = configuredPort === 2525
  ? [2525, 587]
  : configuredPort === 465
    ? [465, 587, 2525]
    : [configuredPort, 2525];

const transporters = new Map();

function getSmtpTransporter(port) {
  if (!SMTP_USER || !SMTP_PASS || !FROM_EMAIL) return null;

  if (!transporters.has(port)) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: {
        minVersion: 'TLSv1.2',
        servername: SMTP_HOST
      }
    });
    transporters.set(port, transporter);
  }

  return transporters.get(port);
}

function isRetryableNetworkError(error) {
  const code = String(error?.code || '').toUpperCase();
  return [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ESOCKET'
  ].includes(code);
}

function formatSmtpError(error) {
  return String(error?.response || error?.code || error?.message || 'Unknown SMTP error');
}

async function sendEmail({ to, subject, html }) {
  if (!SMTP_USER || !SMTP_PASS || !FROM_EMAIL) {
    const missing = [];
    if (!SMTP_USER) missing.push('BREVO_SMTP_USER');
    if (!SMTP_PASS) missing.push('BREVO_SMTP_KEY');
    if (!FROM_EMAIL) missing.push('BREVO_EMAIL');

    const error = new Error(`Brevo SMTP is not configured: missing ${missing.join(', ')}`);
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  let lastError = null;

  for (const port of smtpPorts) {
    const transporter = getSmtpTransporter(port);
    try {
      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to,
        subject,
        html
      });

      console.log(`Brevo SMTP email accepted on port ${port}:`, info.messageId || to);
      return true;
    } catch (error) {
      lastError = error;
      const details = formatSmtpError(error);
      console.error(`Brevo SMTP email delivery failed on port ${port}:`, details);

      // Authentication, sender, recipient, and other SMTP 4xx/5xx responses
      // should not be retried against another port. Network timeouts/resets
      // can safely try Brevo's alternate SMTP submission port.
      if (!isRetryableNetworkError(error)) break;
    }
  }

  const details = formatSmtpError(lastError);
  const sendError = new Error(`Email delivery failed: ${details}`);
  sendError.code = 'EMAIL_SEND_FAILED';
  throw sendError;
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
