// Pip's Paper School: boots the engine, wires the HUD and switches between the hub and the activities.
import { S, resize, startLoop, manualStep, setPointerHandler, addUpdate, onLayout, startDrag } from './engine/core.js';
import { initDigits } from './engine/paper.js';
import { buildWorld } from './engine/world.js';
import { buildPip, say, pip, owlHop, owlCheer } from './engine/pip.js';
import { buildPencil } from './engine/pencil.js';
import { spawnFromTray, tray } from './engine/tray.js';
import { refreshStars, setLevels, showHUD, wiggleHelp, wipe } from './engine/ui.js';
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
import { stickersGame } from './games/stickers.js';
import { hub } from './games/hub.js';

const $ = s => document.querySelector(s);
const GAMES = { sums: sumsGame, minus: minusGame, blocks: blocksGame, clock: clockGame, frac: fracGame, flags: flagsGame, words: wordsGame, animals: animalsGame, stickers: stickersGame };
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
    setLevels(next.levels(), next.level, l => { next.setLevel(l); });
    next.enter(next.level);
  };
  if (instant) await swap(); else await wipe(swap);
  switching = false;
  const h = next === hub ? '' : '#' + next.id;
  if (location.hash !== h) history.pushState(null, '', h || location.pathname + location.search);
}
hub.onPick = id => go(id);
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
}
$('#mSound').addEventListener('click', () => { store.sound = !store.sound; save(); updateMenu(); sfx.tap(); });
$('#mVoice').addEventListener('click', () => { store.voice = !store.voice; save(); if (!store.voice) stopSpeech(); updateMenu(); });
$('#mLang').addEventListener('click', () => { setLang(lang === 'pl' ? 'en' : 'pl'); sfx.tap(); });
document.querySelectorAll('.langs .btn').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.lang); sfx.tap(); }));

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
  if (current) { setLevels(current.levels(), current.level, l => current.setLevel(l)); current.onLang(); }
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
  if (q.has('test')) { store.voice = false; window.__app = { go, S, games: GAMES, hub, current: () => current, colState, blkState, clockState, fracState, flagsState, wordsState, animalsState, spawnFromTray, trayKeys: () => tray ? tray.items.map(i => i.key) : [] }; }
  if (q.has('drive')) setInterval(() => { if (!window.__pause) manualStep(3); }, 30);
  if (q.has('auto')) start();
}
boot();
