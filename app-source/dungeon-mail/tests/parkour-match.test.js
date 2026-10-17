import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ParkourMatch} from '../parkour-match.js';
import {emptyMap,canonicalMap,mapLevel,composeMaps,MAP_SIZE,MAP_COLS,MAP_WIDTH} from '../../../courtyard/parkour-map.js';
import {STEP,intersects,BODY} from '../../../courtyard/parkour-physics.js';
import {mechanismMap} from './fixtures/mechanism-map.js';
function harness(count=2){
  let now=1000;const messages=[];
  const match=new ParkourMatch(Array.from({length:count},(_,i)=>({id:String(i),name:'作者'+i,color:'#c87768'})),{now:()=>now,clock:()=>now,send:(id,type,data)=>messages.push({id,type,data:structuredClone(data)})});
  const seq=new Map();
  const drive=(frames,ids=[...match.drafts.keys()])=>{for(let i=0;i<frames;i++){now+=STEP*1000;for(const id of ids){const run=match.sessions.get(id);if(!run||run.state.finished)continue;const key=id+run.id,n=(seq.get(key)||0)+1;seq.set(key,n);match.input(id,{id:run.id,frames:[[n,1,0,0]]});}match.tick();}};
  return {match,messages,drive,advance(ms){now+=ms;match.tick();}};
}
test('editor rejects malformed maps, protects connectors, caps crystals and composes safe seams',()=>{
  assert.throws(()=>canonicalMap('1'.repeat(MAP_SIZE-1)));assert.throws(()=>canonicalMap('x'.repeat(MAP_SIZE)));
  const cells=canonicalMap('3'.repeat(MAP_SIZE));assert.ok([...cells].filter(c=>c==='3').length<=32);
  const a=mapLevel(cells);assert.equal(a.solids.some(r=>intersects({x:48,y:504,...BODY},r)),false);
  const course=composeMaps([{cells:emptyMap(),name:'甲'},{cells:emptyMap(),name:'乙'}]);assert.equal(course.width,MAP_WIDTH*2);assert.equal(course.checkpoints.length,2);assert.equal(course.goal.x,1080+MAP_WIDTH);
  assert.ok(course.solids.some(r=>r.x+r.w===MAP_WIDTH&&r.y===528));assert.ok(course.solids.some(r=>r.x===MAP_WIDTH&&r.y===528));
});
test('each author must actually finish the current revision; edits invalidate verification and other drafts stay private',()=>{
  const {match:m,messages,drive}=harness();
  m.open('0');assert.equal(messages.at(-2).data.cells,canonicalMap(emptyMap()));assert.equal(messages.at(-1).data.players.some(p=>'cells' in p),false);
  assert.equal(m.launch(()=>true),false);assert.equal(m.verify('0',999),false);assert.equal(m.verify('0',0),true);
  drive(670,['0']);assert.equal(m.drafts.get('0').verified,true);assert.equal(m.drafts.get('1').verified,false);assert.equal(m.launch(()=>true),false);
  m.open('0');assert.equal(messages.filter(m=>m.type==='parkour:run').at(-1).data.verified,true,'reloading a completed verification preserves its status');
  m.invalidate('0');assert.equal(m.drafts.get('0').verified,false,'the first brush stroke revokes the old proof before the map upload is debounced');
  const edited=Array.from(emptyMap());edited[10*MAP_COLS+12]='1';m.edit('0',edited.join(''));assert.equal(m.drafts.get('0').verified,false);assert.equal(m.verify('0',0),false);
  m.verify('0',1);m.verify('1',0);drive(670);assert.ok([...m.drafts.values()].every(d=>d.verified));assert.equal(m.canLaunch(id=>id!=='1'),false);
});
test('two to four players race the frozen concatenated course and receive server results',()=>{
  for(const count of [2,3,4]){
    const {match:m,drive,advance}=harness(count);for(const id of m.drafts.keys())m.verify(id,0);drive(670);assert.ok(m.launch(()=>true));assert.equal(m.phase,'countdown');assert.equal(m.level.width,MAP_WIDTH*count);
    const frozen=m.level;assert.equal(m.edit('0',emptyMap()),false);advance(3100);assert.equal(m.phase,'racing');drive(count*720);
    assert.equal(m.phase,'results');assert.equal(m.results.length,count);assert.ok(m.results.every(r=>r.time>count*4));assert.equal(m.level,frozen);assert.ok([...m.sessions.values()].every(r=>r.state.checkpoint===count-1));
    assert.ok(m.launch(()=>true),'same validated maps support a rematch');
  }
});
test('input floods cannot advance time; stale run IDs and invalid commands are ignored, idle physics still advances',()=>{
  const {match:m,advance}=harness();m.verify('0',0);const run=m.sessions.get('0'),x=run.state.x;
  for(let i=0;i<40;i++)m.input('0',{id:run.id,frames:Array.from({length:16},(_,j)=>[i*16+j+1,1,0,0])});
  m.tick();assert.equal(run.state.x,x);assert.ok(run.queue.length<=60);advance(10);assert.ok(run.state.x<x+4);
  const received=run.received;m.input('0',{id:'old',frames:[[received+1,1,0,0]]});m.input('0',{id:run.id,frames:[[received+1,1e9,0,0]]});assert.equal(run.received,received);
  run.queue=[];run.state.y=350;run.state.vy=100;advance(90);assert.ok(run.state.y>350);
  m.remove('1');assert.equal(m.canLaunch(()=>true),false);m.open('0');
});
test('race snapshots remain compact even for late-index crystal cooldowns',()=>{
  const {match:m,messages,drive}=harness(4);for(const id of m.drafts.keys())m.verify(id,0);drive(670);m.launch(()=>true);
  for(const run of m.sessions.values())run.state.crystals[127]=.7;m.snapshot();
  for(const message of messages.slice(-4)){assert.equal(message.type,'parkour:state');assert.ok(Buffer.byteLength(JSON.stringify(message.data))<1000);assert.deepEqual(message.data.state.crystalCharges,[[127,.7]]);}
});

test('saved maps load into private editors, new revisions invalidate proof, progress hides layouts, and next-round editing keeps courses',()=>{
  const {match:m,drive,advance}=harness();const saved={id:'saved-map',version:3,title:'云端地图',cells:canonicalMap(emptyMap()),verified:true};
  const original=m.drafts.get('0').documentId;assert.ok(m.load('0',saved));assert.notEqual(m.drafts.get('0').documentId,original);assert.equal(m.drafts.get('0').cloudVersion,3);assert.ok(m.drafts.get('0').verified);
  m.verify('1',0);drive(200,['1']);const status=m.status();assert.ok(status.players[1].progress>0);assert.equal('cells' in status.players[1],false);drive(500,['1']);assert.ok(m.launch(()=>true));advance(3100);drive(1500);assert.equal(m.phase,'results');
  const cells=m.drafts.get('0').cells;assert.ok(m.rebuild());assert.equal(m.phase,'building');assert.equal(m.drafts.get('0').cells,cells);assert.ok(m.drafts.get('0').verified);assert.equal(m.sessions.size,0);
  const edited=Array.from(cells);edited[10*48+8]='1';m.edit('0',edited.join(''));assert.equal(m.drafts.get('0').verified,false);
});
test('all new mechanisms survive authoritative validation, four-map racing, independent states and spectator snapshots',()=>{
  const {match:m,messages,drive,advance}=harness(4);for(const id of m.drafts.keys()){m.edit(id,mechanismMap());m.verify(id,1);}drive(1000);
  assert.ok([...m.drafts.values()].every(d=>d.verified));assert.ok([...m.sessions.values()].every(r=>r.state.deaths===0));assert.ok(m.launch(()=>true));advance(3100);
  const [a,b]=[...m.sessions.values()];assert.notEqual(a.state.crumbles,b.state.crumbles);a.state.doors[0]=3;assert.equal(b.state.doors[0],undefined);
  drive(3200);assert.equal(m.phase,'results');assert.equal(m.results.length,4);assert.ok(m.results.every(r=>r.deaths===0));
  a.state.finished=true;b.state.finished=false;b.state.crumbles[191]=2.2;b.state.doors[3]=2;m.snapshot();
  const view=messages.filter(message=>message.id==='0'&&message.type==='parkour:state').at(-1).data;
  const observed=view.mechanismPeers.find(([id])=>id==='1')[1];assert.deepEqual(observed.crumbleCharges.find(([index])=>index===191),[191,2.2]);assert.deepEqual(observed.doorCharges,[[3,2]]);assert.ok(observed.mechanismTime>=0);
});
