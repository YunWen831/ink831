import test from 'node:test';
import assert from 'node:assert/strict';
import {relayOrder} from '../relay-order.js';
import {RelayMatch} from '../relay-match.js';
import {relaySteps,validDrawing} from '../../../courtyard/relay-rules.js';
import {fillPixels} from '../../../courtyard/relay-paint.js';

for(const mode of ['relay','story'])test(`${mode} randomized routes are fair and never return a book to its previous author`,()=>{
  for(let n=2;n<=18;n++)for(let seed=1;seed<=20;seed++){
    let value=seed;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;},steps=relaySteps(mode,n),rows=relayOrder(n,steps,random);
    for(let step=0;step<steps;step++){assert.equal(new Set(rows[step]).size,n);for(let seat=0;seat<n;seat++){if(step)assert.notEqual(rows[step][seat],rows[step-1][seat]);const circuit=rows.slice(Math.floor(step/n)*n,step+1).map(row=>row[seat]);assert.equal(new Set(circuit).size,circuit.length);}}
    assert.deepEqual(rows[0],Array.from({length:n},(_,i)=>i));
  }
  const routes=new Set(Array.from({length:20},()=>JSON.stringify(relayOrder(4,4))));assert.ok(routes.size>1);
});

test('fill stays inside connected boundaries, respects transparency, and handles edges',()=>{
 const width=5,pixels=new Uint8ClampedArray(5*5*4).fill(255);
 for(let y=0;y<5;y++)pixels.set([0,0,0,255],(y*5+2)*4);
 assert.equal(fillPixels(pixels,5,5,0,0,'#ff0000'),true);assert.deepEqual([...pixels.slice(0,4)],[255,0,0,255]);assert.deepEqual([...pixels.slice(12,16)],[255,255,255,255]);assert.deepEqual([...pixels.slice(8,12)],[0,0,0,255]);
 assert.equal(fillPixels(pixels,5,5,0,0,'#ff0000'),false);fillPixels(pixels,5,5,5,5,'#0000ff');assert.deepEqual([...pixels.slice(-4)],[0,0,255,255]);
 const alpha=new Uint8ClampedArray([255,255,255,0,255,255,255,255]);fillPixels(alpha,2,1,0,0,'#00ff00');assert.deepEqual([...alpha],[0,255,0,255,255,255,255,255]);
});

test('fill commands validate and round-trip through real relay drafts and sealed pages',()=>{
 const fill=['#ff0000','fill',[100,200]],stroke=['#000000',5,[0,0,20,20]];
 assert.equal(validDrawing([stroke,fill]),true);for(const invalid of [[['#ff0000','fill',[0,0,1,1]]],[['#ff0000','fill',[641,0]]],Array(33).fill(fill)])assert.equal(validDrawing(invalid),false);
 const m=new RelayMatch([{id:'a'},{id:'b'}],{mode:'relay',send(){}});m.advance();for(const id of ['a','b']){assert.equal(m.save(id,{id:m.id,step:1,revision:1,value:[stroke,fill]}),true);m.submit(id,{id:m.id,step:1,revision:1});}assert.deepEqual(m.snapshot('a').previous[0].value,[stroke,fill]);m.advance();m.advance();assert.deepEqual(m.page('a',{id:m.id,book:0,page:1}).value.value,[stroke,fill]);
});

test('shared reveal advances, pauses, survives reconnect, checks host and finishes with all books intact',()=>{
 let now=0;const sent=[],m=new RelayMatch([{id:'a'},{id:'b'}],{mode:'story',now:()=>now,send:(...args)=>sent.push(args)});for(let i=0;i<m.steps;i++)m.advance();
 assert.deepEqual(m.snapshot('a').reveal,m.snapshot('b').reveal);assert.equal(m.snapshot('a').reveal.page,0);now=10001;m.tick();assert.equal(m.snapshot('b').reveal.page,1);
 assert.equal(m.revealControl('b',{id:m.id,action:'next'}),false);assert.equal(m.revealControl('a',{id:'stale',action:'next'}),false);assert.equal(m.revealControl('a',{id:m.id,action:'pause'}),true);now+=50000;m.tick();assert.equal(m.snapshot('b').reveal.page,1);assert.equal(m.snapshot('b').reveal.paused,true);
 assert.equal(m.revealControl('a',{id:m.id,action:'pause'}),true);now+=10000;m.tick();assert.equal(m.snapshot('a').reveal.page,2);now+=400;assert.equal(m.revealControl('a',{id:m.id,action:'next'}),true);assert.equal(m.snapshot('b').reveal.page,3);now+=10001;m.tick();assert.equal(m.snapshot('b').reveal.book,1);assert.equal(m.snapshot('b').reveal.page,0);
 now+=100000;m.tick();assert.equal(m.snapshot('a').reveal.done,true);assert.equal(m.snapshot('b').books.length,2);assert.equal(m.page('a',{id:m.id,book:1,page:3}).value.kind,'text');assert.ok(sent.some(([,type,data])=>type==='relay:clock'&&data.phase==='final'));
 const count=sent.length;m.tick();assert.equal(sent.length,count);
});
