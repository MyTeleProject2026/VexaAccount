const nodemailer = require('nodemailer');
const axios = require('axios');

// VexaAccount supports the existing Render SMTP configuration used by the
// production deployment. Both the historical SMPT_* spelling and the
// conventional SMTP_* spelling are accepted so an environment-variable
// rename is not required for the existing deployment.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.SMPT_PASS || process.env.SMPT_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.GMAIL_USER || SMTP_USER || 'vexatradeblockchainecosystem@gmail.com';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'VexaAccount';

// Optional Brevo HTTP API fallback. This is only used when SMTP is not
// configured. Keeping it here also supports deployments that already expose
// BREVO_API_KEY without changing their email templates.
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SMPT_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

let smtpTransporter = null;

function getSmtpTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

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

  // Prefer the configured SMTP relay. This matches the existing deployment
  // variables: SMTP_HOST, SMTP_PORT, SMTP_USER and SMPT_PASS/SMPT_KEY.
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to,
        subject,
        html
      });

      console.log('Email accepted by SMTP provider:', info.messageId || to);
      return true;
    } catch (error) {
      const details = error.response || error.code || error.message;
      console.error('SMTP email delivery failed:', details);
      const sendError = new Error(`Email delivery failed: ${details}`);
      sendError.code = 'EMAIL_SEND_FAILED';
      throw sendError;
    }
  }

  // If SMTP variables are not configured, use the Brevo HTTP API when a key
  // is available. No fake console-only success is returned.
  if (!BREVO_API_KEY) {
    const error = new Error(
      'Email provider is not configured: SMTP_HOST/SMTP_USER/SMPT_PASS (or SMPT_KEY) or BREVO_API_KEY is required'
    );
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        timeout: 30000
      }
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Email provider returned HTTP ${response.status}`);
    }

    console.log('Email accepted by Brevo API:', to);
    return true;
  } catch (error) {
    const details = error.response?.data?.message || error.response?.data?.code || error.message;
    console.error('Brevo email delivery request failed:', details);
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
