import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { BUILTIN_MATERIALS, validPixels } from '../../courtyard/materials.js';
import { isBuildCell, tileKey, MAX_TILES } from '../../courtyard/world.js';
import {splitMural} from '../../courtyard/mural-rules.js';
import {isLibraryMaterial,expiredMaterial} from '../../courtyard/material-lifecycle.js';
import {buildRectangle,inRectangle} from '../../courtyard/bulk-rules.js';
const regionHash=tiles=>createHash('sha256').update(JSON.stringify(tiles.slice().sort((a,b)=>a.row-b.row||a.col-b.col))).digest('hex');

export const cleanText = (value, length) => typeof value === 'string' ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,length).join('') : '';
const ownerId=value=>value===undefined||value===''||/^[a-f0-9-]{36}$/.test(value);
export function validateWorld(data) {
  if (data?.version!==1 || !Array.isArray(data.materials) || !Array.isArray(data.tiles) || data.materials.length>512 || data.tiles.length>MAX_TILES) throw new Error('Invalid world save');
  const ids=new Set(BUILTIN_MATERIALS.map(m=>m.id));
  for(const m of data.materials){
    if(!/^[a-z0-9-]{8,40}$/.test(m.id)||ids.has(m.id)||!validPixels(m.pixels)||!cleanText(m.name,12)||m.name.length>24||typeof m.author!=='string'||m.author.length>24)throw new Error('Invalid material in save');
    if(!ownerId(m.ownerId)||(m.deletedAt!==undefined&&(!Number.isFinite(m.deletedAt)||m.deletedAt<=0)))throw new Error('Invalid material ownership');
    if(['mural','retired'].some(flag=>m[flag]!==undefined&&typeof m[flag]!=='boolean'))throw Error('Invalid texture flags');
    ids.add(m.id);
  }
  const cells=new Set();
  for(const t of data.tiles){
    const key=tileKey(t.col,t.row);
    if(!isBuildCell(t.col,t.row)||cells.has(key)||!ids.has(t.material)||typeof t.solid!=='boolean')throw new Error('Invalid block in save');
    if(!ownerId(t.ownerId))throw new Error('Invalid block ownership');cells.add(key);
  }
  if(data.protection!==undefined&&(typeof data.protection!=='object'||data.protection===null||Array.isArray(data.protection)||Object.entries(data.protection).some(([id,value])=>!id||!ownerId(id)||typeof value!=='boolean')))throw new Error('Invalid protection settings');
  return data;
}

export class WorldStore {
  constructor(directory){this.directory=directory;this.path=join(directory,'world.json');this.data={version:1,materials:[],tiles:[]};this.queue=Promise.resolve();}
  async load(){
    await mkdir(this.directory,{recursive:true,mode:0o750});
    try{this.data=validateWorld(JSON.parse(await readFile(this.path,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
    return this;
  }
  transact(edit){
    const task=this.queue.then(async()=>{
      const next=structuredClone(this.data),result=edit(next);validateWorld(next);
      const temporary=this.path+'.tmp';
      await writeFile(temporary,JSON.stringify(next),{mode:0o600});
      try{await copyFile(this.path,this.path+'.bak');}catch(error){if(error.code!=='ENOENT')throw error;}
      await rename(temporary,this.path);this.data=next;return result;
    });
    this.queue=task.catch(()=>{});return task;
  }
  createMaterial(name,pixels,author,owner=''){
    if(!cleanText(name,12)||!validPixels(pixels))return Promise.reject(new Error('请填写材料名，并至少画一个像素。'));
    return this.transact(data=>{
      if(data.materials.filter(m=>isLibraryMaterial(m)&&!m.deletedAt).length>=128||data.materials.length>=512)throw new Error('材料库已满，请先使用已有材料。');
      const material={id:randomUUID(),name:cleanText(name,12),pixels,author:cleanText(author,12),ownerId:owner};
      data.materials.push(material);return material;
    });
  }
  setTile(tile,actor,authorizeLegacy=null){return this.transact(data=>{
    if(actor!==undefined){
      if(!actor)throw new Error('请登录后施工。');
      const old=data.tiles.find(t=>tileKey(t.col,t.row)===tileKey(tile.col,tile.row));
      if(old&&!old.ownerId){if(typeof authorizeLegacy!=='function'||authorizeLegacy()!==true)throw new Error('旧建筑仅管理员可拆除或覆盖。');}
      else if(old&&old.ownerId!==actor&&data.protection?.[old.ownerId]!==true)throw new Error('这座建筑未开放他人拆除。');
      if(tile.material&&!BUILTIN_MATERIALS.some(m=>m.id===tile.material)&&!data.materials.some(m=>m.id===tile.material&&isLibraryMaterial(m)&&!m.deletedAt))throw new Error('材料已删除，请选择其他材料。');
      tile={...tile,ownerId:actor};
    }
    data.tiles=data.tiles.filter(t=>tileKey(t.col,t.row)!==tileKey(tile.col,tile.row));
    if(tile.material)data.tiles.push(tile);return tile;
  });}
  importMural(input,actor,author,authorize){return this.transact(data=>{
    authorize();if(!actor||!ownerId(actor)||!Number.isInteger(input.col)||!Number.isInteger(input.row))throw Error('请登录后放置。');
    const parts=splitMural(input),materials=[],tiles=[];
    for(const part of parts){
      const col=input.col+part.x,row=input.row+part.y;if(!isBuildCell(col,row))throw Error('区域超出地图边界。');
      const old=data.tiles.find(t=>t.col===col&&t.row===row);
      if(old&&(!old.ownerId?!authorize(true):old.ownerId!==actor&&data.protection?.[old.ownerId]!==true))throw Error('区域内有未开放拆除的建筑，请换个位置。');
      let material=[...data.materials,...materials].find(m=>m.mural&&!m.retired&&m.pixels===part.pixels);
      if(!material){material={id:randomUUID(),name:cleanText(input.name,8)||'像素画',pixels:part.pixels,author:cleanText(author,12),ownerId:actor,mural:true};materials.push(material);}
      tiles.push({col,row,material:material.id,solid:false,ownerId:actor});
    }
    if(data.materials.length+materials.length>512)throw Error('地图贴图容量不足，请先拆除不用的像素画或缩小图片。');
    const keys=new Set(tiles.map(t=>tileKey(t.col,t.row)));data.tiles=data.tiles.filter(t=>!keys.has(tileKey(t.col,t.row)));data.tiles.push(...tiles);data.materials.push(...materials);return {materials,tiles};
  });}
  protect(owner,allow,authorize=null){return this.transact(data=>{authorize?.();if(!owner||!ownerId(owner)||typeof allow!=='boolean')throw new Error('无效的建筑设置。');data.protection={...data.protection,[owner]:allow};return allow;});}
  deleteMaterial(id,owner,restore=false,authorizeAdmin=null){return this.transact(data=>{
    const material=data.materials.find(m=>m.id===id);
    const admin=typeof authorizeAdmin==='function'&&authorizeAdmin()===true;
    if(!material||!isLibraryMaterial(material))throw Error('作品不存在或已永久删除。');
    if(!admin&&(!owner||!material.ownerId||material.ownerId!==owner))throw new Error('只能管理自己保存的画布。');
    if(restore){if(!material.deletedAt)return material;if(expiredMaterial(material))throw new Error('已超过 12 小时恢复期限。');if(data.materials.filter(m=>isLibraryMaterial(m)&&!m.deletedAt).length>=128)throw new Error('材料库已满，请先删除其他画布。');delete material.deletedAt;}
    else if(!material.deletedAt)material.deletedAt=Date.now();
    return material;
  });}
  async pruneMaterials(now=Date.now()){
    const used=new Set(this.data.tiles.map(t=>t.material));
    if(!this.data.materials.some(m=>expiredMaterial(m,now)||((m.mural||m.retired)&&!used.has(m.id))))return {removed:[],retained:[]};
    return this.transact(data=>{
      const references=new Set(data.tiles.map(t=>t.material)),removed=[],retained=[];
      data.materials=data.materials.filter(m=>{
        if(expiredMaterial(m,now)){if(!references.has(m.id)){removed.push(m.id);return false;}m.retired=true;delete m.deletedAt;retained.push({...m});}
        if((m.mural||m.retired)&&!references.has(m.id)){removed.push(m.id);return false;}return true;
      });return {removed,retained};
    });
  }
  previewDemolition(value){const rect=buildRectangle(value),tiles=this.data.tiles.filter(t=>inRectangle(t,rect));return {rect,count:tiles.length,digest:regionHash(tiles)};}
  demolishRegion(rect,digest,authorize){return this.transact(data=>{
    authorize();rect=buildRectangle(rect);const removed=data.tiles.filter(t=>inRectangle(t,rect));
    if(regionHash(removed)!==digest)throw Object.assign(Error('选区建筑已变化，请重新预览。'),{status:409});
    data.tiles=data.tiles.filter(t=>!inRectangle(t,rect));return removed;
  });}
  async flush(){await this.queue;}
}
