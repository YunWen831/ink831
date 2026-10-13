(function (root) {
  'use strict';
  const shuffle = (items, rng=Math.random) => {
    const result = [...items];
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  };
  const freshRecord = () => ({exposures:0,attempts:0,recognised:0,spelled:0,hints:0,errors:0,lastSeen:0,due:0});
  const recordFor = (profile, word) => profile[word] || (profile[word]=freshRecord());
  const normaliseAnswer=value=>String(value).normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ');
  const RELICS = [
    {id:'edge',name:'磨刀石',mark:'✦',group:'attack',desc:'每次连词额外造成 5 点伤害。',max:8},
    {id:'spark',name:'连锁闪电',mark:'ϟ',group:'attack',desc:'每次连词追加 6 点闪电伤害。'},
    {id:'ward',name:'厚壳',mark:'◇',group:'shield',desc:'每个护盾格额外提供 2 点护盾。'},
    {id:'thorn',name:'荆棘',mark:'✳',group:'shield',desc:'将挡住伤害的 60% 反弹给敌人，每级叠加。'},
    {id:'bash',name:'盾击',mark:'◈',group:'shield',desc:'将本次获得护盾的 60% 化为伤害，每级叠加。'},
    {id:'mend',name:'嫩芽',mark:'✿',group:'heal',desc:'每个恢复格多恢复 1 点生命；过关多恢复 1 点。',max:3},
    {id:'leech',name:'暖流',mark:'♥',group:'heal',desc:'无失误且未用熟词提示的连词，恢复 2 点生命。',max:3},
    {id:'retain',name:'余温',mark:'▱',group:'shield',desc:'敌人行动后，最多保留 6 点剩余护盾。'},
    {id:'double',name:'剑舞',mark:'⚔',group:'attack',desc:'至少 2 个攻击格额外造成 10 点伤害；3 个攻击格压制敌人，攻击降低 3 点。'},
    {id:'burn',name:'余烬',mark:'♨',group:'attack',desc:'每个攻击格叠加 2 点灼烧，每回合持续造成伤害。'},
    {id:'warp',name:'穿隙',mark:'↗',group:'rule',desc:'一次连词中，可以跨过一格连接一次。',max:1},
    {id:'echo',name:'回声',mark:'↺',group:'rule',desc:'每第三次连词，追加上次伤害的 60%。'},
    {id:'focus',name:'记忆结晶',mark:'▰',group:'memory',desc:'独立拼写成功的连词，额外造成 10 点伤害。'},
    {id:'vitality',name:'生命之种',mark:'✚',group:'heal',desc:'生命上限增加 8，立即恢复 8 点生命。',max:Infinity},
    {id:'camp',name:'营火',mark:'♧',group:'rest',desc:'立即恢复 28 点生命，占用本次升级机会。',max:Infinity,bossOnly:true},
    {id:'spring',name:'清泉',mark:'≈',group:'rest',desc:'立即恢复 16 点生命，占用本次升级机会。',max:Infinity},
    {id:'growth',name:'远征之刃',mark:'➶',group:'attack',desc:'每次连词额外造成 3 点伤害，可以不断叠加。',max:Infinity}
  ];
  const TOTAL_FLOORS=24,CHAPTERS=['苔纸回廊','灰烬书库','遗忘深渊'];
  const ENEMIES=[
    {name:'墨团',hp:32,attack:6,trait:'plain'},
    {name:'藏书守卫',hp:39,attack:7,trait:'armor'},
    {name:'裂页兽',hp:37,attack:7,trait:'rage'},
    {name:'噬墨蝠',hp:41,attack:7,trait:'leech'},
    {name:'荆棘纸牙',hp:34,attack:6,trait:'thorns'},
    {name:'蚀盾雾灯',hp:40,attack:8,trait:'erosion'},
    {name:'遗忘之眼',hp:36,attack:7,trait:'pierce'},
    {name:'补页者',hp:43,attack:6,trait:'regen'}
  ];
  const BOSSES=[
    {name:'藏书巨像',trait:'archive'},
    {name:'余烬审判者',trait:'embers'},
    {name:'遗忘之王',trait:'king'}
  ];
  class Game {
    constructor(words, profile={}, rng=Math.random, now=()=>Date.now()) {
      this.words=words; this.profile=profile; this.rng=rng; this.now=now;
      this.phase='home'; this.scope='all'; this.state=null;
    }
    start(scope='all',difficulty='normal') {
      this.scope=scope; this.recent={};this.difficulty=difficulty==='hard'?'hard':'normal';
      this.available=this.words.filter(w=>scope==='all'||w.level===Number(scope));
      if (this.available.length<3) throw new Error('词库至少需要三个词');
      const unknown=shuffle(this.available.filter(w=>!this.profile[w.word]?.exposures),this.rng);
      const old=shuffle(this.available.filter(w=>this.profile[w.word]?.exposures),this.rng)
        .sort((a,b)=>(this.profile[a.word].due||0)-(this.profile[b.word].due||0));
      const initialNew=unknown.slice(0,4);
      this.pool=[...old.slice(0,6),...initialNew];
      if (this.pool.length<3) this.pool=this.available.slice(0,3);
      this.newQueue=unknown.slice(initialNew.length);
      const maxHp=this.difficulty==='hard'?64:72,hintLimit=this.difficulty==='hard'?1:2,penalty=this.difficulty==='hard'?4:3;
      this.state={hp:maxHp,maxHp,shield:0,floor:1,round:0,turn:0,relics:{},burn:0,lastDamage:0,
        totalFloors:TOTAL_FLOORS,endless:false,hintLimit,penalty,roomHints:hintLimit,turnMistakes:0,failedTurns:0,mistakeDamage:0,
        chains:0,touches:0,independentSpells:0,newWords:new Set(),practised:new Set(),mistakes:0,hints:0};
      this.lesson=initialNew; this.pendingFloor=1;
      if (this.lesson.length) this.phase='lesson'; else this.enterFloor(1);
      return this;
    }
    finishLesson() {
      if (this.phase!=='lesson') return;
      for (const w of this.lesson) {
        const r=recordFor(this.profile,w.word);
        if (!r.exposures) this.state.newWords.add(w.word);
        r.exposures++; r.lastSeen=this.now(); r.due=this.now()+2*60*1000;
      }
      this.enterFloor(this.pendingFloor);
    }
    enterFloor(floor) {
      const chapter=Math.floor((floor-1)/8),local=(floor-1)%8+1,boss=local===8,elite=local===4;
      this.state.floor=floor; this.state.round=0; this.state.burn=0;this.state.roomHints=this.state.hintLimit;
      let template=boss?BOSSES[chapter%3]:floor===1?ENEMIES[0]:shuffle(ENEMIES,this.rng)[0];
      let hp=boss?130+chapter*120:Math.round((template.hp+chapter*34+local*3)*(elite?1.55:1));
      let attack=boss?12+chapter*6:template.attack+chapter*4+(elite?3:0);
      if(this.difficulty==='hard'){hp=Math.round(hp*1.25);attack=Math.ceil(attack*1.3);}
      const armor=template.trait==='armor'?6+chapter*2:template.trait==='archive'?4+chapter:0;
      this.enemy={...template,name:(elite?'精英 · ':'')+template.name,hp,maxHp:hp,attack,armor,chapter,boss,elite};
      this.phase='battle'; this.newTurn();
    }
    modeFor(w,index) {
      const record=recordFor(this.profile,w.word);
      if (record.attempts===0) return 'guided';
      if (index===2 && record.recognised>=2 && w.word.replace(/[^A-Za-zÀ-ÿ]/g,'').length>=3) return 'spell';
      return 'recognise';
    }
    newTurn() {
      if (this.phase!=='battle') return;
      this.state.turn++; this.state.round++;
      let candidates=shuffle(this.pool,this.rng);
      candidates.sort((a,b)=>(this.recent[a.word]??-99)-(this.recent[b.word]??-99));
      this.targets=candidates.slice(0,3).map((w,i)=>({...w,mode:this.modeFor(w,i)}));
      this.assisted=this.targets.map(w=>w.mode==='guided');
      this.path=[]; this.warpUsed=false; this.spellReady=false; this.spellingValidated=false;
      this.state.turnMistakes=0;this.state.suppression=0;this.assistanceUsed=false;
      this.makeBoard();
    }
    makeBoard() {
      // 两条独立的正确路线确保每个回合可解；重复词格提供攻击/防守选择。
      const routes=[];
      const walk=(start,length=3) => {
        const route=[start];
        for(let step=1;step<length;step++) {
          const options=[];
          for(let i=0;i<16;i++) if(!route.includes(i)&&!routes.flat().includes(i)&&this.near(route.at(-1),i)) options.push(i);
          if(!options.length) return null;
          route.push(shuffle(options,this.rng)[0]);
        }
        return route;
      };
      for(let n=0;n<2;n++) {
        let route=null;
        for(const start of shuffle(Array.from({length:16},(_,i)=>i),this.rng)) {
          if(routes.flat().includes(start)) continue;
          route=walk(start); if(route) break;
        }
        if (!route) throw new Error('未生成有效路线');
        routes.push(route);
      }
      this.board=Array.from({length:16},(_,i)=>({index:i,word:shuffle(this.pool,this.rng)[0],kind:shuffle(['sword','sword','shield','heart'],this.rng)[0]}));
      routes.forEach((route,n)=>route.forEach((i,step)=>{
        this.board[i].word=this.targets[step];
        this.board[i].kind=n===0?'sword':(step===2?'heart':'shield');
      }));
    }
    near(a,b,reach=1) {
      const dx=Math.abs(a%4-b%4),dy=Math.abs(Math.floor(a/4)-Math.floor(b/4));
      return a!==b&&Math.max(dx,dy)<=reach;
    }
    select(index) {
      if(this.phase!=='battle'||this.spellReady) return {type:'ignore'};
      const selectedAt=this.path.indexOf(index);
      if(selectedAt>=0) {this.path=this.path.slice(0,selectedAt);this.warpUsed=this.path.some((v,i)=>i>0&&!this.near(this.path[i-1],v));return {type:'undo'};}
      const target=this.targets[this.path.length],tile=this.board[index];
      if(!target||!tile) return {type:'ignore'};
      if(tile.word.word!==target.word) {
        this.assisted[this.path.length]=true;
        const revealed=this.targets.findIndex(w=>w.word===tile.word.word);
        if(revealed>=0) this.assisted[revealed]=true;
        const r=recordFor(this.profile,target.word); r.errors++; r.due=this.now()+60*1000;
        this.state.mistakes++;
        return this.penalise(target,`${tile.word.word} 是“${tile.word.meaning}”；目标是 ${target.word}（${target.meaning}）。`);
      }
      if(this.path.length&&!this.near(this.path.at(-1),index)) {
        if(this.state.relics.warp&&!this.warpUsed&&this.near(this.path.at(-1),index,2)) this.warpUsed=true;
        else return {type:'far',message:'需要连接相邻格，横、竖、斜都可以。'};
      }
      this.path.push(index);
      if(this.path.length===3) {
        if(this.targets[2].mode==='spell') {this.spellReady=true;return {type:'spell'};}
        return {type:'ready'};
      }
      return {type:'selected'};
    }
    hint() {
      if(this.phase!=='battle') return;
      const index=Math.min(this.path.length,2);
      const target=this.targets[index],free=target.mode==='guided';
      if(!free&&this.state.roomHints<=0)return {blocked:true,message:'本场提示已用完。'};
      if(!free){this.state.roomHints--;this.assistanceUsed=true;}
      this.assisted[index]=true;
      recordFor(this.profile,target.word).hints++;
      this.state.hints++;
      return {...target,free};
    }
    bookHint() {
      return this.phase==='battle'||this.phase==='resolving'?{blocked:true,message:'战斗中请使用限次提示，战后可自由查看词册。'}:null;
    }
    spell(value) {
      if(!this.spellReady||this.phase!=='battle') return {type:'ignore'};
      const target=this.targets[2];
      if(![target.word,...(target.aliases||[])].map(normaliseAnswer).includes(normaliseAnswer(value))) {
        this.assisted[2]=true;this.state.mistakes++;
        const r=recordFor(this.profile,target.word);r.errors++;r.due=this.now()+60*1000;
        return this.penalise(target,`正确拼写是 ${target.word}（${target.meaning}）。`);
      }
      this.spellingValidated=true;
      return {type:'ready',independent:!this.assisted[2]};
    }
    penalise(target,message) {
      if(target.mode==='guided')return {type:'wrong',message:message+' 新词引导中，不扣血。'};
      this.assistanceUsed=true;
      const penalty=this.state.penalty;
      this.state.turnMistakes++;this.state.mistakeDamage+=penalty;this.state.hp=Math.max(0,this.state.hp-penalty);
      if(this.state.turnMistakes>=2||this.state.hp<=0){
        const result=this.failTurn(message+' 扣 '+penalty+' 血，连词中断，敌人行动。');
        return {type:'failed',message:result.message,result};
      }
      return {type:'wrong',message:message+' 扣 '+penalty+' 血；再错一次，敌人直接行动。'};
    }
    getIntent() {
      const e=this.enemy,s=this.state,trait=e.trait;
      let attack=e.attack,pierce=0,heal=0;
      const notes=[];
      if(trait==='rage'){attack+=Math.min(12,(s.round-1)*2);notes.push('每回合攻击 +2');}
      if(trait==='pierce'){pierce=3+e.chapter;notes.push('穿透 '+pierce);}
      if(trait==='armor'||trait==='archive')notes.push('护甲 '+e.armor);
      if(trait==='thorns')notes.push('连到 3 个攻击格，反伤 '+(3+e.chapter));
      if(trait==='erosion'&&s.round%2===0)notes.push('本回合护盾减半');
      if(trait==='leech')notes.push('攻击造成伤害时吸血');
      if(trait==='regen'){heal=5+e.chapter*2;notes.push('恢复 '+heal);}
      if(trait==='archive'&&s.round%3===0){attack+=8;heal=8+e.chapter*2;notes.push('蓄力 · 恢复 '+heal);}
      if(trait==='embers'){attack+=Math.floor((s.round-1)/3)*2;pierce=s.round%2===0?6+e.chapter:0;if(pierce)notes.push('灼伤穿透 '+pierce);}
      if(trait==='king'){pierce=8+e.chapter*2;if(s.round%3===0){attack+=14;heal=12+e.chapter*3;notes.push('蓄力 · 恢复 '+heal);}notes.push('穿透 '+pierce);}
      if(s.suppression){attack=Math.max(1,attack-s.suppression);notes.push('已压制 '+s.suppression);}
      return {attack,pierce,heal,text:'攻击 '+attack+(notes.length?' · '+notes.join(' · '):'')};
    }
    takeDamage(attack,pierce=0) {
      const s=this.state;
      const blocked=Math.min(Math.max(0,attack-pierce),s.shield),taken=attack-blocked;
      s.shield-=blocked;s.hp=Math.max(0,s.hp-taken);
      const reflected=Math.floor(blocked*.6*(s.relics.thorn||0));
      this.enemy.hp=Math.max(0,this.enemy.hp-reflected);
      return {blocked,taken,reflected};
    }
    enemyTurn() {
      const intent=this.getIntent(),result=this.takeDamage(intent.attack,intent.pierce);
      if(this.enemy.hp>0) {
        let heal=intent.heal;
        if(this.enemy.trait==='leech')heal+=Math.ceil(result.taken/2);
        heal=Math.min(heal,this.enemy.maxHp-this.enemy.hp);
        this.enemy.hp+=heal;result.enemyHeal=heal;
      }
      this.state.shield=Math.min(this.state.shield,6*(this.state.relics.retain||0));
      return result;
    }
    finishOutcome() {
      const s=this.state;
      if(s.hp<=0)this.outcome='defeat';
      else if(this.enemy.hp<=0)this.outcome=s.floor===TOTAL_FLOORS&&!s.endless?'victory':'upgrade';
      else this.outcome='battle';
    }
    failTurn(message) {
      this.phase='resolving';this.state.failedTurns++;
      this.enemy.hp=Math.max(0,this.enemy.hp-this.state.burn);
      const retaliation=this.enemy.hp>0&&this.state.hp>0?this.enemyTurn():{blocked:0,taken:0,reflected:0};
      this.result={damage:this.state.burn,heal:0,gainShield:0,independent:false,failed:true,message,...retaliation};
      this.finishOutcome();return this.result;
    }
    resolve() {
      if(this.phase!=='battle'||this.path.length!==3) return null;
      if(this.targets[2].mode==='spell'&&!this.spellingValidated) return null;
      this.phase='resolving';
      const s=this.state, r=s.relics;
      const tiles=this.path.map(i=>this.board[i]);
      const swords=tiles.filter(t=>t.kind==='sword').length;
      const shields=tiles.filter(t=>t.kind==='shield').length;
      const hearts=tiles.filter(t=>t.kind==='heart').length;
      const independent=this.targets[2].mode==='spell'&&!this.assisted[2];
      let gainShield=shields*(3+2*(r.ward||0));
      if(this.enemy.trait==='erosion'&&s.round%2===0)gainShield=Math.floor(gainShield/2);
      let heal=hearts*(3+(r.mend||0))+(this.assistanceUsed?0:2*(r.leech||0));
      let damage=9+swords*4+5*(r.edge||0)+6*(r.spark||0)+3*(r.growth||0);
      damage+=Math.floor(gainShield*.6*(r.bash||0))+(swords>=2?10*(r.double||0):0)+(independent?10*(r.focus||0):0);
      if((s.chains+1)%3===0) damage+=Math.floor(s.lastDamage*.6)*(r.echo||0);
      if(this.assistanceUsed)damage=Math.floor(damage*.7);
      s.burn=Math.min(60,s.burn+swords*2*(r.burn||0));
      const directDamage=Math.max(1,damage-this.enemy.armor);
      damage=directDamage+s.burn;
      this.enemy.hp=Math.max(0,this.enemy.hp-damage);
      heal=Math.min(heal,s.maxHp-s.hp);
      s.shield+=gainShield; s.hp+=heal; s.lastDamage=directDamage;s.chains++;
      s.suppression=swords===3?3*(r.double||0):0;
      this.targets.forEach((w,i)=>{
        const record=recordFor(this.profile,w.word);
        if(!record.exposures) s.newWords.add(w.word);
        record.exposures++;record.attempts++;record.lastSeen=this.now();this.recent[w.word]=s.turn;
        if(!this.assisted[i]&&w.mode==='spell') {record.spelled++;s.independentSpells++;record.due=this.now()+24*60*60*1000;}
        else if(!this.assisted[i]&&w.mode==='recognise') {record.recognised++;record.due=this.now()+4*60*60*1000;}
        else record.due=this.now()+2*60*1000;
        s.touches++;s.practised.add(w.word);
      });
      let retaliation=0;
      if(this.enemy.trait==='thorns'&&swords===3){retaliation=3+this.enemy.chapter;s.hp=Math.max(0,s.hp-retaliation);}
      const enemyResult=this.enemy.hp>0&&s.hp>0?this.enemyTurn():{blocked:0,taken:0,reflected:0};
      this.result={damage,heal,gainShield,retaliation,...enemyResult,independent,assisted:this.assistanceUsed,words:this.targets.map(w=>w.word)};
      this.finishOutcome();
      return this.result;
    }
    advance() {
      if(this.phase!=='resolving') return;
      if(this.outcome==='victory'||this.outcome==='defeat') this.phase=this.outcome;
      else if(this.outcome==='upgrade') {
        this.state.hp=Math.min(this.state.maxHp,this.state.hp+3+(this.state.relics.mend||0)+(this.enemy.boss?8:0));
        this.phase='upgrade';this.choices=this.offerRelics();
      } else {this.phase='battle';this.newTurn();}
    }
    offerRelics() {
      let eligible=RELICS.filter(r=>(!r.bossOnly||this.enemy.boss)&&(this.state.relics[r.id]||0)<(r.max||4));
      if(this.state.hp===this.state.maxHp){
        const useful=eligible.filter(r=>!['camp','spring'].includes(r.id));
        if(useful.length>=3)eligible=useful;
      }
      const shuffled=shuffle(eligible,this.rng),picked=[];
      for(const relic of shuffled) {
        if(!picked.length||!picked.some(p=>p.group===relic.group)) picked.push(relic);
        if(picked.length===3) {
          if(this.enemy.boss&&eligible.some(r=>r.id==='camp')&&!picked.some(r=>r.id==='camp'))picked[2]=RELICS.find(r=>r.id==='camp');
          return picked;
        }
      }
      return shuffled.slice(0,3);
    }
    choose(id) {
      if(this.phase!=='upgrade'||!this.choices.some(r=>r.id===id)) return false;
      this.state.relics[id]=(this.state.relics[id]||0)+1;
      if(id==='vitality'){this.state.maxHp+=8;this.state.hp=Math.min(this.state.maxHp,this.state.hp+8);}
      if(id==='camp')this.state.hp=Math.min(this.state.maxHp,this.state.hp+28);
      if(id==='spring')this.state.hp=Math.min(this.state.maxHp,this.state.hp+16);
      const floor=this.state.floor+1;
      this.prepareFloor(floor);
      return true;
    }
    prepareFloor(floor) {
      const count=floor===5?2:floor>1&&floor%8===1?4:0;
      const incoming=this.newQueue.splice(0,count);
      if(incoming.length){
        const retained=this.pool.sort((a,b)=>((this.profile[a.word]?.spelled||0)+(this.profile[a.word]?.recognised||0))-((this.profile[b.word]?.spelled||0)+(this.profile[b.word]?.recognised||0))).slice(0,14-incoming.length);
        this.pool=[...retained,...incoming];this.lesson=incoming;this.pendingFloor=floor;this.phase='lesson';
      }else this.enterFloor(floor);
    }
    continueEndless() {
      if(this.phase!=='victory')return false;
      this.state.endless=true;this.state.hp=Math.min(this.state.maxHp,this.state.hp+20);
      this.prepareFloor(TOTAL_FLOORS+1);return true;
    }
  }
  const api={Game,RELICS,ENEMIES,BOSSES,TOTAL_FLOORS,CHAPTERS,shuffle,freshRecord};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.WordChain=api;
})(typeof window==='undefined'?globalThis:window);
