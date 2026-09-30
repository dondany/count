// "Words": look at the paper picture, listen to Pip, and spell the word with letter tiles.
import * as THREE from 'three';
import { rint, pick, lerp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, RIM, DIGIT_COLORS, font, cutShared, sharedMesh, paint, text, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx, speak } from '../engine/audio.js';
import { tr, lang } from '../engine/i18n.js';
import { say, note, firstTime, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';
import { PICS } from './pictures.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SP = 1.5; // slot spacing
const ALPHA = { en: 'ABCDEFGHIJKLMNOPRSTUWY', pl: 'ABCDEFGHIJKLMNOPRSTUWYZŁŚŻ' };
const W = {
  level: 1, id: null, word: '', letters: [], slots: [], group: null, card: null, busy: true, round: 0, help: 0,
  problemWrong: 0, stepWrong: 0, promptFn: () => '', recent: [],
};

/* ---------- letters ---------- */
let capH = 0;
const letterMat = ch => cutShared('let' + ch, 1.5, 1.95, (ctx, P) => {
  if (!capH) { const m = document.createElement('canvas').getContext('2d'); m.font = font(100); capH = m.measureText('H').actualBoundingBoxAscent / 100; }
  const size = 1.02 / capH; // every letter sits on the same baseline; accents go up into the padding
  ctx.save(); ctx.scale(1 / P.res, 1 / P.res); ctx.font = font(size * P.res); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const y = 0.51 * P.res + 0.12 * P.res;
  if (P.rim) { ctx.lineWidth = P.rimW * 2 * P.res; ctx.strokeStyle = RIM; ctx.fillStyle = RIM; ctx.strokeText(ch, 0, y); ctx.fillText(ch, 0, y); }
  else { ctx.shadowColor = 'rgba(74,52,38,0.3)'; ctx.shadowBlur = 0.05 * P.res; ctx.shadowOffsetY = 0.025 * P.res; ctx.fillStyle = DIGIT_COLORS[ch.charCodeAt(0) % 10]; ctx.fillText(ch, 0, y); }
  ctx.restore();
}, { res: 150, rim: 0.11 });
const slotMat = () => cutShared('wslot', 1.35, 1.55, (ctx) => {
  rr(ctx, -0.625, -0.73, 1.25, 1.46, 0.22); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
  ctx.setLineDash([0.17, 0.12]); ctx.lineWidth = 0.07; ctx.strokeStyle = 'rgba(74,52,38,0.7)'; ctx.stroke();
}, { res: 100, rim: 0, pad: 0.04 });
const picMat = id => cutShared('wpic' + id, 4.6, 3.9, (ctx, P) => {
  tornRect(ctx, -2.3, -1.95, 4.6, 3.9, 0.3, 0.035, id.length * 11); paint(ctx, P, '#fff8ec', { shadow: false });
  if (P.rim) return;
  ctx.save(); ctx.scale(1.25, 1.25); PICS[id].draw(ctx, P); ctx.restore();
}, { res: 90, rim: 0.12 });
const listenMat = () => cutShared('listen' + lang, 3.6, 2.6, (ctx, P) => {
  tornRect(ctx, -1.8, -1.3, 3.6, 2.6, 0.3, 0.035, 5); paint(ctx, P, '#cde6f5');
  if (P.rim) return;
  ctx.beginPath(); ctx.moveTo(-0.75, -0.55); ctx.lineTo(-0.35, -0.55); ctx.lineTo(0.1, -0.95); ctx.lineTo(0.1, 0.35); ctx.lineTo(-0.35, -0.05); ctx.lineTo(-0.75, -0.05); ctx.closePath(); paint(ctx, P, '#3f7fc1');
  ctx.strokeStyle = '#3f7fc1'; ctx.lineWidth = 0.1; for (const r of [0.35, 0.65]) { ctx.beginPath(); ctx.arc(0.15, -0.3, r, -0.8, 0.8); ctx.stroke(); }
  text(ctx, P, tr('wrdListen'), 0, 0.85, 0.46, INK, { maxW: 3.2 });
}, { res: 90, rim: 0.1 });

/* ---------- the board ---------- */
function build() {
  const g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1], 0);
  const pic = sharedMesh(picMat(W.id)); pic.position.set(0, 1.75, 0); pic.userData.kind = 'wpic'; g.add(pic);
  const sh = softShadow(4.6, 3.9); sh.position.set(0.3, 1.35, -0.35); g.add(sh);
  const n = W.word.length, x0 = -(n - 1) / 2 * SP;
  W.slots = [...W.word].map((ch, i) => {
    const sm = slotMat(), mat = new THREE.MeshBasicMaterial({ map: sm.mat.map, transparent: true, depthWrite: false, opacity: 0.7 });
    const m = new THREE.Mesh(sm.geo, mat); m.position.set(x0 + i * SP, -2.35, 0.06); g.add(m);
    let trace = null;
    if (W.level === 1) {
      const lm = letterMat(ch); trace = new THREE.Mesh(lm.geo, new THREE.MeshBasicMaterial({ map: lm.mat.map, transparent: true, opacity: 0.22, depthWrite: false }));
      trace.position.set(x0 + i * SP, -2.35, 0.08); trace.scale.setScalar(0.85); g.add(trace);
    }
    return { ch, i, mesh: m, j: new Juicy(m), trace, tile: null, r: 0.9, flash: 0 };
  });
  scene.add(g);
  return { group: g, pic: new Juicy(pic), sh };
}
function destroy(b) {
  if (!b) return;
  unjuice(b.group); scene.remove(b.group); b.sh.geometry.dispose(); b.sh.material.map.dispose(); b.sh.material.dispose();
  b.group.traverse(o => { if (o.material && o.material.isMeshBasicMaterial && o.material !== b.sh.material) o.material.dispose(); });
}
function buildListen() {
  removeListen();
  const m = sharedMesh(listenMat()); const tall = S.L.sideDir === 'h';
  m.position.set(S.L.side[0], S.L.side[1] + (tall ? 0 : 0.6), 0.1); m.userData.kind = 'listen'; m.rotation.z = 0.03;
  scene.add(m); W.card = new Juicy(m);
}
function removeListen() { if (W.card) { W.card.kill(); W.card = null; } }
const trayItems = () => W.letters.filter(l => !l.used).map(l => ({ key: 'l' + l.k, ch: l.ch, make: () => { const j = new Juicy(sharedMesh(letterMat(l.ch))); j.ch = l.ch; return j; }, trayBase: 0.8, base: 0.9 }));
const refreshTray = () => setTray(trayItems(), { sp: { wide: 1.95, tall: 2.1 } });

/* ---------- rounds ---------- */
function setPrompt(fn, speechFn) { W.promptFn = fn; W.speechFn = speechFn; say(fn(), { speech: speechFn ? speechFn() : null }); }
function pickWord() {
  const ok = id => { const n = PICS[id][lang].length; return W.level === 1 ? n <= 4 : W.level === 2 ? n <= 5 : n >= 5; };
  const pool = Object.keys(PICS).filter(id => ok(id) && !W.recent.includes(id));
  const id = pick(pool.length ? pool : Object.keys(PICS).filter(ok));
  W.recent = [id, ...W.recent].slice(0, 6);
  return id;
}
async function startRound() {
  const tok = ++W.round;
  W.busy = true; W.help = 0; W.problemWrong = 0; W.stepWrong = 0; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  if (W.board) { const old = W.board, og = old.group, sx = og.position.x; W.board = null; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.4; }, ease.inCubic).then(() => destroy(old)); }
  W.id = pickWord(); W.word = PICS[W.id][lang];
  // the word's letters (shuffled) plus a few decoys on the long-word level
  const letters = [...W.word];
  if (W.level === 3) { const extra = [...ALPHA[lang]].filter(c => !letters.includes(c)); for (let i = 0; i < Math.min(3, 10 - letters.length); i++) letters.push(extra.splice(rint(0, extra.length - 1), 1)[0]); }
  for (let i = letters.length - 1; i > 0; i--) { const j = rint(0, i); [letters[i], letters[j]] = [letters[j], letters[i]]; }
  W.letters = letters.map((ch, k) => ({ ch, k, used: false }));
  const b = W.board = build(); buildListen(); refreshTray();
  sfx.whoosh();
  await tween(0.7, k => b.group.position.set(S.L.main[0], S.L.main[1] + (1 - k) * 15, 0), ease.outBack);
  if (tok !== W.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2); b.pic.pop(0.5);
  const w = () => W.word.charAt(0) + W.word.slice(1).toLowerCase();
  const first = firstTime('words');
  setPrompt(() => W.level === 1 ? tr('wrdTrace') : tr('wrdSpell'), () => first ? `${w()}! ${W.level === 1 ? tr('wrdTrace') : tr('wrdSpell')}` : `${w()}!`);
  W.busy = false; S.lastAct = S.time;
}
function onDrop(p, slot) {
  if (!slot || W.busy || !W.board) { flyHome(p); return; }
  if (p.ch === slot.ch) {
    slot.tile = p; W.letters.find(l => 'l' + l.k === p.key).used = true; W.stepWrong = 0;
    const to = slot.mesh.getWorldPosition(V3()); to.z += 0.12; const from = p.mesh.position.clone(), b0 = p.base;
    p.rot.t = 0; p.sc.t = 1;
    tween(0.13, k => { p.mesh.position.lerpVectors(from, to, k); p.base = lerp(b0, 0.85, k); }, ease.inCubic).then(() => {
      if (!W.board) { p.kill(); return; }
      W.board.group.attach(p.mesh); p.mesh.position.set(slot.mesh.position.x, slot.mesh.position.y, 0.13); p.base = 0.85; p.punch(0.55); p.mesh.userData.kind = 'wletter'; sfx.snap();
      burst(to, 8, { speed: 2.6, up: 3, z: 1, size: 0.7 });
    });
    if (slot.trace) slot.trace.visible = false;
    sfx.good(slot.i + 1); setTrayGlow(null); wiggleHelp(false); refreshTray();
    speak(p.ch);
    if (W.slots.every(s => s.tile)) win();
    return;
  }
  W.problemWrong++; W.stepWrong++; recordMistake('words', 'letter'); slot.flash = 0.7; sfx.bad(); owlTilt(); flyHome(p);
  setPrompt(() => tr('wrdWrong', p.ch), () => `${tr('wrdWrong', p.ch)} ${W.word}`);
  if (W.stepWrong >= 2) { const s = W.slots.find(x => !x.tile); glowLetter(s.ch); wiggleHelp(true); }
}
function glowLetter(ch) { const l = W.letters.find(x => !x.used && x.ch === ch); if (l) setTrayGlow('l' + l.k); }
async function win() {
  const tok = W.round; W.busy = true; setTrayGlow(null); wiggleHelp(false);
  const nStars = W.problemWrong === 0 ? 3 : W.problemWrong <= 2 ? 2 : 1;
  owlCheer(); W.board.pic.pop(0.8); W.board.pic.punch(0.5);
  W.slots.forEach((s, i) => wait(0.07 * i).then(() => s.tile && (s.tile.pop(0.5), s.tile.punch(0.3))));
  const ti = Math.floor(Math.random() * 4);
  W.promptFn = () => tr('wrdWin', W.word, tr('winTail')[ti]); note(W.promptFn());
  await celebrate({ center: W.board.group.localToWorld(V3(0, 0.3, 0)), nStars, gameId: 'words', level: W.level, wrong: W.problemWrong });
  if (tok !== W.round) return;
  await wait(0.3);
  if (tok !== W.round) return;
  startRound();
}

/* ---------- game object ---------- */
const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a'), COL_PEND = new THREE.Color('#fff1b8'), COL_BAD = new THREE.Color('#ff9a8a');
function pending() { if (W.busy || !W.board) return null; const s = W.slots.find(x => !x.tile); return s && { mesh: s.mesh, r: 0.9, slot: s }; }
export const wordsState = W;
export const wordsGame = {
  id: 'words',
  levels: () => [{ id: 1, emoji: '✏️', label: tr('lvTrace') }, { id: 2, emoji: '🔤', label: tr('lvSpell') }, { id: 3, emoji: '📚', label: tr('lvLong') }],
  level: 1,
  enter(level) { W.level = this.level = level; setPencil(pending); startRound(); },
  exit() { W.round++; W.busy = true; destroy(W.board); W.board = null; removeListen(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { W.level = this.level = l; startRound(); },
  adopt(l) { W.level = this.level = l; },
  relayout() { if (W.board) W.board.group.position.set(S.L.main[0], S.L.main[1], 0); if (W.card) buildListen(); refreshTray(); },
  update(dt, t) {
    const pd = pending(), pulse = 0.5 + 0.5 * Math.sin(t * 6);
    for (const s of W.slots) {
      s.flash -= dt; s.mesh.visible = !s.tile;
      const hov = drag.hover === s, isP = pd && pd.slot === s;
      s.j.sc.t = hov ? 1.2 : isP ? 1 + 0.06 * pulse : 1;
      s.mesh.material.color.copy(s.flash > 0 ? COL_BAD : hov ? COL_HOV : isP ? COL_PEND : COL_W);
      s.mesh.material.opacity = hov ? 1 : isP ? 0.75 + 0.25 * pulse : 0.55;
    }
    if (W.card) W.card.sc.t = 1 + 0.02 * Math.sin(t * 3);
  },
  pointer(o) {
    if (!o) return;
    const k = o.userData.kind;
    if (k === 'listen' || k === 'wpic') { (k === 'listen' ? W.card : W.board.pic).pop(0.4); sfx.tap(); speak(W.word.charAt(0) + W.word.slice(1).toLowerCase()); }
    else if (k === 'wletter') { const j = o.userData.j; j.pop(0.4); speak(j.ch); }
  },
  help() {
    if (W.busy || !W.board) return;
    W.help = Math.min(2, W.help + 1);
    const s = W.slots.find(x => !x.tile); if (!s) return;
    s.j.pop(0.6);
    if (W.help === 1) say(tr('wrdSpell'), { speech: tr('wrdHelp', W.word.charAt(0) + W.word.slice(1).toLowerCase()) });
    else { say(tr('glow')); glowLetter(s.ch); }
  },
  prompt: () => W.promptFn(),
  idle: () => !W.busy && !!W.board,
  canDrag: () => !W.busy && !!W.board,
  dragOpts: () => ({ targets: () => W.slots.filter(s => !s.tile), onDrop }),
  onLang() { buildListen(); startRound(); }, // a new word in the new language
};
