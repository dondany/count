// A paper pencil that hovers next to whatever the child should do next.
// setPencil(fn): fn() returns { mesh, r, left } (point at mesh from the upper right, or upper left when `left`) or null to hide.
import * as THREE from 'three';
import { Juicy, lerp } from './util.js';
import { INK, cutMesh, paint, rr } from './paper.js';
import { scene, S, drag, addUpdate } from './core.js';

let pencil = null, source = null;
const _v = new THREE.Vector3();
export const setPencil = fn => { source = fn; };

export function buildPencil() {
  const m = cutMesh(2.5, 0.52, (ctx, P) => {
    const body = () => { ctx.beginPath(); ctx.moveTo(-0.62, -0.2); ctx.lineTo(0.86, -0.2); ctx.lineTo(0.86, 0.2); ctx.lineTo(-0.62, 0.2); ctx.closePath(); };
    const cone = () => { ctx.beginPath(); ctx.moveTo(-0.62, -0.2); ctx.lineTo(-1.2, 0); ctx.lineTo(-0.62, 0.2); ctx.closePath(); };
    const eraser = () => { rr(ctx, 0.84, -0.2, 0.4, 0.4, 0.12); };
    if (P.rim) { for (const f of [body, cone, eraser]) { f(); paint(ctx, P); } return; }
    eraser(); paint(ctx, P, '#f29bb0');
    ctx.beginPath(); ctx.rect(0.82, -0.21, 0.16, 0.42); paint(ctx, P, '#bdb6ad');
    body(); paint(ctx, P, '#f2b33d');
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(-0.62, 0.06, 1.44, 0.14);
    cone(); paint(ctx, P, '#f3cf9b');
    ctx.beginPath(); ctx.moveTo(-0.98, -0.075); ctx.lineTo(-1.2, 0); ctx.lineTo(-0.98, 0.075); ctx.closePath(); paint(ctx, P, INK, { shadow: false });
  }, { res: 110, rim: 0.07 });
  scene.add(m);
  pencil = { mesh: m, j: new Juicy(m), pos: new THREE.Vector3(0, 20, 1) };
  pencil.j.rot.v = pencil.j.rot.t = Math.PI / 4;
  addUpdate(update);
}
function update(dt, t) {
  const s = source && !drag.piece ? source() : null, j = pencil.j;
  if (s) {
    s.mesh.getWorldPosition(_v);
    const bob = Math.sin(t * 5) * 0.14, r = (s.r ?? 1.05) + bob;
    const tx = _v.x + r * 0.72 * (s.left ? -1 : 1), ty = _v.y + r * 0.72;
    pencil.pos.x = lerp(pencil.pos.x, tx, 1 - Math.exp(-dt * 9)); pencil.pos.y = lerp(pencil.pos.y, ty, 1 - Math.exp(-dt * 9));
    j.rot.t = s.left ? Math.PI * 3 / 4 : Math.PI / 4;
    j.sc.t = 1;
  } else j.sc.t = 0;
  pencil.mesh.position.set(pencil.pos.x, pencil.pos.y, 0.9);
  j.base = S.L.name === 'tall' ? 0.8 : 0.9;
}
