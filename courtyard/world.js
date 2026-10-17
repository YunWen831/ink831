// Shared movement and collision rules for the browser and authoritative server.
export const WORLD = Object.freeze({ width: 4096, height: 3072, speed: 208, radius: 10, stepMs: 20 });
export const TILE_SIZE = 32;
export const BUILD_REACH = 160;
export const MAX_TILES = WORLD.width / TILE_SIZE * (WORLD.height / TILE_SIZE);
export const PARTY = Object.freeze({ min: 2, max: 4 });
export const FACILITIES = [
  { id: 'party', name: '小游戏派对', x: 283, y: 229, hint: '2～4 人，五轮轻松派对' },
  { id: 'art', name: '方块画室', x: 480, y: 660, hint: '画一块材料，留在大家的庭院里' },
];
export const tileKey = (col, row) => `${col},${row}`;
export function isBuildCell(col, row) {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 &&
    col < WORLD.width / TILE_SIZE && row < WORLD.height / TILE_SIZE;
}
export function overlapsTile(x, y, col, row) {
  const r = WORLD.radius;
  return x + r > col * TILE_SIZE && x - r < (col + 1) * TILE_SIZE &&
    y + r > row * TILE_SIZE && y - r < (row + 1) * TILE_SIZE;
}
export const COLORS = ['#cf7459', '#5c9d91', '#a08dbd', '#d4ae58', '#709bbb', '#b47a9c', '#8caa68', '#a3907b'];
export function canStand(x, y, tiles) {
  const r = WORLD.radius;
  return Number.isFinite(x) && Number.isFinite(y) && x >= r && y >= r &&
    x <= WORLD.width - r && y <= WORLD.height - r &&
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
export function spawn(index, tiles) {
  const point = { x: [480,440,520,400,560,600][index % 6], y: 414 + (Math.floor(index / 6) % 4) * 38 };
  if (canStand(point.x, point.y, tiles)) return point;
  // Building is allowed at spawn too. Find free ground without deleting a work.
  const col = Math.floor(point.x / TILE_SIZE), row = Math.floor(point.y / TILE_SIZE);
  for (let radius=1;radius<=Math.max(WORLD.width,WORLD.height)/TILE_SIZE;radius++) {
    for (let y=row-radius;y<=row+radius;y++) for (let x=col-radius;x<=col+radius;x++) {
      if (Math.abs(x-col)!==radius&&Math.abs(y-row)!==radius) continue;
      const candidate={x:(x+.5)*TILE_SIZE,y:(y+.5)*TILE_SIZE};
      if (isBuildCell(x,y)&&canStand(candidate.x,candidate.y,tiles)) return candidate;
    }
  }
  return point;
}
