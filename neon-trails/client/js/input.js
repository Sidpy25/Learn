// Keyboard + multi-touch controls. Each local human gets a LEFT and RIGHT
// button pair in their own corner of the screen (top players' pads are
// rotated so friends sitting opposite each other can share one phone).
// A lone touch player gets a floating joystick instead: drag anywhere and
// the ride turns toward that screen direction.

const STICK_RADIUS = 56; // px the knob can travel
const STICK_DEADZONE = 12; // px before a drag counts as steering
const STICK_GAIN = 2.4; // turn strength per radian of heading error

const KEYMAPS = [
  { left: ['KeyA'], right: ['KeyD'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'] },
  { left: ['KeyJ'], right: ['KeyL'] },
  { left: ['Digit4', 'Numpad4'], right: ['Digit6', 'Numpad6'] },
];
const CORNERS = ['bl', 'tr', 'tl', 'br'];
export const KEY_HINTS = ['A / D', '← / →', 'J / L', '4 / 6'];

export class Controls {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.slots = []; // [{ player, left:Set, right:Set, keyL, keyR }]
    this.pointers = new Map();
    this._key = (e) => this.handleKey(e);
    window.addEventListener('keydown', this._key);
    window.addEventListener('keyup', this._key);
  }

  // humans: [{ player, color, name }]
  // single: one touch player using the whole screen ('stick' or 'buttons').
  // getHeading(player) returns the ride's current angle for joystick steering.
  setup(humans, single = false, { style = 'stick', getHeading = null } = {}) {
    this.root.innerHTML = '';
    this.stick = null;
    if (single && style === 'stick') {
      this.setupStick(humans[0], getHeading);
      return;
    }
    this.slots = humans.map((h, k) => ({
      player: h.player,
      keys: single ? { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] } : KEYMAPS[k],
      down: { left: new Set(), right: new Set() },
      turn: 0,
    }));
    humans.forEach((h, k) => {
      const pad = document.createElement('div');
      pad.className = 'pad ' + (single ? 'pad-full' : 'pad-' + CORNERS[k]);
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
      if (!single) {
        const tag = document.createElement('div');
        tag.className = 'pad-tag';
        tag.textContent = h.name;
        pad.appendChild(tag);
      }
      this.root.appendChild(pad);
    });
  }

  setupStick(h, getHeading) {
    this.slots = [{
      player: h.player,
      keys: { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] },
      down: { left: new Set(), right: new Set() },
      turn: 0,
    }];
    const area = document.createElement('div');
    area.className = 'pad pad-stick';
    area.style.setProperty('--c', h.color);
    area.innerHTML = '<div class="stick-base"><div class="stick-knob"></div></div>' +
      '<div class="stick-hint"><b>Drag anywhere to steer</b>Your ride turns toward your finger</div>';
    const base = area.querySelector('.stick-base');
    const knob = area.querySelector('.stick-knob');
    const hint = area.querySelector('.stick-hint');
    const st = { player: h.player, getHeading, id: null, ox: 0, oy: 0, want: null, sent: 0 };
    this.stick = st;

    area.addEventListener('pointerdown', (e) => {
      if (st.id !== null) return; // one steering finger at a time
      e.preventDefault();
      area.setPointerCapture?.(e.pointerId);
      st.id = e.pointerId;
      st.ox = e.clientX; st.oy = e.clientY;
      st.want = null;
      base.style.transform = `translate(${st.ox}px, ${st.oy}px)`;
      knob.style.transform = 'translate(0px, 0px)';
      base.classList.add('on');
      hint.classList.add('gone');
    });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId !== st.id) return;
      let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
      const d = Math.hypot(dx, dy);
      // Drag past the rim and the base follows, so the thumb never runs out of room.
      if (d > STICK_RADIUS) {
        const k = (d - STICK_RADIUS) / d;
        st.ox += dx * k; st.oy += dy * k;
        dx = e.clientX - st.ox; dy = e.clientY - st.oy;
        base.style.transform = `translate(${st.ox}px, ${st.oy}px)`;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      st.want = d > STICK_DEADZONE ? Math.atan2(dy, dx) : null;
    });
    const up = (e) => {
      if (e.pointerId !== st.id) return;
      st.id = null;
      st.want = null;
      base.classList.remove('on');
    };
    area.addEventListener('pointerup', up);
    area.addEventListener('pointercancel', up);
    area.addEventListener('lostpointercapture', up);
    this.root.appendChild(area);
  }

  // Called every frame: steer the joystick player toward the dragged direction.
  tick() {
    const st = this.stick;
    if (!st) return;
    const slot = this.slots[0];
    if (slot.down.left.size || slot.down.right.size) return; // keyboard wins
    let turn = 0;
    const heading = st.getHeading ? st.getHeading(st.player) : null;
    if (st.want !== null && heading != null) {
      const diff = Math.atan2(Math.sin(st.want - heading), Math.cos(st.want - heading));
      turn = Math.max(-1, Math.min(1, diff * STICK_GAIN));
      if (Math.abs(turn) < 0.03) turn = 0;
    }
    // Only report real changes, so online play doesn't flood the server.
    if (Math.abs(turn - st.sent) > 0.06 || (turn === 0 && st.sent !== 0)) {
      st.sent = turn;
      slot.turn = turn;
      this.onChange(st.player, turn);
    }
  }

  clear() {
    this.slots = [];
    this.stick = null;
    this.root.innerHTML = '';
  }

  handleKey(e) {
    if (e.repeat) return;
    const isDown = e.type === 'keydown';
    this.slots.forEach((s, k) => {
      for (const side of ['left', 'right']) {
        if (s.keys[side].includes(e.code)) {
          if (isDown) s.down[side].add(e.code); else s.down[side].delete(e.code);
          e.preventDefault();
          this.update(k);
        }
      }
    });
  }

  update(k) {
    const s = this.slots[k];
    const turn = (s.down.right.size > 0 ? 1 : 0) - (s.down.left.size > 0 ? 1 : 0);
    if (turn !== s.turn) {
      s.turn = turn;
      if (this.stick) this.stick.sent = turn;
      this.onChange(s.player, turn);
    }
  }
}
