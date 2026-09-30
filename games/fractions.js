// "Fractions": put paper pizza slices / chocolate pieces on a plate to make a fraction, or read one and write it.
import * as THREE from 'three';
import { rand, rint, pick, lerp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, SRC, cutTex, cutShared, sharedMesh, paperMat, paint, text, segs, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, fracWords } from '../engine/i18n.js';
import { say, note, firstTime, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, digitItems, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2, PR = 2.75, BW = 8.2, BH = 2.3;
const DENOMS = { 1: [2, 3, 4], 2: [2, 3, 4, 5, 6], 3: [5, 6, 7, 8, 9] };
const F = {
  level: 1, mode: 'make', shape: 'pizza', n: 1, d: 2, placed: [], busy: true, round: 0, rounds: 0, help: 0, problemWrong: 0,
  promptFn: () => '', stage: null, card: null, slots: [], last: '',
};
const fracStr = () => `${F.n}/${F.d}`;

/* ---------- pieces ---------- */
const alpha = d => Math.PI / d;
const centroid = d => d === 1 ? 0 : 2 * PR * Math.sin(alpha(d)) / (3 * alpha(d));
function sliceMat(d) {
  return cutShared('slice' + d, PR * 2, PR * 2, (ctx, P) => {
    const a = alpha(d), a0 = -Math.PI / 2 - a, a1 = -Math.PI / 2 + a;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, PR - 0.04, a0, a1); ctx.closePath(); paint(ctx, P, '#e0a458');
    if (P.rim) return;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, PR - 0.34, a0 + 0.04, a1 - 0.04); ctx.closePath(); paint(ctx, P, '#f7c948');
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, PR - 0.34, a0 + 0.04, a1 - 0.04); ctx.closePath(); ctx.clip();
    const spots = [[0.55, 0], [0.8, 0.5], [0.8, -0.5], [0.33, 0.3]];
    for (const [rf, af] of spots) {
      const ang = -Math.PI / 2 + af * a * 0.8, r = rf * (PR - 0.4);
      ctx.beginPath(); ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, Math.min(0.26, 0.4 * a + 0.08), 0, TAU); paint(ctx, P, '#d9533f');
    }
    ctx.restore();
  }, { res: 90, rim: 0.07, pad: 0.1 });
}
function barMat(d) {
  const w = BW / d - 0.06;
  return cutShared('bar' + d, w, BH, (ctx, P) => {
    rr(ctx, -w / 2, -BH / 2, w, BH, 0.1); paint(ctx, P, '#7b4a2e');
    if (P.rim) return;
    rr(ctx, -w / 2 + 0.16, -BH / 2 + 0.16, w - 0.32, BH - 0.32, 0.08); ctx.strokeStyle = 'rgba(255,220,180,.35)'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-w / 2 + 0.2, -BH / 2 + 0.2, w - 0.4, 0.25);
  }, { res: 90, rim: 0.07 });
}
function makePiece() {
  const d = F.d;
  if (F.shape === 'pizza') {
    const sh = sliceMat(d), geo = once2('sgeo' + d, () => { const g = sh.geo.clone(); g.translate(0, -centroid(d), 0); return g; });
    const m = new THREE.Mesh(geo, sh.mat); m.castShadow = m.receiveShadow = true; return new Juicy(m);
  }
  return new Juicy(sharedMesh(barMat(d)));
}
const geoCache = {};
const once2 = (k, fn) => geoCache[k] || (geoCache[k] = fn());
function slotPose(k) {
  if (F.shape === 'pizza') { const phi = (k + 0.5) * TAU / F.d, rc = centroid(F.d); return { p: V3(rc * Math.sin(phi), rc * Math.cos(phi), 0.12), rot: -phi }; }
  return { p: V3(-BW / 2 + (k + 0.5) * BW / F.d, 0, 0.12), rot: 0 };
}
const trayItem = () => {
  const big = F.shape === 'pizza' ? 0.42 : Math.min(0.8, 1.8 / (BW / F.d));
  return [{ key: 'slice', make: makePiece, trayBase: big, base: 1 }];
};

/* ---------- the plate / tray the pieces go on ---------- */
function plateMat(d) {
  return cutShared('plate' + d, PR * 2 + 0.9, PR * 2 + 0.9, (ctx, P) => {
    ctx.beginPath(); ctx.arc(0, 0, PR + 0.42, 0, TAU); paint(ctx, P, '#e9dcc4');
    if (P.rim) return;
    ctx.beginPath(); ctx.arc(0, 0, PR + 0.12, 0, TAU); paint(ctx, P, '#fffaf0', { shadow: false });
    ctx.setLineDash([0.16, 0.12]); ctx.strokeStyle = 'rgba(74,52,38,.55)'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(0, 0, PR - 0.02, 0, TAU); ctx.stroke();
    for (let k = 0; k < d; k++) { const a = -Math.PI / 2 + k * TAU / d; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * PR, Math.sin(a) * PR); ctx.stroke(); }
  }, { res: 70, rim: 0.1 });
}
function boardMat(d) {
  return cutShared('choc' + d, BW + 0.7, BH + 0.7, (ctx, P) => {
    rr(ctx, -BW / 2 - 0.35, -BH / 2 - 0.35, BW + 0.7, BH + 0.7, 0.3); paint(ctx, P, '#c9a27a');
    if (P.rim) return;
    rr(ctx, -BW / 2 - 0.05, -BH / 2 - 0.05, BW + 0.1, BH + 0.1, 0.12); ctx.fillStyle = '#fff3dc'; ctx.fill();
    ctx.setLineDash([0.16, 0.12]); ctx.strokeStyle = 'rgba(74,52,38,.55)'; ctx.lineWidth = 0.05; ctx.stroke();
    for (let k = 1; k < d; k++) { const x = -BW / 2 + k * BW / d; ctx.beginPath(); ctx.moveTo(x, -BH / 2); ctx.lineTo(x, BH / 2); ctx.stroke(); }
  }, { res: 70, rim: 0.1 });
}
function buildStage() {
  const g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1], 0);
  const pizza = F.shape === 'pizza';
  const base = sharedMesh(pizza ? plateMat(F.d) : boardMat(F.d)); base.userData.kind = 'plate'; g.add(base);
  const sh = pizza ? softShadow(PR * 2 + 0.8, PR * 2 + 0.8, { r: PR + 0.4 }) : softShadow(BW + 0.7, BH + 0.7);
  sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  scene.add(g);
  return { group: g, base: new Juicy(base), sh, ghosts: [] };
}
function removeStage(st) { if (!st) return; unjuice(st.group); scene.remove(st.group); disposeMesh(st.sh); }

/* ---------- side card: the fraction ---------- */
function cardLayout() {
  const tall = S.L.sideDir === 'h';
  return tall ? { tall, w: 11.0, h: 3.6, fx: -3.3, fy: 0, tx: 1.9, ty: 1.05, wy: -0.35, ww: 6.2 }
              : { tall, w: 5.3, h: 5.8, fx: 0, fy: -0.05, tx: 0, ty: 2.3, wy: -2.35, ww: 4.8 };
}
function buildCard() {
  removeCard();
  const L = cardLayout(), ct = cutTex(L.w, L.h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'card';
  const g = new THREE.Group(); g.position.set(S.L.side[0], S.L.side[1], 0); g.rotation.z = L.tall ? -0.01 : 0.02;
  const sh = softShadow(L.w, L.h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  F.card = { group: g, mesh: m, sh, ct, L, j: new Juicy(m) };
  drawCard();
}
function removeCard() {
  for (const s of F.slots) { s.j.kill(); if (s.tile) s.tile.kill(); }
  F.slots = [];
  if (!F.card) return; F.card.j.kill(); scene.remove(F.card.group); disposeMesh(F.card.mesh); disposeMesh(F.card.sh); F.card = null;
}
function drawCard(reveal = false) {
  const c = F.card; if (!c) return;
  const L = c.L, show = F.mode === 'make' || reveal, w = L.w, h = L.h;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 77); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    text(ctx, P, F.mode === 'make' ? tr('frMakeTitle') : tr('frWhat'), L.tx, -L.ty, 0.5, INK, { maxW: L.ww });
    ctx.beginPath(); ctx.moveTo(L.fx - 0.8, -L.fy); ctx.lineTo(L.fx + 0.8, -L.fy); ctx.strokeStyle = INK; ctx.lineWidth = 0.12; ctx.stroke();
    if (show) {
      text(ctx, P, String(F.n), L.fx, -(L.fy + 0.92), 1.2, SRC.a);
      text(ctx, P, String(F.d), L.fx, -(L.fy - 0.92), 1.2, SRC.b);
      text(ctx, P, fracWords(F.n, F.d), L.tx, -L.wy, 0.42, '#9a7a62', { weight: 600, shadow: false, maxW: L.ww });
    }
  });
  c.j.punch(0.25);
}
const slotMat = () => cutShared('fslot', 1.45, 1.52, (ctx) => {
  rr(ctx, -0.675, -0.71, 1.35, 1.42, 0.24); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  ctx.setLineDash([0.17, 0.12]); ctx.lineWidth = 0.07; ctx.strokeStyle = 'rgba(74,52,38,0.7)'; ctx.stroke();
}, { res: 100, rim: 0, pad: 0.04 });
function makeSlots() {
  const L = F.card.L;
  for (const [which, dy] of [['n', 0.92], ['d', -0.92]]) {
    const sm = slotMat(), mat = new THREE.MeshBasicMaterial({ map: sm.mat.map, transparent: true, depthWrite: false, opacity: 0.7 });
    const m = new THREE.Mesh(sm.geo, mat); m.position.set(L.fx, L.fy + dy, 0.08); m.scale.setScalar(0.82); F.card.group.add(m);
    F.slots.push({ which, mesh: m, j: new Juicy(m, 0.82), tile: null, r: 1.0, flash: 0 });
  }
}

/* ---------- rounds ---------- */
function setPrompt(fn) { F.promptFn = fn; say(fn()); }
// explain once per visit, then say only the short version (or show the text silently when there is no short one)
function intro(key, full, short = null) { const first = firstTime(key), fn = first || !short ? full : short; F.promptFn = fn; if (first || short) say(fn()); else note(fn()); }
function quiet(fn) { F.promptFn = fn; note(fn()); }
async function startRound() {
  const tok = ++F.round;
  F.busy = true; F.help = 0; F.problemWrong = 0; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  const r = F.rounds++;
  F.mode = r % 2 ? 'read' : 'make'; F.shape = Math.floor(r / 2) % 2 ? 'bar' : 'pizza';
  for (let i = 0; i < 30; i++) { F.d = pick(DENOMS[F.level]); F.n = rint(1, F.d - 1); if (fracStr() !== F.last) break; }
  F.last = fracStr();
  // old stage flies off, new one drops in
  if (F.stage) { const old = F.stage, og = old.group, sx = og.position.x; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.5; }, ease.inCubic).then(() => removeStage(old)); }
  F.placed = Array(F.d).fill(null);
  const st = F.stage = buildStage();
  buildCard();
  setTray(F.mode === 'make' ? trayItem() : digitItems(), F.mode === 'make' ? { sp: { wide: 3.4, tall: 3.4 } } : {});
  sfx.whoosh();
  await tween(0.7, k => st.group.position.set(S.L.main[0], S.L.main[1] + (1 - k) * 15, 0), ease.outBack);
  if (tok !== F.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  if (F.mode === 'make') intro('frMake', () => tr('frMake', fracStr(), fracWords(F.n, F.d)), () => tr('frMakeShort', fracStr(), fracWords(F.n, F.d)));
  else {
    const off = F.shape === 'pizza' ? rint(0, F.d - 1) : 0;
    for (let i = 0; i < F.n; i++) {
      const k = (off + i) % F.d, pc = makePiece(), pose = slotPose(k);
      pc.mesh.position.copy(pose.p); pc.rot.v = pc.rot.t = pose.rot; pc.sc.v = pc.sc.t = 0.0001; pc.mesh.userData.kind = 'piece';
      st.group.add(pc.mesh); F.placed[k] = pc;
      wait(0.08 * i).then(() => { pc.sc.t = 1; pc.punch(0.3); sfx.tap(); });
    }
    makeSlots();
    await wait(0.08 * F.n + 0.2);
    if (tok !== F.round) return;
    intro('frRead', () => tr('frRead'));
  }
  F.busy = false; S.lastAct = S.time;
}
const count = () => F.placed.filter(Boolean).length;

async function dropPiece(pc, target) {
  if (!target || F.busy || !F.stage) { flyHome(pc); return; }
  const k = F.placed.indexOf(null);
  if (k < 0) { flyHome(pc); sfx.bad(); owlTilt(); setPrompt(() => tr('frTooMany')); return; }
  F.placed[k] = pc;
  const pose = slotPose(k), to = F.stage.group.localToWorld(pose.p.clone()), from = pc.mesh.position.clone();
  pc.rot.t = pose.rot; pc.sc.t = 1;
  await tween(0.16, t => pc.mesh.position.lerpVectors(from, to, t), ease.inCubic);
  if (!F.stage || F.placed[k] !== pc) { pc.kill(); return; }
  F.stage.group.attach(pc.mesh); pc.mesh.position.copy(pose.p); pc.mesh.userData.kind = 'piece';
  pc.punch(0.5); sfx.snap(); F.stage.base.punch(0.15);
  burst(to, 8, { colors: F.shape === 'pizza' ? ['#f7c948', '#d9533f', '#fffaf0'] : ['#7b4a2e', '#c9a27a', '#fffaf0'], speed: 2.5, up: 3, z: 1, size: 0.7 });
  const c = count();
  sfx.dot(c - 1);
  if (c === F.n) return win();
  if (c > F.n) { F.problemWrong++; recordMistake('frac', 'tooMany'); owlTilt(); setPrompt(() => tr('frTooMany')); }
}
function removePiece(pc) {
  const k = F.placed.indexOf(pc); if (k < 0) return;
  F.placed[k] = null; pc.key = 'slice'; flyHome(pc);
  if (count() === F.n) win();
}
// count pieces out loud: "there" = only the placed ones (numerator), "all" = every part of the whole (denominator)
let countTok = 0;
async function countParts(all) {
  const my = ++countTok, st = F.stage; if (!st) return;
  let k = 0;
  for (let i = 0; i < F.d; i++) {
    if (my !== countTok || !F.stage) return;
    const pc = F.placed[i];
    if (pc) { pc.pop(0.5); pc.punch(0.4); }
    else if (all) {
      const g = makePiece(), pose = slotPose(i); g.mesh.material = g.mesh.material.clone(); g.mesh.material.transparent = true; g.mesh.material.opacity = 0.4; g.mesh.material.alphaTest = 0.05; g.mesh.castShadow = false;
      g.mesh.position.copy(pose.p); g.rot.v = g.rot.t = pose.rot; g.sc.v = 0.3; st.group.add(g.mesh); st.ghosts.push(g);
    } else continue;
    sfx.dot(k++);
    await wait(0.3);
  }
  await wait(0.8);
  for (const g of st.ghosts) { g.sc.t = 0; const m = g.mesh.material; wait(0.3).then(() => { g.kill(); m.dispose(); }); }
  st.ghosts = [];
}
function dropDigit(t, slot) {
  if (!slot || F.busy || slot.tile) { flyHome(t); return; }
  const want = slot.which === 'n' ? F.n : F.d;
  if (t.d === want) {
    slot.tile = t;
    const to = slot.mesh.getWorldPosition(V3()); to.z += 0.12; const from = t.mesh.position.clone(), b0 = t.base;
    tween(0.13, k => { t.mesh.position.lerpVectors(from, to, k); t.base = lerp(b0, 0.8, k); }, ease.inCubic).then(() => {
      if (!F.card) { t.kill(); return; }
      F.card.group.attach(t.mesh); t.mesh.position.copy(slot.mesh.position); t.mesh.position.z = 0.15; t.punch(0.55); t.mesh.userData.kind = null; sfx.snap();
      burst(to, 8, { speed: 2.6, up: 3, z: 1, size: 0.7 });
    });
    sfx.good(slot.which === 'n' ? 2 : 4); setTrayGlow(null); wiggleHelp(false);
    if (F.slots.every(s => s.tile)) win();
    return;
  }
  F.problemWrong++; recordMistake('frac', slot.which === 'n' ? 'num' : 'den'); slot.flash = 0.7; sfx.bad(); owlTilt(); flyHome(t);
  setPrompt(() => tr(slot.which === 'n' ? 'frNumWrong' : 'frDenWrong'));
  wait(0.5).then(() => countParts(slot.which === 'd'));
  if (F.problemWrong >= 2) { setTrayGlow('d' + want); wiggleHelp(true); }
}
async function win() {
  const tok = F.round; F.busy = true; setTrayGlow(null); wiggleHelp(false);
  const nStars = F.problemWrong === 0 ? 3 : F.problemWrong <= 2 ? 2 : 1;
  owlCheer(); drawCard(true);
  const ti = Math.floor(Math.random() * 4);
  quiet(() => tr('frWin', fracStr(), fracWords(F.n, F.d), tr('winTail')[ti]));
  F.placed.forEach((pc, i) => pc && wait(0.05 * i).then(() => { pc.pop(0.5); pc.punch(0.3); }));
  await celebrate({ center: F.stage.group.localToWorld(V3(0, 0.4, 0)), nStars, gameId: 'frac', level: F.level, wrong: F.problemWrong });
  if (tok !== F.round) return;
  await wait(0.3);
  if (tok !== F.round) return;
  startRound();
}

/* ---------- per-frame ---------- */
const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a'), COL_PEND = new THREE.Color('#fff1b8'), COL_BAD = new THREE.Color('#ff9a8a');
function pending() {
  if (F.busy || F.mode !== 'read') return null;
  const s = F.slots.find(s => !s.tile); return s && { mesh: s.mesh, r: 0.95, slot: s };
}
export const fracState = F; // for automated tests
F.restart = () => startRound();
export const fracGame = {
  id: 'frac',
  levels: () => [{ id: 1, emoji: '🍕', label: tr('lvEasy') }, { id: 2, emoji: '🍫', label: tr('lvMore') }, { id: 3, emoji: '🧩', label: tr('lvTricky') }],
  level: 1,
  enter(level) { F.level = this.level = level; F.rounds = 0; setPencil(pending); startRound(); },
  exit() { F.round++; F.busy = true; removeStage(F.stage); F.stage = null; removeCard(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { F.level = this.level = l; F.rounds = 0; startRound(); },
  adopt(l) { F.level = this.level = l; },
  relayout() {
    if (F.stage) F.stage.group.position.set(S.L.main[0], S.L.main[1], 0);
    if (F.card) { const hadSlots = F.slots.length > 0; buildCard(); if (hadSlots) makeSlots(); } // (a rotated screen clears written digits)
  },
  update(dt, t) {
    const pd = pending(), pulse = 0.5 + 0.5 * Math.sin(t * 6);
    for (const s of F.slots) {
      s.flash -= dt; s.mesh.visible = !s.tile;
      const hov = drag.hover === s, isP = pd && pd.slot === s;
      s.j.sc.t = hov ? 1.2 : isP ? 1 + 0.06 * pulse : 1;
      s.mesh.material.color.copy(s.flash > 0 ? COL_BAD : hov ? COL_HOV : isP ? COL_PEND : COL_W);
      s.mesh.material.opacity = hov ? 1 : isP ? 0.75 + 0.25 * pulse : 0.55;
    }
    if (F.stage) F.stage.base.sc.t = drag.piece && drag.hover && drag.hover.stage ? 1.02 : 1;
  },
  pointer(o) {
    if (!o) return;
    const k = o.userData.kind;
    if (k === 'piece') { const pc = o.userData.j; if (F.mode === 'make' && !F.busy) removePiece(pc); else { pc.pop(0.4); sfx.tap(); } }
    else if (k === 'plate' && F.stage) { F.stage.base.punch(0.2); if (!F.busy) countParts(F.mode === 'read'); }
    else if (k === 'card') F.card.j.punch(0.4);
  },
  help() {
    if (F.busy || !F.stage) return;
    F.help = Math.min(2, F.help + 1);
    if (F.help === 1) { setPrompt(() => tr('frHelp', F.n, F.d)); countParts(true); F.card.j.punch(0.5); return; }
    if (F.mode === 'make') { if (count() > F.n) setPrompt(() => tr('frTooMany')); else { say(tr('glow')); setTrayGlow('slice'); } }
    else { const s = F.slots.find(s => !s.tile); if (s) { say(tr('glow')); setTrayGlow('d' + (s.which === 'n' ? F.n : F.d)); } }
  },
  prompt: () => F.promptFn(),
  idle: () => !F.busy && !!F.stage,
  canDrag: () => !F.busy && !!F.stage,
  dragOpts: () => F.mode === 'make'
    ? { targets: () => F.stage ? [{ stage: true, j: F.stage.base, hit: pt => {
        const l = F.stage.group.worldToLocal(pt.clone());
        return F.shape === 'pizza' ? Math.hypot(l.x, l.y) < PR + 0.9 : Math.abs(l.x) < BW / 2 + 0.6 && Math.abs(l.y) < BH / 2 + 1.0;
      } }] : [], onDrop: dropPiece }
    : { targets: () => F.slots.filter(s => !s.tile), onDrop: dropDigit },
  onLang() { drawCard(); say(F.promptFn()); },
};
