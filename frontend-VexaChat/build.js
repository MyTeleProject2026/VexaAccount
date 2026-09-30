const fs=require('fs');
const base=String(process.env.VEXA_CHAT_API_BASE||'https://api-vexaaccount.onrender.com').trim().replace(/\/$/,'');
fs.writeFileSync('config.js','window.VEXA_CHAT_API_BASE='+JSON.stringify(base)+';\n');
console.log('VexaChat API base:',base);
