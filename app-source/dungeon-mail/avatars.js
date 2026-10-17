import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AVATAR_LENGTH,AVATAR_FRAME_LENGTH,validAvatar } from '../../courtyard/avatar-data.js';
import {RIG_LENGTH,validRig,validAvatarRecord,unpackRig,packRig} from '../../courtyard/avatar-rig.js';

export class AvatarUpload {
  constructor(length,format='frames'){if(!['frames','parts-v1'].includes(format)||length!==(format==='parts-v1'?RIG_LENGTH:AVATAR_LENGTH))throw new Error('人物画布尺寸不正确。');this.format=format;this.expected=length;this.parts=[];this.length=0;this.expires=Date.now()+20000;}
  append(index,pixels){if(Date.now()>this.expires||index!==this.parts.length||typeof pixels!=='string'||!pixels.length||pixels.length>3072||!/^[a-f0-9]+$/i.test(pixels)||this.length+pixels.length>this.expected)throw new Error('人物上传中断，请重新保存。');this.parts.push(pixels);this.length+=pixels.length;}
  finish(){if(this.length!==this.expected||Date.now()>this.expires)throw new Error('人物尚未上传完整。');const text=this.parts.join('');if(this.format==='parts-v1')return unpackRig(text);const frames=Array.from({length:12},(_,i)=>text.slice(i*AVATAR_FRAME_LENGTH,(i+1)*AVATAR_FRAME_LENGTH));if(!validAvatar(frames))throw new Error('每一帧至少保留一个像素。');return frames;}
}
export class AvatarStore {
  constructor(directory){this.directory=join(directory,'avatars');this.cache=new Map();this.queues=new Map();}
  path(id){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('无效的账号。');return join(this.directory,id+'.json');}
  keep(id,data){this.cache.delete(id);this.cache.set(id,data);if(this.cache.size>128)this.cache.delete(this.cache.keys().next().value);return data;}
  async get(id){if(this.cache.has(id))return this.cache.get(id);try{const data=JSON.parse(await readFile(this.path(id),'utf8'));if(data.userId!==id||!validAvatarRecord(data)||typeof data.revision!=='string')throw new Error('Invalid avatar save');return this.keep(id,data);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
  save(id,avatar){
    if(!validAvatar(avatar)&&!validRig(avatar))return Promise.reject(new Error('人物画布不完整。'));
    const content=Array.isArray(avatar)?{frames:avatar.slice()}:{rig:unpackRig(packRig(avatar))};
    const task=(this.queues.get(id)||Promise.resolve()).then(async()=>{await mkdir(this.directory,{recursive:true,mode:0o700});const path=this.path(id),data={userId:id,revision:randomUUID(),...content};await writeFile(path+'.tmp',JSON.stringify(data),{mode:0o600});await rename(path+'.tmp',path);return this.keep(id,data);});
    this.queues.set(id,task.catch(()=>{}));return task;
  }
  async flush(){await Promise.all(this.queues.values());}
}
