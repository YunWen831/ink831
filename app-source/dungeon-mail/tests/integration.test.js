import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { Client } from '@colyseus/sdk';
import { canStand, move, WORLD } from '../../../courtyard/world.js';

const endpoint = process.env.TEST_ENDPOINT || 'http://127.0.0.1:2570';
const rooms = [];
let child;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (check()) return; await delay(50); }
  throw new Error('Condition timed out');
}
async function join(kind, id, name) {
  const client = new Client(endpoint);
  const room = kind === 'create' ? await client.create('courtyard', { name }) : await client.joinById(id, { name });
  room.onMessage('emote', () => {}); room.onMessage('pong', () => {});
  room.reconnection.minUptime = 0;
  rooms.push(room);
  await until(() => room.state?.players?.has(room.sessionId));
  return room;
}
before(async () => {
  if (!process.env.TEST_ENDPOINT) {
    child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '2570' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', () => {}); child.stderr.on('data', chunk => process.stderr.write(chunk));
  }
  for (let i = 0; i < 100; i++) {
    try { const health = await fetch(endpoint + '/health'); if ((await health.json()).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Test server did not start');
});
after(async () => {
  await Promise.all(rooms.filter(room => room.connection.isOpen).map(room => room.leave().catch(() => {})));
  if (child) { child.kill('SIGTERM'); await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)]); }
});

test('room creation, peer state, isolation, authoritative movement, emotes and reconnection', async () => {
  const a = await join('create', null, '甲');
  assert.match(a.roomId, /^[A-HJ-NP-Z2-9]{6}$/);
  const b = await join('join', a.roomId, '乙');
  const c = await join('create', null, '另一间');
  await until(() => a.state.players.size === 2 && b.state.players.size === 2);
  assert.equal(c.state.players.size, 1);
  assert.equal(c.state.players.has(a.sessionId), false);
  assert.equal(a.state.players.get(b.sessionId).name, '乙');

  const oldX = a.state.players.get(a.sessionId).x;
  a.send('input', { steps: [{ seq: 1, dx: 1, dy: 0 }, { seq: 2, dx: 1, dy: 0 }] });
  await until(() => b.state.players.get(a.sessionId)?.ack === 2);
  assert.ok(b.state.players.get(a.sessionId).x > oldX);
  a.send('input', { steps: [{ seq: 3, dx: 1e9, dy: 0 }] });
  await delay(120);
  assert.equal(b.state.players.get(a.sessionId).ack, 2);
  assert.ok(canStand(b.state.players.get(a.sessionId).x, b.state.players.get(a.sessionId).y));

  let inRoom = false, otherRoom = false;
  b.onMessage('emote', data => { inRoom = data.id === a.sessionId; });
  c.onMessage('emote', () => { otherRoom = true; });
  a.send('emote'); await until(() => inRoom); await delay(100); assert.equal(otherRoom, false);

  let reconnectCount = 0;
  a.onReconnect(() => { reconnectCount++; });
  const session = a.sessionId;
  a.connection.close(4010, 'test connection interruption');
  await until(() => reconnectCount === 1, 12000);
  await until(() => b.state.players.get(session)?.connected === true);
  assert.equal(a.sessionId, session);
  assert.equal(a.state.players.size, 2);
  assert.equal(b.state.players.get(session).ack, 2);

  const token = b.reconnectionToken;
  b.reconnection.enabled = false;
  b.connection.close(4010, 'test page reload');
  await until(() => a.state.players.get(b.sessionId)?.connected === false);
  const recovered = await new Client(endpoint).reconnect(token);
  recovered.onMessage('emote', () => {}); recovered.onMessage('pong', () => {}); rooms.push(recovered);
  await until(() => recovered.state?.players?.has(b.sessionId));
  assert.equal(recovered.sessionId, b.sessionId);
  await recovered.leave();
  await until(() => a.state.players.size === 1);
});

test('HTTP rejects other browser origins and incorrect room IDs fail', async () => {
  const response = await fetch(endpoint + '/health', { headers: { Origin: 'https://unrelated.example' } });
  assert.equal(response.status, 403);
  const create = await fetch(endpoint + '/matchmake/create/courtyard', {
    method: 'POST', headers: { Origin: 'https://unrelated.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'not allowed' }),
  });
  assert.equal(create.status, 403);
  const client = new Client(endpoint);
  await assert.rejects(client.joinById('ZZZZZZ', { name: '不存在' }));
});

test('world collision rejects crossing walls and movement is normalized', () => {
  assert.equal(canStand(-100, 200), false);
  assert.equal(canStand(180, 160), false);
  assert.ok(WORLD.stepMs > 0);
  const start = { x: 400, y: 420 };
  const straight = move(start, 1, 0);
  const diagonal = move(start, 1, 1);
  assert.ok(Math.abs(Math.hypot(straight.x - start.x, straight.y - start.y) - Math.hypot(diagonal.x - start.x, diagonal.y - start.y)) < 1e-8);
});
