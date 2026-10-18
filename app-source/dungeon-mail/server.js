import { Server as HttpServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Courtyard, worldStore,accounts,avatars,levelStore,notifyAdministration } from './hall.js';
import { accountApi } from './account-api.js';
import {materialInfo} from './material-catalog.js';
import {Encoder} from '@colyseus/schema';
Encoder.BUFFER_SIZE=128*1024;

const joinRates = new Map();
const localPort=Number(process.env.PORT||2567);
const origins = new Set((process.env.ALLOWED_ORIGINS || (process.env.NODE_ENV==='production'?'https://82.157.83.81,https://yunwen831.github.io':`https://82.157.83.81,https://yunwen831.github.io,http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:${localPort},http://localhost:${localPort}`)).split(','));
const allowedOrigin = origin => !origin || origins.has(origin);

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
      if (req.method === 'POST' && req.url.startsWith('/matchmake/')) {
        const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
        const now = Date.now();
        let entry = joinRates.get(ip);
        if (!entry || now - entry.start > 60000) { entry = { start: now, count: 0 }; joinRates.set(ip, entry); }
        if (++entry.count > 120) {
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
app.use('/api/account',accountApi(accounts,worldStore,notifyAdministration));
app.get('/health', (req, res) => res.json({ ok: true, service: 'dungeon-mail-courtyard', version: '0.19.1' }));
app.get('/api/materials/:id',(req,res)=>{
  const material=worldStore.data.materials.find(m=>m.id===req.params.id);
  if(!material)return res.status(404).json({error:'材料已不存在'});
  const info=materialInfo(material);if(req.query.v!==info.rev)return res.status(409).json({error:'材料已更新，请刷新'});
  res.setHeader('Cache-Control','public, max-age=31536000, immutable');
  res.json({id:material.id,rev:info.rev,pixels:material.pixels});
});
const sourceRoot=fileURLToPath(new URL('../../',import.meta.url));
app.get('/',(req,res)=>res.redirect('/courtyard/'));
app.get('/courtyard/config.json',(req,res)=>res.json({endpoint:'same-origin'}));
app.get('/assets/favicon.svg',(req,res)=>res.sendFile(resolve(sourceRoot,'assets/favicon.svg')));
app.use('/courtyard',express.static(resolve(sourceRoot,'courtyard'),{dotfiles:'deny',etag:true,setHeaders:(res,path)=>{
  const request=new URL(res.req.url,'http://localhost');
  const assetVersion=request.searchParams.get('v');res.setHeader('Cache-Control',(assetVersion?.startsWith('0.16.')||assetVersion?.startsWith('0.17.')||assetVersion?.startsWith('0.18.')||assetVersion?.startsWith('0.19.'))&&/\.(js|css)$/.test(path)?'public, max-age=31536000, immutable':'no-cache');
}}));
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
  await worldStore.flush();
  await accounts.flush();await avatars.flush();await levelStore.flush();
  process.exit(0);
});
