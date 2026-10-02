// Neon renderer: persistent trail layer + cheap downsampled bloom,
// glowing heads, particles, screen shake and flashes.
import { W, H, POWERUPS, hasFx } from '../shared/game.js';

const BLOOM_SCALE = 0.25;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const glowCache = new Map();
function glowSprite(color, size = 64) {
  const key = color + size;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, rgba(color, 1));
  grd.addColorStop(0.25, rgba(color, 0.55));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
    this.time = 0;
    this.players = [];
    this.view = null;
    this.banners = [];
    this.rings = [];
    this.aims = [];
    this.hud = true;
    this.quality = 1;
    this.resize();
  }

  setPlayers(players) {
    this.players = players;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = window.innerWidth, ch = window.innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.dpr = dpr;
    // Fit the arena with a small margin for HUD.
    const margin = 10 * dpr;
    const top = 44 * dpr;
    const s = Math.min((this.canvas.width - margin * 2) / W, (this.canvas.height - top - margin) / H);
    this.scale = s;
    this.ox = (this.canvas.width - W * s) / 2;
    this.oy = top + (this.canvas.height - top - margin - H * s) / 2;

    const oldTrail = this.trail;
    this.trail = makeCanvas(W * s, H * s);
    this.tctx = this.trail.getContext('2d');
    this.tctx.lineCap = 'round';
    if (oldTrail) this.tctx.drawImage(oldTrail, 0, 0, this.trail.width, this.trail.height);
    this.bloom = makeCanvas(this.trail.width * BLOOM_SCALE, this.trail.height * BLOOM_SCALE);
    this.bctx = this.bloom.getContext('2d');
    // A second, smaller layer gives the wide soft halo.
    this.halo = makeCanvas(this.trail.width * BLOOM_SCALE * 0.5, this.trail.height * BLOOM_SCALE * 0.5);
    this.hctx = this.halo.getContext('2d');
    this.bloomSupportsFilter = 'filter' in this.bctx;
    this.buildBackground();
  }

  buildBackground() {
    const c = makeCanvas(this.canvas.width, this.canvas.height);
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    bg.addColorStop(0, '#120a2e');
    bg.addColorStop(0.6, '#07051a');
    bg.addColorStop(1, '#020109');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    // Nebula blobs
    const blobs = [['#5b1aa8', 0.2, 0.25], ['#0a4a8a', 0.8, 0.7], ['#8a0a5e', 0.75, 0.2]];
    for (const [col, fx, fy] of blobs) {
      const r = Math.max(c.width, c.height) * 0.45;
      const grd = g.createRadialGradient(c.width * fx, c.height * fy, 0, c.width * fx, c.height * fy, r);
      grd.addColorStop(0, rgba(col, 0.28));
      grd.addColorStop(1, rgba(col, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, c.width, c.height);
    }
    // Stars
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 + 0.1})`;
      const r = Math.random() * 1.3 * this.dpr;
      g.beginPath();
      g.arc(Math.random() * c.width, Math.random() * c.height, r, 0, Math.PI * 2);
      g.fill();
    }
    // Arena floor grid
    const s = this.scale;
    g.save();
    g.translate(this.ox, this.oy);
    g.fillStyle = 'rgba(8,6,24,0.72)';
    g.fillRect(0, 0, W * s, H * s);
    g.strokeStyle = 'rgba(120,90,255,0.09)';
    g.lineWidth = 1;
    const step = 40 * s;
    g.beginPath();
    for (let x = step; x < W * s; x += step) { g.moveTo(x, 0); g.lineTo(x, H * s); }
    for (let y = step; y < H * s; y += step) { g.moveTo(0, y); g.lineTo(W * s, y); }
    g.stroke();
    const vig = g.createRadialGradient(W * s / 2, H * s / 2, H * s * 0.3, W * s / 2, H * s / 2, W * s * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W * s, H * s);
    g.restore();
    this.bg = c;
  }

  clearTrails() {
    this.tctx.clearRect(0, 0, this.trail.width, this.trail.height);
  }

  addSegments(segs) {
    const g = this.tctx;
    const s = this.scale;
    for (let i = 0; i < segs.length; i += 6) {
      const p = this.players[segs[i]];
      if (!p) continue;
      const x0 = segs[i + 1] * s, y0 = segs[i + 2] * s, x1 = segs[i + 3] * s, y1 = segs[i + 4] * s;
      const w = segs[i + 5] * s;
      // Opaque strokes so joints never bead; the bloom pass adds the glow.
      g.strokeStyle = p.color;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = p.core || (p.core = mix(p.color, 0.65));
      g.lineWidth = Math.max(1, w * 0.35);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
  }

  handleEvents(events, sfx) {
    for (const e of events) {
      if (e.type === 'death') {
        const p = this.players[e.i];
        this.burst(e.x, e.y, p ? p.color : '#fff', 70, 380);
        this.burst(e.x, e.y, '#ffffff', 18, 200);
        this.shake = Math.min(18, this.shake + 11);
        this.flash = 0.25; this.flashColor = p ? p.color : '#fff';
        sfx && sfx('death');
      } else if (e.type === 'pickup') {
        const def = POWERUPS[e.pu];
        this.burst(e.x, e.y, def.color, 34, 240);
        this.rings.push({ x: e.x, y: e.y, color: def.color, t: 0 });
        const p = this.players[e.i];
        this.banner(`${p ? p.name : ''} · ${def.label.toUpperCase()}`, def.color, 1.1, 0.42);
        if (e.pu === 'wipe') { this.clearTrails(); this.flash = 0.5; this.flashColor = '#ffe600'; }
        sfx && sfx('pickup', e.pu);
      } else if (e.type === 'round') {
        this.clearTrails();
        sfx && sfx('round');
      } else if (e.type === 'go') {
        this.banner('GO!', '#ffffff', 0.7, 0.5, 2.2);
        sfx && sfx('go');
      } else if (e.type === 'roundEnd') {
        const p = this.players[e.winner];
        if (p) this.banner(`${p.name} survives!`, p.color, 2.2, 0.5, 1.4);
        else this.banner('No survivors', '#ffffff', 2.2, 0.5, 1.4);
        sfx && sfx('roundEnd');
      } else if (e.type === 'puSpawn') {
        sfx && sfx('spawn');
      }
    }
  }

  banner(text, color, dur = 1.5, y = 0.5, size = 1) {
    this.banners = this.banners.filter((b) => b.y !== y);
    this.banners.push({ text, color, dur, t: 0, y, size });
  }

  burst(x, y, color, n, speed) {
    const max = this.quality < 1 ? 250 : 700;
    for (let i = 0; i < n && this.particles.length < max; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.2 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.5 + Math.random() * 0.7, t: 0, color, size: 1.5 + Math.random() * 3,
      });
    }
  }

  draw(view, dt) {
    this.time += dt;
    this.view = view;
    const ctx = this.ctx;
    const s = this.scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0);

    let sx = 0, sy = 0;
    if (this.shake > 0.1) {
      sx = (Math.random() - 0.5) * this.shake * this.dpr;
      sy = (Math.random() - 0.5) * this.shake * this.dpr;
      this.shake *= Math.pow(0.02, dt);
    }
    ctx.translate(this.ox + sx, this.oy + sy);

    this.drawBorder(ctx, view);

    // Bloom: downsample the trail layer (bilinear filtering blurs it), then
    // add it back on top with additive blending.
    const hq = this.bloomSupportsFilter && this.quality >= 1;
    const b = this.bctx;
    b.clearRect(0, 0, this.bloom.width, this.bloom.height);
    if (hq) b.filter = `blur(${1.5 * this.dpr}px)`;
    b.drawImage(this.trail, 0, 0, this.bloom.width, this.bloom.height);
    b.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.bloom, 0, 0, this.trail.width, this.trail.height);
    ctx.drawImage(this.bloom, 0, 0, this.trail.width, this.trail.height);
    if (hq) {
      const h = this.hctx;
      h.clearRect(0, 0, this.halo.width, this.halo.height);
      h.filter = `blur(${2 * this.dpr}px)`;
      h.drawImage(this.bloom, 0, 0, this.halo.width, this.halo.height);
      h.filter = 'none';
      ctx.globalAlpha = 0.8;
      ctx.drawImage(this.halo, 0, 0, this.trail.width, this.trail.height);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.trail, 0, 0);

    if (view) {
      this.drawPowerups(ctx, view);
      this.drawHeads(ctx, view);
    }
    this.drawParticles(ctx, dt);
    this.drawRings(ctx, dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flash * 0.6;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      this.flash = Math.max(0, this.flash - dt * 1.6);
    }
    if (view && this.hud) {
      this.drawHud(ctx, view);
      this.drawCountdown(ctx, view);
    }
    this.drawBanners(ctx, dt);
  }

  drawBorder(ctx, view) {
    const s = this.scale;
    const portal = view && view.po > 0;
    const t = this.time;
    ctx.save();
    ctx.lineJoin = 'round';
    const col = portal ? `hsl(${(t * 120) % 360},100%,65%)` : '#7c4dff';
    ctx.strokeStyle = col;
    if (portal) {
      ctx.setLineDash([14 * s, 10 * s]);
      ctx.lineDashOffset = -t * 60 * s;
    }
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 10 * s;
    ctx.strokeRect(0, 0, W * s, H * s);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5 * s;
    ctx.strokeRect(0, 0, W * s, H * s);
    ctx.restore();
  }

  drawPowerups(ctx, view) {
    const s = this.scale;
    const t = this.time;
    for (const [id, type, x, y] of view.u) {
      const def = POWERUPS[type];
      const pulse = 1 + Math.sin(t * 5 + id) * 0.08;
      const r = 15 * s * pulse;
      const gs = glowSprite(def.color);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(gs, x * s - r * 2.6, y * s - r * 2.6, r * 5.2, r * 5.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(x * s, y * s);
      ctx.rotate(t * 1.2 + id);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(10,6,30,0.85)';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawIcon(ctx, type, x * s, y * s, r * 0.55, def.color, s);
    }
  }

  drawHeads(ctx, view) {
    const s = this.scale;
    const counting = view.st === 'countdown';
    view.p.forEach((pp, i) => {
      const [x, y, a, alive, , fx, w] = pp;
      if (!alive) return;
      const pl = this.players[i];
      if (!pl) return;
      const ghost = hasFx(fx, 'ghost');
      const r = (w / 2 + 2.5) * s;
      ctx.globalCompositeOperation = 'lighter';
      const gs = glowSprite(pl.color);
      const gr = r * (counting ? 9 + Math.sin(this.time * 8) * 2 : 6);
      ctx.globalAlpha = ghost ? 0.4 + Math.sin(this.time * 20) * 0.2 : 1;
      ctx.drawImage(gs, x * s - gr / 2, y * s - gr / 2, gr, gr);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x * s, y * s, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (hasFx(fx, 'boost')) {
        this.particles.push({ x: x - Math.cos(a) * 6, y: y - Math.sin(a) * 6, vx: -Math.cos(a) * 60 + (Math.random() - 0.5) * 50, vy: -Math.sin(a) * 60 + (Math.random() - 0.5) * 50, life: 0.35, t: 0, color: '#39ff14', size: 2 });
      }
      const aim = this.aims && this.aims.find((m) => m.player === i);
      if (aim) {
        // Chevron showing where the joystick is steering; fades once on course.
        let d = aim.angle - a;
        d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
        const alpha = d < 0.06 ? 0 : Math.min(1, 0.45 + d * 2);
        if (alpha > 0) {
          const cx = x * s + Math.cos(aim.angle) * 34 * s, cy = y * s + Math.sin(aim.angle) * 34 * s;
          const k = 13 * s;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = pl.color;
          ctx.lineWidth = 4.5 * s;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(aim.angle + 2.4) * k, cy + Math.sin(aim.angle + 2.4) * k);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + Math.cos(aim.angle - 2.4) * k, cy + Math.sin(aim.angle - 2.4) * k);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      if (hasFx(fx, 'reverse')) {
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.arc(x * s, y * s, r * 2.4, this.time * 6, this.time * 6 + Math.PI * 1.3);
        ctx.stroke();
      }
      if (counting) {
        // Direction arrow + name tag so everyone finds themselves.
        const ax = x * s + Math.cos(a) * 34 * s, ay = y * s + Math.sin(a) * 34 * s;
        ctx.strokeStyle = pl.color;
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(x * s + Math.cos(a) * 12 * s, y * s + Math.sin(a) * 12 * s);
        ctx.lineTo(ax, ay);
        ctx.moveTo(ax + Math.cos(a + 2.5) * 9 * s, ay + Math.sin(a + 2.5) * 9 * s);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax + Math.cos(a - 2.5) * 9 * s, ay + Math.sin(a - 2.5) * 9 * s);
        ctx.stroke();
        ctx.font = `700 ${14 * s}px Orbitron, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = pl.color;
        ctx.fillText(pl.name, x * s, y * s - 22 * s);
      }
    });
  }

  drawParticles(ctx, dt) {
    const s = this.scale;
    ctx.globalCompositeOperation = 'lighter';
    const ps = this.particles;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.15, dt); p.vy *= Math.pow(0.15, dt);
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      const sz = p.size * s * (0.5 + k);
      ctx.fillRect(p.x * s - sz / 2, p.y * s - sz / 2, sz, sz);
      ps[j++] = p;
    }
    ps.length = j;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawRings(ctx, dt) {
    const s = this.scale;
    this.rings = this.rings.filter((r) => (r.t += dt) < 0.6);
    for (const r of this.rings) {
      const k = r.t / 0.6;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * s * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x * s, r.y * s, (15 + k * 70) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawHud(ctx, view) {
    const d = this.dpr;
    const n = view.p.length;
    const chipW = Math.min(200 * d, (this.canvas.width - 20 * d) / n - 8 * d);
    const total = n * chipW + (n - 1) * 8 * d;
    let x = (this.canvas.width - total) / 2;
    const y = 6 * d;
    ctx.font = `700 ${13 * d}px Orbitron, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    view.p.forEach((pp, i) => {
      const pl = this.players[i];
      if (!pl) return;
      const alive = pp[3];
      ctx.globalAlpha = alive || view.st !== 'playing' ? 1 : 0.4;
      ctx.fillStyle = 'rgba(12,8,36,0.75)';
      roundRect(ctx, x, y, chipW, 30 * d, 15 * d);
      ctx.fill();
      ctx.strokeStyle = pl.color;
      ctx.lineWidth = 1.5 * d;
      ctx.stroke();
      ctx.fillStyle = pl.color;
      ctx.beginPath();
      ctx.arc(x + 15 * d, y + 15 * d, 5 * d, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      const name = pl.name.length > 10 ? pl.name.slice(0, 9) + '…' : pl.name;
      ctx.fillText(name, x + 26 * d, y + 15.5 * d);
      ctx.textAlign = 'right';
      ctx.fillStyle = pl.color;
      ctx.fillText(String(pp[4]), x + chipW - 12 * d, y + 15.5 * d);
      x += chipW + 8 * d;
    });
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  drawCountdown(ctx, view) {
    if (view.st !== 'countdown') return;
    const secs = view.tm / 60;
    const n = Math.ceil(secs - 0.6);
    const label = n >= 1 ? String(n) : 'READY';
    const frac = (secs - 0.6) % 1;
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    const size = (80 + (1 - frac) * 0) * this.dpr * (1 + frac * 0.35);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${size}px Orbitron, system-ui, sans-serif`;
    ctx.globalAlpha = Math.min(1, frac * 2 + 0.2);
    ctx.shadowColor = '#ff2bd6';
    ctx.shadowBlur = 30 * this.dpr;
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, cy);
    ctx.font = `700 ${16 * this.dpr}px Orbitron, system-ui, sans-serif`;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`ROUND ${view.rd}`, cx, cy - 70 * this.dpr);
    ctx.restore();
  }

  drawBanners(ctx, dt) {
    this.banners = this.banners.filter((b) => (b.t += dt) < b.dur);
    for (const b of this.banners) {
      const k = b.t / b.dur;
      const alpha = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const scale = 1 + (k < 0.15 ? (0.15 - k) * 2 : 0);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${30 * b.size * scale * this.dpr}px Orbitron, system-ui, sans-serif`;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 24 * this.dpr;
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, this.canvas.width / 2, this.canvas.height * b.y);
      ctx.restore();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(ctx, type, x, y, r, color, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (type) {
    case 'boost': // lightning bolt
      ctx.moveTo(r * 0.2, -r); ctx.lineTo(-r * 0.5, r * 0.1); ctx.lineTo(r * 0.1, r * 0.1);
      ctx.lineTo(-r * 0.2, r); ctx.lineTo(r * 0.5, -r * 0.1); ctx.lineTo(-r * 0.1, -r * 0.1);
      ctx.closePath(); ctx.fill(); break;
    case 'ghost':
      ctx.arc(0, -r * 0.1, r * 0.7, Math.PI, 0);
      ctx.lineTo(r * 0.7, r * 0.8); ctx.lineTo(r * 0.35, r * 0.5); ctx.lineTo(0, r * 0.8);
      ctx.lineTo(-r * 0.35, r * 0.5); ctx.lineTo(-r * 0.7, r * 0.8); ctx.closePath(); ctx.stroke(); break;
    case 'slow': // snowflake
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(-Math.cos(a) * r, -Math.sin(a) * r);
      }
      ctx.stroke(); break;
    case 'fat':
      ctx.lineWidth = 5 * s; ctx.moveTo(-r, r * 0.4); ctx.lineTo(r, -r * 0.4); ctx.stroke(); break;
    case 'reverse':
      ctx.arc(0, 0, r * 0.75, 0.3, Math.PI * 1.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.75); ctx.lineTo(r * 0.7, -r * 0.05); ctx.lineTo(r * 0.05, -r * 0.4); ctx.stroke(); break;
    case 'portal':
      ctx.setLineDash([3 * s, 3 * s]); ctx.strokeRect(-r, -r * 0.7, r * 2, r * 1.4); break;
    case 'wipe':
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(r * 0.55, r * 0.55); ctx.stroke(); break;
  }
  ctx.restore();
}
