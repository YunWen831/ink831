export function drawCar(ctx,p){
  ctx.save();ctx.rotate(p.heading||0);ctx.fillStyle='#203b46';for(const x of [-18,10])for(const y of [-19,12])ctx.fillRect(x,y,11,7);
  ctx.fillStyle=p.color;ctx.fillRect(-26,-15,53,30);ctx.fillStyle='#f5ead1';ctx.fillRect(16,-13,9,26);ctx.fillStyle='#3e6874';ctx.fillRect(-8,-12,20,24);ctx.fillStyle='#bce2e7';ctx.fillRect(6,-11,6,22);ctx.fillStyle='#ffe9a3';ctx.fillRect(25,-12,4,6);ctx.fillRect(25,6,4,6);ctx.fillStyle='#e8715b';ctx.fillRect(-28,-11,3,5);ctx.fillRect(-28,6,3,5);ctx.restore();
}
function icon(ctx,kind,x,y,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=kind==='knife'?'#ebeee7':'#344653';ctx.fillRect(-8,-3,kind==='rifle'?27:18,6);ctx.fillStyle=kind==='knife'?'#885e43':'#84664c';ctx.fillRect(-8,kind==='knife'?-3:2,8,kind==='knife'?6:8);if(kind==='rifle'){ctx.fillStyle='#344653';ctx.fillRect(3,2,6,9);}ctx.restore();}
export function drawPickups(ctx,game,now){for(const p of game?.pickups?.values()||[]){ctx.fillStyle='#fffbea';ctx.beginPath();ctx.arc(p.x,p.y,19,0,Math.PI*2);ctx.fill();ctx.strokeStyle=p.kind==='rifle'?'#b5774d':p.kind==='pistol'?'#5486aa':'#709e76';ctx.lineWidth=2;ctx.stroke();icon(ctx,p.kind,p.x,p.y-2+Math.sin(now/500+p.x)*2);}}
export function drawCombatPerson(ctx,p,world,now){
  const active=world.forcedPvp||p.pvp;if(active){ctx.fillStyle='#d65b51';ctx.fillRect(-3,-76,6,6);}
  if(p.hp<100||active){ctx.fillStyle='#263b3dcc';ctx.fillRect(-19,-69,38,5);ctx.fillStyle=p.hp>35?'#7cd69b':'#f38875';ctx.fillRect(-18,-68,36*p.hp/100,3);}
  if(p.shieldUntil>Date.now()){ctx.strokeStyle='#eef9ff99';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-20,23,33,0,0,Math.PI*2);ctx.stroke();}
  if(p.weapon&&!p.driving&&p.hp>0)icon(ctx,p.weapon,14,-15,p.id===world.self?world.lobbyGame?.aim:0);
  if(p.hp<=0){ctx.fillStyle='#fff6e6';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('复活中',0,-30);}
}
export function drawShots(ctx,game,now){if(!game)return;for(let i=game.effects.length-1;i>=0;i--){const e=game.effects[i],age=now-e.at;if(age>220){game.effects.splice(i,1);continue;}ctx.save();ctx.globalAlpha=1-age/220;ctx.strokeStyle=e.hit?'#ef795c':'#fff1ba';ctx.lineWidth=e.kind==='knife'?4:2;ctx.beginPath();if(e.kind==='knife')ctx.arc(e.x,e.y,40,e.angle-.65,e.angle+.65);else{ctx.moveTo(e.x,e.y-10);ctx.lineTo(e.x+Math.cos(e.angle)*e.distance,e.y+Math.sin(e.angle)*e.distance-10);}ctx.stroke();ctx.restore();}}
