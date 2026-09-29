// "Animals": help paper animals get home by dragging them onto the right continent of the world map.
import * as THREE from 'three';
import { rint, lerp, Juicy, tween, wait, ease } from '../engine/util.js';
import { INK, cutTex, cutShared, sharedMesh, paperMat, paint, text, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, lang, cap1 } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setPencil } from '../engine/pencil.js';
import { setTray, setTrayGlow, flyHome } from '../engine/tray.js';
import { celebrate, wiggleHelp } from '../engine/ui.js';
import { ANIMALS } from './pictures.js';
import { toMap, buildMap, disposeMap, relabelMap } from './worldMap.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rint(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nm = a => a.name[lang];
const byId = id => ANIMALS.find(a => a.id === id);
const An = {
  level: 1, busy: true, round: 0, help: 0, problemWrong: 0, stepWrong: 0, promptFn: () => '',
  map: null, card: null, queue: [], cur: null, loose: [], placed: 0, total: 0, recent: [],
};

export const animalMat = id => cutShared('ani' + id, 3.0, 3.0, (ctx, P) => byId(id).draw(ctx, P), { res: 90, rim: 0.1 });
const animalItem = a => ({ key: 'a' + a.id, make: () => { const j = new Juicy(sharedMesh(animalMat(a.id))); j.aid = a.id; return j; }, trayBase: 0.55, base: 0.62 });

/* ---------- side card ---------- */
function buildCard() {
  removeCard();
  const tall = S.L.sideDir === 'h', w = tall ? 11.0 : 5.3, h = tall ? 3.3 : 5.4;
  const ct = cutTex(w, h, () => {}, { res: 80, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ct.W, ct.H), paperMat(ct.tex)); m.castShadow = m.receiveShadow = true; m.userData.kind = 'card';
  const g = new THREE.Group(); g.position.set(S.L.side[0], S.L.side[1] - (tall ? 0.3 : 0), 0); g.rotation.z = tall ? -0.01 : 0.02;
  const sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh, m); scene.add(g);
  An.card = { group: g, mesh: m, sh, ct, w, h, tall, j: new Juicy(m), state: null };
}
function removeCard() { if (!An.card) return; An.card.j.kill(); scene.remove(An.card.group); disposeMesh(An.card.mesh); disposeMesh(An.card.sh); An.card = null; }
// state: { animal: id|null, lines: [...] }
function drawCard(state) {
  const c = An.card; if (!c) return;
  c.state = state = state || c.state; if (!state) return;
  const { w, h, tall } = c;
  c.ct.redraw((ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.3, 0.035, 41); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    const tx = tall ? 1.6 : 0, tw = tall ? 6.4 : w - 0.5;
    text(ctx, P, tr('anTitle'), tx, -h / 2 + 0.6, 0.5, INK, { maxW: tw });
    if (state.animal) { ctx.save(); ctx.translate(tall ? -3.3 : 0, tall ? 0.05 : -0.25); ctx.scale(tall ? 0.95 : 1.05, tall ? 0.95 : 1.05); byId(state.animal).draw(ctx, P); ctx.restore(); }
    (state.lines || []).forEach((ln, i) => text(ctx, P, ln, tx, (tall ? -0.1 : h / 2 - 1.05) + i * 0.52, i ? 0.36 : 0.46, i ? '#7a5d49' : INK, { weight: i ? 600 : 700, shadow: false, maxW: tw }));
  });
  c.j.punch(0.25);
}

/* ---------- rounds ---------- */
function setPrompt(fn) { An.promptFn = fn; say(fn()); }
function pickAnimals(n) {
  const pool = ANIMALS.filter(a => (An.level === 1 ? a.easy : true) && !An.recent.includes(a.id));
  const out = shuffle(pool.slice()).slice(0, n);
  An.recent = out.map(a => a.id).concat(An.recent).slice(0, 8);
  return out;
}
async function startRound() {
  const tok = ++An.round;
  An.busy = true; An.problemWrong = 0; An.placed = 0; setTrayGlow(null); wiggleHelp(false); S.nudged = false;
  if (An.map) { const old = An.map, og = old.group, sx = og.position.x; An.map = null; tween(0.5, k => { og.position.x = sx - k * 30; og.rotation.z = k * 0.4; }, ease.inCubic).then(() => disposeMap(old)); }
  const map = An.map = buildMap(); buildCard(); setTray(null);
  sfx.whoosh();
  await tween(0.7, k => map.group.position.set(S.L.main[0], S.L.main[1] + 0.3 + (1 - k) * 15, 0), ease.outBack);
  if (tok !== An.round) return;
  sfx.snap(); S.shake = Math.max(S.shake, 0.2);
  if (An.level === 3) {
    An.loose = pickAnimals(3); An.total = 3; An.cur = null;
    setTray(An.loose.map(animalItem), { sp: { wide: 2.6, tall: 2.3 } });
    drawCard({ animal: null, lines: [`0 / ${An.total}`] });
    setPrompt(() => tr('anMany'));
    An.busy = false; S.lastAct = S.time;
  } else { An.queue = pickAnimals(5); An.total = An.queue.length; nextStep(tok); }
}
function nextStep(tok) {
  if (tok !== An.round) return;
  if (!An.queue.length) return win();
  const a = An.cur = An.queue.shift(); An.help = 0; An.stepWrong = 0; S.nudged = false; setTrayGlow(null); wiggleHelp(false);
  setTray([animalItem(a)], { sp: { wide: 2.6, tall: 2.3 } });
  drawCard({ animal: a.id, lines: [cap1(nm(a))] });
  setPrompt(() => tr('anWhere', nm(a)));
  An.busy = false; S.lastAct = S.time;
}
async function goHome(p, a) {
  const [x, y] = toMap(a.lon, a.lat), local = V3(x, y, 0.3 + An.placed * 0.02), to = An.map.group.localToWorld(local.clone());
  const from = p.mesh.position.clone(), b0 = p.base; p.rot.t = 0; p.sc.t = 1;
  await tween(0.35, k => { p.mesh.position.lerpVectors(from, to, k); p.mesh.position.z += Math.sin(k * Math.PI) * 1.2; p.base = lerp(b0, 0.34, k); }, ease.inOutSine);
  if (!An.map) { p.kill(); return; }
  An.map.group.attach(p.mesh); p.mesh.position.copy(local); p.base = 0.34; p.mesh.userData.kind = 'homeAnimal';
  p.punch(0.6); sfx.snap(); burst(to, 12, { speed: 2.6, up: 3.5, z: 1, size: 0.7 });
}
function onDrop(p, t) {
  if (!t || An.busy || !An.map) { flyHome(p); return; }
  const a = byId(p.aid);
  if (t.cont === a.cont) return solved(a, p);
  flyHome(p); t.j.rot.vel += 4; t.j.punch(0.3);
  An.problemWrong++; An.stepWrong++; sfx.bad(); owlTilt();
  setPrompt(() => tr('anNo', nm(a), t.cont));
  if (An.stepWrong >= 2) { const cj = An.map.conts[a.cont]; cj.pop(0.5); cj.punch(0.4); wiggleHelp(true); }
}
async function solved(a, p) {
  const tok = An.round;
  An.busy = true; An.placed++; setTrayGlow(null); wiggleHelp(false);
  const cj = An.map.conts[a.cont]; cj.pop(0.3);
  await goHome(p, a);
  sfx.good(An.placed + 1);
  drawCard({ animal: a.id, lines: [cap1(nm(a)), An.level === 3 ? `${An.placed} / ${An.total}` : ''] });
  setPrompt(() => tr('anYes', nm(a), a.cont));
  if (An.level === 3) {
    An.loose = An.loose.filter(x => x.id !== a.id);
    if (!An.loose.length) { await wait(1.6); if (tok === An.round) win(); return; }
    setTray(An.loose.map(animalItem), { sp: { wide: 2.6, tall: 2.3 } }); An.stepWrong = 0; An.busy = false; return;
  }
  await wait(2.2);
  nextStep(tok);
}
async function win() {
  const tok = An.round; An.busy = true; setTrayGlow(null); wiggleHelp(false); setTray(null);
  const nStars = An.problemWrong === 0 ? 3 : An.problemWrong <= 3 ? 2 : 1;
  owlCheer();
  const ti = Math.floor(Math.random() * 4);
  setPrompt(() => tr('anWin', An.placed, tr('winTail')[ti]));
  An.map.group.children.forEach((o, i) => { if (o.userData.kind === 'homeAnimal') wait(0.08 * i).then(() => o.userData.j && o.userData.j.pop(0.6)); });
  await celebrate({ center: An.map.group.localToWorld(V3(0, 0.2, 0)), nStars, gameId: 'animals' });
  if (tok !== An.round) return;
  await wait(0.4);
  if (tok !== An.round) return;
  startRound();
}

export const animalsState = An;
export const animalsGame = {
  id: 'animals',
  levels: () => [{ id: 1, emoji: '🐼', label: tr('lvHomes') }, { id: 2, emoji: '🦥', label: tr('lvMoreAnimals') }, { id: 3, emoji: '🦒', label: tr('lvHerd') }],
  level: 1,
  enter(level) { An.level = this.level = level; setPencil(null); startRound(); },
  exit() { An.round++; An.busy = true; disposeMap(An.map); An.map = null; removeCard(); setTray(null); wiggleHelp(false); },
  setLevel(l) { An.level = this.level = l; startRound(); },
  relayout() {
    if (An.map) An.map.group.position.set(S.L.main[0], S.L.main[1] + 0.3, 0);
    const st = An.card && An.card.state; buildCard(); drawCard(st);
  },
  update() { if (An.map) An.map.conts.forEach((j, i) => { j.sc.t = drag.hover && drag.hover.cont === i ? 1.04 : 1; }); },
  pointer(o) {
    if (!o || !An.map) return;
    const k = o.userData.kind;
    if (k === 'homeAnimal') { const j = o.userData.j, a = ANIMALS.find(x => x.id === j.aid); j.pop(0.5); sfx.tap(); if (a) say(cap1(nm(a)), { hop: false }); }
    else if (k === 'continent') { o.userData.j.punch(0.3); sfx.tap(); }
    else if (k === 'card') An.card.j.punch(0.4);
  },
  help() {
    if (An.busy || !An.map) return;
    An.help = Math.min(2, An.help + 1);
    const a = An.cur || An.loose[0]; if (!a) return;
    const cj = An.map.conts[a.cont]; cj.pop(0.5); cj.punch(0.4);
    say(tr('anHint', nm(a), a.cont));
    if (An.level === 3 && An.help === 2) setTrayGlow('a' + a.id);
  },
  prompt: () => An.promptFn(),
  idle: () => !An.busy && !!An.map,
  canDrag: () => !An.busy && !!An.map,
  dragOpts: () => ({ targets: () => An.map ? An.map.targets : [], onDrop }),
  onLang() {
    relabelMap(An.map);
    if (An.cur) drawCard({ animal: An.cur.id, lines: [cap1(nm(An.cur))] }); else drawCard();
    say(An.promptFn());
  },
};
