const {pool}=require('../config/database');

const clients=new Map();

function emit(userId,event,data){
  const set=clients.get(Number(userId));
  if(!set)return;
  const payload='event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n';
  for(const res of [...set]){
    try{res.write(payload)}catch{set.delete(res)}
  }
}

function subscribe(userId,res){
  const id=Number(userId);
  if(!clients.has(id))clients.set(id,new Set());
  clients.get(id).add(res);
  return ()=>{
    const set=clients.get(id);
    set?.delete(res);
    if(set?.size===0)clients.delete(id);
  };
}

async function memberIds(conversationId){
  const [rows]=await pool.query('SELECT user_id FROM vexachat_participants WHERE conversation_id=?',[conversationId]);
  return rows.map(row=>Number(row.user_id));
}

async function broadcast(conversationId,event,data){
  for(const userId of await memberIds(conversationId))emit(userId,event,data);
}

module.exports={emit,subscribe,broadcast,memberIds};
