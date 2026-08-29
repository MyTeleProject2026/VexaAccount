const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';

router.use((req,res,next)=>{try{const h=req.get('authorization')||'';if(!h.startsWith('Bearer '))return res.status(401).json({success:false,message:'Authentication required'});const c=jwt.verify(h.slice(7),JWT_SECRET);const userId=c.sub||c.id;if(!userId)return res.status(401).json({success:false,message:'Invalid identity'});req.userId=userId;next();}catch{return res.status(401).json({success:false,message:'Invalid or expired session'});}});

router.get('/consents',async(req,res,next)=>{try{const[r]=await pool.query('SELECT c.client_id,c.name,sc.scopes,sc.granted_at,sc.revoked_at FROM sso_consents sc JOIN sso_clients c ON c.client_id=sc.client_id WHERE sc.user_id=? ORDER BY sc.granted_at DESC',[req.userId]);res.json({success:true,consents:r});}catch(e){next(e);}});

router.delete('/consents/:clientId',async(req,res,next)=>{try{const conn=await pool.getConnection();await conn.beginTransaction();await conn.query('UPDATE sso_consents SET revoked_at=NOW() WHERE user_id=? AND client_id=? AND revoked_at IS NULL',[req.userId,req.params.clientId]);await conn.query('UPDATE sso_refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND client_id=? AND revoked_at IS NULL',[req.userId,req.params.clientId]);await conn.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE user_id=? AND client_id=? AND revoked_at IS NULL',[req.userId,req.params.clientId]);await conn.query('INSERT INTO sso_security_events (user_id,client_id,event_type,ip_address,user_agent,metadata) VALUES (?,?,?,?,?,?)',[req.userId,req.params.clientId,'consent_revoked',req.ip||null,String(req.get('user-agent')||'').slice(0,512),'{}']);await conn.commit();conn.release();res.json({success:true,message:'Application access revoked'});}catch(e){next(e);}});

router.get('/sessions',async(req,res,next)=>{try{const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500);const[r]=await pool.query('SELECT s.id,s.client_id,c.name,s.scope,s.created_at,s.last_seen_at,s.expires_at FROM sso_sessions s JOIN sso_clients c ON c.client_id=s.client_id WHERE s.user_id=? AND s.revoked_at IS NULL AND s.expires_at>NOW() ORDER BY s.last_seen_at DESC LIMIT ?',[req.userId,limit]);res.json({success:true,sessions:r});}catch(e){next(e);}});

router.delete('/sessions/:id',async(req,res,next)=>{try{const[r]=await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE id=? AND user_id=? AND revoked_at IS NULL',[req.params.id,req.userId]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Active session not found'});res.json({success:true,message:'SSO session revoked'});}catch(e){next(e);}});

module.exports=router;