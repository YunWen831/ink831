import {CITY,GUNS,GOODS,EVENTS,PLACES,BOONS,SLOT_SYMBOLS,CONTRACT_META,BODY_UPGRADES,dist} from './city-rules.js?v=0.26.1';
import {CityPrediction} from './city-motion.js?v=0.26.1';
import {createCityRenderer} from './city-render.js?v=0.26.1';
import {createCityAudio} from './city-audio.js?v=0.26.1';

const SERVICE = new Set(['arms', 'market', 'bank', 'casino', 'garage', 'job', 'fixer', 'safehouse', 'clinic', 'cyber']);
const GUN_IDS = new Set(Object.keys(GUNS));
const padNumber = n => String(n);

export function createCityGame({send, self, online, onActive, exit, avatars, speech}) {
  const $ = id => document.getElementById(id), canvas = $('cityWorld'), keys = new Set();
  let state = null, active = false, seq = 0, actionSeq = 0, aim = 0, fire = false, interact = false, stick = {x: 0, y: 0}, mode = '', panelKey = '', lastTime = 0, lastPacket = 0, lastMap = 0, lastHud = 0, mapPoints = [], message = '', predicted = null, snapshotAt = 0, obstacles = [], fireAt = 0, lastLocalShot = 0, quickKey = '', promptKey = '', shopTab = 'all', lastDice = null, lastDiceId = '', lastSlots = null, lastSlotsId = '', escapedAt = 0, boonKey = '', raceStake = 50, lastRacePhase = '', feedKey = '', sirenAt = 0, suppressInteract = false, brake = false, lastGun = '', engineAt = 0, leaderboardRows = [];
  const pointer = {clientX: 0, clientY: 0, inside: false};
  const fxAt = new Map();
  const prediction = new CityPrediction();
  const audio = createCityAudio();
  const unlockAudio = () => audio.unlock();
  window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
  window.addEventListener('keydown', unlockAudio, { once: true, capture: true });

  $('cityPads').hidden = !matchMedia('(pointer: coarse)').matches;
  const blocked = () => !online() || document.hidden || !!document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  const me = () => predicted || state?.self;

  function clear() {
    keys.clear();
    suppressInteract = false;
    fire = false;
    interact = false;
    stick = {x: 0, y: 0};
    $('cityMoveKnob').style.transform = '';
  }
  function action(kind, fields = {}) {
    if (!state || !online()) return;
    audio.unlock();
    if (kind === 'reload') audio.reload();
    send('city:action', {id: state.id, seq: ++actionSeq, kind, ...fields});
    canvas.focus({preventScroll: true});
  }
  const renderState = () => state ? {
    ...state, snapshotAt, map: mapPoints, fxAt,
    self: {...state.self, ...predicted},
    cars: state.cars.map(c => c[0] === state.self.car && predicted ? [c[0], predicted.x, predicted.y, predicted.heading, ...c.slice(4)] : c)
  } : null;
  const renderer = createCityRenderer(canvas, {state: renderState, self, aim: () => aim, avatars, speech, pointer: () => pointer, firing: () => fire, fireAt: () => fireAt});
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  function button(text, fn, disabled = false) { const b = el('button', text); b.disabled = disabled; b.addEventListener('click', fn); return b; }
  function row(title, description, buttons) { const r = el('div', undefined, 'city-row'), copy = el('div'); copy.append(el('strong', title), el('small', description)); r.append(copy, ...buttons); return r; }
  function card(title, description, children, actions, icon) {
    const c = el('div', undefined, 'city-card'), head = el('div', undefined, 'city-card-head');
    if (icon) head.append(icon);
    const copy = el('div', undefined, 'city-card-copy');
    copy.append(el('strong', title));
    if (description) copy.append(el('small', description));
    head.append(copy);
    c.append(head);
    if (children) c.append(children);
    if (actions?.length) { const bar = el('div', undefined, 'city-card-actions'); bar.append(...actions); c.append(bar); }
    return c;
  }

  const ITEM_COLORS = {medkit:'#e0675e',ammo:'#d9b45a',vest:'#5c8ed4',banana:'#efd45b',decoy:'#d58ad8',perfume:'#6fbf95',blink:'#6fd7e5',barricade:'#e59a5b',repair:'#b7c3c7',bribe:'#d6b07a',grenade:'#8fa38a',molotov:'#e8995b',smoke:'#b8c3c0',mine:'#8a6a4f',adrenaline:'#e76f6a',flashbang:'#f4e5a0',armorplate:'#6f9fc4',knife:'#c5d1d3',revolver:'#d0b79b',dmr:'#a9bdc2',lmg:'#8fa6a6',pistol:'#d0b79b',shotgun:'#c8a27c',smg:'#aab9bd',rifle:'#a9bdc2',car:'#72bda5',fists:'#d0b79b'};
  const SERVICE_KICKER = {arms:'ARMORY',market:'NIGHT MARKET','black-market':'BLACK MARKET',bank:'BANK',casino:'CASINO',goose:'GOOSE DERBY',garage:'GARAGE',job:'JOBS',escape:'EXIT',fixer:'FIXER',safehouse:'SAFEHOUSE',clinic:'CLINIC',cyber:'BODY LAB'};
  const SERVICE_TAGLINE = {arms:'铁与火，明码标价。',market:'怪东西，也许正好用得上。','black-market':'不问来路，加价三成。',bank:'存款安全，金库不太安全。',casino:'骰子一响，黄金万两；老虎机一停，口袋见底。',goose:'六只鹅，一条赛道，谁都能冲线。',garage:'从二手车，到更旧的二手车。',job:'打工，或者送一单。',escape:'带得走，才算你的。',fixer:'委托、悬赏、脏活。完成一单，选一项强化。',safehouse:'把命续在这里，下次从这里醒。',clinic:'缝针、护甲，现金结账。',cyber:'血肉苦弱。最大生命、护甲、速度、负重，全部可以加钱。'};

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawItemIcon(g, id) {
    g.clearRect(0, 0, 48, 48);
    const color = ITEM_COLORS[id] || '#8fa6a6';
    g.fillStyle = '#0b1721';
    roundRect(g, 1, 1, 46, 46, 11); g.fill();
    g.strokeStyle = color + '88'; g.lineWidth = 1.5;
    roundRect(g, 1, 1, 46, 46, 11); g.stroke();
    g.save(); g.translate(24, 24); g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.5;
    if (id === 'medkit') {
      g.fillStyle = '#eee8d6'; roundRect(g, -11, -8, 22, 16, 3); g.fill();
      g.fillStyle = '#d9554e'; g.fillRect(-2, -6, 4, 12); g.fillRect(-7, -1, 14, 4);
      g.fillStyle = '#9fb0ae'; g.fillRect(-4, -11, 8, 3);
    } else if (id === 'ammo') {
      for (let i = -1; i <= 1; i++) { g.fillStyle = '#d9b45a'; g.fillRect(i * 7 - 3, -8, 6, 13); g.beginPath(); g.arc(i * 7, -9, 3, Math.PI, 0); g.fill(); }
      g.strokeStyle = '#9a7a3f'; g.strokeRect(-13, 7, 26, 5);
    } else if (id === 'vest') {
      g.fillStyle = '#5c8ed4'; g.beginPath(); g.moveTo(-10, -10); g.lineTo(10, -10); g.lineTo(8, 10); g.lineTo(-8, 10); g.closePath(); g.fill();
      g.fillStyle = '#243b59'; g.fillRect(-2, -10, 4, 20); g.fillStyle = '#d4e3f5'; g.fillRect(-9, -2, 4, 7); g.fillRect(5, -2, 4, 7);
    } else if (id === 'banana') {
      g.strokeStyle = '#efd45b'; g.lineWidth = 7; g.beginPath(); g.arc(0, 1, 11, .55, 2.7); g.stroke();
      g.fillStyle = '#7b5b32'; g.fillRect(-12, 4, 5, 4);
    } else if (id === 'decoy') {
      g.fillStyle = '#d58ad8'; g.beginPath(); g.arc(0, -8, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(0, 4, 10, 12, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7e3d83'; g.beginPath(); g.moveTo(-5, 12); g.lineTo(-8, 17); g.moveTo(5, 12); g.lineTo(8, 17); g.stroke();
    } else if (id === 'perfume') {
      g.fillStyle = '#6fbf95'; roundRect(g, -7, -4, 14, 17, 3); g.fill();
      g.fillStyle = '#cfe7d9'; g.fillRect(-4, -10, 8, 7); g.fillStyle = '#b58a55'; g.fillRect(-2, -14, 4, 4);
      g.strokeStyle = '#cbe9dd'; g.beginPath(); g.moveTo(9, -8); g.lineTo(14, -13); g.moveTo(9, -5); g.lineTo(15, -6); g.stroke();
    } else if (id === 'blink') {
      g.fillStyle = '#e9f1ef'; roundRect(g, -10, -12, 20, 9, 2); g.fill();
      g.beginPath(); g.ellipse(0, 5, 11, 8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6fd7e5'; g.lineWidth = 2; g.beginPath(); g.arc(0, 4, 6, .3, 4.5); g.stroke();
    } else if (id === 'barricade') {
      g.fillStyle = '#e59a5b'; roundRect(g, -14, -7, 28, 11, 2); g.fill();
      g.strokeStyle = '#f4ead0'; g.lineWidth = 3; for (let i = -12; i < 12; i += 8) { g.beginPath(); g.moveTo(i, -6); g.lineTo(i + 6, 3); g.stroke(); }
      g.strokeStyle = '#8e6743'; g.beginPath(); g.moveTo(-9, 4); g.lineTo(-12, 14); g.moveTo(9, 4); g.lineTo(12, 14); g.stroke();
    } else if (id === 'repair') {
      g.strokeStyle = '#b7c3c7'; g.lineWidth = 5; g.beginPath(); g.moveTo(-8, 9); g.lineTo(8, -8); g.stroke();
      g.beginPath(); g.arc(8, -8, 5, .4, 5.2); g.stroke(); g.beginPath(); g.arc(-8, 9, 5, 3.5, 2.1); g.stroke();
    } else if (id === 'bribe') {
      g.fillStyle = '#d6b07a'; g.fillRect(-14, -9, 28, 18);
      g.strokeStyle = '#7d5d34'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-14, -9); g.lineTo(0, 1); g.lineTo(14, -9); g.stroke();
      g.fillStyle = '#674b2b'; g.font = 'bold 9px system-ui'; g.textAlign = 'center'; g.fillText('$', 0, 7);
    } else if (id === 'knife') {
      g.fillStyle = '#c5d1d3'; g.beginPath(); g.moveTo(-13, 7); g.lineTo(10, -11); g.lineTo(13, -7); g.lineTo(-8, 11); g.closePath(); g.fill();
      g.fillStyle = '#6d4b35'; g.fillRect(-14, 7, 9, 5);
    } else if (id === 'grenade') {
      g.fillStyle = '#6f8570'; g.beginPath(); g.ellipse(0, 3, 10, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#39493f'; g.fillRect(-6, -11, 12, 4); g.fillRect(2, -15, 3, 5);
      g.strokeStyle = '#cfc38f'; g.lineWidth = 2; g.beginPath(); g.arc(6, -12, 5, -1.2, 1.7); g.stroke();
      g.strokeStyle = '#4f5f50'; g.lineWidth = 1.2; for (let i = -7; i <= 7; i += 7) { g.beginPath(); g.moveTo(i, -5); g.lineTo(i, 12); g.stroke(); }
    } else if (id === 'molotov') {
      g.fillStyle = '#7e5a3c'; roundRect(g, -6, -2, 12, 17, 3); g.fill();
      g.fillStyle = '#d9e0cf'; g.fillRect(-3, -11, 6, 10);
      g.fillStyle = '#b8553d'; g.fillRect(-5, 2, 10, 8);
      g.fillStyle = '#f0a24f'; g.beginPath(); g.moveTo(0, -13); g.quadraticCurveTo(8, -20, 2, -23); g.quadraticCurveTo(-5, -19, 0, -13); g.fill();
      g.fillStyle = '#ffe09a'; g.beginPath(); g.moveTo(1, -14); g.quadraticCurveTo(5, -18, 2, -20); g.quadraticCurveTo(-1, -17, 1, -14); g.fill();
    } else if (id === 'smoke') {
      g.fillStyle = '#8b9a96'; roundRect(g, -6, -4, 12, 18, 3); g.fill();
      g.fillStyle = '#d7dfd9'; g.fillRect(-4, -9, 8, 6);
      g.fillStyle = '#c9d3cf88'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-9 + i * 7, -14 - (i % 2) * 5, 5 + i, 0, Math.PI * 2); g.fill(); }
    } else if (id === 'mine') {
      g.fillStyle = '#5d5448'; g.beginPath(); g.ellipse(0, 2, 12, 8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c7b98c'; g.lineWidth = 2; g.beginPath(); g.arc(0, 2, 7, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#e0675e'; g.beginPath(); g.arc(0, 2, 2.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#8f9a8a'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a) * 8, 2 + Math.sin(a) * 5); g.lineTo(Math.cos(a) * 14, 2 + Math.sin(a) * 9); g.stroke(); }
    } else if (id === 'adrenaline') {
      g.strokeStyle = '#e76f6a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-12, 12); g.lineTo(8, -8); g.stroke();
      g.fillStyle = '#f1d5c4'; g.fillRect(7, -12, 7, 3);
      g.fillStyle = '#e76f6a'; g.fillRect(-3, 3, 6, 5);
      g.strokeStyle = '#8fa6a2'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-10, 3); g.lineTo(-3, 10); g.stroke();
    } else if (id === 'flashbang') {
      g.fillStyle = '#b9b69a'; roundRect(g, -6, -6, 12, 20, 3); g.fill();
      g.fillStyle = '#f4e5a0'; g.fillRect(-4, -11, 8, 6);
      g.fillStyle = '#fff8c8'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 3, -14 + Math.sin(a) * 3); g.lineTo(Math.cos(a) * 10, -14 + Math.sin(a) * 10); g.strokeStyle = '#fff8c8'; g.lineWidth = 1.5; g.stroke(); }
    } else if (id === 'armorplate') {
      g.fillStyle = '#6f9fc4'; g.beginPath(); g.moveTo(0, -13); g.lineTo(12, -6); g.lineTo(9, 10); g.lineTo(0, 15); g.lineTo(-9, 10); g.lineTo(-12, -6); g.closePath(); g.fill();
      g.strokeStyle = '#d6e8f5'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -8); g.lineTo(7, -3); g.lineTo(5, 8); g.lineTo(0, 10); g.stroke();
    } else if (id === 'pistol' || id === 'rifle' || id === 'shotgun' || id === 'smg' || id === 'revolver' || id === 'dmr' || id === 'lmg') {
      const long = id === 'rifle' || id === 'shotgun' || id === 'dmr' || id === 'lmg', smg = id === 'smg', revolver = id === 'revolver';
      g.fillStyle = id === 'smg' ? '#aab9bd' : '#d0b79b'; g.fillRect(long ? -15 : smg ? -11 : -12, -5, long ? 28 : smg ? 19 : 20, 7);
      g.fillRect(long ? -5 : -4, 2, 6, smg ? 12 : 10);
      g.fillRect(long ? -15 : -12, -2, long ? 15 : 10, 4);
      g.fillStyle = '#5e6b72'; g.fillRect(-4, -8, long ? 8 : 5, 3);
      if (id === 'rifle') { g.fillStyle = '#8d9b9f'; g.fillRect(7, -8, 9, 2); }
      if (id === 'shotgun') { g.fillStyle = '#6d4b35'; g.fillRect(3, 2, 14, 4); g.fillStyle = '#8d9b9f'; g.fillRect(10, -7, 5, 2); }
      if (id === 'smg') { g.fillStyle = '#55646b'; g.fillRect(-1, 2, 5, 12); g.fillRect(9, -7, 4, 3); }
      if (revolver) { g.fillStyle = '#6f6a5e'; g.beginPath(); g.arc(-1, -1, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d0b79b'; g.fillRect(-1, -15, 16, 4); }
      if (id === 'dmr') { g.fillStyle = '#3d4d55'; g.fillRect(-2, -12, 14, 3); g.fillStyle = '#a9bdc2'; g.fillRect(-5, -10, 3, 4); g.fillRect(9, -10, 3, 4); }
      if (id === 'lmg') { g.fillStyle = '#55646b'; g.fillRect(-4, 2, 15, 10); g.fillStyle = '#8fa6a6'; g.fillRect(-12, 4, 4, 4); g.fillRect(-12, 10, 4, 4); }
    } else if (id === 'car') {
      g.fillStyle = '#72bda5'; roundRect(g, -15, -3, 30, 10, 3); g.fill();
      g.beginPath(); g.moveTo(-10, -3); g.lineTo(-5, -11); g.lineTo(7, -11); g.lineTo(12, -3); g.fill();
      g.fillStyle = '#1b2a32'; g.beginPath(); g.arc(-9, 8, 4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(9, 8, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b9e7dd'; g.fillRect(-3, -9, 8, 4);
    } else {
      g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }
  function itemIcon(id, cls) {
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48; c.className = 'city-item-icon' + (cls ? ' ' + cls : '');
    drawItemIcon(c.getContext('2d'), id);
    return c;
  }

  function drawServiceIcon(g, kind) {
    g.clearRect(0, 0, 64, 64);
    const color = {job:'#70dbb1',arms:'#f39485',market:'#c4a0ef','black-market':'#a76bd0',bank:'#f2d57d',casino:'#e97cf0',garage:'#84c8e8',escape:'#b5f493',fixer:'#f2c94c',safehouse:'#7fd6b0',clinic:'#f28f8f',goose:'#f2c94c',cyber:'#6fd7e5'}[kind] || '#b6c4c2';
    g.fillStyle = '#0b1721'; roundRect(g, 1, 1, 62, 62, 14); g.fill();
    g.strokeStyle = color; g.lineWidth = 2; roundRect(g, 1, 1, 62, 62, 14); g.stroke();
    g.save(); g.translate(32, 32); g.scale(1.55, 1.55); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
    if (kind === 'job') { g.strokeRect(-10, -8, 17, 14); g.beginPath(); g.moveTo(-10, -8); g.lineTo(-3, -1); g.lineTo(7, -8); g.stroke(); g.beginPath(); g.arc(9, 8, 6, 0, Math.PI * 2); g.stroke(); }
    else if (kind === 'arms') { g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-14, 0); g.lineTo(-5, 0); g.moveTo(5, 0); g.lineTo(14, 0); g.moveTo(0, -14); g.lineTo(0, -5); g.moveTo(0, 5); g.lineTo(0, 14); g.stroke(); }
    else if (kind === 'market') { g.strokeRect(-9, -5, 18, 15); g.beginPath(); g.arc(0, -5, 6, Math.PI, 0); g.stroke(); }
    else if (kind === 'bank') { g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke(); g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.fillText('$', 0, 5); }
    else if (kind === 'casino') { g.fillStyle = '#f6edcf'; g.fillRect(-11, -10, 18, 18); g.fillStyle = '#192531'; for (const [px, py] of [[-6,-5],[2,-5],[-6,3],[2,3],[0,0]]) { g.beginPath(); g.arc(px, py, 1.7, 0, Math.PI * 2); g.fill(); } g.fillStyle = color; g.beginPath(); g.arc(10, 10, 5, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'garage') { g.strokeRect(-13, -5, 22, 10); g.beginPath(); g.moveTo(-10, -5); g.lineTo(-6, -11); g.lineTo(5, -11); g.lineTo(9, -5); g.stroke(); g.beginPath(); g.arc(-7, 7, 3.5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(7, 7, 3.5, 0, Math.PI * 2); g.stroke(); }
    else if (kind === 'fixer') { g.strokeRect(-10, -10, 20, 20); g.beginPath(); g.moveTo(-4, -4); g.lineTo(5, -4); g.moveTo(-4, 0); g.lineTo(5, 0); g.moveTo(-4, 4); g.lineTo(2, 4); g.stroke(); g.fillStyle = color; g.beginPath(); g.arc(9, 9, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#13202a'; g.font = 'bold 7px system-ui'; g.textAlign = 'center'; g.fillText('¥', 9, 11.5); }
    else if (kind === 'safehouse') { g.beginPath(); g.moveTo(-13, 0); g.lineTo(0, -12); g.lineTo(13, 0); g.stroke(); g.strokeRect(-9, 0, 18, 12); g.beginPath(); g.moveTo(-3, 4); g.lineTo(-3, 12); g.lineTo(4, 12); g.lineTo(4, 4); g.stroke(); g.beginPath(); g.arc(0, -1, 4, 0, Math.PI * 2); g.stroke(); }
    else if (kind === 'clinic') { g.strokeRect(-10, -10, 20, 20); g.fillStyle = color; g.fillRect(-2, -7, 4, 14); g.fillRect(-7, -2, 14, 4); }
    else if (kind === 'goose') { g.beginPath(); g.ellipse(-1, 5, 11, 8, -.2, 0, Math.PI * 2); g.fill(); g.fillRect(5, -14, 6, 17); g.beginPath(); g.arc(8, -14, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e0a24f'; g.beginPath(); g.moveTo(12, -15); g.lineTo(18, -12); g.lineTo(12, -11); g.fill(); g.fillStyle = '#1a2531'; g.beginPath(); g.arc(9, -15, 1.4, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'cyber') { g.beginPath(); g.arc(0, -9, 5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 13); g.moveTo(-9, 2); g.lineTo(9, 2); g.moveTo(-7, 13); g.lineTo(0, 8); g.lineTo(7, 13); g.stroke(); g.fillStyle = '#6fd7e5'; g.beginPath(); g.moveTo(-2, 5); g.lineTo(2, 5); g.lineTo(-1, 10); g.lineTo(4, 2); g.lineTo(0, 2); g.closePath(); g.fill(); }
    else { g.strokeRect(-9, -4, 16, 9); g.beginPath(); g.moveTo(7, -3); g.lineTo(13, -8); g.lineTo(13, -1); g.stroke(); g.beginPath(); g.moveTo(-17, -8); g.lineTo(11, -8); g.moveTo(-3, -8); g.lineTo(-3, -5); g.stroke(); }
    g.restore();
  }
  function serviceIcon(kind, cls) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64; c.className = 'city-service-icon' + (cls ? ' ' + cls : '');
    drawServiceIcon(c.getContext('2d'), kind);
    return c;
  }

  function serviceHero(place, p, discount) {
    const hero = el('div', undefined, 'city-service-hero');
    const skin = place.black ? 'black-market' : place.goose ? 'goose' : place.kind;
    hero.dataset.kind = skin;
    hero.append(serviceIcon(skin));
    const copy = el('div', undefined, 'city-service-copy');
    copy.append(el('span', SERVICE_KICKER[skin] || 'SERVICE', 'city-service-kicker'));
    copy.append(el('h3', place.name));
    copy.append(el('p', SERVICE_TAGLINE[skin] || ''));
    const cash = el('div', undefined, 'city-service-cash');
    cash.append(el('strong', '¥' + p.cash), el('span', '存款 ¥' + p.bank));
    if (discount < 1) cash.append(el('em', 'SALE · 7 折', 'city-sale'));
    hero.append(copy, cash);
    return hero;
  }

  function categoryOf(id, kind) {
    if (kind === 'arms') return id === 'ammo' ? 'ammo' : 'weapon';
    if (kind === 'market') return ['medkit', 'vest', 'ammo'].includes(id) ? 'recover' : ['banana', 'decoy', 'perfume', 'blink', 'grenade', 'molotov'].includes(id) ? 'trick' : 'carry';
    return 'all';
  }
  function shopTabs(kind, active, pick) {
    const specs = kind === 'arms' ? [['all', '全部'], ['weapon', '武器'], ['ammo', '弹药']] : [['all', '全部'], ['recover', '恢复'], ['trick', '整活'], ['carry', '工具']];
    const bar = el('div', undefined, 'city-shop-tabs');
    for (const [id, name] of specs) {
      const b = el('button', name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(active === id));
      b.addEventListener('click', () => pick(id));
      bar.append(b);
    }
    return bar;
  }

  const DIE_PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  function casinoStage(place, p) {
    const wrap = el('div', undefined, 'city-casino');
    const sign = el('div', undefined, 'city-casino-sign');
    sign.append(el('span', 'CASINO'), el('strong', place.name), el('em', '骰子 · 单双 · 局内虚拟币'));
    wrap.append(sign);
    const die = el('div', undefined, 'city-die');
    const face = lastDice?.face || 1, on = new Set(DIE_PIPS[face] || []);
    for (let i = 0; i < 9; i++) { const pip = el('i'); if (on.has(i)) pip.className = 'on'; die.append(pip); }
    if (lastDice && performance.now() - lastDice.at < 900) die.classList.add('rolling');
    wrap.append(die);
    const result = el('p', undefined, 'city-casino-result');
    result.textContent = lastDice ? `上一把：${lastDice.face} 点 · ${lastDice.win ? '赢得筹码' : '输掉筹码'}` : '押单或双，骰子决定。';
    wrap.append(result);
    const bets = el('div', undefined, 'city-casino-bets');
    for (const stake of [50, 200, 500]) {
      const bet = el('div', undefined, 'city-casino-bet');
      bet.append(el('strong', '¥' + stake), el('span', '筹码'));
      bet.append(button('押单', () => action('gamble', {amount: stake, choice: 'odd'}), p.cash < stake));
      bet.append(button('押双', () => action('gamble', {amount: stake, choice: 'even'}), p.cash < stake));
      bets.append(bet);
    }
    wrap.append(bets, slotStage(p));
    return wrap;
  }

  function bodyShop(p) {
    const wrap = el('div', undefined, 'city-body');
    wrap.append(el('p', '义体强化在本局永久保留；每项最高 Lv.3。', 'city-contract-hint'));
    const grid = el('div', undefined, 'city-shop-grid');
    for (const [id, up] of Object.entries(BODY_UPGRADES)) {
      const level = p.body?.[id] || 0;
      const cost = level < 3 ? Math.ceil(up.costs[level] * (state.modifier?.sale || 1)) : 0;
      const detail = id === 'vitality' ? `最大生命 ${p.maxHp || 100} → ${(p.maxHp || 100) + 20}`
        : id === 'plating' ? `护甲上限 ${p.armorCap || 100} → ${(p.armorCap || 100) + 25}`
        : id === 'muscle' ? `移动速度 +${(level + 1) * 6}%`
        : `背包容量 ${p.invCap || 12} → ${(p.invCap || 12) + 4}`;
      const meta = el('div', undefined, 'city-card-meta');
      meta.append(el('span', level < 3 ? '¥' + cost : 'MAX', 'city-price'));
      meta.append(el('span', 'Lv.' + level + '/3', 'city-owned'));
      const item = card(up.name, detail, meta, [
        button(level >= 3 ? '已满级' : p.cash < cost ? '现金不足' : '强化', () => action('body', { item: id }), level >= 3 || p.cash < cost || !!p.car)
      ], serviceIcon('cyber'));
      item.style.setProperty('--boon', up.color);
      grid.append(item);
    }
    wrap.append(grid);
    wrap.append(el('p', '义体强化不会因死亡丢失；撤离后本局结束。', 'city-contract-hint'));
    return wrap;
  }

  function gooseRaceStage(place, p) {
    const r = state?.gooseRace;
    const wrap = el('div', undefined, 'city-goose-panel');
    if (!r) { wrap.append(el('p', '赛鹅场正在布置赛道，下一场马上开始。', 'city-goose-hint')); return wrap; }
    const head = el('div', undefined, 'city-goose-head');
    head.append(el('span', 'GOOSE DERBY'), el('strong', '赛鹅大奖赛'), el('em', r.bettors ? r.bettors + ' 人已下注' : '全场播报'));
    wrap.append(head);
    const clock = el('div', undefined, 'city-goose-clock');
    clock.dataset.phase = r.phase;
    clock.textContent = r.phase === 'betting' ? '下注截止 ' + r.startsIn + 's' : r.phase === 'racing' ? '冲线中 · ' + Math.max(0, r.endsIn) + 's' : (r.winnerName || '比赛结束') + ' 获胜';
    wrap.append(clock);
    const stakes = el('div', undefined, 'city-goose-stakes');
    for (const stake of [50, 200, 500]) {
      const b = button('¥' + stake, () => { raceStake = stake; panelKey = ''; updatePanel(); });
      b.setAttribute('aria-pressed', String(raceStake === stake));
      b.disabled = r.phase !== 'betting';
      stakes.append(b);
    }
    wrap.append(stakes);
    const lanes = el('div', undefined, 'city-goose-lanes');
    for (const g of r.geese) {
      const lane = el('div', undefined, 'city-goose-lane');
      lane.style.setProperty('--goose', g.color);
      if (r.own?.goose === g.id) lane.classList.add('picked');
      const dot = el('i', undefined, 'city-goose-dot');
      const name = el('strong', g.name);
      const odds = el('small', 'x' + g.odds);
      const track = el('div', undefined, 'city-goose-track');
      const fill = el('i');
      fill.style.width = (r.phase === 'betting' ? 0 : Math.round((g.progress || 0) * 100)) + '%';
      track.append(fill);
      const own = r.own?.goose === g.id;
      const b = button(own ? '已押' : r.phase === 'betting' ? '押 ¥' + raceStake : '封盘', () => action('betGoose', { item: g.id, amount: raceStake }), !own && (r.phase !== 'betting' || !!r.own || p.cash < raceStake));
      lane.append(dot, name, odds, track, b);
      lanes.append(lane);
    }
    wrap.append(lanes);
    const result = el('div', undefined, 'city-goose-result');
    if (r.phase === 'result') {
      const podium = (r.result || []).slice(0, 3).map(q => q.place + '. ' + q.name).join(' · ');
      const own = r.own;
      result.append(el('strong', r.winnerName + ' 夺冠'), el('span', ' · ' + podium + (own ? (own.goose === r.winner ? ' · 你押中了' : ' · 你押了 ' + own.amount) : '')));
    } else if (r.own) result.textContent = '已押 ' + (r.geese.find(g => g.id === r.own.goose)?.name || '') + ' ¥' + r.own.amount + ' · 赔率 x' + r.own.odds;
    else result.textContent = '比赛开始后自动结算；押中按赔率返还。';
    wrap.append(result);
    wrap.append(el('p', '赛鹅场在娱乐区东南角。下注窗口结束前选一只鹅；一场只能押一次。', 'city-goose-hint'));
    return wrap;
  }

  function drawSlotSymbol(g, sym) {
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#101a24'; roundRect(g, 1, 1, 62, 62, 12); g.fill();
    g.strokeStyle = sym.color + '66'; g.lineWidth = 2; roundRect(g, 1, 1, 62, 62, 12); g.stroke();
    g.save(); g.translate(32, 32); g.fillStyle = sym.color; g.strokeStyle = sym.color; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
    if (sym.id === 'goose') {
      g.beginPath(); g.ellipse(-1, 5, 13, 10, -.2, 0, Math.PI * 2); g.fill();
      g.fillRect(5, -17, 7, 20);
      g.beginPath(); g.arc(8, -17, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e0a24f'; g.beginPath(); g.moveTo(13, -18); g.lineTo(20, -15); g.lineTo(13, -13); g.fill();
      g.fillStyle = '#1a2531'; g.beginPath(); g.arc(9, -18, 1.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c9b78f'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, 12); g.lineTo(-10, 16); g.moveTo(4, 12); g.lineTo(6, 16); g.stroke();
    } else if (sym.id === 'coin') {
      g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.stroke();
      g.font = 'bold 18px system-ui'; g.textAlign = 'center'; g.fillText('¥', 0, 6);
    } else if (sym.id === 'dice') {
      g.fillStyle = '#f2ecdc'; g.fillRect(-14, -14, 28, 28);
      g.fillStyle = '#1c2732'; for (const [x, y] of [[-7,-7],[7,-7],[-7,7],[7,7],[0,0]]) { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); }
    } else if (sym.id === 'cherry') {
      g.beginPath(); g.arc(-8, 7, 8, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(8, 9, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6fa15d'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(-4, -15, 5, -17); g.moveTo(8, 3); g.quadraticCurveTo(8, -10, 5, -17); g.stroke();
    } else {
      g.beginPath(); g.arc(-3, 4, 12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d6c38d'; g.beginPath(); g.moveTo(5, -4); g.quadraticCurveTo(14, -10, 14, -18); g.stroke();
      g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(14, -20, 3.5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function slotStage(p) {
    const wrap = el('div', undefined, 'city-slots');
    const head = el('div', undefined, 'city-slots-head');
    head.append(el('span', 'SLOTS'), el('strong', '幸运鹅老虎机'), el('em', '三连返还 · 炸弹清空'));
    wrap.append(head);
    const reels = el('div', undefined, 'city-reels');
    const symbols = lastSlots?.symbols?.length ? lastSlots.symbols : ['goose', 'dice', 'coin'];
    for (const id of symbols) {
      const sym = SLOT_SYMBOLS.find(s => s.id === id) || SLOT_SYMBOLS[0];
      const reel = el('div', undefined, 'city-reel');
      const icon = document.createElement('canvas');
      icon.width = 64; icon.height = 64; icon.className = 'city-reel-icon';
      drawSlotSymbol(icon.getContext('2d'), sym);
      reel.style.setProperty('--reel', sym.color);
      reel.append(icon, el('span', sym.name));
      reels.append(reel);
    }
    if (lastSlots && performance.now() - lastSlots.at < 900) reels.classList.add('rolling');
    wrap.append(reels);
    const result = el('p', undefined, 'city-slots-result');
    result.textContent = lastSlots ? (lastSlots.pay ? '中奖 +¥' + lastSlots.pay + '，见好就收？' : '没有中奖，再拉一把？') : '三枚相同符号有大奖，出现炸弹则清空。';
    wrap.append(result);
    const bets = el('div', undefined, 'city-slots-bets');
    for (const stake of [50, 200, 500]) bets.append(button('¥' + stake + ' 拉杆', () => action('slots', { amount: stake }), p.cash < stake));
    wrap.append(bets);
    return wrap;
  }

  function boonsLine(p) {
    if (!p.boons?.length) return null;
    const line = el('div', undefined, 'city-boons-line');
    line.append(el('span', '强化'));
    for (const id of p.boons) {
      const b = BOONS[id]; if (!b) continue;
      const chip = el('em', b.name);
      chip.style.setProperty('--boon', b.color);
      chip.title = b.description;
      line.append(chip);
    }
    return line;
  }

  function boonBoard(p) {
    const wrap = el('div', undefined, 'city-boons');
    wrap.append(el('p', '委托完成。选择一项本局永久强化；每个强化只会出现一次。', 'city-boon-hint'));
    const grid = el('div', undefined, 'city-boon-grid');
    for (const id of p.boonChoices || []) {
      const b = BOONS[id]; if (!b) continue;
      const item = card(b.name, b.description, null, [
        button('选择强化', () => { action('boon', { item: id }); $('cityPanel').close(); })
      ], serviceIcon('fixer'));
      item.style.setProperty('--boon', b.color);
      item.classList.add('city-boon-card');
      grid.append(item);
    }
    wrap.append(grid);
    const current = boonsLine(p);
    if (current) wrap.append(current);
    return wrap;
  }

  function contractBoard(p) {
    const wrap = el('div', undefined, 'city-contracts');
    if (p.contract) {
      const meta = CONTRACT_META[p.contract.kind] || { name: '委托', color: '#f0c97b' };
      const targetId = p.contract.kind === 'heist' && p.contract.stage === 2 ? p.contract.drop : p.contract.to || p.contract.place;
      const target = PLACES.find(q => q.id === targetId);
      const info = el('div', undefined, 'city-contract-active');
      info.style.setProperty('--contract', meta.color);
      info.append(el('span', '进行中 · ' + meta.name), el('strong', p.contract.name || meta.name), el('p', (p.contract.description || meta.description) + (target ? ' → ' + target.name : '') + ' · 奖励 ¥' + p.contract.pay));
      if (p.contract.kind === 'race') {
        const cps = (p.contract.checkpoints || []).map(id => PLACES.find(q => q.id === id)?.name).filter(Boolean);
        info.append(el('div', '检查点 ' + Math.min((p.contract.index || 0) + 1, cps.length) + '/' + cps.length + '：' + cps.join(' → ') + ' · 剩余 ' + Math.max(0, Math.ceil((p.contract.expires || 0) - state.time)) + 's', 'city-race-line'));
      }
      if (p.contract.kind === 'player') info.append(el('div', '目标：' + (p.contract.targetName || '玩家') + ' · 剩余 ' + Math.max(0, Math.ceil((p.contract.expires || 0) - state.time)) + 's · 目标撑到结束则失败', 'city-race-line'));
      if (p.contract.kind === 'heist') { const stage = p.contract.stage || 0; const drop = PLACES.find(q => q.id === p.contract.drop); info.append(el('div', '阶段 ' + (stage + 1) + '/3：' + (stage === 0 ? '到 ' + (PLACES.find(q => q.id === p.contract.place)?.name || '银行') + ' 按住 E 取得钥匙卡' : stage === 1 ? '打开金库' : '把赃款送到 ' + (drop?.name || '撤离点')) + ' · 剩余 ' + Math.max(0, Math.ceil((p.contract.expires || 0) - state.time)) + 's', 'city-race-line')); }
      wrap.append(info);
      if (p.contract.kind === 'vehicle') wrap.append(el('p', '地图上带金色边的是委托车辆；开到任意车行旁，下车后按 E 交货。', 'city-contract-hint'));
      wrap.append(button('放弃当前委托', () => action('abandonContract')));
      return wrap;
    }
    wrap.append(el('p', '在 Fixer 接一单：急送、悬赏或偷车。完成任意委托，都能从三项强化里选一项。', 'city-contract-hint'));
    const grid = el('div', undefined, 'city-contract-grid');
    for (const c of p.contracts || []) {
      const meta = CONTRACT_META[c.kind] || { name: '委托', color: '#f0c97b' };
      const item = card(c.name, c.description + ' · 奖励 ¥' + c.pay, null, [
        button(p.car ? '先下车' : '接受委托', () => action('acceptContract', { item: c.id }), !!p.car)
      ], serviceIcon('fixer'));
      item.style.setProperty('--contract', meta.color);
      grid.append(item);
    }
    if (!(p.contracts || []).length) grid.append(el('p', '委托板暂时空了，稍后再来。'));
    wrap.append(grid, button('换一批委托', () => action('refreshContracts'), !!p.car));
    return wrap;
  }

  function sellShelf(p) {
    const entries = Object.entries(p.inv).filter(([id, n]) => n > 0 && id !== p.gun && (Object.hasOwn(GUNS, id) || Object.hasOwn(GOODS, id)));
    const wrap = el('div', undefined, 'city-sell');
    wrap.append(el('h3', '黑市回收 · 半价'));
    if (!entries.length) { wrap.append(el('p', '当前没有可以回收的多余物品。', 'city-contract-hint')); return wrap; }
    const grid = el('div', undefined, 'city-shop-grid');
    for (const [id, count] of entries) {
      const base = GUNS[id]?.price ?? GOODS[id]?.price ?? 0;
      const price = Math.max(20, Math.round(base * .5 * (state.modifier?.sale || 1)));
      grid.append(card((GUNS[id]?.name || GOODS[id]?.name || id) + ' ×' + count, '回收价 ¥' + price, null, [
        button('回收一件', () => action('sell', { item: id }))
      ], itemIcon(id)));
    }
    wrap.append(grid);
    wrap.append(el('p', '当前装备的武器不会出现在回收列表里。', 'city-contract-hint'));
    return wrap;
  }

  function leaderboardTable() {
    const wrap = el('div', undefined, 'city-leaderboard');
    wrap.append(el('p', '按撤离时带走的总资产排名：现金 + 存款。只记录成功撤离的局。', 'city-contract-hint'));
    if (!leaderboardRows.length) { wrap.append(el('p', '还没有撤离记录。成为第一个带着 ¥10000 离开的人。', 'city-leaderboard-empty')); return wrap; }
    const table = el('table');
    const head = el('tr');
    for (const text of ['#', '玩家', '总资产', '用时', '击杀', '委托', '规则']) head.append(el('th', text));
    table.append(head);
    leaderboardRows.forEach((row, i) => {
      const tr = el('tr');
      if (i < 3) tr.className = 'top' + (i + 1);
      const mins = Math.floor((row.seconds || 0) / 60), secs = Math.floor((row.seconds || 0) % 60);
      tr.append(el('td', String(i + 1)), el('td', row.name || '匿名'), el('td', '¥' + (row.total || 0)), el('td', mins + ':' + String(secs).padStart(2, '0')), el('td', String(row.stats?.kills || 0)), el('td', String(row.stats?.contracts || 0)), el('td', row.rule || '—'));
      table.append(tr);
    });
    wrap.append(table);
    return wrap;
  }

  function quickEntries() {
    const p = state?.self;
    if (!p) return [];
    return Object.entries(p.inv).filter(([id, n]) => n > 0 && (GUN_IDS.has(id) || Object.hasOwn(GOODS, id))).slice(0, 6);
  }
  function useQuick(entry) {
    if (!entry) return;
    action(GUN_IDS.has(entry[0]) ? 'equip' : 'use', {item: entry[0]});
  }

  function openShop() {
    if (!serviceHere()) return;
    if (mode === 'shop') { closeShop(); return; }
    mode = 'shop'; panelKey = ''; shopTab = 'all';
    $('cityShop').hidden = false;
    document.body.classList.add('city-shop-open');
    updatePanel();
  }
  function closeShop() {
    if (mode === 'shop') { mode = ''; panelKey = ''; }
    $('cityShop').hidden = true;
    document.body.classList.remove('city-shop-open');
  }
  function panel(type) {
    if (type === 'shop') { openShop(); return; }
    closeShop();
    if (type === 'leaderboard' && state) send('city:leaderboard');
    clear();
    mode = type;
    panelKey = '';
    $('cityPanelTitle').textContent = {bag: '背包与快捷道具', map: '城市地图', help: '入城手册', leave: '放弃本次行动？', boon: '委托奖励', leaderboard: '都市排行榜'}[type];
    updatePanel();
    if (!$('cityPanel').open) $('cityPanel').showModal();
  }

  function updatePanel() {
    if (!state || !mode) return;
    const p = state.self, place = PLACES.find(q => q.id === p.near);
    if (mode === 'shop' && (p.hp <= 0 || p.escaped || !place || !SERVICE.has(place.kind))) { closeShop(); return; }
    const shop = mode === 'shop';
    const host = shop ? $('cityShop') : $('cityPanel');
    host.dataset.kind = shop && place ? (place.goose ? 'goose' : place.kind) : mode;
    const key = JSON.stringify([mode, place?.id, shopTab, lastDiceId, lastSlotsId, p.cash, p.bank, p.inv, p.gun, p.ammo, p.reserve, p.hp, p.armor, p.reload, p.car, p.message, p.contract, p.contracts, p.boons, p.boonChoices, p.mods, p.body, p.maxHp, p.armorCap, p.invCap, p.respawnPoint, state.modifier?.id, state.chaos, state.gooseRace?.phase, state.gooseRace?.startsIn, state.gooseRace?.winner, state.gooseRace?.own?.goose, state.gooseRace?.own?.amount, state.gooseRace?.geese?.map(g => g.progress), raceStake, state.offers, state.sent, state.event?.kind]);
    if (key === panelKey) return;
    panelKey = key;
    const body = shop ? $('cityShopBody') : $('cityPanelBody');
    const shopScroll = shop ? $('cityShopBody').scrollTop : 0;
    body.replaceChildren();
    if (shop) $('cityShopTitle').textContent = place ? place.name : '附近服务';
    else $('cityPanelTitle').textContent = {bag: '背包与快捷道具', map: '城市地图', help: '入城手册', leave: '放弃本次行动？', boon: '委托奖励', leaderboard: '都市排行榜'}[mode] || '附近服务';
    if (p.message) body.append(el('p', p.message, 'city-panel-message'));

    if (mode === 'help') {
      const items = [
        '赚够 ¥' + CITY.goal + ' 随身现金，在绿色撤离点按住 E 8 秒离开；银行存款可在撤离前取出使用。',
        'WASD / 方向键移动，Shift 冲刺，空格手刹（驾驶时），鼠标瞄准，按住左键攻击，R 装填，Q 快速换回上一把枪。霰弹枪一次打出 6 颗弹丸，冲锋枪射速极快。',
        'E 拾取 / 抢车 / 交货 / 按住开金库或撤离；靠近服务点按 E 或 F 打开半屏商店，商店打开时仍可移动。B 背包，M 地图，1–6 快捷使用道具。',
        '中央广场的 Fixer 发布急送、悬赏、偷车、狂飙委托；完成委托后从三项强化中选择一项，本局永久生效。',
        '每局城市规则不同：严打周、现金雨、黑市繁荣、肥鹅之夜、停电或无政府之夜。规则会影响警察、掉落、价格和事件。',
        '犯罪会推高全城混乱度。混乱度越高，警察和事件越凶，但委托奖励也越高；想赚大钱就得承担风险。',
        '黑市可以把当前枪械改装到 Lv.3：每级伤害 +15%、装填更快。狂飙委托要开车按顺序穿过三个检查点。',
        '义体诊所用现金强化身体：心脏 +20 最大生命、皮下装甲 +25 护甲上限、肌肉 +6% 移速、负重 +4 背包，每项三级，本局保留。',
        'Fixer 会发布玩家猎杀悬赏：确认目标后 120 秒内击倒他；被悬赏的人撑到结束可拿生存奖金。被悬赏时人物头顶会出现红色金额。',
        '赛鹅竞技场每 25 秒开一场：下注窗口内选鹅，比赛开始后赛道上的六只鹅会实时冲线，押中按赔率结算。右上角会显示下一场倒计时。',
        '通缉按热度槽计算：每次犯罪累积热度，8 点一星；脱离警察 4 秒后热度才下降。2 星起警察才会锁定你，4 星出警车，5 星设路障并出动直升机。',
        '新道具：烟雾弹遮蔽视线，感应地雷自动引爆，肾上腺素 8 秒加速，闪光弹震盲，护甲板补 40 甲。左轮、精确步枪和轻机枪是黑市限定。',
        '安全屋可设置重生点；诊所花现金回血或补护甲；黑市什么都有，但加价 35%。',
        '赌场除了骰子，还有老虎机：三连返还，炸弹清空。所有筹码都是局内虚拟币。',
        '死亡掉落背包、武器和 70% 随身现金；4 秒后复活。新入城/复活有 10 秒保护，主动犯罪或攻击会结束保护。',
        '手机左摇杆移动、右摇杆瞄准攻击，按住 E 按钮互动；快捷道具条也可以直接点。'
      ];
      for (const text of items) body.append(el('p', text));
      return;
    }
    if (mode === 'leave') {
      body.append(el('p', '随身现金和物品会留在都市，本局存款与进度结束。'), button('确认放弃并回大厅', () => { $('cityPanel').close(); exit(); }));
      return;
    }
    if (mode === 'map') {
      const map = el('canvas');
      map.width = 768;
      map.height = 576;
      map.className = 'city-large-map';
      body.append(map);
      const directory = el('div', undefined, 'city-place-directory');
      for (const place of PLACES) {
        const entry = el('div', undefined, 'city-place-entry');
        entry.append(serviceIcon(place.black ? 'black-market' : place.goose ? 'goose' : place.kind, 'city-place-icon'), el('span', place.name));
        directory.append(entry);
      }
      body.append(directory, el('p', '金色圆点是你；地图上只标服务类型，完整名称见下方目录。'));
      renderer.map(map, state);
      return;
    }
    if (mode === 'bag') {
      body.append(card(GUNS[p.gun].name + ((p.mods?.gun || 0) ? ' · 改装 Lv.' + p.mods.gun : ''), `弹匣 ${p.ammo} / 备用 ${p.reserve}${p.reload > 0 ? ' · 装填中 ' + p.reload.toFixed(1) + 's' : ''}${(p.mods?.gun || 0) ? ' · 伤害 +' + (p.mods.gun * 15) + '%' : ''}`, null, [button('装填', () => action('reload'), !GUNS[p.gun].mag || p.reload > 0)], itemIcon(p.gun)));
      if (p.contract) body.append(card('当前委托 · ' + p.contract.name, p.contract.description || '', null, [button('放弃委托', () => action('abandonContract'))], serviceIcon('fixer')));
      const inv = Object.entries(p.inv).filter(([, n]) => n > 0);
      body.append(el('p', '背包容量 ' + inv.reduce((a, [, n]) => a + n, 0) + '/' + (p.invCap || 12), 'city-contract-hint'));
      if (inv.length) {
        const grid = el('div', undefined, 'city-shop-grid');
        for (const [id, count] of inv) {
          const isGun = GUN_IDS.has(id);
          const item = GOODS[id] || GUNS[id] || {name: id, description: ''};
          grid.append(card(item.name + ' ×' + count, item.description || (isGun ? '可装备武器' : ''), null, [
            button(isGun ? '装备' : '使用', () => action(isGun ? 'equip' : 'use', {item: id})),
            button('丢下', () => action('drop', {item: id}))
          ], itemIcon(id)));
        }
        body.append(grid);
      } else body.append(el('p', '背包空空。按 E 搜刮街头物资，或到商店补给。'));
      const nearby = state.players.filter(q => q.id !== self() && q.hp > 0 && Math.hypot(q.x - p.x, q.y - p.y) < 110);
      if (nearby.length) {
        body.append(el('h3', '附近玩家'));
        for (const q of nearby) {
          body.append(row(q.name, '可转交现金或出售背包物品', [button('给100', () => action('gift', {target: q.id}), p.cash < 100)]));
          const items = Object.entries(p.inv).filter(([, n]) => n > 0);
          if (items.length) {
            const r = el('div', undefined, 'city-trade'), select = el('select'), price = el('input');
            for (const [id] of items) select.append(new Option(GOODS[id]?.name || GUNS[id]?.name, id));
            price.type = 'number';
            price.min = '0';
            price.max = '10000';
            price.value = '100';
            price.setAttribute('aria-label', '交易价格');
            r.append(select, price, button('报价给 ' + q.name, () => action('offer', {target: q.id, item: select.value, price: Number(price.value)})));
            body.append(r);
          }
        }
      }
      for (const offer of state.offers) body.append(row(`${offer.name} 的报价`, `${GOODS[offer.item]?.name || GUNS[offer.item]?.name} · ¥${offer.price}`, [button('接受交易', () => action('accept', {offer: offer.id}), p.cash < offer.price)]));
      for (const offer of state.sent || []) body.append(row(`等待 ${offer.name} 接受`, `${GOODS[offer.item]?.name || GUNS[offer.item]?.name} · ¥${offer.price} · 剩余 ${Math.max(0, Math.ceil(offer.until - state.time))}s`, []));
      return;
    }

    if (mode === 'leaderboard') {
      body.append(leaderboardTable());
      return;
    }
    if (mode === 'boon') {
      body.append(boonBoard(p));
      return;
    }
    if (!place) {
      body.append(el('p', '靠近地图上的服务点。打开地图可以查看位置。'));
      return;
    }
    const discount = state.event?.kind === 'sale' ? .7 : 1;
    body.append(serviceHero(place, p, discount));

    if (place.kind === 'fixer') {
      body.append(contractBoard(p));
      const current = boonsLine(p);
      if (current) body.append(current);
      if (p.boonChoices?.length) body.append(boonBoard(p));
    } else if (place.kind === 'safehouse') {
      const here = p.respawnPoint && Math.hypot(p.respawnPoint.x - p.x, p.respawnPoint.y - p.y) < 140;
      body.append(card('重生点', here ? '这间安全屋已经是你的重生点。' : '把重生点设在这里，倒下后会在安全屋门口醒来，不用被随机投放。', null, [
        button(here ? '已设置' : '设为重生点', () => action('setRespawn'), here || !!p.car)
      ], serviceIcon('safehouse')));
      body.append(card('安全屋守则', '重生点只记录位置，不保留现金与背包；贵重物品请存银行或尽快撤离。', null, [], serviceIcon('safehouse')));
    } else if (place.kind === 'clinic') {
      const cost = Math.max(60, Math.ceil(((p.maxHp || 100) - p.hp) * 2));
      body.append(card('缝合伤口', p.hp >= (p.maxHp || 100) ? '状态良好，不需要治疗。' : `恢复全部生命，费用 ¥${cost}。`, el('span', '¥' + cost, 'city-price'), [
        button(p.hp >= (p.maxHp || 100) ? '状态良好' : p.cash < cost ? '现金不足' : '治疗', () => action('heal', { item: 'hp' }), p.hp >= (p.maxHp || 100) || p.cash < cost || !!p.car)
      ], serviceIcon('clinic')));
      body.append(card('防弹护甲', '补充 60 点护甲，费用 ¥300。', el('span', '¥300', 'city-price'), [
        button(p.cash < 300 ? '现金不足' : '购买护甲', () => action('heal', { item: 'armor' }), p.cash < 300 || !!p.car)
      ], serviceIcon('clinic', 'danger')));
    } else if (place.kind === 'cyber') {
      body.append(bodyShop(p));
    } else if (place.kind === 'arms' || place.kind === 'market') {
      const black = place.black === true;
      const all = black
        ? [...Object.entries(GUNS).filter(([id]) => id !== 'fists'), ['ammo', GOODS.ammo], ...Object.entries(GOODS).filter(([id]) => id !== 'ammo')]
        : place.kind === 'arms'
          ? [...Object.entries(GUNS).filter(([id]) => id !== 'fists'), ['ammo', GOODS.ammo]]
          : Object.entries(GOODS);
      const items = all.filter(([id]) => shopTab === 'all' || categoryOf(id, place.kind) === shopTab);
      if (!black) body.append(shopTabs(place.kind, shopTab, id => { shopTab = id; panelKey = ''; updatePanel(); }));
      const grid = el('div', undefined, 'city-shop-grid');
      for (const [id, item] of items) {
        const markup = black && state.modifier?.id !== 'blackmarket' ? 1.35 : 1;
        const price = Math.ceil((item.price ?? GUNS[id]?.price ?? 0) * discount * markup * (state.modifier?.sale || 1));
        const owned = id !== 'ammo' && (id === p.gun || (p.inv[id] || 0) > 0);
        const detail = item.description || (GUNS[id] ? `伤害 ${GUNS[id].damage} · ${GUNS[id].mag ? GUNS[id].mag + ' 发弹匣' : '近战'}` : '');
        const meta = el('div', undefined, 'city-card-meta');
        meta.append(el('span', '¥' + price, 'city-price'));
        if (black) meta.append(el('span', markup > 1 ? '黑市 +35%' : '规则免加价', 'city-owned'));
        if (owned) meta.append(el('span', '已拥有', 'city-owned'));
        grid.append(card(item.name, detail, meta, [
          button(owned ? '已拥有' : p.cash < price ? '现金不足' : '购买', () => action('buy', {item: id}), owned || p.cash < price || !!p.car)
        ], itemIcon(id)));
      }
      if (black) {
        const lv = p.mods?.gun || 0, upCost = lv < 3 ? Math.ceil([450, 950, 1700][lv] * (state.modifier?.sale || 1)) : 0;
        body.append(card('枪械改装 Lv.' + lv, lv >= 3 ? '当前武器已满级。' : `当前武器伤害 +${lv * 15}%，装填 -${lv * 6}%。下一级伤害 +15%，费用 ¥${upCost}。`, el('span', lv < 3 ? '¥' + upCost : 'MAX', 'city-price'), [
          button(lv >= 3 ? '已满级' : p.gun === 'fists' ? '先装备枪械' : p.cash < upCost ? '现金不足' : '改装', () => action('upgrade', {item: 'gun'}), lv >= 3 || p.gun === 'fists' || p.cash < upCost || !!p.car)
        ], itemIcon(p.gun === 'fists' ? 'pistol' : p.gun)));
        body.append(el('p', '改装只对当前装备的枪械生效；黑市不问来路，也不开发票。', 'city-contract-hint'));
        body.append(sellShelf(p));
      }
      body.append(grid);
    } else if (place.kind === 'bank') {
      if (p.contract?.kind === 'heist') body.append(card('劫案阶段 ' + ((p.contract.stage || 0) + 1) + '/3', p.contract.stage === 0 ? '关闭面板后按住 E 取得钥匙卡。' : p.contract.stage === 1 ? '钥匙卡到手，可以拉响警报开金库。' : '赃款已到手，送到地图标记的撤离点。', null, [], serviceIcon('bank')));
      const account = el('div', undefined, 'city-bank-line');
      account.append(el('strong', '¥' + p.cash), el('span', '存款 ¥' + p.bank));
      body.append(card('个人账户', '存款不会因死亡丢失；撤离需要随身现金。', account, [
        button('存 100', () => action('deposit', {amount: 100}), p.cash < 100),
        button('存全部', () => action('deposit', {amount: 'all'}), !p.cash),
        button('取 100', () => action('withdraw', {amount: 100}), p.bank < 100),
        button('取全部', () => action('withdraw', {amount: 'all'}), !p.bank)
      ], serviceIcon('bank')));
      body.append(card('抢劫金库', '持武器，拉响警报后按住 E 12 秒；收益 1600，会触发通缉。', null, [
        button(p.gun === 'fists' ? '需要武器' : '拉响警报 · 按住 E', () => { action('robBank'); closeShop(); }, p.gun === 'fists' || !!p.car)
      ], serviceIcon('bank', 'danger')));
    } else if (place.kind === 'job') {
      body.append(card('临时打工', '站在原地工作 10 秒，赚 260。', null, [button('开始打工', () => { action('work'); closeShop(); }, !!p.job)], serviceIcon('job')));
      body.append(card('城市配送', p.job ? `配送中 → ${PLACES.find(q => q.id === p.job.to)?.name || p.job.to}` : '接单后开车或步行送达，按路程计酬。', null, [
        button(p.job ? '先完成当前配送' : '接单', () => { action('delivery'); closeShop(); }, !!p.job)
      ], itemIcon('car')));
    } else if (place.kind === 'casino') {
      body.append(place.goose ? gooseRaceStage(place, p) : casinoStage(place, p));
    } else if (place.kind === 'garage') {
      const price = Math.ceil(900 * discount * (state.modifier?.sale || 1));
      body.append(card('二手小车', '买下后停在车行门口，走近按 E 上车。', el('span', '¥' + price, 'city-price'), [
        button(p.cash < price ? '现金不足' : '购买', () => action('buy', {item: 'car'}), p.cash < price || !!p.car)
      ], itemIcon('car')));
    } else if (place.kind === 'escape') {
      const need = Math.max(0, CITY.goal - p.cash);
      body.append(card('撤离点', need ? `还需要 ¥${need} 随身现金。` : '满足条件。关闭面板后按住 E 8 秒。', null, [button('知道了', () => $('cityPanel').close())], serviceIcon('escape')));
    }
    if (shop) $('cityShopBody').scrollTop = shopScroll;
  }

  function reloadLabel() {
    const p = state.self;
    if (p.car) return '驾驶中';
    const gun = GUNS[p.gun];
    if (p.reload > 0) return '装填 ' + p.reload.toFixed(1) + 's';
    return gun.name + (gun.mag ? ` ${p.ammo}/${p.reserve}` : '');
  }

  function quickbar() {
    const entries = quickEntries(), key = JSON.stringify(entries);
    if (key === quickKey) return;
    quickKey = key;
    const box = $('cityQuick');
    box.replaceChildren();
    entries.forEach(([id, count], i) => {
      const isGun = GUN_IDS.has(id);
      const b = el('button', undefined, 'city-quick-item');
      b.type = 'button';
      const copy = el('div', undefined, 'city-quick-copy');
      copy.append(el('strong', (GUNS[id]?.name || GOODS[id]?.name || id) + ' ×' + count), el('small', isGun ? '装备' : '使用'));
      b.append(el('kbd', padNumber(i + 1)), itemIcon(id, 'city-quick-icon'), copy);
      b.addEventListener('click', () => useQuick([id]));
      box.append(b);
    });
  }

  function updatePrompt() {
    if (!state) return;
    const p = state.self, m = me();
    const place = PLACES.find(q => q.id === p.near);
    const loot = state.loot.find(q => dist({x: q[2], y: q[3]}, m) < 42);
    const car = state.cars.find(c => c[4] > 0 && !c[6] && Math.abs(c[8]) < 100 && dist({x: c[1], y: c[2]}, m) < 64);
    const civilian = state.npcs.find(n => n[1] === 'civilian' && n[4] > 0 && dist({x: n[2], y: n[3]}, m) < 64);
    const hints = [];
    let act = '';
    if (p.hp > 0 && !p.escaped) {
      if (p.car) {
        if (p.contract?.kind === 'vehicle' && place?.kind === 'garage') { hints.push('按 E 交付委托车辆'); hints.push('F 下车'); }
        else { hints.push('F 下车'); hints.push('Shift 冲刺'); }
      } else if (p.progress) {
        hints.push({work: '打工进行中 · 留在原地', bank: '开金库 · 按住 E', car: '抢车 · 按住 E', mug: '抢劫 · 按住 E', escape: '撤离 · 按住 E'}[p.progress.kind] || '任务进行中');
      } else {
        const serviceSpot = !!(place && SERVICE.has(place.kind));
        if (serviceSpot) { hints.push('E / F · ' + place.name); act = 'service'; }
        if (p.contract?.kind === 'delivery' && p.contract.to === place?.id) hints.unshift('按 E 交付委托');
        if (p.contract?.kind === 'bounty' && p.contract.place === place?.id) hints.unshift('委托目标就在' + place.name + '附近');
        if (p.contract?.kind === 'race') { const target = PLACES.find(q => q.id === p.contract.checkpoints?.[p.contract.index]); if (target && place?.id === target.id) hints.unshift('狂飙检查点 ' + ((p.contract.index || 0) + 1) + '/' + p.contract.checkpoints.length + ' · 留在圈内'); }
        if (p.contract?.kind === 'heist') { const target = p.contract.stage === 2 ? p.contract.drop : p.contract.place; if (place?.id === target) hints.unshift(p.contract.stage === 0 ? '按住 E 取得钥匙卡 4 秒' : p.contract.stage === 1 ? '打开金库' : '按 E 交付赃款'); }
        if (place?.kind === 'escape') hints.push(p.cash >= CITY.goal ? '按住 E 撤离 8 秒' : `撤离需要 ¥${CITY.goal} · 当前 ¥${p.cash}`);
        if (loot) hints.push(loot[1] === 'cash' ? 'E 拾取 ¥' + loot[4] : 'E 拾取 ' + (GUNS[loot[1]]?.name || GOODS[loot[1]]?.name || loot[1]));
        if (!serviceSpot && car) hints.push(car[5] === self() ? '按住 E 上车' : '按住 E 抢车');
        if (!serviceSpot && civilian && p.gun !== 'fists') hints.push('按住 E 抢劫路人');
        if (!hints.length && place) hints.push(place.name);
      }
    }
    const text = hints.slice(0, 3).join(' · ');
    const key = text + '|' + act;
    if (key === promptKey) return;
    promptKey = key;
    $('cityPrompt').hidden = !text;
    $('cityPromptText').textContent = text;
    const actionButton = $('cityPromptAction');
    actionButton.hidden = act !== 'service';
    if (act === 'service') actionButton.textContent = '打开';
  }

  function hud() {
    if (!state) return;
    const p = state.self;
    $('cityCash').textContent = '¥' + p.cash;
    $('cityBank').textContent = '存款 ' + p.bank;
    $('cityHp').textContent = 'HP ' + p.hp + '/' + (p.maxHp || 100) + (p.armor ? ' · 甲 ' + p.armor + '/' + (p.armorCap || 100) : '');
    $('cityWanted').textContent = p.wanted ? '★'.repeat(p.wanted) + ' · 热度 ' + Math.round(p.heat || 0) : '暂无通缉';
    const chaosLevel = state.chaosLevel || 0;
    $('cityChaos').textContent = '混乱 ' + chaosLevel + ' · ' + (state.chaos || 0) + '%';
    $('cityChaos').dataset.level = String(chaosLevel);
    $('cityChaos').title = '犯罪会推高全城混乱度；混乱越高，警察和事件越凶，但委托奖励越高。';
    $('cityWeapon').textContent = reloadLabel() + ((p.mods?.gun || 0) ? ' · 改装 Lv.' + p.mods.gun : '');
    $('cityPopulation').textContent = state.count + '/8';
    const ruleText = state.modifier ? '规则 ' + state.modifier.name + ' · ' : '';
    $('cityEvent').textContent = ruleText + (state.event ? EVENTS[state.event.kind].name + ' · ' + Math.ceil(state.event.ends - state.time) + 's' : '下一事件 ' + state.next + 's');
    $('cityEvent').title = state.modifier ? state.modifier.description : '';
    $('cityEvent').dataset.active = String(!!state.event);
    const feed = (state.feed || []).filter(e => !['race', 'join', 'leave'].includes(e.kind) && state.time - (e.at || 0) < 16), nextFeedKey = feed.map(e => e.id).join('|');
    if (nextFeedKey !== feedKey) {
      feedKey = nextFeedKey;
      const box = $('cityFeed');
      box.replaceChildren();
      for (const entry of feed.slice(-3)) {
        const line = el('div', entry.text, 'city-feed-line');
        line.dataset.kind = entry.kind || 'info';
        box.append(line);
      }
      box.hidden = !feed.length;
    }
    const gooseRaceState = state.gooseRace;
    if (gooseRaceState && p.near === 'goose-stadium') {
      $('cityRace').hidden = false;
      $('cityRace').dataset.phase = gooseRaceState.phase;
      $('cityRace').textContent = gooseRaceState.phase === 'betting' ? '赛鹅 · ' + gooseRaceState.startsIn + 's 后开跑' : gooseRaceState.phase === 'racing' ? '赛鹅 · 冲线中' : '赛鹅 · ' + (gooseRaceState.winnerName || '') + ' 获胜';
    } else $('cityRace').hidden = true;
    const venue = PLACES.find(q => q.id === p.near);
    $('cityService').textContent = venue ? venue.name : '服务';
    $('cityService').disabled = !venue || p.hp <= 0 || !!p.car;
    $('cityReload').hidden = !GUNS[p.gun].mag || !!p.car;
    $('cityCarExit').hidden = !p.car;
    const ownCar = p.car ? state.cars.find(c => c[0] === p.car) : null;
    $('citySpeed').hidden = !p.car;
    $('cityBrake').hidden = !p.car;
    if (p.car) $('citySpeed').textContent = Math.round((ownCar?.[8] || 0) * .18) + ' km/h';
    const race = p.contract?.kind === 'race';
    const heistTarget = p.contract?.kind === 'heist' ? (p.contract.stage === 2 ? p.contract.drop : p.contract.place) : null;
    const contractTarget = p.contract ? PLACES.find(q => q.id === (race ? p.contract.checkpoints?.[p.contract.index] : heistTarget || p.contract.to || p.contract.place)) : null;
    const contractText = !p.contract ? '' : race ? '狂飙 · 检查点 ' + Math.min((p.contract.index || 0) + 1, (p.contract.checkpoints || []).length) + '/' + (p.contract.checkpoints || []).length + (contractTarget ? ' → ' + contractTarget.name : '') + ' · ' + Math.max(0, Math.ceil((p.contract.expires || 0) - state.time)) + 's' : p.contract.kind === 'player' ? '猎杀 · ' + (p.contract.targetName || '玩家') + ' · 剩余 ' + Math.max(0, Math.ceil((p.contract.expires || 0) - state.time)) + 's' : p.contract.kind === 'heist' ? '劫案 · ' + (p.contract.stage === 0 ? '取得钥匙卡' : p.contract.stage === 1 ? '打开金库' : '送达 ' + (contractTarget?.name || '撤离点')) + ' · 剩余 ' + Math.max(0, Math.ceil((p.contract.expires || 0) - state.time)) + 's' : '委托 · ' + p.contract.name + (contractTarget ? ' → ' + contractTarget.name : p.contract.kind === 'vehicle' ? ' → 任意车行' : '');
    $('cityTask').dataset.hunted = String(!!p.bounty);
    $('cityTask').classList.toggle('city-task-hunted', !!p.bounty);
    const bountyText = p.bounty ? '你被 ' + (p.bounty.hunter || '某人') + ' 悬赏 ¥' + p.bounty.amount + ' · 撑住 ' + Math.max(0, Math.ceil((p.bounty.until || 0) - state.time)) + 's' : '';
    $('cityTask').textContent = p.bounty ? bountyText : p.progress ? `${ {work: '打工', bank: '开金库', car: '抢车', mug: '抢劫', escape: '撤离'}[p.progress.kind] } ${Math.max(0, p.progress.left).toFixed(1)}s` : p.contract ? contractText : p.job ? '配送 → ' + PLACES.find(q => q.id === p.job.to)?.name + ' · ¥' + p.job.pay : p.shield > 0 ? '保护 ' + Math.ceil(p.shield) + 's · 主动攻击会结束' : state.event ? EVENTS[state.event.kind].hint : '赚够 ¥' + CITY.goal + '，去绿色撤离点';
    const nextMessage = p.message || state.feed.at(-1)?.text || '';
    if (nextMessage !== message) {
      message = nextMessage;
      $('cityMessage').textContent = message;
    }
    $('cityRespawn').hidden = p.hp > 0 && !p.escaped;
    $('cityRespawnTitle').textContent = p.escaped ? '成功撤离' : '你倒下了';
    const autoBack = p.escaped ? Math.max(0, 12 - Math.ceil((performance.now() - escapedAt) / 1000)) : 0;
    const death = p.death;
    $('cityRespawnText').textContent = p.escaped ? `带走现金 ¥${p.result.cash} · 存款 ¥${p.result.bank} · 用时 ${p.result.seconds}s · ${autoBack}s 后返回大厅` : `${death ? '被 ' + death.by + ' 用 ' + death.gun + ' 击倒 · 伤害 ' + death.damage + ' · 掉落 ¥' + death.lost + ' · ' : ''}${Math.ceil(p.respawn)}秒后重新投放，观战中`;
    $('cityResultBack').hidden = !p.escaped;
    if (p.boonChoices?.length && !$('cityPanel').open && !p.escaped) {
      const key = p.boonChoices.join(',');
      if (key !== boonKey) { boonKey = key; panel('boon'); }
    }
    quickbar();
    updatePrompt();
    updatePanel();
  }

  function controls() {
    const stop = blocked() || state.self.hp <= 0 || state.self.escaped;
    const x = stop ? 0 : (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + stick.x;
    const y = stop ? 0 : (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + stick.y;
    const n = Math.max(1, Math.hypot(x, y));
    return {x: x / n, y: y / n, angle: aim, fire: !stop && fire, interact: !stop && !suppressInteract && (interact || keys.has('e')), sprint: !stop && keys.has('shift'), brake: !stop && (brake || keys.has(' '))};
  }
  function packet() { if (active && state && online()) send('city:input', {id: state.id, seq: ++seq, ...controls()}); }
  function predict(dt) { if (state) predicted = prediction.advance(dt, controls(), state.self, obstacles); }

  function worldInteractNearby() {
    if (!state) return false;
    const m = me();
    return state.loot.some(q => dist({x: q[2], y: q[3]}, m) < 42);
  }
  function serviceHere() {
    const p = state?.self;
    if (!p || p.car || p.hp <= 0 || p.escaped || p.progress) return null;
    const venue = PLACES.find(q => q.id === p.near);
    return venue && SERVICE.has(venue.kind) ? venue : null;
  }

  function toggleChat(force) {
    const on = force ?? !document.body.classList.contains('city-chat');
    document.body.classList.toggle('city-chat', on);
    $('cityChat').setAttribute('aria-pressed', String(on));
  }

  window.addEventListener('keydown', e => {
    if (!active || blocked() || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'shift', ' '].includes(k)) {
      e.preventDefault();
      keys.add(k);
    }
    if (/^[1-6]$/.test(k) && !e.repeat) {
      e.preventDefault();
      useQuick(quickEntries()[Number(k) - 1]);
      return;
    }
    if (k === 'e' && !e.repeat) {
      if (mode === 'shop') { closeShop(); suppressInteract = true; return; }
      if (serviceHere() && !worldInteractNearby()) { openShop(); suppressInteract = true; return; }
    }
    if (k === 'escape' && mode === 'shop') { closeShop(); return; }
    if (k === 'f' && !e.repeat) {
      if (state.self.car) { action('exitCar'); return; }
      if (mode === 'shop') { closeShop(); return; }
      if (serviceHere()) { openShop(); return; }
    }
    if (k === 'r' && !e.repeat) action('reload');
    if (k === 'q' && !e.repeat && !state.self.car && lastGun) action('equip', {item: lastGun});
    if (k === 'b' && !e.repeat) panel('bag');
    if (k === 'm' && !e.repeat) panel('map');
    if (k === 'enter') {
      clear();
      toggleChat(true);
      $('chatBody').hidden = false;
      $('chatInput').focus();
    }
  });
  window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); if (k === 'e') suppressInteract = false; });
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { clear(); packet(); });

  canvas.addEventListener('pointermove', e => {
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;
    pointer.inside = true;
    if (!state) return;
    const point = renderer.point(e.clientX, e.clientY), p = predicted || state.self;
    aim = Math.atan2(point.y - p.y, point.x - p.x);
  });
  canvas.addEventListener('pointerenter', e => { pointer.clientX = e.clientX; pointer.clientY = e.clientY; pointer.inside = true; });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
  canvas.addEventListener('pointerdown', e => {
    if (!active || e.button !== 0) return;
    e.preventDefault();
    canvas.focus({preventScroll: true});
    fire = true;
  });
  window.addEventListener('pointerup', () => { fire = false; });
  window.addEventListener('pointercancel', () => { fire = false; });

  function pad(id, kind) {
    const node = $(id);
    let pointerId = null;
    const move = e => {
      if (pointerId !== e.pointerId) return;
      const b = node.getBoundingClientRect(), dx = e.clientX - b.x - b.width / 2, dy = e.clientY - b.y - b.height / 2, len = Math.max(b.width / 2, Math.hypot(dx, dy));
      if (kind === 'move') {
        stick = {x: dx / len, y: dy / len};
        $('cityMoveKnob').style.transform = `translate(${stick.x * 22}px,${stick.y * 22}px)`;
      } else if (Math.hypot(dx, dy) > 8) {
        aim = Math.atan2(dy, dx);
        fire = true;
      }
    };
    node.addEventListener('pointerdown', e => { e.preventDefault(); pointerId = e.pointerId; node.setPointerCapture(pointerId); move(e); });
    node.addEventListener('pointermove', move);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(t, () => {
      pointerId = null;
      if (kind === 'move') { stick = {x: 0, y: 0}; $('cityMoveKnob').style.transform = ''; }
      else fire = false;
    });
  }
  pad('cityMovePad', 'move');
  pad('cityAimPad', 'aim');
  $('cityInteract').addEventListener('pointerdown', e => {
    e.preventDefault(); $('cityInteract').setPointerCapture(e.pointerId);
    if (mode === 'shop') { closeShop(); suppressInteract = true; }
    else if (serviceHere() && !worldInteractNearby()) { openShop(); suppressInteract = true; }
    else interact = true;
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) $('cityInteract').addEventListener(t, () => { interact = false; suppressInteract = false; });

  for (const [id, type] of [['cityBag', 'bag'], ['cityMapButton', 'map'], ['cityLeaderboard', 'leaderboard'], ['cityService', 'shop'], ['cityHelp', 'help']]) $(id).onclick = () => panel(type);
  $('cityLeave').onclick = () => state?.self.escaped ? exit() : panel('leave');
  $('cityResultBack').onclick = exit;
  const soundButton = $('citySound');
  const paintSound = () => { if (!soundButton) return; soundButton.textContent = audio.muted ? '🔇' : '🔊'; soundButton.setAttribute('aria-pressed', String(!audio.muted)); };
  if (soundButton) {
    soundButton.onclick = () => { audio.unlock(); audio.setMuted(!audio.muted); paintSound(); if (!audio.muted) audio.ui(); };
    paintSound();
  }
  $('cityReload').onclick = () => action('reload');
  $('cityCarExit').onclick = () => action('exitCar');
  $('cityBrake').addEventListener('pointerdown', e => { e.preventDefault(); $('cityBrake').setPointerCapture(e.pointerId); brake = true; });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) $('cityBrake').addEventListener(t, () => { brake = false; });
  $('cityPanelClose').onclick = () => $('cityPanel').close();
  $('cityShopClose').onclick = closeShop;
  $('cityPanel').addEventListener('close', () => { mode = ''; canvas.focus({preventScroll: true}); });
  $('cityChat').onclick = () => toggleChat();
  $('cityPromptAction').onclick = () => { if (serviceHere()) openShop(); };

  function frame(now) {
    requestAnimationFrame(frame);
    if (!active || !state) return;
    const dt = Math.min(.05, (now - lastTime) / 1000);
    lastTime = now;
    predict(dt);
    if (fire && !state.self.car && state.self.hp > 0 && !state.self.escaped) {
      const gun = GUNS[state.self.gun];
      if ((!gun.mag || state.self.ammo > 0) && state.self.reload <= 0 && now - lastLocalShot >= gun.interval * 1000) {
        lastLocalShot = now;
        fireAt = now;
        audio.shot(state.self.gun);
      }
    }
    if (now - lastPacket >= 50) { packet(); lastPacket = now; }
    if (now - lastMap > 500) { renderer.map($('cityMiniMap'), renderState()); lastMap = now; }
    if (now - lastHud > 100) { hud(); lastHud = now; }
    const p = state.self;
    if (now - engineAt > 120) { const car = p.car ? state.cars.find(c => c[0] === p.car) : null; audio.engine(!!p.car && !blocked(), car?.[8] || 0); engineAt = now; }
    if (p.wanted >= 2 && now - sirenAt > 2400 && state.cars.some(c => c[7] === 'police' && Math.hypot(c[1] - p.x, c[2] - p.y) < 650)) { sirenAt = now; audio.alarm(); }
    if (p.escaped && escapedAt && now - escapedAt > 12000) exit();
  }
  requestAnimationFrame(frame);

  return {
    get active() { return active; },
    receive(data) {
      const previousSelf = state?.self, previousEvent = state?.event;
      if (data.id !== state?.id) {
        seq = 0;
        actionSeq = 0;
        mapPoints = [];
        prediction.clear();
        fxAt.clear();
        lastDice = null;
        lastDiceId = '';
        lastSlots = null;
        lastSlotsId = '';
        escapedAt = 0;
        boonKey = '';
        lastRacePhase = '';
        feedKey = '';
        lastGun = '';
      }
      seq = Math.max(seq, data.self.seq);
      actionSeq = Math.max(actionSeq, data.self.actionSeq);
      state = data;
      snapshotAt = performance.now();
      if (data.gooseRace?.phase && data.gooseRace.phase !== lastRacePhase) {
        if (data.self.near === 'goose-stadium') {
          if (data.gooseRace.phase === 'racing') audio.checkpoint();
          else if (data.gooseRace.phase === 'result') audio.reward();
        }
        lastRacePhase = data.gooseRace.phase;
      }
      const diceEffect = [...data.effects].reverse().find(e => e.kind === 'dice');
      if (diceEffect && diceEffect.id !== lastDiceId) {
        lastDiceId = diceEffect.id;
        lastDice = {face: Number(diceEffect.text) || 1, win: String(data.self.message || '').includes('赢得'), at: snapshotAt};
      }
      const slotEffect = [...data.effects].reverse().find(e => e.kind === 'slots');
      if (slotEffect && slotEffect.id !== lastSlotsId) {
        lastSlotsId = slotEffect.id;
        lastSlots = {symbols: String(slotEffect.text || '').split(',').filter(Boolean), pay: Number(slotEffect.pay) || 0, at: snapshotAt};
      }
      if (data.self.escaped && !escapedAt) escapedAt = snapshotAt;
      if (!data.self.escaped) escapedAt = 0;
      obstacles = data.objects.map(q => ({kind: q[1], x: q[2], y: q[3], hp: q[4]}));
      const effected = new Set();
      for (const e of data.effects) {
        effected.add(e.id);
        if (!fxAt.has(e.id)) {
          fxAt.set(e.id, snapshotAt);
          const far = Math.hypot((e.x || 0) - data.self.x, (e.y || 0) - data.self.y);
          if (e.kind === 'shot' && far > 28) audio.shot(e.gun || 'pistol', .45);
          else if (e.kind === 'explosion' && far < 700) audio.explosion();
          else if (e.kind === 'flash') audio.flash();
          else if (e.kind === 'hit') { if (far < 34) audio.hit(.5); else audio.hit(); }
          else if (e.kind === 'fall' && far < 500) audio.kill();
          else if (e.kind === 'slots') audio.slots(Number(e.pay) > 0);
          else if (e.kind === 'checkpoint') audio.checkpoint();
          else if (e.kind === 'bounty') audio.bounty();
          else if (e.kind === 'dice') audio.ui();
        }
      }
      if (previousSelf) {
        if (previousSelf.gun && data.self.gun !== previousSelf.gun) lastGun = previousSelf.gun === 'fists' ? 'fists' : previousSelf.gun;
        if (data.self.hp < previousSelf.hp) audio.hurt();
        if (data.self.wanted > previousSelf.wanted) audio.alarm();
        if (data.self.cash > previousSelf.cash) audio.cash();
        if (!previousSelf.bounty && data.self.bounty) audio.bounty();
        if (!previousSelf.boonChoices?.length && data.self.boonChoices?.length) audio.reward();
      }
      if (!previousEvent && data.event) audio.alarm();
      for (const id of fxAt.keys()) if (!effected.has(id)) fxAt.delete(id);
      predicted = prediction.reconcile(data, controls());
      if (data.map) mapPoints = data.map;
      if (!active) {
        active = true;
        lastTime = performance.now();
        document.body.classList.add('in-city');
        $('cityStage').hidden = false;
        onActive(true);
        canvas.focus({preventScroll: true});
      }
      hud();
    },
    leaderboard(entries) {
      leaderboardRows = Array.isArray(entries) ? entries.slice(0, 10) : [];
      panelKey = '';
      if (mode === 'leaderboard') updatePanel();
    },
    stop() {
      if (!active) return;
      active = false;
      state = null;
      predicted = null;
      prediction.clear();
      fxAt.clear();
      lastDice = null;
      lastDiceId = '';
      lastSlots = null;
      lastSlotsId = '';
      escapedAt = 0;
      boonKey = '';
      lastRacePhase = '';
      feedKey = '';
      lastGun = '';
      leaderboardRows = [];
      shopTab = 'all';
      clear();
      document.body.classList.remove('in-city');
      toggleChat(false);
      $('cityStage').hidden = true;
      $('cityPanel').close();
      closeShop();
      audio.engine(false, 0);
      onActive(false);
    }
  };
}
