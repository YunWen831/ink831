export const AVATAR_WIDTH=32,AVATAR_HEIGHT=48,AVATAR_FRAMES=12;
export const AVATAR_FRAME_LENGTH=AVATAR_WIDTH*AVATAR_HEIGHT*8;
export const AVATAR_LENGTH=AVATAR_FRAME_LENGTH*AVATAR_FRAMES;
export const AVATAR_DIRECTIONS=['down','up','left','right'];
export function validAvatar(frames){return Array.isArray(frames)&&frames.length===AVATAR_FRAMES&&frames.every(p=>typeof p==='string'&&p.length===AVATAR_FRAME_LENGTH&&/^[a-f0-9]+$/i.test(p)&&Array.from({length:AVATAR_WIDTH*AVATAR_HEIGHT},(_,i)=>p.slice(i*8+6,i*8+8)).some(a=>a!=='00'));}
// Original 32×48 courier: the default lobby sprite and painter template share pixels.
export function avatarTemplate(color='568a78'){
  color=String(color).replace(/^#/,'');if(!/^[a-f0-9]{6}$/i.test(color))color='568a78';
  const tint=(toward,amount)=>{const a=color.match(/../g).map(x=>parseInt(x,16)),b=toward.match(/../g).map(x=>parseInt(x,16));return a.map((v,i)=>Math.round(v+(b[i]-v)*amount).toString(16).padStart(2,'0')).join('');};
  const coat=color,light=tint('fff1cd',.27),shade=tint('203344',.32);
  const ink='263640',hair='4d3d3a',hairLight='876452',hairMid='684c42',skin='f3d2ab',skinShadow='d49e7d',scarf='f0dda8',scarfShade='bea071';
  return AVATAR_DIRECTIONS.flatMap(direction=>[0,1,2].map(frame=>{
    const pixels=Array(32*48).fill('00000000');
    const rect=(x,y,w,h,c)=>{for(let row=Math.max(0,y);row<Math.min(48,y+h);row++)for(let col=Math.max(0,x);col<Math.min(32,x+w);col++)pixels[row*32+col]=c+'ff';};
    const side=direction==='left'||direction==='right',back=direction==='up',step=frame===1?-2:frame===2?2:0,bob=frame?1:0;
    const r=(x,y,w,h,c)=>rect(x,y+bob,w,h,c);
    // Feet stay anchored; depth and a bright sole distinguish the two strides.
    if(side){
      rect(11-step,34,6,10-Math.abs(step),ink);rect(12-step,35,4,8-Math.abs(step),'3d5261');
      rect(10-step,43-Math.abs(step),8,4,ink);rect(11-step,43-Math.abs(step),5,2,'745f50');
      rect(16+step,34,6,11-Math.abs(step),ink);rect(17+step,35,4,8-Math.abs(step),'58747b');
      rect(16+step,44-Math.abs(step),9,3,ink);rect(18+step,44-Math.abs(step),6,1,'b29b75');
    }else{
      for(const [x,dy,front] of [[10,step,false],[18,-step,true]]){
        rect(x,34,5,10+dy,ink);rect(x+1,35,3,8+dy,front?'58747b':'3d5261');
        rect(x-1,43+dy,7,3,ink);rect(x,43+dy,5,1,back?'745f50':'a08a69');
      }
    }
    // Rear arm first; the near arm is drawn over the coat below.
    const arm=(x,y,front)=>{r(x,y,5,11,ink);r(x+1,y+1,3,7,front?coat:shade);r(x+1,y+8,3,3,front?skin:skinShadow);};
    if(side)arm(9,24+step,false);else arm(4,24-step,false);
    const left=side?10:7,w=side?14:19;
    r(left,22,w,14,ink);r(left+1,23,w-2,11,coat);r(left+1,23,3,10,light);r(left+w-4,25,3,9,shade);
    r(left+2,34,w-4,2,scarfShade);r(left+2,35,w-4,1,ink);
    if(back){
      // A little mail satchel reads as a different silhouette from the front.
      r(11,25,12,10,ink);r(12,26,10,8,'936249');r(12,26,10,3,'c89763');r(16,28,3,3,scarf);r(13,34,8,1,'6b4a3f');
      r(10,23,2,5,'b58b61');r(23,23,2,6,'b58b61');
    }else{
      r(side?17:15,24,3,7,'f6e7c0');r(side?13:11,26,2,7,'8b6049');r(side?15:13,23,2,5,'b38a5b');
      r(side?18:20,29,4,4,shade);r(side?19:21,29,2,1,light);r(16,32,1,1,scarf);
    }
    // Stepped silhouette and warm skin, with a clear one-pixel eye highlight.
    r(9,5,14,2,ink);r(7,7,18,12,ink);r(9,19,14,3,ink);
    if(back){
      r(8,8,16,11,hair);r(10,6,12,3,hairMid);r(10,7,8,1,hairLight);r(9,18,14,3,hairMid);r(11,20,10,2,skinShadow);
      r(8,11,2,6,hairMid);r(21,11,2,6,hairMid);
    }else if(side){
      r(10,8,13,12,skin);r(21,12,4,6,skin);r(21,18,2,2,skinShadow);r(21,12,2,3,ink);r(22,12,1,1,'fff1d7');
      r(8,8,6,11,hair);r(10,6,12,4,hairMid);r(11,7,8,1,hairLight);r(14,9,7,2,hair);r(12,13,3,5,skinShadow);r(13,14,2,2,skin);
      r(18,20,4,1,'bf8c72');
    }else{
      r(9,9,14,11,skin);r(9,17,2,3,skinShadow);r(21,17,2,3,skinShadow);r(13,20,7,1,skinShadow);
      r(8,8,16,4,hair);r(10,6,12,3,hairMid);r(10,7,9,1,hairLight);r(9,10,3,5,hair);r(20,10,3,3,hair);r(12,11,3,2,hair);
      r(12,14,2,3,ink);r(19,14,2,3,ink);r(13,14,1,1,'fff4dc');r(20,14,1,1,'fff4dc');r(16,18,2,1,skinShadow);
    }
    r(side?10:8,21,side?14:16,3,scarfShade);r(side?11:9,21,side?12:14,2,scarf);r(side?12:10,21,side?8:10,1,'fff0cc');
    if(!back){r(17,24,3,6,scarf);r(17,29,3,1,scarfShade);}else r(9,24,3,4,scarf);
    if(side)arm(19,24-step,true);else arm(24,24+step,true);
    if(direction==='left')for(let y=0;y<48;y++)pixels.splice(y*32,32,...pixels.slice(y*32,y*32+32).reverse());
    return pixels.join('');
  }));
}
