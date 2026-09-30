// "Paper scene": free play. Drag pictures and collected stickers onto a paper landscape; tap to resize. Saved on this device.
import * as THREE from 'three';
import { clamp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, cutShared, sharedMesh, paint, rr, tornRect, starPath, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, drag, startDrag } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr } from '../engine/i18n.js';
import { say, note, owlCheer } from '../engine/pip.js';
import { setTray, flyHome } from '../engine/tray.js';
import { setPencil } from '../engine/pencil.js';
import { store, save } from '../engine/store.js';
import { ALL_STICKERS } from './stickers.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const FREE = ['w:tree', 'w:sun', 'w:house', 'w:flower', 'w:star', 'w:balloon', 'w:car', 'w:cat'];
const SIZES = [0.45, 0.65, 0.9], PER_PAGE = 8;
const Sc = { card: null, items: [], page: 0, buttons: [], clearArmed: 0 };
const available = () => [...new Set([...FREE, ...store.stickers])].filter(id => ALL_STICKERS.some(s => s.id === id));

/* ---------- materials ---------- */
const dims = () => S.L.name === 'wide' ? { w: 11.2, h: 7.9 } : { w: 11.3, h: 8.6 };
const bgMat = () => { const { w, h } = dims(); return cutShared('scenebg' + S.L.name, w, h, (ctx, P) => {
  tornRect(ctx, -w / 2, -h / 2, w, h, 0.35, 0.04, 808); paint(ctx, P, '#cfe8f3', { shadow: false });
  if (P.rim) return;
  ctx.save(); tornRect(ctx, -w / 2, -h / 2, w, h, 0.35, 0.04, 808); ctx.clip();
  const g = ctx.createLinearGradient(0, -h / 2, 0, 0); g.addColorStop(0, '#bfe0ee'); g.addColorStop(1, '#e6f3f5'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.12); for (let x = -w / 2; x <= w / 2; x += 0.3) ctx.lineTo(x, h * 0.1 + Math.sin(x * 0.9) * 0.25); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fillStyle = '#a3c266'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.26); for (let x = -w / 2; x <= w / 2; x += 0.3) ctx.lineTo(x, h * 0.25 + Math.sin(x * 0.6 + 2) * 0.2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fillStyle = '#8fb85a'; ctx.fill();
  ctx.restore();
}, { res: 60, rim: 0.1 }); };
const cutMat = id => cutShared('scut' + id, 3.0, 3.0, (ctx, P) => ALL_STICKERS.find(s => s.id === id).draw(ctx, P), { res: 90, rim: 0.1 });
const BTN = {
  prev: (ctx, P) => { ctx.beginPath(); ctx.moveTo(0.15, -0.25); ctx.lineTo(-0.2, 0); ctx.lineTo(0.15, 0.25); ctx.strokeStyle = INK; ctx.lineWidth = 0.12; ctx.stroke(); },
  next: (ctx, P) => { ctx.beginPath(); ctx.moveTo(-0.15, -0.25); ctx.lineTo(0.2, 0); ctx.lineTo(-0.15, 0.25); ctx.strokeStyle = INK; ctx.lineWidth = 0.12; ctx.stroke(); },
  bin: (ctx, P) => { rr(ctx, -0.22, -0.18, 0.44, 0.48, 0.05); ctx.fillStyle = INK; ctx.fill(); ctx.fillRect(-0.3, -0.3, 0.6, 0.08); ctx.fillRect(-0.08, -0.38, 0.16, 0.08); },
  snap: (ctx, P) => { rr(ctx, -0.32, -0.18, 0.64, 0.44, 0.08); ctx.fillStyle = INK; ctx.fill(); ctx.fillRect(-0.12, -0.28, 0.24, 0.1); ctx.beginPath(); ctx.arc(0, 0.04, 0.13, 0, Math.PI * 2); ctx.fillStyle = '#9fd8df'; ctx.fill(); },
};
const btnMat = act => cutShared('scbtn' + act, 1.3, 1.3, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.6, 0, Math.PI * 2); paint(ctx, P, act === 'bin' ? '#f9d3dc' : act === 'snap' ? '#cde6f5' : '#f2c14e');
  if (!P.rim) BTN[act](ctx, P);
}, { res: 110, rim: 0.07 });

/* ---------- scene ---------- */
function buildScene() {
  const g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1] + (S.L.name === 'wide' ? 0.05 : -0.3), 0);
  const bg = sharedMesh(bgMat()); bg.userData.kind = 'sceneBg'; g.add(bg);
  const { w, h } = dims(), sh = softShadow(w, h); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  scene.add(g);
  Sc.card = { group: g, sh, w, h };
  Sc.items = [];
  for (const it of store.scene || []) if (ALL_STICKERS.some(s => s.id === it.id)) addItem(it.id, it.x, it.y, it.s, false);
}
function removeScene() { if (!Sc.card) return; unjuice(Sc.card.group); scene.remove(Sc.card.group); disposeMesh(Sc.card.sh); Sc.card = null; Sc.items = []; }
function addItem(id, x, y, s, pop = true) {
  const j = new Juicy(sharedMesh(cutMat(id)), SIZES[s]); j.sid = id; j.size = s; j.key = 'i' + id;
  j.mesh.position.set(x, y, 0.1 + Sc.items.length * 0.004); j.mesh.userData.kind = 'sceneItem'; Sc.card.group.add(j.mesh);
  if (pop) { j.sc.v = 0.5; j.punch(0.5); }
  Sc.items.push(j); return j;
}
function persist() { store.scene = Sc.items.map(j => ({ id: j.sid, x: +j.mesh.position.x.toFixed(2), y: +j.mesh.position.y.toFixed(2), s: j.size })); save(); }
function refreshTray() {
  const ids = available(), pages = Math.max(1, Math.ceil(ids.length / PER_PAGE));
  Sc.page = (Sc.page + pages) % pages;
  setTray(ids.slice(Sc.page * PER_PAGE, Sc.page * PER_PAGE + PER_PAGE).map(id => ({
    key: 'i' + id, make: () => { const j = new Juicy(sharedMesh(cutMat(id)), 0.55); j.sid = id; j.size = 1; return j; }, trayBase: 0.55, base: 0.65,
  })), { sp: { wide: 2.05, tall: 2.12 } });
}
function buildButtons() {
  Sc.buttons.forEach(j => j.kill()); Sc.buttons = [];
  const [sx, sy] = S.L.side, tall = S.L.sideDir === 'h';
  ['prev', 'next', 'bin', 'snap'].forEach((act, i) => {
    const m = sharedMesh(btnMat(act)); m.userData.kind = 'scBtn'; m.userData.act = act;
    m.position.set(tall ? sx + (i - 1.5) * 1.9 : sx + (i % 2 ? 0.8 : -0.8), tall ? sy - 0.2 : sy + (i < 2 ? 0.9 : -0.9), 0.3);
    scene.add(m); Sc.buttons.push(new Juicy(m));
  });
}
const inside = pt => { const l = Sc.card.group.worldToLocal(pt.clone()); return Math.abs(l.x) < Sc.card.w / 2 && Math.abs(l.y) < Sc.card.h / 2; };
function onDrop(p, target) {
  if (!target || !Sc.card) { flyHome(p); if (Sc.items.includes(p)) Sc.items.splice(Sc.items.indexOf(p), 1); persist(); return; }
  const l = Sc.card.group.worldToLocal(drag.pt.clone()), { w, h } = Sc.card;
  const x = clamp(l.x, -w / 2 + 0.4, w / 2 - 0.4), y = clamp(l.y, -h / 2 + 0.4, h / 2 - 0.4);
  // a tap on an item already in the picture (no real move) changes its size
  if (p.from && Math.hypot(x - p.from.x, y - p.from.y) < 0.3) {
    Sc.card.group.attach(p.mesh); p.mesh.position.set(p.from.x, p.from.y, p.mesh.position.z > 0.5 ? 0.1 + Sc.items.length * 0.004 : p.mesh.position.z);
    p.size = (p.size + 1) % SIZES.length; p.base = SIZES[p.size]; p.sc.t = 1; p.pop(0.5); p.punch(0.4); sfx.tap(); p.from = null; p.mesh.userData.kind = 'sceneItem';
    if (!Sc.items.includes(p)) Sc.items.push(p);
    persist(); return;
  }
  const idx = Sc.items.indexOf(p); if (idx >= 0) Sc.items.splice(idx, 1);
  const size = p.size ?? 1;
  const to = Sc.card.group.localToWorld(V3(x, y, 0.1)), from = p.mesh.position.clone(), b0 = p.base;
  tween(0.12, k => { p.mesh.position.lerpVectors(from, to, k); p.base = b0 + (SIZES[size] - b0) * k; }, ease.inCubic).then(() => {
    if (!Sc.card) { p.kill(); return; }
    Sc.card.group.attach(p.mesh); p.mesh.position.set(x, y, 0.1 + Sc.items.length * 0.004); p.base = SIZES[size]; p.size = size; p.from = null;
    p.mesh.userData.kind = 'sceneItem'; p.key = 'i' + p.sid; p.sc.t = 1; p.punch(0.5); sfx.snap();
    Sc.items.push(p); persist();
    burst(to, 6, { speed: 2, up: 2.5, z: 1, size: 0.5 });
  });
}
const dragOpts = () => ({ targets: () => Sc.card ? [{ hit: inside }] : [], onDrop });
function snap() {
  const fl = document.createElement('div');
  fl.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9;pointer-events:none;opacity:.9;transition:opacity .6s';
  document.body.appendChild(fl); requestAnimationFrame(() => { fl.style.opacity = '0'; }); setTimeout(() => fl.remove(), 700);
  sfx.paper(); sfx.star(1); owlCheer();
  Sc.items.forEach((j, i) => wait(0.03 * i).then(() => j.pop(0.4)));
  note(tr('scSnap'));
}
function clearAll() {
  if (S.time - Sc.clearArmed > 3) { Sc.clearArmed = S.time; say(tr('scClearAsk')); return; }
  Sc.clearArmed = 0;
  Sc.items.forEach((j, i) => { j.sc.t = 0; j.extra = 3; wait(0.25 + i * 0.01).then(() => j.kill()); });
  Sc.items = []; persist(); sfx.whoosh(); say(tr('scCleared'));
}

export const sceneGame = {
  id: 'scene',
  levels: () => [],
  level: null,
  enter() {
    setPencil(null); buildScene(); buildButtons(); refreshTray();
    say(store.stickers.length < 3 ? `${tr('scHello')} ${tr('scMore')}` : tr('scHello'));
  },
  exit() { removeScene(); Sc.buttons.forEach(j => j.kill()); Sc.buttons = []; setTray(null); },
  setLevel() {}, adopt() {},
  relayout() {
    if (!Sc.card) return;
    removeScene(); buildScene(); buildButtons(); refreshTray();
  },
  update() {},
  pointer(o, e) {
    if (!o || !Sc.card) return;
    const k = o.userData.kind;
    if (k === 'sceneItem') {
      const j = o.userData.j; j.from = { x: j.mesh.position.x, y: j.mesh.position.y };
      scene.attach(j.mesh); j.mesh.userData.kind = null; startDrag(j, e, dragOpts());
    } else if (k === 'scBtn') {
      const j = o.userData.j, act = o.userData.act; j.punch(0.4); j.pop(0.2); sfx.tap();
      if (act === 'prev' || act === 'next') { Sc.page += act === 'next' ? 1 : -1; refreshTray(); }
      else if (act === 'bin') clearAll();
      else snap();
    }
  },
  help() { say(store.stickers.length < 3 ? `${tr('scHello')} ${tr('scMore')}` : tr('scHello')); },
  prompt: () => tr('scHello'),
  idle: () => false,
  canDrag: () => !!Sc.card,
  dragOpts,
  onLang() { say(tr('scHello')); },
};
