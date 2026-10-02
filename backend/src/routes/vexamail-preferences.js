const express=require('express');
const {pool}=require('../config/database');
const {authUser}=require('../middleware/auth');
const router=express.Router();
router.use(authUser);

const uid=req=>req.user.id||req.user.sub;
const boolValue=(value,fallback)=>value===undefined?fallback:Boolean(value);

async function ensurePreferences(userId){
  await pool.query(
    'INSERT INTO vexamail_preferences (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',
    [userId]
  );
}

router.get('/settings',async(req,res,next)=>{
  try{
    const userId=uid(req);
    await ensurePreferences(userId);
    const [rows]=await pool.query(
      'SELECT conversation_view,desktop_notifications,compact_message_list,confirm_destructive_actions,updated_at FROM vexamail_preferences WHERE user_id=? LIMIT 1',
      [userId]
    );
    const p=rows[0];
    res.json({success:true,settings:{
      conversationView:Boolean(p.conversation_view),
      desktopNotifications:Boolean(p.desktop_notifications),
      compactMessageList:Boolean(p.compact_message_list),
      confirmDestructiveActions:Boolean(p.confirm_destructive_actions),
      updatedAt:p.updated_at
    }});
  }catch(e){next(e)}
});

router.patch('/settings',async(req,res,next)=>{
  try{
    const userId=uid(req);
    await ensurePreferences(userId);
    const [currentRows]=await pool.query(
      'SELECT conversation_view,desktop_notifications,compact_message_list,confirm_destructive_actions FROM vexamail_preferences WHERE user_id=? LIMIT 1',
      [userId]
    );
    const current=currentRows[0]||{};
    const values={
      conversation_view:boolValue(req.body?.conversationView,current.conversation_view!==0),
      desktop_notifications:boolValue(req.body?.desktopNotifications,current.desktop_notifications!==0),
      compact_message_list:boolValue(req.body?.compactMessageList,current.compact_message_list!==0),
      confirm_destructive_actions:boolValue(req.body?.confirmDestructiveActions,current.confirm_destructive_actions!==0)
    };
    await pool.query(
      'UPDATE vexamail_preferences SET conversation_view=?,desktop_notifications=?,compact_message_list=?,confirm_destructive_actions=? WHERE user_id=?',
      [values.conversation_view?1:0,values.desktop_notifications?1:0,values.compact_message_list?1:0,values.confirm_destructive_actions?1:0,userId]
    );
    res.json({success:true,settings:{
      conversationView:values.conversation_view,
      desktopNotifications:values.desktop_notifications,
      compactMessageList:values.compact_message_list,
      confirmDestructiveActions:values.confirm_destructive_actions
    }});
  }catch(e){next(e)}
});

module.exports=router;
