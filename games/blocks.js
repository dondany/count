// "Tens & ones": build numbers from paper place-value blocks, or read the blocks on the mat and write the number.
import * as THREE from 'three';
import { rand, rint, pick, lerp, digitsOf, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, BAND_COLORS, BAND_INK, cutTex, cutShared, sharedMesh, paperMat, paint, text, segs, rr, tornRect, softShadow, makeTile, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, lang, colName, words, splitWords, unit } from '../engine/i18n.js';
import { say, note, firstTime, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, digitItems, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const COLW = [2.3, 3.9, 4.6];                      // column width for ones, tens, hundreds
const PIECE = ['#f2c14e', '#2f9e97', '#e8574a'];     // ones = mustard cubes, tens = teal rods, hundreds = red flats
const MAT_TOP = 3.55, MAT_BOT = -3.65, COUNT_Y = -2.6;

const B = {
  level: 1, mode: 'build', N: 0, cols: 2, mat: null, card: null, counts: [0, 0, 0], pieces: [[], [], []],
  busy: true, round: 0, wrong: 0, help: 0, problemWrong: 0, promptFn: () => '', lastN: 0, slots: [], targets: [], rounds: 0,
};
const target = () => { const d = digitsOf(B.N); while (d.length < B.cols) d.push(0); return d; };
const value = () => B.counts[0] + B.counts[1] * 10 + B.counts[2] * 100;

/* ---------- materials ---------- */
const cubeMat = () => cutShared('cube', 0.34, 0.34, (ctx, P) => {
  rr(ctx, -0.17, -0.17, 0.34, 0.34, 0.05); paint(ctx, P, PIECE[0]);
  if (P.rim) return; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.03; rr(ctx, -0.11, -0.11, 0.22, 0.22, 0.03); ctx.stroke();
}, { res: 150, rim: 0.035 });
const rodMat = () => cutShared('rod', 0.34, 3.0, (ctx, P) => {
  rr(ctx, -0.17, -1.5, 0.34, 3.0, 0.05); paint(ctx, P, PIECE[1]);
  if (P.rim) return; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.03; ctx.beginPath();
  for (let k = 1; k < 10; k++) { ctx.moveTo(-0.17, -1.5 + k * 0.3); ctx.lineTo(0.17, -1.5 + k * 0.3); } ctx.stroke();
}, { res: 110, rim: 0.045 });
const flatMat = () => cutShared('flat', 3.0, 3.0, (ctx, P) => {
  rr(ctx, -1.5, -1.5, 3.0, 3.0, 0.08); paint(ctx, P, PIECE[2]);
  if (P.rim) return; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 0.025; ctx.beginPath();
  for (let k = 1; k < 10; k++) { ctx.moveTo(-1.5, -1.5 + k * 0.3); ctx.lineTo(1.5, -1.5 + k * 0.3); ctx.moveTo(-1.5 + k * 0.3, -1.5); ctx.lineTo(-1.5 + k * 0.3, 1.5); } ctx.stroke();
}, { res: 70, rim: 0.06 });
const PIECE_MAT = [cubeMat, rodMat, flatMat];
function makePiece(p) { const j = new Juicy(sharedMesh(PIECE_MAT[p]())); j.place = p; j.key = 'p' + p; return j; }
const blockItems = cols => [2, 1, 0].filter(p => p < cols).map(p => ({ key: 'p' + p, make: () => makePiece(p), trayBase: [1.7, 0.5, 0.42][p], base: 1 }));

const colMat = p => cutShared('bcol' + p + lang, COLW[p] - 0.14, MAT_TOP - MAT_BOT - 0.3, (ctx, P) => {
  const w = COLW[p] - 0.14, h = MAT_TOP - MAT_BOT - 0.3;
  tornRect(ctx, -w / 2, -h / 2, w, h, 0.22, 0.025, 40 + p); paint(ctx, P, BAND_COLORS[p], { shadow: false });
  text(ctx, P, colName(p), 0, -h / 2 + 0.45, 0.4, BAND_INK[p], { weight: 600, shadow: false, maxW: w - 0.2 });
  ctx.setLineDash([0.12, 0.1]); ctx.strokeStyle = 'rgba(74,52,38,.25)'; ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 0.15, -h / 2 + 0.85); ctx.lineTo(w / 2 - 0.15, -h / 2 + 0.85); ctx.stroke();
}, { res: 70, rim: 0, pad: 0.05 });
const slotMat = () => cutShared('bslot', 1.45, 1.52, (ctx) => {
  rr(ctx, -0.675, -0.71, 1.35, 1.42, 0.24); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
  ctx.setLineDash([0.17, 0.12]); ctx.lineWidth = 0.07; ctx.strokeStyle = 'rgba(74,52,38,0.7)'; ctx.stroke();
}, { res: 100, rim: 0, pad: 0.04 });
const checkMat = () => cutShared('check', 0.66, 0.66, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.33, 0, Math.PI * 2); paint(ctx, P, '#6fae52');
  if (P.rim) return;
  ctx.beginPath(); ctx.moveTo(-0.15, 0.0); ctx.lineTo(-0.04, 0.12); ctx.lineTo(0.17, -0.12); ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 0.09; ctx.stroke();
}, { res: 120, rim: 0.06 });

/* ---------- mat ---------- */
function colCenter(p) {
  const ws = [...Array(B.cols).keys()].map(i => COLW[i]), total = ws.reduce((a, b) => a + b, 0) + 0.12 * (B.cols - 1);
  let x = -total / 2;
  for (let q = B.cols - 1; q >= 0; q--) { if (q === p) return x + COLW[q] / 2; x += COLW[q] + 0.12; }
  return 0;
}
function slotPos(p, k) {
  const cx = colCenter(p);
  if (p === 0) return V3(cx + ((k % 3) - 1) * 0.46, 2.15 - Math.floor(k / 3) * 0.46, 0.12);
  if (p === 1) return V3(cx - 1.62 + k * 0.36, 0.5, 0.12 + k * 0.002);
  return V3(cx - 0.75 + k * 0.15, 0.9 - k * 0.1, 0.12 + k * 0.03);
}
function buildMat() {
  const g = new THREE.Group(); g.rotation.z = 0.008;
  const ws = [...Array(B.cols).keys()].map(i => COLW[i]), w = ws.reduce((a, b) => a + b, 0) + 0.12 * (B.cols - 1) + 0.7, h = MAT_TOP - MAT_BOT;
  const ct = cutTex(w, h, (ctx, P) => { tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.04, 12 + B.cols); paint(ctx, P, '#fffaf0', { shadow: false }); }, { res: 60, rim: 0, pad: 0.05 });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); card.castShadow = card.receiveShadow = true; g.add(card);
  const sh = softShadow(w - 0.2, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  const mat = { group: g, cols: [], meshes: [card, sh], counters: [], checks: [] };
  for (let p = 0; p < B.cols; p++) {
    const m = sharedMesh(colMat(p)); m.position.set(colCenter(p), (MAT_TOP + MAT_BOT) / 2 - 0.02, 0.03); g.add(m);
    const j = new Juicy(m); j.rot.t = j.rot.v = rand(-0.01, 0.01);
    const col = { p, j, hit: pt => { const l = g.worldToLocal(pt.clone()); return Math.abs(l.x - colCenter(p)) < COLW[p] / 2 && l.y > MAT_BOT && l.y < MAT_TOP + 0.5; } };
    mat.cols[p] = col;
  }
  g.position.set(S.L.main[0], S.L.main[1], 0);
  scene.add(g);
  return mat;
}
function disposeMat() {
  if (!B.mat) return;
  unjuice(B.mat.group); scene.remove(B.mat.group); B.mat.meshes.forEach(disposeMesh);
  for (const s of B.slots) s.j.kill();
  B.mat = null; B.slots = []; B.pieces = [[], [], []]; B.counts = [0, 0, 0];
}

/* ---------- side card: the number to build / the answer ---------- */
function buildCard() {
  removeCard();
  const tall = S.L.sideDir === 'h', w = tall ? 11.0 : 5.3, h = tall ? 3.6 : 5.6;
  const ct = cutTex(w, h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true;
  const g = new THREE.Group(); g.position.set(S.L.side[0], S.L.side[1], 0); g.rotation.z = tall ? -0.01 : 0.02; g.add(m);
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  m.userData.kind = 'card';
  scene.add(g);
  B.card = { group: g, mesh: m, sh, ct, w, h, j: new Juicy(m) };
  drawCard();
}
function removeCard() { if (!B.card) return; B.card.j.kill(); scene.remove(B.card.group); disposeMesh(B.card.mesh); disposeMesh(B.card.sh); B.card = null; }
function drawCard(reveal = false) {
  const c = B.card; if (!c) return;
  const show = B.mode === 'build' || reveal, d = target(), w = c.w, h = c.h;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 55); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    text(ctx, P, B.mode === 'build' ? tr('blkTarget') : tr('blkWhat'), 0, -h / 2 + 0.55, 0.5, INK, { maxW: w - 0.6 });
    if (show) {
      segs(ctx, P, d.slice().reverse().map((x, i) => ({ t: String(x), c: BAND_INK[d.length - 1 - i] })), 0, -0.05, 1.7, w - 0.8);
      text(ctx, P, words(B.N), 0, h / 2 - 0.6, 0.42, '#9a7a62', { weight: 600, shadow: false, maxW: w - 0.5 });
    } else segs(ctx, P, [{ t: '?', c: '#e8574a' }], 0, 0, 1.9, w - 0.8);
  });
  c.j.punch(0.25);
}

/* ---------- counters (build) and answer boxes (read) ---------- */
function setCounter(p) {
  const mat = B.mat; if (!mat) return;
  const old = mat.counters[p]; if (old) old.kill();
  const t = makeTile(B.counts[p], 0.8); t.mesh.position.set(colCenter(p), COUNT_Y, 0.15); mat.group.add(t.mesh);
  t.sc.v = 0.5; t.sc.t = 1; t.punch(0.4); mat.counters[p] = t;
  const ok = B.counts[p] === target()[p];
  if (ok && !mat.checks[p]) {
    const ck = sharedMesh(checkMat()); ck.position.set(colCenter(p) + 0.7, COUNT_Y + 0.6, 0.2); mat.group.add(ck);
    const j = new Juicy(ck); j.sc.v = 0; j.pop(0.6); mat.checks[p] = j;
  } else if (!ok && mat.checks[p]) { mat.checks[p].kill(); mat.checks[p] = null; }
}
function makeSlots() {
  for (let p = 0; p < B.cols; p++) {
    const sm = slotMat(), mat = new THREE.MeshBasicMaterial({ map: sm.mat.map, transparent: true, depthWrite: false, opacity: 0.7 });
    const m = new THREE.Mesh(sm.geo, mat); m.position.set(colCenter(p), COUNT_Y, 0.06); B.mat.group.add(m);
    B.slots.push({ p, mesh: m, j: new Juicy(m), tile: null, r: 1.25, flash: 0 });
  }
}

/* ---------- rounds ---------- */
function pickN() {
  for (let i = 0; i < 50; i++) {
    const n = B.level === 1 ? rint(11, 50) : B.level === 2 ? rint(11, 99) : rint(100, 999);
    if (n !== B.lastN && n % 10 !== 0 || i > 40) { B.lastN = n; return n; }
  }
  return 42;
}
function setPrompt(fn) { B.promptFn = fn; say(fn()); }
// explain once per visit, then say only the short version (or show the text silently when there is no short one)
function intro(key, full, short = null) { const first = firstTime(key), fn = first || !short ? full : short; B.promptFn = fn; if (first || short) say(fn()); else note(fn()); }
function quiet(fn) { B.promptFn = fn; note(fn()); }
async function startRound() {
  const tok = ++B.round;
  B.busy = true; B.wrong = 0; B.help = 0; B.problemWrong = 0; setTrayGlow(null); wiggleHelp(false); S.nudged = false;
  B.cols = B.level === 3 ? 3 : 2; B.mode = B.rounds++ % 2 ? 'read' : 'build'; B.N = pickN();
  // old mat flies away, new one drops in
  if (B.mat) {
    const old = B.mat; B.mat = null; B.slots.forEach(s => s.j.kill()); B.slots = [];
    const og = old.group, sx = og.position.x;
    tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.5; }, ease.inCubic).then(() => { unjuice(og); scene.remove(og); old.meshes.forEach(disposeMesh); });
  }
  B.pieces = [[], [], []]; B.counts = [0, 0, 0];
  const mat = B.mat = buildMat();
  setTray(B.mode === 'build' ? blockItems(B.cols) : digitItems(), { sp: B.mode === 'build' ? { wide: 3.4, tall: 3.5 } : null });
  if (!B.card) buildCard(); else drawCard();
  sfx.whoosh();
  await tween(0.7, k => { mat.group.position.set(S.L.main[0], S.L.main[1] + (1 - k) * 15, 0); }, ease.outBack);
  if (tok !== B.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  if (B.mode === 'build') {
    for (let p = 0; p < B.cols; p++) setCounter(p);
    intro('blkBuild', () => tr('blkBuild', B.N, words(B.N), B.cols === 3), () => tr('blkBuildShort', B.N));
  } else {
    const d = target(); let k = 0;
    for (let p = B.cols - 1; p >= 0; p--) for (let i = 0; i < d[p]; i++) {
      const pc = makePiece(p), pos = slotPos(p, i); pc.mesh.position.copy(pos); pc.mesh.userData.kind = 'matPiece';
      pc.sc.v = 0.0001; pc.sc.t = 0.0001; mat.group.add(pc.mesh); B.pieces[p].push(pc); B.counts[p]++;
      wait(0.05 * k++).then(() => { pc.sc.t = 1; pc.punch(0.3); sfx.tap(); });
    }
    makeSlots();
    await wait(0.05 * k + 0.2);
    if (tok !== B.round) return;
    intro('blkRead', () => tr('blkRead', B.cols === 3));
  }
  B.busy = false; S.lastAct = S.time;
}

/* ---------- building ---------- */
async function placePiece(pc, p) {
  const k = B.pieces[p].length; B.pieces[p].push(pc); B.counts[p]++;
  const to = B.mat.group.localToWorld(slotPos(p, k)), from = pc.mesh.position.clone();
  pc.rot.t = 0; pc.sc.t = 1;
  await tween(0.14, t => pc.mesh.position.lerpVectors(from, to, t), ease.inCubic);
  if (!B.mat) { pc.kill(); return; }
  B.mat.group.attach(pc.mesh); pc.mesh.position.copy(slotPos(p, B.pieces[p].indexOf(pc)));
  pc.mesh.userData.kind = 'matPiece'; pc.punch(0.5); sfx.snap();
  burst(to, 6, { colors: [PIECE[p], '#fffaf0'], speed: 2.4, up: 3, z: 1, size: 0.6 });
}
function relayoutColumn(p) {
  B.pieces[p].forEach((pc, k) => {
    const from = pc.mesh.position.clone(), to = slotPos(p, k);
    if (from.distanceTo(to) > 0.01) tween(0.25, t => pc.mesh.position.lerpVectors(from, to, t));
  });
}
async function trade(p) {
  const list = B.pieces[p].splice(0, 10); B.counts[p] -= 10;
  if (firstTime('trade' + p)) say(tr('blkTrade', p)); else note(tr('blkTrade', p));
  const cx = colCenter(p), froms = list.map(pc => pc.mesh.position.clone());
  const tos = list.map((pc, i) => p === 0 ? V3(cx, 0.5 + (4.5 - i) * 0.3, 0.2) : V3(cx + (i - 4.5) * 0.3, 0.9, 0.2 + i * 0.002));
  await tween(0.5, t => list.forEach((pc, i) => pc.mesh.position.lerpVectors(froms[i], tos[i], t)), ease.inOutSine);
  sfx.ten(); S.shake = Math.max(S.shake, 0.2);
  const c = p === 0 ? V3(cx, 0.5, 0.25) : V3(cx, 0.9, 0.25);
  burst(B.mat.group.localToWorld(c.clone()), 22, { colors: [PIECE[p], PIECE[p + 1], '#fffaf0'], speed: 3, up: 5 });
  list.forEach(pc => pc.kill());
  const np = makePiece(p + 1); np.mesh.position.copy(c); np.mesh.userData.kind = 'matPiece'; B.mat.group.add(np.mesh); np.pop(0.8); np.punch(0.5);
  await wait(0.35);
  const k = B.pieces[p + 1].length; B.pieces[p + 1].push(np); B.counts[p + 1]++;
  const to = slotPos(p + 1, k);
  await tween(0.4, t => { np.mesh.position.lerpVectors(c, to, t); np.mesh.position.z += Math.sin(t * Math.PI) * 0.8; }, ease.inOutSine);
  np.punch(0.4); sfx.snap();
  setCounter(p); setCounter(p + 1); relayoutColumn(p);
  if (B.counts[p + 1] === 10) await trade(p + 1);
}
async function dropBlock(pc, col) {
  if (!col || B.busy || !B.mat) { flyHome(pc); return; }
  const p = pc.place;
  if (col.p !== p) {
    flyHome(pc); sfx.bad(); owlTilt(); col.j.punch(0.3); B.wrong++; B.problemWrong++; recordMistake('blocks', 'wrongCol');
    setPrompt(() => tr('blkWrongCol', p)); return;
  }
  if (value() + 10 ** p > 10 ** B.cols - 1) { flyHome(pc); sfx.bad(); owlTilt(); setPrompt(() => tr('blkTooMany', p)); return; }
  B.busy = true;
  await placePiece(pc, p);
  setCounter(p);
  if (B.counts[p] === 10) await trade(p);
  B.busy = false;
  evaluate(p);
}
function evaluate(p) {
  const d = target();
  if (value() === B.N) return win();
  if (B.counts[p] > d[p]) { B.problemWrong++; recordMistake('blocks', 'tooMany'); owlTilt(); setPrompt(() => tr('blkTooMany', p)); return; }
  if (B.counts[p] === d[p]) sfx.good(p + 2);
}
function removePiece(pc) {
  const p = pc.place, i = B.pieces[p].indexOf(pc); if (i < 0) return;
  B.pieces[p].splice(i, 1); B.counts[p]--;
  flyHome(pc); relayoutColumn(p); setCounter(p);
  if (value() === B.N) win();
}

/* ---------- reading ---------- */
let countTok = 0;
async function countColumn(p) {
  const my = ++countTok;
  const list = B.pieces[p];
  for (let i = 0; i < list.length; i++) {
    if (my !== countTok || !B.mat) return;
    list[i].pop(0.5); list[i].punch(0.4); sfx.dot(i);
    await wait(0.28);
  }
  if (my === countTok && B.mat) say(unit(p, list.length) + '!', { hop: true });
}
function dropDigit(t, slot) {
  if (!slot || B.busy || slot.tile) { flyHome(t); return; }
  const want = target()[slot.p];
  if (t.d === want) {
    slot.tile = t; t.slot = slot;
    const to = slot.mesh.getWorldPosition(V3()); to.z += 0.12; const from = t.mesh.position.clone(), b0 = t.base;
    tween(0.13, k => { t.mesh.position.lerpVectors(from, to, k); t.base = lerp(b0, 1, k); }, ease.inCubic).then(() => {
      if (!B.mat) { t.kill(); return; }
      B.mat.group.attach(t.mesh); t.mesh.position.set(colCenter(slot.p), COUNT_Y, 0.15); t.punch(0.55); t.mesh.userData.kind = 'boardTile'; sfx.snap();
      burst(to, 8, { speed: 2.6, up: 3, z: 1, size: 0.7 });
    });
    sfx.good(slot.p + 2); setTrayGlow(null); wiggleHelp(false); B.wrong = 0;
    B.pieces[slot.p].forEach((pc, i) => wait(i * 0.03).then(() => pc.pop(0.3)));
    if (B.slots.every(s => s.tile)) win();
    return;
  }
  // wrong: shake, bounce home, count that column together
  B.wrong++; B.problemWrong++; recordMistake('blocks', 'readWrong'); slot.flash = 0.7; sfx.bad(); owlTilt(); flyHome(t);
  setPrompt(() => tr('blkReadWrong', slot.p));
  wait(0.5).then(() => countColumn(slot.p));
  if (B.wrong >= 2) { setTrayGlow('d' + want); wiggleHelp(true); }
}

async function win() {
  const tok = B.round; B.busy = true; setTrayGlow(null); wiggleHelp(false);
  const nStars = B.problemWrong === 0 ? 3 : B.problemWrong <= 2 ? 2 : 1;
  owlCheer(); drawCard(true);
  const ti = Math.floor(Math.random() * 4);
  quiet(() => tr('blkWin', B.N, words(B.N), tr('winTail')[ti]));
  for (let p = 0; p < B.cols; p++) B.pieces[p].forEach((pc, i) => wait(0.02 * i + p * 0.1).then(() => { pc.pop(0.5); pc.punch(0.3); }));
  await celebrate({ center: B.mat.group.localToWorld(V3(0, 0.6, 0)), nStars, gameId: 'blocks', level: B.level, wrong: B.problemWrong });
  if (tok !== B.round) return;
  await wait(0.4);
  if (tok !== B.round) return;
  startRound();
}

/* ---------- per-frame ---------- */
const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a'), COL_PEND = new THREE.Color('#fff1b8'), COL_BAD = new THREE.Color('#ff9a8a');
function pending() {
  if (B.busy || !B.mat) return null;
  if (B.mode === 'read') { const s = B.slots.slice().reverse().find(s => !s.tile); return s && { mesh: s.mesh, r: 1.05, slot: s }; }
  return null;
}
function update(dt, t) {
  if (!B.mat) return;
  const pd = pending(), pulse = 0.5 + 0.5 * Math.sin(t * 6);
  for (const s of B.slots) {
    s.flash -= dt; s.mesh.visible = !s.tile;
    const hov = drag.hover === s, isP = pd && pd.slot === s;
    s.j.sc.t = hov ? 1.2 : isP ? 1 + 0.06 * pulse : 1;
    s.mesh.material.color.copy(s.flash > 0 ? COL_BAD : hov ? COL_HOV : isP ? COL_PEND : COL_W);
    s.mesh.material.opacity = hov ? 1 : isP ? 0.75 + 0.25 * pulse : 0.55;
  }
  for (const c of B.mat.cols) if (c) c.j.sc.t = drag.hover === c ? 1.03 : 1;
}

/* ---------- game object ---------- */
export const blkState = B; // for automated tests
B.restart = () => startRound();
export const blocksGame = {
  id: 'blocks',
  levels: () => [{ id: 1, emoji: '🐣', label: tr('lv50') }, { id: 2, emoji: '🧱', label: tr('lv99') }, { id: 3, emoji: '🏰', label: tr('lvHund') }],
  level: 1,
  enter(level) { B.level = this.level = level; B.rounds = 0; buildCard(); setPencil(pending); startRound(); },
  exit() { B.round++; B.busy = true; disposeMat(); removeCard(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { B.level = this.level = l; B.rounds = 0; startRound(); },
  adopt(l) { B.level = this.level = l; },
  relayout() {
    buildCard();
    if (B.mat) B.mat.group.position.set(S.L.main[0], S.L.main[1], 0);
  },
  update,
  pointer(o) {
    if (!o || !B.mat) return;
    const k = o.userData.kind, pc = o.userData.j;
    if (k === 'matPiece') {
      if (B.mode === 'build' && !B.busy) removePiece(pc);
      else { pc.pop(0.4); pc.punch(0.3); sfx.tap(); }
    } else if (k === 'card') B.card.j.punch(0.4);
  },
  help() {
    if (B.busy || !B.mat) return;
    B.help = Math.min(2, B.help + 1);
    const d = target();
    if (B.mode === 'build') {
      const over = [0, 1, 2].find(p => p < B.cols && B.counts[p] > d[p]);
      if (over !== undefined) { setPrompt(() => tr('blkTooMany', over)); return; }
      if (B.help === 1) { setPrompt(() => tr('blkSplit', B.N, splitWords(d))); B.card.j.punch(0.5); }
      else { const need = [2, 1, 0].find(p => p < B.cols && B.counts[p] < d[p]); if (need !== undefined) { say(tr('glow')); setTrayGlow('p' + need); } }
    } else {
      const s = B.slots.slice().reverse().find(s => !s.tile); if (!s) return;
      if (B.help === 1) { say(tr('blkReadWrong', s.p)); countColumn(s.p); }
      else { say(tr('glow')); setTrayGlow('d' + d[s.p]); }
    }
  },
  prompt: () => B.promptFn(),
  idle: () => !B.busy && !!B.mat,
  canDrag: () => !B.busy && !!B.mat,
  dragOpts: () => B.mode === 'build'
    ? { targets: () => B.mat ? B.mat.cols.filter(Boolean) : [], onDrop: dropBlock }
    : { targets: () => B.slots.filter(s => !s.tile), onDrop: dropDigit },
  onLang() {
    if (B.mat) B.mat.cols.forEach((c, p) => { if (c) c.j.mesh.material = colMat(p).mat; });
    drawCard(); say(B.promptFn());
  },
};
