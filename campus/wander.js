/* 在学校乱逛：可选小关卡。调查进度存在原存档的旗标里。 */
'use strict';
var EPISODES={
  night:{from:'hall3',x:8,y:13,title:'巡夜侧廊',reward:'避开巡夜'},
  photo:{from:'museum',x:8,y:18,title:'照片里的房间',reward:'识破照片'},
  loop:{from:'art',x:8,y:13,title:'没有第四间教室',reward:'走出循环'}
};
function episodeObj(x,y,who,action,art){return {x:x,y:y,who:who,verb:'调查',action:action,art:art||'paper'};}
function episodeLayout(w,h,title){R('wall',1,1,w-2,h-2);R('floor',2,2,w-4,h-4);NAME(2,1,w-4,2,title);}
makeMap('night',{w:32,h:20,base:'void',spawn:[3,16],objs:[
  episodeObj(4,5,'旧器材柜 · 可以躲进去','hide','drawer'),
  episodeObj(28,15,'走廊储物柜 · 可以躲进去','hide','drawer'),
  episodeObj(27,3,'巡夜信号总闸','night_reward','speaker'),
  episodeObj(3,17,'回广播室','leave','door')
],deco:[{x:9,y:3,n:5,dx:2,art:'desk'},{x:17,y:15,n:4,dx:2,art:'desk'}]},function(){
  episodeLayout(32,20,'巡夜侧廊');R('wall',7,6,14,1);R('wall',12,13,16,1);
});
makeMap('photo',{w:24,h:18,base:'void',spawn:[12,14],objs:[
  episodeObj(5,6,'照片位置① · 椅子','photo_0','desk'),
  episodeObj(18,6,'照片位置② · 窗户','photo_1','window'),
  episodeObj(12,10,'照片位置③ · 时钟','photo_2','paper'),
  episodeObj(12,15,'回校史馆','leave','door')
]},function(){episodeLayout(24,18,'旧照片展室');});
makeMap('loop',{w:34,h:20,base:'void',spawn:[16,15],objs:[
  episodeObj(6,3,'左边教室 · 指出异常','loop_0','board'),
  episodeObj(16,3,'中间教室 · 指出异常','loop_1','board'),
  episodeObj(26,3,'右边教室 · 指出异常','loop_2','board'),
  episodeObj(30,15,'没有异常，沿走廊前进','loop_clean','door'),
  episodeObj(3,15,'回艺术楼','leave','door')
],deco:[{x:4,y:6,n:3,dx:2,art:'desk'},{x:14,y:6,n:3,dx:2,art:'desk'},{x:24,y:6,n:3,dx:2,art:'desk'}]},function(){
  episodeLayout(34,20,'没有第四间教室');
  R('wall',11,2,1,9);R('wall',21,2,1,9);R('wall',2,10,29,1);
  [6,16,26].forEach(function(x){R('floor',x,10,2,1);});
});
// Preserve current map dimensions until the usual startup loads the campus.
MAPW=MAPS.campus.w;MAPH=MAPS.campus.h;
TALK.night_intro={nodes:{s:{text:'广播室后面多了一条侧廊。巡夜的人拖着脚走过去，手里的灯照着前面。\n\n慢走也会被灯照见。蹲下可以减少声音；柜子可以藏身；纸团能把他引开。\n\n键盘 C 蹲行、F 投纸团，手机用屏幕上的按钮。拿到最里面的总闸记录就回来。',end:true}}};
TALK.photo_intro={nodes:{s:{text:'旧照片拍的是这间屋子。上面有三样东西：一把空椅子、三格窗、停在07:10的钟。\n\n点「看旧照片」对照现场，走近变化的东西再调查。每认出一个变化，房间就会换一遍。\n\n需要找出三次变化。答错可以继续观察。',end:true}}};
TALK.loop_intro={nodes:{s:{text:'三间教室：46班、45班、44班。三个钟都停在07:10。脚印从教室走向门外。\n\n第一圈先记住这些，再从右边走廊前进。之后有变化，就走进那间教室指出异常；没有变化，继续走廊。\n\n每走对一圈，门框上的刻痕就多一道。',end:true}}};
TALK.night_done={nodes:{s:{text:'我断开巡夜信号。走廊里的人站住了，灯还在向前移动。\n\n柜门里传出一个声音，和我一模一样：\n「你刚才怎么没叫我一起出来？」\n\n奖励：最终战第一阶段的笑声圈减速。',end:true}}};
TALK.photo_done={nodes:{s:{text:'第三处变化被我圈出来。照片上那个人慢慢转过身。\n\n他的脸跟我一样，手里也拿着一张照片。\n照片里，是我站在门口的背影。\n\n奖励：最终战的影子延迟更长，真假灯有额外标记。',end:true}}};
TALK.loop_done={nodes:{s:{text:'第四道刻痕留下来，门外终于传来打球声。\n\n我跨过门槛，身后还有一双脚步跟了出来。\n我停下。它又走了一步，才停下。\n\n奖励：最终战受伤后的保护时间延长。',end:true}}};
TALK.episode_wrong={nodes:{s:{text:'不太对。先把看到的和记录里的对一遍。\n\n远处有谁也在翻纸，刚好慢我一拍。',end:true}}};
Object.keys(EPISODES).forEach(function(id){
  var e=EPISODES[id],o=episodeObj(e.x,e.y,'可选调查 · '+e.title,'enter_'+id,'door');o.if='可以走动了';
  o._i=MAPS[e.from].objs.length;MAPS[e.from].objs.push(o);MAPS[e.from].allObjs=null;
  TASKS.push({ch:2,t:e.title,f:e.reward,opt:true});
});
Object.assign(CLUES,{
  '避开巡夜':'巡夜灯会照见你，蹲行可以避开脚步声。已取回总闸记录：最终战第一阶段弧线减速。',
  '识破照片':'现实与旧照片的三处变化已经找齐：影子模仿延迟增加，真灯出现额外标记。',
  '走出循环':'记住门牌、时钟和脚印，才找得到出口。最终战受伤后保护时间延长。'
});
var wanderStyle=document.createElement('style');wanderStyle.textContent=`
 #episodeHud{position:absolute;top:76px;left:12px;right:12px;z-index:6;background:rgba(10,13,16,.94);border:1px solid #738a8a;border-left:3px solid #e8a33d;padding:9px 12px;display:none;max-width:530px;font-size:12px;line-height:1.65}
 #episodeHud b{font-size:14px;color:#f4dfb0}#episodeHud i{display:block;height:4px;background:#c37663;margin-top:5px;max-width:100%;transition:width .15s}
 body.in-episode #goal,body.in-episode #prog,body.in-episode #arrow{display:none!important}
 #episodeControls{position:absolute;right:12px;bottom:calc(252px + env(safe-area-inset-bottom,0px));z-index:8;display:flex;flex-direction:column;gap:7px}
 #episodeControls button{background:#15202b;color:#f3e6cc;border:2px solid #67777b;padding:10px 12px;font:600 12px system-ui,sans-serif;border-radius:4px;touch-action:manipulation}
 #episodeControls button[aria-pressed=true]{background:#4d5534;border-color:#cdb779}
 #photoReference{position:absolute;top:174px;left:50%;transform:translateX(-50%);z-index:7;border:3px solid #ddc9a3;background:#19181a;max-width:90vw;width:320px;display:none;pointer-events:none}
 #photoReference canvas{width:100%;display:block;image-rendering:pixelated}#photoReference p{font-size:11px;text-align:center;padding:7px;color:#e6d9be}
 @media(max-height:560px){#episodeHud{top:8px;left:70px;max-width:400px}#photoReference{top:108px;width:240px}#episodeControls{top:90px;left:12px;right:auto;bottom:auto}}
`;document.head.appendChild(wanderStyle);
var episodeHud=document.createElement('div');episodeHud.id='episodeHud';document.body.appendChild(episodeHud);
var episodeControls=document.createElement('div');episodeControls.id='episodeControls';document.body.appendChild(episodeControls);
var photoReference=document.createElement('div');photoReference.id='photoReference';photoReference.innerHTML='<canvas width="320" height="140"></canvas><p>旧照片 · 9月14日 · 对照后调查现场的变化</p>';document.body.appendChild(photoReference);
var crouchBtn=episodeButton('蹲行 · C',function(){if(M.night){if(M.night.hidden){M.night.hidden=false;toast('我走出柜子。',1.5);}else M.night.crouch=!M.night.crouch;clearInput();syncEpisodeUI();}});
var paperBtn=episodeButton('投纸团 · F',throwPaper);
var photoBtn=episodeButton('看旧照片',function(){M.photoView=!M.photoView;clearInput();syncEpisodeUI();});
var exitEpisodeBtn=episodeButton('离开调查',leaveEpisode);
function episodeButton(text,action){var b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',function(e){e.stopPropagation();if(episodeActive())action();});episodeControls.appendChild(b);return b;}
function episodeActive(){return !!(EPISODES[M.map] && M.screen==='play' && !M.book && !M.talk.open && !M.cut && !M.cardT && !M.dying && !document.hidden);}
function enteredEpisode(id){
  if(M.chase||M.boss){toast('先离开追逐，再来调查。');return;}
  loadMap(id,MAPS[id].spawn[0],MAPS[id].spawn[1]);checkpoint('进入可选调查');
  openScript(id+'_intro');syncEpisodeUI();
}
function leaveEpisode(){
  var e=EPISODES[M.map];if(!e)return;
  loadMap(e.from,e.x,e.y+1);recoverPosition();checkpoint('离开可选调查');syncEpisodeUI();
}
function photoRound(){for(var i=0;i<3;i++)if(!flagOn('照片差异'+i))return i;return 3;}
function loopRound(){for(var i=0;i<4;i++)if(!flagOn('循环刻痕'+i))return i;return 4;}
function loopAnswer(){return [ -1,1,0,2 ][Math.min(loopRound(),3)];}
var originalWanderPress=pressObj;
pressObj=function(o){
  if(!o||!o.action){originalWanderPress(o);return;}
  if(!objLive(o)||!episodeActive() && !o.action.startsWith('enter_'))return;
  if(o.action.startsWith('enter_')){enteredEpisode(o.action.slice(6));return;}
  clearInput();M.talk.cool=.2;
  if(o.action==='leave'){leaveEpisode();return;}
  if(o.action==='hide'){
    M.night.hidden=!M.night.hidden;
    if(M.night.hidden){M.night.crouch=true;M.p.x=o.x*TILE+16;M.p.y=(o.y+1)*TILE+16;toast('藏好了。调查柜子或点「出柜子」出来。',2);}
    else toast('我走出柜子。',1.5);
  }else if(o.action==='night_reward'){
    if(M.night.alert>0&&Math.hypot(M.night.x-M.p.x,M.night.y-M.p.y)<TILE*6){toast('脚步太近了。先把巡夜的人引开。',2);return;}
    setFlag('避开巡夜');M.night.alert=0;M.night.meter=0;M.night.path=[];checkpoint('巡夜调查完成');openScript('night_done');
  }else if(o.action.startsWith('photo_')){
    if(photoRound()===3){toast('三个变化都找到了。可以回校史馆。',2);return;}
    var k=Number(o.action.slice(6));
    if(k===[2,1,0][photoRound()]){
      setFlag('照片差异'+photoRound());M.photoView=false;sfxPick();
      if(photoRound()===3){setFlag('识破照片');checkpoint('照片调查完成');openScript('photo_done');}
      else {checkpoint('记下照片差异');toast('变化被圈出来了。房间又换了一遍，再对照旧照片。',3);}
    }else openScript('episode_wrong');
  }else if(o.action.startsWith('loop_')){
    if(loopRound()===4){toast('走廊已经恢复正常。可以回艺术楼。',2);return;}
    var answer=o.action==='loop_clean'?-1:Number(o.action.slice(5));
    if(answer===loopAnswer()){
      setFlag('循环刻痕'+loopRound());sfxPick();M.p.x=16*TILE+16;M.p.y=15*TILE+16;
      if(loopRound()===4){setFlag('走出循环');checkpoint('循环调查完成');openScript('loop_done');}
      else {checkpoint('留下循环刻痕');toast('门框多了一道刻痕。再看一遍三个房间。',2.6);}
    }else {
      M.loopMistakes=(M.loopMistakes||0)+1;M.p.x=16*TILE+16;M.p.y=15*TILE+16;
      toast('又回到这里。没有丢失刻痕，身后的脚步近了一点。',3);sfxStep();
    }
  }
  M.renderDirty=true;syncEpisodeUI();
};
var originalWanderLoad=loadMap;
loadMap=function(id,x,y,dir){
  originalWanderLoad(id,x,y,dir);M.night=null;M.photoView=false;M.loopMistakes=0;
  if(id==='night')M.night={x:4*TILE+16,y:10*TILE+16,dir:'right',point:1,meter:0,alert:0,grace:2.5,path:[],pathT:0,hidden:false,crouch:false,paperCd:0,lure:null,tries:0};
  syncEpisodeUI();
};
window.addEventListener('keydown',function(e){
  if(!episodeActive())return;var k=e.key.toLowerCase();
  if(k==='c'&&M.night&&!e.repeat){M.night.crouch=!M.night.crouch;syncEpisodeUI();}
  if(k==='f'&&M.night&&!e.repeat)throwPaper();
});
function throwPaper(){
  var n=M.night;if(!n||n.hidden)return;
  if(n.paperCd>0){toast('等纸团落地，再投下一个。',1.5);return;}
  var d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[M.p.dir]||[1,0];
  var p=walkableNear(Math.floor(M.p.x/TILE)+d[0]*5,Math.floor(M.p.y/TILE)+d[1]*5,3);if(!p)return;
  n.lure={x:p.x*TILE+16,y:p.y*TILE+16,t:5};n.paperCd=4;n.pathT=0;sfxBlip();toast('纸团落在'+{up:'前面',down:'前面',left:'左边',right:'右边'}[M.p.dir]+'。脚步声转了过去。',2);
}
function sightClear(ax,ay,bx,by){
  var len=Math.hypot(bx-ax,by-ay),steps=Math.ceil(len/12);
  for(var i=1;i<=steps;i++){var x=Math.floor((ax+(bx-ax)*i/steps)/TILE),y=Math.floor((ay+(by-ay)*i/steps)/TILE);if(solidAt(x,y)||doorBlocked(x,y))return false;}
  return true;
}
function guardSees(n){
  if(n.hidden||M.night.hidden)return false;
  var dx=M.p.x-n.x,dy=M.p.y-n.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
  var dir={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[n.dir];
  var da=Math.abs(Math.atan2(Math.sin(a-dir),Math.cos(a-dir)));
  return d<TILE*6&&da<.62&&sightClear(n.x,n.y,M.p.x,M.p.y);
}
function guardPath(n,target){
  var sx=Math.floor(n.x/TILE),sy=Math.floor(n.y/TILE),tx=Math.floor(target.x/TILE),ty=Math.floor(target.y/TILE);
  var q=[[sx,sy]],parents=new Map([[sx+','+sy,null]]),end=null;
  for(var i=0;i<q.length&&i<MAPW*MAPH;i++){
    var p=q[i],k=p.join(',');if(p[0]===tx&&p[1]===ty){end=k;break;}
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var x=p[0]+d[0],y=p[1]+d[1],key=x+','+y;
      if(x<0||y<0||x>=MAPW||y>=MAPH||parents.has(key)||solidAt(x,y)||doorBlocked(x,y))return;
      parents.set(key,k);q.push([x,y]);});
  }
  var path=[];while(end&&parents.get(end)!==null){var a=end.split(',').map(Number);path.unshift({x:a[0]*TILE+16,y:a[1]*TILE+16});end=parents.get(end);}
  return path;
}
function nightTick(dt){
  var n=M.night;if(!n||flagOn('避开巡夜'))return;
  n.grace=Math.max(0,n.grace-dt);n.paperCd=Math.max(0,n.paperCd-dt);n.alert=Math.max(0,n.alert-dt);
  if(n.lure){n.lure.t-=dt;if(n.lure.t<=0)n.lure=null;}
  var near=Math.hypot(M.p.x-n.x,M.p.y-n.y);
  var noise=!n.hidden&&M.p.moving&&!n.crouch&&near<TILE*((keys.shift||M.run)?7:2.5)&&sightClear(n.x,n.y,M.p.x,M.p.y);
  if(n.grace<=0&&(guardSees(n)||noise))n.meter=Math.min(1,n.meter+dt*1.4);else n.meter=Math.max(0,n.meter-dt*.8);
  if(n.meter>=1){if(n.alert<=0){toast('灯转过来了。找柜子，或者把他引开！',2);sfxBell(1);}n.alert=4;}
  var patrol=[[4,10],[27,10],[28,16],[4,16]],p=patrol[n.point];
  var target=n.lure||{x:p[0]*TILE+16,y:p[1]*TILE+16};
  if(n.alert>0&&!n.hidden&&!n.lure)target={x:M.p.x,y:M.p.y};
  if(!n.lure&&n.alert<=0&&Math.hypot(n.x-target.x,n.y-target.y)<6)n.point=(n.point+1)%patrol.length;
  n.pathT-=dt;if(n.pathT<=0){n.pathT=.25;n.path=guardPath(n,target);}
  var next=n.path[0];if(next){
    var dx=next.x-n.x,dy=next.y-n.y,d=Math.hypot(dx,dy),speed=n.alert>0?94:52;
    n.dir=faceTowards(n.x,n.y,next.x,next.y);
    if(d<=speed*dt){n.x=next.x;n.y=next.y;n.path.shift();}else {n.x+=dx/d*speed*dt;n.y+=dy/d*speed*dt;}
  }
  if(n.grace<=0&&!n.hidden&&near<19){
    var tries=n.tries+1;loadMap('night',3,16);M.night.tries=tries;checkpoint('巡夜重试');
    toast('灯照到我脸上，里面却没有人。回到侧廊入口，线索仍在。',3);shake(.35);
  }
}
var originalWanderUpdate=update;
update=function(dt){
  originalWanderUpdate(dt);
  if(episodeActive()){if(M.map==='night')nightTick(dt);syncEpisodeUI();}
  else syncEpisodeUI();
};
var episodeHudSig='';
function displayEpisode(el,value){if(el.style.display!==value)el.style.display=value;}
function syncEpisodeUI(){
  var active=episodeActive(),e=EPISODES[M.map];
  document.body.classList.toggle('in-episode',!!e&&M.screen==='play');
  displayEpisode(episodeHud,active?'block':'none');displayEpisode(episodeControls,active?'flex':'none');
  displayEpisode(crouchBtn,active&&M.map==='night'?'':'none');displayEpisode(paperBtn,active&&M.map==='night'?'':'none');
  displayEpisode(photoBtn,active&&M.map==='photo'?'':'none');displayEpisode(photoReference,active&&M.map==='photo'&&M.photoView?'block':'none');
  if(!active)return;
  var detail='',meter=0;
  if(M.map==='night'){
    var n=M.night;if(!n)return;var label=n.hidden?'出柜子':n.crouch?'蹲行中 · C':'蹲行 · C';
    if(crouchBtn.textContent!==label)crouchBtn.textContent=label;
    if(crouchBtn.getAttribute('aria-pressed')!==String(n.crouch))crouchBtn.setAttribute('aria-pressed',String(n.crouch));
    if(paperBtn.disabled!==n.hidden)paperBtn.disabled=n.hidden;
    detail=flagOn(e.reward)?'信号已断开，可以返回。':n.hidden?'藏身中 · 脚步声会经过柜门。调查或点「出柜子」出来。':n.alert>0?'他在找你 · 引开灯光，再去右上角总闸。':n.crouch?'蹲行中 · 保持在灯光外，调查柜子可藏身。':'灯光会照见你；跑动更容易被听见。右上角是总闸。';
    meter=Math.round(n.meter*10)*10;
  }else if(M.map==='photo'){detail='已认出 '+photoRound()+'/3 处变化 · 对照旧照片，走近变化的物件调查。';var label=M.photoView?'收起照片':'看旧照片';if(photoBtn.textContent!==label)photoBtn.textContent=label;}
  else detail='门框刻痕 '+loopRound()+'/4 · '+(loopRound()===0?'先记住三个房间，再沿右边走廊前进。':'有异常就进那间指出；没有异常就沿右边前进。');
  var sig=M.map+':'+detail+':'+meter;if(sig!==episodeHudSig){episodeHudSig=sig;episodeHud.innerHTML='<b>可选调查 · '+e.title+'</b><br>'+detail+(M.map==='night'?'<i style="width:'+meter+'%"></i>':'');}
}
function photoVariants(old){
  var values=[0,0,0],r=photoRound();if(!old&&r<3)values[[2,1,0][r]]=1;return values;
}
function drawPhotoProp(ctx,k,v,x,y){
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#1b2024';ctx.fillRect(-38,-34,76,68);ctx.strokeStyle='#7e8071';ctx.lineWidth=2;
  if(k===0){
    ctx.fillStyle='#7d5530';ctx.fillRect(-23,-8,46,10);ctx.fillRect(-20,2,4,19);ctx.fillRect(16,2,4,19);
    ctx.fillStyle='#bba383';ctx.fillRect(-12,-28,24,18);ctx.fillRect(-12,-10,4,8);ctx.fillRect(8,-10,4,8);
    if(v){ctx.fillStyle='#313340';ctx.fillRect(-8,-26,16,22);ctx.fillStyle='#dac9a6';ctx.fillRect(-5,-34,10,9);}
  }else if(k===1){
    ctx.fillStyle='#83a8b6';ctx.fillRect(-26,-23,52,45);ctx.strokeRect(-26,-23,52,45);
    var panes=v?4:3;for(var j=1;j<panes;j++){ctx.beginPath();ctx.moveTo(-26+52*j/panes,-23);ctx.lineTo(-26+52*j/panes,22);ctx.stroke();}
  }else {
    ctx.fillStyle='#e7dcc5';ctx.beginPath();ctx.arc(0,-5,25,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#33342e';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(-10,8);ctx.moveTo(0,-5);ctx.lineTo(v?19:17,v?-10:-15);ctx.stroke();
    ctx.font='bold 12px monospace';ctx.fillStyle='#e7dcc5';ctx.textAlign='center';ctx.fillText(v?'07:11':'07:10',0,33);
  }
  ctx.restore();
}
var pc=photoReference.querySelector('canvas').getContext('2d');pc.fillStyle='#171a1c';pc.fillRect(0,0,320,140);
[0,1,2].forEach(function(k){drawPhotoProp(pc,k,0,55+k*105,66);pc.fillStyle='#d8caac';pc.font='12px sans-serif';pc.textAlign='center';pc.fillText(['① 空椅子','② 三格窗','③ 07:10'][k],55+k*105,124);});
function drawWanderWorld(){
  cx.save();
  if(M.map==='night'&&M.night){
    var n=M.night,a={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[n.dir];
    if(flagOn('避开巡夜'))a+=Math.sin(M.t*.6)*.35;
    cx.fillStyle='rgba(4,9,20,.76)';cx.fillRect(0,0,MAPW*TILE,MAPH*TILE);
    allObjs().forEach(function(o){if(!o.action)return;var x=o.x*TILE+16,y=o.y*TILE+TILE;drawObj(o.art,x,y);
      if(Math.hypot(x-M.p.x,y-16-M.p.y)<100){cx.font='600 12px sans-serif';cx.textAlign='center';cx.fillStyle='#e6dcc4';cx.fillText(o.who,x,y-63);}
    });
    if(!n.hidden)drawSprite(M.me.id,M.p.x,M.p.y,M.p.dir,M.p.anim,M.p.moving,2);
    cx.fillStyle=n.alert>0?'rgba(232,80,72,.16)':'rgba(232,212,130,.15)';cx.beginPath();cx.moveTo(n.x,n.y);
    for(var j=0;j<=12;j++){
      var ray=a-.62+j/12*1.24,r=12;
      while(r<TILE*6&&!solidAt(Math.floor((n.x+Math.cos(ray)*r)/TILE),Math.floor((n.y+Math.sin(ray)*r)/TILE)))r+=12;
      cx.lineTo(n.x+Math.cos(ray)*r,n.y+Math.sin(ray)*r);
    }cx.closePath();cx.fill();drawSprite('teacher',n.x,n.y,n.dir,M.t*.7,!!n.path.length,2);
    cx.font='bold 12px sans-serif';cx.textAlign='center';cx.fillStyle='#e5dbb9';cx.fillText(n.alert>0?'他在找你':'巡夜灯',n.x,n.y-57);
    if(n.lure){cx.fillStyle='#f6efda';cx.fillRect(n.lure.x-4,n.lure.y-4,8,8);cx.strokeStyle='#d1b668';cx.beginPath();cx.arc(n.lure.x,n.lure.y,8+(5-n.lure.t)%1*18,0,7);cx.stroke();}
    if(n.hidden){cx.fillStyle='rgba(6,8,12,.7)';cx.fillRect(M.p.x-24,M.p.y-55,48,70);cx.fillStyle='#e5dbb9';cx.fillText('藏身中',M.p.x,M.p.y-40);}
  }else if(M.map==='photo'){
    var variants=photoVariants(false),positions=[[5,6],[18,6],[12,10]];
    positions.forEach(function(p,k){drawPhotoProp(cx,k,variants[k],p[0]*TILE+16,p[1]*TILE+4);cx.fillStyle='#ecd4a1';cx.font='bold 15px sans-serif';cx.textAlign='center';cx.fillText(['①','②','③'][k],p[0]*TILE+16,p[1]*TILE-44);});
  }else if(M.map==='loop'){
    var round=loopRound();[6,16,26].forEach(function(x,k){
      cx.fillStyle='#ded5bf';cx.fillRect(x*TILE-10,8*TILE,80,46);cx.fillStyle='#30352d';cx.font='bold 13px sans-serif';cx.textAlign='center';
      cx.fillText(round===2&&k===0?'64班':['46班','45班','44班'][k],x*TILE+30,8*TILE+17);
      cx.fillText(round===1&&k===1?'07:09':'07:10',x*TILE+30,8*TILE+34);
      var inward=round===3&&k===2;cx.fillStyle='#a3aca4';
      for(var j=0;j<3;j++){var px=(x+(j%2)*.5)*TILE+16,py=(8.8+j*.65)*TILE;cx.fillRect(px-2,py-3,5,8);cx.beginPath();cx.moveTo(px-5,py+(inward?-8:12));cx.lineTo(px+6,py+(inward?-8:12));cx.lineTo(px,py+(inward?-14:18));cx.fill();}
    });
    if(M.loopMistakes){cx.globalAlpha=.3;drawSprite(M.me.id,16*TILE+16,(17-Math.min(2,M.loopMistakes)*.6)*TILE,'up',0,false,2);cx.globalAlpha=1;}
  }
  var boss=M.boss;
  if(boss&&boss.echo){cx.globalAlpha=.5;drawSprite(M.me.id,boss.echo.x,boss.echo.y,boss.echo.dir,0,false,2);cx.globalAlpha=1;cx.strokeStyle='#b8a7d8';cx.beginPath();cx.ellipse(boss.echo.x,boss.echo.y+3,19,10,0,0,7);cx.stroke();}
  if(boss&&boss.hp===1&&boss.open>0&&boss.lit>=0){
    var fake=boss.plats[(boss.lit+1)%3],x=fake.x*TILE+16,y=fake.y*TILE+16;
    if(boss.t%1.2<.4){cx.strokeStyle='rgba(255,255,255,.85)';cx.lineWidth=4;cx.beginPath();cx.ellipse(x,y+12,42,22,0,0,7);cx.stroke();}
    if(flagOn('识破照片')){var real=boss.plats[boss.lit];cx.fillStyle='#f1db94';cx.font='bold 13px sans-serif';cx.textAlign='center';cx.fillText('照片里的真灯',real.x*TILE+16,real.y*TILE-30);}
  }
  cx.restore();
}
var originalWanderBossTick=bossTick;
bossTick=function(dt){
  var b=M.boss;if(!b)return;var lives=b.lives;
  originalWanderBossTick(dt);if(M.boss!==b)return;
  if(b.lives<lives&&flagOn('走出循环'))b.inv+=.5;
  if(flagOn('避开巡夜')&&b.hp===3)b.rings.forEach(function(r){if(!r.nightSlow){r.spd*=.85;r.nightSlow=true;}});
  if(b.hp!==2){b.echo=null;b.echoTrail=[];b.echoT=0;return;}
  b.echoT=(b.echoT||0)+dt;b.echoTrail=b.echoTrail||[];
  if(b.echoT>=.12){b.echoT=0;b.echoTrail.push({x:M.p.x,y:M.p.y,dir:M.p.dir});if(b.echoTrail.length>(flagOn('识破照片')?26:18))b.echo=b.echoTrail.shift();}
  if(b.echo&&b.inv<=0&&Math.hypot(b.echo.x-M.p.x,b.echo.y-M.p.y)<17){
    b.lives--;b.inv=1.8+(flagOn('走出循环')?.5:0);b.hurt=.5;shake(.4);flashRed();bossHudDraw(true);
    if(b.lives<=0){M.bossRetryHp=b.hp;M.boss=null;M.bossRetryT=1.2;bossHud(false);droneOff();toast('影子追上了。保留已关闭的节点，从这一阶段重试。',3);}
    else toast('影子重复你刚才的路。别回到它走过的位置。',2.5);
  }
};
var originalWanderBossHit=bossHit;
bossHit=function(o){var b=M.boss,inv=b&&b.inv;var result=originalWanderBossHit(o);if(M.boss&&M.boss===b&&flagOn('走出循环')&&b.inv!==inv)b.inv+=.5;return result;};
var originalWanderBuildBook=buildBook;
buildBook=function(){originalWanderBuildBook();bookList.insertAdjacentHTML('beforeend','<h3>探索玩法 · 校园后门</h3>'+Object.keys(EPISODES).map(function(id){var e=EPISODES[id];return '<p>'+(flagOn(e.reward)?'✓':'○')+' <b>'+e.title+'</b><br>'+escapeHTML(e.location||{night:'第三教学楼 · 西侧走廊门：躲灯、藏身、投纸团。',photo:'校史馆 · 南侧展厅门：对照旧照片找三处变化。',loop:'艺术楼 · 西侧走廊门：记住门牌、时钟和脚印。'}[id])+'</p>';}).join(''));};
syncEpisodeUI();
