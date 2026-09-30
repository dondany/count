// Renderer, scene, layout, input + dragging, confetti and the frame loop shared by every activity.
import * as THREE from 'three';
import { lerp, clamp, rand, pick, juicy, updateTweens } from './util.js';
import { ensureAudio, sfx } from './audio.js';
import { CONF_COLORS } from './paper.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true; // the zoomable Europe map is clipped to its window
document.getElementById('app').appendChild(renderer.domElement);
export const scene = new THREE.Scene(); scene.background = new THREE.Color('#fbd9b0');
export const camera = new THREE.PerspectiveCamera(30, 1, 1, 300); camera.position.set(0, 0, 40);
scene.add(new THREE.HemisphereLight('#fff6ea', '#eac9a6', 2.2));
const sunLight = new THREE.DirectionalLight('#fff0da', 1.7);
sunLight.position.set(-7, 11, 18); sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 1, far: 70 });
sunLight.shadow.camera.updateProjectionMatrix();
sunLight.shadow.bias = -0.0005; sunLight.shadow.normalBias = 0.02;
scene.add(sunLight, sunLight.target);

// Design areas (world units at z=0) for landscape and portrait screens.
// main = the big work surface, side = helper panel, tray = the strip of draggable pieces.
export const LAY = {
  wide: { name: 'wide', w: 24.4, h: 14.4, owl: [-10.3, 5.55], owlS: 1, main: [-2.2, -0.05], side: [8.5, 0.1], sideDir: 'v',
          tray: { y: -6.0, perRow: 10, sp: 2.05, rowGap: 0 }, sun: [13, 8.2, -13] },
  tall: { name: 'tall', w: 11.9, h: 22.4, owl: [-4.75, 9.35], owlS: 0.9, main: [0, 3.55], side: [0, -3.1], sideDir: 'h',
          tray: { y: -7.3, perRow: 5, sp: 2.12, rowGap: 2.15 }, sun: [4.6, 13.2, -13] },
};
export const S = { L: null, camDist: 40, shake: 0, time: 0, lastAct: 0, started: false, nudged: false };

/* ---------- confetti (instanced paper bits) ---------- */
const CONF_N = 320;
const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 }), CONF_N);
conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage); conf.castShadow = true; conf.frustumCulled = false;
scene.add(conf);
const confP = [], _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
for (let i = 0; i < CONF_N; i++) {
  confP.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), spin: 0, ph: 0, s: 1 });
  conf.setMatrixAt(i, _m4.makeScale(0, 0, 0)); conf.setColorAt(i, _c.set('#fff'));
}
let confIdx = 0;
export function burst(pos, n, { colors = CONF_COLORS, speed = 5, up = 5, z = 2, size = 1 } = {}) {
  for (let k = 0; k < n; k++) {
    const i = confIdx = (confIdx + 1) % CONF_N, p = confP[i];
    p.p.copy(pos); p.v.set(rand(-1, 1) * speed, rand(0.3, 1) * up, rand(0, 1) * z);
    p.life = rand(1.4, 2.6); p.axis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    p.spin = rand(5, 13); p.ph = rand(0, 6.28); p.s = size * rand(0.7, 1.3);
    conf.setColorAt(i, _c.set(pick(colors)));
  }
  conf.instanceColor.needsUpdate = true;
}
function updateConfetti(dt, t) {
  for (let i = 0; i < CONF_N; i++) {
    const p = confP[i]; if (p.life <= 0) continue;
    p.life -= dt; p.v.y -= 9 * dt; p.v.multiplyScalar(1 - 1.8 * dt);
    p.p.addScaledVector(p.v, dt); p.p.x += Math.sin(t * 6 + p.ph) * 0.7 * dt;
    _q.setFromAxisAngle(p.axis, t * p.spin + p.ph);
    const s = p.life <= 0 ? 0 : Math.min(1, p.life * 2) * p.s;
    conf.setMatrixAt(i, _m4.compose(p.p, _q, _s.set(s, s, s)));
  }
  conf.instanceMatrix.needsUpdate = true;
}

/* ---------- picking ---------- */
export const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
export function setNDC(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }
export function atZ(z) {
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction, t = (z - o.z) / d.z;
  return new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, z);
}
export function screenToWorld(px, py, z) { ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); return atZ(z); }
const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
export function hitTest() {
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects(scene.children, true)) if (h.object.userData.kind && shown(h.object)) return h.object;
  return null;
}

/* ---------- dragging ----------
   startDrag(piece, e, { targets(): [{ mesh, r } | { hit(pt) }], onDrop(piece, target|null) }) */
export const drag = { piece: null, id: null, touch: false, target: new THREE.Vector3(), pt: new THREE.Vector3(), hover: null, opts: null };
const LIFT = 1.6, _v = new THREE.Vector3();
function updateDragTarget() {
  const off = drag.touch ? 0.9 : 0.1;
  drag.target.copy(atZ(LIFT)); drag.target.y += off;
  drag.pt.copy(atZ(0.12)); drag.pt.y += off;
  let best = null, bd = Infinity;
  for (const s of drag.opts.targets()) {
    let d;
    if (s.hit) d = s.hit(drag.pt) ? 0.5 : Infinity;
    else { s.mesh.getWorldPosition(_v); d = Math.hypot(_v.x - drag.pt.x, _v.y - drag.pt.y) / s.r; }
    if (d < 1 && d < bd) { bd = d; best = s; }
  }
  if (best !== drag.hover && best) { sfx.tap(); if (best.j) best.j.punch(0.2); }
  drag.hover = best;
}
export function startDrag(piece, e, opts) {
  drag.piece = piece; drag.id = e.pointerId; drag.touch = e.pointerType !== 'mouse'; drag.opts = opts; drag.hover = null;
  piece.sc.t = 1.18; piece.punch(0.35); piece.rot.t = 0; piece.mesh.renderOrder = 10; sfx.pick();
  updateDragTarget();
}
function release() {
  const p = drag.piece, s = drag.hover, o = drag.opts;
  drag.piece = null; drag.hover = null; drag.opts = null;
  p.rot.t = 0; p.mesh.renderOrder = 0;
  o.onDrop(p, s);
}
function updateDrag(dt) {
  if (!drag.piece) return;
  const m = drag.piece.mesh, px = m.position.x;
  m.position.lerp(drag.target, 1 - Math.exp(-dt * 24));
  if (drag.hover && drag.hover.mesh && !drag.hover.hit) { drag.hover.mesh.getWorldPosition(_v); m.position.x += (_v.x - m.position.x) * 0.1; m.position.y += (_v.y - m.position.y) * 0.1; }
  const vx = (m.position.x - px) / Math.max(dt, 1e-3);
  drag.piece.rot.t = clamp(-vx * 0.045, -0.55, 0.55);
}

// grabbing something that isn't a loose piece (e.g. clock hands): onMove(worldPointOnBoard), onEnd()
let grab = null;
export function startGrab(e, onMove, onEnd) { grab = { id: e.pointerId, onMove, onEnd }; }
function endGrab() { const g = grab; grab = null; if (g) g.onEnd(); }

/* ---------- pointer events ---------- */
let pointerHandler = null;
export const setPointerHandler = fn => { pointerHandler = fn; };
renderer.domElement.addEventListener('pointerdown', e => {
  ensureAudio(); S.lastAct = S.time;
  if (!S.started || drag.piece || grab) return;
  setNDC(e);
  if (pointerHandler) pointerHandler(hitTest(), e);
});
const par = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { par.tx = e.clientX / innerWidth * 2 - 1; par.ty = -(e.clientY / innerHeight) * 2 + 1; }
  if (drag.piece && e.pointerId === drag.id) { setNDC(e); updateDragTarget(); renderer.domElement.style.cursor = 'grabbing'; }
  else if (grab && e.pointerId === grab.id) { setNDC(e); grab.onMove(atZ(0.2)); renderer.domElement.style.cursor = 'grabbing'; }
  else if (e.pointerType === 'mouse' && S.started && e.target === renderer.domElement) {
    setNDC(e); const o = hitTest();
    renderer.domElement.style.cursor = o ? (o.userData.kind === 'tray' ? 'grab' : 'pointer') : 'default';
  }
});
addEventListener('pointerup', e => { if (drag.piece && e.pointerId === drag.id) release(); if (grab && e.pointerId === grab.id) endGrab(); });
addEventListener('pointercancel', e => { if (drag.piece && e.pointerId === drag.id) { drag.hover = null; release(); } if (grab && e.pointerId === grab.id) endGrab(); });

/* ---------- layout ---------- */
const layoutFns = [];
export const onLayout = fn => layoutFns.push(fn);
export function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  const L = w / h < 0.95 ? LAY.tall : LAY.wide;
  if (S.L !== L) { S.L = L; layoutFns.forEach(f => f()); }
  const hud = Math.min(h * 0.18, document.getElementById('hud').getBoundingClientRect().bottom + 4);
  const upp = Math.max(L.w / w, L.h / (h - hud)), F = h + hud;
  S.camDist = (upp * F / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // the virtual view is taller than the screen so the design area sits centred below the HUD
  camera.aspect = w / F; camera.setViewOffset(w, F, 0, 0, w, h); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---------- loop ---------- */
const updaters = new Set(), posts = new Set();
export const addUpdate = fn => { updaters.add(fn); return () => updaters.delete(fn); };
export const addPost = fn => { posts.add(fn); return () => posts.delete(fn); };
function step(dt) {
  S.time += dt; const t = S.time;
  updateTweens(dt);
  updateDrag(dt);
  for (const j of juicy) j.update(dt);
  for (const f of updaters) f(dt, t);
  updateConfetti(dt, t);
  // camera: gentle parallax + shake
  par.x = lerp(par.x, par.tx, 1 - Math.exp(-dt * 3)); par.y = lerp(par.y, par.ty, 1 - Math.exp(-dt * 3));
  S.shake *= Math.exp(-dt * 7);
  const sx = (Math.random() - 0.5) * S.shake, sy = (Math.random() - 0.5) * S.shake;
  camera.position.set(par.x * 0.9 + sx, par.y * 0.6 + sy, S.camDist);
  camera.lookAt(par.x * 0.2, par.y * 0.12, 0);
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  step(dt);
  renderer.render(scene, camera);
  for (const f of posts) f();
}
export function startLoop() { requestAnimationFrame(frame); }
// test hook: advance the simulation without requestAnimationFrame (headless browsers barely fire it)
export function manualStep(n = 3) { for (let i = 0; i < n; i++) step(0.033); renderer.render(scene, camera); for (const f of posts) f(); }
