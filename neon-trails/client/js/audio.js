// Synthesised sound effects and a light synthwave loop — no audio files needed.
let ac = null;
let master = null;
let musicGain = null;
let musicTimer = null;
const settings = { sound: true, music: true };

export function configureAudio(opts) {
  Object.assign(settings, opts);
  if (musicGain) musicGain.gain.value = settings.music ? 0.22 : 0;
  if (master) master.gain.value = settings.sound ? 0.8 : 0;
}

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = settings.sound ? 0.8 : 0;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    musicGain = ac.createGain();
    musicGain.gain.value = settings.music ? 0.22 : 0;
    musicGain.connect(master);
    startMusic();
  }
  if (ac.state === 'suspended') ac.resume();
}

function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, when = 0, dest = master) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.4, filterFreq = 1200) {
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(filterFreq, ac.currentTime);
  f.frequency.exponentialRampToValueAtTime(80, ac.currentTime + dur);
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export function sfx(name, arg) {
  if (!ac || !settings.sound) return;
  switch (name) {
    case 'death':
      noise(0.6, 0.5, 2400);
      tone(220, 0.45, 'sawtooth', 0.18, -180);
      break;
    case 'pickup':
      tone(660, 0.09, 'square', 0.12);
      tone(990, 0.12, 'square', 0.12, 0, 0.07);
      tone(1320, 0.18, 'triangle', 0.14, 0, 0.14);
      if (arg === 'wipe') noise(0.4, 0.25, 6000);
      break;
    case 'spawn':
      tone(1800, 0.08, 'sine', 0.05, -600);
      break;
    case 'tick':
      tone(440, 0.12, 'triangle', 0.2);
      break;
    case 'go':
      tone(880, 0.25, 'triangle', 0.25);
      tone(1320, 0.3, 'sine', 0.15, 0, 0.05);
      break;
    case 'round':
      tone(330, 0.15, 'triangle', 0.12, 200);
      break;
    case 'roundEnd':
      tone(523, 0.15, 'triangle', 0.18);
      tone(659, 0.15, 'triangle', 0.18, 0, 0.12);
      tone(784, 0.3, 'triangle', 0.18, 0, 0.24);
      break;
    case 'win':
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.25, 'square', 0.1, 0, i * 0.12));
      break;
    case 'click':
      tone(1200, 0.05, 'square', 0.06);
      break;
  }
}

// Minor-key arpeggio over a pulsing bass: Am - F - C - G.
function startMusic() {
  const chords = [
    [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62],
  ];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const stepDur = 0.15;
  let step = 0;
  let next = ac.currentTime + 0.1;
  const schedule = () => {
    while (next < ac.currentTime + 0.4) {
      const chord = chords[Math.floor(step / 16) % chords.length];
      const when = next - ac.currentTime;
      if (step % 2 === 0) tone(mtof(chord[0] - 24), stepDur * 1.8, 'sawtooth', 0.22, 0, when, musicGain);
      const note = chord[[0, 1, 2, 1][step % 4]] + (step % 8 >= 4 ? 12 : 0);
      tone(mtof(note), stepDur * 0.9, 'triangle', 0.1, 0, when, musicGain);
      next += stepDur;
      step++;
    }
  };
  musicTimer = setInterval(schedule, 100);
  schedule();
}

export function haptic(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
}
