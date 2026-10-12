/* 三份独立证词：角色视角、专属调查室与可续存的调查操作。 */
'use strict';
var ROUTE_VOICES={
 laoli:{
  open_class:{s:'我拉开46班自己的椅子。旁边那张空桌的书已经摊好，边角压着一块橡皮。\n\n他以前总这样。今天却没人承认这张桌子有人坐过。',t:'十九个人，老师念了二十个名字。\n\n空桌下面答了一声「到」。声音像他。可是他回答前总会先把书放下。\n刚才没有那一下。',u:'前排开始笑。我差点也笑出来。\n\n不是好笑。是有人把我记得的声音塞进了那把空椅子。\n\n我得先闭嘴，别让它知道我认得谁。',x:'抽屉里是半张合影。我和他之间裂了一道白线。\n\n背面是我的字：「今天如果还是十八日，不要只凭声音认人。」\n我不记得写过。可那个歪掉的「日」字，只有我会这样写。'},
  free_laoli:{s:'lg7问我是不是认识空座位的人。\n「认识。小学同桌，借东西前总敲两下桌沿。」\n\n「那就记住动作，别只记声音。」他说。\n\n先听自己的点名，借旧名单，再回46班数两遍。我要查的是一个人，不是多出来的数字。'},
  f2_enter:{s:'二楼的粉笔味和小学教室一样。\n有人在墙后轻轻敲了两下。',t:'我差点敲回去。\n然后记起阅览室的书：他敲桌子是在借东西，敲完会等。墙后却没有停。',u:'东头多出一道门。门缝里塞着半截橡皮。\n\n先听清走廊点名，不要迎着声音进门。'},
  f2_rollcall:{s:'我往东走。有人用我们小学老师的声音点名。',t:'它连老师总念错的那个字都念错了。\n\n我认得这段录音。它却不该认识二楼。\n先退回西侧楼梯口。'},
  f2_wait:{s:'我退到楼梯口，把手背在身后。',t:'声音经过每一道门，空桌都答了一声。\n到东头，它忽然换成他的声音：「你忘了我吗？」',u:'我没有回答。\n忘了的那个人不会问我这个。他只会把橡皮推过来。\n脚步下楼了。现在能进去。'},
  f2_pen:{use3:'最后一行是他的笔迹：\n「07:10，它学会叫我的名字。\n老师说先留下来，别人才能出去。\n如果明天有人来，请把我的书收好。」\n\n我一直以为他是在等点名。原来他还在等一个认识他的人。'},
  final_gate:{return:'我把借阅页摊在lg7面前。\n「我答应过把书还给他。你答应过让他回去。」\n\nlg7没有把纸收走。他拎起保险丝。\n「那就都别再拖到明天。」'},
  him:{name:'「你借过我的橡皮。先敲两下桌沿，拿走以后放回右上角。」\n\n他的手动了一下。\n「原来还有人记得。」',name2:'我把借阅页放到他面前。\n「不是名单告诉我你在。是我记得你坐过这儿。」',ans4:'「最后一排有人。书还没还完。」\n\n我把橡皮放回他的桌角。\n走廊里那声假「到」断了。'},
  boss_end:{w:'他把书合上，站了起来。\n\n我没有急着让他坐到合影里。先把椅子拉开，等他自己走过来。',x:'第二天，46班少了一句「本来就没有这个人」。\n\n我留着借阅页。空座位上放着还回来的书，橡皮在右上角。\n这次，我知道该等谁来。'}
 },
 shui:{
  open_class:{s:'进46班，我先摸手机。空口袋。\n\n对，lg7收的。说我早读还录视频。现在空桌都在翻书，这也不能录？',t:'十九个人，老师念了二十个名字。\n\n空椅子答了「到」。我下意识去按录像，手指只按到校服的线头。\n上次那段还在手机里。lg7为什么不让我看？',u:'大家开始笑。我本来想跟同桌说「椅子成精了」。\n\n但空椅子用我的声音先说了。一个字都没差。\n我把嘴闭上。',x:'半张照片，背面写着九月十四日。我的字却写着：「视频不能只看最后一秒。」\n\n我不记得这句话。照片里那只送样品的手，我倒认得。是我的。'},
  free_shui:{s:'lg7看我摸口袋，伸手按住他的抽屉钥匙。\n「手机还你。但先看清那天你搬了什么。」\n\n我想说我就是顺手帮忙。话到嘴边，又想起瓶子里贴着我的名字。\n\n去后山按守则的开头擦苔，再查黑板、元素表，打开他的办公桌。'},
  f2_enter:{s:'二楼，还是那股饭盒没洗干净的味道。\n我手机里也有这条走廊。',t:'录像里我走了六道门。这里有七道。\n\n以前我会骂手机卡了。现在我把第七道也拍进去。',u:'东头的门底下漏出白光。\n录像自动对焦到门后，画面里却是我的背影。\n先听点名，别推门。'},
  f2_rollcall:{s:'我往东走。手机里的音量自己跳到了最大。',t:'走廊开始点名。手机却提前半秒播放同一句。\n\n下一句是：「进来，手机还你。」\n手机已经在我手上。先退回西侧楼梯。'},
  f2_wait:{s:'我退回楼梯，按住音量键。它一直自己往上跳。',t:'点名经过东头时，屏幕弹出「录像已删除」。\n\n我没碰删除。原始三段也还在。',u:'我关掉预览，不再跟弹窗吵。\n声音下楼了。我把手机扣在掌心，去看它想让我删掉的东西。'},
  f2_pen:{use3:'「07:10，样品模仿点名。\n送样品的同学已离开。记录员仍在室内。\n断电后模仿继续。」\n\n下面补着一句：「不要拿送饭前的照片，证明我们都走了。」\n我没拍完就跑了。后来又说自己什么都没看见。'},
  final_gate:{return:'我把三段完整视频和送餐小票放到lg7手里。\n「我搬过，录过，也跑过。这几个字都得写进去。」\n\n他点头。\n「手机你自己拿着。回去继续录，别替我剪掉。」'},
  him:{name:'我打开那段送饭录像，停在他接过餐盘的时候。\n「饭是我送的。我只拍了送来，没拍你走。」',name2:'我把小票压在他桌上。\n「谁说你不在，就让他把这三段都看完。」',ans4:'「留校记录员在这里。最后一份饭已经送到。」\n\n这次我没把摄像头转开。'},
  boss_end:{w:'lg7伸手想拿手机，我先缩了一下。\n他停住手：「你自己保管。完整的。」\n\n我把那句也录进去。',x:'我交出了完整录像，连自己逃跑那一段都留着。\n\n早读时手机还是被收。我没再拿这事开玩笑。\n小票夹在壳里，最后一行没有裁掉。'}
 },
 logic:{
  open_class:{s:'46班。已坐下十九人。\n\n我在本子上划十九笔，空桌的书翻了一页。\n记录：无人接触。翻页方向与窗外的风相反。',t:'老师念了二十个名字。空椅子回答。\n\n本子上出现第二十笔。墨是湿的。我的笔盖还没有打开。',u:'前排笑声向后传播，每排慢半拍。\n\n我本来想量间隔。第二十笔却开始弯曲，像一只闭着的眼。\n先停笔，保持安静。',x:'半张照片背面是我的记录：「9月14日，07:10，东头门牌缺失。」\n\n字迹符合。事件不记得。\n我在下面补上：记录需要复核。包括我的。'},
  free_logic:{s:'lg7说他换过东头的门牌。\n「门没动，只动了牌子？」\n「我以为没人找得到，就不会再进去。」\n\n我写下这句，没有写结论。先核对图纸、门牌、登记表。\n记忆会错，地图也可能被人改过。'},
  f2_enter:{s:'二楼。南北各三扇门，东头一扇。\n当前记录：七扇。',t:'本子上的旧记录写六扇。\n\n不是新门。第七扇的位置，我之前量过。\n我把「不存在」改成「被漏记」。',u:'东头门宽一格，影子宽两格。\n我停在楼梯口。先听走廊点名，暂不进入。'},
  f2_rollcall:{s:'我向东走。点名从西侧响起。',t:'声音经过三间教室，用了八秒。\n\n第四声从我口袋里的本子传出。\n声音的位置不等于房间的位置。退回西侧楼梯。'},
  f2_wait:{s:'我退回起点，将笔夹在本子外面。',t:'声音经过东头时，本子自己多出一句：「已确认无人。」\n\n我划掉「已确认」，在旁边写「谁确认的？」',u:'脚步下楼。新字停止增加。\n我的手在抖。\n记录：害怕。仍能行动。'},
  f2_pen:{use3:'记录：\n「07:10，样品重复点名。\n断电后回应仍在。\n记录员留室核对，其他人员离开。」\n\n门牌、名单、平面图后来全部少了一项。\n删除记录不能消除被记录的人。这句话我写了两次，防止它又替我改掉。'},
  final_gate:{return:'我把实测图和原图一起交给lg7。\n「修改处不能直接涂回去。要留修改前后，以及是谁改的。」\n\n他在两张图上都签名。\n我把真正的门画上去，和他一起返回。'},
  him:{name:'「我量过门到你这张桌子的距离。你的位置在房间里面，不在误差里面。」\n\n他看着图：「那我为什么出不去？」',name2:'我把被改过的登记表也摊开。\n「不是你不在。是我们用错的图，反过来认定你不在。」',ans4:'「最后一排，有人。原始记录补回，修改记录保留。」\n\n笔尖终于停在我自己想写的位置。'},
  boss_end:{w:'我把两张图压在窗台，一张原图，一张实测图。\n\n这一次，lg7没有让我把旧的丢掉。\n我也没有只留下自己算对的部分。',x:'新地图贴回走廊，修改日期和责任人一起留着。\n\n第七扇门不再需要别人相信才存在。\n本子最后一行是我写的：「今天没有重复。」\n我等了一会儿，没有东西替我补字。'}
 }
};
var routeVoiceGoto=gotoNode;
gotoNode=function(id){
 var role=M.me&&M.me.id,voices=ROUTE_VOICES[role],script=M.talk.script;
 if(voices&&script)Object.keys(voices).some(function(name){if(TALK[name]!==script)return false;var text=voices[name][id];if(text!==undefined&&script.nodes[id])script.nodes[id].text=text;return true;});
 return routeVoiceGoto(id);
};
CAST.forEach(function(role){
 var caption={laoli:'空椅子用了熟人的声音。\n但没有放下书。',shui:'我的声音，先从空桌底下传出。\n手机却不在我手上。',logic:'十九笔。二十笔。\n我的笔盖还没打开。'}[role];
 SCENES['film_class46_'+role]=[filmBeat('class46',2.2,'46班，早读。\n'+caption,24,11,{zoom:1.35,cue:'knock'}),filmBeat('class_empty',2.4,'书自己翻页。\n没有人承认看见。',25,13,{zoom:1.5,cue:'scrape'})];
});
var routeVoiceOpen=openScript;
openScript=function(name,replay){if(name==='open_class')TALK.open_class.nodes.s.scene='film_class46_'+M.me.id;return routeVoiceOpen(name,replay);};

var ROUTE_ROOMS={
 laoli:{id:'reading',from:'hall2',x:8,y:13,title:'旧阅览室 · 借来的声音',prereq:'认出看台空位',first:'收好借阅证词',done:'认回借书的人'},
 shui:{id:'projection',from:'office',x:17,y:14,title:'放映室 · 未剪掉的八秒',prereq:'找回原始小票',first:'找齐原始片段',done:'保留完整录像'},
 logic:{id:'survey',from:'hall3',x:12,y:14,title:'测绘侧廊 · 图外的一格',prereq:'标出真实出口',first:'核对测绘基准',done:'留下两份地图'}
};
var ROUTE_EVIDENCE={
 laoli:[['借阅卡','借阅卡上有两个人的手印。一张日期填九月十四日，另一张填明天。\n\n他答过到就先放下书，不会一边答一边翻页。'],['夹在书里的橡皮','橡皮上有两道指甲印。\n借东西前他敲两下；还东西时直接推过来，从不再敲。\n\n下面还有一张餐票。时间07:09，视频截图却写07:10。'],['归还登记','最末一行：「归还时不要叫出声，给我留个位置。」\n\n我忽然记不起他的脸。可我还记得这些小事。先把它们写下来。']],
 shui:[['原始片段①','07:06。我把黄色样品送到辅导室。瓶盖开着，饭锅仍盖着。\n\n背景里一个同学敲两下桌沿，另一个把橡皮借给他。'],['原始片段②','07:09。我递进最后一份饭。记录员接过餐盘，样品的盖子已经合上。\n\nlg7在门口说：「你留下，其他人出去。」'],['原始片段③','07:10。我往外跑。记录员没跟出来。笑声却在离开以后才加入音轨。\n\n三份文件的创建时间相同。剪辑版本把顺序改了。']],
 logic:[['西侧基准桩','实测基准：左墙x=4，右墙x=22。两点横向距离十八格。\n\n以玩家站立处为测点，直线距离取两点坐标差；绕路长度不算。'],['旧测绘页','旧图把右墙写成x=21，房间少一格。\n\n同一块擦痕下面，留下「书」「饭」「门」三个字。不是空白。'],['保留修改痕','纸上两种墨：原图十九日签字，修改记录却写十八日。\n\n我的初稿也跟着旧图少画一格。错的不只有lg7。先留下它，再做实测。']]
};
function routeKey(role,n){return '独立证词:'+role+':'+n;}
function routeRound(role){for(var i=0;i<3;i++)if(!flagOn(routeKey(role,'解'+i)))return i;return 3;}
function routeEvidenceCount(role){return [0,1,2].filter(function(i){return flagOn(routeKey(role,i));}).length;}
CAST.forEach(function(role){
 var r=ROUTE_ROOMS[role];
 EPISODES[r.id]={from:r.from,x:r.x,y:r.y,title:r.title,reward:r.done,location:r.title+'：仅限对应角色，旧校区调查完成后进入。'};
 var objs=ROUTE_EVIDENCE[role].map(function(e,i){return episodeObj(5+i*8,5,e[0],'route_evidence_'+i,i===1?'drawer':'paper');});
 objs.push(episodeObj(13,11,role==='laoli'?'听借书的声音':role==='shui'?'修复原始时间线':'测绘台 · 确认测量','route_trial','board'));
 objs.push(episodeObj(13,17,'返回原来的走廊','leave','door'));
 if(role==='logic')objs.push(episodeObj(4,13,'左墙测点 · 设置起点','route_mark','paper'),episodeObj(22,13,'右墙测点 · 读取距离','route_measure','paper'));
 makeMap(r.id,{w:28,h:20,base:'void',spawn:[13,16],objs:objs,deco:[{x:5,y:8,n:3,dx:8,art:'desk'}]},function(){episodeLayout(28,20,r.title);R('wall',10,3,1,6);R('wall',18,3,1,6);NAME(2,14,24,2,'原始记录保留区');});
 var entry=episodeObj(r.x,r.y,r.title,'enter_'+r.id,'door');entry.if=['是:'+role,r.prereq];entry._i=MAPS[r.from].objs.length;MAPS[r.from].objs.push(entry);MAPS[r.from].allObjs=null;
 var steps=[step(2,'进入'+r.title,'进入独立调查:'+role,r.from,r.x,r.y,['route_'+role+'_entry']),step(2,'调查三份原始证词：'+r.title,r.first,r.id,13,5,['route_'+role+'_evidence']),step(2,role==='laoli'?'辨认三次借书声，给真正的人留位置':role==='shui'?'按原始时间还原三段录像，保留完整版本':'设置左右测点，实测距离，再保留原图与修改记录',r.done,r.id,13,12,['route_'+role+'_trial'])];
 steps.forEach(function(s){s.routeExtra=true;TASKS.push(Object.assign({who:role},s));});
 var at=ROUTE_STEPS[role].indexOf(LG7_REPORTS[role]);ROUTE_STEPS[role].splice.apply(ROUTE_STEPS[role],[at,0].concat(steps));
 TALK[r.id+'_intro']={nodes:{s:{text:{laoli:'阅览室的窗外是46班。可这里在另一栋楼。\n\n三个书架上留着借阅卡、橡皮和归还记录。先看完，再去中间的桌子听声音。\n声音可以仿，习惯会露出破绽。',shui:'手机连接投影仪，屏幕亮出三个损坏的片段。\n\n先查看左、中、右三个文件，再到放映台按事件先后修复。\n正确片段会保留；选错可以重试，不必重新找手机。',logic:'侧廊比地图多一格。\n\n先看三份测绘资料。再到左墙设置起点，走到右墙读取距离，到中间测绘台确认。\n记录会保存在本子里。离开或重读也不会丢。'}[role],end:true}}};
 CLUES[r.first]=ROUTE_EVIDENCE[role].map(function(e){return e[1];}).join('\n\n');
 CLUES[r.done]={laoli:'确认放书再答到、借物敲两下、归还不再敲。真正的人想要一个能坐下的位置。',shui:'原始时间线：送样品→送最后一份饭→离开后才加入笑声。保留完整原始版本。',logic:'左右墙实测相隔十八格，旧图少一格。保留实测图与修改痕，不能拿删除后的图证明房间无人。'}[role];
});
MAPW=MAPS.campus.w;MAPH=MAPS.campus.h;
var routeMainSteps=mainSteps;
mainSteps=function(){return routeMainSteps().filter(function(s){return !s.routeExtra||!flagOn('旧存档已过独立调查');});};
var routeRepair=repairLegacySave;
repairLegacySave=function(version,build){if((!build||parseInt(String(build).replace('v',''),10)<28)&&(flagOn('有翻译笔')||flagOn('lg7核对过证据')))setFlag('旧存档已过独立调查');routeRepair(version,build);};
var routeEnter=enteredEpisode;
enteredEpisode=function(id){
 var role=CAST.find(function(role){return ROUTE_ROOMS[role].id===id;});
 if(role){var r=ROUTE_ROOMS[role];if(M.me.id!==role||!flagOn(r.prereq)||M.chase||M.boss){toast('先完成本子里的旧校区调查。');return;}setFlag('进入独立调查:'+role);}
 routeEnter(id);
};
TALK.route_evidence={nodes:{s:{text:'',end:true}}};
TALK.route_trial={nodes:{s:{text:'',opts:[]},wrong:{text:'',next:'s'},right:{text:'',end:true},done:{text:'原始证据已经保存。可以再看一遍，或返回找lg7。',end:true}}};
var ROUTE_TRIALS={
 laoli:[['门外用他的声音说：「到」。书还在不停翻。',[['马上开门','wrong'],['等书放下，再听回答','right']], '书忽然合上。这一次「到」在合书之后。我把第一张借阅卡留下。'],['桌沿被敲了两下。声音问：「橡皮还我了吗？」',[['借东西才敲两下：这是在套我的话','right'],['他声音一样，把橡皮递出去','wrong']], '我没有递。桌下伸出的手收回去；真正的橡皮仍在书页里。'],['椅子后面没有声音。桌角的橡皮慢慢推向我。',[['逼他再答一次点名','wrong'],['把书和橡皮放好，留出座位','right']], '我拉开椅子。\n「脸我一时想不起来。但我没忘掉你。」\n借阅卡上，明天的日期终于变成今天。']],
 shui:[['第一段应该从哪件事开始？',[['样品送到，瓶盖开着','right'],['我已经离开，走廊响起笑声','wrong'],['最后一份饭送到','wrong']], '07:06。样品是我搬的。我把自己的手也留在画面里。'],['接下来，哪一段能证明屋里仍然有人？',[['截一张空走廊的图片','wrong'],['记录员接过最后一份饭','right'],['把没有拍到的地方补成无人','wrong']], '07:09。记录员接过餐盘。画面里，他没有走向门口。'],['最后一段有两条音轨，如何保存？',[['删掉我跑出去的那几秒','wrong'],['只保留比较清楚的笑声','wrong'],['保留原始画面，并注明笑声后来加入','right']], '07:10。摄像头离开门口，原始音轨只有脚步。\n笑声来自另一份文件。\n我按下「保留全部」，没有再按裁剪。']],
 logic:[['确认左右墙的实测间距。',[['十八格，使用两测点的坐标差','right'],['十七格，沿用旧图','wrong']], '实测十八格，旧图十七格。差的一格在房间里，不能画到围墙外。'],['新实测图已经画好，旧图怎么处理？',[['擦掉错误，让所有图一致','wrong'],['保留原图，并注明谁改了哪里','right']], '原图与实测图叠在一起。少的一格里，出现最后一排的课桌。'],['我的初稿也少画了一格。记录如何提交？',[['只写lg7改错的部分','wrong'],['把自己的误判也一起留下','right']], '我留下初稿，写上自己的修改记录。\n纸上的眼睛闭起来。\n门还是那扇门，这次无需把它删掉。']]
};
function prepareRouteTrial(){
 var role=M.me.id,round=routeRound(role),nodes=TALK.route_trial.nodes;
 if(round===3)return 'done';
 if(routeEvidenceCount(role)<3){toast('先看三份资料，再来这里。');return null;}
 if(role==='logic'&&!flagOn('实测过左右墙')){toast('先到左墙设置起点，再到右墙读取距离。');return null;}
 var q=ROUTE_TRIALS[role][round];nodes.s.text='第'+(round+1)+'份核对\n\n'+q[0];nodes.s.opts=q[1].map(function(o){return {t:o[0],go:o[1]};});
 nodes.wrong.text={laoli:'声音一样，动作却不对。我把借阅记录再看一遍，暂时没有开门。\n\n窗外的空桌向这里挪了一点。重新判断。',shui:'片段接上以后，时间往回跳了。\n不是按事件发生的顺序。原始文件还在，可以重新选择。',logic:'两张纸叠不上。\n不能为了让它们一致，删掉实际测到的那一格。重新确认。'}[role];
 nodes.right.text=q[2];nodes.right.scene=round===2?'film_route_'+role:undefined;return 's';
}
var routePress=pressObj;
pressObj=function(o){
 if(!o||!o.action||!o.action.startsWith('route_'))return routePress(o);
 if(!episodeActive()||!objLive(o))return;
 var role=M.me.id,r=ROUTE_ROOMS[role];if(M.map!==r.id)return;
 if(o.action.startsWith('route_evidence_')){var i=Number(o.action.slice(-1));setFlag(routeKey(role,i));if(routeEvidenceCount(role)===3)setFlag(r.first);TALK.route_evidence.nodes.s.text=ROUTE_EVIDENCE[role][i][1];checkpoint('保存原始证词');openScript('route_evidence');}
 else if(o.action==='route_trial'){var start=prepareRouteTrial();if(start){TALK.route_trial.start=start;openScript('route_trial');}}
 else if(o.action==='route_mark'){setFlag('测绘起点',{x:o.x,y:o.y});checkpoint('设置测绘起点');toast('左墙基准钉已记下。到右墙取第二个测点。');}
 else if(o.action==='route_measure'){var p=FLAGS['测绘起点'];if(!p){toast('先到左墙设置起点。');return;}var dx=Math.abs(o.x-p.x),dy=Math.abs(o.y-p.y);setFlag('实测过左右墙');setFlag('测绘结果',{x:dx,y:dy});checkpoint('保存实测结果');TALK.route_evidence.nodes.s.text='两枚基准钉横向差：'+dx+'格；纵向差：'+dy+'格。\n\n旧图标十七格，实测十八格。\n我把这一次的结果和旧图放在一起，去中间测绘台确认。';openScript('route_evidence');}
};
var routeTrialGoto=gotoNode;
gotoNode=function(id){
 if(M.talk.script===TALK.route_trial&&!M.talk.replay&&id==='right'){
  var role=M.me.id,round=routeRound(role);if(round<3){setFlag(routeKey(role,'解'+round));if(routeRound(role)===3)setFlag(ROUTE_ROOMS[role].done);}
 }
 if(M.talk.script===TALK.route_trial&&id==='s')prepareRouteTrial();
 return routeTrialGoto(id);
};
var routeSync=syncEpisodeUI;
syncEpisodeUI=function(){
 var role=M.me&&M.me.id,r=ROUTE_ROOMS[role];if(!r||M.map!==r.id){delete episodeHud.dataset.route;return routeSync();}
 var active=episodeActive();document.body.classList.toggle('in-episode',M.screen==='play');displayEpisode(episodeHud,active?'block':'none');displayEpisode(episodeControls,active?'flex':'none');
 [crouchBtn,paperBtn,photoBtn,photoReference].forEach(function(el){displayEpisode(el,'none');});if(!active)return;
 var detail='原始证词 '+routeEvidenceCount(role)+'/3 · 已核对 '+routeRound(role)+'/3'+(flagOn(r.done)?' · 返回找lg7':role==='logic'?' · 左墙起点 → 右墙测量 → 中间确认':' · 看完资料，到中间桌核对');
 var sig=M.map+':'+detail;if(episodeHud.dataset.route!==sig){episodeHud.dataset.route=sig;episodeHud.innerHTML='<b>'+r.title+'</b><br>'+detail;}
};
Object.assign(reportRoleText,{
 laoli:'我把合影、借阅页和橡皮放在lg7面前。\n「我记不起整张脸，但我知道他怎么借东西。你不该让我用名单来证明他不在。」\n\nlg7翻到归还登记。「他本来说明天还书。是我让他留下。」',
 shui:'我把原始三段接在一起，没有裁掉自己逃跑的画面。\n「饭送到的时候他还在。笑声后来才加进去。你那张全员离校的照片不能算。」\n\nlg7没有让我删。「手机我收的。资料也是我锁起来的。都写上。」',
 logic:'我把原图、实测图和自己的初稿并排摊开。\n「房间多的一格没有消失。我也照着你的旧图，漏画过一次。」\n\nlg7拿起笔：「把我修改的两根箭头留下，旁边写我的名字。」'
});
CAST.forEach(function(role){SCENES['film_route_'+role]=[
 filmBeat('route_'+role,2.5,{laoli:'没有答到。\n椅子先拉开了一点。',shui:'画面倒回07:06。\n这一次，没有剪掉我的手。',logic:'两张地图叠在一起。\n漏画的一格里，放着一张课桌。'}[role],13,10,{zoom:1.25,cue:'scrape'}),
 filmBeat('route_'+role,2.4,{laoli:'橡皮推到桌角，停住。\n那个人没有催我想起他的脸。',shui:'07:10。\n先有离开的脚步，后来才有笑声。',logic:'记录：害怕。\n记录：门存在。'}[role],13,10,{zoom:1.35,black:.25})
];});
var routeFilmWorld=drawFilmWorld;
drawFilmWorld=function(){routeFilmWorld();if(!M.film||!M.film.beat.film.startsWith('route_'))return;var role=M.film.beat.film.slice(6),t=M.film.t;cx.save();
 if(role==='laoli'){cx.globalAlpha=.16;drawSprite('deskmate',13*TILE+16,10*TILE+16,'down',0,false,2);cx.globalAlpha=1;cx.fillStyle='#d7c89f';cx.fillRect(13*TILE+7+Math.min(1,t/2)*8,10*TILE-7,8,5);}
 if(role==='shui'){cx.fillStyle='#b7c8bf';cx.fillRect(11*TILE,8*TILE,5*TILE,3*TILE);cx.globalAlpha=.65;drawSprite('shui',12*TILE+16,10*TILE,'right',t,true,2);drawSprite('deskmate',14*TILE+16,10*TILE,'down',0,false,2);cx.globalAlpha=1;cx.fillStyle='#294344';cx.font='12px monospace';cx.fillText(t<1?'07:06':t<2?'07:09':'07:10',11*TILE+6,8*TILE+15);}
 if(role==='logic'){cx.fillStyle='#c1b799';cx.fillRect(11*TILE,9*TILE,4*TILE,2*TILE);cx.strokeStyle='#534d43';cx.strokeRect(11*TILE+8,9*TILE+8,3*TILE,40);cx.strokeStyle='#914943';cx.strokeRect(14*TILE+8,9*TILE+8,24,40);cx.fillStyle='#625847';cx.fillRect(14*TILE+12,9*TILE+16,15,12);}
 cx.restore();};
var routeEnding=endingFor;
endingFor=function(){var end=routeEnding(),role=M.me&&M.me.id;if(!flagOn('干掉奶蛙')||!ROUTE_ROOMS[role])return end;
 end.title='在学校乱逛 · '+{laoli:'留一个位置',shui:'保留全部',logic:'图上有人'}[role];
 end.lines=['放学铃完整响完。lg7和最后一排的同学一起走出辅导室。',ROUTE_VOICES[role].boss_end.w,ROUTE_VOICES[role].boss_end.x];
 if(flagOn('保住底片'))end.lines.push('底片也留下来，照片里的那个人终于看向镜头。');
 if(flagOn('切断广播'))end.lines.push('空白磁带里只剩一句很轻的「明天见」。');
 end.lines.push('校门口的钟走到了十八点。日期变成十九日。');return end;};
Object.assign(PICK_NOTE,{laoli:'他认得那个被忘掉的人。辨认声音与习惯，找回借阅证词，留出一个位置。',shui:'他搬过样品，也拍过视频。找回手机，还原完整录像，面对自己做过的事。',logic:'她追查变化的校园。实测被漏掉的一格，保留地图的修改记录，也核对自己的判断。'});
var routeWorld=drawWanderWorld;
drawWanderWorld=function(){routeWorld();var role=CAST.find(function(role){return ROUTE_ROOMS[role].id===M.map;});if(!role)return;cx.save();
 if(role==='laoli'){
  [5,13,21].forEach(function(x){cx.fillStyle='#36342b';cx.fillRect(x*TILE-22,3*TILE,44,40);for(var j=0;j<8;j++){cx.fillStyle=['#785447','#687467','#a0906f'][j%3];cx.fillRect(x*TILE-18+j*5,3*TILE+4,3,28);}cx.fillStyle='#24231f';cx.fillRect(x*TILE-22,4*TILE+1,44,5);});
  cx.globalAlpha=.14;drawSprite('deskmate',13*TILE+16,10*TILE,'down',0,false,2);
 }else if(role==='shui'){
  cx.fillStyle='#282e31';cx.fillRect(10*TILE,2*TILE+8,7*TILE,3*TILE);cx.fillStyle='#87918a';cx.fillRect(10*TILE+8,2*TILE+16,7*TILE-16,3*TILE-16);
  cx.fillStyle='#384a45';cx.font='12px monospace';cx.fillText('09/14    ORIGINAL',10*TILE+18,3*TILE+4);cx.fillText('07:06 > 07:09 > 07:10',10*TILE+18,4*TILE+4);
  cx.globalAlpha=.08;cx.fillStyle='#e0e3bd';cx.beginPath();cx.moveTo(13*TILE+16,10*TILE);cx.lineTo(10*TILE,5*TILE);cx.lineTo(17*TILE,5*TILE);cx.closePath();cx.fill();
 }else{
  cx.fillStyle='#d0c2a0';cx.fillRect(11*TILE,3*TILE,5*TILE,2*TILE);cx.strokeStyle='#686352';for(var i=0;i<4;i++){cx.beginPath();cx.moveTo(11*TILE+8,3*TILE+12+i*12);cx.lineTo(16*TILE-8,3*TILE+12+i*12);cx.stroke();}
  cx.strokeStyle='#b75449';cx.strokeRect(15*TILE,3*TILE+8,24,46);cx.globalAlpha=.3;cx.setLineDash([5,5]);cx.beginPath();cx.moveTo(4*TILE+16,13*TILE+16);cx.lineTo(22*TILE+16,13*TILE+16);cx.stroke();
 }
 cx.restore();};
