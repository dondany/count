// "Pattern train": a paper train carries a pattern of shapes (or numbers); drag what comes next onto the empty wagons.
import * as THREE from 'three';
import { rint, pick, lerp, Juicy, tween, wait, ease, unjuice, rand } from '../engine/util.js';
import { INK, DIGIT_COLORS, cutShared, sharedMesh, paint, text, rr, starPath, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr } from '../engine/i18n.js';
import { say, note, firstTime, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const COLS = ['#e8574a', '#3f7fc1', '#f2c14e', '#6fae52', '#7a5cc4'];
const WAGON_COLS = ['#d9703f', '#2f9e97', '#c9a13c', '#7a5cc4', '#3f7fc1', '#d9508f'];
const Pt = {
  level: 1, seq: [], blanks: 0, step: 0, busy: true, round: 0, help: 0, problemWrong: 0, stepWrong: 0, promptFn: () => '',
  train: null, slots: [], puffT: 0,
};

/* ---------- items ---------- */
const SHAPE = [
  ctx => { ctx.beginPath(); ctx.arc(0, 0, 0.4, 0, TAU); },
  ctx => rr(ctx, -0.36, -0.36, 0.72, 0.72, 0.06),
  ctx => { ctx.beginPath(); ctx.moveTo(0, -0.42); ctx.lineTo(0.44, 0.34); ctx.lineTo(-0.44, 0.34); ctx.closePath(); },
  ctx => starPath(ctx, 5, 0.45, 0.2),
  ctx => { ctx.beginPath(); ctx.moveTo(0, 0.4); ctx.bezierCurveTo(-0.62, -0.02, -0.26, -0.52, 0, -0.18); ctx.bezierCurveTo(0.26, -0.52, 0.62, -0.02, 0, 0.4); ctx.closePath(); },
  ctx => { ctx.beginPath(); ctx.moveTo(0, -0.45); ctx.lineTo(0.36, 0); ctx.lineTo(0, 0.45); ctx.lineTo(-0.36, 0); ctx.closePath(); },
];
const itemMat = key => cutShared('pt' + key, 1.0, 1.0, (ctx, P) => {
  if (key[0] === 'n') {
    ctx.beginPath(); ctx.arc(0, 0, 0.46, 0, TAU); paint(ctx, P, '#fffdf8');
    if (!P.rim) text(ctx, P, key.slice(1), 0, 0, key.length > 2 ? 0.42 : 0.5, DIGIT_COLORS[+key.slice(1) % 10], { maxW: 0.8 });
    return;
  }
  const si = +key[1], ci = +key[3]; SHAPE[si](ctx); paint(ctx, P, COLS[ci]);
}, { res: 130, rim: 0.07 });
const itemName = key => key[0] === 'n' ? key.slice(1) : tr('item', tr('colors')[+key[3]], tr('shapes')[+key[1]]);
const itemItem = key => ({ key, make: () => { const j = new Juicy(sharedMesh(itemMat(key))); j.ikey = key; return j; }, trayBase: 1.25, base: 1 });

/* ---------- the train ---------- */
const wagonMat = ci => cutShared('wagon' + ci, 1.3, 0.75, (ctx, P) => {
  rr(ctx, -0.6, -0.3, 1.2, 0.36, 0.06); paint(ctx, P, WAGON_COLS[ci]);
  for (const x of [-0.35, 0.35]) { ctx.beginPath(); ctx.arc(x, 0.18, 0.16, 0, TAU); paint(ctx, P, INK); }
  if (!P.rim) { for (const x of [-0.35, 0.35]) { ctx.beginPath(); ctx.arc(x, 0.18, 0.06, 0, TAU); ctx.fillStyle = '#bdb6ad'; ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-0.55, -0.26, 1.1, 0.07); }
}, { res: 120, rim: 0.05 });
const locoMat = () => cutShared('loco', 2.2, 1.9, (ctx, P) => {
  rr(ctx, -0.95, -0.2, 1.7, 0.75, 0.12); paint(ctx, P, '#e8574a');
  rr(ctx, -0.95, -0.85, 0.8, 0.7, 0.1); paint(ctx, P, '#c2453a');
  rr(ctx, 0.35, -0.75, 0.28, 0.6, 0.05); paint(ctx, P, INK);
  ctx.beginPath(); ctx.moveTo(0.75, 0.55); ctx.lineTo(1.05, 0.55); ctx.lineTo(0.75, 0.15); ctx.closePath(); paint(ctx, P, '#f2c14e');
  for (const [x, r] of [[-0.6, 0.26], [0.1, 0.22], [0.55, 0.22]]) { ctx.beginPath(); ctx.arc(x, 0.6, r, 0, TAU); paint(ctx, P, INK); }
  if (P.rim) return;
  rr(ctx, -0.82, -0.72, 0.52, 0.34, 0.06); ctx.fillStyle = '#cde6f5'; ctx.fill();
  ctx.beginPath(); ctx.arc(0.3, 0.12, 0.08, 0, TAU); ctx.arc(0.62, 0.12, 0.08, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(0.46, 0.25, 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 0.05; ctx.stroke();
  for (const x of [-0.6, 0.1, 0.55]) { ctx.beginPath(); ctx.arc(x, 0.6, 0.08, 0, TAU); ctx.fillStyle = '#bdb6ad'; ctx.fill(); }
}, { res: 110, rim: 0.07 });
const railMat = () => cutShared('rails', 17, 0.3, (ctx, P) => {
  ctx.fillStyle = '#8a5a3b'; for (let x = -8.4; x < 8.5; x += 0.45) ctx.fillRect(x, -0.12, 0.16, 0.26);
  ctx.fillStyle = '#7a5d49'; ctx.fillRect(-8.5, -0.06, 17, 0.06);
}, { res: 60, rim: 0, pad: 0.02 });
const slotMat = () => cutShared('ptslot', 1.1, 1.1, (ctx) => {
  rr(ctx, -0.5, -0.5, 1.0, 1.0, 0.2); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
  ctx.setLineDash([0.14, 0.1]); ctx.lineWidth = 0.06; ctx.strokeStyle = 'rgba(74,52,38,0.7)'; ctx.stroke();
}, { res: 110, rim: 0, pad: 0.04 });
const puffMat = () => cutShared('puff', 0.5, 0.5, (ctx, P) => { ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, TAU); paint(ctx, P, '#fffaf0', { shadow: false }); }, { res: 80, rim: 0 });
function geom() {
  return S.L.name === 'wide' ? { cx: 3.0, cy: 0.2, sp: 1.6, s: 1.15 } : { cx: 0, cy: 1.2, sp: 1.25, s: 0.9 };
}
function buildTrain() {
  const G = geom(), n = Pt.seq.length, g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); inner.scale.setScalar(G.s);
  const total = n * G.sp + 2.3, x0 = -total / 2 + G.sp / 2;
  const rails = sharedMesh(railMat(), false); rails.position.set(0, -0.62, -0.05); inner.add(rails);
  const cars = [], slots = [];
  Pt.seq.forEach((key, i) => {
    const x = x0 + i * G.sp, w = new Juicy(sharedMesh(wagonMat(i % WAGON_COLS.length))); w.mesh.position.set(x, -0.25, 0.05); inner.add(w.mesh);
    const blank = i >= n - Pt.blanks;
    let item = null, slot = null;
    if (!blank) { item = new Juicy(sharedMesh(itemMat(key))); item.mesh.position.set(x, 0.42, 0.12); item.mesh.userData.kind = 'ptItem'; item.ikey = key; inner.add(item.mesh); }
    else {
      const sm = slotMat(), m = new THREE.Mesh(sm.geo, new THREE.MeshBasicMaterial({ map: sm.mat.map, transparent: true, depthWrite: false, opacity: 0.8 }));
      m.position.set(x, 0.42, 0.08); inner.add(m); slot = { want: key, i, mesh: m, j: new Juicy(m), tile: null, r: 0.85 }; slots.push(slot);
    }
    cars.push({ w, item, slot, x });
  });
  const loco = new Juicy(sharedMesh(locoMat())); loco.mesh.position.set(x0 + n * G.sp + 0.55, 0.05, 0.05); inner.add(loco.mesh);
  scene.add(g);
  g.position.set(-22, G.cy, 0);
  return { group: g, inner, cars, slots, loco, chimney: V3(x0 + n * G.sp + 0.55 + 0.49, 0.95, 0.2), puffs: [] };
}
function removeTrain(t) {
  if (!t) return; unjuice(t.group); scene.remove(t.group);
  t.slots.forEach(s => s.mesh.material.dispose());
}

/* ---------- patterns ---------- */
function genPattern() {
  const L = Pt.level;
  if (L === 3) {
    for (;;) {
      const step = pick([1, 2, 2, 3, 5, 10, -1, -2]), len = 7, start = step > 0 ? rint(0, 12) : rint(-step * len, -step * len + 12);
      const seq = [...Array(len)].map((_, i) => start + i * step);
      if (seq.every(v => v >= 0 && v <= 99)) { Pt.step = step; Pt.blanks = 2; return seq.map(v => 'n' + v); }
    }
  }
  const unit = L === 1 ? pick(['AB', 'AAB', 'ABB']) : pick(['ABC', 'AABB', 'ABBC', 'ABC', 'AABC']);
  const letters = [...new Set(unit)];
  // level 1: shape and colour both change; level 2 sometimes only one of them changes
  const mode = L === 1 ? 'both' : pick(['both', 'shape', 'color']);
  const shapes = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5), colors = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
  const map = {};
  letters.forEach((l, i) => { map[l] = `s${mode === 'color' ? shapes[0] : shapes[i]}c${mode === 'shape' ? colors[0] : colors[i]}`; });
  const len = L === 1 ? 7 : 8;
  Pt.blanks = L === 1 ? 1 : 2; Pt.step = 0;
  return [...Array(len)].map((_, i) => map[unit[i % unit.length]]);
}
function trayKeys() {
  const need = [...new Set(Pt.slots.map(s => s.want))], all = new Set(need), max = Pt.level === 1 ? 3 : 4;
  if (Pt.level === 3) {
    const v = +need[0].slice(1);
    for (const d of [1, -1, Pt.step * 2, 2, -2, 3]) { if (all.size >= max) break; const x = v + d; if (x >= 0 && x <= 99) all.add('n' + x); }
  } else {
    for (const k of Pt.seq) { if (all.size >= max) break; all.add(k); }
    while (all.size < max) all.add(`s${rint(0, 5)}c${rint(0, 4)}`);
  }
  return [...all].sort(() => Math.random() - 0.5);
}

/* ---------- rounds ---------- */
function setPrompt(fn) { Pt.promptFn = fn; say(fn()); }
// explain once per visit, then say only the short version (or show the text silently when there is no short one)
function intro(key, full, short = null) { const first = firstTime(key), fn = first || !short ? full : short; Pt.promptFn = fn; if (first || short) say(fn()); else note(fn()); }
function quiet(fn) { Pt.promptFn = fn; note(fn()); }
const chug = () => { sfx.tap(); };
async function startRound() {
  const tok = ++Pt.round;
  Pt.busy = true; Pt.help = 0; Pt.problemWrong = 0; Pt.stepWrong = 0; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  if (Pt.train) { const old = Pt.train, og = old.group, sx = og.position.x; Pt.train = null; tween(0.9, k => { og.position.x = sx + k * 26; }, ease.inCubic).then(() => removeTrain(old)); }
  Pt.seq = genPattern();
  const t = Pt.train = buildTrain(); Pt.slots = t.slots;
  setTray(null);
  const G = geom();
  for (let k = 0; k < 6; k++) wait(k * 0.18).then(chug);
  await tween(1.2, k => { t.group.position.x = lerp(-22, G.cx, k); }, ease.outCubic);
  if (tok !== Pt.round) return;
  sfx.snap(); t.cars.forEach((c, i) => wait(i * 0.05).then(() => c.w.punch(0.3)));
  setTray(trayKeys().map(itemItem), { sp: { wide: 2.4, tall: 2.3 } });
  intro('ptStart', () => tr('ptStart'));
  Pt.busy = false; S.lastAct = S.time;
}
let rhythmTok = 0;
async function rhythm() {
  const my = ++rhythmTok;
  for (const c of Pt.train.cars) {
    if (my !== rhythmTok || !Pt.train) return;
    if (c.item) { c.item.pop(0.5); c.item.punch(0.3); } else if (c.slot && c.slot.tile) c.slot.tile.pop(0.5); else if (c.slot) c.slot.j.pop(0.6);
    c.w.punch(0.2); sfx.dot(Pt.train.cars.indexOf(c)); await wait(0.35);
  }
}
function onDrop(p, slot) {
  if (!slot || Pt.busy || !Pt.train) { flyHome(p); return; }
  if (p.ikey === slot.want) {
    slot.tile = p;
    const to = slot.mesh.getWorldPosition(V3()); to.z += 0.12; const from = p.mesh.position.clone(), b0 = p.base;
    p.rot.t = 0; p.sc.t = 1;
    tween(0.13, k => { p.mesh.position.lerpVectors(from, to, k); p.base = lerp(b0, geom().s, k); }, ease.inCubic).then(() => {
      if (!Pt.train) { p.kill(); return; }
      Pt.train.inner.attach(p.mesh); p.mesh.position.copy(slot.mesh.position); p.mesh.position.z = 0.12; p.base = 1; p.mesh.userData.kind = 'ptItem'; p.punch(0.55); sfx.snap();
      burst(to, 8, { speed: 2.5, up: 3, z: 1, size: 0.6 });
    });
    slot.mesh.visible = false; sfx.good(slot.i); setTrayGlow(null); wiggleHelp(false); Pt.stepWrong = 0;
    if (Pt.slots.every(s => s.tile)) win();
    return;
  }
  flyHome(p); slot.j.punch(0.3); Pt.problemWrong++; Pt.stepWrong++; recordMistake('pattern', 'pattern'); sfx.bad(); owlTilt();
  const names = Pt.seq.slice(0, Math.min(6, Pt.seq.length - Pt.blanks)).map(itemName).join(', ');
  setPrompt(() => Pt.level === 3 ? tr('ptStep', Pt.step) : tr('ptListen', names));
  rhythm();
  if (Pt.stepWrong >= 2) { const s = Pt.slots.find(x => !x.tile); if (s) setTrayGlow(s.want); wiggleHelp(true); }
}
async function win() {
  const tok = Pt.round; Pt.busy = true; setTrayGlow(null); wiggleHelp(false); setTray(null);
  const nStars = Pt.problemWrong === 0 ? 3 : Pt.problemWrong <= 2 ? 2 : 1;
  owlCheer(); Pt.train.loco.pop(0.6);
  const ti = Math.floor(Math.random() * 4);
  quiet(() => tr('ptWin', tr('winTail')[ti]));
  [0, 0.25].forEach(d => { wait(d).then(() => sfx.hoot()); });
  await rhythm();
  await celebrate({ center: Pt.train.group.localToWorld(V3(0, 0.3, 0)), nStars, gameId: 'pattern', level: Pt.level, wrong: Pt.problemWrong });
  if (tok !== Pt.round) return;
  startRound();
}

const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a');
function pending() { if (Pt.busy || !Pt.train) return null; const s = Pt.slots.find(x => !x.tile); return s && { mesh: s.mesh, r: 0.8 }; }
export const patternState = Pt;
export const patternGame = {
  id: 'pattern',
  adaptiveLevels: [1, 2], // may step up from shapes to tricky shapes, but never jump to number patterns on its own
  levels: () => [{ id: 1, emoji: '🔺', label: tr('lvPat1') }, { id: 2, emoji: '🧩', label: tr('lvPat2') }, { id: 3, emoji: '🔢', label: tr('lvPat3') }],
  level: 1,
  enter(level) { Pt.level = this.level = level; setPencil(pending); startRound(); },
  exit() { Pt.round++; Pt.busy = true; removeTrain(Pt.train); Pt.train = null; Pt.slots = []; setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { Pt.level = this.level = l; startRound(); },
  adopt(l) { Pt.level = this.level = l; },
  relayout() { if (Pt.train && !Pt.busy) { const G = geom(); removeTrain(Pt.train); const t = Pt.train = buildTrain(); t.group.position.x = G.cx; Pt.slots = t.slots; } },
  update(dt, t) {
    const tr0 = Pt.train; if (!tr0) return;
    for (const s of Pt.slots) { const hov = drag.hover === s; s.j.sc.t = hov ? 1.2 : 1 + 0.05 * Math.sin(t * 6); s.mesh.material.color.copy(hov ? COL_HOV : COL_W); }
    tr0.inner.position.y = Math.sin(t * 9) * 0.015;
    Pt.puffT -= dt;
    if (Pt.puffT < 0) {
      Pt.puffT = 0.7;
      const p = new Juicy(sharedMesh(puffMat(), false), 0.4); p.mesh.position.copy(tr0.chimney); tr0.inner.add(p.mesh); p.sc.v = 0.3;
      const y0 = tr0.chimney.y, x0 = tr0.chimney.x;
      tween(1.6, k => { p.mesh.position.set(x0 - k * 0.6, y0 + k * 1.3, 0.2); p.base = 0.4 + k * 0.8; p.sc.t = 1 - k; }, ease.linear).then(() => p.kill());
    }
  },
  pointer(o) {
    if (!o) return;
    if (o.userData.kind === 'ptItem') { const j = o.userData.j; j.pop(0.5); sfx.tap(); say(itemName(j.ikey), { hop: false }); }
  },
  help() {
    if (Pt.busy || !Pt.train) return;
    Pt.help = Math.min(2, Pt.help + 1);
    const names = Pt.seq.slice(0, Pt.seq.length - Pt.blanks).map(itemName).join(', ');
    if (Pt.help === 1) { say(Pt.level === 3 ? tr('ptStep', Pt.step) : tr('ptListen', names)); rhythm(); }
    else { const s = Pt.slots.find(x => !x.tile); if (s) { say(tr('glow')); setTrayGlow(s.want); } }
  },
  prompt: () => Pt.promptFn(),
  idle: () => !Pt.busy && !!Pt.train,
  canDrag: () => !Pt.busy && !!Pt.train,
  dragOpts: () => ({ targets: () => Pt.slots.filter(s => !s.tile), onDrop }),
  onLang() { say(Pt.promptFn()); },
};
