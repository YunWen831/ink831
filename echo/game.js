/* ECHO — a sonar stealth game. Classic script, no dependencies. */
(() => {
'use strict';

// ============================================================================
// constants
// ============================================================================
const T = 32;                 // world units per tile
const FIXED = 1 / 60;
const TAU = Math.PI * 2;
const MEMORY_T = 7.0;         // seconds a wall stays in memory
const PULSE_COOLDOWN = 1.1;
const PULSE_MAX = 9.5;
const PULSE_SPEED = 17;
const RUN_SPEED = 4.3;
const SNEAK_SPEED = 2.2;
const FOOTSTEP_RADIUS = 4.5;
const PULSE_NOISE = 10;
const MEMORY_RATE = 0.5;
const SAVE_KEY = 'echo-save-v1';
const LEVELS = Array.isArray(window.ECHO_LEVELS) ? window.ECHO_LEVELS : [];
const PARAMS = new URLSearchParams(location.search);
const PROBE = PARAMS.get('probe');

const RGB = {
  cyan: [111, 247, 255],
  white: [234, 255, 255],
  amber: [255, 207, 122],
  red: [255, 95, 120],
  violet: [169, 155, 255],
  deep: [27, 124, 138]
};
const rgba = (name, a) => {
  const c = Array.isArray(name) ? name : (RGB[name] || RGB.cyan);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
};

const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
const pad2 = n => String(n).padStart(2, '0');
const fmtTime = sec => {
  const s = Math.max(0, Math.floor(sec));
  return Math.floor(s / 60) + ':' + pad2(s % 60);
};

// ============================================================================
// DOM
// ============================================================================
const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false });
const probeEl = $('probe');

if (!canvas || !ctx) {
  document.body.innerHTML = '<div style="padding:3em;color:#d9f7ff;font:15px/1.8 system-ui">这个浏览器无法创建画布。</div>';
  return;
}

const view = { w: window.innerWidth, h: window.innerHeight, dpr: 1 };

// ============================================================================
// save
// ============================================================================
function defaultSave() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    v: 1,
    unlocked: 0,
    best: {},
    endlessBest: 0,
    settings: { volume: 70, motion: !reduce, muted: false }
  };
}

function loadSave() {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const out = {
      v: 1,
      unlocked: clamp(Number(parsed.unlocked) || 0, 0, Math.max(0, LEVELS.length - 1)),
      best: parsed.best && typeof parsed.best === 'object' ? parsed.best : {},
      endlessBest: Math.max(0, Number(parsed.endlessBest) || 0),
      settings: Object.assign({}, base.settings, parsed.settings || {})
    };
    out.settings.volume = clamp(Number(out.settings.volume), 0, 100);
    out.settings.motion = out.settings.motion !== false;
    out.settings.muted = out.settings.muted === true;
    return out;
  } catch (e) {
    return base;
  }
}

let save = loadSave();

function persist() {
  if (game.probe) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

// ============================================================================
// audio — everything is synthesized
// ============================================================================
const Sound = {
  ctx: null,
  master: null,
  ambientGain: null,
  noiseBuf: null,
  muted: false,
  volume: 0.7,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.volume = clamp(save.settings.volume / 100, 0, 1);
      this.muted = !!save.settings.muted;
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.makeNoise();
      this.startAmbient();
    } catch (e) { this.ctx = null; }
  },

  makeNoise() {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  ensure() {
    this.init();
    this.resume();
  },

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    }
    save.settings.muted = this.muted;
    persist();
    return this.muted;
  },

  startAmbient() {
    if (!this.ctx || this.ambientGain) return;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 210;
    filter.Q.value = 0.7;
    filter.connect(g);
    [55, 82.5, 110.3].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const og = this.ctx.createGain();
      og.gain.value = i === 2 ? 0.08 : 0.16;
      osc.connect(og);
      og.connect(filter);
      osc.start();
    });
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = this.ctx.createGain();
    lg.gain.value = 55;
    lfo.connect(lg);
    lg.connect(filter.frequency);
    lfo.start();
    this.ambientGain = g;
  },

  setAmbient(on) {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.35);
  },

  env(gain, t0, peak, dur) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  },

  tone(freq, endFreq, dur, peak, type) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
      this.env(g, t, peak, dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  },

  ping() {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const delay = this.ctx.createDelay(1.0);
      const fb = this.ctx.createGain();
      const wet = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, t);
      osc.frequency.exponentialRampToValueAtTime(170, t + 0.44);
      this.env(g, t, 0.17, 0.65);
      delay.delayTime.value = 0.19;
      fb.gain.value = 0.28;
      wet.gain.value = 0.42;
      osc.connect(g);
      g.connect(this.master);
      g.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.75);
    } catch (e) { /* ignore */ }
  },

  noise(dur, freq, peak, type) {
    if (!this.ctx || !this.noiseBuf || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type || 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 0.2);
      src.stop(t + dur + 0.03);
    } catch (e) { /* ignore */ }
  },

  step() {
    this.noise(0.09, 760 + Math.random() * 220, 0.045, 'bandpass');
  },

  pickup() {
    this.tone(880, 880, 0.18, 0.11, 'sine');
    setTimeout(() => this.tone(1320, 1320, 0.25, 0.09, 'sine'), 70);
  },

  unlock() {
    this.tone(220, 330, 0.7, 0.09, 'sine');
    setTimeout(() => this.tone(440, 660, 0.8, 0.07, 'sine'), 160);
  },

  alert() {
    this.tone(118, 92, 0.28, 0.07, 'sawtooth');
  },

  scan() {
    this.tone(300, 900, 0.65, 0.055, 'sine');
  },

  caught() {
    this.noise(0.5, 380, 0.2, 'lowpass');
    this.tone(140, 42, 0.8, 0.12, 'sawtooth');
  },

  win() {
    this.tone(440, 660, 0.5, 0.075, 'sine');
    setTimeout(() => this.tone(660, 990, 0.7, 0.06, 'sine'), 130);
  },

  ui() {
    this.tone(520, 620, 0.06, 0.025, 'sine');
  }
};

// ============================================================================
// input
// ============================================================================
const Input = {
  keys: Object.create(null),
  axisX: 0,
  axisY: 0,
  pulseQueued: false,
  sneak: false,
  touchActive: false,
  stickX: 0,
  stickY: 0,
  stickMag: 0,
  pointerId: null,
  originX: 0,
  originY: 0,
  isTouch: false,
  coarse: false,

  init() {
    this.coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    this.isTouch = this.coarse || (navigator.maxTouchPoints || 0) > 0;
    if (this.coarse) document.body.classList.add('touch-ui');
    const controlsLine = $('controls-line');
    if (controlsLine && this.coarse) {
      controlsLine.textContent = '左半屏拖动移动　轻推摇杆潜行　右下角声呐';
    }

    window.addEventListener('keydown', e => {
      const k = (e.key || '').toLowerCase();
      if (game.state === 'play' || game.state === 'paused') {
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'shift'].includes(k)) {
          e.preventDefault();
        }
      }
      if (e.repeat) return;
      if (k === 'shift') this.sneak = true;
      this.keys[k] = true;

      if (k === 'm' && game.state === 'play') toggleMute();
      if (k === 'escape') {
        if (game.state === 'play') setPause(true);
        else if (game.state === 'paused') setPause(false);
        else if (game.state === 'levels' || game.state === 'settings') showTitle();
      }
      if ((k === 'r') && (game.state === 'dead')) retryLevel();
      if ((k === 'enter') && game.state === 'win') nextLevel();
      if (k === ' ' && game.state === 'play') this.pulseQueued = true;
      if (k === 'p' && game.state === 'play') setPause(true);
    });

    window.addEventListener('keyup', e => {
      const k = (e.key || '').toLowerCase();
      this.keys[k] = false;
      if (k === 'shift') this.sneak = false;
    });

    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.state === 'play') setPause(true);
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (game.state !== 'play') return;
      Sound.ensure();
      if (e.pointerType === 'touch') {
        e.preventDefault();
        if (e.clientX > window.innerWidth * 0.56) {
          this.pulseQueued = true;
          return;
        }
        if (this.pointerId === null) {
          this.pointerId = e.pointerId;
          this.touchActive = true;
          this.originX = e.clientX;
          this.originY = e.clientY;
          this.stickX = 0;
          this.stickY = 0;
          this.stickMag = 0;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          const stick = $('stick');
          stick.style.left = e.clientX + 'px';
          stick.style.top = e.clientY + 'px';
          stick.classList.add('on');
          $('stick-knob').style.transform = 'translate(0,0)';
        }
      } else if (e.button === 0) {
        this.pulseQueued = true;
      }
    });

    window.addEventListener('pointermove', e => {
      if (e.pointerId !== this.pointerId || !this.touchActive) return;
      e.preventDefault();
      let dx = e.clientX - this.originX;
      let dy = e.clientY - this.originY;
      const len = Math.hypot(dx, dy);
      const max = 55;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.stickX = dx / max;
      this.stickY = dy / max;
      this.stickMag = Math.min(1, len / max);
      $('stick-knob').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }, { passive: false });

    const endPointer = e => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.touchActive = false;
      this.stickX = 0;
      this.stickY = 0;
      this.stickMag = 0;
      const stick = $('stick');
      stick.classList.remove('on');
      $('stick-knob').style.transform = 'translate(0,0)';
    };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
  },

  getMove() {
    let x = this.axisX;
    let y = this.axisY;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    if (this.keys['w'] || this.keys['arrowup']) y -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) y += 1;
    if (this.stickMag > 0.12) {
      x += this.stickX;
      y += this.stickY;
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, mag: Math.min(1, m), touchSneak: this.stickMag > 0.12 && this.stickMag < 0.55 };
  },

  consumePulse() {
    const v = this.pulseQueued;
    this.pulseQueued = false;
    return v;
  },

  clear() {
    this.keys = Object.create(null);
    this.axisX = 0;
    this.axisY = 0;
    this.sneak = false;
    this.stickX = 0;
    this.stickY = 0;
    this.stickMag = 0;
    this.touchActive = false;
    this.pointerId = null;
    const stick = $('stick');
    if (stick) stick.classList.remove('on');
  }
};

// ============================================================================
// level compile + geometry
// ============================================================================
function compileLevel(raw) {
  const src = (raw.rows || []).slice();
  const w = Math.max.apply(null, src.map(r => r.length).concat([1]));
  const rows = src.map(r => r.padEnd(w, '#'));
  const h = rows.length;
  const tile = new Uint8Array(w * h);
  let spawn = null;
  let exit = null;
  const cores = [];
  const groups = Object.create(null);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] || '#';
      const i = y * w + x;
      if (ch === '#') tile[i] = 1;
      else if (ch === '~') tile[i] = 2;
      else tile[i] = 0;

      if (ch === 'S') spawn = { x: x + 0.5, y: y + 0.5, tx: x, ty: y };
      else if (ch === 'X') exit = { x: x + 0.5, y: y + 0.5, tx: x, ty: y };
      else if (ch === 'C') cores.push({ x: x + 0.5, y: y + 0.5, tx: x, ty: y, taken: false, seen: false, phase: cores.length * 1.7 });
      else if (ch >= '1' && ch <= '4') {
        if (!groups[ch]) groups[ch] = [];
        groups[ch].push({ x: x + 0.5, y: y + 0.5, tx: x, ty: y });
      }
    }
  }

  const enemies = [];
  Object.keys(groups).sort().forEach((key, idx) => {
    const route = groups[key];
    const spec = (raw.enemySpecs && raw.enemySpecs[idx]) || {};
    const first = route[0];
    enemies.push({
      x: first.x,
      y: first.y,
      route,
      routeIndex: route.length > 1 ? 1 : 0,
      state: 'patrol',
      path: [],
      pathIndex: 0,
      inv: { x: first.x, y: first.y },
      lastSeen: -99,
      alertT: 0,
      pauseT: 0.4,
      elite: !!spec.elite,
      scanT: 5.2 + idx * 0.7,
      scanCharge: 0,
      chaseLost: 0,
      thinkT: 0,
      searchT: 0,
      stuckT: 0,
      face: 0,
      vx: 0,
      vy: 0
    });
  });

  return {
    raw: Object.assign({}, raw, { rows }),
    w, h, tile, spawn, exit, cores, enemies,
    totalCores: cores.length
  };
}

function tileAt(L, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return 1;
  return L.tile[ty * L.w + tx];
}
function isWall(L, tx, ty) { return tileAt(L, tx, ty) !== 0; }

function circleHitsWall(L, x, y, r) {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isWall(L, tx, ty)) continue;
      const nx = clamp(x, tx, tx + 1);
      const ny = clamp(y, ty, ty + 1);
      if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return true;
    }
  }
  return false;
}

function losClear(L, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return true;
  const steps = Math.max(2, Math.ceil(len / 0.08));
  let last = -1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor(x0 + dx * t);
    const ty = Math.floor(y0 + dy * t);
    if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return false;
    const idx = ty * L.w + tx;
    if (idx === last) continue;
    last = idx;
    if (L.tile[idx] !== 0) return false;
  }
  return true;
}

function soundPath(L, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.ceil(len / 0.2));
  let last = -1;
  let walls = 0;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor(x0 + dx * t);
    const ty = Math.floor(y0 + dy * t);
    if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return { blocked: true, walls };
    const idx = ty * L.w + tx;
    if (idx === last) continue;
    last = idx;
    const v = L.tile[idx];
    if (v === 2) return { blocked: true, walls };
    if (v === 1) walls++;
  }
  return { blocked: false, walls };
}

function findPath(L, sx, sy, tx, ty) {
  const w = L.w;
  const h = L.h;
  sx = clamp(Math.floor(sx), 0, w - 1);
  sy = clamp(Math.floor(sy), 0, h - 1);
  tx = clamp(Math.floor(tx), 0, w - 1);
  ty = clamp(Math.floor(ty), 0, h - 1);
  if (isWall(L, sx, sy) || isWall(L, tx, ty)) return null;
  const start = sy * w + sx;
  const goal = ty * w + tx;
  if (start === goal) return [];
  const prev = new Int32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const q = [start];
  seen[start] = 1;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = false;
  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    if (cur === goal) { found = true; break; }
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + dirs[d][0];
      const ny = cy + dirs[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (isWall(L, nx, ny)) continue;
      const ni = ny * w + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (!found) return null;
  const path = [];
  let cur = goal;
  let guard = 0;
  while (cur !== start && cur !== -1 && guard++ < w * h + 4) {
    path.push({ x: (cur % w) + 0.5, y: ((cur / w) | 0) + 0.5 });
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

function validateCompiled(L) {
  const issues = [];
  if (!L.spawn) issues.push('no spawn');
  if (!L.exit) issues.push('no exit');
  if (!L.cores.length) issues.push('no cores');
  if (L.spawn && isWall(L, L.spawn.tx, L.spawn.ty)) issues.push('spawn in wall');
  if (L.exit && isWall(L, L.exit.tx, L.exit.ty)) issues.push('exit in wall');
  L.cores.forEach((c, i) => {
    if (isWall(L, c.tx, c.ty)) issues.push('core ' + i + ' in wall');
  });
  const start = L.spawn ? L.spawn.ty * L.w + L.spawn.tx : -1;
  if (start >= 0) {
    const seen = new Uint8Array(L.w * L.h);
    const q = [start];
    seen[start] = 1;
    for (let head = 0; head < q.length; head++) {
      const cur = q[head];
      const cx = cur % L.w;
      const cy = (cur / L.w) | 0;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let d = 0; d < 4; d++) {
        const nx = cx + dirs[d][0];
        const ny = cy + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        if (isWall(L, nx, ny)) continue;
        const ni = ny * L.w + nx;
        if (!seen[ni]) { seen[ni] = 1; q.push(ni); }
      }
    }
    L.cores.forEach((c, i) => {
      if (!seen[c.ty * L.w + c.tx]) issues.push('core ' + i + ' unreachable');
    });
    if (L.exit && !seen[L.exit.ty * L.w + L.exit.tx]) issues.push('exit unreachable');
    L.enemies.forEach((e, i) => {
      if (!e.route || e.route.length < 2) issues.push('enemy ' + i + ' route too short');
      (e.route || []).forEach((p, j) => {
        if (!seen[p.ty * L.w + p.tx]) issues.push('enemy ' + i + ' waypoint ' + j + ' unreachable');
      });
    });
  }
  return issues;
}

// ============================================================================
// game state
// ============================================================================
const game = {
  state: 'title',
  mode: 'campaign',
  levelIndex: 0,
  depth: 0,
  score: 0,
  level: null,
  player: null,
  enemies: [],
  cores: [],
  collected: 0,
  exitUnlocked: false,
  time: 0,
  pulses: 0,
  pulse: null,
  pulseCooldown: 0,
  stepT: 0,
  trailT: 0,
  hudT: 0,
  visT: 0,
  lastPX: 0,
  lastPY: 0,
  vis: null,
  wallSeen: null,
  floorSeen: null,
  noises: [],
  ripples: [],
  particles: [],
  shake: 0,
  introT: 0,
  deadAt: 0,
  autoT: 0,
  cam: { x: 0, y: 0, zoom: 1 },
  probe: false,
  ghost: false,
  runSeed: 0,
  exitHintT: 0
};

// ============================================================================
// visibility
// ============================================================================
function recomputeVisibility(g) {
  const L = g.level;
  const p = g.player;
  if (!L || !p || !g.vis) return;
  const R = Math.ceil(PULSE_MAX + 2);
  const px = Math.floor(p.x);
  const py = Math.floor(p.y);
  g.vis.fill(0);
  const x0 = Math.max(0, px - R);
  const x1 = Math.min(L.w - 1, px + R);
  const y0 = Math.max(0, py - R);
  const y1 = Math.min(L.h - 1, py + R);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * L.w + tx;
      if (L.tile[i] !== 0) continue;
      const cx = tx + 0.5;
      const cy = ty + 0.5;
      if ((cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y) > (R + 0.5) * (R + 0.5)) continue;
      if (losClear(L, p.x, p.y, cx, cy)) g.vis[i] = 1;
    }
  }
}

function silentReveal(g, radius) {
  const L = g.level;
  const p = g.player;
  const x0 = Math.max(0, Math.floor(p.x - radius));
  const x1 = Math.min(L.w - 1, Math.floor(p.x + radius));
  const y0 = Math.max(0, Math.floor(p.y - radius));
  const y1 = Math.min(L.h - 1, Math.floor(p.y + radius));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * L.w + tx;
      if (L.tile[i] !== 0) continue;
      if (!g.vis[i]) continue;
      if (dist(tx + 0.5, ty + 0.5, p.x, p.y) > radius) continue;
      g.floorSeen[i] = g.time;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let d = 0; d < 4; d++) {
        const nx = tx + dirs[d][0];
        const ny = ty + dirs[d][1];
        if (isWall(L, nx, ny)) g.wallSeen[ny * L.w + nx] = g.time;
      }
    }
  }
}

function revealPulse(g, pulse) {
  const L = g.level;
  const R = pulse.r + 0.7;
  const x0 = Math.max(0, Math.floor(pulse.x - R));
  const x1 = Math.min(L.w - 1, Math.floor(pulse.x + R));
  const y0 = Math.max(0, Math.floor(pulse.y - R));
  const y1 = Math.min(L.h - 1, Math.floor(pulse.y + R));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * L.w + tx;
      const cx = tx + 0.5;
      const cy = ty + 0.5;
      const d = dist(cx, cy, pulse.x, pulse.y);
      if (d > R) continue;
      if (L.tile[i] === 0) {
        if (g.vis[i] && d <= pulse.r) g.floorSeen[i] = g.time;
      } else {
        let adj = false;
        for (let k = 0; k < 4; k++) {
          const nx = tx + dirs[k][0];
          const ny = ty + dirs[k][1];
          if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
          const ni = ny * L.w + nx;
          if (L.tile[ni] === 0 && g.vis[ni]) { adj = true; break; }
        }
        if (adj && d <= pulse.r + 0.35) g.wallSeen[i] = g.time;
      }
    }
  }
  for (let i = 0; i < g.cores.length; i++) {
    const c = g.cores[i];
    if (!c.seen && !c.taken && g.vis[c.ty * L.w + c.tx] && dist(c.x, c.y, pulse.x, pulse.y) <= pulse.r + 0.55) {
      c.seen = true;
    }
  }
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    const tx = Math.floor(e.x);
    const ty = Math.floor(e.y);
    if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) continue;
    if (g.vis[ty * L.w + tx] && dist(e.x, e.y, pulse.x, pulse.y) <= pulse.r + 0.4) e.lastSeen = g.time;
  }
}

// ============================================================================
// noise + enemies
// ============================================================================
function emitNoise(g, x, y, radius, delay, kind) {
  g.noises.push({ x, y, radius, delay, kind: kind || 'noise', emitted: false, age: 0 });
}

function updateNoises(g, dt) {
  for (let i = 0; i < g.noises.length; i++) {
    const n = g.noises[i];
    n.age += dt;
    if (!n.emitted) {
      n.delay -= dt;
      if (n.delay <= 0) {
        n.emitted = true;
        alertEnemies(g, n);
        g.ripples.push({ x: n.x, y: n.y, r: 0.2, speed: 3.5, life: 0.7, maxLife: 0.7, color: n.kind === 'pulse' ? 'cyan' : 'red', width: 1 });
      }
    }
  }
  g.noises = g.noises.filter(n => n.age < 1.2);
}

function alertEnemies(g, n) {
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (e.state === 'chase') continue;
    const sr = soundPath(g.level, n.x, n.y, e.x, e.y);
    if (sr.blocked) continue;
    const atten = Math.max(0.35, 1 - sr.walls * 0.16);
    if (dist(n.x, n.y, e.x, e.y) > n.radius * atten) continue;
    e.state = 'investigate';
    e.inv = { x: n.x, y: n.y };
    e.alertT = 1.25;
    e.path = [];
    e.pathIndex = 0;
    e.thinkT = 0;
    e.searchT = 0;
    if (dist(g.player.x, g.player.y, e.x, e.y) < 9) Sound.alert();
  }
}

function updateElite(g, e, dt) {
  if (!e.elite) return;
  if (e.scanCharge > 0) {
    e.scanCharge -= dt;
    if (e.scanCharge <= 0) {
      e.scanCharge = 0;
      eliteScan(g, e);
    }
    return;
  }
  if (e.state === 'chase') return;
  e.scanT -= dt;
  if (e.scanT <= 0) {
    e.scanT = 5.0;
    e.scanCharge = 1.0;
    if (dist(e.x, e.y, g.player.x, g.player.y) < 14) toast('巡礼者正在扫描');
  }
}

function eliteScan(g, e) {
  Sound.scan();
  g.ripples.push({ x: e.x, y: e.y, r: 0.4, speed: 7.5, life: 1.0, maxLife: 1.0, color: 'red', width: 2 });
  if (dist(e.x, e.y, g.player.x, g.player.y) <= 8 && losClear(g.level, e.x, e.y, g.player.x, g.player.y)) {
    e.state = 'chase';
    e.inv = { x: g.player.x, y: g.player.y };
    e.chaseLost = 0;
    e.alertT = 1.5;
    e.path = [];
    e.thinkT = 0;
    toast('被扫描到');
    Sound.alert();
  }
}

function enemySpeed(e) {
  if (e.state === 'chase') return e.elite ? 3.4 : 3.25;
  if (e.state === 'investigate') return 2.15;
  if (e.state === 'return') return 1.9;
  if (e.state === 'search') return 1.2;
  return 1.45;
}

function ensureEnemyPath(g, e) {
  if (e.state === 'search') return;
  if (e.state === 'chase') {
    if (e.thinkT <= 0 || !e.path || e.path.length === 0) {
      e.path = findPath(g.level, e.x, e.y, g.player.x, g.player.y) || [];
      e.pathIndex = 0;
      e.thinkT = 0.32;
    }
    return;
  }
  if (e.state === 'patrol' && e.pauseT > 0) return;
  if (e.path && e.path.length && e.pathIndex < e.path.length) return;
  let target = null;
  if (e.state === 'investigate') target = e.inv;
  else if (e.state === 'patrol' || e.state === 'return') target = e.route[e.routeIndex] || e.route[0];
  if (!target) return;
  e.path = findPath(g.level, e.x, e.y, target.x, target.y) || [];
  e.pathIndex = 0;
  e.thinkT = 0.4;
}

function enemyArrive(g, e) {
  if (e.state === 'patrol') {
    e.pauseT = 0.9;
    e.routeIndex = (e.routeIndex + 1) % e.route.length;
    e.path = [];
    e.pathIndex = 0;
  } else if (e.state === 'investigate') {
    e.state = 'search';
    e.searchT = 2.6;
    e.path = [];
    e.pathIndex = 0;
  } else if (e.state === 'return') {
    e.state = 'patrol';
    e.path = [];
    e.pathIndex = 0;
    e.pauseT = 0.3;
  }
}

function moveEnemy(g, e, dt) {
  const L = g.level;
  if (e.state === 'search') return;
  if (e.state === 'patrol' && e.pauseT > 0) { e.pauseT -= dt; return; }
  let target = null;
  if (e.path && e.pathIndex < e.path.length) {
    target = e.path[e.pathIndex];
    if (dist(e.x, e.y, target.x, target.y) < 0.16) {
      e.pathIndex++;
      if (e.pathIndex >= e.path.length) { enemyArrive(g, e); return; }
      target = e.path[e.pathIndex];
    }
  } else {
    if (e.state === 'chase') target = { x: g.player.x, y: g.player.y };
    else if (e.state === 'investigate') target = e.inv;
    else if (e.state === 'patrol' || e.state === 'return') target = e.route[e.routeIndex] || e.route[0];
    if (!target) return;
    if (dist(e.x, e.y, target.x, target.y) < 0.3) { enemyArrive(g, e); return; }
  }
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return;
  const step = Math.min(enemySpeed(e) * dt, len);
  const nx = e.x + dx / len * step;
  const ny = e.y + dy / len * step;
  const ox = e.x;
  const oy = e.y;
  if (!circleHitsWall(L, nx, e.y, 0.25)) e.x = nx;
  if (!circleHitsWall(L, e.x, ny, 0.25)) e.y = ny;
  const moved = Math.hypot(e.x - ox, e.y - oy);
  if (moved > 0.0005) {
    e.face = Math.atan2(e.y - oy, e.x - ox);
    e.vx = (e.x - ox) / Math.max(dt, 0.001);
    e.vy = (e.y - oy) / Math.max(dt, 0.001);
  }
  if (moved < 0.004) {
    e.stuckT += dt;
    if (e.stuckT > 0.55) {
      e.stuckT = 0;
      e.path = [];
      e.pathIndex = 0;
      e.thinkT = 0;
    }
  } else {
    e.stuckT = 0;
  }
}

function updateEnemy(g, e, dt) {
  e.alertT = Math.max(0, e.alertT - dt);
  e.thinkT = Math.max(0, e.thinkT - dt);
  updateElite(g, e, dt);

  const p = g.player;
  const d = dist(e.x, e.y, p.x, p.y);
  const see = d < 2.45 && losClear(g.level, e.x, e.y, p.x, p.y);
  if (see) {
    if (e.state !== 'chase') e.alertT = 1.2;
    e.state = 'chase';
    e.chaseLost = 0;
    e.inv = { x: p.x, y: p.y };
  }
  if (e.state === 'chase') {
    e.chaseLost = see ? 0 : e.chaseLost + dt;
    if (e.chaseLost > 2.4) {
      e.state = 'investigate';
      e.inv = { x: p.x, y: p.y };
      e.path = [];
      e.thinkT = 0;
    }
  } else if (e.state === 'search') {
    e.searchT -= dt;
    if (e.searchT <= 0) {
      e.state = 'return';
      e.path = [];
      e.thinkT = 0;
    }
  }

  ensureEnemyPath(g, e);
  moveEnemy(g, e, dt);
}

function separateEnemies(g) {
  const L = g.level;
  for (let i = 0; i < g.enemies.length; i++) {
    for (let j = i + 1; j < g.enemies.length; j++) {
      const a = g.enemies[i];
      const b = g.enemies[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= 0.44 || d < 1e-5) continue;
      dx /= d;
      dy /= d;
      const push = (0.44 - d) * 0.5;
      const ax = a.x - dx * push;
      const ay = a.y - dy * push;
      const bx = b.x + dx * push;
      const by = b.y + dy * push;
      if (!circleHitsWall(L, ax, ay, 0.24)) { a.x = ax; a.y = ay; }
      if (!circleHitsWall(L, bx, by, 0.24)) { b.x = bx; b.y = by; }
    }
  }
}

function checkCapture(g) {
  if (g.ghost) return false;
  const p = g.player;
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (dist(e.x, e.y, p.x, p.y) < 0.58 && losClear(g.level, e.x, e.y, p.x, p.y)) {
      die();
      return true;
    }
  }
  return false;
}

// ============================================================================
// player + pulse
// ============================================================================
function tryPulse(g) {
  if (g.state !== 'play' || g.pulseCooldown > 0) return false;
  const p = g.player;
  g.pulse = { x: p.x, y: p.y, r: 0, maxR: PULSE_MAX, age: 0, active: true, alpha: 1 };
  g.pulseCooldown = PULSE_COOLDOWN;
  g.pulses++;
  g.shake = Math.max(g.shake, 0.13);
  emitNoise(g, p.x, p.y, PULSE_NOISE, 0.6, 'pulse');
  Sound.ping();
  g.ripples.push({ x: p.x, y: p.y, r: 0.1, speed: 5, life: 0.5, maxLife: 0.5, color: 'cyan', width: 1.5 });
  return true;
}

function updatePulse(g, dt) {
  if (g.pulseCooldown > 0) g.pulseCooldown = Math.max(0, g.pulseCooldown - dt);
  const p = g.pulse;
  if (!p) return;
  p.age += dt;
  if (p.active) {
    p.r += PULSE_SPEED * dt;
    if (p.r >= p.maxR) { p.r = p.maxR; p.active = false; }
    revealPulse(g, p);
  } else {
    p.alpha -= dt * 2.4;
    if (p.alpha <= 0) g.pulse = null;
  }
}

function updatePlayer(g, dt) {
  const L = g.level;
  const p = g.player;
  const mv = Input.getMove();
  const moving = mv.mag > 0.04;
  const sneaking = Input.sneak || mv.touchSneak;
  const speed = sneaking ? SNEAK_SPEED : RUN_SPEED;
  const targetVx = mv.x * speed;
  const targetVy = mv.y * speed;
  const accel = moving ? 24 : 18;
  p.vx = approach(p.vx, targetVx, accel * dt);
  p.vy = approach(p.vy, targetVy, accel * dt);

  const nx = p.x + p.vx * dt;
  if (!circleHitsWall(L, nx, p.y, 0.25)) p.x = nx; else p.vx = 0;
  const ny = p.y + p.vy * dt;
  if (!circleHitsWall(L, p.x, ny, 0.25)) p.y = ny; else p.vy = 0;

  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 0.25) p.aim = Math.atan2(p.vy, p.vx);

  const running = sp > 1.6 && !sneaking;
  if (running) {
    g.stepT -= dt;
    p.loud = Math.min(1, p.loud + dt * 5);
    if (g.stepT <= 0) {
      g.stepT = 0.45;
      emitNoise(g, p.x, p.y, FOOTSTEP_RADIUS, 0.03, 'step');
      Sound.step();
    }
  } else {
    p.loud = Math.max(0, p.loud - dt * 2.8);
    g.stepT = Math.max(0, Math.min(g.stepT, 0.15));
  }

  g.trailT -= dt;
  if (g.trailT <= 0 && sp > 0.2) {
    g.trailT = 0.045;
    p.trail.push({ x: p.x, y: p.y, a: 1 });
    if (p.trail.length > 16) p.trail.shift();
  }
  for (let i = 0; i < p.trail.length; i++) p.trail[i].a -= dt * 1.8;

  if (Input.consumePulse()) tryPulse(g);

  g.exitHintT = Math.max(0, g.exitHintT - dt);
  for (let i = 0; i < g.cores.length; i++) {
    const c = g.cores[i];
    if (c.taken) continue;
    if (dist(p.x, p.y, c.x, c.y) < 0.56) {
      c.taken = true;
      c.seen = true;
      g.collected++;
      Sound.pickup();
      emitNoise(g, c.x, c.y, 7, 0.08, 'pickup');
      g.ripples.push({ x: c.x, y: c.y, r: 0.2, speed: 4, life: 0.8, maxLife: 0.8, color: 'amber', width: 1.5 });
      burst(g, c.x, c.y, 'amber', 12, 2.5);
      if (!g.probe) toast('共鸣核心 ' + g.collected + ' / ' + g.cores.length);
      if (g.collected >= g.cores.length) {
        g.exitUnlocked = true;
        if (!g.probe) toast('出口已开启');
        Sound.unlock();
        emitNoise(g, L.exit.x, L.exit.y, 6, 0.22, 'unlock');
        g.ripples.push({ x: L.exit.x, y: L.exit.y, r: 0.3, speed: 5, life: 1.2, maxLife: 1.2, color: 'amber', width: 2 });
      }
    }
  }

  if (L.exit) {
    const d = dist(p.x, p.y, L.exit.x, L.exit.y);
    if (g.exitUnlocked && d < 0.6) {
      winLevel();
      return;
    }
    if (!g.exitUnlocked && d < 1.5 && g.exitHintT <= 0) {
      g.exitHintT = 3;
      if (!g.probe) {
        const left = g.cores.length - g.collected;
        toast('出口锁着 · 还差 ' + left + ' 个核心');
      }
    }
  }

  if (g.introT > 0) {
    g.introT -= dt;
    if (g.introT <= 0) $('intro').classList.remove('on');
    else if (moving) g.introT = Math.min(g.introT, 0.7);
  }
}

function burst(g, x, y, color, count, power) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const s = power * (0.3 + Math.random() * 0.9);
    g.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.45 + Math.random() * 0.65,
      maxLife: 1.1,
      color,
      size: 0.035 + Math.random() * 0.055
    });
  }
}

function updateEffects(g, dt) {
  g.shake = Math.max(0, g.shake - dt * 2.6);
  for (let i = 0; i < g.ripples.length; i++) {
    const r = g.ripples[i];
    r.r += (r.speed || 3.5) * dt;
    r.life -= dt;
  }
  g.ripples = g.ripples.filter(r => r.life > 0);
  for (let i = 0; i < g.particles.length; i++) {
    const p = g.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  g.particles = g.particles.filter(p => p.life > 0);
}

function updateVisibility(g, dt) {
  g.visT -= dt;
  const p = g.player;
  if (g.visT <= 0 || dist(p.x, p.y, g.lastPX, g.lastPY) > 0.12) {
    recomputeVisibility(g);
    g.visT = 0.1;
    g.lastPX = p.x;
    g.lastPY = p.y;
  }
}

function updateGame(dt) {
  const g = game;
  if (g.state !== 'play') return;
  g.time += dt;
  updateVisibility(g, dt);
  updatePulse(g, dt);
  updateNoises(g, dt);
  updatePlayer(g, dt);
  if (g.state !== 'play') return;
  for (let i = 0; i < g.enemies.length; i++) updateEnemy(g, g.enemies[i], dt);
  separateEnemies(g);
  if (checkCapture(g)) return;
  g.hudT -= dt;
  if (g.hudT <= 0) {
    g.hudT = 0.12;
    updateHUD();
  }
}

// ============================================================================
// level lifecycle
// ============================================================================
function beginLevel(raw, index, mode, opts) {
  opts = opts || {};
  const g = game;
  const L = compileLevel(raw);
  g.level = L;
  g.levelIndex = index;
  g.mode = mode;
  g.player = {
    x: L.spawn.x,
    y: L.spawn.y,
    vx: 0,
    vy: 0,
    aim: -Math.PI / 2,
    loud: 0,
    trail: []
  };
  g.enemies = L.enemies;
  g.cores = L.cores;
  g.collected = 0;
  g.exitUnlocked = false;
  g.time = 0;
  g.pulses = 0;
  g.pulse = null;
  g.pulseCooldown = 0;
  g.stepT = 0;
  g.trailT = 0;
  g.hudT = 0;
  g.visT = 0;
  g.lastPX = L.spawn.x;
  g.lastPY = L.spawn.y;
  g.vis = new Uint8Array(L.w * L.h);
  g.wallSeen = new Float32Array(L.w * L.h).fill(-99);
  g.floorSeen = new Float32Array(L.w * L.h).fill(-99);
  g.noises = [];
  g.ripples = [];
  g.particles = [];
  g.shake = 0;
  g.introT = 0;
  g.deadAt = 0;
  g.autoT = 0;
  g.exitHintT = 0;
  g.state = 'play';
  g.probe = !!opts.probe;

  recomputeVisibility(g);
  silentReveal(g, 6.5);
  g.cam = cameraFor(g);

  if (!opts.noUI) {
    enterPlayUI();
    if (opts.intro !== false) showIntro(raw, index, mode);
    updateHUD(true);
  }
  if (!opts.silent) Sound.setAmbient(true);
  if (!opts.noUI && Input.coarse && index === 0 && mode === 'campaign') {
    try {
      if (!localStorage.getItem('echo-touch-tip')) {
        localStorage.setItem('echo-touch-tip', '1');
        setTimeout(() => toast('左半屏拖动移动 · 右下角发声呐', 3200), 1400);
      }
    } catch (e) { /* ignore */ }
  }
  return g;
}

function startLevel(index, mode) {
  mode = mode || 'campaign';
  const raw = LEVELS[index];
  if (!raw) return;
  beginLevel(raw, index, mode, {});
}

function showIntro(raw, index, mode) {
  if (mode === 'endless') {
    $('intro-kicker').textContent = 'DEPTH ' + pad2(game.depth);
    $('intro-name').textContent = '第 ' + game.depth + ' 层';
    $('intro-hint').textContent = '收齐核心，找到出口。越深，听者越多。';
  } else {
    let hint = raw.hint || '';
    if (Input.coarse) {
      if (index === 0) hint = '左半屏拖动移动 · 右下角发出声呐';
      else if (index === 3) hint = '轻推摇杆潜行无声；推满会留下脚步声';
    }
    $('intro-kicker').textContent = 'LEVEL ' + pad2(index + 1);
    $('intro-name').textContent = raw.name || '回声';
    $('intro-hint').textContent = hint;
  }
  const el = $('intro');
  el.classList.add('on');
  game.introT = 3.4;
}

function winLevel() {
  const g = game;
  if (g.state !== 'play') return;
  const L = g.level;
  g.state = 'win';
  g.introT = 0;
  $('intro').classList.remove('on');
  setTouchUI(false);
  Sound.setAmbient(false);
  Sound.win();

  if (g.probe) return;

  const t = g.time;
  const labels = document.querySelectorAll('.stats span');
  if (g.mode === 'campaign') {
    const id = L.raw.id || ('level-' + g.levelIndex);
    const prev = save.best[id];
    const isBest = prev === undefined || t < prev;
    if (isBest) save.best[id] = Math.round(t * 10) / 10;
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length - 1, g.levelIndex + 1));
    persist();
    labels[0].textContent = '用时';
    labels[1].textContent = '最佳';
    labels[2].textContent = '回声';
    $('win-kicker').textContent = isBest ? 'NEW ECHO' : 'ECHO COMPLETE';
    $('win-title').textContent = '回声消散';
    $('win-sub').textContent = isBest ? '这是你留下的最短回声。' : '你又把一小块黑暗点亮了。';
    $('win-time').textContent = fmtTime(t);
    $('win-best').textContent = fmtTime(save.best[id]);
    $('win-pulses').textContent = String(g.pulses);
    $('btn-next').textContent = g.levelIndex >= LEVELS.length - 1 ? '回到标题' : '下一关';
    $('btn-replay').style.display = '';
  } else {
    const gain = Math.round(g.depth * 100 + Math.max(0, 120 - t) * 2);
    g.score += gain;
    save.endlessBest = Math.max(save.endlessBest || 0, g.score);
    persist();
    labels[0].textContent = '用时';
    labels[1].textContent = '得分';
    labels[2].textContent = '回声';
    $('win-kicker').textContent = 'DEPTH CLEARED';
    $('win-title').textContent = '第 ' + g.depth + ' 层已平静';
    $('win-sub').textContent = '本层 +' + gain + ' · 总分 ' + g.score;
    $('win-time').textContent = fmtTime(t);
    $('win-best').textContent = String(g.score);
    $('win-pulses').textContent = String(g.pulses);
    $('btn-next').textContent = '下一层';
    $('btn-replay').style.display = 'none';
  }
  updateHUD(true);
  showScreen('win');
  document.body.classList.add('in-play');
}

function die() {
  const g = game;
  if (g.state !== 'play') return;
  g.state = 'dead';
  g.introT = 0;
  $('intro').classList.remove('on');
  setTouchUI(false);
  Sound.setAmbient(false);
  Sound.caught();
  g.shake = 0.55;
  burst(g, g.player.x, g.player.y, 'red', 28, 4);
  burst(g, g.player.x, g.player.y, 'white', 10, 2.5);

  if (g.probe) return;

  if (g.mode === 'endless') {
    save.endlessBest = Math.max(save.endlessBest || 0, g.score);
    persist();
    $('dead-sub').textContent = '深度 ' + g.depth + ' · 分数 ' + g.score + '。黑暗记住了你。';
    $('auto-line').textContent = '按 R 从第一层重新开始';
    g.deadAt = 0;
  } else {
    const lines = ['轻一点。再轻一点。', '它听见的，是你最后那一步。', '这次先躲开，再点亮。', '重来一次。黑暗不会记得。'];
    $('dead-sub').textContent = lines[Math.floor(Math.random() * lines.length)];
    g.deadAt = performance.now() + 1600;
    g.autoT = 0;
    $('auto-line').textContent = '1.6 秒后重试';
  }
  updateHUD(true);
  showScreen('dead');
  document.body.classList.add('in-play');
  setTimeout(() => {
    const screen = $('screen-dead');
    screen.classList.remove('is-dead');
    void screen.offsetWidth;
    screen.classList.add('is-dead');
  }, 10);
}

function retryLevel() {
  if (game.mode === 'endless') {
    startEndless();
  } else {
    startLevel(game.levelIndex, 'campaign');
  }
}

function nextLevel() {
  const g = game;
  if (g.mode === 'endless') {
    g.depth++;
    startEndlessLayer();
    return;
  }
  if (g.levelIndex >= LEVELS.length - 1) {
    showTitle();
  } else {
    startLevel(g.levelIndex + 1, 'campaign');
  }
}

function setPause(on) {
  const g = game;
  if (on) {
    if (g.state !== 'play') return;
    g.state = 'paused';
    Input.clear();
    setTouchUI(false);
    Sound.setAmbient(false);
    showScreen('pause');
    document.body.classList.add('in-play');
    updateHUD(true);
  } else if (g.state === 'paused') {
    hideScreens();
    g.state = 'play';
    Sound.setAmbient(true);
    setTouchUI(true);
    document.body.classList.add('in-play');
  }
}

// ============================================================================
// endless generation
// ============================================================================
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function bfsDist(grid, w, h, sx, sy) {
  const out = new Int32Array(w * h).fill(-1);
  const q = [sy * w + sx];
  out[sy * w + sx] = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + dirs[d][0];
      const ny = cy + dirs[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] === '#') continue;
      const ni = ny * w + nx;
      if (out[ni] !== -1) continue;
      out[ni] = out[cur] + 1;
      q.push(ni);
    }
  }
  return out;
}

function generateRaw(seed, depth) {
  const fallback = LEVELS[Math.min(LEVELS.length - 1, 7)];
  for (let attempt = 0; attempt < 40; attempt++) {
    const rnd = mulberry32((seed + attempt * 7919) >>> 0);
    const w = 19 + 2 * Math.min(6, depth - 1);
    const h = 13 + 2 * Math.min(4, depth - 1);
    const grid = Array.from({ length: h }, () => new Array(w).fill('#'));
    grid[1][1] = '.';
    const stack = [[1, 1]];
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const x = cur[0];
      const y = cur[1];
      const order = shuffle(dirs.slice(), rnd);
      let moved = false;
      for (let i = 0; i < order.length; i++) {
        const dx = order[i][0];
        const dy = order[i][1];
        const nx = x + dx;
        const ny = y + dy;
        if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && grid[ny][nx] === '#') {
          grid[y + dy / 2][x + dx / 2] = '.';
          grid[ny][nx] = '.';
          stack.push([nx, ny]);
          moved = true;
          break;
        }
      }
      if (!moved) stack.pop();
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (grid[y][x] !== '#') continue;
        const hf = grid[y][x - 1] === '.' && grid[y][x + 1] === '.';
        const vf = grid[y - 1][x] === '.' && grid[y + 1][x] === '.';
        if ((hf || vf) && rnd() < 0.16) grid[y][x] = '.';
      }
    }

    const dists = bfsDist(grid, w, h, 1, 1);
    let exit = null;
    let far = -1;
    const floorCells = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (grid[y][x] !== '.') continue;
        const d = dists[y * w + x];
        if (d < 0) continue;
        floorCells.push({ x, y, d });
        if (d > far) { far = d; exit = { x, y }; }
      }
    }
    if (!exit || floorCells.length < 24) continue;

    const coreCount = Math.min(5, 3 + Math.floor(depth / 2));
    const candidates = floorCells
      .filter(c => c.d >= 4 && !(c.x === 1 && c.y === 1) && !(c.x === exit.x && c.y === exit.y))
      .sort((a, b) => {
        const da = degree(grid, a.x, a.y);
        const db = degree(grid, b.x, b.y);
        if (da !== db) return da - db;
        return b.d - a.d;
      });
    const cores = [];
    for (let i = 0; i < candidates.length && cores.length < coreCount; i++) {
      const c = candidates[i];
      let ok = true;
      for (let j = 0; j < cores.length; j++) {
        if (Math.hypot(cores[j].x - c.x, cores[j].y - c.y) < 4.5) { ok = false; break; }
      }
      if (!ok) continue;
      if (Math.hypot(c.x - 1, c.y - 1) < 4) continue;
      cores.push(c);
    }
    for (let i = 0; i < candidates.length && cores.length < coreCount; i++) {
      const c = candidates[i];
      if (cores.some(k => k.x === c.x && k.y === c.y)) continue;
      cores.push(c);
    }
    if (cores.length < 2) continue;

    const enemyCount = Math.min(4, 1 + Math.floor(depth / 2));
    const enemyCells = floorCells.filter(c => c.d > 7 && !cores.some(k => k.x === c.x && k.y === c.y) && !(c.x === exit.x && c.y === exit.y));
    if (enemyCells.length < enemyCount * 2) continue;
    const routes = [];
    const used = new Set();
    let attempts = 0;
    while (routes.length < enemyCount && attempts++ < 80) {
      const p0 = enemyCells[Math.floor(rnd() * enemyCells.length)];
      const key = p0.x + ',' + p0.y;
      if (used.has(key)) continue;
      used.add(key);
      const route = [p0];
      for (let k = 0; k < 2; k++) {
        const p1 = enemyCells[Math.floor(rnd() * enemyCells.length)];
        if (route.some(q => q.x === p1.x && q.y === p1.y)) continue;
        route.push(p1);
      }
      if (route.length < 3) continue;
      routes.push(route);
    }
    if (routes.length < enemyCount) continue;

    const rows = grid.map(r => r.slice());
    rows[1][1] = 'S';
    rows[exit.y][exit.x] = 'X';
    cores.forEach(c => { rows[c.y][c.x] = 'C'; });
    routes.forEach((route, i) => {
      route.forEach(p => { rows[p.y][p.x] = String(i + 1); });
    });

    // soundproof walls: purely a sound barrier, still solid
    const soundCount = 3 + Math.min(14, depth * 2);
    for (let i = 0; i < soundCount; i++) {
      const sy = 1 + Math.floor(rnd() * (h - 2));
      const sx = 1 + Math.floor(rnd() * (w - 2));
      if (rows[sy][sx] === '#' && degree(grid, sx, sy) > 0 &&
          !(Math.abs(sx - 1) + Math.abs(sy - 1) < 3) &&
          (sx !== exit.x || sy !== exit.y)) {
        rows[sy][sx] = '~';
      }
    }

    const strRows = rows.map(r => r.join(''));
    const raw = {
      id: 'endless-' + depth + '-' + seed,
      name: '第 ' + depth + ' 层',
      hint: '收齐核心，找到出口。',
      par: 80 + depth * 10,
      rows: strRows,
      enemySpecs: routes.map((r, i) => (depth >= 6 && i === routes.length - 1 ? { elite: true } : {}))
    };
    const compiled = compileLevel(raw);
    if (validateCompiled(compiled).length === 0) {
      raw.attempts = attempt + 1;
      return raw;
    }
  }
  const raw = JSON.parse(JSON.stringify(fallback));
  raw.id = 'endless-fallback-' + depth;
  raw.name = '第 ' + depth + ' 层';
  raw.hint = '收齐核心，找到出口。';
  raw.attempts = 40;
  return raw;
}

function degree(grid, x, y) {
  let n = 0;
  if (grid[y][x - 1] === '.') n++;
  if (grid[y][x + 1] === '.') n++;
  if (grid[y - 1][x] === '.') n++;
  if (grid[y + 1][x] === '.') n++;
  return n;
}

function startEndless() {
  game.mode = 'endless';
  game.depth = 1;
  game.score = 0;
  game.runSeed = ((Date.now() % 1000000000) ^ (Math.random() * 0x7fffffff)) | 0;
  Sound.ensure();
  startEndlessLayer();
}

function startEndlessLayer() {
  const raw = generateRaw(game.runSeed + game.depth * 1013, game.depth);
  beginLevel(raw, -1, 'endless', {});
}

// ============================================================================
// rendering
// ============================================================================
const GLOW = {};
function makeGlow(rgb) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.95)');
  grd.addColorStop(0.22, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.5)');
  grd.addColorStop(0.55, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.14)');
  grd.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
}
function initGlow() {
  Object.keys(RGB).forEach(k => { GLOW[k] = makeGlow(RGB[k]); });
}

const DUST = [];
function initDust() {
  for (let i = 0; i < 70; i++) {
    DUST.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1.6,
      alpha: 0.04 + Math.random() * 0.14,
      speed: 0.3 + Math.random() * 1.2,
      phase: Math.random() * TAU
    });
  }
}

let menuLevel = null;
let menuTime = 0;
let frameDt = 1 / 60;

function resize() {
  view.w = Math.max(320, window.innerWidth);
  view.h = Math.max(320, window.innerHeight);
  view.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const cw = Math.floor(view.w * view.dpr);
  const ch = Math.floor(view.h * view.dpr);
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
}

function cameraFor(g) {
  const L = g.level;
  const zx = view.w / (T * 20);
  const zy = view.h / (T * 13);
  const zoom = clamp(Math.min(zx, zy), 0.78, 1.7);
  const halfW = view.w / (2 * zoom * T);
  const halfH = view.h / (2 * zoom * T);
  let x = g.player.x;
  let y = g.player.y;
  if (L.w <= halfW * 2) x = L.w / 2;
  else x = clamp(x, halfW + 0.2, L.w - halfW - 0.2);
  if (L.h <= halfH * 2) y = L.h / 2;
  else y = clamp(y, halfH + 0.2, L.h - halfH - 0.2);
  return { x, y, zoom };
}

function drawBackground() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, view.w, view.h);
  const grd = ctx.createRadialGradient(view.w * 0.5, view.h * 0.44, 0, view.w * 0.5, view.h * 0.44, Math.max(view.w, view.h) * 0.72);
  grd.addColorStop(0, 'rgba(12,30,44,0.30)');
  grd.addColorStop(0.55, 'rgba(5,11,19,0.12)');
  grd.addColorStop(1, 'rgba(2,4,8,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, view.w, view.h);
}

function drawDust(strong) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < DUST.length; i++) {
    const d = DUST[i];
    const x = ((d.x * view.w + menuTime * d.speed * 9) % view.w + view.w) % view.w;
    const y = (d.y * view.h + Math.sin(menuTime * 0.18 + d.phase) * 9 + view.h) % view.h;
    const a = d.alpha * (0.55 + 0.45 * Math.sin(menuTime * 0.7 + d.phase)) * (strong ? 1 : 0.4);
    ctx.fillStyle = rgba('cyan', a);
    ctx.fillRect(x, y, d.size, d.size);
  }
  ctx.restore();
}

function drawMenu() {
  drawBackground();
  drawDust(true);
  if (!menuLevel) return;
  const L = menuLevel;
  const zoom = Math.min(view.w / (L.w * T), view.h / (L.h * T)) * 0.92;
  const cx = L.w / 2;
  const cy = L.h / 2;
  const px = 1 / (zoom * T);
  const mt = (menuTime % 4.6) / 4.6;
  const waveR = mt * 13;
  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(zoom * T, zoom * T);
  ctx.translate(-cx, -cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let ty = 0; ty < L.h; ty++) {
    for (let tx = 0; tx < L.w; tx++) {
      const t = L.tile[ty * L.w + tx];
      if (!t) continue;
      const dc = dist(tx + 0.5, ty + 0.5, cx, cy);
      let a = 0.10 * Math.max(0, 1 - dc / 13);
      a += Math.exp(-Math.pow((dc - waveR) / 0.9, 2)) * (1 - mt) * 0.7;
      if (a < 0.015) continue;
      ctx.beginPath();
      if (L.tile[ty * L.w + tx - L.w] === 0 && ty > 0) { ctx.moveTo(tx, ty); ctx.lineTo(tx + 1, ty); }
      if (ty < L.h - 1 && L.tile[ty * L.w + tx + L.w] === 0) { ctx.moveTo(tx, ty + 1); ctx.lineTo(tx + 1, ty + 1); }
      if (tx > 0 && L.tile[ty * L.w + tx - 1] === 0) { ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + 1); }
      if (tx < L.w - 1 && L.tile[ty * L.w + tx + 1] === 0) { ctx.moveTo(tx + 1, ty); ctx.lineTo(tx + 1, ty + 1); }
      const col = t === 2 ? 'violet' : 'cyan';
      ctx.strokeStyle = rgba(col, a * 0.2);
      ctx.lineWidth = 5 * px;
      ctx.stroke();
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = 1.4 * px;
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba('cyan', 0.24 * (1 - mt));
  ctx.lineWidth = 1.4 * px;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, waveR), 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba('cyan', 0.1 * (1 - mt));
  ctx.lineWidth = 5 * px;
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  ctx.drawImage(GLOW.cyan, cx - 1.2, cy - 1.2, 2.4, 2.4);
  ctx.restore();
  ctx.restore();
}

function drawGame(dt) {
  drawBackground();
  drawDust(false);
  const g = game;
  const L = g.level;
  if (!L) { drawMenu(); return; }
  const target = cameraFor(g);
  const k = 1 - Math.exp(-dt * 7.5);
  g.cam.x = lerp(g.cam.x, target.x, k);
  g.cam.y = lerp(g.cam.y, target.y, k);
  g.cam.zoom = lerp(g.cam.zoom, target.zoom, k);
  const zoom = g.cam.zoom;
  const halfW = view.w / (2 * zoom * T);
  const halfH = view.h / (2 * zoom * T);
  let sx = 0;
  let sy = 0;
  if (g.shake > 0 && save.settings.motion) {
    sx = (Math.random() * 2 - 1) * g.shake * 0.16;
    sy = (Math.random() * 2 - 1) * g.shake * 0.16;
  }

  ctx.save();
  ctx.translate(view.w / 2 + sx, view.h / 2 + sy);
  ctx.scale(zoom * T, zoom * T);
  ctx.translate(-g.cam.x, -g.cam.y);
  const px = 1 / (zoom * T);
  drawFloor(g, halfW, halfH, px);
  drawWalls(g, halfW, halfH, px);
  drawPulse(g, px);
  drawExit(g, px);
  drawCores(g, px);
  drawEnemies(g, px);
  drawPlayer(g, px);
  drawRipples(g, px);
  drawParticles(g);
  ctx.restore();

  drawExitArrow(g);
}

function drawFloor(g, halfW, halfH, px) {
  const L = g.level;
  const p = g.pulse;
  const x0 = Math.max(0, Math.floor(g.cam.x - halfW) - 1);
  const x1 = Math.min(L.w - 1, Math.ceil(g.cam.x + halfW) + 1);
  const y0 = Math.max(0, Math.floor(g.cam.y - halfH) - 1);
  const y1 = Math.min(L.h - 1, Math.ceil(g.cam.y + halfH) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * L.w + tx;
      if (L.tile[i] !== 0) continue;
      let a = 0;
      if (g.vis[i]) {
        a = 0.14;
        if (p && p.active) {
          const d = dist(tx + 0.5, ty + 0.5, p.x, p.y);
          if (d <= p.r) a += Math.exp(-Math.pow((d - p.r) / 0.8, 2)) * 0.55;
        }
      } else {
        const age = g.time - g.floorSeen[i];
        if (age < MEMORY_T) a = (1 - age / MEMORY_T) * 0.07;
      }
      if (a <= 0.012) continue;
      ctx.fillStyle = rgba('cyan', a);
      const s = 2.2 * px;
      ctx.fillRect(tx + 0.5 - s / 2, ty + 0.5 - s / 2, s, s);
    }
  }
}

function drawWalls(g, halfW, halfH, px) {
  const L = g.level;
  const p = g.pulse;
  const x0 = Math.max(0, Math.floor(g.cam.x - halfW) - 1);
  const x1 = Math.min(L.w - 1, Math.ceil(g.cam.x + halfW) + 1);
  const y0 = Math.max(0, Math.floor(g.cam.y - halfH) - 1);
  const y1 = Math.min(L.h - 1, Math.ceil(g.cam.y + halfH) + 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * L.w + tx;
      const t = L.tile[i];
      if (!t) continue;
      const up = ty > 0 ? L.tile[i - L.w] : 1;
      const down = ty < L.h - 1 ? L.tile[i + L.w] : 1;
      const left = tx > 0 ? L.tile[i - 1] : 1;
      const right = tx < L.w - 1 ? L.tile[i + 1] : 1;
      const adjVis =
        (up === 0 && g.vis[i - L.w]) ||
        (down === 0 && g.vis[i + L.w]) ||
        (left === 0 && g.vis[i - 1]) ||
        (right === 0 && g.vis[i + 1]);
      const age = g.time - g.wallSeen[i];
      const mem = age < MEMORY_T ? (1 - age / MEMORY_T) * MEMORY_RATE : 0;
      let aWave = 0;
      if (adjVis && p && p.active) {
        const d = dist(tx + 0.5, ty + 0.5, p.x, p.y);
        aWave = Math.exp(-Math.pow((d - p.r) / 0.85, 2)) * (1 - p.r / p.maxR * 0.5);
      }
      let aAmb = 0;
      if (adjVis) {
        const d = dist(tx + 0.5, ty + 0.5, g.player.x, g.player.y);
        if (d < 2.1) aAmb = 0.2 * (1 - d / 2.1);
      }
      const a = clamp(mem + aWave + aAmb, 0, 1);
      if (a < 0.015) continue;

      let path = false;
      ctx.beginPath();
      if (up === 0) { ctx.moveTo(tx, ty); ctx.lineTo(tx + 1, ty); path = true; }
      if (down === 0) { ctx.moveTo(tx, ty + 1); ctx.lineTo(tx + 1, ty + 1); path = true; }
      if (left === 0) { ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + 1); path = true; }
      if (right === 0) { ctx.moveTo(tx + 1, ty); ctx.lineTo(tx + 1, ty + 1); path = true; }
      if (!path) continue;
      const col = t === 2 ? 'violet' : 'cyan';
      ctx.strokeStyle = rgba(col, a * 0.18);
      ctx.lineWidth = 5 * px;
      ctx.stroke();
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = 1.45 * px;
      ctx.stroke();
    }
  }
}

function drawPulse(g, px) {
  const p = g.pulse;
  if (!p) return;
  const a = p.alpha;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba('cyan', 0.5 * a);
  ctx.lineWidth = 2.4 * px;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba('cyan', 0.14 * a);
  ctx.lineWidth = 8 * px;
  ctx.stroke();
  ctx.strokeStyle = rgba('white', 0.2 * a);
  ctx.lineWidth = 0.9 * px;
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(0.01, p.r - 0.18), 0, TAU);
  ctx.stroke();
  const flare = 2.6 * a + 0.35;
  ctx.drawImage(GLOW.cyan, p.x - flare / 2, p.y - flare / 2, flare, flare);
  ctx.restore();
}

function drawExit(g, px) {
  const L = g.level;
  const e = L.exit;
  if (!e) return;
  const d = dist(g.player.x, g.player.y, e.x, e.y);
  const seen = g.vis[e.ty * L.w + e.tx];
  if (!g.exitUnlocked && (!seen || d > 3.4)) return;
  ctx.save();
  const col = g.exitUnlocked ? 'amber' : 'deep';
  const glow = g.exitUnlocked ? 2.2 : 1.0;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(GLOW[col], e.x - glow, e.y - glow, glow * 2, glow * 2);
  ctx.restore();

  ctx.save();
  ctx.translate(e.x, e.y);
  if (g.exitUnlocked) {
    const ph = (g.time % 2.8) / 2.8;
    ctx.strokeStyle = rgba('amber', (1 - ph) * 0.34);
    ctx.lineWidth = 1.4 * px;
    ctx.beginPath();
    ctx.arc(0, 0, 0.35 + ph * 4.6, 0, TAU);
    ctx.stroke();
    ctx.rotate(g.time * 0.7);
    ctx.strokeStyle = rgba('amber', 0.85);
    ctx.lineWidth = 1.6 * px;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 0.34, i * Math.PI, i * Math.PI + Math.PI * 0.58);
      ctx.stroke();
    }
    ctx.rotate(-g.time * 0.7);
    ctx.fillStyle = rgba('amber', 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, 0.1, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = rgba('amber', 0.28);
    ctx.lineWidth = 1.2 * px;
    ctx.beginPath();
    ctx.arc(0, 0, 0.32, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = rgba('amber', 0.22);
    ctx.fillRect(-0.08, -0.16, 0.16, 0.32);
  }
  ctx.restore();
}

function drawCores(g, px) {
  const L = g.level;
  const p = g.player;
  for (let i = 0; i < g.cores.length; i++) {
    const c = g.cores[i];
    if (c.taken) continue;
    const seen = g.vis[c.ty * L.w + c.tx];
    const near = dist(p.x, p.y, c.x, c.y) < 2.8;
    if (!c.seen && !(seen && near)) continue;
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 2.6 + c.phase);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gs = 0.95 + pulse * 0.35;
    ctx.drawImage(GLOW.amber, c.x - gs, c.y - gs, gs * 2, gs * 2);
    ctx.restore();
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(g.time * 0.9 + c.phase);
    ctx.fillStyle = rgba('amber', 0.9);
    ctx.beginPath();
    const r = 0.16 + pulse * 0.025;
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba('white', 0.6);
    ctx.lineWidth = 0.8 * px;
    ctx.stroke();
    ctx.restore();
    if (c.seen) {
      const ph = ((g.time + c.phase) % 2.4) / 2.4;
      ctx.strokeStyle = rgba('amber', (1 - ph) * 0.2);
      ctx.lineWidth = 0.8 * px;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 0.25 + ph * 1.2, 0, TAU);
      ctx.stroke();
    }
  }
}

function drawEnemies(g, px) {
  const L = g.level;
  const p = g.player;
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    const prox = dist(e.x, e.y, p.x, p.y) < 2.35 && losClear(L, e.x, e.y, p.x, p.y);
    const seen = g.time - e.lastSeen < 1.7;
    const charge = e.scanCharge > 0 && dist(e.x, e.y, p.x, p.y) < 15;
    if (!seen && !prox && !charge) continue;
    let a = 0.9;
    if (seen) a = clamp(1 - (g.time - e.lastSeen) / 1.7, 0.18, 1) * 0.95;
    else if (prox) a = 0.58;
    else a = 0.3;

    if (charge) {
      const progress = 1 - e.scanCharge;
      ctx.save();
      ctx.strokeStyle = rgba('red', 0.2 + progress * 0.35);
      ctx.lineWidth = 1.4 * px;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 1.3 + progress * 0.9, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba('red', (1 - progress) * 0.5);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 2.2 - progress * 0.8, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (!seen && !prox) continue;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gs = e.elite ? 1.95 : 1.3;
    ctx.drawImage(GLOW.red, e.x - gs, e.y - gs, gs * 2, gs * 2);
    ctx.restore();

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.face || 0);
    ctx.fillStyle = rgba('red', a);
    const r = e.elite ? 0.26 : 0.21;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.75, r * 0.85);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r * 0.75, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba('white', a * 0.55);
    ctx.lineWidth = 0.8 * px;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, TAU);
    ctx.fillStyle = rgba('white', a * 0.8);
    ctx.fill();
    if (e.elite) {
      ctx.strokeStyle = rgba('red', a * 0.8);
      ctx.lineWidth = 0.9 * px;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    if (e.alertT > 0) {
      const ph = 1 - clamp(e.alertT / 1.25, 0, 1);
      ctx.strokeStyle = rgba('red', (1 - ph) * 0.45);
      ctx.lineWidth = 1.1 * px;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 0.3 + ph * 1.5, 0, TAU);
      ctx.stroke();
    }
  }
}

function drawPlayer(g, px) {
  const p = g.player;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(GLOW.cyan, p.x - 1.4, p.y - 1.4, 2.8, 2.8);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgba('cyan', 0.08 + p.loud * 0.05);
  ctx.lineWidth = 0.9 * px;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 0.42 + p.loud * FOOTSTEP_RADIUS * 0.32, 0, TAU);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < p.trail.length; i++) {
    const t = p.trail[i];
    if (t.a <= 0) continue;
    ctx.fillStyle = rgba('cyan', t.a * 0.28);
    ctx.beginPath();
    ctx.arc(t.x, t.y, 0.09 * t.a + 0.02, 0, TAU);
    ctx.fill();
  }

  const cd = 1 - g.pulseCooldown / PULSE_COOLDOWN;
  ctx.strokeStyle = rgba('cyan', 0.3);
  ctx.lineWidth = 1.1 * px;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 0.39, -Math.PI / 2, -Math.PI / 2 + TAU * cd);
  ctx.stroke();

  ctx.fillStyle = rgba('white', 0.95);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 0.19, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('cyan', 0.9);
  ctx.lineWidth = 0.9 * px;
  ctx.stroke();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  ctx.fillStyle = rgba('cyan', 0.9);
  ctx.beginPath();
  ctx.moveTo(0.34, 0);
  ctx.lineTo(0.17, 0.1);
  ctx.lineTo(0.17, -0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRipples(g, px) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < g.ripples.length; i++) {
    const r = g.ripples[i];
    if (r.life <= 0) continue;
    const a = clamp(r.life / (r.maxLife || 1), 0, 1);
    ctx.strokeStyle = rgba(r.color || 'cyan', a * 0.42);
    ctx.lineWidth = (r.width || 1) * px;
    ctx.beginPath();
    ctx.arc(r.x, r.y, Math.max(0.02, r.r), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(g) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < g.particles.length; i++) {
    const p = g.particles[i];
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = rgba(p.color, a * 0.85);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawExitArrow(g) {
  if (!g.exitUnlocked || !g.level || !g.level.exit) return;
  const e = g.level.exit;
  const sx = (e.x - g.cam.x) * g.cam.zoom * T + view.w / 2;
  const sy = (e.y - g.cam.y) * g.cam.zoom * T + view.h / 2;
  const margin = 48;
  if (sx > margin && sx < view.w - margin && sy > margin && sy < view.h - margin) return;
  const cx = view.w / 2;
  const cy = view.h / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const rx = Math.min(view.w / 2 - margin, Math.abs(Math.cos(ang)) > 0.001 ? Math.abs(cx - margin) / Math.abs(Math.cos(ang)) : Infinity);
  const ry = Math.min(view.h / 2 - margin, Math.abs(Math.sin(ang)) > 0.001 ? Math.abs(cy - margin) / Math.abs(Math.sin(ang)) : Infinity);
  const rr = Math.min(rx, ry);
  const ax = cx + Math.cos(ang) * rr;
  const ay = cy + Math.sin(ang) * rr;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = rgba('amber', 0.8);
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-7, 6.5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, -6.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = '10px ui-monospace, Consolas, monospace';
  ctx.fillStyle = rgba('amber', 0.62);
  ctx.textAlign = 'center';
  ctx.fillText('出口', ax, ay + (Math.sin(ang) >= 0 ? 22 : -14));
  ctx.restore();
}

function render(dt) {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (game.state === 'title' || game.state === 'levels' || game.state === 'settings') {
    drawMenu();
  } else if (game.level) {
    drawGame(dt);
  } else {
    drawMenu();
  }
}

// ============================================================================
// UI
// ============================================================================
function hideScreens() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
}
function showScreen(name) {
  hideScreens();
  const el = $('screen-' + name);
  if (el) el.classList.add('on');
}
function enterPlayUI() {
  hideScreens();
  document.body.classList.add('in-play');
  setTouchUI(true);
}
function setTouchUI(on) {
  const el = $('touch');
  if (!el) return;
  el.classList.toggle('on', !!(on && Input.coarse));
  if (!on) {
    $('stick').classList.remove('on');
    Input.stickX = 0;
    Input.stickY = 0;
    Input.stickMag = 0;
    Input.touchActive = false;
    Input.pointerId = null;
  }
}
function showTitle() {
  game.state = 'title';
  hideScreens();
  $('screen-title').classList.add('on');
  document.body.classList.remove('in-play');
  setTouchUI(false);
  Sound.setAmbient(false);
  refreshTitle();
}
function refreshTitle() {
  const done = Object.keys(save.best).length;
  const cont = $('btn-continue');
  if (done > 0) {
    cont.style.display = '';
    const idx = Math.min(save.unlocked, Math.max(0, LEVELS.length - 1));
    const name = LEVELS[idx] ? LEVELS[idx].name : '';
    cont.textContent = '继续 · 第 ' + (idx + 1) + ' 关' + (name ? ' · ' + name : '');
  } else {
    cont.style.display = 'none';
  }
  let line = done > 0 ? ('已点亮 ' + done + ' 个回声 · 已解锁 ' + (Math.min(save.unlocked + 1, LEVELS.length)) + ' / ' + LEVELS.length) : '还没有留下回声';
  if (save.endlessBest > 0) line += ' · 深渊最高 ' + save.endlessBest;
  $('save-line').textContent = line;
}
function buildLevelGrid() {
  const grid = $('level-grid');
  grid.replaceChildren();
  for (let i = 0; i < LEVELS.length; i++) {
    const raw = LEVELS[i];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level-card';
    b.disabled = i > save.unlocked;
    const best = save.best[raw.id];
    b.innerHTML = '<span class="level-num">' + pad2(i + 1) + '</span><b>' + raw.name + '</b><small>' +
      (best !== undefined ? ('最佳 ' + fmtTime(best)) : (b.disabled ? '未解锁' : '未完成')) + '</small>' +
      (b.disabled ? '<span class="lock">×</span>' : '');
    if (!b.disabled) b.addEventListener('click', () => { Sound.ensure(); Sound.ui(); startLevel(i, 'campaign'); });
    grid.appendChild(b);
  }
  $('endless-best').textContent = save.endlessBest > 0 ? ('深渊回响 · 最高 ' + save.endlessBest + ' 分') : '深渊回响 · 尚未记录';
  $('save-detail').textContent = '已解锁 ' + Math.min(save.unlocked + 1, LEVELS.length) + ' / ' + LEVELS.length;
}
function openLevels() {
  game.state = 'levels';
  document.body.classList.remove('in-play');
  setTouchUI(false);
  buildLevelGrid();
  showScreen('levels');
  Sound.ensure();
  Sound.ui();
}
function openSettings() {
  game.state = 'settings';
  document.body.classList.remove('in-play');
  setTouchUI(false);
  $('opt-volume').value = String(Math.round(save.settings.volume));
  $('opt-volume-out').textContent = String(Math.round(save.settings.volume));
  $('opt-motion').checked = !save.settings.motion;
  $('save-detail').textContent = '已解锁 ' + Math.min(save.unlocked + 1, LEVELS.length) + ' / ' + LEVELS.length;
  showScreen('settings');
  Sound.ensure();
  Sound.ui();
}
function updateHUD(force) {
  const g = game;
  if (!g.level) return;
  const total = g.cores.length;
  const taken = g.cores.filter(c => c.taken).length;
  if (g.mode === 'endless') {
    $('hud-mode').textContent = 'DEPTH ' + pad2(g.depth) + (g.score ? ' · ' + g.score : '');
    $('hud-level').textContent = '第 ' + g.depth + ' 层';
  } else {
    $('hud-mode').textContent = 'ECHO · ' + pad2(Math.max(0, g.levelIndex) + 1);
    $('hud-level').textContent = g.level.raw.name || '回声';
  }
  $('hud-cores').textContent = taken + ' / ' + total;
  $('hud-time').textContent = fmtTime(g.time);
}
function syncMute() {
  $('btn-mute').classList.toggle('is-off', Sound.muted);
}
function toggleMute() {
  const m = Sound.toggleMute();
  syncMute();
  if (!m) Sound.ensure();
  if (!game.probe) toast(m ? '已静音' : '声音已开启');
}
let toastTimer = 0;
function toast(msg, ms) {
  if (game.probe) return;
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms || 1800);
}
function applyMotion() {
  document.body.classList.toggle('reduced-motion', !save.settings.motion);
}

function bindUI() {
  $('btn-start').addEventListener('click', () => { Sound.ensure(); Sound.ui(); startLevel(0, 'campaign'); });
  $('btn-continue').addEventListener('click', () => { Sound.ensure(); Sound.ui(); startLevel(Math.min(save.unlocked, LEVELS.length - 1), 'campaign'); });
  $('btn-endless').addEventListener('click', () => { Sound.ensure(); Sound.ui(); startEndless(); });
  $('btn-levels').addEventListener('click', openLevels);
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-mute').addEventListener('click', () => { Sound.ensure(); toggleMute(); });
  $('btn-pause').addEventListener('click', () => setPause(true));
  $('btn-resume').addEventListener('click', () => { Sound.ui(); setPause(false); });
  $('btn-restart').addEventListener('click', () => {
    Sound.ui();
    if (game.mode === 'endless') startEndlessLayer();
    else startLevel(game.levelIndex, 'campaign');
  });
  $('btn-quit').addEventListener('click', showTitle);
  $('btn-retry').addEventListener('click', () => { Sound.ensure(); Sound.ui(); retryLevel(); });
  $('btn-dead-quit').addEventListener('click', showTitle);
  $('btn-next').addEventListener('click', () => { Sound.ui(); nextLevel(); });
  $('btn-replay').addEventListener('click', () => { Sound.ui(); if (game.mode === 'endless') startEndlessLayer(); else startLevel(game.levelIndex, 'campaign'); });
  $('btn-win-quit').addEventListener('click', showTitle);
  $('btn-pulse').addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    Sound.ensure();
    Input.pulseQueued = true;
  });
  $('btn-pulse').addEventListener('click', e => { e.preventDefault(); });

  document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { Sound.ui(); showTitle(); }));

  $('opt-volume').addEventListener('input', e => {
    const v = clamp(parseInt(e.target.value, 10) || 0, 0, 100);
    save.settings.volume = v;
    $('opt-volume-out').textContent = String(v);
    Sound.ensure();
    Sound.setVolume(v / 100);
    persist();
  });
  $('opt-motion').addEventListener('change', e => {
    save.settings.motion = !e.target.checked;
    applyMotion();
    persist();
  });
  $('opt-reset').addEventListener('click', () => {
    if (!window.confirm('清空本机的关卡进度与记录？')) return;
    save.unlocked = 0;
    save.best = {};
    save.endlessBest = 0;
    persist();
    buildLevelGrid();
    refreshTitle();
    toast('进度已清空');
  });
}

// ============================================================================
// frame loop
// ============================================================================
let lastTs = 0;
let acc = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.2) dt = 0.2;
  frameDt = dt;
  menuTime += dt;

  if (game.state === 'play') {
    acc += dt;
    let steps = 0;
    while (acc >= FIXED && steps < 6) {
      updateGame(FIXED);
      acc -= FIXED;
      steps++;
      if (game.state !== 'play') break;
    }
  } else {
    acc = 0;
    if (game.state === 'dead' && game.deadAt && !game.probe) {
      const left = (game.deadAt - performance.now()) / 1000;
      if (left <= 0) {
        retryLevel();
      } else if (performance.now() - game.autoT > 100) {
        game.autoT = performance.now();
        $('auto-line').textContent = left.toFixed(1) + ' 秒后重试';
      }
    }
  }
  updateEffects(game, dt);
  render(dt);
}

function boot() {
  initGlow();
  initDust();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  menuLevel = LEVELS.length ? compileLevel(LEVELS[0]) : null;
  bindUI();
  applyMotion();
  syncMute();
  Input.init();
  Sound.muted = !!save.settings.muted;
  showTitle();
  menuTime = 1.6;
  render(0.016);
  requestAnimationFrame(frame);

  const playIndex = parseInt(PARAMS.get('play') || '', 10);
  if (isFinite(playIndex) && playIndex > 0) {
    startLevel(clamp(playIndex - 1, 0, LEVELS.length - 1), 'campaign');
  }
  if (PARAMS.get('mute') === '1') { Sound.muted = true; save.settings.muted = true; syncMute(); }
}

// ============================================================================
// headless probe
// ============================================================================
function probeWrite(line) {
  if (!probeEl) return;
  probeEl.textContent += line + '\n';
}
function runProbe(mode) {
  resize();
  initGlow();
  initDust();
  let ok = true;
  const fail = msg => { ok = false; probeWrite('FAIL ' + msg); };

  if (mode === 'lint' || mode === 'check') {
    let bad = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      const L = compileLevel(LEVELS[i]);
      const issues = validateCompiled(L);
      if (issues.length) { bad++; probeWrite('LEVEL ' + (i + 1) + ' ' + (LEVELS[i].id || '') + ' :: ' + issues.join('; ')); }
      else probeWrite('LEVEL ' + (i + 1) + ' ' + (LEVELS[i].id || '') + ' OK ' + L.w + 'x' + L.h + ' cores=' + L.cores.length + ' enemies=' + L.enemies.length);
    }
    if (bad) fail(bad + ' level(s) invalid');
    else probeWrite('LINT OK levels=' + LEVELS.length);
  }

  if (mode === 'gen' || mode === 'check') {
    const n = clamp(parseInt(PARAMS.get('n') || '50', 10) || 50, 1, 200);
    let bad = 0;
    let attempts = 0;
    let maxAttempts = 0;
    for (let i = 0; i < n; i++) {
      const depth = 1 + (i % 8);
      const seed = 12345 + i * 97;
      const raw = generateRaw(seed, depth);
      attempts += raw.attempts || 1;
      maxAttempts = Math.max(maxAttempts, raw.attempts || 1);
      const L = compileLevel(raw);
      const issues = validateCompiled(L);
      if (issues.length) { bad++; probeWrite('GEN seed=' + seed + ' depth=' + depth + ' :: ' + issues.join('; ')); }
    }
    if (bad) fail('generator produced ' + bad + ' invalid map(s)');
    else probeWrite('GEN OK n=' + n + ' avgAttempts=' + (attempts / n).toFixed(2) + ' maxAttempts=' + maxAttempts);
  }

  if (mode === 'sim' || mode === 'check') {
    const lv = clamp((parseInt(PARAMS.get('level') || '1', 10) || 1) - 1, 0, LEVELS.length - 1);
    const res = simulateLevel(lv);
    if (res.win) probeWrite('SIM OK level=' + (lv + 1) + ' ticks=' + res.ticks + ' time=' + res.time.toFixed(1));
    else fail('SIM level=' + (lv + 1) + ' did not finish (' + res.reason + ', ' + res.time.toFixed(1) + 's)');
  }

  if (mode === 'sonar' || mode === 'check') {
    const L = compileLevel(LEVELS[0]);
    const g = beginLevel(LEVELS[0], 0, 'campaign', { silent: true, noUI: true, probe: true, intro: false });
    let visible = 0;
    for (let i = 0; i < g.vis.length; i++) if (g.vis[i]) visible++;
    if (visible < 10) fail('sonar visible=' + visible);
    else probeWrite('SONAR OK visible=' + visible + ' level=' + L.w + 'x' + L.h);
    g.state = 'title';
  }

  if (mode === 'shot') {
    const lv = clamp((parseInt(PARAMS.get('level') || '1', 10) || 1) - 1, 0, LEVELS.length - 1);
    const g = beginLevel(LEVELS[lv], lv, 'campaign', { silent: true, noUI: false, intro: false });
    g.state = 'play';
    document.body.classList.add('in-play');
    setTouchUI(false);
    $('intro').classList.remove('on');
    const demo = PARAMS.get('demo') === '1';
    const t = clamp(parseFloat(PARAMS.get('t') || (demo ? '6' : '0.55')) || 0.55, 0.1, demo ? 40 : 3);
    let ticks = Math.round(t / FIXED);
    if (demo) {
      g.ghost = true;
      let path = null;
      let pathIndex = 0;
      for (let i = 0; i < ticks; i++) {
        let target = null;
        for (let k = 0; k < g.cores.length; k++) {
          if (!g.cores[k].taken) { target = g.cores[k]; break; }
        }
        if (target) {
          if (!path || pathIndex >= path.length || i % 30 === 0) {
            path = findPath(g.level, g.player.x, g.player.y, target.x, target.y);
            pathIndex = 0;
          }
          if (path && pathIndex < path.length) {
            const wp = path[pathIndex];
            if (dist(g.player.x, g.player.y, wp.x, wp.y) < 0.18) pathIndex++;
            else {
              const dx = wp.x - g.player.x;
              const dy = wp.y - g.player.y;
              const m = Math.hypot(dx, dy) || 1;
              Input.axisX = dx / m;
              Input.axisY = dy / m;
            }
          }
        }
        Input.pulseQueued = (i % 55 === 0);
        updateGame(FIXED);
        updateEffects(g, FIXED);
        Input.axisX = 0;
        Input.axisY = 0;
        if (g.state !== 'play') { g.state = 'play'; break; }
      }
      tryPulse(g);
      for (let i = 0; i < 20 && g.state === 'play'; i++) {
        updateGame(FIXED);
        updateEffects(g, FIXED);
      }
      for (let i = 0; i < 16; i++) render(0.05);
    } else {
      tryPulse(g);
      for (let i = 0; i < ticks; i++) {
        if (g.state !== 'play') break;
        updateGame(FIXED);
      }
      updateEffects(g, Math.max(0.016, t));
    }
    updateEffects(game, 0.016);
    hideScreens();
    document.body.classList.add('in-play');
    updateHUD(true);
    render(0.016);
    probeWrite('SHOT OK level=' + (lv + 1) + ' time=' + g.time.toFixed(2) + ' vis=' + g.vis.reduce((a, b) => a + b, 0) + (demo ? ' demo=1' : ''));
    document.body.dataset.ready = '1';
  }

  if (mode === 'probe') {
    probeWrite('PROBE hello');
  }

  document.title = ok ? 'PROBE OK' : 'PROBE FAIL';
  probeWrite(ok ? 'PROBE OK' : 'PROBE FAIL');
}

function simulateLevel(index) {
  const raw = LEVELS[index];
  const g = beginLevel(raw, index, 'campaign', { silent: true, noUI: true, probe: true, intro: false });
  g.enemies = [];
  g.state = 'play';
  let path = null;
  let pathIndex = 0;
  let targetKey = '';
  let ticks = 0;
  const maxTicks = 60 * 150;
  let reason = 'timeout';
  while (ticks < maxTicks) {
    let target = null;
    let key = '';
    for (let i = 0; i < g.cores.length; i++) {
      if (!g.cores[i].taken) {
        const c = g.cores[i];
        target = { x: c.x, y: c.y };
        key = 'c' + i;
        break;
      }
    }
    if (!target && g.exitUnlocked) { target = { x: g.level.exit.x, y: g.level.exit.y }; key = 'exit'; }
    if (!target) { reason = 'no target'; break; }
    if (key !== targetKey || !path || pathIndex >= path.length) {
      targetKey = key;
      path = findPath(g.level, g.player.x, g.player.y, target.x, target.y);
      pathIndex = 0;
      if (!path) { reason = 'no path'; break; }
    }
    let ax = 0;
    let ay = 0;
    if (path && pathIndex < path.length) {
      const wp = path[pathIndex];
      if (dist(g.player.x, g.player.y, wp.x, wp.y) < 0.18) pathIndex++;
      else {
        const dx = wp.x - g.player.x;
        const dy = wp.y - g.player.y;
        const m = Math.hypot(dx, dy) || 1;
        ax = dx / m;
        ay = dy / m;
      }
    }
    Input.axisX = ax;
    Input.axisY = ay;
    Input.pulseQueued = (ticks % 45 === 0);
    updateGame(FIXED);
    ticks++;
    if (g.state === 'win') return { win: true, ticks, time: g.time };
    if (g.state !== 'play') { reason = 'state ' + g.state; break; }
  }
  Input.axisX = 0;
  Input.axisY = 0;
  return { win: false, ticks, time: g.time, reason };
}

function initProbe() {
  window.addEventListener('error', ev => {
    probeWrite('RUNTIME ' + (ev.message || 'error'));
    document.title = 'PROBE FAIL';
  });
  document.body.classList.add('probe');
  try {
    runProbe(PROBE);
  } catch (e) {
    probeWrite('EXCEPTION ' + (e && e.message ? e.message : String(e)));
    probeWrite('PROBE FAIL');
    document.title = 'PROBE FAIL';
  }
}

// ============================================================================
// start
// ============================================================================
window.__ECHO__ = game;
if (PROBE) {
  initProbe();
} else {
  boot();
}

})();
