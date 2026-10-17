import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanText } from './world-store.js';

const scrypt=promisify(scryptCallback),DAY=86400000;
export const SESSION_AGE=30*DAY;
export const COOKIE_NAME=process.env.COOKIE_SECURE==='0'?'courtyard_session':'__Host-courtyard_session';
const digest=value=>createHash('sha256').update(value).digest('hex');
const username=value=>typeof value==='string'?value.trim().toLowerCase():'';
const recoveryHash=value=>digest(typeof value==='string'?value.replace(/[-\s]/g,'').toUpperCase():'');
const recoveryCode=()=>randomBytes(20).toString('hex').toUpperCase().match(/.{1,8}/g).join('-');
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
let hashing=0;
async function derive(password,salt){
  if(hashing>=2)throw new Error('登录繁忙，请稍后重试。');
  hashing++;
  try{return (await scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024})).toString('hex');}
  finally{hashing--;}
}
function checkPassword(value){if(typeof value!=='string'||value.length<12||value.length>128)throw new Error('密码请使用 12～128 个字符。');}
export const publicUser=(user,admin=false)=>user?{id:user.id,username:user.username,nickname:user.nickname,admin}:null;
export function cookieToken(header){
  const part=(header||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='));
  const token=part?.slice(COOKIE_NAME.length+1);return /^[a-zA-Z0-9_-]{43}$/.test(token||'')?token:null;
}
export function sessionCookie(token){return `${COOKIE_NAME}=${token||''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?SESSION_AGE/1000:0}${process.env.COOKIE_SECURE==='0'?'':'; Secure'}`;}

// Small self-hosted account store. Only hashes are persisted; every mutation is
// serialized and atomically replaced, in the external, backed-up data directory.
export class AccountStore {
  constructor(directory){this.directory=directory;this.path=join(directory,'accounts.json');this.data={version:1,users:[],sessions:[]};this.adminIds=new Set();this.queue=Promise.resolve();}
  async load(){
    await mkdir(this.directory,{recursive:true,mode:0o700});
    try{this.data=JSON.parse(await readFile(this.path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    const d=this.data;
    if(d.version!==1||!Array.isArray(d.users)||!Array.isArray(d.sessions)||d.users.length>1000||d.sessions.length>5000)throw new Error('Invalid account save');
    const ids=new Set(),names=new Set();
    for(const u of d.users){if(!/^[a-f0-9-]{36}$/.test(u.id)||ids.has(u.id)||names.has(u.username)||!/^[a-z0-9_]{3,24}$/.test(u.username)||!cleanText(u.nickname,12)||!/^[a-f0-9]{32}$/.test(u.salt)||!/^[a-f0-9]{128}$/.test(u.passwordHash)||!/^[a-f0-9]{64}$/.test(u.recoveryHash)||u.banned!==undefined&&typeof u.banned!=='boolean'||u.mustRecover!==undefined&&typeof u.mustRecover!=='boolean')throw new Error('Invalid account');ids.add(u.id);names.add(u.username);}
    for(const s of d.sessions)if(!ids.has(s.userId)||!/^[a-f0-9]{64}$/.test(s.hash)||!Number.isFinite(s.expires))throw new Error('Invalid session');
    if(d.adminLog!==undefined&&(!Array.isArray(d.adminLog)||d.adminLog.length>200))throw Error('Invalid administration log');
    try{const config=JSON.parse(await readFile(join(this.directory,'admins.json'),'utf8'));if(config.version!==1||!Array.isArray(config.ids)||config.ids.length>10||config.ids.some(id=>!ids.has(id)))throw Error('Invalid administrator configuration');this.adminIds=new Set(config.ids);}catch(error){if(error.code!=='ENOENT')throw error;}
    return this;
  }
  transact(edit){
    const task=this.queue.then(async()=>{
      const data=structuredClone(this.data),result=edit(data);
      data.sessions=data.sessions.filter(s=>s.expires>Date.now());
      await writeFile(this.path+'.tmp',JSON.stringify(data),{mode:0o600});
      try{await copyFile(this.path,this.path+'.bak');}catch(error){if(error.code!=='ENOENT')throw error;}
      await rename(this.path+'.tmp',this.path);this.data=data;return result;
    });this.queue=task.catch(()=>{});return task;
  }
  find(name){return this.data.users.find(u=>u.username===username(name));}
  session(token){
    if(!token||token.length!==43)return null;
    const hash=digest(token),s=this.data.sessions.find(s=>s.hash===hash&&s.expires>Date.now());
    const user=s&&this.data.users.find(u=>u.id===s.userId);return user&&!user.banned&&!user.mustRecover?{user,hash,expires:s.expires}:null;
  }
  valid(hash){const s=this.data.sessions.find(s=>s.hash===hash&&s.expires>Date.now());return !!s&&this.data.users.some(u=>u.id===s.userId&&!u.banned&&!u.mustRecover);}
  isAdmin(id){return this.adminIds.has(id);}
  user(user){return publicUser(user,this.isAdmin(user?.id));}
  requireAdmin(hash,data=this.data){const session=data.sessions.find(s=>s.hash===hash&&s.expires>Date.now()),actor=session&&data.users.find(u=>u.id===session.userId);if(!actor||actor.banned||actor.mustRecover||!this.isAdmin(actor.id)){const e=Error('需要管理员权限。');e.status=403;throw e;}return actor;}
  adminUsers(hash,search=''){
    this.requireAdmin(hash);search=String(search).slice(0,40).toLowerCase();
    return this.data.users.filter(u=>(u.username+' '+u.nickname).toLowerCase().includes(search)).map(u=>({...this.user(u),banned:!!u.banned,mustRecover:!!u.mustRecover,banReason:u.banReason||'',createdAt:u.createdAt||null,lastLoginAt:u.lastLoginAt||null,sessions:this.data.sessions.filter(s=>s.userId===u.id&&s.expires>Date.now()).length}));
  }
  audit(data,actor,target,action,note=''){data.adminLog=[...(data.adminLog||[]),{id:randomUUID(),at:Date.now(),actorId:actor.id,targetId:target,action,note:cleanText(note,80)}].slice(-200);}
  adminAction(hash,id,action,input={}){return this.transact(data=>{
    const actor=this.requireAdmin(hash,data),target=data.users.find(u=>u.id===id);if(!target)throw Error('账号不存在。');
    if(!['ban','unban','logout','recovery','rename'].includes(action))throw Error('操作不支持。');
    if(this.isAdmin(id)&&action!=='rename')throw Error('管理员账号受保护，请从“我的账号”修改自己的登录信息。');
    let code;
    if(action==='ban'){target.banned=true;target.banReason=cleanText(input.note,80);data.sessions=data.sessions.filter(s=>s.userId!==id);}
    if(action==='unban'){target.banned=false;target.banReason='';}
    if(action==='logout')data.sessions=data.sessions.filter(s=>s.userId!==id);
    if(action==='recovery'){code=recoveryCode();target.recoveryHash=recoveryHash(code);target.mustRecover=true;data.sessions=data.sessions.filter(s=>s.userId!==id);}
    if(action==='rename'){const name=cleanText(input.nickname,12);if(!name)throw Error('请输入昵称。');target.nickname=name;}
    this.audit(data,actor,id,action,input.note);return {ok:true,...(code?{recoveryCode:code}:{})};
  });}
  adminAudit(hash){this.requireAdmin(hash);return (this.data.adminLog||[]).slice(-50).reverse().map(log=>({...log,actor:this.data.users.find(u=>u.id===log.actorId)?.username||'管理员',target:this.data.users.find(u=>u.id===log.targetId)?.username||log.targetId}));}
  recordAdmin(hash,id,action,note=''){return this.transact(data=>{const actor=this.requireAdmin(hash,data);this.audit(data,actor,id,action,note);});}
  recordAdminActor(actorId,id,action,note=''){return this.transact(data=>{const actor=data.users.find(u=>u.id===actorId);if(!actor||!this.isAdmin(actorId))throw Error('需要管理员权限。');this.audit(data,actor,id,action,note);});}
  issue(data,userId){
    const token=randomBytes(32).toString('base64url');
    const own=data.sessions.filter(s=>s.userId===userId&&s.expires>Date.now()).slice(-4);
    data.sessions=data.sessions.filter(s=>s.userId!==userId&&s.expires>Date.now());
    data.sessions.push(...own,{hash:digest(token),userId,expires:Date.now()+SESSION_AGE});return token;
  }
  async register(input){
    const name=username(input?.username),nickname=cleanText(input?.nickname,12)||name;
    if(!/^[a-z0-9_]{3,24}$/.test(name))throw new Error('账号请用 3～24 位字母、数字或下划线。');
    checkPassword(input?.password);
    if(this.find(name))throw new Error('这个账号已被使用。');
    const salt=randomBytes(16).toString('hex'),passwordHash=await derive(input.password,salt),code=recoveryCode();
    return this.transact(data=>{
      if(data.users.some(u=>u.username===name))throw new Error('这个账号已被使用。');
      if(data.users.length>=1000)throw new Error('账号名额已满，请联系站长。');
      const user={id:randomUUID(),username:name,nickname,salt,passwordHash,recoveryHash:recoveryHash(code),createdAt:Date.now(),lastLoginAt:Date.now()};
      data.users.push(user);return {user:this.user(user),token:this.issue(data,user.id),recoveryCode:code};
    });
  }
  async verifyPassword(user,password){
    if(typeof password!=='string'||password.length>128)return false;
    const hash=await derive(password,user?.salt||'00000000000000000000000000000000');
    return !!user&&safeEqual(hash,user.passwordHash);
  }
  async login(input){
    const user=this.find(input?.username);
    if(!await this.verifyPassword(user,input?.password))throw new Error('账号或密码不正确。');
    return this.transact(data=>{const current=data.users.find(u=>u.id===user.id);if(current.passwordHash!==user.passwordHash)throw new Error('密码已更改，请重新登录。');if(current.banned)throw Error('账号已停用，请联系管理员。');if(current.mustRecover)throw Error('请使用管理员提供的找回码重设密码。');current.lastLoginAt=Date.now();return {user:this.user(current),token:this.issue(data,user.id)};});
  }
  async logout(hash){return this.transact(data=>{data.sessions=data.sessions.filter(s=>s.hash!==hash);});}
  async profile(id,nickname){
    const name=cleanText(nickname,12);if(!name)throw new Error('请输入昵称。');
    return this.transact(data=>{const user=data.users.find(u=>u.id===id);if(!user||user.banned||user.mustRecover)throw new Error('请重新登录。');user.nickname=name;return this.user(user);});
  }
  async changePassword(id,oldPassword,password){
    checkPassword(password);const user=this.data.users.find(u=>u.id===id);
    if(!await this.verifyPassword(user,oldPassword))throw new Error('原密码不正确。');
    return this.replacePassword(user,password);
  }
  async recover(input){
    checkPassword(input?.password);const user=this.find(input?.username);
    if(!user||!safeEqual(user.recoveryHash,recoveryHash(input?.recoveryCode)))throw new Error('账号或找回码不正确。');
    if(user.banned)throw Error('账号已停用，请联系管理员。');
    return this.replacePassword(user,input.password);
  }
  async replacePassword(previous,password){
    const salt=randomBytes(16).toString('hex'),passwordHash=await derive(password,salt),code=recoveryCode();
    return this.transact(data=>{
      const user=data.users.find(u=>u.id===previous.id);
      if(user.banned)throw Error('账号已停用，请联系管理员。');
      if(user.passwordHash!==previous.passwordHash||user.recoveryHash!==previous.recoveryHash)throw new Error('账号已更新，请重试。');
      Object.assign(user,{salt,passwordHash,recoveryHash:recoveryHash(code),mustRecover:false,lastLoginAt:Date.now()});data.sessions=data.sessions.filter(s=>s.userId!==user.id);
      return {user:this.user(user),token:this.issue(data,user.id),recoveryCode:code};
    });
  }
  async flush(){await this.queue;}
}
