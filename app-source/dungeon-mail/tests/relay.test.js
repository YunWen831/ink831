import test from 'node:test';
import assert from 'node:assert/strict';
import {RelayMatch} from '../relay-match.js';
import {TextUpload,relayKind} from '../../../courtyard/relay-rules.js';
const members=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'玩家'+i,color:'#ff0000'}));
for(const mode of ['relay','story'])for(const n of [2,3,4,5,17,18])test(`${mode} ${n} players: private rotation, sealed pages and full reveal`,()=>{
  let now=0;const match=new RelayMatch(members(n),{mode,now:()=>now,send(){}});
  const expected=match.steps;
  for(let step=0;step<expected;step++){
    assert.equal(match.phase,'writing');
    for(const p of match.members){
      const view=match.snapshot(p.id);assert.equal(view.books,undefined);assert.equal(view.previous.length,mode==='story'?step:Math.min(step,1));
      if(step)assert.notEqual(view.previous.at(-1).author,p.id);
      const value=relayKind(mode,step)==='text'?`${p.id} ${step}`:[['#ff0000',5,[10,10,20,20]]];
      assert.equal(match.save(p.id,{id:match.id,step,revision:1,value}),true);
      assert.equal(match.save('outsider',{id:match.id,step,revision:1,value}),false);
      assert.equal(match.submit(p.id,{id:match.id,step,revision:1}),true);
      if(match.step===step)assert.equal(match.save(p.id,{id:match.id,step,revision:2,value}),false);
    }
  }
  assert.equal(match.phase,'final');const final=match.snapshot('p0');assert.equal(final.books.length,n);for(const book of final.books){assert.equal(book.pages.length,expected);assert.ok(book.pages.every(p=>p.value===undefined));}assert.equal(match.snapshot('outsider'),null);
  assert.equal(match.page('outsider',{id:match.id,book:0,page:0}),null);assert.equal(match.page('p0',{id:'stale',book:0,page:0}),null);assert.ok(match.page('p0',{id:match.id,book:0,page:0}).value.value.length);
});
test('relay rejects nineteenth player and never reveals book pages while writing',()=>{assert.throws(()=>new RelayMatch(members(19),{mode:'relay',send(){}}));const match=new RelayMatch(members(18),{mode:'story',send(){}});assert.equal(match.page('p0',{id:match.id,book:0,page:0}),null);assert.equal(match.steps,18);});
test('relay deadlines keep draft, reject stale requests and finish after departure',()=>{
  let now=0;const gone=new Set();const m=new RelayMatch(members(3),{mode:'relay',now:()=>now,connected:id=>!gone.has(id),send(){}});
  m.save('p0',{id:m.id,step:0,revision:2,value:'草稿'});assert.equal(m.save('p0',{id:m.id,step:0,revision:1,value:'旧稿'}),false);
  now=61000;m.tick();assert.equal(m.step,1);assert.equal(m.books[0].pages[0].value,'草稿');assert.equal(m.books[0].pages[0].skipped,true);
  assert.equal(m.save('p0',{id:m.id,step:0,revision:3,value:'迟到'}),false);gone.add('p2');
  for(let i=0;i<10&&m.phase!=='final';i++){now+=91000;m.tick();}assert.equal(m.phase,'final');
});
test('bounded uploads reject malformed chunks and expire',()=>{
  let now=0;const u=new TextUpload(4,100,()=>now);u.append(0,'ab');assert.throws(()=>u.append(0,'cd'));u.append(1,'cd');assert.equal(u.finish(),'abcd');now=31000;assert.throws(()=>u.finish());assert.throws(()=>new TextUpload(1000000));
});
