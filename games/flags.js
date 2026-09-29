// "Flags": a paper world map. Match flags to countries, put flags on the right continent, find where countries are.
import * as THREE from 'three';
import { rand, rint, pick, lerp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, cutTex, cutShared, sharedMesh, paperMat, paint, text, segs, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, lang, contName, cap1 } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { COUNTRIES } from './flagsData.js';
import { MW, toMap, pinMat, poleMat, tagMat, buildMap, disposeMap, relabelMap } from './worldMap.js';

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
  ctx.save(); ctx.clip(); byId(id).draw(ctx, 1.8, 1.2); ctx.restore();
  rr(ctx, -0.9, -0.6, 1.8, 1.2, 0.06); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.02; ctx.stroke();
}, { res: 120, rim: 0.08 });
function removeMap() { disposeMap(Fl.map); Fl.map = null; Fl.pins = []; }
function makePin(c, label) {
  const [x, y] = toMap(c.lon, c.lat), g = new THREE.Group(); g.position.set(x, y, 0.3);
  const head = new Juicy(sharedMesh(pinMat())); head.sc.v = 0.0001; head.sc.t = 1; head.pop(0.6); g.add(head.mesh);
  let tag = null;
  if (label) { tag = new Juicy(sharedMesh(tagMat(label))); tag.mesh.position.set(0, 0.5, 0.05); tag.sc.v = 0.0001; tag.sc.t = 1; g.add(tag.mesh); }
  Fl.map.group.add(g);
  const pin = { c, group: g, head, tag, mesh: head.mesh, j: head, r: 1.1, planted: null };
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
    if (state.flag) { rr(ctx, -0.9, -0.6, 1.8, 1.2, 0.06); ctx.save(); ctx.clip(); byId(state.flag).draw(ctx, 1.8, 1.2); ctx.restore(); }
    else text(ctx, P, '?', 0, 0, 0.9, '#e8574a');
    ctx.restore();
    (state.lines || []).forEach((ln, i) => text(ctx, P, ln, tx, (tall ? -0.15 : h / 2 - 1.25) + i * 0.52, 0.36, '#7a5d49', { weight: 600, shadow: false, maxW: tw }));
  });
  c.j.punch(0.25);
}
const factLines = c => [`${contName(c.cont)}`, `${tr('flCapital')}: ${capOf(c)}`];

/* ---------- rounds ---------- */
function setPrompt(fn) { Fl.promptFn = fn; say(fn()); }
const flagItem = c => ({ key: 'f' + c.id, make: () => { const j = new Juicy(sharedMesh(flagMat(c.id))); j.cid = c.id; return j; }, trayBase: 1, base: 1 });
function pickCountries(n) {
  const pool = COUNTRIES.filter(c => (Fl.level === 1 ? c.easy : true) && !Fl.recent.includes(c.id));
  const out = shuffle(pool.slice()).slice(0, n);
  Fl.recent = out.map(c => c.id).concat(Fl.recent).slice(0, 12);
  return out;
}
async function startRound() {
  const tok = ++Fl.round;
  Fl.busy = true; Fl.problemWrong = 0; Fl.placed = 0; setTrayGlow(null); wiggleHelp(false); S.nudged = false;
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
    setPrompt(() => tr('flWhere'));
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
    setPrompt(() => tr('flFind', nm(c)));
  } else {
    setTray([flagItem(c)], { sp: { wide: 2.5, tall: 2.3 } });
    drawCard({ title: cap1(nm(c)), flag: c.id, lines: [] });
    setPrompt(() => tr('flWhichCont', nm(c)));
  }
  Fl.busy = false; S.lastAct = S.time;
}
function wrong(fn) {
  Fl.problemWrong++; Fl.stepWrong++; sfx.bad(); owlTilt(); setPrompt(fn);
  if (Fl.stepWrong >= 2) wiggleHelp(true);
}
async function solved(c, p, pin) {
  const tok = Fl.round;
  Fl.busy = true; Fl.placed++; setTrayGlow(null); wiggleHelp(false);
  await plant(p, pin);
  sfx.good(Fl.placed + 1);
  if (Fl.level === 3) drawCard({ title: tr('flMystery'), flag: c.id, lines: [cap1(nm(c)), `${Fl.placed} / ${Fl.total}`] });
  else drawCard({ title: cap1(nm(c)), flag: c.id, lines: factLines(c) });
  setPrompt(() => tr('flFact', nm(c), c.cont, capOf(c)));
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
async function win() {
  const tok = Fl.round; Fl.busy = true; setTrayGlow(null); wiggleHelp(false); setTray(null);
  const nStars = Fl.problemWrong === 0 ? 3 : Fl.problemWrong <= 3 ? 2 : 1;
  owlCheer();
  const ti = Math.floor(Math.random() * 4);
  setPrompt(() => tr('flWin', Fl.placed, tr('winTail')[ti]));
  Fl.pins.forEach((pin, i) => wait(0.08 * i).then(() => { if (pin.planted) { pin.planted.pop(0.6); pin.planted.punch(0.4); } }));
  await celebrate({ center: Fl.map.group.localToWorld(V3(0, 0.2, 0)), nStars, gameId: 'flags' });
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
export const flagsState = Fl;
export const flagsGame = {
  id: 'flags',
  levels: () => [{ id: 1, emoji: '🚩', label: tr('lvFlags') }, { id: 2, emoji: '🗺️', label: tr('lvCont') }, { id: 3, emoji: '🌍', label: tr('lvWorld') }],
  level: 1,
  enter(level) { Fl.level = this.level = level; setPencil(pending); startRound(); },
  exit() { Fl.round++; Fl.busy = true; removeMap(); removeCard(); setTray(null); setPencil(null); wiggleHelp(false); },
  setLevel(l) { Fl.level = this.level = l; startRound(); },
  relayout() {
    if (Fl.map) Fl.map.group.position.set(S.L.main[0], S.L.main[1] + 0.3, 0);
    const st = Fl.card && Fl.card.state; buildCard(); drawCard(st);
  },
  update(dt, t) {
    if (!Fl.map) return;
    Fl.map.conts.forEach((j, i) => { j.sc.t = drag.hover && drag.hover.cont === i ? 1.04 : 1; });
    for (const pin of Fl.pins) pin.head.sc.t = drag.hover === pin ? 1.5 : pin.planted ? 1 : 1 + 0.12 * Math.sin(t * 5);
  },
  pointer(o) {
    if (!o || !Fl.map) return;
    const k = o.userData.kind;
    if (k === 'continent') { const j = o.userData.j; j.punch(0.3); sfx.tap(); say(contName(Fl.map.conts.indexOf(j)), { hop: false }); }
    else if (k === 'card') Fl.card.j.punch(0.4);
  },
  help() {
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
  idle: () => !Fl.busy && !!Fl.map,
  canDrag: () => !Fl.busy && !!Fl.map,
  dragOpts: () => ({
    targets: () => !Fl.map ? [] : Fl.level === 2 ? Fl.map.targets : Fl.level === 1 ? (Fl.curPin && !Fl.curPin.planted ? [Fl.curPin] : []) : Fl.pins.filter(p => !p.planted),
    onDrop,
  }),
  onLang() {
    relabelMap(Fl.map);
    const c = Fl.cur;
    if (Fl.card && Fl.card.state) {
      if (Fl.level === 3) drawCard({ ...Fl.card.state, title: tr('flMystery') });
      else if (c) drawCard({ ...Fl.card.state, title: cap1(nm(c)), lines: Fl.card.state.lines.length ? factLines(c) : [] });
    }
    say(Fl.promptFn());
  },
};
