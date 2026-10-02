// Neon Trails — shared game simulation.
// Runs on the client (offline party mode) and on the server (online mode),
// so both modes play exactly the same.

export const W = 1280;
export const H = 720;
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const MAX_PLAYERS = 4;

export const COLORS = ['#00f0ff', '#ff2bd6', '#ffe600', '#39ff14'];
export const COLOR_NAMES = ['Cyan', 'Magenta', 'Gold', 'Lime'];

const CELL = 2;
const GW = W / CELL;
const GH = H / CELL;

const BASE_SPEED = 120; // px / s
const TURN_RATE = 3.3; // rad / s
const BASE_WIDTH = 5;
const SELF_GRACE_TICKS = 14; // own fresh trail can't kill you
const COUNTDOWN_TICKS = TICK_RATE * 2.6;
const ROUND_END_TICKS = TICK_RATE * 2.6;

export const POWERUPS = {
  boost: { label: 'Boost', color: '#39ff14', self: true, ticks: 4 * TICK_RATE },
  ghost: { label: 'Ghost', color: '#b388ff', self: true, ticks: 4 * TICK_RATE },
  slow: { label: 'Freeze', color: '#4dd2ff', self: false, ticks: 4 * TICK_RATE },
  fat: { label: 'Fatten', color: '#ff9100', self: false, ticks: 5 * TICK_RATE },
  reverse: { label: 'Reverse', color: '#ff1744', self: false, ticks: 4 * TICK_RATE },
  portal: { label: 'Portal', color: '#ffffff', global: true, ticks: 6 * TICK_RATE },
  wipe: { label: 'Wipe', color: '#ffe600', global: true, ticks: 0 },
};
const PU_TYPES = Object.keys(POWERUPS);
const PU_RADIUS = 15;

function rand(rng, a, b) {
  return a + (b - a) * rng();
}

// Small deterministic PRNG so rounds can be reproduced in tests.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function targetScoreFor(n) {
  return Math.max(5, (n - 1) * 5);
}

export class Game {
  // players: [{ name, color?, bot? }]
  constructor(players, opts = {}) {
    this.rng = opts.seed != null ? mulberry32(opts.seed) : Math.random;
    this.players = players.map((p, i) => ({
      index: i,
      name: p.name || `Player ${i + 1}`,
      color: p.color || COLORS[i % COLORS.length],
      bot: !!p.bot,
      score: 0,
      x: 0, y: 0, a: 0,
      alive: true,
      turn: 0,
      gapIn: 0, gapLeft: 0,
      fx: {},
      botTurn: 0, botThink: 0,
    }));
    this.solo = this.players.length === 1;
    this.target = opts.target || targetScoreFor(this.players.length);
    this.owner = new Uint8Array(GW * GH);
    this.stamp = new Int32Array(GW * GH);
    this.tick = 0;
    this.round = 0;
    this.state = 'countdown';
    this.timer = 0;
    this.powerups = [];
    this.puId = 0;
    this.puSpawnIn = 0;
    this.portal = 0;
    this.winner = -1;
    this.roundWinner = -1;
    this.segs = [];
    this.events = [];
    this.startRound();
  }

  setInput(i, turn) {
    const p = this.players[i];
    if (p && !p.bot) p.turn = Math.max(-1, Math.min(1, turn | 0));
  }

  setBot(i, bot) {
    const p = this.players[i];
    if (p) { p.bot = bot; p.turn = 0; }
  }

  startRound() {
    this.round++;
    this.owner.fill(0);
    this.stamp.fill(0);
    this.powerups = [];
    this.portal = 0;
    this.puSpawnIn = Math.floor(rand(this.rng, 2, 4) * TICK_RATE);
    this.state = 'countdown';
    this.timer = COUNTDOWN_TICKS;
    this.roundWinner = -1;
    const placed = [];
    for (const p of this.players) {
      let x, y, tries = 0;
      do {
        x = rand(this.rng, 160, W - 160);
        y = rand(this.rng, 130, H - 130);
        tries++;
      } while (tries < 60 && placed.some((q) => Math.hypot(q.x - x, q.y - y) < 220));
      placed.push({ x, y });
      // Face roughly toward the centre so nobody spawns into a wall.
      const toC = Math.atan2(H / 2 - y, W / 2 - x);
      p.x = x; p.y = y;
      p.a = toC + rand(this.rng, -0.9, 0.9);
      p.alive = true;
      p.turn = 0;
      p.fx = {};
      p.gapIn = rand(this.rng, 120, 260);
      p.gapLeft = 0;
    }
    this.events.push({ type: 'round', round: this.round });
  }

  speedOf(p) {
    let s = BASE_SPEED;
    if (p.fx.boost) s *= 1.75;
    if (p.fx.slow) s *= 0.55;
    return s;
  }

  widthOf(p) {
    return p.fx.fat ? BASE_WIDTH * 2.2 : BASE_WIDTH;
  }

  alive() {
    return this.players.filter((p) => p.alive);
  }

  step() {
    this.tick++;
    if (this.state === 'countdown') {
      if (--this.timer <= 0) {
        this.state = 'playing';
        this.events.push({ type: 'go' });
      }
      return;
    }
    if (this.state === 'roundEnd') {
      if (--this.timer <= 0) {
        if (this.winner >= 0) {
          this.state = 'matchEnd';
          this.events.push({ type: 'matchEnd', winner: this.winner });
        } else {
          this.startRound();
        }
      }
      return;
    }
    if (this.state !== 'playing') return;

    this.updatePowerups();
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p.bot) this.thinkBot(p);
      for (const k in p.fx) if (--p.fx[k] <= 0) delete p.fx[k];
      this.movePlayer(p);
    }
    if (this.portal > 0) this.portal--;
    this.checkRoundOver();
  }

  movePlayer(p) {
    const speed = this.speedOf(p);
    const turn = p.fx.reverse ? -p.turn : p.turn;
    // Faster players turn wider; slower players turn tighter.
    p.a += turn * TURN_RATE * DT * Math.sqrt(speed / BASE_SPEED);
    const dist = speed * DT;
    const ox = p.x, oy = p.y;
    let nx = ox + Math.cos(p.a) * dist;
    let ny = oy + Math.sin(p.a) * dist;
    const w = this.widthOf(p);
    const r = w / 2;

    let wrapped = false;
    if (nx < r || nx > W - r || ny < r || ny > H - r) {
      if (this.portal > 0) {
        if (nx < 0) { nx += W; wrapped = true; } else if (nx > W) { nx -= W; wrapped = true; }
        if (ny < 0) { ny += H; wrapped = true; } else if (ny > H) { ny -= H; wrapped = true; }
      } else {
        p.x = Math.max(r, Math.min(W - r, nx));
        p.y = Math.max(r, Math.min(H - r, ny));
        this.kill(p, null);
        return;
      }
    }

    // Gaps in the trail let players slip through.
    let drawing = true;
    if (p.gapLeft > 0) {
      p.gapLeft -= dist;
      drawing = false;
    } else {
      p.gapIn -= dist;
      if (p.gapIn <= 0) {
        p.gapLeft = w * 3 + 14;
        p.gapIn = rand(this.rng, 140, 300);
      }
    }
    if (p.fx.ghost) drawing = false;

    p.x = nx; p.y = ny;

    if (!p.fx.ghost) {
      const hit = this.collide(p, nx, ny, r);
      if (hit !== 0) {
        this.kill(p, hit > 0 ? hit - 1 : null);
        return;
      }
    }
    if (drawing && !wrapped) {
      this.stampSeg(p, ox, oy, nx, ny, r);
      this.segs.push(p.index, ox, oy, nx, ny, w);
    }
    this.pickup(p);
  }

  // Returns 0 for no hit, owner index + 1 for a trail hit.
  collide(p, x, y, r) {
    const probes = [
      [0, r + 1],
      [-0.6, r + 0.5],
      [0.6, r + 0.5],
    ];
    for (const [da, d] of probes) {
      const px = x + Math.cos(p.a + da) * d;
      const py = y + Math.sin(p.a + da) * d;
      const hit = this.cellHit(p, px, py);
      if (hit) return hit;
    }
    return 0;
  }

  cellHit(p, px, py) {
    if (this.portal > 0) {
      px = (px + W) % W;
      py = (py + H) % H;
    }
    const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return 0;
    const idx = cy * GW + cx;
    const o = this.owner[idx];
    if (o === 0) return 0;
    if (o === p.index + 1 && this.tick - this.stamp[idx] < SELF_GRACE_TICKS) return 0;
    return o;
  }

  stampSeg(p, x0, y0, x1, y1, r) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / 1.5));
    const rc = Math.ceil(r / CELL);
    for (let s = 1; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      for (let dy = -rc; dy <= rc; dy++) {
        for (let dx = -rc; dx <= rc; dx++) {
          if ((dx * dx + dy * dy) * CELL * CELL > r * r + 1) continue;
          const gx = cx + dx, gy = cy + dy;
          if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
          const idx = gy * GW + gx;
          if (this.owner[idx] === 0 || this.owner[idx] === p.index + 1) {
            this.owner[idx] = p.index + 1;
            this.stamp[idx] = this.tick;
          }
        }
      }
    }
  }

  kill(p, by) {
    p.alive = false;
    for (const q of this.players) if (q.alive) q.score++;
    this.events.push({ type: 'death', i: p.index, x: p.x, y: p.y, by });
  }

  checkRoundOver() {
    const alive = this.alive();
    const over = this.solo ? alive.length === 0 : alive.length <= 1;
    if (!over) return;
    this.roundWinner = alive.length === 1 && !this.solo ? alive[0].index : -1;
    this.state = 'roundEnd';
    this.timer = ROUND_END_TICKS;
    // Match ends once someone reaches the target with a 2 point lead.
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const second = sorted[1];
    if (this.solo) {
      this.winner = -1;
      if (this.round >= 5) this.winner = 0;
    } else if (top.score >= this.target && (!second || top.score - second.score >= 2)) {
      this.winner = top.index;
    }
    this.events.push({ type: 'roundEnd', winner: this.roundWinner });
  }

  updatePowerups() {
    if (--this.puSpawnIn <= 0) {
      this.puSpawnIn = Math.floor(rand(this.rng, 2.5, 5.5) * TICK_RATE);
      if (this.powerups.length < 4) {
        for (let tries = 0; tries < 20; tries++) {
          const x = rand(this.rng, 60, W - 60);
          const y = rand(this.rng, 60, H - 60);
          const clearOfHeads = this.players.every((p) => !p.alive || Math.hypot(p.x - x, p.y - y) > 90);
          if (!clearOfHeads) continue;
          let type = PU_TYPES[Math.floor(this.rng() * PU_TYPES.length)];
          if (type === 'wipe' && this.rng() < 0.5) type = 'boost';
          const pu = { id: ++this.puId, type, x, y };
          this.powerups.push(pu);
          this.events.push({ type: 'puSpawn', id: pu.id });
          break;
        }
      }
    }
  }

  pickup(p) {
    for (let k = this.powerups.length - 1; k >= 0; k--) {
      const pu = this.powerups[k];
      if (Math.hypot(pu.x - p.x, pu.y - p.y) > PU_RADIUS + 4) continue;
      this.powerups.splice(k, 1);
      const def = POWERUPS[pu.type];
      if (pu.type === 'wipe') {
        this.owner.fill(0);
        this.stamp.fill(0);
      } else if (def.global) {
        this.portal = def.ticks;
      } else if (def.self) {
        p.fx[pu.type] = def.ticks;
        if (pu.type === 'boost') delete p.fx.slow;
      } else {
        for (const q of this.players) if (q !== p && q.alive) q.fx[pu.type] = def.ticks;
      }
      this.events.push({ type: 'pickup', i: p.index, pu: pu.type, x: pu.x, y: pu.y });
    }
  }

  // ---- Bots: look ahead along three candidate steering choices. ----
  thinkBot(p) {
    if (--p.botThink > 0) { p.turn = p.botTurn; return; }
    p.botThink = 3 + Math.floor(this.rng() * 3);
    const choices = [0, -1, 1];
    let best = 0, bestScore = -Infinity;
    for (const c of choices) {
      let s = this.probe(p, c);
      if (c === p.botTurn) s += 4; // a little momentum looks more human
      if (c === 0) s += 2;
      s += this.rng() * 6;
      // Drift toward nearby powerups when the way is clear.
      const pu = this.nearestPowerup(p);
      if (pu && s > 60) {
        const want = Math.atan2(pu.y - p.y, pu.x - p.x);
        let d = want - p.a;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if ((d > 0.15 && c === 1) || (d < -0.15 && c === -1) || (Math.abs(d) <= 0.15 && c === 0)) s += 10;
      }
      if (s > bestScore) { bestScore = s; best = c; }
    }
    p.botTurn = best;
    const turn = p.fx.reverse ? -best : best; // bots understand reverse
    p.turn = turn;
  }

  probe(p, c) {
    const speed = this.speedOf(p);
    const dist = speed * DT * 3;
    let x = p.x, y = p.y, a = p.a;
    const r = this.widthOf(p) / 2;
    const steps = 26;
    for (let s = 1; s <= steps; s++) {
      // Turn for a while, then straighten out.
      if (s <= 12) a += c * TURN_RATE * DT * 3;
      x += Math.cos(a) * dist;
      y += Math.sin(a) * dist;
      if (this.portal > 0) {
        x = (x + W) % W; y = (y + H) % H;
      } else if (x < r + 2 || x > W - r - 2 || y < r + 2 || y > H - r - 2) {
        return s * 4;
      }
      if (!p.fx.ghost) {
        const tx = x + Math.cos(a) * (r + 1), ty = y + Math.sin(a) * (r + 1);
        const cx = Math.floor(tx / CELL), cy = Math.floor(ty / CELL);
        if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) {
          const idx = cy * GW + cx;
          const o = this.owner[idx];
          if (o !== 0 && !(o === p.index + 1 && this.tick - this.stamp[idx] < SELF_GRACE_TICKS + s * 3)) return s * 4;
        }
      }
      // Other heads are danger too.
      for (const q of this.players) {
        if (q === p || !q.alive) continue;
        if (Math.hypot(q.x - x, q.y - y) < 18) return s * 4 + 2;
      }
    }
    return steps * 4 + 20;
  }

  nearestPowerup(p) {
    let best = null, bd = 260;
    for (const pu of this.powerups) {
      const d = Math.hypot(pu.x - p.x, pu.y - p.y);
      if (d < bd) { bd = d; best = pu; }
    }
    return best;
  }

  // ---- Serialisation shared by local and network play. ----
  drainSegs() {
    const s = this.segs;
    this.segs = [];
    return s;
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  meta() {
    return {
      target: this.target,
      players: this.players.map((p) => ({ name: p.name, color: p.color, bot: p.bot })),
    };
  }

  snapshot() {
    return {
      k: this.tick,
      st: this.state,
      tm: this.timer,
      rd: this.round,
      w: this.winner,
      rw: this.roundWinner,
      po: this.portal,
      p: this.players.map((p) => [
        Math.round(p.x * 10) / 10,
        Math.round(p.y * 10) / 10,
        Math.round(p.a * 1000) / 1000,
        p.alive ? 1 : 0,
        p.score,
        fxFlags(p.fx),
        this.widthOf(p),
      ]),
      u: this.powerups.map((pu) => [pu.id, pu.type, Math.round(pu.x), Math.round(pu.y)]),
    };
  }
}

const FX_BITS = { boost: 1, ghost: 2, slow: 4, fat: 8, reverse: 16 };
function fxFlags(fx) {
  let f = 0;
  for (const k in fx) f |= FX_BITS[k] || 0;
  return f;
}
export function hasFx(flags, name) {
  return (flags & FX_BITS[name]) !== 0;
}
