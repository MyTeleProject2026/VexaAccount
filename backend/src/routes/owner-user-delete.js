const express = require('express');
const { pool } = require('../config/database');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');

const router = express.Router();
router.use(requireSuperAdmin);

router.delete('/:id', auditAdminAction('owner.user.delete','vexa_user'), async (req,res,next)=>{
  const conn=await pool.getConnection();
  try{
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({success:false,message:'Invalid user id'});
    const confirmation=String(req.body?.confirmation||'').trim().toLowerCase();
    const [users]=await conn.query('SELECT id,email FROM store_users WHERE id=? LIMIT 1',[id]);
    if(!users.length)return res.status(404).json({success:false,message:'User not found'});
    if(!confirmation||confirmation!==String(users[0].email||'').toLowerCase())return res.status(400).json({success:false,message:'Type the user email exactly to confirm permanent deletion'});
    await conn.beginTransaction();
    await conn.query('DELETE FROM sso_consents WHERE user_id=?',[id]);
    await conn.query('DELETE FROM sso_security_events WHERE user_id=?',[id]);
    await conn.query('DELETE FROM sso_sessions WHERE user_id=?',[id]);
    await conn.query('DELETE FROM sso_refresh_tokens WHERE user_id=?',[id]);
    await conn.query('DELETE FROM otp_codes WHERE user_id=?',[id]);
    await conn.query('DELETE FROM vexa_user_credit_ledger WHERE user_id=?',[id]);
    await conn.query('DELETE FROM vexa_user_credit_balances WHERE user_id=?',[id]);
    await conn.query('DELETE FROM vexa_user_storage_records WHERE user_id=?',[id]);
    await conn.query('DELETE FROM vexa_user_admin_notes WHERE user_id=?',[id]);
    const [result]=await conn.query('DELETE FROM store_users WHERE id=?',[id]);
    if(!result.affectedRows){await conn.rollback();return res.status(404).json({success:false,message:'User not found'});}
    await conn.commit();
    res.json({success:true,message:'VexaAccount user permanently deleted',userId:id});
  }catch(e){try{await conn.rollback()}catch{};next(e)}finally{conn.release()}
});
module.exports=router;
