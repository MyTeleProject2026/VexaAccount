const webpush=require('web-push');
const crypto=require('crypto');
const {pool}=require('../config/database');
const VAPID_PUBLIC_KEY=String(process.env.VAPID_PUBLIC_KEY||'').trim();
const VAPID_PRIVATE_KEY=String(process.env.VAPID_PRIVATE_KEY||'').trim();
const VAPID_SUBJECT=String(process.env.VAPID_SUBJECT||'mailto:admin@vexaaccount.com').trim();
let configured=false;
if(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY){try{webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);configured=true}catch(e){console.error('[WebPush] invalid VAPID configuration:',e.message)}}
function publicKey(){return VAPID_PUBLIC_KEY||null}
function available(){return configured}
function endpointHash(endpoint){return crypto.createHash('sha256').update(String(endpoint)).digest('hex')}
async function saveSubscription(subjectType,subjectId,subscription,meta={}){
 if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth)throw new Error('Invalid Web Push subscription');
 const endpoint=String(subscription.endpoint),hash=endpointHash(endpoint);
 await pool.query('INSERT INTO vexa_web_push_subscriptions(subject_type,subject_id,endpoint,endpoint_hash,p256dh,auth,user_agent,platform) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE subject_type=VALUES(subject_type),subject_id=VALUES(subject_id),endpoint=VALUES(endpoint),p256dh=VALUES(p256dh),auth=VALUES(auth),user_agent=VALUES(user_agent),platform=VALUES(platform),updated_at=CURRENT_TIMESTAMP',[subjectType,subjectId,endpoint,hash,String(subscription.keys.p256dh),String(subscription.keys.auth),String(meta.userAgent||'').slice(0,512)||null,String(meta.platform||'').slice(0,64)||null]);
 return {success:true};
}
async function removeSubscription(subjectType,subjectId,endpoint){const [r]=await pool.query('DELETE FROM vexa_web_push_subscriptions WHERE subject_type=? AND subject_id=? AND endpoint_hash=?',[subjectType,subjectId,endpointHash(endpoint)]);return r.affectedRows>0}
async function sendToSubject(subjectType,subjectId,payload){
 if(!configured)return {sent:0,skipped:true,reason:'VAPID not configured'};
 const [rows]=await pool.query('SELECT id,endpoint,p256dh,auth FROM vexa_web_push_subscriptions WHERE subject_type=? AND subject_id=?',[subjectType,subjectId]);
 let sent=0;
 for(const row of rows){try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload));sent++;await pool.query('UPDATE vexa_web_push_subscriptions SET last_used_at=CURRENT_TIMESTAMP WHERE id=?',[row.id])}catch(error){if(error?.statusCode===404||error?.statusCode===410)await pool.query('DELETE FROM vexa_web_push_subscriptions WHERE id=?',[row.id]);}}
 return {sent};
}
async function sendNotificationToUser(userId,notification){return sendToSubject('user',userId,{title:String(notification.title||'VexaAccount'),body:String(notification.message||''),tag:String(notification.tag||notification.type||'vexa-account'),data:{url:String(notification.url||'/#/'),notificationId:notification.id||null,type:notification.type||'info'}})}
async function sendNotificationToAdmin(adminId,notification){return sendToSubject('admin',adminId,{title:String(notification.title||'VexaAccount Owner'),body:String(notification.message||''),tag:String(notification.tag||notification.type||'vexa-owner'),data:{url:String(notification.url||'/'),notificationId:notification.id||null,type:notification.type||'info'}})}
module.exports={available,publicKey,saveSubscription,removeSubscription,sendNotificationToUser,sendNotificationToAdmin};
