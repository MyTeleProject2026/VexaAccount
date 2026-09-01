const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM_EMAIL = process.env.FROM_EMAIL || 'vexatradeblockchainecosystem@gmail.com';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'VexaAccount';

async function sendEmail({ to, subject, html }) {
  if (!BREVO_API_KEY) {
    const error = new Error('Email provider is not configured: BREVO_API_KEY is required');
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  try {
    const response = await axios.post(BREVO_API_URL,{sender:{name:FROM_NAME,email:FROM_EMAIL},to:[{email:to}],subject,htmlContent:html},{headers:{'Content-Type':'application/json','api-key':BREVO_API_KEY},timeout:30000});
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Email provider returned HTTP ${response.status}`);
    }
    console.log('Email accepted by provider for:', to);
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
  return sendEmail({to,subject:'🔐 VexaAccount Verification Code',html});
}
async function sendResetEmail(to, resetLink) {
  const html = `<div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b0b;color:#fff"><h2>Reset Your Password</h2><p>Click the link below to reset your password. This link expires in 1 hour.</p><a href="${resetLink}" style="display:inline-block;background:#06b6d4;color:#000;padding:12px 24px;text-decoration:none;border-radius:12px;font-weight:bold;margin:16px 0">Reset Password</a><p style="color:#cbd5e1">If you didn't request this, please ignore this email.</p></div>`;
  return sendEmail({to,subject:'🔑 VexaAccount Password Reset',html});
}
module.exports = { sendEmail, sendOtpEmail, sendResetEmail };
