'use strict';
/* =============================================================
   qoder言 —— 地图探索肉鸽
   8×8 地图，不同地形考不同类别的四六级单词。
   词库：ECDICT（MIT），5,788 词，CET-4 + CET-6
   ============================================================= */
(function () {

  var D = window.DS_WORDS;
  if (!D || !D.words) {
    document.body.innerHTML = '<p style="padding:40px;text-align:center">词库没加载上，刷新试试。</p>';
    return;
  }

  var WORDS = D.words;
  var BY = {};
  for (var i = 0; i < WORDS.length; i++) BY[WORDS[i].w] = WORDS[i];

  /* ---------- 地形-词汇映射 ---------- */
  // 按中文释义关键词把词分到地形。一个词只归一个地形（先匹配先赢）。
  var TERRAINS = {
    water:    { icon: '🌊', name: '水域',   cls: 'tile-water',    kw: ['水','河','海','湖','鱼','船','流','湿','雨','潮','波','洋','泉','冰'] },
    forest:   { icon: '🌲', name: '森林',   cls: 'tile-forest',   kw: ['树','林','木','草','花','叶','植物','生长','种子','根','茎'] },
    mountain: { icon: '⛰️', name: '山地',   cls: 'tile-mountain', kw: ['山','石','岩','高','陡','峰','谷','崖','坡'] },
    desert:   { icon: '🏜️', name: '沙漠',   cls: 'tile-desert',   kw: ['沙','旱','干','热','晒','渴','焦'] },
    swamp:    { icon: '🌿', name: '沼泽',   cls: 'tile-swamp',    kw: ['泥','沼','腐','烂','毒','虫','蛇','臭'] },
    plains:   { icon: '🌾', name: '平原',   cls: 'tile-plains',   kw: ['田','农','耕','麦','稻','谷','粮','牛','羊','马','猪'] }
  };
  var TERRAIN_KEYS = ['water','forest','mountain','desert','swamp','plains'];

  // 预分类：每个地形对应一个词池
  var TERRAIN_WORDS = {};
  (function () {
    var used = {};
    TERRAIN_KEYS.forEach(function (k) { TERRAIN_WORDS[k] = []; });
    // 按关键词匹配
    TERRAIN_KEYS.forEach(function (k) {
      var keywords = TERRAINS[k].kw;
      WORDS.forEach(function (w) {
        if (used[w.w]) return;
        var senses = (w.s || []).join('');
        for (var i = 0; i < keywords.length; i++) {
          if (senses.indexOf(keywords[i]) >= 0) {
            TERRAIN_WORDS[k].push(w);
            used[w.w] = 1;
            return;
          }
        }
      });
    });
    // 没匹配到的词全塞 plains 当默认池
    WORDS.forEach(function (w) {
      if (!used[w.w]) TERRAIN_WORDS.plains.push(w);
    });
  })();

  /* ---------- 常量 ---------- */
  var MAP_SIZE = 8;
  var MAX_ENERGY = 25;
  var SAVE_KEY = 'qoder-yan:save';

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
        if (!Prog.stats) Prog.stats = { runs: 0, answered: 0, correct: 0 };
        if (Prog.stats.answered === undefined) Prog.stats.answered = 0;
        if (Prog.stats.correct === undefined) Prog.stats.correct = 0;
      }
      if (o && o.run && o.run.map) R = o.run;
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
  try { USE_VOICE = localStorage.getItem('qoder-yan:voice') !== '0'; } catch (e) {}
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
  try { SND = localStorage.getItem('qoder-yan:snd') !== '0'; } catch (e) {}
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
  function sfxOk()   { seq([[660, .08, 'triangle', .09], [990, .13, 'triangle', .08]], 75); }
  function sfxBad()  { seq([[200, .10, 'sawtooth', .06], [150, .18, 'sawtooth', .05]], 65); }
  function sfxWin()  { seq([[523, .09], [659, .09], [784, .18]], 90); }
  function sfxLose() { seq([[330, .13], [262, .13], [196, .26]], 115); }
  function sfxPick() { seq([[784, .06], [1046, .11]], 65); }
  function sfxStep() { tone(440, .05, 'sine', .06); }

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
  function hintOf(word) {
    var out = [];
    for (var i = 0; i < word.length; i++) out.push('_');
    return out.join(' ') + '   (' + word.length + ')';
  }

  /* ---------- 选词 ---------- */
  var usedWords = {};
  function pickWord(terrain) {
    var pool = TERRAIN_WORDS[terrain] || TERRAIN_WORDS.plains;
    if (!pool.length) pool = WORDS;
    var tries = 0, w;
    do {
      w = pool[(Math.random() * pool.length) | 0];
      tries++;
    } while (usedWords[w.w] && tries < 100);
    if (usedWords[w.w]) w = pool[(Math.random() * pool.length) | 0];
    // 复习优先
    if (Prog.seen[w.w] && profOf(w.w) < 3 && Math.random() < 0.4) return w;
    usedWords[w.w] = 1;
    return w;
  }

  /* =========================================================
     地图生成
     ========================================================= */
  function generateMap() {
    var map = [];
    for (var y = 0; y < MAP_SIZE; y++) {
      var row = [];
      for (var x = 0; x < MAP_SIZE; x++) {
        if (x === 0 && y === 0) {
          row.push({ terrain: 'plains', type: 'start' });
        } else if (x === MAP_SIZE - 1 && y === MAP_SIZE - 1) {
          row.push({ terrain: 'mountain', type: 'goal' });
        } else {
          var roll = Math.random();
          var terrain, type;
          if (roll < 0.55) {
            terrain = TERRAIN_KEYS[(Math.random() * TERRAIN_KEYS.length) | 0];
            type = 'challenge';
          } else if (roll < 0.72) {
            terrain = TERRAIN_KEYS[(Math.random() * TERRAIN_KEYS.length) | 0];
            type = 'event';
          } else if (roll < 0.82) {
            terrain = 'plains';
            type = 'treasure';
          } else if (roll < 0.90) {
            terrain = 'plains';
            type = 'rest';
          } else {
            terrain = TERRAIN_KEYS[(Math.random() * TERRAIN_KEYS.length) | 0];
            type = 'challenge';
          }
          row.push({ terrain: terrain, type: type, visited: false });
        }
      }
      map.push(row);
    }
    return map;
  }

  /* =========================================================
     标题页
     ========================================================= */
  function renderTitle() {
    var btns = $('titleBtns'); btns.innerHTML = '';
    btns.appendChild(btn('开始探索', '8×8 地图，找到终点', function () { newRun(); }));
    if (R && !R.over) {
      btns.appendChild(btn('继续探索', '上次能量 ' + R.energy, function () {
        renderMap(); show('map');
      }));
    }

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
      map: generateMap(),
      px: 0, py: 0,
      energy: MAX_ENERGY,
      gold: 0,
      stats: { steps: 0, answered: 0, correct: 0, events: 0 },
      over: false
    };
    usedWords = {};
    Prog.stats.runs++;
    save();
    renderMap();
    show('map');
  }

  /* =========================================================
     地图渲染
     ========================================================= */
  function renderMap() {
    $('energyText').textContent = R.energy + '/' + MAX_ENERGY;
    $('goldText').textContent = R.gold;
    $('energyBar').style.width = (R.energy / MAX_ENERGY * 100) + '%';
    $('mapInfo').textContent = '步数 ' + R.stats.steps;

    var grid = $('mapGrid');
    grid.innerHTML = '';

    for (var y = 0; y < MAP_SIZE; y++) {
      for (var x = 0; x < MAP_SIZE; x++) {
        var cell = R.map[y][x];
        var tile = el('div', 'tile');
        var isPlayer = (x === R.px && y === R.py);
        var isAdjacent = isAdj(x, y);
        var isGoal = cell.type === 'goal';

        if (isGoal) {
          tile.className += ' goal';
          tile.textContent = '★';
        } else if (isPlayer) {
          tile.className += ' player';
          tile.textContent = '🧙';
        } else if (cell.visited) {
          tile.className += ' ' + TERRAINS[cell.terrain].cls;
          tile.textContent = '·';
          tile.style.opacity = '0.5';
        } else {
          tile.className += ' ' + TERRAINS[cell.terrain].cls;
          // 事件/宝藏格在未访问时显示特殊图标
          if (cell.type === 'event') tile.textContent = '？';
          else if (cell.type === 'treasure') tile.textContent = '✧';
          else if (cell.type === 'rest') tile.textContent = '🔥';
          else tile.textContent = TERRAINS[cell.terrain].icon;
        }

        if (isAdjacent && !isPlayer) {
          tile.className += ' adjacent';
          tile.dataset.x = x;
          tile.dataset.y = y;
          tile.addEventListener('click', onTileClick);
        }

        grid.appendChild(tile);
      }
    }
  }

  function isAdj(x, y) {
    var dx = Math.abs(x - R.px), dy = Math.abs(y - R.py);
    return (dx + dy === 1); // 只允许上下左右
  }

  function onTileClick(e) {
    var x = parseInt(e.currentTarget.dataset.x);
    var y = parseInt(e.currentTarget.dataset.y);
    tryMove(x, y);
  }

  /* =========================================================
     移动
     ========================================================= */
  function tryMove(x, y) {
    if (R.over) return;
    if (!isAdj(x, y)) return;
    if (R.energy <= 0) {
      // 没能量了
      return endRun(false, '能量耗尽');
    }

    R.energy--;
    R.stats.steps++;
    R.px = x;
    R.py = y;
    sfxStep();

    var cell = R.map[y][x];

    if (cell.type === 'goal') {
      cell.visited = true;
      save();
      return endRun(true);
    }

    if (cell.type === 'start' || cell.visited) {
      cell.visited = true;
      save();
      renderMap();
      show('map');
      return;
    }

    cell.visited = true;

    if (cell.type === 'challenge') {
      startChallenge(cell.terrain);
    } else if (cell.type === 'event') {
      startEvent();
    } else if (cell.type === 'treasure') {
      startTreasure();
    } else if (cell.type === 'rest') {
      startRest();
    } else {
      renderMap();
      show('map');
    }
    save();
  }

  /* =========================================================
     拼写挑战
     ========================================================= */
  var CH = null;

  function startChallenge(terrain) {
    var w = pickWord(terrain);
    var t = TERRAINS[terrain];
    CH = { terrain: terrain, word: w, done: false };

    $('challengeIcon').textContent = t.icon;
    $('challengePrompt').textContent = t.name + ' — 拼出这个词';
    $('challengeCn').textContent = senses(w);
    $('challengeHint').textContent = hintOf(w.w);
    $('challengeInput').value = '';
    $('challengeInput').className = '';
    $('challengeFlash').textContent = '';
    $('challengeFlash').className = 'flash';
    $('submitBtn').disabled = false;
    $('skipBtn').disabled = false;

    show('challenge');
    $('challengeInput').focus();
  }

  function submitChallenge() {
    if (!CH || CH.done) return;
    var input = $('challengeInput').value.trim().toLowerCase();
    if (!input) return;

    CH.done = true;
    var w = CH.word, want = w.w;
    var typed = input;
    R.stats.answered++;
    Prog.stats.answered++;
    Prog.seen[w.w] = 1;

    var f = $('challengeFlash');
    var verdict;

    if (typed === want) verdict = 'exact';
    else if (typed.length > 2 && dist(typed, want) <= 1) verdict = 'near';
    else verdict = 'wrong';

    if (verdict === 'exact') {
      R.stats.correct++;
      Prog.stats.correct++;
      Prog.prof[w.w] = Math.min(4, profOf(w) + 1);
      R.gold += 3;
      f.textContent = '正确！' + want + ' · ' + senses(w);
      f.className = 'flash ok';
      $('challengeInput').className = 'ok';
      say(want); sfxOk();
    } else if (verdict === 'near') {
      R.stats.correct++;
      Prog.stats.correct++;
      Prog.prof[w.w] = Math.min(4, profOf(w) + 1);
      f.textContent = '差一点：' + typed + ' → ' + want;
      f.className = 'flash info';
      $('challengeInput').className = 'ok';
      say(want); sfxOk();
    } else {
      Prog.prof[w.w] = Math.max(0, profOf(w) - 1);
      R.energy = Math.max(0, R.energy - 1);
      f.textContent = '错误。正确：' + want + ' · ' + senses(w);
      f.className = 'flash no';
      $('challengeInput').className = 'no';
      say(want); sfxBad();
    }

    $('submitBtn').disabled = true;
    $('skipBtn').disabled = true;
    save();

    setTimeout(function () {
      if (R.energy <= 0) return endRun(false, '能量耗尽');
      CH = null;
      renderMap();
      show('map');
    }, 1500);
  }

  function skipChallenge() {
    CH = null;
    renderMap();
    show('map');
  }

  /* =========================================================
     事件
     ========================================================= */
  var EVENTS = [
    { icon: '🎒', title: '遗落的背包', desc: '地上有一个落满灰尘的背包。',
      choices: [
        { t: '打开看看', fn: function () { R.gold += 10; return '找到了 10 ✧'; } },
        { t: '不碰', fn: function () { return '继续前进'; } }
      ] },
    { icon: '⛲', title: '生命之泉', desc: '清澈的泉水从石缝中涌出。',
      choices: [
        { t: '喝一口', fn: function () { R.energy = Math.min(MAX_ENERGY, R.energy + 5); return '恢复了 5 能量'; } },
        { t: '装一瓶', fn: function () { R.gold += 8; return '获得了 8 ✧'; } }
      ] },
    { icon: '📜', title: '古老卷轴', desc: '卷轴上写满了文字，似乎蕴含知识。',
      choices: [
        { t: '仔细研读', fn: function () {
          var pool = WORDS;
          var w = pool[(Math.random() * pool.length) | 0];
          Prog.prof[w.w] = Math.min(4, profOf(w) + 1);
          Prog.seen[w.w] = 1;
          return '学会了 ' + w.w + '（' + senses(w) + '）';
        } },
        { t: '卖掉', fn: function () { R.gold += 12; return '获得了 12 ✧'; } }
      ] },
    { icon: '🎰', title: '命运转盘', desc: '一个闪闪发光的转盘。',
      choices: [
        { t: '转动它', fn: function () {
          if (Math.random() < 0.5) { R.gold += 15; return '运气不错！+15 ✧'; }
          else { R.energy = Math.max(0, R.energy - 3); return '运气不好... -3 能量'; }
        } },
        { t: '离开', fn: function () { return '不冒险'; } }
      ] },
    { icon: '🔥', title: '废弃营地', desc: '有人在这里生过火，余温尚存。',
      choices: [
        { t: '休息一下', fn: function () { R.energy = Math.min(MAX_ENERGY, R.energy + 4); return '恢复了 4 能量'; } },
        { t: '搜索物资', fn: function () { R.gold += 8; return '找到了 8 ✧'; } }
      ] },
    { icon: '🧭', title: '神秘指南针', desc: '一个古老的指南针在发光。',
      choices: [
        { t: '拿起指南针', fn: function () { R.energy = Math.min(MAX_ENERGY, R.energy + 6); return '指南针给了你力量 +6 能量'; } },
        { t: '留下', fn: function () { return '继续前进'; } }
      ] }
  ];

  function startEvent() {
    R.stats.events++;
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
        $('eventChoices').appendChild(btn('继续', '', function () {
          if (R.energy <= 0) return endRun(false, '能量耗尽');
          renderMap();
          show('map');
        }));
        sfxPick();
        save();
      }));
    });
    show('event');
  }

  /* =========================================================
     宝藏
     ========================================================= */
  function startTreasure() {
    var gold = 5 + (Math.random() * 10) | 0;
    R.gold += gold;
    sfxPick();
    $('eventIcon').textContent = '💎';
    $('eventTitle').textContent = '宝藏！';
    $('eventDesc').textContent = '你发现了 ' + gold + ' ✧';
    var choices = $('eventChoices');
    choices.innerHTML = '';
    choices.appendChild(btn('继续', '', function () {
      renderMap();
      show('map');
    }));
    show('event');
    save();
  }

  /* =========================================================
     休息
     ========================================================= */
  function startRest() {
    $('eventIcon').textContent = '🔥';
    $('eventTitle').textContent = '篝火';
    $('eventDesc').textContent = '温暖的篝火，可以歇一会儿。';
    var choices = $('eventChoices');
    choices.innerHTML = '';
    choices.appendChild(btn('休息', '恢复 5 能量', function () {
      R.energy = Math.min(MAX_ENERGY, R.energy + 5);
      sfxPick();
      save();
      renderMap();
      show('map');
    }));
    choices.appendChild(btn('复习错题', '随机 2 个没掌握的词熟练度 +1', function () {
      var pool = [];
      for (var k in Prog.prof) if (Prog.prof[k] < 3) pool.push(k);
      for (var i = pool.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      pool.slice(0, 2).forEach(function (w) { Prog.prof[w] = profOf(w) + 1; });
      sfxPick();
      save();
      renderMap();
      show('map');
    }));
    show('event');
  }

  /* =========================================================
     结算
     ========================================================= */
  function endRun(cleared, reason) {
    if (R) R.over = true;
    save();

    if (!cleared) sfxLose(); else sfxWin();

    $('overTitle').textContent = cleared ? '到达终点！' : '探索结束';
    $('overSub').textContent = cleared ? '你穿越了整片大陆' : (reason || '你走不动了');

    var stats = $('overStats');
    stats.innerHTML = '';
    stats.appendChild(makeStat(R.stats.steps, '步数'));
    stats.appendChild(makeStat(R.stats.correct, '答对'));
    stats.appendChild(makeStat(R.gold, '金币'));
    stats.appendChild(makeStat(knownCount(), '总掌握'));

    var btns = $('overBtns');
    btns.innerHTML = '';
    btns.appendChild(btn('再来一次', '新的地图', function () { newRun(); }));
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
     启动
     ========================================================= */
  load();
  renderTitle();

  $('submitBtn').addEventListener('click', submitChallenge);
  $('skipBtn').addEventListener('click', skipChallenge);
  $('challengeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitChallenge(); }
  });

})();
