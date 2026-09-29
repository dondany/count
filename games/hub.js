// The home screen: paper activity cards on the hills. Locked cards show what's coming next.
import * as THREE from 'three';
import { rand, Juicy, wait, unjuice } from '../engine/util.js';
import { INK, DIGIT_COLORS, cutMesh, paint, text, rr, tornRect, starPath, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr } from '../engine/i18n.js';
import { store } from '../engine/store.js';
import { say, owlTilt } from '../engine/pip.js';
import { setTray } from '../engine/tray.js';
import { setPencil } from '../engine/pencil.js';
import { ANIMALS } from './pictures.js';
import { ALL_STICKERS } from './stickers.js';

const CW = 4.2, CH = 5.6;
const big = (ctx, P, s, x, c) => text(ctx, P, s, x, 0.1, 1.55, c);
const CARDS = [
  { id: 'sums', name: 'gSums', bg: '#fde2c8', draw: (ctx, P) => { big(ctx, P, '3', -1.0, DIGIT_COLORS[3]); big(ctx, P, '+', 0, '#e8574a'); big(ctx, P, '4', 1.0, DIGIT_COLORS[4]); } },
  { id: 'minus', name: 'gMinus', bg: '#d8ecc4', draw: (ctx, P) => { big(ctx, P, '9', -1.0, DIGIT_COLORS[9]); big(ctx, P, '−', 0, '#e8574a'); big(ctx, P, '5', 1.0, DIGIT_COLORS[5]); } },
  { id: 'blocks', name: 'gBlocks', bg: '#cde6f5', draw: (ctx, P) => {
    for (const x of [-1.25, -0.85]) {
      rr(ctx, x, -1.15, 0.32, 2.3, 0.05); paint(ctx, P, '#2f9e97');
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.025; ctx.beginPath();
      for (let k = 1; k < 10; k++) { ctx.moveTo(x, -1.15 + k * 0.23); ctx.lineTo(x + 0.32, -1.15 + k * 0.23); } ctx.stroke();
    }
    for (let k = 0; k < 4; k++) { rr(ctx, -0.3 + (k % 2) * 0.38, 0.35 + Math.floor(k / 2) * 0.38, 0.32, 0.32, 0.05); paint(ctx, P, '#f2c14e'); }
    rr(ctx, 0.45, -1.15, 1.1, 1.1, 0.06); paint(ctx, P, '#e8574a');
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 0.02; ctx.beginPath();
    for (let k = 1; k < 10; k++) { ctx.moveTo(0.45, -1.15 + k * 0.11); ctx.lineTo(1.55, -1.15 + k * 0.11); ctx.moveTo(0.45 + k * 0.11, -1.15); ctx.lineTo(0.45 + k * 0.11, -0.05); } ctx.stroke();
  } },
  { id: 'clock', name: 'gClock', bg: '#e4d9f6', draw: (ctx, P) => {
    ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); paint(ctx, P, '#fffdf8'); ctx.lineWidth = 0.1; ctx.strokeStyle = INK; ctx.stroke();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.95, Math.sin(a) * 0.95); ctx.lineTo(Math.cos(a) * 1.08, Math.sin(a) * 1.08); ctx.lineWidth = 0.06; ctx.stroke(); }
    ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.85); ctx.stroke();
    ctx.strokeStyle = '#e8574a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.55, 0.2); ctx.stroke();
  } },
  { id: 'frac', name: 'gFrac', bg: '#f9d3dc', draw: (ctx, P) => {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1.2, -Math.PI / 2 + Math.PI / 2, -Math.PI / 2 + Math.PI * 2); ctx.closePath(); paint(ctx, P, '#f2c14e');
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1.0, 0, Math.PI * 1.5); ctx.closePath(); ctx.fillStyle = '#e8574a'; ctx.fill();
    ctx.fillStyle = '#b8433a'; for (const [x, y] of [[-0.5, 0.3], [0.3, 0.5], [-0.3, -0.5], [0.55, 0.05], [-0.6, -0.1]]) { ctx.beginPath(); ctx.arc(x, y, 0.13, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.lineTo(1.2, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 1.2); ctx.stroke();
  } },
  { id: 'flags', name: 'gFlags', bg: '#d8ecc4', draw: (ctx, P) => {
    ctx.beginPath(); ctx.arc(-0.2, 0.1, 1.15, 0, Math.PI * 2); paint(ctx, P, '#8ec9dd');
    ctx.save(); ctx.beginPath(); ctx.arc(-0.2, 0.1, 1.15, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#8fb85a';
    for (const [x, y, rx, ry, r] of [[-0.8, -0.3, 0.45, 0.6, 0.4], [0.1, -0.5, 0.5, 0.3, -0.2], [0.35, 0.5, 0.35, 0.5, 0.3], [-0.7, 0.8, 0.3, 0.2, 0]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0.9, -1.25, 0.07, 1.5);
    ctx.beginPath(); ctx.rect(0.97, -1.25, 0.7, 0.24); paint(ctx, P, '#ffffff'); ctx.beginPath(); ctx.rect(0.97, -1.01, 0.7, 0.24); paint(ctx, P, '#dc143c');
  } },
  { id: 'words', name: 'gWords', bg: '#f9e3b4', draw: (ctx, P) => {
    [['A', -1.0, '#e8574a', -0.15], ['B', 0, '#3f7fc1', 0.1], ['C', 1.0, '#6fae52', -0.05]].forEach(([ch, x, col, r]) => {
      ctx.save(); ctx.translate(x, 0.1); ctx.rotate(r); rr(ctx, -0.45, -0.55, 0.9, 1.1, 0.12); paint(ctx, P, '#fffaf0'); text(ctx, P, ch, 0, 0, 0.8, col); ctx.restore();
    });
  } },
  { id: 'animals', name: 'gAnimals', bg: '#cde6f5', draw: (ctx, P) => { ctx.save(); ctx.scale(0.85, 0.85); ANIMALS.find(a => a.id === 'panda').draw(ctx, P); ctx.restore(); } },
  { id: 'stickers', name: 'gStickers', bg: '#f9d3dc', stat: () => `${store.stickers.length} / ${ALL_STICKERS.length}`, draw: (ctx, P) => {
    for (const [x, y, id, r] of [[-0.75, -0.3, 'a:koala', -0.2], [0.7, -0.35, 'w:sun', 0.15], [0, 0.5, 'a:lion', 0.05]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.arc(0, 0, 0.62, 0, Math.PI * 2); paint(ctx, P, '#fffdf8');
      ctx.scale(0.38, 0.38); ALL_STICKERS.find(s => s.id === id).draw(ctx, P); ctx.restore();
    }
  } },
];

let H = null;
function drawCard(c) {
  return (ctx, P) => {
    tornRect(ctx, -CW / 2, -CH / 2, CW, CH, 0.35, 0.035, c.id.length * 13); paint(ctx, P, c.bg);
    if (P.rim) return;
    rr(ctx, -1.8, -2.45, 3.6, 3.05, 0.3); ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.save(); ctx.translate(0, -0.95); c.draw(ctx, P); ctx.restore();
    if (c.locked) {
      rr(ctx, -1.8, -2.45, 3.6, 3.05, 0.3); ctx.fillStyle = 'rgba(255,250,240,0.55)'; ctx.fill();
      ctx.lineWidth = 0.14; ctx.strokeStyle = '#7a5d49'; ctx.beginPath(); ctx.arc(0, -1.05, 0.34, Math.PI, 0); ctx.stroke();
      rr(ctx, -0.5, -1.05, 1.0, 0.8, 0.12); paint(ctx, P, '#c9a13c');
      ctx.beginPath(); ctx.arc(0, -0.7, 0.1, 0, 7); ctx.fillStyle = INK; ctx.fill();
    }
    text(ctx, P, tr(c.name), 0, 1.2, 0.52, INK, { maxW: CW - 0.5 });
    if (c.locked) text(ctx, P, tr('soon'), 0, 2.05, 0.4, '#9a7a62', { weight: 600, shadow: false });
    else {
      ctx.save(); ctx.translate(-0.45, 2.02); starPath(ctx, 5, 0.3, 0.14); paint(ctx, P, '#f2c14e'); ctx.restore();
      text(ctx, P, c.stat ? c.stat() : String(store.stars[c.id] || 0), c.stat ? 0.5 : 0.3, 2.05, 0.46, INK, { weight: 700 });
    }
  };
}
// [x, y, scale]: a 5×2 grid on wide screens, 3×3 on phones
function positions() {
  if (S.L.name === 'wide') return CARDS.map((c, i) => [((i % 5) - 2) * 3.35 + 0.9, 1.95 - Math.floor(i / 5) * 4.5, 0.72]);
  return CARDS.map((c, i) => [((i % 3) - 1) * 3.8, 5.4 - Math.floor(i / 3) * 5.05, 0.84]);
}
function build() {
  destroy();
  const g = new THREE.Group(); const pos = positions(); const cards = [];
  CARDS.forEach((c, i) => {
    const cg = new THREE.Group(); cg.position.set(pos[i][0], pos[i][1], 0); cg.scale.setScalar(pos[i][2]); cg.rotation.z = rand(-0.03, 0.03);
    const m = cutMesh(CW, CH, drawCard(c), { res: 90, rim: 0.12 }); m.userData.kind = 'hubCard'; m.userData.id = c.id;
    const sh = softShadow(CW, CH); sh.position.set(0.3, -0.4, -0.3);
    cg.add(sh, m); g.add(cg);
    const j = new Juicy(m); j.sc.v = 0.0001; j.sc.t = 0.0001;
    cards.push({ c, g: cg, j, m, sh, y: pos[i][1], ph: rand(0, 6) });
  });
  scene.add(g);
  H = { group: g, cards };
  cards.forEach((k, i) => wait(0.08 * i).then(() => { if (H && H.cards.includes(k)) { k.j.sc.t = 1; k.j.punch(0.3); sfx.tap(); } }));
}
function destroy() {
  if (!H) return;
  unjuice(H.group); scene.remove(H.group);
  H.cards.forEach(k => { disposeMesh(k.m); disposeMesh(k.sh); });
  H = null;
}

export const hub = {
  id: 'hub', level: null, levels: () => null,
  onPick: null,
  enter() { setTray(null); setPencil(null); build(); say(tr('hubHello')); },
  exit() { destroy(); },
  relayout() { if (!H) return; const pos = positions(); H.cards.forEach((k, i) => { k.g.position.x = pos[i][0]; k.y = pos[i][1]; k.g.scale.setScalar(pos[i][2]); }); },
  update(dt, t) { if (H) for (const k of H.cards) k.g.position.y = k.y + Math.sin(t * 1.4 + k.ph) * 0.08; },
  pointer(o) {
    if (!o || o.userData.kind !== 'hubCard') return;
    const k = H.cards.find(x => x.m === o); if (!k) return;
    k.j.punch(0.5); k.j.pop(0.3);
    if (k.c.locked) { sfx.bad(); owlTilt(); k.j.rot.vel += 5; say(tr('hubLocked')); return; }
    sfx.good(3); if (hub.onPick) hub.onPick(k.c.id);
  },
  help() {}, prompt: () => tr('hubHello'), idle: () => false, canDrag: () => false, dragOpts: () => null,
  onLang() { build(); say(tr('hubHello')); },
};
