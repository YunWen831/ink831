import {platformAt,crumbleSolid,CRUMBLE_LIFETIME,DOOR_DURATION} from './parkour-mechanics.js?v=0.11.0';
export const STEP=1/120;
export const BODY={w:16,h:24};
export const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const approach=(v,target,amount)=>v<target?Math.min(target,v+amount):Math.max(target,v-amount);
const body=s=>({x:s.x,y:s.y,...BODY});
const buckets=new WeakMap();
function nearby(rects,box){
  let cache=buckets.get(rects);
  if(!cache||cache.length!==rects.length){
    const grid=new Map();for(const r of rects)for(let y=Math.floor(r.y/64);y<=Math.floor((r.y+r.h)/64);y++)for(let x=Math.floor(r.x/64);x<=Math.floor((r.x+r.w)/64);x++){const key=x+','+y;let cell=grid.get(key);if(!cell)grid.set(key,cell=[]);cell.push(r);}
    cache={length:rects.length,grid};buckets.set(rects,cache);
  }
  const found=new Set();for(let y=Math.floor(box.y/64);y<=Math.floor((box.y+box.h)/64);y++)for(let x=Math.floor(box.x/64);x<=Math.floor((box.x+box.w)/64);x++)for(const r of cache.grid.get(x+','+y)||[])found.add(r);
  return found;
}
function* walls(s,level,box){
  yield* nearby(level.solids,box);
  yield* nearby(level.springs||[],box);
  for(const r of nearby(level.doors||[],box))if(!(s.doors[r.group]>0))yield r;
  for(const r of nearby(level.crumbles||[],box))if(crumbleSolid(s.crumbles[r.index]))yield r;
}
// Indexed IDs are assigned once, identically for local and network level objects.
const indexed=new WeakSet();
function prepare(level){if(indexed.has(level))return;for(const key of ['crumbles','switches'])for(const [index,r] of (level[key]||[]).entries())r.index=index;indexed.add(level);}
function* tops(s,level){
  if(s.dropTime>0)return;
  yield* level.oneways||[];
  for(const r of level.movers||[])yield platformAt(r,s.mechanismTime);
}
const overlapX=(a,b)=>a.x<b.x+b.w&&a.x+BODY.w>b.x;
const hits=(s,level,dx=0,dy=0)=>{
  const box={...body(s),x:s.x+dx,y:s.y+dy};for(const r of walls(s,level,box))if(intersects(box,r))return true;
  if(dy>0&&s.vy>=0)for(const r of tops(s,level))if(overlapX(box,r)&&s.y+BODY.h<=r.y+.7&&box.y+BODY.h>=r.y)return true;
  return false;
};
function resetMechanisms(s){Object.assign(s,{mechanismTime:0,crumbles:[],doors:[],switchContacts:[],dropTime:0,springBoost:0});}
export function createParkourState(level,checkpoint=0){
  const p=level.checkpoints[checkpoint];
  const state={x:p.x,y:p.y,vx:0,vy:0,facing:1,grounded:false,coyote:0,buffer:0,dashBuffer:0,dash:1,dashTime:0,wallLock:0,checkpoint,deaths:0,time:0,dead:0,finished:false,crystals:[]};resetMechanisms(state);return state;
}
export function respawn(s,level){
  const {checkpoint,deaths,time}=s;
  Object.assign(s,createParkourState(level,checkpoint),{deaths,time});
}
function axis(s,amount,key,level,includeTops=true){
  if(!amount)return;
  const before=s.y+BODY.h;
  s[key]+=amount;
  for(const r of walls(s,level,body(s))){
    if(!intersects(body(s),r))continue;
    if(key==='x'){s.x=amount>0?r.x-BODY.w:r.x+r.w;s.vx=0;}
    else {s.y=amount>0?r.y-BODY.h:r.y+r.h;s.vy=0;if(amount>0)s.grounded=true;}
    s.dashTime=0;
  }
  if(key==='y'&&amount>0&&includeTops){
    let top=Infinity;for(const r of tops(s,level))if(overlapX(s,r)&&before<=r.y+.7&&s.y+BODY.h>=r.y)top=Math.min(top,r.y);
    if(Number.isFinite(top)){s.y=top-BODY.h;s.vy=0;s.grounded=true;s.dashTime=0;}
  }
}
const die=s=>{s.deaths++;s.dead=.18;s.dashTime=0;};
export function stepParkour(s,input,dt,level){
  if(s.finished)return;
  prepare(level);
  s.time+=dt;
  s.crystals=s.crystals.map(t=>Math.max(0,(t||0)-dt));
  if(s.dead>0){s.dead-=dt;if(s.dead<=0)respawn(s,level);return;}
  const oldTime=s.mechanismTime;
  const riding=s.dropTime<=0&&s.vy>=0?(level.movers||[]).find(r=>{const p=platformAt(r,oldTime);return overlapX(s,p)&&Math.abs(s.y+BODY.h-p.y)<.8;}):null;
  s.mechanismTime+=dt;
  s.dropTime=Math.max(0,s.dropTime-dt);s.springBoost=Math.max(0,s.springBoost-dt);
  const cooldown=t=>{const next=(t||0)-dt;return next<.0001?0:next;};
  s.crumbles=s.crumbles.map(cooldown);s.doors=s.doors.map(cooldown);
  const occupied={x:s.x+3,y:s.y+2,w:BODY.w-6,h:BODY.h-4};
  if([...walls(s,level,occupied)].some(r=>intersects(occupied,r))){die(s);return;}
  if(riding){const a=platformAt(riding,oldTime),b=platformAt(riding,s.mechanismTime);axis(s,b.x-a.x,'x',level,false);axis(s,b.y-a.y,'y',level,false);if(s.y+BODY.h>b.y+1&&intersects(body(s),b)){die(s);return;}}
  s.grounded=hits(s,level,0,.5);
  if(input.jumpPressed&&input.y>0&&[...tops(s,level)].some(r=>overlapX(s,r)&&Math.abs(s.y+BODY.h-r.y)<.8)){
    s.dropTime=.22;s.y+=1;s.vy=Math.max(s.vy,60);s.grounded=false;s.coyote=0;input={...input,jumpPressed:false};
  }
  if(s.grounded){s.coyote=.10;if(s.dashTime<=0)s.dash=1;}else s.coyote=Math.max(0,s.coyote-dt);
  s.buffer=input.jumpPressed?.12:Math.max(0,s.buffer-dt);
  s.dashBuffer=input.dashPressed?.10:Math.max(0,s.dashBuffer-dt);
  s.wallLock=Math.max(0,s.wallLock-dt);
  const direction=Math.abs(input.x||0)>.2?Math.sign(input.x):0;
  let wx=0,wy=0;for(const r of nearby(level.winds||[],body(s)))if(intersects(body(s),r)){wx+=r.dx;wy+=r.dy;}
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
    if(s.wallLock<=0)s.vx=approach(s.vx,direction*205+Math.sign(wx)*170,(direction||wx?(s.grounded?1800:1200):2400)*dt);
    if(!input.jumpHeld&&s.springBoost<=0&&s.vy < -150)s.vy=-150;
    s.vy=Math.min(520,s.vy+1500*dt);
    if(wall&&direction===wall&&s.vy>90)s.vy=90;
    s.vy=Math.max(-650,Math.min(650,s.vy+Math.sign(wy)*2100*dt));
  }
  s.grounded=false;
  axis(s,s.vx*dt,'x',level);axis(s,s.vy*dt,'y',level);
  s.wallSide=hits(s,level,-1,0)?-1:hits(s,level,1,0)?1:0;
  s.x=Math.max(0,Math.min(level.width-BODY.w,s.x));
  if(s.grounded&&s.dashTime<=0)s.dash=1;
  const hurt={x:s.x+3,y:s.y+2,w:BODY.w-6,h:BODY.h-4};
  if(s.y>level.height+40||[...nearby(level.hazards,hurt)].some(r=>intersects(hurt,r))||[...walls(s,level,hurt)].some(r=>intersects(hurt,r))){die(s);return;}
  for(let i=s.checkpoint+1;i<level.checkpoints.length;i++)if(intersects(body(s),level.checkpoints[i].trigger)){s.checkpoint=i;resetMechanisms(s);}
  if(s.grounded){
    for(const r of nearby(level.crumbles||[],{...body(s),h:BODY.h+1}))if(overlapX(s,r)&&Math.abs(s.y+BODY.h-r.y)<.8&&!s.crumbles[r.index])s.crumbles[r.index]=CRUMBLE_LIFETIME;
    for(const r of nearby(level.springs||[],{...body(s),h:BODY.h+1}))if(overlapX(s,r)&&Math.abs(s.y+BODY.h-r.y)<.8){s.vy=-650;s.springBoost=.32;s.grounded=false;s.dash=1;s.dashTime=0;s.coyote=0;break;}
  }
  const contacts=[];for(const r of nearby(level.switches||[],body(s)))if(intersects(body(s),r)){contacts.push(r.index);if(!s.switchContacts.includes(r.index))s.doors[r.group]=DOOR_DURATION;}
  s.switchContacts=contacts;
  level.crystals.forEach((c,index)=>{if(!s.crystals[index]&&intersects(body(s),{x:c.x-12,y:c.y-12,w:24,h:24})){s.dash=1;s.crystals[index]=.9;}});
  if(intersects(body(s),level.goal))s.finished=true;
}
