// Paper cut-out look: canvas-drawn shapes with a white paper rim + grain, used as alpha-tested planes that cast shadows.
import * as THREE from 'three';
import { mulberry, Juicy } from './util.js';

export const INK = '#4a3426', RIM = '#fffaf0';
export const DIGIT_COLORS = ['#e8574a', '#f08a3c', '#e9a825', '#6fae52', '#2f9e97', '#3f7fc1', '#7a5cc4', '#d9508f', '#a0643b', '#4a4f8c'];
export const CONF_COLORS = ['#e8574a', '#f2c14e', '#2f9e97', '#6fae52', '#3f7fc1', '#d9508f', '#f08a3c', '#fffaf0'];
export const SRC = { carry: '#e9a825', a: '#e8574a', b: '#2f9e97' }; // colours for "carried", "top number", "bottom number"
export const BAND_COLORS = ['#cde6f5', '#d8ecc4', '#f9d3dc', '#e4d9f6'];
export const BAND_INK = ['#3f7fc1', '#4f8a3a', '#c2456f', '#6d55b5'];
// Fredoka lacks ś ć ź, so Baloo 2 fills in those Polish letters glyph by glyph
const FONT_FAMILY = "'Fredoka','Baloo 2','Arial Rounded MT Bold','Trebuchet MS',sans-serif";
export const font = (px, w = 700) => `${w} ${px}px ${FONT_FAMILY}`;

const cache = {};
export function once(key, fn) { return cache[key] || (cache[key] = fn()); }

export const grain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = mulberry(3);
  for (let i = 0; i < 6000; i++) {
    const dark = r() < 0.55;
    g.fillStyle = dark ? `rgba(110,70,30,${0.03 + r() * 0.06})` : `rgba(255,255,255,${0.06 + r() * 0.12})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  g.lineWidth = 0.7;
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(120,80,40,${0.04 + r() * 0.05})`; g.beginPath();
    let x = r() * 256, y = r() * 256; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 18; y += (r() - 0.5) * 18; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
})();
export const paperTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.drawImage(grain, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.16, 0.16); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function renderCut(c, res, rim, draw) {
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
  ctx.setTransform(res, 0, 0, res, c.width / 2, c.height / 2);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (rim > 0) { ctx.save(); draw(ctx, { rim: true, rimW: rim, res }); ctx.restore(); }
  ctx.save(); draw(ctx, { rim: false, rimW: rim, res }); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
}
// draw(ctx, P) works in world units, origin at the centre, y pointing down. It runs twice: P.rim (white border) then the fill.
export function cutTex(w, h, draw, { res = 110, rim = 0.08, pad } = {}) {
  pad = pad ?? rim + 0.08;
  const W = w + pad * 2, H = h + pad * 2;
  const c = document.createElement('canvas'); c.width = Math.ceil(W * res); c.height = Math.ceil(H * res);
  renderCut(c, res, rim, draw);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, W, H, redraw(fn) { renderCut(c, res, rim, fn); tex.needsUpdate = true; } };
}
export function paperMat(tex, o = {}) {
  return new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, alphaToCoverage: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, ...o });
}
export function cutMesh(w, h, draw, o = {}) {
  const t = cutTex(w, h, draw, o);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(t.W, t.H), paperMat(t.tex));
  m.castShadow = o.shadow !== false; m.receiveShadow = true;
  m.userData.cut = t;
  return m;
}
// shared material + geometry for a cut-out drawn once
export function cutShared(key, w, h, draw, o) {
  return once(key, () => { const t = cutTex(w, h, draw, o); return { mat: paperMat(t.tex), geo: new THREE.PlaneGeometry(t.W, t.H), W: t.W, H: t.H }; });
}
export function sharedMesh(sh, shadow = true) { const m = new THREE.Mesh(sh.geo, sh.mat); m.castShadow = shadow; m.receiveShadow = true; return m; }
export function disposeMesh(m) { m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }

// fill the current path; in the rim pass it becomes the white paper border
export function paint(ctx, P, fill, { shadow = true } = {}) {
  if (P.rim) { ctx.fillStyle = RIM; ctx.strokeStyle = RIM; ctx.lineWidth = P.rimW * 2; ctx.fill(); ctx.stroke(); return; }
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(74,52,38,0.32)'; ctx.shadowBlur = 0.05 * P.res; ctx.shadowOffsetY = 0.025 * P.res; }
  ctx.fillStyle = fill; ctx.fill(); ctx.restore();
}
export function text(ctx, P, str, x, y, size, color, { weight = 700, shadow = true, maxW = 0 } = {}) {
  ctx.save(); ctx.scale(1 / P.res, 1 / P.res);
  ctx.font = font(size * P.res, weight); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let m = ctx.measureText(str);
  if (maxW && m.width > maxW * P.res) { ctx.font = font(size * P.res * maxW * P.res / m.width, weight); m = ctx.measureText(str); }
  const yy = y * P.res + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  if (P.rim) {
    ctx.lineWidth = P.rimW * 2 * P.res; ctx.strokeStyle = RIM; ctx.fillStyle = RIM;
    ctx.strokeText(str, x * P.res, yy); ctx.fillText(str, x * P.res, yy);
  } else {
    if (shadow) { ctx.shadowColor = 'rgba(74,52,38,0.3)'; ctx.shadowBlur = 0.05 * P.res; ctx.shadowOffsetY = 0.025 * P.res; }
    ctx.fillStyle = color; ctx.fillText(str, x * P.res, yy);
  }
  ctx.restore();
}
// coloured text segments, centred, auto-shrunk to maxW
export function segs(ctx, P, list, x, y, size, maxW, weight = 700) {
  ctx.save(); ctx.scale(1 / P.res, 1 / P.res);
  let s = size * P.res; ctx.font = font(s, weight);
  let tot = list.reduce((a, g) => a + ctx.measureText(g.t).width, 0);
  if (tot > maxW * P.res) { s *= maxW * P.res / tot; ctx.font = font(s, weight); tot = maxW * P.res; }
  const m = ctx.measureText('8');
  const yy = y * P.res + m.actualBoundingBoxAscent / 2;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let cx = x * P.res - tot / 2;
  for (const g of list) { ctx.fillStyle = g.c || INK; ctx.fillText(g.t, cx, yy); cx += ctx.measureText(g.t).width; }
  ctx.restore();
}
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// a rounded rectangle with slightly wobbly, hand-cut edges
export function tornRect(ctx, x, y, w, h, r, jit, seed) {
  const rnd = mulberry(seed), pts = [], step = 0.14;
  const edge = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } };
  const arc = (cx, cy, a0) => { for (let i = 0; i < 4; i++) { const a = a0 + i / 4 * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  edge(x + r, y, x + w - r, y); arc(x + w - r, y + r, -Math.PI / 2);
  edge(x + w, y + r, x + w, y + h - r); arc(x + w - r, y + h - r, 0);
  edge(x + w - r, y + h, x + r, y + h); arc(x + r, y + h - r, Math.PI / 2);
  edge(x, y + h - r, x, y + r); arc(x + r, y + r, Math.PI);
  ctx.beginPath();
  pts.forEach(([px, py], i) => { px += (rnd() - 0.5) * jit * 2; py += (rnd() - 0.5) * jit * 2; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.closePath();
}
export function starPath(ctx, n, ro, ri) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / n; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath();
}
// blurry drop shadow for big paper cards (baked, so it never lands as a hard block on the hills)
export function softShadow(w, h, { op = 0.3, blur = 0.3, r = 0.35 } = {}) {
  const res = 40, W = w + blur * 6, H = h + blur * 6;
  const c = document.createElement('canvas'); c.width = Math.ceil(W * res); c.height = Math.ceil(H * res);
  const ctx = c.getContext('2d');
  ctx.shadowColor = 'rgb(70,40,15)'; ctx.shadowBlur = blur * res; ctx.shadowOffsetX = 10000;
  ctx.translate(c.width / 2 - 10000, c.height / 2); ctx.fillStyle = '#000';
  rr(ctx, -w * res / 2, -h * res / 2, w * res, h * res, r * res); ctx.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false }));
}

/* ---------- paper digits ---------- */
const DIG = { geo: null, mats: [] };
export function initDigits() {
  const m = document.createElement('canvas').getContext('2d'); m.font = font(100);
  const mm = m.measureText('8'); const size = 100 * 1.35 / (mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent);
  for (let d = 0; d < 10; d++) {
    const t = cutTex(1.3, 1.5, (ctx, P) => text(ctx, P, String(d), 0, 0, size, DIGIT_COLORS[d]), { res: 170, rim: 0.11 });
    DIG.mats[d] = paperMat(t.tex);
    if (!DIG.geo) DIG.geo = new THREE.PlaneGeometry(t.W, t.H);
  }
}
export function makeTile(d, base = 1) {
  const mesh = new THREE.Mesh(DIG.geo, DIG.mats[d]); mesh.castShadow = mesh.receiveShadow = true;
  const t = new Juicy(mesh, base); t.d = d; return t;
}
