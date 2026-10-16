import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { Client } from '@colyseus/sdk';
import { move, WORLD } from '../../../courtyard/world.js';

const endpoint=process.env.TEST_ENDPOINT||'http://127.0.0.1:2570',rooms=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));let child,directory;
async function until(check,timeout=8000){const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw Error('Condition timed out');await delay(25);}}
function listen(room){
  room.messages={};
  for(const type of ['emote','pong','content','spaces','chat','material','notice','build:saved','space:launch','chat:prune']){room.messages[type]=[];room.onMessage(type,data=>room.messages[type].push(data));}
  room.reconnection.minUptime=0;rooms.push(room);return room;
}
async function enter(name){const room=listen(await new Client(endpoint).joinOrCreate('courtyard',{name,clientVersion:4}));await until(()=>room.state?.players?.has(room.sessionId));room.send('hello');await until(()=>room.messages.content.length>0);return room;}
async function walkTo(room,x,y){
  let seq=room.state.players.get(room.sessionId).ack;
  for(let batch=0;batch<100;batch++){
    const own=room.state.players.get(room.sessionId);let predicted={x:own.x,y:own.y};const steps=[];
    if(Math.hypot(x-own.x,y-own.y)<.2)return;
    for(let i=0;i<5;i++){
      const distance=Math.hypot(x-predicted.x,y-predicted.y);if(distance<.2)break;
      const scale=Math.max(distance,WORLD.speed*WORLD.stepMs/1000),dx=(x-predicted.x)/scale,dy=(y-predicted.y)/scale;
      steps.push({seq:++seq,dx,dy});predicted=move(predicted,dx,dy,own.space==='lobby'?room.state.tiles:undefined);
    }
    room.send('input',{space:own.space,epoch:own.epoch,steps});await delay(105);await until(()=>room.state.players.get(room.sessionId).ack===seq);
  }
  throw Error('Path did not reach target');
}
before(async()=>{
  if(!process.env.TEST_ENDPOINT){directory=await mkdtemp(join(tmpdir(),'dungeon-hall-'));child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'2570',DATA_DIR:directory},stdio:['ignore','pipe','pipe']});child.stdout.on('data',()=>{});child.stderr.on('data',chunk=>process.stderr.write(chunk));}
  for(let i=0;i<100;i++){try{if((await(await fetch(endpoint+'/health')).json()).version==='0.4.0')return;}catch{}await delay(100);}throw Error('Test server did not start');
});
after(async()=>{
  await Promise.all(rooms.filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));
  if(child){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([exited,delay(5000)]);}
  if(directory){assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('one shared lobby, logical room isolation, chat, authoritative input and reconnection',async()=>{
  const a=await enter('甲');
  await assert.rejects(new Client(endpoint).create('courtyard',{clientVersion:4,name:'不能另开大厅'}));
  const b=await enter('乙'),c=await enter('丙');
  assert.equal(a.roomId,b.roomId);assert.equal(b.roomId,c.roomId);
  await until(()=>a.state.players.size===3);assert.equal(a.state.players.get(a.sessionId).space,'lobby');
  a.send('chat',{text:'大厅你好 <b>这是文字</b>'});await until(()=>b.messages.chat.length===1&&c.messages.chat.length===1);
  assert.match(b.messages.chat[0].text,/<b>/);
  a.send('space:create',{type:'parkour',title:'测试小队'});await until(()=>a.state.players.get(a.sessionId).space!=='lobby');
  const space=a.state.players.get(a.sessionId).space;
  b.send('space:join',{id:space});await until(()=>b.state.players.get(b.sessionId).space===space);
  await delay(1100);a.send('chat',{text:'只有小队能看见'});await until(()=>b.messages.chat.some(m=>m.text==='只有小队能看见'));await delay(150);assert.equal(c.messages.chat.some(m=>m.text==='只有小队能看见'),false);
  a.send('space:ready');await until(()=>b.state.players.get(a.sessionId).ready);
  const own=a.state.players.get(a.sessionId),oldX=own.x;
  a.send('input',{space,epoch:own.epoch,steps:[{seq:1,dx:1,dy:0},{seq:2,dx:1,dy:0}]});await until(()=>b.state.players.get(a.sessionId).ack===2);assert.ok(b.state.players.get(a.sessionId).x>oldX);
  a.send('input',{space:'lobby',epoch:0,steps:[{seq:3,dx:1,dy:0}]});a.send('input',{space,epoch:own.epoch,steps:[{seq:3,dx:1e9,dy:0}]});await delay(150);assert.equal(a.state.players.get(a.sessionId).ack,2);
  a.send('build',{col:12,row:21,material:'stone',solid:true});await until(()=>a.messages.notice.some(m=>m.action==='build'));assert.equal(a.state.tiles.size,0);
  let reconnected=0;a.onReconnect(()=>reconnected++);const id=a.sessionId;a.connection.close(4010,'test interruption');await until(()=>reconnected===1,12000);await until(()=>b.state.players.get(id).connected);assert.equal(a.state.players.get(id).space,space);
  const token=b.reconnectionToken;b.reconnection.enabled=false;b.connection.close(4010,'page reload');await until(()=>!a.state.players.get(b.sessionId).connected);
  const recovered=listen(await new Client(endpoint).reconnect(token));await until(()=>recovered.state?.players?.has(b.sessionId));assert.equal(recovered.state.players.get(b.sessionId).space,space);await recovered.leave();
  a.send('space:leave');await until(()=>a.state.players.get(id).space==='lobby');await until(()=>c.messages.spaces.at(-1)?.every(s=>s.id!==space));
  await a.leave();await c.leave();await delay(150);
});

test('RGB artwork and unrestricted building persist, collide correctly and never cover players',async()=>{
  const a=await enter('画砖的人'),b=await enter('看建筑的人');
  a.send('material:create',{name:'测试花砖',pixels:'12ab34ff'.repeat(256)});await until(()=>b.messages.material.length===1);const material=b.messages.material[0];assert.equal(material.author,'画砖的人');
  await walkTo(a,480,a.state.players.get(a.sessionId).y);await walkTo(a,480,680);
  a.send('build',{col:12,row:21,material:material.id,solid:true});await until(()=>b.state.tiles.get('12,21')?.solid===true);await until(()=>a.messages['build:saved'].length>0);
  if(directory){const saved=JSON.parse(await readFile(join(directory,'world.json'),'utf8'));assert.ok(saved.materials.some(m=>m.id===material.id));assert.ok(saved.tiles.some(t=>t.col===12&&t.row===21));}
  let seq=a.state.players.get(a.sessionId).ack;for(let batch=0;batch<5;batch++){const own=a.state.players.get(a.sessionId);a.send('input',{space:'lobby',epoch:own.epoch,steps:Array.from({length:5},()=>({seq:++seq,dx:-1,dy:0}))});await delay(105);}await until(()=>a.state.players.get(a.sessionId).ack===seq);assert.ok(a.state.players.get(a.sessionId).x>=426);
  await delay(220);a.send('build',{col:15,row:21,material:'wood',solid:false});await until(()=>b.state.tiles.has('15,21'));assert.equal(b.state.tiles.get('15,21').solid,false);
  await delay(220);a.send('build',{col:12,row:21,material:null,solid:false});await until(()=>!b.state.tiles.has('12,21'));
  await delay(220);a.send('build',{col:12,row:21,material:material.id,solid:false});await until(()=>b.state.tiles.get('12,21')?.solid===false);await walkTo(a,400,688);
  await delay(220);a.send('build',{col:12,row:21,material:material.id,solid:true});await until(()=>a.messages.notice.some(m=>/站着/.test(m.text)));assert.equal(b.state.tiles.get('12,21').solid,false);
  a.send('home');await until(()=>a.state.players.get(a.sessionId).epoch>0);assert.equal(a.state.players.get(a.sessionId).y,414);
  await a.leave();await b.leave();await delay(150);
});

test('four-person rooms reject an extra member and delete themselves when empty',async()=>{
  const group=[];for(let i=0;i<5;i++)group.push(await enter('队员'+i));
  group[0].send('space:create',{type:'dungeon',title:'四人上限'});await until(()=>group[0].state.players.get(group[0].sessionId).space!=='lobby');const space=group[0].state.players.get(group[0].sessionId).space;
  for(let i=1;i<4;i++){group[i].send('space:join',{id:space});await until(()=>group[i].state.players.get(group[i].sessionId).space===space);}
  group[4].send('space:join',{id:space});await until(()=>group[4].messages.notice.some(m=>/满/.test(m.text)));assert.equal(group[4].state.players.get(group[4].sessionId).space,'lobby');
  for(let i=0;i<4;i++)await group[i].leave();await until(()=>group[4].messages.spaces.at(-1)?.every(s=>s.id!==space));await group[4].leave();
});

test('only the host can launch a ready party of two, three or four, with no fake playable level',async()=>{
  for(const count of [2,3,4]){
    const group=[];for(let i=0;i<count;i++)group.push(await enter(`队伍${count}-${i}`));
    const host=group[0];host.send('space:create',{type:'parkour',title:`${count}人小队`});await until(()=>host.state.players.get(host.sessionId).space!=='lobby');
    const id=host.state.players.get(host.sessionId).space;
    host.send('space:start');await until(()=>host.messages.notice.some(m=>/2～4/.test(m.text)));
    for(let i=1;i<count;i++)group[i].send('space:join',{id});
    await until(()=>group.every(r=>r.state.players.get(r.sessionId).space===id));
    for(const room of group)room.send('space:ready');
    await until(()=>host.messages.spaces.at(-1)?.find(s=>s.id===id)?.canStart);
    group[1].send('space:start');await until(()=>group[1].messages.notice.some(m=>/房主/.test(m.text)));
    host.send('space:start');await until(()=>group.every(r=>r.messages['space:launch'].length===1));
    assert.equal(host.messages['space:launch'][0].phase,'waiting-for-level');
    assert.equal(host.messages.spaces.at(-1).find(s=>s.id===id).canStart,false);
    host.send('space:ready');await until(()=>host.messages.spaces.at(-1)?.find(s=>s.id===id)?.phase==='forming');
    await Promise.all(group.map(r=>r.leave()));await delay(100);
  }
});

test('HTTP origin restrictions and invalid transport-room IDs remain enforced',async()=>{
  assert.equal((await fetch(endpoint+'/health',{headers:{Origin:'https://unrelated.example'}})).status,403);
  assert.equal((await fetch(endpoint+'/matchmake/joinOrCreate/courtyard',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({clientVersion:4,name:'not allowed'})})).status,403);
  await assert.rejects(new Client(endpoint).joinById('NOTAROOM',{clientVersion:4,name:'不存在'}));
  await assert.rejects(new Client(endpoint).joinOrCreate('courtyard',{name:'旧页面'}),/刷新/);
});

test('all 50 player slots share one lobby, keep exchanging input, and a 51st cannot fork another lobby',async()=>{
  const group=await Promise.all(Array.from({length:50},(_,i)=>enter('容量旅人'+i)));
  try{
    await until(()=>group.every(r=>r.state.players.size===50));
    assert.equal(new Set(group.map(r=>r.roomId)).size,1);
    await assert.rejects(new Client(endpoint).joinOrCreate('courtyard',{clientVersion:4,name:'第51位'}));
    const sequences=group.map(()=>0);
    for(let frame=0;frame<40;frame++){
      for(let i=0;i<group.length;i++){
        const room=group[i],own=room.state.players.get(room.sessionId);
        room.send('input',{space:'lobby',epoch:own.epoch,steps:Array.from({length:frame%4===0?2:1},()=>({seq:++sequences[i],dx:1,dy:0}))});
      }
      await delay(25);
    }
    await until(()=>group.every((r,i)=>r.state.players.get(r.sessionId).ack===sequences[i]));
    assert.equal(group[0].state.players.size,50);
  }finally{await Promise.all(group.map(r=>r.leave().catch(()=>{})));}
});
