// Neon Trails online server.
// Serves the web client and runs authoritative matches over WebSockets.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, COLORS, MAX_PLAYERS, TICK_RATE } from '../client/shared/game.js';

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client');
const QUICK_WAIT_SECS = 12;
const BOT_NAMES = ['Volt', 'Nova', 'Pixel', 'Blitz', 'Echo', 'Zed', 'Lumen', 'Rogue'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

// ------------------------------------------------------------ static files
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: wss.clients.size }));
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
});

// ------------------------------------------------------------ rooms
const rooms = new Map(); // code -> Room

function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

class Room {
  constructor(quick) {
    this.code = newCode();
    this.quick = quick;
    this.seats = []; // { client|null, name, bot }
    this.host = 0;
    this.game = null;
    this.loop = null;
    this.startAt = quick ? Date.now() + QUICK_WAIT_SECS * 1000 : 0;
    rooms.set(this.code, this);
  }

  humans() {
    return this.seats.filter((s) => s.client);
  }

  add(client) {
    if (this.seats.length >= MAX_PLAYERS || this.game) return false;
    this.seats.push({ client, name: client.name, bot: false });
    client.room = this;
    if (this.quick && this.seats.length >= MAX_PLAYERS) this.startAt = Date.now();
    this.broadcastRoom();
    return true;
  }

  addBot() {
    if (this.seats.length >= MAX_PLAYERS || this.game) return;
    const used = new Set(this.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
    this.seats.push({ client: null, name, bot: true });
    this.broadcastRoom();
  }

  remove(client) {
    const idx = this.seats.findIndex((s) => s.client === client);
    if (idx < 0) return;
    client.room = null;
    if (this.game) {
      // Mid-match: a bot takes over so the match carries on.
      const seat = this.seats[idx];
      seat.client = null;
      seat.bot = true;
      seat.replaced = true;
      this.game.setBot(idx, true);
      this.send({ t: 'left', name: seat.name });
    } else {
      this.seats.splice(idx, 1);
    }
    if (this.humans().length === 0) {
      this.close();
      return;
    }
    if (this.host === idx || !this.seats[this.host]?.client) {
      this.host = this.seats.findIndex((s) => s.client);
    } else if (!this.game && idx < this.host) {
      this.host--;
    }
    if (!this.game) this.broadcastRoom();
  }

  close() {
    clearInterval(this.loop);
    this.loop = null;
    for (const s of this.seats) if (s.client) s.client.room = null;
    rooms.delete(this.code);
  }

  broadcastRoom() {
    const players = this.seats.map((s) => ({ name: s.name, bot: s.bot }));
    const startIn = this.quick ? Math.max(0, Math.ceil((this.startAt - Date.now()) / 1000)) : 0;
    this.seats.forEach((s, i) => {
      if (s.client) sendTo(s.client, { t: 'room', code: this.code, quick: this.quick, host: this.host, you: i, players, startIn });
    });
  }

  send(msg) {
    const data = JSON.stringify(msg);
    for (const s of this.seats) if (s.client && s.client.readyState === 1) s.client.send(data);
  }

  start() {
    if (this.game) return;
    if (this.quick) while (this.seats.length < MAX_PLAYERS) this.addBot();
    if (this.seats.length < 2) return;
    this.game = new Game(this.seats.map((s, i) => ({ name: s.name, bot: s.bot, color: COLORS[i] })));
    const meta = this.game.meta();
    this.seats.forEach((s, i) => s.client && sendTo(s.client, { t: 'start', you: i, meta }));
    let last = process.hrtime.bigint();
    let acc = 0;
    const step = 1 / TICK_RATE;
    this.loop = setInterval(() => {
      const now = process.hrtime.bigint();
      acc += Number(now - last) / 1e9;
      last = now;
      let n = 0;
      while (acc >= step && n < 8) {
        this.game.step();
        acc -= step;
        n++;
        // One packet per tick keeps trails and heads perfectly in sync.
        const segs = this.game.drainSegs().map((v, k) => (k % 6 === 0 ? v : Math.round(v * 10) / 10));
        this.send({ t: 's', s: this.game.snapshot(), g: segs, e: this.game.drainEvents() });
        if (this.game.state === 'matchEnd') {
          this.finish();
          return;
        }
      }
      if (n === 8) acc = 0;
    }, 1000 / TICK_RATE);
  }

  finish() {
    clearInterval(this.loop);
    this.loop = null;
    this.game = null;
    // Drop bots that replaced people who left; keep invited bots.
    this.seats = this.seats.filter((s) => s.client || (s.bot && !s.replaced));
    if (this.quick) {
      // Quick-match rooms are single use.
      for (const s of this.seats) if (s.client) s.client.room = null;
      rooms.delete(this.code);
      return;
    }
    this.host = Math.max(0, this.seats.findIndex((s) => s.client));
    setTimeout(() => rooms.has(this.code) && !this.game && this.broadcastRoom(), 2500);
  }
}

// Quick-match rooms tick down and start on their own.
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.quick || room.game) continue;
    if (Date.now() >= room.startAt) room.start();
    else room.broadcastRoom();
  }
}, 1000);

// ------------------------------------------------------------ sockets
function sendTo(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

wss.on('connection', (ws) => {
  ws.name = 'Pilot';
  ws.room = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = ws.room;
    switch (m.t) {
      case 'hello':
        ws.name = String(m.name || 'Pilot').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 12) || 'Pilot';
        break;
      case 'create': {
        if (room) room.remove(ws);
        new Room(false).add(ws);
        break;
      }
      case 'join': {
        const target = rooms.get(String(m.code || '').toUpperCase());
        if (!target || target.quick) return sendTo(ws, { t: 'err', msg: 'Room not found.' });
        if (target.game) return sendTo(ws, { t: 'err', msg: 'That match already started.' });
        if (target.seats.length >= MAX_PLAYERS) return sendTo(ws, { t: 'err', msg: 'Room is full.' });
        if (room) room.remove(ws);
        target.add(ws);
        break;
      }
      case 'quick': {
        if (room) room.remove(ws);
        let target = [...rooms.values()].find((r) => r.quick && !r.game && r.seats.length < MAX_PLAYERS);
        if (!target) target = new Room(true);
        target.add(ws);
        break;
      }
      case 'leave':
        if (room) room.remove(ws);
        break;
      case 'addbot':
        if (room && !room.quick && room.seats[room.host]?.client === ws) room.addBot();
        break;
      case 'start':
        if (room && !room.quick && room.seats[room.host]?.client === ws) room.start();
        break;
      case 'in': {
        if (!room || !room.game) return;
        const idx = room.seats.findIndex((s) => s.client === ws);
        if (idx >= 0) room.game.setInput(idx, Number(m.d) || 0);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.room) ws.room.remove(ws);
  });
});

// Drop dead connections so their seats go to bots.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`Neon Trails server on http://localhost:${PORT}`);
});
