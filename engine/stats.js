// Progress tracking for the parent corner, adaptive difficulty and the daily challenge.
import { store, save } from './store.js';

export function statsFor(id) {
  store.stats = store.stats || {};
  return store.stats[id] || (store.stats[id] = { rounds: 0, stars: 0, wrong: 0, last: 0, mistakes: {}, levels: {} });
}
export function recordMistake(id, why) { const s = statsFor(id); s.mistakes[why] = (s.mistakes[why] || 0) + 1; save(); }
export function recordRound(id, level, nStars, wrong = 0) {
  const s = statsFor(id);
  s.rounds++; s.stars += nStars; s.wrong += wrong; s.last = Date.now();
  const L = s.levels[level] || (s.levels[level] = { rounds: 0, stars: 0, recent: [] });
  L.rounds++; L.stars += nStars; L.recent = [...L.recent, nStars].slice(-5);
  save();
}

// Adaptive difficulty: three 3-star rounds in a row -> level up; two 1-star rounds in a row -> level down.
export function suggestLevel(id, level, levelIds) {
  if (store.adaptive === false || typeof level !== 'number') return level;
  const nums = levelIds.filter(l => typeof l === 'number'), L = statsFor(id).levels[level];
  const r = L ? L.recent : [];
  let next = level;
  if (r.length >= 3 && r.slice(-3).every(x => x === 3) && level < Math.max(...nums)) next = level + 1;
  else if (r.length >= 2 && r.slice(-2).every(x => x === 1) && level > Math.min(...nums)) next = level - 1;
  if (next !== level) { L.recent = []; save(); }
  return next;
}

// Daily challenge: one activity per calendar day, win 3 rounds of it for a free sticker pack.
const DAILY_GAMES = ['sums', 'minus', 'blocks', 'times', 'clock', 'frac', 'words', 'flags', 'animals', 'space', 'pattern'];
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function daily() {
  const date = localDate();
  if (!store.daily || store.daily.date !== date) {
    let h = 7; for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    store.daily = { date, game: DAILY_GAMES[h % DAILY_GAMES.length], done: 0, goal: 3, claimed: false };
    save();
  }
  return store.daily;
}
// returns the challenge if this round counted towards it
export function dailyProgress(id) {
  const d = daily();
  if (d.game !== id || d.claimed) return null;
  d.done++;
  if (d.done >= d.goal) { d.claimed = true; store.freePacks = (store.freePacks || 0) + 1; }
  save();
  return d;
}
