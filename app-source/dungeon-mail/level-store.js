import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { canonicalMap } from '../../courtyard/parkour-map.js';
import { cleanText } from './world-store.js';

// Bump when physics or map semantics change: old completion proofs then expire.
export const MAP_RULESET='parkour-1';
export const mapProof=cells=>MAP_RULESET+':'+createHash('sha256').update(canonicalMap(cells)).digest('hex');
export const isVerified=record=>record.proof===mapProof(record.cells);
const meta=record=>({id:record.id,title:record.title,version:record.version,updatedAt:record.updatedAt,verified:isVerified(record)});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);

export class LevelStore {
  constructor(directory){this.directory=join(directory,'levels');this.queues=new Map();}
  path(owner){if(!uuid(owner))throw new Error('请先登录。');return join(this.directory,owner+'.json');}
  async read(owner){
    try{
      const data=JSON.parse(await readFile(this.path(owner),'utf8'));
      if(data.version!==1||!Array.isArray(data.maps)||data.maps.length>24)throw Error('Invalid level save');
      const ids=new Set();for(const m of data.maps){if(!uuid(m.id)||ids.has(m.id)||m.cells!==canonicalMap(m.cells)||!cleanText(m.title,24)||!Number.isSafeInteger(m.version)||m.version<1||!Number.isFinite(m.updatedAt))throw Error('Invalid saved map');ids.add(m.id);}
      return data;
    }catch(error){if(error.code==='ENOENT')return {version:1,maps:[]};throw error;}
  }
  async list(owner){await this.queues.get(owner);return (await this.read(owner)).maps.map(meta).sort((a,b)=>b.updatedAt-a.updatedAt);}
  async get(owner,id){await this.queues.get(owner);const record=(await this.read(owner)).maps.find(m=>m.id===id);if(!record)throw Error('关卡不存在或不属于当前账号。');return {...record,verified:isVerified(record)};}
  transact(owner,edit){
    const task=(this.queues.get(owner)||Promise.resolve()).then(async()=>{
      const path=this.path(owner),data=await this.read(owner),result=edit(data);
      await mkdir(this.directory,{recursive:true,mode:0o700});await writeFile(path+'.tmp',JSON.stringify(data),{mode:0o600});await rename(path+'.tmp',path);return result;
    });this.queues.set(owner,task.catch(()=>{}));return task;
  }
  save(owner,input,verified=false){
    const cells=canonicalMap(input?.cells),title=cleanText(input?.title,24);
    if(!title)throw Error('请给关卡起个名字。');
    return this.transact(owner,data=>{
      let record=data.maps.find(m=>m.id===input.id);
      if(input.id){if(!record)throw Error('关卡不存在或不属于当前账号。');if(record.version!==input.version)throw Error('云端已有新版本，请载入新版或保存为副本。');}
      else{if(data.maps.length>=24)throw Error('最多保存 24 张关卡，请先整理关卡库。');record={id:randomUUID(),version:0};data.maps.push(record);}
      const proof=verified?mapProof(cells):record.cells===cells&&isVerified(record)?record.proof:null;
      Object.assign(record,{title,cells,proof,version:record.version+1,updatedAt:Date.now()});return {...record,verified:isVerified(record)};
    });
  }
  remove(owner,id,version){return this.transact(owner,data=>{
    const record=data.maps.find(m=>m.id===id);if(!record)throw Error('关卡不存在或不属于当前账号。');if(record.version!==version)throw Error('云端已有新版本，请刷新关卡库。');data.maps=data.maps.filter(m=>m.id!==id);return id;
  });}
  async flush(){await Promise.all(this.queues.values());}
}
