import {platformAt,crumbleSolid} from './parkour-mechanics.js?v=0.15.0';
export function drawSky(ctx,width,height,cameraX){
  const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#1e334d');sky.addColorStop(1,'#8badad');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  for(let layer=0;layer<2;layer++){
    ctx.fillStyle=layer?'#6b919b77':'#b7cac447';ctx.beginPath();ctx.moveTo(0,height);
    for(let i=-1;i<Math.ceil(width/230)+2;i++){const x=i*230-(cameraX*(layer?.12:.06)%230);ctx.lineTo(x,height*(layer?.7:.5));ctx.lineTo(x+110,height*(layer?.34:.16)+(i%2)*38);}
    ctx.lineTo(width,height);ctx.fill();
  }
}
export function drawCourse(ctx,level,now,reduced,timers=[],mechanisms=null){
  const time=mechanisms?.mechanismTime||0;
  for(const r of level.winds||[]){
    ctx.fillStyle='#8ed9f128';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.save();ctx.translate(r.x+12,r.y+12);ctx.rotate(Math.atan2(r.dy,r.dx));
    const drift=reduced?0:Math.sin(now/240)*2;ctx.translate(drift,0);ctx.strokeStyle='#b9eaf6a0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(6,0);ctx.moveTo(1,-4);ctx.lineTo(6,0);ctx.lineTo(1,4);ctx.stroke();ctx.restore();
  }
  for(const r of level.solids){
    ctx.fillStyle='#354f60';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#97bab6';ctx.fillRect(r.x,r.y,r.w,5);ctx.fillStyle='#bed4c4';ctx.fillRect(r.x,r.y,r.w,2);
    ctx.strokeStyle='#496979';ctx.lineWidth=1;for(let x=r.x+24;x<r.x+r.w;x+=24){ctx.beginPath();ctx.moveTo(x,r.y+6);ctx.lineTo(x,r.y+r.h);ctx.stroke();}
  }
  for(const r of level.hazards){ctx.fillStyle='#e3a9a5';for(let x=r.x;x<r.x+r.w;x+=12){ctx.beginPath();ctx.moveTo(x,r.y+r.h);ctx.lineTo(x+6,r.y);ctx.lineTo(Math.min(x+12,r.x+r.w),r.y+r.h);ctx.fill();}}
  for(const r of level.oneways||[]){ctx.fillStyle='#b8d9e4';ctx.fillRect(r.x,r.y,r.w,3);ctx.fillStyle='#779fafaa';ctx.fillRect(r.x+2,r.y+3,r.w-4,3);}
  for(const r of level.movers||[]){
    const p=platformAt(r,time),range=r.range??48;ctx.strokeStyle='#dfbb7b66';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(r.x+12-(r.axis==='x'?range:0),r.y+4-(r.axis==='y'?range:0));ctx.lineTo(r.x+12+(r.axis==='x'?range:0),r.y+4+(r.axis==='y'?range:0));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#e6bc78';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#fff0bf';ctx.fillRect(p.x,p.y,p.w,2);ctx.fillStyle='#896447';ctx.fillRect(p.x+5,p.y+4,4,2);ctx.fillRect(p.x+15,p.y+4,4,2);
  }
  (level.crumbles||[]).forEach((r,i)=>{
    const timer=mechanisms?.crumbles?.[i]||0,solid=crumbleSolid(timer);ctx.save();ctx.globalAlpha=solid?1:.16;if(timer>2.6&&!reduced)ctx.translate(Math.sin(now/22),0);
    ctx.fillStyle='#a0877d';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#dec0a1';ctx.fillRect(r.x,r.y,r.w,3);ctx.strokeStyle='#64554f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x+13,r.y+3);ctx.lineTo(r.x+9,r.y+10);ctx.lineTo(r.x+15,r.y+14);ctx.lineTo(r.x+10,r.y+23);ctx.stroke();ctx.restore();
  });
  for(const r of level.springs||[]){
    ctx.fillStyle='#64887d';ctx.fillRect(r.x+2,r.y+6,20,2);ctx.strokeStyle='#a8e6a7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x+7,r.y+6);ctx.lineTo(r.x+16,r.y+4);ctx.lineTo(r.x+7,r.y+2);ctx.lineTo(r.x+16,r.y);ctx.stroke();ctx.fillStyle='#c5f09c';ctx.fillRect(r.x,r.y,24,3);
  }
  for(const r of level.doors||[]){
    const open=mechanisms?.doors?.[r.group]>0;ctx.fillStyle=open?'#bfa7e31c':'#7b6597';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle=open?'#d3c2ee70':'#d3c2ee';ctx.lineWidth=1;ctx.strokeRect(r.x+2,r.y+2,r.w-4,r.h-4);
    if(!open){ctx.fillStyle='#d3c2ee';ctx.fillRect(r.x+10,r.y+8,4,8);}
  }
  for(const r of level.switches||[]){
    const remaining=mechanisms?.doors?.[r.group]||0;ctx.fillStyle=remaining?'#f6e6ac':'#bd9bd9';ctx.fillRect(r.x,r.y+7,r.w,11);ctx.fillStyle=remaining?'#8cbe99':'#73608c';ctx.fillRect(r.x+5,r.y,8,8);
    if(remaining){ctx.fillStyle='#f7e8b5';ctx.fillRect(r.x,r.y-4,r.w*Math.min(1,remaining/4),2);}
  }
  for(let i=0;i<level.checkpoints.length;i++){const c=level.checkpoints[i];ctx.fillStyle='#d3ded0';ctx.fillRect(c.x+5,c.y-18,2,42);ctx.fillStyle='#edce8d';ctx.beginPath();ctx.moveTo(c.x+7,c.y-18);ctx.lineTo(c.x+27,c.y-12);ctx.lineTo(c.x+7,c.y-5);ctx.fill();}
  level.crystals.forEach((c,i)=>{ctx.save();ctx.globalAlpha=timers[i]>0?.22:1;ctx.translate(c.x,c.y+(reduced?0:Math.sin(now/330)*3));ctx.fillStyle='#a6eed4';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,0);ctx.lineTo(0,12);ctx.lineTo(-9,0);ctx.fill();ctx.strokeStyle='#e2fff0';ctx.stroke();ctx.restore();});
  ctx.fillStyle='#e4c58e';ctx.fillRect(level.goal.x,level.goal.y,4,48);ctx.fillRect(level.goal.x+4,level.goal.y,27,19);
  ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.fillStyle='#e0ebdf';for(const sign of level.signs)ctx.fillText(sign.text,sign.x,sign.y);
}
