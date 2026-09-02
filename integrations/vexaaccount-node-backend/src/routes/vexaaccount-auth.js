const express = require('express');
const crypto = require('crypto');
const sso = require('../vexaaccount-sso');
const router = express.Router();

// This example expects an application session middleware (req.session) to be installed.
// Store state, PKCE verifier and the returned VexaAccount tokens server-side only.
function requireSession(req) { if (!req.session) throw new Error('Install express-session or your application session middleware before using these routes'); return req.session; }

router.get('/vexaaccount/login', (req,res,next)=>{ try { const session=requireSession(req), flow=sso.startState(); session.vexaSso={state:flow.state,verifier:flow.verifier,createdAt:Date.now()}; res.redirect(flow.url); } catch(e){next(e);} });

router.get('/vexaaccount/callback', async (req,res,next)=>{
  try {
    const session=requireSession(req), {code,state,error,error_description}=req.query;
    if(error) return res.status(401).send(`VexaAccount authorization failed: ${error_description || error}`);
    if(!code || !state) return res.status(400).send('Missing SSO code or state');
    const flow=session.vexaSso;
    delete session.vexaSso;
    if(!flow || !crypto.timingSafeEqual(Buffer.from(String(flow.state)),Buffer.from(String(state)))) return res.status(400).send('Invalid or expired SSO state');
    if(Date.now()-Number(flow.createdAt||0)>10*60*1000) return res.status(400).send('SSO state expired');
    const tokens=await sso.exchange({code:String(code),verifier:String(flow.verifier)});
    const profile=await sso.userinfo(tokens.access_token);
    if(!profile.sub) return res.status(502).send('VexaAccount did not return a stable subject');
    // IMPORTANT: map profile.sub to this application's own user table. Do not key identity by email alone.
    const localUser=await req.app.locals.findOrCreateUserFromVexaAccount(profile);
    session.userId=localUser.id;
    session.vexaAccount={sub:profile.sub,accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:Date.now()+Number(tokens.expires_in||3600)*1000};
    res.redirect('/');
  } catch(e){next(e);}
});

router.post('/vexaaccount/logout', async(req,res,next)=>{try{const refreshToken=req.session?.vexaAccount?.refreshToken;if(refreshToken)await sso.logout(refreshToken);if(req.session?.destroy)req.session.destroy(()=>res.json({success:true}));else res.json({success:true});}catch(e){next(e);}});

module.exports=router;
