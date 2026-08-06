const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.KEPLERS_SMTP_HOST && process.env.KEPLERS_EMAIL && process.env.KEPLERS_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: process.env.KEPLERS_SMTP_HOST,
      port: parseInt(process.env.KEPLERS_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.KEPLERS_EMAIL,
        pass: process.env.KEPLERS_PASSWORD,
      },
    });
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  } else {
    console.warn('⚠️ No mail service configured. Emails will be logged to console.');
    transporter = {
      sendMail: (mailOptions) => {
        console.log('📧 [FAKE EMAIL] To:', mailOptions.to);
        console.log('📧 [FAKE EMAIL] Subject:', mailOptions.subject);
        console.log('📧 [FAKE EMAIL] Body:', mailOptions.html);
        return Promise.resolve();
      }
    };
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter();
  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || 'VexaAccount'}" <${process.env.FROM_EMAIL || 'noreply@vexastore.com'}>`,
      to,
      subject,
      html
    });
    console.log('✅ Email sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    return false;
  }
}

async function sendOtpEmail(to, otp) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <h2 style="margin:0 0 16px;">VexaAccount Verification</h2>
      <p style="margin:0 0 16px;">Your 6-digit verification code is:</p>
      <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#06b6d4; margin:16px 0;">
        ${otp}
      </div>
      <p style="margin:16px 0 0; color:#cbd5e1;">This code expires in 10 minutes.</p>
    </div>
  `;
  return sendEmail({ to, subject: 'VexaAccount Email Verification', html });
}

async function sendResetEmail(to, resetLink) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <h2 style="margin:0 0 16px;">Reset Your Password</h2>
      <p style="margin:0 0 16px;">Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetLink}" style="display: inline-block; background: #06b6d4; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 16px 0;">
        Reset Password
      </a>
      <p style="margin:16px 0 0; color:#cbd5e1;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  return sendEmail({ to, subject: 'VexaAccount Password Reset', html });
}

module.exports = { sendEmail, sendOtpEmail, sendResetEmail };
