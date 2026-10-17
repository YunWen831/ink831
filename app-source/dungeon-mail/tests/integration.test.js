import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { Client } from '@colyseus/sdk';
import {AccountStore,COOKIE_NAME} from '../accounts.js';
import {WorldStore} from '../world-store.js';
import {rigTemplate,packRig,RIG_LENGTH} from '../../../courtyard/avatar-rig.js';
import { move, WORLD } from '../../../courtyard/world.js';
import { avatarTemplate,AVATAR_LENGTH } from '../../../courtyard/avatar-data.js';
import {mechanismMap} from './fixtures/mechanism-map.js';

const endpoint=process.env.TEST_ENDPOINT||'http://127.0.0.1:2570',rooms=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));let child,directory,adminCookie,adminId;
async function until(check,timeout=8000){const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw Error('Condition timed out');await delay(25);}}
function listen(room){
  room.messages={};
  const originalSend=room.send.bind(room);room.send=(type,data)=>{if(['parkour:map','parkour:verify','parkour:invalidate'].includes(type))data={...data,documentId:data?.documentId??room.messages['parkour:workshop']?.at(-1)?.documentId};return originalSend(type,data);};
  for(const type of ['relay:page','relay:ack','materials:pruned','relay:state','relay:clock','mural:saved','party:private','party:state','emote','pong','content','spaces','chat','material','notice','build:saved','space:launch','chat:prune','parkour:workshop','parkour:run','parkour:status','parkour:state','parkour:verified','parkour:closed','avatar','material:updated','building:protection','levels:list','levels:saved','levels:deleted']){room.messages[type]=[];room.onMessage(type,data=>room.messages[type].push(data));}
  room.reconnection.minUptime=0;rooms.push(room);return room;
}
let accountIndex=0;
async function enter(name,authenticated=false){
  let cookie='';
  if(authenticated){const response=await fetch(endpoint+'/api/account/register',{method:'POST',headers:{Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:JSON.stringify({username:'test_'+(++accountIndex),nickname:name,password:'Integration test password!'})});assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];}
  const room=listen(await new Client(endpoint,{headers:cookie?{Cookie:cookie}:{}}).joinOrCreate('courtyard',{name,clientVersion:15}));room.testCookie=cookie;await until(()=>room.state?.players?.has(room.sessionId));room.send('hello');await until(()=>room.messages.content.length>0);return room;}
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
  if(!process.env.TEST_ENDPOINT){directory=await mkdtemp(join(tmpdir(),'dungeon-hall-'));const seed=await new AccountStore(directory).load(),admin=await seed.register({username:'ink',password:'Isolated administration test password!'});adminId=admin.user.id;adminCookie=COOKIE_NAME+'='+admin.token;await writeFile(join(directory,'admins.json'),JSON.stringify({version:1,ids:[adminId]}));const legacyWorld=await new WorldStore(directory).load();await legacyWorld.createMaterial('未绑定旧画作','ff9900ff'.repeat(256),'旧旅人');for(const col of [13,14])await legacyWorld.setTile({col,row:12,material:'stone',solid:false});child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'2570',DATA_DIR:directory},stdio:['ignore','pipe','pipe']});child.stdout.on('data',()=>{});child.stderr.on('data',chunk=>process.stderr.write(chunk));}
  for(let i=0;i<100;i++){try{if((await(await fetch(endpoint+'/health')).json()).version==='0.14.0')return;}catch{}await delay(100);}throw Error('Test server did not start');
});
after(async()=>{
  await Promise.all(rooms.filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));
  if(child){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([exited,delay(5000)]);}
  if(directory){assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('one shared lobby, logical room isolation, chat, authoritative input and reconnection',async()=>{
  const a=await enter('甲');
  await assert.rejects(new Client(endpoint).create('courtyard',{clientVersion:15,name:'不能另开大厅'}));
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
  a.send('build',{col:12,row:21,material:'stone',solid:true});await until(()=>a.messages.notice.some(m=>m.action==='build'));assert.equal(a.state.tiles.has('12,21'),false);
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
  assert.equal((await fetch(endpoint+'/matchmake/joinOrCreate/courtyard',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({clientVersion:15,name:'not allowed'})})).status,403);
  await assert.rejects(new Client(endpoint).joinById('NOTAROOM',{clientVersion:15,name:'不存在'}));
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

test('real SDK players verify mechanism maps, race the joined course and recover a dropped connection',async()=>{
  const a=await enter('跑酷甲'),b=await enter('跑酷乙'),group=[a,b],counters=new Map();let pump;
  try{
    a.send('space:create',{type:'parkour',title:'真实竞速'});await until(()=>a.state.players.get(a.sessionId).space!=='lobby');const id=a.state.players.get(a.sessionId).space;
    b.send('space:join',{id});await until(()=>b.state.players.get(b.sessionId).space===id);for(const r of group)r.send('space:ready');await until(()=>a.messages.spaces.at(-1)?.find(s=>s.id===id)?.canStart);a.send('space:start');
    await until(()=>group.every(r=>r.messages['parkour:workshop'].length));
    b.send('parkour:map',{cells:mechanismMap()});await until(()=>b.messages['parkour:workshop'].at(-1)?.revision===1);
    const edit=Array.from(mechanismMap());edit[14*48+10]='1';a.send('parkour:map',{cells:edit.join('')});await until(()=>a.messages['parkour:workshop'].at(-1)?.revision===1);
    const saved=a.messages['parkour:workshop'].length;edit[14*48+11]='1';a.send('parkour:map',{cells:edit.join('')});await until(()=>a.messages['parkour:workshop'].length>saved);await delay(150);a.send('parkour:map',{cells:edit.join('')});await until(()=>a.messages['parkour:workshop'].at(-1)?.revision===2);
    for(const r of group){const mine=r.messages['parkour:workshop'].at(-1);assert.equal(mine.id,r.sessionId);r.send('parkour:verify',{revision:mine.revision});}
    await until(()=>group.every(r=>r.messages['parkour:run'].length));
    pump=setInterval(()=>{for(const r of group){if(!r.connection.isOpen)continue;const run=r.messages['parkour:run'].at(-1),snapshot=r.messages['parkour:state'].at(-1);if(!run||run.kind==='race'&&snapshot?.phase!=='racing')continue;const key=r.sessionId+run.id;let seq=counters.get(key)||run.ack;const frames=Array.from({length:4},()=>[++seq,1,0,0]);counters.set(key,seq);r.send('parkour:input',{id:run.id,frames});}},33);
    await until(()=>a.messages['parkour:status'].at(-1)?.players.every(p=>p.verified),12000);
    assert.ok(a.messages['parkour:state'].some(m=>m.state.springBoost>0));assert.ok(a.messages['parkour:state'].some(m=>m.state.crumbleCharges?.length));assert.ok(a.messages['parkour:state'].some(m=>m.state.doorCharges?.length));
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
    await delay(3100);const rig=rigTemplate('#709bbb'),parts=packRig(rig);a.send('avatar:begin',{length:RIG_LENGTH,format:'parts-v1',userId:own(b)});for(let i=0;i<parts.length;i+=3072)a.send('avatar:chunk',{index:i/3072,pixels:parts.slice(i,i+3072)});a.send('avatar:finish');await until(()=>b.messages.avatar.some(s=>s.userId===own(a)&&s.rig));assert.deepEqual(b.messages.avatar.find(s=>s.userId===own(a)&&s.rig).rig,rig);
    assert.equal((await api(a,'profile',{nickname:'改名后'})).status,200);await until(()=>b.state.players.get(a.sessionId).name==='改名后');assert.equal(b.state.players.get(a.sessionId).userId,art.ownerId);
    a.reconnection.enabled=false;const token=a.reconnectionToken;let left=false;a.onLeave(()=>left=true);assert.equal((await api(a,'logout',{})).status,200);a.send('ping',123);await until(()=>left);
    await assert.rejects(new Client(endpoint,{headers:{Cookie:a.testCookie}}).joinOrCreate('courtyard',{name:'冒用旧登录',clientVersion:15}));await assert.rejects(new Client(endpoint).reconnect(token));
    assert.equal((await fetch(endpoint+'/api/account/me',{headers:{Cookie:a.testCookie}}).then(r=>r.json())).user,null);
    assert.ok(b.state.players.get(b.sessionId).userId);
  }finally{await Promise.all([a,b,guest].filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));await delay(150);}
});

test('private account workshop saves across sessions, preserves server proofs, rejects conflicts and never exposes another account maps',async()=>{
  const a=await enter('云端作者',true),b=await enter('另一账号',true),guest=await enter('访客');let second,timer;
  const latest=()=>a.messages['parkour:workshop'].at(-1),save=(room,draft,extra={})=>room.send('levels:save',{id:draft.cloudId,version:draft.cloudVersion,title:'跨设备地图',cells:draft.cells,revision:draft.revision,documentId:draft.documentId,...extra});
  try{
    guest.send('levels:list');await until(()=>guest.messages.notice.some(n=>n.action==='levels'));
    a.send('levels:new');await until(()=>latest());const draft=latest();assert.equal(draft.solo,true);save(a,draft);
    await until(()=>a.messages['levels:saved'].length===1);const first=a.messages['levels:saved'][0];assert.equal(first.verified,false);
    a.send('parkour:verify',{revision:draft.revision});await until(()=>a.messages['parkour:run'].length>0);const run=a.messages['parkour:run'].at(-1);let seq=0;
    timer=setInterval(()=>a.send('parkour:input',{id:run.id,frames:Array.from({length:4},()=>[++seq,1,0,0])}),33);
    await until(()=>a.messages['levels:saved'].some(m=>m.id===first.id&&m.verified),12000);clearInterval(timer);timer=null;const verified=a.messages['levels:saved'].at(-1);
    assert.equal(verified.version,2);a.send('parkour:edit');await until(()=>latest().cloudVersion===2);
    b.send('levels:open',{id:first.id});await until(()=>b.messages.notice.some(n=>n.action==='levels'));assert.equal(b.messages['parkour:workshop'].length,0);
    second=listen(await new Client(endpoint,{headers:{Cookie:a.testCookie}}).joinOrCreate('courtyard',{clientVersion:15}));await until(()=>second.state?.players?.has(second.sessionId));second.send('levels:open',{id:first.id});await until(()=>second.messages['parkour:workshop'].length>0);
    const loaded=second.messages['parkour:workshop'].at(-1);assert.equal(loaded.verified,true);assert.equal(loaded.cells,verified.cells);
    const cells=Array.from(loaded.cells);cells[10*48+12]='1';second.send('parkour:map',{cells:cells.join('')});await until(()=>second.messages['parkour:workshop'].at(-1).revision>loaded.revision);
    const modified=second.messages['parkour:workshop'].at(-1);assert.equal(modified.verified,false);save(second,modified);await until(()=>second.messages['levels:saved'].length>0);assert.equal(second.messages['levels:saved'][0].version,3);
    save(a,latest());await until(()=>a.messages.notice.some(n=>n.action==='levels'&&/新版本/.test(n.text)));assert.equal(a.messages['levels:saved'].at(-1).version,2);
    save(a,latest(),{id:null,version:0,title:'保存为副本'});await until(()=>a.messages['levels:saved'].some(m=>m.title==='保存为副本'));a.send('levels:list');await until(()=>a.messages['levels:list'].at(-1)?.maps.length===2);
    const previous=latest();a.send('levels:open',{id:first.id});await until(()=>latest().documentId!==previous.documentId);const loadedAgain=latest();assert.equal(loadedAgain.verified,false);
    await delay(150);a.send('parkour:map',{cells:previous.cells,documentId:previous.documentId});await delay(180);assert.equal(latest().cells,loadedAgain.cells,'stale editor must not overwrite a newly loaded document');
    second.send('levels:delete',{id:first.id,version:3});await until(()=>a.messages['levels:deleted'].some(m=>m.id===first.id));
    const beforeDraft=latest().documentId;a.send('levels:new',{cells:verified.cells,verified:true});await until(()=>latest().documentId!==beforeDraft);assert.equal(latest().verified,false,'restoring client drafts cannot fabricate a proof');assert.equal(latest().title,'本机草稿');
    a.send('parkour:solo:close');await until(()=>a.messages['parkour:closed'].length>0);assert.equal(a.state.players.get(a.sessionId).space,'lobby');
  }finally{if(timer)clearInterval(timer);await Promise.all([a,b,guest,second].filter(r=>r?.connection.isOpen).map(r=>r.leave().catch(()=>{})));await delay(150);}
});

test('HTTP administration enforces role and origin, revokes live sessions, moderates artwork and synchronizes protection',async(t)=>{
  if(!adminCookie){t.skip('Only runs against a seeded, isolated server');return;}
  const target=await enter('管理测试目标',true),own=target.state.players.get(target.sessionId).userId;
  const api=(path,body,cookie=adminCookie,origin='http://127.0.0.1:4173')=>fetch(endpoint+'/api/account/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(origin?{Origin:origin}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  try{
    assert.equal((await api('admin/users',undefined,target.testCookie)).status,403);assert.equal((await api('admin/users/action',{id:own,action:'ban'},adminCookie,null)).status,403);
    const list=await(await api('admin/users')).json();assert.ok(list.users.find(u=>u.id===adminId).admin);assert.equal(list.users.find(u=>u.id===own).admin,false);assert.equal('passwordHash' in list.users[0],false);
    assert.equal((await api('admin/users/action',{id:adminId,action:'ban'})).status,400);
    assert.equal((await api('admin/protection',{id:own,allow:true})).status,200);await until(()=>target.messages['building:protection'].at(-1)?.allow===true);
    target.send('material:create',{name:'管理测试画布',pixels:'ff66aaff'.repeat(256)});await until(()=>target.messages.material.some(m=>m.name==='管理测试画布'));const art=target.messages.material.find(m=>m.name==='管理测试画布');
    const meta=await(await api('admin/materials?userId='+own)).json();assert.ok(meta.materials.some(m=>m.id===art.id));assert.equal('pixels' in meta.materials[0],false);assert.equal((await(await api('admin/materials/'+art.id)).json()).material.pixels,art.pixels);
    assert.equal((await api('admin/materials/action',{id:art.id,restore:false},target.testCookie)).status,403);
    assert.equal((await api('admin/materials/action',{id:art.id,restore:false})).status,200);await until(()=>target.messages['material:updated'].some(m=>m.id===art.id&&m.deletedAt));
    assert.equal((await api('admin/materials/action',{id:art.id,restore:true})).status,200);await until(()=>target.messages['material:updated'].at(-1)?.id===art.id&&!target.messages['material:updated'].at(-1)?.deletedAt);
    target.reconnection.enabled=false;let left=false;target.onLeave(()=>left=true);assert.equal((await api('admin/users/action',{id:own,action:'ban',note:'测试'})).status,200);await until(()=>left);
    const username=list.users.find(u=>u.id===own).username;assert.equal((await api('login',{username,password:'Integration test password!'},'')).status,400);
    assert.equal((await api('admin/users/action',{id:own,action:'unban'})).status,200);assert.equal((await api('login',{username,password:'Integration test password!'},'')).status,200);
    const reset=await(await api('admin/users/action',{id:own,action:'recovery'})).json();assert.ok(reset.recoveryCode);assert.equal((await api('login',{username,password:'Integration test password!'},'')).status,400);
    assert.equal((await api('recover',{username,recoveryCode:reset.recoveryCode,password:'New isolated recovered password!'},'')).status,200);
    const audit=await(await api('admin/audit')).json();assert.ok(audit.events.some(e=>e.action==='material-delete'));assert.ok(audit.events.some(e=>e.action==='protection'));
  }finally{if(target.connection.isOpen)await target.leave();}
});

test('legacy buildings are editable only by administrators and old artwork remains recoverable',async(t)=>{
  if(!directory){t.skip('Requires isolated legacy fixtures');return;}
  const ordinary=await enter('旧内容保护测试',true),admin=listen(await new Client(endpoint,{headers:{Cookie:adminCookie}}).joinOrCreate('courtyard',{clientVersion:15}));
  await until(()=>admin.state?.players?.has(admin.sessionId));
  const api=(path,body)=>fetch(endpoint+'/api/account/admin/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:adminCookie,Origin:'http://127.0.0.1:4173',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  try{
    for(const material of [null,'wood']){const count=ordinary.messages.notice.length;ordinary.send('build',{col:13,row:12,material,solid:false,admin:true});await until(()=>ordinary.messages.notice.length>count);assert.match(ordinary.messages.notice.at(-1).text,/仅管理员/);assert.equal(ordinary.state.tiles.get('13,12').material,'stone');await delay(150);}
    admin.send('build',{col:13,row:12,material:'wood',solid:false});await until(()=>ordinary.state.tiles.get('13,12')?.material==='wood');assert.equal(ordinary.state.tiles.get('13,12').ownerId,adminId);
    await delay(150);admin.send('build',{col:14,row:12,material:null});await until(()=>!ordinary.state.tiles.has('14,12'));
    await delay(150);admin.send('build',{col:13,row:12,material:null});await until(()=>!ordinary.state.tiles.has('13,12'));
    const data=await(await api('materials?userId=legacy')).json(),art=data.materials.find(m=>m.name==='未绑定旧画作');assert.ok(art);assert.ok(data.materials.every(m=>!m.ownerId));
    ordinary.send('material:delete',{id:art.id});await until(()=>ordinary.messages.notice.some(n=>n.action==='library'));
    assert.equal((await api('materials/action',{id:art.id,restore:false})).status,200);await until(()=>ordinary.messages['material:updated'].some(m=>m.id===art.id&&m.deletedAt));
    assert.equal((await api('materials/action',{id:art.id,restore:true})).status,200);await until(()=>ordinary.messages['material:updated'].at(-1)?.id===art.id&&!ordinary.messages['material:updated'].at(-1)?.deletedAt);
    assert.equal(ordinary.messages['build:saved'].length,0);const audit=await(await api('audit')).json();assert.ok(audit.events.some(e=>e.action==='legacy-demolish'&&e.note==='14,12'));assert.ok(audit.events.some(e=>e.action==='legacy-replace'&&e.note==='13,12'));
  }finally{await Promise.all([ordinary,admin].filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));await delay(150);}
});

test('party rooms launch with two to four guests, isolate snapshots and restore a live round after reconnecting',async()=>{
  const observer=await enter('派对旁观大厅');
  try{for(const n of [2,3,4]){
    const group=[];try{
      for(let i=0;i<n;i++)group.push(await enter('派对旅人'+i));const host=group[0];host.send('space:create',{type:'party',title:'小游戏派对'});await until(()=>host.state.players.get(host.sessionId).space!=='lobby');const space=host.state.players.get(host.sessionId).space;
      host.send('space:start');await until(()=>host.messages.notice.some(m=>m.action==='space'));assert.equal(host.messages['party:state'].length,0);
      for(const peer of group.slice(1)){peer.send('space:join',{id:space});await until(()=>peer.state.players.get(peer.sessionId).space===space);}
      group.at(-1).send('space:start');await until(()=>group.at(-1).messages.notice.some(m=>m.text.includes('房主')));
      for(const peer of group)peer.send('space:ready');await until(()=>host.messages.spaces.at(-1)?.find(s=>s.id===space)?.canStart);host.send('space:start');await until(()=>group.every(p=>p.messages['party:state'].length));
      assert.equal(new Set(group.map(p=>p.messages['party:state'].at(-1).id)).size,1);assert.equal(host.messages['party:state'].at(-1).players.length,n);assert.equal(observer.messages['party:state'].length,0);
      if(n===2){await until(()=>host.messages['party:state'].at(-1)?.phase==='playing',7000);const before=host.messages['party:state'].at(-1);host.send('party:input',{id:'forged',round:0,seq:1,x:10000,y:0,total:999});host.send('party:input',{id:before.id,round:0,seq:2,x:1,y:0});await until(()=>host.messages['party:state'].at(-1).left<before.left-.2);assert.equal(host.messages['party:state'].at(-1).players[0].total,0);
        const peer=group[1];let reconnected=false;peer.onReconnect(()=>{reconnected=true;peer.send('hello');});peer.connection.close(4010,'party QA drop');await until(()=>reconnected,12000);await until(()=>peer.messages['party:state'].at(-1)?.id===before.id);assert.equal(peer.messages['party:state'].at(-1).round,0);
      }
      host.send('space:leave');await until(()=>host.state.players.get(host.sessionId).space==='lobby');
    }finally{await Promise.all(group.filter(p=>p.connection.isOpen).map(p=>p.leave().catch(()=>{})));await delay(200);}
  }}finally{await observer.leave();}
});

test('host selects a single game, changes clear readiness, and final votes determine the next actual match',async()=>{
  const a=await enter('投票房主'),b=await enter('投票朋友');
  try{
    a.send('space:create',{type:'party',mode:'random'});await until(()=>a.state.players.get(a.sessionId).space!=='lobby');const space=a.state.players.get(a.sessionId).space;
    b.send('space:join',{id:space});await until(()=>b.state.players.get(b.sessionId).space===space);a.send('space:ready');b.send('space:ready');await until(()=>a.messages.spaces.at(-1)?.find(s=>s.id===space)?.canStart);
    b.send('party:settings',{mode:'bump'});await until(()=>b.messages.notice.some(n=>n.text.includes('仅房主')));assert.equal(a.messages.spaces.at(-1).find(s=>s.id===space).mode,'random');
    a.send('party:settings',{mode:'mine'});await until(()=>a.messages.spaces.at(-1)?.find(s=>s.id===space)?.mode==='mine'&&!a.messages.spaces.at(-1)?.find(s=>s.id===space)?.canStart);await until(()=>!a.state.players.get(a.sessionId).ready&&!a.state.players.get(b.sessionId).ready);
    a.send('space:ready');b.send('space:ready');await until(()=>a.messages.spaces.at(-1)?.find(s=>s.id===space)?.canStart);a.send('space:start');await until(()=>a.messages['party:state'].at(-1)?.phase==='playing',8000);const first=a.messages['party:state'].at(-1);assert.equal(first.mode,'mine');assert.equal(first.roundCount,1);
    for(const p of [a,b])p.send('party:input',{id:first.id,round:0,seq:1,x:0,y:0,choice:'cash'});await until(()=>a.messages['party:state'].at(-1)?.phase==='final',16000);assert.equal(a.messages['party:state'].at(-1).history.length,1);
    a.send('party:vote',{id:first.id,mode:'delivery'});b.send('party:vote',{id:first.id,mode:'bump'});await until(()=>a.messages['party:state'].at(-1)?.votes.length===2);assert.equal(a.messages['party:state'].at(-1).nextMode,'delivery');
    a.send('party:vote',{id:first.id,mode:'bump'});await until(()=>a.messages['party:state'].at(-1)?.voteCounts.bump===2);a.send('space:start');await until(()=>a.messages['party:state'].at(-1)?.id!==first.id);assert.equal(a.messages['party:state'].at(-1).game,'bump');assert.equal(a.messages['party:state'].at(-1).roundCount,1);
  }finally{await Promise.all([a,b].filter(p=>p.connection.isOpen).map(p=>p.leave().catch(()=>{})));await delay(200);}
});

test('new game secrets are sent only to their owner, survive peeking and become public only at reveal',async()=>{
  const a=await enter('按钮房主'),b=await enter('按钮朋友'),outsider=await enter('大厅访客');
  try{
    a.send('space:create',{type:'party',mode:'buttons'});await until(()=>a.state.players.get(a.sessionId).space!=='lobby');const space=a.state.players.get(a.sessionId).space;b.send('space:join',{id:space});await until(()=>b.state.players.get(b.sessionId).space===space);
    for(const p of [a,b])p.send('space:ready');await until(()=>a.messages.spaces.at(-1)?.find(s=>s.id===space)?.canStart);a.send('space:start');await until(()=>a.messages['party:state'].at(-1)?.phase==='playing',8000);const state=a.messages['party:state'].at(-1),req={id:state.id,round:0,turn:0};
    for(const p of [a,b,outsider])p.send('party:peek',req);await until(()=>a.messages['party:private'].length&&b.messages['party:private'].length);assert.equal(outsider.messages['party:private'].length,0);assert.notEqual(a.messages['party:private'][0].clue.button,b.messages['party:private'][0].clue.button);assert.equal(state.extra.effects,undefined);assert.equal(state.extra.reveal.length,0);assert.equal(JSON.stringify(state).includes('privateClue'),false);
    const peerCount=b.messages['party:private'].length;a.send('party:input',{...req,seq:1,x:0,y:0,choice:'0'});await until(()=>a.messages['party:private'].at(-1)?.choice==='0');assert.equal(b.messages['party:private'].length,peerCount);
    await delay(180);a.send('party:peek',req);await until(()=>a.messages['party:private'].length>=3);assert.equal(a.messages['party:private'].at(-1).choice,'0');b.send('party:input',{...req,seq:1,x:0,y:0,choice:'1'});
    await until(()=>a.messages['party:state'].at(-1)?.extra?.stage==='reveal',7000);const revealed=a.messages['party:state'].at(-1);assert.equal(revealed.extra.effects.length,3);assert.equal(revealed.extra.reveal.length,2);assert.equal(outsider.messages['party:state'].length,0);
  }finally{await Promise.all([a,b,outsider].filter(p=>p.connection.isOpen).map(p=>p.leave().catch(()=>{})));await delay(200);}
});

test('relay rooms deliver only assigned pages, survive refresh and reveal both complete books',async()=>{
 const a=await enter('接龙甲'),b=await enter('接龙乙'),outsider=await enter('接龙旁观');let recovered;
 const upload=async(p,request,value)=>{const text=JSON.stringify(value);p.send('relay:begin',{...request,length:text.length,submit:true});p.send('relay:chunk',{index:0,text});p.send('relay:finish');};
 try{
  a.send('space:create',{type:'party',mode:'relay'});await until(()=>a.state.players.get(a.sessionId).space!=='lobby');const space=a.state.players.get(a.sessionId).space;b.send('space:join',{id:space});await until(()=>b.state.players.get(b.sessionId).space===space);for(const p of [a,b])p.send('space:ready');await until(()=>a.messages.spaces.at(-1)?.find(s=>s.id===space)?.canStart);a.send('space:start');await until(()=>a.messages['relay:state'].length&&b.messages['relay:state'].length);
  for(let step=0;step<4;step++){
   const state=a.messages['relay:state'].at(-1),request={id:state.id,step,revision:1};assert.equal(state.step,step);assert.equal(state.books,undefined);
   for(const p of [a,b])await upload(p,request,step%2?[['#ff0000',5,[2,2,40,40]]]:p.sessionId+'页'+step);
   await until(()=>a.messages['relay:state'].at(-1)?.step===step+1);
   if(step===0){assert.equal(a.messages['relay:state'].at(-1).previous[0].author,b.sessionId);b.reconnection.enabled=false;const token=b.reconnectionToken;b.connection.close(4010,'reload relay');await until(()=>!a.state.players.get(b.sessionId).connected);recovered=listen(await new Client(endpoint).reconnect(token));await until(()=>recovered.state?.players?.has(recovered.sessionId));recovered.send('hello');await until(()=>recovered.messages['relay:state'].length);assert.equal(recovered.messages['relay:state'][0].previous[0].author,a.sessionId);}
   // Continue through the recovered socket, with the same server identity.
   if(recovered&&step===0){b.send=recovered.send.bind(recovered);}
   if(step<3)await delay(60);
  }
  const final=a.messages['relay:state'].at(-1);assert.equal(final.phase,'final');assert.equal(final.books.length,2);assert.ok(final.books.every(book=>book.pages.length===4));outsider.send('relay:peek');await delay(100);assert.equal(outsider.messages['relay:state'].length,0);
 }finally{await Promise.all([a,b,outsider,recovered].filter(p=>p?.connection.isOpen).map(p=>p.leave().catch(()=>{})));await delay(200);}
});

test('regional art crosses bounded chunks and guests cannot write it',async()=>{
 const a=await enter('区域画家',true),b=await enter('区域旁观');
 const data={cols:2,rows:1,col:17,row:14,name:'区域测试',pixels:('abcdef12'.repeat(16)+'001122ff'.repeat(16)).repeat(16)},text=JSON.stringify(data);
 const upload=p=>{p.send('mural:begin',{length:text.length});for(let i=0;i<text.length;i+=2000)p.send('mural:chunk',{index:i/2000,text:text.slice(i,i+2000)});p.send('mural:finish');};
 try{upload(b);await until(()=>b.messages.notice.some(n=>n.action==='mural'));assert.equal(a.state.tiles.has('17,14'),false);upload(a);await until(()=>a.messages['mural:saved'].length);await until(()=>b.state.tiles.has('18,14'));assert.equal(b.state.tiles.get('17,14').solid,false);assert.equal(b.state.tiles.get('17,14').ownerId,a.state.players.get(a.sessionId).userId);assert.equal(a.messages['mural:saved'][0].count,2);const hidden=a.messages.material.find(m=>m.mural);assert.ok(hidden);a.send('build',{col:16,row:14,material:hidden.id,solid:false});await until(()=>a.messages.notice.some(n=>n.action==='build'&&n.text.includes('删除')));if(adminCookie){const meta=await(await fetch(endpoint+'/api/account/admin/materials',{headers:{Cookie:adminCookie}})).json();assert.equal(meta.materials.some(m=>m.id===hidden.id),false);}upload(a);await until(()=>a.messages.notice.some(n=>n.action==='mural'&&n.text.includes('稍等')));assert.equal(a.messages['mural:saved'].length,1);}
 finally{await Promise.all([a,b].map(p=>p.leave().catch(()=>{})));await delay(200);}
});

test('room chat remains private while lobby channel reaches players inside and outside a game',async()=>{
 const a=await enter('频道甲'),b=await enter('频道乙'),c=await enter('频道丙');
 try{
  a.send('space:create',{type:'party',mode:'story'});await until(()=>a.state.players.get(a.sessionId).space!=='lobby');const space=a.state.players.get(a.sessionId).space;b.send('space:join',{id:space});await until(()=>b.state.players.get(b.sessionId).space===space);
  a.send('chat',{channel:'room',text:'只给小队的信'});await until(()=>b.messages.chat.some(m=>m.text==='只给小队的信'));assert.equal(c.messages.chat.some(m=>m.text==='只给小队的信'),false);
  await delay(1100);a.send('chat',{channel:'lobby',text:'发给大厅的信'});await until(()=>[b,c].every(p=>p.messages.chat.some(m=>m.text==='发给大厅的信')));assert.equal(c.messages.chat.find(m=>m.text==='发给大厅的信').space,'lobby');
  c.send('chat',{channel:'lobby',text:'大厅回复'});await until(()=>a.messages.chat.some(m=>m.text==='大厅回复'));a.send('hello');await until(()=>a.messages.content.at(-1)?.lobbyHistory?.some(m=>m.text==='大厅回复'));assert.ok(a.messages.content.at(-1).history.some(m=>m.text==='只给小队的信'));assert.equal(a.messages.content.at(-1).lobbyHistory.some(m=>m.text==='只给小队的信'),false);
  a.send('chat',{channel:space,text:'伪造频道'});await delay(100);assert.equal(b.messages.chat.some(m=>m.text==='伪造频道'),false);
 }finally{await Promise.all([a,b,c].map(p=>p.leave().catch(()=>{})));await delay(150);}
});

test('administrator batch API previews protected cells, rejects ordinary users and stale regions, and syncs one atomic removal',async(t)=>{
 if(!adminCookie){t.skip('Seeded server required');return;}const a=await enter('批拆目标甲',true),b=await enter('批拆目标乙',true);
 const api=(path,body,cookie=adminCookie)=>fetch(endpoint+'/api/account/admin/buildings/'+path,{method:'POST',headers:{Cookie:cookie,Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  a.send('build',{col:15,row:13,material:'stone',solid:false});b.send('build',{col:16,row:13,material:'wood',solid:false});await until(()=>a.state.tiles.has('15,13')&&a.state.tiles.has('16,13'));
  const rect={col1:15,row1:13,col2:16,row2:13};assert.equal((await api('preview',rect,a.testCookie)).status,403);const first=await(await api('preview',rect)).json();assert.equal(first.count,2);
  await delay(150);a.send('build',{col:15,row:13,material:'brick',solid:false});await until(()=>a.state.tiles.get('15,13')?.material==='brick');assert.equal((await api('demolish',{ticket:first.ticket})).status,409);assert.ok(a.state.tiles.has('16,13'));
  const fresh=await(await api('preview',rect)).json();const result=await api('demolish',{ticket:fresh.ticket});assert.equal(result.status,200);assert.equal((await result.json()).count,2);await until(()=>[a,b].every(p=>!p.state.tiles.has('15,13')&&!p.state.tiles.has('16,13')));assert.equal((await api('demolish',{ticket:fresh.ticket})).status,409);
  const audit=await(await fetch(endpoint+'/api/account/admin/audit',{headers:{Cookie:adminCookie}})).json();assert.ok(audit.events.some(e=>e.action==='bulk-demolish'));
 }finally{await Promise.all([a,b].map(p=>p.leave().catch(()=>{})));await delay(100);}
});

for(const mode of ['relay','story'])test(`eighteen real SDK players finish ${mode}, reject a nineteenth member and load sealed pages on demand`,async()=>{
 const group=await Promise.all(Array.from({length:19},(_,i)=>enter('接龙队员'+i))),host=group[0];
 try{
  host.send('space:create',{type:'party',mode});await until(()=>host.state.players.get(host.sessionId).space!=='lobby');const space=host.state.players.get(host.sessionId).space;
  for(const p of group.slice(1,18)){p.send('space:join',{id:space});await until(()=>p.state.players.get(p.sessionId).space===space);}
  assert.equal(host.messages.spaces.at(-1).find(s=>s.id===space).capacity,18);group[18].send('space:join',{id:space});await until(()=>group[18].messages.notice.some(n=>n.text.includes('满')));
  host.send('party:settings',{mode:'bump'});await until(()=>host.messages.notice.some(n=>n.text.includes('4人')));assert.equal(host.messages.spaces.at(-1).find(s=>s.id===space).mode,mode);
  for(const p of group.slice(0,18))p.send('space:ready');await until(()=>host.messages.spaces.at(-1).find(s=>s.id===space).canStart);host.send('space:start');await until(()=>host.messages['relay:state'].length);const id=host.messages['relay:state'].at(-1).id;host.send('relay:page',{id,book:0,page:0});await delay(100);assert.equal(host.messages['relay:page'].length,0);
  for(let step=0;step<18;step++){
   for(const p of group.slice(0,18)){const text=JSON.stringify(mode==='relay'&&step%2?[['#ff0000',5,[10,10,20,20]]]:p.sessionId+'第'+step+'页');p.send('relay:begin',{id,step,revision:1,length:text.length,submit:true});p.send('relay:chunk',{index:0,text});p.send('relay:finish');}
   await until(()=>host.messages['relay:state'].at(-1)?.step===step+1);await delay(35);
  }
  const final=host.messages['relay:state'].at(-1);assert.equal(final.phase,'final');assert.equal(final.books.length,18);assert.ok(final.books.every(b=>b.pages.length===18&&b.pages.every(p=>p.value===undefined)));assert.ok(JSON.stringify(final).length<35000);assert.equal(group[18].messages['relay:state'].length,0);
  for(const p of [host,group[18]])p.send('relay:page',{id,book:17,page:17});await until(()=>host.messages['relay:page'].length);assert.ok(host.messages['relay:page'][0].value.value.length);assert.equal(group[18].messages['relay:page'].length,0);
 }finally{await Promise.all(group.map(p=>p.leave().catch(()=>{})));await delay(150);}
});

test('all 50 player slots share one lobby, keep exchanging input, and a 51st cannot fork another lobby',async()=>{
  const group=await Promise.all(Array.from({length:50},(_,i)=>enter('容量旅人'+i)));
  try{
    await until(()=>group.every(r=>r.state.players.size===50));
    assert.equal(new Set(group.map(r=>r.roomId)).size,1);
    await assert.rejects(new Client(endpoint).joinOrCreate('courtyard',{clientVersion:15,name:'第51位'}));
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
