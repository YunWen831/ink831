import {WORLD,move,canStand} from './world.js';

export const CAR={maxSpeed:WORLD.speed*3,acceleration:560,brake:850,turn:3.8};
export function slide(position,dx,dy,tiles){
  let {x,y}=position;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  for(let i=0;i<steps;i++){if(canStand(x+dx/steps,y,tiles))x+=dx/steps;if(canStand(x,y+dy/steps,tiles))y+=dy/steps;}
  return{x,y};
}
export function lobbyMove(p,dx,dy,tiles){
  if(!p.driving)return{...move(p,dx,dy,tiles),speed:0,heading:p.heading||0};
  const dt=WORLD.stepMs/1000,input=Math.min(1,Math.hypot(dx,dy));let heading=p.heading||0,speed=Math.max(0,Math.min(CAR.maxSpeed,p.speed||0));
  if(input>.08){const angle=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading));heading+=Math.max(-CAR.turn*dt,Math.min(CAR.turn*dt,delta));speed=Math.min(CAR.maxSpeed*input,speed+CAR.acceleration*dt);}
  else speed=Math.max(0,speed-CAR.brake*dt);
  const distance=speed*dt,next=slide(p,Math.cos(heading)*distance,Math.sin(heading)*distance,tiles);
  if(Math.hypot(next.x-p.x,next.y-p.y)<distance*.5)speed=0;
  return{...next,speed,heading};
}
