// A paper map of Europe with every country as its own cut-out. Found countries get painted with their flag.
import * as THREE from 'three';
import { Juicy, unjuice } from '../engine/util.js';
import { cutTex, cutShared, sharedMesh, paperMat, paint, rr, softShadow, disposeMesh } from '../engine/paper.js';
import { scene } from '../engine/core.js';
import { EU_BOX, EU_COUNTRIES, EU_SCENERY } from './europeData.js';
import { COUNTRIES, FLAGS, pointInPoly } from './flagsData.js';

// names and capitals for every European country (countries already in the world game reuse their entries)
const EXTRA = {
  AL: ['Albania', 'Albania', 'Tirana', 'Tirana'], AD: ['Andorra', 'Andora', 'Andorra la Vella', 'Andora'], BY: ['Belarus', 'Białoruś', 'Minsk', 'Mińsk'],
  BA: ['Bosnia and Herzegovina', 'Bośnia i Hercegowina', 'Sarajevo', 'Sarajewo'], BG: ['Bulgaria', 'Bułgaria', 'Sofia', 'Sofia'],
  HR: ['Croatia', 'Chorwacja', 'Zagreb', 'Zagrzeb'], CY: ['Cyprus', 'Cypr', 'Nicosia', 'Nikozja'], EE: ['Estonia', 'Estonia', 'Tallinn', 'Tallinn'],
  GR: ['Greece', 'Grecja', 'Athens', 'Ateny'], IS: ['Iceland', 'Islandia', 'Reykjavík', 'Reykjavík'], XK: ['Kosovo', 'Kosowo', 'Pristina', 'Prisztina'],
  LV: ['Latvia', 'Łotwa', 'Riga', 'Ryga'], LI: ['Liechtenstein', 'Liechtenstein', 'Vaduz', 'Vaduz'], LU: ['Luxembourg', 'Luksemburg', 'Luxembourg', 'Luksemburg'],
  MT: ['Malta', 'Malta', 'Valletta', 'La Valletta'], MD: ['Moldova', 'Mołdawia', 'Chișinău', 'Kiszyniów'], MC: ['Monaco', 'Monako', 'Monaco', 'Monako'],
  ME: ['Montenegro', 'Czarnogóra', 'Podgorica', 'Podgorica'], MK: ['North Macedonia', 'Macedonia Północna', 'Skopje', 'Skopje'],
  PT: ['Portugal', 'Portugalia', 'Lisbon', 'Lizbona'], RU: ['Russia', 'Rosja', 'Moscow', 'Moskwa'], SM: ['San Marino', 'San Marino', 'San Marino', 'San Marino'],
  RS: ['Serbia', 'Serbia', 'Belgrade', 'Belgrad'], SK: ['Slovakia', 'Słowacja', 'Bratislava', 'Bratysława'], SI: ['Slovenia', 'Słowenia', 'Ljubljana', 'Lublana'],
  VA: ['Vatican City', 'Watykan', 'Vatican City', 'Watykan'],
};
export const EU_INFO = Object.fromEntries(EU_COUNTRIES.map(c => {
  const w = COUNTRIES.find(x => x.id === c.id), e = EXTRA[c.id];
  return [c.id, w ? { id: c.id, name: w.name, capital: w.capital } : { id: c.id, name: { en: e[0], pl: e[1] }, capital: { en: e[2], pl: e[3] } }];
}));
export const EU_IDS = EU_COUNTRIES.map(c => c.id);

// projection: equirectangular, squashed east-west for latitude ~52°
const S = 0.22, K = Math.cos(52 * Math.PI / 180), LONC = (EU_BOX.lon0 + EU_BOX.lon1) / 2, LATC = (EU_BOX.lat0 + EU_BOX.lat1) / 2;
export const MAP_W = (EU_BOX.lon1 - EU_BOX.lon0) * K * S, MAP_H = (EU_BOX.lat1 - EU_BOX.lat0) * S;
const proj = (lon, lat) => [(lon - LONC) * K * S, (lat - LATC) * S];
const ring = flat => { const out = []; for (let i = 0; i < flat.length; i += 2) out.push(proj(flat[i], flat[i + 1])); return out; };
const LABEL_FIX = { RU: [38, 56.5], NO: [9.5, 61.5], IT: [12.6, 42.9], GR: [22, 39.4], HR: [16.2, 45.3] };
const TINY = 0.4; // countries smaller than this (deg²) are drawn as a round marker too
const PALETTE = ['#f4b8a8', '#b9d98f', '#f7d77e', '#a9d2e8', '#d7bde8', '#f2c49a'];

const GEO = EU_COUNTRIES.map(c => {
  const polys = c.polys.map(ring), pts = polys.flat();
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  return { id: c.id, polys, box, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, label: proj(...(LABEL_FIX[c.id] || c.label)), tiny: c.area < TINY, area: c.area };
});
// greedy colouring so neighbours get different paper colours
(() => {
  const near = (a, b) => {
    if (a.box.x1 < b.box.x0 - 0.1 || b.box.x1 < a.box.x0 - 0.1 || a.box.y1 < b.box.y0 - 0.1 || b.box.y1 < a.box.y0 - 0.1) return false;
    const pa = a.polys.flat(), pb = b.polys.flat();
    for (let i = 0; i < pa.length; i += 2) for (let j = 0; j < pb.length; j += 2) if (Math.abs(pa[i][0] - pb[j][0]) + Math.abs(pa[i][1] - pb[j][1]) < 0.08) return true;
    return false;
  };
  const order = GEO.slice().sort((a, b) => b.area - a.area);
  for (const g of order) {
    const used = new Set(GEO.filter(o => o.color && near(g, o)).map(o => o.color));
    g.color = PALETTE.find(c => !used.has(c)) || PALETTE[0];
  }
})();
export const geo = id => GEO.find(g => g.id === id);

function drawShape(ctx, g, P, fill) {
  for (const poly of g.polys) {
    ctx.beginPath(); poly.forEach(([x, y], i) => i ? ctx.lineTo(x - g.cx, -(y - g.cy)) : ctx.moveTo(x - g.cx, -(y - g.cy))); ctx.closePath();
    paint(ctx, P, fill, { shadow: false });
  }
}
const countryMat = g => cutShared('eu' + g.id, g.box.x1 - g.box.x0 + 0.02, g.box.y1 - g.box.y0 + 0.02, (ctx, P) => drawShape(ctx, g, P, g.color), { res: 150, rim: 0.018 });
// the country filled with its own flag
const paintedMat = g => cutShared('eup' + g.id, g.box.x1 - g.box.x0 + 0.02, g.box.y1 - g.box.y0 + 0.02, (ctx, P) => {
  if (P.rim) { drawShape(ctx, g, P); return; }
  ctx.save(); ctx.beginPath();
  for (const poly of g.polys) { poly.forEach(([x, y], i) => i ? ctx.lineTo(x - g.cx, -(y - g.cy)) : ctx.moveTo(x - g.cx, -(y - g.cy))); ctx.closePath(); }
  ctx.clip();
  // stretch the flag over the country's box so every stripe shows (a 3:2 fit would crop France to its white middle)
  const w = g.box.x1 - g.box.x0 + 0.04, h = g.box.y1 - g.box.y0 + 0.04;
  ctx.scale(w / 1.8, h / 1.2); FLAGS[g.id](ctx, 1.8, 1.2);
  ctx.restore();
}, { res: 150, rim: 0.018 });
const markerMat = (g, painted) => cutShared('eum' + g.id + painted, 0.4, 0.4, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, Math.PI * 2);
  if (P.rim || !painted) { paint(ctx, P, g.color); if (!P.rim) { ctx.lineWidth = 0.025; ctx.strokeStyle = 'rgba(74,52,38,.5)'; ctx.stroke(); } return; }
  ctx.save(); ctx.clip(); ctx.scale(0.4 / 1.2, 0.4 / 1.2); FLAGS[g.id](ctx, 1.8, 1.2); ctx.restore();
}, { res: 160, rim: 0.03 });
const glowMat = () => cutShared('euglow', 1.2, 1.2, (ctx) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2); ctx.lineWidth = 0.09; ctx.strokeStyle = '#f2c14e'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,222,110,.25)'; ctx.fill();
}, { res: 110, rim: 0, pad: 0.04 });

// The map sits in a paper window: E.root is the window (placed by the game), E.group is the zoomable map inside it.
// Everything in the map is clipped to the window, so zooming never spills over the rest of the screen.
const WIN_W = MAP_W + 0.5, WIN_H = MAP_H + 0.5, MAX_ZOOM = 4;
const zoomBtnMat = d => cutShared('euzoom' + d, 1.1, 1.1, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2); paint(ctx, P, '#fffaf0');
  if (P.rim) return;
  ctx.lineWidth = 0.05; ctx.strokeStyle = '#4a3426'; ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.05, -0.05, 0.22, 0, Math.PI * 2); ctx.lineWidth = 0.07; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.11, 0.11); ctx.lineTo(0.28, 0.28); ctx.lineWidth = 0.1; ctx.stroke();
  ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(-0.15, -0.05); ctx.lineTo(0.05, -0.05); if (d > 0) { ctx.moveTo(-0.05, -0.15); ctx.lineTo(-0.05, 0.05); } ctx.stroke();
}, { res: 120, rim: 0.06 });
const frameMat = () => cutShared('euframe', WIN_W + 0.3, WIN_H + 0.3, (ctx) => {
  rr(ctx, -WIN_W / 2 - 0.06, -WIN_H / 2 - 0.06, WIN_W + 0.12, WIN_H + 0.12, 0.22); ctx.lineWidth = 0.16; ctx.strokeStyle = '#fffaf0'; ctx.stroke();
  rr(ctx, -WIN_W / 2 - 0.13, -WIN_H / 2 - 0.13, WIN_W + 0.26, WIN_H + 0.26, 0.26); ctx.lineWidth = 0.025; ctx.strokeStyle = 'rgba(122,93,73,.45)'; ctx.stroke();
}, { res: 70, rim: 0, pad: 0.05 });

export function buildEurope() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const sea = cutMesh2(WIN_W, WIN_H, (ctx, P) => {
    const w = WIN_W, h = WIN_H;
    rr(ctx, -w / 2, -h / 2, w, h, 0.2); paint(ctx, P, '#bfe0ee', { shadow: false });
    if (P.rim) return;
    ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, 0.2); ctx.clip();
    for (const r of EU_SCENERY) { ctx.beginPath(); ring(r).forEach(([x, y], i) => i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y)); ctx.closePath(); ctx.fillStyle = '#e9dcc4'; ctx.fill(); }
    ctx.restore();
  });
  sea.userData.kind = 'euSea'; g.add(sea);
  const sh = softShadow(WIN_W, WIN_H); sh.position.set(0.3, -0.4, -0.35); root.add(sh);
  const frame = sharedMesh(frameMat(), false); frame.position.z = 0.5; root.add(frame);
  const countries = {};
  GEO.forEach((c, i) => {
    const m = sharedMesh(countryMat(c), false); m.position.set(c.cx, c.cy, 0.04 + (c.tiny ? 0.02 : 0) + i * 0.0002);
    m.userData.kind = 'euCountry'; m.userData.id = c.id; g.add(m);
    let marker = null;
    if (c.tiny) { marker = new Juicy(sharedMesh(markerMat(c, false))); marker.mesh.position.set(c.label[0], c.label[1], 0.2); marker.mesh.userData = { kind: 'euCountry', id: c.id, j: marker }; g.add(marker.mesh); }
    countries[c.id] = { g: c, mesh: m, j: new Juicy(m), marker, painted: null };
  });
  const glow = new Juicy(sharedMesh(glowMat(), false)); glow.sc.v = glow.sc.t = 0.0001; glow.mesh.position.z = 0.3; g.add(glow.mesh);
  const zoomBtns = [1, -1].map((d, i) => {
    const b = new Juicy(sharedMesh(zoomBtnMat(d), false)); b.mesh.position.set(-WIN_W / 2 + 0.6, WIN_H / 2 - 0.6 - i * 1.1, 0.6);
    b.mesh.userData = { kind: 'euZoom', dir: d, j: b }; root.add(b.mesh); return b;
  });
  scene.add(root);
  const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  const E = { root, group: g, sea, sh, countries, glow, glowFor: null, planes, zoomBtns, z: 1, v: new THREE.Vector2(), zc: 1, vc: new THREE.Vector2() };
  g.traverse(o => clipped(E, o));
  return E;
}
function clipped(E, o) { if (o.material) { o.material.clippingPlanes = E.planes; o.material.clipShadows = true; } }
function cutMesh2(w, h, draw) {
  const t = cutTex(w, h, draw, { res: 60, rim: 0.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(t.W, t.H), paperMat(t.tex)); m.castShadow = m.receiveShadow = true; return m;
}
export function disposeEurope(E) {
  if (!E) return; unjuice(E.root); scene.remove(E.root); disposeMesh(E.sea); disposeMesh(E.sh);
}
// is a world point inside the map window?
export function inWindow(E, pt) {
  const l = E.root.worldToLocal(pt.clone()); return Math.abs(l.x) < WIN_W / 2 && Math.abs(l.y) < WIN_H / 2;
}
const clampView = E => {
  const mx = WIN_W / 2 * (1 - 1 / E.z), my = WIN_H / 2 * (1 - 1 / E.z);
  E.v.x = Math.max(-mx, Math.min(mx, E.v.x)); E.v.y = Math.max(-my, Math.min(my, E.v.y));
};
// zoom to z, keeping map point `at` (map-local) where it is on screen (or centring on it with centre = true)
export function zoomTo(E, z, at = null, centre = false) {
  z = Math.max(1, Math.min(MAX_ZOOM, z));
  if (at && centre) E.v.set(at.x, at.y);
  else if (at) E.v.set(at.x - (at.x - E.v.x) * E.z / z, at.y - (at.y - E.v.y) * E.z / z);
  E.z = z; clampView(E);
}
export const zoomLevel = E => E.z;
// pan by a world-space delta
export function panBy(E, dx, dy) { const s = E.root.scale.x * E.z; E.v.x -= dx / s; E.v.y -= dy / s; clampView(E); }
export function updateEurope(E, dt) {
  const k = 1 - Math.exp(-dt * 10);
  E.zc += (E.z - E.zc) * k; E.vc.lerp(E.v, k);
  E.group.scale.setScalar(E.zc); E.group.position.set(-E.vc.x * E.zc, -E.vc.y * E.zc, 0);
  // keep the micro-state markers from ballooning when zoomed in
  for (const c of Object.values(E.countries)) if (c.marker) c.marker.base = 1 / Math.sqrt(E.zc);
  // clip to the window, in world space
  E.root.updateMatrixWorld();
  const a = E.root.localToWorld(new THREE.Vector3(-WIN_W / 2, -WIN_H / 2, 0)), b = E.root.localToWorld(new THREE.Vector3(WIN_W / 2, WIN_H / 2, 0));
  E.planes[0].constant = -a.x; E.planes[1].constant = b.x; E.planes[2].constant = -a.y; E.planes[3].constant = b.y;
  E.zoomBtns[0].sc.t = E.z < MAX_ZOOM ? 1 : 0.7; E.zoomBtns[1].sc.t = E.z > 1 ? 1 : 0.7;
}
const HOV = new THREE.Color('#ffe9a0'), PLAIN = new THREE.Color('#ffffff');
// warm highlight of the country under a dragged flag (no scaling, so nothing wobbles)
export function highlight(E, id) {
  for (const [cid, c] of Object.entries(E.countries)) {
    const m = (c.painted ? c.painted.mesh : c.mesh).material; m.color.copy(cid === id ? HOV : PLAIN);
    if (c.marker) c.marker.sc.t = cid === id ? 1.4 : 1;
  }
}
export function paintCountry(E, id, pop = true) {
  const c = E.countries[id]; if (!c || c.painted) return;
  const m = sharedMesh(paintedMat(c.g), false); m.position.set(c.g.cx, c.g.cy, c.mesh.position.z + 0.01); m.userData.kind = 'euCountry'; m.userData.id = id; E.group.add(m);
  clipped(E, m);
  const j = new Juicy(m); if (pop) { j.sc.v = 0.6; j.pop(0.5); }
  c.painted = j; c.mesh.visible = false;
  if (c.marker) { c.marker.mesh.material = markerMat(c.g, true).mat; clipped(E, c.marker.mesh); c.marker.pop(0.6); }
}
// the glowing ring that shows where a country is (hint)
export function showGlow(E, id) {
  E.glowFor = id; if (!id) { E.glow.sc.t = 0.0001; return; }
  const g = geo(id), size = Math.max(0.6, Math.min(3.2, Math.max(g.box.x1 - g.box.x0, g.box.y1 - g.box.y0) * 1.1));
  E.glow.mesh.position.set(g.label[0], g.label[1], 0.3); E.glow.base = size; E.glow.sc.t = 1; E.glow.pop(0.5);
}
// which country is under a point (map-local). Tiny countries' markers win; `prefer` gets a little extra room.
export function countryAt(E, l, prefer = null) {
  const x = l.x, y = l.y;
  for (const c of GEO) if (c.tiny && Math.hypot(x - c.label[0], y - c.label[1]) < (c.id === prefer ? 0.6 : 0.24)) return c.id;
  if (prefer) { const p = geo(prefer); if (distTo(p, x, y) < (p.area < 4 ? 0.4 : 0.3)) return prefer; }
  let best = null;
  for (const c of GEO) {
    if (x < c.box.x0 || x > c.box.x1 || y < c.box.y0 || y > c.box.y1) continue;
    if (c.polys.some(poly => pointInPoly(x, y, poly)) && (!best || c.area < best.area)) best = c;
  }
  return best ? best.id : null;
}
function distTo(c, x, y) {
  if (c.polys.some(poly => pointInPoly(x, y, poly))) return 0;
  if (x < c.box.x0 - 0.5 || x > c.box.x1 + 0.5 || y < c.box.y0 - 0.5 || y > c.box.y1 + 0.5) return Infinity;
  let d = Infinity;
  for (const poly of c.polys) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    d = Math.min(d, Math.hypot(x - ax - dx * u, y - ay - dy * u));
  }
  return d;
}
