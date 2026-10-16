import { WORLD, move, FACILITIES, TILE_SIZE, BUILD_REACH, isBuildCell, tileKey } from './world.js?v=0.3.0';
import { BUILTIN_MATERIALS } from './materials.js?v=0.3.0';
import { createScene } from './scene.js?v=0.3.0';
import { createPainter, preview } from './art.js?v=0.3.0';

const $=id=>document.getElementById(id);
const keys=new Set(),players=new Map(),tiles=new Map(),emotes=new Map(),speech=new Map();
const materials=new Map(BUILTIN_MATERIALS.map(m=>[m.id,m])),histories=new Map(),events=[];
const store={get(key,session=false){try{return (session?sessionStorage:localStorage).getItem(key);}catch{return null;}},set(key,value,session=false){try{(session?sessionStorage:localStorage).setItem(key,value);}catch{}},remove(key){try{sessionStorage.removeItem(key);}catch{}}};
const params=new URLSearchParams(location.search);
let room=null,endpoint='',ready=false,busy=false,online=false,space='lobby',epoch=0,spaces=[],facilityMode='parkour',spaceBusy=false;
let predicted=null,pending=[],outgoing=[],seq=0,resetPrediction=true,reconnects=0,lastPong=0,latency=null;
let joystick={x:0,y:0},rosterSignature='',toastTimer=0,checkTask=null,tool='walk',hover=null,nearFacility=null,invitationShown=false;
let selectedId=store.get('dungeon-mail-material')||'stone',lastChat=0,spaceUiSignature='';
function log(message){events.push({at:new Date().toISOString(),message});if(events.length>30)events.shift();}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function status(kind,label,hint){$('connectionStatus').dataset.state=kind;$('connectionStatus').textContent=label;$('networkHint').textContent=hint;$('worldDot').classList.toggle('online',kind==='online');}
function resetInput(){keys.clear();joystick={x:0,y:0};$('joystickKnob').style.transform='';}
function saveSession(){if(room)store.set('dungeon-mail-session',JSON.stringify({version:2,endpoint,token:room.reconnectionToken}),true);}
function controls(){
  const active=!!room&&online;
  $('enterButton').disabled=busy||!ready;
  for(const id of ['chatInput','sendChat','waveButton','inviteButton','readyButton','returnButton','leaveButton','homeButton','roomsButton'])$(id).disabled=!active||spaceBusy;
  const party=spaces.find(s=>s.id===space);$('startButton').disabled=!active||spaceBusy||!party?.canStart||party.host!==room?.sessionId;
  for(const button of document.querySelectorAll('[data-tool]'))button.disabled=!active||space!=='lobby';
  for(const id of ['materialButton','paintButton','blockKind'])$(id).disabled=!active||space!=='lobby';
  $('createSpaceButton').disabled=!active||spaceBusy;
}
function setTool(value){tool=value;resetInput();for(const b of document.querySelectorAll('[data-tool]')){b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));}
  $('toolHint').textContent=tool==='walk'?'WASD 移动 · E 互动':tool==='place'?'点击 / 拖动放置 · 右键拆除':'点击 / 拖动拆除';
}
function roster(){
  const signature=JSON.stringify([...players].map(([id,p])=>[id,p.name,p.color,p.connected,p.ready,id===room?.sessionId]));
  if(signature===rosterSignature)return;rosterSignature=signature;$('playerList').replaceChildren();let count=0;
  for(const [id,p] of players){
    if(p.connected)count++;
    const li=document.createElement('li'),color=document.createElement('span'),name=document.createElement('span'),badge=document.createElement('span');
    color.className='player-color';color.style.backgroundColor=p.color;name.textContent=p.name;badge.className='player-badge';
    badge.textContent=!p.connected?'重连中':p.ready?'已准备':id===room?.sessionId?'你':'在线';li.append(color,name,badge);$('playerList').append(li);
  }
  $('rosterCount').textContent=`${players.size} / ${space==='lobby'?50:4}`;$('worldCount').textContent=`${count} 人`;
}
function updateSpaceUI(){
  const info=spaces.find(s=>s.id===space),inLobby=space==='lobby';
  const signature=JSON.stringify([space,info?.title,info?.type,info?.phase,info?.canStart,info?.host,info?.count,info?.ready,players.get(room?.sessionId)?.ready,!!room,online,spaceBusy]);
  if(signature===spaceUiSignature)return;spaceUiSignature=signature;
  $('spaceTitle').textContent=inLobby?'大厅':info?.title||'小队';
  $('spaceBadge').textContent=inLobby?'':info?.type==='dungeon'?'地牢':'跑酷';
  $('roomCard').hidden=inLobby;$('roomsButton').hidden=!inLobby;
  $('homeButton').hidden=!inLobby;
  $('roomTitle').textContent=info?.title||'小队准备庭院';$('roomCode').textContent=inLobby?'':space;
  $('roomDescription').textContent=info?.phase==='waiting-for-level'?'队伍已就绪，等待关卡开放。':`${info?.count||0} / 4 人 · ${info?.ready||0} 人准备 · 至少 2 人`;
  $('readyButton').textContent=info?.phase==='waiting-for-level'?'返回准备':players.get(room?.sessionId)?.ready?'取消准备':'准备';
  $('startButton').textContent=info?.phase==='waiting-for-level'?'已就绪':'开始';
  $('startButton').title='2～4 人全部准备后由房主确认；完整关卡尚未开放';
  $('chatTitle').textContent=inLobby?'聊天':'小队聊天';
  const url=new URL(location.href);if(inLobby)url.searchParams.delete('room');else url.searchParams.set('room',space);if(url.href!==location.href)history.replaceState(null,'',url);
  controls();
}
function applyState(state){
  if(!room||!state?.players)return;const own=state.players.get(room.sessionId);if(!own)return;
  const changed=space!==own.space||epoch!==own.epoch,previousSpace=space;
  if(resetPrediction||changed){
    space=own.space;epoch=own.epoch;seq=own.ack;pending=[];outgoing=[];resetPrediction=false;resetInput();
    if(changed){spaceBusy=false;setTool('walk');hover=null;speech.clear();emotes.clear();$('spacesDialog').close();if(previousSpace!==space)renderChat();}
  }
  tiles.clear();state.tiles?.forEach((b,key)=>tiles.set(key,{col:b.col,row:b.row,material:b.material,solid:b.solid}));
  players.clear();state.players.forEach((p,id)=>{if(p.space===space)players.set(id,{name:p.name,x:p.x,y:p.y,color:p.color,connected:p.connected,ack:p.ack,ready:p.ready});});
  pending=pending.filter(step=>step.seq>own.ack);predicted={x:own.x,y:own.y};for(const step of pending)predicted=move(predicted,step.dx,step.dy,space==='lobby'?tiles:undefined);
  if(changed||$('coordinates').textContent==='等待进入')$('coordinates').textContent=`${Math.round(predicted.x)}, ${Math.round(predicted.y)}`;
  roster();if(changed||!$('peopleCard').hidden)updateSpaceUI();
}
function addChat(message,animate=true){
  const history=histories.get(message.space)||[];if(history.some(m=>m.id===message.id))return;
  history.push(message);if(history.length>50)history.shift();histories.set(message.space,history);
  if(message.space===space){renderChat();if(animate)speech.set(message.sender,{text:message.text,at:performance.now()});}
}
function renderChat(){
  const container=$('chatMessages'),oldScroll=container.scrollTop,wasNearBottom=container.scrollHeight-container.scrollTop-container.clientHeight<45;
  container.replaceChildren();const history=histories.get(space)||[];
  for(const m of history){const line=document.createElement('p'),name=document.createElement('strong'),text=document.createElement('span'),time=document.createElement('time');line.className='chat-line';name.textContent=m.name;name.style.color=m.color;text.textContent=m.text;time.textContent=new Date(m.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});line.append(name,text,time);container.append(line);}
  container.scrollTop=wasNearBottom?container.scrollHeight:oldScroll;
}
function selectMaterial(id){
  selectedId=materials.has(id)?id:'stone';const material=materials.get(selectedId);$('selectedMaterial').textContent=material.name;preview($('selectedTexture'),material);store.set('dungeon-mail-material',selectedId);renderLibrary();
}
function renderLibrary(){
  $('materialGrid').replaceChildren();
  for(const material of materials.values()){
    const button=document.createElement('button'),canvas=document.createElement('canvas'),name=document.createElement('strong'),author=document.createElement('small');button.className='material-item';button.classList.toggle('selected',material.id===selectedId);button.setAttribute('aria-label','选择材料：'+material.name);canvas.width=canvas.height=16;preview(canvas,material);name.textContent=material.name;author.textContent='by '+material.author;button.append(canvas,name,author);
    button.addEventListener('click',()=>{selectMaterial(material.id);$('libraryDialog').close();setTool('place');$('world').focus({preventScroll:true});});$('materialGrid').append(button);
  }
}
const painter=createPainter(data=>{if(room&&online)room.send('material:create',data);else painter.failed('连接恢复后再保存作品。');});
function openPaint(){if(!room||!online)return;resetInput();$('libraryDialog').close();painter.open();}
function renderRooms(){
  $('roomList').replaceChildren();const list=spaces.filter(s=>s.type===facilityMode);
  if(!list.length){const empty=document.createElement('p');empty.className='empty-list';empty.textContent='暂无房间';$('roomList').append(empty);}
  for(const info of list){
    const row=document.createElement('div'),body=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('small'),button=document.createElement('button');row.className='room-entry';title.textContent=info.title;meta.textContent=`${info.count} / 4 · ${info.id}`;body.append(title,meta);button.className='secondary-button';button.textContent=info.phase!=='forming'?'已就绪':info.count>=4?'已满':'加入';button.disabled=info.count>=4||info.phase!=='forming'||spaceBusy;button.addEventListener('click',()=>{spaceBusy=true;controls();renderRooms();room.send('space:join',{id:info.id});});row.append(body,button);$('roomList').append(row);
  }
}
function openFacility(id){
  if(!room||!online||space!=='lobby')return;resetInput();
  if(id==='art'){openPaint();return;}
  facilityMode=id;$('facilityTitle').textContent=id==='parkour'?'跑酷':'地牢';$('facilityDescription').textContent='2～4 人 · 完整关卡待开放';for(const button of document.querySelectorAll('[data-facility]'))button.classList.toggle('active',button.dataset.facility===id);$('spaceMessage').textContent='';renderRooms();room.send('spaces:list');if(!$('spacesDialog').open)$('spacesDialog').showModal();
}
function attach(joined){
  joined.reconnection.minUptime=0;room=joined;online=true;lastPong=performance.now();resetPrediction=true;pending=[];outgoing=[];predicted=null;space='lobby';epoch=0;spaceBusy=false;
  spaceUiSignature='';document.body.classList.add('in-world');$('loginOverlay').hidden=true;$('peopleCard').hidden=false;$('connectionShade').hidden=true;$('touchControls').hidden=!matchMedia('(pointer:coarse)').matches;controls();renderChat();
  status('online','已连接','');log('joined public courtyard');saveSession();
  joined.onStateChange(state=>{if(room===joined)applyState(state);});
  joined.onMessage('pong',stamp=>{if(room!==joined||typeof stamp!=='number')return;latency=Math.round(performance.now()-stamp);lastPong=performance.now();$('latency').replaceChildren(document.createTextNode(String(latency)),Object.assign(document.createElement('small'),{textContent:' ms'}));if(online)status('online','已连接',latency>300?'网络较慢':'');});
  joined.onMessage('space:launch',()=>{if(room===joined){spaceBusy=false;controls();updateSpaceUI();}});
  joined.onMessage('emote',data=>{if(room===joined&&typeof data?.id==='string')emotes.set(data.id,performance.now());});
  joined.onMessage('chat',data=>{if(room===joined)addChat(data);});
  joined.onMessage('spaces',data=>{if(room!==joined)return;spaces=data;renderRooms();updateSpaceUI();});
  joined.onMessage('content',data=>{
    if(room!==joined)return;for(const material of data.materials)materials.set(material.id,material);spaces=data.spaces;histories.set(data.space,data.history);selectMaterial(materials.has(selectedId)?selectedId:'stone');renderRooms();if(data.space===space)renderChat();updateSpaceUI();
    if(!invitationShown&&params.get('room')){invitationShown=true;const invitation=spaces.find(s=>s.id===params.get('room'));if(invitation){openFacility(invitation.type);toast('朋友的房间在列表里，点击加入就能过去。');}else toast('邀请的房间已结束，你可以留在大厅和大家玩。');}
  });
  joined.onMessage('material',data=>{if(room!==joined)return;materials.set(data.id,data);renderLibrary();if(data.creator===room.sessionId){selectMaterial(data.id);painter.saved();setTool('place');toast('已保存');}});
  joined.onMessage('build:saved',()=>{if(room===joined)$('saveState').textContent='已保存';});
  joined.onMessage('notice',data=>{if(room!==joined)return;toast(data.text);if(data.action==='build')$('saveState').textContent='';if(data.action==='material')painter.failed(data.text);if(data.action==='space'){spaceBusy=false;controls();renderRooms();$('spaceMessage').textContent=data.text;}});
  joined.onDrop(()=>{if(room!==joined)return;online=false;resetInput();outgoing=[];pending=[];resetPrediction=true;spaceBusy=false;controls();painter.failed('连接中断，恢复后可以重新保存。');$('connectionShade').hidden=false;status('reconnecting','重连中','正在找回位置，最多等待 60 秒。');log('connection dropped');});
  joined.onReconnect(()=>{if(room!==joined)return;online=true;reconnects++;lastPong=performance.now();resetPrediction=true;spaceBusy=false;$('reconnects').firstChild.textContent=String(reconnects);$('connectionShade').hidden=true;applyState(joined.state);saveSession();room.send('hello');controls();status('online','已连接','连接回来了，欢迎回来。');log('reconnected');});
  joined.onLeave(code=>{if(room!==joined)return;cleanup();status('offline','已离开',code===4001?'服务器更新完成后，请重新进入公共大厅。':'已离开庭院，可以重新输入用户名进入。');log('left '+code);});
  joined.onError(code=>{if(room===joined){log('room error '+code);toast('连接出现问题，请稍后重试。');}});
  applyState(joined.state);room.send('hello');$('world').focus({preventScroll:true});
}
function cleanup(){
  room=null;online=false;predicted=null;pending=[];outgoing=[];space='lobby';epoch=0;spaces=[];spaceBusy=false;spaceUiSignature='';players.clear();tiles.clear();emotes.clear();speech.clear();histories.clear();resetInput();rosterSignature='';setTool('walk');
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  document.body.classList.remove('in-world');$('loginOverlay').hidden=false;$('peopleCard').hidden=true;$('roomCard').hidden=true;$('roomsButton').hidden=false;$('homeButton').hidden=false;$('connectionShade').hidden=true;$('touchControls').hidden=true;$('interactButton').hidden=true;$('coordinates').textContent='';$('worldCount').textContent='';$('spaceTitle').textContent='大厅';$('spaceBadge').textContent='';$('chatTitle').textContent='聊天';
  $('latency').replaceChildren(document.createTextNode('—'),Object.assign(document.createElement('small'),{textContent:' ms'}));store.remove('dungeon-mail-session');controls();renderChat();
}
function friendly(error){const message=String(error?.message||error);if(/full|locked|已满|maxClients/i.test(message))return '大厅已满，请稍后再来。';if(/用户|昵称|刷新/.test(message))return message;return '连接失败，请重试。';}
async function enter(){
  if(busy||room)return;const name=$('nickname').value.trim();if(!name)return;
  busy=true;controls();$('formMessage').textContent='正在走进公共大厅…';store.set('dungeon-mail-name',name);
  try{attach(await new Colyseus.Client(endpoint).joinOrCreate('courtyard',{name,clientVersion:3}));$('formMessage').textContent='';}catch(error){$('formMessage').textContent=friendly(error);log('join failed '+String(error?.code||'network'));}finally{busy=false;controls();}
}
async function checkEndpoint(){
  if(checkTask)return checkTask;
  checkTask=(async()=>{
    const wasInRoom=!!room;ready=false;controls();if(!wasInRoom)status('checking','检查中','正在检查联机入口。');
    try{
      const response=await fetch('./config.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('config unavailable');
      const config=await response.json(),url=new URL(config.endpoint);
      if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('invalid endpoint');
      if(!globalThis.Colyseus)throw Error('client unavailable');
      const health=await fetch(url.origin+'/health',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!health.ok)throw Error('health unavailable');const data=await health.json();
      if(data.service!=='dungeon-mail-courtyard'||!data.ok||!data.version.startsWith('0.3.'))throw Error('server updating');
      endpoint=url.origin;ready=true;if(!wasInRoom)status('ready','入口可用','输入用户名，就能进入大家共同的大厅。');log('endpoint ready');
    }catch(error){if(!wasInRoom)status('error','暂不可用','入口暂时不可用或正在更新，请稍后重新检查。');else toast('入口检查未通过，当前连接继续保留。');log('endpoint check failed '+error.message);}finally{controls();}
  })();try{await checkTask;}finally{checkTask=null;}
}
$('enterForm').addEventListener('submit',event=>{event.preventDefault();enter();});
$('leaveButton').addEventListener('click',async()=>{const old=room;cleanup();if(old)await old.leave().catch(()=>{});const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);status('ready','入口可用','输入用户名，就能再次回到庭院。');});
$('returnButton').addEventListener('click',()=>{if(room&&online){spaceBusy=true;resetInput();controls();room.send('space:leave');}});
$('readyButton').addEventListener('click',()=>{if(room&&online)room.send('space:ready');});
$('startButton').addEventListener('click',()=>{if(room&&online){spaceBusy=true;controls();room.send('space:start');}});
$('roomsButton').addEventListener('click',()=>openFacility('parkour'));
for(const button of document.querySelectorAll('[data-facility]'))button.addEventListener('click',()=>openFacility(button.dataset.facility));
$('helpButton').addEventListener('click',()=>{resetInput();$('helpDialog').showModal();});
$('mapButton').addEventListener('click',()=>{const hidden=!$('minimap').hidden;$('minimap').hidden=hidden;$('mapButton').setAttribute('aria-pressed',String(!hidden));});
$('homeButton').addEventListener('click',()=>{if(room&&online){resetInput();room.send('home');$('world').focus({preventScroll:true});}});
$('retryButton').addEventListener('click',checkEndpoint);
$('createSpaceForm').addEventListener('submit',event=>{event.preventDefault();if(!room||!online||spaceBusy)return;spaceBusy=true;resetInput();controls();renderRooms();room.send('space:create',{type:facilityMode,title:$('spaceName').value.trim()});});
$('inviteButton').addEventListener('click',async()=>{if(!room||space==='lobby')return;const url=new URL(location.href);url.search='';url.searchParams.set('room',space);try{await navigator.clipboard.writeText(url.href);toast('小队邀请已复制，朋友会先进入大厅，再加入你的房间。');}catch{toast('请复制地址栏中的链接，发给朋友。');}});
$('chatForm').addEventListener('submit',event=>{
  event.preventDefault();if(!room||!online)return;const text=$('chatInput').value.trim();if(!text)return;
  if(performance.now()-lastChat<1100){toast('等一秒再发送下一句吧。');return;}
  lastChat=performance.now();room.send('chat',{text});$('chatInput').value='';
});
$('chatInput').addEventListener('focus',resetInput);
$('chatInput').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();$('chatInput').blur();$('world').focus({preventScroll:true});}});
$('chatToggle').addEventListener('click',()=>{const show=$('chatBody').hidden;$('chatBody').hidden=!show;$('chatToggle').textContent=show?'−':'+';$('chatToggle').setAttribute('aria-expanded',String(show));$('chatToggle').setAttribute('aria-label',show?'收起聊天':'展开聊天');});
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{setTool(button.dataset.tool);$('world').focus({preventScroll:true});});
$('paintButton').addEventListener('click',openPaint);$('newMaterialButton').addEventListener('click',openPaint);
$('materialButton').addEventListener('click',()=>{resetInput();renderLibrary();$('libraryDialog').showModal();});
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>button.closest('dialog').close());
$('interactButton').addEventListener('click',()=>{if(nearFacility)openFacility(nearFacility);});
let lastWave=0;function wave(){if(room&&online&&performance.now()-lastWave>1800){lastWave=performance.now();room.send('emote');}}
$('waveButton').addEventListener('click',wave);$('touchWave').addEventListener('click',wave);
const movementKeys=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright']);
window.addEventListener('keydown',event=>{
  if(!room||!online||spaceBusy||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|BUTTON|SELECT/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
  const key=event.key.toLowerCase();if(movementKeys.has(key)){event.preventDefault();keys.add(key);}else if(event.key==='Enter'){event.preventDefault();$('chatBody').hidden=false;$('chatToggle').textContent='−';$('chatToggle').setAttribute('aria-expanded','true');$('chatInput').focus();}else if(key==='e'&&nearFacility&&!event.repeat){event.preventDefault();openFacility(nearFacility);}else if(event.code==='Space'){event.preventDefault();if(!event.repeat)wave();}
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',resetInput);
const joystickElement=$('joystick');let pointer=null;
function touchMove(event){if(pointer!==event.pointerId)return;const box=joystickElement.getBoundingClientRect(),radius=box.width/2-18;let x=event.clientX-box.left-box.width/2,y=event.clientY-box.top-box.height/2;const distance=Math.hypot(x,y);if(distance>radius){x=x/distance*radius;y=y/distance*radius;}joystick=distance<7?{x:0,y:0}:{x:x/radius,y:y/radius};$('joystickKnob').style.transform=`translate(${x}px,${y}px)`;}
joystickElement.addEventListener('pointerdown',event=>{event.preventDefault();pointer=event.pointerId;joystickElement.setPointerCapture(pointer);touchMove(event);});joystickElement.addEventListener('pointermove',touchMove);for(const name of ['pointerup','pointercancel','lostpointercapture'])joystickElement.addEventListener(name,()=>{pointer=null;resetInput();});
setInterval(()=>{
  if(!room||!online||!predicted||spaceBusy||document.hidden||document.querySelector('dialog[open]')||pending.length>150)return;
  const dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystick.x,dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joystick.y;if(!dx&&!dy)return;
  const norm=Math.max(1,Math.hypot(dx,dy)),step={seq:++seq,dx:dx/norm,dy:dy/norm};predicted=move(predicted,step.dx,step.dy,space==='lobby'?tiles:undefined);pending.push(step);outgoing.push(step);
},WORLD.stepMs);
setInterval(()=>{if(room&&online&&!spaceBusy&&outgoing.length)room.send('input',{space,epoch,steps:outgoing.splice(0,6)});},25);
setInterval(()=>{if(room&&online)room.send('ping',performance.now());},2000);
setInterval(()=>{
  if(predicted&&room)$('coordinates').textContent=`${Math.round(predicted.x)}, ${Math.round(predicted.y)}`;
  nearFacility=room&&online&&space==='lobby'&&predicted?FACILITIES.find(f=>Math.hypot(f.x-predicted.x,f.y-predicted.y)<76)?.id||null:null;
  $('interactButton').hidden=!nearFacility;if(nearFacility)$('interactButton').lastElementChild.textContent='进入'+FACILITIES.find(f=>f.id===nearFacility).name;
  $('areaLabel').textContent=space!=='lobby'?'小队':'大厅';
  if(room&&online&&performance.now()-lastPong>9000)status('reconnecting','响应较慢','暂时没有收到服务器响应，正在等待恢复。');
},150);
const scene=createScene($('world'),()=>({players,tiles,materials,emotes,speech,self:room?.sessionId,me:predicted,space,tool,hover,nearFacility}));
function mapCell(event){const point=scene.pointAt(event.clientX,event.clientY);return {col:Math.floor(point.x/TILE_SIZE),row:Math.floor(point.y/TILE_SIZE)};}
let buildPointer=null,lastBuildAt=0,lastBuildKey='';
function construct(event){
  if(!room||!online||space!=='lobby'||!predicted||tool==='walk')return;
  const {col,row}=mapCell(event);hover={col,row};
  if(!isBuildCell(col,row))return;
  if(Math.hypot(predicted.x-(col+.5)*TILE_SIZE,predicted.y-(row+.5)*TILE_SIZE)>BUILD_REACH){if(event.type==='pointerdown')toast('走近一点');return;}
  const remove=tool==='remove'||event.button===2||(event.buttons&2)!==0,key=`${col},${row}:${remove}`;
  if(remove&&!tiles.has(tileKey(col,row)))return;
  if(performance.now()-lastBuildAt<140||key===lastBuildKey)return;
  lastBuildAt=performance.now();lastBuildKey=key;$('saveState').textContent='保存中';
  room.send('build',{col,row,material:remove?null:selectedId,solid:!remove&&$('blockKind').value==='wall'});
}
$('world').addEventListener('pointermove',event=>{hover=mapCell(event);if(buildPointer===event.pointerId)construct(event);});$('world').addEventListener('pointerleave',()=>hover=null);
$('world').addEventListener('contextmenu',event=>{if(tool!=='walk')event.preventDefault();});
$('world').addEventListener('pointerdown',event=>{
  if(!room||!online)return;$('world').focus({preventScroll:true});
  if(tool==='walk'){const point=scene.pointAt(event.clientX,event.clientY);const clicked=FACILITIES.find(f=>f.id===nearFacility&&Math.hypot(f.x-point.x,f.y-point.y)<60);if(clicked)openFacility(clicked.id);return;}
  event.preventDefault();lastBuildKey='';buildPointer=event.pointerId;$('world').setPointerCapture(event.pointerId);construct(event);
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('world').addEventListener(name,()=>{buildPointer=null;lastBuildKey='';});
$('diagnosticsButton').addEventListener('click',async()=>{
  const data=JSON.stringify({version:'0.3.0',at:new Date().toISOString(),page:location.origin+location.pathname,endpoint,space,status:$('connectionStatus').textContent,latency,reconnects,browser:navigator.userAgent,events},null,2);
  try{await navigator.clipboard.writeText(data);toast('诊断已复制。');}catch{const url=URL.createObjectURL(new Blob([data],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='courtyard-diagnostics.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
$('nickname').value=store.get('dungeon-mail-name')||'';preview($('selectedTexture'),materials.get('stone'));renderLibrary();controls();
if(matchMedia('(max-width:760px)').matches)document.querySelector('.network-card').open=false;
await checkEndpoint();
if(ready){let saved;try{saved=JSON.parse(store.get('dungeon-mail-session',true)||'null');}catch{}
  if(saved?.version===2&&saved.endpoint===endpoint){busy=true;controls();status('checking','找回中','正在找回上次的位置。');try{attach(await new Colyseus.Client(endpoint).reconnect(saved.token));}catch{store.remove('dungeon-mail-session');status('ready','入口可用','上次的连接已结束，可以重新进入公共大厅。');}finally{busy=false;controls();}}
}
