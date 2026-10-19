import {CITY,BLOCKS,PLACES,ZONES,DISTRICTS,ROADS,BOONS,CONTRACT_META,GUNS,GOODS,EVENTS,BARKS,wallRange} from './city-rules.js?v=0.27.2';
import {rigImage} from './avatar-render.js?v=0.16.0';
import {drawCar} from './lobby-render.js?v=0.16.0';
import {CityTimeline} from './city-motion.js?v=0.27.2';

const colors = {job: '#70dbb1', arms: '#f39485', market: '#c4a0ef', 'black-market': '#b57ae0', bank: '#f2d57d', casino: '#d7a1db', garage: '#84c8e8', escape: '#b5f493', fixer: '#f2c94c', safehouse: '#7fd6b0', clinic: '#f28f8f', goose: '#f2c94c', cyber: '#6fd7e5', containment: '#e0675e'};
const signs = {job: '工', arms: '武', market: '店', 'black-market': '黑', bank: '银', casino: '赌', garage: '车', escape: '离', fixer: '委', safehouse: '安', clinic: '医', goose: '鹅', cyber: '体', containment: '容'};
const ROAD = 100;
const LANDMARKS = new Set(['central-plaza', 'finance-plaza', 'old-park', 'finance-park', 'ent-plaza', 'harbor-water', 'harbor-pier-west', 'harbor-pier-south', 'harbor-pier-east','ent-goose-stadium']);
const SHOT_STYLES = {
  pistol: {core: '#fff4cf', glow: '#ffc46b', coreW: 1.4, glowW: 4, flash: 20, spike: 16, shake: 1.5, tracer: 95},
  revolver: {core: '#fff0bd', glow: '#ffab4f', coreW: 2, glowW: 5.5, flash: 28, spike: 22, shake: 2.4, tracer: 115},
  smg: {core: '#fff0c8', glow: '#ffb46b', coreW: 1.1, glowW: 3.2, flash: 14, spike: 12, shake: 1.1, tracer: 65},
  lmg: {core: '#fff4d8', glow: '#ffbb5f', coreW: 1.3, glowW: 4, flash: 18, spike: 15, shake: 1.6, tracer: 80},
  rifle: {core: '#fff7df', glow: '#ffd89a', coreW: 1.3, glowW: 3.6, flash: 19, spike: 16, shake: 1.9, tracer: 145},
  dmr: {core: '#fff8e8', glow: '#ffcf85', coreW: 1.6, glowW: 4.2, flash: 23, spike: 19, shake: 2.3, tracer: 175},
  shotgun: {core: '#fff2c8', glow: '#ffb35f', coreW: 1.3, glowW: 2.8, flash: 22, spike: 18, shake: 3.2, tracer: 70}
};

const CHAR_SCALE = .65;

export function createCityRenderer(canvas, {state, self, aim, avatars = () => new Map(), speech = () => null, pointer = () => null, firing = () => false, fireAt = () => 0}) {
  const ctx = canvas.getContext('2d'), poses = new Map(), timeline = new CityTimeline(), raceSmooth = new Map();
  let w = 960, h = 640, dpr = 1, last = 0, view = {x: 0, y: 0, z: 1}, snapshotKey = '', match = '', hitAt = 0, renderNow = 0, shake = 0, hurtAt = 0, flashAt = 0, flashColor = '#ffce8e', killAt = 0, cameraReady = false, hurtDir = 0, hurtDirAt = 0;

  new ResizeObserver(() => {
    const b = canvas.getBoundingClientRect();
    w = Math.max(1, b.width);
    h = Math.max(1, b.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }).observe(canvas);

  function label(text, x, y, color = '#f0ecda', size = 11) {
    size = Math.round(size * 1.18 * Math.min(1.3, Math.max(1, w / 1440)));
    ctx.font = `${size}px system-ui,"Microsoft YaHei"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#101d2dd9';
    const width = ctx.measureText(text).width;
    ctx.fillRect(x - width / 2 - 5, y - size, width + 10, size + 5);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function zoneAt(x, y) {
    return ZONES.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
  }

  function drawGround() {
    const x0 = view.x, y0 = view.y, x1 = view.x + w / view.z, y1 = view.y + h / view.z;
    ctx.fillStyle = '#0d161c';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#232e35';
    ctx.fillRect(0, 0, CITY.width, CITY.height);
    for (const z of ZONES) {
      const ax = Math.max(z.x, x0), ay = Math.max(z.y, y0), bx = Math.min(z.x + z.w, x1), by = Math.min(z.y + z.h, y1);
      if (ax >= bx || ay >= by) continue;
      ctx.fillStyle = z.tint;
      ctx.fillRect(ax, ay, bx - ax, by - ay);
      ctx.save();
      ctx.beginPath(); ctx.rect(ax, ay, bx - ax, by - ay); ctx.clip();
      if (z.id === 'oldtown') {
        ctx.strokeStyle = '#ffffff08'; ctx.lineWidth = 1;
        for (let y = Math.floor(ay / 44) * 44; y < by; y += 44) {
          for (let x = Math.floor(ax / 76) * 76; x < bx; x += 76) {
            const off = (Math.floor(y / 44) % 2) * 38;
            ctx.beginPath(); ctx.moveTo(x + off, y); ctx.lineTo(x + off + 29, y); ctx.stroke();
          }
        }
      } else if (z.id === 'finance') {
        ctx.strokeStyle = '#b8d2e60b'; ctx.lineWidth = 1;
        for (let x = Math.floor(ax / 120) * 120; x < bx; x += 120) { ctx.beginPath(); ctx.moveTo(x, ay); ctx.lineTo(x, by); ctx.stroke(); }
        for (let y = Math.floor(ay / 120) * 120; y < by; y += 120) { ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(bx, y); ctx.stroke(); }
      } else if (z.id === 'commercial') {
        ctx.strokeStyle = '#ffd79c09'; ctx.lineWidth = 1;
        for (let y = Math.floor(ay / 64) * 64; y < by; y += 64) { ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(bx, y); ctx.stroke(); }
        for (let x = Math.floor(ax / 64) * 64; x < bx; x += 64) { ctx.beginPath(); ctx.moveTo(x, ay); ctx.lineTo(x, by); ctx.stroke(); }
      } else if (z.id === 'entertainment') {
        for (let y = Math.floor(ay / 160) * 160; y < by; y += 160) {
          for (let x = Math.floor(ax / 160) * 160; x < bx; x += 160) {
            ctx.fillStyle = (x / 160 + y / 160) % 2 ? '#f07cff09' : '#4de3f209';
            ctx.beginPath(); ctx.arc(x + 80, y + 80, 54, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else {
        ctx.strokeStyle = '#d5e4e009'; ctx.lineWidth = 2;
        for (let x = Math.floor(ax / 180) * 180; x < bx; x += 180) { ctx.beginPath(); ctx.moveTo(x, ay); ctx.lineTo(x, by); ctx.stroke(); }
        for (let y = Math.floor(ay / 180) * 180; y < by; y += 180) { ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(bx, y); ctx.stroke(); }
      }
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 64px system-ui';
      ctx.fillStyle = z.edge;
      ctx.globalAlpha = .075;
      ctx.fillText(z.name, z.x + z.w / 2, z.y + z.h / 2 + 20);
      ctx.restore();
    }
    // 外圈人行道与围栏，任何镜头都不会看到地图外的虚空。
    ctx.fillStyle = '#3d474f';
    ctx.fillRect(0, 0, CITY.width, 46);
    ctx.fillRect(0, CITY.height - 46, CITY.width, 46);
    ctx.fillRect(0, 0, 46, CITY.height);
    ctx.fillRect(CITY.width - 46, 0, 46, CITY.height);
    ctx.fillStyle = '#141d23';
    ctx.fillRect(0, 0, CITY.width, 10);
    ctx.fillRect(0, CITY.height - 10, CITY.width, 10);
    ctx.fillRect(0, 0, 10, CITY.height);
    ctx.fillRect(CITY.width - 10, 0, 10, CITY.height);
    ctx.fillStyle = '#647880';
    for (let x = 20; x < CITY.width; x += 52) { ctx.fillRect(x, 2, 12, 18); ctx.fillRect(x, CITY.height - 20, 12, 18); }
    for (let y = 20; y < CITY.height; y += 52) { ctx.fillRect(2, y, 18, 12); ctx.fillRect(CITY.width - 20, y, 18, 12); }
  }

  function road(curb = '#3c4a53', fill = '#222d36') {
    ctx.fillStyle = curb;
    ctx.fillRect(view.x, view.y, w / view.z, h / view.z);
    ctx.fillStyle = fill;
  }

  function drawRoads() {
    // 每个区自己的街巷网格，路宽与街区尺寸来自 DISTRICTS。
    for (const d of DISTRICTS) {
      ctx.fillStyle = '#28333b';
      for (let y = d.y + d.ch; y < d.y + d.h; y += d.ch + d.road) ctx.fillRect(d.x, y, d.w, d.road);
      for (let x = d.x + d.cw; x < d.x + d.w; x += d.cw + d.road) ctx.fillRect(x, d.y, d.road, d.h);
      ctx.fillStyle = '#4a555c';
      for (let y = d.y + d.ch; y < d.y + d.h; y += d.ch + d.road) {
        ctx.fillRect(d.x, y, d.w, 3);
        ctx.fillRect(d.x, y + d.road - 3, d.w, 3);
      }
      for (let x = d.x + d.cw; x < d.x + d.w; x += d.cw + d.road) {
        ctx.fillRect(x, d.y, 3, d.h);
        ctx.fillRect(x + d.road - 3, d.y, 3, d.h);
      }
    }
    // 主干道
    for (const r of ROADS) {
      const fill = r.type === 'dock' ? '#353630' : '#1f2931';
      ctx.fillStyle = fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (r.type === 'avenue') {
        ctx.fillStyle = '#4f5b62';
        if (r.w > r.h) { ctx.fillRect(r.x, r.y, r.w, 3); ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3); }
        else { ctx.fillRect(r.x, r.y, 3, r.h); ctx.fillRect(r.x + r.w - 3, r.y, 3, r.h); }
        ctx.fillStyle = '#c7bd93';
        if (r.w > r.h) {
          for (let x = Math.floor(r.x / 90) * 90; x < r.x + r.w; x += 90) ctx.fillRect(x, r.y + r.h / 2 - 2, 38, 4);
        } else {
          for (let y = Math.floor(r.y / 90) * 90; y < r.y + r.h; y += 90) ctx.fillRect(r.x + r.w / 2 - 2, y, 4, 38);
        }
      } else if (r.type === 'dock') {
        ctx.fillStyle = '#c7bd9355';
        for (let x = r.x; x < r.x + r.w; x += 54) ctx.fillRect(x, r.y + 5, 24, 3);
      }
    }
    // 主要路口的人行横道
    for (const [x, y] of [[1160, 48], [1160, 990], [1160, 1990], [2890, 48], [2890, 990], [2890, 1990]]) {
      ctx.fillStyle = '#d6d3bd99';
      for (let i = 0; i < 6; i++) {
        if (y < 100) ctx.fillRect(x + 10 + i * 11, y - 2, 6, 46);
        else if (y === 990) ctx.fillRect(x + 10 + i * 11, y - 4, 6, 56);
        else ctx.fillRect(x + 10 + i * 11, y - 6, 6, 70);
      }
    }
  }

  function drawPark(b) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#6d8a63';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    ctx.fillStyle = '#b3a47c';
    ctx.fillRect(b.x + 18, b.y + b.h / 2 - 7, b.w - 36, 14);
    ctx.fillRect(b.x + b.w / 2 - 7, b.y + 18, 14, b.h - 36);
    if (b.w > 260 && b.h > 200) {
      ctx.fillStyle = '#3d7180';
      ctx.beginPath(); ctx.ellipse(b.x + b.w * .66, b.y + b.h * .32, b.w * .15, b.h * .12, -.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9cc8c066'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(b.x + b.w * .66, b.y + b.h * .32, b.w * .15, b.h * .12, -.3, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const tx = b.x + 28 + ((i * 71 + 19) % Math.max(28, b.w - 56));
      const ty = b.y + 28 + ((i * 47 + 13) % Math.max(28, b.h - 56));
      ctx.fillStyle = '#2b4332';
      ctx.beginPath(); ctx.arc(tx + 4, ty + 7, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i % 2 ? '#557d55' : '#648c5d';
      ctx.beginPath(); ctx.arc(tx, ty, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fa06f';
      ctx.beginPath(); ctx.arc(tx - 4, ty - 4, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#5b4936';
    for (let i = 0; i < 3; i++) {
      const bx = b.x + 26 + i * 46;
      if (bx + 30 > b.x + b.w - 20) break;
      ctx.fillRect(bx, b.y + b.h - 42, 30, 7);
      ctx.fillRect(bx + 3, b.y + b.h - 35, 4, 9);
      ctx.fillRect(bx + 23, b.y + b.h - 35, 4, 9);
    }
    if (b.label) label(b.label, b.x + b.w / 2, b.y + 16, '#d6e8c8', 10);
  }

  function drawPlaza(b) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.id.includes('-court-') || b.id.includes('-edge-') ? '#5d5b53' : '#6d6a62';
    ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
    if (!LANDMARKS.has(b.id)) {
      // 服务点周围的街角小广场：按位置轮换市集、露天咖啡、口袋公园、停车位和街角舞台。
      const zone = zoneAt(b.x, b.y)?.id;
      const v = Math.floor(b.x / 11 + b.y / 13) % 5;
      ctx.strokeStyle = '#e7dfc81f'; ctx.lineWidth = 1;
      for (let y = b.y + 24; y < b.y + b.h - 12; y += 34) { ctx.beginPath(); ctx.moveTo(b.x + 12, y); ctx.lineTo(b.x + b.w - 12, y); ctx.stroke(); }
      if (v === 0) {
        // 市集：三顶条纹棚和货箱
        for (let i = 0; i < 3; i++) {
          const sx = b.x + 24 + i * (b.w - 48) / 2.4;
          ctx.fillStyle = i % 2 ? '#b0544c' : '#c59a5c';
          ctx.fillRect(sx, b.y + 28, 48, 12);
          ctx.fillStyle = '#f0d6b0';
          for (let k = 0; k < 4; k++) ctx.fillRect(sx + k * 12, b.y + 28, 6, 12);
          ctx.fillStyle = '#5b4431'; ctx.fillRect(sx + 4, b.y + 42, 40, 10);
          ctx.fillStyle = '#8f9f7c'; ctx.fillRect(sx + 9, b.y + 40, 12, 4);
          ctx.fillStyle = '#b56a54'; ctx.fillRect(sx + 26, b.y + 40, 10, 4);
        }
      } else if (v === 1) {
        // 露天咖啡：遮阳伞和圆桌
        for (const [ox, oy, col] of [[.28, .38, '#c56a5c'], [.7, .62, '#5e8b7d']]) {
          const x = b.x + b.w * ox, y = b.y + b.h * oy;
          ctx.strokeStyle = '#d7cfb0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 24); ctx.stroke();
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 24, y - 20); ctx.quadraticCurveTo(x, y - 36, x + 24, y - 20); ctx.fill();
          ctx.fillStyle = '#6f6a5c'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d6cdb3'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        }
      } else if (v === 2) {
        // 口袋公园：草地、树和步道
        ctx.fillStyle = '#4f6a48'; ctx.fillRect(b.x + 14, b.y + 14, b.w - 28, b.h - 28);
        ctx.fillStyle = '#b1a27c'; ctx.fillRect(b.x + 22, b.y + b.h / 2 - 6, b.w - 44, 12);
        for (let i = 0; i < 3; i++) {
          const tx = b.x + 30 + (i * 61) % Math.max(30, b.w - 60), ty = b.y + 26 + (i * 39) % Math.max(30, b.h - 60);
          ctx.fillStyle = '#2b4332'; ctx.beginPath(); ctx.arc(tx + 3, ty + 5, 13, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#5f875d'; ctx.beginPath(); ctx.arc(tx, ty, 13, 0, Math.PI * 2); ctx.fill();
        }
      } else if (v === 3) {
        // 停车位：沥青、车位线和一辆停着的车
        ctx.fillStyle = '#3c444b'; ctx.fillRect(b.x + 12, b.y + 14, b.w - 24, b.h - 24);
        ctx.strokeStyle = '#d9d5ba55'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const x = b.x + 24 + i * (b.w - 48) / 4;
          ctx.beginPath(); ctx.moveTo(x, b.y + 24); ctx.lineTo(x, b.y + b.h - 22); ctx.stroke();
        }
        ctx.save(); ctx.translate(b.x + b.w * .38, b.y + b.h * .58); drawCar(ctx, { heading: 0, color: '#7a8fa0' }); ctx.restore();
        ctx.save(); ctx.translate(b.x + b.w * .68, b.y + b.h * .42); drawCar(ctx, { heading: Math.PI / 2, color: '#8a7f6e' }); ctx.restore();
      } else {
        // 街角舞台 / 喷泉小广场
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        ctx.fillStyle = '#5b5449'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7f8f8a'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4d7c84'; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#bfe0e2aa'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
        for (const side of [-1, 1]) {
          ctx.fillStyle = '#6a5138'; ctx.fillRect(cx + side * 34 - 13, cy + b.h * .3, 26, 6);
          ctx.fillRect(cx + side * 34 - 10, cy + b.h * .3 + 6, 3, 7);
        }
      }
      return;
    }
    ctx.strokeStyle = '#b9b29b33';
    ctx.lineWidth = 2;
    for (let x = b.x + 32; x < b.x + b.w - 24; x += 38) {
      ctx.beginPath(); ctx.moveTo(x, b.y + 20); ctx.lineTo(x, b.y + b.h - 20); ctx.stroke();
    }
    for (let y = b.y + 32; y < b.y + b.h - 24; y += 38) {
      ctx.beginPath(); ctx.moveTo(b.x + 20, y); ctx.lineTo(b.x + b.w - 20, y); ctx.stroke();
    }
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.strokeStyle = '#c9bf9f44';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(b.w, b.h) * .34, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(b.w, b.h) * .2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#a49c87';
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7cfae';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    if (b.id === 'central-plaza') {
      ctx.strokeStyle = '#f2c94c33';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        ctx.fillStyle = i % 3 ? '#c9bf9f' : '#f2c94c';
        ctx.fillRect(cx + Math.cos(a) * 190 - 2, cy + Math.sin(a) * 190 - 2, 5, 5);
      }
    } else if (b.id === 'ent-plaza') {
      ctx.globalAlpha = .5 + .3 * Math.sin(renderNow / 420);
      ctx.strokeStyle = '#f07cff';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawParking(b) {
    ctx.fillStyle = '#4c535c';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#d9d5ba66';
    ctx.lineWidth = 2;
    for (let x = b.x + 18; x < b.x + b.w - 20; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, b.y + 20); ctx.lineTo(x, b.y + b.h - 20); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(b.x + 14, b.y + b.h / 2); ctx.lineTo(b.x + b.w - 14, b.y + b.h / 2); ctx.stroke();
    ctx.fillStyle = '#d9d5ba';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('P', b.x + b.w / 2, b.y + 34);
  }

  function drawWater(b) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const x0 = Math.max(b.x, view.x), x1 = Math.min(b.x + b.w, view.x + w / view.z);
    const y0 = Math.max(b.y, view.y), y1 = Math.min(b.y + b.h, view.y + h / view.z);
    if (x0 >= x1 || y0 >= y1) return;
    ctx.strokeStyle = '#7fd0d92e';
    ctx.lineWidth = 2;
    for (let y = Math.floor(y0 / 54) * 54; y < y1; y += 54) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 22) {
        const yy = y + Math.sin(x * .018 + renderNow / 1400 + y * .02) * 4;
        if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#0b1a20';
    ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.fillStyle = '#9adfe455';
    for (let i = 0; i < 7; i++) {
      const x = b.x + ((i * 311 + renderNow * .012) % b.w);
      ctx.fillRect(x, b.y + 8, 46, 2);
    }
  }

  function drawPier(b) {
    ctx.fillStyle = '#5a5142';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#7b6f57';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.strokeStyle = '#433b31';
    ctx.lineWidth = 2;
    for (let x = b.x + 10; x < b.x + b.w; x += 22) {
      ctx.beginPath(); ctx.moveTo(x, b.y + 4); ctx.lineTo(x, b.y + b.h - 4); ctx.stroke();
    }
    ctx.fillStyle = '#3a342b';
    for (let x = b.x + 8; x < b.x + b.w; x += 88) { ctx.fillRect(x, b.y + 2, 8, 10); ctx.fillRect(x, b.y + b.h - 12, 8, 10); }
  }

  function drawStadium(b) {
    const race = state()?.gooseRace;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.fillStyle = '#4a3950';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#6b4a38';
    ctx.beginPath(); ctx.ellipse(cx, cy, b.w * .43, b.h * .39, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6248';
    ctx.beginPath(); ctx.ellipse(cx, cy, b.w * .4, b.h * .35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4d6b48';
    ctx.beginPath(); ctx.ellipse(cx, cy, b.w * .25, b.h * .19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8cfa866';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, b.w * .38 - i * 8, b.h * .33 - i * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 起跑线
    ctx.fillStyle = '#e8e1c6';
    for (let i = 0; i < 6; i++) ctx.fillRect(cx - 7 + (i % 2) * 7, cy - b.h * .33 - 2 - i * 6, 7, 5);
    // 大屏
    ctx.fillStyle = '#0d1820';
    ctx.fillRect(cx - 88, b.y + 14, 176, 26);
    ctx.strokeStyle = '#8a7a55'; ctx.lineWidth = 2; ctx.strokeRect(cx - 88, b.y + 14, 176, 26);
    ctx.fillStyle = race?.phase === 'result' ? '#a9f0c8' : race?.phase === 'racing' ? '#ffb08f' : '#f2d57d';
    ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(race ? (race.phase === 'betting' ? '下注 ' + race.startsIn + 's' : race.phase === 'racing' ? '冲线中' : race.winnerName + ' 获胜') : '赛鹅', cx, b.y + 32);
    // 赛道上的鹅
    if (race) {
      race.geese.forEach((g, i) => {
        const p = raceSmooth.get(g.id) ?? g.progress;
        const angle = -Math.PI / 2 + (race.phase === 'betting' ? (i - (race.geese.length - 1) / 2) * .035 : p * Math.PI * 2);
        const rx = b.w * .38 - i * 8, ry = b.h * .33 - i * 6;
        const x = cx + Math.cos(angle) * rx, y = cy + Math.sin(angle) * ry;
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.ellipse(0, 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eee8d6'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(4, -12, 4, 12);
        ctx.beginPath(); ctx.arc(6, -13, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eeb768'; ctx.fillRect(10, -14, 5, 3);
        ctx.fillStyle = g.color; ctx.fillRect(-6, -5, 11, 4);
        ctx.fillStyle = '#17232a'; ctx.beginPath(); ctx.arc(7, -14, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        label(g.name, x, y - 20, g.color, 8);
      });
      if (race.phase === 'result' && race.winner) {
        const winner = race.geese.find(g => g.id === race.winner);
        if (winner) {
          ctx.strokeStyle = winner.color + '99'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(cx, cy, b.w * .44, b.h * .4, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = b.x + 34 + i * (b.w - 68) / 3, y = b.y + 52;
      ctx.fillStyle = '#2b3038'; ctx.fillRect(x - 2, y, 4, 22);
      ctx.fillStyle = '#ffe5a1'; ctx.beginPath(); ctx.arc(x, y - 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe5a133'; ctx.beginPath(); ctx.arc(x, y - 2, 17, 0, Math.PI * 2); ctx.fill();
    }
    label(b.label || '赛鹅竞技场', b.x + b.w / 2, b.y + b.h - 10, '#f0c6ff', 12);
  }

  function drawSilo(b) {
    ctx.fillStyle = '#111a2066';
    ctx.beginPath(); ctx.ellipse(b.x + b.w / 2 + 8, b.y + b.h / 2 + 10, b.w * .46, b.h * .42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * .46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#474f47';
    ctx.lineWidth = 3;
    for (let r = .18; r < .45; r += .11) { ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#b8b595';
    ctx.fillRect(b.x + b.w / 2 - 2, b.y + 4, 4, b.h - 8);
    ctx.fillStyle = '#2c3430';
    ctx.fillRect(b.x + b.w * .68, b.y + b.h * .25, 14, 14);
  }

  function drawCrane(b) {
    ctx.fillStyle = '#4d5349';
    ctx.fillRect(b.x + b.w * .34, b.y + b.h * .25, b.w * .32, b.h * .75);
    ctx.strokeStyle = '#333a34';
    ctx.lineWidth = 3;
    for (let y = b.y + b.h * .3; y < b.y + b.h; y += 14) {
      ctx.beginPath(); ctx.moveTo(b.x + b.w * .36, y); ctx.lineTo(b.x + b.w * .64, y + 10); ctx.stroke();
    }
    ctx.fillStyle = '#d3a45e';
    ctx.fillRect(b.x - b.w * 2.2, b.y + b.h * .18, b.w * 3.1, 10);
    ctx.fillRect(b.x + b.w * .24, b.y + b.h * .08, b.w * .5, 14);
    ctx.strokeStyle = '#1c2326';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x - b.w * 1.8, b.y + b.h * .2); ctx.lineTo(b.x - b.w * 1.8, b.y + b.h * .9); ctx.stroke();
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(b.x - b.w * 1.8 - 8, b.y + b.h * .9, 16, 12);
    ctx.fillStyle = '#e0675e';
    ctx.beginPath(); ctx.arc(b.x + b.w * .5, b.y + b.h * .06, 4, 0, Math.PI * 2); ctx.fill();
  }

  function drawContainer(b) {
    ctx.fillStyle = '#00000055';
    ctx.fillRect(b.x + 6, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ffffff1f';
    ctx.lineWidth = 2;
    for (let x = b.x + 7; x < b.x + b.w - 4; x += 13) {
      ctx.beginPath(); ctx.moveTo(x, b.y + 3); ctx.lineTo(x, b.y + b.h - 3); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff30';
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 4);
    ctx.fillStyle = '#1d2429';
    ctx.fillRect(b.x + b.w - 10, b.y + 4, 4, b.h - 8);
  }

  function drawBuilding(b) {
    const style = b.style, floors = b.floors || 2;
    ctx.fillStyle = '#070d1288';
    ctx.fillRect(b.x + 12, b.y + 16, b.w, b.h);
    if (style === 'tower') {
      const tone = b.color;
      ctx.fillStyle = tone; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#253845'; ctx.fillRect(b.x, b.y, b.w, 12);
      const cols = Math.max(3, Math.floor(b.w / 32));
      const rows = Math.max(3, Math.min(floors + 3, Math.floor(b.h / 26)));
      for (let r = 0; r < rows; r++) {
        const wy = b.y + 18 + r * (b.h - 30) / rows;
        for (let c = 0; c < cols; c++) {
          const wx = b.x + 8 + c * (b.w - 16) / cols;
          const lit = ((Math.floor(b.x / 10) + r * 7 + c * 13) % 9) < 3;
          ctx.fillStyle = lit ? '#e5d6a5' : '#8fb4c4';
          ctx.globalAlpha = lit ? .8 : .5;
          ctx.fillRect(wx, wy, (b.w - 16) / cols - 5, Math.max(5, (b.h - 30) / rows - 7));
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#bcd2dc22'; ctx.lineWidth = 2;
      for (let c = 0; c <= cols; c++) { const x = b.x + 8 + c * (b.w - 16) / cols - 2; ctx.beginPath(); ctx.moveTo(x, b.y + 14); ctx.lineTo(x, b.y + b.h); ctx.stroke(); }
      ctx.fillStyle = '#d9cba5'; ctx.fillRect(b.x + b.w - 26, b.y - 18, 5, 20);
      ctx.fillStyle = '#e0675e'; ctx.beginPath(); ctx.arc(b.x + b.w - 23, b.y - 20, 3, 0, Math.PI * 2); ctx.fill();
    } else if (style === 'rowhouse') {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#4c3b2d'; ctx.fillRect(b.x - 4, b.y - 5, b.w + 8, 13);
      ctx.fillStyle = '#6b5340'; ctx.fillRect(b.x, b.y + 8, b.w, 3);
      const rows = Math.max(1, floors), cols = Math.max(2, Math.floor(b.w / 42));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wx = b.x + 10 + c * (b.w - 20) / cols, wy = b.y + 20 + r * (b.h - 48) / rows;
        ctx.fillStyle = (r + c) % 5 === 0 ? '#e4c98d' : '#2b3a40';
        ctx.fillRect(wx, wy, Math.min(16, (b.w - 20) / cols - 6), 13);
        ctx.fillStyle = '#ffffff12'; ctx.fillRect(wx, wy, Math.min(16, (b.w - 20) / cols - 6), 2);
      }
      ctx.fillStyle = '#3e2e22'; ctx.fillRect(b.x + b.w / 2 - 9, b.y + b.h - 24, 18, 24);
      ctx.fillStyle = '#caa76b'; ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h - 26, 20, 3);
      if (b.w > 90) { ctx.fillStyle = '#5b4534'; ctx.fillRect(b.x + 8, b.y - 13, 11, 10); }
      ctx.fillStyle = '#f2c97d33'; ctx.fillRect(b.x + 2, b.y + b.h - 4, b.w - 4, 3);
    } else if (style === 'shop') {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#2e3b40'; ctx.fillRect(b.x, b.y, b.w, 20);
      ctx.fillStyle = b.accent || '#f2cf8f';
      const sign = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
      sign.addColorStop(0, '#f2cf8f'); sign.addColorStop(1, '#f2cf8f55');
      ctx.fillStyle = sign; ctx.fillRect(b.x + 8, b.y + 5, b.w - 16, 10);
      ctx.fillStyle = '#4a3227';
      for (let x = b.x + 10; x < b.x + b.w - 10; x += 26) ctx.fillRect(x, b.y + 21, 14, 6);
      // 遮阳棚
      ctx.fillStyle = '#b85c4d';
      ctx.fillRect(b.x + 6, b.y + 30, b.w - 12, 9);
      ctx.fillStyle = '#f0d6b0';
      for (let x = b.x + 6; x < b.x + b.w - 12; x += 18) ctx.fillRect(x, b.y + 30, 9, 9);
      // 橱窗：分格玻璃、窗台与室内灯带
      ctx.fillStyle = '#1b2b33';
      ctx.fillRect(b.x + 8, b.y + 43, b.w - 16, b.h - 58);
      const glassH = b.h - 64;
      ctx.fillStyle = '#e9d39a'; ctx.globalAlpha = .55;
      ctx.fillRect(b.x + 14, b.y + 48, b.w * .36, glassH);
      ctx.fillRect(b.x + b.w * .56, b.y + 48, b.w * .3, glassH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#0e1a20'; ctx.lineWidth = 2;
      for (let x = b.x + 14; x < b.x + b.w - 14; x += 22) { ctx.beginPath(); ctx.moveTo(x, b.y + 45); ctx.lineTo(x, b.y + b.h - 16); ctx.stroke(); }
      ctx.fillStyle = '#f1d795';
      ctx.fillRect(b.x + 12, b.y + 46, b.w - 24, 3);
      ctx.fillStyle = '#2b3b3b';
      ctx.fillRect(b.x + 8, b.y + b.h - 16, b.w - 16, 4);
      ctx.fillStyle = '#5a3d2c'; ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h - 26, 20, 26);
      ctx.fillStyle = '#d6a85a'; ctx.fillRect(b.x + b.w / 2 - 11, b.y + b.h - 28, 22, 3);
    } else if (style === 'casino') {
      ctx.fillStyle = '#2a1834'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      const pulse = .55 + .35 * Math.sin(renderNow / 300 + b.x * .01);
      ctx.strokeStyle = `rgba(240,124,255,${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      ctx.strokeStyle = '#4de3f2aa'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      ctx.fillStyle = '#130d1b';
      ctx.fillRect(b.x + 16, b.y + b.h * .42, b.w - 32, b.h * .42);
      // 赌场地毯与机器
      ctx.strokeStyle = '#f07cff18'; ctx.lineWidth = 1;
      for (let x = b.x + 24; x < b.x + b.w - 20; x += 22) { ctx.beginPath(); ctx.moveTo(x, b.y + b.h * .44); ctx.lineTo(x + 10, b.y + b.h * .82); ctx.stroke(); }
      for (let i = 0; i < 5; i++) {
        const mx = b.x + 30 + i * (b.w - 60) / 4;
        ctx.fillStyle = '#2a2238'; ctx.fillRect(mx - 7, b.y + b.h - 36, 14, 19);
        ctx.fillStyle = ['#f07cff', '#ffd34d', '#4de3f2'][i % 3];
        ctx.fillRect(mx - 4, b.y + b.h - 33, 8, 5);
        ctx.fillStyle = '#ffffff22'; ctx.fillRect(mx - 6, b.y + b.h - 27, 12, 3);
      }
      const rcx = b.x + b.w / 2, rcy = b.y + b.h * .64, rr = Math.min(46, b.w * .16);
      ctx.save(); ctx.translate(rcx, rcy); ctx.rotate(renderNow / 5000);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 ? '#2b1820' : '#9c3546';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rr, i / 12 * Math.PI * 2, (i + 1) / 12 * Math.PI * 2); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#e0c27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e0c27a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#26543f'; ctx.beginPath(); ctx.ellipse(rcx - b.w * .27, rcy + 12, 24, 12, .2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rcx + b.w * .27, rcy + 4, 22, 11, -.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d6b77a66'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(rcx - b.w * .27, rcy + 12, 24, 12, .2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(rcx + b.w * .27, rcy + 4, 22, 11, -.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f6e3ff';
      ctx.font = `bold ${Math.min(22, Math.max(10, b.w / 10))}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('CASINO', b.x + b.w / 2, b.y + b.h * .3);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = ['#f07cff', '#ffd34d', '#4de3f2'][i % 3];
        ctx.globalAlpha = .55 + .35 * Math.sin(renderNow / 220 + i);
        ctx.beginPath(); ctx.arc(b.x + 18 + i * (b.w - 36) / 5, b.y + b.h - 12, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (style === 'hotel') {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#312333'; ctx.fillRect(b.x, b.y, b.w, 14);
      const cols = Math.max(2, Math.floor(b.w / 48));
      for (let r = 0; r < Math.min(6, floors); r++) for (let c = 0; c < cols; c++) {
        const wx = b.x + 10 + c * (b.w - 20) / cols, wy = b.y + 22 + r * (b.h - 40) / Math.min(6, floors);
        ctx.fillStyle = (r * 3 + c) % 4 === 0 ? '#f0cf96' : '#2f3a44';
        ctx.fillRect(wx, wy, 14, 9);
        ctx.fillStyle = '#00000033'; ctx.fillRect(wx - 2, wy + 9, 18, 3);
      }
      ctx.fillStyle = '#d6b06a'; ctx.fillRect(b.x + 6, b.y + 28, 16, 60);
      ctx.fillStyle = '#2a1d2c'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
      for (let i = 0; i < 5; i++) ctx.fillText('HOTEL'[i], b.x + 14, b.y + 40 + i * 10);
    } else if (style === 'warehouse') {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#39423a'; ctx.fillRect(b.x, b.y, b.w, 12);
      ctx.fillStyle = '#ffffff12';
      for (let x = b.x + 6; x < b.x + b.w - 6; x += 14) ctx.fillRect(x, b.y + 14, 3, b.h - 20);
      ctx.fillStyle = '#2b3130';
      ctx.fillRect(b.x + b.w * .32, b.y + b.h - 48, b.w * .36, 48);
      ctx.fillStyle = '#b6ad8e33';
      for (let i = 0; i < 4; i++) ctx.fillRect(b.x + b.w * .34, b.y + b.h - 43 + i * 10, b.w * .32, 2);
      ctx.fillStyle = '#d7cbaa'; ctx.fillRect(b.x + 10, b.y + b.h - 20, 26, 3); ctx.fillRect(b.x + 10, b.y + b.h - 13, 26, 3);
      ctx.fillStyle = '#9a5a4d'; ctx.fillRect(b.x + b.w - 26, b.y - 6, 18, 8);
    } else if (style === 'bankhq') {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#d8d4c4'; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 14);
      ctx.fillStyle = '#b9b29a';
      for (let x = b.x + 22; x < b.x + b.w - 14; x += (b.w - 36) / 6) ctx.fillRect(x, b.y + 24, 12, b.h - 36);
      ctx.fillStyle = '#5a4a34'; ctx.fillRect(b.x + b.w * .38, b.y + b.h - 74, b.w * .24, 74);
      ctx.fillStyle = '#e0c27a'; ctx.fillRect(b.x + b.w * .3, b.y + 8, b.w * .4, 4);
      ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#5d4b31';
      ctx.fillText('BANK', b.x + b.w / 2, b.y + 18);
    } else if (style === 'safehouse') {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#4c3828'; ctx.lineWidth = 1;
      for (let y = b.y + 10; y < b.y + b.h; y += 10) {
        for (let x = b.x + ((Math.floor(y / 10) % 2) * 14); x < b.x + b.w; x += 28) ctx.strokeRect(x, y, 26, 8);
      }
      ctx.fillStyle = '#333b36'; ctx.fillRect(b.x + b.w / 2 - 15, b.y + b.h - 36, 30, 36);
      ctx.fillStyle = '#c9c3a2'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h - 20, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6f8d6e'; ctx.beginPath(); ctx.arc(b.x + b.w - 24, b.y + 16, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6f8d6e33'; ctx.beginPath(); ctx.arc(b.x + b.w - 24, b.y + 16, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2c2620'; ctx.fillRect(b.x + 12, b.y + 22, 18, 18);
      ctx.strokeStyle = '#7c6a4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x + 12, b.y + 31); ctx.lineTo(b.x + 30, b.y + 31); ctx.stroke();
    } else if (style === 'clinic') {
      ctx.fillStyle = '#d8ddd2'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#e8ece3'; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = '#cb5b58'; ctx.fillRect(b.x + b.w / 2 - 6, b.y + 16, 12, 36); ctx.fillRect(b.x + b.w / 2 - 18, b.y + 28, 36, 12);
      ctx.fillStyle = '#8fb0ad'; ctx.fillRect(b.x + 12, b.y + b.h - 34, b.w - 24, 22);
      ctx.fillStyle = '#f4f8f2'; ctx.fillRect(b.x + b.w / 2 - 11, b.y + b.h - 30, 22, 18);
    } else if (style === 'office' || style === 'apartment') {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#2c3a44'; ctx.fillRect(b.x, b.y, b.w, 13);
      const cols = Math.max(2, Math.floor(b.w / 42));
      for (let r = 0; r < Math.min(8, floors); r++) for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r * 5 + c) % 6 === 0 ? '#d9c58c' : '#8fa6ab';
        ctx.fillRect(b.x + 8 + c * (b.w - 16) / cols, b.y + 20 + r * (b.h - 32) / Math.min(8, floors), 12, 8);
      }
      ctx.fillStyle = '#d9cba5'; ctx.fillRect(b.x + b.w - 26, b.y - 16, 5, 18);
    } else {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#36434b'; ctx.fillRect(b.x, b.y, b.w, 13);
      ctx.fillStyle = '#b9c7c5';
      for (let y = b.y + 26; y < b.y + b.h - 22; y += 22) for (let x = b.x + 10; x < b.x + b.w - 10; x += 30) ctx.fillRect(x, y, 16, 9);
      ctx.fillStyle = '#2e3b42'; ctx.fillRect(b.x + b.w * .42, b.y + b.h - 26, b.w * .16, 26);
    }
    const zone = zoneAt(b.x, b.y);
    if (zone?.id === 'entertainment') {
      const pulse = .5 + .5 * Math.sin(renderNow / 260 + b.x * .02);
      ctx.strokeStyle = `rgba(240,124,255,${.35 + pulse * .3})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x + 8, b.y + 2); ctx.lineTo(b.x + b.w - 8, b.y + 2); ctx.stroke();
    } else if (zone?.id === 'finance' && style !== 'bankhq') {
      ctx.strokeStyle = '#d8b86a33'; ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    }
    // 屋顶细节：水箱、空调、天窗、天线、屋顶招牌，打破方块感。
    const h = ((Math.floor(b.x) * 13 + Math.floor(b.y) * 7) >>> 0) % 10;
    if (style === 'tower') {
      ctx.fillStyle = '#1c2b3444';
      ctx.fillRect(b.x + 20, b.y + 20, b.w - 40, b.h - 40);
      ctx.strokeStyle = '#c7dbe233'; ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 20, b.y + 20, b.w - 40, b.h - 40);
      ctx.fillStyle = '#485b64'; ctx.fillRect(b.x + b.w * .2, b.y + b.h * .2, 22, 14);
      ctx.fillRect(b.x + b.w * .62, b.y + b.h * .55, 16, 11);
      ctx.fillStyle = '#9fb6bd'; ctx.fillRect(b.x + b.w * .22, b.y + b.h * .22, 18, 3);
      if (h % 3 === 0) { ctx.fillStyle = '#d9cba5'; ctx.fillRect(b.x + b.w * .5, b.y + 24, 4, 20); ctx.fillStyle = '#e0675e'; ctx.beginPath(); ctx.arc(b.x + b.w * .5 + 2, b.y + 22, 2.5, 0, Math.PI * 2); ctx.fill(); }
      if (h % 4 === 0) { ctx.fillStyle = '#2e4652'; ctx.fillRect(b.x + b.w * .72, b.y + 28, 34, 20); ctx.fillStyle = '#8fb4c4'; for (let i = 0; i < 3; i++) ctx.fillRect(b.x + b.w * .72 + 5 + i * 10, b.y + 33, 6, 10); }
    } else if (style === 'rowhouse') {
      if (h % 3 === 0) { ctx.fillStyle = '#4a3f33'; ctx.fillRect(b.x + b.w * .58, b.y + 12, 20, 20); ctx.fillStyle = '#7a6a52'; ctx.beginPath(); ctx.arc(b.x + b.w * .58 + 10, b.y + 12, 10, Math.PI, 0); ctx.fill(); }
      if (h % 4 === 1) { ctx.fillStyle = '#a8a28d'; ctx.fillRect(b.x + 12, b.y + b.h * .45, 16, 12); ctx.fillStyle = '#67645a'; for (let i = 0; i < 3; i++) ctx.fillRect(b.x + 14, b.y + b.h * .45 + 3 + i * 3, 12, 1); }
      if (h % 5 === 2) { ctx.fillStyle = '#6f8a6c'; ctx.fillRect(b.x + b.w * .3, b.y + 14, 18, 12); ctx.strokeStyle = '#3f573f'; ctx.lineWidth = 1; ctx.strokeRect(b.x + b.w * .3, b.y + 14, 18, 12); }
    } else if (style === 'shop') {
      if (h % 2 === 0) { ctx.fillStyle = '#c7bf9e'; ctx.fillRect(b.x + b.w * .18, b.y + 12, 26, 12); ctx.strokeStyle = '#6e644f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x + b.w * .18, b.y + 18); ctx.lineTo(b.x + b.w * .18 + 26, b.y + 18); ctx.stroke(); }
      ctx.fillStyle = '#3d4741'; ctx.fillRect(b.x + b.w * .7, b.y + b.h * .18, 14, 10);
      if (h % 3 === 0) { ctx.fillStyle = '#b2594e'; ctx.fillRect(b.x + b.w * .54, b.y + 6, 30, 5); ctx.fillStyle = '#f2d6a8'; ctx.font = 'bold 4px system-ui'; ctx.textAlign = 'center'; ctx.fillText('CAFE', b.x + b.w * .54 + 15, b.y + 10); }
    } else if (style === 'warehouse') {
      ctx.fillStyle = '#8d9a8a33';
      for (let i = 0; i < 3; i++) ctx.fillRect(b.x + 18 + i * (b.w - 50) / 2, b.y + 22, 22, 10);
      if (h % 3 === 0) { ctx.strokeStyle = '#c9b98f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x + 30, b.y + 20); ctx.lineTo(b.x + 30, b.y + b.h - 30); ctx.stroke(); }
    } else if (style === 'casino') {
      ctx.fillStyle = `rgba(240,124,255,${.5 + .3 * Math.sin(renderNow / 300)})`;
      ctx.fillRect(b.x + b.w * .2, b.y + 18, b.w * .6, 4);
    } else if (style === 'bankhq') {
      ctx.fillStyle = '#d9cfaa'; ctx.fillRect(b.x + b.w * .42, b.y + 28, b.w * .16, b.h * .5);
      ctx.fillStyle = '#6b5c42'; ctx.fillRect(b.x + b.w * .46, b.y + 34, b.w * .08, b.h * .4);
    }
    if (b.label) label(b.label, b.x + b.w / 2, b.y - 5, '#dce5db', 10);
  }

  function drawBlock(b) {
    if (b.solid !== false && b.style !== 'water' && b.style !== 'pier' && b.style !== 'stadium' && b.style !== 'crane') {
      const zone = zoneAt(b.x, b.y), walk = zone?.id === 'oldtown' ? '#4c4b40' : zone?.id === 'finance' ? '#46545e' : zone?.id === 'entertainment' ? '#3c3a44' : '#4b4d46';
      ctx.fillStyle = walk;
      ctx.fillRect(b.x - 7, b.y - 7, b.w + 14, b.h + 14);
      ctx.fillStyle = '#ffffff08';
      ctx.fillRect(b.x - 7, b.y - 7, b.w + 14, 2);
    }
    if (b.style === 'water') return drawWater(b);
    if (b.style === 'pier') return drawPier(b);
    if (b.style === 'stadium') return drawStadium(b);
    if (b.style === 'silo') return drawSilo(b);
    if (b.style === 'crane') return drawCrane(b);
    if (b.style === 'container') return drawContainer(b);
    if (b.solid === false) {
      if (b.style === 'parking') drawParking(b);
      else if (b.style === 'plaza') drawPlaza(b);
      else drawPark(b);
      return;
    }
    drawBuilding(b);
  }

  function inView(x, y, margin = 90) {
    return x > view.x - margin && y > view.y - margin && x < view.x + w / view.z + margin && y < view.y + h / view.z + margin;
  }

  function drawProps(me, now) {
    // 城市外圈：最后一层围栏盖在道路上，走到边缘也不会看到虚空。
    ctx.fillStyle = '#0b141a';
    ctx.fillRect(0, 0, CITY.width, 10);
    ctx.fillRect(0, CITY.height - 10, CITY.width, 10);
    ctx.fillRect(0, 0, 10, CITY.height);
    ctx.fillRect(CITY.width - 10, 0, 10, CITY.height);
    ctx.fillStyle = '#617a82';
    for (let x = 18; x < CITY.width; x += 52) { ctx.fillRect(x, 1, 10, 15); ctx.fillRect(x, CITY.height - 16, 10, 15); }
    for (let y = 18; y < CITY.height; y += 52) { ctx.fillRect(1, y, 15, 10); ctx.fillRect(CITY.width - 16, y, 15, 10); }

    // 中央广场环路：一圈真正的车道，把委托台围在广场中心。
    const ring = ROADS.find(r => r.type === 'ring');
    if (ring && inView(ring.x + ring.w / 2, ring.y + ring.h / 2, 500)) {
      const t = 64;
      ctx.fillStyle = '#1d2831';
      ctx.fillRect(ring.x, ring.y, ring.w, t);
      ctx.fillRect(ring.x, ring.y + ring.h - t, ring.w, t);
      ctx.fillRect(ring.x, ring.y + t, t, ring.h - t * 2);
      ctx.fillRect(ring.x + ring.w - t, ring.y + t, t, ring.h - t * 2);
      ctx.strokeStyle = '#4b575f'; ctx.lineWidth = 3;
      ctx.strokeRect(ring.x, ring.y, ring.w, ring.h);
      ctx.strokeStyle = '#c7bd9355'; ctx.lineWidth = 2; ctx.setLineDash([14, 16]);
      ctx.strokeRect(ring.x + t / 2, ring.y + t / 2, ring.w - t, ring.h - t);
      ctx.setLineDash([]);
      // 四角斑马线
      for (const [x, y, v] of [[ring.x + 76, ring.y, 0], [ring.x + ring.w - 110, ring.y, 0], [ring.x + 76, ring.y + ring.h - t, 0], [ring.x, ring.y + 110, 1], [ring.x + ring.w - t, ring.y + 110, 1]]) {
        ctx.fillStyle = '#d6d3bd88';
        for (let i = 0; i < 4; i++) {
          if (v) ctx.fillRect(x + 4, y + i * 14, t - 8, 7);
          else ctx.fillRect(x + i * 14, y + 4, 7, t - 8);
        }
      }
    }

    // 中央委托台：铜色镶边、告示板与两盏工作灯。
    const fixer = PLACES.find(p => p.kind === 'fixer');
    if (fixer && inView(fixer.x, fixer.y, 230)) {
      ctx.strokeStyle = '#f2c94c44'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(fixer.x, fixer.y, 92, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(fixer.x, fixer.y, 108, .3, 2.2); ctx.stroke();
      ctx.fillStyle = '#26333c'; ctx.fillRect(fixer.x - 52, fixer.y + 22, 104, 12);
      ctx.fillStyle = '#d7c690'; ctx.fillRect(fixer.x - 52, fixer.y + 20, 104, 3);
      ctx.fillStyle = '#1a252d'; ctx.fillRect(fixer.x - 36, fixer.y + 34, 72, 34);
      ctx.fillStyle = '#f2c94c'; ctx.fillRect(fixer.x - 28, fixer.y + 40, 24, 3); ctx.fillRect(fixer.x - 28, fixer.y + 47, 38, 2); ctx.fillRect(fixer.x - 28, fixer.y + 53, 31, 2);
      for (const side of [-1, 1]) {
        const lx = fixer.x + side * 122, ly = fixer.y + 24;
        ctx.fillStyle = '#2c3841'; ctx.fillRect(lx - 2, ly - 44, 4, 54);
        ctx.fillStyle = '#ffe2a1'; ctx.beginPath(); ctx.arc(lx, ly - 46, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe2a126'; ctx.beginPath(); ctx.arc(lx, ly - 46, 18, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + .2, r = 230;
        const bx = fixer.x + Math.cos(a) * r, by = fixer.y + Math.sin(a) * r;
        ctx.fillStyle = '#5b4a35'; ctx.fillRect(bx - 14, by - 3, 28, 7);
        ctx.fillRect(bx - 11, by + 4, 3, 7); ctx.fillRect(bx + 8, by + 4, 3, 7);
        ctx.fillStyle = '#5f8257'; ctx.beginPath(); ctx.arc(bx + 22, by - 12, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2b4332'; ctx.beginPath(); ctx.arc(bx + 24, by - 10, 6, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 金融街广场：镜面水池与玻璃碑。
    if (inView(2000, 440, 260)) {
      ctx.fillStyle = '#1a303d'; ctx.fillRect(1850, 360, 300, 150);
      ctx.fillStyle = '#2c5b68'; ctx.fillRect(1862, 372, 276, 126);
      ctx.fillStyle = '#8fd4d655';
      for (let i = 0; i < 5; i++) ctx.fillRect(1880 + i * 52, 390 + (i % 3) * 22, 34, 2);
      ctx.fillStyle = '#96c7d733'; ctx.beginPath(); ctx.arc(2000, 440, 52, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bfe0e2aa'; ctx.beginPath(); ctx.arc(2000, 440, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fa7ad'; ctx.beginPath(); ctx.moveTo(2000, 300); ctx.lineTo(2016, 430); ctx.lineTo(1984, 430); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d5eef0'; ctx.beginPath(); ctx.moveTo(2000, 300); ctx.lineTo(2008, 430); ctx.lineTo(2000, 430); ctx.closePath(); ctx.fill();
    }

    // 娱乐广场：霓虹拱门、舞台与霓虹骰子。
    if (inView(3640, 1420, 360)) {
      const pulse = .55 + .35 * Math.sin(now / 340);
      ctx.strokeStyle = `rgba(240,124,255,${pulse})`;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(3640, 1440, 128, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(77,227,242,${pulse * .8})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(3640, 1440, 116, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1b1324'; ctx.fillRect(3520, 1408, 240, 76);
      ctx.fillStyle = '#3a2250'; ctx.fillRect(3534, 1420, 212, 52);
      ctx.fillStyle = '#f07cff'; ctx.fillRect(3546, 1432, 62, 3); ctx.fillRect(3546, 1440, 44, 2);
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(3630, 1432, 72, 3); ctx.fillRect(3630, 1440, 54, 2);
      ctx.fillStyle = '#4de3f2'; ctx.fillRect(3722, 1432, 12, 12);
      ctx.save();
      ctx.translate(3640, 1330);
      ctx.rotate(now / 3000);
      ctx.fillStyle = '#f6edcf'; ctx.fillRect(-18, -18, 36, 36);
      ctx.fillStyle = '#192531'; for (const [x, y] of [[-9, -9], [9, -9], [0, 0], [-9, 9], [9, 9]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      const glow = ctx.createRadialGradient(3640, 1420, 40, 3640, 1420, 260);
      glow.addColorStop(0, 'rgba(168,74,214,.18)'); glow.addColorStop(1, 'rgba(168,74,214,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(3640, 1420, 260, 0, Math.PI * 2); ctx.fill();
    }

    // 市场和黑市：摊位 / 货箱。黑市有帆布棚和更暗的灯。
    for (const p of PLACES) {
      if (p.kind !== 'market' || !inView(p.x, p.y, 150)) continue;
      if (p.black) {
        ctx.fillStyle = '#2a2230'; ctx.fillRect(p.x - 58, p.y + 18, 116, 28);
        ctx.fillStyle = '#4a3a52'; ctx.fillRect(p.x - 52, p.y + 10, 104, 12);
        ctx.strokeStyle = '#8a6ba0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 58, p.y + 16); ctx.lineTo(p.x + 58, p.y + 16); ctx.stroke();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#5d4a3a'; ctx.fillRect(p.x - 52 + i * 38, p.y + 30, 26, 18); ctx.fillStyle = '#3b2e24'; ctx.fillRect(p.x - 52 + i * 38, p.y + 30, 26, 3); }
        ctx.fillStyle = '#a76bd0'; ctx.beginPath(); ctx.arc(p.x + 50, p.y + 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a76bd033'; ctx.beginPath(); ctx.arc(p.x + 50, p.y + 2, 22, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#3e3030'; ctx.fillRect(p.x - 42, p.y + 30, 84, 26);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? '#d46a5d' : '#f0d6b0';
          ctx.fillRect(p.x - 42 + i * 14, p.y + 20, 14, 12);
        }
        ctx.fillStyle = '#f4d57d'; ctx.fillRect(p.x - 34, p.y + 36, 14, 12);
        ctx.fillStyle = '#9d6fd1'; ctx.fillRect(p.x - 12, p.y + 36, 10, 12);
        ctx.fillStyle = '#6fbfa5'; ctx.fillRect(p.x + 6, p.y + 38, 12, 10);
      }
    }

    // 港湾：水面上的船、码头吊机和堆叠集装箱。
    if (inView(1650, 2700, 600)) {
      for (const [bx, by, bw, col] of [[1350, 2680, 150, '#7c4d43'], [2680, 2580, 120, '#4b6575'], [1900, 2880, 180, '#5b6a4e'], [3100, 2740, 100, '#8a6a4f'], [2350, 2720, 90, '#8a8d78']]) {
        ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.ellipse(bx, by + 12, bw * .52, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx - bw / 2, by); ctx.lineTo(bx + bw / 2, by); ctx.lineTo(bx + bw * .38, by + 22); ctx.lineTo(bx - bw * .38, by + 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d8d1b6'; ctx.fillRect(bx - 14, by - 26, 28, 20);
        ctx.fillStyle = '#8fc7cc'; ctx.fillRect(bx - 10, by - 22, 8, 6); ctx.fillRect(bx + 2, by - 22, 8, 6);
        ctx.strokeStyle = '#9a8e73'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by - 26); ctx.lineTo(bx, by - 44); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const bx = 1250 + i * 340, by = 2920 + (i % 2) * 60;
        ctx.fillStyle = i % 2 ? '#d7a05d' : '#d7d0ae';
        ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e8e1c422'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#3d3429';
      ctx.fillRect(1080, 2468, 1980, 8);
      ctx.fillStyle = '#c9b98f33';
      for (let x = 1090; x < 3060; x += 70) ctx.fillRect(x, 2470, 26, 2);
    }

    // 主干道路灯
    for (const r of ROADS) {
      if (r.type !== 'avenue') continue;
      if (r.w > r.h) {
        for (let x = Math.floor(Math.max(r.x, view.x - 40) / 210) * 210; x < Math.min(r.x + r.w, view.x + w / view.z + 40); x += 210) {
          if (x < r.x) continue;
          const y = r.y + r.h + 7;
          ctx.fillStyle = '#25333d'; ctx.fillRect(x, y, 5, 26);
          ctx.fillStyle = '#f4d28a'; ctx.beginPath(); ctx.arc(x + 2, y - 2, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f4d28a20'; ctx.beginPath(); ctx.arc(x + 2, y - 2, 17, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        for (let y = Math.floor(Math.max(r.y, view.y - 40) / 210) * 210; y < Math.min(r.y + r.h, view.y + h / view.z + 40); y += 210) {
          if (y < r.y) continue;
          const x = r.x + r.w + 7;
          ctx.fillStyle = '#25333d'; ctx.fillRect(x, y, 26, 5);
          ctx.fillStyle = '#f4d28a'; ctx.beginPath(); ctx.arc(x + 28, y + 2, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f4d28a20'; ctx.beginPath(); ctx.arc(x + 28, y + 2, 17, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // 旧城行道树与散落木箱
    for (let i = 0; i < 26; i++) {
      const x = 120 + ((i * 197) % 1030), y = 160 + ((i * 283) % 1720);
      if (!inView(x, y, 30)) continue;
      if (BLOCKS.some(b => b.solid !== false && x > b.x - 18 && x < b.x + b.w + 18 && y > b.y - 18 && y < b.y + b.h + 18)) continue;
      ctx.fillStyle = '#26382b'; ctx.beginPath(); ctx.arc(x + 3, y + 5, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5f8257'; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#77966a'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
      const x = 150 + ((i * 347) % 900), y = 500 + ((i * 191) % 2300);
      if (!inView(x, y, 20)) continue;
      if (!zoneAt(x, y)?.id || zoneAt(x, y).id !== 'oldtown') continue;
      if (BLOCKS.some(b => b.solid !== false && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)) continue;
      ctx.fillStyle = '#6b5238'; ctx.fillRect(x, y, 18, 14);
      ctx.strokeStyle = '#3f3023'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 18, 14); ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + 18, y + 7); ctx.stroke();
    }
    // 赛鹅场压在娱乐广场和霓虹舞台之上，保证赛道与赛鹅始终可见。
    for (const b of BLOCKS) if (b.style === 'stadium' && inView(b.x + b.w / 2, b.y + b.h / 2, 360)) drawStadium(b);
  }

  function drawAbnormality(p, now, type) {
    const pulse = Math.sin(now / 180);
    if (type === 'ab_nothing') {
      // 一无所有：惨白瘦长人形、拖地长臂、红眼和裂开的笑口。
      ctx.fillStyle = '#0e0d10'; ctx.fillRect(-7, -18, 5, 18); ctx.fillRect(2, -18, 5, 18);
      ctx.fillStyle = '#cdbfb5'; ctx.beginPath(); ctx.moveTo(-14, -50); ctx.lineTo(14, -50); ctx.lineTo(9, -17); ctx.lineTo(-9, -17); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b5a49a'; ctx.fillRect(-23, -48, 7, 40); ctx.fillRect(16, -48, 7, 40);
      ctx.fillStyle = '#2a1416'; for (let i = 0; i < 3; i++) { ctx.fillRect(-24 + i * 3, -9, 2, 8); ctx.fillRect(16 + i * 3, -9, 2, 8); }
      ctx.fillStyle = '#d8c9bd'; ctx.beginPath(); ctx.arc(0, -57, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a0b0e'; ctx.beginPath(); ctx.ellipse(0, -52, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2e8dc'; ctx.fillRect(-5, -54, 10, 1.6);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(-6, -60, 4, 4); ctx.fillRect(2, -60, 4, 4);
      ctx.strokeStyle = '#7a1f2a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-9, -45); ctx.lineTo(-3, -33); ctx.lineTo(-8, -27); ctx.moveTo(9, -42); ctx.lineTo(4, -31); ctx.stroke();
    } else if (type === 'ab_bigbird') {
      // 大鸟：巨大黑翼、独眼、喙下提灯。
      ctx.save(); ctx.scale(1.15, 1.15);
      ctx.fillStyle = '#0f1216';
      ctx.beginPath(); ctx.moveTo(-10, -60); ctx.lineTo(-42, -42); ctx.lineTo(-35, -12); ctx.lineTo(-12, -27); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -60); ctx.lineTo(42, -42); ctx.lineTo(35, -12); ctx.lineTo(12, -27); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1b2027'; ctx.beginPath(); ctx.ellipse(0, -38, 21, 27, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#252c34'; ctx.beginPath(); ctx.arc(0, -65, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, -65, 9 + pulse * .8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1206'; ctx.beginPath(); ctx.arc(0, -65, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0a24f'; ctx.beginPath(); ctx.moveTo(-4, -57); ctx.lineTo(0, -46); ctx.lineTo(6, -57); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(9, -53); ctx.lineTo(23, -30); ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(24, -26, 7 + pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(24, -26, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0e1114'; ctx.fillRect(-10, -15, 5, 15); ctx.fillRect(5, -15, 5, 15);
      ctx.restore();
    } else if (type === 'ab_mountain') {
      // 微笑的尸山：会随着成长变大的尸堆，很多眼睛与笑口。
      const sc = 1 + Math.min(.55, (p.hp || 0) / 2400);
      ctx.save(); ctx.scale(sc, sc);
      ctx.fillStyle = '#4e2529'; ctx.beginPath(); ctx.ellipse(0, -12, 34, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6d3136';
      for (const [ex, ey, er] of [[-24, -18, 12], [-8, -26, 14], [12, -22, 13], [24, -13, 11], [0, -10, 16]]) { ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f0e4c8';
      for (const [ex, ey] of [[-20, -20], [-4, -30], [12, -25], [22, -14], [2, -14], [-12, -8]]) { ctx.beginPath(); ctx.arc(ex, ey - 2, 3.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1a0d10';
      for (const [ex, ey] of [[-20, -20], [-4, -30], [12, -25], [22, -14], [2, -14], [-12, -8]]) { ctx.beginPath(); ctx.arc(ex, ey - 2, 1.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#f2e2c0'; ctx.lineWidth = 1.6;
      for (const [mx, my, mw] of [[-18, -13, 11], [-1, -20, 13], [15, -16, 9], [1, -4, 8]]) { ctx.beginPath(); ctx.arc(mx, my, mw / 2, .15, Math.PI - .15); ctx.stroke(); }
      ctx.strokeStyle = '#d8cfb8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-28, -4); ctx.lineTo(-20, -14); ctx.moveTo(27, -6); ctx.lineTo(20, -16); ctx.stroke();
      ctx.restore();
    } else if (type === 'ab_judgebird') {
      // 审判鸟：黑色法官长袍、金喙、悬挂的天平。
      ctx.fillStyle = '#191b22'; ctx.beginPath(); ctx.moveTo(0, -68); ctx.lineTo(25, -4); ctx.lineTo(-25, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d9c27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(0, -8); ctx.moveTo(-9, -34); ctx.lineTo(9, -34); ctx.stroke();
      ctx.fillStyle = '#24252c'; ctx.beginPath(); ctx.arc(0, -70, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.moveTo(-3, -66); ctx.lineTo(8, -62); ctx.lineTo(-3, -59); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(-4, -73, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(4, -73, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d9c27a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(0, -30); ctx.moveTo(-16, -30); ctx.lineTo(16, -30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16, -30); ctx.lineTo(-20, -22); ctx.moveTo(-16, -30); ctx.lineTo(-12, -22); ctx.moveTo(16, -30); ctx.lineTo(12, -22); ctx.moveTo(16, -30); ctx.lineTo(20, -22); ctx.stroke();
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(-16, -20, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(16, -20, 3.5, 0, Math.PI * 2); ctx.fill();
    } else {
      // 焦化少女：焦黑的身体、火焰头发和裙摆。
      ctx.fillStyle = '#2a1a18'; ctx.beginPath(); ctx.ellipse(0, -18, 13, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120b0a'; ctx.beginPath(); ctx.arc(0, -38, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a3d'; ctx.beginPath(); ctx.arc(-3, -39, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(3, -39, 1.8, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + now / 260, h = 10 + (i % 3) * 7 + pulse * 2;
        ctx.fillStyle = i % 2 ? '#f2a13f' : '#e25b3d';
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, -44 + Math.sin(a) * 2); ctx.lineTo(Math.cos(a) * 11, -44 - h); ctx.lineTo(Math.cos(a) * 13 + 4, -42); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + now / 300;
        ctx.fillStyle = i % 2 ? '#f2a13f' : '#e8995b';
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, -8); ctx.lineTo(Math.cos(a) * 18, 2 - (i % 2) * 5); ctx.lineTo(Math.cos(a) * 12 + 3, -2); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#ffb15a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-7, -28); ctx.lineTo(-2, -20); ctx.lineTo(-7, -13); ctx.moveTo(6, -30); ctx.lineTo(2, -22); ctx.stroke();
    }
    const names = { ab_nothing: '一无所有', ab_bigbird: '大鸟', ab_mountain: '微笑的尸山', ab_judgebird: '审判鸟', ab_scorched: '焦化少女' };
    const tops = { ab_nothing: -80, ab_bigbird: -100, ab_mountain: -72, ab_judgebird: -96, ab_scorched: -76 };
    const max = Math.max(1, p.maxHp || p.hp || 1), frac = Math.max(0, Math.min(1, (p.hp || 0) / max)), top = tops[type] || -76;
    ctx.fillStyle = '#101a20dd'; ctx.fillRect(-34, top, 68, 7); ctx.fillStyle = '#e0675e'; ctx.fillRect(-34, top, 68 * frac, 7);
    ctx.strokeStyle = '#ffd7c8aa'; ctx.lineWidth = 1; ctx.strokeRect(-34, top, 68, 7);
    label(names[type] || '异想体', 0, top - 11, '#ffd7c8', 11);
  }
  function drawMcMob(p, now, type) {
    if (type === 'creeper') {
      // 苦力怕：经典方脸、四只脚，靠近时脸部发白。
      const closer = Math.hypot(p.x - (state()?.self?.x || 0), p.y - (state()?.self?.y || 0)) < 180;
      ctx.fillStyle = '#4f8a42'; ctx.fillRect(-12, -34, 24, 30); ctx.fillRect(-9, -38, 18, 6);
      ctx.fillStyle = '#8fbf7a'; ctx.fillRect(-12, -34, 24, 3);
      ctx.fillStyle = '#2d4a2c'; ctx.fillRect(-12, -20, 24, 4); ctx.fillRect(-12, -10, 24, 3);
      if (closer) { ctx.fillStyle = `rgba(255,90,70,${.08 + .1 * Math.abs(Math.sin(now / 90))})`; ctx.fillRect(-12, -38, 24, 34); }
      ctx.fillStyle = '#d8dcc8'; ctx.fillRect(-8, -31, 6, 6); ctx.fillRect(2, -31, 6, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(-8, -29, 6, 3); ctx.fillRect(2, -29, 6, 3); ctx.fillRect(-4, -23, 8, 7); ctx.fillRect(-6, -19, 4, 4); ctx.fillRect(2, -19, 4, 4);
      ctx.fillStyle = '#3d6f36'; ctx.fillRect(-12, -4, 7, 5); ctx.fillRect(5, -4, 7, 5);
    } else if (type === 'enderman') {
      // 末影人：细长四肢、紫色眼睛、周身粒子。
      ctx.fillStyle = '#0d0f14'; ctx.fillRect(-8, -48, 16, 34); ctx.fillRect(-13, -42, 5, 34); ctx.fillRect(8, -42, 5, 34);
      ctx.fillStyle = '#080a0d'; ctx.fillRect(-9, -5, 7, 5); ctx.fillRect(2, -5, 7, 5);
      ctx.fillStyle = '#b57ae0'; ctx.fillRect(-5, -44, 4, 3); ctx.fillRect(1, -44, 4, 3);
      ctx.fillStyle = `rgba(181,122,224,${.35 + .25 * Math.sin(now / 170)})`;
      for (const [px, py] of [[-18, -34], [16, -20], [-15, -8], [19, -42], [-21, -46]]) ctx.fillRect(px, py, 2, 2);
    } else if (type === 'skeleton') {
      // 骷髅：头骨、肋骨、持弓。
      ctx.fillStyle = '#d9d5c2'; ctx.beginPath(); ctx.arc(0, -45, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-5, -47, 3, 4); ctx.fillRect(2, -47, 3, 4); ctx.fillRect(-2, -41, 4, 2);
      ctx.fillStyle = '#d9d5c2'; ctx.fillRect(-2, -36, 4, 20);
      for (let i = 0; i < 4; i++) { ctx.fillRect(-9, -34 + i * 5, 18, 2); }
      ctx.fillRect(-5, -16, 3, 12); ctx.fillRect(2, -16, 3, 12);
      ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(18, -26, 12, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = '#e6e0cc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(21, -38); ctx.lineTo(21, -14); ctx.stroke();
      ctx.strokeStyle = '#d9d5c2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -32); ctx.lineTo(20, -28); ctx.stroke();
    } else {
      // 史莱姆：半透明果冻块，内部有核心。
      const sc = type === 'slime_small' ? .7 : 1; ctx.save(); ctx.scale(sc, sc);
      const squash = 1 + Math.sin(now / 220 + p.x) * .06;
      ctx.fillStyle = 'rgba(111,191,123,.85)'; ctx.beginPath(); ctx.ellipse(0, -12 * squash, 16, 13 * squash, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(160,225,160,.5)'; ctx.beginPath(); ctx.ellipse(-4, -17, 8, 5, -.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7a4a'; ctx.fillRect(-7, -13, 4, 4); ctx.fillRect(3, -13, 4, 4); ctx.fillRect(-3, -7, 6, 3);
      ctx.restore();
    }
    const names = { creeper: '苦力怕', enderman: '末影人', skeleton: '骷髅', slime: '史莱姆', slime_small: '小史莱姆' };
    if (Math.hypot(p.x - (state()?.self?.x || 0), p.y - (state()?.self?.y || 0)) < 480) label(names[type] || type, 0, -58, '#dfe8d8', 10);
  }
  function drawZombie(p, old, now, zs) {
    // 行尸：绿色前伸手臂的人形；暴尸更宽更暗，疾行者更瘦并带速度线。
    const brute = p.variant === 'brute', runner = p.variant === 'runner', u = CHAR_SCALE * zs;
    const skin = brute ? '#547c4a' : runner ? '#8fb87d' : '#709765', dark = brute ? '#33502f' : '#42603a';
    ctx.fillStyle = brute ? 'rgba(74,107,74,.26)' : 'rgba(111,147,104,.22)';
    ctx.beginPath(); ctx.arc(0, -18 * u, (brute ? 30 : 23) * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark; ctx.fillRect(-7 * u, -16 * u, 5 * u, 16 * u); ctx.fillRect(2 * u, -16 * u, 5 * u, 16 * u);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-11 * u, -35 * u); ctx.lineTo(11 * u, -35 * u); ctx.lineTo(9 * u, -14 * u); ctx.lineTo(-9 * u, -14 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3c5b3c'; ctx.fillRect(-11 * u, -27 * u, 22 * u, 3 * u); ctx.fillRect(-11 * u, -20 * u, 22 * u, 2 * u);
    ctx.fillStyle = skin; ctx.fillRect(-3 * u, -24 * u, 6 * u, 6 * u);
    ctx.fillStyle = skin; ctx.fillRect(-23 * u, -30 * u, 13 * u, 5 * u); ctx.fillRect(10 * u, -30 * u, 13 * u, 5 * u);
    ctx.fillStyle = dark; ctx.fillRect(-24 * u, -31 * u, 3 * u, 7 * u); ctx.fillRect(21 * u, -31 * u, 3 * u, 7 * u);
    ctx.fillStyle = skin; ctx.fillRect(-8 * u, -48 * u, 16 * u, 13 * u);
    ctx.fillStyle = '#16220f'; ctx.fillRect(-6 * u, -45 * u, 5 * u, 4 * u); ctx.fillRect(1 * u, -45 * u, 5 * u, 4 * u);
    ctx.fillStyle = '#ff5b4a'; ctx.fillRect(-5 * u, -44 * u, 3 * u, 2 * u); ctx.fillRect(2 * u, -44 * u, 3 * u, 2 * u);
    ctx.fillStyle = '#1e2a16'; ctx.fillRect(-3 * u, -39 * u, 6 * u, 2 * u);
    if (brute) {
      ctx.fillStyle = '#2b402a'; ctx.fillRect(-14 * u, -38 * u, 5 * u, 5 * u); ctx.fillRect(9 * u, -38 * u, 5 * u, 5 * u);
      ctx.strokeStyle = '#2f4a34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -20 * u, 30 * u, 0, Math.PI * 2); ctx.stroke();
    }
    if (runner) {
      ctx.strokeStyle = 'rgba(160,220,140,.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-12 * u, -16 * u); ctx.lineTo(-26 * u, -10 * u); ctx.moveTo(-10 * u, -24 * u); ctx.lineTo(-22 * u, -20 * u); ctx.stroke();
    }
  }
  function person(p, now, type = 'player') {
    const old = poses.get(p.id) || {x: p.x, y: p.y, phase: 0}, moved = Math.hypot(p.x - old.x, p.y - old.y);
    old.phase += Math.min(moved, 30) * .045;
    old.x = p.x;
    old.y = p.y;
    poses.set(p.id, old);
    if (old.x < view.x - 70 || old.y < view.y - 80 || old.x > view.x + w / view.z + 70 || old.y > view.y + h / view.z + 80) return;
    const x = old.x, y = old.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#0006';
    ctx.beginPath(); ctx.ellipse(0, 1, 14 * CHAR_SCALE, 5 * CHAR_SCALE, 0, 0, Math.PI * 2); ctx.fill();
    if (type === 'gooseking') {
      ctx.save();
      ctx.scale(3.1, 3.1);
      ctx.fillStyle = '#f3efdf';
      ctx.beginPath(); ctx.ellipse(-1, 5, 11, 8, -.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(5, -14, 6, 17); ctx.beginPath(); ctx.arc(8, -14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0a24f'; ctx.beginPath(); ctx.moveTo(12, -15); ctx.lineTo(19, -12); ctx.lineTo(12, -11); ctx.fill();
      ctx.fillStyle = '#e0675e'; ctx.beginPath(); ctx.arc(9, -15, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.moveTo(4, -19); ctx.lineTo(6, -24); ctx.lineTo(8, -20); ctx.lineTo(10, -24); ctx.lineTo(12, -19); ctx.closePath(); ctx.fill();
      ctx.restore();
      const hp = Math.max(0, Math.min(1, (p.hp || 0) / 2400));
      ctx.fillStyle = '#101a20cc'; ctx.fillRect(-44, -82, 88, 8);
      ctx.fillStyle = '#f2c94c'; ctx.fillRect(-44, -82, 88 * hp, 8);
      ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = 1; ctx.strokeRect(-44, -82, 88, 8);
      ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('鹅王', 0, -88);
      ctx.strokeStyle = `rgba(240,100,80,${.18 + .1 * Math.sin(now / 160)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.stroke();
    } else if (type === 'goose' || type === 'golden') {
      const gold = type === 'golden';
      ctx.fillStyle = gold ? '#f2c94c' : '#eee8d6';
      ctx.fillRect(-10, -20, 19, 15);
      ctx.fillRect(5, -30, 7, 15);
      ctx.fillStyle = gold ? '#ffe08a' : '#eeb768';
      ctx.fillRect(12, -26, 9, 4);
      ctx.fillRect(-7, -5, 4, 7);
      ctx.fillRect(4, -5, 4, 7);
      if (gold) {
        ctx.fillStyle = '#fff2b0'; ctx.fillRect(5, -35, 7, 4); ctx.fillRect(3, -38, 3, 4); ctx.fillRect(10, -38, 3, 4);
        ctx.fillStyle = '#f2c94c55'; ctx.beginPath(); ctx.arc(6, -18, 24, 0, Math.PI * 2); ctx.fill();
      }
    } else if (type.startsWith('ab_') && !(type === 'ab_nothing' && !p.revealed)) {
      drawAbnormality(p, now, type);
    } else if (['creeper', 'enderman', 'skeleton', 'slime', 'slime_small'].includes(type)) {
      drawMcMob(p, now, type);
    } else {
      const angle = p.id === self() ? aim() : p.heading || 0;
      const face = Math.abs(Math.cos(angle)) > .65 ? Math.cos(angle) > 0 ? 'right' : 'left' : Math.sin(angle) > 0 ? 'down' : 'up';
      const zs = (type === 'zombie' ? (p.variant === 'brute' ? 1.18 : p.variant === 'runner' ? .92 : 1) : 1) * (p.distorted ? 1.45 : 1);
      ctx.globalAlpha = p.hp <= 0 ? .3 : p.connected === false ? .5 : 1;
      if (type === 'zombie') ctx.rotate(Math.sin(old.phase * .55) * .07);
      if (p.distorted) { ctx.save(); ctx.globalAlpha = .3 + .12 * Math.sin(now / 140); ctx.fillStyle = '#e0675e'; ctx.beginPath(); ctx.arc(0, -18 * CHAR_SCALE, 30 * zs, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      if (p.ego) { ctx.strokeStyle = '#f2d57d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -18 * CHAR_SCALE, 24 * zs, 0, Math.PI * 2); ctx.stroke(); }
      if (type === 'zombie') drawZombie(p, old, now, zs);
      else {
        ctx.drawImage(rigImage(avatars().get(p.userId), p.color || ({police: '#728fb4', civilian: '#ad946c', target: '#b45b52', convoy: '#8a6f4a', golden: '#f2c94c', 'ab_nothing': '#ad946c'}[type]), face, old.phase, moved > .12 ? 1 : 0), -18 * zs * CHAR_SCALE, -47 * zs * CHAR_SCALE, 36 * zs * CHAR_SCALE, 50 * zs * CHAR_SCALE);
        if (type === 'police') { ctx.fillStyle = '#1f3d6f'; ctx.fillRect(-7 * CHAR_SCALE, -44 * CHAR_SCALE, 14 * CHAR_SCALE, 5 * CHAR_SCALE); }
      }
      if (type === 'target') { ctx.fillStyle = '#c94f48'; ctx.fillRect(-8 * CHAR_SCALE, -44 * CHAR_SCALE, 16 * CHAR_SCALE, 5 * CHAR_SCALE); ctx.fillStyle = '#ffd36e'; ctx.fillRect(-1 * CHAR_SCALE, -52 * CHAR_SCALE, 2 * CHAR_SCALE, 4 * CHAR_SCALE); }
      const meNow = state()?.self;
      if (meNow && Math.hypot(p.x - meNow.x, p.y - meNow.y) < 520) {
        if (type === 'zombie') label(p.variant === 'brute' ? '暴尸' : p.variant === 'runner' ? '疾行者' : '行尸', 0, -64 * CHAR_SCALE, '#a9d99a', 10);
        if (type === 'convoy') label('押运员', 0, -61 * CHAR_SCALE, '#e0c08a', 10);
        if (type === 'police') label('警察', 0, -61 * CHAR_SCALE, '#9db8dd', 10);
      }
    }
    if (p.id === self()) {
      ctx.strokeStyle = '#f5d889';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 2 * CHAR_SCALE, 18 * CHAR_SCALE, 7 * CHAR_SCALE, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.shield) {
      ctx.strokeStyle = '#8ae0e6aa';
      ctx.beginPath(); ctx.ellipse(0, -20 * CHAR_SCALE, 22 * CHAR_SCALE, 32 * CHAR_SCALE, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (type === 'player' && p.bounty) {
      const pulse = .55 + .3 * Math.sin(now / 260);
      ctx.strokeStyle = `rgba(255,105,86,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 2 * CHAR_SCALE, 24 * CHAR_SCALE, 10 * CHAR_SCALE, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e0675e';
      ctx.beginPath(); ctx.moveTo(0, -72 * CHAR_SCALE); ctx.lineTo(7 * CHAR_SCALE, -60 * CHAR_SCALE); ctx.lineTo(-7 * CHAR_SCALE, -60 * CHAR_SCALE); ctx.closePath(); ctx.fill();
      label('悬赏 ¥' + p.bounty, 0, -82 * CHAR_SCALE, '#ff9b8a', 11);
    }
    const huntContract = state()?.self?.contract;
    if (type === 'player' && huntContract?.kind === 'player' && huntContract.target === p.id) {
      ctx.strokeStyle = '#ff7d6c';
      ctx.lineWidth = 2.5;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(sx * 26 * CHAR_SCALE, sy * 26 * CHAR_SCALE - 20 * CHAR_SCALE);
        ctx.lineTo(sx * 26 * CHAR_SCALE, sy * 13 * CHAR_SCALE - 20 * CHAR_SCALE);
        ctx.moveTo(sx * 26 * CHAR_SCALE, sy * 26 * CHAR_SCALE - 20 * CHAR_SCALE);
        ctx.lineTo(sx * 13 * CHAR_SCALE, sy * 26 * CHAR_SCALE - 20 * CHAR_SCALE);
        ctx.stroke();
      }
      label('猎杀目标', 0, -96 * CHAR_SCALE, '#ffb09a', 10);
    }
    if (p.hp < 100 || type === 'zombie') {
      ctx.fillStyle = '#17202a';
      ctx.fillRect(-17 * CHAR_SCALE, -55 * CHAR_SCALE, 34 * CHAR_SCALE, 4 * CHAR_SCALE);
      ctx.fillStyle = p.hp > 35 ? '#7ed6ad' : '#f08776';
      ctx.fillRect(-16 * CHAR_SCALE, -54 * CHAR_SCALE, 32 * CHAR_SCALE * Math.min(100, p.hp) / 100, 2 * CHAR_SCALE);
    }
    if (type === 'player') label((p.wanted ? '★'.repeat(p.wanted) + ' ' : '') + p.name, 0, -61 * CHAR_SCALE, p.id === self() ? '#f6dc91' : '#eee9db');
    if (type === 'target') label('悬赏目标', 0, -70 * CHAR_SCALE, '#ffb09a', 10);
    if (type === 'golden') label('黄金大鹅', 0, -72 * CHAR_SCALE, '#ffe08a', 10);
    if (p.id === self() && p.hp > 0 && !p.car) {
      const gun = state()?.self.gun;
      if (gun && gun !== 'fists') {
        ctx.rotate(aim());
        ctx.fillStyle = gun === 'knife' ? '#ece6cc' : gun === 'mimicry' ? '#c45b5b' : gun === 'lamp' ? '#e0c060' : gun === 'smile' ? '#e08a9a' : gun === 'justitia' ? '#f2d57d' : gun === 'fourthflame' ? '#e8995b' : gun === 'diamondsword' ? '#84c8e8' : '#c9b69b';
        const len = gun === 'rifle' ? 28 : gun === 'shotgun' ? 25 : gun === 'smg' ? 19 : gun === 'mimicry' ? 30 : gun === 'lamp' ? 26 : gun === 'smile' ? 24 : gun === 'justitia' ? 32 : gun === 'fourthflame' ? 22 : gun === 'diamondsword' ? 26 : 17;
        ctx.fillRect(6 * CHAR_SCALE, -19 * CHAR_SCALE, len * CHAR_SCALE, 5 * CHAR_SCALE);
        if (gun === 'shotgun') { ctx.fillStyle = '#6d4b35'; ctx.fillRect(11 * CHAR_SCALE, -14 * CHAR_SCALE, 10 * CHAR_SCALE, 3 * CHAR_SCALE); }
        if (gun === 'smg') { ctx.fillStyle = '#55646b'; ctx.fillRect(9 * CHAR_SCALE, -14 * CHAR_SCALE, 4 * CHAR_SCALE, 9 * CHAR_SCALE); }
      }
    }
    ctx.restore();
    const bubble = type === 'player' ? speech(p.id) : type === 'civilian' && ((Math.floor(now / 5000) + Number(p.id.slice(1))) % 7 === 0) ? {text: BARKS[p.bark], at: now - 500} : null;
    if (bubble && now - bubble.at < 4500) label(bubble.text.length > 28 ? bubble.text.slice(0, 28) + '…' : bubble.text, x, y - 86 * CHAR_SCALE, '#d8e8dc');
  }

  function drawPlaceIcon(c, kind, x, y, size, color) {
    c.save();
    c.translate(x, y);
    c.fillStyle = '#0b161ee6';
    c.beginPath(); c.arc(0, 0, size, 0, Math.PI * 2); c.fill();
    c.strokeStyle = color;
    c.lineWidth = Math.max(1.6, size * .075);
    c.beginPath(); c.arc(0, 0, size - 1, 0, Math.PI * 2); c.stroke();
    c.scale(size / 32, size / 32);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    if (kind === 'job') {
      c.strokeRect(-10, -8, 17, 14);
      c.beginPath(); c.moveTo(-10, -8); c.lineTo(-3, -1); c.lineTo(7, -8); c.stroke();
      c.beginPath(); c.arc(9, 8, 6, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(9, 4); c.lineTo(9, 8); c.lineTo(12, 10); c.stroke();
    } else if (kind === 'arms') {
      c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(-5, 0); c.moveTo(5, 0); c.lineTo(14, 0); c.moveTo(0, -14); c.lineTo(0, -5); c.moveTo(0, 5); c.lineTo(0, 14); c.stroke();
      c.fillRect(-2.5, -2.5, 5, 5);
    } else if (kind === 'market') {
      c.strokeRect(-9, -5, 18, 15);
      c.beginPath(); c.arc(0, -5, 6, Math.PI, 0); c.stroke();
      c.fillRect(-5, 3, 4, 4);
      c.fillRect(2, 3, 4, 4);
    } else if (kind === 'bank') {
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.stroke();
      c.font = 'bold 13px system-ui'; c.textAlign = 'center'; c.fillText('$', 0, 5);
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(-12, 0); c.moveTo(12, 0); c.lineTo(15, 0); c.stroke();
    } else if (kind === 'casino') {
      c.fillStyle = '#f6edcf';
      c.fillRect(-11, -10, 18, 18);
      c.fillStyle = '#192531';
      for (const [px, py] of [[-6, -5], [2, -5], [-6, 3], [2, 3], [0, 0]]) { c.beginPath(); c.arc(px, py, 1.7, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = color; c.beginPath(); c.arc(10, 10, 5, 0, Math.PI * 2); c.fill();
    } else if (kind === 'garage') {
      c.strokeRect(-13, -5, 22, 10);
      c.beginPath(); c.moveTo(-10, -5); c.lineTo(-6, -11); c.lineTo(5, -11); c.lineTo(9, -5); c.stroke();
      c.beginPath(); c.arc(-7, 7, 3.5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(7, 7, 3.5, 0, Math.PI * 2); c.stroke();
    } else if (kind === 'fixer') {
      c.strokeRect(-10, -10, 20, 20);
      c.beginPath(); c.moveTo(-4, -4); c.lineTo(5, -4); c.moveTo(-4, 0); c.lineTo(5, 0); c.moveTo(-4, 4); c.lineTo(2, 4); c.stroke();
      c.fillStyle = color; c.beginPath(); c.arc(9, 9, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#13202a'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText('¥', 9, 11.5);
    } else if (kind === 'safehouse') {
      c.beginPath(); c.moveTo(-13, 0); c.lineTo(0, -12); c.lineTo(13, 0); c.stroke();
      c.strokeRect(-9, 0, 18, 12);
      c.beginPath(); c.moveTo(-3, 4); c.lineTo(-3, 12); c.lineTo(4, 12); c.lineTo(4, 4); c.stroke();
      c.beginPath(); c.arc(0, -1, 4, 0, Math.PI * 2); c.stroke();
    } else if (kind === 'clinic') {
      c.strokeRect(-10, -10, 20, 20);
      c.fillRect(-2, -7, 4, 14); c.fillRect(-7, -2, 14, 4);
    } else if (kind === 'goose') {
      c.beginPath(); c.ellipse(-1, 5, 11, 8, -.2, 0, Math.PI * 2); c.fill();
      c.fillRect(5, -14, 6, 17); c.beginPath(); c.arc(8, -14, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e0a24f'; c.beginPath(); c.moveTo(12, -15); c.lineTo(18, -12); c.lineTo(12, -11); c.fill();
      c.fillStyle = '#1a2531'; c.beginPath(); c.arc(9, -15, 1.4, 0, Math.PI * 2); c.fill();
    } else if (kind === 'cyber') {
      c.beginPath(); c.arc(0, -9, 5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(0, -4); c.lineTo(0, 13); c.moveTo(-9, 2); c.lineTo(9, 2); c.moveTo(-7, 13); c.lineTo(0, 8); c.lineTo(7, 13); c.stroke();
      c.fillStyle = '#6fd7e5'; c.beginPath(); c.moveTo(-2, 5); c.lineTo(2, 5); c.lineTo(-1, 10); c.lineTo(4, 2); c.lineTo(0, 2); c.closePath(); c.fill();
    } else if (kind === 'containment') {
      c.strokeRect(-10, -11, 20, 22);
      c.beginPath(); c.arc(0, 4, 5, Math.PI, 0); c.stroke();
      c.beginPath(); c.moveTo(-4, -4); c.lineTo(4, -4); c.moveTo(0, -8); c.lineTo(0, -1); c.stroke();
      c.fillStyle = color; c.beginPath(); c.arc(0, 6, 2.2, 0, Math.PI * 2); c.fill();
    } else if (kind === 'black-market') {
      c.strokeRect(-9, -5, 18, 15);
      c.beginPath(); c.arc(0, -5, 6, Math.PI, 0); c.stroke();
      c.beginPath(); c.arc(0, 0, 5, .4, 2.7); c.stroke();
      c.fillRect(5, 6, 4, 4);
    } else if (kind === 'escape') {
      c.strokeRect(-9, -4, 16, 9);
      c.beginPath(); c.moveTo(7, -3); c.lineTo(13, -8); c.lineTo(13, -1); c.stroke();
      c.beginPath(); c.moveTo(-17, -8); c.lineTo(11, -8); c.moveTo(-3, -8); c.lineTo(-3, -5); c.stroke();
      c.beginPath(); c.moveTo(-6, 5); c.lineTo(-8, 11); c.moveTo(4, 5); c.lineTo(6, 11); c.stroke();
    }
    c.restore();
  }

  function drawAim(me, s) {
    const gun = GUNS[s.self.gun];
    if (!gun?.mag || s.self.car || s.self.hp <= 0 || s.self.escaped) return;
    const obstacles = s.objects.map(o => ({kind: o[1], x: o[2], y: o[3], hp: o[4]}));
    const angle = aim(), range = Math.min(wallRange(me, angle, gun.range, obstacles), 180);
    ctx.save();
    ctx.setLineDash([4, 10]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#f5dfa326';
    ctx.beginPath();
    ctx.moveTo(me.x + Math.cos(angle) * 18, me.y + Math.sin(angle) * 18 - 10);
    ctx.lineTo(me.x + Math.cos(angle) * range, me.y + Math.sin(angle) * range - 10);
    ctx.stroke();
    ctx.restore();
  }

  function drawEffects(me, now, s) {
    for (const e of s.effects) {
      const localAt = s.fxAt?.get(e.id);
      const age = (now - (localAt ?? (s.snapshotAt ?? now))) / 1000;
      if (e.kind === 'shot') {
        const style = SHOT_STYLES[e.gun] || SHOT_STYLES.pistol, life = .22;
        if (age > life) continue;
        const a = Math.max(0, 1 - age / life), sx = e.x, sy = e.y - 17, ca = Math.cos(e.angle), sa = Math.sin(e.angle);
        const spread = e.gun === 'shotgun' ? 6 : 1, far = Math.hypot(e.x - me.x, e.y - me.y);
        const travel = Math.min(1, age / .045), headD = e.range * travel;
        ctx.save();
        for (let i = 0; i < spread; i++) {
          const off = (i - (spread - 1) / 2) * (spread > 1 ? .05 : 0), ang = e.angle + off;
          const tail = Math.max(0, headD - style.tracer);
          const tx = e.x + Math.cos(ang) * tail, ty = e.y + Math.sin(ang) * tail - 17;
          const ex = e.x + Math.cos(ang) * headD, ey = e.y + Math.sin(ang) * headD - 17;
          ctx.globalAlpha = a * .16; ctx.strokeStyle = style.glow; ctx.lineWidth = style.glowW;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.globalAlpha = a * .92; ctx.strokeStyle = style.core; ctx.lineWidth = style.coreW;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ex, ey); ctx.stroke();
        }
        const hx = sx + ca * headD, hy = sy + sa * headD;
        ctx.globalAlpha = a; ctx.fillStyle = style.core;
        ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * .24; ctx.fillStyle = style.glow;
        ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, Math.PI * 2); ctx.fill();
        if (e.hit && age < .2) {
          const ia = Math.max(0, 1 - age / .2), ex = e.x + ca * e.range, ey = e.y + sa * e.range - 17;
          ctx.globalAlpha = ia; ctx.strokeStyle = style.glow; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(ex, ey, 4 + age * 70, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = style.core; ctx.lineWidth = 1.3;
          for (let k = 0; k < 5; k++) {
            const ang = e.angle + Math.PI + (k - 2) * .34, len = 8 + age * 70;
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(ang) * len, ey + Math.sin(ang) * len); ctx.stroke();
          }
          ctx.globalAlpha = ia * .9; ctx.fillStyle = style.core;
          ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        if (age < .1) {
          const fa = 1 - age / .1, size = style.flash * (1 + age * 3);
          const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, size);
          g.addColorStop(0, '#fffbe6'); g.addColorStop(.35, style.glow); g.addColorStop(1, 'rgba(255,150,60,0)');
          ctx.globalAlpha = fa; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = style.core; ctx.lineWidth = 2; ctx.globalAlpha = fa * .8;
          for (let k = 0; k < 5; k++) {
            const a2 = e.angle + (k - 2) * .13, reach = style.spike * (1 - age * 3);
            ctx.beginPath(); ctx.moveTo(sx + Math.cos(a2) * 5, sy + Math.sin(a2) * 5); ctx.lineTo(sx + Math.cos(a2) * reach, sy + Math.sin(a2) * reach); ctx.stroke();
          }
        }
        if (age < .22) {
          const smoke = 1 - age / .22;
          ctx.fillStyle = '#c9bda5';
          for (let k = 0; k < 3; k++) {
            const d = 8 + age * 55 + k * 4, off = (k - 1) * .1;
            ctx.globalAlpha = smoke * .16;
            ctx.beginPath(); ctx.arc(sx + Math.cos(e.angle + off) * d, sy + Math.sin(e.angle + off) * d, 3 + age * 14, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (far < 34 && age < .32) {
          const ca2 = age / .32, side = e.angle + Math.PI / 2;
          ctx.globalAlpha = (1 - ca2) * .9; ctx.fillStyle = '#e8c05a';
          ctx.translate(sx + Math.cos(side) * (6 + ca2 * 34), sy + Math.sin(side) * (6 + ca2 * 34) + ca2 * ca2 * 26);
          ctx.rotate(e.angle + ca2 * 12); ctx.fillRect(-2, -1, 4, 2);
        }
        ctx.restore();
        if (e.hit && far < 40) hitAt = now;
        if (far < 180) shake = Math.max(shake, style.shake);
        continue;
      }
      if (e.kind === 'swing') {
        if (age > .26) continue;
        const knife = e.gun === 'knife', fist = !knife;
        const reach = Math.min(72, Math.max(30, e.range || (knife ? 56 : 43)));
        const a = Math.max(0, 1 - age / .26), near = Math.hypot(e.x - me.x, e.y - me.y) < 34;
        const seed = [...String(e.id || 'x')].reduce((n, ch) => n + ch.charCodeAt(0), 0);
        const hook = (seed % 2 ? 1 : -1) * (fist ? .12 : .05), sweep = fist ? .92 : .78;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.globalAlpha = a * (fist ? .3 : .2);
        ctx.strokeStyle = e.hit ? (fist ? '#ffb36b' : '#ff8a72') : (fist ? '#ffd894' : '#ffe6b0');
        ctx.lineWidth = fist ? 14 : 8;
        ctx.beginPath(); ctx.arc(e.x, e.y - 12, reach, e.angle - sweep + hook, e.angle + sweep + hook); ctx.stroke();
        ctx.globalAlpha = a;
        ctx.strokeStyle = e.hit ? (fist ? '#ffe1a8' : '#ffc0a6') : '#fff4d4';
        ctx.lineWidth = fist ? 4 : 2.4;
        ctx.beginPath(); ctx.arc(e.x, e.y - 12, reach, e.angle - sweep * .82 + hook, e.angle + sweep * .82 + hook); ctx.stroke();
        ctx.strokeStyle = '#fffdf2'; ctx.lineWidth = fist ? 2 : 1.4;
        const lead = e.angle + sweep * .7 + hook;
        ctx.beginPath(); ctx.arc(e.x, e.y - 12, reach + (fist ? 9 : 7), lead - .28, lead + .28); ctx.stroke();
        if (fist) {
          ctx.globalAlpha = a * .55; ctx.strokeStyle = e.hit ? '#ffb36b' : '#ffe6b8'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y - 12, reach * .64, e.angle - .95 + hook, e.angle + .95 + hook); ctx.stroke();
        }
        const ex = e.x + Math.cos(e.angle) * reach, ey = e.y - 12 + Math.sin(e.angle) * reach;
        ctx.globalAlpha = a * (fist ? .9 : .72);
        ctx.strokeStyle = fist ? '#ffe9b8' : '#fff8e4'; ctx.lineWidth = fist ? 7 : 1.8;
        ctx.beginPath(); ctx.moveTo(e.x + Math.cos(e.angle) * 6, e.y - 12 + Math.sin(e.angle) * 6); ctx.lineTo(ex, ey); ctx.stroke();
        if (fist) {
          const g2 = ctx.createRadialGradient(ex, ey, 1, ex, ey, 18);
          g2.addColorStop(0, '#fffdf3'); g2.addColorStop(.4, 'rgba(255,200,120,.8)'); g2.addColorStop(1, 'rgba(255,150,60,0)');
          ctx.globalAlpha = a; ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(ex, ey, 18, 0, Math.PI * 2); ctx.fill();
        }
        if (e.hit) {
          const hx = e.x + Math.cos(e.angle) * reach * .8, hy = e.y - 12 + Math.sin(e.angle) * reach * .8;
          const ia = Math.max(0, 1 - age / .21);
          ctx.globalAlpha = ia;
          if (fist) {
            const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, 28);
            g.addColorStop(0, '#fffdf3'); g.addColorStop(.32, '#ffd18a'); g.addColorStop(1, 'rgba(255,140,70,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 28, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffe3a8'; ctx.lineWidth = 2.6;
            ctx.beginPath(); ctx.arc(hx, hy, 8 + age * 95, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#ffecc4';
            for (let i = 0; i < 8; i++) {
              const ang = e.angle + (i - 3.5) * .3, r = 8 + age * 115;
              ctx.beginPath(); ctx.arc(hx + Math.cos(ang) * r, hy + Math.sin(ang) * r, Math.max(.4, 2.6 - age * 6), 0, Math.PI * 2); ctx.fill();
            }
          } else {
            ctx.strokeStyle = '#ffd0a8'; ctx.lineWidth = 2;
            for (const off of [-.18, .18]) {
              ctx.beginPath(); ctx.moveTo(hx - Math.cos(e.angle + off) * 14, hy - Math.sin(e.angle + off) * 14);
              ctx.lineTo(hx + Math.cos(e.angle + off) * 24, hy + Math.sin(e.angle + off) * 24); ctx.stroke();
            }
            ctx.fillStyle = '#fff0c8';
            for (let i = 0; i < 5; i++) {
              const ang = e.angle + (i - 2) * .28, r = 7 + age * 85;
              ctx.beginPath(); ctx.arc(hx + Math.cos(ang) * r, hy + Math.sin(ang) * r, 1.9, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
        ctx.restore();
        if (near) { shake = Math.max(shake, fist ? 3.4 : 1.7); if (e.hit) hitAt = now; }
        continue;
      }
      if (e.kind === 'flash') {
        const far = Math.hypot(e.x - me.x, e.y - me.y);
        if (far < 520) { flashAt = now; flashColor = '#ffffff'; shake = Math.max(shake, 5); }
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / .45);
        ctx.strokeStyle = '#fff8d4'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, 20 + age * 220, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        continue;
      }
      if (e.kind === 'hit') {
        if (age > .5) continue;
        const near = Math.hypot(e.x - me.x, e.y - me.y) < 36;
        if (near) {
          hurtAt = now; shake = Math.max(shake, 4);
          const attacker = (s.players || []).find(q => q.id === e.by) || (s.npcs || []).find(q => q[0] === e.by);
          if (attacker) { hurtDir = Math.atan2((attacker.y ?? attacker[3]) - me.y, (attacker.x ?? attacker[2]) - me.x); hurtDirAt = now; }
        }
        const seed = [...String(e.id || 'x')].reduce((n, ch) => n + ch.charCodeAt(0), 0);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / .5);
        for (let i = 0; i < 7; i++) {
          const a2 = seed * .17 + i * .9 + age * 2.6, r = 6 + age * 48 + (i % 3) * 5;
          ctx.fillStyle = near ? '#ff8f7a' : '#ffd08a';
          ctx.beginPath(); ctx.arc(e.x + Math.cos(a2) * r, e.y + Math.sin(a2) * r * .7, 2.2 + (i % 3) * .9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#ffe0b0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 7 + age * 34, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        if (e.damage) label('-' + e.damage, e.x, e.y - 24 - age * 34, near ? '#ff9b8a' : '#ffd08a', 13);
        continue;
      }
      if (e.kind === 'explosion') {
        if (age > .55) continue;
        const far = Math.hypot(e.x - me.x, e.y - me.y);
        shake = Math.max(shake, Math.max(0, 13 - far / 55));
        flashAt = now; flashColor = '#ffb36b';
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / .55);
        ctx.fillStyle = '#ff9a5b55';
        ctx.beginPath(); ctx.arc(e.x, e.y, 20 + age * 150, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffb47a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 20 + age * 150, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a2 = i * .9 + age * 1.8, r = 18 + age * 120;
          ctx.fillStyle = i % 2 ? '#ffb45f' : '#e25b3d';
          ctx.beginPath(); ctx.arc(e.x + Math.cos(a2) * r, e.y + Math.sin(a2) * r * .65, 3.5 - age * 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        continue;
      }
      if (e.kind === 'blood') {
        if (age > .5) continue;
        const seed = [...String(e.id || 'x')].reduce((n, ch) => n + ch.charCodeAt(0), 0);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / .5);
        for (let i = 0; i < 9; i++) {
          const a2 = seed * .13 + i * 1.7, r = 4 + (i % 3) * 5 + age * 26;
          ctx.fillStyle = i % 3 === 0 ? '#5e7d62' : '#7a2e2a';
          ctx.beginPath(); ctx.arc(e.x + Math.cos(a2) * r, e.y + Math.sin(a2) * r * .7, Math.max(.6, 2.8 - age * 3), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        continue;
      }
      if (age > .35) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / .35);
      ctx.strokeStyle = e.kind === 'checkpoint' ? '#7fe0a6' : e.kind === 'bounty' ? '#ff7d6c' : '#f4d9a2';
      ctx.lineWidth = e.kind === 'bounty' ? 4 : 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 10 + age * 50, 0, Math.PI * 2); ctx.stroke();
      if (e.kind === 'dice' && e.text) label('骰子 ' + e.text, e.x, e.y - 28, '#ffe2a6');
      if (e.kind === 'bounty') label('悬赏', e.x, e.y - 34, '#ff9b8a');
      ctx.restore();
    }
  }

  function crosshair(me, s, now) {
    const ptr = pointer();
    if (!ptr?.inside || !s || s.self.car || s.self.hp <= 0 || s.self.escaped) return;
    const rect = canvas.getBoundingClientRect();
    const x = ptr.clientX - rect.left, y = ptr.clientY - rect.top;
    const gun = GUNS[s.self.gun];
    const bloom = firing() ? (gun?.pellets ? 18 : gun?.name === '冲锋枪' ? 14 : gun?.name === '轻机枪' ? 12 : 9) : 4;
    const low = gun?.mag && s.self.ammo <= Math.ceil(gun.mag * .25), empty = gun?.mag && s.self.ammo <= 0;
    const ink = empty ? 'rgba(255,124,104,.95)' : low ? 'rgba(255,205,120,.95)' : 'rgba(246,233,194,.95)';
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    for (const [stroke, width] of [['rgba(10,18,24,.75)', 4], [ink, 1.5]]) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x - bloom - 8, y); ctx.lineTo(x - bloom, y);
      ctx.moveTo(x + bloom, y); ctx.lineTo(x + bloom + 8, y);
      ctx.moveTo(x, y - bloom - 8); ctx.lineTo(x, y - bloom);
      ctx.moveTo(x, y + bloom); ctx.lineTo(x, y + bloom + 8);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, gun?.mag ? 2.2 : 4, 0, Math.PI * 2); ctx.stroke();
    }
    if (now - hitAt < 130) {
      ctx.strokeStyle = `rgba(255,216,150,${1 - (now - hitAt) / 130})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 9); ctx.lineTo(x - 4, y - 4);
      ctx.moveTo(x + 9, y - 9); ctx.lineTo(x + 4, y - 4);
      ctx.moveTo(x - 9, y + 9); ctx.lineTo(x - 4, y + 4);
      ctx.moveTo(x + 9, y + 9); ctx.lineTo(x + 4, y + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render(now) {
    requestAnimationFrame(render);
    const s = state();
    if (!s || canvas.hidden) return;
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    renderNow = now;
    const key = s.snapshotAt ?? s.time;
    if (match !== s.id) { match = s.id; timeline.clear(); poses.clear(); raceSmooth.clear(); snapshotKey = ''; hitAt = 0; cameraReady = false; }
    if (key !== snapshotKey) {
      snapshotKey = key;
      const at = s.snapshotAt ?? now, ids = new Set();
      for (const p of s.players) { ids.add('p:' + p.id); timeline.update('p:' + p.id, p, at, (p.hp > 0) + ':' + p.car + ':' + p.escaped); }
      for (const n of s.npcs) { ids.add('n:' + n[0]); timeline.update('n:' + n[0], {x: n[2], y: n[3], heading: n[5]}, at, n[1]); }
      for (const c of s.cars) { ids.add('c:' + c[0]); timeline.update('c:' + c[0], {x: c[1], y: c[2], heading: c[3]}, at, c[6]); }
      timeline.prune(ids);
    }
    if (s.gooseRace) for (const g of s.gooseRace.geese) {
      const current = raceSmooth.get(g.id);
      raceSmooth.set(g.id, current === undefined ? g.progress : current + (g.progress - current) * Math.min(1, dt * 8));
    }
    const me = s.self, z = w < 600 ? 1.15 : 1.25, margin = 160;
    if (me.hp <= 0) cameraReady = false;
    let focus = me;
    if (me.hp <= 0 && me.death) {
      const killer = (s.players || []).find(q => q.id === me.death.byId) || (s.npcs || []).find(q => q[0] === me.death.byId);
      focus = killer ? {x: killer.x ?? killer[2], y: killer.y ?? killer[3]} : {x: me.death.x, y: me.death.y};
    }
    const viewW = w / z, viewH = h / z;
    const look = me.hp > 0 ? (me.car ? 95 : 52) : 0, lookAngle = me.car ? (me.heading || 0) : aim();
    const targetX = Math.max(-margin, Math.min(Math.max(-margin, CITY.width - viewW + margin), focus.x + Math.cos(lookAngle) * look - viewW / 2));
    const targetY = Math.max(-margin, Math.min(Math.max(-margin, CITY.height - viewH + margin), focus.y + Math.sin(lookAngle) * look - viewH / 2));
    if (!cameraReady) { view = {z, x: targetX, y: targetY}; cameraReady = true; }
    else { const follow = 1 - Math.exp(-dt * 8.5); view = {z, x: view.x + (targetX - view.x) * follow, y: view.y + (targetY - view.y) * follow}; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.scale(z, z);
    shake = Math.max(0, shake - dt * 42);
    if (now - fireAt() >= 0 && now - fireAt() < 90) shake = Math.max(shake, GUNS[s.self.gun]?.pellets ? 3.4 : 1.6);
    const jitterX = shake > .15 ? (Math.random() - .5) * shake : 0;
    const jitterY = shake > .15 ? (Math.random() - .5) * shake : 0;
    ctx.translate(-view.x + jitterX, -view.y + jitterY);
    ctx.imageSmoothingEnabled = false;
    drawGround();
    drawRoads();
    for (const b of BLOCKS) {
      if (b.id !== 'harbor-water') continue;
      if (b.x + b.w < view.x - 30 || b.y + b.h < view.y - 30 || b.x > view.x + w / z + 30 || b.y > view.y + h / view.z + 30) continue;
      drawBlock(b);
    }
    for (const b of BLOCKS) {
      if (LANDMARKS.has(b.id)) continue;
      if (b.x + b.w < view.x - 30 || b.y + b.h < view.y - 30 || b.x > view.x + w / z + 30 || b.y > view.y + h / view.z + 30) continue;
      drawBlock(b);
    }
    for (const b of BLOCKS) {
      if (!LANDMARKS.has(b.id) || b.id === 'harbor-water') continue;
      if (b.x + b.w < view.x - 30 || b.y + b.h < view.y - 30 || b.x > view.x + w / z + 30 || b.y > view.y + h / view.z + 30) continue;
      drawBlock(b);
    }
    drawProps(me, now);
    for (const p of PLACES) {
      if (p.x < view.x - 60 || p.y < view.y - 60 || p.x > view.x + w / z + 60 || p.y > view.y + h / z + 60) continue;
      const skin = p.black ? 'black-market' : p.goose ? 'goose' : p.kind, color = colors[skin], radius = p.kind === 'escape' ? 23 : p.kind === 'fixer' ? 23 : 20;
      ctx.fillStyle = color + '16';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'escape' ? 48 : p.kind === 'fixer' ? 42 : 33, 0, Math.PI * 2); ctx.fill();
      drawPlaceIcon(ctx, skin, p.x, p.y, radius, color);
      label(p.name, p.x, p.y + 34, color, p.kind === 'fixer' ? 12 : 10);
      if (p.black) {
        const pulse = .32 + .22 * Math.sin(now / 260);
        ctx.strokeStyle = `rgba(181,122,224,${pulse})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 42 + Math.sin(now / 320) * 4, 0, Math.PI * 2); ctx.stroke();
        const beam = ctx.createLinearGradient(p.x, p.y, p.x, p.y - 150);
        beam.addColorStop(0, 'rgba(181,122,224,.3)'); beam.addColorStop(1, 'rgba(181,122,224,0)');
        ctx.fillStyle = beam; ctx.fillRect(p.x - 9, p.y - 150, 18, 150);
        label('黑市', p.x, p.y - 62, '#d9b4ff', 14);
      }
      if (p.kind === 'casino') {
        const pulse = .35 + .25 * Math.sin(now / 430);
        ctx.strokeStyle = `rgba(240,124,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 36 + Math.sin(now / 300) * 3, 0, Math.PI * 2); ctx.stroke();
        if (p.goose) label('赛鹅 · 夜场', p.x, p.y - 50, '#f6b4ff', 12);
      }
      if (p.kind === 'fixer') {
        const pulse = .4 + .25 * Math.sin(now / 380);
        ctx.strokeStyle = `rgba(242,201,76,${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 44 + Math.sin(now / 420) * 3, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.kind === 'escape') {
        ctx.strokeStyle = 'rgba(181,244,147,.45)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 32 + Math.sin(now / 500) * 2, 0, Math.PI * 2); ctx.stroke();
      }
      if (me.job?.to === p.id) {
        ctx.strokeStyle = '#fff0b3';
        ctx.lineWidth = 4;
        ctx.strokeRect(p.x - 35, p.y - 35, 70, 70);
        label('配送目的地', p.x, p.y - 55, '#ffe298');
      }
      const raceTarget = me.contract?.kind === 'race' ? me.contract.checkpoints?.[me.contract.index] : null;
      const heistTarget = me.contract?.kind === 'heist' ? (me.contract.stage === 2 ? me.contract.drop : me.contract.place) : null;
      if (me.contract && (me.contract.to === p.id || me.contract.place === p.id || raceTarget === p.id || heistTarget === p.id)) {
        const pulse = .55 + .3 * Math.sin(now / 260);
        ctx.strokeStyle = `rgba(242,201,76,${pulse})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(p.x - 42, p.y - 42, 84, 84);
        label(me.contract.kind === 'delivery' ? '交付委托' : me.contract.kind === 'race' ? '狂飙检查点' : me.contract.kind === 'heist' ? (me.contract.stage === 2 ? '赃款交接点' : '劫案目标') : '悬赏目标', p.x, p.y - 58, '#ffe298', 11);
      }
    }
    if (me.contract?.kind === 'race' && me.contract.checkpoints?.length) {
      const pts = me.contract.checkpoints.map(id => PLACES.find(q => q.id === id)).filter(Boolean);
      ctx.save();
      ctx.setLineDash([13, 11]);
      ctx.strokeStyle = 'rgba(242,201,76,.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(me.x, me.y);
      for (const q of pts) ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach((q, i) => {
        const done = i < (me.contract.index || 0);
        ctx.fillStyle = done ? '#5d7d5a' : '#f2c94c';
        ctx.beginPath(); ctx.arc(q.x, q.y, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#14202a';
        ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), q.x, q.y + 4);
      });
      ctx.restore();
    }
    for (const [, kind, x, y, value] of s.loot) {
      const ego = !!GUNS[kind]?.ego;
      if (ego) {
        const pulse = .3 + .2 * Math.sin(now / 220 + x);
        ctx.fillStyle = `rgba(242,213,125,${pulse})`; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f2d57d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14 + Math.sin(now / 260) * 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = kind === 'cash' ? '#82d0a1' : ego ? '#f2d57d' : Object.hasOwn(GUNS, kind) ? '#edb08c' : '#b69ad9';
      ctx.fillRect(x - 7, y - 8, 14, 13);
      ctx.fillStyle = '#f6f0d6';
      ctx.fillRect(x - 2, y - 8, 3, 13);
      if (Math.hypot(x - me.x, y - me.y) < (ego ? 240 : 80)) label(kind === 'cash' ? '¥' + value : (ego ? 'E.G.O. · ' : '') + (GUNS[kind]?.name || GOODS[kind]?.name || kind), x, y - 18);
    }
    for (const o of s.objects) {
      const [, kind, x, y, ohp, ow, oh, mat] = o;
      if (kind === 'smoke') {
        const pulse = 1 + Math.sin(now / 220 + x) * .06;
        for (let i = 0; i < 9; i++) {
          const a = i * 2.1 + now / 1400, r = 18 + (i % 3) * 20;
          ctx.fillStyle = i % 2 ? 'rgba(184,195,192,.22)' : 'rgba(214,222,216,.18)';
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * .7, (34 + (i % 4) * 7) * pulse, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(80,95,92,.22)'; ctx.beginPath(); ctx.arc(x, y, 74, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (kind === 'mine') {
        ctx.fillStyle = '#4f4a40'; ctx.beginPath(); ctx.ellipse(x, y, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c7b98c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
        if (Math.sin(now / 180) > 0) { ctx.fillStyle = '#ff6e61'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
        continue;
      }
      if (kind === 'fire') {
        const flick = 1 + Math.sin(now / 90 + x) * .12;
        ctx.fillStyle = '#f2703f2e'; ctx.beginPath(); ctx.arc(x, y, 70 * flick, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * Math.PI * 2 + now / 700, r = 28 + (i % 3) * 11;
          ctx.fillStyle = i % 2 ? '#f2a13f' : '#e25b3d';
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * .6, 8 + (i % 3) * 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x, y, 11 * flick, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (kind === 'airdrop') {
        const pulse = .45 + .3 * Math.sin(now / 260);
        ctx.strokeStyle = `rgba(255,214,120,${pulse})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 40 + Math.sin(now / 300) * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#3f5b4a'; ctx.fillRect(x - 20, y - 14, 40, 30);
        ctx.fillStyle = '#c9a25f'; ctx.fillRect(x - 20, y - 14, 40, 4);
        ctx.fillStyle = '#e8d7a7'; ctx.fillRect(x - 3, y - 14, 6, 30);
        ctx.fillStyle = '#d3d9c9'; ctx.beginPath(); ctx.moveTo(x - 30, y - 26); ctx.quadraticCurveTo(x, y - 68, x + 30, y - 26); ctx.fill();
        ctx.strokeStyle = '#aab3a2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 30, y - 26); ctx.lineTo(x - 18, y - 16); ctx.moveTo(x + 30, y - 26); ctx.lineTo(x + 18, y - 16); ctx.stroke();
        label('空投军火', x, y - 58, '#ffe298');
        continue;
      }
      if (kind === 'block') { const bw = ow || 30, bh = oh || 30; ctx.fillStyle = mat === 'grass' ? '#5f9a4e' : mat === 'dirt' ? '#8a6a45' : '#7c8188'; ctx.fillRect(x, y, bw, bh); ctx.fillStyle = '#0003'; ctx.fillRect(x, y + bh - 4, bw, 4); ctx.strokeStyle = '#0004'; ctx.strokeRect(x + .5, y + .5, bw - 1, bh - 1); continue; }
      if (kind === 'riftcore') { const bw = ow || 40, bh = oh || 40, pulse = .4 + .3 * Math.sin(now / 260); ctx.fillStyle = '#1a1020'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = `rgba(190,120,255,${pulse})`; ctx.lineWidth = 3; ctx.strokeRect(x, y, bw, bh); ctx.fillStyle = `rgba(190,120,255,${pulse})`; ctx.fillRect(x + bw / 2 - 6, y + bh / 2 - 6, 12, 12); label('核心', x + bw / 2, y - 10, '#d9b8ff', 10); continue; }
      if (kind === 'chest') { const bw = ow || 28, bh = oh || 28; ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x, y, bw, bh); ctx.fillStyle = '#c9a25f'; ctx.fillRect(x + bw / 2 - 4, y - 2, 8, 8); ctx.strokeStyle = '#3a2a18'; ctx.strokeRect(x, y, bw, bh); continue; }
      if (kind === 'pod') { ctx.fillStyle = '#3a4650'; ctx.beginPath(); ctx.ellipse(x, y, 34, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e0675e'; ctx.beginPath(); ctx.arc(x, y - 12, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8fa6a6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 34, 26, 0, 0, Math.PI * 2); ctx.stroke(); label('收容舱', x, y - 42, '#ffb09a', 10); continue; }
      ctx.fillStyle = {banana: '#f4db69', barricade: '#e6a574', decoy: '#cab8df', perfume: '#94ccad'}[kind] || '#c9c0a8';
      ctx.fillRect(x - 18, y - 15, 36, 25);
      if (kind === 'barricade') { ctx.fillStyle = '#493e40'; ctx.fillRect(x - 16, y - 9, 32, 6); }
    }
    drawAim(me, s);
    for (const car of s.cars) {
      const [id, cx, cy, ch, hp, owner, driver, kind, speed, contract, chase, convoy] = car;
      const {x, y, heading} = driver === self() ? {x: cx, y: cy, heading: ch} : timeline.sample('c:' + id, now) || {x: cx, y: cy, heading: ch};
      ctx.save();
      ctx.translate(x, y);
      drawCar(ctx, {heading, color: hp <= 0 ? '#4b4e53' : kind === 'police' ? '#3f6d9b' : kind === 'truck' ? '#56624f' : kind === 'van' ? '#c8a36c' : owner === self() ? '#72bda5' : '#8498b7'});
      if (kind === 'police' && hp > 0) {
        const pulse = Math.sin(now / 130) > 0;
        ctx.fillStyle = pulse ? '#ff5b55' : '#5db8ff';
        ctx.beginPath(); ctx.arc(-12, -18, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pulse ? '#5db8ff' : '#ff5b55';
        ctx.beginPath(); ctx.arc(12, -18, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pulse ? '#ff5b5533' : '#5db8ff33';
        ctx.beginPath(); ctx.arc(0, -18, 20, 0, Math.PI * 2); ctx.fill();
      }
      if (kind === 'truck') {
        ctx.fillStyle = '#3f4a3b'; ctx.fillRect(-25, -10, 50, 20);
        ctx.fillStyle = '#7b8a6a'; ctx.fillRect(-21, -7, 42, 14);
        ctx.fillStyle = '#1f2723'; ctx.fillRect(12, -12, 12, 24);
        ctx.fillStyle = '#d7cbaa44'; for (let i = -18; i < 10; i += 10) ctx.fillRect(i, -6, 2, 12);
      }
      ctx.restore();
      if (kind === 'police' && chase) {
        label(hp <= 0 ? '警车残骸' : '警车追捕', x, y - 42, hp <= 0 ? '#9fb0b5' : '#9fd8ff', 10);
      } else if (contract) {
        const pulse = .6 + .3 * Math.sin(now / 260);
        ctx.strokeStyle = `rgba(242,201,76,${pulse})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 34 + Math.sin(now / 330) * 2, 0, Math.PI * 2); ctx.stroke();
        label('委托车辆', x, y - 42, '#ffe298', 10);
      } else if (kind === 'truck') {
        label(hp <= 0 ? (convoy ? '押运车残骸' : '装甲车残骸') : (convoy ? '武装押运' : '装甲运钞车'), x, y - 42, hp <= 0 ? '#bca9a2' : '#ffe0a0', 11);
      } else if (Math.hypot(x - me.x, y - me.y) < 110) label(hp <= 0 ? '报废' : owner === self() ? '你的车' : driver ? '有人驾驶' : '按住E抢车', x, y - 39, hp <= 0 ? '#bca9a2' : '#d9e4e5');
    }
    const people = s.players.map(p => p.id === self() ? {...p, x: me.x, y: me.y} : {...p, ...timeline.sample('p:' + p.id, now)});
    for (const p of people) if (!p.car) person(p, now);
    for (const n of s.npcs) person({id: n[0], x: n[2], y: n[3], hp: n[4], heading: n[5], bark: n[6], variant: n[7], revealed: !!n[8], maxHp: n[9] || n[4], ...timeline.sample('n:' + n[0], now)}, now, n[1]);
    const progress = s.self.progress;
    if (progress && s.self.hp > 0) {
      const frac = Math.max(0, Math.min(1, 1 - (progress.left || 0) / (progress.total || 1)));
      const color = {work: '#70dbb1', bank: '#f2d57d', car: '#84c8e8', mug: '#f39485', escape: '#b5f493', mine: '#b0a080'}[progress.kind] || '#f2d57d';
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(me.x, me.y - 8, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
      ctx.globalAlpha = .22; ctx.beginPath(); ctx.arc(me.x, me.y - 8, 36, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; label(({work: '打工', bank: '开金库', car: '抢车', mug: '抢劫', escape: '撤离', mine: '挖方块'}[progress.kind] || '操作') + ' ' + Math.round(frac * 100) + '%', me.x, me.y - 52, color, 10);
      ctx.restore();
    }
    if (s.self.reload > 0 && s.self.hp > 0) {
      const total = GUNS[s.self.gun]?.reload || 1, frac = Math.max(0, Math.min(1, 1 - s.self.reload / total));
      ctx.save(); ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(me.x, me.y - 8, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
      ctx.restore();
    }
    if (now - hurtDirAt < 720) {
      ctx.save(); ctx.globalAlpha = 1 - (now - hurtDirAt) / 720;
      ctx.strokeStyle = '#ff6f5f'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(me.x, me.y - 12, 58, hurtDir - .38, hurtDir + .38); ctx.stroke();
      ctx.restore();
    }
    for (const bomb of s.bombs) {
      const [, x, y, at, kind, radius] = bomb;
      const r = radius || 80;
      ctx.fillStyle = '#f6795d30';
      ctx.strokeStyle = kind === 'grenade' ? '#ffd27a' : '#ff9c74';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      label(Math.max(0, at - s.time).toFixed(1), x, y, '#ffb99c');
    }
    const eventList = s.events || (s.event ? [s.event] : []);
    for (const ev of eventList) if (ev.kind === 'golden') {
      const goose = s.npcs.find(n => n[1] === 'golden');
      if (!goose) { const pulse = .4 + .3 * Math.sin(now / 300); ctx.strokeStyle = `rgba(255,214,90,${pulse})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ev.x, ev.y, 44, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const ev of eventList) if (ev.kind === 'artillery') {
      const radius = ev.radius || 620, warning = s.time < (ev.warnEnd ?? 0), end = warning ? (ev.warnEnd ?? 0) : (ev.barrageEnd ?? 0);
      const alpha = warning ? .13 + .07 * Math.sin(now / 150) : .05;
      ctx.save();
      ctx.fillStyle = `rgba(235,70,55,${alpha})`;
      ctx.strokeStyle = warning ? 'rgba(255,120,90,.85)' : 'rgba(255,170,110,.45)';
      ctx.lineWidth = 4; ctx.setLineDash([20, 14]);
      ctx.beginPath(); ctx.arc(ev.x, ev.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      const left = Math.max(0, Math.ceil(end - s.time));
      label(warning ? `炮击预警 ${left}` : `炮击中 ${left}`, ev.x, ev.y - 24, '#ffd9c8', 20);
      ctx.restore();
    }
    for (const ev of eventList) if (ev.x != null && !['blackout', 'truck', 'golden', 'bombs', 'artillery'].includes(ev.kind)) {
      const pulse = .28 + .18 * Math.sin(now / 330);
      ctx.strokeStyle = ev.major ? `rgba(242,120,90,${pulse})` : `rgba(242,180,90,${pulse})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, 54, 0, Math.PI * 2); ctx.stroke();
    }
    for (const b of s.bullets || []) {
      const [, bx, by, angle, kind] = b, police = kind === 'police', color = police ? '#b9e4ff' : '#ffd08a';
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.moveTo(bx - Math.cos(angle) * 18, by - Math.sin(angle) * 18); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = police ? '#eaf8ff' : '#fff4d0';
      ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .24; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    drawEffects(me, now, s);
    if (s.helicopter) {
      const h = s.helicopter;
      const glow = ctx.createRadialGradient(h.x, h.y, 20, h.x, h.y, 240);
      glow.addColorStop(0, 'rgba(255,246,190,.2)');
      glow.addColorStop(1, 'rgba(255,246,190,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(h.x, h.y, 240, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,246,190,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, 70, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(h.x, h.y);
      ctx.fillStyle = '#1d2a32'; ctx.beginPath(); ctx.ellipse(0, 0, 23, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9fb6b8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.stroke();
      ctx.rotate(now / 80); ctx.strokeStyle = '#c9d6d4'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(38, 0); ctx.moveTo(0, -38); ctx.lineTo(0, 38); ctx.stroke();
      ctx.restore();
      if (h.maxHp) {
        const frac = Math.max(0, Math.min(1, (h.hp || 0) / h.maxHp));
        ctx.fillStyle = '#101d2dcc'; ctx.fillRect(h.x - 30, h.y - 48, 60, 5);
        ctx.fillStyle = '#ff6b5a'; ctx.fillRect(h.x - 30, h.y - 48, 60 * frac, 5);
      }
      label(h.maxHp ? '警方直升机 · 可击落' : '警方直升机', h.x, h.y - 32, '#ffe9a0', 10);
    }
    if (s.event?.kind === 'blackout') {
      const gradient = ctx.createRadialGradient(me.x, me.y, 80, me.x, me.y, 480);
      gradient.addColorStop(0, '#050b1200');
      gradient.addColorStop(1, '#050b12ed');
      ctx.fillStyle = gradient;
      ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    if (s.event?.kind === 'zombies') {
      const pulse = .2 + .06 * Math.sin(now / 260);
      const gradient = ctx.createRadialGradient(me.x, me.y, 160, me.x, me.y, 620);
      gradient.addColorStop(0, 'rgba(40,70,40,0)');
      gradient.addColorStop(1, `rgba(28,52,30,${pulse})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    if (s.chaos >= 50) {
      const heat = Math.min(.22, (s.chaos - 50) / 50 * .22);
      const gradient = ctx.createRadialGradient(me.x, me.y, 160, me.x, me.y, 760);
      gradient.addColorStop(0, 'rgba(180,40,30,0)');
      gradient.addColorStop(1, `rgba(160,30,24,${heat})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    if (now - hurtAt < 280) {
      const gradient = ctx.createRadialGradient(me.x, me.y, 110, me.x, me.y, 620);
      gradient.addColorStop(0, 'rgba(190,30,24,0)');
      gradient.addColorStop(1, `rgba(190,30,24,${(1 - (now - hurtAt) / 280) * .26})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    if (s.self.bounty) {
      const pulse = .1 + .05 * Math.sin(now / 240);
      const gradient = ctx.createRadialGradient(me.x, me.y, 120, me.x, me.y, 640);
      gradient.addColorStop(0, 'rgba(210,50,35,0)');
      gradient.addColorStop(1, `rgba(210,50,35,${pulse})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    const hpRatio = s.self.hp / (s.self.maxHp || 100);
    if (hpRatio < .32 && s.self.hp > 0) {
      const power = (.32 - hpRatio) / .32, pulse = .75 + .25 * Math.sin(now / 220);
      const gradient = ctx.createRadialGradient(me.x, me.y, 80, me.x, me.y, 560);
      gradient.addColorStop(0, 'rgba(190,20,16,0)');
      gradient.addColorStop(1, `rgba(190,20,16,${power * .24 * pulse})`);
      ctx.fillStyle = gradient; ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    if (now - flashAt < 130) {
      ctx.fillStyle = flashColor === '#ffffff' ? `rgba(255,255,255,${(1 - (now - flashAt) / 130) * .48})` : `rgba(255,206,142,${(1 - (now - flashAt) / 130) * .2})`;
      ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    if (s.self.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(.7, s.self.flash * .35)})`;
      ctx.fillRect(view.x, view.y, w / z, h / z);
    }
    const since = now - fireAt();
    if (since >= 0 && since < 90 && s.self.hp > 0 && !s.self.car) {
      const a = aim();
      ctx.save();
      ctx.globalAlpha = 1 - since / 90;
      ctx.fillStyle = '#ffe2a0';
      ctx.beginPath(); ctx.arc(me.x + Math.cos(a) * 24, me.y + Math.sin(a) * 24 - 17, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff2c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(me.x + Math.cos(a) * 18, me.y + Math.sin(a) * 18 - 17);
      ctx.lineTo(me.x + Math.cos(a) * 40, me.y + Math.sin(a) * 40 - 17);
      ctx.stroke();
      ctx.restore();
    }
    for (const id of poses.keys()) if (!people.some(p => p.id === id) && !s.npcs.some(n => n[0] === id)) poses.delete(id);
    crosshair(me, s, now);
  }

  requestAnimationFrame(render);

  return {
    point(x, y) {
      const b = canvas.getBoundingClientRect();
      return {x: (x - b.x) / view.z + view.x, y: (y - b.y) / view.z + view.y};
    },
    map(canvas, s) {
      const c = canvas.getContext('2d'), sx = canvas.width / CITY.width, sy = canvas.height / CITY.height;
      c.fillStyle = '#173e4c';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = '#1b2530';
      c.fillRect(3, 3, canvas.width - 6, canvas.height - 6);
      for (const z of ZONES) {
        c.fillStyle = z.tint;
        c.fillRect(z.x * sx, z.y * sy, z.w * sx, z.h * sy);
        if (canvas.width > 300) {
          c.font = `bold ${Math.max(8, Math.round(canvas.width / 100))}px system-ui`;
          c.textAlign = 'center';
          c.fillStyle = z.edge + '66';
          c.fillText(z.name, (z.x + z.w / 2) * sx, (z.y + z.h / 2) * sy);
        }
      }
      // 道路
      c.fillStyle = '#39454e';
      for (const d of DISTRICTS) {
        for (let y = d.y + d.ch; y < d.y + d.h; y += d.ch + d.road) c.fillRect(d.x * sx, y * sy, d.w * sx, Math.max(1, d.road * sy));
        for (let x = d.x + d.cw; x < d.x + d.w; x += d.cw + d.road) c.fillRect(x * sx, d.y * sy, Math.max(1, d.road * sx), d.h * sy);
      }
      for (const r of ROADS) {
        c.fillStyle = r.type === 'dock' ? '#59564a' : r.type === 'ring' ? '#39454e' : '#58636b';
        if (r.type === 'ring') {
          const t = 64;
          c.fillRect(r.x * sx, r.y * sy, r.w * sx, t * sy);
          c.fillRect(r.x * sx, (r.y + r.h - t) * sy, r.w * sx, t * sy);
          c.fillRect(r.x * sx, (r.y + t) * sy, t * sx, (r.h - t * 2) * sy);
          c.fillRect((r.x + r.w - t) * sx, (r.y + t) * sy, t * sx, (r.h - t * 2) * sy);
        } else c.fillRect(r.x * sx, r.y * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy));
      }
      c.strokeStyle = '#0d151c';
      c.lineWidth = 2;
      c.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      for (const b of BLOCKS) {
        let fill = b.color || '#71808a';
        if (b.style === 'water') fill = '#154351';
        else if (b.style === 'pier') fill = '#8a7c60';
        else if (b.style === 'park') fill = '#4d704f';
        else if (b.style === 'plaza') fill = '#767064';
        else if (b.style === 'container') fill = b.color;
        else if (b.solid === false) fill = '#5d6670';
        c.fillStyle = fill;
        c.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
      }
      const iconSize = canvas.width > 300 ? 8 : 4;
      c.font = 'bold 9px system-ui';
      for (const p of PLACES) {
        const tx = p.x * sx, ty = p.y * sy, skin = p.black ? 'black-market' : p.goose ? 'goose' : p.kind;
        drawPlaceIcon(c, skin, tx, ty, iconSize, colors[skin]);
        if (p.black) { c.strokeStyle = '#d9aaff'; c.lineWidth = canvas.width > 300 ? 2 : 1.2; c.beginPath(); c.arc(tx, ty, iconSize + (canvas.width > 300 ? 6 : 3), 0, Math.PI * 2); c.stroke(); }
        if (canvas.width > 300) {
          const right = tx > canvas.width - 40;
          c.textAlign = right ? 'right' : 'left';
          c.fillStyle = colors[skin];
          c.fillText(signs[skin], right ? tx - iconSize - 5 : tx + iconSize + 5, ty + 3);
        }
      }
      if (s) {
        if (s.self.contract) {
          const contract = s.self.contract;
          if (contract.kind === 'race' && contract.checkpoints?.length) {
            const pts = contract.checkpoints.map(id => PLACES.find(q => q.id === id)).filter(Boolean);
            c.strokeStyle = '#f2c94c99'; c.lineWidth = 2; c.setLineDash([8, 6]);
            c.beginPath(); c.moveTo(s.self.x * sx, s.self.y * sy);
            for (const q of pts) c.lineTo(q.x * sx, q.y * sy);
            c.stroke(); c.setLineDash([]);
            pts.forEach((q, i) => {
              c.fillStyle = i < (contract.index || 0) ? '#5d7d5a' : '#f2c94c';
              c.beginPath(); c.arc(q.x * sx, q.y * sy, canvas.width > 300 ? 7 : 3, 0, Math.PI * 2); c.fill();
            });
          }
          const target = PLACES.find(q => q.id === (contract.kind === 'race' ? contract.checkpoints?.[contract.index] : contract.kind === 'heist' ? (contract.stage === 2 ? contract.drop : contract.place) : (contract.to || contract.place)));
          if (target) {
            c.strokeStyle = '#f2c94c';
            c.lineWidth = 2;
            c.strokeRect(target.x * sx - 10, target.y * sy - 10, 20, 20);
          }
          for (const car of s.cars || []) {
            if (car[9]) { c.strokeStyle = '#f2c94c'; c.lineWidth = 2; c.strokeRect(car[1] * sx - 8, car[2] * sy - 8, 16, 16); }
          }
        }
        for (const q of s.map || []) {
          c.fillStyle = '#b9c7d0';
          c.fillRect(q[1] * sx - 2, q[2] * sy - 2, 4, 4);
        }
        for (const q of s.players || []) {
          if (!q.bounty && !(s.self.contract?.kind === 'player' && s.self.contract.target === q.id)) continue;
          c.strokeStyle = '#ff7d6c';
          c.lineWidth = 2;
          c.beginPath(); c.arc(q.x * sx, q.y * sy, canvas.width > 300 ? 7 : 3, 0, Math.PI * 2); c.stroke();
          if (canvas.width > 300) { c.fillStyle = '#ff9b8a'; c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.fillText('赏', q.x * sx, q.y * sy + 3); }
        }
        c.fillStyle = '#ffe4a0';
        c.beginPath(); c.arc(s.self.x * sx, s.self.y * sy, canvas.width > 300 ? 5 : 3, 0, Math.PI * 2); c.fill();
        for (const ev of (s.events || (s.event ? [s.event] : []))) {
          if (ev.x == null) continue;
          c.strokeStyle = ev.major ? '#f4896f' : '#9fb0b5';
          c.strokeRect(ev.x * sx - 10, ev.y * sy - 10, 20, 20);
        }
      }
    }
  };
}
