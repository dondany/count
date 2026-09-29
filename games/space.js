// "Solar system": put smiling paper planets in order from the Sun, then answer a planet quiz.
import * as THREE from 'three';
import { rint, pick, lerp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, font, cutTex, cutShared, sharedMesh, paperMat, paint, text, rr, tornRect, starPath, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2, BW = 11.4, BH = 4.6, SUN = { x: -BW / 2, r: 1.8 };
const R = [0.24, 0.34, 0.36, 0.28, 0.62, 0.5, 0.4, 0.4];
const XS = (() => { const xs = []; let x = SUN.x + SUN.r + 0.3; R.forEach((r, i) => { x += r + (i === 5 || i === 6 ? 0.2 : 0); xs.push(x); x += r + 0.25; }); return xs; })();
const Sp = {
  level: 1, busy: true, round: 0, help: 0, problemWrong: 0, stepWrong: 0, promptFn: () => '',
  board: null, card: null, slots: [], planets: [], quiz: [], q: -1, answered: 0,
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
const planetMat = i => cutShared('planet' + i, R[i] * 4, R[i] * 2.4, (ctx, P) => { DRAW[i](ctx, P, R[i]); if (i === 5 && !P.rim) { ctx.save(); face(ctx, P, R[i]); ctx.restore(); } else face(ctx, P, R[i]); }, { res: 140, rim: 0.05 });
const ringMat = i => cutShared('pslot' + i, R[i] * 2 + 0.3, R[i] * 2 + 0.3, (ctx) => {
  ctx.beginPath(); ctx.arc(0, 0, R[i] + 0.1, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  ctx.setLineDash([0.12, 0.09]); ctx.strokeStyle = 'rgba(255,250,240,.75)'; ctx.lineWidth = 0.05; ctx.stroke();
}, { res: 120, rim: 0, pad: 0.04 });
const labelMat = i => cutShared('plab' + i + tr('planets')[i], 1.6, 0.4, (ctx, P) => text(ctx, P, tr('planets')[i], 0, 0, 0.26, '#fffaf0', { weight: 600, shadow: false, maxW: 1.55 }), { res: 130, rim: 0, pad: 0.02 });

/* ---------- board ---------- */
const boardMat = () => cutShared('spaceboard', BW, BH, (ctx, P) => {
  tornRect(ctx, -BW / 2, -BH / 2, BW, BH, 0.35, 0.04, 314); paint(ctx, P, '#2b3a67', { shadow: false });
  if (P.rim) return;
  ctx.save(); tornRect(ctx, -BW / 2, -BH / 2, BW, BH, 0.35, 0.04, 314); ctx.clip();
  for (let i = 0; i < 70; i++) { const x = ((i * 73) % 100) / 100 * BW - BW / 2, y = ((i * 41) % 100) / 100 * BH - BH / 2; ctx.beginPath(); ctx.arc(x, y, 0.02 + (i % 3) * 0.015, 0, TAU); ctx.fillStyle = 'rgba(255,250,240,.7)'; ctx.fill(); }
  ctx.setLineDash([0.1, 0.1]); ctx.strokeStyle = 'rgba(255,250,240,.25)'; ctx.lineWidth = 0.03;
  for (const x of XS) { ctx.beginPath(); ctx.arc(SUN.x, 0, x - SUN.x, -0.6, 0.6); ctx.stroke(); }
  ctx.setLineDash([]);
  starPath(ctx, 16, SUN.r + 0.35, SUN.r + 0.05); ctx.translate(SUN.x, 0); ctx.fillStyle = '#ffb347';
  ctx.beginPath(); for (let k = 0; k < 32; k++) { const r = k % 2 ? SUN.r + 0.05 : SUN.r + 0.35, a = k * Math.PI / 16; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, SUN.r, 0, TAU); ctx.fillStyle = '#ffd35a'; ctx.fill();
  ctx.beginPath(); ctx.arc(1.0, -0.25, 0.14, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(1.0, 0.35, 0.3, -0.5 * Math.PI, 0.5 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 0.08; ctx.stroke();
  ctx.restore();
}, { res: 80, rim: 0.1 });
function buildBoard() {
  const g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1] + 0.4, 0);
  const b = sharedMesh(boardMat()); g.add(b);
  const sh = softShadow(BW, BH); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  Sp.slots = XS.map((x, i) => {
    const m = sharedMesh(ringMat(i), false); m.position.set(x, 0, 0.06); g.add(m);
    let ghost = null, label = null;
    if (Sp.level === 1) {
      const pm = planetMat(i); ghost = new THREE.Mesh(pm.geo, new THREE.MeshBasicMaterial({ map: pm.mat.map, transparent: true, opacity: 0.25, depthWrite: false })); ghost.position.set(x, 0, 0.07); g.add(ghost);
    }
    if (Sp.level !== 2) { label = sharedMesh(labelMat(i), false); label.position.set(x, -R[i] - 0.45 - (i % 2) * 0.3, 0.08); g.add(label); }
    return { i, mesh: m, j: new Juicy(m), ghost, label, planet: null, r: Math.max(0.7, R[i] + 0.35) };
  });
  scene.add(g);
  return { group: g, sh };
}
function removeBoard(b) {
  if (!b) return; unjuice(b.group); scene.remove(b.group); disposeMesh(b.sh);
  b.group.traverse(o => { if (o.material && o.material.isMeshBasicMaterial && o.material.opacity === 0.25) o.material.dispose(); });
}
function placePlanet(i, pc, animate = true) {
  const s = Sp.slots[i]; s.planet = pc; if (s.ghost) s.ghost.visible = false;
  const local = V3(XS[i], 0, 0.12);
  if (!animate) { pc.mesh.position.copy(local); Sp.board.group.add(pc.mesh); }
  else { Sp.board.group.attach(pc.mesh); pc.mesh.position.copy(local); }
  pc.mesh.userData.kind = 'planet'; pc.pi = i; pc.base = 1;
}

/* ---------- side card (title / quiz question) ---------- */
function wrap(ctx, P, str, x, y, size, maxW, color) {
  ctx.save(); ctx.font = font(size * P.res, 700); ctx.restore();
  const m = document.createElement('canvas').getContext('2d'); m.font = font(size * 100, 700);
  const lines = []; let line = '';
  for (const w of str.split(' ')) { const t = line ? line + ' ' + w : w; if (m.measureText(t).width / 100 > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  lines.forEach((ln, k) => text(ctx, P, ln, x, y + (k - (lines.length - 1) / 2) * size * 1.25, size, color, { shadow: false }));
}
function buildCard() {
  removeCard();
  const tall = S.L.sideDir === 'h', w = tall ? 11.0 : 5.3, h = tall ? 3.2 : 5.0;
  const ct = cutTex(w, h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'card';
  const g = new THREE.Group(); g.position.set(S.L.side[0], S.L.side[1] - (tall ? 0.4 : 0), 0); g.rotation.z = tall ? -0.01 : 0.02;
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  Sp.card = { group: g, mesh: m, sh, ct, w, h, tall, j: new Juicy(m) };
  drawCard();
}
function removeCard() { if (!Sp.card) return; Sp.card.j.kill(); scene.remove(Sp.card.group); disposeMesh(Sp.card.mesh); disposeMesh(Sp.card.sh); Sp.card = null; }
function drawCard() {
  const c = Sp.card; if (!c) return;
  const { w, h } = c, quiz = Sp.level === 3;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 71); paint(ctx, P, quiz ? '#fff3dc' : '#e4d9f6', { shadow: false });
    if (P.rim) return;
    text(ctx, P, quiz ? tr('spQTitle') : tr('spTitle'), 0, -h / 2 + 0.55, 0.46, INK, { maxW: w - 0.6 });
    if (quiz && Sp.q >= 0) wrap(ctx, P, tr('spQ')[Sp.q], 0, 0.25, c.tall ? 0.5 : 0.48, w - 0.8, '#7a5d49');
    else if (!quiz) { ctx.save(); ctx.translate(0, 0.3); for (let k = 0; k < 8; k++) { ctx.save(); ctx.translate((k - 3.5) * (c.tall ? 1.0 : 0.58), 0); ctx.scale(0.55, 0.55); DRAW[k](ctx, P, R[k]); ctx.restore(); } ctx.restore(); }
  });
  c.j.punch(0.25);
}

/* ---------- rounds ---------- */
function setPrompt(fn) { Sp.promptFn = fn; say(fn()); }
const planetItem = i => ({ key: 'p' + i, make: () => { const j = new Juicy(sharedMesh(planetMat(i))); j.pi = i; return j; }, trayBase: Math.min(1.5, 0.62 / R[i]), base: 1 });
async function startRound() {
  const tok = ++Sp.round;
  Sp.busy = true; Sp.help = 0; Sp.problemWrong = 0; Sp.stepWrong = 0; Sp.answered = 0; Sp.q = -1; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  if (Sp.board) { const old = Sp.board, og = old.group, sx = og.position.x; Sp.board = null; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.4; }, ease.inCubic).then(() => removeBoard(old)); }
  const b = Sp.board = buildBoard(); buildCard(); setTray(null);
  sfx.whoosh();
  await tween(0.7, k => b.group.position.set(S.L.main[0], S.L.main[1] + 0.4 + (1 - k) * 15, 0), ease.outBack);
  if (tok !== Sp.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  if (Sp.level === 3) {
    R.forEach((r, i) => { const pc = new Juicy(sharedMesh(planetMat(i))); pc.sc.v = 0.0001; placePlanet(i, pc, false); wait(0.08 * i).then(() => { pc.sc.t = 1; pc.pop(0.3); sfx.tap(); }); });
    Sp.quiz = [...Array(8).keys()].sort(() => Math.random() - 0.5).slice(0, 5);
    setPrompt(() => tr('spQuizStart')); await wait(1.2); if (tok !== Sp.round) return;
    nextQuestion(tok);
  } else {
    setTray([...Array(8).keys()].sort(() => Math.random() - 0.5).map(planetItem), { sp: { wide: 2.05, tall: 2.12 } });
    setPrompt(() => tr('spStart'));
    Sp.busy = false; S.lastAct = S.time;
  }
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
function onDrop(p, target) {
  if (!target || Sp.busy || !Sp.board) { flyHome(p); return; }
  const names = tr('planets');
  if (Sp.level === 3) {
    if (p.pi === Sp.q) {
      Sp.busy = true; flyHome(p); const pl = Sp.slots[Sp.q].planet; pl.pop(0.8); pl.punch(0.5);
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
  const s = target;
  if (p.pi === s.i) {
    const to = s.mesh.getWorldPosition(V3()); to.z += 0.12; const from = p.mesh.position.clone(), b0 = p.base;
    s.planet = p; p.rot.t = 0; p.sc.t = 1;
    tween(0.14, k => { p.mesh.position.lerpVectors(from, to, k); p.base = lerp(b0, 1, k); }, ease.inCubic).then(() => {
      if (!Sp.board) { p.kill(); return; }
      placePlanet(s.i, p); p.punch(0.6); sfx.snap(); burst(to, 12, { colors: ['#fffaf0', '#f2c14e', '#9fd8df'], speed: 2.6, up: 3, z: 1, size: 0.6 });
    });
    sfx.good(s.i + 1); Sp.stepWrong = 0; setTrayGlow(null); wiggleHelp(false);
    setTray(Sp.slots.filter(x => !x.planet).map(x => x.i).sort(() => Math.random() - 0.5).map(planetItem), { sp: { wide: 2.05, tall: 2.12 } });
    setPrompt(() => tr('spFacts')[s.i]);
    if (Sp.slots.every(x => x.planet)) win();
    return;
  }
  flyHome(p); s.j.punch(0.3); Sp.problemWrong++; Sp.stepWrong++; recordMistake('space', 'order'); sfx.bad(); owlTilt();
  setPrompt(() => p.pi < s.i ? tr('spCloser', names[p.pi]) : tr('spFurther', names[p.pi]));
  if (Sp.stepWrong >= 2) { const need = Sp.slots.find(x => !x.planet); if (need) setTrayGlow('p' + need.i); wiggleHelp(true); }
}
async function win() {
  const tok = Sp.round; Sp.busy = true; setTrayGlow(null); wiggleHelp(false); setTray(null);
  const nStars = Sp.problemWrong === 0 ? 3 : Sp.problemWrong <= 2 ? 2 : 1;
  owlCheer();
  const ti = Math.floor(Math.random() * 4);
  setPrompt(() => tr('spWin', tr('winTail')[ti]));
  Sp.slots.forEach((s, i) => wait(0.1 * i).then(() => s.planet && (s.planet.pop(0.6), s.planet.punch(0.4))));
  await wait(0.9);
  await celebrate({ center: Sp.board.group.localToWorld(V3(0, 0, 0)), nStars, gameId: 'space', level: Sp.level, wrong: Sp.problemWrong });
  if (tok !== Sp.round) return;
  await wait(0.3);
  if (tok !== Sp.round) return;
  startRound();
}

const COL_W = new THREE.Color('#ffffff'), COL_HOV = new THREE.Color('#ffe38a');
function pending() { if (Sp.busy || Sp.level === 3 || !Sp.board) return null; const s = Sp.slots.find(x => !x.planet); return s && { mesh: s.mesh, r: s.r }; }
export const spaceState = Sp;
export const spaceGame = {
  id: 'space',
  levels: () => [{ id: 1, emoji: '🌞', label: tr('lvGuided') }, { id: 2, emoji: '🪐', label: tr('lvInOrder') }, { id: 3, emoji: '❓', label: tr('lvQuiz') }],
  level: 1,
  enter(level) { Sp.level = this.level = level; setPencil(Sp.level === 1 ? pending : null); startRound(); },
  exit() { Sp.round++; Sp.busy = true; removeBoard(Sp.board); Sp.board = null; removeCard(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { Sp.level = this.level = l; setPencil(l === 1 ? pending : null); startRound(); },
  adopt(l) { Sp.level = this.level = l; setPencil(l === 1 ? pending : null); },
  relayout() { if (Sp.board) Sp.board.group.position.set(S.L.main[0], S.L.main[1] + 0.4, 0); buildCard(); },
  update() {
    for (const s of Sp.slots) { const hov = drag.hover === s; s.j.sc.t = hov ? 1.25 : 1; s.mesh.material.color.copy(hov ? COL_HOV : COL_W); }
    if (Sp.card) Sp.card.j.sc.t = drag.hover && drag.hover.card ? 1.04 : 1;
  },
  pointer(o) {
    if (!o) return;
    const k = o.userData.kind;
    if (k === 'planet') { const j = o.userData.j; j.pop(0.5); j.punch(0.3); sfx.tap(); say(`${tr('planets')[j.pi]}! ${tr('spFacts')[j.pi]}`, { hop: false }); }
    else if (k === 'card') Sp.card.j.punch(0.4);
  },
  help() {
    if (Sp.busy || !Sp.board) return;
    Sp.help = Math.min(2, Sp.help + 1);
    if (Sp.level === 3) { if (Sp.help === 1) { say(tr('spFacts')[Sp.q]); } else { say(tr('glow')); setTrayGlow('p' + Sp.q); } return; }
    const need = Sp.slots.find(x => !x.planet); if (!need) return;
    need.j.pop(0.6);
    if (Sp.help === 1) say(tr('spHelp')); else { say(tr('glow')); setTrayGlow('p' + need.i); }
  },
  prompt: () => Sp.promptFn(),
  idle: () => !Sp.busy && !!Sp.board,
  canDrag: () => !Sp.busy && !!Sp.board,
  dragOpts: () => Sp.level === 3
    ? { targets: () => Sp.card ? [{ card: true, j: Sp.card.j, hit: pt => { const l = Sp.card.group.worldToLocal(pt.clone()); return Math.abs(l.x) < Sp.card.w / 2 + 0.3 && Math.abs(l.y) < Sp.card.h / 2 + 0.3; } }] : [], onDrop }
    : { targets: () => Sp.slots.filter(s => !s.planet), onDrop },
  onLang() { if (Sp.board) Sp.slots.forEach(s => { if (s.label) s.label.material = labelMat(s.i).mat; }); drawCard(); say(Sp.promptFn()); },
};
