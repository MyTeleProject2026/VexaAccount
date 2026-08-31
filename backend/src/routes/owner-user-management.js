const express = require('express');
const { pool } = require('../config/database');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');

const router = express.Router();
router.use(requireSuperAdmin);

function limit(v, fallback=50, max=200){return Math.min(Math.max(Number(v)||fallback,1),max);}
async function columns(){const [rows]=await pool.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='store_users'`);return new Set(rows.map(r=>r.COLUMN_NAME));}
function bool(v){return v===true||v===1||v==='1';}

router.get('/users', auditAdminAction('owner.user.list','vexa_user'), async(req,res,next)=>{
 try{
  const q=String(req.query.q||'').trim(); const l=limit(req.query.limit); const off=Math.max(Number(req.query.offset)||0,0);
  const where=q?'WHERE (email LIKE ? OR name LIKE ? OR CAST(id AS CHAR)=?)':''; const params=q?[`%${q}%`,`%${q}%`,q]:[];
  const [rows]=await pool.query(`SELECT id,email,name,first_name,last_name,gender,dob,country,is_verified,is_active,twofa_enabled,email_2fa_enabled,created_at,updated_at FROM store_users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,[...params,l,off]);
  res.json({success:true,users:rows});
 }catch(e){next(e);}
});

router.get('/users/:id', async(req,res,next)=>{
 try{
  const id=Number(req.params.id); const [users]=await pool.query('SELECT * FROM store_users WHERE id=? LIMIT 1',[id]);
  if(!users.length)return res.status(404).json({success:false,message:'User not found'});
  const [credits]=await pool.query('SELECT credit_score,coins,updated_at FROM vexa_user_credit_balances WHERE user_id=?',[id]);
  const [sessions]=await pool.query('SELECT id,client_id,created_at,expires_at,revoked_at FROM sso_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[id]);
  const [events]=await pool.query('SELECT id,client_id,event_type,ip_address,user_agent,metadata,created_at FROM sso_security_events WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[id]);
  const [storage]=await pool.query('SELECT id,provider,storage_key,display_name,content_type,size_bytes,status,metadata,created_at,updated_at FROM vexa_user_storage_records WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[id]);
  const [notes]=await pool.query('SELECT id,note,created_at FROM vexa_user_admin_notes WHERE user_id=? ORDER BY created_at DESC LIMIT 100',[id]);
  res.json({success:true,user:users[0],credits:credits[0]||{credit_score:0,coins:0},sessions,securityEvents:events,storage,notes});
 }catch(e){next(e);}
});

router.patch('/users/:id/profile',auditAdminAction('owner.user.profile.update','vexa_user'),async(req,res,next)=>{
 try{
  const id=Number(req.params.id);const allowed=['email','name','first_name','last_name','gender','dob','country','avatar_url'];const cols=await columns();const fields=[],values=[];
  for(const key of allowed){if(req.body[key]!==undefined&&cols.has(key)){fields.push('`'+key+'`=?');values.push(key==='email'?String(req.body[key]).trim().toLowerCase():req.body[key]);}}
  if(!fields.length)return res.status(400).json({success:false,message:'No supported profile fields supplied'});
  values.push(id);const [r]=await pool.query(`UPDATE store_users SET ${fields.join(', ')} WHERE id=?`,values);if(!r.affectedRows)return res.status(404).json({success:false,message:'User not found'});
  res.json({success:true,message:'User profile updated'});
 }catch(e){next(e);}
});

router.patch('/users/:id/status',auditAdminAction('owner.user.status.update','vexa_user'),async(req,res,next)=>{
 try{if(typeof req.body.isActive!=='boolean')return res.status(400).json({success:false,message:'isActive must be boolean'});const [r]=await pool.query('UPDATE store_users SET is_active=? WHERE id=?',[req.body.isActive?1:0,req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,message:'User not found'});if(!req.body.isActive)await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[req.params.id]);res.json({success:true,isActive:req.body.isActive});}catch(e){next(e);}
});

router.post('/users/:id/security/reset-2fa',auditAdminAction('owner.user.security.reset_2fa','vexa_user'),async(req,res,next)=>{
 try{const id=Number(req.params.id);const c=await columns();const sets=[];if(c.has('twofa_enabled'))sets.push('twofa_enabled=0');if(c.has('twofa_secret'))sets.push('twofa_secret=NULL');if(c.has('email_2fa_enabled'))sets.push('email_2fa_enabled=0');if(!sets.length)return res.status(409).json({success:false,message:'This account schema does not expose 2FA fields'});sets.push('updated_at=CURRENT_TIMESTAMP');const [r]=await pool.query(`UPDATE store_users SET ${sets.join(', ')} WHERE id=?`,[id]);if(!r.affectedRows)return res.status(404).json({success:false,message:'User not found'});await pool.query('UPDATE otp_codes SET is_used=1 WHERE user_id=? AND is_used=0',[id]);await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[id]);res.json({success:true,message:'Authenticator and email 2FA enrollment reset; active SSO sessions revoked'});}catch(e){next(e);}
});

router.post('/users/:id/security/reset-passcode',auditAdminAction('owner.user.security.reset_passcode','vexa_user'),async(req,res,next)=>{
 try{const c=await columns();const candidates=['passcode_hash','passcode','pin_hash','pin_code'];const field=candidates.find(x=>c.has(x));if(!field)return res.status(409).json({success:false,message:'No passcode field exists in the current VexaAccount user schema'});const [r]=await pool.query(`UPDATE store_users SET \`${field}\`=NULL WHERE id=?`,[req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,message:'User not found'});res.json({success:true,message:'User passcode enrollment removed'});}catch(e){next(e);}
});

router.post('/users/:id/sessions/revoke-all',auditAdminAction('owner.user.sessions.revoke_all','vexa_user'),async(req,res,next)=>{try{await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[req.params.id]);await pool.query('UPDATE sso_refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[req.params.id]);res.json({success:true,message:'All active VexaAccount SSO sessions revoked'});}catch(e){next(e);}});

router.patch('/users/:id/credits',auditAdminAction('owner.user.credits.adjust','vexa_user'),async(req,res,next)=>{
 const conn=await pool.getConnection();try{const id=Number(req.params.id);const creditDelta=Number(req.body.creditScoreDelta||0);const coinsDelta=Number(req.body.coinsDelta||0);const reason=String(req.body.reason||'Owner adjustment').trim().slice(0,500);if(!Number.isInteger(creditDelta)||!Number.isInteger(coinsDelta)||(!creditDelta&&!coinsDelta))return res.status(400).json({success:false,message:'Provide an integer creditScoreDelta or coinsDelta'});await conn.beginTransaction();await conn.query('INSERT INTO vexa_user_credit_balances (user_id,credit_score,coins) VALUES (?,0,0) ON DUPLICATE KEY UPDATE user_id=user_id',[id]);await conn.query('UPDATE vexa_user_credit_balances SET credit_score=GREATEST(0,credit_score+?), coins=GREATEST(0,coins+?) WHERE user_id=?',[creditDelta,coinsDelta,id]);await conn.query('INSERT INTO vexa_user_credit_ledger (user_id,credit_score_delta,coins_delta,reason,admin_id) VALUES (?,?,?,?,?)',[id,creditDelta,coinsDelta,reason,req.superAdmin.adminId]);const [rows]=await conn.query('SELECT credit_score,coins,updated_at FROM vexa_user_credit_balances WHERE user_id=?',[id]);await conn.commit();res.json({success:true,credits:rows[0]});}catch(e){try{await conn.rollback();}catch{}next(e);}finally{conn.release();}
});

router.get('/users/:id/storage',async(req,res,next)=>{try{const [rows]=await pool.query('SELECT * FROM vexa_user_storage_records WHERE user_id=? ORDER BY created_at DESC',[req.params.id]);res.json({success:true,records:rows});}catch(e){next(e);}});
router.patch('/users/:id/storage/:recordId',auditAdminAction('owner.user.storage.update','vexa_storage'),async(req,res,next)=>{try{const status=String(req.body.status||'');if(!['active','disabled','deleted'].includes(status))return res.status(400).json({success:false,message:'Invalid storage status'});const [r]=await pool.query('UPDATE vexa_user_storage_records SET status=? WHERE id=? AND user_id=?',[status,req.params.recordId,req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Storage record not found'});res.json({success:true,status});}catch(e){next(e);}});
router.delete('/users/:id/storage/:recordId',auditAdminAction('owner.user.storage.delete','vexa_storage'),async(req,res,next)=>{try{const [r]=await pool.query('DELETE FROM vexa_user_storage_records WHERE id=? AND user_id=?',[req.params.recordId,req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Storage record not found'});res.json({success:true,message:'Storage metadata record removed'});}catch(e){next(e);}});
router.post('/users/:id/notes',auditAdminAction('owner.user.note.create','vexa_user'),async(req,res,next)=>{try{const note=String(req.body.note||'').trim();if(!note)return res.status(400).json({success:false,message:'note is required'});const [r]=await pool.query('INSERT INTO vexa_user_admin_notes (user_id,admin_id,note) VALUES (?,?,?)',[req.params.id,req.superAdmin.adminId,note]);res.status(201).json({success:true,id:r.insertId});}catch(e){next(e);}});

module.exports=router;