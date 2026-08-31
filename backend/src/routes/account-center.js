const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function getToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : req.cookies?.vexaccount_session || null;
}

function requireUser(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    const claims = jwt.verify(token, JWT_SECRET);
    const userId = claims.sub || claims.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid identity' });
    req.accountUser = { ...claims, userId };
    next();
  } catch { return res.status(401).json({ success: false, message: 'Invalid or expired session' }); }
}

router.use(requireUser);
router.get('/apps', async (req, res, next) => { try { const [rows] = await pool.query(`SELECT r.client_id, r.display_name, r.application_key, r.environment, r.status, r.description, c.is_active, c.last_used_at, co.scopes, co.granted_at FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id LEFT JOIN sso_consents co ON co.client_id=r.client_id AND co.user_id=? AND co.revoked_at IS NULL ORDER BY r.display_name ASC`, [req.accountUser.userId]); res.json({ success:true, applications:rows }); } catch(error){ next(error); } });
router.get('/sessions', async (req,res,next)=>{ try { const [rows] = await pool.query(`SELECT s.id, s.client_id, r.display_name, s.scope, s.created_at, s.last_seen_at, s.expires_at FROM sso_sessions s LEFT JOIN sso_client_registry r ON r.client_id=s.client_id WHERE s.user_id=? AND s.revoked_at IS NULL AND s.expires_at > NOW() ORDER BY s.last_seen_at DESC`, [req.accountUser.userId]); res.json({success:true,sessions:rows}); } catch(error){next(error);} });
router.delete('/sessions/:id', async(req,res,next)=>{try{const [result]=await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE id=? AND user_id=? AND revoked_at IS NULL',[req.params.id,req.accountUser.userId]);if(!result.affectedRows)return res.status(404).json({success:false,message:'Session not found'});await pool.query('INSERT INTO sso_security_events (user_id,event_type,metadata) VALUES (?,?,?)',[req.accountUser.userId,'sso.session_revoked',JSON.stringify({session_id:req.params.id})]);res.json({success:true,message:'Session revoked'});}catch(error){next(error);}});
router.delete('/apps/:clientId/consent', async(req,res,next)=>{try{const [result]=await pool.query('UPDATE sso_consents SET revoked_at=NOW() WHERE client_id=? AND user_id=? AND revoked_at IS NULL',[req.params.clientId,req.accountUser.userId]);await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE client_id=? AND user_id=? AND revoked_at IS NULL',[req.params.clientId,req.accountUser.userId]);if(!result.affectedRows)return res.status(404).json({success:false,message:'Application consent not found'});await pool.query('INSERT INTO sso_security_events (user_id,client_id,event_type,metadata) VALUES (?,?,?,?)',[req.accountUser.userId,req.params.clientId,'sso.application_access_revoked',JSON.stringify({source:'account_center'})]);res.json({success:true,message:'Application access revoked'});}catch(error){next(error);}});
router.get('/security/events', async(req,res,next)=>{try{const limit=Math.min(Math.max(Number(req.query.limit)||50,1),100);const [rows]=await pool.query('SELECT id, client_id, event_type, ip_address, user_agent, metadata, created_at FROM sso_security_events WHERE user_id=? ORDER BY created_at DESC LIMIT ?',[req.accountUser.userId,limit]);res.json({success:true,events:rows});}catch(error){next(error);}});
module.exports=router;
