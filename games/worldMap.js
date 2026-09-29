// The paper world map shared by Flags and Animals: sea card, continents (hover-able drop targets), labels, pins.
import * as THREE from 'three';
import { Juicy, unjuice } from '../engine/util.js';
import { INK, cutShared, sharedMesh, paint, text, rr, tornRect, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S } from '../engine/core.js';
import { lang, contName } from '../engine/i18n.js';
import { CONTINENTS, pointInPoly } from './flagsData.js';

export const MW = 11.0, MH = 5.2, LON0 = -170, LON1 = 180, LAT0 = -50, LAT1 = 82;
export const toMap = (lon, lat) => [(lon - LON0) / (LON1 - LON0) * MW - MW / 2, (lat - LAT0) / (LAT1 - LAT0) * MH - MH / 2];
export const fromMap = (x, y) => [(x + MW / 2) / MW * (LON1 - LON0) + LON0, (y + MH / 2) / MH * (LAT1 - LAT0) + LAT0];
const seaMat = () => cutShared('sea', MW + 0.8, MH + 0.8, (ctx, P) => {
  const w = MW + 0.8, h = MH + 0.8;
  tornRect(ctx, -w / 2, -h / 2, w, h, 0.35, 0.04, 90); paint(ctx, P, '#bfe0ee', { shadow: false });
  if (P.rim) return;
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.035;
  for (let i = 0; i < 26; i++) {
    const x = ((i * 37) % 100) / 100 * (w - 1) - w / 2 + 0.5, y = ((i * 61) % 100) / 100 * (h - 1) - h / 2 + 0.5;
    ctx.beginPath(); ctx.arc(x, y, 0.16, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(x + 0.3, y, 0.16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
}, { res: 70, rim: 0.1 });
function contBox(i) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const poly of CONTINENTS[i].polys) for (const [lon, lat] of poly) { const [x, y] = toMap(lon, lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
const contMat = i => cutShared('cont' + i,contBox(i).w, contBox(i).h, (ctx, P) => {
  const b = contBox(i), C = CONTINENTS[i];
  for (const poly of C.polys) {
    ctx.beginPath();
    poly.forEach(([lon, lat], k) => { const [x, y] = toMap(lon, lat); k ? ctx.lineTo(x - b.cx, -(y - b.cy)) : ctx.moveTo(x - b.cx, -(y - b.cy)); });
    ctx.closePath(); paint(ctx, P, C.color, { shadow: false });
  }
}, { res: 110, rim: 0.05 });
// continent names float above the map (drawn inside the continent they'd get clipped at its edges)
const labelMat = i => cutShared('clab' + i + lang, 3.4, 0.5, (ctx, P) => {
  text(ctx, P, contName(i), 0, 0, 0.28, '#5b4332', { weight: 600, shadow: false, maxW: 3.3 });
}, { res: 120, rim: 0, pad: 0.02 });
export const pinMat = () => cutShared('pin', 0.46, 0.46, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.2, 0, Math.PI * 2); paint(ctx, P, '#e8574a');
  if (!P.rim) { ctx.beginPath(); ctx.arc(-0.06, -0.06, 0.06, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill(); }
}, { res: 140, rim: 0.05 });
export const poleMat = () => cutShared('pole', 0.07, 0.95, (ctx, P) => { rr(ctx, -0.035, -0.475, 0.07, 0.95, 0.03); paint(ctx, P, '#8a5a3b'); }, { res: 140, rim: 0.03 });
export const tagMat = label => cutShared('ftag' + label, 0.32 + label.length * 0.2, 0.5, (ctx, P) => {
  const w = 0.32 + label.length * 0.2;
  rr(ctx, -w / 2, -0.25, w, 0.5, 0.12); paint(ctx, P, '#fffaf0');
  if (!P.rim) text(ctx, P, label, 0, 0, 0.3, INK, { maxW: w - 0.14 });
}, { res: 120, rim: 0.05 });

/* ---------- the map ---------- */
export function buildMap() {
  const g = new THREE.Group(); g.position.set(S.L.main[0], S.L.main[1] + 0.3, 0);
  const sea = sharedMesh(seaMat()); g.add(sea);
  const sh = softShadow(MW + 0.8, MH + 0.8); sh.position.set(0.3, -0.4, -0.35); g.add(sh);
  const conts = CONTINENTS.map((C, i) => {
    const b = contBox(i), m = sharedMesh(contMat(i)); m.position.set(b.cx, b.cy, 0.05 + i * 0.002); m.userData.kind = 'continent'; g.add(m);
    return new Juicy(m);
  });
  const labels = CONTINENTS.map((C, i) => {
    const [x, y] = toMap(...C.label), m = sharedMesh(labelMat(i), false); m.position.set(x, y, 0.15); g.add(m); return m;
  });
  const targets = conts.map((j, i) => ({
    cont: i, j, hit: pt => {
      const l = g.worldToLocal(pt.clone()); const [lon, lat] = fromMap(l.x, l.y);
      // a little forgiving: also count drops a few degrees off the coast
      return [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => CONTINENTS[i].polys.some(p => pointInPoly(lon + dx, lat + dy, p)));
    },
  }));
  scene.add(g);
  return { group: g, sh, conts, targets, labels };
}
export function disposeMap(m) { if (!m) return; unjuice(m.group); scene.remove(m.group); disposeMesh(m.sh); }
// after a language switch
export function relabelMap(m) { if (m) m.labels.forEach((mesh, i) => { mesh.material = labelMat(i).mat; }); }
