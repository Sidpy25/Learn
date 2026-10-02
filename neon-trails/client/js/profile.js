// Local progression: XP, levels, stats and settings, kept on the device.
const KEY = 'neon-trails-profile-v1';

const defaults = {
  name: '',
  xp: 0,
  matches: 0,
  wins: 0,
  bestStreak: 0,
  streak: 0,
  settings: { sound: true, music: true, haptics: true, quality: 1, server: '' },
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...defaults, ...p, settings: { ...defaults.settings, ...(p.settings || {}) } };
    }
  } catch { /* storage unavailable */ }
  return structuredClone(defaults);
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function levelFor(xp) {
  return Math.floor(Math.sqrt(xp / 60)) + 1;
}

export function xpForLevel(level) {
  return (level - 1) * (level - 1) * 60;
}

// Award XP for a finished match; returns a summary for the results screen.
export function awardMatch(profile, { score, won, placed, players }) {
  const before = levelFor(profile.xp);
  let xp = 20 + score * 6;
  if (won) xp += 60 + 10 * (players - 2);
  else if (placed === 2) xp += 20;
  profile.xp += xp;
  profile.matches++;
  if (won) {
    profile.wins++;
    profile.streak++;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
  } else {
    profile.streak = 0;
  }
  saveProfile(profile);
  const after = levelFor(profile.xp);
  return { xp, levelUp: after > before, level: after };
}
