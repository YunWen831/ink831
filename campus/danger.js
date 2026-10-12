/* 有预兆的危险选择。保留安全教学和就近重试。 */
'use strict';
TALK.class46_empty={nodes:{
 s:{text:'最后一张课桌没有人。书停在周五。\n\n椅背上有一行lg7写的红字：\n「别坐。别替他答。更别数第三遍。」\n\n书页底下写着：\n「我没有迟到。」',next:'q'},
 q:{text:'椅子向我挪了一点，像在等我坐下。',esc:true,opts:[{t:'记下字迹，离开空位',go:'ok'},{t:'无视红字，坐进空椅子（危险）',go:'sit',if:'看过守则'},{t:'无视守则，数第三遍（危险）',go:'third',if:'看过守则'}]},
 ok:{text:'我没有把自己的名字放进那个空位。\n\nlg7隔着门说：「我会把原来那个人找回来。不是再填进去一个。」',set:'看过46班空位',end:true},
 sit:{text:'椅子压住了我的校服。\n名单最后那道划痕，慢慢变成了我的名字。',scene:'film_empty_death',kill:true,killMsg:'你坐进了不属于你的空位。\n这一次，名单上留下了你。',end:true},
 third:{text:'第三遍。\n我数到自己时，身后有人接着数了下去。',scene:'film_empty_death',kill:true,killMsg:'第三遍不是你在数学生。\n是它在数你。',end:true}
}};
// This choice must remain live after cancelling or dying; a once-only replay
// would suppress both its clue reward and its death effects on later attempts.
MAPS.school1.objs.find(function(o){return o&&o.talk==='class46_empty';}).once=false;
SCENES.film_empty_death=[filmBeat('class_empty',1.6,'名单最后一行，被你的名字填满。',25,13,{black:.55,cue:'knock'})];
SCENES.film_fourth_death=[filmBeat('tray',1.6,'没有小票的第四份，\n收餐的人变成了你。',20,6,{black:.5,cue:'scrape'})];
SCENES.film_false_exit=[filmBeat('exit',1.5,'图纸外面的路，\n把你的影子留在了里面。',51,32,{black:.8,cue:'silence'})];
TALK.danger_fourth={nodes:{
 s:{text:'三张小票都收好了，熄灭的窗口里却伸出一只手。\n「还有第四份。」\n\nlg7按住餐盘：\n「没有小票。别送。它在把你写成收餐的人。」',next:'q'},
 q:{text:'窗口后面响起了和我一样的声音。',esc:true,opts:[{t:'听lg7的话，把盘子放下',go:'ok'},{t:'无视警告，送出第四份（危险）',go:'dead'}]},
 ok:{text:'那只手慢慢收回去。\n\n空盘底下的姓名栏，也重新变成了空白。',end:true},
 dead:{text:'盘子递出去。\n手腕上多了一道细细的红字：「已收餐」。',scene:'film_fourth_death',kill:true,killMsg:'你送出了没有小票的第四份。\n窗口收走的，不是饭。',end:true}
}};
TALK.danger_exit={nodes:{
 s:{text:'南侧假出口，写着「校外26格」。\n旧图上，校区总长只有24格。\n\n围墙后面的影子，伸手示意我继续走。它的脚没有落在地上。',next:'q'},
 q:{text:'这条路越过了图纸上的边界。',esc:true,opts:[{t:'留在图内，原路返回',go:'ok'},{t:'跟着影子走到地图外（危险）',go:'dead'}]},
 ok:{text:'我退回来。多出的两格，像被人擦掉的铅笔线一样消失了。',end:true},
 dead:{text:'我跨过界碑。\n围墙里，另一个我却没有跟上。',scene:'film_false_exit',kill:true,killMsg:'你走进了被添上的路。\n影子回来时，脚下已经没有你。',end:true}
}};
function addDangerObj(map,x,y,talk,label,condition){var o={x:x,y:y,talk:talk,who:label,art:'door',verb:'调查',if:condition};o._i=MAPS[map].objs.length;MAPS[map].objs.push(o);MAPS[map].allObjs=null;}
addDangerObj('canteen',30,23,'danger_fourth','没有小票的第四个窗口','退回空餐盘');
addDangerObj('yard',51,32,'danger_exit','越过图纸边界的南出口','可以走动了');
var dangerOpen=openScript;
openScript=function(name,replay){if(!replay&&['class46_empty','danger_fourth','danger_exit'].includes(name)&&M.screen==='play'&&!M.dying)checkpoint('危险前的安全位置');return dangerOpen(name,replay);};
TALK.annex_rules.nodes.s.text+='\n\n特别注意：被发现前两次退回起点，第三次直接致死。离开调查或复活后重新计数。';
TALK.yard_intro.nodes.s.text+='\n\n被发现前两次退回起点，第三次致死。黄灯时就准备松开方向。';
TALK.canteen_intro.nodes.s.text+='\n\n只送小票上的三份。不要接没有小票的第四份。';
TALK.him.nodes.kill6.text+='\n\n第三阶段的假灯碰错会掉一条命。看持续亮着的那盏；闪一下的会骗人。';
var dangerBossHit=bossHit;
bossHit=function(o){
 var b=M.boss,idx=o&&{plat_nw:0,plat_ne:1,plat_s:2}[o.talk];
 if(b&&b.hp===1&&b.open>0&&idx!==undefined&&idx!==b.lit){
  if(b.badLampUntil>b.t)return true;b.badLampUntil=b.t+1;b.lives--;b.inv=Math.max(b.inv,1.2);b.hurt=.5;M.horrorHit=.45;flashRed();shake(.3);bossHudDraw(true);
  if(b.lives<=0){M.bossRetryHp=b.hp;M.boss=null;M.bossRetryT=1.2;bossHud(false);droneOff();toast('假灯借走了你的回答。从这一阶段重试，已关闭的节点保留。',3);}
  else toast('这盏只闪了一下。假灯扣一条命，去找持续亮的那盏。',2.5);
  return true;
 }return dangerBossHit(o);
};
var dangerDraw=drawWanderWorld;
drawWanderWorld=function(){dangerDraw();cx.save();if(M.map==='canteen'&&flagOn('退回空餐盘'))bloodHand(30*TILE+16,23*TILE-14,.9,.6);if(M.map==='yard'){cx.strokeStyle='#a06a64';cx.lineWidth=2;cx.beginPath();cx.moveTo(50*TILE,32*TILE);cx.lineTo(54*TILE,32*TILE);cx.stroke();}cx.restore();};
