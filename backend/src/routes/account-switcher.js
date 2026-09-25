const express=require('express');
const {pool}=require('../config/database');
const {authUser}=require('../middleware/auth');
const router=express.Router();
router.use(authUser);
router.use((req,res,next)=>{req.userId=Number(req.user.id||req.user.sub);next();});

router.get('/switcher/accounts',async(req,res,next)=>{
  try{
    const id=req.userId;
    const [self]=await pool.query('SELECT id,email,name,avatar_url,is_verified FROM store_users WHERE id=? AND is_active=1',[id]);
    if(!self.length)return res.status(404).json({success:false,message:'Account not found'});
    const [rows]=await pool.query(`SELECT a.id,a.account_user_id,a.label,a.last_used_at,u.email,u.name,u.avatar_url,u.is_verified
      FROM vexa_account_switcher_accounts a JOIN store_users u ON u.id=a.account_user_id
      WHERE a.owner_user_id=? AND u.is_active=1 ORDER BY COALESCE(a.last_used_at,a.created_at) DESC,a.id DESC`,[id]);
    res.json({success:true,current:self[0],accounts:rows});
  }catch(e){next(e)}
});

router.post('/switcher/accounts',async(req,res,next)=>{
  try{
    const email=String(req.body?.email||'').trim().toLowerCase();
    const label=String(req.body?.label||'').trim().slice(0,160)||null;
    if(!email)return res.status(400).json({success:false,message:'Account email is required'});
    const [target]=await pool.query('SELECT id,email,name,avatar_url,is_verified FROM store_users WHERE email=? AND is_active=1',[email]);
    if(!target.length)return res.status(404).json({success:false,message:'That VexaAccount could not be found.'});
    const accountId=Number(target[0].id),ownerId=req.userId;
    await pool.query('INSERT INTO vexa_account_switcher_accounts(owner_user_id,account_user_id,label) VALUES(?,?,?) ON DUPLICATE KEY UPDATE label=COALESCE(VALUES(label),label),updated_at=CURRENT_TIMESTAMP',[ownerId,accountId,label]);
    await pool.query('INSERT INTO vexa_account_switcher_accounts(owner_user_id,account_user_id,label) VALUES(?,?,?) ON DUPLICATE KEY UPDATE label=COALESCE(VALUES(label),label),updated_at=CURRENT_TIMESTAMP',[accountId,ownerId,null]);
    res.status(201).json({success:true,account:target[0],message:'Account added to the switcher. Sign in to that account to switch.'});
  }catch(e){next(e)}
});

router.delete('/switcher/accounts/:accountId',async(req,res,next)=>{
  try{
    const accountId=Number(req.params.accountId);
    if(!Number.isInteger(accountId)||accountId<=0)return res.status(400).json({success:false,message:'Invalid account'});
    await pool.query('DELETE FROM vexa_account_switcher_accounts WHERE owner_user_id=? AND account_user_id=?',[req.userId,accountId]);
    res.json({success:true,message:'Account removed from this switcher.'});
  }catch(e){next(e)}
});

router.patch('/switcher/accounts/:accountId/used',async(req,res,next)=>{
  try{
    const accountId=Number(req.params.accountId);
    await pool.query('UPDATE vexa_account_switcher_accounts SET last_used_at=NOW() WHERE owner_user_id=? AND account_user_id=?',[req.userId,accountId]);
    res.json({success:true});
  }catch(e){next(e)}
});
module.exports=router;