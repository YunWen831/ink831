import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lobbyMove,CAR} from '../../../courtyard/lobby-rules.js';
import {canStand,WORLD} from '../../../courtyard/world.js';
import {RemoteMotion} from '../../../courtyard/motion.js';

test('driving retains acceleration, braking, turn limits and swept wall collision',()=>{
  let p={x:400,y:500,driving:true,speed:0,heading:0};const tiles=new Map([['16,15',{col:16,row:15,solid:true}]]);
  for(let i=0;i<180;i++){p={...p,...lobbyMove(p,1,0,tiles)};assert.ok(canStand(p.x,p.y,tiles));assert.ok(p.x<=502);assert.ok(p.speed<=CAR.maxSpeed);}
  p={...p,x:400,y:600,speed:CAR.maxSpeed};const heading=lobbyMove(p,0,1,tiles).heading;assert.ok(heading>0&&heading<Math.PI/2);
  for(let i=0;i<60;i++)p={...p,...lobbyMove(p,0,0,tiles)};assert.equal(p.speed,0);
  let car={x:400,y:900,driving:true,speed:CAR.maxSpeed,heading:0};for(let i=0;i<50;i++)car={...car,...lobbyMove(car,1,0)};assert.ok(Math.abs(car.x-400-WORLD.speed*3)<.001);
});
test('remote driving follows vehicle speed, caps extrapolation and resets on mode changes',()=>{
  const p={x:400,y:500,ack:0,epoch:0,connected:true,driving:true};const motion=new RemoteMotion(p,0);
  motion.update({...p,x:431.2,ack:5},100);assert.ok(motion.velocity.x>WORLD.speed);assert.ok(motion.velocity.x<=CAR.maxSpeed);
  for(let now=110;now<500;now+=10)assert.ok(motion.sample(now).x<=431.2+CAR.maxSpeed*.06+.001);
  motion.update({...p,x:450,ack:6,epoch:1,driving:false},510);assert.deepEqual(motion.sample(510),{x:450,y:500});
});
