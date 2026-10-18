import {CITY,BLOCKS,PLACES,ZONES,GUNS,GOODS,EVENTS,BARKS,wallRange} from './city-rules.js?v=0.17.3';
import {rigImage} from './avatar-render.js?v=0.16.0';
import {drawCar} from './lobby-render.js?v=0.16.0';
import {CityTimeline} from './city-motion.js?v=0.17.3';

const colors = {job: '#70dbb1', arms: '#f39485', market: '#c4a0ef', bank: '#f2d57d', casino: '#d7a1db', garage: '#84c8e8', escape: '#b5f493'};
const signs = {job: '工', arms: '武', market: '店', bank: '银', casino: '赌', garage: '车', escape: '离'};
const ROAD = 100;

export function createCityRenderer(canvas, {state, self, aim, avatars = () => new Map(), speech = () => null, pointer = () => null, firing = () => false, fireAt = () => 0}) {
  const ctx = canvas.getContext('2d'), poses = new Map(), timeline = new CityTimeline();
  let w = 960, h = 640, dpr = 1, last = 0, view = {x: 0, y: 0, z: 1}, snapshotKey = '', match = '', hitAt = 0, renderNow = 0;

  new ResizeObserver(() => {
    const b = canvas.getBoundingClientRect();
    w = Math.max(1, b.width);
    h = Math.max(1, b.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }).observe(canvas);

  function label(text, x, y, color = '#f0ecda', size = 11) {
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
    ctx.fillStyle = '#1c4a5a';
    ctx.fillRect(view.x, view.y, w / view.z, h / view.z);
    ctx.strokeStyle = '#4a8b98aa';
    ctx.lineWidth = 2;
    const waveX = Math.floor(view.x / 80) * 80, waveY = Math.floor(view.y / 80) * 80;
    for (let y = waveY; y < view.y + h / view.z; y += 36) {
      ctx.beginPath();
      ctx.moveTo(view.x, y);
      for (let x = waveX; x < view.x + w / view.z; x += 80) ctx.lineTo(x, y + Math.sin(x * .03) * 3);
      ctx.lineTo(view.x + w / view.z, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#1b2530';
    ctx.fillRect(0, 0, CITY.width, CITY.height);
    for (const z of ZONES) {
      ctx.fillStyle = z.tint;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = z.edge + '1f';
      ctx.lineWidth = 3;
      ctx.strokeRect(z.x + 5, z.y + 5, z.w - 10, z.h - 10);
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px system-ui';
    for (const z of ZONES) {
      ctx.fillStyle = z.edge;
      ctx.globalAlpha = .13;
      ctx.fillText(z.name, z.x + z.w / 2, z.y + z.h / 2 + 16);
    }
    ctx.restore();
    // 外围人行道与围栏：玩家走到边缘也不会看到城市外的虚空。
    ctx.fillStyle = '#3a4651';
    ctx.fillRect(0, 0, CITY.width, 46);
    ctx.fillRect(0, CITY.height - 46, CITY.width, 46);
    ctx.fillRect(0, 0, 46, CITY.height);
    ctx.fillRect(CITY.width - 46, 0, 46, CITY.height);
    ctx.fillStyle = '#101a21';
    ctx.fillRect(0, 0, CITY.width, 10);
    ctx.fillRect(0, CITY.height - 10, CITY.width, 10);
    ctx.fillRect(0, 0, 10, CITY.height);
    ctx.fillRect(CITY.width - 10, 0, 10, CITY.height);
    ctx.fillStyle = '#5e747c';
    for (let x = 20; x < CITY.width; x += 52) { ctx.fillRect(x, 2, 12, 18); ctx.fillRect(x, CITY.height - 20, 12, 18); }
    for (let y = 20; y < CITY.height; y += 52) { ctx.fillRect(2, y, 18, 12); ctx.fillRect(CITY.width - 20, y, 18, 12); }
  }

  function drawRoads() {
    ctx.fillStyle = '#222d38';
    ctx.fillRect(view.x, view.y, w / view.z, h / view.z);
    ctx.fillStyle = '#424d58';
    for (let x = 0; x < CITY.width; x += 512) ctx.fillRect(x, 0, ROAD, CITY.height);
    for (let y = 0; y < CITY.height; y += 560) ctx.fillRect(0, y, CITY.width, ROAD);
    ctx.fillStyle = '#5b656d';
    for (let x = 0; x < CITY.width; x += 512) {
      ctx.fillRect(x + 7, 0, 4, CITY.height);
      ctx.fillRect(x + ROAD - 11, 0, 4, CITY.height);
    }
    for (let y = 0; y < CITY.height; y += 560) {
      ctx.fillRect(0, y + 7, CITY.width, 4);
      ctx.fillRect(0, y + ROAD - 11, CITY.width, 4);
    }
    ctx.fillStyle = '#a1a88f';
    const x0 = Math.max(0, Math.floor(view.x / 90) * 90), y0 = Math.max(0, Math.floor(view.y / 90) * 90);
    for (let x = 0; x < CITY.width; x += 512) {
      for (let y = y0; y < Math.min(CITY.height, view.y + h / view.z + 90); y += 90) ctx.fillRect(x + 48, y, 4, 34);
    }
    for (let y = 0; y < CITY.height; y += 560) {
      for (let x = x0; x < Math.min(CITY.width, view.x + w / view.z + 90); x += 90) ctx.fillRect(x, y + 48, 34, 4);
    }
  }

  function drawPark(b) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#7d956f';
    ctx.fillRect(b.x + 18, b.y + 18, b.w - 36, b.h - 36);
    ctx.fillStyle = '#b6a77d';
    ctx.fillRect(b.x + 24, b.y + b.h / 2 - 9, b.w - 48, 18);
    ctx.fillRect(b.x + b.w / 2 - 9, b.y + 24, 18, b.h - 48);
    for (let i = 0; i < 7; i++) {
      const tx = b.x + 38 + (i * 53) % Math.max(1, b.w - 70);
      const ty = b.y + 38 + (i * 31) % Math.max(1, b.h - 70);
      ctx.fillStyle = '#263b2d';
      ctx.beginPath(); ctx.arc(tx + 4, ty + 7, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i % 2 ? '#527a55' : '#628a5f';
      ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.fill();
    }
    label('街心公园', b.x + b.w / 2, b.y + 18, '#d6e8c8', 10);
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

  function drawPlaza(b) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#6e6b63';
    ctx.fillRect(b.x + 22, b.y + 22, b.w - 44, b.h - 44);
    ctx.strokeStyle = '#a8a28f55';
    ctx.lineWidth = 2;
    for (let x = b.x + 42; x < b.x + b.w - 30; x += 42) {
      ctx.beginPath(); ctx.moveTo(x, b.y + 24); ctx.lineTo(x, b.y + b.h - 24); ctx.stroke();
    }
    ctx.fillStyle = '#8e9d9d';
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b7c6c2';
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 12, 0, Math.PI * 2); ctx.fill();
  }

  function drawBuilding(b) {
    ctx.fillStyle = '#111e2980';
    ctx.fillRect(b.x + 14, b.y + 18, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof || '#3e4f5e';
    ctx.fillRect(b.x, b.y, b.w, 13);
    ctx.fillStyle = b.accent || '#d7c58b';
    ctx.fillRect(b.x, b.y + 13, b.w, 2);
    const floors = b.floors || 3;
    const cols = Math.max(2, Math.floor(b.w / 46));
    const gap = 9, winW = (b.w - gap * (cols + 1)) / cols, winH = Math.min(15, (b.h - 42) / Math.max(2, floors) - 7);
    for (let floor = 0; floor < floors; floor++) {
      for (let c = 0; c < cols; c++) {
        const wx = b.x + gap + c * (winW + gap), wy = b.y + 27 + floor * (winH + 8);
        if (wy + winH > b.y + b.h - 25) break;
        ctx.fillStyle = b.window || '#c9d7d5';
        ctx.fillRect(wx, wy, winW, winH);
        ctx.fillStyle = '#1d2b33aa';
        ctx.fillRect(wx + winW * .55, wy, Math.max(1, winW * .08), winH);
      }
    }
    if (b.style === 'shop') {
      ctx.fillStyle = b.accent || '#f2cf8f';
      for (let x = b.x + 10; x < b.x + b.w - 10; x += 30) ctx.fillRect(x, b.y + 17, 15, 6);
      ctx.fillStyle = '#563b36';
      ctx.fillRect(b.x + b.w * .42, b.y + b.h - 31, b.w * .16, 31);
    } else if (b.style === 'warehouse') {
      ctx.strokeStyle = '#c4c8aa44';
      ctx.lineWidth = 2;
      for (let x = b.x + 8; x < b.x + b.w - 8; x += 18) {
        ctx.beginPath(); ctx.moveTo(x, b.y + 16); ctx.lineTo(x, b.y + b.h - 8); ctx.stroke();
      }
      ctx.fillStyle = '#4b5040';
      ctx.fillRect(b.x + b.w * .35, b.y + b.h - 38, b.w * .30, 38);
    } else if (b.style === 'hotel') {
      ctx.fillStyle = '#6d4e4a';
      ctx.fillRect(b.x + 10, b.y + 20, 28, 54);
      ctx.fillStyle = '#f5d28a';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('H', b.x + 24, b.y + 38);
      ctx.fillText('O', b.x + 24, b.y + 52);
      ctx.fillText('T', b.x + 24, b.y + 66);
    } else if (b.style === 'hospital') {
      ctx.fillStyle = '#d47d78';
      ctx.fillRect(b.x + b.w / 2 - 15, b.y + 22, 30, 9);
      ctx.fillRect(b.x + b.w / 2 - 5, b.y + 12, 10, 29);
    } else if (b.style === 'construction') {
      ctx.strokeStyle = '#d8b06c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * .2, b.y + 10);
      ctx.lineTo(b.x + b.w * .2, b.y - 54);
      ctx.lineTo(b.x + b.w * .72, b.y - 20);
      ctx.stroke();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#e2a15d99';
      ctx.beginPath(); ctx.moveTo(b.x + b.w * .2, b.y - 48); ctx.lineTo(b.x + b.w * .72, b.y - 46); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = '#2e3d48';
      ctx.fillRect(b.x + b.w * .44, b.y + b.h - 29, b.w * .12, 29);
      ctx.fillStyle = '#89989a';
      ctx.fillRect(b.x + b.w - 34, b.y + 18, 18, 12);
    }
    const zone = zoneAt(b.x, b.y);
    if (b.style === 'office' || b.style === 'hotel') {
      ctx.fillStyle = '#2c3a44';
      ctx.fillRect(b.x + b.w - 46, b.y + 18, 18, 12);
      ctx.fillStyle = '#80959b';
      ctx.fillRect(b.x + b.w - 42, b.y + 20, 10, 3);
      if (b.style === 'office' && b.w > 240) {
        ctx.strokeStyle = '#89999d';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, b.y); ctx.lineTo(b.x + b.w / 2, b.y - 22); ctx.stroke();
        ctx.fillStyle = '#c95e58';
        ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y - 24, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (b.style === 'apartment' || b.style === 'hotel') {
      ctx.fillStyle = '#6e7d80';
      ctx.fillRect(b.x + 16, b.y - 9, 22, 10);
      ctx.fillStyle = '#a9b6b4';
      ctx.fillRect(b.x + 18, b.y - 7, 18, 2);
      for (let f = 1; f < Math.min(6, b.floors); f++) {
        ctx.fillStyle = '#d9d3ba44';
        ctx.fillRect(b.x + 5, b.y + 26 + f * 24, 8, 13);
      }
    }
    if (b.style === 'warehouse') {
      ctx.fillStyle = '#4b5040';
      ctx.fillRect(b.x + 8, b.y - 8, 30, 9);
      ctx.fillStyle = '#c4b78a';
      ctx.fillRect(b.x + 12, b.y - 6, 22, 3);
    }
    if (zone?.id === 'entertainment') {
      const pulse = .5 + .5 * Math.sin(renderNow / 260 + b.x * .02);
      ctx.strokeStyle = `rgba(240,124,255,${.45 + pulse * .35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x + 8, b.y + 3); ctx.lineTo(b.x + b.w - 8, b.y + 3); ctx.stroke();
      ctx.fillStyle = `rgba(77,227,242,${.3 + pulse * .4})`;
      ctx.fillRect(b.x + b.w - 20, b.y + 16, 8, 8);
    } else if (zone?.id === 'finance') {
      ctx.strokeStyle = '#d8b86a55';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    } else if (zone?.id === 'commercial' && b.style === 'shop') {
      ctx.fillStyle = '#f2cf8f';
      ctx.fillRect(b.x + 12, b.y - 6, Math.min(90, b.w - 24), 8);
      ctx.fillStyle = '#5a3b32';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('OPEN', b.x + Math.min(57, b.w / 2), b.y + 1);
    }
    if (b.label) label(b.label, b.x + b.w / 2, b.y - 6, '#d8e1d8', 10);
  }

  function drawBlock(b) {
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
    // 赌场：紫色广场、喷泉、红毯、筹码与霓虹灯。
    for (const p of PLACES) {
      if (p.kind !== 'casino' || !inView(p.x, p.y, 230)) continue;
      const glow = ctx.createRadialGradient(p.x, p.y, 24, p.x, p.y, 210);
      glow.addColorStop(0, 'rgba(168,74,214,.35)');
      glow.addColorStop(.55, 'rgba(90,40,130,.18)');
      glow.addColorStop(1, 'rgba(27,37,48,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, 210, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7c2437';
      ctx.fillRect(p.x - 18, p.y + 22, 36, 82);
      ctx.fillStyle = '#d1a34e';
      ctx.fillRect(p.x - 20, p.y + 100, 40, 6);
      ctx.fillStyle = '#55686f';
      ctx.beginPath(); ctx.ellipse(p.x + 76, p.y + 54, 42, 23, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f9ca8';
      ctx.beginPath(); ctx.ellipse(p.x + 76, p.y + 54, 34, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b8edf1';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = now / 900 + i * 1.25;
        ctx.beginPath();
        ctx.moveTo(p.x + 76, p.y + 54);
        ctx.quadraticCurveTo(p.x + 76 + Math.cos(a) * 20, p.y + 30, p.x + 76 + Math.cos(a) * 34, p.y + 54 + Math.sin(a) * 12);
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const cx = p.x - 100 + (i * 43) % 200, cy = p.y + 58 + (i * 31) % 46;
        ctx.fillStyle = ['#f07cff', '#ffd34d', '#4de3f2'][i % 3];
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f6edcf';
        ctx.fillRect(cx + 8, cy - 5, 10, 10);
        ctx.fillStyle = '#192531';
        ctx.beginPath(); ctx.arc(cx + 13, cy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, r = 150 + Math.sin(now / 380 + i) * 5;
        ctx.fillStyle = i % 2 ? '#f07cff' : '#4de3f2';
        ctx.globalAlpha = .45 + .35 * Math.sin(now / 260 + i * 1.9);
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .55, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // 中央商业区的摊位
    for (const p of PLACES) {
      if (p.kind !== 'market' || !inView(p.x, p.y, 140)) continue;
      ctx.fillStyle = '#3e3030';
      ctx.fillRect(p.x - 42, p.y + 30, 84, 26);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#d46a5d' : '#f0d6b0';
        ctx.fillRect(p.x - 42 + i * 14, p.y + 20, 14, 12);
      }
      ctx.fillStyle = '#f4d57d';
      ctx.fillRect(p.x - 34, p.y + 36, 14, 12);
      ctx.fillStyle = '#9d6fd1';
      ctx.fillRect(p.x - 12, p.y + 36, 10, 12);
      ctx.fillStyle = '#6fbfa5';
      ctx.fillRect(p.x + 6, p.y + 38, 12, 10);
    }
    // 工业区集装箱
    for (const b of BLOCKS) {
      if (b.style !== 'warehouse' && b.style !== 'construction') continue;
      if (!inView(b.x, b.y, 80)) continue;
      const palette = ['#a46f51', '#5f7d8f', '#7f8064', '#8d5e63'];
      ctx.fillStyle = palette[(b.x + b.y) % palette.length];
      ctx.fillRect(b.x + b.w - 46, b.y + b.h - 38, 42, 24);
      ctx.fillStyle = '#ffffff1b';
      for (let i = 0; i < 4; i++) ctx.fillRect(b.x + b.w - 42 + i * 10, b.y + b.h - 34, 4, 16);
    }
    // 路灯：主路交叉口
    for (let x = 0; x < CITY.width; x += 512) {
      for (let y = 0; y < CITY.height; y += 560) {
        if (!inView(x + 22, y + 22, 60)) continue;
        ctx.fillStyle = '#25333d';
        ctx.fillRect(x + 20, y + 12, 5, 28);
        ctx.fillStyle = '#f4d28a';
        ctx.beginPath(); ctx.arc(x + 22, y + 10, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4d28a22';
        ctx.beginPath(); ctx.arc(x + 22, y + 10, 17, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 住宅区路边树
    for (const b of BLOCKS) {
      if (b.style !== 'park' && !(b.style === 'apartment' && b.x < 1536)) continue;
      if (!inView(b.x, b.y, 80)) continue;
      for (let i = 0; i < 3; i++) {
        const tx = b.x + 18 + (i * 83) % Math.max(20, b.w - 20);
        const ty = b.y + b.h + 20;
        ctx.fillStyle = '#2c4332';
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5f875d';
        ctx.beginPath(); ctx.arc(tx - 2, ty - 3, 10, 0, Math.PI * 2); ctx.fill();
      }
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
    ctx.beginPath(); ctx.ellipse(0, 1, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (type === 'goose') {
      ctx.fillStyle = '#eee8d6';
      ctx.fillRect(-10, -20, 19, 15);
      ctx.fillRect(5, -30, 7, 15);
      ctx.fillStyle = '#eeb768';
      ctx.fillRect(12, -26, 9, 4);
      ctx.fillRect(-7, -5, 4, 7);
      ctx.fillRect(4, -5, 4, 7);
    } else {
      const angle = p.id === self() ? aim() : p.heading || 0;
      const face = Math.abs(Math.cos(angle)) > .65 ? Math.cos(angle) > 0 ? 'right' : 'left' : Math.sin(angle) > 0 ? 'down' : 'up';
      ctx.globalAlpha = p.hp <= 0 ? .3 : p.connected === false ? .5 : 1;
      ctx.drawImage(rigImage(avatars().get(p.userId), p.color || ({police: '#728fb4', civilian: '#ad946c', zombie: '#5e7d62'}[type]), face, old.phase, moved > .12 ? 1 : 0), -18, -47, 36, 50);
      if (type === 'police') { ctx.fillStyle = '#1f3d6f'; ctx.fillRect(-7, -44, 14, 5); }
      if (type === 'zombie') { ctx.fillStyle = '#8cbb73'; ctx.fillRect(-6, -39, 12, 9); }
    }
    if (p.id === self()) {
      ctx.strokeStyle = '#f5d889';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 2, 18, 7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.shield) {
      ctx.strokeStyle = '#8ae0e6aa';
      ctx.beginPath(); ctx.ellipse(0, -20, 22, 32, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.hp < 100 || type === 'zombie') {
      ctx.fillStyle = '#17202a';
      ctx.fillRect(-17, -55, 34, 4);
      ctx.fillStyle = p.hp > 35 ? '#7ed6ad' : '#f08776';
      ctx.fillRect(-16, -54, 32 * Math.min(100, p.hp) / 100, 2);
    }
    if (type === 'player') label((p.wanted ? '★'.repeat(p.wanted) + ' ' : '') + p.name, 0, -61, p.id === self() ? '#f6dc91' : '#eee9db');
    if (p.id === self() && p.hp > 0 && !p.car) {
      const gun = state()?.self.gun;
      if (gun && gun !== 'fists') {
        ctx.rotate(aim());
        ctx.fillStyle = gun === 'knife' ? '#ece6cc' : '#c9b69b';
        ctx.fillRect(6, -19, gun === 'rifle' ? 28 : 17, 5);
      }
    }
    ctx.restore();
    const bubble = type === 'player' ? speech(p.id) : type === 'civilian' && ((Math.floor(now / 5000) + Number(p.id.slice(1))) % 7 === 0) ? {text: BARKS[p.bark], at: now - 500} : null;
    if (bubble && now - bubble.at < 4500) label(bubble.text.length > 28 ? bubble.text.slice(0, 28) + '…' : bubble.text, x, y - 86, '#d8e8dc');
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
    const angle = aim(), range = wallRange(me, angle, gun.range, obstacles);
    ctx.save();
    ctx.setLineDash([9, 12]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#f5dfa34d';
    ctx.beginPath();
    ctx.moveTo(me.x, me.y);
    ctx.lineTo(me.x + Math.cos(angle) * range, me.y + Math.sin(angle) * range);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f5dfa366';
    ctx.beginPath();
    ctx.arc(me.x + Math.cos(angle) * range, me.y + Math.sin(angle) * range, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEffects(me, now, s) {
    for (const e of s.effects) {
      const localAt = s.fxAt?.get(e.id);
      const age = (now - (localAt ?? (s.snapshotAt ?? now))) / 1000;
      if (e.kind === 'shot') {
        if (age > .29) continue;
        const a = Math.max(0, 1 - age / .29);
        const sx = e.x, sy = e.y - 17;
        const ex = e.x + Math.cos(e.angle) * e.range, ey = e.y + Math.sin(e.angle) * e.range - 17;
        const head = Math.min(1, age / .055);
        const hx = sx + (ex - sx) * head, hy = sy + (ey - sy) * head;
        ctx.save();
        ctx.strokeStyle = `rgba(255,230,164,${a * .18})`;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = `rgba(255,246,214,${a * .9})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = `rgba(255,250,225,${a})`;
        ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, Math.PI * 2); ctx.fill();
        if (age < .075) {
          ctx.fillStyle = `rgba(255,214,120,${(1 - age / .075) * .9})`;
          ctx.beginPath(); ctx.arc(sx, sy, 9 - age * 50, 0, Math.PI * 2); ctx.fill();
        }
        if (age < .18) {
          ctx.strokeStyle = e.hit ? `rgba(255,155,105,${1 - age / .18})` : `rgba(220,210,175,${1 - age / .18})`;
          ctx.lineWidth = 2;
          for (let k = 0; k < 4; k++) {
            const a2 = k * Math.PI / 2 + .4;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + Math.cos(a2) * (e.hit ? 11 : 6), ey + Math.sin(a2) * (e.hit ? 11 : 6));
            ctx.stroke();
          }
        }
        ctx.restore();
        if (e.hit && Math.hypot(e.x - me.x, e.y - me.y) < 70) hitAt = now;
        continue;
      }
      if (e.kind === 'swing') {
        if (age > .2) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / .2);
        ctx.strokeStyle = e.hit ? '#ff967c' : '#f4d9a2';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, 35, e.angle - .7, e.angle + .7); ctx.stroke();
        ctx.restore();
        continue;
      }
      if (e.kind === 'explosion') {
        if (age > .55) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / .55);
        ctx.fillStyle = '#ff9a5b55';
        ctx.beginPath(); ctx.arc(e.x, e.y, 20 + age * 150, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffb47a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 20 + age * 150, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        continue;
      }
      if (age > .35) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / .35);
      ctx.strokeStyle = '#f4d9a2';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 10 + age * 50, 0, Math.PI * 2); ctx.stroke();
      if (e.kind === 'dice' && e.text) label('骰子 ' + e.text, e.x, e.y - 28, '#ffe2a6');
      ctx.restore();
    }
  }

  function crosshair(me, s, now) {
    const ptr = pointer();
    if (!ptr?.inside || !s || s.self.car || s.self.hp <= 0 || s.self.escaped) return;
    const rect = canvas.getBoundingClientRect();
    const x = ptr.clientX - rect.left, y = ptr.clientY - rect.top;
    const gun = GUNS[s.self.gun];
    const bloom = firing() ? 8 : 4;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    for (const [stroke, width] of [['rgba(10,18,24,.75)', 4], ['rgba(246,233,194,.95)', 1.5]]) {
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
    if (match !== s.id) { match = s.id; timeline.clear(); poses.clear(); snapshotKey = ''; hitAt = 0; }
    if (key !== snapshotKey) {
      snapshotKey = key;
      const at = s.snapshotAt ?? now, ids = new Set();
      for (const p of s.players) { ids.add('p:' + p.id); timeline.update('p:' + p.id, p, at, (p.hp > 0) + ':' + p.car + ':' + p.escaped); }
      for (const n of s.npcs) { ids.add('n:' + n[0]); timeline.update('n:' + n[0], {x: n[2], y: n[3], heading: n[5]}, at, n[1]); }
      for (const c of s.cars) { ids.add('c:' + c[0]); timeline.update('c:' + c[0], {x: c[1], y: c[2], heading: c[3]}, at, c[6]); }
      timeline.prune(ids);
    }
    const me = s.self, z = w < 600 ? .83 : 1, margin = 160;
    const viewW = w / z, viewH = h / z;
    view = {z, x: Math.max(-margin, Math.min(Math.max(-margin, CITY.width - viewW + margin), me.x - viewW / 2)), y: Math.max(-margin, Math.min(Math.max(-margin, CITY.height - viewH + margin), me.y - viewH / 2))};
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.scale(z, z);
    ctx.translate(-view.x, -view.y);
    ctx.imageSmoothingEnabled = false;
    drawGround();
    drawRoads();
    for (const b of BLOCKS) {
      if (b.x + b.w < view.x - 30 || b.y + b.h < view.y - 30 || b.x > view.x + w / z + 30 || b.y > view.y + h / view.z + 30) continue;
      drawBlock(b);
    }
    drawProps(me, now);
    for (const p of PLACES) {
      if (p.x < view.x - 60 || p.y < view.y - 60 || p.x > view.x + w / z + 60 || p.y > view.y + h / z + 60) continue;
      const color = colors[p.kind], radius = p.kind === 'escape' ? 23 : 21;
      ctx.fillStyle = color + '16';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'escape' ? 48 : 34, 0, Math.PI * 2); ctx.fill();
      drawPlaceIcon(ctx, p.kind, p.x, p.y, radius, color);
      label(p.name, p.x, p.y - 34, color, 11);
      if (p.kind === 'casino') {
        const pulse = .35 + .25 * Math.sin(now / 430);
        ctx.strokeStyle = `rgba(240,124,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 38 + Math.sin(now / 300) * 3, 0, Math.PI * 2); ctx.stroke();
        label('CASINO · 好运', p.x, p.y - 52, '#f6b4ff', 12);
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
    }
    for (const [, kind, x, y, value] of s.loot) {
      ctx.fillStyle = kind === 'cash' ? '#82d0a1' : Object.hasOwn(GUNS, kind) ? '#edb08c' : '#b69ad9';
      ctx.fillRect(x - 7, y - 8, 14, 13);
      ctx.fillStyle = '#f6f0d6';
      ctx.fillRect(x - 2, y - 8, 3, 13);
      if (Math.hypot(x - me.x, y - me.y) < 80) label(kind === 'cash' ? '¥' + value : GUNS[kind]?.name || GOODS[kind]?.name || kind, x, y - 18);
    }
    for (const [, kind, x, y] of s.objects) {
      ctx.fillStyle = {banana: '#f4db69', barricade: '#e6a574', decoy: '#cab8df', perfume: '#94ccad'}[kind] || '#c9c0a8';
      ctx.fillRect(x - 18, y - 15, 36, 25);
      if (kind === 'barricade') { ctx.fillStyle = '#493e40'; ctx.fillRect(x - 16, y - 9, 32, 6); }
    }
    drawAim(me, s);
    for (const car of s.cars) {
      const [id, cx, cy, ch, hp, owner, driver, kind] = car;
      const {x, y, heading} = driver === self() ? {x: cx, y: cy, heading: ch} : timeline.sample('c:' + id, now) || {x: cx, y: cy, heading: ch};
      ctx.save();
      ctx.translate(x, y);
      drawCar(ctx, {heading, color: hp <= 0 ? '#4b4e53' : kind === 'van' ? '#c8a36c' : owner === self() ? '#72bda5' : '#8498b7'});
      ctx.restore();
      if (Math.hypot(x - me.x, y - me.y) < 110) label(hp <= 0 ? '报废' : owner === self() ? '你的车' : driver ? '有人驾驶' : '按住E抢车', x, y - 39, hp <= 0 ? '#bca9a2' : '#d9e4e5');
    }
    const people = s.players.map(p => p.id === self() ? {...p, x: me.x, y: me.y} : {...p, ...timeline.sample('p:' + p.id, now)});
    for (const p of people) if (!p.car) person(p, now);
    for (const n of s.npcs) person({id: n[0], x: n[2], y: n[3], hp: n[4], heading: n[5], bark: n[6], ...timeline.sample('n:' + n[0], now)}, now, n[1]);
    for (const [, x, y, at] of s.bombs) {
      ctx.fillStyle = '#f6795d30';
      ctx.strokeStyle = '#ff9c74';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 80, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      label(Math.max(0, at - s.time).toFixed(1), x, y, '#ffb99c');
    }
    drawEffects(me, now, s);
    if (s.event?.kind === 'blackout') {
      const gradient = ctx.createRadialGradient(me.x, me.y, 80, me.x, me.y, 480);
      gradient.addColorStop(0, '#050b1200');
      gradient.addColorStop(1, '#050b12ed');
      ctx.fillStyle = gradient;
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
      c.fillStyle = '#1c4a5a';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = '#1b2530';
      c.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
      for (const z of ZONES) {
        c.fillStyle = z.tint;
        c.fillRect(z.x * sx, z.y * sy, z.w * sx, z.h * sy);
        c.font = `bold ${Math.max(7, Math.round(canvas.width / 90))}px system-ui`;
        c.textAlign = 'center';
        c.fillStyle = z.edge + '88';
        c.fillText(z.name, (z.x + z.w / 2) * sx, (z.y + z.h / 2) * sy);
      }
      c.strokeStyle = '#0d151c';
      c.lineWidth = 2;
      c.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      for (const b of BLOCKS) {
        c.fillStyle = b.solid === false ? (b.style === 'park' ? '#4d704f' : '#5d6670') : (b.color || '#71808a');
        c.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
      }
      const iconSize = canvas.width > 300 ? 9 : 5;
      c.font = 'bold 9px system-ui';
      for (const p of PLACES) {
        const tx = p.x * sx, ty = p.y * sy;
        drawPlaceIcon(c, p.kind, tx, ty, iconSize, colors[p.kind]);
        if (canvas.width > 300) {
          const right = tx > canvas.width - 40;
          c.textAlign = right ? 'right' : 'left';
          c.fillStyle = colors[p.kind];
          c.fillText(signs[p.kind], right ? tx - iconSize - 5 : tx + iconSize + 5, ty + 3);
        }
      }
      if (s) {
        for (const q of s.map || []) {
          c.fillStyle = '#b9c7d0';
          c.fillRect(q[1] * sx - 2, q[2] * sy - 2, 4, 4);
        }
        c.fillStyle = '#ffe4a0';
        c.beginPath(); c.arc(s.self.x * sx, s.self.y * sy, 4, 0, Math.PI * 2); c.fill();
        if (s.event) {
          c.strokeStyle = '#f4896f';
          c.strokeRect(s.event.x * sx - 12, s.event.y * sy - 12, 24, 24);
        }
      }
    }
  };
}
