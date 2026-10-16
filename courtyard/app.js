import { WORLD, move } from './world.js';
import { createScene } from './scene.js';

const $=id=>document.getElementById(id);
const keys=new Set(),players=new Map(),emotes=new Map();
const events=[];
let room=null,client=null,endpoint='',ready=false,busy=false,online=false;
let predicted=null,pending=[],outgoing=[],seq=0,resetPrediction=true,reconnects=0,lastPong=0,latency=null;
let joystick={x:0,y:0},rosterSignature='',toastTimer=0,checkTask=null,lastPing=0;
const params=new URLSearchParams(location.search);
const store={get(key,session=false){try{return (session?sessionStorage:localStorage).getItem(key);}catch{return null;}},set(key,value,session=false){try{(session?sessionStorage:localStorage).setItem(key,value);}catch{}},remove(key){try{sessionStorage.removeItem(key);}catch{}}};
function log(message){events.push({at:new Date().toISOString(),message});if(events.length>30)events.shift();}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function status(kind,label,hint){$('connectionStatus').dataset.state=kind;$('connectionStatus').textContent=label;$('networkHint').textContent=hint;$('worldDot').classList.toggle('online',kind==='online');}
function controls(){for(const id of ['createButton','joinButton'])$(id).disabled=busy||!ready;}
function resetInput(){keys.clear();joystick={x:0,y:0};$('joystickKnob').style.transform='';}
function saveSession(){if(room)store.set('dungeon-mail-session',JSON.stringify({endpoint,token:room.reconnectionToken,code:room.roomId}),true);}
function showRoom(active){$('joinCard').hidden=active;$('roomCard').hidden=!active;$('emptyHint').hidden=active;$('touchControls').hidden=!active||!matchMedia('(pointer:coarse)').matches;}
function roster(){
  const signature=JSON.stringify([...players].map(([id,p])=>[id,p.name,p.color,p.connected,id===room?.sessionId]));
  if(signature===rosterSignature)return;rosterSignature=signature;
  $('playerList').replaceChildren();let count=0;
  for(const [id,p] of players){
    if(p.connected)count++;
    const item=document.createElement('li'),color=document.createElement('span'),name=document.createElement('span'),badge=document.createElement('span');
    color.className='player-color';color.style.backgroundColor=p.color;name.textContent=p.name;badge.className='player-badge';
    if(!p.connected)badge.textContent='重连中';else if(id===room?.sessionId){badge.textContent='你';badge.classList.add('self');}else badge.textContent='在线';
    item.append(color,name,badge);$('playerList').append(item);
  }
  $('rosterCount').textContent=`${players.size} / 8`;$('worldCount').textContent=`${count} 位旅人在这里`;
}
function applyState(state){
  if(!room||!state?.players)return;
  players.clear();state.players.forEach((p,id)=>players.set(id,{name:p.name,x:p.x,y:p.y,color:p.color,connected:p.connected,ack:p.ack}));
  const own=players.get(room.sessionId);
  if(own){
    if(resetPrediction){seq=own.ack;pending=[];outgoing=[];resetPrediction=false;}
    pending=pending.filter(step=>step.seq>own.ack);
    predicted={x:own.x,y:own.y};for(const step of pending)predicted=move(predicted,step.dx,step.dy);
  }
  roster();
}
function attach(joined){
  joined.reconnection.minUptime=0;
  room=joined;online=true;lastPong=performance.now();lastPing=0;resetPrediction=true;pending=[];outgoing=[];predicted=null;
  $('roomCode').textContent=room.roomId;$('roomInput').value=room.roomId;showRoom(true);$('connectionShade').hidden=true;
  const url=new URL(location.href);url.searchParams.set('room',room.roomId);history.replaceState(null,'',url);
  status('online','已连接','你已进入庭院。邀请朋友来走走。');log('joined '+room.roomId);saveSession();
  joined.onStateChange(state=>{if(room===joined)applyState(state);});
  joined.onMessage('pong',stamp=>{
    if(room!==joined||typeof stamp!=='number')return;
    latency=Math.round(performance.now()-stamp);lastPong=performance.now();$('latency').replaceChildren(document.createTextNode(String(latency)),Object.assign(document.createElement('small'),{textContent:' ms'}));
    if(online)status('online','已连接',latency>300?'当前线路稍慢；自己的移动会立即响应。':'连接正常，可以邀请朋友一起走动。');
  });
  joined.onMessage('emote',data=>{if(room===joined&&typeof data?.id==='string')emotes.set(data.id,performance.now());});
  joined.onDrop(()=>{
    if(room!==joined)return;online=false;resetInput();outgoing=[];pending=[];resetPrediction=true;
    $('connectionShade').hidden=false;status('reconnecting','重连中','连接中断，正在尝试找回位置，最多等待 60 秒。');log('connection dropped');
  });
  joined.onReconnect(()=>{
    if(room!==joined)return;online=true;reconnects++;lastPong=performance.now();lastPing=0;resetPrediction=true;
    $('reconnects').firstChild.textContent=String(reconnects);$('connectionShade').hidden=true;applyState(joined.state);saveSession();
    status('online','已连接','已经重新连接，欢迎回来。');toast('连接回来了，你还在原来的庭院。');log('reconnected');
  });
  joined.onLeave(code=>{
    if(room!==joined)return;cleanup();status('offline','已离开',code===4001?'服务器正在重启，请稍后重新创建或加入房间。':'已离开庭院，可以重新创建或加入房间。');log('left '+code);
  });
  joined.onError((code,message)=>{if(room===joined){log('room error '+code);toast('连接出现问题，请稍后重试。');}});
  applyState(joined.state);
  $('world').focus({preventScroll:true});if(matchMedia('(max-width:740px)').matches)$('arena').scrollIntoView({behavior:'smooth',block:'center'});
}
function cleanup(){
  room=null;online=false;predicted=null;pending=[];outgoing=[];players.clear();emotes.clear();resetInput();rosterSignature='';roster();
  showRoom(false);$('connectionShade').hidden=true;$('worldCount').textContent='等待旅人';$('coordinates').textContent='还没有进入房间';store.remove('dungeon-mail-session');
  $('latency').replaceChildren(document.createTextNode('—'),Object.assign(document.createElement('small'),{textContent:' ms'}));
}
function friendly(error){
  const message=String(error?.message||error);
  if(/not found|not available|invalid room|expired|4212|4214/i.test(message))return '没有找到这个房间，可能已结束。请朋友重新复制邀请链接。';
  if(/full|locked|maxClients|已满/i.test(message))return '这个庭院暂时已满，请换个房间或稍后再试。';
  if(/昵称/.test(message))return '请先输入一个昵称。';
  return '暂时无法进入庭院。请检查网络，稍后点击“重新检查”再试。';
}
async function enter(mode){
  if(busy||room)return;
  const name=$('nickname').value.trim();if(!name){$('nickname').focus();$('formMessage').textContent='给旅人起个名字吧。';return;}
  const code=$('roomInput').value.trim().toUpperCase();
  if(mode==='join'&&!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){$('formMessage').textContent='请输入朋友分享的 6 位房间码。';return;}
  busy=true;controls();$('formMessage').textContent=mode==='create'?'正在为你打开庭院…':'正在寻找朋友的庭院…';
  store.set('dungeon-mail-name',name);
  try{
    client=new Colyseus.Client(endpoint);
    const joined=mode==='create'?await client.create('courtyard',{name}):await client.joinById(code,{name});
    attach(joined);$('formMessage').textContent='';
  }catch(error){$('formMessage').textContent=friendly(error);log('join failed '+String(error?.code||error?.message||'network'));}
  finally{busy=false;controls();}
}
async function checkEndpoint(){
  if(checkTask)return checkTask;
  checkTask=(async()=>{
    const wasInRoom=!!room;ready=false;controls();if(!wasInRoom)status('checking','检查中','正在检查联机入口。');
    try{
      const response=await fetch('./config.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('config unavailable');
      const config=await response.json();const url=new URL(config.endpoint);
      if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('invalid endpoint');
      if(!globalThis.Colyseus)throw new Error('client unavailable');
      const nextEndpoint=url.origin;
      const health=await fetch(nextEndpoint+'/health',{cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!health.ok)throw new Error('health unavailable');const data=await health.json();
      if(data.service!=='dungeon-mail-courtyard'||!data.ok)throw new Error('unexpected service');
      endpoint=nextEndpoint;ready=true;
      if(!wasInRoom)status('ready','入口可用','联机入口已就绪，创建房间或输入朋友的房间码。');
      log('endpoint ready');
    }catch(error){
      if(!wasInRoom)status('error','暂不可用','测试入口暂时无法连接。请稍后重新检查，或复制诊断反馈。');
      else toast('入口检查未通过；当前房间连接会继续保留。');
      log('endpoint check failed '+String(error?.message||'network'));
    }finally{controls();}
  })();
  try{await checkTask;}finally{checkTask=null;}
}

$('createForm').addEventListener('submit',event=>{event.preventDefault();enter('create');});
$('joinForm').addEventListener('submit',event=>{event.preventDefault();enter('join');});
$('roomInput').addEventListener('input',()=>{$('roomInput').value=$('roomInput').value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
$('leaveButton').addEventListener('click',async()=>{
  const previous=room;cleanup();if(previous)await previous.leave().catch(()=>{});
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
  status(ready?'ready':'offline',ready?'入口可用':'已离开','你已离开庭院，可以创建或加入另一个房间。');
});
$('retryButton').addEventListener('click',()=>checkEndpoint());
$('inviteButton').addEventListener('click',async()=>{
  if(!room)return;const url=new URL(location.href);url.search='';url.searchParams.set('room',room.roomId);
  try{await navigator.clipboard.writeText(url.href);$('inviteMessage').textContent='已复制，发给朋友就能加入。';toast('邀请链接已复制。');}
  catch{$('fallbackInvite').hidden=false;$('inviteText').value=url.href;$('inviteText').select();$('inviteMessage').textContent='请复制下面的链接发给朋友。';}
});
$('diagnosticsButton').addEventListener('click',async()=>{
  const data=JSON.stringify({version:'0.1.0',at:new Date().toISOString(),page:location.origin+location.pathname,endpoint,room:room?.roomId||null,status:$('connectionStatus').textContent,latency,reconnects,browser:navigator.userAgent,events},null,2);
  try{await navigator.clipboard.writeText(data);toast('诊断已复制，可以发给开发者。');}
  catch{const blob=URL.createObjectURL(new Blob([data],{type:'text/plain'}));const a=document.createElement('a');a.href=blob;a.download='courtyard-diagnostics.txt';a.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);toast('诊断已保存为文本。');}
});
let lastWave=0;
function wave(){if(!room||!online||performance.now()-lastWave<1800)return;lastWave=performance.now();room.send('emote');}
$('waveButton').addEventListener('click',wave);$('touchWave').addEventListener('click',wave);
const movementKeys=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright']);
window.addEventListener('keydown',event=>{
  if(!room||!online||/INPUT|TEXTAREA|BUTTON/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
  const key=event.key.toLowerCase();if(movementKeys.has(key)){event.preventDefault();keys.add(key);}else if(event.code==='Space'){event.preventDefault();if(!event.repeat)wave();}
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',resetInput);
const joystickElement=$('joystick');let pointer=null;
function touchMove(event){
  if(pointer!==event.pointerId)return;
  const box=joystickElement.getBoundingClientRect(),radius=box.width/2-19;
  let x=event.clientX-box.left-box.width/2,y=event.clientY-box.top-box.height/2;const distance=Math.hypot(x,y);
  if(distance>radius){x=x/distance*radius;y=y/distance*radius;}
  joystick={x:x/radius,y:y/radius};if(distance<7)joystick={x:0,y:0};$('joystickKnob').style.transform=`translate(${x}px,${y}px)`;
}
joystickElement.addEventListener('pointerdown',event=>{event.preventDefault();pointer=event.pointerId;joystickElement.setPointerCapture(pointer);touchMove(event);});
joystickElement.addEventListener('pointermove',touchMove);
for(const event of ['pointerup','pointercancel','lostpointercapture'])joystickElement.addEventListener(event,()=>{pointer=null;resetInput();});

setInterval(()=>{
  if(!room||!online||!predicted||document.hidden||pending.length>150)return;
  const dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystick.x;
  const dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joystick.y;
  if(!dx&&!dy)return;
  const norm=Math.max(1,Math.hypot(dx,dy));const step={seq:++seq,dx:dx/norm,dy:dy/norm};
  predicted=move(predicted,step.dx,step.dy);pending.push(step);outgoing.push(step);
},WORLD.stepMs);
setInterval(()=>{
  if(!room||!online)return;
  if(outgoing.length){const steps=outgoing.splice(0,6);room.send('input',{steps});}
},50);
setInterval(()=>{
  if(room&&online){lastPing=performance.now();room.send('ping',lastPing);}
},2000);
setInterval(()=>{
  if(predicted&&room)$('coordinates').textContent=`${Math.round(predicted.x)}, ${Math.round(predicted.y)}`;
  if(room&&online&&performance.now()-lastPong>9000)status('reconnecting','响应较慢','暂时没有收到服务器响应，正在等待连接恢复。');
},300);
createScene($('world'),()=>({players,emotes,self:room?.sessionId,me:predicted}));

$('nickname').value=store.get('dungeon-mail-name')||'';
if(params.get('room')){$('roomInput').value=params.get('room').toUpperCase().slice(0,6);$('joinTitle').textContent='朋友寄来了一封邀请';$('joinDescription').textContent='输入昵称，再点击“加入”，就能去见朋友。';}
controls();
await checkEndpoint();
if(ready){
  let saved;try{saved=JSON.parse(store.get('dungeon-mail-session',true)||'null');}catch{}
  if(saved?.endpoint===endpoint&&(!params.get('room')||params.get('room')===saved.code)){
    busy=true;controls();status('checking','找回中','正在尝试找回上次的庭院。');
    try{client=new Colyseus.Client(endpoint);attach(await client.reconnect(saved.token));log('page session restored');}
    catch{store.remove('dungeon-mail-session');status('ready','入口可用','上次的房间已结束，可以重新创建或加入。');}
    finally{busy=false;controls();}
  }
}
