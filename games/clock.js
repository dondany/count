// "Clock": set a paper clock by dragging its hands, or read the clock and pick the matching digital time.
import * as THREE from 'three';
import { rand, rint, pick, lerp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, DIGIT_COLORS, cutTex, cutMesh, cutShared, sharedMesh, paperMat, paint, text, segs, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, startGrab } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, timeWords, timeDigits } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R = 3.2, TAU = Math.PI * 2;
const K = {
  level: 1, mode: 'set', T: 0, target: 0, busy: true, round: 0, rounds: 0, help: 0, problemWrong: 0, promptFn: () => '',
  clock: null, card: null, ready: null, lastTarget: -1,
};
const hm = T => { const h = Math.floor(T / 60) % 12; return [h === 0 ? 12 : h, T % 60]; };
const digital = T => timeDigits(...hm(T));
const inWords = T => timeWords(...hm(T));

/* ---------- the clock ---------- */
const faceMat = () => cutShared('clockface', (R + 0.75) * 2, (R + 0.75) * 2, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, R + 0.1, 0, TAU); paint(ctx, P, '#2f9e97');
  if (P.rim) return;
  ctx.beginPath(); ctx.arc(0, 0, R - 0.18, 0, TAU); paint(ctx, P, '#fffdf8');
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU, big = i % 5 === 0, r0 = big ? R - 0.55 : R - 0.38;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); ctx.lineTo(Math.sin(a) * (R - 0.25), -Math.cos(a) * (R - 0.25));
    ctx.strokeStyle = big ? INK : 'rgba(74,52,38,.45)'; ctx.lineWidth = big ? 0.08 : 0.035; ctx.stroke();
  }
  for (let h = 1; h <= 12; h++) {
    const a = h / 12 * TAU, r = R - 1.05;
    text(ctx, P, String(h), Math.sin(a) * r, -Math.cos(a) * r, 0.62, DIGIT_COLORS[h % 10], { maxW: 0.9 });
    // minutes, in small print outside the rim
    const rm = R + 0.42; text(ctx, P, String((h * 5) % 60).padStart(2, '0'), Math.sin(a) * rm, -Math.cos(a) * rm, 0.26, '#fffaf0', { weight: 600, shadow: false });
  }
}, { res: 110, rim: 0.12 });
// the ring of minute labels needs a dark backing to read on the hills
const ringMat = () => cutShared('clockring', (R + 0.75) * 2, (R + 0.75) * 2, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, R + 0.68, 0, TAU); ctx.arc(0, 0, R, 0, TAU, true); paint(ctx, P, '#7a5d49', { shadow: false });
}, { res: 80, rim: 0.06 });
function handMat(kind) {
  const len = kind === 'h' ? 1.95 : 2.8, w = kind === 'h' ? 0.34 : 0.22, col = kind === 'h' ? '#e8574a' : '#2f9e97';
  return cutShared('hand' + kind, w + 0.2, len + 0.45, (ctx, P) => {
    const top = -(len + 0.45) / 2 + 0.05, pivot = (len + 0.45) / 2 - 0.3;
    ctx.beginPath(); ctx.moveTo(-w / 2, pivot + 0.18); ctx.lineTo(-w / 2, top + 0.35); ctx.lineTo(0, top); ctx.lineTo(w / 2, top + 0.35); ctx.lineTo(w / 2, pivot + 0.18);
    ctx.arc(0, pivot + 0.18, w / 2, 0, Math.PI); ctx.closePath(); paint(ctx, P, col);
  }, { res: 120, rim: 0.06 });
}
function makeHand(kind, z) {
  // move the pivot (0.3 above the drawing's bottom edge, plus the texture padding of 0.14) to the origin
  const sh = handMat(kind), geo = sh.geo.clone(); geo.translate(0, sh.H / 2 - 0.44, 0);
  const m = new THREE.Mesh(geo, sh.mat); m.castShadow = true; m.receiveShadow = true; m.position.z = z;
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(1.0, sh.H), new THREE.MeshBasicMaterial({ visible: false }));
  hit.geometry.translate(0, sh.H / 2 - 0.44, 0); hit.position.z = 0.05; hit.userData = { kind: 'hand', which: kind }; m.add(hit);
  const ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: sh.mat.map, transparent: true, opacity: 0.35, depthWrite: false }));
  ghost.position.z = z - 0.05; ghost.visible = false;
  const tip = new THREE.Object3D(); tip.position.y = sh.H * 0.62; m.add(tip); // where the pencil points
  return { j: new Juicy(m), ghost, geo, hit, tip };
}
function buildClock() {
  const g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1], 0);
  const ring = sharedMesh(ringMat(), false); ring.position.z = -0.05; g.add(ring);
  const face = sharedMesh(faceMat()); face.userData.kind = 'clockFace'; g.add(face);
  const sh = softShadow(R * 2 + 0.6, R * 2 + 0.6, { r: R + 0.3 }); sh.position.set(0.35, -0.45, -0.4); g.add(sh);
  const hh = makeHand('h', 0.2), mh = makeHand('m', 0.32);
  g.add(hh.j.mesh, mh.j.mesh, hh.ghost, mh.ghost);
  const cap = sharedMesh(cutShared('clockcap', 0.5, 0.5, (ctx, P) => { ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, TAU); paint(ctx, P, '#f2c14e'); }, { res: 120, rim: 0.05 }));
  cap.position.z = 0.45; g.add(cap);
  scene.add(g);
  return { group: g, face: new Juicy(face), hh, mh, sh, extra: [hh.geo, mh.geo, hh.hit.geometry, mh.hit.geometry, hh.ghost.material, mh.ghost.material] };
}
function removeClock() {
  const c = K.clock; if (!c) return;
  unjuice(c.group); scene.remove(c.group); disposeMesh(c.sh); c.extra.forEach(x => x.dispose()); K.clock = null;
}
function showTime(T, spring = true) {
  const c = K.clock; if (!c) return;
  const ha = -((T / 60) % 12) / 12 * TAU, ma = -(T % 60) / 60 * TAU;
  // keep the angles continuous so the springs take the short way round
  const near = (cur, a) => a + TAU * Math.round((cur - a) / TAU);
  c.hh.j.rot.t = near(c.hh.j.rot.t, ha); c.mh.j.rot.t = near(c.mh.j.rot.t, ma);
  if (!spring) { c.hh.j.rot.v = c.hh.j.rot.t; c.mh.j.rot.v = c.mh.j.rot.t; }
}
function showGhost(on) {
  const c = K.clock; if (!c) return;
  c.hh.ghost.visible = c.mh.ghost.visible = on;
  if (on) { c.hh.ghost.rotation.z = -((K.target / 60) % 12) / 12 * TAU; c.mh.ghost.rotation.z = -(K.target % 60) / 60 * TAU; }
}

/* ---------- side card + ready button ---------- */
function buildCard() {
  removeCard();
  const tall = S.L.sideDir === 'h', w = tall ? 8.2 : 5.3, h = tall ? 3.6 : 4.6;
  const ct = cutTex(w, h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'card';
  const g = new THREE.Group(); g.position.set(S.L.side[0] - (tall ? 1.4 : 0), S.L.side[1] + (tall ? 0 : 0.9), 0); g.rotation.z = tall ? -0.01 : 0.02;
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  K.card = { group: g, mesh: m, sh, ct, w, h, j: new Juicy(m) };
  // big paper "Ready!" button
  const bw = tall ? 2.6 : 3.4, bh = 1.3;
  const btn = cutMesh(bw, bh, (ctx, P) => {
    rr(ctx, -bw / 2, -bh / 2, bw, bh, 0.35); paint(ctx, P, '#2f9e97');
    if (!P.rim) text(ctx, P, tr('clkReady'), 0, 0, 0.55, '#fffaf0', { maxW: bw - 0.3 });
  }, { res: 100, rim: 0.1 });
  btn.userData.kind = 'clkReady';
  btn.position.set(tall ? S.L.side[0] + 4.15 : S.L.side[0], tall ? S.L.side[1] : S.L.side[1] - 2.6, 0.3); scene.add(btn);
  K.ready = { mesh: btn, j: new Juicy(btn) };
  drawCard();
}
function removeCard() {
  if (K.card) { K.card.j.kill(); scene.remove(K.card.group); disposeMesh(K.card.mesh); disposeMesh(K.card.sh); K.card = null; }
  if (K.ready) { K.ready.j.kill(); disposeMesh(K.ready.mesh); K.ready = null; }
}
function drawCard(reveal = false) {
  const c = K.card; if (!c) return;
  const w = c.w, h = c.h, show = K.mode === 'set' || reveal;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 66); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    text(ctx, P, K.mode === 'set' ? tr('clkSetTitle') : tr('clkWhat'), 0, -h / 2 + 0.55, 0.48, INK, { maxW: w - 0.6 });
    if (show) {
      rr(ctx, -1.9, -0.95, 3.8, 1.5, 0.25); ctx.fillStyle = '#4a3426'; ctx.fill();
      segs(ctx, P, [{ t: digital(K.target), c: '#ffe27a' }], 0, -0.2, 1.05, 3.4);
      text(ctx, P, inWords(K.target), 0, h / 2 - 0.55, 0.4, '#9a7a62', { weight: 600, shadow: false, maxW: w - 0.4 });
    } else segs(ctx, P, [{ t: '?', c: '#e8574a' }], 0, 0, 1.8, w - 0.8);
  });
  c.j.punch(0.25);
  if (K.ready) K.ready.mesh.visible = K.mode === 'set';
}

/* ---------- time cards for "read the clock" ---------- */
const cardItem = T => ({
  key: 't' + T, T,
  make: () => { const j = new Juicy(sharedMesh(cutShared('tcard' + T, 2.1, 1.1, (ctx, P) => {
    rr(ctx, -1.05, -0.55, 2.1, 1.1, 0.2); paint(ctx, P, '#4a3426');
    if (!P.rim) segs(ctx, P, [{ t: digital(T), c: '#ffe27a' }], 0, 0, 0.7, 1.8);
  }, { res: 110, rim: 0.1 }))); j.T = T; return j; },
  trayBase: 0.95, base: 1,
});
function distractors(T) {
  const [h, m] = hm(T), out = new Set([T]);
  const add = (hh, mm) => { if (hh >= 1 && hh <= 12 && mm >= 0 && mm < 60 && mm % 5 === 0) out.add((hh % 12) * 60 + mm); };
  add(m === 0 ? 12 : m / 5, (h * 5) % 60);           // hands mixed up
  add(m >= 30 ? (h % 12) + 1 : h === 1 ? 12 : h - 1, m); // the hour hand is between two numbers
  let guard = 0;
  while (out.size < 3 && guard++ < 50) add(rint(1, 12), K.level === 1 ? 0 : K.level === 2 ? pick([0, 15, 30, 45]) : rint(0, 11) * 5);
  const list = [...out].slice(0, 3); for (let i = list.length - 1; i > 0; i--) { const j = rint(0, i); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

/* ---------- rounds ---------- */
function setPrompt(fn) { K.promptFn = fn; say(fn()); }
function pickTarget() {
  for (let i = 0; i < 40; i++) {
    const h = rint(1, 12), m = K.level === 1 ? 0 : K.level === 2 ? pick([0, 15, 30, 30, 45]) : rint(0, 11) * 5;
    const T = (h % 12) * 60 + m;
    if (T !== K.lastTarget) { K.lastTarget = T; return T; }
  }
  return 180;
}
async function startRound() {
  const tok = ++K.round;
  K.busy = true; K.help = 0; K.problemWrong = 0; S.nudged = false; setTrayGlow(null); wiggleHelp(false); showGhost(false);
  K.mode = K.rounds++ % 2 ? 'read' : 'set'; K.target = pickTarget();
  if (!K.clock) {
    K.clock = buildClock(); const g = K.clock.group;
    await tween(0.7, k => g.position.set(S.L.main[0], S.L.main[1] + (1 - k) * 15, 0), ease.outBack);
    sfx.snap(); S.shake = 0.2;
  }
  if (tok !== K.round) return;
  drawCard();
  if (K.mode === 'set') {
    setTray(null);
    let T0; do { T0 = (rint(1, 12) % 12) * 60 + (K.level === 1 ? 0 : rint(0, 11) * 5); } while (T0 === K.target);
    K.T = T0; showTime(K.T);
    setPrompt(() => tr('clkSet', digital(K.target), inWords(K.target)));
  } else {
    setTray(distractors(K.target).map(cardItem), { sp: { wide: 2.8, tall: 2.6 } });
    // spin the hands round to the time to read
    const from = K.T; K.T = K.target;
    await tween(1.1, k => showTime(Math.round(lerp(from, from + 720 + ((K.target - from) % 720 + 720) % 720, k)), false), ease.inOutSine);
    for (let i = 0; i < 3; i++) sfx.tap();
    showTime(K.target);
    setPrompt(() => tr('clkRead'));
  }
  if (tok !== K.round) return;
  K.busy = false; S.lastAct = S.time;
}
function check() {
  if (K.busy || K.mode !== 'set') return;
  K.ready.j.punch(0.5); K.ready.j.pop(0.3); sfx.tap();
  const [h, m] = hm(K.T), [th, tm] = hm(K.target);
  if (h === th && m === tm) return win();
  K.problemWrong++; sfx.bad(); owlTilt(); K.clock.face.punch(0.2);
  recordMistake('clock', h === th ? 'minute' : m === tm ? 'hour' : 'both');
  setPrompt(() => h === th ? tr('clkHourOk') : m === tm ? tr('clkMinOk') : tr('clkBoth'));
  if (K.problemWrong >= 2) wiggleHelp(true);
}
function grabHand(which, e) {
  if (K.busy || K.mode !== 'set') return;
  const hand = which === 'h' ? K.clock.hh : K.clock.mh;
  hand.j.pop(0.3); sfx.pick(); showGhost(false);
  startGrab(e, pt => {
    const l = K.clock.group.worldToLocal(pt.clone()); if (Math.hypot(l.x, l.y) < 0.3) return;
    const a = (Math.atan2(l.x, l.y) + TAU) % TAU; // clockwise from 12
    const h = Math.floor(K.T / 60) % 12, m = K.T % 60;
    let T = K.T;
    if (which === 'm') {
      const nm = Math.round(a / TAU * 12) % 12 * 5;
      if (nm !== m) { let nh = h; if (nm - m < -30) nh++; if (nm - m > 30) nh--; T = ((nh * 60 + nm) % 720 + 720) % 720; }
    } else {
      const nh = ((Math.round(a / TAU * 12 - m / 60) % 12) + 12) % 12;
      T = nh * 60 + m;
    }
    if (T !== K.T) { K.T = T; showTime(T); sfx.tap(); hand.j.punch(0.15); }
  }, () => { hand.j.punch(0.3); S.lastAct = S.time; });
}
function dropCard(p, target) {
  if (!target || K.busy) { flyHome(p); return; }
  if (p.T === K.target) {
    K.busy = true; const to = K.clock.group.localToWorld(V3(0, -1.4, 0.8)), from = p.mesh.position.clone();
    tween(0.25, k => p.mesh.position.lerpVectors(from, to, k)).then(() => { p.punch(0.6); sfx.snap(); burst(to, 14, { speed: 3, up: 4 }); });
    return win(p);
  }
  K.problemWrong++; recordMistake('clock', 'read'); sfx.bad(); owlTilt(); flyHome(p); K.clock.face.punch(0.3);
  K.clock.hh.j.pop(0.4); wait(0.25).then(() => K.clock && K.clock.mh.j.pop(0.4));
  setPrompt(() => tr('clkReadWrong'));
  if (K.problemWrong >= 2) { setTrayGlow('t' + K.target); wiggleHelp(true); }
}
async function win(card) {
  const tok = K.round; K.busy = true; setTrayGlow(null); wiggleHelp(false); showGhost(false);
  const nStars = K.problemWrong === 0 ? 3 : K.problemWrong <= 2 ? 2 : 1;
  owlCheer(); drawCard(true);
  const ti = Math.floor(Math.random() * 4);
  setPrompt(() => tr('clkWin', digital(K.target), inWords(K.target), tr('winTail')[ti]));
  K.clock.hh.j.pop(0.6); K.clock.mh.j.pop(0.6); K.clock.face.punch(0.4);
  await celebrate({ center: K.clock.group.localToWorld(V3(0, 0.4, 0)), nStars, gameId: 'clock', level: K.level, wrong: K.problemWrong });
  if (card) card.kill();
  if (tok !== K.round) return;
  await wait(0.3);
  if (tok !== K.round) return;
  startRound();
}

/* ---------- game object ---------- */
export const clockState = K;
export const clockGame = {
  id: 'clock',
  levels: () => [{ id: 1, emoji: '🕐', label: tr('lvHour') }, { id: 2, emoji: '🕧', label: tr('lvHalf') }, { id: 3, emoji: '⏱️', label: tr('lv5') }],
  level: 1,
  enter(level) { K.level = this.level = level; K.rounds = 0; K.T = 0; buildCard(); setPencil(pending); startRound(); },
  exit() { K.round++; K.busy = true; removeClock(); removeCard(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { K.level = this.level = l; K.rounds = 0; startRound(); },
  adopt(l) { K.level = this.level = l; },
  relayout() { buildCard(); if (K.clock) K.clock.group.position.set(S.L.main[0], S.L.main[1], 0); },
  update(dt, t) {
    if (K.ready && K.ready.mesh.visible && !K.busy) K.ready.j.sc.t = 1 + 0.03 * Math.sin(t * 4);
    if (K.clock && K.clock.hh.ghost.visible) { const o = 0.25 + 0.15 * Math.sin(t * 6); K.clock.hh.ghost.material.opacity = K.clock.mh.ghost.material.opacity = o; }
  },
  pointer(o, e) {
    if (!o || !K.clock) return;
    const k = o.userData.kind;
    if (k === 'hand') grabHand(o.userData.which, e);
    else if (k === 'clkReady') check();
    else if (k === 'clockFace') { K.clock.face.punch(0.2); sfx.tap(); }
    else if (k === 'card') K.card.j.punch(0.4);
  },
  help() {
    if (K.busy || !K.clock) return;
    K.help = Math.min(2, K.help + 1);
    const [h, m] = hm(K.target);
    if (K.help === 1) { setPrompt(() => tr('clkHelp', digital(K.target), h, m)); K.clock.hh.j.pop(0.4); K.clock.mh.j.pop(0.4); }
    else if (K.mode === 'set') { say(tr('clkGhost')); showGhost(true); wait(4).then(() => showGhost(false)); }
    else { say(tr('glow')); setTrayGlow('t' + K.target); }
  },
  prompt: () => K.promptFn(),
  idle: () => !K.busy && !!K.clock,
  canDrag: () => !K.busy && K.mode === 'read',
  dragOpts: () => ({ targets: () => K.clock ? [{ mesh: K.clock.face.mesh, r: R + 0.4, j: K.clock.face }] : [], onDrop: dropCard }),
  onLang() {
    buildCard();
    if (K.mode === 'read' && !K.busy) setTray(distractors(K.target).map(cardItem), { sp: { wide: 2.8, tall: 2.6 } });
    say(K.promptFn());
  },
};
function pending() {
  if (K.busy || !K.clock || K.mode !== 'set') return null;
  const [h, m] = hm(K.T), [th, tm] = hm(K.target);
  if (m !== tm) return { mesh: K.clock.mh.tip, r: 0.8 };
  if (h !== th) return { mesh: K.clock.hh.tip, r: 0.8 };
  return { mesh: K.ready.mesh, r: 1.4 };
}
