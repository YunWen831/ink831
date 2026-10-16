import { Server as HttpServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { Server, Room } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { WORLD, COLORS, move, spawn } from '../../courtyard/world.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 12;
const MAX_CONNECTIONS = 50;
let connections = 0;
const activeRooms = new Set();
const joinRates = new Map();
const origins = new Set((process.env.ALLOWED_ORIGINS || 'https://yunwen831.github.io,http://127.0.0.1:4173,http://localhost:4173').split(','));
const allowedOrigin = origin => !origin || origins.has(origin);

const Player = schema({
  name: t.string().default(''), x: t.number().default(480), y: t.number().default(414),
  color: t.string().default(COLORS[0]), connected: t.boolean().default(true), ack: t.number().default(0),
}, 'Player');
const CourtyardState = schema({ code: t.string().default(''), players: t.map(Player) }, 'CourtyardState');

export class Courtyard extends Room {
  maxClients = 8;
  maxMessagesPerSecond = 45;
  patchRate = 50;
  state = new CourtyardState();

  onCreate() {
    if (activeRooms.size >= MAX_ROOMS) throw new Error('房间暂时已满，请稍后再试');
    this.roomId = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    this.state.code = this.roomId;
    this.setPrivate(true);
    activeRooms.add(this.roomId);
    // Empty rooms are disposed by Colyseus after the final reservation expires.
    this.onMessage('input', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.connected || !Array.isArray(data?.steps) || data.steps.length > 6) return;
      const now = performance.now();
      const user = client.userData;
      user.credit = Math.min(400, user.credit + now - user.creditAt);
      user.creditAt = now;
      for (const step of data.steps) {
        if (!Number.isSafeInteger(step?.seq) || step.seq <= player.ack || step.seq > player.ack + 250 ||
          !Number.isFinite(step.dx) || !Number.isFinite(step.dy) || Math.abs(step.dx) > 1 || Math.abs(step.dy) > 1) continue;
        // Consume an ack even for an over-budget step so it cannot be replayed.
        player.ack = step.seq;
        if (user.credit < WORLD.stepMs) continue;
        user.credit -= WORLD.stepMs;
        const next = move(player, step.dx, step.dy);
        player.x = next.x; player.y = next.y;
      }
    });
    this.onMessage('ping', (client, value) => {
      if (typeof value === 'number' && Number.isFinite(value)) client.send('pong', value);
    });
    this.onMessage('emote', client => {
      if (Date.now() - (client.userData.lastEmote || 0) < 1800) return;
      client.userData.lastEmote = Date.now();
      this.broadcast('emote', { id: client.sessionId });
    });
  }

  onAuth(client, options) {
    if (connections >= MAX_CONNECTIONS) throw new Error('在线人数暂时已满');
    if (typeof options?.name !== 'string' || !options.name.trim()) throw new Error('请先输入昵称');
    return true;
  }
  onJoin(client, options) {
    const player = new Player();
    player.name = Array.from(options.name.replace(/[\u0000-\u001f\u007f<>]/g, '').trim()).slice(0, 12).join('') || '旅人';
    const occupied = new Set([...this.state.players.values()].map(p => p.color));
    const index = COLORS.findIndex(color => !occupied.has(color));
    player.color = COLORS[Math.max(0, index)];
    Object.assign(player, spawn(Math.max(0, index)));
    client.userData = { credit: 200, creditAt: performance.now(), lastEmote: 0, counted: true };
    this.state.players.set(client.sessionId, player);
    connections++;
  }
  onDrop(client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.allowReconnection(client, 60);
  }
  onReconnect(client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
    client.userData.credit = 200;
    client.userData.creditAt = performance.now();
  }
  onLeave(client) {
    this.state.players.delete(client.sessionId);
    if (client.userData?.counted) { connections--; client.userData.counted = false; }
  }
  onDispose() { activeRooms.delete(this.roomId); }
}

const app = express();
app.disable('x-powered-by');
// Colyseus handles its matchmaker routes before Express. Guard the HTTP server
// dispatch so origin/rate checks also cover those routes, not only /health.
class GuardedHttpServer extends HttpServer {
  emit(event, ...args) {
    if (event === 'request') {
      const [req, res] = args;
      if (!allowedOrigin(req.headers.origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Origin not allowed' }));
        return true;
      }
      if (req.method === 'POST') {
        const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
        const now = Date.now();
        let entry = joinRates.get(ip);
        if (!entry || now - entry.start > 60000) { entry = { start: now, count: 0 }; joinRates.set(ip, entry); }
        if (++entry.count > 30) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '操作过于频繁，请稍后再试' }));
          return true;
        }
      }
    }
    return super.emit(event, ...args);
  }
}
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  if (!allowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/health', (req, res) => res.json({ ok: true, service: 'dungeon-mail-courtyard', version: '0.1.0' }));
const httpServer = new GuardedHttpServer(app);
const server = new Server({
  gracefullyShutdown: false,
  transport: new WebSocketTransport({
    server: httpServer,
    maxPayload: 4096,
    pingInterval: 5000,
    pingMaxRetries: 2,
    verifyClient: info => allowedOrigin(info.origin),
  }),
  greet: false,
});
server.define('courtyard', Courtyard);

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of joinRates) if (now - entry.start > 60000) joinRates.delete(ip);
}, 60000).unref();
const port = Number(process.env.PORT || 2567);
await server.listen(port, process.env.HOST || '127.0.0.1');
console.log(`Courtyard listening on ${port}`);
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  clearInterval(cleanup);
  await server.gracefullyShutdown(false);
  process.exit(0);
});
