// "Solar system": an animated paper solar system. Explore (tap planets), Place (drag each planet onto its orbit), Quiz.
import * as THREE from 'three';
import { rint, lerp, rand, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, font, cutTex, cutShared, sharedMesh, paperMat, paint, text, tornRect, starPath, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2, BW = 12.4, BH = 8.0, SUN_R = 0.85, PS = 0.72;
const R = [0.24, 0.34, 0.36, 0.28, 0.62, 0.5, 0.4, 0.4];
const ORX = i => 1.55 + i * 0.58, ORY = i => ORX(i) * 0.6;
const SPEED = i => 0.55 / Math.pow(i + 1, 0.8); // inner planets go round faster
const Sp = {
  level: 1, busy: true, round: 0, help: 0, problemWrong: 0, stepWrong: 0, promptFn: () => '',
  board: null, card: null, planets: [], quiz: [], q: -1, answered: 0, focus: -1, t: 0,
};

/* ---------- planets ---------- */
function face(ctx, P, r) {
  if (P.rim) return;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.32, -r * 0.08, r * 0.1, 0, TAU); ctx.fillStyle = INK; ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = r * 0.07; ctx.stroke();
}
const DRAW = [
  (ctx, P, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#a8a29a'); if (!P.rim) for (const [x, y, s] of [[-0.4, -0.45, 0.18], [0.45, 0.3, 0.14], [-0.2, 0.55, 0.1]]) { ctx.beginPath(); ctx.arc(x * r, y * r, s * r, 0, TAU); ctx.fillStyle = 'rgba(74,52,38,.2)'; ctx.fill(); } },
  (ctx, P, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#e9c46a'); if (!P.rim) { ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.8, 0.2, 2.6); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * 0.12; ctx.stroke(); } },
  (ctx, P, r) => {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#3f7fc1');
    if (P.rim) return; ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip(); ctx.fillStyle = '#6fae52';
    for (const [x, y, rx, ry] of [[-0.45, -0.3, 0.4, 0.3], [0.35, 0.35, 0.35, 0.28], [0.3, -0.55, 0.25, 0.15]]) { ctx.beginPath(); ctx.ellipse(x * r, y * r, rx * r, ry * r, 0.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  },
  (ctx, P, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#d9703f'); if (!P.rim) for (const [x, y, s] of [[-0.35, 0.4, 0.16], [0.4, -0.35, 0.12]]) { ctx.beginPath(); ctx.arc(x * r, y * r, s * r, 0, TAU); ctx.fillStyle = 'rgba(122,40,20,.3)'; ctx.fill(); } },
  (ctx, P, r) => {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#e0b07a');
    if (P.rim) return; ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ['#c98a50', '#f3dcc0', '#b87a42', '#f3dcc0'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-r, -r * 0.7 + i * r * 0.42, 2 * r, r * 0.16); });
    ctx.beginPath(); ctx.ellipse(r * 0.35, r * 0.45, r * 0.2, r * 0.12, 0, 0, TAU); ctx.fillStyle = '#c2453a'; ctx.fill(); ctx.restore();
  },
  (ctx, P, r) => {
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.85, r * 0.5, -0.25, 0, TAU); ctx.ellipse(0, 0, r * 1.25, r * 0.28, -0.25, 0, TAU, true); paint(ctx, P, '#c9a67a');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#e9cf8f');
    if (!P.rim) { ctx.beginPath(); ctx.ellipse(0, 0, r * 1.85, r * 0.5, -0.25, -0.05, Math.PI + 0.05); ctx.strokeStyle = '#c9a67a'; ctx.lineWidth = r * 0.2; ctx.stroke(); }
  },
  (ctx, P, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#9fd8df'); if (!P.rim) { ctx.beginPath(); ctx.moveTo(-r * 0.2, -r); ctx.lineTo(r * 0.2, r); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = r * 0.1; ctx.stroke(); } },
  (ctx, P, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); paint(ctx, P, '#3f6fd1'); if (!P.rim) { ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.22, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill(); } },
];
const planetMat = i => cutShared('planet' + i, R[i] * 4, R[i] * 2.4, (ctx, P) => { DRAW[i](ctx, P, R[i]); face(ctx, P, R[i]); }, { res: 140, rim: 0.05 });
const orbitMat = i => cutShared('orbit' + i, ORX(i) * 2 + 0.2, ORY(i) * 2 + 0.2, (ctx) => {
  ctx.beginPath(); ctx.ellipse(0, 0, ORX(i), ORY(i), 0, 0, TAU);
  ctx.setLineDash([0.14, 0.12]); ctx.strokeStyle = 'rgba(255,250,240,.9)'; ctx.lineWidth = 0.045; ctx.stroke();
}, { res: 70, rim: 0, pad: 0.05 });
const labelMat = i => cutShared('plab' + i + tr('planets')[i], 1.6, 0.4, (ctx, P) => text(ctx, P, tr('planets')[i], 0, 0, 0.26, '#fffaf0', { weight: 600, shadow: false, maxW: 1.55 }), { res: 130, rim: 0, pad: 0.02 });

/* ---------- board: space, Sun, orbits ---------- */
const boardMat = () => cutShared('spaceboard2', BW, BH, (ctx, P) => {
  tornRect(ctx, -BW / 2, -BH / 2, BW, BH, 0.4, 0.04, 314); paint(ctx, P, '#2b3a67', { shadow: false });
  if (P.rim) return;
  for (let i = 0; i < 120; i++) { const x = ((i * 73) % 100) / 100 * (BW - 0.4) - BW / 2 + 0.2, y = ((i * 41 + i * i) % 100) / 100 * (BH - 0.4) - BH / 2 + 0.2; ctx.beginPath(); ctx.arc(x, y, 0.02 + (i % 3) * 0.015, 0, TAU); ctx.fillStyle = 'rgba(255,250,240,.7)'; ctx.fill(); }
}, { res: 70, rim: 0.1 });
const raysMat = () => cutShared('sunrays2', 2.6, 2.6, (ctx, P) => { starPath(ctx, 16, SUN_R + 0.42, SUN_R + 0.08); paint(ctx, P, '#ffb347'); }, { res: 90, rim: 0.06 });
const sunMat = () => cutShared('sunface2', 2.0, 2.0, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, SUN_R, 0, TAU); paint(ctx, P, '#ffd35a');
  if (P.rim) return;
  ctx.strokeStyle = INK; ctx.lineWidth = 0.07;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.28, -0.08, 0.12, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0.12, 0.26, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(232,87,74,.35)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.5, 0.15, 0.13, 0.08, 0, 0, TAU); ctx.fill(); }
}, { res: 110, rim: 0.06 });
function scaleFor() { return S.L.name === 'wide' ? 0.97 : 0.92; }
function buildBoard() {
  const g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1], 0); g.scale.setScalar(scaleFor());
  g.add(sharedMesh(boardMat()));
  const sh = softShadow(BW, BH); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  const rays = new Juicy(sharedMesh(raysMat())); rays.mesh.position.z = 0.15; rays.mesh.userData.kind = 'sun'; g.add(rays.mesh);
  const sun = new Juicy(sharedMesh(sunMat())); sun.mesh.position.z = 0.2; sun.mesh.userData.kind = 'sun'; g.add(sun.mesh);
  const orbits = R.map((r, i) => { const m = sharedMesh(orbitMat(i), false); m.position.z = 0.05; g.add(m); return { i, mesh: m, j: new Juicy(m) }; });
  scene.add(g);
  return { group: g, sh, rays, sun, orbits };
}
function removeBoard(b) { if (!b) return; unjuice(b.group); scene.remove(b.group); disposeMesh(b.sh); }
// a planet on its orbit; angle advances every frame
function addPlanet(i, angle, pc = null) {
  const j = pc || new Juicy(sharedMesh(planetMat(i)), PS);
  j.pi = i; j.angle = angle; j.base = PS; j.mesh.userData.kind = 'planet';
  if (pc) Sp.board.group.attach(j.mesh); else Sp.board.group.add(j.mesh);
  const lab = Sp.level !== 3 ? sharedMesh(labelMat(i), false) : null; if (lab) Sp.board.group.add(lab);
  Sp.planets.push({ j, i, label: lab });
  placeOnOrbit(Sp.planets[Sp.planets.length - 1]);
  return j;
}
function placeOnOrbit(p) {
  const a = p.j.angle, x = Math.cos(a) * ORX(p.i), y = Math.sin(a) * ORY(p.i);
  p.j.mesh.position.set(x, y, y > 0 ? 0.35 : 0.12); // nearer the viewer at the bottom of each orbit
  if (p.label) p.label.position.set(x, y - R[p.i] * PS - 0.25, 0.4);
}

/* ---------- side card ---------- */
function wrap(ctx, P, str, x, y, size, maxW, color) {
  const m = document.createElement('canvas').getContext('2d'); m.font = font(size * 100, 700);
  const lines = []; let line = '';
  for (const w of str.split(' ')) { const t = line ? line + ' ' + w : w; if (m.measureText(t).width / 100 > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  lines.forEach((ln, k) => text(ctx, P, ln, x, y + (k - (lines.length - 1) / 2) * size * 1.25, size, color, { shadow: false }));
}
function buildCard() {
  removeCard();
  const tall = S.L.sideDir === 'h', w = tall ? 11.0 : 5.3, h = tall ? 3.4 : 6.2;
  const ct = cutTex(w, h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'card';
  const g = new THREE.Group(); g.position.set(S.L.side[0], S.L.side[1] - (tall ? 0.45 : 0), 0); g.rotation.z = tall ? -0.01 : 0.02;
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  Sp.card = { group: g, mesh: m, sh, ct, w, h, tall, j: new Juicy(m) };
  drawCard();
}
function removeCard() { if (!Sp.card) return; Sp.card.j.kill(); scene.remove(Sp.card.group); disposeMesh(Sp.card.mesh); disposeMesh(Sp.card.sh); Sp.card = null; }
function drawCard() {
  const c = Sp.card; if (!c) return;
  const { w, h, tall } = c, L = Sp.level;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 71); paint(ctx, P, L === 3 ? '#fff3dc' : '#e4d9f6', { shadow: false });
    if (P.rim) return;
    if (L === 3) {
      text(ctx, P, tr('spQTitle'), 0, -h / 2 + 0.55, 0.46, INK, { maxW: w - 0.6 });
      if (Sp.q >= 0) wrap(ctx, P, tr('spQ')[Sp.q], 0, 0.25, tall ? 0.5 : 0.46, w - 0.8, '#7a5d49');
      return;
    }
    if (L === 1 && Sp.focus >= 0) {
      const i = Sp.focus, px = tall ? -3.8 : 0, py = tall ? 0.1 : -1.1;
      ctx.save(); ctx.translate(px, py); const s = 1.1 / Math.max(R[i], 0.4); ctx.scale(s, s); DRAW[i](ctx, P, R[i]); face(ctx, P, R[i]); ctx.restore();
      text(ctx, P, tr('planets')[i], tall ? 1.4 : 0, tall ? -1.0 : 0.55, 0.55, INK, { maxW: w - 0.8 });
      wrap(ctx, P, tr('spFacts')[i], tall ? 1.4 : 0, tall ? 0.45 : 1.75, 0.36, tall ? 6.0 : w - 0.7, '#7a5d49');
      return;
    }
    text(ctx, P, L === 1 ? tr('spTap') : tr('spTitle'), 0, -h / 2 + 0.55, 0.46, INK, { maxW: w - 0.6 });
    if (L === 2) text(ctx, P, `${Sp.planets.length} / 8`, 0, 0.1, 0.9, '#7a5cc4', { shadow: false });
    else { ctx.save(); ctx.translate(0, 0.3); for (let k = 0; k < 8; k++) { ctx.save(); ctx.translate((k - 3.5) * (tall ? 1.0 : 0.58), 0); ctx.scale(0.55, 0.55); DRAW[k](ctx, P, R[k]); ctx.restore(); } ctx.restore(); }
  });
  c.j.punch(0.2);
}

/* ---------- rounds ---------- */
function setPrompt(fn) { Sp.promptFn = fn; say(fn()); }
const planetItem = i => ({ key: 'p' + i, make: () => { const j = new Juicy(sharedMesh(planetMat(i))); j.pi = i; return j; }, trayBase: Math.min(1.5, 0.62 / R[i]), base: PS });
async function startRound() {
  const tok = ++Sp.round;
  Sp.busy = true; Sp.help = 0; Sp.problemWrong = 0; Sp.stepWrong = 0; Sp.answered = 0; Sp.q = -1; Sp.focus = -1; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  if (Sp.board) { const old = Sp.board; Sp.board = null; const og = old.group, sx = og.position.x; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.3; }, ease.inCubic).then(() => removeBoard(old)); }
  Sp.planets = [];
  const b = Sp.board = buildBoard(); buildCard(); setTray(null);
  sfx.whoosh();
  await tween(0.7, k => b.group.position.set(S.L.main[0], S.L.main[1] + (1 - k) * 15, 0), ease.outBack);
  if (tok !== Sp.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  if (Sp.level === 2) {
    setTray([...Array(8).keys()].sort(() => Math.random() - 0.5).map(planetItem), { sp: { wide: 2.05, tall: 2.12 } });
    setPrompt(() => tr('spPlace'));
  } else {
    R.forEach((r, i) => { const j = addPlanet(i, rand(0, TAU)); j.sc.v = 0.0001; wait(0.08 * i).then(() => { j.sc.t = 1; j.pop(0.4); sfx.tap(); }); });
    if (Sp.level === 1) setPrompt(() => tr('spExplore'));
    else { Sp.quiz = [...Array(8).keys()].sort(() => Math.random() - 0.5).slice(0, 5); setPrompt(() => tr('spQuizStart')); await wait(1.4); if (tok !== Sp.round) return; nextQuestion(tok); return; }
  }
  Sp.busy = false; S.lastAct = S.time;
}
function nextQuestion(tok) {
  if (tok !== Sp.round) return;
  if (!Sp.quiz.length) return win();
  Sp.q = Sp.quiz.shift(); Sp.stepWrong = 0; Sp.help = 0;
  const others = [...Array(8).keys()].filter(i => i !== Sp.q).sort(() => Math.random() - 0.5).slice(0, 2);
  setTray([Sp.q, ...others].sort(() => Math.random() - 0.5).map(planetItem), { sp: { wide: 2.6, tall: 2.4 } });
  drawCard(); setPrompt(() => tr('spQ')[Sp.q]);
  Sp.busy = false; S.lastAct = S.time;
}
// which orbit is closest to a point (in board coordinates), and how far away it is
function nearestOrbit(l) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 8; i++) {
    const e = Math.hypot(l.x / ORX(i), l.y / ORY(i)), d = Math.abs(e - 1) * (ORX(i) + ORY(i)) / 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { i: best, d: bd };
}
function onDrop(p, target) {
  if (!target || Sp.busy || !Sp.board) { flyHome(p); return; }
  const names = tr('planets');
  if (Sp.level === 3) {
    if (p.pi === Sp.q) {
      Sp.busy = true; flyHome(p); const pl = Sp.planets.find(x => x.i === Sp.q).j; pl.pop(0.8); pl.punch(0.5); Sp.focus = Sp.q;
      burst(pl.mesh.getWorldPosition(V3()), 16, { speed: 3, up: 4 }); sfx.good(Sp.answered++ + 2);
      setPrompt(() => tr('spFacts')[Sp.q]);
      const tok = Sp.round; wait(2.2).then(() => nextQuestion(tok));
      return;
    }
    flyHome(p); Sp.problemWrong++; Sp.stepWrong++; recordMistake('space', 'quiz'); sfx.bad(); owlTilt();
    setPrompt(() => tr('spQuizWrong', names[p.pi]));
    if (Sp.stepWrong >= 2) { setTrayGlow('p' + Sp.q); wiggleHelp(true); }
    return;
  }
  // place mode: target is an orbit
  const o = target.i;
  if (p.pi === o) {
    const l = Sp.board.group.worldToLocal(drag.pt.clone()); let a = Math.atan2(l.y / ORY(o), l.x / ORX(o)); if (!isFinite(a)) a = 0;
    const to = Sp.board.group.localToWorld(V3(Math.cos(a) * ORX(o), Math.sin(a) * ORY(o), 0.3)), from = p.mesh.position.clone();
    Sp.busy = true; p.rot.t = 0; p.sc.t = 1;
    tween(0.18, k => p.mesh.position.lerpVectors(from, to, k), ease.inCubic).then(() => {
      if (!Sp.board) { p.kill(); return; }
      addPlanet(o, a, p); p.punch(0.6); sfx.snap(); target.j.pop(0.4);
      burst(to, 12, { colors: ['#fffaf0', '#f2c14e', '#9fd8df'], speed: 2.6, up: 3, z: 1, size: 0.6 });
      drawCard(); Sp.busy = false;
      if (Sp.planets.length === 8) win();
    });
    sfx.good(o + 1); Sp.stepWrong = 0; setTrayGlow(null); wiggleHelp(false);
    setTray([...Array(8).keys()].filter(i => i !== o && !Sp.planets.some(x => x.i === i)).sort(() => Math.random() - 0.5).map(planetItem), { sp: { wide: 2.05, tall: 2.12 } });
    setPrompt(() => tr('spFacts')[o]);
    return;
  }
  flyHome(p); target.j.punch(0.3); Sp.problemWrong++; Sp.stepWrong++; recordMistake('space', 'order'); sfx.bad(); owlTilt();
  setPrompt(() => p.pi < o ? tr('spCloser', names[p.pi]) : tr('spFurther', names[p.pi]));
  if (Sp.stepWrong >= 2) { const need = [...Array(8).keys()].find(i => !Sp.planets.some(x => x.i === i)); if (need !== undefined) { setTrayGlow('p' + need); Sp.board.orbits[need].j.pop(0.6); } wiggleHelp(true); }
}
async function win() {
  const tok = Sp.round; Sp.busy = true; setTrayGlow(null); wiggleHelp(false); setTray(null);
  const nStars = Sp.problemWrong === 0 ? 3 : Sp.problemWrong <= 2 ? 2 : 1;
  owlCheer();
  const ti = Math.floor(Math.random() * 4);
  setPrompt(() => tr('spWin', tr('winTail')[ti]));
  Sp.planets.forEach((p, i) => wait(0.1 * i).then(() => { p.j.pop(0.6); p.j.punch(0.4); }));
  await wait(0.9);
  await celebrate({ center: Sp.board.group.localToWorld(V3(0, 0, 0)), nStars, gameId: 'space', level: Sp.level, wrong: Sp.problemWrong });
  if (tok !== Sp.round) return;
  await wait(0.3);
  if (tok !== Sp.round) return;
  startRound();
}

/* ---------- game object ---------- */
const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a');
export const spaceState = Sp;
export const spaceGame = {
  id: 'space',
  levels: () => [{ id: 1, emoji: '🔭', label: tr('lvExplore') }, { id: 2, emoji: '🪐', label: tr('lvPlace') }, { id: 3, emoji: '❓', label: tr('lvQuiz') }],
  level: 1,
  enter(level) { Sp.level = this.level = level; setPencil(null); startRound(); },
  exit() { Sp.round++; Sp.busy = true; removeBoard(Sp.board); Sp.board = null; Sp.planets = []; removeCard(); setTray(null); wiggleHelp(false); },
  setLevel(l) { Sp.level = this.level = l; startRound(); },
  adopt(l) { Sp.level = this.level = l; },
  relayout() { if (Sp.board) { Sp.board.group.position.set(S.L.main[0], S.L.main[1], 0); Sp.board.group.scale.setScalar(scaleFor()); } buildCard(); },
  update(dt, t) {
    const b = Sp.board; if (!b) return;
    b.rays.extra = t * 0.15; b.sun.sq.t = Math.sin(t * 2) * 0.02;
    for (const p of Sp.planets) { p.j.angle += SPEED(p.i) * dt * (Sp.focus === p.i && Sp.level === 1 ? 0.25 : 1); placeOnOrbit(p); }
    for (const o of b.orbits) o.mesh.material.color.copy(drag.hover && drag.hover.i === o.i && Sp.level === 2 ? COL_HOV : COL_W);
    if (Sp.card) Sp.card.j.sc.t = drag.hover && drag.hover.card ? 1.04 : 1;
  },
  pointer(o) {
    if (!o) return;
    const k = o.userData.kind;
    if (k === 'planet') {
      const j = o.userData.j; j.pop(0.5); j.punch(0.3); sfx.tap(); Sp.focus = j.pi; drawCard(); S.lastAct = S.time;
      say(`${tr('planets')[j.pi]}! ${tr('spFacts')[j.pi]}`, { hop: false });
    } else if (k === 'sun') { Sp.board.sun.pop(0.5); Sp.board.rays.pop(0.4); sfx.hoot(); }
    else if (k === 'card') Sp.card.j.punch(0.4);
  },
  help() {
    if (Sp.busy || !Sp.board) return;
    Sp.help = Math.min(2, Sp.help + 1);
    if (Sp.level === 1) { say(tr('spHelp')); Sp.planets.forEach((p, i) => wait(0.2 * p.i).then(() => p.j.pop(0.6))); return; }
    if (Sp.level === 3) { if (Sp.help === 1) say(tr('spFacts')[Sp.q]); else { say(tr('glow')); setTrayGlow('p' + Sp.q); } return; }
    const need = [...Array(8).keys()].find(i => !Sp.planets.some(x => x.i === i)); if (need === undefined) return;
    Sp.board.orbits[need].j.pop(0.6);
    if (Sp.help === 1) say(tr('spHelp')); else { say(tr('glow')); setTrayGlow('p' + need); }
  },
  prompt: () => Sp.promptFn(),
  idle: () => !Sp.busy && !!Sp.board && Sp.level !== 1,
  canDrag: () => !Sp.busy && !!Sp.board && Sp.level !== 1,
  dragOpts: () => Sp.level === 3
    ? { targets: () => Sp.card ? [{ card: true, j: Sp.card.j, hit: pt => { const l = Sp.card.group.worldToLocal(pt.clone()); return Math.abs(l.x) < Sp.card.w / 2 + 0.3 && Math.abs(l.y) < Sp.card.h / 2 + 0.3; } }] : [], onDrop }
    : { targets: () => !Sp.board ? [] : Sp.board.orbits.filter(o => !Sp.planets.some(p => p.i === o.i)).map(o => ({ i: o.i, j: o.j, hit: pt => {
        const n = nearestOrbit(Sp.board.group.worldToLocal(pt.clone())); return n.i === o.i && n.d < 0.4;
      } })), onDrop },
  onLang() { if (Sp.board) Sp.planets.forEach(p => { if (p.label) p.label.material = labelMat(p.i).mat; }); drawCard(); say(Sp.promptFn()); },
};
