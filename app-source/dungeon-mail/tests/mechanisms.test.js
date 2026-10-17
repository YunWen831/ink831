import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createParkourState,stepParkour,respawn,STEP,BODY,intersects} from '../../../courtyard/parkour-physics.js';
import {platformAt} from '../../../courtyard/parkour-mechanics.js';
import {packState,unpackState} from '../../../courtyard/parkour-state.js';
import {emptyMap,canonicalMap,mapLevel,composeMaps,MAP_COLS,MAP_SIZE} from '../../../courtyard/parkour-map.js';
import {copySelection,pasteSelection} from '../../../courtyard/map-edit.js';
import {MECHANISM_LEVEL} from '../../../courtyard/parkour-level.js';
const rect=(x,y,w=24,h=24)=>({x,y,w,h});
const level=()=>({width:1200,height:720,solids:[rect(0,640,1200,80)],hazards:[],crystals:[],checkpoints:[{x:100,y:616}],goal:rect(1100,590,30,50)});
function tick(s,l,input={},n=1){for(let i=0;i<n;i++)stepParkour(s,{...input,jumpPressed:i===0&&input.jumpPressed,dashPressed:i===0&&input.dashPressed},STEP,l);}
test('spring bounces on top contact, refills a dash, and never bounces from a side or underside',()=>{
  const l=level();l.springs=[rect(100,600,24,8)];const s=createParkourState(l);s.y=570;s.vy=240;s.dash=0;
  tick(s,l,{},3);assert.ok(s.vy<-600);assert.equal(s.dash,1);assert.equal(s.grounded,false);const start=s.y;tick(s,l,{},20);assert.ok(s.y<start-65,'automatic boost survives released jump');
  const side=createParkourState(l);side.x=82;side.y=595;tick(side,l,{x:1,dashPressed:true});assert.equal(side.x,84);assert.ok(side.vy>=0);
  const below=createParkourState(l);below.y=610;below.vy=-300;tick(below,l,{jumpHeld:true},3);assert.ok(below.vy>=0);
});
test('one-way platforms pass upwards, catch downward motion and support down+jump without a coyote jump',()=>{
  const l=level();l.oneways=[rect(100,580,72,6)];const s=createParkourState(l);tick(s,l,{jumpPressed:true,jumpHeld:true},32);assert.ok(s.y+BODY.h<580,'jump passes through bottom');
  tick(s,l,{},70);assert.equal(s.y,556);assert.ok(s.grounded);tick(s,l,{y:1,jumpPressed:true,jumpHeld:true});assert.ok(s.vy>0);assert.ok(s.dropTime>0);tick(s,l,{},50);assert.equal(s.y,616);
  const side=createParkourState(l);side.y=570;side.x=80;tick(side,l,{x:1,dashPressed:true},10);assert.ok(side.x>110,'edges do not act as walls');
});
test('horizontal and vertical movers carry riders, permit jumping off, and reset safely after death',()=>{
  for(const axis of ['x','y']){
    const l=level();l.movers=[{...rect(100,550,48,8),axis}];const s=createParkourState(l);s.x=110;s.y=526;
    tick(s,l,{},60);const p=platformAt(l.movers[0],s.mechanismTime);assert.ok(Math.abs(s.y+BODY.h-p.y)<.01);assert.ok(Math.abs(s.x-(axis==='x'?110+p.x-100:110))<.02);assert.ok(s.grounded);
    tick(s,l,{jumpPressed:true,jumpHeld:true});assert.ok(s.vy<0);respawn(s,l);assert.equal(s.mechanismTime,0);assert.deepEqual(s.crumbles,[]);
  }
  const l=level();l.movers=[{...rect(100,550,48,8),axis:'x'}];l.solids.push(rect(145,480,24,70));const s=createParkourState(l);s.x=127;s.y=526;tick(s,l,{},60);assert.ok(s.x<=129);assert.equal(s.deaths,0,'carrier cannot push through wall');
});
test('crumble platforms collapse after a warning, restore on a timer and remain independent per racer',()=>{
  const l=level();l.crumbles=[rect(100,560,72,24)];const a=createParkourState(l),b=createParkourState(l);a.y=b.y=536;
  tick(a,l);assert.equal(a.crumbles[0],3);tick(a,l,{},35);assert.equal(a.y,536);tick(a,l,{},25);assert.ok(a.y>536);assert.deepEqual(b.crumbles,[]);
  tick(a,l,{},310);assert.equal(a.crumbles[0],0);b.y=530;b.vy=100;tick(b,l,{},10);assert.equal(b.y,536);assert.ok(b.crumbles[0]>0);
});
test('touch switches open only their course doors for four seconds; closing cannot trap a player',()=>{
  const l=level();l.switches=[{...rect(100,616),group:0}];l.doors=[{...rect(300,592,24,48),group:0},{...rect(500,592,24,48),group:1}];
  const a=createParkourState(l),b=createParkourState(l);tick(a,l);assert.equal(a.doors[0],4);assert.deepEqual(b.doors,[]);assert.equal(a.doors[1],undefined);
  a.x=290;tick(a,l,{x:1,dashPressed:true},9);assert.ok(a.x>324,'open door is passable');a.x=480;tick(a,l,{x:1,dashPressed:true},9);assert.equal(a.x,484,'other segment stays closed');
  a.x=303;a.y=610;a.doors[0]=STEP/2;l.checkpoints[0].x=200;tick(a,l);assert.equal(a.deaths,1,'closing door respawns instead of trapping');tick(a,l,{},24);assert.ok(a.mechanismTime<.03);assert.deepEqual(a.doors,[]);
});
test('four wind directions affect actual movement without multiplying force for painted adjacent cells',()=>{
  for(const [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1]]){
    const l=level();l.winds=[{...rect(0,0,1000,640),dx,dy}];const s=createParkourState(l);s.x=400;s.y=400;
    tick(s,l,{jumpHeld:true},30);if(dx)assert.ok(s.vx*dx>140);if(dy===-1)assert.ok(s.y<390);if(dy===1)assert.ok(s.y>480);
  }
});
test('new map kinds stay bounded, survive copy/paste, and keep independent switch groups across seams',()=>{
  const raw=Array.from(emptyMap());for(const [i,kind] of [...'4567e89abcd'].entries())raw[15*48+6+i]=kind;
  const cells=canonicalMap(raw.join('')),l=mapLevel(cells);assert.equal(l.springs.length,1);assert.equal(l.movers.length,2);assert.equal(l.winds.length,4);
  const stamp=copySelection(cells,{left:6,right:16,top:15,bottom:15});const copied=pasteSelection(cells,stamp,20,10);assert.equal(copied.slice(10*48+20,10*48+31),'4567e89abcd');
  const course=composeMaps([{cells,name:'甲'},{cells,name:'乙'}]);assert.deepEqual(course.doors.map(r=>r.group),[0,1]);assert.deepEqual(course.switches.map(r=>r.group),[0,1]);assert.equal(course.movers[2].x,l.movers[0].x+1152);
  for(const [kind,max] of [['6',12],['e',12],['7',48],['8',12],['9',48],['c',64]])assert.equal([...canonicalMap(kind.repeat(MAP_SIZE))].filter(c=>c===kind).length,max);
  assert.throws(()=>canonicalMap('f'.repeat(MAP_SIZE)));assert.equal(canonicalMap(emptyMap()),canonicalMap(canonicalMap(emptyMap())));
});
test('sparse mechanism snapshots replay the same inputs and checkpoint reset prevents phase carryover',()=>{
  const l=level();Object.assign(l,{movers:[{...rect(100,550,72,8),axis:'x'}],crumbles:[rect(300,570)],switches:[{...rect(115,526),group:0}],doors:[{...rect(500,580),group:0}],winds:[{...rect(200,300,80,200),dx:1,dy:0}]});
  const server=createParkourState(l);server.y=526;tick(server,l,{},15);server.crumbles[191]=2.7;
  const packed=packState(server);assert.equal('crumbles' in packed,false);assert.equal(packed.crumbleCharges.length,1);assert.ok(JSON.stringify(packed).length<850);
  const client=unpackState(structuredClone(packed));for(let i=0;i<120;i++){
    const input={x:1,jumpPressed:i===30,jumpHeld:i<50,dashPressed:i===70};stepParkour(server,input,STEP,l);stepParkour(client,input,STEP,structuredClone(l));
    assert.ok(Math.abs(server.x-client.x)<.03&&Math.abs(server.y-client.y)<.03,'prediction remains deterministic');
  }
  l.checkpoints.push({x:700,y:616,trigger:rect(690,580,50,60)});server.x=700;server.y=616;server.vx=server.vy=0;server.doors[0]=3;tick(server,l);assert.equal(server.checkpoint,1);assert.equal(server.mechanismTime,0);assert.deepEqual(server.doors,[]);
});
test('mechanism practice checkpoints are safe and its full route clears using actual inputs',()=>{
  const l=MECHANISM_LEVEL;
  for(let i=0;i<l.checkpoints.length;i++){const s=createParkourState(l,i);tick(s,l,{},30);assert.equal(s.deaths,0);assert.equal(s.y,l.checkpoints[i].y);}
  const s=createParkourState(l);for(let frame=0;frame<3000&&!s.finished;frame++)tick(s,l,{x:1,jumpPressed:s.grounded&&s.x>175&&s.x<225,jumpHeld:true});
  assert.ok(s.finished,JSON.stringify(s));assert.equal(s.deaths,0);assert.equal(s.checkpoint,5);
});
test('moving platform tracks never enter the reserved seam/spawn columns',()=>{
  const raw=Array.from(emptyMap());for(const c of [4,5,42,43])raw[14*48+c]='6';const l=mapLevel(raw.join(''));
  for(const mover of l.movers)for(const time of [0,1,2,3,4]){const p=platformAt(mover,time);assert.ok(p.x>=96);assert.ok(p.x+p.w<=1056);}
});
test('snapshot rounding does not change crumble/door boundary collisions during prediction',()=>{
  for(const timer of [2.6+STEP,STEP,4-STEP]){
    const l=level();l.crumbles=[rect(100,560,72,24)];l.doors=[{...rect(300,592,24,48),group:0}];
    const a=createParkourState(l);a.x=timer===STEP?303:110;a.y=timer===STEP?610:536;a.crumbles[0]=timer+1e-12;a.doors[0]=timer+1e-12;
    const b=unpackState(packState(a));tick(a,l);tick(b,structuredClone(l));assert.equal(a.dead,b.dead);assert.equal(a.grounded,b.grounded);assert.ok(Math.abs(a.y-b.y)<.001);
  }
});
