const nodemailer = require('nodemailer');

// VexaAccount production email delivery uses Brevo SMTP.
// Canonical environment-variable names are SMTP_*.
// The legacy SMPT_* names are accepted temporarily for backwards compatibility
// so an existing deployment does not break during the rename.
const SMTP_HOST = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER;
const SMTP_PASS =
  process.env.SMTP_PASS ||
  process.env.SMTP_KEY ||
  process.env.SMPT_PASS ||
  process.env.SMPT_KEY;
const FROM_EMAIL =
  process.env.FROM_EMAIL ||
  process.env.GMAIL_USER ||
  SMTP_USER ||
  'vexatradeblockchainecosystem@gmail.com';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'VexaAccount';

let smtpTransporter = null;

function getSmtpTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;

  if (!smtpTransporter) {
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
      socketTimeout: 30000
    });
  }

  return smtpTransporter;
}

async function sendEmail({ to, subject, html }) {
  const transporter = getSmtpTransporter();

  if (!transporter) {
    const error = new Error(
      'SMTP email is not configured: SMTP_USER and SMTP_PASS (or SMTP_KEY) are required'
    );
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
