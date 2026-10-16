// Shared movement and collision rules for the browser and authoritative server.
export const WORLD = Object.freeze({ width: 960, height: 960, speed: 156, radius: 10, stepMs: 20 });
export const TILE_SIZE = 32;
export const BUILD_REACH = 112;
export const FACILITIES = [
  { id: 'parkour', name: '跑酷工坊', x: 283, y: 229, hint: '找朋友，准备下一场跑酷' },
  { id: 'dungeon', name: '地牢邮局', x: 678, y: 235, hint: '寄给朋友的冒险，从这里开始' },
  { id: 'art', name: '方块画室', x: 480, y: 660, hint: '画一块材料，留在大家的庭院里' },
];
export const tileKey = (col, row) => `${col},${row}`;
export function isBuildCell(col, row) {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 2 && col <= 27 &&
    row >= 20 && row <= 26 && (col < 13 || col > 16);
}
export function overlapsTile(x, y, col, row) {
  const r = WORLD.radius;
  return x + r > col * TILE_SIZE && x - r < (col + 1) * TILE_SIZE &&
    y + r > row * TILE_SIZE && y - r < (row + 1) * TILE_SIZE;
}
export const COLORS = ['#cf7459', '#5c9d91', '#a08dbd', '#d4ae58', '#709bbb', '#b47a9c', '#8caa68', '#a3907b'];
export const OBSTACLES = [
  { x: 125, y: 115, w: 112, h: 88, kind: 'house' },
  { x: 729, y: 110, w: 99, h: 90, kind: 'house' },
  { x: 425, y: 276, w: 110, h: 73, kind: 'fountain' },
  { x: 158, y: 450, w: 81, h: 34, kind: 'garden' },
  { x: 728, y: 448, w: 80, h: 34, kind: 'garden' },
  { x: 82, y: 290, w: 48, h: 24, kind: 'tree' },
  { x: 826, y: 290, w: 48, h: 24, kind: 'tree' },
  { x: 0, y: 596, w: 432, h: 44, kind: 'water' },
  { x: 528, y: 596, w: 432, h: 44, kind: 'water' },
];
export function canStand(x, y, tiles) {
  const r = WORLD.radius;
  return Number.isFinite(x) && Number.isFinite(y) && x >= 48 + r && y >= 55 + r &&
    x <= WORLD.width - 48 - r && y <= WORLD.height - 48 - r &&
    !OBSTACLES.some(o => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h) &&
    ![tileKey(Math.floor((x-r)/TILE_SIZE),Math.floor((y-r)/TILE_SIZE)),tileKey(Math.floor((x+r)/TILE_SIZE),Math.floor((y-r)/TILE_SIZE)),tileKey(Math.floor((x-r)/TILE_SIZE),Math.floor((y+r)/TILE_SIZE)),tileKey(Math.floor((x+r)/TILE_SIZE),Math.floor((y+r)/TILE_SIZE))].some(key=>{const tile=tiles?.get(key);return tile?.solid&&overlapsTile(x,y,tile.col,tile.row);});
}
export function move(position, dx, dy, tiles) {
  const norm = Math.max(1, Math.hypot(dx, dy));
  const distance = WORLD.speed * WORLD.stepMs / 1000;
  let { x, y } = position;
  const nx = x + dx / norm * distance;
  const ny = y + dy / norm * distance;
  if (canStand(nx, y, tiles)) x = nx;
  if (canStand(x, ny, tiles)) y = ny;
  return { x, y };
}
export function spawn(index) {
  return { x: [480,440,520,400,560,600][index % 6], y: 414 + (Math.floor(index / 6) % 4) * 38 };
}
