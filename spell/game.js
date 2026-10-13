'use strict';
/* =============================================================
   言灵 —— 用真正的四六级单词战斗的肉鸽
   词库：ECDICT（MIT），5,788 词，CET-4 + CET-6
   ============================================================= */
(function () {

  var D = window.DS_WORDS;
  if (!D || !D.words) {
    document.body.innerHTML = '<p style="padding:40px;text-align:center">词库没加载上，刷新试试。</p>';
    return;
  }

  var WORDS = D.words, ROOTS = D.meta.roots || {};
  var BY = {};
  for (var i = 0; i < WORDS.length; i++) BY[WORDS[i].w] = WORDS[i];

  /* ---------- 难度分层：按词频切块 ---------- */
  var TIERS = [
    { name: '浅滩',   hp: 60,  time: 30, label: 'CET-4 高频' },
    { name: '中层',   hp: 85,  time: 26, label: 'CET-4 低频' },
    { name: '深水',   hp: 110, time: 22, label: 'CET-6 高频' },
    { name: '深渊',   hp: 140, time: 18, label: 'CET-6 低频' }
  ];

  var TIER_WORDS = (function () {
    function byFreq(a, b) { return (a.f || 1e9) - (b.f || 1e9); }
    var c4 = WORDS.filter(function (w) { return w.lv === 4; }).sort(byFreq);
    var c6 = WORDS.filter(function (w) { return w.lv === 6; }).sort(byFreq);
    return [
      c4.slice(0, 800),
      c4.slice(800),
      c6.slice(0, 950),
      c6.slice(950)
    ];
  })();

  /* ---------- 常量 ---------- */
  var FLOORS = 4, ROOMS_PER_FLOOR = 5;
  var PLAYER_HP = 100;
  var SAVE_KEY = 'yanling:save';

  /* ---------- 存档 ---------- */
  var Prog = { prof: {}, seen: {}, stats: { runs: 0, answered: 0, correct: 0 } };
  var R = null;

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.prog) {
        Prog = o.prog;
        // 兼容旧存档
        if (!Prog.stats) Prog.stats = { runs: 0, answered: 0, correct: 0 };
        if (Prog.stats.answered === undefined) Prog.stats.answered = 0;
        if (Prog.stats.correct === undefined) Prog.stats.correct = 0;
      }
      if (o && o.run && o.run.stats) R = o.run;
    } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, prog: Prog, run: R })); } catch (e) {}
  }
  function profOf(w) { return Prog.prof[typeof w === 'string' ? w : w.w] || 0; }
  function knownCount() { var n = 0; for (var k in Prog.prof) if (Prog.prof[k] >= 1) n++; return n; }

  /* ---------- 界面工具 ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function show(id) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i].id === id);
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function btn(title, desc, fn, disabled) {
    var b = el('button', 'btn');
    b.appendChild(el('span', 't', title));
    if (desc) b.appendChild(el('span', 'd', desc));
    b.disabled = !!disabled;
    if (!disabled) b.addEventListener('click', fn);
    return b;
  }
  function senses(w) {
    var s = w.s || [];
    return s.slice(0, 2).join('；');
  }

  /* ---------- 发音 ---------- */
  var VOICE = null, USE_VOICE = true;
  try { USE_VOICE = localStorage.getItem('yanling:voice') !== '0'; } catch (e) {}
  function pickVoice() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices() || [];
    for (var i = 0; i < vs.length; i++) {
      if (/^en([-_]|$)/i.test(vs[i].lang)) { VOICE = vs[i]; return; }
    }
  }
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function say(text) {
    if (!USE_VOICE || !window.speechSynthesis || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.85;
      if (VOICE) u.voice = VOICE;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- 音效 ---------- */
  var AC = null, SND = true;
  try { SND = localStorage.getItem('yanling:snd') !== '0'; } catch (e) {}
  function ac() {
    if (!SND) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SND = false; return null; } }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function tone(freq, dur, type, vol) {
    var c = ac(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.10, c.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.03);
    } catch (e) {}
  }
  function seq(list, gap) {
    list.forEach(function (n, i) {
      setTimeout(function () { tone(n[0], n[1], n[2], n[3]); }, i * (gap || 85));
    });
  }
  function sfxOk() { seq([[660, .08, 'triangle', .09], [990, .13, 'triangle', .08]], 75); }
  function sfxBad() { seq([[200, .10, 'sawtooth', .06], [150, .18, 'sawtooth', .05]], 65); }
  function sfxWin() { seq([[523, .09], [659, .09], [784, .18]], 90); }
  function sfxLose() { seq([[330, .13], [262, .13], [196, .26]], 115); }
  function sfxPick() { seq([[784, .06], [1046, .11]], 65); }

  /* ---------- 编辑距离 ---------- */
  function dist(a, b) {
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    if (Math.abs(m - n) > 2) return 9;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++)
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur.slice();
    }
    return prev[n];
  }

  /* ---------- 提示 ---------- */
  function hintOf(word, tier) {
    var out = [];
    var showFirst = tier <= 1;
    for (var i = 0; i < word.length; i++) {
      out.push(showFirst && i === 0 ? word[0] : '_');
    }
    return out.join(' ') + '   (' + word.length + ')';
  }

  /* ---------- 选词 ---------- */
  var usedWords = {};
  function pickWord(tier, kind) {
    var pool = TIER_WORDS[tier] || WORDS;
    if (!pool.length) pool = WORDS;
    var tries = 0, w;
    do {
      w = pool[(Math.random() * pool.length) | 0];
      tries++;
      if (kind === 'confuse' && !(w.cf && w.cf.length)) w = null;
      if (kind === 'rare' && !(w.x && w.x.length)) w = null;
    } while ((!w || usedWords[w.w]) && tries < 200);
    if (!w) w = pool[(Math.random() * pool.length) | 0];
    // 复习优先：见过但没掌握的词
    if (kind === 'normal' && Prog.seen[w.w] && profOf(w.w) < 3 && Math.random() < 0.4) return w;
    usedWords[w.w] = 1;
    return w;
  }

  /* ---------- 伤害计算 ---------- */
  function damageOf(w) {
    var p = profOf(w.w);
    // 越不熟的词伤害越高
    return Math.round(8 * (1 + (5 - p) * 0.4));
  }

  /* =========================================================
     标题页
     ========================================================= */
  function renderTitle() {
    var btns = $('titleBtns'); btns.innerHTML = '';
    btns.appendChild(btn('开始新的冒险', '4 层地牢，约 10 分钟', function () { newRun(); }));
    if (R && !R.over) {
      btns.appendChild(btn('继续冒险', '上次停在第 ' + (R.floor + 1) + ' 层', function () {
        renderDungeon(); show('dungeon');
      }));
    }
    btns.appendChild(btn('设置', '', function () { renderSettings(); show('settings'); }));

    var ans = Prog.stats.answered || 0;
    var cor = Prog.stats.correct || 0;
    $('titleProgress').textContent = '已掌握 ' + knownCount() + ' / ' + WORDS.length + ' 词 · ' +
      '累计答题 ' + ans + ' 次，答对率 ' +
      (ans ? Math.round(cor / ans * 100) : 0) + '%';
  }

  /* =========================================================
     新局
     ========================================================= */
  function newRun() {
    R = {
      floor: 0, room: 0, hp: PLAYER_HP, maxHp: PLAYER_HP,
      gold: 0, ghosts: [], missed: [],
      stats: { fought: 0, answered: 0, correct: 0, peeked: 0 }
    };
    usedWords = {};
    Prog.stats.runs++;
    save();
    nextRoom();
  }

  /* =========================================================
     地牢探索
     ========================================================= */
  function nextRoom() {
    R.room++;
    if (R.room > ROOMS_PER_FLOOR) {
      R.floor++;
      R.room = 1;
      if (R.floor >= FLOORS) return endRun(true);
    }

    var types = ['monster', 'stele', 'event', 'rest', 'shop'];
    var weights = [0.4, 0.25, 0.15, 0.1, 0.1];
    if (R.room === ROOMS_PER_FLOOR) types = ['monster', 'boss'];

    var roll = Math.random(), cum = 0, type = 'monster';
    for (var i = 0; i < types.length; i++) {
      cum += weights[i] || 0;
      if (roll < cum) { type = types[i]; break; }
    }

    renderRoom(type);
    show('dungeon');
  }

  function renderRoom(type) {
    var tier = Math.min(R.floor, TIERS.length - 1);
    $('floorName').textContent = '第 ' + (R.floor + 1) + ' 层 · ' + TIERS[tier].name;
    $('floorInfo').textContent = TIERS[tier].label;
    $('hpText').textContent = R.hp + '/' + R.maxHp;
    $('hpBar').firstElementChild.style.width = (R.hp / R.maxHp * 100) + '%';
    $('hpBar').classList.toggle('low', R.hp / R.maxHp < 0.3);
    $('goldCount').textContent = '✧ ' + R.gold;

    var desc = $('roomDesc');
    desc.innerHTML = '';
    var choices = $('roomChoices');
    choices.innerHTML = '';

    if (type === 'monster' || type === 'boss') {
      var isBoss = type === 'boss';
      desc.innerHTML = '<div class="icon">' + (isBoss ? '👹' : '👾') + '</div>' +
        '<div class="text">' + (isBoss ? '<b>Boss 房间</b><br>这一层的守关者。' : '前方出现了 <b>单词怪</b>！<br>拼对它才能通过。') + '</div>';
      choices.appendChild(btn(isBoss ? '挑战 Boss' : '迎战',
        '给中文拼英文 · ' + TIERS[tier].label,
        function () { startBattle(tier, isBoss); }));
    } else if (type === 'stele') {
      desc.innerHTML = '<div class="icon">🪨</div><div class="text">你发现了一块 <b>石碑</b>。<br>上面刻着一个四六级高频词。</div>';
      choices.appendChild(btn('研读石碑', '学习新词', function () { startStele(tier); }));
    } else if (type === 'event') {
      desc.innerHTML = '<div class="icon">🎲</div><div class="text">路上遇到了 <b>奇怪的事情</b>。</div>';
      choices.appendChild(btn('看看怎么回事', '', function () { startEvent(); }));
    } else if (type === 'rest') {
      desc.innerHTML = '<div class="icon">🔥</div><div class="text">一堆温暖的 <b>篝火</b>。<br>可以休息一下。</div>';
      choices.appendChild(btn('休息', '恢复生命', function () { startRest(); }));
    } else if (type === 'shop') {
      desc.innerHTML = '<div class="icon">🏪</div><div class="text">一个 <b>流浪商人</b> 在叫卖。</div>';
      choices.appendChild(btn('逛逛', '看看有什么', function () { startShop(); }));
    }

    desc.classList.add('anim-in');
  }

  /* =========================================================
     战斗
     ========================================================= */
  var B = null;

  function startBattle(tier, boss) {
    var w = pickWord(tier, 'normal');
    var t = TIERS[tier];
    var maxHp = Math.round(t.hp * (boss ? 1.5 : 1));

    B = {
      tier: tier, boss: boss, w: w,
      hp: maxHp, maxHp: maxHp,
      limit: boss ? t.time - 4 : t.time,
      left: boss ? t.time - 4 : t.time,
      got: 0, total: 0, done: false, timer: null,
      wordT0: Date.now()
    };
    R.stats.fought++;
    renderBattle();
    show('battle');
    $('spellInput').focus();
    startTimer();
  }

  function renderBattle() {
    var w = B.w;
    $('enemyName').textContent = B.boss ? 'Boss' : '单词怪';
    $('enemyTag').textContent = TIERS[B.tier].label;
    $('enemyHpText').textContent = B.hp + '/' + B.maxHp;
    $('enemyBar').firstElementChild.style.width = (B.hp / B.maxHp * 100) + '%';
    $('enemyBar').classList.toggle('low', B.hp / B.maxHp < 0.3);
    $('enemyEmoji').textContent = B.boss ? '👹' : '👾';
    $('enemyHpDisplay').textContent = 'HP ' + B.hp + '/' + B.maxHp;
    $('battleHp').textContent = R.hp + '/' + R.maxHp;

    $('promptCn').textContent = senses(w);
    $('promptPos').textContent = w.pos || '';
    $('promptHint').textContent = hintOf(w.w, B.tier);
    $('spellInput').value = '';
    $('spellInput').className = '';
    $('flashMsg').textContent = '';
    $('flashMsg').className = 'flash-msg';
    $('castBtn').disabled = false;
    $('fleeBtn').disabled = false;
    B.wordT0 = Date.now();
  }

  function startTimer() {
    clearInterval(B.timer);
    B.timer = setInterval(function () {
      if (B.done) return;
      B.left -= 0.1;
      if (B.left <= 0) {
        clearInterval(B.timer);
        settle('timeout', '');
      }
    }, 100);
  }

  function castSpell() {
    if (!B || B.done) return;
    var v = $('spellInput').value.trim().toLowerCase();
    if (!v) return;
    settle('submit', v);
  }

  function settle(reason, input) {
    if (B.done) return;
    B.done = true;
    clearInterval(B.timer);

    var w = B.w, want = w.w;
    var typed = (input || '').toLowerCase();
    var verdict;

    if (reason === 'timeout') verdict = 'timeout';
    else if (typed === want) verdict = 'exact';
    else if (typed.length > 2 && dist(typed, want) <= 1) verdict = 'near';
    else verdict = 'wrong';

    var twin = (w.cf || []).indexOf(typed) >= 0 && verdict === 'wrong';
    B.total++;
    Prog.stats.answered++;
    R.stats.answered++;
    Prog.seen[w.w] = 1;

    var f = $('flashMsg');
    var dmg = 0;

    if (verdict === 'exact') {
      B.got++;
      R.stats.correct++;
      Prog.stats.correct++;
      dmg = damageOf(w);
      B.hp -= dmg;
      Prog.prof[w.w] = Math.min(4, profOf(w) + 1);
      f.textContent = '正确！' + want + ' · 造成 ' + dmg + ' 伤害';
      f.className = 'flash-msg ok';
      $('spellInput').className = 'ok';
      say(want); sfxOk();
    } else if (verdict === 'near') {
      dmg = Math.round(damageOf(w) * 0.4);
      B.hp -= dmg;
      Prog.stats.correct++;
      f.textContent = '差一点：' + typed + ' → ' + want + ' · 擦边 ' + dmg + ' 伤害';
      f.className = 'flash-msg info';
      $('spellInput').className = 'ok';
      addGhost(w.w);
      say(want); sfxOk();
    } else {
      var hit = verdict === 'timeout' ? 12 : (twin ? 15 : 10);
      R.hp -= hit;
      Prog.prof[w.w] = Math.max(0, profOf(w) - 1);
      f.textContent = (twin ? '被形近词骗了！' : (verdict === 'timeout' ? '超时了。' : '答错了。')) +
        ' 正确：' + want + ' · -' + hit + ' HP';
      f.className = 'flash-msg no';
      $('spellInput').className = 'no';
      addGhost(w.w);
      say(want); sfxBad();
    }

    $('castBtn').disabled = true;
    $('fleeBtn').disabled = true;
    save();

    setTimeout(function () {
      if (R.hp <= 0) return endRun(false);
      if (B.hp <= 0) return winFight();
      // 继续战斗，换下一个词
      B.done = false;
      B.w = pickWord(B.tier, 'normal');
      B.left = B.limit;
      renderBattle();
      startTimer();
      $('spellInput').focus();
    }, 1200);
  }

  function addGhost(word) {
    if (R.ghosts.indexOf(word) < 0 && R.ghosts.length < 10) R.ghosts.push(word);
    if (R.missed.indexOf(word) < 0) R.missed.push(word);
  }

  function winFight() {
    sfxWin();
    var gold = 5 + R.floor * 3 + (B.boss ? 15 : 0);
    R.gold += gold;

    $('flashMsg').textContent = '胜利！+' + gold + ' ✧';
    $('flashMsg').className = 'flash-msg ok';

    setTimeout(function () {
      B = null;
      nextRoom();
    }, 1200);
  }

  function fleeBattle() {
    if (Math.random() < 0.5) {
      R.hp -= 8;
      $('flashMsg').textContent = '逃跑成功！-8 HP';
      $('flashMsg').className = 'flash-msg info';
      setTimeout(function () { B = null; nextRoom(); }, 800);
    } else {
      $('flashMsg').textContent = '逃跑失败！';
      $('flashMsg').className = 'flash-msg no';
      $('fleeBtn').disabled = true;
      setTimeout(function () {
        $('fleeBtn').disabled = false;
        R.hp -= 10;
        if (R.hp <= 0) return endRun(false);
        B.done = false;
        renderBattle();
        startTimer();
      }, 800);
    }
  }

  /* =========================================================
     石碑（学新词）
     ========================================================= */
  var steleWord = null;

  function startStele(tier) {
    steleWord = pickWord(tier, 'normal');
    $('steleCn').textContent = senses(steleWord);
    $('stelePos').textContent = steleWord.pos || '';
    $('steleHint').textContent = hintOf(steleWord.w, tier);
    $('steleInput').value = '';
    $('steleInput').className = '';
    $('steleFlash').textContent = '';
    $('steleFlash').className = 'flash-msg';
    show('stele');
    $('steleInput').focus();
  }

  function inscribeWord() {
    if (!steleWord) return;
    var input = $('steleInput').value.trim().toLowerCase();
    var want = steleWord.w;

    if (input === want || (input.length > 2 && dist(input, want) <= 1)) {
      $('steleInput').className = 'ok';
      $('steleFlash').textContent = '铭刻成功！' + want + ' · ' + senses(steleWord);
      $('steleFlash').className = 'flash-msg ok';
      sfxPick();
      say(want);

      Prog.prof[want] = Math.min(4, profOf(want) + 1);
      Prog.seen[want] = 1;
      Prog.stats.answered++;
      Prog.stats.correct++;
      steleWord = null;
      save();

      setTimeout(function () { nextRoom(); }, 1500);
    } else {
      $('steleInput').className = 'no';
      $('steleFlash').textContent = '拼写错误，正确是 ' + want;
      $('steleFlash').className = 'flash-msg no';
      sfxBad();
      say(want);
      setTimeout(function () {
        $('steleInput').value = '';
        $('steleInput').className = '';
        $('steleFlash').textContent = '';
      }, 1200);
    }
  }

  function skipStele() {
    steleWord = null;
    nextRoom();
  }

  /* =========================================================
     事件
     ========================================================= */
  var EVENTS = [
    { icon: '🎒', title: '遗落的背包', desc: '地上有一个落满灰尘的背包。',
      choices: [
        { t: '打开看看', fn: function () { R.gold += 15; return '找到了 15 ✧'; } },
        { t: '不碰', fn: function () { return '继续前进'; } }
      ] },
    { icon: '⛲', title: '生命之泉', desc: '清澈的泉水从石缝中涌出。',
      choices: [
        { t: '喝一口', fn: function () { R.hp = Math.min(R.maxHp, R.hp + 25); return '恢复了 25 HP'; } },
        { t: '装一瓶', fn: function () { R.gold += 10; return '获得了 10 ✧'; } }
      ] },
    { icon: '📜', title: '古老卷轴', desc: '卷轴上写满了文字。',
      choices: [
        { t: '仔细研读', fn: function () {
          var w = pickWord(Math.min(R.floor, 3), 'normal');
          Prog.prof[w.w] = Math.min(4, profOf(w.w) + 1);
          return '学会了 ' + w.w + '（' + senses(w) + '）';
        } },
        { t: '卖掉', fn: function () { R.gold += 20; return '获得了 20 ✧'; } }
      ] },
    { icon: '🎰', title: '命运转盘', desc: '一个闪闪发光的转盘。',
      choices: [
        { t: '转动它', fn: function () {
          if (Math.random() < 0.5) { R.gold += 25; return '运气不错！+25 ✧'; }
          else { R.hp -= 12; return '运气不好... -12 HP'; }
        } },
        { t: '离开', fn: function () { return '不冒险'; } }
      ] },
    { icon: '🔥', title: '废弃营地', desc: '有人在这里生过火。',
      choices: [
        { t: '休息一下', fn: function () { R.hp = Math.min(R.maxHp, R.hp + 20); return '恢复了 20 HP'; } },
        { t: '搜索物资', fn: function () { R.gold += 12; return '找到了 12 ✧'; } }
      ] }
  ];

  function startEvent() {
    var e = EVENTS[(Math.random() * EVENTS.length) | 0];
    $('eventIcon').textContent = e.icon;
    $('eventTitle').textContent = e.title;
    $('eventDesc').textContent = e.desc;

    var choices = $('eventChoices');
    choices.innerHTML = '';
    e.choices.forEach(function (c) {
      choices.appendChild(btn(c.t, '', function () {
        var msg = c.fn();
        $('eventDesc').textContent = msg;
        $('eventChoices').innerHTML = '';
        $('eventChoices').appendChild(btn('继续', '', function () { nextRoom(); }));
        sfxPick();
        save();
      }));
    });
    show('event');
  }

  /* =========================================================
     休息
     ========================================================= */
  function startRest() {
    var choices = $('restChoices');
    choices.innerHTML = '';
    choices.appendChild(btn('篝火休息', '恢复 30 HP', function () {
      R.hp = Math.min(R.maxHp, R.hp + 30);
      save(); nextRoom();
    }));
    choices.appendChild(btn('复习错题', '随机 3 个没掌握的词 +1 熟练度', function () {
      var pool = [];
      for (var k in Prog.prof) if (Prog.prof[k] < 3) pool.push(k);
      for (var i = pool.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      pool.slice(0, 3).forEach(function (w) { Prog.prof[w] = profOf(w) + 1; });
      save(); nextRoom();
    }));
    show('rest');
  }

  /* =========================================================
     商店
     ========================================================= */
  function startShop() {
    $('shopGold').textContent = R.gold;
    var items = $('shopItems');
    items.innerHTML = '';

    var shopItems = [
      { name: '生命药水', cost: 20, desc: '恢复 35 HP', fn: function () { R.hp = Math.min(R.maxHp, R.hp + 35); } },
      { name: '护身符', cost: 30, desc: '最大 HP +15', fn: function () { R.maxHp += 15; R.hp += 15; } },
      { name: '随机词汇', cost: 25, desc: '随机 1 个词熟练度 +1', fn: function () {
        var w = pickWord(Math.min(R.floor, 3), 'normal');
        Prog.prof[w.w] = Math.min(4, profOf(w.w) + 1);
      } },
      { name: '清除幽灵', cost: 35, desc: '清除所有答错的词', fn: function () { R.ghosts = []; } }
    ];

    shopItems.forEach(function (item) {
      var canBuy = R.gold >= item.cost;
      var b = btn(item.name, item.desc + (canBuy ? '' : '（金币不足）'), function () {
        if (!canBuy) return;
        R.gold -= item.cost;
        item.fn();
        sfxPick();
        save();
        startShop();
      }, !canBuy);
      items.appendChild(b);
    });

    show('shop');
  }

  /* =========================================================
     结算
     ========================================================= */
  function endRun(cleared) {
    if (R) {
      R.over = true;
    }
    save();

    if (!cleared) sfxLose(); else sfxWin();

    $('overTitle').textContent = cleared ? '通关！' : '冒险结束';
    $('overSub').textContent = cleared ? '你征服了所有地牢' : '你倒在了第 ' + (R.floor + 1) + ' 层';

    var stats = $('overStats');
    stats.innerHTML = '';
    stats.appendChild(makeStat(R.stats.correct, '答对'));
    stats.appendChild(makeStat(R.missed.length, '没拿下'));
    stats.appendChild(makeStat(R.gold, '金币'));
    stats.appendChild(makeStat(knownCount(), '总掌握'));

    if (R.missed.length) {
      var missedDiv = el('div', 'card');
      missedDiv.appendChild(el('div', 'small muted', '还没拿下的词（下次会追你）：'));
      var ul = el('ul', 'wordlist');
      R.missed.slice(0, 8).forEach(function (w) {
        var word = BY[w];
        if (!word) return;
        var li = el('li');
        li.appendChild(el('span', '', w));
        li.appendChild(el('span', 'cn', senses(word)));
        ul.appendChild(li);
      });
      missedDiv.appendChild(ul);
      stats.appendChild(missedDiv);
    }

    var btns = $('overBtns');
    btns.innerHTML = '';
    btns.appendChild(btn('再来一次', '新的冒险', function () { newRun(); }));
    btns.appendChild(btn('返回标题', '', function () { R = null; save(); renderTitle(); show('title'); }));

    show('over');
  }

  function makeStat(val, label) {
    var d = el('div', 'stat');
    d.appendChild(el('div', 'val', val));
    d.appendChild(el('div', 'label', label));
    return d;
  }

  /* =========================================================
     设置
     ========================================================= */
  function renderSettings() {
    var sndToggle = $('sndToggle');
    sndToggle.classList.toggle('on', SND);
    sndToggle.onclick = function () {
      SND = !SND;
      sndToggle.classList.toggle('on', SND);
      try { localStorage.setItem('yanling:snd', SND ? '1' : '0'); } catch (e) {}
      if (SND) sfxPick();
    };

    var voiceToggle = $('voiceToggle');
    voiceToggle.classList.toggle('on', USE_VOICE);
    voiceToggle.onclick = function () {
      USE_VOICE = !USE_VOICE;
      voiceToggle.classList.toggle('on', USE_VOICE);
      try { localStorage.setItem('yanling:voice', USE_VOICE ? '1' : '0'); } catch (e) {}
    };

    $('dictInfo').textContent = 'CET-4 + CET-6 · ' + WORDS.length + ' 词';

    show('settings');
  }

  /* =========================================================
     地牢渲染（继续冒险时用）
     ========================================================= */
  function renderDungeon() {
    // 简单显示当前状态，然后进入下一个房间
    nextRoom();
  }

  /* =========================================================
     启动
     ========================================================= */
  load();
  renderTitle();

  $('castBtn').addEventListener('click', castSpell);
  $('fleeBtn').addEventListener('click', fleeBattle);
  $('steleBtn').addEventListener('click', inscribeWord);
  $('steleSkipBtn').addEventListener('click', skipStele);
  $('shopLeaveBtn').addEventListener('click', function () { nextRoom(); });
  $('settingsBack').addEventListener('click', function () { renderTitle(); show('title'); });

  $('spellInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); castSpell(); }
  });
  $('steleInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); inscribeWord(); }
  });

})();
