// Protocol test: boots the server, two clients create/join a room, play, one disconnects.
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const srv = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.once('data', r));

function client(name) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    inbox.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); }
  });
  return {
    ws, inbox,
    ready: new Promise((r) => ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', name })); r(); })),
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 5000) => {
      const hit = inbox.find(pred);
      if (hit) { inbox.splice(inbox.indexOf(hit), 1); return Promise.resolve(hit); }
      return new Promise((res, rej) => {
        const w = { pred, res };
        waiters.push(w);
        setTimeout(() => rej(new Error('timeout waiting')), ms);
      });
    },
  };
}

try {
  const a = client('Alice'), b = client('Bob');
  await Promise.all([a.ready, b.ready]);
  a.send({ t: 'create' });
  const room = await a.wait((m) => m.t === 'room');
  assert.equal(room.players.length, 1);
  assert.equal(room.host, 0);

  b.send({ t: 'join', code: 'ZZZZ' });
  assert.equal((await b.wait((m) => m.t === 'err')).msg, 'Room not found.');

  b.send({ t: 'join', code: room.code.toLowerCase() });
  const rb = await b.wait((m) => m.t === 'room' && m.players.length === 2);
  assert.equal(rb.you, 1);

  b.send({ t: 'start' }); // not host: ignored
  a.send({ t: 'addbot' });
  await a.wait((m) => m.t === 'room' && m.players.length === 3);
  a.send({ t: 'start' });
  const sa = await a.wait((m) => m.t === 'start');
  const sb = await b.wait((m) => m.t === 'start');
  assert.equal(sa.you, 0); assert.equal(sb.you, 1);
  assert.equal(sa.meta.players[2].bot, true);

  a.send({ t: 'in', d: 1 });
  const snap = await a.wait((m) => m.t === 's' && m.s.st === 'playing', 6000);
  assert.equal(snap.s.p.length, 3);
  await a.wait((m) => m.t === 's' && m.g.length > 0, 3000);

  b.ws.close();
  const left = await a.wait((m) => m.t === 'left');
  assert.equal(left.name, 'Bob');

  // Quick match: lone player gets bots after the wait.
  const c = client('Cara');
  await c.ready;
  c.send({ t: 'quick' });
  const q = await c.wait((m) => m.t === 'room' && m.quick);
  assert.ok(q.startIn > 0);
  const qs = await c.wait((m) => m.t === 'start', 15000);
  assert.equal(qs.meta.players.length, 4);

  a.ws.close(); c.ws.close();
  console.log('server ok');
} finally {
  srv.kill();
}
