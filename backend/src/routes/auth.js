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

// ============================================================
// REGISTER
// ============================================================
router.post('/register', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { email, password, name, firstName, lastName, gender, dob, country } = req.body;
    if (!email || !password || !name) return res.status(400).json({ success:false, message:'Email, password and name required' });
    if (String(password).length < 8) return res.status(400).json({ success:false, message:'Password must be at least 8 characters' });
    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await connection.query('SELECT id,is_verified FROM store_users WHERE email=?',[normalizedEmail]);
    if (existing.length) {
      if (existing[0].is_verified === 0) {
        const otp=generateOTP(), expiresAt=new Date(Date.now()+10*60*1000);
        await connection.query('DELETE FROM otp_codes WHERE user_id=? AND purpose="email_verification"',[existing[0].id]);
        await connection.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_verification", ?)',[existing[0].id,otp,expiresAt]);
        try { await sendOtpEmail(normalizedEmail,otp); } catch(e) { console.error('OTP email error:',e.message); }
        return res.status(409).json({success:false,message:'Account already registered but not verified. A new OTP was sent.',action:'verify'});
      }
      return res.status(409).json({success:false,message:'Email already registered. Please login.'});
    }
    const hashed=await bcrypt.hash(password,12);
    const [result]=await connection.query('INSERT INTO store_users (email,password,name,is_verified,first_name,last_name,gender,dob,country,created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, NOW())',[normalizedEmail,hashed,name.trim(),firstName||null,lastName||null,gender||null,dob||null,country||null]);
    const otp=generateOTP(), expiresAt=new Date(Date.now()+10*60*1000);
    await connection.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_verification", ?)',[result.insertId,otp,expiresAt]);
    try { await sendOtpEmail(normalizedEmail,otp); } catch(e) { console.error('OTP email error:',e.message); }
    res.json({success:true,message:'Registration successful. Please verify your email with the OTP.',data:{id:result.insertId}});
  } catch(e) { next(e); } finally { connection.release(); }
});

router.post('/verify-otp', async(req,res,next)=>{const connection=await pool.getConnection();try{const {email,otp}=req.body;if(!email||!otp)return res.status(400).json({success:false,message:'Email and OTP required'});const [u]=await connection.query('SELECT id,email,name FROM store_users WHERE email=?',[email.trim().toLowerCase()]);if(!u.length)return res.status(404).json({success:false,message:'User not found'});const [o]=await connection.query('SELECT id,expires_at FROM otp_codes WHERE user_id=? AND otp_code=? AND purpose="email_verification" AND is_used=0 ORDER BY id DESC LIMIT 1',[u[0].id,otp]);if(!o.length)return res.status(400).json({success:false,message:'Invalid OTP'});if(new Date()>new Date(o[0].expires_at))return res.status(400).json({success:false,message:'OTP expired'});await connection.query('UPDATE otp_codes SET is_used=1 WHERE id=?',[o[0].id]);await connection.query('UPDATE store_users SET is_verified=1 WHERE id=?',[u[0].id]);const token=jwt.sign({id:u[0].id,email:u[0].email,role:'user'},JWT_SECRET,{expiresIn:'7d'});res.cookie('vexaccount_session',token,{httpOnly:true,secure:IS_PRODUCTION,sameSite:process.env.COOKIE_SAME_SITE||'lax',maxAge:7*24*60*60*1000,path:'/'});res.json({success:true,token,user:{id:u[0].id,email:u[0].email,name:u[0].name}});}catch(e){next(e);}finally{connection.release();}});

router.post('/resend-otp', async(req,res,next)=>{try{const {email}=req.body;if(!email)return res.status(400).json({success:false,message:'Email required'});const [u]=await pool.query('SELECT id,is_verified FROM store_users WHERE email=?',[email.trim().toLowerCase()]);if(!u.length)return res.status(404).json({success:false,message:'User not found'});if(u[0].is_verified)return res.status(400).json({success:false,message:'Email already verified. Please login.'});const otp=generateOTP(),expiresAt=new Date(Date.now()+10*60*1000);await pool.query('DELETE FROM otp_codes WHERE user_id=? AND purpose="email_verification"',[u[0].id]);await pool.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_verification", ?)',[u[0].id,otp,expiresAt]);try{await sendOtpEmail(email,otp);}catch(e){console.error('OTP resend error:',e.message);}res.json({success:true,message:'OTP resent to your email.'});}catch(e){next(e);}});

// ============================================================
// LOGIN + 2FA
// ============================================================
router.post('/login', async(req,res,next)=>{try{const {email,password}=req.body;if(!email||!password)return res.status(400).json({success:false,message:'Email and password required'});const [rows]=await pool.query('SELECT * FROM store_users WHERE email=?',[email.trim().toLowerCase()]);if(!rows.length)return res.status(401).json({success:false,message:'Invalid credentials'});const user=rows[0];if(!user.is_verified)return res.status(403).json({success:false,message:'Please verify your email first'});if(!user.is_active)return res.status(403).json({success:false,message:'Account disabled'});if(!await bcrypt.compare(password,user.password))return res.status(401).json({success:false,message:'Invalid credentials'});if(user.twofa_enabled===1&&user.twofa_secret)return res.json({success:true,requiresAuthenticator2fa:true,userId:user.id,message:'Authenticator 2FA verification required'});if(user.email_2fa_enabled===1){const otp=generateOTP(),expiresAt=new Date(Date.now()+10*60*1000);await pool.query('UPDATE otp_codes SET is_used=1 WHERE user_id=? AND purpose="email_2fa" AND is_used=0',[user.id]);await pool.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_2fa", ?)',[user.id,otp,expiresAt]);try{await sendOtpEmail(user.email,otp);}catch(e){console.error('Email 2FA error:',e.message);}return res.json({success:true,requiresEmail2fa:true,userId:user.id,message:'OTP sent to your email'});}const token=jwt.sign({id:user.id,email:user.email,role:'user'},JWT_SECRET,{expiresIn:'7d'});res.cookie('vexaccount_session',token,{httpOnly:true,secure:IS_PRODUCTION,sameSite:process.env.COOKIE_SAME_SITE||'lax',maxAge:7*24*60*60*1000,path:'/'});res.json({success:true,token,user:{id:user.id,email:user.email,name:user.name,is_verified:user.is_verified}});}catch(e){next(e);}});

router.post('/verify-email-2fa', async(req,res,next)=>{const connection=await pool.getConnection();try{const {userId,email,otp}=req.body;if(!userId||!email||!otp)return res.status(400).json({success:false,message:'All fields required'});const [u]=await connection.query('SELECT id,email,name,is_active FROM store_users WHERE id=? AND email=?',[userId,email.trim().toLowerCase()]);if(!u.length||!u[0].is_active)return res.status(401).json({success:false,message:'Invalid authentication request'});const [o]=await connection.query('SELECT id,expires_at FROM otp_codes WHERE user_id=? AND otp_code=? AND purpose="email_2fa" AND is_used=0 ORDER BY id DESC LIMIT 1',[userId,otp]);if(!o.length)return res.status(400).json({success:false,message:'Invalid OTP'});if(new Date()>new Date(o[0].expires_at))return res.status(400).json({success:false,message:'OTP expired'});await connection.query('UPDATE otp_codes SET is_used=1 WHERE id=?',[o[0].id]);const user=u[0],token=jwt.sign({id:user.id,email:user.email,role:'user'},JWT_SECRET,{expiresIn:'7d'});res.cookie('vexaccount_session',token,{httpOnly:true,secure:IS_PRODUCTION,sameSite:process.env.COOKIE_SAME_SITE||'lax',maxAge:7*24*60*60*1000,path:'/'});res.json({success:true,token,user:{id:user.id,email:user.email,name:user.name}});}catch(e){next(e);}finally{connection.release();}});

router.post('/resend-email-2fa', async(req,res,next)=>{try{const {userId,email}=req.body;if(!userId||!email)return res.status(400).json({success:false,message:'All fields required'});const [u]=await pool.query('SELECT id,email,is_active FROM store_users WHERE id=? AND email=?',[userId,email.trim().toLowerCase()]);if(!u.length||!u[0].is_active)return res.status(401).json({success:false,message:'Invalid authentication request'});const otp=generateOTP(),expiresAt=new Date(Date.now()+10*60*1000);await pool.query('UPDATE otp_codes SET is_used=1 WHERE user_id=? AND purpose="email_2fa" AND is_used=0',[userId]);await pool.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "email_2fa", ?)',[userId,otp,expiresAt]);try{await sendOtpEmail(u[0].email,otp);}catch(e){console.error('Email 2FA resend error:',e.message);}res.json({success:true,message:'OTP resent to your email'});}catch(e){next(e);}});

router.post('/twofa/verify', async(req,res,next)=>{try{const {userId,token}=req.body;if(!userId||!token)return res.status(400).json({success:false,message:'User ID and token required'});const [rows]=await pool.query('SELECT id,email,name,twofa_secret,is_active FROM store_users WHERE id=?',[userId]);if(!rows.length||!rows[0].is_active)return res.status(404).json({success:false,message:'User not found'});const user=rows[0];if(!user.twofa_secret)return res.status(400).json({success:false,message:'2FA not enabled for this user'});if(!authenticator.verify({token,secret:user.twofa_secret}))return res.status(400).json({success:false,message:'Invalid TOTP code'});const jwtToken=jwt.sign({id:user.id,email:user.email,role:'user'},JWT_SECRET,{expiresIn:'7d'});res.cookie('vexaccount_session',jwtToken,{httpOnly:true,secure:IS_PRODUCTION,sameSite:process.env.COOKIE_SAME_SITE||'lax',maxAge:7*24*60*60*1000,path:'/'});res.json({success:true,token:jwtToken,user:{id:user.id,email:user.email,name:user.name}});}catch(e){next(e);}});

// ============================================================
// EMAIL 2FA
// ============================================================
router.get('/email-2fa/status',authUser,async(req,res,next)=>{try{const [r]=await pool.query('SELECT email_2fa_enabled FROM store_users WHERE id=?',[req.user.id]);res.json({success:true,enabled:r[0]?.email_2fa_enabled===1});}catch(e){next(e);}});
router.post('/email-2fa/enable',authUser,async(req,res,next)=>{try{await pool.query('UPDATE store_users SET email_2fa_enabled=1 WHERE id=?',[req.user.id]);res.json({success:true,message:'Email 2FA enabled successfully'});}catch(e){next(e);}});
router.post('/email-2fa/disable',authUser,async(req,res,next)=>{try{await pool.query('UPDATE store_users SET email_2fa_enabled=0 WHERE id=?',[req.user.id]);res.json({success:true,message:'Email 2FA disabled successfully'});}catch(e){next(e);}});

// ============================================================
// GOOGLE LOGIN
// ============================================================
router.post('/google',async(req,res,next)=>{try{const {google_id,email,name}=req.body;if(!google_id||!email)return res.status(400).json({success:false,message:'Missing Google data'});let [rows]=await pool.query('SELECT * FROM store_users WHERE google_id=? OR email=?',[google_id,email.trim().toLowerCase()]);let user;if(rows.length){user=rows[0];if(!user.google_id){await pool.query('UPDATE store_users SET google_id=? WHERE id=?',[google_id,user.id]);user.google_id=google_id;}}else{const [r]=await pool.query('INSERT INTO store_users (email,name,google_id,is_verified) VALUES (?, ?, ?, 1)',[email.trim().toLowerCase(),name||email.split('@')[0],google_id]);const [n]=await pool.query('SELECT * FROM store_users WHERE id=?',[r.insertId]);user=n[0];}const token=jwt.sign({id:user.id,email:user.email,role:'user'},JWT_SECRET,{expiresIn:'7d'});res.cookie('vexaccount_session',token,{httpOnly:true,secure:IS_PRODUCTION,sameSite:process.env.COOKIE_SAME_SITE||'lax',maxAge:7*24*60*60*1000,path:'/'});res.json({success:true,token,user:{id:user.id,email:user.email,name:user.name}});}catch(e){next(e);}});

// ============================================================
// PASSWORD RECOVERY
// ============================================================
router.post('/forgot-password',async(req,res,next)=>{try{const email=String(req.body.email||'').trim().toLowerCase();if(!email)return res.status(400).json({success:false,message:'Email is required'});const [rows]=await pool.query('SELECT id,email FROM store_users WHERE email=?',[email]);if(!rows.length)return res.json({success:true,message:'If your email is registered, you will receive a reset link.'});const user=rows[0],resetToken=jwt.sign({id:user.id,email:user.email,purpose:'password_reset'},JWT_SECRET,{expiresIn:'1h'});await pool.query('INSERT INTO otp_codes (user_id,otp_code,purpose,expires_at) VALUES (?, ?, "password_reset", DATE_ADD(NOW(),INTERVAL 1 HOUR)) ON DUPLICATE KEY UPDATE otp_code=VALUES(otp_code),expires_at=VALUES(expires_at)',[user.id,resetToken]);const resetBase=(process.env.AUTH_PUBLIC_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');const resetLink=`${resetBase}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;try{await sendResetEmail(email,resetLink);}catch(e){console.error('Reset email error:',e.message);}res.json({success:true,message:'If your email is registered, you will receive a reset link.'});}catch(e){next(e);}});

router.post('/reset-password',async(req,res,next)=>{const connection=await pool.getConnection();try{const {token,newPassword}=req.body;if(!token||!newPassword)return res.status(400).json({success:false,message:'Token and new password required'});if(String(newPassword).length<8)return res.status(400).json({success:false,message:'Password must be at least 8 characters'});let decoded;try{decoded=jwt.verify(token,JWT_SECRET);}catch{return res.status(400).json({success:false,message:'Invalid or expired token'});}if(decoded.purpose!=='password_reset')return res.status(400).json({success:false,message:'Invalid token purpose'});const [otpRows]=await connection.query('SELECT id FROM otp_codes WHERE user_id=? AND otp_code=? AND purpose="password_reset" AND is_used=0 AND expires_at>NOW()',[decoded.id,token]);if(!otpRows.length)return res.status(400).json({success:false,message:'Invalid or expired token'});const hashed=await bcrypt.hash(newPassword,12);await connection.query('UPDATE store_users SET password=? WHERE id=?',[hashed,decoded.id]);await connection.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[decoded.id]);await connection.query('UPDATE otp_codes SET is_used=1 WHERE id=?',[otpRows[0].id]);res.clearCookie('vexaccount_session',{httpOnly:true,secure:IS_PRODUCTION,sameSite:process.env.COOKIE_SAME_SITE||'lax',path:'/'});res.json({success:true,message:'Password reset successfully. Please sign in again.'});}catch(e){next(e);}finally{connection.release();}});

module.exports=router;
