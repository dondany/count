// Column arithmetic on squared paper: adding with carrying ("sums") and taking away with borrowing ("minus").
import * as THREE from 'three';
import { rand, rint, pick, lerp, digitsOf, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, DIGIT_COLORS, SRC, BAND_COLORS, BAND_INK, cutTex, cutShared, sharedMesh, paperMat, paint, text, segs, rr, tornRect, softShadow, makeTile, disposeMesh } from '../engine/paper.js';
import { scene, camera, S, burst, drag, startDrag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, lang, colName } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, digitItems, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { buildPanel, removePanel, setPanelLabel, clearDots, countUp, countDown, panelPunch } from './panel.js';

const $ = s => document.querySelector(s);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// board geometry (board-local units)
const CW = 2.2, PW = 1.45;
const ROW = { label: 3.66, carry: 2.62, top: 1.42, bottom: -0.12, line: -0.98, answer: -2.25, tag: -3.62 };
const CARD_TOP = 4.3, CARD_BOT = -4.25, BAND_TOP = 4.08, BAND_BOT = -3.18;
const colX = (C, i) => { const total = PW + C * CW; return -total / 2 + PW + (C - 1 - i) * CW + CW / 2; };
const signX = C => -(PW + C * CW) / 2 + PW / 2 + 0.1;

const C = {
  op: '+', gameId: 'sums', level: 1, board: null, P: null, active: 0, wrong: 0, problemWrong: 0, help: 0, streak: 0,
  busy: true, round: 0, promptFn: () => '', lastKey: '', borrowed: [], goSaid: false, boardAnim: false,
};

/* =====================================================================
   shared materials
   ===================================================================== */
const bandMat = i => cutShared('band' + i + lang, CW - 0.24, BAND_TOP - BAND_BOT, (ctx, P) => {
  const w = CW - 0.24, h = BAND_TOP - BAND_BOT;
  tornRect(ctx, -w / 2, -h / 2, w, h, 0.2, 0.025, 20 + i); paint(ctx, P, BAND_COLORS[i], { shadow: false });
  text(ctx, P, colName(i), 0, -h / 2 + 0.42, 0.34, BAND_INK[i], { weight: 600, shadow: false, maxW: w - 0.12 });
}, { res: 80, rim: 0, pad: 0.05 });
const cardMat = n => cutShared('card' + n, PW + n * CW + 1.0, CARD_TOP - CARD_BOT, (ctx, P) => {
  const w = PW + n * CW + 1.0, h = CARD_TOP - CARD_BOT;
  tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.04, n * 7); paint(ctx, P, '#fffaf0', { shadow: false });
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(80,140,210,0.17)'; ctx.lineWidth = 0.025; ctx.beginPath();
  for (let x = -w / 2 + 0.3; x < w / 2; x += 0.55) { ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); }
  for (let y = -h / 2 + 0.3; y < h / 2; y += 0.55) { ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); }
  ctx.stroke(); ctx.restore();
}, { res: 80, rim: 0, pad: 0.05 });
const lineMat = n => cutShared('line' + n, PW + n * CW - 0.3, 0.16, (ctx, P) => {
  const w = PW + n * CW - 0.3; tornRect(ctx, -w / 2, -0.08, w, 0.16, 0.07, 0.012, 3); paint(ctx, P, INK, { shadow: false });
}, { res: 90, rim: 0, pad: 0.04 });
const slotTex = kind => cutShared('slot' + kind, kind === 'box' ? 1.45 : 0.95, kind === 'box' ? 1.52 : 0.95, (ctx) => {
  const box = kind === 'box', w = box ? 1.45 : 0.95, h = box ? 1.52 : 0.95;
  if (box) rr(ctx, -w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1, 0.24); else { ctx.beginPath(); ctx.arc(0, 0, w / 2 - 0.05, 0, Math.PI * 2); }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.setLineDash([0.17, 0.12]); ctx.lineWidth = 0.07; ctx.strokeStyle = 'rgba(74,52,38,0.7)'; ctx.stroke();
}, { res: 100, rim: 0, pad: 0.04 });
const signMat = op => cutShared('sign' + op, 1.2, 1.2, (ctx, P) => text(ctx, P, op === '+' ? '+' : '−', 0, 0, 1.7, '#e8574a'), { res: 120, rim: 0.1 });
const tapeMat = () => cutShared('tape', 1.3, 0.42, (ctx) => {
  ctx.beginPath(); ctx.moveTo(-0.65, -0.21);
  for (let x = -0.65; x <= 0.65; x += 0.1) ctx.lineTo(x, -0.21 + (Math.random() - 0.5) * 0.04);
  ctx.lineTo(0.65, 0.21); for (let x = 0.65; x >= -0.65; x -= 0.1) ctx.lineTo(x, 0.21 + (Math.random() - 0.5) * 0.04);
  ctx.closePath(); ctx.fillStyle = 'rgba(246,231,176,0.8)'; ctx.fill();
}, { res: 80, rim: 0, pad: 0.03 });
const checkMat = () => cutShared('check', 0.66, 0.66, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.33, 0, Math.PI * 2); paint(ctx, P, '#6fae52');
  if (P.rim) return;
  ctx.beginPath(); ctx.moveTo(-0.15, 0.0); ctx.lineTo(-0.04, 0.12); ctx.lineTo(0.17, -0.12); ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 0.09; ctx.stroke();
}, { res: 120, rim: 0.06 });
const haloMat = () => cutShared('halo', CW - 0.04, BAND_TOP - BAND_BOT + 0.2, (ctx) => {
  const w = CW - 0.04, h = BAND_TOP - BAND_BOT + 0.2;
  rr(ctx, -w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12, 0.28); ctx.lineWidth = 0.14; ctx.strokeStyle = '#ffc93c'; ctx.stroke();
}, { res: 70, rim: 0, pad: 0.05 });
const arrowMat = () => cutShared('arrow', 1.9, 1.0, (ctx, P) => {
  const ex = -0.8, ey = 0.22, dx = -0.7, dy = 0.75, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  ctx.beginPath(); ctx.moveTo(0.85, 0.32); ctx.quadraticCurveTo(0.05, -0.55, ex, ey);
  ctx.strokeStyle = P.rim ? '#fffaf0' : SRC.carry; ctx.lineWidth = 0.13 + (P.rim ? P.rimW * 2 : 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex + ux * 0.26, ey + uy * 0.26); ctx.lineTo(ex - uy * 0.2, ey + ux * 0.2); ctx.lineTo(ex + uy * 0.2, ey - ux * 0.2); ctx.closePath();
  paint(ctx, P, SRC.carry);
}, { res: 100, rim: 0.06 });
const strikeMat = () => cutShared('strike', 1.25, 0.16, (ctx, P) => { tornRect(ctx, -0.62, -0.08, 1.24, 0.16, 0.07, 0.01, 8); paint(ctx, P, '#e8574a'); }, { res: 100, rim: 0.05 });
const rodMat = () => cutShared('minirod', 0.36, 1.9, (ctx, P) => {
  rr(ctx, -0.16, -0.9, 0.32, 1.8, 0.05); paint(ctx, P, '#2f9e97');
  if (P.rim) return;
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.025; ctx.beginPath();
  for (let k = 1; k < 10; k++) { ctx.moveTo(-0.16, -0.9 + k * 0.18); ctx.lineTo(0.16, -0.9 + k * 0.18); }
  ctx.stroke();
}, { res: 110, rim: 0.05 });

/* =====================================================================
   the worksheet board
   ===================================================================== */
function makeSlot(b, type, col, x, y) {
  const t = slotTex(type === 'carry' ? 'circle' : 'box');
  const mat = new THREE.MeshBasicMaterial({ map: t.mat.map, transparent: true, depthWrite: false, opacity: 0.7 });
  const m = new THREE.Mesh(t.geo, mat); m.position.set(x, y, 0.06); b.group.add(m);
  const s = { type, col, mesh: m, pos: V3(x, y, 0), tile: null, scale: type === 'carry' ? 0.55 : 1, board: b, j: new Juicy(m), flash: 0, r: type === 'carry' ? 0.8 : 1.2 };
  b.slots.push(s); b.disposables.push(mat); return s;
}
function boardDigit(b, d, x, y, base = 1) {
  const t = makeTile(d, base); t.mesh.position.set(x, y, 0.13); t.mesh.userData.kind = 'boardTile';
  t.sc.v = t.sc.t = 0.0001; b.group.add(t.mesh); return t;
}
function tagDraw(list) {
  return (ctx, P) => {
    const w = 3.0, h = 0.8;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2 + 0.02); ctx.lineTo(w / 2 - 0.03, h / 2); ctx.lineTo(-w / 2 + 0.02, h / 2 - 0.02); ctx.closePath();
    paint(ctx, P, '#ffe27a', { shadow: false });
    if (P.rim) return;
    ctx.fillStyle = 'rgba(200,150,40,0.2)'; ctx.fillRect(-w / 2, -h / 2, w, 0.13);
    segs(ctx, P, list, 0, 0.05, 0.5, w - 0.3);
  };
}
function buildBoard(P, mode) {
  const n = mode === 'build' ? 3 : P.C;
  const g = new THREE.Group(); g.rotation.z = -0.012;
  const b = { group: g, C: n, mode, P, slots: [], top: [], bottom: [], answer: [], carry: [], bands: [], digits: [], disposables: [], meshes: [] };
  const cm = cardMat(n);
  const card = sharedMesh(cm); card.position.y = (CARD_TOP + CARD_BOT) / 2; g.add(card);
  const sh = softShadow(cm.W - 0.2, CARD_TOP - CARD_BOT); sh.position.set(0.3, card.position.y - 0.4, -0.35); g.add(sh); b.meshes.push(sh);
  const tm = tapeMat();
  for (const s of [-1, 1]) { const tp = new THREE.Mesh(tm.geo, new THREE.MeshStandardMaterial({ map: tm.mat.map, transparent: true, roughness: 1, depthWrite: false })); tp.position.set(s * (cm.W / 2 - 0.5), CARD_TOP - 0.02, 0.2); tp.rotation.z = -s * 0.45 + rand(-0.1, 0.1); g.add(tp); b.disposables.push(tp.material); }
  for (let i = 0; i < n; i++) {
    const m = sharedMesh(bandMat(i)); m.position.set(colX(n, i), (BAND_TOP + BAND_BOT) / 2, 0.03);
    m.userData.kind = 'band'; m.userData.col = i; g.add(m);
    const j = new Juicy(m); j.rot.t = j.rot.v = rand(-0.012, 0.012); b.bands.push(j);
  }
  b.halo = sharedMesh(haloMat(), false); b.halo.position.set(colX(n, 0), (BAND_TOP + BAND_BOT) / 2, 0.015); b.halo.visible = false; g.add(b.halo);
  const sign = sharedMesh(signMat(C.op)); sign.position.set(signX(n), ROW.bottom, 0.1); g.add(sign);
  const line = sharedMesh(lineMat(n)); line.position.set(0, ROW.line, 0.08); g.add(line);
  if (mode === 'build') {
    for (let i = 0; i < n; i++) { b.top[i] = makeSlot(b, 'top', i, colX(n, i), ROW.top); b.bottom[i] = makeSlot(b, 'bottom', i, colX(n, i), ROW.bottom); }
  } else {
    for (let i = 0; i < P.lenA; i++) b.digits.push(b.top[i] = boardDigit(b, P.dA[i], colX(n, i), ROW.top));
    for (let i = 0; i < P.lenB; i++) b.digits.push(b.bottom[i] = boardDigit(b, P.dB[i], colX(n, i), ROW.bottom));
    for (let i = 0; i < n; i++) b.answer[i] = makeSlot(b, 'answer', i, colX(n, i), ROW.answer);
    if (C.op === '+') for (let i = 1; i < n; i++) b.carry[i] = makeSlot(b, 'carry', i, colX(n, i), ROW.carry);
    const tt = cutTex(3.0, 0.8, tagDraw([{ t: '' }]), { res: 110, rim: 0.06 });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(tt.W, tt.H), paperMat(tt.tex));
    tag.position.set(colX(n, 0), ROW.tag, 0.16); tag.castShadow = true; g.add(tag); b.meshes.push(tag);
    b.tag = { tex: tt, mesh: tag, x: colX(n, 0), j: new Juicy(tag) }; b.tag.j.rot.t = 0.03;
    const am = arrowMat(); let ageo = am.geo;
    if (C.op === '-') { ageo = am.geo.clone(); ageo.scale(-1, 1, 1); b.disposables.push(ageo); } // borrowing flows left -> right
    b.arrow = new THREE.Mesh(ageo, am.mat); b.arrow.visible = false; b.arrow.castShadow = true; g.add(b.arrow);
    b.arrowJ = new Juicy(b.arrow);
  }
  return b;
}
function disposeBoard(b) {
  unjuice(b.group); for (const s of b.slots) s.j.kill();
  scene.remove(b.group);
  b.disposables.forEach(d => d.dispose()); b.meshes.forEach(disposeMesh);
}
async function swapBoard(nb) {
  const old = C.board; C.board = nb; scene.add(nb.group); C.boardAnim = true;
  const [mx, my] = S.L.main;
  nb.group.position.set(mx, my + 16, 0); nb.group.rotation.z = 0.25;
  sfx.whoosh();
  if (old) {
    const og = old.group, sx = og.position.x, sy = og.position.y, sr = og.rotation.z;
    tween(0.55, k => { og.position.x = sx - k * 32; og.position.y = sy + Math.sin(k * Math.PI) * 2.5; og.rotation.z = sr + k * 0.6; }, ease.inCubic)
      .then(() => disposeBoard(old));
    await wait(0.18);
  }
  await tween(0.75, k => {
    nb.group.position.set(S.L.main[0], S.L.main[1] + (1 - k) * 16, 0);
    nb.group.rotation.z = lerp(0.25, -0.012, k);
  }, ease.outBack);
  C.boardAnim = false;
  if (C.board !== nb) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.25);
  burst(nb.group.localToWorld(V3(0, CARD_BOT, 0.3)), 14, { colors: ['#fffaf0', '#f6e7b0', '#e9d3b0'], speed: 4, up: 3, z: 1.5, size: 0.8 });
  nb.digits.forEach((t, k) => wait(0.06 + k * 0.07).then(() => { t.sc.t = 1; t.punch(0.3); sfx.tap(); }));
}

/* =====================================================================
   problems
   ===================================================================== */
function makeAdd(a, b) {
  const dA = digitsOf(a), dB = digitsOf(b), sum = a + b, dS = digitsOf(sum), n = dS.length;
  const carries = [0], colSum = [];
  for (let i = 0; i < n; i++) { const s = (dA[i] || 0) + (dB[i] || 0) + carries[i]; colSum[i] = s; carries[i + 1] = s >= 10 ? 1 : 0; }
  return { op: '+', a, b, sum, dA, dB, dS, C: n, carries, colSum, lenA: dA.length, lenB: dB.length };
}
function makeSub(a, b) {
  const dA = digitsOf(a), dB = digitsOf(b), r = a - b, dR = digitsOf(r), n = dA.length;
  const cur = dA.slice(), borrow = [], topAfter = [];
  let ok = dR.length === n; // no leading zero in the answer
  for (let i = 0; i < n; i++) {
    const bi = dB[i] || 0; borrow[i] = false;
    if (cur[i] < bi) { if (i + 1 >= n || cur[i + 1] <= 0) ok = false; borrow[i] = true; cur[i] += 10; cur[i + 1] -= 1; } // never borrow from a 0
    topAfter[i] = cur[i];
  }
  return { op: '-', a, b, r, dA, dB, dR, C: n, lenA: n, lenB: dB.length, borrow, topAfter, ok };
}
function fresh(a, b) { const key = C.op + a + '|' + b; if (key === C.lastKey) return false; C.lastKey = key; return true; }
function genAdd(level) {
  for (let tries = 0; tries < 500; tries++) {
    let a, b;
    if (level === 1) {
      const ta = rint(1, 8), tb = rint(1, 9 - ta), oa = rint(0, 9), ob = rint(0, 9 - oa);
      if (oa + ob < 2) continue; a = ta * 10 + oa; b = tb * 10 + ob;
    } else if (level === 2) {
      const oa = rint(2, 9), ob = rint(10 - oa, 9), ta = rint(1, 8), tb = Math.random() < 0.8 ? rint(1, Math.max(1, 8 - ta)) : rint(1, 9);
      a = ta * 10 + oa; b = tb * 10 + ob;
    } else {
      a = rint(100, 899); b = Math.random() < 0.3 ? rint(10, 99) : rint(100, 899);
      if (!makeAdd(a, b).carries.some(c => c)) continue;
    }
    if (fresh(a, b)) return [a, b];
  }
  return [23, 45];
}
function genSub(level) {
  for (let tries = 0; tries < 800; tries++) {
    let a, b;
    if (level === 1) { const ta = rint(2, 9), tb = rint(1, ta - 1), oa = rint(1, 9), ob = rint(0, oa); a = ta * 10 + oa; b = tb * 10 + ob; }
    else if (level === 2) { const oa = rint(0, 8), ob = rint(oa + 1, 9), ta = rint(3, 9), tb = rint(1, ta - 2); a = ta * 10 + oa; b = tb * 10 + ob; }
    else { a = rint(201, 999); b = Math.random() < 0.3 ? rint(11, 99) : rint(101, a - 100); }
    if (b <= 0 || b >= a) continue;
    const P = makeSub(a, b);
    if (!P.ok || (level === 3 && !P.borrow.some(x => x))) continue;
    if (fresh(a, b)) return [a, b];
  }
  return [52, 27];
}

/* =====================================================================
   talking helpers
   ===================================================================== */
function setPrompt(fn) { C.promptFn = fn; say(fn()); }
const onlyCarry = i => i >= C.P.lenA && i >= C.P.lenB;
const needCarry = a => C.op === '+' && a + 1 < C.P.C && C.P.carries[a + 1] === 1;
const borrowPending = a => C.op === '-' && C.P.borrow[a] && !C.borrowed[a];
const subTop0 = i => C.P.dA[i] - (i > 0 && C.P.borrow[i - 1] ? 1 : 0); // top digit before this column borrows
function colParts(col) {
  const P = C.P, b = C.board, parts = [];
  if (P.carries[col]) parts.push({ n: 1, src: 'carry', tile: b.carry[col] && b.carry[col].tile });
  if (col < P.lenA) parts.push({ n: P.dA[col], src: 'a', tile: b.top[col] });
  if (col < P.lenB) parts.push({ n: P.dB[col], src: 'b', tile: b.bottom[col] });
  return parts;
}
const eqSegs = parts => parts.flatMap((p, i) => (i ? [{ t: ' + ', c: INK }] : []).concat([{ t: String(p.n), c: SRC[p.src] }]));
const eqHTML = col => colParts(col).map(p => `<span class="${p.src === 'carry' ? 'ca' : p.src === 'a' ? 'sa' : 'sb'}">${p.n}</span>`).join(' + ');
function columnPrompt(i) {
  const P = C.P;
  if (C.op === '+') {
    if (onlyCarry(i)) return tr('onlyCarry', i);
    return i === 0 ? tr('addStart', P.a, P.b, eqHTML(0)) : tr('addCol', i, eqHTML(i));
  }
  const b = P.dB[i] || 0, head = i === 0 ? tr('subStart', P.a, P.b) : tr('subCol', i);
  if (borrowPending(i)) return head + ' ' + tr('needBorrow', subTop0(i), b, P.dA[i + 1], i + 1);
  return head + ' ' + tr('subAsk', P.topAfter[i], b);
}
function updateTag() {
  const b = C.board; if (!b || !b.tag) return;
  const a = Math.min(C.active, b.C - 1), P = C.P;
  b.tag.x = colX(b.C, a);
  let list;
  if (C.active >= b.C) list = [{ t: C.op === '+' ? `${P.a} + ${P.b} = ${P.sum}` : `${P.a} − ${P.b} = ${P.r}`, c: INK }];
  else if (C.op === '-') {
    list = borrowPending(a) ? [{ t: tr('tagBorrow'), c: SRC.carry }]
      : [{ t: String(P.topAfter[a]), c: SRC.a }, { t: ' − ', c: INK }, { t: String(P.dB[a] || 0), c: SRC.b }, { t: ' = ?', c: INK }];
  } else if (b.answer[a].tile && needCarry(a) && !b.carry[a + 1].tile) list = [{ t: String(P.colSum[a]), c: INK }, { t: ` → ${tr('tagCarry')} `, c: '#9a7a62' }, { t: '1', c: SRC.carry }];
  else list = eqSegs(colParts(a)).concat([{ t: ' = ?', c: INK }]);
  b.tag.tex.redraw(tagDraw(list)); b.tag.j.punch(0.3); b.tag.j.rot.t = rand(-0.05, 0.05);
}
function showCount(a) {
  const P = C.P, b = C.board;
  if (C.op === '+') return countUp(colParts(a));
  if (borrowPending(a)) return countUp([{ n: subTop0(a), src: 'a', tile: b.top[a] }]);
  return countDown(P.topAfter[a], P.dB[a] || 0, b.top[a], b.bottom[a]);
}

/* =====================================================================
   solving flow
   ===================================================================== */
function startColumn(i, prefix = null) {
  C.active = i; C.wrong = 0; C.help = 0; setTrayGlow(null); clearDots(); setPanelLabel(null); S.nudged = false; wiggleHelp(false);
  const b = C.board; b.bands[i].pop(0.35); b.bands[i].punch(0.2);
  const pi = prefix ? Math.floor(Math.random() * tr('praise').length) : -1;
  setPrompt(() => (pi >= 0 ? tr('praise')[pi] + ' ' : '') + columnPrompt(i));
  updateTag();
}
async function startSolve(P) {
  const tok = C.round;
  C.P = P; C.busy = true; C.problemWrong = 0; C.active = 0; C.borrowed = []; setTrayGlow(null);
  const nb = buildBoard(P, 'solve');
  clearDots(); setPanelLabel(null); $('#go').classList.remove('show');
  await swapBoard(nb);
  if (tok !== C.round) return;
  await wait(0.35);
  if (tok !== C.round) return;
  C.busy = false; S.lastAct = S.time;
  startColumn(0);
}
function judge(slot, d) {
  const P = C.P, a = C.active;
  if (C.op === '-') {
    if (slot.col > a) return { why: 'order' };
    if (borrowPending(a)) return { why: 'borrowFirst' };
    const t = P.topAfter[a], b = P.dB[a] || 0;
    if (d === t - b) return { ok: true };
    if (P.borrow[a] && d === Math.abs(t - 10 - b)) return { why: 'forgotTen' };
    if (a > 0 && P.borrow[a - 1] && d === P.dA[a] - b) return { why: 'forgotLent' };
    if (Math.abs(d - (t - b)) === 1) return { why: 'close' };
    return { why: 'wrong' };
  }
  if (slot.type === 'answer') {
    if (slot.col !== a) return { why: 'order' };
    if (d === P.dS[a]) return { ok: true };
    const s = P.colSum[a];
    if (s >= 10 && d === Math.floor(s / 10)) return { why: 'tensDigit' };
    if (P.carries[a] && d === (s - 1) % 10) return { why: 'forgotCarry' };
    if (Math.abs(d - P.dS[a]) === 1) return { why: 'close' };
    return { why: 'wrong' };
  }
  const src = slot.col - 1;
  if (src > a) return { why: 'order' };
  if (src < a || !P.carries[slot.col]) return { why: 'noCarry', src };
  if (d !== 1) return { why: 'carryOne' };
  return { ok: true };
}
function expectedDigit() {
  const b = C.board, a = C.active, P = C.P;
  if (!b || b.mode !== 'solve' || a >= b.C) return -1;
  if (C.op === '-') return borrowPending(a) ? -1 : P.topAfter[a] - (P.dB[a] || 0);
  if (!b.answer[a].tile) return P.dS[a];
  if (needCarry(a) && !b.carry[a + 1].tile) return 1;
  return -1;
}
function onWrong(r) {
  const P = C.P, a = C.active;
  C.streak = 0; owlTilt();
  const counts = !['order', 'borrowFirst'].includes(r.why);
  if (counts) { C.wrong++; C.problemWrong++; }
  const t = C.op === '-' ? P.topAfter[a] : 0, bb = C.op === '-' ? (P.dB[a] || 0) : 0;
  const msg = {
    order: () => tr('order', a),
    borrowFirst: () => tr('borrowFirst', P.dA[a + 1]),
    tensDigit: () => tr('tensDigit', eqHTML(a), P.colSum[a]),
    forgotCarry: () => tr('forgotCarry', a),
    forgotTen: () => tr('forgotTen', t, bb),
    forgotLent: () => tr('forgotLent', P.dA[a]),
    close: () => tr('close'),
    noCarry: () => tr('noCarry', eqHTML(r.src), P.colSum[r.src]),
    carryOne: () => tr('carryOne'),
    wrong: () => tr('notQuite'),
  }[r.why];
  say(msg());
  if (r.why === 'borrowFirst') { const src = C.board.top[a + 1]; src.pop(0.6); src.punch(0.5); }
  if (r.why === 'forgotCarry') { const ct = C.board.carry[a] && C.board.carry[a].tile; if (ct) { ct.pop(0.8); ct.punch(0.6); } }
  if (['tensDigit', 'close', 'wrong', 'forgotCarry', 'forgotTen', 'forgotLent'].includes(r.why)) wait(0.45).then(() => { if (C.board && !C.busy) showCount(C.active); });
  if (counts && C.wrong >= 2) { const e = expectedDigit(); if (e >= 0) setTrayGlow('d' + e); wiggleHelp(true); }
}
function onPlaced() {
  const b = C.board, a = C.active, P = C.P;
  sfx.good(C.streak++);
  setTrayGlow(null); wiggleHelp(false);
  if (C.op === '-') return completeColumn();
  const ansDone = !!b.answer[a].tile, carryDone = !needCarry(a) || !!b.carry[a + 1].tile;
  if (ansDone && carryDone) return completeColumn();
  if (ansDone) setPrompt(() => tr('carryNow', P.colSum[a] % 10, a + 1));
  else setPrompt(() => tr('carryFirst', a, eqHTML(a)));
  C.wrong = 0; updateTag();
}
function completeColumn() {
  const b = C.board, a = C.active;
  const ck = sharedMesh(checkMat()); ck.position.set(colX(b.C, a) + 0.74, ROW.answer + 0.8, 0.22); b.group.add(ck);
  const j = new Juicy(ck); j.sc.v = 0; j.pop(0.6); j.rot.t = rand(-0.3, 0.3);
  b.bands[a].punch(0.3);
  burst(b.group.localToWorld(V3(colX(b.C, a), ROW.answer, 0.5)), 16, { speed: 3.5, up: 5, size: 0.9 });
  if (a + 1 >= b.C) { C.active = b.C; updateTag(); return win(); }
  startColumn(a + 1, true);
}
async function win() {
  const tok = C.round, P = C.P, b = C.board;
  C.busy = true; setTrayGlow(null);
  const nStars = C.problemWrong === 0 ? 3 : C.problemWrong <= 2 ? 2 : 1;
  owlCheer();
  b.answer.slice().reverse().forEach((s, k) => wait(k * 0.11).then(() => { if (s.tile) { s.tile.pop(0.6); s.tile.punch(0.4); } }));
  const ti = Math.floor(Math.random() * 4);
  setPrompt(() => C.op === '+' ? tr('addWin', P.a, P.b, P.sum, tr('winTail')[ti]) : tr('subWin', P.a, P.b, P.r, tr('winTail')[ti]));
  await celebrate({ center: b.group.localToWorld(V3(0, 0.9, 0)), nStars, gameId: C.gameId });
  if (tok !== C.round) return;
  await wait(0.5);
  if (tok !== C.round) return;
  nextRound();
}

/* ---------- borrowing (taking away) ---------- */
async function doBorrow(i) {
  const b = C.board, P = C.P, n = b.C, src = b.top[i + 1], x = P.dA[i + 1], t0 = subTop0(i), bb = P.dB[i] || 0;
  C.borrowed[i] = true; C.busy = true; S.lastAct = S.time;
  sfx.pick(); src.punch(0.5); src.pop(0.3);
  // cross out the digit we borrow from
  const st = sharedMesh(strikeMat()); st.position.set(colX(n, i + 1), ROW.top, 0.2); b.group.add(st);
  const sj = new Juicy(st); sj.sc.v = 0; sj.sc.t = 1; sj.rot.t = sj.rot.v = -0.55; sj.pop(0.4);
  await wait(0.22);
  const nd = boardDigit(b, x - 1, colX(n, i + 1), ROW.carry, 0.55); nd.sc.t = 1; nd.pop(0.5); sfx.snap();
  // one ten flies over as a little rod
  const rod = sharedMesh(rodMat()); rod.position.set(colX(n, i + 1), ROW.top, 0.8); b.group.add(rod);
  const rj = new Juicy(rod); rj.sc.v = 0.3; rj.sc.t = 1;
  const from = rod.position.clone(), to = V3(colX(n, i) - 0.7, ROW.top + 0.45, 0.8);
  sfx.whoosh();
  await tween(0.55, k => { rod.position.lerpVectors(from, to, k); rod.position.y += Math.sin(k * Math.PI) * 1.0; rj.extra = k * Math.PI * 2; }, ease.inOutSine);
  rj.sc.t = 0; wait(0.2).then(() => rj.kill());
  const one = boardDigit(b, 1, colX(n, i) - 0.7, ROW.top + 0.45, 0.5); one.sc.t = 1; one.pop(0.6);
  b.top[i].punch(0.5); b.top[i].pop(0.3); sfx.ten(); S.shake = Math.max(S.shake, 0.12);
  burst(b.group.localToWorld(V3(colX(n, i), ROW.top + 0.4, 0.6)), 14, { colors: ['#2f9e97', '#f2c14e', '#fffaf0'], speed: 3, up: 4, size: 0.8 });
  C.busy = false; C.wrong = 0;
  setPrompt(() => tr('borrowed', x, t0, bb));
  updateTag();
}

/* ---------- build your own (adding) ---------- */
async function enterBuild() {
  const tok = C.round;
  C.P = null; C.busy = true; setTrayGlow(null); clearDots(); setPanelLabel(null);
  await swapBoard(buildBoard(null, 'build'));
  if (tok !== C.round) return;
  C.busy = false;
  setPrompt(() => tr('buildStart'));
}
const readRow = slots => { let v = 0; for (let i = slots.length - 1; i >= 0; i--) v = v * 10 + (slots[i].tile ? slots[i].tile.d : 0); return v; };
const buildReady = () => { const b = C.board; return b && b.mode === 'build' && b.top[0].tile && b.bottom[0].tile; };
function updateGo() {
  const go = $('#go'), ready = buildReady() && !C.busy;
  if (ready && !go.classList.contains('show')) { go.classList.add('show'); C.promptFn = () => tr('buildReady'); say(tr('buildReady'), { voice: !C.goSaid }); C.goSaid = true; }
  if (!ready) go.classList.remove('show');
}
$('#go').addEventListener('click', () => {
  if (!buildReady() || C.busy) return;
  const a = readRow(C.board.top), b = readRow(C.board.bottom);
  $('#go').classList.remove('show'); C.round++;
  startSolve(makeAdd(a, b));
});

/* ---------- placing digits ---------- */
async function placeTile(t, slot) {
  slot.tile = t; t.slot = slot;
  const to = slot.mesh.getWorldPosition(V3()); to.z += 0.12;
  const from = t.mesh.position.clone(), b0 = t.base; t.rot.t = 0; t.sc.t = 1;
  await tween(0.13, k => { t.mesh.position.lerpVectors(from, to, k); t.base = lerp(b0, slot.scale, k); }, ease.inCubic);
  if (slot.tile !== t) return; // taken away mid-flight (build mode)
  if (slot.board !== C.board || !slot.board.group.parent) { t.kill(); return; }
  slot.board.group.attach(t.mesh); t.mesh.position.set(slot.pos.x, slot.pos.y, 0.13); t.base = slot.scale;
  t.mesh.userData.kind = 'boardTile'; t.punch(0.55); sfx.snap(); S.shake = Math.max(S.shake, 0.08);
  burst(to, 8, { colors: [DIGIT_COLORS[t.d], '#fffaf0'], speed: 2.6, up: 3, z: 1, size: 0.7 });
}
async function rejectTile(t, slot) {
  const to = slot.mesh.getWorldPosition(V3()); to.z += 0.6;
  const from = t.mesh.position.clone(); slot.flash = 0.7;
  await tween(0.12, k => t.mesh.position.lerpVectors(from, to, k));
  sfx.bad(); t.sc.t = 1;
  await tween(0.45, k => { const w = Math.sin(k * Math.PI * 6) * (1 - k); t.extra = w * 0.35; t.mesh.position.x = to.x + w * 0.15; }, ease.linear);
  t.extra = 0; flyHome(t);
}
function dropOnSlot(t, slot) {
  const b = C.board;
  if (!slot || !b) { flyHome(t); return; }
  if (b.mode === 'build') {
    if (slot.tile && slot.tile !== t) { const old = slot.tile; slot.tile = null; old.slot = null; flyHome(old); }
    placeTile(t, slot); updateGo(); sfx.good(C.streak++ % 4); return;
  }
  if (C.busy) { flyHome(t); return; }
  const r = judge(slot, t.d);
  if (r.ok) { placeTile(t, slot); onPlaced(); }
  else { rejectTile(t, slot); onWrong(r); }
}
const dragOpts = () => ({
  targets: () => { const b = C.board; if (!b || C.boardAnim) return []; return b.mode === 'build' ? b.slots : b.slots.filter(s => !s.tile); },
  onDrop: dropOnSlot,
});

/* =====================================================================
   per-frame
   ===================================================================== */
const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a'), COL_PEND = new THREE.Color('#fff1b8'), COL_BAD = new THREE.Color('#ff9a8a');
function pending() {
  const b = C.board; if (!b || C.busy || C.boardAnim) return null;
  if (b.mode === 'build') { const s = !b.top[0].tile ? b.top[0] : !b.bottom[0].tile ? b.bottom[0] : null; return s && { mesh: s.mesh, r: 1.05, slot: s }; }
  const a = C.active; if (a >= b.C) return null;
  if (borrowPending(a)) return { mesh: b.top[a + 1].mesh, r: 0.95, left: true };
  if (!b.answer[a].tile) return { mesh: b.answer[a].mesh, r: 1.05, slot: b.answer[a] };
  if (needCarry(a) && !b.carry[a + 1].tile) return { mesh: b.carry[a + 1].mesh, r: 0.75, left: true, slot: b.carry[a + 1] };
  return null;
}
function update(dt, t) {
  const b = C.board; if (!b) return;
  const pd = pending(), pend = pd && pd.slot, pulse = 0.5 + 0.5 * Math.sin(t * 6);
  for (const s of b.slots) {
    s.flash -= dt;
    s.mesh.visible = !s.tile;
    const hov = drag.hover === s, isP = s === pend;
    s.j.sc.t = hov ? 1.2 : isP ? 1 + 0.06 * pulse : 1;
    s.mesh.material.color.copy(s.flash > 0 ? COL_BAD : hov ? COL_HOV : isP ? COL_PEND : COL_W);
    let op = hov ? 1 : isP ? 0.75 + 0.25 * pulse : 0.55;
    if (b.mode === 'solve' && s.type === 'carry' && !C.P.carries[s.col]) op = 0.28;
    s.mesh.material.opacity = op;
  }
  const act = b.mode === 'solve' && !C.busy && C.active < b.C;
  b.bands.forEach((j, i) => { j.sc.t = act && i === C.active ? 1.025 : 1; j.mesh.position.z = lerp(j.mesh.position.z, act && i === C.active ? 0.05 : 0.03, 0.2); });
  b.halo.visible = act;
  if (act) { b.halo.position.x = lerp(b.halo.position.x, colX(b.C, C.active), 1 - Math.exp(-dt * 12)); const s = 1 + 0.015 * Math.sin(t * 5); b.halo.scale.set(s, s, 1); }
  if (b.tag) b.tag.mesh.position.x = lerp(b.tag.mesh.position.x, b.tag.x, 1 - Math.exp(-dt * 10));
  if (b.arrow) {
    const a = C.active;
    let show = false;
    if (act && C.op === '+') show = b.answer[a] && b.answer[a].tile && needCarry(a) && !b.carry[a + 1].tile;
    if (act && C.op === '-') show = borrowPending(a);
    b.arrow.visible = !!show;
    if (show) {
      const x = C.op === '+' ? (colX(b.C, a) + colX(b.C, a + 1) + 0.5) / 2 : (colX(b.C, a + 1) + colX(b.C, a) - 0.6) / 2;
      b.arrow.position.set(x, ROW.carry + 0.52, 0.2); b.arrowJ.sc.t = 1 + 0.08 * Math.sin(t * 7);
    }
  }
  const go = $('#go');
  if (go.classList.contains('show')) {
    const p = b.group.localToWorld(V3(0, ROW.answer, 0.3)).project(camera);
    go.style.left = (p.x + 1) / 2 * innerWidth + 'px'; go.style.top = (1 - p.y) / 2 * innerHeight + 'px';
  }
}

/* =====================================================================
   game objects
   ===================================================================== */
function pointer(o, e) {
  const b = C.board; if (!b || !o) return;
  const k = o.userData.kind;
  if (k === 'boardTile') {
    const t = o.userData.j, s = t.slot;
    if (b.mode === 'build' && s && !C.busy) {
      s.tile = null; t.slot = null; t.key = 'd' + t.d; scene.attach(t.mesh); t.mesh.userData.kind = null;
      startDrag(t, e, dragOpts()); updateGo(); return;
    }
    if (C.op === '-' && b.mode === 'solve' && !C.busy && C.active < b.C) {
      const a = C.active;
      if (borrowPending(a) && b.top[a + 1] === t) { doBorrow(a); return; }
      if (!borrowPending(a) && b.top[a + 1] === t && !C.borrowed[a]) say(tr('noBorrow'));
    }
    t.punch(0.4); t.pop(0.3); sfx.tap();
  } else if (k === 'panel' || k === 'band') {
    if (C.P && b.mode === 'solve' && !C.busy && C.active < b.C) showCount(C.active); else panelPunch();
  }
}
function help() {
  const b = C.board, P = C.P; if (!b || C.busy) return;
  if (b.mode === 'build') { say(buildReady() ? tr('buildHelpReady') : tr('buildHelp')); return; }
  const a = C.active; if (a >= b.C) return;
  C.help = Math.min(2, C.help + 1);
  if (borrowPending(a)) { say(tr('borrowFirst', P.dA[a + 1])); const src = b.top[a + 1]; src.pop(0.6); src.punch(0.5); showCount(a); return; }
  if (C.help === 1) {
    if (C.op === '+') say(b.answer[a].tile && needCarry(a) ? tr('helpCarry', a + 1) : tr('helpCount', eqHTML(a)));
    else say(tr('subHelp', P.topAfter[a], P.dB[a] || 0));
    showCount(a);
  } else {
    say(tr('glow'));
    const e = expectedDigit(); if (e >= 0) setTrayGlow('d' + e);
  }
}
function nextRound() {
  C.round++; C.goSaid = false;
  if (C.level === 'build') enterBuild();
  else if (C.op === '+') startSolve(makeAdd(...genAdd(C.level)));
  else startSolve(makeSub(...genSub(C.level)));
}
function makeGame(op, id) {
  return {
    id,
    levels: () => op === '+'
      ? [{ id: 1, emoji: '🐣', label: tr('lvEasy') }, { id: 2, emoji: '🎒', label: tr('lvCarry') }, { id: 3, emoji: '🚀', label: tr('lvBig') }, { id: 'build', emoji: '✏️', label: tr('lvMake') }]
      : [{ id: 1, emoji: '🐣', label: tr('lvEasy') }, { id: 2, emoji: '🎈', label: tr('lvBorrow') }, { id: 3, emoji: '🚀', label: tr('lvBig') }],
    level: 1,
    enter(level) {
      C.op = op; C.gameId = id; C.level = this.level = level; C.board = null; C.lastKey = '';
      $('#go').textContent = tr('go');
      setTray(digitItems()); buildPanel(); setPencil(pending);
      nextRound();
    },
    exit() {
      C.round++; C.busy = true;
      if (C.board) disposeBoard(C.board); C.board = null; C.P = null;
      removePanel(); setTray(null); setPencil(null); $('#go').classList.remove('show'); wiggleHelp(false);
    },
    setLevel(l) { C.level = this.level = l; nextRound(); },
    relayout() {
      buildPanel();
      if (C.board && !C.boardAnim) C.board.group.position.set(S.L.main[0], S.L.main[1], 0);
    },
    update, pointer, help,
    prompt: () => C.promptFn(),
    idle: () => !C.busy && !!C.board && !C.boardAnim,
    canDrag: () => !C.busy && !C.boardAnim && !!C.board,
    dragOpts,
    onLang() {
      $('#go').textContent = tr('go');
      if (C.board) C.board.bands.forEach((j, i) => { j.mesh.material = bandMat(i).mat; });
      buildPanel(); if (C.P && C.board && C.board.mode === 'solve') updateTag();
      say(C.promptFn());
    },
  };
}
export const colState = C; // for automated tests
export const sumsGame = makeGame('+', 'sums');
export const minusGame = makeGame('-', 'minus');
