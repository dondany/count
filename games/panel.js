// "Let's count!" panel: two ten-frames that fill with paper dots (and can take dots away for subtraction).
import * as THREE from 'three';
import { Juicy, rand, wait, tween, ease, unjuice } from '../engine/util.js';
import { INK, SRC, cutTex, cutMesh, cutShared, paint, text, segs, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr } from '../engine/i18n.js';

export let panel = null;
let tok = 0;

function geom(dir) {
  const cs = 0.84, fw = cs * 5, fh = cs * 2;
  if (dir === 'v') {
    const w = 5.3, h = 6.6, f1 = h / 2 - 1.45;
    return { w, h, cs, fw, fh, labelY: h / 2 - 0.72, labelW: w - 0.4, captionY: -h / 2 + 0.42,
             frames: [{ cx: 0, cy: f1 - fh / 2 }, { cx: 0, cy: f1 - fh - 0.42 - fh / 2 }] };
  }
  const w = 11.0, h = 3.9;
  return { w, h, cs, fw, fh, labelY: h / 2 - 0.62, labelW: w - 0.6, captionY: -h / 2 + 0.36,
           frames: [{ cx: -(fw / 2 + 0.4), cy: -0.15 }, { cx: fw / 2 + 0.4, cy: -0.15 }] };
}
function cellPos(geo, k) {
  const f = geo.frames[Math.floor(k / 10)], idx = k % 10, row = Math.floor(idx / 5), c = idx % 5;
  return [f.cx + (c - 2) * geo.cs, f.cy + (0.5 - row) * geo.cs];
}

export function buildPanel() {
  removePanel();
  const dir = S.L.sideDir, geo = geom(dir), g = new THREE.Group();
  g.position.set(S.L.side[0], S.L.side[1], 0); g.rotation.z = dir === 'v' ? 0.015 : -0.006;
  const card = cutMesh(geo.w, geo.h, (ctx, P) => {
    tornRect(ctx, -geo.w / 2, -geo.h / 2, geo.w, geo.h, 0.3, 0.035, 99); paint(ctx, P, '#fff3dc', { shadow: false });
    for (const f of geo.frames) {
      const x = f.cx - geo.fw / 2, y = -f.cy - geo.fh / 2;
      rr(ctx, x - 0.06, y - 0.06, geo.fw + 0.12, geo.fh + 0.12, 0.12); ctx.fillStyle = '#fffdf8'; ctx.fill();
      ctx.lineWidth = 0.06; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath();
      for (let c = 1; c < 5; c++) { ctx.moveTo(x + c * geo.cs, y); ctx.lineTo(x + c * geo.cs, y + geo.fh); }
      ctx.moveTo(x, y + geo.cs); ctx.lineTo(x + geo.fw, y + geo.cs);
      ctx.lineWidth = 0.03; ctx.strokeStyle = 'rgba(74,52,38,0.35)'; ctx.stroke();
    }
    text(ctx, P, tr('countTap'), 0, -geo.captionY, 0.3, '#9a7a62', { weight: 600, shadow: false, maxW: geo.w - 0.6 });
  }, { res: 80, rim: 0, pad: 0.05 });
  card.userData.kind = 'panel'; g.add(card);
  const sh = softShadow(geo.w, geo.h); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  const lt = cutTex(geo.labelW, 0.8, () => {}, { res: 110, rim: 0, pad: 0.02 });
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(lt.W, lt.H), new THREE.MeshStandardMaterial({ map: lt.tex, transparent: true, roughness: 1, depthWrite: false }));
  lm.position.set(0, geo.labelY, 0.05); g.add(lm);
  const f0 = geo.frames[0];
  const ring = cutMesh(geo.fw + 0.3, geo.fh + 0.3, (ctx) => { rr(ctx, -geo.fw / 2 - 0.1, -geo.fh / 2 - 0.1, geo.fw + 0.2, geo.fh + 0.2, 0.2); ctx.lineWidth = 0.14; ctx.strokeStyle = '#ffc93c'; ctx.stroke(); }, { res: 80, rim: 0, pad: 0.05 });
  ring.position.set(f0.cx, f0.cy, 0.08); ring.visible = false; g.add(ring);
  scene.add(g);
  panel = { group: g, geo, card: new Juicy(card), label: lt, dots: [], ring: new Juicy(ring), disposables: [card, sh, lm, ring] };
  setPanelLabel(null);
}
export function removePanel() {
  if (!panel) return;
  tok++; unjuice(panel.group); scene.remove(panel.group);
  panel.disposables.forEach(disposeMesh); panel = null;
}
export function setPanelLabel(list) {
  if (!panel) return;
  const p = panel;
  p.label.redraw((ctx, P) => segs(ctx, P, list || [{ t: tr('countTitle'), c: INK }], 0, 0, 0.58, p.geo.labelW - 0.2));
}
export function panelPunch(a = 0.3) { if (panel) panel.card.punch(a); }
const dotMat = src => cutShared('dot' + src, 0.56, 0.56, (ctx, P) => { ctx.beginPath(); ctx.arc(0, 0, 0.28, 0, Math.PI * 2); paint(ctx, P, SRC[src]); }, { res: 120, rim: 0.05 });
function addDot(k, src) {
  const p = panel, [x, y] = cellPos(p.geo, k), dm = dotMat(src);
  const m = new THREE.Mesh(dm.geo, dm.mat); m.castShadow = true; m.position.set(x, y, 0.12); p.group.add(m);
  const j = new Juicy(m); j.sc.v = 0; j.sc.t = 1; j.pop(0.4); j.rot.t = rand(-0.4, 0.4); p.dots.push(j);
}
export function clearDots() {
  tok++;
  if (!panel) return;
  for (const j of panel.dots) { j.sc.t = 0; wait(0.25).then(() => j.kill()); }
  panel.dots = []; panel.ring.mesh.visible = false;
}
function ringPop() { const r = panel.ring; r.mesh.visible = true; r.sc.v = 0.6; r.sc.t = 1; r.pop(0.5); sfx.ten(); panel.card.punch(0.25); }
const eq = (list, op = ' + ') => list.flatMap((p, i) => (i ? [{ t: op, c: INK }] : []).concat([{ t: String(p.n), c: SRC[p.src] }]));

// adding: parts = [{ n, src: 'carry'|'a'|'b', tile? }] -> dots appear one by one, counting up
export async function countUp(parts) {
  if (!panel) return;
  clearDots(); const my = tok;
  panel.card.punch(0.15);
  let k = 0; const shown = [];
  for (const p of parts) {
    shown.push(p);
    if (p.tile) { p.tile.punch(0.5); p.tile.pop(0.3); }
    setPanelLabel(eq(shown).concat([{ t: ` → ${k}`, c: '#9a7a62' }]));
    for (let j = 0; j < p.n; j++) {
      await wait(0.16); if (my !== tok || !panel) return;
      addDot(k, p.src); sfx.dot(k); k++;
      setPanelLabel(eq(shown).concat([{ t: ` → ${k}`, c: '#9a7a62' }]));
      if (k === 10) ringPop();
    }
    await wait(0.14); if (my !== tok || !panel) return;
  }
  setPanelLabel(eq(parts).concat([{ t: ' = ', c: INK }, { t: String(k), c: INK }]));
  panel.card.punch(0.2);
}

// taking away: show `top` dots, then `take` of them fly away
export async function countDown(top, take, topTile, takeTile) {
  if (!panel) return;
  clearDots(); const my = tok;
  panel.card.punch(0.15);
  const head = n => [{ t: String(top), c: SRC.a }, { t: ' − ', c: INK }, { t: String(take), c: SRC.b }, { t: ` → ${n}`, c: '#9a7a62' }];
  if (topTile) { topTile.punch(0.5); topTile.pop(0.3); }
  setPanelLabel([{ t: String(top), c: SRC.a }]);
  for (let k = 0; k < top; k++) {
    await wait(0.12); if (my !== tok || !panel) return;
    addDot(k, 'a'); sfx.dot(k);
    setPanelLabel([{ t: String(k + 1), c: SRC.a }]);
    if (k === 9) ringPop();
  }
  await wait(0.35); if (my !== tok || !panel) return;
  if (takeTile) { takeTile.punch(0.5); takeTile.pop(0.3); }
  let left = top;
  for (let j = 0; j < take; j++) {
    await wait(0.2); if (my !== tok || !panel) return;
    const d = panel.dots.pop(); left--;
    if (d) {
      const from = d.mesh.position.clone();
      d.rot.t = rand(-2, 2); d.sc.t = 0.2;
      tween(0.4, k => { d.mesh.position.set(from.x + k * 0.8, from.y + k * 1.4, from.z + k * 0.8); }, ease.inCubic).then(() => d.kill());
    }
    sfx.undot(left);
    if (left === 9) panel.ring.mesh.visible = false;
    setPanelLabel(head(left));
  }
  setPanelLabel(head(left).slice(0, 3).concat([{ t: ' = ', c: INK }, { t: String(left), c: INK }]));
  panel.card.punch(0.2);
}
