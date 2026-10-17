import express from 'express';
import { cookieToken,publicUser,sessionCookie } from './accounts.js';
import {adminApi} from './admin-api.js';

export function accountApi(accounts,worldStore,notify){
  const router=express.Router(),rates=new Map();
  const localPort=Number(process.env.PORT||2567);
  const authOrigins=new Set((process.env.AUTH_ORIGINS||(process.env.NODE_ENV==='production'?'https://82.157.83.81':`https://82.157.83.81,http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:${localPort},http://localhost:${localPort}`)).split(','));
  router.use(express.json({limit:'4kb',strict:true}));
  router.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='GET'&&!authOrigins.has(req.headers.origin))return res.status(403).json({error:'请从游戏页面操作。'});
    if(req.method!=='GET'){
      const now=Date.now(),ip=req.headers['cf-connecting-ip']||req.socket.remoteAddress;
      for(const [key,value] of rates)if(now-value.at>600000)rates.delete(key);
      const keys=[['ip:'+ip,80]];
      if(['/login','/recover'].includes(req.path))keys.push(['account:'+String(req.body?.username||'').toLowerCase().slice(0,24),12]);
      if(req.path==='/register')keys.push(['register:'+ip,60]);
      for(const [key,max] of keys){if(!rates.has(key)&&rates.size>=10000)return res.status(429).json({error:'登录繁忙，请稍后重试。'});const value=rates.get(key)||{at:now,count:0};rates.set(key,value);if(++value.count>max)return res.status(429).json({error:'尝试次数较多，请十分钟后重试。'});}
      if(rates.size>10000)return res.status(429).json({error:'登录繁忙，请稍后重试。'});
    }
    req.account=accounts.session(cookieToken(req.headers.cookie));next();
  });
  const result=(res,data)=>{res.setHeader('Set-Cookie',sessionCookie(data.token));res.json({user:data.user,...(data.recoveryCode?{recoveryCode:data.recoveryCode}:{})});};
  router.get('/me',(req,res)=>res.json({user:accounts.user(req.account?.user)}));
  for(const method of ['register','login','recover'])router.post('/'+method,async(req,res,next)=>{try{result(res,await accounts[method](req.body));}catch(error){next(error);}});
  router.post('/logout',async(req,res,next)=>{try{if(req.account)await accounts.logout(req.account.hash);res.setHeader('Set-Cookie',sessionCookie(null));res.json({ok:true});}catch(error){next(error);}});
  router.use((req,res,next)=>req.account?next():res.status(401).json({error:'请先登录。'}));
  router.use('/admin',adminApi(accounts,worldStore,notify));
  router.post('/profile',async(req,res,next)=>{try{res.json({user:await accounts.profile(req.account.user.id,req.body?.nickname)});}catch(error){next(error);}});
  router.post('/password',async(req,res,next)=>{try{result(res,await accounts.changePassword(req.account.user.id,req.body?.oldPassword,req.body?.password));}catch(error){next(error);}});
  router.use((error,req,res,next)=>{if(res.headersSent)return next(error);const internal=!!error.code||!!error.type;res.status([400,401,403,404,409,413].includes(error.status)?error.status:400).json({error:internal?'操作暂时失败，请稍后重试。':error.message});});
  return router;
}
