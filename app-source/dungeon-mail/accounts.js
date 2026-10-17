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
export const publicUser=user=>user?{id:user.id,username:user.username,nickname:user.nickname}:null;
export function cookieToken(header){
  const part=(header||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='));
  const token=part?.slice(COOKIE_NAME.length+1);return /^[a-zA-Z0-9_-]{43}$/.test(token||'')?token:null;
}
export function sessionCookie(token){return `${COOKIE_NAME}=${token||''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?SESSION_AGE/1000:0}${process.env.COOKIE_SECURE==='0'?'':'; Secure'}`;}

// Small self-hosted account store. Only hashes are persisted; every mutation is
// serialized and atomically replaced, in the external, backed-up data directory.
export class AccountStore {
  constructor(directory){this.directory=directory;this.path=join(directory,'accounts.json');this.data={version:1,users:[],sessions:[]};this.queue=Promise.resolve();}
  async load(){
    await mkdir(this.directory,{recursive:true,mode:0o700});
    try{this.data=JSON.parse(await readFile(this.path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    const d=this.data;
    if(d.version!==1||!Array.isArray(d.users)||!Array.isArray(d.sessions)||d.users.length>1000||d.sessions.length>5000)throw new Error('Invalid account save');
    const ids=new Set(),names=new Set();
    for(const u of d.users){if(!/^[a-f0-9-]{36}$/.test(u.id)||ids.has(u.id)||names.has(u.username)||!/^[a-z0-9_]{3,24}$/.test(u.username)||!cleanText(u.nickname,12)||!/^[a-f0-9]{32}$/.test(u.salt)||!/^[a-f0-9]{128}$/.test(u.passwordHash)||!/^[a-f0-9]{64}$/.test(u.recoveryHash))throw new Error('Invalid account');ids.add(u.id);names.add(u.username);}
    for(const s of d.sessions)if(!ids.has(s.userId)||!/^[a-f0-9]{64}$/.test(s.hash)||!Number.isFinite(s.expires))throw new Error('Invalid session');
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
    const user=s&&this.data.users.find(u=>u.id===s.userId);return user?{user,hash,expires:s.expires}:null;
  }
  valid(hash){return this.data.sessions.some(s=>s.hash===hash&&s.expires>Date.now());}
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
      const user={id:randomUUID(),username:name,nickname,salt,passwordHash,recoveryHash:recoveryHash(code)};
      data.users.push(user);return {user:publicUser(user),token:this.issue(data,user.id),recoveryCode:code};
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
    return this.transact(data=>{const current=data.users.find(u=>u.id===user.id);if(current.passwordHash!==user.passwordHash)throw new Error('密码已更改，请重新登录。');return {user:publicUser(current),token:this.issue(data,user.id)};});
  }
  async logout(hash){return this.transact(data=>{data.sessions=data.sessions.filter(s=>s.hash!==hash);});}
  async profile(id,nickname){
    const name=cleanText(nickname,12);if(!name)throw new Error('请输入昵称。');
    return this.transact(data=>{const user=data.users.find(u=>u.id===id);if(!user)throw new Error('请重新登录。');user.nickname=name;return publicUser(user);});
  }
  async changePassword(id,oldPassword,password){
    checkPassword(password);const user=this.data.users.find(u=>u.id===id);
    if(!await this.verifyPassword(user,oldPassword))throw new Error('原密码不正确。');
    return this.replacePassword(user,password);
  }
  async recover(input){
    checkPassword(input?.password);const user=this.find(input?.username);
    if(!user||!safeEqual(user.recoveryHash,recoveryHash(input?.recoveryCode)))throw new Error('账号或找回码不正确。');
    return this.replacePassword(user,input.password);
  }
  async replacePassword(previous,password){
    const salt=randomBytes(16).toString('hex'),passwordHash=await derive(password,salt),code=recoveryCode();
    return this.transact(data=>{
      const user=data.users.find(u=>u.id===previous.id);
      if(user.passwordHash!==previous.passwordHash||user.recoveryHash!==previous.recoveryHash)throw new Error('账号已更新，请重试。');
      Object.assign(user,{salt,passwordHash,recoveryHash:recoveryHash(code)});data.sessions=data.sessions.filter(s=>s.userId!==user.id);
      return {user:publicUser(user),token:this.issue(data,user.id),recoveryCode:code};
    });
  }
  async flush(){await this.queue;}
}
