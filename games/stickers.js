// "Stickers": spend the stars you earned on sticker packs and fill a paper album (every sticker is a word to learn).
import * as THREE from 'three';
import { pick, lerp, Juicy, tween, wait, ease, unjuice } from '../engine/util.js';
import { INK, cutMesh, cutShared, sharedMesh, paint, text, rr, tornRect, starPath, softShadow, disposeMesh } from '../engine/paper.js';
import { scene, S, burst, screenToWorld } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { tr, lang, cap1 } from '../engine/i18n.js';
import { say, owlTilt, owlCheer } from '../engine/pip.js';
import { setTray } from '../engine/tray.js';
import { setPencil } from '../engine/pencil.js';
import { refreshStars, bumpStars } from '../engine/ui.js';
import { store, save, spendableStars } from '../engine/store.js';
import { PICS, ANIMALS } from './pictures.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const PACK_COST = 5;
export const ALL_STICKERS = [
  ...Object.keys(PICS).map(id => ({ id: 'w:' + id, name: () => cap1(PICS[id][lang].toLowerCase()), draw: PICS[id].draw })),
  ...ANIMALS.map(a => ({ id: 'a:' + a.id, name: () => cap1(a.name[lang]), draw: a.draw })),
];
const PER_PAGE = 12, PAGES = Math.ceil(ALL_STICKERS.length / PER_PAGE);
const K = { page: 0, album: null, pack: null, btn: null, arrows: [], busy: false, promptFn: () => '' };
const owned = id => store.stickers.includes(id);

/* ---------- layout + materials ---------- */
function grid() {
  const wide = S.L.name === 'wide';
  return wide ? { cols: 4, rows: 3, cell: 2.35, w: 10.4, h: 8.0 } : { cols: 3, rows: 4, cell: 2.2, w: 7.6, h: 9.7 };
}
function cellPos(g, k) { const c = k % g.cols, r = Math.floor(k / g.cols); return V3((c - (g.cols - 1) / 2) * g.cell, ((g.rows - 1) / 2 - r) * g.cell + 0.25, 0.1); }
const pageMat = (page) => {
  const g = grid();
  return cutShared(`album${S.L.name}${page}`, g.w, g.h, (ctx, P) => {
    tornRect(ctx, -g.w / 2, -g.h / 2, g.w, g.h, 0.35, 0.035, 60 + page); paint(ctx, P, '#fff3dc', { shadow: false });
    if (P.rim) return;
    for (let k = 0; k < PER_PAGE && page * PER_PAGE + k < ALL_STICKERS.length; k++) {
      const p = cellPos(g, k);
      ctx.beginPath(); ctx.arc(p.x, -p.y, g.cell * 0.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(233,220,196,.6)'; ctx.fill();
      ctx.setLineDash([0.14, 0.1]); ctx.strokeStyle = 'rgba(74,52,38,.35)'; ctx.lineWidth = 0.04; ctx.stroke(); ctx.setLineDash([]);
      text(ctx, P, '?', p.x, -p.y, 0.6, 'rgba(122,93,73,.35)', { shadow: false });
    }
    text(ctx, P, `${page + 1} / ${PAGES}`, 0, g.h / 2 - 0.35, 0.3, '#9a7a62', { weight: 600, shadow: false });
  }, { res: 70, rim: 0.1 });
};
export const stickerMat = id => cutShared('stk' + id, 2.1, 2.1, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 1.0, 0, Math.PI * 2); paint(ctx, P, '#fffdf8');
  if (P.rim) return;
  ctx.save(); ctx.scale(0.6, 0.6); ALL_STICKERS.find(s => s.id === id).draw(ctx, P); ctx.restore();
}, { res: 110, rim: 0.09 });
const miniStar = () => cutShared('ministar', 0.6, 0.6, (ctx, P) => { starPath(ctx, 5, 0.3, 0.14); paint(ctx, P, '#f2c14e'); }, { res: 120, rim: 0.05 });
const arrowMat = dir => cutShared('pgarrow' + dir, 1.2, 1.2, (ctx, P) => {
  ctx.beginPath(); ctx.arc(0, 0, 0.55, 0, Math.PI * 2); paint(ctx, P, '#f2c14e');
  if (P.rim) return;
  ctx.beginPath(); ctx.moveTo(-0.15 * dir, -0.25); ctx.lineTo(0.2 * dir, 0); ctx.lineTo(-0.15 * dir, 0.25); ctx.strokeStyle = INK; ctx.lineWidth = 0.12; ctx.stroke();
}, { res: 110, rim: 0.07 });

/* ---------- album ---------- */
function buildAlbum(page) {
  const g = grid(), grp = new THREE.Group(); grp.position.set(S.L.main[0], S.L.main[1] - (S.L.name === 'wide' ? 0.2 : 0.1), 0);
  const pm = sharedMesh(pageMat(page)); grp.add(pm);
  const sh = softShadow(g.w, g.h); sh.position.set(0.3, -0.4, -0.35); grp.add(sh);
  const stickers = [];
  for (let k = 0; k < PER_PAGE; k++) {
    const s = ALL_STICKERS[page * PER_PAGE + k]; if (!s || !owned(s.id)) continue;
    const m = sharedMesh(stickerMat(s.id)); m.position.copy(cellPos(g, k)); m.userData.kind = 'sticker'; m.userData.sid = s.id; grp.add(m);
    const j = new Juicy(m, g.cell / 2.35); j.rot.t = j.rot.v = (k % 3 - 1) * 0.08; stickers.push(j);
  }
  scene.add(grp);
  return { group: grp, sh, page };
}
function removeAlbum(a) { if (!a) return; unjuice(a.group); scene.remove(a.group); disposeMesh(a.sh); }
async function flip(dir, to = null) {
  const next = to ?? (K.page + dir + PAGES) % PAGES;
  if (next === K.page && K.album) return;
  sfx.paper();
  const old = K.album, d = dir || (next > K.page ? 1 : -1);
  if (old) { const og = old.group, sx = og.position.x; tween(0.35, k => { og.position.x = sx - d * k * 16; og.rotation.z = -d * k * 0.2; }, ease.inCubic).then(() => removeAlbum(old)); }
  K.page = next; const nb = K.album = buildAlbum(next), nx = nb.group.position.x;
  await tween(0.4, k => { nb.group.position.x = nx + d * (1 - k) * 16; }, ease.outCubic);
}

/* ---------- pack + buttons ---------- */
function buildSide() {
  removeSide();
  const tall = S.L.sideDir === 'h', [sx, sy] = S.L.side;
  const pack = cutMesh(3.6, 2.6, (ctx, P) => {
    rr(ctx, -1.8, -1.3, 3.6, 2.6, 0.2); paint(ctx, P, '#e8574a');
    if (P.rim) return;
    ctx.beginPath(); ctx.moveTo(-1.8, -1.3); ctx.lineTo(0, 0.1); ctx.lineTo(1.8, -1.3); ctx.closePath(); paint(ctx, P, '#c2453a');
    ctx.save(); ctx.translate(0, 0.35); starPath(ctx, 5, 0.6, 0.27); paint(ctx, P, '#f2c14e'); ctx.restore();
    text(ctx, P, tr('stkPack'), 0, 1.05, 0.28, '#fffaf0', { weight: 600, shadow: false, maxW: 3.3 });
  }, { res: 90, rim: 0.1 });
  pack.position.set(tall ? sx - 2.5 : sx, tall ? sy : sy + 1.3, 0.3); pack.userData.kind = 'pack'; pack.rotation.z = -0.05; scene.add(pack);
  const btn = cutMesh(3.2, 1.3, (ctx, P) => {
    rr(ctx, -1.6, -0.65, 3.2, 1.3, 0.35); paint(ctx, P, '#2f9e97');
    if (P.rim) return;
    text(ctx, P, `${tr('stkOpen')}  ${PACK_COST}`, -0.25, 0, 0.5, '#fffaf0', { maxW: 2.3 });
    ctx.save(); ctx.translate(1.15, 0); starPath(ctx, 5, 0.26, 0.12); paint(ctx, P, '#f2c14e'); ctx.restore();
  }, { res: 100, rim: 0.1 });
  btn.position.set(tall ? sx + 2.6 : sx, tall ? sy : sy - 1.55, 0.3); btn.userData.kind = 'pack'; scene.add(btn);
  K.pack = new Juicy(pack); K.btn = new Juicy(btn);
  const g = grid(), ax = g.w / 2 + 0.75;
  K.arrows = [-1, 1].map(d => {
    const m = sharedMesh(arrowMat(d)); m.position.set(S.L.main[0] + d * ax, S.L.main[1] - 0.2, 0.3); m.userData.kind = 'arrow'; m.userData.dir = d; scene.add(m);
    return new Juicy(m);
  });
}
function removeSide() {
  for (const j of [K.pack, K.btn]) if (j) { j.kill(); disposeMesh(j.mesh); }
  K.arrows.forEach(j => j.kill()); K.arrows = []; K.pack = K.btn = null;
}
function hello() { return tr('stkHello', PACK_COST, spendableStars()); }

async function openPack() {
  if (K.busy) return;
  const missing = ALL_STICKERS.filter(s => !owned(s.id));
  if (!missing.length) { say(tr('stkAll')); owlCheer(); return; }
  const have = spendableStars();
  if (have < PACK_COST) { sfx.bad(); owlTilt(); K.pack.rot.vel += 5; K.btn.punch(0.4); say(tr('stkNeed', PACK_COST - have)); return; }
  K.busy = true; K.btn.punch(0.5); sfx.tap();
  store.spent = (store.spent || 0) + PACK_COST; save(); refreshStars(); bumpStars();
  // the stars fly from the counter into the pack
  const r = document.getElementById('stars').getBoundingClientRect();
  const from = screenToWorld(r.left + r.width / 2, r.top + r.height / 2, 2.5), to = K.pack.mesh.position.clone().setZ(2.5);
  for (let i = 0; i < PACK_COST; i++) {
    const s = new Juicy(sharedMesh(miniStar())); s.mesh.position.copy(from); scene.add(s.mesh);
    tween(0.55, k => { s.mesh.position.lerpVectors(from, to, k); s.mesh.position.y += Math.sin(k * Math.PI) * 1.2; s.extra = k * 6; }, ease.inOutSine)
      .then(() => { s.kill(); sfx.star(i % 3); K.pack && K.pack.punch(0.25); });
    await wait(0.1);
  }
  await wait(0.6);
  // shake, then burst open
  await tween(0.6, k => { K.pack.extra = Math.sin(k * 40) * 0.12 * (1 - k * 0.3); }, ease.linear);
  K.pack.extra = 0; K.pack.pop(0.8); sfx.win(); S.shake = 0.35;
  burst(K.pack.mesh.position.clone().setZ(1.5), 50, { speed: 4, up: 8, z: 2 });
  const s = pick(missing); store.stickers.push(s.id); save();
  const big = new Juicy(sharedMesh(stickerMat(s.id)), 0.0001); big.mesh.position.copy(K.pack.mesh.position).setZ(3.2); scene.add(big.mesh);
  tween(0.5, k => { big.base = lerp(0.0001, 1.6, k); big.extra = (1 - k) * 6; }, ease.outBack);
  owlCheer(); say(tr('stkNew', s.name()));
  await wait(1.8);
  // turn to its page and stick it in
  const idx = ALL_STICKERS.indexOf(s), page = Math.floor(idx / PER_PAGE), k = idx % PER_PAGE;
  if (page !== K.page) await flip(0, page);
  const g = grid(), cell = K.album.group.localToWorld(cellPos(g, k)), f0 = big.mesh.position.clone(), b0 = big.base;
  await tween(0.5, t => { big.mesh.position.lerpVectors(f0, cell, t); big.mesh.position.z += Math.sin(t * Math.PI) * 1.5; big.base = lerp(b0, g.cell / 2.35, t); }, ease.inOutSine);
  big.kill(); sfx.snap();
  removeAlbum(K.album); K.album = buildAlbum(K.page);
  const placed = K.album.group.children.find(o => o.userData.sid === s.id); if (placed) { placed.userData.j.pop(0.8); placed.userData.j.punch(0.5); }
  burst(cell, 16, { speed: 3, up: 4, size: 0.8 });
  K.promptFn = hello;
  K.busy = false;
}

export const stickersGame = {
  id: 'stickers',
  levels: () => [],
  level: null,
  enter() { K.busy = false; setTray(null); setPencil(null); K.page = 0; K.album = buildAlbum(0); buildSide(); K.promptFn = hello; say(hello()); },
  exit() { removeAlbum(K.album); K.album = null; removeSide(); K.busy = false; },
  setLevel() {},
  relayout() { if (!K.album) return; removeAlbum(K.album); K.album = buildAlbum(K.page); buildSide(); },
  update(dt, t) { if (K.btn && !K.busy) K.btn.sc.t = spendableStars() >= PACK_COST ? 1 + 0.04 * Math.sin(t * 5) : 1; },
  pointer(o) {
    if (!o) return;
    const k = o.userData.kind;
    if (k === 'pack') openPack();
    else if (k === 'arrow' && !K.busy) { o.userData.j.punch(0.4); flip(o.userData.dir); }
    else if (k === 'sticker') { const j = o.userData.j, s = ALL_STICKERS.find(x => x.id === o.userData.sid); j.pop(0.5); j.punch(0.4); sfx.tap(); say(s.name(), { hop: false }); }
  },
  help() { say(hello()); K.btn && K.btn.pop(0.5); },
  prompt: () => K.promptFn(),
  idle: () => false,
  canDrag: () => false,
  dragOpts: () => null,
  onLang() { removeSide(); buildSide(); if (K.album) { removeAlbum(K.album); K.album = buildAlbum(K.page); } say(K.promptFn()); },
};
