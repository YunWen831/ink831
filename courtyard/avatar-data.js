export const AVATAR_WIDTH=32,AVATAR_HEIGHT=48,AVATAR_FRAMES=12;
export const AVATAR_FRAME_LENGTH=AVATAR_WIDTH*AVATAR_HEIGHT*8;
export const AVATAR_LENGTH=AVATAR_FRAME_LENGTH*AVATAR_FRAMES;
export const AVATAR_DIRECTIONS=['down','up','left','right'];
export function validAvatar(frames){return Array.isArray(frames)&&frames.length===AVATAR_FRAMES&&frames.every(p=>typeof p==='string'&&p.length===AVATAR_FRAME_LENGTH&&/^[a-f0-9]+$/i.test(p)&&Array.from({length:AVATAR_WIDTH*AVATAR_HEIGHT},(_,i)=>p.slice(i*8+6,i*8+8)).some(a=>a!=='00'));}
export function avatarTemplate(color='568a78'){
  return AVATAR_DIRECTIONS.flatMap(direction=>[0,1,2].map(frame=>{
    const pixels=Array(32*48).fill('00000000');
    const rect=(x,y,w,h,c)=>{for(let row=Math.max(0,y);row<Math.min(48,y+h);row++)for(let col=Math.max(0,x);col<Math.min(32,x+w);col++)pixels[row*32+col]=c+'ff';};
    const side=direction==='left'||direction==='right',back=direction==='up',step=frame===1?-2:frame===2?2:0;
    rect(9,34,6,11+step,'35473f');rect(18,34,6,11-step,'35473f');rect(8,43+step,8,3,'263b34');rect(17,43-step,8,3,'263b34');
    rect(side?10:6,20,side?14:21,17,'283f36');rect(side?11:7,21,side?12:19,14,color);rect(side?12:8,22,3,10,'91b59b');
    rect(4,23-step,5,12,'283f36');rect(5,24-step,3,8,color);rect(5,32-step,3,4,'edd2ac');
    if(!side){rect(25,23+step,4,12,'283f36');rect(25,24+step,3,8,color);rect(25,32+step,3,4,'edd2ac');}
    rect(8,5,17,16,'283f36');rect(9,7,15,13,'edd2ac');rect(7,4,18,6,'485b42');rect(9,4,12,2,'758760');
    rect(8,9,back?17:4,back?12:6,'485b42');
    if(!back){rect(side?20:13,12,2,3,'283f36');if(!side)rect(19,12,2,3,'283f36');}
    rect(8,20,18,3,'ead8aa');rect(back?10:17,23,3,8,'ead8aa');
    if(direction==='left'){for(let y=0;y<48;y++){const row=pixels.slice(y*32,y*32+32).reverse();pixels.splice(y*32,32,...row);}}
    return pixels.join('');
  }));
}
