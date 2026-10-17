import {WEAPONS} from './lobby-rules.js?v=0.15.0';

export function createLobbyGame({send,self,players,active,connected,admin,forced,pointAt,position,setWalk,toast}){
  const $=id=>document.getElementById(id),effects=[],pickups=new Map();let firing=false,aim=0,lastShot=0,enabled=false;
  const own=()=>players().get(self());
  function action(type,data){if(active())send(type,data);$('world').focus({preventScroll:true});}
  $('pvpButton').onclick=()=>action('lobby:toggle',{kind:'pvp',enabled:!own()?.pvp});
  $('carButton').onclick=()=>{setWalk();action('lobby:toggle',{kind:'car',enabled:!own()?.driving});};
  $('forcePvpButton').onclick=()=>{if(admin()&&connected())send('lobby:force',{enabled:!forced()});};
  $('combatEquip').onclick=()=>{enabled=!enabled;setWalk();$('world').focus({preventScroll:true});update();};
  $('pickupButton').onclick=()=>action('lobby:pickup');$('reloadButton').onclick=()=>action('lobby:reload');
  const canvas=$('world');
  canvas.addEventListener('pointermove',event=>{const p=position();if(p){const point=pointAt(event.clientX,event.clientY);aim=Math.atan2(point.y-p.y,point.x-p.x);}});
  canvas.addEventListener('pointerdown',event=>{if(!active()||!enabled||event.button!==0||!own()?.weapon)return;event.preventDefault();firing=true;});
  for(const type of ['pointerup','pointercancel','blur'])window.addEventListener(type,()=>firing=false);
  // The right pad aims and fires independently of the movement joystick.
  let aimPointer=null;
  function aimTouch(event){if(event.pointerId!==aimPointer)return;const b=$('aimPad').getBoundingClientRect(),dx=event.clientX-b.x-b.width/2,dy=event.clientY-b.y-b.height/2;if(Math.hypot(dx,dy)>8){aim=Math.atan2(dy,dx);firing=true;$('aimKnob').style.transform=`translate(${Math.cos(aim)*23}px,${Math.sin(aim)*23}px)`;}}
  $('aimPad').addEventListener('pointerdown',event=>{event.preventDefault();aimPointer=event.pointerId;$('aimPad').setPointerCapture(event.pointerId);aimTouch(event);});
  $('aimPad').addEventListener('pointermove',aimTouch);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('aimPad').addEventListener(type,()=>{aimPointer=null;firing=false;$('aimKnob').style.transform='';});
  window.addEventListener('keydown',event=>{if(!active()||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|BUTTON|SELECT/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key.toLowerCase()==='f'&&!event.repeat){event.preventDefault();action('lobby:pickup');}
    if(event.key.toLowerCase()==='r'&&!event.repeat){event.preventDefault();action('lobby:reload');}
  });
  document.addEventListener('visibilitychange',()=>firing=false);
  function update(){const p=own(),isActive=active();$('lobbyHud').hidden=!isActive;$('lobbyModes').hidden=!isActive;
    $('forcePvpButton').hidden=!admin();$('forcePvpButton').disabled=!connected();$('forcePvpButton').textContent=forced()?'全员 PvP：开':'全员 PvP：关';$('forcePvpButton').setAttribute('aria-pressed',String(forced()));
    if(!isActive){firing=false;enabled=false;$('aimPad').hidden=true;$('deathShade').hidden=true;return;}
    $('pvpButton').textContent=forced()?'PvP：全员':p?.pvp?'PvP：开':'PvP：关';$('pvpButton').disabled=forced()||!p?.hp;$('pvpButton').setAttribute('aria-pressed',String(!!p?.pvp||forced()));
    $('carButton').textContent=p?.driving?'下车':'开车';$('carButton').setAttribute('aria-pressed',String(!!p?.driving));$('carButton').disabled=!p?.hp;
    $('hpValue').textContent=String(p?.hp??100);$('hpBar').value=p?.hp??100;
    const w=WEAPONS[p?.weapon];$('combatEquip').textContent=w?(enabled?'收起':'装备')+' '+w.name:'未持武器';$('combatEquip').disabled=!w||p?.driving||!p?.hp;$('combatEquip').setAttribute('aria-pressed',String(enabled&&!!w));
    $('ammoValue').textContent=p?.driving?`${Math.round((p.speed||0)/208*10)/10}× 车速`:p?.reloadUntil?'装填中…':w?.magazine?`${p.ammo} / ${w.magazine}`:'';
    $('reloadButton').hidden=!w?.magazine||p?.driving;$('reloadButton').disabled=!!p?.reloadUntil||p?.ammo===w?.magazine||!p?.hp;
    const near=[...pickups.values()].some(q=>Math.hypot(q.x-(position()?.x??0),q.y-(position()?.y??0))<44);$('pickupButton').hidden=!near||p?.driving||!p?.hp;
    $('aimPad').hidden=!enabled||!w||p?.driving||!p?.hp||!(navigator.maxTouchPoints>0||matchMedia('(any-pointer:coarse)').matches);
    canvas.style.cursor=enabled&&w&&!p?.driving?'crosshair':'';
    $('deathShade').hidden=p?.hp!==0;$('deathCountdown').textContent=p?.hp===0?`${Math.max(1,Math.ceil((p.respawnAt-Date.now())/1000))} 秒后回到广场`:'';
    $('combatHint').textContent=p?.driving?'方向键 / 摇杆驾驶 · 松开刹车':enabled&&w?'鼠标瞄准 · 按住攻击 · R 装填':near?'F 拾取武器':'';
    if((!w||p?.driving||!p?.hp)&&enabled){enabled=false;firing=false;}
  }
  setInterval(()=>{update();const p=own(),w=WEAPONS[p?.weapon];if(active()&&enabled&&firing&&w&&!p.driving&&p.hp>0&&!document.hidden&&!document.querySelector('dialog[open]')&&!/INPUT|TEXTAREA/.test(document.activeElement?.tagName)&&performance.now()-lastShot>=w.interval){lastShot=performance.now();send('lobby:attack',{angle:aim});}},50);
  return{
    get equipped(){return enabled&&!!own()?.weapon&&!own()?.driving;},get aim(){return aim;},pickups,effects,
    receive(type,data){if(type==='lobby:pickups'){pickups.clear();for(const p of data)pickups.set(p.id,p);}if(type==='lobby:shot')effects.push({...data,at:performance.now()});if(effects.length>60)effects.shift();if(type==='lobby:death'&&data.id===self()){enabled=false;firing=false;}if(type==='lobby:mode')toast(data.forced?'管理员已开启全员 PvP':'全员 PvP 已关闭，恢复个人设置');update();},
    disarm(){enabled=false;firing=false;},
    stop(){enabled=false;firing=false;pickups.clear();effects.length=0;update();},
  };
}
