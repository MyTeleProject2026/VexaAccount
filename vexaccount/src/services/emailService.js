// vexaccount/src/services/emailService.js
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  // Priority 1: Brevo SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('✅ Brevo SMTP transporter configured');
    return transporter;
  }
  
  // Priority 2: Gmail (fallback)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
      },
    });
    console.log('✅ Gmail transporter configured (fallback)');
    return transporter;
  }
  
  console.warn('⚠️ No mail service configured. Emails will be logged to console.');
  transporter = {
    sendMail: (mailOptions) => {
      console.log('📧 [FAKE EMAIL] To:', mailOptions.to);
      console.log('📧 [FAKE EMAIL] Subject:', mailOptions.subject);
      console.log('📧 [FAKE EMAIL] Body:', mailOptions.html);
      return Promise.resolve();
    }
  };
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter();
  try {
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@vexastore.com';
    const fromName = process.env.MAIL_FROM_NAME || 'VexaAccount';
    
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html
    });
    console.log('✅ Email sent to:', to, 'Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    return false;
  }
}

async function sendOtpEmail(to, otp) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #050812; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #050812; padding: 20px;">
        <tr><td align="center">
          <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background: #0a0e1a; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); padding: 40px; max-width: 600px;">
            <tr><td align="center">
              <h1 style="color: #06b6d4; font-size: 28px; margin: 0 0 8px 0; font-weight: 700;">VexaAccount</h1>
              <p style="color: #94a3b8; font-size: 16px; margin: 0 0 30px 0;">Your verification code</p>
              <div style="background: rgba(6, 182, 212, 0.05); border-radius: 16px; padding: 30px; border: 1px solid rgba(6, 182, 212, 0.1); margin-bottom: 30px;">
                <p style="color: #ffffff; font-size: 14px; margin: 0 0 16px 0;">Enter this code to verify your email:</p>
                <div style="font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #06b6d4; background: rgba(6, 182, 212, 0.05); padding: 16px 24px; border-radius: 12px; font-family: monospace;">${otp}</div>
              </div>
              <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">This code expires in <strong style="color: #94a3b8;">10 minutes</strong>.</p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">If you didn't request this, please ignore this email.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;
  
  return sendEmail({ to, subject: '🔐 VexaAccount Verification Code', html });
}

async function sendResetEmail(to, resetLink) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #050812; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #050812; padding: 20px;">
        <tr><td align="center">
          <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background: #0a0e1a; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); padding: 40px; max-width: 600px;">
            <tr><td align="center">
              <h1 style="color: #06b6d4; font-size: 28px; margin: 0 0 8px 0; font-weight: 700;">VexaAccount</h1>
              <p style="color: #94a3b8; font-size: 16px; margin: 0 0 30px 0;">Reset your password</p>
              <p style="color: #cbd5e1; font-size: 16px; margin: 0 0 24px 0;">Click the button below to reset your password. This link expires in 1 hour.</p>
              <a href="${resetLink}" style="display: inline-block; background: #06b6d4; color: #000000; padding: 14px 40px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">Reset Password</a>
              <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">If you didn't request this, please ignore this email.</p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">Link expires in 1 hour.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;
  
  return sendEmail({ to, subject: '🔑 VexaAccount Password Reset', html });
}

module.exports = { sendEmail, sendOtpEmail, sendResetEmail };
