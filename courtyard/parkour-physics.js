export const STEP=1/120;
export const BODY={w:16,h:24};
export const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const approach=(v,target,amount)=>v<target?Math.min(target,v+amount):Math.max(target,v-amount);
const body=s=>({x:s.x,y:s.y,...BODY});
const hits=(s,level,dx=0,dy=0)=>level.solids.some(r=>intersects({...body(s),x:s.x+dx,y:s.y+dy},r));
export function createParkourState(level,checkpoint=0){
  const p=level.checkpoints[checkpoint];
  return {x:p.x,y:p.y,vx:0,vy:0,facing:1,grounded:false,coyote:0,buffer:0,dashBuffer:0,dash:1,dashTime:0,wallLock:0,checkpoint,deaths:0,time:0,dead:0,finished:false,crystals:[]};
}
export function respawn(s,level){
  const {checkpoint,deaths,time}=s;
  Object.assign(s,createParkourState(level,checkpoint),{deaths,time});
}
function axis(s,amount,key,level){
  s[key]+=amount;
  for(const r of level.solids){
    if(!intersects(body(s),r))continue;
    if(key==='x'){s.x=amount>0?r.x-BODY.w:r.x+r.w;s.vx=0;}
    else {s.y=amount>0?r.y-BODY.h:r.y+r.h;s.vy=0;if(amount>0)s.grounded=true;}
    s.dashTime=0;
  }
}
export function stepParkour(s,input,dt,level){
  if(s.finished)return;
  s.time+=dt;
  s.crystals=s.crystals.map(t=>Math.max(0,t-dt));
  if(s.dead>0){s.dead-=dt;if(s.dead<=0)respawn(s,level);return;}
  s.grounded=hits(s,level,0,.5);
  if(s.grounded){s.coyote=.10;if(s.dashTime<=0)s.dash=1;}else s.coyote=Math.max(0,s.coyote-dt);
  s.buffer=input.jumpPressed?.12:Math.max(0,s.buffer-dt);
  s.dashBuffer=input.dashPressed?.10:Math.max(0,s.dashBuffer-dt);
  s.wallLock=Math.max(0,s.wallLock-dt);
  const direction=Math.abs(input.x||0)>.2?Math.sign(input.x):0;
  if(direction)s.facing=direction;
  if(s.dashBuffer>0&&s.dash&&s.dashTime<=0){
    let x=Math.abs(input.x||0)>.3?Math.sign(input.x):0,y=Math.abs(input.y||0)>.3?Math.sign(input.y):0;
    if(!x&&!y)x=s.facing;
    const length=Math.hypot(x,y);s.vx=x/length*460;s.vy=y/length*460;s.dash=0;s.dashTime=.15;s.buffer=0;s.dashBuffer=0;s.coyote=0;
  }
  if(s.dashTime>0){s.dashTime=Math.max(0,s.dashTime-dt);}
  else {
    const wall=hits(s,level,-1,0)?-1:hits(s,level,1,0)?1:0;
    if(s.buffer>0&&(s.coyote>0||wall)){
      s.buffer=0;s.grounded=false;s.coyote=0;s.vy=wall&&!hits(s,level,0,.5)?-410:-440;
      if(wall&&!hits(s,level,0,.5)){s.vx=-wall*240;s.facing=-wall;s.wallLock=.13;}
    }
    if(s.wallLock<=0)s.vx=approach(s.vx,direction*205,(direction?(s.grounded?1800:1200):2400)*dt);
    if(!input.jumpHeld&&s.vy < -150)s.vy=-150;
    s.vy=Math.min(520,s.vy+1500*dt);
    if(wall&&direction===wall&&s.vy>90)s.vy=90;
  }
  s.grounded=false;
  axis(s,s.vx*dt,'x',level);axis(s,s.vy*dt,'y',level);
  s.x=Math.max(0,Math.min(level.width-BODY.w,s.x));
  if(s.grounded&&s.dashTime<=0)s.dash=1;
  const hurt={x:s.x+3,y:s.y+2,w:BODY.w-6,h:BODY.h-4};
  if(s.y>level.height+40||level.hazards.some(r=>intersects(hurt,r))){s.deaths++;s.dead=.18;s.dashTime=0;return;}
  for(let i=s.checkpoint+1;i<level.checkpoints.length;i++)if(intersects(body(s),level.checkpoints[i].trigger))s.checkpoint=i;
  level.crystals.forEach((c,index)=>{if(!s.crystals[index]&&intersects(body(s),{x:c.x-12,y:c.y-12,w:24,h:24})){s.dash=1;s.crystals[index]=.9;}});
  if(intersects(body(s),level.goal))s.finished=true;
}
