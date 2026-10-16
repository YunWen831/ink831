// Shared movement and collision rules for the browser and authoritative server.
export const WORLD = Object.freeze({ width: 960, height: 640, speed: 156, radius: 10, stepMs: 20 });
export const COLORS = ['#cf7459', '#5c9d91', '#a08dbd', '#d4ae58', '#709bbb', '#b47a9c', '#8caa68', '#a3907b'];
export const OBSTACLES = [
  { x: 125, y: 115, w: 112, h: 88, kind: 'house' },
  { x: 729, y: 110, w: 99, h: 90, kind: 'house' },
  { x: 425, y: 276, w: 110, h: 73, kind: 'fountain' },
  { x: 158, y: 450, w: 81, h: 34, kind: 'garden' },
  { x: 728, y: 448, w: 80, h: 34, kind: 'garden' },
  { x: 82, y: 290, w: 48, h: 24, kind: 'tree' },
  { x: 826, y: 290, w: 48, h: 24, kind: 'tree' },
];
export function canStand(x, y) {
  const r = WORLD.radius;
  return Number.isFinite(x) && Number.isFinite(y) && x >= 48 + r && y >= 55 + r &&
    x <= WORLD.width - 48 - r && y <= WORLD.height - 48 - r &&
    !OBSTACLES.some(o => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
}
export function move(position, dx, dy) {
  const norm = Math.max(1, Math.hypot(dx, dy));
  const distance = WORLD.speed * WORLD.stepMs / 1000;
  let { x, y } = position;
  const nx = x + dx / norm * distance;
  const ny = y + dy / norm * distance;
  if (canStand(nx, y)) x = nx;
  if (canStand(x, ny)) y = ny;
  return { x, y };
}
export function spawn(index) {
  return { x: 390 + (index % 4) * 60, y: 414 + Math.floor(index / 4) * 46 };
}
