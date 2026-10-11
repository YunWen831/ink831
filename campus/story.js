/* 第十九声：章节、调查内容与轻量绘制。无构建依赖，直接兼容 GitHub Pages。 */
'use strict';
var DEBUG = /[?&](debug|probe|boss)(=|&|$)/.test(location.search);
document.body.classList.toggle('debug',DEBUG);

function clearInput(){ keys = {}; if (typeof stickEnd === 'function') stickEnd(); }
function resetTransient(){
  clearInput(); droneOff();
  ['cut','cutAfter','nodeCard','cardT','chase','boss','bossPending','bossEnding','bossRetryT',
   'showOverAfter','resolveAfter','endAfter','killAfter','cpPending','stillKey','stillT',
   'stillWarn','backTo','deathMsg','dying','stare','replay','saveT','ignoreDoors'].forEach(function(k){ delete M[k]; });
  M.talk = freshTalk(); M.book = false; M.renderDirty = true;
  hidePad(); hidePress(); bossHud(false);
  [cardEl,dlgEl,bookEl,chaseEl].forEach(function(el){ if(el) el.classList.remove('on'); });
}
function finishCard(){
  M.cardT = 0; cardEl.classList.remove('on'); M.renderDirty = true;
  if (M.nodeCard){ M.nodeCard = false; advanceOrChoose(); }
  else if (M.cpPending){ M.cpPending = null; checkpoint(); }
}
function recoverPosition(){
  if (canWalk(M.p.x,M.p.y)) return;
  var start = [Math.floor(M.p.x/TILE),Math.floor(M.p.y/TILE)];
  var q=[start], seen={};
  for(var i=0;i<q.length && i<MAPW*MAPH;i++){
    var p=q[i], key=p.join(','); if(seen[key]) continue; seen[key]=true;
    if(p[0]<0 || p[1]<0 || p[0]>=MAPW || p[1]>=MAPH) continue;
    var x=p[0]*TILE+16,y=p[1]*TILE+16;
    if(canWalk(x,y)){ M.p.x=x; M.p.y=y; return; }
    q.push([p[0]+1,p[1]],[p[0]-1,p[1]],[p[0],p[1]+1],[p[0],p[1]-1]);
  }
  M.p.x=CUR.spawn[0]*TILE+16; M.p.y=CUR.spawn[1]*TILE+16;
}

var TILE_CACHE = new Map(), tilePaints=0, tileCacheHits=0;
function clearTileCache(){ TILE_CACHE.clear(); }
function drawCachedTiles(x0,y0,x1,y1){
  var size=12, original=cx;
  for(var by=Math.floor(y0/size);by<=Math.floor(y1/size);by++){
    for(var bx=Math.floor(x0/size);bx<=Math.floor(x1/size);bx++){
      var key=M.map+':'+bx+','+by, cached=TILE_CACHE.get(key);
      if(!cached){
        cached=document.createElement('canvas'); cached.width=cached.height=size*TILE;
        cx=cached.getContext('2d'); cx.translate(-bx*size*TILE,-by*size*TILE);
        try {
          for(var y=by*size;y<Math.min(MAPH,(by+1)*size);y++)
            for(var x=bx*size;x<Math.min(MAPW,(bx+1)*size);x++){
              drawTile(MAP[y][x]==='door'?'floor':MAP[y][x],x*TILE,y*TILE); tilePaints++;
            }
        } finally { cx=original; }
        if(TILE_CACHE.size>=12) TILE_CACHE.delete(TILE_CACHE.keys().next().value);
        TILE_CACHE.set(key,cached);
      } else { tileCacheHits++; TILE_CACHE.delete(key); TILE_CACHE.set(key,cached); }
      original.drawImage(cached,bx*size*TILE,by*size*TILE);
    }
  }
  for(var dy=y0;dy<=y1;dy++) for(var dx=x0;dx<=x1;dx++)
    if(MAP[dy][dx]==='door') drawTile('door',dx*TILE,dy*TILE);
}
var tensionEl=document.getElementById('tension'), tensionValue=-1;
function tensionTick(){
  var v=Math.round((M.laugh||0)*100);
  if(v===tensionValue) return; tensionValue=v;
  tensionEl.classList.toggle('on',v>5 && !M.boss && !M.chase);
  tensionEl.classList.toggle('high',v>=55); tensionEl.querySelector('i').style.width=v+'%';
}
function changeQuality(){
  QUALITY=QUALITY==='low'?'balanced':'low'; DPR_CAP=QUALITY==='low'?1:1.5;
  try{ localStorage.setItem('ink831:quality',QUALITY); }catch(e){}
  qualityLabel(); resize(); clearTileCache(); M.renderDirty=true;
}
function qualityLabel(){
  ['btnQuality','btnQualityBook'].forEach(function(id){
    document.getElementById(id).textContent='画质：'+(QUALITY==='low'?'省电 · 30帧':'标准');
  });
}
['btnQuality','btnQualityBook'].forEach(function(id){ document.getElementById(id).addEventListener('click',function(e){ e.stopPropagation(); changeQuality(); }); });
qualityLabel();
// The pen scene must finish before the stairs can change maps.
MAPS.school1.portals.forEach(function(p){if(p.to==='floor2')p.if='有翻译笔';});
MAPS.floor2.objs.find(function(o){return o.talk==='ld_45room';}).if='念名声过去了';
TALK.ld_45room={nodes:{s:{text:'点名声过去了。我推开东头那扇门。\n\n屋里停在周五早读。黑板上有一块被反复擦过的白痕。\n桌上那本作业，姓名栏正慢慢浮出「顾言」两个字。',set:'45班那间教室',end:true}}};

function step(ch,t,f,map,x,y,scripts){ return {ch:ch,t:t,f:f,map:map,x:x,y:y,scripts:scripts||[]}; }
var INTRO_STEPS=[
  step(1,'看看保安室的窗','到校','campus',32,117,['open_arrive']),
  step(1,'推开一号教学楼的门','进了教学楼','campus',23,81,['open_bell']),
  step(1,'调查46班自己的课桌','纸条','school1',24,12,['open_class']),
  step(1,'读教室后墙的守则','看过守则','school1',24,14,['rule_sheet']),
  step(1,'离开教室，到走廊看看','可以走动了','school1',19,11,['free_laoli','free_shui','free_logic'])
];
var ROUTE_STEPS={
  laoli:[
    step(2,'听走廊的点名：只答自己的名字','答过到','school1',19,15,['pz_rollcall']),
    step(2,'去校门口，向值周生借旧名单','拿过名单','campus',37,119,['hint_duty']),
    step(2,'回46班，数两遍讲台上的点名册','数过两遍','school1',23,14,['scare_count'])
  ],
  shui:[
    step(2,'后山墙根：先擦开苔藓，寻找刻字','看到六块苔','hill',2,3,['wipe_intro']),
    step(2,'按守则六条的开头顺序擦墙','擦完墙','hill',6,4,['wipe_1','wipe_2','wipe_3','wipe_4','wipe_5','wipe_6']),
    step(2,'看一号教学楼45班的黑板','看过黑板式子','school1',9,8,['pw_board']),
    step(2,'实验楼：核对元素符号','查过周期表','lab',15,5,['pw_table']),
    step(2,'行政楼：解开lg7办公桌的锁','拿回手机','office',6,21,['pw_drawer'])
  ],
  logic:[
    step(2,'看走廊的楼层平面图','看过平面图','school1',20,20,['lg_floorplan']),
    step(2,'核对走廊的门牌','数过门牌','school1',19,22,['lg_plates']),
    step(2,'翻办公室门口的登记表','看过登记表','school1',20,13,['lg_classbook']),
    step(2,'在楼梯口，指出没有门牌的教室','logic承认了','school1',16,10,['logic_route'])
  ]
};
var FINAL_STEPS=[
  step(3,'楼梯西侧：拿到lg7留下的翻译笔','有翻译笔','school1',16,9,['lg7_pen']),
  step(3,'沿中庭楼梯上到二楼','上过二楼','floor2',5,12,['f2_enter']),
  step(3,'往东走，听清点名来自哪里',['走廊在念名字','念名声过去了'],'floor2',30,12,['f2_rollcall']),
  step(3,'退回西侧楼梯口，让声音先过去','念名声过去了','floor2',5,12,['f2_wait']),
  step(3,'进东头教室，用翻译笔读黑板','译出化学笔记','floor2',42,3,['f2_pen']),
  step(3,'离开东头教室，检查走廊广播','该去科技楼了','floor2',30,12,['f2_alarm']),
  step(4,'去最北面的科技楼，寻找广播总控','被追了','tech',33,13,['chase_go']),
  step(4,'穿过人排，向南冲出校门','冲出校门','campus',39,123,[]),
  step(4,'和lg7谈谈，决定是否返回','返回辅导室','campus',33,120,['final_gate']),
  step(5,'调查最后一排的人，让他记起自己的名字','替他答了','resolve',13,5,['rs_open','him']),
  step(5,'停止笑声：躲圈，按亮着的讲桌','干掉奶蛙','arena',17,17,[])
];
function mainSteps(){ return INTRO_STEPS.concat(ROUTE_STEPS[M.me?M.me.id:'laoli'],FINAL_STEPS); }
function mainStep(){ return mainSteps().find(function(s){return !taskDone(s);}) || FINAL_STEPS[FINAL_STEPS.length-1]; }
function mainGoal(){
  var s=mainStep(), g={t:s.t,map:s.map,x:s.x,y:s.y};
  // A notebook can be explored from any building without changing this main objective.
  if(s.f==='擦完墙'){ g.x=10;g.y=7; }
  if(s.f!=='擦完墙' && M.map===g.map && s.scripts.length){
    var O=objByTalkHere(s.scripts[0]); if(O){var p=standPoint(O);g.x=p.x;g.y=p.y;}
  }
  return g;
}
function mainAllowed(name){
  if(!name) return true;
  if(/^free_/.test(name)) return name==='free_'+(M.me?M.me.id:'laoli') && flagOn('看过守则');
  var exclusive={shui:['wipe_intro','wipe_1','wipe_2','wipe_3','wipe_4','wipe_5','wipe_6','pw_board','pw_table','pw_drawer','sh_group','sh_chat','sh_laugh','shui_fork'],
    logic:['logic_route','lg_floorplan','lg_plates','lg_classbook','lg_game','lg_zzx','lg_told'],
    laoli:['pz_rollcall','scare_count','ld_radio','ld_45','ld_steps']};
  for(var who in exclusive) if(exclusive[who].includes(name) && (!M.me || M.me.id!==who)) return false;
  if(name==='hint_duty') return !!(M.me && M.me.id==='laoli' && flagOn('答过到'));
  var own=mainSteps().find(function(s){return s.scripts.includes(name);});
  if(!own) return true;
  return taskDone(own) || own===mainStepReference();
}
function mainStepReference(){ return mainSteps().find(function(s){return !taskDone(s);}); }
// Visiting a puzzle is not completing it. Check its reward so existing saves
// containing a failed attempt can retry without losing any other progress.
var RETRY_FLAGS={lg_hooks:'数过名单',lg_windows:'数过窗户',h3_log:'数过广播记录',
  f2_roster:'算过值日表',f2_phone:'看过那局游戏'};
function beatSpent(beat,key){
  if(!FLAGS[key]) return false;
  var st=mainSteps().find(function(s){return s.scripts.includes(beat.talk);});
  if(st) return taskDone(st);
  if(RETRY_FLAGS[beat.talk]) return flagOn(RETRY_FLAGS[beat.talk]);
  return true;
}
// mainSteps concatenates the original step objects, so references stay stable.
function chapterNow(){ return mainStep().ch; }
function progressNow(){var all=mainSteps().filter(function(s){return s.ch===chapterNow();}); return {ch:chapterNow(),n:all.length,d:all.filter(taskDone).length};}
var oldOptional=TASKS.filter(function(t){return t.opt;});
TASKS=INTRO_STEPS.concat(Object.keys(ROUTE_STEPS).flatMap(function(w){return ROUTE_STEPS[w].map(function(s){return Object.assign({who:w},s);});}),FINAL_STEPS,oldOptional);
var originalBook=buildBook;
buildBook=function(){
  originalBook();
  var g=mainGoal();
  bookList.insertAdjacentHTML('afterbegin','<h3>当前主线 · '+['','空座位','三份证词','停住的早读','熄灯前','第十九声'][chapterNow()]+'</h3><p><b>'+escapeHTML(g.t)+'</b></p><p class="dim">调查其他建筑不会改变主线。支线奖励会带入最终战。</p>');
  bookList.insertAdjacentHTML('beforeend','<h3>可选调查 · 三处回声</h3>'+[
    ['切断广播','第三教学楼 · 广播室','取出旧录音，减少笑欲与追逐压力'],
    ['校准节拍','艺术楼 · 东侧琴房','先读谱架，再打开琴盖，延长反击窗口'],
    ['保住底片','校史馆 · 南侧展厅','比较合照和玻璃柜的底片，减慢攻击']
  ].map(function(r){return '<p>'+(flagOn(r[0])?'✓':'○')+' <b>'+r[1]+'</b><br>'+r[2]+'</p>';}).join(''));
};
function repairLegacySave(version){
  if(version===2) return;
  // v19 could consume an object/trigger before its scene interrupted the dialogue.
  Object.keys(MAPS).forEach(function(id){
    var map=MAPS[id];
    (map.objs||[]).forEach(function(o){
      var st=mainSteps().find(function(s){return s.scripts.includes(o.talk);});
      if(st && !taskDone(st)) delete FLAGS['@obj:'+id+':'+o._i];
    });
    (map.triggers||[]).forEach(function(t,i){
      var st=mainSteps().find(function(s){return s.scripts.includes(t.talk);});
      if(st && !taskDone(st)) delete FLAGS['@'+id+':'+i];
    });
  });
  if(flagOn('是:laoli')) ['该去后山了','该上二楼了'].forEach(clearFlag);
  if(flagOn('是:shui')) ['该查名单了','该上二楼了'].forEach(clearFlag);
  if(flagOn('是:logic')) ['该查名单了','该去后山了'].forEach(clearFlag);
}

function writeNode(script,id,text,extra){
  TALK[script].nodes[id]=Object.assign({},TALK[script].nodes[id],{text:text},extra||{});
}
writeNode('open_arrive','s','六点五十。我到校了。保安室的窗里压着一张旧通知。');
writeNode('open_arrive','t','「9月14日，实验楼三层暂停使用。」\n\n今天已经十八日。通知背面还有一行铅笔字：\n「点到空座位时，别替他回答。」');
writeNode('open_class','t','十九个人。我数了两遍。可老师念了二十个名字。\n\n最后那一声「到」，从后排空出来的椅子上传来。');
writeNode('open_class','u','老师合上名册，又从头点了一遍。\n前排有人笑了。接着是第二个，第三个。\n\n老师也笑起来，手里的笔却在纸上写：\n「别跟着数第三遍。」');
writeNode('open_class','x','我的课桌里塞着半张旧照片。背面写着「顾言，9月14日」。\n\n另有一张纸条，是我自己的字：\n「如果今天又是十八日，去找剩下的那半张。」');
writeNode('free_laoli','s','顾言跟我小学同过桌。周五以后，别人都说不认识他。\n\n我认得那半张照片。先拿点名册和旧名单对一遍。');
writeNode('free_shui','s','周五我替lg7搬过一个黄色样品。瓶子里有张纸，写着我的名字。\n\n他没收的手机里有当时的照片。我得拿回来，看看自己究竟搬了什么。');
writeNode('free_logic','s','我借过东头那间安静的教室。每次出来，手机上的时间都少八分钟。\n\n今天门牌又少了一块。先拿图纸、门牌和登记表对一下。');
writeNode('hint_duty','r3','值周生翻开旧名单。\n\n「现有十九人。旧录音却会多念一个：顾言。」\n\n第一行被划穿，背页还留着笔印。我把它拓到纸上。');
writeNode('pw_drawer','t','锁边贴着便签：\n「密码按黑板式子里的原子个数，不按元素序号。」\n\n下面多了一行小字：\n「不要播放九月十四日的录音。」');
TALK.pw_drawer.nodes.u.esc=true;
TALK.pw_drawer.nodes.no.next='u';
delete TALK.pw_drawer.nodes.no.end;
writeNode('pw_drawer','ok4','手机里最后一张照片拍在周五07:10。\n顾言站在讲台边，手里捧着黄色样品。\n\n照片里没有人笑。视频却传出一整间教室的笑声。');
writeNode('lg7_pen','w','他把笔递过来。\n「那不是翻译，是还原。擦掉的字，它还能读出来。」');
writeNode('lg7_pen','x','「笔记是顾言写的。上周五，我让他留下来记录实验。」\n\n他握着笔，不肯松手。\n「如果看到他，告诉他今天已经十八日。」');
writeNode('f2_pen','use3','最后一行：\n「07:10，样品开始模仿点名。\n断电以后，仍然有人回答。\n老师，如果我没出来，请别把我的名字擦掉。」\n\n签名：顾言。');
writeNode('f2_alarm','u','广播里念的是周五的日期。\n有人按了停止，它又从第一句开始。');
writeNode('f2_alarm','v','科技楼的总控还能关掉它。\n\n我在走廊玻璃上看见自己的倒影。倒影没有跟我一起转身。');
writeNode('nw_notebook','s','实验记录，9月14日。\n项目名称是荧光凝胶，同学给黄色样品起了个外号：「奶蛙」。');
writeNode('nw_notebook','t','07:06，样品复现了敲击声。\n07:09，复现老师的点名。\n07:10，顾言回答后，录音里多出一声笑。\n\n后面换成了另一种笔迹：「断电无效。」');
writeNode('nw_notebook','u','最后一页：\n「它不是在学我们笑。\n它在等我们承认，屋里根本没有第二十个人。」\n\n顾言的名字被划掉了。划痕背后却写着：\n「不要把我留在这里。」',{set:'合成记录',end:true,next:undefined});
writeNode('rs_open','t','我回到辅导室。墙上的钟停在周五07:10。\n\n桌上十九份卷子。最后一排还有一个人，面前没有卷子。');
writeNode('rs_open','u','他抬起头。\n\n是顾言。\n「你们点完名了吗？我等了好久。」');
writeNode('him','name','「顾言。」\n\n他抬起头。\n「不是。他们说名单上没有我。」');
writeNode('him','name2','我把背页的笔印指给他看。\n\n「划掉以后，字还在。你也在。」');
writeNode('him','what','「那天老师让我留下来记录。我听见样品叫我的名字。」');
writeNode('him','what2','「我答了一声。后来门外也有人答。\n大家说多了一个，让我先别出去。」\n\n他指着钟：「是不是还没下课？」');
writeNode('him','box','我告诉他，lg7仍然每天来后山。\n\n他低头看着手上的粉笔灰。\n「那他为什么一直不进来？」');
writeNode('him','box2','「如果你见到他，别说我没来上课。\n我一直在这里。」');
writeNode('him','ans4','「顾言在这里。」\n\n这次，我没有冒充他的声音。\n\n走廊里那一行名字，第一次念到了最后。');
writeNode('him','kill5','讲台上的样品突然涨大。笑声推成一圈圈金色弧线。\n\n三个讲桌上的指示灯亮了一下。它在模仿点名时，就是从这里发出声音的。',{scene:undefined});
TALK.him.nodes.kill6={text:'躲开金色弧线，缺口是安全的。\n\n等它停止发圈，跑到亮着的讲桌，按调查。\n停掉三个回声点，就能结束。\n\n失败会直接重试，已找到的线索保留。',card:true,boss:true,end:true};
writeNode('boss_end','u','他走到最后一排，蹲在顾言面前。\n「我把你的名字划掉了。我以为这样就能让录音停下来。」');
writeNode('boss_end','v','「可是每一天，它还是会点到你。」\n\n他把那张旧报名表摊在桌上。');
writeNode('boss_end','w','顾言看着他，一直没有笑。\n\nlg7用笔把划掉的名字重新写上去。');
writeNode('boss_end','x','广播里终于传来下一句话：\n「点名结束。」\n\n窗外，放学铃第一次完整地响完了。');
TALK.final_gate.nodes.v.opts=[
  {t:'把笔记交给lg7，和他返回辅导室',go:'return'},
  {t:'现在离开学校，让这件事留在里面',go:'go'}
];
TALK.final_gate.nodes.return={text:'「顾言没有迟到。他一直在等你。」\n\nlg7接过笔记，把皱掉的报名表展开。\n\n「这次我跟你进去。」',set:'告诉lg7',end:true};
TALK.final_gate.nodes.go3={text:'我到了街上。后面的校门合起来。\n\n手机震了一下：\n「46班，全员到齐。」\n发送者：顾言。',set:'选择离校',end:true};

SCENES.open_laugh=[{text:'六点五十。校门里的笑声整齐地停了一秒。\n\n广播念出我的名字。',secs:3}];
SCENES.open_class_laugh=[{text:'空座位上，有人替我拉开了椅子。\n\n所有人一起看过来。',secs:3,laugh:0.5}];
SCENES.route_laoli=[{text:'牢李 · 被划掉的名字\n\n他不是陌生人。我不会认错。',secs:2.5}];
SCENES.route_shui=[{text:'水哥 · 手机里的周五\n\n我搬过那个样品。照片里应该有证据。',secs:2.5}];
SCENES.route_logic=[{text:'logic · 第四间教室\n\n图纸只有三间。多出来的那间是谁在用？',secs:2.5}];
SCENES.noon_nobody=[{text:'十二点。楼下响起打饭铃。\n\n窗里的学生仍在翻早读的第一页。',secs:3}];
SCENES.bell_nobody=[{text:'十七点三十。放学铃响到一半，变成了早读铃。\n\n学校要把今天重新开始。',secs:3,bell:2}];
SCENES.line_up=[{text:'二十一点三十。\n\n走廊的人排成一行。前面的人回过头，一个个数过来。',secs:3},
  {text:'熄灯前，必须到校门。\n\n人排里的缺口还在移动。',secs:3,laugh:0.5}];
SCENES.what_happened=[{text:'九月十四日，顾言留下来记录实验。\n\n样品学会了他的名字。学校删除了名字，却留下了每天重复的点名。',secs:4},
  {text:'今天，我们停掉了回声。\n\n也终于有人承认，那天被留下的是一个学生。',secs:3}];

// Three optional investigations with tangible rewards; none changes a main-route flag.
TALK.radio_case={nodes:{
  s:{text:'广播机正在播放一段录音。\n「你刚才推开门，走了六步。现在站在机器前面。」\n\n计时器却显示07:10。',next:'t'},
  t:{text:'三路信号：\nA：07:10，循环标记。\nB：当前时间，麦克风输入。\nC：放学铃，待机。\n\n应该先停掉哪路？',esc:true,opts:[{t:'A：停掉重复的旧录音',go:'ok'},{t:'B：拔掉现场麦克风',go:'no'},{t:'C：关掉放学铃',go:'no'}]},
  no:{text:'笑声停了一拍，机器又念了一遍刚才的话。\n\n旧录音的计时器仍停在07:10。',end:true},
  ok:{text:'我取出A路的磁带。机器还转了半圈，停了。\n\n空白磁带上慢慢浮出一行字：\n「谢谢。现在它听不见你了。」\n\n奖励：环境笑欲不再上涨；追逐人排的缺口更宽。',set:'切断广播',end:true}
}};
TALK.piano_notes={nodes:{s:{text:'谱架上留着排练记录：\n「三下，一下，四下。不要跟着最后那声敲。」\n\n琴房里响起了三组声音：咚咚咚。咚。咚咚咚咚。\n最后一声，来自我身后的门。',set:'听过节拍',end:true}}};
TALK.piano_case={nodes:{
  s:{text:'琴盖里嵌着三位数的机械锁。谱架上有排练记录。\n\n我刚碰到琴键，隔壁也响了一下。',next:'t'},
  t:{text:'输入谱架记录的三组敲击次数。门后的那一下不算。',ask:{key:'314',len:3,to:'ok'},end:true},
  ok:{text:'锁开了，琴房里的回声慢了半拍。\n\n夹层里有张控制图：三个讲桌是回声节点，指示灯亮时才可以关闭。\n\n奖励：最终战的反击窗口延长两秒。',set:'校准节拍',end:true}
}};
TALK.photo_first={nodes:{s:{text:'照片上十九个人。后排最右边是一把空椅子。\n\n我用粉笔在照片边缘画了个圈，记住这个位置。\n\n旁边的玻璃柜里，放着同一天的底片。',set:'标记合照',end:true}}};
TALK.photo_negative={nodes:{s:{text:'底片里，空椅子上坐着顾言。\n\n我转头看墙上那张合照。刚才画圈的位置，有一只手把圈擦掉了。\n\n我没有走近。柜子上的标签还在：\n「底片未经修订。」',set:'对过底片',end:true}}};
TALK.photo_case={nodes:{
  s:{text:'照片里现在有二十个人。多出来的那个人，脸正朝着我站的位置。\n\n哪份证据能留下顾言原来的样子？',esc:true,opts:[{t:'只保留会变化的合照',go:'no'},{t:'把未经修订的底片夹进本子',go:'ok',if:'对过底片'},{t:'刮掉照片上的脸',go:'no'}]},
  no:{text:'我低头时，照片上的人也低头。\n\n玻璃柜里那张底片没有动。先看清它。',end:true},
  ok:{text:'底片夹进本子。我再抬头，墙上只剩十九个人。\n\n照片背面多了一句：\n「我记得你画的圈。」\n\n奖励：最终战的笑声弧线变慢；结局保留顾言的照片。',set:'保住底片',end:true}
}};
function addInvestigation(map,x,y,art,who,talk,condition){
  var o={x:x,y:y,art:art,who:who,verb:'调查',talk:talk,if:condition||'可以走动了'};
  o._i=MAPS[map].objs.length; MAPS[map].objs.push(o); MAPS[map].allObjs=null;
}
addInvestigation('hall3',27,7,'speaker','不停重复的录音机','radio_case');
addInvestigation('art',31,6,'paper','谱架上的敲击记录','piano_notes');
addInvestigation('art',31,8,'desk','隔壁会跟着响的琴','piano_case');
TALK.photo_case.nodes.observe=TALK.photo_first.nodes.s;
TALK.photo_case.nodes.wait={text:'墙上的合照暂时没变。\n\n旁边玻璃柜里有未经修订的底片。我画过的圈正对着那把空椅子。',end:true};
TALK.photo_case.entryBy=[{if:'对过底片',go:'s'},{if:'标记合照',go:'wait'},{go:'observe'}];
addInvestigation('museum',12,18,'paper','空椅子旁的合照','photo_case');
addInvestigation('museum',13,20,'drawer','玻璃柜里的原始底片','photo_negative','标记合照');
['切断广播','校准节拍','保住底片'].forEach(function(f,i){TASKS.push({ch:2,t:['第三教学楼：停掉循环广播','艺术楼：辨认敲击节拍','校史馆：保住未经修订的底片'][i],f:f,opt:true});});
Object.assign(CLUES,{
  '纸条':'顾言，9月14日。照片背面是我自己的字：如果今天又是十八日，去找另一半。',
  '译出化学笔记':'顾言在07:10记录下样品模仿点名。学校删掉他的名字，录音却继续等待他的回答。',
  '切断广播':'循环录音已经取出：环境笑欲停止上涨，追逐人排留出更大的缺口。',
  '听过节拍':'排练记录：三下、一下、四下；身后的那一下不算。',
  '校准节拍':'回声慢了半拍：最终战反击窗口延长两秒。',
  '标记合照':'十九人的合照里有空椅子。我画圈留下位置，原始底片在旁边玻璃柜。',
  '对过底片':'未经修订的底片里有顾言，合照会变化。应保存原始底片。',
  '保住底片':'留下了顾言的原始影像：最终战笑声弧线速度降低。',
  '合成记录':'9月14日的黄色凝胶样品开始复现点名，学生叫它奶蛙；顾言留在实验室，名单却被涂掉。',
  '干掉奶蛙':'三个回声节点关闭，lg7重新写下顾言的名字。广播终于念到点名结束。'
});
var originalGap=chaseGap;
chaseGap=function(){return originalGap()+(flagOn('切断广播')?6:0);};
// Apply the photo reward to newly emitted rings once, not on every frame.
var originalBossTick=bossTick;
bossTick=function(dt){
  originalBossTick(dt);
  if(M.boss && flagOn('保住底片')) M.boss.rings.forEach(function(r){if(!r.evidenceSlow){r.spd*=0.8;r.evidenceSlow=true;}});
};
endingFor=function(){
  var won=flagOn('干掉奶蛙'), me=M.me?M.me.id:'laoli';
  if(!won) return {title:'校门外，第二十声',lines:['我离开了学校。','第二天，名册上仍然只有十九个人。','手机里那条「全员到齐」的消息删不掉。','每次播放语音，最后都会多一声「到」。']};
  var lines=['放学铃响完了。顾言从最后一排站起来。','lg7没有再让他等。他们一起走出了那间教室。'];
  lines.push({laoli:'我认得他走路的样子。他和小学时一样，先用脚尖探下一级台阶。',shui:'我的手机恢复了电量。周五那段视频终于有了结尾：顾言把记录本合上了。',logic:'我又数了一遍走廊。三间教室，三块门牌。多出来的八分钟，回到了我的手机上。'}[me]);
  if(flagOn('保住底片')) lines.push('我把底片交给顾言。照片里的他终于看向镜头，而不是门口。');
  else lines.push('旧照片上的空椅子还在。我在背面写下了他的名字。');
  if(flagOn('切断广播')) lines.push('广播室那盘空白磁带，最后录下了一个很轻的声音：「明天见。」');
  if(flagOn('校准节拍')) lines.push('路过琴房，里面敲了三下、一下、四下。这次没有第四组。');
  lines.push(invCount()>=3?'我们把收集的记录交了出去。学校公布了那天完整的名单。':'我把本子收好。还有几处被改过的记录，明天得带人来查。');
  lines.push('校门口的钟走到了十八点。','我低头看手机。日期终于变成了十九日。');
  return {title:flagOn('保住底片')?'第十九声 · 名字留下了':'第十九声 · 点名结束',lines:lines};
};
PICK_NOTE={laoli:'他认得被划掉名字的同学。追查名单，找回那个人。',shui:'他替老师搬过样品。找回手机里的照片，查清自己做过什么。',logic:'她找到一间不走时间的教室。核对图纸，追查第四扇门。'};
// All exposed records describe the same incident four days ago.
Object.values(TALK).forEach(function(script){
  Object.values(script.nodes).forEach(function(node){
    if(node.text) node.text=node.text.replaceAll('三年','四天').replaceAll('整整一年','整整四天').replaceAll('去年','上周五');
  });
});
Object.keys(CLUES).forEach(function(k){CLUES[k]=CLUES[k].replaceAll('三年','四天').replaceAll('一年','四天');});
