import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChatHistory} from '../chat-history.js';
import {CHAT_RETENTION_MS as TTL, bubbleDuration, wrapMessage} from '../../../courtyard/chat.js';

test('chat expires at the boundary, stays isolated and notifies live readers after intervening writes',()=>{
  let now=0;const h=new ChatHistory(()=>now),notifications=[];
  h.add('lobby',{id:'old',at:0});h.add('team',{id:'other',at:1});
  now=TTL-1;assert.equal(h.read('lobby').length,1);
  now=TTL;assert.equal(h.read('lobby').length,0);assert.equal(h.read('team').length,1);
  h.add('lobby',{id:'new',at:now});
  h.sweep((space,cutoff)=>notifications.push({space,cutoff}));
  assert.deepEqual(h.read('lobby').map(m=>m.id),['new']);
  assert.ok(notifications.some(m=>m.space==='lobby'&&m.cutoff===0));
  now=TTL*2+1;assert.equal(h.sweep(),TTL+1);assert.equal(h.entries.size,0);
});
test('chat history remains bounded; full length bubbles wrap without splitting emoji',()=>{
  const h=new ChatHistory(()=>100);
  for(let i=0;i<60;i++)h.add('lobby',{id:i,at:100});
  assert.equal(h.read('lobby').length,50);assert.equal(h.read('lobby')[0].id,10);
  const text='一'.repeat(110)+'👨‍👩‍👧‍👦'.repeat(2);
  const lines=wrapMessage(text,t=>[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(t)].length*12,230);
  assert.equal(lines.join(''),text);assert.ok(lines.length>1&&lines.length<=12);
  assert.ok(bubbleDuration('嗨')>=5000);assert.equal(bubbleDuration('字'.repeat(120)),15000);
});
