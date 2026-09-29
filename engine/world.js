// The paper diorama behind every activity: sky, sun, clouds, layered hills and trees.
import * as THREE from 'three';
import { rand, pick } from './util.js';
import { INK, cutTex, cutMesh, paperMat, paint, starPath, paperTex } from './paper.js';
import { scene, S, onLayout, addUpdate } from './core.js';

const BG = { clouds: [], trees: [], sun: null, rays: null };

export function buildWorld() {
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 512; const g = sc.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#f5b487'); gr.addColorStop(0.5, '#fcd6ab'); gr.addColorStop(1, '#fdebd0');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(260, 170), new THREE.MeshBasicMaterial({ map: st }));
  sky.position.z = -20; scene.add(sky);

  // smiling sun
  const sun = new THREE.Group();
  const rays = cutMesh(4.3, 4.3, (ctx, P) => { starPath(ctx, 14, 2.1, 1.55); paint(ctx, P, '#ffb347'); }, { res: 60, rim: 0.08 });
  const face = cutMesh(3, 3, (ctx, P) => {
    ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, Math.PI * 2); paint(ctx, P, '#ffd35a');
    if (P.rim) return;
    ctx.strokeStyle = INK; ctx.lineWidth = 0.1;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.48, -0.15, 0.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0.2, 0.42, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(232,87,74,.35)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.85, 0.25, 0.22, 0.14, 0, 0, 7); ctx.fill(); }
  }, { res: 70, rim: 0.08 });
  face.position.z = 0.2; sun.add(rays, face); scene.add(sun);
  BG.sun = sun; BG.rays = rays;

  // clouds
  const cloudTex = cutTex(3.6, 1.8, (ctx, P) => {
    ctx.beginPath();
    for (const [x, y, r] of [[-1.1, 0.25, 0.55], [-0.35, -0.2, 0.75], [0.55, -0.05, 0.62], [1.2, 0.28, 0.42]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
    ctx.rect(-1.1, 0.2, 2.3, 0.5);
    paint(ctx, P, '#fffaf2', { shadow: false });
  }, { res: 60, rim: 0 });
  const cloudMat = paperMat(cloudTex.tex), cloudGeo = new THREE.PlaneGeometry(cloudTex.W, cloudTex.H);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(cloudGeo, cloudMat);
    const s = rand(0.8, 1.5); m.scale.set(s * (Math.random() < 0.5 ? -1 : 1), s, 1);
    m.position.set(rand(-30, 30), rand(5, 12), rand(-15, -12)); scene.add(m);
    BG.clouds.push({ m, v: rand(0.15, 0.4) });
  }

  // layered hills (no real shadows: the baked card shadows look softer)
  const hills = [
    { z: -11, color: '#f2b07b', base: 1.4, amp: 1.5, f: 0.14, ph: 1.0 },
    { z: -8, color: '#d9c46e', base: -1.2, amp: 1.3, f: 0.19, ph: 2.3 },
    { z: -5, color: '#a3c266', base: -3.6, amp: 1.1, f: 0.23, ph: 0.4 },
    { z: -2.5, color: '#7eab57', base: -5.8, amp: 0.8, f: 0.29, ph: 4.1 },
  ];
  const treeTex = ['#6f9e4c', '#e8a15a', '#d9703f', '#8fb85a', '#c9a13c'].map((col, k) => cutTex(1.6, 2.3, (ctx, P) => {
    ctx.beginPath(); ctx.rect(-0.1, 0.1, 0.2, 1.05); paint(ctx, P, '#8a5a3b');
    ctx.beginPath(); if (k % 2) { ctx.moveTo(0, -1.1); ctx.lineTo(0.65, 0.3); ctx.lineTo(-0.65, 0.3); ctx.closePath(); } else ctx.arc(0, -0.35, 0.68, 0, Math.PI * 2);
    paint(ctx, P, col);
  }, { res: 50, rim: 0.06 }));
  hills.forEach((h, idx) => {
    const f = x => h.base + h.amp * (0.65 * Math.sin(x * h.f + h.ph) + 0.35 * Math.sin(x * h.f * 2.7 + h.ph * 2.1));
    const shape = new THREE.Shape(); shape.moveTo(-70, -40);
    for (let x = -70; x <= 70; x += 0.5) shape.lineTo(x, f(x));
    shape.lineTo(70, -40); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false, curveSegments: 4 });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: h.color, map: paperTex, roughness: 1 }));
    m.position.z = h.z - 0.25; scene.add(m);
    if (idx === 1 || idx === 2) {
      const xs = idx === 1 ? [-21, -16, -9.5, -4, 5, 11, 16.5, 22] : [-18, -12.5, -6.5, 7, 13, 19];
      for (const x of xs) {
        const tt = pick(treeTex);
        const tr = new THREE.Mesh(new THREE.PlaneGeometry(tt.W, tt.H), paperMat(tt.tex));
        const s = rand(0.8, 1.25); tr.scale.set(s, s, 1);
        tr.position.set(x + rand(-0.6, 0.6), f(x) + 0.55 * s, h.z + 0.25);
        scene.add(tr); BG.trees.push({ m: tr, ph: rand(0, 6) });
      }
    }
  });

  onLayout(() => BG.sun.position.set(...S.L.sun));
  addUpdate((dt, t) => {
    BG.rays.rotation.z = t * 0.12;
    for (const c of BG.clouds) { c.m.position.x += c.v * dt; if (c.m.position.x > 34) c.m.position.x = -34; }
    for (const tr of BG.trees) tr.m.rotation.z = Math.sin(t * 1.3 + tr.ph) * 0.04;
  });
}
