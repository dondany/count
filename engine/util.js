// Small shared helpers: maths, easing, springs, "juice" and tweens.

export const rand = (a, b) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.floor(rand(a, b + 1));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const digitsOf = n => String(n).split('').reverse().map(Number); // little-endian: [ones, tens, ...]
export const ease = {
  linear: t => t,
  outCubic: t => 1 - (1 - t) ** 3,
  inCubic: t => t * t * t,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
export function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export class Spring {
  constructor(v = 0, k = 300, d = 16) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.d = d; }
  step(dt) { const a = this.k * (this.t - this.v) - this.d * this.vel; this.vel += a * dt; this.v += this.vel * dt; }
}

// Wraps a mesh with squash / scale / rotation springs. The engine updates every live Juicy each frame.
export const juicy = new Set();
export class Juicy {
  constructor(mesh, base = 1) {
    this.mesh = mesh; this.base = base; this.extra = 0;
    this.sq = new Spring(0, 420, 14); this.sc = new Spring(1, 320, 15); this.rot = new Spring(0, 220, 13);
    mesh.userData.j = this; juicy.add(this);
  }
  punch(a = 0.3) { this.sq.vel += a * 14; }
  pop(a = 0.3) { this.sc.vel += a * 10; }
  update(dt) {
    this.sq.step(dt); this.sc.step(dt); this.rot.step(dt);
    const s = this.base * Math.max(0.0001, this.sc.v);
    this.mesh.scale.set(s * (1 + this.sq.v), s * (1 - this.sq.v * 0.85), 1);
    this.mesh.rotation.z = this.rot.v + this.extra;
  }
  kill() { juicy.delete(this); if (this.mesh.parent) this.mesh.parent.remove(this.mesh); }
}
// forget every Juicy inside an object tree (before removing it from the scene)
export function unjuice(root) { root.traverse(o => { if (o.userData.j) juicy.delete(o.userData.j); }); }

const tweens = [];
export function tween(dur, fn, ez = ease.outCubic) { return new Promise(res => tweens.push({ t: 0, dur, fn, ez, res })); }
export const wait = s => tween(s, () => {});
export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt;
    const k = tw.dur <= 0 ? 1 : Math.min(1, tw.t / tw.dur);
    tw.fn(tw.ez(k), k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}
