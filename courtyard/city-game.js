import {CITY,GUNS,GOODS,EVENTS,PLACES,dist} from './city-rules.js?v=0.17.3';
import {CityPrediction} from './city-motion.js?v=0.17.3';
import {createCityRenderer} from './city-render.js?v=0.17.3';

const SERVICE = new Set(['arms', 'market', 'bank', 'casino', 'garage', 'job']);
const GUN_IDS = new Set(Object.keys(GUNS));
const padNumber = n => String(n);

export function createCityGame({send, self, online, onActive, exit, avatars, speech}) {
  const $ = id => document.getElementById(id), canvas = $('cityWorld'), keys = new Set();
  let state = null, active = false, seq = 0, actionSeq = 0, aim = 0, fire = false, interact = false, stick = {x: 0, y: 0}, mode = '', panelKey = '', lastTime = 0, lastPacket = 0, lastMap = 0, lastHud = 0, mapPoints = [], message = '', predicted = null, snapshotAt = 0, obstacles = [], fireAt = 0, lastLocalShot = 0, quickKey = '', promptKey = '', shopTab = 'all', lastDice = null, lastDiceId = '';
  const pointer = {clientX: 0, clientY: 0, inside: false};
  const fxAt = new Map();
  const prediction = new CityPrediction();

  $('cityPads').hidden = !matchMedia('(pointer: coarse)').matches;
  const blocked = () => !online() || document.hidden || !!document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  const me = () => predicted || state?.self;

  function clear() {
    keys.clear();
    fire = false;
    interact = false;
    stick = {x: 0, y: 0};
    $('cityMoveKnob').style.transform = '';
  }
  function action(kind, fields = {}) {
    if (!state || !online()) return;
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

  const ITEM_COLORS = {medkit:'#e0675e',ammo:'#d9b45a',vest:'#5c8ed4',banana:'#efd45b',decoy:'#d58ad8',perfume:'#6fbf95',blink:'#6fd7e5',barricade:'#e59a5b',repair:'#b7c3c7',bribe:'#d6b07a',knife:'#c5d1d3',pistol:'#d0b79b',rifle:'#a9bdc2',car:'#72bda5',fists:'#d0b79b'};
  const SERVICE_KICKER = {arms:'ARMORY',market:'NIGHT MARKET',bank:'BANK',casino:'CASINO',garage:'GARAGE',job:'JOBS',escape:'EXIT'};
  const SERVICE_TAGLINE = {arms:'铁与火，明码标价。',market:'怪东西，也许正好用得上。',bank:'存款安全，金库不太安全。',casino:'骰子一响，黄金万两。',garage:'从二手车，到更旧的二手车。',job:'打工，或者送一单。',escape:'带得走，才算你的。'};

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
    } else if (id === 'pistol' || id === 'rifle') {
      const long = id === 'rifle';
      g.fillStyle = '#d0b79b'; g.fillRect(long ? -15 : -12, -5, long ? 28 : 20, 7);
      g.fillRect(long ? -5 : -4, 2, 6, 10);
      g.fillRect(long ? -15 : -12, -2, long ? 15 : 10, 4);
      g.fillStyle = '#5e6b72'; g.fillRect(-4, -8, long ? 8 : 5, 3);
      if (long) { g.fillStyle = '#8d9b9f'; g.fillRect(7, -8, 9, 2); }
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
    const color = {job:'#70dbb1',arms:'#f39485',market:'#c4a0ef',bank:'#f2d57d',casino:'#e97cf0',garage:'#84c8e8',escape:'#b5f493'}[kind] || '#b6c4c2';
    g.fillStyle = '#0b1721'; roundRect(g, 1, 1, 62, 62, 14); g.fill();
    g.strokeStyle = color; g.lineWidth = 2; roundRect(g, 1, 1, 62, 62, 14); g.stroke();
    g.save(); g.translate(32, 32); g.scale(1.55, 1.55); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
    if (kind === 'job') { g.strokeRect(-10, -8, 17, 14); g.beginPath(); g.moveTo(-10, -8); g.lineTo(-3, -1); g.lineTo(7, -8); g.stroke(); g.beginPath(); g.arc(9, 8, 6, 0, Math.PI * 2); g.stroke(); }
    else if (kind === 'arms') { g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-14, 0); g.lineTo(-5, 0); g.moveTo(5, 0); g.lineTo(14, 0); g.moveTo(0, -14); g.lineTo(0, -5); g.moveTo(0, 5); g.lineTo(0, 14); g.stroke(); }
    else if (kind === 'market') { g.strokeRect(-9, -5, 18, 15); g.beginPath(); g.arc(0, -5, 6, Math.PI, 0); g.stroke(); }
    else if (kind === 'bank') { g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke(); g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.fillText('$', 0, 5); }
    else if (kind === 'casino') { g.fillStyle = '#f6edcf'; g.fillRect(-11, -10, 18, 18); g.fillStyle = '#192531'; for (const [px, py] of [[-6,-5],[2,-5],[-6,3],[2,3],[0,0]]) { g.beginPath(); g.arc(px, py, 1.7, 0, Math.PI * 2); g.fill(); } g.fillStyle = color; g.beginPath(); g.arc(10, 10, 5, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'garage') { g.strokeRect(-13, -5, 22, 10); g.beginPath(); g.moveTo(-10, -5); g.lineTo(-6, -11); g.lineTo(5, -11); g.lineTo(9, -5); g.stroke(); g.beginPath(); g.arc(-7, 7, 3.5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(7, 7, 3.5, 0, Math.PI * 2); g.stroke(); }
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
    hero.dataset.kind = place.kind;
    hero.append(serviceIcon(place.kind));
    const copy = el('div', undefined, 'city-service-copy');
    copy.append(el('span', SERVICE_KICKER[place.kind] || 'SERVICE', 'city-service-kicker'));
    copy.append(el('h3', place.name));
    copy.append(el('p', SERVICE_TAGLINE[place.kind] || ''));
    const cash = el('div', undefined, 'city-service-cash');
    cash.append(el('strong', '¥' + p.cash), el('span', '存款 ¥' + p.bank));
    if (discount < 1) cash.append(el('em', 'SALE · 7 折', 'city-sale'));
    hero.append(copy, cash);
    return hero;
  }

  function categoryOf(id, kind) {
    if (kind === 'arms') return id === 'ammo' ? 'ammo' : 'weapon';
    if (kind === 'market') return ['medkit', 'vest', 'ammo'].includes(id) ? 'recover' : ['banana', 'decoy', 'perfume', 'blink'].includes(id) ? 'trick' : 'carry';
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
    wrap.append(bets);
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

  function panel(type) {
    clear();
    mode = type;
    panelKey = '';
    if (type === 'shop') shopTab = 'all';
    $('cityPanelTitle').textContent = {shop: '附近服务', bag: '背包与快捷道具', map: '城市地图', help: '入城手册', leave: '放弃本次行动？'}[type];
    updatePanel();
    if (!$('cityPanel').open) $('cityPanel').showModal();
  }

  function updatePanel() {
    if (!state || !mode) return;
    const p = state.self, place = PLACES.find(q => q.id === p.near);
    const dialog = $('cityPanel');
    dialog.dataset.kind = mode === 'shop' && place ? place.kind : mode;
    const key = JSON.stringify([mode, place?.id, shopTab, lastDiceId, p.cash, p.bank, p.inv, p.gun, p.ammo, p.reserve, p.hp, p.reload, p.car, p.message, state.offers, state.sent, state.event?.kind]);
    if (key === panelKey) return;
    panelKey = key;
    const body = $('cityPanelBody');
    body.replaceChildren();
    if (mode === 'shop' && place) $('cityPanelTitle').textContent = place.name;
    else $('cityPanelTitle').textContent = {bag: '背包与快捷道具', map: '城市地图', help: '入城手册', leave: '放弃本次行动？'}[mode] || '附近服务';
    if (p.message) body.append(el('p', p.message, 'city-panel-message'));

    if (mode === 'help') {
      const items = [
        '赚够 ¥' + CITY.goal + ' 随身现金，在绿色撤离点按住 E 8 秒离开；银行存款可在撤离前取出使用。',
        'WASD / 方向键移动，Shift 冲刺，鼠标瞄准，按住左键攻击，R 装填。',
        'E 拾取 / 抢车 / 交货 / 按住开金库或撤离；F 打开附近服务、下车；B 背包，M 地图，1–6 快捷使用道具。',
        '靠近商店、银行、赌场、车行或打工站时，按 F 或点右上角服务名直接打开面板，不必先打开背包。',
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
        entry.append(serviceIcon(place.kind, 'city-place-icon'), el('span', place.name));
        directory.append(entry);
      }
      body.append(directory, el('p', '金色圆点是你；地图上只标服务类型，完整名称见下方目录。'));
      renderer.map(map, state);
      return;
    }
    if (mode === 'bag') {
      body.append(card(GUNS[p.gun].name, `弹匣 ${p.ammo} / 备用 ${p.reserve}${p.reload > 0 ? ' · 装填中 ' + p.reload.toFixed(1) + 's' : ''}`, null, [button('装填', () => action('reload'), !GUNS[p.gun].mag || p.reload > 0)], itemIcon(p.gun)));
      const inv = Object.entries(p.inv).filter(([, n]) => n > 0);
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

    if (!place) {
      body.append(el('p', '靠近地图上的服务点。打开地图可以查看位置。'));
      return;
    }
    const discount = state.event?.kind === 'sale' ? .7 : 1;
    body.append(serviceHero(place, p, discount));

    if (place.kind === 'arms' || place.kind === 'market') {
      const items = (place.kind === 'arms'
        ? [...Object.entries(GUNS).filter(([id]) => id !== 'fists'), ['ammo', GOODS.ammo]]
        : Object.entries(GOODS)).filter(([id]) => shopTab === 'all' || categoryOf(id, place.kind) === shopTab);
      body.append(shopTabs(place.kind, shopTab, id => { shopTab = id; panelKey = ''; updatePanel(); }));
      const grid = el('div', undefined, 'city-shop-grid');
      for (const [id, item] of items) {
        const price = Math.ceil((item.price ?? GUNS[id]?.price ?? 0) * discount);
        const owned = id !== 'ammo' && (id === p.gun || (p.inv[id] || 0) > 0);
        const detail = item.description || (GUNS[id] ? `伤害 ${GUNS[id].damage} · ${GUNS[id].mag ? GUNS[id].mag + ' 发弹匣' : '近战'}` : '');
        const meta = el('div', undefined, 'city-card-meta');
        meta.append(el('span', '¥' + price, 'city-price'));
        if (owned) meta.append(el('span', '已拥有', 'city-owned'));
        grid.append(card(item.name, detail, meta, [
          button(owned ? '已拥有' : p.cash < price ? '现金不足' : '购买', () => action('buy', {item: id}), owned || p.cash < price || !!p.car)
        ], itemIcon(id)));
      }
      body.append(grid);
    } else if (place.kind === 'bank') {
      const account = el('div', undefined, 'city-bank-line');
      account.append(el('strong', '¥' + p.cash), el('span', '存款 ¥' + p.bank));
      body.append(card('个人账户', '存款不会因死亡丢失；撤离需要随身现金。', account, [
        button('存 100', () => action('deposit', {amount: 100}), p.cash < 100),
        button('存全部', () => action('deposit', {amount: 'all'}), !p.cash),
        button('取 100', () => action('withdraw', {amount: 100}), p.bank < 100),
        button('取全部', () => action('withdraw', {amount: 'all'}), !p.bank)
      ], serviceIcon('bank')));
      body.append(card('抢劫金库', '持武器，拉响警报后按住 E 12 秒；收益 1600，会触发通缉。', null, [
        button(p.gun === 'fists' ? '需要武器' : '拉响警报 · 按住 E', () => { action('robBank'); $('cityPanel').close(); }, p.gun === 'fists' || !!p.car)
      ], serviceIcon('bank', 'danger')));
    } else if (place.kind === 'job') {
      body.append(card('临时打工', '站在原地工作 10 秒，赚 260。', null, [button('开始打工', () => { action('work'); $('cityPanel').close(); }, !!p.job)], serviceIcon('job')));
      body.append(card('城市配送', p.job ? `配送中 → ${PLACES.find(q => q.id === p.job.to)?.name || p.job.to}` : '接单后开车或步行送达，按路程计酬。', null, [
        button(p.job ? '先完成当前配送' : '接单', () => { action('delivery'); $('cityPanel').close(); }, !!p.job)
      ], itemIcon('car')));
    } else if (place.kind === 'casino') {
      body.append(casinoStage(place, p));
    } else if (place.kind === 'garage') {
      const price = Math.ceil(900 * discount);
      body.append(card('二手小车', '买下后停在车行门口，走近按 E 上车。', el('span', '¥' + price, 'city-price'), [
        button(p.cash < price ? '现金不足' : '购买', () => action('buy', {item: 'car'}), p.cash < price || !!p.car)
      ], itemIcon('car')));
    } else if (place.kind === 'escape') {
      const need = Math.max(0, CITY.goal - p.cash);
      body.append(card('撤离点', need ? `还需要 ¥${need} 随身现金。` : '满足条件。关闭面板后按住 E 8 秒。', null, [button('知道了', () => $('cityPanel').close())], serviceIcon('escape')));
    }
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
        hints.push('F 下车');
        hints.push('Shift 冲刺');
      } else if (p.progress) {
        hints.push({work: '打工进行中 · 留在原地', bank: '开金库 · 按住 E', car: '抢车 · 按住 E', mug: '抢劫 · 按住 E', escape: '撤离 · 按住 E'}[p.progress.kind] || '任务进行中');
      } else {
        if (place && SERVICE.has(place.kind)) { hints.push('F 打开 ' + place.name); act = 'service'; }
        if (place?.kind === 'escape') hints.push(p.cash >= CITY.goal ? '按住 E 撤离 8 秒' : `撤离需要 ¥${CITY.goal} · 当前 ¥${p.cash}`);
        if (loot) hints.push(loot[1] === 'cash' ? 'E 拾取 ¥' + loot[4] : 'E 拾取 ' + (GUNS[loot[1]]?.name || GOODS[loot[1]]?.name || loot[1]));
        if (car) hints.push(car[5] === self() ? '按住 E 上车' : '按住 E 抢车');
        if (civilian && p.gun !== 'fists') hints.push('按住 E 抢劫路人');
        if (place?.kind === 'job' && !p.job) hints.push('E 开始打工');
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
    $('cityHp').textContent = 'HP ' + p.hp + (p.armor ? ' · 甲 ' + p.armor : '');
    $('cityWanted').textContent = p.wanted ? '★'.repeat(p.wanted) : '暂无通缉';
    $('cityWeapon').textContent = reloadLabel();
    $('cityPopulation').textContent = state.count + '/8';
    $('cityEvent').textContent = state.event ? EVENTS[state.event.kind].name + ' · ' + Math.ceil(state.event.ends - state.time) + 's' : '下一事件 ' + state.next + 's';
    $('cityEvent').dataset.active = String(!!state.event);
    const venue = PLACES.find(q => q.id === p.near);
    $('cityService').textContent = venue ? venue.name : '服务';
    $('cityService').disabled = !venue || p.hp <= 0 || !!p.car;
    $('cityReload').hidden = !GUNS[p.gun].mag || !!p.car;
    $('cityCarExit').hidden = !p.car;
    $('cityTask').textContent = p.progress ? `${ {work: '打工', bank: '开金库', car: '抢车', mug: '抢劫', escape: '撤离'}[p.progress.kind] } ${Math.max(0, p.progress.left).toFixed(1)}s` : p.job ? '配送 → ' + PLACES.find(q => q.id === p.job.to)?.name + ' · ¥' + p.job.pay : p.shield > 0 ? '保护 ' + Math.ceil(p.shield) + 's · 主动攻击会结束' : state.event ? EVENTS[state.event.kind].hint : '赚够 ¥' + CITY.goal + '，去绿色撤离点';
    const nextMessage = p.message || state.feed.at(-1)?.text || '';
    if (nextMessage !== message) {
      message = nextMessage;
      $('cityMessage').textContent = message;
    }
    $('cityRespawn').hidden = p.hp > 0 && !p.escaped;
    $('cityRespawnTitle').textContent = p.escaped ? '成功撤离' : '你倒下了';
    $('cityRespawnText').textContent = p.escaped ? `带走现金 ¥${p.result.cash} · 存款 ¥${p.result.bank} · 用时 ${p.result.seconds}s` : `${Math.ceil(p.respawn)}秒后重新投放；物品与70%随身现金掉落`;
    $('cityResultBack').hidden = !p.escaped;
    quickbar();
    updatePrompt();
    updatePanel();
  }

  function controls() {
    const stop = blocked() || state.self.hp <= 0 || state.self.escaped;
    const x = stop ? 0 : (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + stick.x;
    const y = stop ? 0 : (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + stick.y;
    const n = Math.max(1, Math.hypot(x, y));
    return {x: x / n, y: y / n, angle: aim, fire: !stop && fire, interact: !stop && (interact || keys.has('e')), sprint: !stop && keys.has('shift')};
  }
  function packet() { if (active && state && online()) send('city:input', {id: state.id, seq: ++seq, ...controls()}); }
  function predict(dt) { if (state) predicted = prediction.advance(dt, controls(), state.self, obstacles); }

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
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'shift'].includes(k)) {
      e.preventDefault();
      keys.add(k);
    }
    if (/^[1-6]$/.test(k) && !e.repeat) {
      e.preventDefault();
      useQuick(quickEntries()[Number(k) - 1]);
      return;
    }
    if (k === 'f' && !e.repeat) {
      if (state.self.car) { action('exitCar'); return; }
      if (serviceHere()) { panel('shop'); return; }
    }
    if (k === 'r' && !e.repeat) action('reload');
    if (k === 'b' && !e.repeat) panel('bag');
    if (k === 'm' && !e.repeat) panel('map');
    if (k === 'enter') {
      clear();
      toggleChat(true);
      $('chatBody').hidden = false;
      $('chatInput').focus();
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
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
  $('cityInteract').addEventListener('pointerdown', e => { e.preventDefault(); $('cityInteract').setPointerCapture(e.pointerId); interact = true; });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) $('cityInteract').addEventListener(t, () => { interact = false; });

  for (const [id, type] of [['cityBag', 'bag'], ['cityMapButton', 'map'], ['cityService', 'shop'], ['cityHelp', 'help']]) $(id).onclick = () => panel(type);
  $('cityLeave').onclick = () => state?.self.escaped ? exit() : panel('leave');
  $('cityResultBack').onclick = exit;
  $('cityReload').onclick = () => action('reload');
  $('cityCarExit').onclick = () => action('exitCar');
  $('cityPanelClose').onclick = () => $('cityPanel').close();
  $('cityPanel').addEventListener('close', () => { mode = ''; canvas.focus({preventScroll: true}); });
  $('cityChat').onclick = () => toggleChat();
  $('cityPromptAction').onclick = () => { if (serviceHere()) panel('shop'); };

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
      }
    }
    if (now - lastPacket >= 50) { packet(); lastPacket = now; }
    if (now - lastMap > 500) { renderer.map($('cityMiniMap'), renderState()); lastMap = now; }
    if (now - lastHud > 100) { hud(); lastHud = now; }
  }
  requestAnimationFrame(frame);

  return {
    get active() { return active; },
    receive(data) {
      if (data.id !== state?.id) {
        seq = 0;
        actionSeq = 0;
        mapPoints = [];
        prediction.clear();
        fxAt.clear();
      }
      seq = Math.max(seq, data.self.seq);
      actionSeq = Math.max(actionSeq, data.self.actionSeq);
      state = data;
      snapshotAt = performance.now();
      const diceEffect = [...data.effects].reverse().find(e => e.kind === 'dice');
      if (diceEffect && diceEffect.id !== lastDiceId) {
        lastDiceId = diceEffect.id;
        lastDice = {face: Number(diceEffect.text) || 1, win: String(data.self.message || '').includes('赢得'), at: snapshotAt};
      }
      obstacles = data.objects.map(q => ({kind: q[1], x: q[2], y: q[3], hp: q[4]}));
      const effected = new Set();
      for (const e of data.effects) {
        effected.add(e.id);
        if (!fxAt.has(e.id)) fxAt.set(e.id, snapshotAt);
      }
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
    stop() {
      if (!active) return;
      active = false;
      state = null;
      predicted = null;
      prediction.clear();
      fxAt.clear();
      lastDice = null;
      lastDiceId = '';
      shopTab = 'all';
      clear();
      document.body.classList.remove('in-city');
      toggleChat(false);
      $('cityStage').hidden = true;
      $('cityPanel').close();
      onActive(false);
    }
  };
}
