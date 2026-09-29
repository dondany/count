// "Times garden": multiplication as rows of paper flowers. Plant a rows of b, count on in b's, write the answer.
import * as THREE from 'three';
import { rint, pick, lerp, digitsOf, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, SRC, cutTex, cutShared, sharedMesh, paperMat, paint, text, segs, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx, speak } from '../engine/audio.js';
import { tr } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, digitItems, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CELL = 0.52, PETALS = ['#e8574a', '#d9508f', '#f2c14e', '#7a5cc4', '#f08a3c'];
const TABLES = { 1: [2, 5, 10], 2: [2, 3, 4, 5], 3: [6, 7, 8, 9] };
const T = {
  level: 1, a: 3, b: 4, placed: 0, phase: 'plant', busy: true, round: 0, help: 0, problemWrong: 0, promptFn: () => '',
  plot: null, card: null, slots: [], rows: [], last: '',
};
const product = () => T.a * T.b;
const skipList = n => Array.from({ length: n }, (_, i) => (i + 1) * T.b).join(', ');

/* ---------- materials ---------- */
function flower(ctx, P, x, y, col) {
  ctx.beginPath(); ctx.rect(x - 0.02, y, 0.04, 0.2); paint(ctx, P, '#5f9844', { shadow: false });
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 0.1, y - 0.04 + Math.sin(a) * 0.1, 0.08, 0, Math.PI * 2); paint(ctx, P, col, { shadow: false }); }
  ctx.beginPath(); ctx.arc(x, y - 0.04, 0.06, 0, Math.PI * 2); paint(ctx, P, '#f2c14e', { shadow: false });
}
const stripMat = (n, ci) => cutShared(`tstrip${n}_${ci}`, n * CELL, CELL, (ctx, P) => {
  rr(ctx, -n * CELL / 2, -CELL / 2 + 0.06, n * CELL, CELL - 0.12, 0.12); paint(ctx, P, '#8fbf5a');
  if (P.rim) return;
  for (let i = 0; i < n; i++) flower(ctx, P, -n * CELL / 2 + (i + 0.5) * CELL, -0.02, PETALS[ci]);
}, { res: 120, rim: 0.05 });
const tagMat = n => cutShared('ttag' + n, 0.8, 0.44, (ctx, P) => {
  rr(ctx, -0.4, -0.22, 0.8, 0.44, 0.12); paint(ctx, P, '#fffaf0');
  if (!P.rim) text(ctx, P, String(n), 0, 0, 0.3, INK, { maxW: 0.7 });
}, { res: 140, rim: 0.04 });
const slotMat = () => cutShared('tslot', 1.45, 1.52, (ctx) => {
  rr(ctx, -0.675, -0.71, 1.35, 1.42, 0.24); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  ctx.setLineDash([0.17, 0.12]); ctx.lineWidth = 0.07; ctx.strokeStyle = 'rgba(74,52,38,0.7)'; ctx.stroke();
}, { res: 100, rim: 0, pad: 0.04 });

/* ---------- garden plot ---------- */
function buildPlot() {
  const w = T.b * CELL + 1.3, h = T.a * CELL + 1.0, g = new THREE.Group(); g.position.set(S.L.main[0] + 0.3, S.L.main[1], 0);
  const ct = cutTex(w, h, (ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.04, T.a * 10 + T.b); paint(ctx, P, '#9b6a42', { shadow: false });
    if (P.rim) return;
    ctx.setLineDash([0.12, 0.1]); ctx.strokeStyle = 'rgba(255,230,200,.35)'; ctx.lineWidth = 0.04;
    for (let r = 0; r < T.a; r++) { const y = -((T.a - 1) / 2 * CELL - r * CELL); ctx.beginPath(); ctx.moveTo(-T.b * CELL / 2, y); ctx.lineTo(T.b * CELL / 2, y); ctx.stroke(); }
  }, { res: 70, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'plot'; g.add(m);
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  scene.add(g);
  return { group: g, mesh: m, sh, j: new Juicy(m), w, h };
}
function removePlot(p) { if (!p) return; unjuice(p.group); scene.remove(p.group); disposeMesh(p.mesh); disposeMesh(p.sh); }
const rowY = r => (T.a - 1) / 2 * CELL - r * CELL;

/* ---------- side card ---------- */
function cardLayout() {
  const tall = S.L.sideDir === 'h';
  return tall ? { tall, w: 11.0, h: 3.6, ex: -3.0, ey: 0.35, sx: [0.6, 2.05], sy: 0.35, kx: 0, ky: -1.25 }
              : { tall, w: 5.3, h: 5.6, ex: 0, ey: 1.7, sx: [-0.72, 0.72], sy: 0.0, kx: 0, ky: -1.9 };
}
function buildCard() {
  removeCard();
  const L = cardLayout(), ct = cutTex(L.w, L.h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'card';
  const g = new THREE.Group(); g.position.set(S.L.side[0], S.L.side[1], 0); g.rotation.z = L.tall ? -0.01 : 0.02;
  const sh = softShadow(L.w, L.h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  T.card = { group: g, mesh: m, sh, ct, L, j: new Juicy(m) };
  drawCard();
}
function removeCard() {
  for (const s of T.slots) { s.j.kill(); if (s.tile) s.tile.kill(); }
  T.slots = [];
  if (!T.card) return; T.card.j.kill(); scene.remove(T.card.group); disposeMesh(T.card.mesh); disposeMesh(T.card.sh); T.card = null;
}
function drawCard(reveal = false) {
  const c = T.card; if (!c) return;
  const L = c.L, w = L.w, h = L.h;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 23); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    segs(ctx, P, [{ t: String(T.a), c: SRC.a }, { t: ' × ', c: INK }, { t: String(T.b), c: SRC.b }, { t: ' =', c: INK }], L.ex, -L.ey, 0.95, L.tall ? 3.8 : 4.6);
    if (reveal || T.phase === 'plant') segs(ctx, P, [{ t: T.phase === 'plant' && !reveal ? '?' : String(product()), c: '#e8574a' }], (L.sx[0] + L.sx[1]) / 2, -L.sy, 1.1, 2.6);
    if (T.placed) segs(ctx, P, [{ t: skipList(T.placed), c: '#6f9e4c' }], L.kx, -L.ky, 0.42, w - 0.6);
  });
  c.j.punch(0.2);
}
function makeSlots() {
  const L = T.card.L, digs = digitsOf(product()).reverse(); // left to right
  const xs = digs.length === 1 ? [(L.sx[0] + L.sx[1]) / 2] : L.sx;
  digs.forEach((d, i) => {
    const sm = slotMat(), mat = new THREE.MeshBasicMaterial({ map: sm.mat.map, transparent: true, depthWrite: false, opacity: 0.7 });
    const m = new THREE.Mesh(sm.geo, mat); m.position.set(xs[i], L.sy, 0.08); m.scale.setScalar(0.9); T.card.group.add(m);
    T.slots.push({ want: d, mesh: m, j: new Juicy(m, 0.9), tile: null, r: 1.0, flash: 0 });
  });
}

/* ---------- rounds ---------- */
function setPrompt(fn) { T.promptFn = fn; say(fn()); }
const stripItem = (n, ci) => ({ key: 's' + n, make: () => { const j = new Juicy(sharedMesh(stripMat(n, ci))); j.len = n; return j; }, trayBase: Math.min(1.3, 3.2 / (n * CELL)), base: 1 });
function plantTray() {
  const ci = T.placed % PETALS.length, items = [stripItem(T.b, ci)];
  if (T.level === 3) items.push(stripItem(T.b + (T.b >= 9 ? -1 : 1), (ci + 2) % PETALS.length));
  setTray(items, { sp: { wide: 6.2, tall: 5.6 } });
}
async function startRound() {
  const tok = ++T.round;
  T.busy = true; T.help = 0; T.problemWrong = 0; T.placed = 0; T.phase = 'plant'; T.rows = []; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  for (let i = 0; i < 30; i++) {
    const t = pick(TABLES[T.level]), m = rint(2, T.level === 1 ? 5 : 10);
    T.a = m; T.b = t; if (`${m}x${t}` !== T.last) break;
  }
  T.last = `${T.a}x${T.b}`;
  if (T.plot) { const old = T.plot, og = old.group, sx = og.position.x; T.plot = null; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.4; }, ease.inCubic).then(() => removePlot(old)); }
  const plot = T.plot = buildPlot(); buildCard(); plantTray();
  sfx.whoosh();
  await tween(0.7, k => plot.group.position.set(S.L.main[0] + 0.3, S.L.main[1] + (1 - k) * 15, 0), ease.outBack);
  if (tok !== T.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  setPrompt(() => tr('tmPlant', T.a, T.b));
  T.busy = false; S.lastAct = S.time;
}
async function dropStrip(p, target) {
  if (!target || T.busy || !T.plot) { flyHome(p); return; }
  if (p.len !== T.b) { flyHome(p); sfx.bad(); owlTilt(); T.problemWrong++; recordMistake('times', 'strip'); setPrompt(() => tr('tmWrongStrip', p.len, T.b)); return; }
  if (T.placed >= T.a) { flyHome(p); setPrompt(() => tr('tmEnough', T.a)); return; }
  const r = T.placed++, local = V3(0, rowY(r), 0.12), to = T.plot.group.localToWorld(local.clone()), from = p.mesh.position.clone();
  p.rot.t = 0; p.sc.t = 1;
  await tween(0.16, k => p.mesh.position.lerpVectors(from, to, k), ease.inCubic);
  if (!T.plot) { p.kill(); return; }
  T.plot.group.attach(p.mesh); p.mesh.position.copy(local); p.mesh.userData.kind = 'row'; p.punch(0.5); sfx.snap();
  const tag = new Juicy(sharedMesh(tagMat(T.placed * T.b))); tag.mesh.position.set(-T.b * CELL / 2 - 0.55, rowY(r), 0.2); tag.sc.v = 0.0001; tag.sc.t = 1; tag.pop(0.5); T.plot.group.add(tag.mesh);
  T.rows.push({ strip: p, tag });
  for (let i = 0; i < T.b; i++) wait(0.04 * i).then(() => sfx.dot(i));
  burst(to, 10, { colors: [PETALS[r % PETALS.length], '#8fbf5a', '#fffaf0'], speed: 2.5, up: 3, z: 1, size: 0.6 });
  say(`${T.placed * T.b}!`, { hop: true });
  drawCard();
  if (T.placed === T.a) {
    T.phase = 'answer'; setTray(digitItems()); makeSlots();
    await wait(0.8);
    setPrompt(() => tr('tmAnswer', T.a, T.b));
  } else plantTray();
}
let skipTok = 0;
async function skipCount() {
  const my = ++skipTok;
  for (let i = 0; i < T.rows.length; i++) {
    if (my !== skipTok || !T.plot) return;
    const r = T.rows[i]; r.strip.pop(0.4); r.tag.pop(0.6); sfx.dot(i + 2); speak(String((i + 1) * T.b));
    await wait(0.7);
  }
}
function dropDigit(t, slot) {
  if (!slot || T.busy || slot.tile) { flyHome(t); return; }
  if (t.d === slot.want) {
    slot.tile = t;
    const to = slot.mesh.getWorldPosition(V3()); to.z += 0.12; const from = t.mesh.position.clone(), b0 = t.base;
    tween(0.13, k => { t.mesh.position.lerpVectors(from, to, k); t.base = lerp(b0, 0.85, k); }, ease.inCubic).then(() => {
      if (!T.card) { t.kill(); return; }
      T.card.group.attach(t.mesh); t.mesh.position.copy(slot.mesh.position); t.mesh.position.z = 0.15; t.punch(0.55); t.mesh.userData.kind = null; sfx.snap();
    });
    sfx.good(3); setTrayGlow(null); wiggleHelp(false);
    if (T.slots.every(s => s.tile)) win();
    return;
  }
  T.problemWrong++; recordMistake('times', 'answer'); slot.flash = 0.7; sfx.bad(); owlTilt(); flyHome(t);
  setPrompt(() => tr('tmSkip', T.b, skipList(T.a)));
  wait(0.4).then(skipCount);
  if (T.problemWrong >= 2) { setTrayGlow('d' + slot.want); wiggleHelp(true); }
}
async function win() {
  const tok = T.round; T.busy = true; setTrayGlow(null); wiggleHelp(false);
  const nStars = T.problemWrong === 0 ? 3 : T.problemWrong <= 2 ? 2 : 1;
  owlCheer(); drawCard(true);
  const ti = Math.floor(Math.random() * 4);
  setPrompt(() => tr('tmWin', T.a, T.b, product(), tr('winTail')[ti]));
  T.rows.forEach((r, i) => wait(0.07 * i).then(() => { r.strip.pop(0.5); r.strip.punch(0.3); }));
  await celebrate({ center: T.plot.group.localToWorld(V3(0, 0.3, 0)), nStars, gameId: 'times', level: T.level, wrong: T.problemWrong });
  if (tok !== T.round) return;
  await wait(0.3);
  if (tok !== T.round) return;
  startRound();
}

const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a'), COL_PEND = new THREE.Color('#fff1b8'), COL_BAD = new THREE.Color('#ff9a8a');
function pending() { if (T.busy || T.phase !== 'answer') return null; const s = T.slots.find(x => !x.tile); return s && { mesh: s.mesh, r: 0.95, slot: s }; }
export const timesState = T;
export const timesGame = {
  id: 'times',
  levels: () => [{ id: 1, emoji: '🌱', label: tr('lvT1') }, { id: 2, emoji: '🌷', label: tr('lvT2') }, { id: 3, emoji: '🌻', label: tr('lvT3') }],
  level: 1,
  enter(level) { T.level = this.level = level; setPencil(pending); startRound(); },
  exit() { T.round++; T.busy = true; removePlot(T.plot); T.plot = null; removeCard(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { T.level = this.level = l; startRound(); },
  adopt(l) { T.level = this.level = l; },
  relayout() {
    if (T.plot) T.plot.group.position.set(S.L.main[0] + 0.3, S.L.main[1], 0);
    const hadSlots = T.slots.length > 0; buildCard(); if (hadSlots) makeSlots();
    if (T.phase === 'plant' && !T.busy) plantTray();
  },
  update(dt, t) {
    const pd = pending(), pulse = 0.5 + 0.5 * Math.sin(t * 6);
    for (const s of T.slots) {
      s.flash -= dt; s.mesh.visible = !s.tile;
      const hov = drag.hover === s, isP = pd && pd.slot === s;
      s.j.sc.t = hov ? 1.2 : isP ? 1 + 0.06 * pulse : 1;
      s.mesh.material.color.copy(s.flash > 0 ? COL_BAD : hov ? COL_HOV : isP ? COL_PEND : COL_W);
      s.mesh.material.opacity = hov ? 1 : isP ? 0.75 + 0.25 * pulse : 0.55;
    }
    if (T.plot) T.plot.j.sc.t = drag.hover && drag.hover.plot ? 1.02 : 1;
  },
  pointer(o) {
    if (!o) return;
    const k = o.userData.kind;
    if ((k === 'row' || k === 'plot') && !T.busy) skipCount();
    else if (k === 'card') T.card.j.punch(0.4);
  },
  help() {
    if (T.busy || !T.plot) return;
    T.help = Math.min(2, T.help + 1);
    if (T.phase === 'plant') { setPrompt(() => tr('tmPlant', T.a, T.b)); setTrayGlow('s' + T.b); return; }
    if (T.help === 1) { say(tr('tmSkip', T.b, skipList(T.a))); skipCount(); }
    else { const s = T.slots.find(x => !x.tile); if (s) { say(tr('glow')); setTrayGlow('d' + s.want); } }
  },
  prompt: () => T.promptFn(),
  idle: () => !T.busy && !!T.plot,
  canDrag: () => !T.busy && !!T.plot,
  dragOpts: () => T.phase === 'plant'
    ? { targets: () => T.plot ? [{ plot: true, j: T.plot.j, hit: pt => { const l = T.plot.group.worldToLocal(pt.clone()); return Math.abs(l.x) < T.plot.w / 2 + 0.6 && Math.abs(l.y) < T.plot.h / 2 + 0.8; } }] : [], onDrop: dropStrip }
    : { targets: () => T.slots.filter(s => !s.tile), onDrop: dropDigit },
  onLang() { drawCard(); say(T.promptFn()); },
};
