import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createParkourState,stepParkour,STEP,BODY,intersects} from '../../../courtyard/parkour-physics.js';
import {PRACTICE_LEVEL} from '../../../courtyard/parkour-level.js';
const flat=()=>({width:1200,height:720,solids:[{x:0,y:640,w:1200,h:80}],hazards:[],crystals:[],checkpoints:[{x:100,y:616}],goal:{x:1100,y:590,w:30,h:50}});
function tick(s,l,input={},n=1){for(let i=0;i<n;i++)stepParkour(s,{...input,jumpPressed:i===0&&input.jumpPressed,dashPressed:i===0&&input.dashPressed},STEP,l);}
test('holding jump changes height; buffered landing and coyote time forgive small timing errors',()=>{
  const l=flat(),a=createParkourState(l),b=createParkourState(l);
  let minA=a.y,minB=b.y;
  for(let i=0;i<70;i++){tick(a,l,{jumpPressed:i===0,jumpHeld:true});tick(b,l,{jumpPressed:i===0,jumpHeld:i<4});minA=Math.min(minA,a.y);minB=Math.min(minB,b.y);}
  assert.ok(minA<minB-25);assert.equal(a.y,616);
  const c=createParkourState(l);c.y=607;c.vy=200;tick(c,l,{jumpPressed:true,jumpHeld:true});tick(c,l,{jumpHeld:true},8);assert.ok(c.vy<0,'buffered jump fires after landing');
  const ledge=flat();ledge.solids[0].w=130;const d=createParkourState(ledge);d.x=127;tick(d,ledge,{x:1},15);assert.ok(!d.grounded&&d.coyote>0);tick(d,ledge,{x:1,jumpPressed:true,jumpHeld:true});assert.ok(d.vy<0);
});
test('eight direction dash consumes one charge until landing; walls stop fast motion and allow wall jumps',()=>{
  const l=flat(),s=createParkourState(l);s.y=400;
  tick(s,l,{x:1,y:-1,dashPressed:true,jumpHeld:true},8);assert.equal(s.dash,0);assert.ok(s.vx>0&&s.vy<0);const old=s.dashTime;
  tick(s,l,{x:-1,dashPressed:true,jumpHeld:true});assert.ok(s.dashTime<old);assert.ok(s.vx>0);
  tick(s,l,{},160);assert.equal(s.dash,1);
  l.solids.push({x:200,y:300,w:24,h:340});const w=createParkourState(l);w.x=170;w.y=450;tick(w,l,{x:1,dashPressed:true},20);assert.equal(w.x,200-BODY.w);assert.equal(w.vx,0);
  tick(w,l,{x:1,jumpPressed:true,jumpHeld:true});assert.ok(w.vx<0&&w.vy<0,'wall jump kicks away');assert.equal(w.dash,0);
});
test('hazards respawn quickly, crystals refill once per cooldown, checkpoints and finish work',()=>{
  const l=flat(),s=createParkourState(l);l.hazards=[{x:200,y:620,w:20,h:20}];s.x=200;tick(s,l);assert.equal(s.deaths,1);tick(s,l,{},24);assert.equal(s.dead,0);assert.equal(s.deaths,1);assert.equal(s.x,100);
  l.hazards=[];l.crystals=[{x:108,y:620}];s.dash=0;tick(s,l);assert.equal(s.dash,1);s.dash=0;s.y=605;tick(s,l);assert.equal(s.dash,0,'a depleted crystal cannot refill again');
  l.checkpoints.push({x:400,y:616,trigger:{x:390,y:580,w:50,h:60}});s.x=400;s.y=616;tick(s,l);assert.equal(s.checkpoint,1);s.x=1100;tick(s,l);assert.equal(s.finished,true);const time=s.time;tick(s,l,{},100);assert.equal(s.time,time);
});
test('every practice checkpoint spawns in free space with safe ground',()=>{
  for(let i=0;i<PRACTICE_LEVEL.checkpoints.length;i++){
    const s=createParkourState(PRACTICE_LEVEL,i);assert.ok(!PRACTICE_LEVEL.solids.some(r=>intersects({...s,...BODY},r)));tick(s,PRACTICE_LEVEL,{},30);assert.equal(s.deaths,0);assert.equal(s.y,PRACTICE_LEVEL.checkpoints[i].y);
  }
});
test('the complete practice course can be cleared using movement inputs alone',()=>{
  const l=PRACTICE_LEVEL,s=createParkourState(l);
  const run=(input,n=1)=>tick(s,l,input,n);
  const until=(check,input={})=>{let frames=0;while(!check(s)&&frames++<1000)run(input);assert.ok(frames<1000,'route made progress');assert.equal(s.deaths,0);};
  until(s=>s.x>110,{x:1});run({x:1,jumpPressed:true,jumpHeld:true});until(s=>s.x>260,{x:1,jumpHeld:true});
  until(s=>s.x>278,{x:1});run({x:1,jumpPressed:true,jumpHeld:true});until(s=>s.x>410,{x:1,jumpHeld:true});
  until(s=>s.x>=888,{x:1});run({x:1,jumpPressed:true,jumpHeld:true});until(s=>s.x<=809,{x:-1,jumpHeld:true});
  for(let i=0;i<7;i++){
    run({x:-1,jumpPressed:true,jumpHeld:true});until(s=>s.x>=888||s.y<372,{x:1,jumpHeld:true});if(s.y<372)break;
    run({x:1,jumpPressed:true,jumpHeld:true});until(s=>s.x<=809,{x:-1,jumpHeld:true});
  }
  run({x:1,dashPressed:true,jumpHeld:true});until(s=>s.x>1010,{x:1,jumpHeld:true});
  const launch=()=>{run({x:1,jumpPressed:true,jumpHeld:true});run({x:1,jumpHeld:true},18);};
  until(s=>s.x>1220,{x:1});launch();run({x:1,dashPressed:true,jumpHeld:true});until(s=>s.x>=1400,{x:1,jumpHeld:true});until(s=>s.grounded);
  until(s=>s.x>1470,{x:1});launch();run({x:1,dashPressed:true,jumpHeld:true});until(s=>s.x>1570,{x:1,jumpHeld:true});
  run({x:1,dashPressed:true,jumpHeld:true});until(s=>s.x>1700,{x:1,jumpHeld:true});until(s=>s.grounded);
  until(s=>s.x>1915,{x:1});launch();run({x:1,dashPressed:true,jumpHeld:true});until(s=>s.x>2120,{x:1,jumpHeld:true});until(s=>s.grounded);
  until(s=>s.x>2180,{x:1});launch();run({x:1,y:-1,dashPressed:true,jumpHeld:true});until(s=>s.x>2255,{x:1,jumpHeld:true});
  run({x:1,dashPressed:true,jumpHeld:true});until(s=>s.x>2340,{x:1,jumpHeld:true});until(s=>s.grounded);
  until(s=>s.x>2475,{x:1});run({x:1,jumpPressed:true,jumpHeld:true});until(s=>s.x>2580,{x:1,jumpHeld:true});until(s=>s.finished,{x:1});
  assert.equal(s.checkpoint,l.checkpoints.length-1);assert.ok(s.time<20);
});
