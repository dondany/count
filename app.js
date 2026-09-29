// Pip's Paper School: boots the engine, wires the HUD and switches between the hub and the activities.
import { S, resize, startLoop, manualStep, setPointerHandler, addUpdate, onLayout, startDrag } from './engine/core.js';
import { initDigits } from './engine/paper.js';
import { buildWorld } from './engine/world.js';
import { buildPip, say, pip, owlHop, owlCheer } from './engine/pip.js';
import { buildPencil } from './engine/pencil.js';
import { spawnFromTray, tray } from './engine/tray.js';
import { refreshStars, setLevels, showHUD, wiggleHelp, wipe, setRoundHook } from './engine/ui.js';
import { recordRound, suggestLevel, dailyProgress, daily, statsFor } from './engine/stats.js';
import { wait } from './engine/util.js';
import { ensureAudio, sfx, stopSpeech } from './engine/audio.js';
import { store, save } from './engine/store.js';
import { tr, lang, setLang, onLang, applyDom } from './engine/i18n.js';
import { sumsGame, minusGame, colState } from './games/column.js';
import { blocksGame, blkState } from './games/blocks.js';
import { clockGame, clockState } from './games/clock.js';
import { fracGame, fracState } from './games/fractions.js';
import { flagsGame, flagsState } from './games/flags.js';
import { wordsGame, wordsState } from './games/words.js';
import { animalsGame, animalsState } from './games/animals.js';
import { stickersGame, ALL_STICKERS } from './games/stickers.js';
import { timesGame, timesState } from './games/times.js';
import { spaceGame, spaceState } from './games/space.js';
import { patternGame, patternState } from './games/pattern.js';
import { sceneGame } from './games/scene.js';
import { hub, nameKey } from './games/hub.js';

const $ = s => document.querySelector(s);
const GAMES = { sums: sumsGame, minus: minusGame, blocks: blocksGame, clock: clockGame, frac: fracGame, flags: flagsGame, words: wordsGame, animals: animalsGame, stickers: stickersGame,
  times: timesGame, space: spaceGame, pattern: patternGame, scene: sceneGame };
let current = null, switching = false;

/* ---------- switching activities (with #hash links you can share) ---------- */
async function go(id, { instant = false } = {}) {
  const next = GAMES[id] || hub;
  if (next === current || switching) return;
  switching = true; stopSpeech();
  const swap = async () => {
    if (current) current.exit();
    current = next;
    showHUD({ home: next !== hub, help: next !== hub });
    if (next !== hub && store.levels && store.levels[next.id] != null && next.levels().some(l => l.id === store.levels[next.id])) next.level = store.levels[next.id];
    setLevels(next.levels(), next.level, l => pickLevel(next, l));
    next.enter(next.level);
  };
  if (instant) await swap(); else await wipe(swap);
  switching = false;
  const h = next === hub ? '' : '#' + next.id;
  if (location.hash !== h) history.pushState(null, '', h || location.pathname + location.search);
}
hub.onPick = id => go(id);
// a level chosen in the HUD is remembered per activity
function pickLevel(g, l) { g.setLevel(l); if (g !== hub) { store.levels[g.id] = l; save(); } }

/* ---------- after every finished round: stats, daily challenge, adaptive difficulty ---------- */
setRoundHook(async ({ gameId, level, nStars, wrong }) => {
  recordRound(gameId, level ?? 0, nStars, wrong);
  const d = dailyProgress(gameId);
  if (d) {
    if (d.claimed) { say(tr('dailyDone')); sfx.win(); owlCheer(); await wait(2.8); }
    else { say(tr('dailyStep', d.done, d.goal)); owlHop(1); await wait(1.6); }
  }
  const g = GAMES[gameId];
  if (!g || g !== current || typeof level !== 'number') return;
  const ids = g.levels().map(l => l.id), nl = suggestLevel(gameId, level, ids);
  if (nl === level) return;
  g.adopt(nl); store.levels[gameId] = nl; save();
  setLevels(g.levels(), nl, l => pickLevel(g, l));
  const label = g.levels().find(l => l.id === nl).label;
  say(nl > level ? tr('levelUp', label) : tr('levelDown', label)); owlHop(1.2);
  await wait(2.6);
});
const fromHash = () => { if (S.started) go(location.hash.slice(1)); };
addEventListener('popstate', fromHash);
addEventListener('hashchange', fromHash);

/* ---------- input + per-frame ---------- */
setPointerHandler((o, e) => {
  if (!current || switching) return;
  const k = o && o.userData.kind;
  if (k === 'owl') { owlHop(1); sfx.hoot(); if (pip.lastSay) say(pip.lastSay, { hop: false, speech: pip.lastSpeech }); return; }
  if (k === 'tray') {
    if (current.canDrag()) startDrag(spawnFromTray(o.userData.key), e, current.dragOpts());
    else o.userData.j.punch(0.3);
    return;
  }
  current.pointer(o, e);
});
addUpdate((dt, t) => {
  if (!current) return;
  current.update(dt, t);
  // a gentle nudge when a child has been stuck for a while
  if (!switching && current.idle() && S.time - S.lastAct > 16 && !S.nudged) {
    S.nudged = true; S.lastAct = S.time; owlHop(1); sfx.hoot();
    say(`${tr('nudge')} ${current.prompt()}`); wiggleHelp(true);
  }
});
onLayout(() => { if (current) current.relayout(); });

/* ---------- HUD ---------- */
$('#home').addEventListener('click', () => { ensureAudio(); sfx.tap(); go('hub'); });
$('#help').addEventListener('click', () => { ensureAudio(); S.lastAct = S.time; if (current && !switching) current.help(); });
$('#gear').addEventListener('click', e => { e.stopPropagation(); ensureAudio(); sfx.tap(); $('#menu').classList.toggle('hidden'); });
addEventListener('pointerdown', e => { if (!e.target.closest('#menu') && !e.target.closest('#gear')) $('#menu').classList.add('hidden'); });
function updateMenu() {
  $('#mSound .lbl').textContent = `${tr('sound')}: ${store.sound ? tr('on') : tr('off')}`;
  $('#mVoice .lbl').textContent = `${tr('voice')}: ${store.voice ? tr('on') : tr('off')}`;
  $('#mLang .lbl').textContent = tr('language');
  $('#mSound .emo').textContent = store.sound ? '🔊' : '🔈';
  $('#home').title = tr('home');
  $('#mParents .lbl').textContent = tr('mParents');
}
$('#mSound').addEventListener('click', () => { store.sound = !store.sound; save(); updateMenu(); sfx.tap(); });
$('#mVoice').addEventListener('click', () => { store.voice = !store.voice; save(); if (!store.voice) stopSpeech(); updateMenu(); });
$('#mLang').addEventListener('click', () => { setLang(lang === 'pl' ? 'en' : 'pl'); sfx.tap(); });
document.querySelectorAll('.langs .btn').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.lang); sfx.tap(); }));

/* ---------- parent corner (behind a grown-up question) ---------- */
let gate = null;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function openParents(unlocked = false) {
  $('#menu').classList.add('hidden'); $('#parents').classList.remove('hidden');
  $('#pTitle').textContent = tr('pcTitle'); $('#pGo').textContent = tr('pcEnter'); $('#pErr').textContent = '';
  if (unlocked && !$('#pBody').classList.contains('hidden')) return renderParents();
  gate = [6 + Math.floor(Math.random() * 4), 6 + Math.floor(Math.random() * 4)];
  $('#pQ').textContent = tr('pcGate', ...gate); $('#pA').value = '';
  $('#pGate').classList.remove('hidden'); $('#pBody').classList.add('hidden');
  setTimeout(() => $('#pA').focus(), 50);
}
function checkGate() {
  if (+$('#pA').value === gate[0] * gate[1]) { $('#pGate').classList.add('hidden'); $('#pBody').classList.remove('hidden'); renderParents(); }
  else { $('#pErr').textContent = tr('pcWrongGate'); $('#pA').value = ''; }
}
function renderParents() {
  const ids = Object.keys(GAMES).filter(id => id !== 'stickers' && id !== 'scene');
  let rounds = 0, stars = 0;
  const rows = ids.map(id => {
    const st = statsFor(id), g = GAMES[id], lv = g.levels().find(l => l.id === (store.levels[id] ?? g.level));
    rounds += st.rounds; stars += st.stars;
    const last = st.last ? new Date(st.last).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB') : tr('pcNever');
    return `<tr><td>${esc(tr(nameKey(id)))}</td><td>${lv ? esc(lv.emoji + ' ' + lv.label) : ''}</td><td class="n">${st.rounds}</td><td class="n">${st.stars}</td>
      <td class="n">${st.rounds ? (st.stars / st.rounds).toFixed(1) : '—'}</td><td>${esc(last)}</td></tr>`;
  }).join('');
  const mk = tr('mk');
  const mistakes = ids.map(id => {
    const m = Object.entries(statsFor(id).mistakes).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return m.length ? `<h3>${esc(tr(nameKey(id)))}</h3><ul>${m.map(([k, n]) => `<li>${esc(mk[k] || k)} — <b>${n}×</b></li>`).join('')}</ul>` : '';
  }).join('') || `<p>${esc(tr('pcNone'))}</p>`;
  const d = daily();
  $('#pBody').innerHTML = `
    <div class="psum">${esc(tr('pcSummary', rounds, stars, store.stickers.length, ALL_STICKERS.length))}</div>
    <table class="ptable"><tr><th>${tr('pcActivity')}</th><th>${tr('pcLevel')}</th><th>${tr('pcRounds')}</th><th>${tr('pcStars')}</th><th>${tr('pcAvg')}</th><th>${tr('pcLast')}</th></tr>${rows}</table>
    <div class="pmist"><h3>${esc(tr('pcMistakes'))}</h3>${mistakes}</div>
    <div class="psum">${esc(tr('pcDaily'))}: ${esc(tr(nameKey(d.game)))} — ${d.claimed ? '✓' : `${d.done}/${d.goal}`}</div>
    <div class="prow"><label><input type="checkbox" id="pAdaptive" ${store.adaptive !== false ? 'checked' : ''}> ${esc(tr('pcAdaptive'))}</label></div>
    <div class="prow"><button class="btn" id="pReset">🗑️ ${esc(tr('pcReset'))}</button></div>`;
  $('#pAdaptive').addEventListener('change', e => { store.adaptive = e.target.checked; save(); });
  $('#pReset').addEventListener('click', () => {
    if (!confirm(tr('pcResetAsk'))) return;
    Object.assign(store, { stars: {}, spent: 0, stickers: [], freePacks: 0, levels: {}, stats: {}, daily: null, scene: [] }); save();
    refreshStars(); renderParents(); if (current === hub) { hub.exit(); hub.enter(); }
  });
}
$('#mParents').addEventListener('click', () => { ensureAudio(); sfx.tap(); openParents(); });
$('#pClose').addEventListener('click', () => { $('#parents').classList.add('hidden'); });
$('#pGo').addEventListener('click', checkGate);
$('#pA').addEventListener('keydown', e => { if (e.key === 'Enter') checkGate(); });
$('#parents').addEventListener('pointerdown', e => { if (e.target.id === 'parents') $('#parents').classList.add('hidden'); });

function buildTitle() {
  document.title = tr('appName');
  if (!$('#title')) return; // the title screen is gone once the game has started
  const cols = ['#e8574a', '#f08a3c', '#e9a825', '#6fae52', '#2f9e97', '#3f7fc1', '#7a5cc4', '#d9508f', '#a0643b'];
  let i = 0;
  $('#title').innerHTML = tr('title').map(w => `<span class="word">${[...w].map(ch => {
    const k = i++; return `<span style="color:${cols[k % cols.length]};--r2:${(k % 2 ? 1 : -1) * 4}deg;animation-delay:${k * 0.12}s;transform:rotate(${(k % 3 - 1) * 4}deg)">${ch}</span>`;
  }).join('')}</span>`).join(' ');
  $('#subtitle').innerHTML = tr('subtitle');
  document.querySelectorAll('.langs .btn').forEach(b => b.classList.toggle('sel', b.dataset.lang === lang));
  if (S.started || !$('#play').disabled) $('#play').textContent = tr('play');
}
onLang(() => {
  updateMenu(); buildTitle();
  if (current) { setLevels(current.levels(), current.level, l => pickLevel(current, l)); current.onLang(); }
  if (!$('#parents').classList.contains('hidden')) openParents(true);
});

/* ---------- boot ---------- */
function start() {
  if (S.started) return;
  ensureAudio(); S.started = true;
  $('#start').classList.add('hide'); setTimeout(() => $('#start').remove(), 600);
  sfx.whoosh(); owlCheer();
  go(location.hash.slice(1), { instant: true });
}
async function boot() {
  applyDom(); updateMenu(); buildTitle(); refreshStars();
  try {
    await Promise.race([
      Promise.all(['700', '600'].flatMap(w => ['Fredoka', "'Baloo 2'"].map(f => document.fonts.load(`${w} 100px ${f}`, 'AaąęłńóśćźżĄĘŁŃÓŚĆŹŻ')))),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  } catch (e) {}
  initDigits(); buildWorld(); buildPip(); buildPencil();
  const q = new URLSearchParams(location.search);
  resize();
  if (!q.has('drive')) startLoop();
  const play = $('#play'); play.disabled = false; play.textContent = tr('play');
  play.addEventListener('click', start);
  // test hooks: ?test exposes the app, ?drive steps the simulation from timers, ?auto skips the title screen
  if (q.has('test')) { store.voice = false; window.__app = { go, S, games: GAMES, hub, current: () => current, colState, blkState, clockState, fracState, flagsState, wordsState, animalsState, timesState, spaceState, patternState, spawnFromTray, openParents, trayKeys: () => tray ? tray.items.map(i => i.key) : [] }; }
  if (q.has('drive')) setInterval(() => { if (!window.__pause) manualStep(3); }, 30);
  if (q.has('auto')) start();
}
boot();
