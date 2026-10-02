import { Game, COLORS, COLOR_NAMES, POWERUPS, DT, MAX_PLAYERS } from '../shared/game.js';
import { Renderer } from './render.js';
import { Controls } from './input.js';
import { sfx, unlockAudio, configureAudio, haptic } from './audio.js';
import { loadProfile, saveProfile, levelFor, xpForLevel, awardMatch } from './profile.js';
import { Net, serverUrl } from './net.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const profile = loadProfile();
const renderer = new Renderer($('#game'));
const controls = new Controls($('#pads'), onTurn);

let mode = 'attract'; // attract | local | online
let game = null;
let view = null;
let paused = false;
let acc = 0;
let lastSec = 0;
let localHumans = [];
let net = null;
let online = null; // { you, room, inGame }
let afterConnect = null;

const BOT_NAMES = ['Volt', 'Nova', 'Pixel', 'Blitz', 'Echo', 'Zed', 'Lumen', 'Rogue'];
const slotKinds = ['human', 'human', 'bot', 'off'];

// ---------------------------------------------------------------- screens
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  if (id === 'menu') renderProfileChip();
  if (id === 'local') renderSlots();
  if (id === 'settings') renderSettings();
  if (id === 'online') $('#nameInput').value = profile.name;
}
function hideScreens() {
  $$('.screen').forEach((s) => s.classList.add('hidden'));
}

$$('[data-go]').forEach((b) =>
  b.addEventListener('click', () => {
    sfx('click');
    show(b.dataset.go);
  }),
);

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

function renderProfileChip() {
  const lvl = levelFor(profile.xp);
  const lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1);
  const pct = Math.round(((profile.xp - lo) / (hi - lo)) * 100);
  $('#profileChip').innerHTML =
    `<div class="lvl" style="--p:${pct}%"><span>${lvl}</span></div>` +
    `<div><b>${escapeHtml(profile.name || 'Pilot')}</b><div class="meta">${profile.wins} wins · streak ${profile.streak}</div></div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------------------------------------------------------------- local setup
function renderSlots() {
  const el = $('#slots');
  el.innerHTML = '';
  let humanNo = 0;
  slotKinds.forEach((kind, i) => {
    const d = document.createElement('div');
    d.className = 'slot' + (kind === 'off' ? ' off' : '');
    d.style.setProperty('--c', COLORS[i]);
    const label = kind === 'human' ? `Player ${++humanNo}` : kind === 'bot' ? 'Bot' : 'Off';
    const keys = kind === 'human' ? ['A / D', '← / →', 'J / L', '4 / 6'][humanNo - 1] : '';
    d.innerHTML = `<div class="dot"></div><div class="who">${COLOR_NAMES[i]}</div><div class="kind">${label}${keys ? ' · ' + keys : ''}</div>`;
    d.addEventListener('click', () => {
      sfx('click');
      const order = ['human', 'bot', 'off'];
      slotKinds[i] = order[(order.indexOf(kind) + 1) % 3];
      renderSlots();
    });
    el.appendChild(d);
  });
  const active = slotKinds.filter((k) => k !== 'off').length;
  $('#startLocal').disabled = active < 2;
}

$('#startLocal').addEventListener('click', () => {
  sfx('click');
  startLocal();
});

function startLocal() {
  const players = [];
  const colorIdx = [];
  let humanNo = 0;
  const bots = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  slotKinds.forEach((kind, i) => {
    if (kind === 'off') return;
    colorIdx.push(i);
    if (kind === 'human') players.push({ name: `P${++humanNo}`, color: COLORS[i], bot: false });
    else players.push({ name: bots.pop(), color: COLORS[i], bot: true });
  });
  if (humanNo === 1) players.find((p) => !p.bot).name = profile.name || 'You';
  game = new Game(players);
  localHumans = players.map((p, i) => ({ player: i, color: p.color, name: p.name, bot: p.bot })).filter((p) => !p.bot);
  mode = 'local';
  paused = false;
  enterGame(game.meta());
  controls.setup(localHumans, touchOpts());
}

function touchOpts() {
  return { touch: isTouch(), style: profile.settings.touch, getHeading: (i) => (view && view.p[i] ? view.p[i][2] : null) };
}

function isTouch() {
  return matchMedia('(pointer: coarse)').matches;
}

function enterGame(meta) {
  renderer.setPlayers(meta.players);
  renderer.clearTrails();
  renderer.particles.length = 0;
  renderer.banners = [];
  renderer.hud = true;
  acc = 0;
  hideScreens();
  $('#pauseBtn').classList.remove('hidden');
  document.body.classList.add('in-game');
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* not supported */ }
}

function onTurn(player, turn) {
  if (mode === 'local' && game) game.setInput(player, turn);
  else if (mode === 'online' && net) net.send({ t: 'in', d: turn });
}

// ---------------------------------------------------------------- attract mode
function startAttract() {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  game = new Game(COLORS.map((c, i) => ({ name: names[i], color: c, bot: true })));
  mode = 'attract';
  paused = false;
  renderer.setPlayers(game.meta().players);
  renderer.clearTrails();
  renderer.hud = false;
  controls.clear();
  $('#pauseBtn').classList.add('hidden');
  document.body.classList.remove('in-game');
}

// ---------------------------------------------------------------- pause / quit
$('#pauseBtn').addEventListener('click', () => {
  sfx('click');
  if (mode === 'local') paused = true;
  $('#resumeBtn').textContent = mode === 'online' ? 'Back to game' : 'Resume';
  $('#quitBtn').textContent = mode === 'online' ? 'Leave match' : 'Quit to menu';
  show('pause');
});
$('#resumeBtn').addEventListener('click', () => {
  paused = false;
  hideScreens();
});
$('#quitBtn').addEventListener('click', () => quitToMenu());

function quitToMenu() {
  if (net) {
    net.close();
    net = null;
    online = null;
  }
  startAttract();
  show('menu');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'local' && !paused) $('#pauseBtn').click();
});

// ---------------------------------------------------------------- results
function showResults(winnerIndex) {
  const meta = renderer.players;
  const ranked = view.p.map((p, i) => ({ i, score: p[4] })).sort((a, b) => b.score - a.score);
  const winner = meta[winnerIndex];
  $('#resultTitle').textContent = winner ? `${winner.name} wins!` : 'Match over';
  $('#resultTitle').style.textShadow = winner ? `0 0 14px ${winner.color}, 0 0 34px ${winner.color}` : '';
  $('#podium').innerHTML = ranked
    .map((r, k) => {
      const p = meta[r.i];
      return `<div class="pl" style="--c:${p.color};animation-delay:${k * 0.08}s"><span class="rank">#${k + 1}</span><span class="nm">${escapeHtml(p.name)}${p.bot ? ' 🤖' : ''}</span><span class="sc">${r.score}</span></div>`;
    })
    .join('');

  // Reward the device owner: the only local human, or the online player.
  let me = -1;
  if (mode === 'online') me = online.you;
  else if (localHumans.length >= 1) me = localHumans[0].player;
  $('#reward').textContent = '';
  if (me >= 0) {
    const placed = ranked.findIndex((r) => r.i === me) + 1;
    const res = awardMatch(profile, { score: view.p[me][4], won: winnerIndex === me, placed, players: view.p.length });
    $('#reward').textContent = `+${res.xp} XP` + (res.levelUp ? `  ·  LEVEL UP! You are now level ${res.level}` : '');
    if (res.levelUp) setTimeout(() => sfx('win'), 600);
  }
  sfx('win');
  if (profile.settings.haptics) haptic([60, 40, 60]);
  $('#againBtn').textContent = mode === 'online' && online.room && !online.room.quick ? 'Back to room' : 'Play again';
  show('results');
}

$('#againBtn').addEventListener('click', () => {
  sfx('click');
  if (mode === 'local') startLocal();
  else if (mode === 'online' && online && net) {
    startAttract();
    if (online.room && !online.room.quick) renderLobby(online.room);
    else {
      show('online');
      net.send({ t: 'quick' });
    }
  }
});
$('#menuBtn').addEventListener('click', () => {
  sfx('click');
  quitToMenu();
});

// ---------------------------------------------------------------- events
function handleEvents(events) {
  const audible = mode !== 'attract';
  renderer.handleEvents(events, audible ? sfx : null);
  for (const e of events) {
    if (e.type === 'round') controls.reset();
    if (e.type === 'death' && audible && profile.settings.haptics) {
      const mine = mode === 'online' ? e.i === online.you : localHumans.some((h) => h.player === e.i);
      haptic(mine ? 180 : 40);
    }
    if (e.type === 'matchEnd') {
      if (mode === 'attract') setTimeout(() => mode === 'attract' && startAttract(), 1500);
      else setTimeout(() => showResults(e.winner), 600);
    }
  }
}

function countdownBeeps() {
  if (!view || mode === 'attract' || view.st !== 'countdown') return;
  const sec = Math.ceil(view.tm / 60 - 0.6);
  if (sec !== lastSec && sec >= 1) sfx('tick');
  lastSec = sec;
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
let slowFrames = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) controls.tick();
  if ((mode === 'local' || mode === 'attract') && game) {
    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < 6) {
        game.step();
        acc -= DT;
        steps++;
      }
      if (steps === 6) acc = 0;
      renderer.addSegments(game.drainSegs());
      view = game.snapshot();
      handleEvents(game.drainEvents());
    }
  }
  countdownBeeps();
  renderer.aims = mode === 'attract' ? [] : controls.aims();
  renderer.draw(view, paused ? 0 : dt);

  // Auto-lower quality on slow devices.
  if (profile.settings.quality >= 1) {
    slowFrames = dt > 1 / 40 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    renderer.quality = slowFrames > 90 ? 0 : 1;
  } else renderer.quality = 0;
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- online
function connect(then) {
  const name = ($('#nameInput').value || '').trim().slice(0, 12) || 'Pilot';
  profile.name = $('#nameInput').value.trim().slice(0, 12);
  saveProfile(profile);
  if (net && net.ws.readyState === 1) {
    net.send({ t: 'hello', name });
    then();
    return;
  }
  if (net) net.close();
  $('#onlineStatus').textContent = 'Connecting…';
  afterConnect = then;
  let url;
  try { url = serverUrl(profile.settings.server); } catch { url = ''; }
  try {
    net = new Net(url, {
      open: () => {
        $('#onlineStatus').textContent = '';
        net.send({ t: 'hello', name });
        afterConnect && afterConnect();
        afterConnect = null;
      },
      message: onNetMessage,
      close: () => {
        const wasPlaying = mode === 'online';
        net = null;
        online = null;
        if (wasPlaying) {
          toast('Connection lost');
          quitToMenu();
        } else {
          $('#onlineStatus').textContent = "Can't reach the server. Check your connection, or play Party Mode offline!";
        }
      },
    });
  } catch {
    $('#onlineStatus').textContent = 'Invalid server address (see Settings).';
  }
}

$('#quickBtn').addEventListener('click', () => { sfx('click'); unlockAudio(); connect(() => net.send({ t: 'quick' })); });
$('#createBtn').addEventListener('click', () => { sfx('click'); unlockAudio(); connect(() => net.send({ t: 'create' })); });
$('#joinBtn').addEventListener('click', () => {
  sfx('click');
  const code = $('#codeInput').value.trim().toUpperCase();
  if (code.length !== 4) { $('#onlineStatus').textContent = 'Enter the 4-letter room code.'; return; }
  connect(() => net.send({ t: 'join', code }));
});
$('#leaveBtn').addEventListener('click', () => { sfx('click'); if (net) net.send({ t: 'leave' }); online = null; show('online'); });
$('#addBotBtn').addEventListener('click', () => { sfx('click'); net && net.send({ t: 'addbot' }); });
$('#startOnline').addEventListener('click', () => { sfx('click'); net && net.send({ t: 'start' }); });

function onNetMessage(m) {
  switch (m.t) {
    case 'room': {
      online = { ...(online || {}), room: m, you: m.you };
      // Keep the results screen up; "Back to room" shows the lobby later.
      if (!$('#results').classList.contains('hidden')) break;
      if (mode === 'online' && view && view.st === 'matchEnd') break;
      if (mode === 'online') startAttract();
      renderLobby(m);
      break;
    }
    case 'start': {
      online = { ...(online || {}), you: m.you, inGame: true };
      mode = 'online';
      view = null;
      enterGame(m.meta);
      const me = m.meta.players[m.you];
      controls.setup([{ player: m.you, color: me.color, name: me.name }], touchOpts());
      toast(`You are ${COLOR_NAMES[COLORS.indexOf(me.color)] || 'in'} — good luck!`);
      break;
    }
    case 's': {
      if (mode !== 'online') break;
      renderer.addSegments(m.g);
      view = m.s;
      handleEvents(m.e);
      break;
    }
    case 'left':
      toast(`${m.name} left — a bot took over`);
      break;
    case 'err':
      $('#onlineStatus').textContent = m.msg;
      toast(m.msg);
      break;
  }
}

function renderLobby(room) {
  show('lobby');
  $('#lobbyTitle').textContent = room.quick ? 'Quick Match' : 'Private Room';
  $('#codeBox').textContent = room.code;
  $('#codeBox').classList.toggle('hidden', !!room.quick);
  const isHost = room.host === room.you;
  $('#lobbyHint').textContent = room.quick
    ? `Finding players… starting in ${room.startIn}s`
    : isHost
      ? 'Share this code with friends. Add bots or start when ready.'
      : 'Waiting for the host to start…';
  $('#startOnline').classList.toggle('hidden', !isHost || room.quick);
  $('#addBotBtn').classList.toggle('hidden', !isHost || room.quick);
  $('#startOnline').disabled = room.players.length < 2;
  $('#addBotBtn').disabled = room.players.length >= MAX_PLAYERS;
  const el = $('#lobbyPlayers');
  el.innerHTML = '';
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const p = room.players[i];
    const d = document.createElement('div');
    d.className = 'slot' + (p ? '' : ' off');
    d.style.setProperty('--c', COLORS[i]);
    d.innerHTML = p
      ? `<div class="dot"></div><div class="who">${escapeHtml(p.name)}</div><div class="kind">${p.bot ? 'Bot' : i === room.you ? '<span class="you">You</span>' : 'Player'}${i === room.host ? ' · Host' : ''}</div>`
      : `<div class="dot"></div><div class="who">Open</div><div class="kind">waiting…</div>`;
    el.appendChild(d);
  }
}

// ---------------------------------------------------------------- settings & how-to
function renderSettings() {
  const s = profile.settings;
  $('#setSound').checked = s.sound;
  $('#setMusic').checked = s.music;
  $('#setHaptics').checked = s.haptics;
  $('#setQuality').checked = s.quality >= 1;
  $('#setTouch').value = s.touch;
  $('#setServer').value = s.server || '';
  $('#stats').innerHTML = `Level ${levelFor(profile.xp)} · ${profile.xp} XP<br>${profile.matches} matches · ${profile.wins} wins · best streak ${profile.bestStreak}`;
}
for (const [id, key] of [['#setSound', 'sound'], ['#setMusic', 'music'], ['#setHaptics', 'haptics']]) {
  $(id).addEventListener('change', (e) => {
    profile.settings[key] = e.target.checked;
    saveProfile(profile);
    configureAudio(profile.settings);
  });
}
$('#setTouch').addEventListener('change', (e) => {
  profile.settings.touch = e.target.value;
  saveProfile(profile);
});
$('#setQuality').addEventListener('change', (e) => {
  profile.settings.quality = e.target.checked ? 1 : 0;
  saveProfile(profile);
});
$('#setServer').addEventListener('change', (e) => {
  profile.settings.server = e.target.value.trim();
  saveProfile(profile);
});

$('#puList').innerHTML = Object.entries(POWERUPS)
  .map(([, d]) => {
    const desc = { Boost: 'You go faster', Ghost: 'Pass through trails', Freeze: 'Rivals slow down', Fatten: 'Rivals leave fat trails', Reverse: 'Rivals’ controls flip', Portal: 'Walls wrap around', Wipe: 'Clears every trail' }[d.label];
    return `<div class="pu" style="--c:${d.color}"><i></i><div><b>${d.label}</b><br>${desc}</div></div>`;
  })
  .join('');

// ---------------------------------------------------------------- boot
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('pointerdown', () => unlockAudio(), { once: false, passive: true });
window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.code === 'Escape' && mode !== 'attract' && $('#pause').classList.contains('hidden') && $('#results').classList.contains('hidden')) $('#pauseBtn').click();
});
configureAudio(profile.settings);

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

startAttract();
show('menu');
requestAnimationFrame(frame);

// Exposed for automated smoke tests.
window.__neon = { get mode() { return mode; }, get view() { return view; }, get online() { return online; } };
