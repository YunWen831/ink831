import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PartyMatch} from '../party-match.js';
import {PARTY_GAMES,PARTY_BASES,partySchedule,roundPoints} from '../../../courtyard/party-rules.js';
const members=Array.from({length:4},(_,i)=>({id:'p'+i,name:'玩家'+i,color:'#709bbb'}));
function game(kind,n=2,options={}){const g=new PartyMatch(members.slice(0,n),{random:()=>.5,schedule:[kind,...Object.keys(PARTY_GAMES).filter(k=>k!==kind),kind],...options});return g;}
function advance(g,seconds){for(let t=0;t<seconds;t+=.05)g.tick(Math.min(.05,seconds-t));}
function start(g){advance(g,5.1);assert.equal(g.phase,'playing');}
function input(g,i,data={}){const p=g.players[i];return g.input(p.id,{id:g.id,round:g.round,seq:p.seq+1,x:0,y:0,...data});}
test('party schedule contains all four games, scores ties fairly, and completes exactly five rounds',()=>{
  const schedule=partySchedule(()=>.3);assert.equal(new Set(schedule.slice(0,4)).size,4);assert.equal(schedule.length,5);assert.ok(schedule.every((s,i)=>!i||s!==schedule[i-1]));assert.deepEqual(roundPoints([7,7,3,0]),[10,10,4,2]);
  for(const n of [2,3,4]){const g=game('bump',n);advance(g,480);assert.equal(g.phase,'final');assert.equal(g.history.length,5);const totals=g.players.map(p=>p.total);assert.ok(totals.every(v=>v>=10&&v<=50));advance(g,20);assert.deepEqual(g.players.map(p=>p.total),totals);assert.ok(JSON.stringify(g.snapshot()).length<10000);}
});
test('inputs cannot forge results, skip time, reuse a round, or move disconnected players',()=>{
  const g=game('delivery');assert.equal(input(g,0,{x:1}),false);start(g);const p=g.players[0],x=p.x;
  for(let seq=1;seq<300;seq++)g.input(p.id,{id:g.id,round:0,seq,x:1,y:0,total:9999});assert.equal(p.x,x);assert.equal(p.total,0);
  assert.equal(g.snapshot().players[0].ack,299);assert.equal(input(g,0,{x:Infinity}),false);assert.equal(input(g,0,{id:'other',x:1}),false);assert.equal(input(g,0,{round:4}),false);assert.equal(g.input('unknown',{id:g.id,round:0,seq:1,x:0,y:0}),false);
  advance(g,.1);assert.ok(p.x>x&&p.x-x<=23);advance(g,1);const stopped=p.x;advance(g,1);assert.equal(p.x,stopped);
});
test('bump falls award the recent opponent once and respawn promptly with a shield',()=>{
  const g=game('bump');start(g);const a=g.players[0],b=g.players[1];Object.assign(a,{x:800,y:300,hit:{id:b.id,at:g.time},shield:0});advance(g,.05);assert.equal(b.value,1);assert.ok(a.out>0);advance(g,1);assert.equal(b.value,1);advance(g,1.1);assert.ok(a.out<=0);assert.ok(a.shield>0);assert.ok(Math.hypot(a.x-480,a.y-300)<200);
});
test('delivery picks up one parcel per press, cashes only at the matching base, and allows stealing',()=>{
  const g=game('delivery');start(g);const a=g.players[0],b=g.players[1];Object.assign(a,{x:400,y:300});g.items=[{id:'parcel',x:a.x,y:a.y,value:3}];input(g,0,{action:true});advance(g,.05);assert.equal(a.carry?.value,3);advance(g,.15);assert.equal(a.carry?.value,3);
  Object.assign(a,{x:PARTY_BASES[1].x,y:PARTY_BASES[1].y});advance(g,.05);assert.equal(a.value,0);Object.assign(b,{x:a.x,y:a.y});input(g,1,{action:true});advance(g,.05);assert.equal(a.carry,null);assert.ok(g.items.some(i=>i.value===3));
  input(g,1,{action:false});advance(g,.3);input(g,1,{action:true});advance(g,.05);assert.equal(b.carry?.value,3);advance(g,.05);assert.equal(b.value,3);assert.equal(b.carry,null);
});
test('mining banks cash-outs, hides other decisions, and loses only unbanked treasure at a collapse',()=>{
  const g=game('mine',2,{random:()=>0});start(g);advance(g,5);assert.equal(g.minePot,3);input(g,0,{choice:'cash'});input(g,0,{choice:'dig'});assert.equal(g.players[0].choice,'cash');assert.equal('choice' in g.snapshot().players[0],false);advance(g,5);assert.equal(g.players[0].value,3);assert.ok(g.players[0].cashed);advance(g,5);assert.equal(g.phase,'results');assert.equal(g.players[1].value,0);assert.ok(g.players[0].points>g.players[1].points);
});
test('rescue requires boards and sustained repair, replenishes supplies, pumps water, and awards the team equally',()=>{
  const g=game('rescue');start(g);const p=g.players[0],leak=g.leaks[0];Object.assign(p,{x:leak.x,y:leak.y});input(g,0,{action:true});for(let i=0;i<16;i++){input(g,0,{action:true});g.tick(.1);}assert.ok(!g.leaks.includes(leak));assert.equal(p.boards,1);
  Object.assign(p,{x:300,y:520});g.tick(.1);assert.equal(p.boards,2);g.water=70;Object.assign(p,{x:650,y:520,cool:0});input(g,0,{action:true});g.tick(.1);assert.ok(g.water<62);g.left=.01;g.tick(.1);assert.equal(g.phase,'results');assert.deepEqual(g.players.map(p=>p.points),[10,10]);
  const failure=game('rescue');start(failure);failure.water=100;failure.tick(.1);assert.deepEqual(failure.players.map(p=>p.points),[4,4]);
});
test('a disconnected party pauses without consuming round time and finishes after the grace period',()=>{
  let online=true;const g=game('delivery',2,{connected:id=>id==='p0'||online});start(g);const left=g.left;online=false;advance(g,4);assert.equal(g.left,left);assert.ok(g.snapshot().paused);online=true;advance(g,.1);assert.equal(g.pause,0);online=false;advance(g,15.1);assert.equal(g.phase,'final');assert.match(g.reason,/在线不足/);assert.equal(g.history.length,0);
});
