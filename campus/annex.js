/* 旧生活区：三条主线的新增章节、后操场与旧食堂。 */
'use strict';
EPISODES.yard={from:'campus',x:62,y:24,title:'后操场 · 回头的人',reward:'拿到旧哨子',location:'校园北部林子东侧新路：到后操场躲开回头的目光，再去旧食堂。'};
EPISODES.canteen={from:'yard',x:45,y:9,title:'旧食堂 · 最后一份饭',reward:'退回空餐盘',location:'后操场东侧旧食堂：按小票顺序配餐，送回窗口，共三份。'};
makeMap('yard',{w:56,h:38,base:'grass',spawn:[34,34],npcs:[
 {id:'annex_watch',tx:32,ty:11,face:'left',talk:'annex_watch'},
 {id:'annex_mapper',tx:37,ty:28,face:'down',talk:'annex_mapper'},
 {id:'annex_seated',tx:42,ty:20,face:'up',talk:'annex_seated'}
],objs:[
 episodeObj(15,8,'终点的旧哨子','annex_whistle','drawer'),
 episodeObj(5,32,'跑道旁的旧规则','annex_rules','paper'),
 episodeObj(5,19,'西侧界碑','annex_post_0','paper'),
 episodeObj(36,33,'南侧界碑','annex_post_1','paper'),
 episodeObj(51,25,'东侧界碑','annex_post_2','paper'),
 episodeObj(45,9,'旧食堂的侧门','enter_canteen','door'),
 episodeObj(34,35,'回校园林子','leave','door'),
 episodeObj(41,23,'看台下面的失物袋','annex_lost','drawer')
],deco:[{x:39,y:18,n:5,dx:2,art:'desk'},{x:39,y:21,n:5,dx:2,art:'desk'}]},function(){
 R('wall',0,0,56,1);R('wall',0,37,56,1);R('wall',0,0,1,38);R('wall',55,0,1,38);
 R('wall',4,6,26,27);R('plaza',5,7,24,25);R('garden',9,12,16,15);R('floor',14,32,3,1);
 R('path',30,5,6,31);R('path',30,30,24,3);R('path',35,8,12,3);
 house(39,2,14,8,'旧食堂',[[45,9,2,1]],'classroom');
 R('planter',7,23,5,1);R('planter',17,16,8,1);R('planter',8,10,4,1);
 NAME(5,7,24,25,'旧跑道');NAME(38,17,15,7,'没有观众的看台');NAME(30,30,24,6,'旧校区南路');
});
makeMap('canteen',{w:40,h:28,base:'void',spawn:[20,23],npcs:[
 {id:'annex_server',tx:20,ty:5,face:'down',talk:'annex_server'}
],objs:[
 episodeObj(6,7,'温水壶','annex_food_0','drawer'),
 episodeObj(32,7,'白饭锅','annex_food_1','lunchbox'),
 episodeObj(32,20,'青菜盘','annex_food_2','lunchbox'),
 episodeObj(6,20,'洗掉餐盘里的东西','annex_wash','drawer'),
 episodeObj(20,10,'窗口前的小票','annex_menu','paper'),
 episodeObj(20,24,'回后操场','leave','door'),
 episodeObj(4,13,'墙上倒过来的菜单','annex_menu_story','board')
],deco:[{x:12,y:14,n:4,dx:4,art:'desk'},{x:12,y:18,n:4,dx:4,art:'desk'}]},function(){
 episodeLayout(40,28,'旧食堂');R('stage',12,3,16,2);
 R('wall',10,6,1,6);R('wall',28,6,1,6);R('floor',10,10,1,2);R('floor',28,10,1,2);
 NAME(2,3,7,8,'水房');NAME(30,3,8,8,'饭锅');NAME(30,17,8,6,'配菜台');
});
MAPW=MAPS.campus.w;MAPH=MAPS.campus.h;
// Connect the previously empty northern tree line to a new route. Existing
// buildings, portals and the original western mountain trail stay in place.
for(var ay=22;ay<=26;ay++)for(var ax=60;ax<=64;ax++)MAPS.campus.map[ay][ax]='path';
MAPS.campus.labels.push({x:59,y:22,w:8,h:5,t:'通往后操场的新路'});
Object.keys({yard:1,canteen:1}).forEach(function(id){
 var e=EPISODES[id],o=episodeObj(e.x,e.y,'探索 · '+e.title,'enter_'+id,'door');o.if='可以走动了';
 // The canteen already has a physical entrance on the yard map.
 if(id==='yard'){o._i=MAPS[e.from].objs.length;MAPS[e.from].objs.push(o);}
 TASKS.push({ch:2,t:e.title,f:e.reward,opt:true});
});
function annexNpc(id,label,skin){
 var base=speaker(skin);CHARS.push(Object.assign({},base,{id:id,name:label,tag:'旧校区里没有姓名的人'}));
 SPRITE_IMG[id]=SPRITE_IMG[skin];PORTRAIT_IMG[id]=PORTRAIT_IMG[skin];
}
annexNpc('annex_watch','看台旁的人','teacher');
annexNpc('annex_mapper','拿卷尺的人','duty');
annexNpc('annex_seated','背对跑道的人','deskmate');
annexNpc('annex_server','端空餐盘的人','teacher');
annexNpc('annex_witness','长椅旁的同学','deskmate');
MAPS.campus.npcs.push({id:'annex_witness',tx:61,ty:118,face:'down',talk:'annex_witness'});
MAPS.campus.map[119][59]='bench';
TALK.annex_witness={start:'s',again:'s',nodes:{s:{text:'他把那张合影藏在长椅下面。\n\n「等你把手里的记录看完，再去旧操场。那里有人一直在数数。」',end:true}}};
TALK.yard_intro={nodes:{s:{text:'林子后面是一片旧操场。跑道上有脚印，脚印却没有落在同一个方向。\n\n「一、二、三……」背对跑道的人开始数数。\n\n绿灯时能走；黄灯时准备停；红灯回头时不要移动。被看见只退回跑道起点，不会丢失调查记录。\n终点的哨子可以带走。东侧还有一间旧食堂。',end:true}}};
TALK.canteen_intro={nodes:{s:{text:'旧食堂没有开火，饭锅里却一直冒着白气。\n\n窗口前的小票列了三样东西。到水壶、饭锅和配菜台，按顺序取餐，再送到端空餐盘的人那里。\n\n装错了可以去左下角清洗，送错也能重试。做完三份，记得再问问他。',end:true}}};
TALK.annex_rules={nodes:{s:{text:'跑道旧规则：\n绿灯：「一、二、三」——可以移动。\n黄灯：「要回头了」——现在就松开方向。\n红灯：「我看见你了」——站住，不要动。\n\n目光只管跑道里面，旁边小路和食堂是安全的。拿到终点的哨子后，数数就会停。',end:true}}};
TALK.annex_watch={start:'s',again:'s',nodes:{s:{text:'「他们说这里原来有六排座位。」\n\n他指着看台。\n「数座位没用。你得数坐过的人。先拿到跑道上的哨子，别在他回头时走。」',end:true}}};
TALK.annex_mapper={start:'s',again:'s',nodes:{s:{text:'他把卷尺拉得很长。末端垂进草里，还是不够。\n\n「西、南、东，三块界碑都去看一眼。出口总不能比校区还长。」\n\n卷尺收回时，我看见上面每个数字后面都跟着同一只眼睛。',end:true}}};
TALK.annex_seated={start:'s',again:'s',nodes:{s:{text:'他没有转头。\n\n「你从哪边来的？」\n\n我指向林子。他又问了一遍。\n这次声音来自我背后。',end:true}}};
var ANNEX_FOOD=['温水','白饭','青菜'],ANNEX_ORDERS=[[0,1,2],[2,0,1],[1,2,0]];
function mealRound(){for(var i=0;i<3;i++)if(!flagOn('送完餐盘'+i))return i;return 3;}
function mealTray(){return Array.isArray(FLAGS['旧食堂餐盘'])?FLAGS['旧食堂餐盘']:[];}
function mealOrder(){return ANNEX_ORDERS[Math.min(2,mealRound())];}
function mealMenu(){return mealOrder().map(function(i){return ANNEX_FOOD[i];}).join(' → ');}
TALK.annex_server={start:'s',again:'s',nodes:{
 s:{text:'',opts:[{t:'把餐盘送过去',go:'serve'},{t:'再看一遍小票',go:'menu'},{t:'先离开窗口',go:'bye'}]},
 serve:{text:'',end:true},menu:{text:'',end:true},bye:{text:'他还端着那个空盘。盘底倒映的天花板上，有人正趴着看我。',end:true}
}};
var annexTasks={
 laoli:[step(2,'校园东南空地：问长椅旁的同学','接下看台委托','campus',61,119,['annex_laoli_start']),step(2,'后操场：拿旧哨子，再问看台旁的人','认出看台空位','yard',32,12,['annex_laoli_final'])],
 shui:[step(2,'校园西南空地：对照旧水龙头旁的照片','接下食堂委托','campus',18,118,['annex_shui_start']),step(2,'旧食堂：送三份餐，再向窗口问小票','找回原始小票','canteen',20,6,['annex_shui_final'])],
 logic:[step(2,'中心广场东北空地：核对旧校区路牌','接下旧路委托','campus',49,98,['annex_logic_start']),step(2,'后操场：调查三块界碑，再问拿卷尺的人','标出真实出口','yard',37,29,['annex_logic_final'])]
};
Object.keys(annexTasks).forEach(function(role){annexTasks[role].forEach(function(s,i){s.annex=true;if(i)s.npc={laoli:'annex_watch',shui:'annex_server',logic:'annex_mapper'}[role];ROUTE_STEPS[role].push(s);TASKS.push(Object.assign({who:role},s));});});
var annexOriginalMainSteps=mainSteps;
mainSteps=function(){return annexOriginalMainSteps().filter(function(s){return !s.annex||!flagOn('旧存档已过旧校区');});};
var annexMainAllowed=mainAllowed;
mainAllowed=function(name){var role=/^annex_(laoli|shui|logic)_/.exec(name||'');if(role&&(!M.me||role[1]!==M.me.id))return false;return annexMainAllowed(name);};
var annexRepair=repairLegacySave;
repairLegacySave=function(version,build){
 // Already advanced old saves may continue directly to their battle. New
 // games include the extra chapters; exploration remains available to both.
 if((!build||parseInt(String(build).replace('v',''),10)<25)&&flagOn('有翻译笔'))setFlag('旧存档已过旧校区');
 annexRepair(version);
};
TALK.annex_laoli_start={nodes:{s:{text:'长椅旁的同学低着头，鞋底沾着跑道上的红土。\n\n「你还记得一起上体育课的那些人吗？」\n\n他递来一张合影。牢李认得每张脸，可看台最右边多了一只没有主人的手。\n「去后操场拿旧哨子，再数一遍坐过的人。」\n\n入口在校园北部林子东侧的新路。',set:'接下看台委托',end:true}}};
TALK.annex_shui_start={nodes:{s:{text:'旧水龙头下压着一张照片，水哥手机里也有同一张。\n\n周五他把三份饭送到旧食堂，照片里的餐盘却是空的。小票最后一行，被人撕掉了。\n\n「别问送给谁。照小票做一遍，他就会把剩下的还你。」\n\n入口在校园北部林子东侧；后操场东侧是旧食堂。',set:'接下食堂委托',end:true}}};
TALK.annex_logic_start={nodes:{s:{text:'logic 把路牌上的距离和旧图叠在一起：\n「旧校区总长二十四格，西侧出口在图内。」\n\n路牌却多出两条箭头：南门、东门。它们指着校园围墙外。\n\n先走进林子东侧的新路，核对后操场的西、南、东三块界碑，再找拿卷尺的人。',set:'接下旧路委托',end:true}}};
TALK.annex_laoli_final={start:'s',again:'s',nodes:{
 s:{text:'我把旧哨子放在掌心。看台上那六排座位，同时响了一下。\n\n「现在你认得了吗？」\n\n合影里有十九个人。看台上多出来的手，正放在那个空位的椅背上。',opts:[{t:'给多出来的人补一个新名字',go:'wrong'},{t:'指出空位：他被从照片里删掉了',go:'right'},{t:'把照片也撕掉',go:'wrong'}]},
 wrong:{text:'他摇头：「不是再添一个。是把原来那个找回来。」',next:'s'},
 right:{text:'牢李没有喊一个陌生名字。他指着自己记得的空位。\n\n那只手从椅背上松开，掌心留着四天前的粉笔灰。\n「点到最后一排时，替我说一句：我在。」\n\n旧哨子留下来。最终战按 Q／手机「吹哨」可短暂护身并打散靠近的两道弧线。',set:'认出看台空位',end:true}
}};
TALK.annex_shui_final={start:'s',again:'s',nodes:{
 s:{text:'第三份餐盘被端走后，窗口的人把小票倒扣在台面上。\n\n「你手机里那张照片，是送饭前拍的，还是送饭后？」\n\n照片背景里，三口饭锅都还盖着盖子。',opts:[{t:'送饭前：盘子本来就还没装饭',go:'right'},{t:'送饭后：把空盘当成送过饭的证据',go:'wrong'}]},
 wrong:{text:'水哥看着照片里的锅盖。\n「锅都没开。我还没盛饭。」',next:'s'},
 right:{text:'小票翻过来，最后一行终于完整：\n「留校记录员一份，送至竞赛辅导室。」\n\n有人把送饭前的照片换成了「全员已经离校」的证据。水哥收起原始小票。\n窗口后面只剩一块倒映着他的玻璃。\n\n奖励：最终战屏息／吹哨的等待时间缩短两秒。',set:'找回原始小票',end:true}
}};
TALK.annex_logic_final={start:'s',again:'s',nodes:{
 s:{text:'三块界碑：西侧「校内24」，南侧「校外26」，东侧「校外28」。\n\n旧图的校区总长是24格。\n拿卷尺的人问：「你要给地图留下哪个出口？」',opts:[{t:'西侧：距离在校区范围内',go:'right'},{t:'南侧：多出来的两格也算进去',go:'wrong'},{t:'东侧：路牌写了就一定能走',go:'wrong'}]},
 wrong:{text:'卷尺一直收不回来。\n「超过围墙的那一截，量的是谁的影子？」',next:'s'},
 right:{text:'logic 在图上划掉南、东两根箭头，标出西侧旧路。\n\n两块界碑上的数字脱落了。底下写着同一句话：\n「只要有人照着走，就会多出一截。」\n\n拿卷尺的人把末端递给她。卷尺终于能够收完。\n奖励：最终战的真假信号灯会标出地图里真实的位置。',set:'标出真实出口',end:true}
}};
function annexCampusClue(role,x,y,art,talk,label){var o={x:x,y:y,art:art,talk:talk,who:label,verb:'调查',if:['是:'+role,'可以走动了'],once:true};o._i=MAPS.campus.objs.length;MAPS.campus.objs.push(o);}
annexCampusClue('laoli',61,119,'paper','annex_laoli_start','长椅旁的同学留下的合影');
annexCampusClue('shui',18,118,'drawer','annex_shui_start','旧水龙头下的送餐照片');
annexCampusClue('logic',49,98,'board','annex_logic_start','指向旧校区的路牌');
MAPS.campus.allObjs=null;MAPS.campus.solidMap=null;
Object.assign(CLUES,{
 '接下看台委托':'牢李认出体育课的合影。北部林子东侧的新路通往后操场，先拿旧哨子，再找看台旁的人。',
 '认出看台空位':'多出来的是被删掉的人留下的手。旧哨子能打散靠近的两道弧线。',
 '接下食堂委托':'水哥手机里的照片被当作离校证据。去后操场东侧旧食堂，配好三份饭再问小票。',
 '找回原始小票':'原始小票记录留校记录员的饭。送饭前的照片曾被换成离校证明。',
 '接下旧路委托':'logic 的旧图：校区总长24格。去后操场核对西、南、东界碑，再找拿卷尺的人。',
 '标出真实出口':'西侧24格在围墙内，南26和东28是被添上的路。最终战真灯出现地图标记。',
 '拿到旧哨子':'跑道尽头的哨子能打散附近两道弧线。最终战 Q／手机按钮使用，每8秒一次。',
 '退回空餐盘':'三份餐盘送回后，窗口恢复安静。最终战 Q／手机按钮等待缩短至6秒。',
 '界碑0':'西侧：校内24格。','界碑1':'南侧：校外26格。','界碑2':'东侧：校外28格。',
 '捡回失物袋':'失物袋里只有一张从后面拍的照片。上面的人正在打开同一个袋子。'
});
var annexLoad=loadMap;
loadMap=function(id,x,y,dir){episodeHudSig='';delete episodeHud.dataset.annex;annexLoad(id,x,y,dir);M.yardTrial=id==='yard'?{phase:'walk',t:3.6,turns:0,grace:0,px:M.p.x,py:M.p.y}:null;};
var annexReset=resetTransient;
resetTransient=function(){annexReset();M.yardTrial=null;if(battleAction)displayEpisode(battleAction,'none');};
var annexOpenTalk=openTalk;
openTalk=function(n){
 var talk=n.talk;
 if(n.id==='annex_witness')n.talk=M.me.id==='laoli'&&annexMainAllowed('annex_laoli_start')?'annex_laoli_start':'annex_witness';
 if(n.id==='annex_watch')n.talk=M.me.id==='laoli'&&flagOn('接下看台委托')&&flagOn('拿到旧哨子')?'annex_laoli_final':'annex_watch';
 if(n.id==='annex_mapper')n.talk=M.me.id==='logic'&&flagOn('接下旧路委托')&&[0,1,2].every(function(i){return flagOn('界碑'+i);})?'annex_logic_final':'annex_mapper';
 if(n.id==='annex_server'){
  n.talk=M.me.id==='shui'&&flagOn('接下食堂委托')&&flagOn('退回空餐盘')?'annex_shui_final':'annex_server';
  TALK.annex_server.nodes.s.text=mealRound()===3?'他收好了三份餐盘。\n「我没有吃过。你看到的那个人，也没有吃过。」':'「第'+(mealRound()+1)+'份。」\n小票：'+mealMenu()+'。\n\n我的餐盘：'+(mealTray().map(function(i){return ANNEX_FOOD[i];}).join(' → ')||'空的');
  TALK.annex_server.nodes.menu.text='小票的顺序：'+mealMenu()+'。\n拿错可以在左下角洗掉，已送好的餐盘不会丢失。';
 }
 annexOpenTalk(n);n.talk=talk;
};
var annexGoto=gotoNode;
gotoNode=function(id){
 if(M.talk.script===TALK.annex_server&&id==='serve'&&!M.talk.replay){
  var tray=mealTray(),round=mealRound(),correct=round<3&&JSON.stringify(tray)===JSON.stringify(mealOrder());
  if(correct){setFlag('送完餐盘'+round);setFlag('旧食堂餐盘',[]);sfxPick();if(mealRound()===3)setFlag('退回空餐盘');}
  else if(round<3)setFlag('旧食堂餐盘',[]);
  TALK.annex_server.nodes.serve.text=round===3?'三个空盘都收好了。现在可以问他，或者回后操场。':correct?(mealRound()===3?'最后一个盘子收走了。\n\n我听见身后有人说「够了」。\n回头时，每张空桌前都坐着一个背对我的人。\n\n三份已送完。再调查窗口，可以继续你的主线。':'他把餐盘推向黑暗。盘子没有落下去。\n\n下一张小票：'+mealMenu()+'。'): '盘子原封不动回到我手上。\n「顺序错了。」\n\n我清洗了餐盘，再按小票做一遍。已送好的那几份还在。';
 }
 annexGoto(id);
};
var annexPress=pressObj;
pressObj=function(o){
 if(!o||!o.action||!o.action.startsWith('annex_')){annexPress(o);return;}
 if(!episodeActive()||!objLive(o))return;clearInput();
 if(o.action==='annex_whistle'){
  if(flagOn('拿到旧哨子')){toast('哨子已经收好了。',2);return;}
  setFlag('拿到旧哨子');checkpoint('拿到旧哨子');openScript('annex_whistle');
 }else if(o.action==='annex_rules')openScript('annex_rules');
 else if(o.action.startsWith('annex_post_')){var k=Number(o.action.slice(-1));setFlag('界碑'+k);checkpoint('记下界碑');toast(CLUES['界碑'+k]+' 三块都看完，再找拿卷尺的人。',3);}
 else if(o.action==='annex_lost'){setFlag('捡回失物袋');checkpoint('捡回失物袋');openScript('annex_lost');}
 else if(o.action==='annex_menu'){toast(mealRound()===3?'三份饭都送回去了。': '第'+(mealRound()+1)+'份小票：'+mealMenu(),4);}
 else if(o.action==='annex_menu_story'){
  TALK.annex_menu_story.nodes.s.text='菜单上只有四个字：\n\n「今日昨日」。\n\n有人把中间那一道竖线描了很多遍，好像不让这两天分开。\n\n'+{laoli:'牢李认出了四天前那个同学写字的习惯。',shui:'水哥发现菜单背面还压着送饭车的车票。',logic:'logic 量了两行的间距。下半行比上半行多出两格。'}[M.me.id];
  openScript('annex_menu_story');
 }
 else if(o.action==='annex_wash'){setFlag('旧食堂餐盘',[]);checkpoint('清洗餐盘');toast('餐盘洗干净了，可以重配。',2);}
 else if(o.action.startsWith('annex_food_')){
  if(mealRound()===3){toast('三份饭都送回去了，再问问窗口的人。',2);return;}
  var tray=mealTray().slice(),k=Number(o.action.slice(-1));if(tray.length>=3){toast('餐盘满了，送到窗口或者先清洗。',2);return;}
  tray.push(k);setFlag('旧食堂餐盘',tray);checkpoint('配好餐盘');sfxPick();toast('餐盘：'+tray.map(function(i){return ANNEX_FOOD[i];}).join(' → '),2.5);
 }syncEpisodeUI();M.renderDirty=true;
};
TALK.annex_whistle={nodes:{s:{text:'哨子响了一下，跑道上所有脚印同时停住。\n\n背对跑道的人仍然没有回头。\n我走过去时，椅子上只搭着一件空校服。\n\n哨子已收进本子：最终战 Q／手机「吹哨」可短暂保护自己，打散附近的两道弧线。',end:true}}};
TALK.annex_lost={nodes:{s:{text:'失物袋没有名字。里面是一张刚拍的照片：\n我正背对镜头，伸手打开这个袋子。\n\n照片背面还有一行：\n「别回头看是谁拍的。」',end:true}}};
TALK.annex_menu_story={nodes:{s:{text:'菜单上写着：今日昨日。',end:true}}};
function yardTick(dt){
 var t=M.yardTrial;if(!t||flagOn('拿到旧哨子'))return;
 t.t-=dt;t.grace=Math.max(0,t.grace-dt);
 if(t.t<=0){
  if(t.phase==='walk'){t.phase='warn';t.t=.9;tone(550,.12,{vol:.025});}
  else if(t.phase==='warn'){t.phase='stop';t.t=1.8+t.turns%2*.3;t.grace=.2;tone(220,.15,{vol:.025});}
  else {t.phase='walk';t.turns++;t.t=2.7+(t.turns%3)*.35;}
 }
 var moved=Math.hypot(M.p.x-t.px,M.p.y-t.py)>0.5,inTrack=M.p.x>=5*TILE&&M.p.x<29*TILE&&M.p.y>=7*TILE&&M.p.y<32*TILE;
 if(t.phase==='stop'&&t.grace<=0&&inTrack&&moved){
  t.caught=(t.caught||0)+1;
  if(t.caught>=3){clearInput();die('第三次回头，他终于认出了你的声音。\n跑道尽头的空校服里，多了一张脸。',1.7);return;}
  M.p.x=15*TILE+16;M.p.y=33*TILE+16;clearInput();t.phase='walk';t.t=3.6;t.grace=.3;flashRed();shake(.25);
  checkpoint('跑道起点');toast('他看见了（'+t.caught+'/3）。第三次会致死；先站住，再走。',3);
 }t.px=M.p.x;t.py=M.p.y;
}
var annexUpdate=update;
update=function(dt){annexUpdate(dt);if(episodeActive()&&M.map==='yard')yardTick(dt);syncAnnexBattleUI();};
var annexSync=syncEpisodeUI;
syncEpisodeUI=function(){
 if(!['yard','canteen'].includes(M.map)){annexSync();return;}
 var active=episodeActive();document.body.classList.toggle('in-episode',M.screen==='play');
 displayEpisode(episodeHud,active?'block':'none');displayEpisode(episodeControls,active?'flex':'none');
 [crouchBtn,paperBtn,photoBtn,photoReference].forEach(function(el){displayEpisode(el,'none');});
 if(!active)return;
 var detail;
 if(M.map==='yard'){
  var t=M.yardTrial;detail=flagOn('拿到旧哨子')?'旧哨子已拿到。看台旁、拿卷尺的人和东侧旧食堂还可以调查。':(t&&t.phase==='stop'?'红灯 · 他回头了：松开方向，站住！':t&&t.phase==='warn'?'黄灯 · 要回头了，现在准备停！':'绿灯 · 可以走，跑道终点的旧哨子在北侧。');
 }else detail=mealRound()===3?'三份已送回 · 再问窗口的人，继续调查。':'第'+(mealRound()+1)+'/3份：'+mealMenu()+' · 餐盘：'+(mealTray().map(function(i){return ANNEX_FOOD[i];}).join(' → ')||'空');
 if(M.map==='yard'&&!flagOn('拿到旧哨子'))detail+=' · 被发现 '+((M.yardTrial&&M.yardTrial.caught)||0)+'/3';
 var sig=M.map+':'+detail;if(episodeHud.dataset.annex!==sig){episodeHud.dataset.annex=sig;episodeHud.innerHTML='<b>'+EPISODES[M.map].title+'</b><br>'+detail;}
};
var annexDraw=drawWanderWorld;
drawWanderWorld=function(){
 annexDraw();cx.save();
 if(M.map==='yard'||M.map==='canteen'){cx.fillStyle=M.map==='yard'?'rgba(13,24,29,.3)':'rgba(21,22,29,.26)';cx.fillRect(0,0,MAPW*TILE,MAPH*TILE);}
 if(M.map==='yard'){
  cx.strokeStyle='#d7c1a1';cx.lineWidth=2;for(var i=0;i<3;i++)cx.strokeRect((5.5+i)*TILE,(7.5+i)*TILE,(23-i*2)*TILE,(24-i*2)*TILE);
  var t=M.yardTrial,color=flagOn('拿到旧哨子')?'#91bfc7':t&&t.phase==='stop'?'#e96464':t&&t.phase==='warn'?'#e9ba56':'#8cbe7e';
  cx.fillStyle=color;cx.beginPath();cx.arc(15*TILE+16,5.5*TILE,16,0,7);cx.fill();
  cx.font='bold 14px sans-serif';cx.textAlign='center';cx.fillText(flagOn('拿到旧哨子')?'数数停止了':t&&t.phase==='stop'?'我看见你了':t&&t.phase==='warn'?'要回头了':'一、二、三……',15*TILE+16,4.5*TILE);
  // The figure at the finish is separate from the NPCs on the safe path.
  if(!flagOn('拿到旧哨子')){cx.globalAlpha=.7;drawSprite('deskmate',15*TILE+16,7*TILE,t&&t.phase==='stop'?'down':'up',0,false,2);cx.globalAlpha=1;}
  cx.fillStyle='#d6ceb7';cx.font='bold 17px sans-serif';cx.fillText('不要跟着多出来的脚步',17*TILE,20*TILE);
  for(var j=0;j<8;j++){cx.fillStyle='rgba(44,37,35,.6)';cx.fillRect((13+(j%2)*.5)*TILE, (12+j*1.4)*TILE,5,11);}
  cx.fillStyle='#b8a07b';cx.beginPath();cx.arc(22*TILE+Math.sin(M.t*.5)*6,29*TILE,9,0,7);cx.fill();
 }else if(M.map==='canteen'){
  var r=mealRound();for(var i=0;i<r;i++){cx.globalAlpha=.32;drawSprite('deskmate',(12+i*4)*TILE+16,17*TILE,'up',0,false,2);}cx.globalAlpha=1;
  cx.font='bold 13px sans-serif';cx.textAlign='center';cx.fillStyle='#efd9ac';cx.fillText(r===3?'窗口已收好三份餐盘':'第'+(r+1)+'份 · '+mealMenu(),20*TILE+16,9*TILE);
  cx.fillStyle='rgba(77,41,43,.6)';for(var j=0;j<r+1;j++){cx.fillRect((17+j*2)*TILE,4*TILE,9,13);for(var f=0;f<3;f++)cx.fillRect((17+j*2)*TILE+f*4-1,4*TILE-7,3,12);}
 }
 M.npcs.forEach(function(n){if(n.id.startsWith('annex_')&&n.id!=='annex_witness'){cx.fillStyle='rgba(18,23,27,.9)';cx.fillRect(n.x-10,n.y-40,20,8);}});
 if(M.boss&&M.boss.hp===1&&M.boss.open>0&&flagOn('标出真实出口')){var p=M.boss.plats[M.boss.lit];if(p){cx.fillStyle='#9bcbd6';cx.font='bold 13px sans-serif';cx.textAlign='center';cx.fillText('地图中的真灯',p.x*TILE+16,p.y*TILE-50);}}
 cx.restore();
};
// Every character has a short defensive action. The two new maps improve it.
var battleAction=document.createElement('button');battleAction.id='annexBattleAction';battleAction.type='button';document.body.appendChild(battleAction);
var battleStyle=document.createElement('style');battleStyle.textContent='#annexBattleAction{position:absolute;right:12px;bottom:calc(252px + env(safe-area-inset-bottom,0px));z-index:8;background:#26373e;border:2px solid #b9c2ae;color:#f7edd4;padding:12px;font:600 13px system-ui;border-radius:5px;display:none;touch-action:manipulation}#annexBattleAction:disabled{opacity:.65}@media(max-height:560px){#annexBattleAction{right:auto;left:12px;top:92px;bottom:auto}}';document.head.appendChild(battleStyle);
function battleActionActive(){return !!(M.boss&&M.screen==='play'&&!M.book&&!M.talk.open&&!M.cardT&&!M.cut&&!M.dying&&!document.hidden);}
function useBattleAction(){
 if(!battleActionActive())return;var b=M.boss;if(b.breathCd>0)return;
 b.breathCd=flagOn('退回空餐盘')?6:8;b.inv=Math.max(b.inv,.65);b.echo=null;b.echoTrail=[];b.echoT=0;
 if(flagOn('拿到旧哨子')){
  var distance=Math.hypot(M.p.x-b.cx,M.p.y-b.cy),near=b.rings.filter(function(r){return Math.abs(r.r-distance)<100;}).sort(function(a,c){return Math.abs(a.r-distance)-Math.abs(c.r-distance);}).slice(0,2);
  b.rings=b.rings.filter(function(r){return !near.includes(r);});tone(1046,.18,{type:'triangle',vol:.05});toast('哨声打断了靠近的笑声。继续找亮着的讲桌。',2);
 }else toast('屏住呼吸，影子停了一拍。短暂护身，继续躲圈。',2);
 M.renderDirty=true;syncAnnexBattleUI();
}
battleAction.addEventListener('click',function(e){e.stopPropagation();useBattleAction();});
window.addEventListener('keydown',function(e){if(e.key.toLowerCase()==='q'&&!e.repeat&&battleActionActive()){e.preventDefault();useBattleAction();}});
function syncAnnexBattleUI(){
 var active=battleActionActive();displayEpisode(battleAction,active?'block':'none');if(!active)return;
 var cd=Math.ceil(M.boss.breathCd||0),label=(flagOn('拿到旧哨子')?'吹哨':'屏息')+(cd?' · '+cd+'秒':' · Q');
 if(battleAction.textContent!==label)battleAction.textContent=label;if(battleAction.disabled!==!!cd)battleAction.disabled=!!cd;
}
var annexBossTick=bossTick;
bossTick=function(dt){if(M.boss)M.boss.breathCd=Math.max(0,(M.boss.breathCd||0)-dt);annexBossTick(dt);};
var annexBook=buildBook;
buildBook=function(){annexBook();bookList.insertAdjacentHTML('beforeend','<h3>三条主线 · 旧校区</h3><p>完成自己的早期调查后，去校园的新调查点：牢李到东南长椅，水哥到西南旧水龙头，logic 到中心广场东北路牌。后操场入口在北部林子东侧。</p><p>最终战按 Q／手机按钮屏息，短暂护身。后操场的旧哨子可以打散靠近的两道弧线；旧食堂奖励缩短等待时间。</p>');};
var annexEnding=endingFor;
endingFor=function(){var e=annexEnding();if(flagOn('干掉奶蛙')){var clue={laoli:['认出看台空位','我把旧哨子挂回操场。看台上的每只手，都有了该坐的位置。'],shui:['找回原始小票','我把原始送餐小票贴回窗口。再也没人把空盘当成所有人都走了的证据。'],logic:['标出真实出口','我把真实出口标进地图。两根通向围墙外的箭头，再也没有出现。']}[M.me.id];if(flagOn(clue[0]))e.lines.splice(e.lines.length-2,0,clue[1]);}return e;};
syncAnnexBattleUI();
