'use strict';
/* =============================================================
   qoder言 —— 地图探索肉鸽（完全版）
   3 大陆 · 商店 · 道具 · Boss · 陷阱 · 传送门
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

  /* ---------- 地形-词汇映射 ---------- */
  var TERRAINS = {
    water:    { icon: '🌊', name: '水域',   cls: 'tile-water',    kw: ['水','河','海','湖','鱼','船','流','湿','雨','潮','波','洋','泉','冰'] },
    forest:   { icon: '🌲', name: '森林',   cls: 'tile-forest',   kw: ['树','林','木','草','花','叶','植物','生长','种子','根','茎'] },
    mountain: { icon: '⛰️', name: '山地',   cls: 'tile-mountain', kw: ['山','石','岩','高','陡','峰','谷','崖','坡'] },
    desert:   { icon: '🏜️', name: '沙漠',   cls: 'tile-desert',   kw: ['沙','旱','干','热','晒','渴','焦'] },
    swamp:    { icon: '🌿', name: '沼泽',   cls: 'tile-swamp',    kw: ['泥','沼','腐','烂','毒','虫','蛇','臭'] },
    plains:   { icon: '🌾', name: '平原',   cls: 'tile-plains',   kw: ['田','农','耕','麦','稻','谷','粮','牛','羊','马','猪'] }
  };
  var TERRAIN_KEYS = ['water','forest','mountain','desert','swamp','plains'];

  var TERRAIN_WORDS = {};
  (function () {
    var used = {};
    TERRAIN_KEYS.forEach(function (k) { TERRAIN_WORDS[k] = []; });
    TERRAIN_KEYS.forEach(function (k) {
      var keywords = TERRAINS[k].kw;
      WORDS.forEach(function (w) {
        if (used[w.w]) return;
        var senses = (w.s || []).join('');
        for (var i = 0; i < keywords.length; i++) {
          if (senses.indexOf(keywords[i]) >= 0) { TERRAIN_WORDS[k].push(w); used[w.w] = 1; return; }
        }
      });
    });
    WORDS.forEach(function (w) { if (!used[w.w]) TERRAIN_WORDS.plains.push(w); });
  })();

  /* ---------- 道具 ---------- */
  var ITEMS = {
    potion: { icon: '🧪', name: '能量药水', desc: '恢复 8 能量', cost: 15 },
    hint:   { icon: '📜', name: '提示卷轴', desc: '显示首字母', cost: 10 },
    skip:   { icon: '🎫', name: '跳过券',   desc: '跳过当前挑战', cost: 8 },
    shield: { icon: '🛡️', name: '护盾',     desc: '下次答错不扣能量', cost: 20 }
  };

  /* ---------- 常量 ---------- */
  var MAP_SIZE = 10;
  var MAX_ENERGY = 30;
  var MAX_FLOOR = 3;
  var SAVE_KEY = 'qoder-yan:save';

  /* ---------- 存档 ---------- */
  var Prog = {
    prof: {}, seen: {}, learned: {},
    stats: { runs: 0, answered: 0, correct: 0, newLearned: 0, bestFloor: 0 }
  };
  var R = null;

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.prog) {
        Prog = o.prog;
        if (!Prog.stats) Prog.stats = { runs: 0, answered: 0, correct: 0, newLearned: 0, bestFloor: 0 };
        if (!Prog.learned) Prog.learned = {};
      }
      if (o && o.run && o.run.map) R = o.run;
    } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 3, prog: Prog, run: R })); } catch (e) {}
  }
  function profOf(w) { return Prog.prof[typeof w === 'string' ? w : w.w] || 0; }
  function isNew(w) { return !Prog.seen[w.w]; }
  function knownCount() { var n = 0; for (var k in Prog.prof) if (Prog.prof[k] >= 1) n++; return n; }
  function learnedCount() { var n = 0; for (var k in Prog.learned) n++; return n; }

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
  function senses(w) { return (w.s || []).slice(0, 2).join('；'); }
  function getRoots(w) {
    if (!w.rt || !w.rt.length) return null;
    var parts = [];
    w.rt.forEach(function (r) {
      var raw = ROOTS[r];
      if (!raw) { parts.push(r); return; }
      var def;
      try { def = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { parts.push(r); return; }
      if (def && def.m) parts.push(r + '(' + def.m + ')');
      else parts.push(r);
    });
    return parts.join(' + ');
  }

  /* ---------- 发音 ---------- */
  var VOICE = null, USE_VOICE = true;
  try { USE_VOICE = localStorage.getItem('qoder-yan:voice') !== '0'; } catch (e) {}
  function pickVoice() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices() || [];
    for (var i = 0; i < vs.length; i++) { if (/^en([-_]|$)/i.test(vs[i].lang)) { VOICE = vs[i]; return; } }
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
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
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SND = false; } }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function tone(freq, dur, type, vol) {
    var c = ac(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.10, c.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.03);
    } catch (e) {}
  }
  function seq(list, gap) {
    list.forEach(function (n, i) { setTimeout(function () { tone(n[0], n[1], n[2], n[3]); }, i * (gap || 85)); });
  }
  function sfxOk()    { seq([[660,.08,'triangle',.09],[990,.13,'triangle',.08]], 75); }
  function sfxBad()   { seq([[200,.10,'sawtooth',.06],[150,.18,'sawtooth',.05]], 65); }
  function sfxWin()   { seq([[523,.09],[659,.09],[784,.18]], 90); }
  function sfxLose()  { seq([[330,.13],[262,.13],[196,.26]], 115); }
  function sfxPick()  { seq([[784,.06],[1046,.11]], 65); }
  function sfxStep()  { tone(440,.05,'sine',.06); }
  function sfxLearn() { seq([[523,.08],[659,.08],[784,.12]], 80); }
  function sfxBoss()  { seq([[220,.12,'sawtooth',.08],[330,.12,'sawtooth',.07],[440,.18,'sawtooth',.09]], 80); }
  function sfxPortal(){ seq([[880,.06],[660,.06],[440,.06],[660,.06],[880,.1]], 50); }

  /* ---------- 编辑距离 ---------- */
  function dist(a, b) {
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    if (Math.abs(m - n) > 2) return 9;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++)
        cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev = cur.slice();
    }
    return prev[n];
  }

  function hintOf(word, showFirst) {
    var out = [];
    for (var i = 0; i < word.length; i++) out.push(showFirst && i === 0 ? word[0] : '_');
    return out.join(' ') + '   (' + word.length + ')';
  }

  /* ---------- 选词 ---------- */
  var usedWords = {};
  function pickWord(terrain, boss) {
    var pool = TERRAIN_WORDS[terrain] || TERRAIN_WORDS.plains;
    if (!pool.length) pool = WORDS;
    if (boss) {
      var hard = pool.filter(function (w) { return w.w.length >= 7 && !usedWords[w.w]; });
      if (hard.length) pool = hard;
    }
    var roll = Math.random(), w;
    if (roll < 0.4) w = pickFromPool(pool, function (w) { return !Prog.seen[w.w] && !usedWords[w.w]; });
    else if (roll < 0.8) w = pickFromPool(pool, function (w) { return Prog.seen[w.w] && profOf(w.w) < 3 && !usedWords[w.w]; });
    if (!w) {
      var tries = 0;
      do { w = pool[(Math.random() * pool.length) | 0]; tries++; } while (usedWords[w.w] && tries < 100);
    }
    if (!w) w = pool[(Math.random() * pool.length) | 0];
    usedWords[w.w] = 1;
    return w;
  }
  function pickFromPool(pool, test) {
    for (var i = 0; i < 50; i++) { var w = pool[(Math.random() * pool.length) | 0]; if (test(w)) return w; }
    return null;
  }

  /* =========================================================
     地图生成
     ========================================================= */
  function generateMap(floor) {
    var map = [];
    for (var y = 0; y < MAP_SIZE; y++) {
      var row = [];
      for (var x = 0; x < MAP_SIZE; x++) {
        if (x === 0 && y === 0) row.push({ terrain: 'plains', type: 'start' });
        else if (x === MAP_SIZE-1 && y === MAP_SIZE-1) row.push({ terrain: 'mountain', type: 'goal' });
        else row.push(generateCell(floor));
      }
      map.push(row);
    }
    var shopCount = 0, bossCount = 0;
    for (var y = 0; y < MAP_SIZE; y++) for (var x = 0; x < MAP_SIZE; x++) {
      if (map[y][x].type === 'shop') shopCount++;
      if (map[y][x].type === 'boss') bossCount++;
    }
    while (shopCount < 2) { placeSpecial(map, 'shop'); shopCount++; }
    if (floor >= 1 && bossCount < 1) placeSpecial(map, 'boss');
    return map;
  }
  function placeSpecial(map, type) {
    for (var tries = 0; tries < 200; tries++) {
      var x = 1 + (Math.random() * (MAP_SIZE - 2)) | 0;
      var y = 1 + (Math.random() * (MAP_SIZE - 2)) | 0;
      if (map[y][x].type === 'challenge' || map[y][x].type === 'event') { map[y][x].type = type; return; }
    }
  }
  function generateCell(floor) {
    var roll = Math.random();
    var terrain = TERRAIN_KEYS[(Math.random() * TERRAIN_KEYS.length) | 0];
    var trapChance = 0.03 + floor * 0.02;
    var bossChance = 0.02 + floor * 0.02;
    var portalChance = floor >= 2 ? 0.03 : 0;
    if (roll < 0.38) return { terrain: terrain, type: 'challenge' };
    if (roll < 0.48) return { terrain: TERRAIN_KEYS[(Math.random() * TERRAIN_KEYS.length) | 0], type: 'discovery' };
    if (roll < 0.58) return { terrain: TERRAIN_KEYS[(Math.random() * TERRAIN_KEYS.length) | 0], type: 'event' };
    if (roll < 0.65) return { terrain: 'plains', type: 'treasure' };
    if (roll < 0.72) return { terrain: 'plains', type: 'rest' };
    if (roll < 0.78) return { terrain: 'plains', type: 'shop' };
    if (roll < 0.78 + trapChance) return { terrain: terrain, type: 'trap' };
    if (roll < 0.78 + trapChance + bossChance) return { terrain: terrain, type: 'boss' };
    if (roll < 0.78 + trapChance + bossChance + portalChance) return { terrain: 'plains', type: 'portal' };
    return { terrain: terrain, type: 'challenge' };
  }

  /* =========================================================
     标题页
     ========================================================= */
  function renderTitle() {
    var btns = $('titleBtns'); btns.innerHTML = '';
    btns.appendChild(btn('开始探索', '3 个大陆，找到终点', function () { newRun(); }));
    if (R && !R.over) {
      btns.appendChild(btn('继续探索', '大陆 ' + (R.floor + 1) + ' · 能量 ' + R.energy, function () {
        renderMap(); show('map');
      }));
    }
    var ans = Prog.stats.answered || 0;
    var cor = Prog.stats.correct || 0;
    var best = Prog.stats.bestFloor || 0;
    $('titleProgress').textContent = '已掌握 ' + knownCount() + '/' + WORDS.length + ' · 新学 ' +
      learnedCount() + ' · 答对率 ' + (ans ? Math.round(cor/ans*100) : 0) + '%' +
      (best > 0 ? ' · 最远大陆 ' + best : '');
  }

  /* =========================================================
     新局
     ========================================================= */
  function newRun() {
    R = {
      map: generateMap(0), floor: 0,
      px: 0, py: 0,
      energy: MAX_ENERGY, maxEnergy: MAX_ENERGY,
      gold: 0,
      items: { potion: 1, hint: 1, skip: 0, shield: 0 },
      shieldActive: false,
      ghosts: [],
      stats: { steps: 0, answered: 0, correct: 0, events: 0, newThisRun: 0, bosses: 0, ghostsKilled: 0 },
      over: false
    };
    usedWords = {};
    Prog.stats.runs++;
    save(); renderMap(); show('map');
  }

  /* =========================================================
     地图渲染
     ========================================================= */
  function renderMap() {
    $('floorName').textContent = '大陆 ' + (R.floor + 1) + '/' + MAX_FLOOR;
    $('energyText').textContent = R.energy + '/' + R.maxEnergy;
    $('goldText').textContent = R.gold;
    $('energyBar').style.width = (R.energy / R.maxEnergy * 100) + '%';
    $('mapInfo').textContent = '步数 ' + R.stats.steps;

    var itemsBar = $('itemsBar');
    itemsBar.innerHTML = '';
    Object.keys(ITEMS).forEach(function (k) {
      if (R.items[k] > 0) itemsBar.appendChild(el('span', 'item-badge', ITEMS[k].icon + '×' + R.items[k]));
    });
    if (R.shieldActive) itemsBar.appendChild(el('span', 'item-badge', '🛡️'));

    var grid = $('mapGrid');
    grid.innerHTML = '';
    for (var y = 0; y < MAP_SIZE; y++) {
      for (var x = 0; x < MAP_SIZE; x++) {
        var cell = R.map[y][x];
        var tile = el('div', 'tile');
        var isPlayer = (x === R.px && y === R.py);
        var isAdjacent = isAdj(x, y);

        if (cell.type === 'goal') { tile.className += ' goal'; tile.textContent = '★'; }
        else if (isPlayer) { tile.className += ' player'; tile.textContent = '🧙'; }
        else if (cell.visited) {
          tile.className += ' ' + TERRAINS[cell.terrain].cls;
          tile.textContent = '·'; tile.style.opacity = '0.4';
        } else {
          tile.className += ' ' + TERRAINS[cell.terrain].cls;
          var icons = { discovery:'📖', event:'？', treasure:'✧', rest:'🔥', shop:'🏪', boss:'⚔', trap:'⚡', portal:'🌀', ghost:'👻' };
          tile.textContent = icons[cell.type] || TERRAINS[cell.terrain].icon;
          if (cell.type === 'ghost') tile.style.animation = 'pulse 1.5s infinite';
        }

        if (isAdjacent && !isPlayer) {
          tile.className += ' adjacent';
          tile.dataset.x = x; tile.dataset.y = y;
          tile.addEventListener('click', onTileClick);
        }
        grid.appendChild(tile);
      }
    }
  }

  function isAdj(x, y) { return Math.abs(x - R.px) + Math.abs(y - R.py) === 1; }
  function onTileClick(e) { tryMove(parseInt(e.currentTarget.dataset.x), parseInt(e.currentTarget.dataset.y)); }

  /* =========================================================
     移动
     ========================================================= */
  function tryMove(x, y) {
    if (R.over || !isAdj(x, y)) return;
    if (R.energy <= 0) return endRun(false, '能量耗尽');
    R.energy--; R.stats.steps++; R.px = x; R.py = y; sfxStep();
    var cell = R.map[y][x];

    if (cell.type === 'goal') {
      cell.visited = true;
      if (R.floor < MAX_FLOOR - 1) {
        R.floor++;
        Prog.stats.bestFloor = Math.max(Prog.stats.bestFloor, R.floor);
        R.map = generateMap(R.floor); R.px = 0; R.py = 0;
        R.energy = Math.min(R.maxEnergy, R.energy + 10);
        R.map[0][0].visited = true;
        save(); renderMap(); show('map'); return;
      }
      save(); return endRun(true);
    }
    if (cell.type === 'start' || cell.visited) { cell.visited = true; save(); renderMap(); show('map'); return; }
    cell.visited = true;

    switch (cell.type) {
      case 'challenge': { var w = pickWord(cell.terrain); if (isNew(w)) startLearn(w, cell.terrain, 'challenge'); else startChallenge(cell.terrain, w, false); break; }
      case 'discovery': startLearn(pickWord(cell.terrain), cell.terrain, 'discovery'); break;
      case 'boss': startChallenge(cell.terrain, pickWord(cell.terrain, true), true); break;
      case 'ghost': {
        var gw = BY[cell.ghostWord];
        if (!gw) { cell.type = 'challenge'; save(); renderMap(); show('map'); break; }
        startGhostChallenge(cell.terrain, gw, x, y);
        break;
      }
      case 'trap': startTrap(cell.terrain); break;
      case 'portal': startPortal(); break;
      case 'shop': startShop(); break;
      case 'event': startEvent(); break;
      case 'treasure': startTreasure(); break;
      case 'rest': startRest(); break;
      default: renderMap(); show('map');
    }
    save();
  }

  /* =========================================================
     学习界面
     ========================================================= */
  var learnState = null;
  function startLearn(word, terrain, after) {
    learnState = { word: word, terrain: terrain, after: after };
    var t = TERRAINS[terrain];
    $('learnIcon').textContent = after === 'discovery' ? '📖' : t.icon;
    $('learnTitle').textContent = after === 'discovery' ? '发现新词！' : '遇到生词';
    $('learnSub').textContent = after === 'discovery' ? '仔细记住这个词' : '先学再考，别慌';
    $('learnWord').textContent = word.w;
    $('learnPhonetic').textContent = word.ph || '';
    $('learnMeaning').textContent = senses(word);
    var rootEl = $('learnRoot');
    var rootStr = getRoots(word);
    if (rootStr) { rootEl.textContent = '词根：' + rootStr; rootEl.style.display = 'inline-block'; }
    else rootEl.style.display = 'none';
    show('learn'); sfxLearn(); say(word.w);
    Prog.seen[word.w] = 1; save();
  }
  function finishLearn() {
    if (!learnState) return;
    var w = learnState.word;
    Prog.learned[w.w] = 1; Prog.stats.newLearned++;
    if (R) R.stats.newThisRun++;
    if (learnState.after === 'challenge') startChallenge(learnState.terrain, w, false);
    else { renderMap(); show('map'); }
    learnState = null; save();
  }

  /* =========================================================
     拼写挑战
     ========================================================= */
  var CH = null;
  function startChallenge(terrain, word, boss) {
    var w = word || pickWord(terrain, boss);
    var t = TERRAINS[terrain];
    CH = { terrain: terrain, word: w, boss: !!boss, done: false, hintUsed: false };
    $('challengeIcon').textContent = t.icon;
    $('challengePrompt').textContent = t.name + ' — 拼出这个词';
    $('challengeCn').textContent = senses(w);
    $('challengeHint').textContent = hintOf(w.w, false);
    $('challengeInput').value = ''; $('challengeInput').className = '';
    $('challengeFlash').textContent = ''; $('challengeFlash').className = 'flash';
    $('challengeDetail').textContent = '';
    $('submitBtn').disabled = false; $('skipBtn').disabled = false;
    $('bossTag').style.display = boss ? 'block' : 'none';
    if (boss) sfxBoss();
    var rootEl = $('challengeRoot');
    var rootStr = getRoots(w);
    if (rootStr && profOf(w.w) < 2) { rootEl.textContent = '词根：' + rootStr; rootEl.style.display = 'block'; }
    else rootEl.style.display = 'none';
    var confuseEl = $('challengeConfuse');
    if (w.cf && w.cf.length && Prog.seen[w.w]) { confuseEl.textContent = '注意形近词：' + w.cf.slice(0, 2).join(', '); confuseEl.style.display = 'block'; }
    else confuseEl.style.display = 'none';
    renderChallengeItems();
    show('challenge'); $('challengeInput').focus();
  }
  function renderChallengeItems() {
    var bar = $('challengeItems'); bar.innerHTML = '';
    if (!CH || CH.done) return;
    ['hint', 'skip', 'shield'].forEach(function (k) {
      if (!R.items[k]) return;
      var b = el('button', 'item-btn', ITEMS[k].icon + ' ' + ITEMS[k].name);
      b.addEventListener('click', function () { useItem(k); });
      bar.appendChild(b);
    });
  }
  function useItem(k) {
    if (!CH || CH.done || !R.items[k]) return;
    R.items[k]--; sfxPick();
    if (k === 'hint') { CH.hintUsed = true; $('challengeHint').textContent = hintOf(CH.word.w, true); }
    else if (k === 'skip') { CH = null; renderMap(); show('map'); return; }
    else if (k === 'shield') { R.shieldActive = true; }
    renderChallengeItems(); save();
  }
  function submitChallenge() {
    if (!CH || CH.done) return;
    if (trapTimerInterval) { clearInterval(trapTimerInterval); trapTimerInterval = null; }
    var input = $('challengeInput').value.trim().toLowerCase();
    if (!input) return;
    CH.done = true;
    var w = CH.word, want = w.w, typed = input;
    R.stats.answered++; Prog.stats.answered++;
    var f = $('challengeFlash'), detail = $('challengeDetail');
    var verdict;
    if (typed === want) verdict = 'exact';
    else if (typed.length > 2 && dist(typed, want) <= 1) verdict = 'near';
    else verdict = 'wrong';
    var goldReward = CH.boss ? 10 : 3;
    var energyPenalty = CH.boss ? 3 : (CH.trap ? 2 : 1);

    if (verdict === 'exact' || verdict === 'near') {
      R.stats.correct++; Prog.stats.correct++;
      Prog.prof[w.w] = Math.min(4, profOf(w) + 1);
      R.gold += verdict === 'exact' ? goldReward : Math.round(goldReward / 2);
      if (CH.boss && verdict === 'exact') R.stats.bosses++;
      if (CH.ghost) {
        killGhost(CH.ghostX, CH.ghostY);
        R.map[CH.ghostY][CH.ghostX].type = 'challenge';
        R.map[CH.ghostY][CH.ghostX].ghostWord = null;
        f.textContent = (verdict === 'exact' ? '正确！' : '差一点！') + want + ' · 幽灵消灭！';
      } else {
        f.textContent = (verdict === 'exact' ? '正确！' : '差一点！') + want + (CH.boss ? ' · Boss 击败！' : '');
      }
      f.className = 'flash ok'; detail.textContent = senses(w);
      $('challengeInput').className = 'ok'; say(want); sfxOk();
    } else {
      if (R.shieldActive) { R.shieldActive = false; f.textContent = '护盾挡住了！正确：' + want; f.className = 'flash info'; }
      else {
        R.energy = Math.max(0, R.energy - energyPenalty);
        f.textContent = '错误。正确：' + want; f.className = 'flash no';
        if (!CH.trap && R.ghosts.length < 5) {
          spawnGhost(w);
        }
      }
      Prog.prof[w.w] = Math.max(0, profOf(w) - 1); detail.textContent = senses(w);
      var twin = (w.cf || []).indexOf(typed) >= 0;
      if (twin) { var tw = BY[typed]; detail.textContent = '你拼的 ' + typed + (tw ? '（'+senses(tw)+'）' : '') + ' ≠ ' + want + '（' + senses(w) + '）'; }
      $('challengeInput').className = 'no'; say(want); sfxBad();
    }
    $('submitBtn').disabled = true; $('skipBtn').disabled = true; $('challengeItems').innerHTML = '';
    save();
    setTimeout(function () { if (R.energy <= 0) return endRun(false, '能量耗尽'); CH = null; renderMap(); show('map'); }, 2000);
  }
  function skipChallenge() { CH = null; renderMap(); show('map'); }

  function spawnGhost(word) {
    var candidates = [];
    for (var y = 0; y < MAP_SIZE; y++) for (var x = 0; x < MAP_SIZE; x++) {
      var c = R.map[y][x];
      if (!c.visited && c.type !== 'goal' && c.type !== 'start' && c.type !== 'ghost' && !(x === R.px && y === R.py))
        candidates.push({ x: x, y: y });
    }
    if (!candidates.length) return;
    var pos = candidates[(Math.random() * candidates.length) | 0];
    R.map[pos.y][pos.x].type = 'ghost';
    R.map[pos.y][pos.x].ghostWord = word.w;
    R.ghosts.push({ word: word.w, x: pos.x, y: pos.y });
  }

  function killGhost(x, y) {
    R.ghosts = R.ghosts.filter(function (g) { return !(g.x === x && g.y === y); });
    R.stats.ghostsKilled++;
  }

  function startGhostChallenge(terrain, word, gx, gy) {
    CH = { terrain: terrain, word: word, boss: false, ghost: true, ghostX: gx, ghostY: gy, done: false, hintUsed: false };
    $('challengeIcon').textContent = '👻';
    $('challengePrompt').textContent = '幽灵阻挡！拼出这个词消灭它';
    $('challengeCn').textContent = senses(word);
    $('challengeHint').textContent = hintOf(word.w, false);
    $('challengeInput').value = ''; $('challengeInput').className = '';
    $('challengeFlash').textContent = ''; $('challengeFlash').className = 'flash';
    $('challengeDetail').textContent = '';
    $('submitBtn').disabled = false; $('skipBtn').disabled = true;
    $('bossTag').style.display = 'none';
    var rootEl = $('challengeRoot');
    var rootStr = getRoots(word);
    if (rootStr) { rootEl.textContent = '词根：' + rootStr; rootEl.style.display = 'block'; }
    else rootEl.style.display = 'none';
    var confuseEl = $('challengeConfuse');
    if (word.cf && word.cf.length) { confuseEl.textContent = '注意形近词：' + word.cf.slice(0, 2).join(', '); confuseEl.style.display = 'block'; }
    else confuseEl.style.display = 'none';
    $('challengeItems').innerHTML = '';
    show('challenge'); $('challengeInput').focus();
  }

  /* =========================================================
     陷阱（限时）
     ========================================================= */
  function startTrap(terrain) {
    var w = pickWord(terrain);
    if (isNew(w)) { startLearn(w, terrain, 'challenge'); return; }
    CH = { terrain: terrain, word: w, boss: false, trap: true, done: false, hintUsed: false, timer: 15 };
    $('challengeIcon').textContent = '⚡';
    $('challengePrompt').textContent = '陷阱！15秒内拼出';
    $('challengeCn').textContent = senses(w);
    $('challengeHint').textContent = hintOf(w.w, false);
    $('challengeInput').value = ''; $('challengeInput').className = '';
    $('challengeFlash').textContent = '答错扣 2 能量！'; $('challengeFlash').className = 'flash no';
    $('challengeDetail').textContent = '';
    $('bossTag').style.display = 'none'; $('challengeRoot').style.display = 'none'; $('challengeConfuse').style.display = 'none';
    $('submitBtn').disabled = false; $('skipBtn').disabled = true; $('challengeItems').innerHTML = '';
    startTrapTimer();
    show('challenge'); $('challengeInput').focus();
  }

  var trapTimerInterval = null;
  function startTrapTimer() {
    if (trapTimerInterval) clearInterval(trapTimerInterval);
    updateTimerDisplay();
    trapTimerInterval = setInterval(function () {
      if (!CH || CH.done) { clearInterval(trapTimerInterval); trapTimerInterval = null; return; }
      CH.timer--;
      updateTimerDisplay();
      if (CH.timer <= 0) {
        clearInterval(trapTimerInterval); trapTimerInterval = null;
        CH.done = true;
        R.energy = Math.max(0, R.energy - 2);
        $('challengeFlash').textContent = '时间到！正确：' + CH.word.w;
        $('challengeFlash').className = 'flash no';
        $('challengeInput').className = 'no';
        $('submitBtn').disabled = true;
        say(CH.word.w); sfxBad();
        save();
        setTimeout(function () { if (R.energy <= 0) return endRun(false, '能量耗尽'); CH = null; renderMap(); show('map'); }, 2000);
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    if (!CH) return;
    $('challengePrompt').textContent = '陷阱！' + CH.timer + '秒内拼出';
  }

  /* =========================================================
     传送门
     ========================================================= */
  function startPortal() {
    sfxPortal();
    var candidates = [];
    for (var y = 0; y < MAP_SIZE; y++) for (var x = 0; x < MAP_SIZE; x++) {
      if (!R.map[y][x].visited && R.map[y][x].type !== 'goal' && !(x === R.px && y === R.py)) candidates.push({ x: x, y: y });
    }
    if (candidates.length) { var t = candidates[(Math.random() * candidates.length) | 0]; R.px = t.x; R.py = t.y; }
    $('eventIcon').textContent = '🌀'; $('eventTitle').textContent = '传送门！';
    $('eventDesc').textContent = '你被传送到了地图的另一个角落。';
    var choices = $('eventChoices'); choices.innerHTML = '';
    choices.appendChild(btn('继续', '', function () { renderMap(); show('map'); }));
    show('event'); save();
  }

  /* =========================================================
     商店
     ========================================================= */
  function startShop() {
    $('shopGold').textContent = R.gold;
    var list = $('shopList'); list.innerHTML = '';
    Object.keys(ITEMS).forEach(function (k) {
      var item = ITEMS[k];
      var div = el('div', 'shop-item');
      var info = el('div', 'info');
      info.appendChild(el('div', 'name', item.icon + ' ' + item.name));
      info.appendChild(el('div', 'desc', item.desc + '（持有 ' + (R.items[k]||0) + '）'));
      div.appendChild(info);
      div.appendChild(el('div', 'cost', item.cost + ' ✧'));
      var buyBtn = el('button', 'btn primary');
      buyBtn.style.cssText = 'width:auto;padding:8px 16px;margin:0;flex-shrink:0';
      buyBtn.appendChild(el('span', 't', '买'));
      buyBtn.disabled = R.gold < item.cost;
      buyBtn.addEventListener('click', (function (key) { return function () {
        if (R.gold < ITEMS[key].cost) return;
        R.gold -= ITEMS[key].cost; R.items[key] = (R.items[key] || 0) + 1;
        sfxPick(); save(); startShop();
      }; })(k));
      div.appendChild(buyBtn);
      list.appendChild(div);
    });
    var maxDiv = el('div', 'shop-item');
    var maxInfo = el('div', 'info');
    maxInfo.appendChild(el('div', 'name', '⚡ 能量上限 +5'));
    maxInfo.appendChild(el('div', 'desc', '当前 ' + R.maxEnergy));
    maxDiv.appendChild(maxInfo);
    maxDiv.appendChild(el('div', 'cost', '30 ✧'));
    var maxBtn = el('button', 'btn primary');
    maxBtn.style.cssText = 'width:auto;padding:8px 16px;margin:0;flex-shrink:0';
    maxBtn.appendChild(el('span', 't', '买'));
    maxBtn.disabled = R.gold < 30;
    maxBtn.addEventListener('click', function () { if (R.gold < 30) return; R.gold -= 30; R.maxEnergy += 5; R.energy += 5; sfxPick(); save(); startShop(); });
    maxDiv.appendChild(maxBtn);
    list.appendChild(maxDiv);
    show('shop');
  }

  /* =========================================================
     事件（15 种）
     ========================================================= */
  var EVENTS = [
    { icon:'🎒', title:'遗落的背包', desc:'地上有一个落满灰尘的背包。', choices:[
      { t:'打开', fn:function(){R.gold+=10;return '找到了 10 ✧';} },
      { t:'不碰', fn:function(){return '继续前进';} }
    ]},
    { icon:'⛲', title:'生命之泉', desc:'清澈的泉水从石缝中涌出。', choices:[
      { t:'喝', fn:function(){R.energy=Math.min(R.maxEnergy,R.energy+5);return '恢复 5 能量';} },
      { t:'装瓶', fn:function(){R.gold+=8;return '获得 8 ✧';} }
    ]},
    { icon:'📜', title:'古老卷轴', desc:'卷轴上写满了文字。', choices:[
      { t:'研读', fn:function(){
        var pool=WORDS.filter(function(w){return !Prog.seen[w.w];});
        if(!pool.length) return '没有新词可学';
        var w=pool[(Math.random()*pool.length)|0];
        Prog.learned[w.w]=1;Prog.seen[w.w]=1;Prog.prof[w.w]=1;
        Prog.stats.newLearned++;R.stats.newThisRun++;
        return '学会了 '+w.w;
      }},
      { t:'卖掉', fn:function(){R.gold+=12;return '获得 12 ✧';} }
    ]},
    { icon:'🎰', title:'命运转盘', desc:'一个闪闪发光的转盘。', choices:[
      { t:'转动', fn:function(){
        if(Math.random()<0.5){R.gold+=15;return '运气不错！+15 ✧';}
        else{R.energy=Math.max(0,R.energy-3);return '运气不好 -3 能量';}
      }},
      { t:'离开', fn:function(){return '不冒险';} }
    ]},
    { icon:'🔥', title:'废弃营地', desc:'有人在这里生过火。', choices:[
      { t:'休息', fn:function(){R.energy=Math.min(R.maxEnergy,R.energy+4);return '恢复 4 能量';} },
      { t:'搜索', fn:function(){R.gold+=8;return '找到 8 ✧';} }
    ]},
    { icon:'🧭', title:'指南针', desc:'一个古老的指南针在发光。', choices:[
      { t:'拿起', fn:function(){R.energy=Math.min(R.maxEnergy,R.energy+6);return '+6 能量';} },
      { t:'留下', fn:function(){return '继续';} }
    ]},
    { icon:'📚', title:'魔法书', desc:'一本书在空中翻动。', choices:[
      { t:'阅读', fn:function(){
        var pool=[];for(var k in Prog.prof)if(Prog.prof[k]<3)pool.push(k);
        if(!pool.length) return '没有需要复习的词';
        pool.slice(0,2).forEach(function(w){Prog.prof[w]=Math.min(4,profOf(w)+1);});
        return '2 个词熟练度 +1';
      }},
      { t:'离开', fn:function(){return '继续';} }
    ]},
    { icon:'🎁', title:'神秘礼物', desc:'一个包装精美的盒子。', choices:[
      { t:'打开', fn:function(){
        var r=Math.random();
        if(r<0.3){R.items.potion++;return '获得 🧪 能量药水';}
        if(r<0.6){R.items.hint++;return '获得 📜 提示卷轴';}
        if(r<0.8){R.items.skip++;return '获得 🎫 跳过券';}
        R.items.shield++;return '获得 🛡️ 护盾';
      }},
      { t:'不碰', fn:function(){return '继续';} }
    ]},
    { icon:'🗡️', title:'流浪剑客', desc:'一个剑客在路边磨剑。', choices:[
      { t:'切磋', fn:function(){
        if(Math.random()<0.5){R.gold+=20;return '你赢了！+20 ✧';}
        else{R.energy=Math.max(0,R.energy-5);return '你输了 -5 能量';}
      }},
      { t:'路过', fn:function(){return '继续';} }
    ]},
    { icon:'🧙', title:'老法师', desc:'一个老法师在研究魔法。', choices:[
      { t:'请教', fn:function(){
        var pool=WORDS.filter(function(w){return Prog.seen[w.w]&&profOf(w.w)<3;});
        if(!pool.length) return '你已经很厉害了';
        var w=pool[(Math.random()*pool.length)|0];
        Prog.prof[w.w]=Math.min(4,profOf(w.w)+2);
        return w.w+' 熟练度 +2';
      }},
      { t:'离开', fn:function(){return '继续';} }
    ]},
    { icon:'💰', title:'税收官', desc:'一个税收官要收过路费。', choices:[
      { t:'交税', fn:function(){var c=Math.min(R.gold,10);R.gold-=c;return '交了 '+c+' ✧';} },
      { t:'逃跑', fn:function(){
        if(Math.random()<0.6) return '成功逃脱！';
        R.energy=Math.max(0,R.energy-3);return '被抓到 -3 能量';
      }}
    ]},
    { icon:'🏕️', title:'露营地', desc:'一群旅人在露营。', choices:[
      { t:'加入', fn:function(){R.energy=Math.min(R.maxEnergy,R.energy+3);R.gold+=5;return '+3 能量 +5 ✧';} },
      { t:'路过', fn:function(){return '继续';} }
    ]},
    { icon:'🔮', title:'水晶球', desc:'一个发光的水晶球。', choices:[
      { t:'触摸', fn:function(){R.shieldActive=true;return '获得护盾效果';} },
      { t:'离开', fn:function(){return '继续';} }
    ]},
    { icon:'📦', title:'补给箱', desc:'一个标记着补给的箱子。', choices:[
      { t:'打开', fn:function(){R.items.potion++;R.items.hint++;return '获得 🧪 和 📜';} },
      { t:'不碰', fn:function(){return '继续';} }
    ]},
    { icon:'🎪', title:'马戏团', desc:'一个小型马戏团在表演。', choices:[
      { t:'看表演', fn:function(){R.energy=Math.min(R.maxEnergy,R.energy+2);return '心情愉快 +2 能量';} },
      { t:'帮忙', fn:function(){R.gold+=15;return '获得 15 ✧';} }
    ]}
  ];

  function startEvent() {
    R.stats.events++;
    var e = EVENTS[(Math.random() * EVENTS.length) | 0];
    $('eventIcon').textContent = e.icon; $('eventTitle').textContent = e.title; $('eventDesc').textContent = e.desc;
    var choices = $('eventChoices'); choices.innerHTML = '';
    e.choices.forEach(function (c) {
      choices.appendChild(btn(c.t, '', function () {
        $('eventDesc').textContent = c.fn();
        $('eventChoices').innerHTML = '';
        $('eventChoices').appendChild(btn('继续', '', function () {
          if (R.energy <= 0) return endRun(false, '能量耗尽');
          renderMap(); show('map');
        }));
        sfxPick(); save();
      }));
    });
    show('event');
  }

  /* =========================================================
     宝藏 / 休息
     ========================================================= */
  function startTreasure() {
    var gold = 5 + (Math.random() * 12) | 0;
    R.gold += gold; sfxPick();
    var bonus = '';
    if (Math.random() < 0.3) {
      var keys = Object.keys(ITEMS);
      var k = keys[(Math.random() * keys.length) | 0];
      R.items[k] = (R.items[k] || 0) + 1;
      bonus = ' + ' + ITEMS[k].icon;
    }
    $('eventIcon').textContent = '💎'; $('eventTitle').textContent = '宝藏！';
    $('eventDesc').textContent = '你发现了 ' + gold + ' ✧' + bonus;
    var choices = $('eventChoices'); choices.innerHTML = '';
    choices.appendChild(btn('继续', '', function () { renderMap(); show('map'); }));
    show('event'); save();
  }

  function startRest() {
    $('eventIcon').textContent = '🔥'; $('eventTitle').textContent = '篝火';
    $('eventDesc').textContent = '温暖的篝火，歇一会儿。';
    var choices = $('eventChoices'); choices.innerHTML = '';
    choices.appendChild(btn('休息', '恢复 6 能量', function () {
      R.energy = Math.min(R.maxEnergy, R.energy + 6); sfxPick(); save(); renderMap(); show('map');
    }));
    choices.appendChild(btn('复习', '2 个词熟练度 +1', function () {
      var pool = []; for (var k in Prog.prof) if (Prog.prof[k] < 3) pool.push(k);
      if (!pool.length) { $('eventDesc').textContent = '没有需要复习的词！'; $('eventChoices').innerHTML = '';
        $('eventChoices').appendChild(btn('继续','',function(){renderMap();show('map');})); return; }
      for (var i=pool.length-1;i>0;i--){var j=(Math.random()*(i+1))|0;var t=pool[i];pool[i]=pool[j];pool[j]=t;}
      pool.slice(0,2).forEach(function(w){Prog.prof[w]=Math.min(4,profOf(w)+1);});
      sfxPick(); save(); renderMap(); show('map');
    }));
    if (R.items.potion > 0) {
      choices.appendChild(btn('用药水', '恢复 8 能量', function () {
        R.items.potion--; R.energy = Math.min(R.maxEnergy, R.energy + 8); sfxPick(); save(); renderMap(); show('map');
      }));
    }
    show('event');
  }

  /* =========================================================
     结算
     ========================================================= */
  function endRun(cleared, reason) {
    if (R) { R.over = true; Prog.stats.bestFloor = Math.max(Prog.stats.bestFloor, R.floor); }
    save();
    if (!cleared) sfxLose(); else sfxWin();
    $('overTitle').textContent = cleared ? '通关！' : '探索结束';
    $('overSub').textContent = cleared ? '你穿越了所有大陆' : (reason || '倒在了大陆 ' + (R.floor+1));
    var stats = $('overStats'); stats.innerHTML = '';
    stats.appendChild(makeStat(R.stats.steps, '步数'));
    stats.appendChild(makeStat(R.stats.correct, '答对'));
    stats.appendChild(makeStat(R.stats.bosses || 0, 'Boss'));
    stats.appendChild(makeStat(R.stats.ghostsKilled || 0, '幽灵'));
    stats.appendChild(makeStat(R.stats.newThisRun || 0, '新学'));
    stats.appendChild(makeStat(R.gold, '金币'));
    stats.appendChild(makeStat(knownCount(), '总掌握'));
    var btns = $('overBtns'); btns.innerHTML = '';
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
     启动
     ========================================================= */
  load(); renderTitle();
  $('submitBtn').addEventListener('click', submitChallenge);
  $('skipBtn').addEventListener('click', skipChallenge);
  $('learnOkBtn').addEventListener('click', finishLearn);
  $('learnListenBtn').addEventListener('click', function () { if (learnState) say(learnState.word.w); });
  $('shopLeaveBtn').addEventListener('click', function () { renderMap(); show('map'); });
  $('challengeInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitChallenge(); } });

})();
