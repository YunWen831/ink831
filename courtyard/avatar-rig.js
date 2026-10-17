import {avatarTemplate,validAvatar} from './avatar-data.js?v=0.13.1';
export const RIG_VIEWS=['down','up','right'];
export const RIG_PARTS=[
  {id:'head',name:'头部',w:20,h:22,x:6,y:2},
  {id:'body',name:'身体',w:22,h:18,x:5,y:20},
  {id:'leftArm',name:'左臂',w:8,h:16,x:3,y:21},
  {id:'rightArm',name:'右臂',w:8,h:16,x:21,y:21},
  {id:'leftLeg',name:'左腿',w:10,h:14,x:7,y:33},
  {id:'rightLeg',name:'右腿',w:10,h:14,x:15,y:33}
];
export const RIG_LENGTH=RIG_VIEWS.length*RIG_PARTS.reduce((n,p)=>n+p.w*p.h*8,0);
const visible=text=>text.match(/.{8}/g).some(p=>p.slice(6)!=='00');
export function validRig(rig){
  return rig?.version===1&&RIG_VIEWS.every(view=>rig.views?.[view]&&RIG_PARTS.every(p=>{const text=rig.views[view][p.id];return typeof text==='string'&&text.length===p.w*p.h*8&&/^[a-f0-9]+$/i.test(text);})&&RIG_PARTS.some(p=>visible(rig.views[view][p.id])));
}
export const validAvatarRecord=data=>data?.rig!==undefined?validRig(data.rig):validAvatar(data?.frames);
export function packRig(rig){if(!validRig(rig))throw Error('人物部件不完整。');return RIG_VIEWS.flatMap(v=>RIG_PARTS.map(p=>rig.views[v][p.id])).join('');}
export function unpackRig(text){
  if(typeof text!=='string'||text.length!==RIG_LENGTH)throw Error('人物部件尺寸不正确。');
  let offset=0;const rig={version:1,views:{}};for(const view of RIG_VIEWS){rig.views[view]={};for(const p of RIG_PARTS){const n=p.w*p.h*8;rig.views[view][p.id]=text.slice(offset,offset+=n);}}
  if(!validRig(rig))throw Error('每个朝向至少保留一些像素。');return rig;
}
export function rigFromFrames(frames){
  if(!validAvatar(frames))throw Error('旧人物格式不正确。');
  const rig={version:1,views:{}};
  for(const [view,index] of [['down',0],['up',3],['right',9]]){
    rig.views[view]={};const source=frames[index].match(/.{8}/g);
    for(const p of RIG_PARTS)rig.views[view][p.id]=Array.from({length:p.w*p.h},(_,i)=>{
      const x=p.x+i%p.w,y=p.y+Math.floor(i/p.w),side=view==='right';
      const keep=p.id==='head'?y<21:p.id==='body'?y>=21&&y<36&&x>=(side?10:9)&&x<(side?24:24):p.id==='leftArm'?y>=24&&y<36&&x<(side?14:9):p.id==='rightArm'?y>=24&&y<36&&x>=(side?19:24):p.id==='leftLeg'?y>=36&&x<17:y>=36&&x>=17;
      return keep?source[y*32+x]:'00000000';
    }).join('');
  }return rig;
}
export function rigTemplate(color='568a78'){
  // The head keeps the existing character; limbs and torso are actual separate layers.
  const rig=rigFromFrames(avatarTemplate(color));color=String(color).replace(/^#/,'');if(!/^[a-f0-9]{6}$/i.test(color))color='568a78';
  const mix=(target,t)=>color.match(/../g).map((c,i)=>Math.round(parseInt(c,16)*(1-t)+parseInt(target.slice(i*2,i*2+2),16)*t).toString(16).padStart(2,'0')).join('');
  const ink='263640',light=mix('fff1cd',.27),shade=mix('203344',.32);
  for(const view of RIG_VIEWS)for(const p of RIG_PARTS){
    if(p.id==='head')continue;const pixels=Array(p.w*p.h).fill('00000000'),rect=(x,y,w,h,c)=>{for(let yy=Math.max(0,y);yy<Math.min(p.h,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(p.w,x+w);xx++)pixels[yy*p.w+xx]=c+'ff';};
    const side=view==='right',back=view==='up';
    if(p.id==='body'){
      const x=side?5:2,w=side?14:18;rect(x,2,w,14,ink);rect(x+1,3,w-2,11,color);rect(x+1,3,3,10,light);rect(x+w-4,5,3,9,shade);rect(x+2,14,w-4,1,'bea071');
      if(back){rect(6,5,12,10,ink);rect(7,6,10,8,'936249');rect(7,6,10,3,'c89763');rect(11,8,3,3,'f0dda8');}
      else{rect(side?11:10,4,3,7,'f6e7c0');rect(side?8:6,6,2,7,'8b6049');rect(side?10:8,3,2,5,'b38a5b');rect(side?13:15,9,4,4,shade);rect(side?14:16,9,2,1,light);}
      rect(x,1,w,3,'bea071');rect(x+1,1,w-2,2,'f0dda8');rect(x+2,1,w-5,1,'fff0cc');rect(side?12:12,4,3,6,'f0dda8');
    }else if(p.id.endsWith('Arm')){
      rect(1,1,6,13,ink);rect(2,2,4,8,color);rect(2,2,1,7,light);rect(5,3,1,7,shade);rect(2,10,4,4,'f3d2ab');rect(2,13,4,1,'d49e7d');
    }else{
      rect(2,0,6,11,ink);rect(3,1,4,9,p.id==='leftLeg'?'3d5261':'58747b');rect(side?2:1,10,side?8:8,4,ink);rect(side?4:2,10,side?5:6,2,'745f50');rect(side?4:2,12,side?5:6,1,'a08a69');
    }
    rig.views[view][p.id]=pixels.join('');
  }return rig;
}
