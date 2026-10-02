// Keyboard + touch controls.
//
// Touch: every human gets an always-visible circular joystick. Push the knob
// toward where you want to go (screen direction) and the ride turns that way;
// let go and it finishes the turn and carries on in that direction.
// Party Mode puts one joystick in each player's corner; the top two are
// rotated so friends sitting opposite each other can share one phone.
// Classic ◀ ▶ buttons remain available as a setting.

const KEYMAPS = [
  { left: ['KeyA'], right: ['KeyD'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'] },
  { left: ['KeyJ'], right: ['KeyL'] },
  { left: ['Digit4', 'Numpad4'], right: ['Digit6', 'Numpad6'] },
];
const SOLO_KEYS = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
const CORNERS = ['bl', 'tr', 'tl', 'br'];
export const KEY_HINTS = ['A / D', '← / →', 'J / L', '4 / 6'];

const STICK_DEADZONE = 0.25; // fraction of the knob's travel before it steers
const STICK_GAIN = 3.2; // turn strength per radian of heading error
const ALIGNED = 0.04; // radians: close enough, go straight

export class Controls {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.slots = [];
    this.getHeading = null;
    this._key = (e) => this.handleKey(e);
    window.addEventListener('keydown', this._key);
    window.addEventListener('keyup', this._key);
  }

  // humans: [{ player, color, name }]
  // touch: show on-screen controls; style: 'stick' (joystick) or 'buttons'.
  // getHeading(player) returns the ride's current angle, for joystick steering.
  setup(humans, { touch = false, style = 'stick', getHeading = null } = {}) {
    this.root.innerHTML = '';
    this.getHeading = getHeading;
    const solo = humans.length === 1;
    this.slots = humans.map((h, k) => ({
      player: h.player,
      keys: solo ? SOLO_KEYS : KEYMAPS[k],
      down: { left: new Set(), right: new Set() },
      turn: 0,
      want: null, // target screen direction from the joystick
    }));
    if (!touch) return;
    humans.forEach((h, k) => {
      const corner = solo ? 'solo' : CORNERS[k];
      if (style === 'buttons') this.addButtons(h, k, corner);
      else this.addStick(h, k, corner, solo);
    });
  }

  addStick(h, k, corner, solo) {
    const slot = this.slots[k];
    // The zone is a generous touch area; the visible joystick sits inside it.
    const zone = document.createElement('div');
    zone.className = `pad stick-zone stick-${corner}`;
    zone.style.setProperty('--c', h.color);
    zone.innerHTML =
      '<div class="stick-base"><i class="tick t-n"></i><i class="tick t-e"></i><i class="tick t-s"></i><i class="tick t-w"></i>' +
      '<div class="stick-knob"></div></div>' +
      (solo ? '<div class="stick-hint">Push the joystick where you want to go</div>' : `<div class="stick-tag">${escapeHtml(h.name)}</div>`);
    const base = zone.querySelector('.stick-base');
    const knob = zone.querySelector('.stick-knob');
    const hint = zone.querySelector('.stick-hint');
    const flipped = corner === 'tl' || corner === 'tr';
    let active = null;

    const move = (e) => {
      const r = base.getBoundingClientRect();
      const radius = r.width / 2;
      let dx = e.clientX - (r.left + radius);
      let dy = e.clientY - (r.top + radius);
      const d = Math.hypot(dx, dy);
      const travel = radius * 0.62;
      if (d > travel) { dx *= travel / d; dy *= travel / d; }
      // Rotated pads draw in their own (upside-down) coordinates.
      const lx = flipped ? -dx : dx, ly = flipped ? -dy : dy;
      knob.style.transform = `translate(${lx}px, ${ly}px)`;
      if (d > travel * STICK_DEADZONE) slot.want = Math.atan2(dy, dx);
    };
    zone.addEventListener('pointerdown', (e) => {
      if (active !== null) return;
      e.preventDefault();
      zone.setPointerCapture?.(e.pointerId);
      active = e.pointerId;
      base.classList.add('on');
      if (hint) hint.classList.add('gone');
      move(e);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === active) move(e); });
    const up = (e) => {
      if (e.pointerId !== active) return;
      active = null;
      base.classList.remove('on');
      knob.style.transform = 'translate(0px, 0px)';
      // Keep slot.want: the ride finishes turning toward the last direction.
    };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
    this.root.appendChild(zone);
  }

  addButtons(h, k, corner) {
    const pad = document.createElement('div');
    pad.className = 'pad ' + (corner === 'solo' ? 'pad-full' : 'pad-' + corner);
    pad.style.setProperty('--c', h.color);
    for (const side of ['left', 'right']) {
      const b = document.createElement('div');
      b.className = 'pad-btn pad-' + side;
      b.innerHTML = side === 'left' ? '<span>◀</span>' : '<span>▶</span>';
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture?.(e.pointerId);
        this.slots[k].down[side].add('p' + e.pointerId);
        b.classList.add('on');
        this.update(k);
      });
      const up = (e) => {
        this.slots[k].down[side].delete('p' + e.pointerId);
        if (![...this.slots[k].down[side]].some((x) => x.startsWith('p'))) b.classList.remove('on');
        this.update(k);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      pad.appendChild(b);
    }
    if (corner !== 'solo') {
      const tag = document.createElement('div');
      tag.className = 'pad-tag';
      tag.textContent = h.name;
      pad.appendChild(tag);
    }
    this.root.appendChild(pad);
  }

  clear() {
    this.slots = [];
    this.root.innerHTML = '';
  }

  // New round: forget old joystick targets so nobody steers off on their own.
  reset() {
    for (const s of this.slots) s.want = null;
  }

  handleKey(e) {
    if (e.repeat) return;
    const isDown = e.type === 'keydown';
    this.slots.forEach((s, k) => {
      for (const side of ['left', 'right']) {
        if (s.keys[side].includes(e.code)) {
          if (isDown) s.down[side].add(e.code); else s.down[side].delete(e.code);
          e.preventDefault();
          s.want = null; // keyboard takes over from the joystick
          this.update(k);
        }
      }
    });
  }

  update(k) {
    const s = this.slots[k];
    const turn = (s.down.right.size > 0 ? 1 : 0) - (s.down.left.size > 0 ? 1 : 0);
    this.send(s, turn);
  }

  send(s, turn) {
    // Only report real changes, so online play doesn't flood the server.
    if (Math.abs(turn - s.turn) > 0.05 || (turn === 0 && s.turn !== 0)) {
      s.turn = turn;
      this.onChange(s.player, turn);
    }
  }

  // Called every frame: steer joystick players toward their chosen direction.
  tick() {
    for (const s of this.slots) {
      if (s.want === null || s.down.left.size || s.down.right.size) continue;
      const heading = this.getHeading ? this.getHeading(s.player) : null;
      if (heading == null) continue;
      const diff = Math.atan2(Math.sin(s.want - heading), Math.cos(s.want - heading));
      const turn = Math.abs(diff) < ALIGNED ? 0 : Math.max(-1, Math.min(1, diff * STICK_GAIN));
      this.send(s, turn);
    }
  }

  // Joystick targets, for drawing a direction arrow at each ride.
  aims() {
    return this.slots.filter((s) => s.want !== null).map((s) => ({ player: s.player, angle: s.want }));
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
