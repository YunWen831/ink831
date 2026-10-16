export function drawSky(ctx,width,height,cameraX){
  const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#1e334d');sky.addColorStop(1,'#8badad');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  for(let layer=0;layer<2;layer++){
    ctx.fillStyle=layer?'#6b919b77':'#b7cac447';ctx.beginPath();ctx.moveTo(0,height);
    for(let i=-1;i<Math.ceil(width/230)+2;i++){const x=i*230-(cameraX*(layer?.12:.06)%230);ctx.lineTo(x,height*(layer?.7:.5));ctx.lineTo(x+110,height*(layer?.34:.16)+(i%2)*38);}
    ctx.lineTo(width,height);ctx.fill();
  }
}
export function drawCourse(ctx,level,now,reduced,timers=[]){
  for(const r of level.solids){
    ctx.fillStyle='#354f60';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#97bab6';ctx.fillRect(r.x,r.y,r.w,5);ctx.fillStyle='#bed4c4';ctx.fillRect(r.x,r.y,r.w,2);
    ctx.strokeStyle='#496979';ctx.lineWidth=1;for(let x=r.x+24;x<r.x+r.w;x+=24){ctx.beginPath();ctx.moveTo(x,r.y+6);ctx.lineTo(x,r.y+r.h);ctx.stroke();}
  }
  for(const r of level.hazards){ctx.fillStyle='#e3a9a5';for(let x=r.x;x<r.x+r.w;x+=12){ctx.beginPath();ctx.moveTo(x,r.y+r.h);ctx.lineTo(x+6,r.y);ctx.lineTo(Math.min(x+12,r.x+r.w),r.y+r.h);ctx.fill();}}
  for(let i=0;i<level.checkpoints.length;i++){const c=level.checkpoints[i];ctx.fillStyle='#d3ded0';ctx.fillRect(c.x+5,c.y-18,2,42);ctx.fillStyle='#edce8d';ctx.beginPath();ctx.moveTo(c.x+7,c.y-18);ctx.lineTo(c.x+27,c.y-12);ctx.lineTo(c.x+7,c.y-5);ctx.fill();}
  level.crystals.forEach((c,i)=>{ctx.save();ctx.globalAlpha=timers[i]>0?.22:1;ctx.translate(c.x,c.y+(reduced?0:Math.sin(now/330)*3));ctx.fillStyle='#a6eed4';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,0);ctx.lineTo(0,12);ctx.lineTo(-9,0);ctx.fill();ctx.strokeStyle='#e2fff0';ctx.stroke();ctx.restore();});
  ctx.fillStyle='#e4c58e';ctx.fillRect(level.goal.x,level.goal.y,4,48);ctx.fillRect(level.goal.x+4,level.goal.y,27,19);
  ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.fillStyle='#e0ebdf';for(const sign of level.signs)ctx.fillText(sign.text,sign.x,sign.y);
}
