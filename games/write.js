// "Writing": trace English letters with a finger — each line from its green start dot, in the right order and direction.
import * as THREE from 'three';
import { clamp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, font, cutTex, cutShared, sharedMesh, paperMat, paint, text, rr, tornRect, starPath, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, atZ, startGrab } from '../engine/core.js';
import { sfx, speak } from '../engine/audio.js';
import { tr, lang, cap1 } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';
import { store, save } from '../engine/store.js';
import { UPPER, LOWER } from './letters.js';
import { PICS, ANIMALS } from './pictures.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const INKS = ['#e8574a', '#2f9e97', '#3f7fc1', '#d9508f', '#e9a825'];
const TOL = 0.55, START_TOL = 0.85, GUIDE_W = 0.62, INK_W = 0.46;
const Wr = {
  level: 1, idx: 0, ch: 'A', strokes: [], cur: 0, prog: 0, warned: false, startWarned: false, grabbing: false,
  busy: true, round: 0, help: 0, mistakes: 0, board: null, card: null, buttons: [], dirty: false, marker: null, promptFn: () => '',
};
const letters = () => Wr.level === 1 ? ABC : ABC.toLowerCase();

/* ---------- geometry ---------- */
const dims = () => S.L.name === 'wide' ? { w: 11.0, h: 8.2 } : { w: 11.3, h: 8.4 };
function buildStrokes(ch) {
  const upper = Wr.level === 1, raw = (upper ? UPPER : LOWER)[ch], s = upper ? 0.058 : 0.046, top = upper ? 2.9 : 3.1;
  let x0 = Infinity, x1 = -Infinity; raw.flat().forEach(([x]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); });
  const cx = (x0 + x1) / 2;
  return raw.map(pts => {
    const P = pts.map(([x, y]) => [(x - cx) * s, top - y * s]), cum = [0];
    for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const len = cum[cum.length - 1];
    return { pts: P, cum, len, dot: len < 0.25 };
  });
}
function pointAt(st, s) {
  for (let k = 0; k < st.pts.length - 1; k++) if (s <= st.cum[k + 1] || k === st.pts.length - 2) {
    const u = clamp((s - st.cum[k]) / Math.max(1e-6, st.cum[k + 1] - st.cum[k]), 0, 1);
    return [st.pts[k][0] + (st.pts[k + 1][0] - st.pts[k][0]) * u, st.pts[k][1] + (st.pts[k + 1][1] - st.pts[k][1]) * u];
  }
  return st.pts[0];
}
// closest point on the stroke, only looking a little behind / ahead of the progress (so a closing circle can't jump to the end)
function project(q, st, sMin, sMax) {
  let best = { d: Infinity, s: 0 };
  for (let k = 0; k < st.pts.length - 1; k++) {
    const s0 = st.cum[k], s1 = st.cum[k + 1]; if (s1 < sMin || s0 > sMax) continue;
    const [ax, ay] = st.pts[k], [bx, by] = st.pts[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const u = clamp(((q.x - ax) * dx + (q.y - ay) * dy) / L2, 0, 1), d = Math.hypot(q.x - (ax + dx * u), q.y - (ay + dy * u));
    if (d < best.d) best = { d, s: s0 + (s1 - s0) * u };
  }
  return best;
}

/* ---------- board ---------- */
const boardMat = () => { const { w, h } = dims(); return cutShared(`wboard${S.L.name}${Wr.level}`, w, h, (ctx, P) => {
  tornRect(ctx, -w / 2, -h / 2, w, h, 0.35, 0.04, 606); paint(ctx, P, '#fffaf0', { shadow: false });
  if (P.rim) return;
  const upper = Wr.level === 1, line = (y, dash, a) => { ctx.beginPath(); ctx.setLineDash(dash ? [0.2, 0.15] : []); ctx.moveTo(-w / 2 + 0.4, -y); ctx.lineTo(w / 2 - 0.4, -y); ctx.strokeStyle = `rgba(80,140,210,${a})`; ctx.lineWidth = 0.04; ctx.stroke(); };
  if (upper) { line(2.9, false, 0.45); line(0, true, 0.35); line(-2.9, false, 0.6); }
  else { line(3.1, false, 0.3); line(3.1 - 45 * 0.046, true, 0.4); line(3.1 - 100 * 0.046, false, 0.6); line(3.1 - 135 * 0.046, false, 0.2); }
  ctx.setLineDash([]);
}, { res: 50, rim: 0.1 }); };
function buildBoard() {
  const { w, h } = dims(), g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1], 0);
  const bg = sharedMesh(boardMat()); bg.userData.kind = 'writeBoard'; g.add(bg);
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  const ov = cutTex(w, h, () => {}, { res: 55, rim: 0, pad: 0.02 });
  const om = new THREE.Mesh(new THREE.PlaneGeometry(ov.W, ov.H), new THREE.MeshBasicMaterial({ map: ov.tex, transparent: true, depthWrite: false }));
  om.position.z = 0.06; om.userData.kind = 'writeBoard'; g.add(om);
  const marker = new THREE.Object3D(); g.add(marker);
  const tracer = new Juicy(sharedMesh(cutShared('wtracer', 0.7, 0.7, (ctx, P) => { starPath(ctx, 5, 0.33, 0.15); paint(ctx, P, '#f2c14e'); }, { res: 120, rim: 0.06 })), 0.0001);
  tracer.mesh.position.z = 0.3; g.add(tracer.mesh);
  scene.add(g);
  return { group: g, sh, ov, om, marker, tracer, bg: new Juicy(bg) };
}
function removeBoard(b) { if (!b) return; unjuice(b.group); scene.remove(b.group); disposeMesh(b.sh); disposeMesh(b.om); }
const path = (ctx, pts, upto = Infinity, st = null) => {
  ctx.beginPath();
  if (!st || upto >= st.len) { pts.forEach(([x, y], i) => i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y)); return; }
  ctx.moveTo(pts[0][0], -pts[0][1]);
  for (let k = 1; k < pts.length && st.cum[k] <= upto; k++) ctx.lineTo(pts[k][0], -pts[k][1]);
  const [ex, ey] = pointAt(st, upto); ctx.lineTo(ex, -ey);
};
function drawOverlay() {
  const b = Wr.board; if (!b) return;
  b.ov.redraw((ctx, P) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const st of Wr.strokes) { path(ctx, st.pts); ctx.strokeStyle = 'rgba(122,93,73,.2)'; ctx.lineWidth = st.dot ? 0.9 : GUIDE_W; ctx.stroke(); }
    for (const st of Wr.strokes) { path(ctx, st.pts); ctx.setLineDash([0.12, 0.16]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.05; ctx.stroke(); ctx.setLineDash([]); }
    Wr.strokes.forEach((st, i) => {
      if (i > Wr.cur) return;
      const upto = i < Wr.cur ? Infinity : Wr.prog;
      if (upto <= 0) return;
      if (st.dot) { ctx.beginPath(); ctx.arc(st.pts[0][0], -st.pts[0][1], 0.3, 0, Math.PI * 2); ctx.fillStyle = INKS[i % INKS.length]; ctx.fill(); return; }
      path(ctx, st.pts, upto, st); ctx.strokeStyle = INKS[i % INKS.length]; ctx.lineWidth = INK_W; ctx.stroke();
    });
    // later strokes: small grey numbers at their starts
    Wr.strokes.forEach((st, i) => {
      if (i <= Wr.cur) return;
      const [x, y] = st.pts[0]; ctx.beginPath(); ctx.arc(x, -y, 0.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(122,93,73,.35)'; ctx.fill();
      text(ctx, P, String(i + 1), x, -y, 0.24, '#fffaf0', { shadow: false });
    });
    const st = Wr.strokes[Wr.cur]; if (!st || Wr.busyDone) return;
    // arrows showing which way to go
    if (!st.dot) for (let k = 1; k <= 3; k++) {
      const s = Wr.prog + k * 0.9; if (s > st.len - 0.2) break;
      const [x1, y1] = pointAt(st, s - 0.12), [x2, y2] = pointAt(st, s + 0.12), a = Math.atan2(-(y2 - y1), x2 - x1);
      ctx.save(); ctx.translate(x2, -y2); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-0.14, -0.13); ctx.lineTo(0.06, 0); ctx.lineTo(-0.14, 0.13);
      ctx.strokeStyle = 'rgba(111,174,82,.9)'; ctx.lineWidth = 0.07; ctx.stroke(); ctx.restore();
    }
    const [sx, sy] = Wr.prog > 0 ? pointAt(st, Wr.prog) : st.pts[0];
    ctx.beginPath(); ctx.arc(sx, -sy, 0.34, 0, Math.PI * 2); ctx.fillStyle = '#6fae52'; ctx.fill();
    ctx.lineWidth = 0.06; ctx.strokeStyle = '#fffaf0'; ctx.stroke();
    text(ctx, P, String(Wr.cur + 1), sx, -sy, 0.34, '#fffaf0', { shadow: false });
  });
  Wr.dirty = false;
}

/* ---------- side card + buttons ---------- */
function pictureFor(ch) {
  const up = ch.toUpperCase();
  const w = Object.entries(PICS).find(([, p]) => p[lang].startsWith(up));
  if (w) return { draw: w[1].draw, word: cap1(w[1][lang].toLowerCase()) };
  const a = ANIMALS.find(x => x.name[lang].toUpperCase().startsWith(up));
  return a ? { draw: a.draw, word: cap1(a.name[lang]) } : null;
}
function buildCard() {
  removeCard();
  const tall = S.L.sideDir === 'h', w = tall ? 7.6 : 5.3, h = tall ? 3.4 : 5.4;
  const ct = cutTex(w, h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'wcard';
  const g = new THREE.Group(); g.position.set(tall ? S.L.side[0] - 1.8 : S.L.side[0], tall ? S.L.side[1] - 0.3 : S.L.side[1] + 0.8, 0); g.rotation.z = tall ? -0.01 : 0.02;
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  Wr.card = { group: g, mesh: m, sh, ct, w, h, tall, j: new Juicy(m) };
  Wr.buttons.forEach(j => j.kill()); Wr.buttons = [];
  [-1, 1].forEach((d, i) => {
    const bm = sharedMesh(cutShared('wnav' + d, 1.3, 1.3, (ctx, P) => {
      ctx.beginPath(); ctx.arc(0, 0, 0.6, 0, Math.PI * 2); paint(ctx, P, '#f2c14e');
      if (!P.rim) { ctx.beginPath(); ctx.moveTo(-0.15 * d, -0.25); ctx.lineTo(0.2 * d, 0); ctx.lineTo(-0.15 * d, 0.25); ctx.strokeStyle = INK; ctx.lineWidth = 0.12; ctx.stroke(); }
    }, { res: 110, rim: 0.07 }));
    bm.userData.kind = 'wnav'; bm.userData.dir = d;
    bm.position.set(tall ? S.L.side[0] + 3.2 + i * 1.5 : S.L.side[0] + d * 0.9, tall ? S.L.side[1] - 0.3 : S.L.side[1] - 2.6, 0.3);
    scene.add(bm); Wr.buttons.push(new Juicy(bm));
  });
  drawCard();
}
function removeCard() { Wr.buttons.forEach(j => j.kill()); Wr.buttons = []; if (!Wr.card) return; Wr.card.j.kill(); scene.remove(Wr.card.group); disposeMesh(Wr.card.mesh); disposeMesh(Wr.card.sh); Wr.card = null; }
function drawCard() {
  const c = Wr.card; if (!c) return;
  const { w, h, tall } = c, pic = pictureFor(Wr.ch);
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 66); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    const ux = tall ? -2.4 : 0, uy = tall ? 0 : -1.1;
    text(ctx, P, Wr.ch.toUpperCase() + Wr.ch.toLowerCase(), ux, uy, 1.5, '#e8574a');
    if (pic) {
      ctx.save(); ctx.translate(tall ? 1.2 : 0, tall ? -0.25 : 0.95); ctx.scale(0.55, 0.55); pic.draw(ctx, P); ctx.restore();
      text(ctx, P, pic.word, tall ? 2.9 : 0, tall ? 0.95 : 2.1, 0.44, INK, { maxW: tall ? 2.8 : w - 0.6 });
    }
  });
  c.j.punch(0.25);
}

/* ---------- flow ---------- */
function setPrompt(fn) { Wr.promptFn = fn; say(fn()); }
async function demo() {
  const b = Wr.board; if (!b) return;
  const my = Wr.round, t = b.tracer;
  t.sc.t = 1;
  for (const st of Wr.strokes) {
    if (my !== Wr.round || !Wr.board) return;
    if (st.dot) { t.mesh.position.set(st.pts[0][0], st.pts[0][1], 0.3); t.pop(0.6); sfx.tap(); await wait(0.4); continue; }
    await tween(Math.max(0.35, st.len / 4.5), k => { const [x, y] = pointAt(st, k * st.len); t.mesh.position.set(x, y, 0.3); t.extra = k * 6; }, ease.inOutSine);
    sfx.dot(Wr.strokes.indexOf(st) + 2); await wait(0.2);
  }
  t.sc.t = 0.0001;
}
async function startLetter(auto = true) {
  const tok = ++Wr.round;
  Wr.busy = true; Wr.busyDone = false; Wr.help = 0; Wr.mistakes = 0; Wr.cur = 0; Wr.prog = 0; Wr.warned = Wr.startWarned = false; S.nudged = false; wiggleHelp(false);
  Wr.ch = letters()[Wr.idx]; Wr.strokes = buildStrokes(Wr.ch);
  if (!Wr.board) {
    Wr.board = buildBoard(); const g = Wr.board.group;
    await tween(0.6, k => g.position.set(S.L.main[0], S.L.main[1] + (1 - k) * 15, 0), ease.outBack);
    sfx.snap();
  } else { Wr.board.bg.punch(0.2); sfx.paper(); }
  if (tok !== Wr.round) return;
  drawOverlay(); drawCard();
  setPrompt(() => tr('wrStart', Wr.ch));
  if (auto) { await wait(1.2); if (tok !== Wr.round) return; say(tr('wrWatch')); await demo(); if (tok !== Wr.round) return; setPrompt(() => tr('wrStart', Wr.ch)); }
  Wr.busy = false; S.lastAct = S.time;
}
function completeStroke() {
  const st = Wr.strokes[Wr.cur], end = st.pts[st.pts.length - 1];
  Wr.prog = st.len; Wr.grabbing = false;
  burst(Wr.board.group.localToWorld(V3(end[0], end[1], 0.4)), 10, { colors: [INKS[Wr.cur % INKS.length], '#fffaf0', '#f2c14e'], speed: 2.4, up: 3, z: 1, size: 0.6 });
  sfx.good(Wr.cur + 2);
  if (Wr.cur + 1 < Wr.strokes.length) {
    Wr.cur++; Wr.prog = 0; Wr.warned = Wr.startWarned = false; drawOverlay();
    say(tr('wrNext', Wr.cur + 1), { hop: false });
  } else letterDone();
}
async function letterDone() {
  const tok = Wr.round; Wr.busy = true; Wr.busyDone = true; drawOverlay();
  Wr.board.bg.pop(0.4); owlCheer();
  const pic = pictureFor(Wr.ch);
  setPrompt(() => tr('wrDone', Wr.ch, pic && pic.word));
  const nStars = Wr.mistakes === 0 ? 3 : Wr.mistakes <= 2 ? 2 : 1;
  await celebrate({ center: Wr.board.group.localToWorld(V3(0, 0.3, 0)), nStars, gameId: 'write', level: Wr.level, wrong: Wr.mistakes });
  if (tok !== Wr.round) return;
  Wr.idx = (Wr.idx + 1) % 26; store.write = store.write || {}; store.write[Wr.level] = Wr.idx; save();
  startLetter();
}
function wrongStart() {
  if (!Wr.startWarned) { Wr.startWarned = true; Wr.mistakes++; recordMistake('write', 'start'); }
  sfx.bad(); owlTilt(); say(tr('wrStartDot')); Wr.board.bg.punch(0.15);
}
// finger at q (board coordinates) while drawing the current stroke
let lastTick = 0;
function advance(st, q) {
  if (!Wr.grabbing || !Wr.board) return;
  const pr = project(q, st, Wr.prog - 0.3, Wr.prog + 1.1);
  if (pr.d < TOL && pr.s > Wr.prog) {
    Wr.prog = pr.s; Wr.dirty = true;
    if (Wr.prog - lastTick > 0.5) { lastTick = Wr.prog; sfx.dot(Math.floor(Wr.prog * 2) % 10); }
    if (Wr.prog >= st.len - 0.3) completeStroke();
  } else if (pr.d > TOL * 2.2 && !Wr.warned) {
    Wr.warned = true; Wr.mistakes++; recordMistake('write', 'path'); sfx.bad(); owlTilt(); say(tr('wrStay'));
  }
}
// finger goes down at l: start (or resume) the current stroke, or explain where to start
function begin(l) {
  const st = Wr.strokes[Wr.cur], [sx, sy] = st.pts[0]; S.lastAct = S.time;
  if (st.dot) { if (Math.hypot(l.x - sx, l.y - sy) < START_TOL + 0.1) { Wr.prog = 1; completeStroke(); } else wrongStart(); return null; }
  const [px, py] = pointAt(st, Wr.prog);
  const fromStart = Wr.prog === 0 && Math.hypot(l.x - sx, l.y - sy) < START_TOL, resume = Wr.prog > 0 && Math.hypot(l.x - px, l.y - py) < TOL * 1.4;
  if (!fromStart && !resume) { wrongStart(); return null; }
  Wr.grabbing = true; lastTick = Wr.prog; sfx.pick();
  return st;
}
function pointerDown(e) {
  const b = Wr.board; if (!b || Wr.busy) return;
  const st = begin(b.group.worldToLocal(atZ(0.2))); if (!st) return;
  startGrab(e, pt => advance(st, Wr.board ? Wr.board.group.worldToLocal(pt) : pt), () => { Wr.grabbing = false; });
}
// test hook: trace the current stroke (reverse = start from the wrong end)
Wr.simulate = (reverse = false, frac = 1) => {
  const st = Wr.strokes[Wr.cur]; if (!st || Wr.busy) return;
  const pts = reverse ? st.pts.slice().reverse() : st.pts, s0 = new THREE.Vector3(pts[0][0] + 0.1, pts[0][1] - 0.1, 0);
  if (!begin(s0)) return;
  for (let s = 0; s <= st.len * frac && Wr.grabbing; s += 0.15) { const [x, y] = pointAt(st, s); advance(st, new THREE.Vector3(x + 0.12, y + 0.08, 0)); }
  Wr.grabbing = false;
};

/* ---------- game object ---------- */
export const writeState = Wr;
export const writeGame = {
  id: 'write',
  levels: () => [{ id: 1, emoji: '🔠', label: tr('lvUpper') }, { id: 2, emoji: '🔡', label: tr('lvLower') }],
  level: 1,
  enter(level) {
    Wr.level = this.level = level; Wr.idx = (store.write && store.write[level]) || 0;
    setTray(null); buildCard();
    setPencil(() => {
      if (Wr.busy || Wr.grabbing || !Wr.board) return null;
      const st = Wr.strokes[Wr.cur]; if (!st) return null;
      const [x, y] = Wr.prog > 0 ? pointAt(st, Wr.prog) : st.pts[0]; Wr.board.marker.position.set(x, y, 0.2);
      return { mesh: Wr.board.marker, r: 0.55 };
    });
    startLetter();
  },
  exit() { Wr.round++; Wr.busy = true; Wr.grabbing = false; removeBoard(Wr.board); Wr.board = null; removeCard(); setPencil(null); wiggleHelp(false); },
  setLevel(l) { Wr.level = this.level = l; Wr.idx = (store.write && store.write[l]) || 0; removeBoard(Wr.board); Wr.board = null; startLetter(); },
  adopt(l) { Wr.level = this.level = l; Wr.idx = (store.write && store.write[l]) || 0; removeBoard(Wr.board); Wr.board = null; },
  relayout() {
    buildCard();
    if (Wr.board) { const keep = { cur: Wr.cur, prog: Wr.prog }; removeBoard(Wr.board); Wr.board = buildBoard(); Object.assign(Wr, keep); drawOverlay(); }
  },
  update() { if (Wr.dirty) drawOverlay(); },
  pointer(o, e) {
    if (!o) return;
    const k = o.userData.kind;
    if (k === 'writeBoard') pointerDown(e);
    else if (k === 'wnav') { const j = o.userData.j; j.punch(0.4); sfx.tap(); Wr.idx = (Wr.idx + o.userData.dir + 26) % 26; store.write = store.write || {}; store.write[Wr.level] = Wr.idx; save(); startLetter(); }
    else if (k === 'wcard') { Wr.card.j.pop(0.3); const pic = pictureFor(Wr.ch); speak(pic ? `${Wr.ch}. ${pic.word}` : Wr.ch); }
  },
  help() {
    if (Wr.busy || !Wr.board) return;
    Wr.help = Math.min(2, Wr.help + 1);
    say(tr('wrWatch')); Wr.busy = true;
    const tok = Wr.round; demo().then(() => { if (tok === Wr.round) { Wr.busy = false; setPrompt(() => tr('wrStart', Wr.ch)); } });
  },
  prompt: () => Wr.promptFn(),
  idle: () => !Wr.busy && !!Wr.board && !Wr.grabbing,
  canDrag: () => false,
  dragOpts: () => null,
  onLang() { buildCard(); say(Wr.promptFn()); },
};
