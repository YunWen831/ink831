import {WORLD,move,canStand} from './world.js';

export const WEAPONS=Object.freeze({
  knife:{name:'刀',damage:35,range:52,interval:480,magazine:0,reload:0},
  pistol:{name:'手枪',damage:20,range:620,interval:350,magazine:8,reload:1200},
  rifle:{name:'步枪',damage:14,range:840,interval:150,magazine:24,reload:1800},
});
export const CAR={maxSpeed:WORLD.speed*3,acceleration:560,brake:850,turn:3.8};
export const combatReady=p=>!!p&&p.connected&&p.space==='lobby'&&p.hp>0&&!p.sheltered;
export const canDamage=(a,b,forced,now)=>a!==b&&combatReady(a)&&combatReady(b)&&(forced||a.pvp&&b.pvp)&&a.shieldUntil<=now&&b.shieldUntil<=now;
export function slide(position,dx,dy,tiles){
  let {x,y}=position;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  for(let i=0;i<steps;i++){if(canStand(x+dx/steps,y,tiles))x+=dx/steps;if(canStand(x,y+dy/steps,tiles))y+=dy/steps;}
  return{x,y};
}
export function lobbyMove(p,dx,dy,tiles){
  if(p.hp<=0)return{x:p.x,y:p.y,speed:0,heading:p.heading||0};
  if(!p.driving)return{...move(p,dx,dy,tiles),speed:0,heading:p.heading||0};
  const dt=WORLD.stepMs/1000,input=Math.min(1,Math.hypot(dx,dy));let heading=p.heading||0,speed=Math.max(0,Math.min(CAR.maxSpeed,p.speed||0));
  if(input>.08){const angle=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading));heading+=Math.max(-CAR.turn*dt,Math.min(CAR.turn*dt,delta));speed=Math.min(CAR.maxSpeed*input,speed+CAR.acceleration*dt);}
  else speed=Math.max(0,speed-CAR.brake*dt);
  const distance=speed*dt,next=slide(p,Math.cos(heading)*distance,Math.sin(heading)*distance,tiles);
  if(Math.hypot(next.x-p.x,next.y-p.y)<distance*.5)speed=0;
  return{...next,speed,heading};
}
// First intersection along a shot, used for walls, targets and melee visibility.
export function rayWall(p,angle,range,tiles){
  for(let d=0;d<=range;d+=4){const x=p.x+Math.cos(angle)*d,y=p.y+Math.sin(angle)*d;if(x<0||y<0||x>WORLD.width||y>WORLD.height||tiles?.get(`${Math.floor(x/32)},${Math.floor(y/32)}`)?.solid)return d;}
  return range;
}
export function rayPerson(p,angle,target,radius=13){
  const dx=target.x-p.x,dy=target.y-p.y,along=dx*Math.cos(angle)+dy*Math.sin(angle),side=dx*dx+dy*dy-along*along;
  if(side>radius*radius||along<0)return Infinity;return Math.max(0,along-Math.sqrt(Math.max(0,radius*radius-side)));
}
