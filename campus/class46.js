/* 46班的早读，以及lg7从回避到承担的行动。 */
'use strict';
// Seventeen students + the actual deskmate + the player = nineteen. Neither
// the player's chair nor the missing student's chair contains a crowd copy.
CROWD=CROWD.filter(function(c){return c.map!=='school1'||!((c.x===24&&c.y===11)||(c.x===22&&c.y===9)||(c.x===25&&c.y===13));});
MAPS.school1.deco.push({x:25,y:13,n:1,art:'desk'});
MAPS.school1.npcs.push({id:'teacher',tx:23,ty:8,face:'down',talk:'class46_teacher'});
var classObj=MAPS.school1.objs.find(function(o){return o&&o.talk==='open_class';});classObj.who='我的课桌 · 先坐下';
var classOpenScript=openScript;
openScript=function(name,replay){if(name==='open_class'&&!replay&&M.map==='school1'){M.p.x=24*TILE+16;M.p.y=11*TILE+16;M.p.dir='up';}return classOpenScript(name,replay);};
MAPS.school1.objs.find(function(o){return o&&o.talk==='scare_count';}).who='后排桌上的旧点名册';
ROUTE_STEPS.laoli[2].t='回46班，数两遍后排桌上的旧点名册';
SCENES.film_class46=[
 filmBeat('class46',2.2,'46班，十九个学生。\n最后一声「到」，来自空着的椅子。',24,11,{zoom:1.35,cue:'knock'}),
 filmBeat('class_empty',2.4,'全班一起翻页。\n空座位上的书，也翻了一页。',25,13,{zoom:1.5,cue:'scrape'})
];
SCENES.film_lg7_knock=[filmBeat('lg7_knock',2.8,'门外两声敲击。\nlg7：「停。不要数第三遍。」',20,11,{zoom:1.2,cue:'knock'})];
SCENES.film_lg7_pen=[filmBeat('lg7_pen',3.0,'lg7把泡过水的笔擦干。\n这次，他没有再把它藏回口袋。',17,11,{zoom:1.25,cue:'scrape'})];
SCENES.film_lg7_return=[filmBeat('lg7_return',3.0,'lg7走在前面，推开那扇门。\n「门我撑着。你去找他。」',13,5,{zoom:1.2,cue:'step'})];
TALK.open_class={nodes:{
 s:{text:'我走到46班自己的课桌前。椅子被人拉开了一点，书本停在周五那一页。\n\n轻点推进对话；出现选项时，点选项。',scene:'film_class46',next:'t'},
 t:{text:'十九个人。我数了两遍。\n老师却念了二十个名字。\n\n后排靠窗那把空椅子底下，响起一声「到」。老师翻回第一页，又准备从头数。',next:'u'},
 u:{text:'前排第一个人开始笑。第二个、第三个，也跟着笑。\n\n我喉咙里那声「到」正在往上顶。现在怎么做？',opts:[{t:'咬住牙，不替空座位回答',go:'hold'},{t:'问老师：刚才是谁在回答？',go:'ask'}]},
 hold:{text:'我压住了声音。空椅子向我的方向挪了一点。\n\n它不是没听见，它在等。',next:'door'},
 ask:{text:'我还没问完，全班就一起转了过来。\n\n老师嘴唇没动，空椅子下面却用他的声音问：\n「你想再数一遍吗？」\n\n我把后半句话咽了回去。',stare:3,next:'door'},
 door:{text:'lg7停在门外，敲了两下玻璃。\n「够了。第三遍不是在数学生。」\n\n教室里的笑声断了一拍。他看了一眼空椅子，马上把视线移开。',scene:'film_lg7_knock',next:'x'},
 x:{text:'课桌抽屉里有半张旧照片。背面写着：\n「9月14日，姓名栏被涂黑。」\n\n另有一张纸条，是我自己的字：\n「如果今天又是十八日，去找剩下的那半张。」',next:'goal'},
 goal:{text:'lg7把后墙上的塑封纸指给我看：\n「先把六条看完。我在走廊等你。」\n\n纸条已放进本子。\n下一步：调查教室后墙的《46班自习课守则》。',set:'纸条',end:true}
}};
// Keep the six opening characters unchanged: they are the moss puzzle's key.
TALK.rule_sheet.nodes.w={text:'六条下面还有一行小字：\n「数第三遍，多的那个就开始数你。」\n\n右下角是lg7的笔迹：\n「不是让你忘掉他。是别让录音借你的嘴说话。」',next:'practice'};
TALK.rule_sheet.nodes.practice={text:'先在心里练一次，避免把第二、第三条弄反：\n\n老师点到我自己的名字时，我应该怎么做？',esc:true,opts:[{t:'只在点到我自己时回答「到」',go:'ok'},{t:'连空座位的那声也一起替答',go:'retry'}]};
TALK.rule_sheet.nodes.retry={text:'纸背上有一行红字：\n「你不能替不在教室的人答。」\n\nlg7隔着门说：「别试。这不是扣分，是它会记住你的声音。」\n\n这次只是练习，可以重新选择。',next:'practice'};
TALK.rule_sheet.nodes.ok={text:'我记下了六条，把它们夹进本子。\n\n轻点右侧「本」可以查看规则和目标；开本子时游戏暂停。\n现在走出教室，三个角色会接到各自的调查。',set:'看过守则',end:true};
TALK.class46_teacher={start:'s',again:'s',nodes:{s:{text:'老师的笔一直停在名单最后一行。\n\n「先坐下。后墙的守则看完，再去走廊。」\n\n他把名单压在书下面，露出的空白处却越来越大。',end:true}}};
TALK.hint_deskmate.nodes.s={text:'同桌把书向我这边推了一点。\n\n「先看自己的抽屉，再看后墙。别急着往楼上走。」',next:'t'};
TALK.hint_deskmate.nodes.t={text:'他没有看那张空椅子。\n\n「刚才翻页的声音里，有一下慢了半拍。你也听到了吧？」',end:true};
TALK.class46_empty={nodes:{s:{text:'椅子上没有人。桌上放着一本摊开的书，纸页停在周五。\n\n我把手放到桌沿，下面有人敲了两下。\n我没有敲回去。\n\n书页最底下写着：「我没有迟到。」',set:'看过46班空位',end:true}}};
TALK.class46_margin={nodes:{s:{text:'黑板边缘留下三次点名的粉笔痕。\n第一遍：十九。\n第二遍：十九。\n第三遍的数字，被lg7用手掌擦掉了。\n\n擦痕后面写着：\n「到此为止。」',set:'看过点名擦痕',end:true}}};
function addClassClue(x,y,talk,who,art){var o={x:x,y:y,talk:talk,who:who,art:art,verb:'调查',if:'纸条',once:true};o._i=MAPS.school1.objs.length;MAPS.school1.objs.push(o);}
addClassClue(25,13,'class46_empty','没有人的最后一张课桌','paper');
addClassClue(25,8,'class46_margin','黑板旁被擦掉的数字','board');
MAPS.school1.allObjs=null;
writeNode('free_laoli','s','lg7在走廊低声问：「照片里的人，你认得吗？」\n\n那个同学跟我小学同过桌。我不会认错。\n「那就别听别人怎么说。先查旧名单。」\n\n目标：听清走廊点名，只答自己的名字，再去校门借旧名单。');
writeNode('free_shui','s','lg7看见我摸空了的手机口袋，没再问化学考多少分。\n\n「手机我收的。那天你搬过样品，照片不能随便删。」\n他把后山墙上的刻字位置画在纸角。\n\n目标：去后山按六条守则的开头擦苔，再找回手机。');
writeNode('free_logic','s','lg7看见我在对门牌，停了下来。\n「我换过一块牌子，以为这样就不会有人再进去。」\n\n他指着走廊的平面图。\n「别照着我改过的走。把图纸、门牌、登记表一起看。」\n\n目标：核对三份记录，找出没有门牌的那间教室。');
// The extra chapter now ends with an actual conversation with lg7.
var LG7_REPORTS={};
CAST.forEach(function(role){var map=role==='shui'?'canteen':'yard',x=role==='shui'?8:33,y=role==='shui'?23:24;
 var st=step(2,'把旧校区证据交给lg7，当面问清楚','lg7核对过证据',map,x,y+1,['lg7_report']);st.annex=true;st.npc='lg7';LG7_REPORTS[role]=st;ROUTE_STEPS[role].push(st);TASKS.push(Object.assign({who:role},st));
});
MAPS.yard.npcs.push({id:'lg7',tx:33,ty:24,face:'down',talk:'lg7'});
MAPS.canteen.npcs.push({id:'lg7',tx:8,ty:23,face:'right',talk:'lg7'});
MAPS.resolve.npcs.push({id:'lg7',tx:3,ty:6,face:'right',talk:'lg7_inside'});
var penTrigger=MAPS.school1.triggers.find(function(t){return t.talk==='lg7_pen';});penTrigger.put=['lg7',17,11];
writeNode('lg7_pen','s','lg7已经在楼梯口等着。\n他把我们查出的证据摊在膝盖上，旁边放着那支泡过水的笔。');
writeNode('lg7_pen','t','「我试过断电、封门、改门牌，最后把名字也划了。」\n\n他盯着自己的手。\n「它反而每天都来点名。」');
writeNode('lg7_pen','u','「那些规矩，只能让你活着走过去。它们没法让他出来。」');
writeNode('lg7_pen','v','他擦干笔上的水，试了一下。\n纸上被黑墨盖住的字，慢慢重新显出来。',{scene:'film_lg7_pen'});
writeNode('lg7_pen','x','「如果他还在，先听他把那天说完。」\n\nlg7把笔交给我，松开了手。\n「我去把广播的供电找出来。别再让他一个人等。」');
TALK.lg7_inside={start:'s',again:'s',nodes:{s:{text:'lg7把肩膀顶在门上。门外有很多脚步，走到这儿就停住。\n\n「我以前只敢站在楼下。今天不走了。」\n「你去最后一排，听他把话说完。别替他编一个名字。」',end:true}}};
TALK.lg7_report={start:'s',again:'s',nodes:{
 s:{text:'',next:'q'},q:{text:'lg7把证据翻到最后一页。\n\n「现在你还想问我什么？」',opts:[{t:'你早知道有人被留在里面？',go:'truth'},{t:'你为什么一直不进去？',go:'fear'},{t:'接下来一起把他带出来',go:'ok'}]},
 truth:{text:'「知道。」\n\n他没有再说二楼不归他管。\n「人是我让他留下的。名单也是我划的。我把录音里的那声当成错误，把活人改成了空位。」',next:'q'},
 fear:{text:'「我每次走到门前，里面都会用我的声音说：人都走了。」\n\n「我就信一次。明天再信一次。」\n他把报名表摊平。\n「今天，你带来的东西让我没法再信了。」',next:'q'},
 ok:{text:'lg7在证据旁签上自己的名字。\n\n「先还原楼上的笔记，再去科技楼断广播。我会接应你。」\n\n证据保留在本子里。最终战中，lg7会帮忙压住回声，反击窗口延长一秒。',set:'lg7核对过证据',end:true}
}};
var reportRoleText={
 laoli:'lg7接过看台上的拓印。\n「这个座位原来留给他。体育课也是我点的名。」\n\n他把那张被划过的合影和拓印叠在一起，空位正好对上。',
 shui:'lg7接过原始送餐小票。\n「留校记录员那份，是我填的。」\n\n「手机我收着，是怕那段声音流出去。可我也把真正的证据锁了起来。」\n他把小票夹回报名表。',
 logic:'lg7接过三块界碑的记录。\n「那两根箭头，是我后来画的。我不想让人再走回那间屋。」\n\n「可路没被我改掉。我只是让别人走错了。」\n他划掉了自己加上的箭头。'
};
// More conversations, but no side conversation changes the route or clock.
TALK.lg7.entryBy=[{if:'译出化学笔记',go:'records'},{if:'有翻译笔',go:'wait'},{if:'纸条',go:'class'},{go:'first'}];
Object.assign(TALK.lg7.nodes,{
 class:{text:'lg7看了一眼46班后排的空椅子。\n「六条看完了吗？我只拦得住第三遍，拦不住你替它回答。」',opts:[{t:'那六条是你写的？',go:'rules'},{t:'我该查哪份记录？',go:'route'},{t:'你为什么不让别人再数？',go:'count'},{t:'我先去调查',go:'bye'}]},
 rules:{text:'「不是纪律。我把几次能活着走出来的办法，写成了规矩。」\n\n他抹掉纸角上沾着的红灰。\n「别拿它们证明那个人不存在。那是我犯的错。」',set:'听过lg7守则说明',end:true},
 count:{text:'「前两遍在数学生。第三遍，会记住数数的人。」\n\n他伸出食指，停在空椅子前。\n「我知道你还在。」\n这句话，他没有让广播听见。',end:true},
 route:{text:'',end:true},
 wait:{text:'「我已经找到广播的供电了。你先听清点名，别迎着声音进门。」\n\nlg7把水桶挪开，给楼梯让出路。\n「那支笔别再丢。纸上还有字。」',end:true},
 records:{text:'lg7盯着笔记最后一行：\n「老师，如果我没出来……」\n\n他把后半句念完了。\n「去科技楼断总控。校门口我等你。这一次你跑出来，我会接住。」',end:true}
});
var lg7OpenTalk=openTalk;
openTalk=function(n){
 var talk=n.talk;
 if(n.id==='lg7'){
  if(mainStep()===LG7_REPORTS[M.me.id]){n.talk='lg7_report';TALK.lg7_report.nodes.s.text=reportRoleText[M.me.id];}
  TALK.lg7.nodes.route.text={laoli:'「先听自己的点名，再拿旧名单来对。看台那张合影别丢，你认得那些人。」',shui:'「后山刻字按六条开头读，别按从左到右。手机在我办公桌里，密码看原子个数。」',logic:'「图纸、门牌、登记表都要看。旧校区的界碑也去量。不要只信我画过的路。」'}[M.me.id];
 }
 lg7OpenTalk(n);n.talk=talk;
};
var lg7Load=loadMap;
loadMap=function(id,x,y,dir){lg7Load(id,x,y,dir);if((id==='yard'||id==='canteen')&&!flagOn('接下看台委托')&&!flagOn('接下食堂委托')&&!flagOn('接下旧路委托'))M.npcs=M.npcs.filter(function(n){return n.id!=='lg7';});};
var lg7Repair=repairLegacySave;
repairLegacySave=function(version,build){if((!build||parseInt(String(build).replace('v',''),10)<27)&&flagOn('有翻译笔'))setFlag('lg7核对过证据');lg7Repair(version,build);};
writeNode('final_gate','u','是lg7。他没有站在墙根后面躲着。\n\n手里是广播供电的保险丝，袖口磨破了一块。\n「供电断了。里面还有回声，是我当初留下的。」');
TALK.final_gate.nodes.return={text:'我把楼上的笔记交给lg7。\n\n「他没有迟到。他一直在等你。」\n\nlg7拿起那张皱掉的报名表，走在我前面。\n「这次不是让你替我进去。我和你一起回去。」',set:'告诉lg7',end:true};
TALK.rs_open.nodes.s.scene='film_lg7_return';
writeNode('rs_open','t','lg7把门撑住。墙上的钟停在周五07:10。\n\n十九份卷子。最后一排还有一个人，面前没有卷子。');
writeNode('boss_end','u','lg7接住暗下去的样品，先放回讲台。\n然后走到最后一排，蹲在那个同学面前。\n「人是我让你留下的。名字也是我划掉的。」');
writeNode('boss_end','v','「我不能再让你等到明天。」\n\n他把原始报名表、我们查到的记录，一起摊开。\n这次，他在自己的签名下面又签了一遍。');
Object.assign(CLUES,{
 '纸条':'46班抽屉里是半张周五的合影，背面写着被涂黑的姓名栏。另一张是自己的笔迹：今天又是十八日，去找另一半。',
 '看过46班空位':'最后一张课桌没有人，书却跟着翻页。书底写着：我没有迟到。',
 '看过点名擦痕':'点名的前两遍都是十九；第三遍被lg7擦掉。',
 '听过lg7守则说明':'六条是lg7记下的求生办法，不能用它们证明那个同学不存在。',
 'lg7核对过证据':'lg7承认划掉名单、锁起照片和改动路牌的责任。已签名确认原始证据；最终战的反击窗口延长一秒。'
});
var lg7StartBoss=startBoss;
startBoss=function(hp){lg7StartBoss(hp);if(M.boss&&flagOn('lg7核对过证据'))M.boss.win+=1;};
var lg7BossTick=bossTick;
bossTick=function(dt){var b=M.boss;lg7BossTick(dt);if(!b||M.boss!==b||b.open<=0||b.supportHp===b.hp)return;b.supportHp=b.hp;toast('lg7在门边喊：'+(b.hp===3?'「灯亮了！我把外面的声音压住，你去关节点！」':b.hp===2?'「别走回影子那里！我在这儿。」':'「看持续亮的那盏，别信闪一下的！」'),2.6);};
var lg7FilmWorld=drawFilmWorld;
drawFilmWorld=function(){lg7FilmWorld();if(!M.film)return;var id=M.film.beat.film,t=M.film.t,p=Math.min(1,t/M.film.duration);cx.save();
 if(id==='class46'){cx.fillStyle='#ded6bb';cx.fillRect(23*TILE-9,8*TILE+5,31,18);for(var i=0;i<4;i++){cx.fillStyle='#666b5e';cx.fillRect(23*TILE-5,8*TILE+9+i*3,21,1);}}
 if(id==='class_empty'){cx.globalAlpha=.12+.18*Math.sin(p*Math.PI);drawSprite(M.me.id,25*TILE+16,13*TILE,'up',0,false,2);cx.globalAlpha=1;cx.fillStyle='#dfd4b8';cx.save();cx.translate(25*TILE+16,13*TILE-13);cx.rotate(Math.sin(p*Math.PI)*.3);cx.fillRect(-10,-5,20,9);cx.restore();}
 if(id==='lg7_knock'){drawSprite('lg7',(19.5+p*1.2)*TILE,11*TILE+16,'right',t,p<.7,2);cx.strokeStyle='#d9cba6';cx.lineWidth=2;cx.beginPath();cx.arc(21*TILE,11*TILE-17,4+Math.sin(p*Math.PI)*8,-.8,.8);cx.stroke();}
 if(id==='lg7_pen'){drawSprite('lg7',17*TILE+16,11*TILE+16,'down',0,false,2);cx.save();cx.translate(17*TILE+30,11*TILE-6);cx.rotate(-.5+p);cx.fillStyle='#9db1b2';cx.fillRect(-2,-15,4,28);cx.fillStyle='#d6c387';cx.fillRect(-2,10,4,4);cx.restore();}
 if(id==='lg7_return'){drawSprite('lg7',(7+p*3)*TILE,8*TILE,'right',t,true,2);cx.fillStyle='#d9ccae';cx.fillRect((7+p*3)*TILE+8,8*TILE-24,12,16);}
 cx.restore();};
var lg7World=drawWanderWorld;
drawWanderWorld=function(){lg7World();if(M.map==='school1'&&!M.film){cx.save();cx.fillStyle='#d6c9a6';cx.font='10px sans-serif';cx.textAlign='center';cx.fillText('空位',25*TILE+16,13*TILE-44);cx.restore();}if(M.boss){cx.save();drawSprite('lg7',3*TILE,12*TILE,'right',0,false,2);cx.restore();}};
