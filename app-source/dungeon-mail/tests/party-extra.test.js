import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PartyMatch} from '../party-match.js';
import {partySchedule,PARTY_GAMES,EXTRA_GAMES} from '../../../courtyard/party-rules.js';
const members=Array.from({length:4},(_,i)=>({id:'p'+i,name:'玩家'+i,color:'#709bbb'}));
function game(mode,n=2,options={}){let seed=123;return new PartyMatch(members.slice(0,n),{mode,random:()=>((seed=seed*16807%2147483647)/2147483647),...options});}
function advance(g,seconds){for(let t=0;t<seconds;t+=.05)g.tick(Math.min(.05,seconds-t));}
function start(g){advance(g,5.1);assert.equal(g.phase,'playing');}
function input(g,index,extra={}){const p=g.players[index];return g.input(p.id,{id:g.id,round:g.round,turn:g.turn,seq:p.seq+1,x:0,y:0,...extra});}
test('nine-game shuffle chooses five distinct entries and every new game completes for two, three and four players',()=>{
  assert.equal(Object.keys(PARTY_GAMES).length,9);for(let i=0;i<20;i++){const list=partySchedule();assert.equal(list.length,5);assert.equal(new Set(list).size,5);}
  for(const mode of EXTRA_GAMES)for(const count of [2,3,4]){const g=game(mode,count);advance(g,90);assert.equal(g.phase,'final',mode);assert.equal(g.history.length,1);assert.ok(g.players.every(p=>Number.isFinite(p.value)&&p.value>=0));assert.ok(g.players.every(p=>p.total>=2&&p.total<=10));assert.ok(JSON.stringify(g.snapshot()).length<18000);}
});
test('floor construction is quota-limited, match-local and shared, then stars and warp/boost effects apply to everyone',()=>{
  const g=game('floor');start(g);const p=g.players[0];
  for(let i=0;i<8;i++){p.x=128+i*64;p.y=108;input(g,0,{action:false});g.tick(.1);input(g,0,{action:true,tileType:'warp'});g.tick(.1);advance(g,.3);}assert.equal(p.tileCount,6);assert.equal(g.extra.tiles.length,6);
  advance(g,12);const other=g.players[1];Object.assign(other,{x:128,y:108,tileUntil:0});g.tick(.05);assert.ok(other.x>700);assert.ok(other.tileUntil>0);
  const star=g.extra.stars[0];Object.assign(p,{x:star.x,y:star.y,tileUntil:2});g.extra.tiles=[];g.tick(.05);assert.equal(p.value,1);assert.equal(p.stats.stars,1);
  input(g,0,{action:true});g.tick(.05);assert.equal(g.extra.tiles.length,0);assert.equal(g.history.length,0);
});
test('wish decisions stay private until reveal and arithmetic precedes ordered swaps',()=>{
  const g=game('wish');start(g);g.players[0].value=8;g.players[1].value=2;input(g,0,{choice:'gift'});input(g,1,{choice:'swap',target:'p0'});input(g,1,{choice:'gift'});
  const visible=JSON.stringify(g.snapshot());assert.ok(!visible.includes('extraChoice'));assert.equal(g.extra.reveal.length,0);assert.equal(g.privateState('p1',{id:g.id,round:0,turn:0}).choice,'swap');assert.equal(g.privateState('outsider',{id:g.id,round:0,turn:0}),null);
  advance(g,5);assert.deepEqual(g.players.map(p=>p.value),[2,11]);assert.equal(g.extra.reveal.length,2);const values=g.players.map(p=>p.value);advance(g,1);assert.deepEqual(g.players.map(p=>p.value),values);advance(g,2.1);assert.equal(g.turn,1);assert.equal(g.extra.reveal.length,0);assert.equal(g.players[0].extraChoice,'');assert.equal(input(g,0,{turn:0,choice:'gift'}),true);assert.equal(g.players[0].extraChoice,'');
  const harmony=game('wish');start(harmony);input(harmony,0,{choice:'harmony'});input(harmony,1,{choice:'harmony'});advance(harmony,5);assert.deepEqual(harmony.players.map(p=>p.value),[5,5]);
});
test('remote control rotates, rejects another player, affects the owner too and lasts only five seconds',()=>{
  const g=game('remote');start(g);assert.equal(g.extra.controller,'p0');input(g,1,{choice:'giant'});assert.equal(g.extra.power,'');input(g,0,{choice:'giant'});assert.equal(g.extra.power,'giant');input(g,0,{choice:'shuffle'});assert.equal(g.extra.power,'giant');advance(g,5.1);assert.equal(g.extra.power,'');advance(g,4);assert.equal(g.extra.controller,'p1');assert.equal(g.extra.used,false);const before=g.players.map(p=>({x:p.x,y:p.y}));input(g,1,{choice:'shuffle'});assert.equal(g.players[0].x,before[1].x);assert.equal(g.players[1].x,before[0].x);assert.equal(g.players[1].stats.powers,1);
});
test('button clues and choices are private, correct effects reveal after the deadline and reconnect retrieves the same clue',()=>{
  const g=game('buttons',4);start(g);const request={id:g.id,round:0,turn:0},one=g.privateState('p0',request),two=g.privateState('p1',request);assert.notEqual(one.clue.button,two.clue.button);assert.equal(new Set(g.players.map(p=>JSON.stringify(p.privateClue))).size,4);assert.notEqual(g.players[3].privateClue.effect,g.secretButtons[g.players[3].privateClue.button]);assert.deepEqual(g.privateState('p0',request),one);assert.equal(g.snapshot().extra.effects,undefined);assert.equal(g.snapshot().extra.reveal.length,0);
  g.secretButtons=['gift','team','trap'];input(g,0,{choice:'0'});input(g,1,{choice:'1'});input(g,2,{choice:'2'});input(g,3,{choice:'9'});advance(g,5);assert.deepEqual(g.players.map(p=>p.value),[6,2,0,2]);assert.deepEqual(g.snapshot().extra.effects,['gift','team','trap']);advance(g,3.1);assert.equal(g.snapshot().extra.effects,undefined);assert.equal(g.privateState('p0',request),null);
});
test('follow requires an exact count for two to four people and discloses decisions only at reveal',()=>{
  for(const n of [2,3,4]){const g=game('follow',n);start(g);g.extra.required=n-1;for(let i=0;i<n;i++)input(g,i,{choice:i<n-1?'do':'hold'});assert.equal(g.snapshot().extra.reveal.length,0);advance(g,5);assert.deepEqual(g.players.map(p=>p.value),Array.from({length:n},(_,i)=>i<n-1?4:1));}
  const miss=game('follow');start(miss);miss.extra.required=1;input(miss,0,{choice:'do'});input(miss,1,{choice:'do'});advance(miss,5);assert.deepEqual(miss.players.map(p=>p.value),[0,0]);
});
