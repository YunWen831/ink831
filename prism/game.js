/* 棱 PRISM · 玩法、输入、存档、界面与自测
 * 普通 <script>，不用 ES module；file:// 直接打开也能跑。
 */
(function () {
  'use strict';

  var PARAMS = new URLSearchParams(location.search);
  var PROBE = PARAMS.get('probe');
  var DEMO = PARAMS.get('demo') || '';
  var FIXED = 1 / 60;
  var MAX_SPEED = 3.3;
  var BOUND_X = 1.65;
  var BOUND_Y = 1.00;
  var PICK_R = 0.34;
  var SYMBOLS = ['○', '▲', '■', '◆', '▲■', '▲◆', '■◆', '▲■◆'];
  var MASK_GLYPH = { 0: 0, 1: 1, 2: 2, 4: 3, 3: 4, 5: 5, 6: 6, 7: 7 };
  var CHANNELS = [1, 2, 4];
  var SAVE_KEY = 'prism-save-v1';

  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  var renderer = null;
  var audio = new window.PrismAudio();
  var app = {
    screen: 'title',
    chapterIndex: 0,
    run: null,
    save: null,
    acc: 0,
    last: 0,
    attract: null,
    probe: !!PROBE,
    demo: DEMO,
    frameAvg: 16,
    scaleCooldown: 0,
    lastInput: { ax: 0, ay: 0, vent: false },
    keys: {},
    pointer: { active: false, id: null, ox: 0, oy: 0, ax: 0, ay: 0 },
    ventHeld: false,
    hudCache: {},
    liveAt: 0
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function maskOf(stack) {
    var m = 0;
    for (var i = 0; i < stack.length; i++) m |= stack[i];
    return m;
  }
  function glyphOf(mask) { return MASK_GLYPH[mask] === undefined ? 0 : MASK_GLYPH[mask]; }
  function maskInfo(mask) { return window.PRISM_MASKS[mask] || window.PRISM_MASKS[0]; }
  function symbolOf(mask) { return SYMBOLS[glyphOf(mask)] || '○'; }
  function formatScore(n) { return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function formatTime(n) { return n.toFixed(1) + 's'; }

  // ---------------------------------------------------------------------------
  // 存档
  // ---------------------------------------------------------------------------
  function defaultSave() {
    return {
      v: 1,
      unlocked: 1,
      best: {},
      endlessBest: 0,
      endlessUnlocked: false,
      settings: { quality: 'auto', muted: false, motion: true, volume: 0.7 }
    };
  }

  function loadSave() {
    var s = defaultSave();
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.v === 1) {
          s.unlocked = clamp(parseInt(d.unlocked, 10) || 1, 1, 5);
          s.best = d.best && typeof d.best === 'object' ? d.best : {};
          s.endlessBest = Math.max(0, parseInt(d.endlessBest, 10) || 0);
          s.endlessUnlocked = !!d.endlessUnlocked;
          if (d.settings) {
            s.settings.quality = ['auto', 'high', 'low'].indexOf(d.settings.quality) >= 0 ? d.settings.quality : 'auto';
            s.settings.muted = !!d.settings.muted;
            s.settings.motion = d.settings.motion !== false;
            s.settings.volume = clamp(Number(d.settings.volume) || 0.7, 0, 1);
          }
        }
      }
    } catch (e) {}
    return s;
  }

  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(app.save)); } catch (e) {}
  }

  function applySettings() {
    var s = app.save.settings;
    if (renderer) renderer.setQuality(s.quality);
    audio.setVolume(s.volume);
    audio.setMuted(s.muted);
    document.body.classList.toggle('reduce-motion', !s.motion);
    var q = $('quality-auto'), qh = $('quality-high'), ql = $('quality-low');
    if (q) q.setAttribute('aria-pressed', s.quality === 'auto' ? 'true' : 'false');
    if (qh) qh.setAttribute('aria-pressed', s.quality === 'high' ? 'true' : 'false');
    if (ql) ql.setAttribute('aria-pressed', s.quality === 'low' ? 'true' : 'false');
    var mo = $('btn-motion');
    if (mo) {
      mo.setAttribute('aria-pressed', s.motion ? 'true' : 'false');
      mo.textContent = s.motion ? '开' : '关';
    }
    var so = $('btn-sound');
    if (so) {
      so.setAttribute('aria-pressed', s.muted ? 'false' : 'true');
      so.textContent = s.muted ? '已静音' : '开启';
    }
    var vol = $('volume');
    if (vol) vol.value = String(Math.round(s.volume * 100));
    var mu = $('btn-mute');
    if (mu) mu.textContent = s.muted ? '静音' : '声音';
  }

  // ---------------------------------------------------------------------------
  // 章节准备
  // ---------------------------------------------------------------------------
  function prepareChapter(raw) {
    var ch = {
      id: raw.id, index: raw.index, name: raw.name, line: raw.line || '',
      hint: raw.hint || '', speed: raw.speed, par: raw.par, key: raw.key,
      tempo: raw.tempo, length: raw.length,
      gates: [], motes: []
    };
    for (var i = 0; i < raw.gates.length; i++) {
      var g = raw.gates[i];
      var info = maskInfo(g.mask);
      ch.gates.push({
        d: g.d, mask: g.mask, x: g.x, y: g.y, r: g.r,
        driftX: g.driftX || 0, freq: g.freq || 0.8, phase: g.phase || 0,
        color: info.color, glyph: glyphOf(g.mask), symbol: symbolOf(g.mask), name: info.name
      });
    }
    for (var j = 0; j < raw.motes.length; j++) {
      var m = raw.motes[j];
      var mi = maskInfo(m.ch);
      ch.motes.push({
        d: m.d, ch: m.ch, x: m.x, y: m.y,
        color: mi.color, taken: false, alpha: 1
      });
    }
    ch.gates.sort(function (a, b) { return a.d - b.d; });
    ch.motes.sort(function (a, b) { return a.d - b.d; });
    return ch;
  }

  function gateX(gate, travel) {
    if (!gate.driftX) return gate.x;
    return gate.x + gate.driftX * Math.sin((travel - gate.d) * gate.freq + gate.phase);
  }
  function gateCrossX(gate) {
    return gate.x + (gate.driftX ? gate.driftX * Math.sin(gate.phase) : 0);
  }

  function makeEndless(seed) {
    var gen = window.PrismLevels.generateEndless(seed || 831, 160, 260, 17);
    var raw = {
      id: 'endless', index: 0, name: '无尽棱廊',
      line: '走廊没有尽头，只有下一扇门。',
      hint: '速度会慢慢变快。三枚棱片用完为止。',
      speed: 17, par: 0, key: 50, tempo: 100,
      length: gen.length, gates: gen.gates, motes: gen.motes
    };
    var ch = prepareChapter(raw);
    ch.endless = true;
    ch.seed = seed || 831;
    return ch;
  }

  function createRun(chapter, mode, silent) {
    var run = {
      chapter: chapter, mode: mode || 'campaign', silent: !!silent,
      time: 0, travel: 0, speed: chapter.speed, baseSpeed: chapter.speed,
      player: { x: 0, y: 0, vx: 0, vy: 0 },
      prev: { x: 0, y: 0, travel: 0, camX: 0, camY: 0 },
      camX: 0, camY: 0,
      stack: [], rgb: [0, 0, 0],
      combo: 0, maxCombo: 0, score: 0, facets: 3,
      perfect: 0, passed: 0, missed: 0, crashes: 0,
      gateIndex: 0, moteIndex: 0,
      finishAt: 0,
      phase: 'play', endTimer: 0, screenShown: false,
      impact: 0, flash: 0, perfectPulse: 0, ventPulse: 0,
      ventTimer: 0, ventHeld: false, lastMask: 0,
      slowUntil: -1,
      particles: [], trail: [], trailTimer: 0,
      lastVentSound: -1,
      gateFlash: 0
    };
    if (chapter.gates.length) run.finishAt = chapter.gates[chapter.gates.length - 1].d + 58;
    else run.finishAt = 300;
    if (chapter.endless) run.finishAt = Infinity;
    return run;
  }

  // ---------------------------------------------------------------------------
  // 颜色 / 粒子
  // ---------------------------------------------------------------------------
  function colorForMask(mask) { return maskInfo(mask).color; }

  function spawnBurst(run, x, y, d, color, count, power, kind) {
    if (run.silent) return;
    for (var i = 0; i < count; i++) {
      if (run.particles.length > 140) break;
      var a = Math.random() * Math.PI * 2;
      var sp = (0.4 + Math.random() * 1.6) * power;
      run.particles.push({
        x: x, y: y, d: d,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vd: (Math.random() * 1.4 - 0.4) * power,
        life: 0.35 + Math.random() * 0.55,
        maxLife: 0.9,
        size: 0.08 + Math.random() * 0.20,
        color: color,
        kind: kind === undefined ? 4 : kind,
        phase: Math.random() * 6.28,
        alpha: 1
      });
    }
  }

  function updateParticles(run, dt) {
    var out = [];
    for (var i = 0; i < run.particles.length; i++) {
      var p = run.particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.d += p.vd * dt;
      p.alpha = clamp(p.life / p.maxLife, 0, 1);
      out.push(p);
    }
    run.particles = out;
  }

  // ---------------------------------------------------------------------------
  // 一帧逻辑
  // ---------------------------------------------------------------------------
  function updateRun(run, dt, inp) {
    run.prev.x = run.player.x;
    run.prev.y = run.player.y;
    run.prev.travel = run.travel;
    run.prev.camX = run.camX;
    run.prev.camY = run.camY;

    if (run.phase === 'complete' || run.phase === 'dead' || run.phase === 'dying') {
      updateParticles(run, dt);
      run.impact = Math.max(0, run.impact - dt * 2.6);
      run.flash = Math.max(0, run.flash - dt * 3.0);
      run.perfectPulse = Math.max(0, run.perfectPulse - dt * 2.4);
      run.camX += (run.player.x - run.camX) * Math.min(1, dt * 5);
      run.camY += (run.player.y - run.camY) * Math.min(1, dt * 5);
      if (run.phase === 'dying') {
        run.endTimer -= dt;
        if (run.endTimer <= 0) { run.phase = 'dead'; run.endTimer = 0.7; }
      } else {
        run.endTimer -= dt;
        if (run.endTimer <= 0 && !run.screenShown) {
          run.screenShown = true;
          if (!run.silent) finishScreen(run);
        }
      }
      return;
    }

    run.time += dt;
    if (run.mode === 'endless') {
      run.baseSpeed = 17 + Math.min(4.5, run.time / 50);
      run.speed += (run.baseSpeed - run.speed) * Math.min(1, dt * 0.8);
    }
    var speed = run.speed;
    if (run.slowUntil > run.time) speed *= 0.82;
    run.travel += speed * dt;

    // 输入 → 光球
    var ax = clamp(inp.ax || 0, -1, 1);
    var ay = clamp(inp.ay || 0, -1, 1);
    var len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; }
    var p = run.player;
    p.vx += (ax * MAX_SPEED - p.vx) * Math.min(1, dt * 11);
    p.vy += (ay * MAX_SPEED - p.vy) * Math.min(1, dt * 11);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -BOUND_X) { p.x = -BOUND_X; p.vx = 0; }
    if (p.x > BOUND_X) { p.x = BOUND_X; p.vx = 0; }
    if (p.y < -BOUND_Y) { p.y = -BOUND_Y; p.vy = 0; }
    if (p.y > BOUND_Y) { p.y = BOUND_Y; p.vy = 0; }

    // 吐息：LIFO 丢掉最后吃下的颜色
    var vent = !!inp.vent;
    if (vent) {
      if (!run.ventHeld) run.ventTimer = 0.24;
      run.ventHeld = true;
      run.ventTimer += dt;
      while (run.ventTimer >= 0.24 && run.stack.length) {
        var ch = run.stack.pop();
        run.ventTimer -= 0.24;
        run.ventPulse = 1;
        var ci = ch === 1 ? 0 : ch === 2 ? 1 : 2;
        run.rgb[ci] = Math.min(run.rgb[ci], 0.999);
        if (!run.silent) {
          spawnBurst(run, p.x, p.y, run.travel - 0.2, maskInfo(ch).color, 4, 0.42, 4);
          if (run.time - run.lastVentSound > 0.14) {
            audio.vent();
            run.lastVentSound = run.time;
          }
        }
      }
    } else {
      run.ventHeld = false;
      run.ventTimer = 0;
    }

    // 颜色视觉平滑
    var mask = maskOf(run.stack);
    if (!run.silent && mask !== run.lastMask) {
      run.lastMask = mask;
      audio.setColor(mask);
    }
    for (var c = 0; c < 3; c++) {
      var target = (mask & CHANNELS[c]) ? 1 : 0;
      run.rgb[c] += (target - run.rgb[c]) * Math.min(1, dt * 11);
    }

    // 色粒
    while (run.moteIndex < run.chapter.motes.length && run.chapter.motes[run.moteIndex].d <= run.travel) {
      var mote = run.chapter.motes[run.moteIndex];
      var denom = run.travel - run.prev.travel;
      var a = denom > 0.00001 ? (mote.d - run.prev.travel) / denom : 1;
      a = clamp(a, 0, 1);
      var mx = lerp(run.prev.x, p.x, a);
      var my = lerp(run.prev.y, p.y, a);
      if (!mote.taken && Math.hypot(mx - mote.x, my - mote.y) <= PICK_R) {
        mote.taken = true;
        if (run.stack.indexOf(mote.ch) < 0) {
          run.stack.push(mote.ch);
          run.score += 10;
          if (!run.silent) {
            audio.pickup(mote.ch);
            spawnBurst(run, mote.x, mote.y, mote.d, mote.color, 7, 0.8, 4);
            announce('吃到' + maskInfo(mote.ch).name);
          }
        } else {
          run.score += 5;
          if (!run.silent) audio.pickup(mote.ch);
        }
      }
      run.moteIndex++;
    }

    // 门
    while (run.gateIndex < run.chapter.gates.length && run.chapter.gates[run.gateIndex].d <= run.travel) {
      var gate = run.chapter.gates[run.gateIndex];
      var den = run.travel - run.prev.travel;
      var t = den > 0.00001 ? (gate.d - run.prev.travel) / den : 1;
      t = clamp(t, 0, 1);
      var px = lerp(run.prev.x, p.x, t);
      var py = lerp(run.prev.y, p.y, t);
      var gx = gateCrossX(gate);
      var dist = Math.hypot(px - gx, py - gate.y);
      var held = maskOf(run.stack);
      // 穿门
      if (dist <= gate.r) {
        if ((held & gate.mask) === gate.mask) {
          var perfect = held === gate.mask;
          run.stack = run.stack.filter(function (ch) { return !(gate.mask & ch); });
          run.combo++;
          run.maxCombo = Math.max(run.maxCombo, run.combo);
          var mult = Math.min(5, 1 + run.combo * 0.25);
          var center = (1 - dist / Math.max(0.001, gate.r)) * 40;
          run.score += 100 * mult + (perfect ? 60 : 0) + center;
          run.passed++;
          if (perfect) run.perfect++;
          run.perfectPulse = perfect ? 1 : 0.55;
          run.flash = Math.max(run.flash, perfect ? 0.28 : 0.10);
          if (!run.silent) {
            audio.gate(run.combo, perfect);
            spawnBurst(run, gx, gate.y, gate.d, gate.color, perfect ? 18 : 10, 1.1, 4);
            announce((perfect ? '完美穿门 · ' : '穿门 · ') + gate.name);
          }
        } else {
          crashGate(run, gate, gx, px, py);
        }
      } else if (dist <= gate.r + 0.17) {
        crashGate(run, gate, gx, px, py);
      } else {
        run.combo = 0;
        run.missed++;
        if (!run.silent) {
          audio.miss();
          announce('绕过 · ' + gate.name);
        }
      }
      run.gateIndex++;
      if (run.phase !== 'play') break;
    }

    // 相机滞后
    run.camX += (p.x - run.camX) * Math.min(1, dt * 5.4);
    run.camY += (p.y - run.camY) * Math.min(1, dt * 5.4);

    // 拖尾
    run.trailTimer += dt;
    if (run.trailTimer >= 0.035) {
      run.trailTimer = 0;
      run.trail.unshift({ x: p.x, y: p.y, d: run.travel });
      if (run.trail.length > 11) run.trail.pop();
    }

    updateParticles(run, dt);
    run.impact = Math.max(0, run.impact - dt * 2.6);
    run.flash = Math.max(0, run.flash - dt * 3.0);
    run.perfectPulse = Math.max(0, run.perfectPulse - dt * 2.4);
    run.ventPulse = Math.max(0, run.ventPulse - dt * 4.5);
    run.gateFlash = Math.max(0, run.gateFlash - dt * 3.5);

    // 终点
    if (run.phase === 'play' && run.travel >= run.finishAt) {
      run.phase = 'complete';
      run.endTimer = 0.9;
      run.score += 300 + run.facets * 150;
      if (!run.silent) {
        audio.complete();
        announce('章节完成');
        completeRun(run);
      } else {
        completeRun(run);
      }
    }

    // 无尽：补门
    if (run.mode === 'endless' && run.chapter.gates.length &&
        run.travel > run.chapter.gates[run.chapter.gates.length - 1].d - 280) {
      var lastD = run.chapter.gates[run.chapter.gates.length - 1].d;
      var more = window.PrismLevels.generateEndless(run.chapter.seed + Math.floor(run.travel), lastD + 46, 80, run.speed);
      for (var gi = 0; gi < more.gates.length; gi++) {
        var g = more.gates[gi];
        var inf = maskInfo(g.mask);
        run.chapter.gates.push({
          d: g.d, mask: g.mask, x: g.x, y: g.y, r: g.r,
          driftX: g.driftX || 0, freq: g.freq || 0.8, phase: g.phase || 0,
          color: inf.color, glyph: glyphOf(g.mask), symbol: symbolOf(g.mask), name: inf.name
        });
      }
      for (var mi = 0; mi < more.motes.length; mi++) {
        var mo = more.motes[mi];
        run.chapter.motes.push({
          d: mo.d, ch: mo.ch, x: mo.x, y: mo.y,
          color: maskInfo(mo.ch).color, taken: false, alpha: 1
        });
      }
      run.chapter.gates.sort(function (a, b) { return a.d - b.d; });
      run.chapter.motes.sort(function (a, b) { return a.d - b.d; });
      run.chapter.length = run.chapter.gates[run.chapter.gates.length - 1].d + 90;
    }
  }

  function crashGate(run, gate, gx, px, py) {
    run.facets--;
    run.crashes++;
    run.combo = 0;
    run.score = Math.max(0, run.score - 75);
    run.impact = 1;
    run.flash = 0.35;
    run.slowUntil = run.time + 0.65;
    if (!run.silent) {
      audio.crash();
      spawnBurst(run, gx, gate.y, gate.d, gate.color, 22, 1.5, 4);
      spawnBurst(run, px, py, run.travel, [1.0, 0.96, 0.9], 12, 1.2, 4);
      announce('撞碎 · 失去一枚棱片');
    }
    if (run.facets <= 0) {
      run.phase = 'dying';
      run.endTimer = 0.9;
      if (!run.silent) {
        run.screenShown = false;
        saveRunBest(run, false);
      }
    }
  }

  function completeRun(run) {
    if (run.silent) return;
    saveRunBest(run, true);
    if (run.chapter.endless) {
      app.save.endlessBest = Math.max(app.save.endlessBest, Math.round(run.score));
    } else {
      var next = run.chapter.index + 1;
      if (next > app.save.unlocked) app.save.unlocked = Math.min(5, next);
      if (run.chapter.index >= 5) app.save.endlessUnlocked = true;
      if (run.chapter.index >= 5 && run.passed === run.chapter.gates.length) app.save.endlessUnlocked = true;
      // 五章全通后解锁无尽
      var all = true;
      for (var i = 0; i < window.PRISM_LEVELS.length; i++) {
        if (!app.save.best[window.PRISM_LEVELS[i].id]) all = false;
      }
      if (all) app.save.endlessUnlocked = true;
    }
    writeSave();
  }

  function saveRunBest(run, won) {
    if (run.chapter.endless) {
      app.save.endlessBest = Math.max(app.save.endlessBest, Math.round(run.score));
    } else {
      var id = run.chapter.id;
      var prev = app.save.best[id];
      var rec = {
        score: Math.round(run.score),
        time: Math.round(run.time * 10) / 10,
        passed: run.passed,
        perfect: run.perfect,
        maxCombo: run.maxCombo,
        facets: run.facets,
        won: !!won
      };
      if (!prev || rec.score > prev.score) app.save.best[id] = rec;
    }
    writeSave();
  }

  // ---------------------------------------------------------------------------
  // 自动驾驶员（自测 + 截图）
  // ---------------------------------------------------------------------------
  function autoInput(run, auto) {
    if (run.gateIndex >= run.chapter.gates.length) return { ax: 0, ay: 0, vent: false };
    var g = run.chapter.gates[run.gateIndex];
    if (auto.gate !== run.gateIndex) {
      auto.gate = run.gateIndex;
      var have = maskOf(run.stack);
      var missing = g.mask & ~have;
      var prevD = run.gateIndex > 0 ? run.chapter.gates[run.gateIndex - 1].d : 0;
      var targets = [];
      for (var k = 0; k < CHANNELS.length; k++) {
        var ch = CHANNELS[k];
        if (!(missing & ch)) continue;
        var best = null;
        for (var i = 0; i < run.chapter.motes.length; i++) {
          var m = run.chapter.motes[i];
          if (m.d <= prevD || m.d >= g.d || m.taken || m.ch !== ch) continue;
          if (!best || m.d > best.d) best = m;
        }
        if (best) targets.push(best);
      }
      targets.sort(function (a, b) { return a.d - b.d; });
      auto.targets = targets;
    }
    while (auto.targets.length && auto.targets[0].d <= run.travel + 0.2) auto.targets.shift();
    var target = auto.targets[0];
    var tx, ty;
    if (target) {
      tx = target.x; ty = target.y;
    } else {
      tx = gateCrossX(g); ty = g.y;
    }
    var dx = tx - run.player.x;
    var dy = ty - run.player.y;
    return { ax: clamp(dx * 2.6, -1, 1), ay: clamp(dy * 2.6, -1, 1), vent: false };
  }

  function simulateChapter(index) {
    var run = createRun(prepareChapter(window.PRISM_LEVELS[index]), 'campaign', true);
    var auto = { gate: -1, targets: [] };
    var maxSteps = Math.ceil((run.finishAt / run.speed + 25) / FIXED);
    var steps = 0;
    while (steps < maxSteps && run.phase === 'play') {
      updateRun(run, FIXED, autoInput(run, auto));
      steps++;
    }
    return {
      win: run.phase === 'complete',
      passed: run.passed,
      total: run.chapter.gates.length,
      perfect: run.perfect,
      facets: run.facets,
      time: run.time,
      score: Math.round(run.score)
    };
  }

  // ---------------------------------------------------------------------------
  // 自测 probe
  // ---------------------------------------------------------------------------
  function probeWrite(line) {
    var p = $('probe');
    if (p) p.textContent += line + '\n';
  }

  function lintAll() {
    var ok = true, lines = [];
    for (var i = 0; i < window.PRISM_LEVELS.length; i++) {
      var ch = prepareChapter(window.PRISM_LEVELS[i]);
      var issues = [];
      if (!ch.gates.length) issues.push('no gates');
      var prev = null;
      for (var g = 0; g < ch.gates.length; g++) {
        var gate = ch.gates[g];
        if (prev && gate.d <= prev.d) issues.push('gate order');
        if (![1, 2, 3, 4, 5, 6, 7].some(function (m) { return m === gate.mask; })) issues.push('bad mask');
        if (Math.abs(gate.x) + gate.r > 2.45 || Math.abs(gate.y) + gate.r > 1.62) issues.push('gate out of bounds ' + gate.d);
        if (gate.r < 0.55 || gate.r > 1.02) issues.push('gate radius ' + gate.r);
        var prevD = prev ? prev.d : 0;
        var windowMotes = [];
        for (var m = 0; m < ch.motes.length; m++) {
          var mo = ch.motes[m];
          if (mo.d > prevD && mo.d < gate.d) windowMotes.push(mo);
        }
        var union = 0;
        for (var u = 0; u < windowMotes.length; u++) union |= windowMotes[u].ch;
        if ((union & gate.mask) !== gate.mask) issues.push('unreachable mask ' + gate.mask + ' at ' + gate.d);
        var chosen = [];
        for (var c = 0; c < CHANNELS.length; c++) {
          var chn = CHANNELS[c];
          if (!(gate.mask & chn)) continue;
          var best = null;
          for (var w = 0; w < windowMotes.length; w++) {
            if (windowMotes[w].ch === chn && (!best || windowMotes[w].d > best.d)) best = windowMotes[w];
          }
          if (best) chosen.push(best);
        }
        chosen.sort(function (a, b) { return a.d - b.d; });
        var pos = prev ? { x: gateCrossX(prev), y: prev.y } : { x: 0, y: 0 };
        var lastD = prevD;
        for (var q = 0; q < chosen.length; q++) {
          var need = Math.hypot(chosen[q].x - pos.x, chosen[q].y - pos.y) / MAX_SPEED;
          var have = (chosen[q].d - lastD) / ch.speed;
          if (need > have - 0.06) issues.push('mote too late ' + chosen[q].d);
          pos = { x: chosen[q].x, y: chosen[q].y };
          lastD = chosen[q].d;
        }
        var needG = Math.hypot(gateCrossX(gate) - pos.x, gate.y - pos.y) / MAX_SPEED;
        var haveG = (gate.d - lastD) / ch.speed;
        if (needG > haveG - 0.08) issues.push('gate too soon ' + gate.d);
        prev = gate;
      }
      for (var b = 0; b < ch.motes.length; b++) {
        if (Math.abs(ch.motes[b].x) > 1.72 || Math.abs(ch.motes[b].y) > 1.08) issues.push('mote out of bounds ' + ch.motes[b].d);
      }
      var sim = simulateChapter(i);
      if (!sim.win || sim.passed !== sim.total) issues.push('autopilot ' + sim.passed + '/' + sim.total);
      if (issues.length) {
        ok = false;
        probeWrite('LEVEL ' + (i + 1) + ' ' + ch.id + ' :: ' + issues.join('; '));
      } else {
        probeWrite('LEVEL ' + (i + 1) + ' ' + ch.id + ' OK gates=' + ch.gates.length + ' motes=' + ch.motes.length + ' sim=' + sim.passed + '/' + sim.total + ' t=' + sim.time.toFixed(1));
      }
    }
    return ok;
  }

  function glProbe() {
    if (!renderer || !renderer.ok) {
      probeWrite('GL FAIL ' + (renderer ? renderer.error : 'no renderer'));
      return false;
    }
    var demo = makeDemoState();
    var ok = false;
    for (var i = 0; i < 3; i++) {
      if (renderer.render(demo)) ok = true;
    }
    var gl = renderer.gl;
    var px = new Uint8Array(4);
    gl.readPixels(Math.floor(renderer.canvas.width / 2), Math.floor(renderer.canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var center = px[0] + px[1] + px[2];
    gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var corner = px[0] + px[1] + px[2];
    probeWrite('GL OK renderer="' + renderer.info.renderer + '" version="' + renderer.info.version + '" center=' + center + ' corner=' + corner + ' scale=' + renderer.scale.toFixed(2));
    return !!ok && center > 0;
  }

  function perfProbe(frames) {
    if (!renderer || !renderer.ok) { probeWrite('PERF FAIL no webgl'); return; }
    var demo = makeDemoState();
    var gl = renderer.gl;
    var t0 = performance.now();
    for (var i = 0; i < frames; i++) {
      demo.time += 0.016;
      demo.travel += 0.2;
      renderer.render(demo);
    }
    gl.finish();
    var ms = (performance.now() - t0) / frames;
    probeWrite('PERF OK frames=' + frames + ' ms=' + ms.toFixed(2) + ' scale=' + renderer.scale.toFixed(2));
  }

  function shotProbe() {
    var chapter = clamp(parseInt(PARAMS.get('chapter') || '1', 10) || 1, 1, 5) - 1;
    var t = clamp(parseFloat(PARAMS.get('t') || '18') || 18, 0, 90);
    var demo = DEMO;
    if (demo === 'title') {
      showScreen('title');
      updateAttract(1 / 60);
      renderAttract();
      var tf = 0;
      var tt = function () {
        updateAttract(1 / 60);
        renderAttract();
        tf++;
        if (tf < 90) requestAnimationFrame(tt);
        else document.body.dataset.ready = '1';
      };
      requestAnimationFrame(tt);
      probeWrite('SHOT OK title');
      return;
    }
    if (demo === 'chapters' || demo === 'settings' || demo === 'intro' || demo === 'pause') {
      updateAttract(1 / 60);
      renderAttract();
      if (demo === 'chapters') showScreen('chapters');
      else if (demo === 'settings') showScreen('settings');
      else if (demo === 'intro') showIntro(0);
      else {
        var pr = createRun(prepareChapter(window.PRISM_LEVELS[0]), 'campaign', true);
        var pa = { gate: -1, targets: [] };
        for (var pi = 0; pi < Math.ceil(12 / FIXED) && pr.phase === 'play'; pi++) updateRun(pr, FIXED, autoInput(pr, pa));
        app.run = pr;
        app.chapterIndex = 0;
        renderRun(1);
        showScreen('pause');
      }
      document.body.dataset.ready = '1';
      probeWrite('SHOT OK ' + demo);
      return;
    }
    if (demo === 'summary' || demo === 'dead') {
      var r = createRun(prepareChapter(window.PRISM_LEVELS[chapter]), 'campaign', true);
      var auto = { gate: -1, targets: [] };
      var steps = Math.ceil(Math.min(t, r.finishAt / r.speed) / FIXED);
      for (var i = 0; i < steps && r.phase === 'play'; i++) updateRun(r, FIXED, autoInput(r, auto));
      app.run = r;
      app.chapterIndex = chapter;
      renderRun(1);
      if (demo === 'dead') { r.passed = Math.max(1, r.passed); showDead(); }
      else showSummary();
      document.body.dataset.ready = '1';
      probeWrite('SHOT OK ' + demo);
      return;
    }
    var run = createRun(prepareChapter(window.PRISM_LEVELS[chapter]), 'campaign', true);
    var at = { gate: -1, targets: [] };
    var n = Math.ceil(t / FIXED);
    for (var k = 0; k < n && run.phase === 'play'; k++) {
      updateRun(run, FIXED, autoInput(run, at));
      if (demo === 'crash' && k === Math.max(1, n - 3)) run.impact = 1, run.flash = 0.4;
      if (demo === 'gate' && run.gateIndex > 0 && k === n - 1) run.perfectPulse = 1;
    }
    app.run = run;
    app.chapterIndex = chapter;
    document.body.dataset.screen = 'play';
    document.body.classList.add('in-play');
    hideScreens();
    updateHUD(run);
    var rendered = renderRun(1);
    var gl = renderer && renderer.gl;
    if (gl) {
      var px = new Uint8Array(4);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      probeWrite('PIXELS ' + [px[0], px[1], px[2], px[3]].join(',') + ' gl=' + gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight + ' ok=' + renderer.ok);
    }
    var frames = 0;
    var tick = function () {
      renderRun(1);
      frames++;
      if (frames < 90) requestAnimationFrame(tick);
      else document.body.dataset.ready = '1';
    };
    requestAnimationFrame(tick);
    probeWrite('SHOT OK chapter=' + (chapter + 1) + ' t=' + run.time.toFixed(1) + ' gates=' + run.gateIndex);
  }

  function layoutProbe() {
    document.body.classList.add('in-play');
    document.body.dataset.screen = 'play';
    probeWrite('VIEW ' + window.innerWidth + 'x' + window.innerHeight + ' dpr=' + (window.devicePixelRatio || 1));
    var nodes = [
      ['hud', '.hud'], ['top', '.hud-top'], ['center', '.hud-center'],
      ['right', '.hud-block.right'], ['score', '#hud-score'], ['combo', '#hud-combo'],
      ['mute', '#btn-mute'], ['pause', '#btn-pause'],
      ['bottom', '.hud-bottom'], ['color', '.color-readout'], ['facets', '#hud-facets'],
      ['vent', '#btn-vent'], ['nextchip', '.next-chip']
    ];
    for (var i = 0; i < nodes.length; i++) {
      var n = document.querySelector(nodes[i][1]);
      if (!n) { probeWrite(nodes[i][0] + ' MISSING'); continue; }
      var r = n.getBoundingClientRect();
      var cs = getComputedStyle(n);
      probeWrite(nodes[i][0] + ' ' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' +
        Math.round(r.width) + 'x' + Math.round(r.height) + ' display=' + cs.display +
        ' vis=' + cs.visibility + ' op=' + cs.opacity);
    }
  }

  function runProbe(mode) {
    var ok = true;
    if (mode === 'lint' || mode === 'check') ok = lintAll() && ok;
    if (mode === 'sim' || mode === 'check') {
      var all = PARAMS.get('all') === '1' || mode === 'check';
      var one = clamp((parseInt(PARAMS.get('chapter') || '1', 10) || 1) - 1, 0, 4);
      var list = all ? [0, 1, 2, 3, 4] : [one];
      for (var i = 0; i < list.length; i++) {
        var r = simulateChapter(list[i]);
        var line = 'SIM chapter=' + (list[i] + 1) + ' ' + (r.win ? 'OK' : 'FAIL') +
          ' passed=' + r.passed + '/' + r.total + ' perfect=' + r.perfect +
          ' facets=' + r.facets + ' time=' + r.time.toFixed(1) + ' score=' + r.score;
        probeWrite(line);
        if (!r.win || r.passed !== r.total) ok = false;
      }
    }
    if (mode === 'gl' || mode === 'check') ok = glProbe() && ok;
    if (mode === 'perf') perfProbe(clamp(parseInt(PARAMS.get('frames') || '60', 10) || 60, 1, 600));
    if (mode === 'shot') shotProbe();
    if (mode === 'layout') layoutProbe();
    if (mode === 'input') {
      showScreen('title');
      startChapter(0);
      var ir = app.run, sx0 = ir.player.x;
      var cv = el.canvas;
      try {
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 400, bubbles: true }));
        cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 170, clientY: 400, bubbles: true }));
      } catch (e) { probeWrite('INPUT pointer event error ' + e.message); }
      var pi = currentInput();
      for (var ii = 0; ii < 60; ii++) updateRun(ir, FIXED, pi);
      var moved = ir.player.x > sx0 + 0.15;
      ir.stack = [1, 2];
      updateRun(ir, FIXED, { ax: 0, ay: 0, vent: true });
      var vented = ir.stack.length === 1;
      try { cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 170, clientY: 400, bubbles: true })); } catch (e2) {}
      app.keys = { KeyA: true };
      var ki = currentInput();
      app.keys = {};
      var keyok = ki.ax < -0.5;
      probeWrite('INPUT pointer=' + moved + ' vent=' + vented + ' key=' + keyok + ' ax=' + pi.ax.toFixed(2));
      if (!moved || !vented || !keyok) ok = false;
    }
    if (mode === 'audio') {
      var ca = audio.ensure();
      if (ca) {
        audio.start();
        audio.setColor(3);
        audio.pickup(1); audio.pickup(2);
        audio.gate(3, true); audio.miss(); audio.vent(); audio.crash(); audio.complete();
        audio.pause(true); audio.pause(false);
        probeWrite('AUDIO OK state=' + audio.ctx.state + ' rate=' + audio.ctx.sampleRate);
      } else {
        ok = false;
        probeWrite('AUDIO FAIL no AudioContext');
      }
    }
    if (mode === 'ui') {
      var states = [];
      var click = function (id) {
        var n = $(id);
        if (!n) { states.push(id + ':missing'); return; }
        n.click();
        states.push(id + ':' + document.body.dataset.screen);
      };
      click('btn-start');
      click('btn-intro-start');
      click('btn-pause');
      click('btn-resume');
      click('btn-quit');
      click('btn-chapters');
      click('btn-chapters-back');
      click('btn-settings');
      click('btn-settings-back');
      probeWrite('UI ' + states.join(' > '));
      var good = states.join('|') === 'btn-start:intro|btn-intro-start:play|btn-pause:pause|btn-resume:play|btn-quit:title|btn-chapters:chapters|btn-chapters-back:title|btn-settings:settings|btn-settings-back:title';
      if (!good) ok = false;
    }
    if (mode === 'check') {
      // 无尽生成器
      var gen = window.PrismLevels.generateEndless(831, 160, 80, 17);
      var mock = prepareChapter({
        id: 'endless', index: 0, name: '无尽棱廊', speed: 17, par: 0, key: 50, tempo: 100,
        length: gen.length, gates: gen.gates, motes: gen.motes
      });
      var issues = [];
      if (mock.gates.length !== 80) issues.push('gate count');
      var prev = null;
      for (var q = 0; q < mock.gates.length; q++) {
        if (prev && mock.gates[q].d <= prev.d) issues.push('endless order');
        prev = mock.gates[q];
      }
      if (issues.length) { ok = false; probeWrite('GEN FAIL ' + issues.join('; ')); }
      else probeWrite('GEN OK gates=' + mock.gates.length + ' motes=' + mock.motes.length);
    }
    document.title = ok ? 'PROBE OK' : 'PROBE FAIL';
    probeWrite(ok ? 'PROBE OK' : 'PROBE FAIL');
  }

  // ---------------------------------------------------------------------------
  // 界面
  // ---------------------------------------------------------------------------
  function hideScreens() {
    var s = document.querySelectorAll('.screen');
    for (var i = 0; i < s.length; i++) s[i].classList.remove('on');
  }

  function showScreen(name) {
    app.screen = name;
    document.body.dataset.screen = name;
    document.body.classList.toggle('in-play', name === 'play' || name === 'pause');
    hideScreens();
    var map = { title: 'screen-title', chapters: 'screen-chapters', settings: 'screen-settings', intro: 'screen-intro', pause: 'screen-pause', summary: 'screen-summary', dead: 'screen-dead', fallback: 'fallback' };
    var node = $(map[name]);
    if (node) node.classList.add('on');
    if (name === 'title') {
      updateTitle();
      audio.pause(false);
    }
    if (name === 'play') audio.pause(false);
    if (name === 'pause' || name === 'intro') audio.pause(true);
    if (name === 'chapters') renderChapters();
    if (name === 'settings') applySettings();
  }

  function updateTitle() {
    var allDone = true;
    for (var a = 0; a < 5; a++) if (!app.save.best[window.PRISM_LEVELS[a].id]) allDone = false;
    var best = 0;
    for (var k in app.save.best) if (app.save.best[k] && app.save.best[k].score > best) best = app.save.best[k].score;
    var node = $('title-best');
    if (node) node.textContent = best ? '最佳 ' + formatScore(best) : '一次穿过所有颜色';
    var start = $('btn-start');
    if (start) {
      if (allDone && app.save.endlessUnlocked) start.textContent = '无尽棱廊';
      else {
        var next = 0;
        for (var i = 0; i < 5; i++) {
          if (!app.save.best[window.PRISM_LEVELS[i].id]) { next = i; break; }
        }
        start.textContent = app.save.unlocked > 1 || next > 0 ? '继续 · ' + window.PRISM_LEVELS[next].name : '开始';
      }
    }
  }

  function renderChapters() {
    var list = $('chapter-list');
    if (!list) return;
    list.textContent = '';
    for (var i = 0; i < window.PRISM_LEVELS.length; i++) {
      var ch = window.PRISM_LEVELS[i];
      var rec = app.save.best[ch.id];
      var locked = i + 1 > app.save.unlocked;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chapter-card' + (locked ? ' locked' : '') + (rec && rec.won ? ' done' : '');
      b.setAttribute('aria-disabled', locked ? 'true' : 'false');
      var num = document.createElement('span');
      num.className = 'chapter-num';
      num.textContent = '0' + (i + 1);
      var nm = document.createElement('strong');
      nm.textContent = ch.name;
      var ds = document.createElement('span');
      ds.className = 'chapter-desc';
      ds.textContent = locked ? '未解锁' : (rec && rec.score ? '最佳 ' + formatScore(rec.score) : ch.hint);
      b.append(num, nm, ds);
      if (!locked) {
        b.addEventListener('click', function (idx) {
          return function () { showIntro(idx); };
        }(i));
      }
      list.append(b);
    }
    // 奇数张卡片留下的空格，放一条规则说明。
    var filler = document.createElement('div');
    filler.className = 'chapter-card blank';
    var fn = document.createElement('span');
    fn.className = 'chapter-num';
    fn.textContent = 'NOTE';
    var fs = document.createElement('strong');
    fs.textContent = '三色 = 白';
    var fd = document.createElement('span');
    fd.className = 'chapter-desc';
    fd.textContent = '多余的色会留在身上。按住吐息，可以丢掉最后吃下的颜色。';
    filler.append(fn, fs, fd);
    list.append(filler);

    // 无尽
    var e = document.createElement('button');
    e.type = 'button';
    e.className = 'chapter-card endless' + (app.save.endlessUnlocked ? '' : ' locked');
    var en = document.createElement('span');
    en.className = 'chapter-num';
    en.textContent = '∞';
    var enm = document.createElement('strong');
    enm.textContent = '无尽棱廊';
    var eds = document.createElement('span');
    eds.className = 'chapter-desc';
    eds.textContent = app.save.endlessUnlocked ? (app.save.endlessBest ? '最佳 ' + formatScore(app.save.endlessBest) : '速度会慢慢变快') : '通关五章后解锁';
    e.append(en, enm, eds);
    if (app.save.endlessUnlocked) {
      e.addEventListener('click', function () { startEndless(); });
    }
    list.append(e);
  }

  function showIntro(index) {
    app.chapterIndex = index;
    var ch = window.PRISM_LEVELS[index];
    var rec = app.save.best[ch.id];
    $('intro-index').textContent = '0' + (index + 1) + ' / 05';
    $('intro-name').textContent = ch.name;
    $('intro-line').textContent = ch.line;
    $('intro-hint').textContent = ch.hint;
    $('intro-best').textContent = rec && rec.score ? '最佳 ' + formatScore(rec.score) : '还没有走完这一章';
    showScreen('intro');
  }

  function startChapter(index) {
    var ch = prepareChapter(window.PRISM_LEVELS[index]);
    app.chapterIndex = index;
    app.run = createRun(ch, 'campaign', false);
    audio.start();
    audio.setTempo(ch.tempo);
    audio.setColor(0);
    app.acc = 0;
    showScreen('play');
    updateHUD(app.run);
    announce('第 ' + (index + 1) + ' 章 · ' + ch.name);
  }

  function startEndless() {
    var ch = makeEndless(831 + Math.floor(Math.random() * 9999));
    app.chapterIndex = -1;
    app.run = createRun(ch, 'endless', false);
    audio.start();
    audio.setTempo(100);
    audio.setColor(0);
    app.acc = 0;
    showScreen('play');
    updateHUD(app.run);
    announce('无尽棱廊');
  }

  function finishScreen(run) {
    if (run.phase === 'complete') showSummary();
    else showDead();
  }

  function showSummary() {
    var run = app.run;
    if (!run) return;
    var ch = run.chapter;
    var ratio = run.passed / Math.max(1, ch.gates.length);
    var grade = 'C';
    if (run.passed === ch.gates.length) {
      if (run.perfect >= ch.gates.length * 0.75) grade = 'S';
      else if (run.perfect >= ch.gates.length * 0.45) grade = 'A';
      else grade = 'B';
    } else if (ratio >= 0.7) grade = 'C';
    else grade = 'D';
    if (ch.endless) grade = run.passed >= 40 ? 'S' : run.passed >= 25 ? 'A' : run.passed >= 12 ? 'B' : 'C';
    $('sum-kicker').textContent = ch.endless ? 'ENDLESS · 无尽棱廊' : 'CHAPTER 0' + ch.index + ' / 05 · ' + ch.name;
    $('sum-title').textContent = ch.endless ? '走到这里' : (grade === 'S' ? '光，完全听你的' : grade === 'A' ? '很干净的一次穿行' : grade === 'B' ? '穿过去了' : '还差一点');
    $('sum-grade').textContent = grade;
    $('sum-stats').textContent = '穿门 ' + run.passed + ' / ' + ch.gates.length +
      ' · 完美 ' + run.perfect + ' · 最高连击 ' + run.maxCombo +
      ' · 用时 ' + formatTime(run.time) + ' · 得分 ' + formatScore(run.score);
    $('sum-best').textContent = ch.endless ? '无尽最佳 ' + formatScore(app.save.endlessBest) : '本章最佳 ' + formatScore((app.save.best[ch.id] || {}).score || 0);
    var next = $('btn-next');
    if (ch.endless) {
      next.hidden = true;
    } else if (ch.index < 5) {
      next.hidden = false;
      next.textContent = '下一章 · ' + window.PRISM_LEVELS[ch.index].name;
    } else {
      next.hidden = false;
      next.textContent = app.save.endlessUnlocked ? '进入无尽棱廊' : '回到标题';
    }
    document.body.classList.remove('in-play');
    showScreen('summary');
  }

  function showDead() {
    var run = app.run;
    if (!run) return;
    var ch = run.chapter;
    $('dead-title').textContent = ch.endless ? '走廊还在继续' : '光散开了';
    $('dead-stats').textContent = '穿门 ' + run.passed + ' · 最高连击 ' + run.maxCombo +
      ' · 得分 ' + formatScore(run.score) + (ch.endless ? ' · 无尽最佳 ' + formatScore(app.save.endlessBest) : '');
    document.body.classList.remove('in-play');
    showScreen('dead');
  }

  function announce(text) {
    var now = performance.now();
    if (now - app.liveAt < 450) return;
    app.liveAt = now;
    var live = $('live');
    if (live) live.textContent = text;
  }

  function updateHUD(run) {
    if (!run) return;
    var mask = maskOf(run.stack);
    var info = maskInfo(mask);
    var ch = run.chapter;
    var cache = app.hudCache;
    function set(id, value) {
      if (cache[id] === value) return;
      cache[id] = value;
      var n = $(id);
      if (n) n.textContent = value;
    }
    set('hud-chapter', ch.endless ? '∞ / ∞' : '0' + ch.index + ' / 05');
    set('hud-name', ch.name);
    set('hud-score', formatScore(run.score));
    set('hud-combo', run.combo > 1 ? '×' + run.combo : '—');
    set('hud-mask', info.name);
    var next = run.chapter.gates[run.gateIndex];
    if (next) {
      set('hud-next-symbol', next.symbol);
      set('hud-next-name', next.name);
      set('hud-distance', Math.max(0, Math.round(next.d - run.travel)) + ' m');
    } else {
      set('hud-next-symbol', '○');
      set('hud-next-name', '尽头');
      set('hud-distance', '');
    }
    var facets = $('hud-facets');
    if (facets) {
      while (facets.children.length < 3) {
        var s = document.createElement('span');
        s.className = 'facet';
        facets.append(s);
      }
      for (var i = 0; i < 3; i++) facets.children[i].classList.toggle('lost', i >= run.facets);
    }
    var lamps = [['lamp-r', 1], ['lamp-g', 2], ['lamp-b', 4]];
    for (var l = 0; l < lamps.length; l++) {
      var lamp = $(lamps[l][0]);
      if (lamp) lamp.classList.toggle('on', !!(mask & lamps[l][1]));
    }
    var bar = $('hud-bar');
    if (bar && isFinite(run.finishAt)) {
      var pct = clamp(run.travel / run.finishAt * 100, 0, 100).toFixed(1) + '%';
      if (cache.bar !== pct) { cache.bar = pct; bar.style.width = pct; }
    }
    var vent = $('btn-vent');
    if (vent) vent.classList.toggle('active', run.stack.length > 0);
    var audioNode = $('hud-color-name');
    if (audioNode) audioNode.textContent = info.name + ' ' + symbolOf(mask);
  }

  // ---------------------------------------------------------------------------
  // 渲染状态
  // ---------------------------------------------------------------------------
  function fract(x) { return x - Math.floor(x); }

  function makeDecor(travel, count) {
    var palette = [
      [1.00, 0.42, 0.32], [1.00, 0.82, 0.30], [0.30, 0.86, 0.50],
      [0.30, 0.82, 0.90], [0.38, 0.54, 1.00], [0.90, 0.44, 0.80]
    ];
    var out = [];
    var start = Math.floor((travel - 4) / 7);
    for (var n = 0; n < count; n++) {
      var idx = start + n;
      var h1 = fract(Math.sin(idx * 12.9898) * 43758.5453);
      var h2 = fract(Math.sin(idx * 78.233 + 1.7) * 12345.678);
      var h3 = fract(Math.sin(idx * 37.719 + 4.1) * 9876.543);
      var d = idx * 7 + h1 * 3.5;
      if (d < travel - 4 || d > travel + 130) continue;
      out.push({
        x: (h2 * 2 - 1) * 2.25, y: (h3 * 2 - 1) * 1.50, d: d,
        size: 0.025 + h1 * 0.095,
        color: palette[Math.floor(h2 * palette.length) % palette.length],
        alpha: 0.14 + h2 * 0.24, phase: h3 * 6.28
      });
    }
    return out;
  }

  function buildRenderState(run, alpha) {
    var travel = lerp(run.prev.travel, run.travel, alpha);
    var px = lerp(run.prev.x, run.player.x, alpha);
    var py = lerp(run.prev.y, run.player.y, alpha);
    var camX = lerp(run.prev.camX, run.camX, alpha);
    var camY = lerp(run.prev.camY, run.camY, alpha) + 0.55;
    var mask = maskOf(run.stack);
    var orb = colorForMask(mask);
    var gates = [];
    for (var i = 0; i < run.chapter.gates.length; i++) {
      var g = run.chapter.gates[i];
      if (g.d < travel - 6 || g.d > travel + 145) continue;
      gates.push({
        x: gateX(g, travel), y: g.y, d: g.d, r: g.r,
        color: g.color, glyph: g.glyph, alpha: 1
      });
    }
    var motes = [];
    for (var j = 0; j < run.chapter.motes.length; j++) {
      var m = run.chapter.motes[j];
      if (m.taken || m.d < travel - 4 || m.d > travel + 120) continue;
      motes.push({ x: m.x, y: m.y, d: m.d, color: m.color, alpha: 1, glyph: glyphOf(m.ch) });
    }
    var trail = [];
    for (var k = 0; k < run.trail.length; k++) {
      var tr = run.trail[k];
      if (tr.d > travel - 7) trail.push({ x: tr.x, y: tr.y, d: tr.d });
    }
    return {
      travel: travel, camX: camX, camY: camY,
      player: { x: px, y: py, d: travel },
      orb: orb,
      speed: run.speed,
      time: run.time,
      impact: run.impact,
      flash: run.flash,
      tint: [0.02, 0.015, 0.01],
      motion: app.save.settings.motion,
      gates: gates, motes: motes, particles: run.particles, trail: trail,
      decor: makeDecor(travel, 26)
    };
  }

  function renderRun(alpha) {
    if (!renderer || !renderer.ok || !app.run) return;
    renderer.render(buildRenderState(app.run, alpha));
  }

  // ---------------------------------------------------------------------------
  // 吸引模式（标题背后）
  // ---------------------------------------------------------------------------
  function makeAttract() {
    var gates = [];
    var motes = [];
    var masks = [7, 3, 6, 5, 1, 2, 4, 7, 3, 6, 5];
    for (var i = 0; i < 11; i++) {
      var d = 70 + i * 44;
      var mask = masks[i % masks.length];
      gates.push({
        d: d, x: Math.sin(i * 1.3) * 0.72, y: Math.cos(i * 0.9) * 0.4,
        r: 0.84, color: maskInfo(mask).color, glyph: glyphOf(mask), alpha: 1,
        driftX: 0, freq: 0.8, phase: 0
      });
      var chs = mask === 7 ? [1, 2, 4] : mask === 3 ? [1, 2] : mask === 6 ? [2, 4] : mask === 5 ? [1, 4] : [mask];
      for (var c = 0; c < chs.length; c++) {
        motes.push({
          d: d - 20 + c * 6, x: Math.sin(i + c) * 1.0, y: Math.cos(i * 0.7 + c) * 0.6,
          color: maskInfo(chs[c]).color, glyph: glyphOf(chs[c]), taken: false, alpha: 1
        });
      }
    }
    return {
      time: 0, travel: 0, camX: 0, camY: 0,
      player: { x: 0, y: 0 },
      gates: gates, motes: motes, particles: [], trail: [],
      impact: 0, flash: 0, orb: colorForMask(7)
    };
  }

  function updateAttract(dt) {
    var a = app.attract;
    if (!a) { a = app.attract = makeAttract(); }
    a.time += dt;
    a.travel += dt * 9.5;
    if (a.travel > 560) a.travel = 0;
    a.player.x = Math.sin(a.time * 0.55) * 1.05;
    a.player.y = Math.cos(a.time * 0.73) * 0.58;
    a.camX += (a.player.x - a.camX) * Math.min(1, dt * 4);
    a.camY += (a.player.y - a.camY) * Math.min(1, dt * 4);
    var cycle = Math.floor(a.time / 4.5) % 7;
    var mask = [7, 3, 6, 5, 1, 2, 4][cycle];
    a.orb = colorForMask(mask);
    a.trail.unshift({ x: a.player.x, y: a.player.y, d: a.travel });
    if (a.trail.length > 10) a.trail.pop();
  }

  function renderAttract() {
    var a = app.attract;
    if (!a || !renderer || !renderer.ok) return;
    var gates = [];
    for (var i = 0; i < a.gates.length; i++) {
      var g = a.gates[i];
      if (g.d < a.travel - 5 || g.d > a.travel + 130) continue;
      gates.push(g);
    }
    var motes = [];
    for (var j = 0; j < a.motes.length; j++) {
      var m = a.motes[j];
      if (m.d < a.travel - 3 || m.d > a.travel + 110) continue;
      motes.push(m);
    }
    renderer.render({
      travel: a.travel, camX: a.camX, camY: a.camY + 0.55,
      player: { x: a.player.x, y: a.player.y, d: a.travel },
      orb: a.orb, speed: 9.5, time: a.time, impact: 0, flash: 0,
      tint: [0.02, 0.015, 0.01], motion: app.save.settings.motion,
      gates: gates, motes: motes, particles: [], trail: a.trail,
      decor: makeDecor(a.travel, 22)
    });
  }

  function makeDemoState() {
    var a = {
      travel: 120, camX: 0.2, camY: 0.45,
      player: { x: 0.1, y: 0.0, d: 120 },
      orb: colorForMask(3), speed: 14, time: 2.5, impact: 0, flash: 0,
      tint: [0.02, 0.015, 0.01], motion: true,
      gates: [
        { x: 0, y: 0, d: 160, r: 0.84, color: colorForMask(7), glyph: 7, alpha: 1 },
        { x: -0.6, y: 0.3, d: 240, r: 0.84, color: colorForMask(3), glyph: 4, alpha: 1 }
      ],
      motes: [
        { x: -0.8, y: 0.2, d: 140, color: colorForMask(1), alpha: 1, glyph: 1 },
        { x: 0.5, y: -0.3, d: 150, color: colorForMask(2), alpha: 1, glyph: 2 }
      ],
      particles: [
        { x: 0.4, y: 0.2, d: 126, size: 0.16, color: colorForMask(1), alpha: 0.8, kind: 4, phase: 0.4 }
      ],
      trail: [],
      decor: makeDecor(120, 14)
    };
    for (var i = 0; i < 8; i++) a.trail.push({ x: 0.1 - i * 0.02, y: 0, d: 120 - i * 0.4 });
    return a;
  }

  // ---------------------------------------------------------------------------
  // 输入
  // ---------------------------------------------------------------------------
  function pointerAxes() {
    if (!app.pointer.active) return { x: 0, y: 0 };
    var p = app.pointer;
    var dx = clamp((p.x - p.ox) / 54, -1, 1);
    var dy = clamp((p.y - p.oy) / 54, -1, 1);
    var dead = 0.12;
    if (Math.abs(dx) < dead) dx = 0; else dx = (dx - Math.sign(dx) * dead) / (1 - dead);
    if (Math.abs(dy) < dead) dy = 0; else dy = (dy - Math.sign(dy) * dead) / (1 - dead);
    return { x: dx, y: -dy };
  }

  function currentInput() {
    var pa = pointerAxes();
    var kx = 0, ky = 0;
    if (app.keys['ArrowLeft'] || app.keys['KeyA']) kx -= 1;
    if (app.keys['ArrowRight'] || app.keys['KeyD']) kx += 1;
    if (app.keys['ArrowUp'] || app.keys['KeyW']) ky += 1;
    if (app.keys['ArrowDown'] || app.keys['KeyS']) ky -= 1;
    var ax = pa.x || kx;
    var ay = pa.y || ky;
    var len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; }
    return {
      ax: ax, ay: ay,
      vent: !!(app.keys['Space'] || app.keys['ShiftLeft'] || app.keys['ShiftRight'] || app.ventHeld)
    };
  }

  function bindInput() {
    var canvas = el.canvas;
    canvas.addEventListener('pointerdown', function (e) {
      if (app.screen !== 'play') return;
      app.pointer.active = true;
      app.pointer.id = e.pointerId;
      app.pointer.ox = app.pointer.x = e.clientX;
      app.pointer.oy = app.pointer.y = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointermove', function (e) {
      if (!app.pointer.active || e.pointerId !== app.pointer.id) return;
      app.pointer.x = e.clientX;
      app.pointer.y = e.clientY;
      e.preventDefault();
    }, { passive: false });
    function up(e) {
      if (e.pointerId !== app.pointer.id) return;
      app.pointer.active = false;
      app.pointer.id = null;
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    window.addEventListener('keydown', function (e) {
      var code = e.code || e.key;
      if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
        if (app.screen === 'play' || app.screen === 'intro') e.preventDefault();
      }
      if (app.screen === 'play') {
        if (code === 'Escape' || code === 'KeyP') { pauseGame(); return; }
        if (code === 'KeyM') { toggleMute(); return; }
      }
      if (app.screen === 'pause' && (code === 'Escape' || code === 'KeyP')) { resumeGame(); return; }
      if (app.screen === 'summary' && code === 'Enter') { nextChapter(); return; }
      if (app.screen === 'dead' && (code === 'KeyR' || code === 'Enter')) { retryRun(); return; }
      if (app.screen === 'intro' && (code === 'Enter' || code === 'Space')) { startChapter(app.chapterIndex); return; }
      app.keys[code] = true;
    });
    window.addEventListener('keyup', function (e) {
      app.keys[e.code || e.key] = false;
    });
    window.addEventListener('blur', function () {
      app.keys = {};
      app.pointer.active = false;
      if (app.screen === 'play') pauseGame();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (app.screen === 'play') pauseGame();
        audio.suspend();
      } else {
        audio.resume();
      }
    });

    // 吐息按钮
    var vent = $('btn-vent');
    if (vent) {
      vent.addEventListener('pointerdown', function (e) {
        app.ventHeld = true;
        e.preventDefault();
      });
      vent.addEventListener('pointerup', function () { app.ventHeld = false; });
      vent.addEventListener('pointercancel', function () { app.ventHeld = false; });
      vent.addEventListener('pointerleave', function () { app.ventHeld = false; });
    }
  }

  function pauseGame() {
    if (app.screen !== 'play' || !app.run) return;
    if (app.run.phase !== 'play') return;
    showScreen('pause');
    audio.pause(true);
  }
  function resumeGame() {
    if (!app.run) return;
    showScreen('play');
    audio.pause(false);
    audio.resume();
    app.acc = 0;
    app.last = performance.now();
  }
  function retryRun() {
    if (app.chapterIndex < 0) { startEndless(); return; }
    startChapter(app.chapterIndex);
  }
  function nextChapter() {
    if (!app.run) { showScreen('title'); return; }
    var ch = app.run.chapter;
    if (ch.endless) { showScreen('title'); return; }
    if (ch.index < 5) { startChapter(ch.index); return; }
    if (app.save.endlessUnlocked) startEndless();
    else showScreen('title');
  }
  function toggleMute() {
    app.save.settings.muted = !app.save.settings.muted;
    audio.setMuted(app.save.settings.muted);
    writeSave();
    applySettings();
  }

  // ---------------------------------------------------------------------------
  // 主循环
  // ---------------------------------------------------------------------------
  function loop(ts) {
    if (!app.last) app.last = ts;
    var dt = Math.min(0.05, (ts - app.last) / 1000);
    app.last = ts;
    if (dt < 0) dt = 0;

    if (app.screen === 'title') {
      updateAttract(dt);
      renderAttract();
      updateHUDTitleAttract();
      requestAnimationFrame(loop);
      return;
    }
    if (app.screen === 'play' && app.run) {
      var run = app.run;
      var inp = currentInput();
      app.lastInput = inp;
      app.acc += dt;
      var steps = 0;
      while (app.acc >= FIXED && steps < 6) {
        updateRun(run, FIXED, inp);
        app.acc -= FIXED;
        steps++;
      }
      if (steps === 6) app.acc = 0;
      updateHUD(run);
      renderRun(app.acc / FIXED);
      // 自适应分辨率
      if (app.save.settings.quality === 'auto') {
        app.frameAvg = app.frameAvg * 0.92 + dt * 1000 * 0.08;
        app.scaleCooldown -= dt;
        if (app.scaleCooldown <= 0) {
          if (app.frameAvg > 25 && renderer.scale > 0.55) {
            renderer.setRenderScale(renderer.scale - 0.08);
            app.scaleCooldown = 1.2;
          } else if (app.frameAvg < 13 && renderer.scale < 0.98) {
            renderer.setRenderScale(renderer.scale + 0.05);
            app.scaleCooldown = 2.0;
          }
        }
      }
      requestAnimationFrame(loop);
      return;
    }
    if (app.screen === 'pause' || app.screen === 'summary' || app.screen === 'dead') {
      if (app.run) {
        if (app.run.phase === 'dead') updateRun(app.run, dt, { ax: 0, ay: 0, vent: false });
        renderRun(1);
      }
      requestAnimationFrame(loop);
      return;
    }
    requestAnimationFrame(loop);
  }

  function updateHUDTitleAttract() {
    // 标题页的 HUD 是隐藏的，这里不做任何事；保留函数方便调试。
  }

  // ---------------------------------------------------------------------------
  // 初始化
  // ---------------------------------------------------------------------------
  function bindButtons() {
    var on = function (id, fn) {
      var n = $(id);
      if (n) n.addEventListener('click', function (e) { e.preventDefault(); fn(); });
    };
    on('btn-start', function () {
      audio.start();
      var allDone = true;
      for (var i = 0; i < 5; i++) if (!app.save.best[window.PRISM_LEVELS[i].id]) allDone = false;
      if (allDone && app.save.endlessUnlocked) { startEndless(); return; }
      var next = 0;
      for (var i = 0; i < 5; i++) {
        if (!app.save.best[window.PRISM_LEVELS[i].id]) { next = i; break; }
      }
      showIntro(next);
    });
    on('btn-chapters', function () { showScreen('chapters'); });
    on('btn-settings', function () { showScreen('settings'); });
    on('btn-chapters-back', function () { showScreen('title'); });
    on('btn-settings-back', function () { showScreen('title'); });
    on('btn-intro-start', function () { startChapter(app.chapterIndex); });
    on('btn-intro-back', function () { showScreen('chapters'); });
    on('btn-resume', function () { resumeGame(); });
    on('btn-restart', function () { retryRun(); });
    on('btn-quit', function () { showScreen('title'); });
    on('btn-next', function () { nextChapter(); });
    on('btn-retry', function () { retryRun(); });
    on('btn-summary-title', function () { showScreen('title'); });
    on('btn-dead-retry', function () { retryRun(); });
    on('btn-dead-title', function () { showScreen('title'); });
    on('btn-pause', function () { pauseGame(); });
    on('btn-mute', function () { toggleMute(); });
    on('quality-auto', function () { app.save.settings.quality = 'auto'; writeSave(); applySettings(); });
    on('quality-high', function () { app.save.settings.quality = 'high'; writeSave(); applySettings(); });
    on('quality-low', function () { app.save.settings.quality = 'low'; writeSave(); applySettings(); });
    on('btn-motion', function () { app.save.settings.motion = !app.save.settings.motion; writeSave(); applySettings(); });
    on('btn-sound', function () { toggleMute(); });
    var vol = $('volume');
    if (vol) vol.addEventListener('input', function () {
      app.save.settings.volume = clamp(Number(vol.value) / 100, 0, 1);
      audio.setVolume(app.save.settings.volume);
      writeSave();
    });
  }

  function initDom() {
    el.canvas = $('gl');
  }

  function init() {
    initDom();
    app.save = loadSave();
    if (PARAMS.get('unlock') === '1') {
      app.save.unlocked = 5;
      app.save.endlessUnlocked = true;
    }
    if (PARAMS.get('mute') === '1') app.save.settings.muted = true;
    if (PARAMS.get('quality')) app.save.settings.quality = PARAMS.get('quality');
    document.body.classList.toggle('reduce-motion', !app.save.settings.motion);
    audio.setMuted(app.save.settings.muted);
    audio.setVolume(app.save.settings.volume);

    renderer = new window.PrismRender(el.canvas);
    if (!renderer.init()) {
      var fb = $('fallback');
      if (fb) {
        fb.classList.add('on');
        var msg = $('fallback-msg');
        if (msg) msg.textContent = renderer.error || '需要 WebGL 才能进入这条走廊。';
      }
      document.body.dataset.screen = 'fallback';
      document.body.classList.add('no-webgl');
      if (!PROBE) return;
    } else {
      renderer.setQuality(app.save.settings.quality);
    }
    app.attract = makeAttract();
    bindButtons();
    bindInput();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

    window.addEventListener('error', function (ev) {
      if (PROBE) {
        probeWrite('RUNTIME ' + (ev.message || 'error'));
        document.title = 'PROBE FAIL';
      }
    });
    window.addEventListener('unhandledrejection', function (ev) {
      if (PROBE) {
        probeWrite('REJECT ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)));
        document.title = 'PROBE FAIL';
      }
    });

    if (PROBE) {
      document.body.classList.add('probe');
      try {
        runProbe(PROBE);
      } catch (e) {
        probeWrite('EXCEPTION ' + (e && e.message ? e.message : String(e)));
        probeWrite('PROBE FAIL');
        document.title = 'PROBE FAIL';
      }
      return;
    }

    showScreen('title');
    app.last = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    if (!renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = window.devicePixelRatio || 1;
    renderer.resize(w, h, dpr);
  }

  window.__PRISM__ = {
    app: app,
    run: function () { return app.run; },
    simulate: simulateChapter,
    lint: lintAll,
    renderer: function () { return renderer; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
