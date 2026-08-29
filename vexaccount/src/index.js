// vexaccount/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { testConnection, pool } = require('./config/database');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const ssoRoutes = require('./routes/sso');
const ssoAccountRoutes = require('./routes/sso-account');
const superOwnerAdminRoutes = require('./routes/super-owner-admins');
const ssoAdminRoutes = require('./routes/sso-admin');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? null : 'vexastore_jwt_secret_key');
if (IS_PRODUCTION && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
}

app.set('trust proxy', process.env.TRUST_PROXY || 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cookieParser());

const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const allowedOrigins = [...configuredOrigins,
  process.env.FRONTEND_USER_URL, process.env.FRONTEND_ADMIN_URL,
  'https://vexastore.onrender.com','https://www.vexastore.onrender.com','https://vexastore.2bd.net','https://www.vexastore.2bd.net','https://vexastore-admin.onrender.com',
  'https://vexatrade-6nhs.onrender.com','https://vexatrade-v.2bd.net','https://www.vexatrade-v.2bd.net','https://admin.vexatrade-v.2bd.net','https://vexatrade.onrender.com','https://vexatrade-admin.onrender.com','https://admin-vexatrade-manage.onrender.com','https://vexatrade-admin-n36m.onrender.com',
  'https://vexawallet.onrender.com','https://vexabrowser.onrender.com','https://learn-vexatrade.onrender.com',
  'https://api-vexaaccount.onrender.com','https://api-vexastore.onrender.com','https://vexatrade-server.onrender.com','https://vexatrade-5ycu.onrender.com','https://vexatrade-ecosystem-api.onrender.com',
  'http://localhost:5173','http://localhost:5174','http://localhost:3000'
].filter((v,i,a)=>v&&a.indexOf(v)===i);

app.use(cors({ origin: (origin, cb) => { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by VexaAccount CORS policy')); }, credentials: true, methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders:['Origin','X-Requested-With','Content-Type','Accept','Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const limiter = rateLimit({ windowMs:15*60*1000, max:100, standardHeaders:true, legacyHeaders:false, message:{success:false,message:'Too many requests, please try again later.'} });
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/sso', ssoRoutes);
app.use('/api/account/sso', ssoAccountRoutes);
app.use('/api/admin/super-owners', superOwnerAdminRoutes);
app.use('/api/admin/sso', ssoAdminRoutes);

app.get('/api/health', (req,res)=>res.json({success:true,message:'VexaAccount Service is running',timestamp:new Date().toISOString(),version:'2.1.0'}));
app.get('/auth/otp-verify',(req,res)=>res.sendFile(path.join(__dirname,'../public/otp-verify.html')));
app.get('/auth/otp-verify.html',(req,res)=>res.sendFile(path.join(__dirname,'../public/otp-verify.html')));

app.get('/api/auth/session', async (req,res)=>{try{const sessionToken=req.cookies?.vexaccount_session;if(!sessionToken)return res.json({success:false,message:'No session'});const decoded=jwt.verify(sessionToken,JWT_SECRET);const [rows]=await pool.query('SELECT id,email,name,avatar_url FROM store_users WHERE id=?',[decoded.id]);if(!rows.length)return res.json({success:false,message:'User not found'});res.json({success:true,user:rows[0]});}catch(error){res.json({success:false,message:'Invalid session'});}});
app.post('/api/auth/session-login', async (req,res)=>{try{const{email}=req.body;if(!email)return res.status(400).json({success:false,message:'Email required'});const [rows]=await pool.query('SELECT id,email,name,is_active,twofa_enabled FROM store_users WHERE email=?',[email]);if(!rows.length)return res.status(404).json({success:false,message:'User not found'});const user=rows[0];if(!user.is_active)return res.status(403).json({success:false,message:'Account disabled'});if(user.twofa_enabled===1)return res.json({success:true,requires2fa:true,userId:user.id,message:'2FA verification required'});const token=jwt.sign({id:user.id,email:user.email,role:'user'},JWT_SECRET,{expiresIn:'7d'});res.cookie('vexaccount_session',token,{httpOnly:true,secure:IS_PRODUCTION,sameSite:'lax',maxAge:7*24*60*60*1000,path:'/'});res.json({success:true,token,user:{id:user.id,email:user.email,name:user.name}});}catch(error){console.error('Session login error:',error);res.status(500).json({success:false,message:error.message});}});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('vexaccount_session',{httpOnly:true,secure:IS_PRODUCTION,sameSite:'lax',path:'/'});res.json({success:true,message:'Logged out successfully'});});

app.get('/api/auth/login', async (req,res)=>{const redirectUri=req.query.redirect_uri||process.env.FRONTEND_USER_URL;const sessionToken=req.cookies?.vexaccount_session;if(sessionToken){try{jwt.verify(sessionToken,JWT_SECRET);if(redirectUri)return res.redirect(redirectUri);return res.json({success:true,message:'Already authenticated'});}catch(_){} }res.json({success:true,login_required:true,redirect_uri:redirectUri||null});});

app.use((err,req,res,next)=>{console.error(err);if(err.message==='Origin not allowed by VexaAccount CORS policy')return res.status(403).json({success:false,message:'Origin not allowed'});res.status(500).json({success:false,message:IS_PRODUCTION?'Internal server error':err.message});});

(async()=>{try{await testConnection();app.listen(PORT,()=>console.log(`VexaAccount server running on port ${PORT}`));}catch(error){console.error('Database connection failed:',error);process.exit(1);}})();

module.exports=app;
