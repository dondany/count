// "Flags": a paper world map. Match flags to countries, put flags on the right continent, find where countries are.
import * as THREE from 'three';
import { rand, rint, pick, lerp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, cutTex, cutShared, sharedMesh, paperMat, paint, text, segs, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag, startGrab, cancelGrab, setNDC, atZ, renderer } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, lang, contName, cap1 } from '../engine/i18n.js';
import { say, note, firstTime, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { recordMistake } from '../engine/stats.js';
import { COUNTRIES, FLAGS } from './flagsData.js';
import { store, save } from '../engine/store.js';
import { EU_INFO, EU_IDS, MAP_W as EU_W, MAP_H as EU_H, geo, buildEurope, disposeEurope, paintCountry, showGlow, countryAt,
  inWindow, zoomTo, zoomLevel, pinchTo, panBy, updateEurope, highlight } from './europeMap.js';
import { MW, toMap, pinMat, pinRingMat, poleMat, tagMat, buildMap, disposeMap, relabelMap } from './worldMap.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nm = c => c.name[lang], capOf = c => c.capital[lang];
const byId = id => COUNTRIES.find(c => c.id === id);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rint(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const Fl = {
  level: 1, busy: true, round: 0, help: 0, problemWrong: 0, stepWrong: 0, promptFn: () => '',
  map: null, card: null, queue: [], cur: null, pins: [], placed: 0, total: 0, recent: [],
};

/* ---------- materials ---------- */
export const flagMat = id => cutShared('flag' + id, 1.8, 1.2, (ctx, P) => {
  rr(ctx, -0.9, -0.6, 1.8, 1.2, 0.06);
  if (P.rim) { paint(ctx, P); return; }
  ctx.save(); ctx.clip(); FLAGS[id](ctx, 1.8, 1.2); ctx.restore();
  rr(ctx, -0.9, -0.6, 1.8, 1.2, 0.06); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.02; ctx.stroke();
}, { res: 120, rim: 0.08 });
function removeMap() { disposeMap(Fl.map); Fl.map = null; Fl.pins = []; }
function makePin(c, label) {
  const [x, y] = toMap(c.lon, c.lat), g = new THREE.Group(); g.position.set(x, y, 0.3);
  const head = new Juicy(sharedMesh(pinMat())); head.sc.v = 0.0001; head.sc.t = 1; head.pop(0.6); g.add(head.mesh);
  const ring = new Juicy(sharedMesh(pinRingMat(false), false)); ring.mesh.position.z = -0.02; ring.sc.v = 0.0001; g.add(ring.mesh);
  let tag = null;
  if (label) { tag = new Juicy(sharedMesh(tagMat(label))); tag.mesh.position.set(0, 0.62, 0.05); tag.sc.v = 0.0001; tag.sc.t = 1; g.add(tag.mesh); }
  Fl.map.group.add(g);
  // drop radius: with a single target the whole neighbourhood counts; several pins are spread apart (see pickCountries)
  const pin = { c, group: g, head, ring, tag, mesh: head.mesh, j: head, r: Fl.level === 1 ? 2.4 : 1.0, planted: null };
  Fl.pins.push(pin); sfx.tap();
  return pin;
}
async function plant(p, pin) {
  const side = pin.group.position.x > MW / 2 - 1.3 ? -1 : 1; // near the right edge the flag flies to the left
  const from = p.mesh.position.clone(), local = V3(0.39 * side, 0.74, 0.1), to = pin.group.localToWorld(local.clone()), b0 = p.base;
  p.rot.t = 0; p.sc.t = 1;
  await tween(0.25, k => { p.mesh.position.lerpVectors(from, to, k); p.base = lerp(b0, 0.42, k); }, ease.inOutSine);
  if (!Fl.map || !pin.group.parent) { p.kill(); return; }
  pin.group.attach(p.mesh); p.mesh.position.copy(local); p.base = 0.42; p.mesh.userData.kind = null;
  const pole = new Juicy(sharedMesh(poleMat())); pole.mesh.position.set(0, 0.45, 0.05); pole.sc.v = 0.3; pole.sc.t = 1; pin.group.add(pole.mesh);
  if (pin.tag) pin.tag.sc.t = 0.0001;
  pin.planted = p; p.punch(0.6); pin.head.pop(0.5); sfx.snap();
  burst(to, 12, { speed: 2.6, up: 3.5, z: 1, size: 0.7 });
}

/* ---------- side card ---------- */
function buildCard() {
  removeCard();
  const tall = S.L.sideDir === 'h', w = tall ? 11.0 : 5.3, h = tall ? 3.3 : 5.4;
  const ct = cutTex(w, h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'card';
  const g = new THREE.Group(); g.position.set(S.L.side[0], S.L.side[1] - (tall ? 0.3 : 0), 0); g.rotation.z = tall ? -0.01 : 0.02;
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  Fl.card = { group: g, mesh: m, sh, ct, w, h, tall, j: new Juicy(m), state: null };
}
function removeCard() { if (!Fl.card) return; Fl.card.j.kill(); scene.remove(Fl.card.group); disposeMesh(Fl.card.mesh); disposeMesh(Fl.card.sh); Fl.card = null; }
// state: { title, flag: countryId|null (null = "?"), lines: [...] }
function drawCard(state) {
  const c = Fl.card; if (!c) return;
  c.state = state = state || c.state; if (!state) return;
  const { w, h, tall } = c;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 88); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    const fx = tall ? -3.2 : 0, fy = tall ? 0 : -0.35, tx = tall ? 1.6 : 0, tw = tall ? 6.4 : w - 0.5;
    text(ctx, P, state.title, tx, tall ? -h / 2 + 0.6 : -h / 2 + 0.6, 0.5, INK, { maxW: tw });
    ctx.save(); ctx.translate(fx, fy); ctx.scale(1.25, 1.25);
    rr(ctx, -0.95, -0.65, 1.9, 1.3, 0.1); ctx.fillStyle = '#e9dcc4'; ctx.fill();
    if (state.flag) { rr(ctx, -0.9, -0.6, 1.8, 1.2, 0.06); ctx.save(); ctx.clip(); FLAGS[state.flag](ctx, 1.8, 1.2); ctx.restore(); }
    else text(ctx, P, '?', 0, 0, 0.9, '#e8574a');
    ctx.restore();
    (state.lines || []).forEach((ln, i) => text(ctx, P, ln, tx, (tall ? -0.15 : h / 2 - 1.25) + i * 0.52, 0.36, '#7a5d49', { weight: 600, shadow: false, maxW: tw }));
  });
  c.j.punch(0.25);
}
const factLines = c => [`${contName(c.cont)}`, `${tr('flCapital')}: ${capOf(c)}`];

/* ---------- rounds ---------- */
function setPrompt(fn) { Fl.promptFn = fn; say(fn()); }
// explain once per visit, then say only the short version (or show the text silently when there is no short one)
function intro(key, full, short = null) { const first = firstTime(key), fn = first || !short ? full : short; Fl.promptFn = fn; if (first || short) say(fn()); else note(fn()); }
function quiet(fn) { Fl.promptFn = fn; note(fn()); }
const flagItem = c => ({ key: 'f' + c.id, make: () => { const j = new Juicy(sharedMesh(flagMat(c.id))); j.cid = c.id; return j; }, trayBase: 1, base: 1 });
// countries for a round, spread out on the map so pins (and planted flags) never sit on top of each other
function pickCountries(n) {
  const pool = shuffle(COUNTRIES.filter(c => (Fl.level === 1 ? c.easy : true) && !Fl.recent.includes(c.id)));
  const pos = c => toMap(c.lon, c.lat), far = (a, list, d) => list.every(b => { const [x1, y1] = pos(a), [x2, y2] = pos(b); return Math.hypot(x1 - x2, y1 - y2) >= d; });
  let out = [];
  for (const d of [Fl.level === 3 ? 1.6 : 1.15, 0.9, 0]) {
    out = [];
    for (const c of pool) { if (out.length < n && far(c, out, d)) out.push(c); }
    if (out.length === n) break;
  }
  Fl.recent = out.map(c => c.id).concat(Fl.recent).slice(0, 12);
  return out;
}
async function startRound() {
  const tok = ++Fl.round;
  Fl.busy = true; Fl.problemWrong = 0; Fl.placed = 0; setTrayGlow(null); wiggleHelp(false); S.nudged = false;
  if (Fl.level === 4) return startEurope(tok);
  if (Fl.eu) { const old = Fl.eu, og = old.root, sx = og.position.x; Fl.eu = null; tween(0.5, k => { og.position.x = sx - k * 30; }, ease.inCubic).then(() => disposeEurope(old)); }
  if (Fl.map) { const old = Fl.map, og = old.group, sx = og.position.x; Fl.map = null; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.4; }, ease.inCubic).then(() => disposeMap(old)); }
  Fl.pins = [];
  const map = Fl.map = buildMap();
  buildCard(); setTray(null);
  sfx.whoosh();
  await tween(0.7, k => map.group.position.set(S.L.main[0], S.L.main[1] + 0.3 + (1 - k) * 15, 0), ease.outBack);
  if (tok !== Fl.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  if (Fl.level === 3) {
    const list = pickCountries(4); Fl.total = list.length; Fl.queue = [];
    list.forEach((c, i) => wait(0.12 * i).then(() => { if (tok === Fl.round) makePin(c, '?'); }));
    await wait(0.6);
    setTray(shuffle(list.slice()).map(flagItem), { sp: { wide: 2.5, tall: 2.3 } });
    drawCard({ title: tr('flMystery'), flag: null, lines: [`0 / ${Fl.total}`] });
    intro('fl3', () => tr('flWhere'));
    Fl.busy = false; S.lastAct = S.time;
  } else {
    Fl.queue = pickCountries(5); Fl.total = Fl.queue.length;
    nextStep(tok);
  }
}
async function nextStep(tok) {
  if (tok !== Fl.round) return;
  if (!Fl.queue.length) return win();
  const c = Fl.cur = Fl.queue.shift(); Fl.help = 0; Fl.stepWrong = 0; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  if (Fl.level === 1) {
    Fl.curPin = makePin(c, cap1(nm(c)));
    const others = shuffle(COUNTRIES.filter(x => x.id !== c.id)).slice(0, 2);
    setTray(shuffle([c, ...others]).map(flagItem), { sp: { wide: 2.5, tall: 2.3 } });
    drawCard({ title: cap1(nm(c)), flag: null, lines: [] });
    intro('fl1', () => tr('flFind', nm(c)), () => tr('flFindShort', nm(c)));
  } else {
    setTray([flagItem(c)], { sp: { wide: 2.5, tall: 2.3 } });
    drawCard({ title: cap1(nm(c)), flag: c.id, lines: [] });
    intro('fl2', () => tr('flWhichCont', nm(c)), () => tr('flContShort', nm(c)));
  }
  Fl.busy = false; S.lastAct = S.time;
}
function wrong(fn) {
  Fl.problemWrong++; Fl.stepWrong++; recordMistake('flags', Fl.level === 2 ? 'cont' : 'flag'); sfx.bad(); owlTilt(); setPrompt(fn);
  if (Fl.stepWrong >= 2) wiggleHelp(true);
}
async function solved(c, p, pin) {
  const tok = Fl.round;
  Fl.busy = true; Fl.placed++; setTrayGlow(null); wiggleHelp(false);
  await plant(p, pin);
  sfx.good(Fl.placed + 1);
  if (Fl.level === 3) drawCard({ title: tr('flMystery'), flag: c.id, lines: [cap1(nm(c)), `${Fl.placed} / ${Fl.total}`] });
  else drawCard({ title: cap1(nm(c)), flag: c.id, lines: factLines(c) });
  quiet(() => tr('flFact', nm(c), c.cont, capOf(c)));
  if (Fl.level === 3) {
    if (Fl.placed >= Fl.total) { await wait(1.6); if (tok === Fl.round) win(); return; }
    // only the flags still to place stay in the tray
    setTray(shuffle(Fl.pins.filter(x => !x.planted).map(x => x.c)).map(flagItem), { sp: { wide: 2.5, tall: 2.3 } });
    Fl.busy = false; return;
  }
  await wait(2.4);
  nextStep(tok);
}
function onDrop(p, t) {
  if (Fl.level === 4 && Fl.eu && t && !Fl.busy) return euDrop(p);
  if (!t || Fl.busy || !Fl.map) { flyHome(p); return; }
  const dropped = byId(p.cid);
  if (Fl.level === 1) {
    if (p.cid === Fl.cur.id) return solved(Fl.cur, p, Fl.curPin);
    flyHome(p); Fl.curPin.head.pop(0.5);
    wrong(() => tr('flOops', nm(dropped)));
    if (Fl.stepWrong >= 2) setTrayGlow('f' + Fl.cur.id);
  } else if (Fl.level === 2) {
    if (t.cont === Fl.cur.cont) return solved(Fl.cur, p, makePin(Fl.cur, null));
    flyHome(p); t.j.rot.vel += 4; t.j.punch(0.3);
    wrong(() => tr('flNotCont', t.cont));
    if (Fl.stepWrong >= 2) { const cj = Fl.map.conts[Fl.cur.cont]; cj.pop(0.5); cj.punch(0.4); }
  } else {
    if (t.c.id === p.cid) return solved(dropped, p, t);
    flyHome(p); t.head.pop(0.5);
    wrong(() => tr('flNotHere', nm(dropped)));
  }
}
/* ---------- Europe: find every country, paint it with its flag ---------- */
const euScale = () => S.L.name === 'wide' ? Math.min(1, 8.4 / (EU_H + 0.5)) : Math.min(11.5 / (EU_W + 0.5), 8.2 / (EU_H + 0.5));
const euY = () => S.L.main[1] + (S.L.name === 'wide' ? -0.05 : 0.15);
const painted = () => (store.europe || []).filter(id => EU_IDS.includes(id));
async function startEurope(tok) {
  if (Fl.map) { const old = Fl.map, og = old.group, sx = og.position.x; Fl.map = null; Fl.pins = []; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.4; }, ease.inCubic).then(() => disposeMap(old)); }
  let left = EU_IDS.filter(id => !painted().includes(id));
  if (!left.length) { store.europe = []; save(); left = EU_IDS.slice(); if (Fl.eu) { disposeEurope(Fl.eu); Fl.eu = null; } say(tr('euAll')); owlCheer(); }
  buildCard(); setTray(null);
  if (!Fl.eu) {
    const E = Fl.eu = buildEurope(), sc = euScale(); E.root.scale.setScalar(sc);
    painted().forEach(id => paintCountry(E, id, false));
    sfx.whoosh();
    await tween(0.7, k => E.root.position.set(S.L.main[0], euY() + (1 - k) * 15, 0), ease.outBack);
    if (tok !== Fl.round) return;
    sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  }
  zoomTo(Fl.eu, 1);
  // five countries per round, at most one tiny one (they're the hardest to hit)
  const tiny = id => geo(id).tiny, q = [];
  for (const id of shuffle(left)) { if (q.length < 5 && (!tiny(id) || !q.some(tiny))) q.push(id); }
  Fl.queue = q.map(id => EU_INFO[id]); Fl.total = Fl.queue.length;
  nextEuStep(tok);
}
function nextEuStep(tok) {
  if (tok !== Fl.round) return;
  if (!Fl.queue.length) return win();
  const c = Fl.cur = Fl.queue.shift(); Fl.help = 0; Fl.stepWrong = 0; S.nudged = false; wiggleHelp(false); showGlow(Fl.eu, null);
  setTray([flagItem(c)], { sp: { wide: 2.5, tall: 2.3 } });
  drawCard({ title: cap1(nm(c)), flag: c.id, lines: [tr('euProgress', painted().length, EU_IDS.length)] });
  intro('eu', () => tr('euFind', nm(c)), () => tr('euFindShort', nm(c)));
  Fl.busy = false; S.lastAct = S.time;
}
function euLocal(pt) { return Fl.eu.group.worldToLocal(pt.clone()); }
// small countries get a zoom-in with the hint, so they're easy to reach
function euHint() {
  const g = geo(Fl.cur.id); showGlow(Fl.eu, Fl.cur.id);
  if (g.area < 6) zoomTo(Fl.eu, g.tiny ? 3.5 : g.area < 2 ? 2.8 : 2, { x: g.label[0], y: g.label[1] }, true);
}
function euDrop(p) {
  const id = inWindow(Fl.eu, drag.pt) ? countryAt(Fl.eu, euLocal(drag.pt), Fl.cur.id) : null;
  if (id === Fl.cur.id) return euSolved(p);
  flyHome(p);
  if (!id) return;
  const c = Fl.eu.countries[id]; (c.painted || c.j).pop(0.5); if (c.marker) c.marker.pop(0.6);
  Fl.problemWrong++; Fl.stepWrong++; recordMistake('flags', 'europe'); sfx.bad(); owlTilt();
  setPrompt(() => tr('euNo', nm(EU_INFO[id])));
  if (Fl.stepWrong >= 2) { euHint(); wiggleHelp(true); }
}
async function euSolved(p) {
  const tok = Fl.round, c = Fl.cur, g = geo(c.id), E = Fl.eu;
  Fl.busy = true; Fl.placed++; showGlow(E, null); wiggleHelp(false);
  const to = E.group.localToWorld(V3(g.label[0], g.label[1], 0.4)), from = p.mesh.position.clone(), b0 = p.base;
  p.rot.t = 0;
  await tween(0.3, k => { p.mesh.position.lerpVectors(from, to, k); p.base = lerp(b0, 0.15, k); p.extra = k * 3; }, ease.inCubic);
  p.kill();
  if (tok !== Fl.round || !Fl.eu) return;
  paintCountry(E, c.id); sfx.snap(); sfx.good(Fl.placed + 1); S.shake = Math.max(S.shake, 0.12);
  burst(to, 16, { speed: 2.8, up: 4, z: 1, size: 0.7 });
  store.europe = [...new Set([...(store.europe || []), c.id])]; save();
  drawCard({ title: cap1(nm(c)), flag: c.id, lines: [`${tr('flCapital')}: ${capOf(c)}`, tr('euProgress', painted().length, EU_IDS.length)] });
  quiet(() => tr('euYes', nm(c), capOf(c)));
  await wait(2.3);
  nextEuStep(tok);
}

async function win() {
  const tok = Fl.round; Fl.busy = true; setTrayGlow(null); wiggleHelp(false); setTray(null);
  const nStars = Fl.problemWrong === 0 ? 3 : Fl.problemWrong <= 3 ? 2 : 1;
  owlCheer();
  const ti = Math.floor(Math.random() * 4);
  quiet(() => tr('flWin', Fl.placed, tr('winTail')[ti]));
  Fl.pins.forEach((pin, i) => wait(0.08 * i).then(() => { if (pin.planted) { pin.planted.pop(0.6); pin.planted.punch(0.4); } }));
  await celebrate({ center: (Fl.eu ? Fl.eu.root : Fl.map.group).localToWorld(V3(0, 0.2, 0)), nStars, gameId: 'flags', level: Fl.level, wrong: Fl.problemWrong });
  if (tok !== Fl.round) return;
  await wait(0.4);
  if (tok !== Fl.round) return;
  startRound();
}

/* ---------- game object ---------- */
function pending() {
  if (Fl.busy || !Fl.map) return null;
  if (Fl.level === 1 && Fl.curPin && !Fl.curPin.planted) return { mesh: Fl.curPin.head.mesh, r: 0.7 };
  return null;
}
// mouse wheel zooms the Europe map on computers
renderer.domElement.addEventListener('wheel', e => {
  if (!Fl.eu) return;
  setNDC(e); const pt = atZ(0.12); if (!inWindow(Fl.eu, pt)) return;
  e.preventDefault();
  zoomTo(Fl.eu, zoomLevel(Fl.eu) * (e.deltaY < 0 ? 1.2 : 1 / 1.2), euLocal(pt));
}, { passive: false });
// two-finger pinch zooms (and moves) the Europe map on touch screens
const touches = new Map(); let pinch = null;
const touchPt = e => { setNDC(e); return atZ(0.2); };
const midOf = (a, b) => a.clone().add(b).multiplyScalar(0.5);
renderer.domElement.addEventListener('pointerdown', e => {
  if (!Fl.eu || e.pointerType === 'mouse') return;
  touches.set(e.pointerId, touchPt(e));
  if (touches.size !== 2 || drag.piece) return;
  const [a, b] = [...touches.values()], mid = midOf(a, b);
  if (!inWindow(Fl.eu, mid)) return;
  cancelGrab(); // the first finger had started a pan
  pinch = { d0: Math.max(0.3, a.distanceTo(b)), z0: zoomLevel(Fl.eu), f: euLocal(mid) };
});
addEventListener('pointermove', e => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, touchPt(e));
  if (!pinch || !Fl.eu || touches.size < 2) return;
  const [a, b] = [...touches.values()];
  pinchTo(Fl.eu, pinch.z0 * a.distanceTo(b) / pinch.d0, pinch.f, midOf(a, b));
});
const liftTouch = e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
addEventListener('pointerup', liftTouch); addEventListener('pointercancel', liftTouch);
export const flagsState = Fl;
export const flagsGame = {
  id: 'flags',
  levels: () => [{ id: 1, emoji: '🚩', label: tr('lvFlags') }, { id: 2, emoji: '🗺️', label: tr('lvCont') }, { id: 3, emoji: '🌍', label: tr('lvWorld') }, { id: 4, emoji: '🏰', label: tr('lvEurope') }],
  level: 1,
  enter(level) { Fl.level = this.level = level; setPencil(pending); startRound(); },
  exit() { Fl.round++; Fl.busy = true; removeMap(); disposeEurope(Fl.eu); Fl.eu = null; removeCard(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { Fl.level = this.level = l; startRound(); },
  adopt(l) { Fl.level = this.level = l; },
  relayout() {
    if (Fl.map) Fl.map.group.position.set(S.L.main[0], S.L.main[1] + 0.3, 0);
    if (Fl.eu) { Fl.eu.root.position.set(S.L.main[0], euY(), 0); Fl.eu.root.scale.setScalar(euScale()); }
    const st = Fl.card && Fl.card.state; buildCard(); drawCard(st);
  },
  update(dt, t) {
    if (Fl.eu) {
      updateEurope(Fl.eu, dt);
      highlight(Fl.eu, drag.piece && drag.hover && drag.hover.eu ? countryAt(Fl.eu, euLocal(drag.pt), Fl.cur && Fl.cur.id) : null);
      if (Fl.eu.glowFor) Fl.eu.glow.sc.t = 1 + 0.1 * Math.sin(t * 6);
    }
    if (!Fl.map) return;
    Fl.map.conts.forEach((j, i) => { j.sc.t = drag.hover && drag.hover.cont === i ? 1.04 : 1; });
    for (const pin of Fl.pins) {
      const hov = drag.hover === pin, open = !pin.planted && (Fl.level !== 1 || pin === Fl.curPin);
      pin.head.sc.t = hov ? 1.4 : pin.planted ? 1 : 1 + 0.1 * Math.sin(t * 5);
      pin.ring.sc.t = !open ? 0.0001 : hov ? 1.35 : 1 + 0.08 * Math.sin(t * 4 + pin.c.lon);
      const m = pinRingMat(hov).mat; if (pin.ring.mesh.material !== m) pin.ring.mesh.material = m;
    }
  },
  pointer(o, e) {
    const k0 = o && o.userData.kind;
    if (Fl.eu && k0 === 'euZoom') { const j = o.userData.j; j.punch(0.4); sfx.tap(); zoomTo(Fl.eu, zoomLevel(Fl.eu) * (o.userData.dir > 0 ? 1.8 : 1 / 1.8)); return; }
    if (Fl.eu && (k0 === 'euCountry' || k0 === 'euSea')) {
      // drag the map to pan it (when zoomed in); a tap on a country says its name
      let last = atZ(0.2), moved = 0;
      startGrab(e, pt => { if (!Fl.eu) return; const dx = pt.x - last.x, dy = pt.y - last.y; moved += Math.hypot(dx, dy); if (zoomLevel(Fl.eu) > 1.01) panBy(Fl.eu, dx, dy); last = pt; }, () => {
        if (moved > 0.25 || k0 !== 'euCountry' || !Fl.eu) return;
        const id = o.userData.id, c = Fl.eu.countries[id], info = EU_INFO[id];
        (c.painted || c.j).pop(0.2); if (c.marker) c.marker.pop(0.5); sfx.tap();
        say(c.painted ? `${cap1(nm(info))} — ${capOf(info)}` : cap1(nm(info)), { hop: false });
      });
      return;
    }
    if (!o || !Fl.map) return;
    const k = o.userData.kind;
    if (k === 'continent') { const j = o.userData.j; j.punch(0.3); sfx.tap(); say(contName(Fl.map.conts.indexOf(j)), { hop: false }); }
    else if (k === 'card') Fl.card.j.punch(0.4);
  },
  help() {
    if (Fl.level === 4) {
      if (Fl.busy || !Fl.eu || !Fl.cur) return;
      euHint(); say(tr('euHint', nm(Fl.cur))); return;
    }
    if (Fl.busy || !Fl.map) return;
    Fl.help = Math.min(2, Fl.help + 1);
    if (Fl.level === 3) {
      const pin = Fl.pins.find(p => !p.planted); if (!pin) return;
      pin.head.pop(0.8); say(tr('flIsIn', nm(pin.c), pin.c.cont)); if (Fl.help === 2) { say(tr('glow')); setTrayGlow('f' + pin.c.id); }
      return;
    }
    const c = Fl.cur; if (!c) return;
    const cj = Fl.map.conts[c.cont]; cj.pop(0.5); cj.punch(0.4);
    if (Fl.help === 1) say(tr('flIsIn', nm(c), c.cont));
    else if (Fl.level === 1) { say(tr('glow')); setTrayGlow('f' + c.id); }
    else say(tr('flIsIn', nm(c), c.cont));
  },
  prompt: () => Fl.promptFn(),
  idle: () => !Fl.busy && !!(Fl.map || Fl.eu),
  canDrag: () => !Fl.busy && !!(Fl.map || Fl.eu),
  dragOpts: () => ({
    targets: () => Fl.level === 4 ? (Fl.eu ? [{ eu: true, hit: pt => inWindow(Fl.eu, pt) && countryAt(Fl.eu, euLocal(pt), Fl.cur && Fl.cur.id) !== null }] : []) : !Fl.map ? [] : Fl.level === 2 ? Fl.map.targets : Fl.level === 1 ? (Fl.curPin && !Fl.curPin.planted ? [Fl.curPin] : []) : Fl.pins.filter(p => !p.planted),
    onDrop,
  }),
  onLang() {
    relabelMap(Fl.map);
    const c = Fl.cur;
    if (Fl.level === 4 && c && Fl.card) { drawCard({ ...Fl.card.state, title: cap1(nm(c)), lines: [tr('euProgress', painted().length, EU_IDS.length)] }); say(Fl.promptFn()); return; }
    if (Fl.card && Fl.card.state) {
      if (Fl.level === 3) drawCard({ ...Fl.card.state, title: tr('flMystery') });
      else if (c) drawCard({ ...Fl.card.state, title: cap1(nm(c)), lines: Fl.card.state.lines.length ? factLines(c) : [] });
    }
    say(Fl.promptFn());
  },
};
