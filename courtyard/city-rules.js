export const CITY = {
  width: 4096,
  height: 3072,
  capacity: 8,
  goal: 5000,
  step: .05,
  view: 1300,
  npcLimit: 40,
  carLimit: 18,
  lootLimit: 100
};

// 步行/冲刺速度。服务端模拟与客户端预测共用。
export const SPEED = { walk: 190, sprint: 300 };
// 角色/车辆的碰撞半径。角色贴图约 36px 宽，用 18 避免贴脸穿墙。
export const BODY_RADIUS = 18;
export const CAR_RADIUS = 24;

export const GUNS = {
  fists: { name: '拳头', price: 0, damage: 12, range: 43, interval: .5, mag: 0, reload: 0 },
  knife: { name: '折叠刀', price: 180, damage: 30, range: 56, interval: .5, mag: 0, reload: 0 },
  pistol: { name: '手枪', price: 650, damage: 22, range: 610, interval: .36, mag: 8, reload: 1.2 },
  rifle: { name: '步枪', price: 1600, damage: 14, range: 850, interval: .15, mag: 24, reload: 1.8 }
};

export const GOODS = {
  medkit: { name: '急救包', price: 120, description: '恢复45生命' },
  ammo: { name: '弹药盒', price: 120, description: '当前枪械补充32发备用弹' },
  vest: { name: '防弹背心', price: 300, description: '补充60护甲' },
  banana: { name: '香蕉皮', price: 90, description: '脚下布置，踩中打滑' },
  decoy: { name: '充气替身', price: 160, description: '吸引附近警察和僵尸' },
  perfume: { name: '僵尸香水', price: 140, description: '让僵尸聚集到投掷位置' },
  blink: { name: '瞬移马桶', price: 260, description: '沿瞄准方向传送到可落脚地面' },
  barricade: { name: '便携路障', price: 100, description: '临时封路，可被打坏' },
  repair: { name: '维修工具', price: 130, description: '修复身边载具' },
  bribe: { name: '可疑信封', price: 300, description: '降低两级通缉' }
};

export const EVENTS = {
  bombs: { name: '炸弹雨', hint: '红圈落弹前有预警，离开爆炸范围', seconds: 40 },
  zombies: { name: '僵尸入侵', hint: '击败僵尸可领80奖金，小心枪声引来更多', seconds: 50 },
  blackout: { name: '全城停电', hint: '视野变暗，开车时注意路障', seconds: 40 },
  cash: { name: '运钞车翻了', hint: '地图标记处散落现金，所有人都能捡', seconds: 40 },
  sale: { name: '疯狂促销', hint: '所有商店与车行限时七折', seconds: 45 },
  geese: { name: '大鹅接管街道', hint: '暴躁大鹅追人，车辆也拦不住它们的脾气', seconds: 35 }
};

const STYLE = {
  office: { colors: ['#687d93', '#768ba0', '#5c7085'], window: '#b9cbd4', roof: '#3e4f5e', accent: '#d7c58b', floors: [3, 6] },
  shop: { colors: ['#c58a78', '#d39b7e', '#b7796b'], window: '#f1d6b8', roof: '#70483f', accent: '#f2cf8f', floors: [1, 2] },
  apartment: { colors: ['#8d7e9c', '#9c8eaa', '#7c6f8b'], window: '#d2c5df', roof: '#4f445d', accent: '#e2b3a1', floors: [3, 7] },
  warehouse: { colors: ['#8b8e78', '#999d86', '#787b66'], window: '#c9cfb4', roof: '#505442', accent: '#d0a76a', floors: [1, 2] },
  hotel: { colors: ['#7f9c99', '#90aaa6', '#6f8b88'], window: '#cbe5df', roof: '#3d5554', accent: '#e5c47e', floors: [4, 8] },
  hospital: { colors: ['#a6b4bc', '#b6c3ca', '#95a5ae'], window: '#e0edf0', roof: '#516670', accent: '#d47d78', floors: [3, 5] },
  construction: { colors: ['#a39a86', '#b0a793', '#918875'], window: '#d3c8ac', roof: '#675e4e', accent: '#e2a15d', floors: [1, 1] }
};
const STYLE_KEYS = Object.keys(STYLE);
const BUILDING_NAMES = ['云端公寓', '旧城旅店', '蓝鲸写字楼', '南风仓库', '夜班便利店', '第七医院', '好运旅馆', '纸箱批发', '无名剧院', '转角书店', '金鱼公寓', '冷却塔'];
const LOT_W = 290, LOT_H = 300;

const hash = (a, b) => {
  let n = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

export const BLOCKS = [];
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 8; col++) {
    const lotX = col * 512, lotY = row * 560;
    const x = lotX + 105, y = lotY + 110;
    const roll = hash(col, row);
    // 第一块保持完整实心，服务端测试和玩家出生点都依赖这块墙。
    if (row === 0 && col === 0) {
      BLOCKS.push({ id: 'b0-0', x, y, w: 290, h: 300, color: STYLE.office.colors[0], window: STYLE.office.window, roof: STYLE.office.roof, accent: STYLE.office.accent, style: 'office', floors: 5, label: '蓝鲸写字楼', solid: true });
      continue;
    }
    // 公园、停车场、广场：不参与碰撞，给城市留出呼吸的地方。
    if (roll < .12 || (roll > .12 && roll < .20 && (col + row) % 2)) {
      const kind = roll < .07 ? 'park' : roll < .14 ? 'parking' : 'plaza';
      BLOCKS.push({ id: `b${col}-${row}`, x, y, w: LOT_W, h: LOT_H, color: kind === 'park' ? '#6c8d68' : kind === 'parking' ? '#5d6670' : '#8a877d', style: kind, solid: false });
      continue;
    }
    const styleKey = STYLE_KEYS[Math.floor(hash(col + 3, row + 7) * STYLE_KEYS.length)];
    const style = STYLE[styleKey];
    const w = styleKey === 'warehouse' ? 250 + Math.floor(hash(col + 9, row) * 40) : 215 + Math.floor(hash(col + 5, row + 2) * 75);
    const h = styleKey === 'warehouse' ? 215 + Math.floor(hash(col + 11, row + 4) * 40) : 170 + Math.floor(hash(col + 7, row + 8) * 110);
    const bx = x + Math.floor((LOT_W - w) / 2);
    const by = y + Math.floor((LOT_H - h) / 2);
    const floors = style.floors[0] + Math.floor(hash(col + 17, row + 13) * (style.floors[1] - style.floors[0] + 1));
    const color = style.colors[Math.floor(hash(col + 19, row + 23) * style.colors.length)];
    const label = hash(col + 29, row + 31) > .62 ? BUILDING_NAMES[Math.floor(hash(col + 31, row + 37) * BUILDING_NAMES.length)] : '';
    BLOCKS.push({
      id: `b${col}-${row}`, x: bx, y: by, w, h,
      color, window: style.window, roof: style.roof, accent: style.accent,
      style: styleKey, floors, label, solid: true
    });
  }
}

export const PLACES = [
  { id: 'job-west', kind: 'job', name: '西区快递站', x: 80, y: 80 },
  { id: 'job-east', kind: 'job', name: '东区打工站', x: 2640, y: 1760 },
  { id: 'job-north', kind: 'job', name: '北环配送站', x: 1800, y: 80 },
  { id: 'job-south', kind: 'job', name: '南站仓库', x: 2000, y: 2820 },
  { id: 'arms', kind: 'arms', name: '铁皮武器店', x: 530, y: 80 },
  { id: 'arms-east', kind: 'arms', name: '东区军品店', x: 2580, y: 1200 },
  { id: 'arms-south', kind: 'arms', name: '南区靶场', x: 1600, y: 2820 },
  { id: 'market', kind: 'market', name: '怪东西商店', x: 1555, y: 80 },
  { id: 'market-south', kind: 'market', name: '深夜杂货铺', x: 1050, y: 1760 },
  { id: 'market-north', kind: 'market', name: '北环夜市', x: 2750, y: 80 },
  { id: 'market-east', kind: 'market', name: '码头杂货', x: 4000, y: 1000 },
  { id: 'bank-west', kind: 'bank', name: '不太安全银行', x: 80, y: 640 },
  { id: 'bank-east', kind: 'bank', name: '发财银行', x: 2100, y: 1760 },
  { id: 'bank-north', kind: 'bank', name: '北环储蓄所', x: 1000, y: 80 },
  { id: 'bank-south', kind: 'bank', name: '南站金库', x: 1000, y: 2820 },
  { id: 'casino', kind: 'casino', name: '好运骰子厅', x: 1060, y: 640 },
  { id: 'casino-south', kind: 'casino', name: '赛鹅俱乐部', x: 1570, y: 1760 },
  { id: 'casino-east', kind: 'casino', name: '东岸赌场', x: 4000, y: 1680 },
  { id: 'garage', kind: 'garage', name: '二手车行', x: 2070, y: 80 },
  { id: 'garage-south', kind: 'garage', name: '南区车行', x: 80, y: 1760 },
  { id: 'garage-north', kind: 'garage', name: '北环车行', x: 3400, y: 80 },
  { id: 'garage-east', kind: 'garage', name: '东岸车行', x: 4000, y: 560 },
  { id: 'escape-west', kind: 'escape', name: '渡轮撤离点', x: 70, y: 2180 },
  { id: 'escape-east', kind: 'escape', name: '直升机撤离点', x: 2990, y: 80 },
  { id: 'escape-south', kind: 'escape', name: '长途车站', x: 2600, y: 2180 },
  { id: 'escape-north', kind: 'escape', name: '北环直升机坪', x: 4000, y: 80 },
  { id: 'escape-east2', kind: 'escape', name: '东岸码头', x: 4000, y: 2900 }
];

// 城市分区：只影响客户端地面/道具/招牌，服务端仍用同一份坐标。
export const ZONES = [
  { id: 'residential', name: '旧城区', x: 0, y: 0, w: 1536, h: 1120, tint: '#2f4a3c', edge: '#5d8a68' },
  { id: 'finance', name: '金融街', x: 1536, y: 0, w: 1024, h: 1120, tint: '#2d3c50', edge: '#7b95b8' },
  { id: 'commercial', name: '中央商业区', x: 0, y: 1120, w: 1536, h: 1120, tint: '#4a3c32', edge: '#d0a06a' },
  { id: 'entertainment', name: '霓虹娱乐区', x: 2560, y: 1120, w: 1536, h: 1120, tint: '#3c2f4a', edge: '#d07be8' },
  { id: 'industrial', name: '南港工业区', x: 0, y: 2240, w: 4096, h: 832, tint: '#33383a', edge: '#9aa28f' }
];

export const BARKS = ['这路灯是不是在盯着我？', '我只想准点下班！', '你见过会开车的鹅吗？', '隔壁银行又响了。', '今天的外卖有点烫手。', '别抢我，我工资还没发！'];

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function free(x, y, r = 12, obstacles = []) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= r && y >= r && x <= CITY.width - r && y <= CITY.height - r &&
    !BLOCKS.some(b => b.solid !== false && x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) &&
    !obstacles.some(b => b.kind === 'barricade' && b.hp > 0 && Math.abs(x - b.x) < r + 18 && Math.abs(y - b.y) < r + 18);
}

export function cityMove(p, dx, dy, obstacles = [], radius = BODY_RADIUS) {
  let { x, y } = p;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < steps; i++) {
    if (free(x + dx / steps, y, radius, obstacles)) x += dx / steps;
    if (free(x, y + dy / steps, radius, obstacles)) y += dy / steps;
  }
  return { x, y };
}

export function cityDrive(car, input, dt, obstacles = []) {
  let { heading, speed } = car;
  const power = Math.min(1, Math.hypot(input.x, input.y));
  if (power > .1) {
    const desired = Math.atan2(input.y, input.x), diff = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
    heading += clamp(diff, -3.5 * dt, 3.5 * dt);
    speed = Math.min(580 * power, speed + 420 * dt);
  } else speed = Math.max(0, speed - 700 * dt);
  const next = cityMove(car, Math.cos(heading) * speed * dt, Math.sin(heading) * speed * dt, obstacles, CAR_RADIUS);
  const crash = dist(next, car) < speed * dt * .4 && speed > 150;
  return { ...next, heading, speed: crash ? speed * .2 : speed, impact: crash ? speed * .025 : 0 };
}

export function wallRange(p, angle, range, obstacles = []) {
  for (let d = 0; d <= range; d += 6) if (!free(p.x + Math.cos(angle) * d, p.y + Math.sin(angle) * d, 1, obstacles)) return d;
  return range;
}

export function circleHit(p, angle, t, r = 15) {
  const dx = t.x - p.x, dy = t.y - p.y;
  const a = dx * Math.cos(angle) + dy * Math.sin(angle), side = dx * dx + dy * dy - a * a;
  return a < 0 || side > r * r ? Infinity : Math.max(0, a - Math.sqrt(Math.max(0, r * r - side)));
}

export function nearPlace(p, kind, range = 95) {
  return PLACES.filter(q => (!kind || q.kind === kind) && dist(p, q) < range).sort((a, b) => dist(p, a) - dist(p, b))[0];
}
