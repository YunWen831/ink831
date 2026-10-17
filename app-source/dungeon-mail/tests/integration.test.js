import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { Client } from '@colyseus/sdk';
import { move, WORLD } from '../../../courtyard/world.js';
import { avatarTemplate,AVATAR_LENGTH } from '../../../courtyard/avatar-data.js';

const endpoint=process.env.TEST_ENDPOINT||'http://127.0.0.1:2570',rooms=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));let child,directory;
async function until(check,timeout=8000){const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw Error('Condition timed out');await delay(25);}}
function listen(room){
  room.messages={};
  for(const type of ['emote','pong','content','spaces','chat','material','notice','build:saved','space:launch','chat:prune','parkour:workshop','parkour:run','parkour:status','parkour:state','parkour:verified','parkour:closed','avatar','material:updated','building:protection']){room.messages[type]=[];room.onMessage(type,data=>room.messages[type].push(data));}
  room.reconnection.minUptime=0;rooms.push(room);return room;
}
let accountIndex=0;
async function enter(name,authenticated=false){
  let cookie='';
  if(authenticated){const response=await fetch(endpoint+'/api/account/register',{method:'POST',headers:{Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:JSON.stringify({username:'test_'+(++accountIndex),nickname:name,password:'Integration test password!'})});assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];}
  const room=listen(await new Client(endpoint,{headers:cookie?{Cookie:cookie}:{}}).joinOrCreate('courtyard',{name,clientVersion:6}));room.testCookie=cookie;await until(()=>room.state?.players?.has(room.sessionId));room.send('hello');await until(()=>room.messages.content.length>0);return room;}
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
  for(let i=0;i<100;i++){try{if((await(await fetch(endpoint+'/health')).json()).version==='0.6.0')return;}catch{}await delay(100);}throw Error('Test server did not start');
});
after(async()=>{
  await Promise.all(rooms.filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));
  if(child){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([exited,delay(5000)]);}
  if(directory){assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('one shared lobby, logical room isolation, chat, authoritative input and reconnection',async()=>{
  const a=await enter('甲');
  await assert.rejects(new Client(endpoint).create('courtyard',{clientVersion:6,name:'不能另开大厅'}));
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
  const a=await enter('画砖的人',true),b=await enter('看建筑的人');
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

test('only the host can launch a ready party of two, three or four into private editors',async()=>{
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
    assert.equal(host.messages['space:launch'][0].phase,'building');await until(()=>group.every(r=>r.messages['parkour:workshop'].length));
    assert.equal(host.messages.spaces.at(-1).find(s=>s.id===id).canStart,false);
    host.send('parkour:reset');await until(()=>host.messages.spaces.at(-1)?.find(s=>s.id===id)?.phase==='forming');
    await Promise.all(group.map(r=>r.leave()));await delay(100);
  }
});

test('HTTP origin restrictions and invalid transport-room IDs remain enforced',async()=>{
  assert.equal((await fetch(endpoint+'/health',{headers:{Origin:'https://unrelated.example'}})).status,403);
  assert.equal((await fetch(endpoint+'/matchmake/joinOrCreate/courtyard',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({clientVersion:6,name:'not allowed'})})).status,403);
  await assert.rejects(new Client(endpoint).joinById('NOTAROOM',{clientVersion:6,name:'不存在'}));
  await assert.rejects(new Client(endpoint).joinOrCreate('courtyard',{name:'旧页面'}),/刷新/);
});
test('chunked 32 and 64 pixel materials cross real WebSockets without raising the 4096-byte input limit',async()=>{
  const a=await enter('高分辨率甲',true),b=await enter('高分辨率乙',true),bad=await enter('中断上传',true);
  try{
    for(const [room,size] of [[a,32],[b,64]]){
      const pixels='ff0044ff'.repeat(size*size-1)+'00000000';room.send('material:begin',{name:size+'格画作',length:pixels.length});for(let i=0;i<pixels.length;i+=2048)room.send('material:chunk',{index:i/2048,pixels:pixels.slice(i,i+2048)});room.send('material:finish');
    }
    bad.send('material:begin',{name:'未完成',length:32768});bad.send('material:chunk',{index:1,pixels:'ff'.repeat(1024)});bad.send('material:finish');await until(()=>bad.messages.notice.some(n=>n.action==='material'));
    await until(()=>a.messages.material.some(m=>m.name==='64格画作')&&b.messages.material.some(m=>m.name==='32格画作'));
    assert.equal(a.messages.material.find(m=>m.name==='64格画作').pixels.length,32768);assert.ok(a.messages.material.find(m=>m.name==='64格画作').pixels.endsWith('00000000'));assert.equal(a.messages.material.some(m=>m.name==='未完成'),false);
  }finally{await Promise.all([a,b,bad].map(r=>r.leave().catch(()=>{})));}
});

test('real SDK players verify private maps, race the joined course and recover a dropped connection',async()=>{
  const a=await enter('跑酷甲'),b=await enter('跑酷乙'),group=[a,b],counters=new Map();let pump;
  try{
    a.send('space:create',{type:'parkour',title:'真实竞速'});await until(()=>a.state.players.get(a.sessionId).space!=='lobby');const id=a.state.players.get(a.sessionId).space;
    b.send('space:join',{id});await until(()=>b.state.players.get(b.sessionId).space===id);for(const r of group)r.send('space:ready');await until(()=>a.messages.spaces.at(-1)?.find(s=>s.id===id)?.canStart);a.send('space:start');
    await until(()=>group.every(r=>r.messages['parkour:workshop'].length));
    const edit=Array.from(a.messages['parkour:workshop'].at(-1).cells);edit[14*48+10]='1';a.send('parkour:map',{cells:edit.join('')});await until(()=>a.messages['parkour:workshop'].at(-1)?.revision===1);
    const saved=a.messages['parkour:workshop'].length;edit[14*48+11]='1';a.send('parkour:map',{cells:edit.join('')});await until(()=>a.messages['parkour:workshop'].length>saved);await delay(150);a.send('parkour:map',{cells:edit.join('')});await until(()=>a.messages['parkour:workshop'].at(-1)?.revision===2);
    for(const r of group){const mine=r.messages['parkour:workshop'].at(-1);assert.equal(mine.id,r.sessionId);r.send('parkour:verify',{revision:mine.revision});}
    await until(()=>group.every(r=>r.messages['parkour:run'].length));
    pump=setInterval(()=>{for(const r of group){if(!r.connection.isOpen)continue;const run=r.messages['parkour:run'].at(-1),snapshot=r.messages['parkour:state'].at(-1);if(!run||run.kind==='race'&&snapshot?.phase!=='racing')continue;const key=r.sessionId+run.id;let seq=counters.get(key)||run.ack;const frames=Array.from({length:4},()=>[++seq,1,0,0]);counters.set(key,seq);r.send('parkour:input',{id:run.id,frames});}},33);
    await until(()=>a.messages['parkour:status'].at(-1)?.players.every(p=>p.verified),12000);
    a.send('space:start');await until(()=>group.every(r=>r.messages['parkour:run'].at(-1)?.kind==='race'));
    assert.equal(a.messages['parkour:run'].at(-1).level.width,2304);await until(()=>a.messages['parkour:state'].at(-1)?.phase==='racing',6000);
    let recovered=false;a.onReconnect(()=>{recovered=true;a.send('hello');});a.connection.close(4010,'race interruption');await until(()=>recovered,12000);
    await until(()=>a.messages['parkour:status'].at(-1)?.phase==='results',22000);
    const result=a.messages['parkour:status'].at(-1).results;assert.equal(result.length,2);assert.ok(result.every(r=>r.time>9&&Number.isFinite(r.time)));
    assert.equal(a.messages['parkour:state'].at(-1).state.checkpoint,1);
  }finally{clearInterval(pump);await Promise.all(group.map(r=>r.leave().catch(()=>{})));}
});

test('real accounts enforce ownership over WebSockets, protect replacements, synchronize avatars and revoke live sessions',async()=>{
  const a=await enter('同名画家',true),b=await enter('同名画家',true),guest=await enter('游客');
  const own=room=>room.state.players.get(room.sessionId).userId;
  const api=(room,path,body,origin='http://127.0.0.1:4173')=>fetch(endpoint+'/api/account/'+path,{method:'POST',headers:{Cookie:room.testCookie,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
  try{
    assert.ok(own(a));assert.notEqual(own(a),own(b));assert.equal(own(guest),'');
    assert.equal((await api(a,'profile',{nickname:'CSRF'},'https://unrelated.example')).status,403);assert.equal((await api(a,'profile',{nickname:'CSRF'},null)).status,403);
    guest.send('material:create',{name:'冒名',pixels:'ff0000ff'.repeat(256),ownerId:own(a)});guest.send('build',{col:15,row:14,material:'stone',solid:false});await until(()=>guest.messages.notice.some(n=>n.action==='material')&&guest.messages.notice.some(n=>n.action==='build'));
    a.send('material:create',{name:'归属测试',pixels:'ff88aaff'.repeat(256),ownerId:own(b)});await until(()=>b.messages.material.some(m=>m.name==='归属测试'));const art=b.messages.material.find(m=>m.name==='归属测试');assert.equal(art.ownerId,own(a));
    b.send('material:delete',{id:art.id,ownerId:own(a)});await until(()=>b.messages.notice.some(n=>n.action==='library'));assert.equal(a.messages['material:updated'].some(m=>m.id===art.id),false);
    a.send('build',{col:15,row:14,material:art.id,solid:false,ownerId:own(b)});await until(()=>b.state.tiles.get('15,14')?.ownerId===own(a));
    b.send('build',{col:15,row:14,material:'wood',solid:false});await until(()=>b.messages.notice.some(n=>n.action==='build'&&/未开放/.test(n.text)));assert.equal(b.state.tiles.get('15,14').material,art.id);
    await delay(150);b.send('build',{col:15,row:14,material:null});await delay(200);assert.ok(a.state.tiles.has('15,14'));
    a.send('building:protection',{allow:true,ownerId:own(b)});await until(()=>a.messages['building:protection'].at(-1)?.allow===true);b.send('build',{col:15,row:14,material:'wood',solid:false});await until(()=>a.state.tiles.get('15,14')?.material==='wood');assert.equal(a.state.tiles.get('15,14').ownerId,own(b));
    a.send('building:protection',{allow:false});await until(()=>a.messages['building:protection'].at(-1)?.allow===false);a.send('building:protection',{allow:true});await until(()=>a.messages['building:protection'].at(-1)?.allow===true);
    a.send('material:delete',{id:art.id});await until(()=>b.messages['material:updated'].some(m=>m.id===art.id&&m.deletedAt));a.send('material:restore',{id:art.id});await until(()=>b.messages['material:updated'].at(-1)?.id===art.id&&!b.messages['material:updated'].at(-1)?.deletedAt);
    await delay(1100);const frames=avatarTemplate('dd2244'),pixels=frames.join('');a.send('avatar:begin',{length:AVATAR_LENGTH,userId:own(b)});for(let offset=0;offset<pixels.length;offset+=3072)a.send('avatar:chunk',{index:offset/3072,pixels:pixels.slice(offset,offset+3072)});a.send('avatar:finish');await until(()=>b.messages.avatar.some(s=>s.userId===own(a)));assert.deepEqual(b.messages.avatar.find(s=>s.userId===own(a)).frames,frames);
    assert.equal((await api(a,'profile',{nickname:'改名后'})).status,200);await until(()=>b.state.players.get(a.sessionId).name==='改名后');assert.equal(b.state.players.get(a.sessionId).userId,art.ownerId);
    a.reconnection.enabled=false;const token=a.reconnectionToken;let left=false;a.onLeave(()=>left=true);assert.equal((await api(a,'logout',{})).status,200);a.send('ping',123);await until(()=>left);
    await assert.rejects(new Client(endpoint,{headers:{Cookie:a.testCookie}}).joinOrCreate('courtyard',{name:'冒用旧登录',clientVersion:6}));await assert.rejects(new Client(endpoint).reconnect(token));
    assert.equal((await fetch(endpoint+'/api/account/me',{headers:{Cookie:a.testCookie}}).then(r=>r.json())).user,null);
    assert.ok(b.state.players.get(b.sessionId).userId);
  }finally{await Promise.all([a,b,guest].filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));await delay(150);}
});

test('all 50 player slots share one lobby, keep exchanging input, and a 51st cannot fork another lobby',async()=>{
  const group=await Promise.all(Array.from({length:50},(_,i)=>enter('容量旅人'+i)));
  try{
    await until(()=>group.every(r=>r.state.players.size===50));
    assert.equal(new Set(group.map(r=>r.roomId)).size,1);
    await assert.rejects(new Client(endpoint).joinOrCreate('courtyard',{clientVersion:6,name:'第51位'}));
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
