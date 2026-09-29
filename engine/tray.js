// The kraft-paper tray at the bottom with an endless supply of draggable pieces (digits, blocks, ...).
// setTray(items): items = [{ key, make() -> Juicy, trayBase, base }] ; setTray(null) hides it.
import * as THREE from 'three';
import { tween, lerp, ease, wait } from './util.js';
import { cutMesh, paint, rr, tornRect, softShadow, once, makeTile } from './paper.js';
import { scene, S, onLayout, addUpdate } from './core.js';
import { sfx } from './audio.js';

export let tray = null;
let defs = null, opts = {};

export const digitItems = () => Array.from({ length: 10 }, (_, d) => ({ key: 'd' + d, d, make: () => makeTile(d, 0.92), trayBase: 0.92, base: 0.92 }));

export function setTray(items, o = {}) { defs = items; opts = o; rebuild(); }
function dispose(m) { m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
function rebuild() {
  if (tray) { tray.items.forEach(t => t.kill()); scene.remove(tray.group); dispose(tray.strip); dispose(tray.sh); tray = null; }
  if (!defs || !S.L) return;
  const L = S.L.tray, n = defs.length, perRow = Math.min(n, L.perRow), rows = Math.ceil(n / perRow);
  const sp = (opts.sp && opts.sp[S.L.name]) || L.sp;
  const g = new THREE.Group(); g.position.z = 0.25;
  const w = perRow * sp + 0.5, h = (rows - 1) * L.rowGap + 1.95, cy = L.y - (rows - 1) * L.rowGap / 2;
  const strip = cutMesh(w, h, (ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.35, 0.04, 77); paint(ctx, P, '#d9a066', { shadow: false });
    rr(ctx, -w / 2 + 0.16, -h / 2 + 0.16, w - 0.32, h - 0.32, 0.25);
    ctx.setLineDash([0.18, 0.12]); ctx.lineWidth = 0.05; ctx.strokeStyle = 'rgba(255,243,220,0.8)'; ctx.stroke();
  }, { res: 60, rim: 0, pad: 0.05 });
  strip.position.set(0, cy, -0.1); strip.rotation.z = 0.004; g.add(strip);
  const sh = softShadow(w, h, { op: 0.25 }); sh.position.set(0.25, cy - 0.3, -0.4); g.add(sh);
  const haloTex = once('glow', () => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(255,222,110,0.95)'); gr.addColorStop(1, 'rgba(255,222,110,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  const haloGeo = once('haloGeo', () => new THREE.PlaneGeometry(2.4, 2.4));
  const hitGeo = once('hitGeo', () => new THREE.PlaneGeometry(Math.min(sp, 2.0) * 0.95, 1.9));
  const hitMat = once('hitMat', () => new THREE.MeshBasicMaterial({ visible: false }));
  const items = [], halos = [];
  defs.forEach((def, i) => {
    const r = Math.floor(i / perRow), c = i % perRow, inRow = Math.min(perRow, n - r * perRow);
    const x = (c - (inRow - 1) / 2) * sp, y = L.y - r * L.rowGap;
    const t = def.make(); t.base = def.trayBase; t.key = def.key; t.home = new THREE.Vector3(x, y, 0.1); t.mesh.position.copy(t.home);
    t.mesh.userData.kind = 'tray'; t.mesh.userData.key = def.key; g.add(t.mesh); items.push(t);
    // invisible, finger-sized touch area (thin pieces like the ten-rod are hard to grab otherwise)
    const hit = new THREE.Mesh(hitGeo, hitMat); hit.position.set(x, y, 0.3);
    hit.userData = { kind: 'tray', key: def.key, j: t }; g.add(hit);
    const hl = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false }));
    hl.position.set(x, y, 0.02); hl.visible = false; g.add(hl); halos.push(hl);
  });
  scene.add(g); tray = { group: g, items, halos, glow: null, strip, sh };
}
onLayout(rebuild);

export const trayItem = key => tray && tray.items.find(t => t.key === key);
export function setTrayGlow(key) { if (!tray) return; tray.glow = key; tray.halos.forEach((h, i) => { h.visible = tray.items[i].key === key; }); }

// a fresh copy of a tray piece, ready to be dragged
export function spawnFromTray(key) {
  const it = trayItem(key), def = defs.find(d => d.key === key);
  const p = def.make(); p.key = key; scene.add(p.mesh);
  it.mesh.getWorldPosition(p.mesh.position); p.mesh.position.z += 0.05;
  p.base = def.trayBase; tween(0.18, k => { p.base = lerp(def.trayBase, def.base, k); });
  it.sc.v = 0.0001; // the tray copy pops back in
  return p;
}
// send a piece back to the tray (it disappears into its twin)
export async function flyHome(p) {
  const it = trayItem(p.key);
  if (p.mesh.parent !== scene) scene.attach(p.mesh);
  p.rot.t = 0; p.slot = null; p.mesh.userData.kind = null;
  if (!it) { p.sc.t = 0; await wait(0.3); p.kill(); return; }
  const to = it.mesh.getWorldPosition(new THREE.Vector3()), from = p.mesh.position.clone(), b0 = p.base;
  p.sc.t = 0.6;
  await tween(0.42, k => {
    p.mesh.position.lerpVectors(from, to, k); p.mesh.position.z += Math.sin(k * Math.PI) * 1.5;
    p.extra = k * Math.PI * 2 * (from.x > to.x ? 1 : -1); p.base = lerp(b0, it.base, k);
  }, ease.inOutSine);
  p.kill(); it.punch(0.35); it.pop(0.2); sfx.tap();
}

addUpdate((dt, t) => {
  if (!tray) return;
  tray.items.forEach((it, i) => {
    it.mesh.position.y = it.home.y + Math.sin(t * 2 + i * 0.7) * 0.05;
    it.rot.t = Math.sin(t * 1.5 + i) * 0.04;
    if (it.sc.t !== 1) it.sc.t = 1;
  });
  const gi = tray.items.findIndex(it => it.key === tray.glow);
  if (gi >= 0) {
    const h = tray.halos[gi], s = 1 + 0.15 * Math.sin(t * 6); h.scale.set(s, s, 1);
    if (Math.floor(t * 1.2) !== Math.floor((t - dt) * 1.2)) { const it = tray.items[gi]; it.pop(0.4); it.punch(0.3); }
  }
});
