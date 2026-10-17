import { WORLD, FACILITIES, TILE_SIZE, isBuildCell, BUILD_REACH, tileKey } from './world.js?v=0.6.0';
import { RemoteMotion } from './motion.js?v=0.6.0';
import { avatarImage } from './avatar.js?v=0.6.0';
import { texture } from './art.js?v=0.6.0';
import { drawBubbles } from './bubbles.js?v=0.6.0';
import { bubbleDuration } from './chat.js?v=0.6.0';

const grass=document.createElement('canvas');grass.width=grass.height=128;
const ground=grass.getContext('2d');ground.fillStyle='#b9cea5';ground.fillRect(0,0,128,128);
for(let i=0;i<85;i++){const x=i*37%128,y=i*59%128;ground.fillStyle=i%3?'#c4d6b0':'#a9c494';ground.fillRect(x,y,2+i%4,1);}

export function createScene(canvas,getWorld){
  const ctx=canvas.getContext('2d'),pattern=ctx.createPattern(grass,'repeat');
  const mini=document.getElementById('minimap'),miniCtx=mini.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const positions=new Map(),motions=new Map(),poses=new Map();
  let width=960,height=640,dpr=1,lastMini=0,view={zoom:1,cameraX:0,cameraY:0};
  new ResizeObserver(()=>{const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}).observe(canvas);
  function background(cameraX,cameraY,visibleW,visibleH){
    ctx.fillStyle=pattern;ctx.fillRect(cameraX,cameraY,visibleW,visibleH);
    // The plaza is a walkable base layer; every cell can be covered by a build.
    ctx.fillStyle='#d6d9b4';ctx.fillRect(224,176,512,576);
    ctx.fillStyle='#dedfc1';ctx.fillRect(256,208,448,512);
    ctx.fillStyle='#d0d6ad';ctx.fillRect(0,368,WORLD.width,64);ctx.fillRect(448,0,64,WORLD.height);
    ctx.fillStyle='#dce0bf';ctx.fillRect(0,380,WORLD.width,40);ctx.fillRect(460,0,40,WORLD.height);
    ctx.strokeStyle='#8aa57566';ctx.lineWidth=2;ctx.strokeRect(1,1,WORLD.width-2,WORLD.height-2);
    const left=Math.max(0,Math.floor(cameraX/TILE_SIZE)),top=Math.max(0,Math.floor(cameraY/TILE_SIZE));
    const right=Math.min(WORLD.width/TILE_SIZE-1,Math.ceil((cameraX+visibleW)/TILE_SIZE)),bottom=Math.min(WORLD.height/TILE_SIZE-1,Math.ceil((cameraY+visibleH)/TILE_SIZE));
    return {left,top,right,bottom};
  }
  function drawPerson(p,pose,self,now,labels,world){
    const x=Math.round(p.x),y=Math.round(p.y),swing=p.moving&&!reduced?Math.sin(pose.phase)*3:0;
    const bob=p.moving&&!reduced?-Math.abs(Math.sin(pose.phase))*1.2:0;
    ctx.save();ctx.globalAlpha=p.connected?1:.4;
    ctx.fillStyle='#344d3530';ctx.beginPath();ctx.ellipse(x,y+2,10,4,0,0,Math.PI*2);ctx.fill();
    if(self){ctx.strokeStyle='#fffce5';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y+2,13,6,0,0,Math.PI*2);ctx.stroke();}
    ctx.translate(x,y);
    const custom=avatarImage(world.avatars?.get(p.userId),pose.facing,p.moving&&!reduced?[1,2][Math.floor(pose.phase/Math.PI)%2]:0);
    if(custom){ctx.drawImage(custom,-13,-39,26,39);}else{
    ctx.save();if(pose.facing==='left')ctx.scale(-1,1);
    const side=pose.facing==='left'||pose.facing==='right',back=pose.facing==='up';
    // Alternating feet and opposite arms make each step read in every direction.
    ctx.fillStyle='#435347';ctx.fillRect(side?-5:-7,-7+swing,5,8);ctx.fillRect(side?0:2,-7-swing,5,8);
    ctx.fillStyle='#354039';ctx.fillRect(side?-5:-7,-1+swing,6,3);ctx.fillRect(side?0:2,-1-swing,6,3);
    ctx.translate(0,bob);
    ctx.fillStyle=p.color;ctx.fillRect(side?-6:-9,-20,side?13:18,14);
    ctx.fillStyle='#ffffff20';ctx.fillRect(side?-5:-7,-19,side?3:4,11);
    ctx.fillStyle='#273b3020';ctx.fillRect(side?3:5,-17,side?4:4,11);
    ctx.save();ctx.translate(side?2:-10,-18);ctx.rotate(swing*.08);ctx.fillStyle=p.color;ctx.fillRect(-2,0,5,9);ctx.fillStyle='#e5c79d';ctx.fillRect(-2,7,5,4);ctx.restore();
    if(!side){ctx.save();ctx.translate(10,-18);ctx.rotate(-swing*.08);ctx.fillStyle=p.color;ctx.fillRect(-2,0,5,9);ctx.fillStyle='#e5c79d';ctx.fillRect(-2,7,5,4);ctx.restore();}
    ctx.fillStyle='#edd6ae';ctx.fillRect(side?-6:-7,-32,side?13:15,14);
    ctx.fillStyle='#536044';ctx.fillRect(-8,-34,16,6);ctx.fillRect(-8,-30,back?16:4,back?11:8);
    ctx.fillStyle='#6d7958';ctx.fillRect(-5,-34,9,2);
    if(!back){ctx.fillStyle='#35443a';ctx.fillRect(side?5:-3,-26,2,3);if(!side)ctx.fillRect(3,-26,2,3);ctx.fillStyle='#d6ad88';ctx.fillRect(side?6:0,-21,3,2);}
    ctx.fillStyle='#f0dfb5';ctx.fillRect(side?-5:-7,-18,side?12:14,3);ctx.fillRect(back?-5:side?0:-4,-15,3,6+Math.abs(swing)*.3);
    ctx.restore();}
    const label=p.name+(self?' · 你':'');ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';const tw=ctx.measureText(label).width;
    let labelY=-53,showLabel=true;
    if(!self){const collision=()=>labels.some(r=>x-tw/2-5<r.x+r.w&&x+tw/2+5>r.x&&y+labelY<r.y+r.h&&y+labelY+16>r.y);for(let i=0;i<3&&collision();i++)labelY-=18;showLabel=!collision();if(showLabel)labels.push({x:x-tw/2-5,y:y+labelY,w:tw+10,h:16});}
    if(showLabel){ctx.fillStyle=self?'#fbfcefef':'#fcfae6ce';ctx.fillRect(-tw/2-5,labelY,tw+10,16);ctx.fillStyle='#435c40';ctx.fillText(label,0,labelY+11);}
    const speech=world.speech?.get(p.id),emote=world.emotes.get(p.id);
    if((!speech||now-speech.at>=bubbleDuration(speech.text))&&emote&&now-emote<2300){ctx.fillStyle='#fff9e8';ctx.fillRect(12,-44,27,20);ctx.fillStyle='#8b7655';ctx.fillText('嗨',25,-30);}
    ctx.restore();
  }
  function minimap(world,cameraX,cameraY,visibleW,visibleH,now){
    if(mini.hidden||now-lastMini<120)return;lastMini=now;
    const sx=mini.width/WORLD.width,sy=mini.height/WORLD.height;
    miniCtx.clearRect(0,0,mini.width,mini.height);miniCtx.fillStyle='#adc696';miniCtx.fillRect(0,0,mini.width,mini.height);
    miniCtx.fillStyle='#dce0bf';miniCtx.fillRect(448*sx,0,64*sx,mini.height);miniCtx.fillRect(0,368*sy,mini.width,64*sy);
    if(world.space==='lobby'){miniCtx.fillStyle='#68765f';for(const tile of world.tiles.values())miniCtx.fillRect(tile.col*TILE_SIZE*sx,tile.row*TILE_SIZE*sy,Math.max(1,TILE_SIZE*sx),Math.max(1,TILE_SIZE*sy));}
    for(const f of FACILITIES){miniCtx.fillStyle='#6b8c8b';miniCtx.fillRect(f.x*sx-1,f.y*sy-1,3,3);}
    miniCtx.strokeStyle='#ffffffd9';miniCtx.lineWidth=1;miniCtx.strokeRect(cameraX*sx,cameraY*sy,visibleW*sx,visibleH*sy);
    for(const [id,p] of world.players){const point=id===world.self&&world.me?world.me:p;miniCtx.beginPath();miniCtx.fillStyle=id===world.self?'#fff9df':p.color;miniCtx.arc(point.x*sx,point.y*sy,id===world.self?2.6:1.6,0,Math.PI*2);miniCtx.fill();}
  }
  function frame(now){
    if(getWorld().practicing){requestAnimationFrame(frame);return;}
    const world=getWorld(),me=world.me,zoom=width<600?.92:Math.min(1.2,Math.max(1,width/1050));
    const visibleW=width/zoom,visibleH=height/zoom;
    const cameraX=Math.max(0,Math.min(WORLD.width-visibleW,(me?.x??480)-visibleW/2));
    const cameraY=Math.max(0,Math.min(WORLD.height-visibleH,(me?.y??414)-visibleH/2));view={zoom,cameraX,cameraY};
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;ctx.scale(zoom,zoom);ctx.translate(-cameraX,-cameraY);
    const bounds=background(cameraX,cameraY,visibleW,visibleH);
    if(world.space==='lobby'){
      const building=world.tool==='place'||world.tool==='remove';
      for(let row=bounds.top;row<=bounds.bottom;row++)for(let col=bounds.left;col<=bounds.right;col++){
        const x=col*TILE_SIZE,y=row*TILE_SIZE,tile=world.tiles.get(tileKey(col,row));
        if(tile){const image=texture(world.materials.get(tile.material));if(image){if(tile.solid){ctx.fillStyle='#384c3628';ctx.fillRect(x+3,y+4,TILE_SIZE,TILE_SIZE);}ctx.drawImage(image,x,y,TILE_SIZE,TILE_SIZE);if(tile.solid){ctx.fillStyle='#182e2828';ctx.fillRect(x,y+TILE_SIZE-4,TILE_SIZE,4);ctx.strokeStyle='#ffffee5c';ctx.strokeRect(x+.5,y+.5,TILE_SIZE-1,TILE_SIZE-1);}}}
        if(building){ctx.strokeStyle='#5b7a442e';ctx.lineWidth=.5;ctx.strokeRect(x,y,TILE_SIZE,TILE_SIZE);}
      }
      for(const f of FACILITIES){
        const near=world.nearFacility===f.id;
        ctx.fillStyle=f.id==='parkour'?'#8cb8ab':f.id==='dungeon'?'#b7a3c5':'#d6b380';ctx.beginPath();ctx.ellipse(f.x,f.y-4,19,11,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#f9f8df';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(f.x,f.y-4,14,7,0,0,Math.PI*2);ctx.stroke();
        ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';const tw=ctx.measureText(f.name).width;ctx.fillStyle=near?'#fff9e8':'#f6f7e5d9';ctx.fillRect(f.x-tw/2-7,f.y-39,tw+14,18);ctx.fillStyle='#4c6b49';ctx.fillText(f.name,f.x,f.y-26);
      }
      if(world.hover&&me&&building){const {col,row}=world.hover,valid=isBuildCell(col,row)&&Math.hypot(me.x-(col+.5)*TILE_SIZE,me.y-(row+.5)*TILE_SIZE)<=BUILD_REACH;ctx.fillStyle=valid?'#f6ffe33d':'#d47e6a30';ctx.fillRect(col*TILE_SIZE,row*TILE_SIZE,TILE_SIZE,TILE_SIZE);ctx.strokeStyle=valid?'#fafee6':'#ba7765';ctx.lineWidth=2;ctx.strokeRect(col*TILE_SIZE+1,row*TILE_SIZE+1,TILE_SIZE-2,TILE_SIZE-2);}
    }
    const people=[];
    for(const [id,p] of world.players){
      const target=id===world.self&&me?{...p,...me}:p,previous=positions.get(id)||target;let next={x:target.x,y:target.y};
      if(id!==world.self){let motion=motions.get(id);if(!motion){motion=new RemoteMotion(p,now);motions.set(id,motion);}motion.update(p,now);next=motion.sample(now,world.space==='lobby'?world.tiles:undefined);}
      const dx=next.x-previous.x,dy=next.y-previous.y,distance=Math.hypot(dx,dy);
      const pose=poses.get(id)||{phase:0,facing:'down',movedAt:-1000};
      if(distance>.04&&distance<30){pose.phase+=distance*.075;pose.movedAt=now;pose.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
      else if(distance>=30){pose.phase=0;pose.movedAt=-1000;}
      const moving=p.connected&&now-pose.movedAt<90;
      positions.set(id,next);poses.set(id,pose);
      if(next.x>cameraX-70&&next.x<cameraX+visibleW+70&&next.y>cameraY-70&&next.y<cameraY+visibleH+70)people.push({...target,...next,id,moving});
    }
    for(const id of positions.keys())if(!world.players.has(id)){positions.delete(id);motions.delete(id);poses.delete(id);}
    people.sort((a,b)=>a.y-b.y);const labels=[],own=people.find(p=>p.id===world.self);ctx.font='11px "Microsoft YaHei",sans-serif';
    if(own){const w=ctx.measureText(own.name+' · 你').width+10;labels.push({x:own.x-w/2,y:own.y-53,w,h:16});}
    for(const p of people)drawPerson(p,poses.get(p.id),p.id===world.self,now,labels,world);
    drawBubbles(ctx,people.map(p=>({...p,...(world.speech.get(p.id)||{text:'',at:-Infinity})})),now,{x:cameraX,y:cameraY,w:visibleW,h:visibleH},world.self);
    minimap(world,cameraX,cameraY,visibleW,visibleH,now);requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {pointAt(clientX,clientY){const box=canvas.getBoundingClientRect();return {x:(clientX-box.left)/view.zoom+view.cameraX,y:(clientY-box.top)/view.zoom+view.cameraY};}};
}
