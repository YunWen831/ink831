(function () {
  'use strict';
  const $=id=>document.getElementById(id),words=window.CHAIN_WORDS,api=window.WordChain;
  const KEY='codex-chain-learning-v1';
  let profile={},scope='all',difficulty='normal',game,advanceTimer=null,dragging=false,dragMoved=false,toastTimer=null,lastHover=-1;
  let bookWords=words,bookLimit=80;
  try { const saved=JSON.parse(localStorage.getItem(KEY)||'{}'); if(saved&&typeof saved==='object'&&!Array.isArray(saved)) profile=saved; } catch (_) {}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(profile));}catch(_){toast('当前浏览器无法保存进度，本局仍可继续。');}};
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mask=w=>w.length<5?w[0]+'·'.repeat(w.length-1):w[0]+'·'.repeat(w.length-2)+w.at(-1);
  const marks={sword:'✦',shield:'◇',heart:'♥'},kindNames={sword:'攻击',shield:'护盾',heart:'恢复'};
  function toast(message){$('toast').textContent=message;$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),3500);}
  function show(id){for(const el of document.querySelectorAll('.screen'))el.hidden=el.id!==id;window.scrollTo({top:0,behavior:'instant'});}
  function feedback(message,kind=''){$('feedback').textContent=message;$('feedback').className='feedback '+kind;}
  function home(){
    clearTimeout(advanceTimer);game=null;$('book-button').disabled=false;show('home');
    const practised=Object.values(profile).filter(r=>r.attempts>0).length;
    const recalled=Object.values(profile).reduce((sum,r)=>sum+(r.spelled||0),0);
    $('progress').textContent=practised?'已练习 '+practised+' 个词 · 独立拼写 '+recalled+' 次':'每局少量新词，反复遇见；没有倒计时。';
  }
  function start(){clearTimeout(advanceTimer);game=new api.Game(words,profile);game.start(scope,difficulty);render();}
  function render(){
    if(!game)return;
    $('book-button').disabled=game.phase==='battle'||game.phase==='resolving';
    if(game.phase==='lesson'){
      $('lesson-cards').innerHTML=game.lesson.map(w=>'<article class="lesson-card"><b>'+w.word+'</b><div class="meaning"><span>'+w.pos+'</span>'+escape(w.meaning)+'</div>'+(w.example?'<p>'+escape(w.example)+'</p>':w.senses?.length>1?'<p>'+escape(w.senses.slice(1,3).join('；'))+'</p>':'')+'<span class="level">CET-'+w.level+'</span></article>').join('');
      show('lesson');
    } else if(game.phase==='battle'){show('battle');renderBattle(true);}
    else if(game.phase==='upgrade'){
      $('upgrade-status').textContent='当前生命 '+game.state.hp+' / '+game.state.maxHp+' · 下一层 '+(game.state.floor+1);
      $('upgrade-cards').innerHTML=game.choices.map(r=>'<button class="upgrade-card" data-relic="'+r.id+'"><span class="relic-mark">'+r.mark+'</span><span><b>'+r.name+'<span class="relic-level">'+(['camp','spring'].includes(r.id)?'立即恢复':((game.state.relics[r.id]||0)+1)+'级')+'</span></b><small>'+r.desc+'</small></span></button>').join('');
      show('upgrade');
    } else if(game.phase==='victory'||game.phase==='defeat')renderEnd();
  }
  function renderStatus(){
    const s=game.state,e=game.enemy;
    const chapter=api.CHAPTERS[Math.floor((s.floor-1)/8)%3];
    $('floor-label').textContent=(s.endless?'无尽 '+(s.floor-api.TOTAL_FLOORS):chapter+' '+s.floor+' / '+api.TOTAL_FLOORS)+(e.elite?' · 精英':e.boss?' · 首领':'');
    $('hero-hp').textContent='生命 '+s.hp+' / '+s.maxHp+(s.shield?' · 护盾 '+s.shield:'');
    $('hero-bar').style.width=s.hp/s.maxHp*100+'%';
    $('enemy-name').textContent=e.name;$('enemy-hp').textContent=e.hp+' / '+e.maxHp;
    $('enemy-bar').style.width=e.hp/e.maxHp*100+'%';
    $('enemy-intent').textContent='下一步：'+game.getIntent().text;
    $('enemy-art').dataset.trait=e.trait;
    $('turn-status').textContent='熟词失误 '+s.turnMistakes+' / 2 · 提示后本次伤害七折';
    const current=game.targets[Math.min(game.path.length,2)],guided=current?.mode==='guided';
    $('hint-button').textContent=guided?'新词提示':'提示 '+s.roomHints+' / '+s.hintLimit;
    $('hint-button').disabled=game.phase!=='battle'||(!guided&&s.roomHints<=0);
    $('book-button').disabled=true;
    $('relic-strip').innerHTML=Object.entries(s.relics).filter(([id])=>!['camp','spring'].includes(id)).map(([id,level])=>{const r=api.RELICS.find(r=>r.id===id);return '<button class="relic-chip" data-description="'+escape(r.name+' '+level+'级：'+r.desc)+'">'+r.mark+' '+r.name+' '+level+'</button>';}).join('');
  }
  function renderBattle(fresh=false){
    renderStatus();renderPath();
    if(fresh){$('spell-form').hidden=true;$('spell-input').value='';feedback('横、竖、斜都能连；攻击格打得快，护盾格更稳。');}
  }
  function renderPath(){
    const current=Math.min(game.path.length,2);
    $('prompts').innerHTML=game.targets.map((w,i)=>'<div class="prompt '+(i<game.path.length?'done':i===current?'current':'')+'"><em>'+(i<game.path.length?'✓':i+1)+'</em><span>'+escape(w.meaning)+'</span>'+(w.clue?'<small class="word-clue">'+escape(w.pos+' '+w.clue)+'</small>':'')+'</div>').join('');
    $('board').innerHTML=game.board.map((tile,i)=>{
      const target=game.targets.find(w=>w.word===tile.word.word);
      const spell=target?.mode==='spell',guided=target?.mode==='guided',selected=game.path.indexOf(i);
      const name=spell?mask(tile.word.word):tile.word.word;
      const label=spell?'拼写词，'+tile.word.word.length+'个字母':tile.word.word;
      return '<button class="tile '+tile.kind+(selected>=0?' selected':'')+'" data-cell="'+i+'" aria-label="'+escape(label+'，'+kindNames[tile.kind])+'"'+(game.phase!=='battle'?' disabled':'')+'><span class="kind">'+marks[tile.kind]+'</span>'+(selected>=0?'<span class="order">'+(selected+1)+'</span>':'')+'<span class="word '+(name.length>10?'long':'')+'">'+name+'</span>'+(guided?'<span class="tile-meaning">'+escape(tile.word.meaning)+'</span>':'')+'</button>';
    }).join('');
    requestAnimationFrame(drawLine);
  }
  function drawLine(){
    if(!game||$('battle').hidden)return;
    const rect=$('board').getBoundingClientRect();
    const points=game.path.map(i=>{const t=$('board').querySelector('[data-cell="'+i+'"]').getBoundingClientRect();return (t.left-rect.left+t.width/2)+','+(t.top-rect.top+t.height/2);}).join(' ');
    $('path-svg').setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);$('path-line').setAttribute('points',points);
  }
  function chooseCell(index){
    if(!game||game.phase!=='battle')return;
    const result=game.select(index);
    if(result.type==='ignore')return;
    if(result.type==='failed'){showResult(result.result);return;}
    if(result.type==='wrong'||result.type==='far'){
      renderStatus();
      feedback(result.message,'bad');
      const tile=$('board').querySelector('[data-cell="'+index+'"]');tile?.classList.add('error');
      setTimeout(()=>tile?.classList.remove('error'),250);save();return;
    }
    renderPath();renderStatus();
    if(result.type==='spell'){
      const w=game.targets[2];$('spell-form').hidden=false;
      $('spell-label').textContent='最后一步：把“'+w.meaning+'”写完整。';
      $('spell-input').value='';$('spell-input').focus();
      feedback('拼错扣 '+game.state.penalty+' 血，两次错会中断连词。需要帮助可使用限次提示。');
    }else if(result.type==='ready')resolve();
    else feedback('已连 '+game.path.length+' / 3。下一词：'+game.targets[Math.min(game.path.length,2)].meaning);
  }
  function resolve(){
    const result=game.resolve();if(!result)return;
    showResult(result);
  }
  function showResult(result){
    $('spell-form').hidden=true;renderStatus();renderPath();
    let message=result.failed?result.message:'造成 '+result.damage+' 点伤害';
    if(result.gainShield)message+=' · 获得 '+result.gainShield+' 护盾';
    if(result.heal)message+=' · 恢复 '+result.heal+' 生命';
    if(result.blocked)message+=' · 挡住 '+result.blocked+' 伤害';
    if(result.reflected)message+=' · 反弹 '+result.reflected+' 伤害';
    if(result.taken)message+=' · 受到 '+result.taken+' 伤害';
    if(result.retaliation)message+=' · 反伤 '+result.retaliation;
    if(result.enemyHeal)message+=' · 敌人恢复 '+result.enemyHeal;
    if(result.assisted)message+=' · 提示伤害七折';
    if(result.independent)message+=' · 独立拼写 ✓';
    feedback(message,result.failed?'bad':'good');save();
    $('enemy-art').classList.remove('hit');void $('enemy-art').offsetWidth;
    $('damage-float').textContent='−'+result.damage;$('enemy-art').classList.add('hit');
    advanceTimer=setTimeout(()=>{if(game){game.advance();render();}},result.failed?1800:1100);
  }
  function renderEnd(){
    const s=game.state,win=game.phase==='victory';
    $('end-symbol').textContent=win?'✦':'↺';$('end-label').textContent=win?'地牢已通关':'本次探险结束';
    $('end-title').textContent=win?'词语，是你的力量。':'下次，带着记忆回来。';
    $('end-detail').textContent='抵达第 '+s.floor+' 层 · 失误 '+s.mistakes+' 次 · 连词中断 '+s.failedTurns+' 次';
    $('endless-button').hidden=!win;
    $('end-stats').innerHTML='<div class="stat"><b>'+s.practised.size+'</b><span>练习词数</span></div><div class="stat"><b>'+s.touches+'</b><span>连词练习</span></div><div class="stat"><b>'+s.independentSpells+'</b><span>独立拼写</span></div>';
    $('end-words').innerHTML=[...s.practised].map(word=>{const w=words.find(w=>w.word===word);return '<span>'+w.word+' · '+escape(w.meaning)+'</span>';}).join('');
    save();show('end');
  }
  function openBook(){
    const permission=game?.bookHint();
    if(permission?.blocked){toast(permission.message);return;}
    save();
    bookWords=game?[...game.pool,...words.filter(w=>!game.pool.some(p=>p.word===w.word))]:words;
    bookLimit=80;$('book-search').value='';renderBook();
    $('book').showModal();
  }
  function renderBook(){
    const query=$('book-search').value.trim().toLowerCase();
    const results=query?bookWords.filter(w=>w.word.toLowerCase().includes(query)||w.meaning.includes(query)||(w.aliases||[]).some(a=>a.toLowerCase().includes(query))||(w.senses||[]).some(s=>s.includes(query))):bookWords;
    $('book-count').textContent='找到 '+results.length+' 条 · 显示 '+Math.min(bookLimit,results.length)+' 条';
    $('book-list').innerHTML=results.slice(0,bookLimit).map(w=>{const r=profile[w.word]||{};return '<div class="book-row"><div><strong>'+w.word+'</strong><p>'+w.pos+' '+escape(w.meaning)+' · CET-'+w.level+'</p>'+(w.aliases?.length?'<p>也可拼作 '+escape(w.aliases.join(' / '))+'</p>':'')+(w.senses?.length>1?'<p>'+escape(w.senses.slice(1,4).join('；'))+'</p>':'')+'</div><div class="book-count">词义辨认 '+(r.recognised||0)+' 次<br>独立拼写 '+(r.spelled||0)+' 次</div></div>';}).join('');
    $('book-more').hidden=bookLimit>=results.length;
  }
  function scopeCount(){
    $('scope-count').textContent=(scope==='all'?'四六级':scope==='4'?'四级及派生词':'六级增补及派生词')+' · '+words.filter(w=>scope==='all'||w.level===Number(scope)).length+' 条';
  }
  $('word-count').textContent=words.length;
  document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>{scope=b.dataset.scope;document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===scope));scopeCount();}));
  $('book-search').addEventListener('input',()=>{bookLimit=80;renderBook();});
  $('book-more').addEventListener('click',()=>{bookLimit+=80;renderBook();});
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{
    difficulty=b.dataset.difficulty;
    document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===difficulty));
    $('run-rule').innerHTML=difficulty==='hard'?'挑战：敌人生命 +25%、攻击 +30%，熟词答错扣 4 血。<br>每场 1 次提示，两次错敌人行动；新词免费引导。':'熟词答错扣 3 血，同回合错两次，敌人直接行动。<br>每场战斗 2 次提示；初见新词免费引导。';
  }));
  $('start-button').addEventListener('click',start);
  $('lesson-button').addEventListener('click',()=>{game.finishLesson();save();render();});
  $('upgrade-cards').addEventListener('click',e=>{const b=e.target.closest('[data-relic]');if(b&&game.choose(b.dataset.relic)){save();render();}});
  $('spell-form').addEventListener('submit',e=>{e.preventDefault();const result=game.spell($('spell-input').value);if(result.type==='ready')resolve();else if(result.type==='failed')showResult(result.result);else if(result.message){renderStatus();feedback(result.message,'bad');save();}});
  $('hint-button').addEventListener('click',()=>{
    const w=game.hint();if(!w)return;
    if(w.blocked){feedback(w.message,'bad');return;}
    renderStatus();
    feedback(w.word+' · '+w.pos+' '+w.meaning+(w.free?'。初见新词，免费引导。':'。消耗一次提示，本次伤害七折。'),'good');
    save();
  });
  $('reset-path').addEventListener('click',()=>{if(game?.phase!=='battle')return;game.path=[];game.warpUsed=false;game.spellReady=false;game.spellingValidated=false;$('spell-form').hidden=true;renderPath();feedback('路线已清空，重新连就好。');});
  $('board').addEventListener('click',e=>{if(e.detail>0)return;const b=e.target.closest('[data-cell]');if(b)chooseCell(Number(b.dataset.cell));});
  $('board').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const b=e.target.closest('[data-cell]');if(!b)return;dragging=true;dragMoved=false;lastHover=Number(b.dataset.cell);chooseCell(lastHover);});
  document.addEventListener('pointermove',e=>{
    if(!dragging||!game||game.phase!=='battle')return;
    if(e.buttons===0&&e.pointerType==='mouse'){dragging=false;return;}
    const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-cell]');
    if(b&&Number(b.dataset.cell)!==lastHover){lastHover=Number(b.dataset.cell);if(!game.path.includes(lastHover)&&game.board[lastHover].word.word===game.targets[Math.min(game.path.length,2)].word){dragMoved=true;chooseCell(lastHover);}}
  });
  document.addEventListener('pointerup',()=>{dragging=false;setTimeout(()=>{dragMoved=false;},60);});
  $('relic-strip').addEventListener('click',e=>{const b=e.target.closest('[data-description]');if(b)toast(b.dataset.description);});
  $('book-button').addEventListener('click',openBook);$('book-close').addEventListener('click',()=>$('book').close());
  $('book').addEventListener('click',e=>{if(e.target===$('book')){const r=$('book').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('book').close();}});
  $('quit-button').addEventListener('click',()=>{if(confirm('返回首页？本局构筑结束，单词练习记录会保留。')){save();home();}});
  $('again-button').addEventListener('click',start);$('back-button').addEventListener('click',home);
  $('endless-button').addEventListener('click',()=>{if(game?.continueEndless()){save();render();}});
  $('home-link').addEventListener('click',e=>{if(location.pathname.includes('/_game_dev/')){e.preventDefault();home();}});
  window.addEventListener('resize',drawLine);
  $('start-button').disabled=false;scopeCount();home();
})();
