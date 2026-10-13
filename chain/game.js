(function () {
  'use strict';
  const $=id=>document.getElementById(id),words=window.CHAIN_WORDS,api=window.WordChain;
  const KEY='codex-chain-learning-v1';
  let profile={},scope='all',game,advanceTimer=null,dragging=false,dragMoved=false,toastTimer=null,lastHover=-1;
  try { const saved=JSON.parse(localStorage.getItem(KEY)||'{}'); if(saved&&typeof saved==='object'&&!Array.isArray(saved)) profile=saved; } catch (_) {}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(profile));}catch(_){toast('当前浏览器无法保存进度，本局仍可继续。');}};
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mask=w=>w.length<5?w[0]+'·'.repeat(w.length-1):w[0]+'·'.repeat(w.length-2)+w.at(-1);
  const marks={sword:'✦',shield:'◇',heart:'♥'},kindNames={sword:'攻击',shield:'护盾',heart:'恢复'};
  function toast(message){$('toast').textContent=message;$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),3500);}
  function show(id){for(const el of document.querySelectorAll('.screen'))el.hidden=el.id!==id;window.scrollTo({top:0,behavior:'instant'});}
  function feedback(message,kind=''){$('feedback').textContent=message;$('feedback').className='feedback '+kind;}
  function home(){
    clearTimeout(advanceTimer);game=null;show('home');
    const practised=Object.values(profile).filter(r=>r.attempts>0).length;
    const recalled=Object.values(profile).reduce((sum,r)=>sum+(r.spelled||0),0);
    $('progress').textContent=practised?'已练习 '+practised+' 个词 · 独立拼写 '+recalled+' 次':'每局少量新词，反复遇见；没有倒计时。';
  }
  function start(){clearTimeout(advanceTimer);game=new api.Game(words,profile);game.start(scope);render();}
  function render(){
    if(!game)return;
    if(game.phase==='lesson'){
      $('lesson-cards').innerHTML=game.lesson.map(w=>'<article class="lesson-card"><b>'+w.word+'</b><div class="meaning"><span>'+w.pos+'</span>'+escape(w.meaning)+'</div><p>'+escape(w.example)+'</p><span class="level">CET-'+w.level+'</span></article>').join('');
      show('lesson');
    } else if(game.phase==='battle'){show('battle');renderBattle(true);}
    else if(game.phase==='upgrade'){
      $('upgrade-cards').innerHTML=game.choices.map(r=>'<button class="upgrade-card" data-relic="'+r.id+'"><span class="relic-mark">'+r.mark+'</span><span><b>'+r.name+'<span class="relic-level">'+((game.state.relics[r.id]||0)+1)+'级</span></b><small>'+r.desc+'</small></span></button>').join('');
      show('upgrade');
    } else if(game.phase==='victory'||game.phase==='defeat')renderEnd();
  }
  function renderStatus(){
    const s=game.state,e=game.enemy;
    $('floor-label').textContent='地牢 '+s.floor+' / 8'+(s.floor===4?' · 精英':s.floor===8?' · 首领':'');
    $('hero-hp').textContent='生命 '+s.hp+' / '+s.maxHp+(s.shield?' · 护盾 '+s.shield:'');
    $('hero-bar').style.width=s.hp/s.maxHp*100+'%';
    $('enemy-name').textContent=e.name;$('enemy-hp').textContent=e.hp+' / '+e.maxHp;
    $('enemy-bar').style.width=e.hp/e.maxHp*100+'%';
    const attack=e.attack+(s.floor===8&&s.round%3===0?3:0);
    $('enemy-intent').textContent='下一步：攻击 '+attack+(e.armor?' · 护甲 '+e.armor:'')+(s.floor===8&&s.round%3===0?' · 恢复 9':'');
    $('relic-strip').innerHTML=Object.entries(s.relics).map(([id,level])=>{const r=api.RELICS.find(r=>r.id===id);return '<button class="relic-chip" data-description="'+escape(r.name+' '+level+'级：'+r.desc)+'">'+r.mark+' '+r.name+' '+level+'</button>';}).join('');
  }
  function renderBattle(fresh=false){
    renderStatus();renderPath();
    if(fresh){$('spell-form').hidden=true;$('spell-input').value='';feedback('横、竖、斜都能连；攻击格打得快，护盾格更稳。');}
  }
  function renderPath(){
    const current=Math.min(game.path.length,2);
    $('prompts').innerHTML=game.targets.map((w,i)=>'<div class="prompt '+(i<game.path.length?'done':i===current?'current':'')+'"><em>'+(i<game.path.length?'✓':i+1)+'</em><span>'+escape(w.meaning)+'</span></div>').join('');
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
    if(result.type==='wrong'||result.type==='far'){
      feedback(result.message,'bad');
      const tile=$('board').querySelector('[data-cell="'+index+'"]');tile?.classList.add('error');
      setTimeout(()=>tile?.classList.remove('error'),250);save();return;
    }
    renderPath();
    if(result.type==='spell'){
      const w=game.targets[2];$('spell-form').hidden=false;
      $('spell-label').textContent='最后一步：把“'+w.meaning+'”写完整。';
      $('spell-input').value='';$('spell-input').focus({preventScroll:true});
      feedback('熟词升级为拼写回忆。忘了可以看提示，不扣生命。');
    }else if(result.type==='ready')resolve();
    else feedback('已连 '+game.path.length+' / 3。下一词：'+game.targets[Math.min(game.path.length,2)].meaning);
  }
  function resolve(){
    const result=game.resolve();if(!result)return;
    $('spell-form').hidden=true;renderStatus();renderPath();
    let message='造成 '+result.damage+' 点伤害';
    if(result.gainShield)message+=' · 获得 '+result.gainShield+' 护盾';
    if(result.heal)message+=' · 恢复 '+result.heal+' 生命';
    if(result.blocked)message+=' · 挡住 '+result.blocked+' 伤害';
    if(result.reflected)message+=' · 反弹 '+result.reflected+' 伤害';
    if(result.taken)message+=' · 受到 '+result.taken+' 伤害';
    if(result.independent)message+=' · 独立拼写 ✓';
    feedback(message,'good');save();
    $('enemy-art').classList.remove('hit');void $('enemy-art').offsetWidth;
    $('damage-float').textContent='−'+result.damage;$('enemy-art').classList.add('hit');
    advanceTimer=setTimeout(()=>{game.advance();render();},1100);
  }
  function renderEnd(){
    const s=game.state,win=game.phase==='victory';
    $('end-symbol').textContent=win?'✦':'↺';$('end-label').textContent=win?'地牢已通关':'本次探险结束';
    $('end-title').textContent=win?'词语，是你的力量。':'下次，带着记忆回来。';
    $('end-stats').innerHTML='<div class="stat"><b>'+s.practised.size+'</b><span>练习词数</span></div><div class="stat"><b>'+s.touches+'</b><span>连词练习</span></div><div class="stat"><b>'+s.independentSpells+'</b><span>独立拼写</span></div>';
    $('end-words').innerHTML=[...s.practised].map(word=>{const w=words.find(w=>w.word===word);return '<span>'+w.word+' · '+escape(w.meaning)+'</span>';}).join('');
    save();show('end');
  }
  function openBook(){
    game?.bookHint();save();
    const list=game?[...game.pool,...words.filter(w=>!game.pool.some(p=>p.word===w.word))]:words;
    $('book-list').innerHTML=list.map(w=>{const r=profile[w.word]||{};return '<div class="book-row"><div><strong>'+w.word+'</strong><p>'+w.pos+' '+escape(w.meaning)+' · CET-'+w.level+'</p></div><div class="book-count">词义辨认 '+(r.recognised||0)+' 次<br>独立拼写 '+(r.spelled||0)+' 次</div></div>';}).join('');
    $('book').showModal();
  }
  $('word-count').textContent=words.length;
  document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>{scope=b.dataset.scope;document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===scope));}));
  $('start-button').addEventListener('click',start);
  $('lesson-button').addEventListener('click',()=>{game.finishLesson();save();render();});
  $('upgrade-cards').addEventListener('click',e=>{const b=e.target.closest('[data-relic]');if(b&&game.choose(b.dataset.relic)){save();render();}});
  $('spell-form').addEventListener('submit',e=>{e.preventDefault();const result=game.spell($('spell-input').value);if(result.type==='ready')resolve();else if(result.message){feedback(result.message,'bad');save();}});
  $('hint-button').addEventListener('click',()=>{
    const w=game.hint();if(!w)return;
    feedback(w.word+' · '+w.pos+' '+w.meaning+'。查看提示后也能正常发动。','good');
    save();
  });
  $('reset-path').addEventListener('click',()=>{if(game?.phase!=='battle')return;game.path=[];game.warpUsed=false;game.spellReady=false;game.spellingValidated=false;$('spell-form').hidden=true;renderPath();feedback('路线已清空，重新连就好。');});
  $('board').addEventListener('click',e=>{if(e.detail>0)return;const b=e.target.closest('[data-cell]');if(b)chooseCell(Number(b.dataset.cell));});
  $('board').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const b=e.target.closest('[data-cell]');if(!b)return;dragging=true;dragMoved=false;lastHover=Number(b.dataset.cell);chooseCell(lastHover);});
  document.addEventListener('pointermove',e=>{
    if(!dragging||!game||game.phase!=='battle')return;
    if(e.buttons===0&&e.pointerType==='mouse'){dragging=false;return;}
    const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-cell]');
    if(b&&Number(b.dataset.cell)!==lastHover){lastHover=Number(b.dataset.cell);if(!game.path.includes(lastHover)){dragMoved=true;chooseCell(lastHover);}}
  });
  document.addEventListener('pointerup',()=>{dragging=false;setTimeout(()=>{dragMoved=false;},60);});
  $('relic-strip').addEventListener('click',e=>{const b=e.target.closest('[data-description]');if(b)toast(b.dataset.description);});
  $('book-button').addEventListener('click',openBook);$('book-close').addEventListener('click',()=>$('book').close());
  $('book').addEventListener('click',e=>{if(e.target===$('book')){const r=$('book').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('book').close();}});
  $('quit-button').addEventListener('click',()=>{if(confirm('返回首页？本局构筑结束，单词练习记录会保留。')){save();home();}});
  $('again-button').addEventListener('click',start);$('back-button').addEventListener('click',home);
  $('home-link').addEventListener('click',e=>{if(location.pathname.includes('/_game_dev/')){e.preventDefault();home();}});
  window.addEventListener('resize',drawLine);
  home();
})();
