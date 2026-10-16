import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BUILTIN_MATERIALS, validPixels } from '../../courtyard/materials.js';
import { isBuildCell, tileKey, MAX_TILES } from '../../courtyard/world.js';

export const cleanText = (value, length) => typeof value === 'string' ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,length).join('') : '';
export function validateWorld(data) {
  if (data?.version!==1 || !Array.isArray(data.materials) || !Array.isArray(data.tiles) || data.materials.length>128 || data.tiles.length>MAX_TILES) throw new Error('Invalid world save');
  const ids=new Set(BUILTIN_MATERIALS.map(m=>m.id));
  for(const m of data.materials){
    if(!/^[a-z0-9-]{8,40}$/.test(m.id)||ids.has(m.id)||!validPixels(m.pixels)||!cleanText(m.name,12)||m.name.length>24||typeof m.author!=='string'||m.author.length>24)throw new Error('Invalid material in save');
    ids.add(m.id);
  }
  const cells=new Set();
  for(const t of data.tiles){
    const key=tileKey(t.col,t.row);
    if(!isBuildCell(t.col,t.row)||cells.has(key)||!ids.has(t.material)||typeof t.solid!=='boolean')throw new Error('Invalid block in save');
    cells.add(key);
  }
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
  createMaterial(name,pixels,author){
    if(!cleanText(name,12)||!validPixels(pixels))return Promise.reject(new Error('请填写材料名，并至少画一个像素。'));
    return this.transact(data=>{
      if(data.materials.length>=128)throw new Error('公共材料库已满（128 件），请先使用已有材料。');
      const material={id:randomUUID(),name:cleanText(name,12),pixels,author:cleanText(author,12)};
      data.materials.push(material);return material;
    });
  }
  setTile(tile){return this.transact(data=>{
    data.tiles=data.tiles.filter(t=>tileKey(t.col,t.row)!==tileKey(tile.col,tile.row));
    if(tile.material)data.tiles.push(tile);return tile;
  });}
  async flush(){await this.queue;}
}
