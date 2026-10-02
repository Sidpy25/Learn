// Keyboard + multi-touch controls. Each local human gets a LEFT and RIGHT
// button pair in their own corner of the screen (top players' pads are
// rotated so friends sitting opposite each other can share one phone).

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

  // humans: [{ player, color, name }]; single = whole-screen halves (online / 1 human)
  setup(humans, single = false) {
    this.root.innerHTML = '';
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

  clear() {
    this.slots = [];
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
      this.onChange(s.player, turn);
    }
  }
}
