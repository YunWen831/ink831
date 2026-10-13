(function (root) {
  'use strict';
  const shuffle = (items, rng=Math.random) => {
    const result = [...items];
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  };
  const freshRecord = () => ({exposures:0,attempts:0,recognised:0,spelled:0,hints:0,errors:0,lastSeen:0,due:0});
  const recordFor = (profile, word) => profile[word] || (profile[word]=freshRecord());
  const RELICS = [
    {id:'edge',name:'磨刀石',mark:'✦',group:'attack',desc:'每次连词额外造成 5 点伤害。'},
    {id:'spark',name:'连锁闪电',mark:'ϟ',group:'attack',desc:'每次连词追加 6 点闪电伤害。'},
    {id:'ward',name:'厚壳',mark:'◇',group:'shield',desc:'每个护盾格额外提供 4 点护盾。'},
    {id:'thorn',name:'荆棘',mark:'✳',group:'shield',desc:'每挡住 1 点伤害，反弹 1 点伤害。'},
    {id:'bash',name:'盾击',mark:'◈',group:'shield',desc:'本次获得的护盾，同时造成等量伤害。'},
    {id:'mend',name:'嫩芽',mark:'✿',group:'heal',desc:'每个恢复格多恢复 2 点生命；过关多恢复 2 点。'},
    {id:'leech',name:'暖流',mark:'♥',group:'heal',desc:'每次连词恢复 3 点生命。'},
    {id:'retain',name:'余温',mark:'▱',group:'shield',desc:'敌人行动后，最多保留 6 点剩余护盾。'},
    {id:'double',name:'剑舞',mark:'⚔',group:'attack',desc:'连到至少 2 个攻击格，额外造成 10 点伤害。'},
    {id:'burn',name:'余烬',mark:'♨',group:'attack',desc:'每个攻击格叠加 2 点灼烧，每回合持续造成伤害。'},
    {id:'warp',name:'穿隙',mark:'↗',group:'rule',desc:'一次连词中，可以跨过一格连接一次。',max:1},
    {id:'echo',name:'回声',mark:'↺',group:'rule',desc:'每第三次连词，追加上次伤害的 60%。'},
    {id:'focus',name:'记忆结晶',mark:'▰',group:'memory',desc:'独立拼写成功的连词，额外造成 10 点伤害。'}
  ];
  const ENEMIES = [
    ['墨团',26,6,'攻击',0],['纸牙',34,7,'攻击',0],['雾灯',39,8,'攻击',0],
    ['藏书守卫',54,10,'护甲 4',4],['墨团兄弟',46,9,'攻击',0],['遗忘之眼',56,10,'攻击',0],
    ['裂页兽',65,11,'攻击',0],['遗忘之王',96,13,'每三回合恢复 9',0]
  ];
  class Game {
    constructor(words, profile={}, rng=Math.random, now=()=>Date.now()) {
      this.words=words; this.profile=profile; this.rng=rng; this.now=now;
      this.phase='home'; this.scope='all'; this.state=null;
    }
    start(scope='all') {
      this.scope=scope; this.recent={};
      this.available=this.words.filter(w=>scope==='all'||w.level===Number(scope));
      if (this.available.length<3) throw new Error('词库至少需要三个词');
      const unknown=shuffle(this.available.filter(w=>!this.profile[w.word]?.exposures),this.rng);
      const old=shuffle(this.available.filter(w=>this.profile[w.word]?.exposures),this.rng)
        .sort((a,b)=>(this.profile[a.word].due||0)-(this.profile[b.word].due||0));
      const initialNew=unknown.slice(0,4);
      this.pool=[...old.slice(0,6),...initialNew];
      if (this.pool.length<3) this.pool=this.available.slice(0,3);
      this.nextNew=unknown.slice(initialNew.length,initialNew.length+2);
      this.state={hp:60,maxHp:60,shield:0,floor:1,round:0,turn:0,relics:{},burn:0,lastDamage:0,
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
      this.state.floor=floor; this.state.round=0; this.state.burn=0;
      const [name,hp,attack,trait,armor]=ENEMIES[floor-1];
      this.enemy={name,hp,maxHp:hp,attack,trait,armor};
      this.phase='battle'; this.newTurn();
    }
    modeFor(w,index) {
      const record=recordFor(this.profile,w.word);
      if (record.attempts===0) return 'guided';
      if (index===2 && record.recognised>=2) return 'spell';
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
        return {type:'wrong',message:`${tile.word.word} 是“${tile.word.meaning}”；现在要找“${target.meaning}”。`};
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
      this.assisted[index]=true;
      recordFor(this.profile,this.targets[index].word).hints++;
      this.state.hints++;
      return this.targets[index];
    }
    bookHint() {
      if(this.phase==='battle') {
        this.assisted=this.assisted.map(()=>true);
        this.state.hints++;
        this.targets.forEach(w=>recordFor(this.profile,w.word).hints++);
      }
    }
    spell(value) {
      if(!this.spellReady||this.phase!=='battle') return {type:'ignore'};
      const target=this.targets[2];
      if(value.trim().toLowerCase()!==target.word) {
        this.assisted[2]=true;this.state.mistakes++;
        const r=recordFor(this.profile,target.word);r.errors++;r.due=this.now()+60*1000;
        return {type:'wrong',message:`正确拼写是 ${target.word}。看一下，再输入一次即可继续。`};
      }
      this.spellingValidated=true;
      return {type:'ready',independent:!this.assisted[2]};
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
      const gainShield=shields*(5+4*(r.ward||0));
      let heal=hearts*(3+2*(r.mend||0))+3*(r.leech||0);
      let damage=9+swords*4+5*(r.edge||0)+6*(r.spark||0);
      damage+=gainShield*(r.bash||0)+(swords>=2?10*(r.double||0):0)+(independent?10*(r.focus||0):0);
      if((s.chains+1)%3===0) damage+=Math.floor(s.lastDamage*.6)*(r.echo||0);
      s.burn+=swords*2*(r.burn||0);
      const directDamage=Math.max(1,damage-this.enemy.armor);
      damage=directDamage+s.burn;
      this.enemy.hp=Math.max(0,this.enemy.hp-damage);
      s.shield+=gainShield; s.hp=Math.min(s.maxHp,s.hp+heal); s.lastDamage=directDamage;s.chains++;
      this.targets.forEach((w,i)=>{
        const record=recordFor(this.profile,w.word);
        if(!record.exposures) s.newWords.add(w.word);
        record.exposures++;record.attempts++;record.lastSeen=this.now();this.recent[w.word]=s.turn;
        if(!this.assisted[i]&&w.mode==='spell') {record.spelled++;s.independentSpells++;record.due=this.now()+24*60*60*1000;}
        else if(!this.assisted[i]&&w.mode==='recognise') {record.recognised++;record.due=this.now()+4*60*60*1000;}
        else record.due=this.now()+2*60*1000;
        s.touches++;s.practised.add(w.word);
      });
      let blocked=0,taken=0,reflected=0;
      if(this.enemy.hp>0) {
        const attack=this.enemy.attack+(s.floor===8&&s.round%3===0?3:0);
        blocked=Math.min(attack,s.shield);taken=attack-blocked;
        s.shield=Math.max(0,s.shield-attack);s.hp=Math.max(0,s.hp-taken);
        reflected=blocked*(r.thorn||0);this.enemy.hp=Math.max(0,this.enemy.hp-reflected);
        if(s.floor===8&&s.round%3===0&&this.enemy.hp>0) this.enemy.hp=Math.min(this.enemy.maxHp,this.enemy.hp+9);
      }
      s.shield=Math.min(s.shield,6*(r.retain||0));
      this.result={damage,heal,gainShield,blocked,taken,reflected,independent,words:this.targets.map(w=>w.word)};
      if(s.hp<=0) this.outcome='defeat';
      else if(this.enemy.hp<=0) this.outcome=s.floor===8?'victory':'upgrade';
      else this.outcome='battle';
      return this.result;
    }
    advance() {
      if(this.phase!=='resolving') return;
      if(this.outcome==='victory'||this.outcome==='defeat') this.phase=this.outcome;
      else if(this.outcome==='upgrade') {
        this.state.hp=Math.min(this.state.maxHp,this.state.hp+8+2*(this.state.relics.mend||0));
        this.phase='upgrade';this.choices=this.offerRelics();
      } else {this.phase='battle';this.newTurn();}
    }
    offerRelics() {
      const eligible=RELICS.filter(r=>(this.state.relics[r.id]||0)<(r.max||4));
      const shuffled=shuffle(eligible,this.rng),picked=[];
      for(const relic of shuffled) {
        if(!picked.length||!picked.some(p=>p.group===relic.group)) picked.push(relic);
        if(picked.length===3) return picked;
      }
      return shuffled.slice(0,3);
    }
    choose(id) {
      if(this.phase!=='upgrade'||!this.choices.some(r=>r.id===id)) return false;
      this.state.relics[id]=(this.state.relics[id]||0)+1;
      const floor=this.state.floor+1;
      if(floor===5&&this.nextNew.length) {
        this.pool.push(...this.nextNew);this.lesson=this.nextNew;this.pendingFloor=floor;this.phase='lesson';
      } else this.enterFloor(floor);
      return true;
    }
  }
  const api={Game,RELICS,ENEMIES,shuffle,freshRecord};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.WordChain=api;
})(typeof window==='undefined'?globalThis:window);
