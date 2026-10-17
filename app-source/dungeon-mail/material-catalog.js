import {createHash} from 'node:crypto';
import {decodePixels} from '../../courtyard/materials.js';
const cache=new WeakMap();
export function materialInfo(material){
  if(cache.has(material))return cache.get(material);
  const {pixels,...info}=material;info.rev=createHash('sha256').update(pixels).digest('hex').slice(0,20);
  if(!material.mural&&!material.retired){const decoded=decodePixels(pixels),size=Math.sqrt(decoded.length);info.thumbnail=Array.from({length:16},(_,i)=>decoded[Math.min(size-1,Math.floor((Math.floor(i/4)+.5)*size/4))*size+Math.min(size-1,Math.floor((i%4+.5)*size/4))]).join('');}
  cache.set(material,info);return info;
}
