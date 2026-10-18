import {RIG_VIEWS,RIG_PARTS,rigTemplate} from './avatar-rig.js?v=0.15.1';
import {rigPose,drawRig} from './avatar-motion.js?v=0.15.1';
const cache=new Map();
export function pixelCanvas(text,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),image=ctx.createImageData(w,h);for(let i=0;i<w*h;i++)for(let k=0;k<4;k++)image.data[i*4+k]=parseInt(text.slice(i*8+k*2,i*8+k*2+2),16);ctx.putImageData(image,0,0);return c;}
export function decodeRig(rig){return Object.fromEntries(RIG_VIEWS.map(view=>[view,Object.fromEntries(RIG_PARTS.map(p=>[p.id,pixelCanvas(rig.views[view][p.id],p.w,p.h)]))]));}
export function rigImage(data,color,direction='down',phase=0,amount=0){
  const key=data?.rig?'user:'+data.userId+':'+data.revision:'default:'+color;
  let entry=cache.get(key);if(!entry){entry={parts:decodeRig(data?.rig||rigTemplate(color)),poses:new Map()};cache.set(key,entry);if(cache.size>96)cache.delete(cache.keys().next().value);}
  const n=32,index=(Math.round(phase/(Math.PI*2)*n)%n+n)%n,strength=Math.round(Math.max(0,Math.min(1,amount))*8),poseKey=direction+':'+(strength?index:0)+':'+strength;
  let image=entry.poses.get(poseKey);if(!image){image=document.createElement('canvas');image.width=40;image.height=56;const ctx=image.getContext('2d');ctx.translate(4,4);drawRig(ctx,entry.parts[direction==='up'?'up':direction==='down'?'down':'right'],rigPose(direction,index/n*Math.PI*2,strength/8));entry.poses.set(poseKey,image);if(entry.poses.size>160)entry.poses.delete(entry.poses.keys().next().value);}
  return image;
}
