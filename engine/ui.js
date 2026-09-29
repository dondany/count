// HUD helpers, the win celebration (banner + stars flying to the counter) and the paper-sheet scene transition.
import * as THREE from 'three';
import { Juicy, tween, wait, lerp, ease, pick, rand, mulberry } from './util.js';
import { cutMesh, cutShared, sharedMesh, paint, text, tornRect, starPath } from './paper.js';
import { scene, S, burst, screenToWorld } from './core.js';
import { sfx } from './audio.js';
import { addStars, spendableStars } from './store.js';
import { tr } from './i18n.js';

const $ = s => document.querySelector(s);
export function refreshStars() { $('#starCount').textContent = spendableStars(); }
export function bumpStars() { const el = $('#stars'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
export function setLevels(levels, current, onPick) {
  const box = $('#levels'); box.innerHTML = '';
  for (const l of levels || []) {
    const b = document.createElement('button');
    b.className = 'btn' + (l.id === current ? ' sel' : ''); b.title = l.label;
    b.innerHTML = `<span class="emo">${l.emoji}</span><span class="lbl">${l.label}</span>`;
    b.onclick = () => { box.querySelectorAll('.btn').forEach(x => x.classList.toggle('sel', x === b)); sfx.tap(); onPick(l.id); };
    box.appendChild(b);
  }
}
export function showHUD({ home, help }) { $('#home').classList.toggle('hidden', !home); $('#help').classList.toggle('hidden', !help); }
export function wiggleHelp(on) { $('#help').classList.toggle('wiggle', on); }

/* ---------- win celebration ---------- */
const banners = {};
function bannerMesh(txt) {
  return banners[txt] || (banners[txt] = cutMesh(8.6, 2.4, (ctx, P) => {
    const tail = s => { ctx.beginPath(); ctx.moveTo(s * 3.2, -0.45); ctx.lineTo(s * 4.25, -0.45); ctx.lineTo(s * 3.85, 0.2); ctx.lineTo(s * 4.25, 0.85); ctx.lineTo(s * 3.2, 0.85); ctx.closePath(); };
    tail(-1); paint(ctx, P, '#c2453a'); tail(1); paint(ctx, P, '#c2453a');
    tornRect(ctx, -3.6, -0.95, 7.2, 1.6, 0.12, 0.02, 5); paint(ctx, P, '#e8574a');
    if (P.rim) return;
    text(ctx, P, txt, 0, -0.15, 1.0, '#fffaf0', { maxW: 6.6 });
  }, { res: 100, rim: 0.12 }));
}
function starMesh(gold) {
  return sharedMesh(cutShared('star' + gold, 1.3, 1.3, (ctx, P) => { starPath(ctx, 5, 0.64, 0.3); paint(ctx, P, gold ? '#f2c14e' : '#e9dcc4'); }, { res: 110, rim: 0.08 }));
}
// called once per finished round (stats, daily challenge, adaptive level); may await its own messages
let roundHook = null;
export const setRoundHook = fn => { roundHook = fn; };
// center: world position of the work surface; stars earned fly to the HUD and are saved for gameId
export async function celebrate({ center, nStars, gameId, level = null, wrong = 0 }) {
  sfx.win(); S.shake = 0.45;
  burst(center.clone().add(new THREE.Vector3(-5, -3, 1)), 60, { speed: 4, up: 12, z: 3 });
  burst(center.clone().add(new THREE.Vector3(5, -3, 1)), 60, { speed: 4, up: 12, z: 3 });
  const m = bannerMesh(pick(tr('banners'))); m.position.set(center.x, center.y + 12, 3); scene.add(m);
  const bj = new Juicy(m, S.L.name === 'tall' ? 0.95 : 1.1);
  await tween(0.6, k => { m.position.y = center.y + 1 + (1 - k) * 12; }, ease.outBack);
  bj.punch(0.4); sfx.snap(); S.shake = 0.3;
  const stars = [];
  for (let k = 0; k < 3; k++) {
    const gold = k < nStars, s = starMesh(gold);
    s.position.set(center.x + (k - 1) * 1.6, center.y - 0.8 - (k === 1 ? 0.25 : 0), 3.2); scene.add(s);
    const j = new Juicy(s, k === 1 ? 1.25 : 1.05); j.sc.v = 0; j.sc.t = 1; j.rot.t = (k - 1) * -0.25; stars.push({ j, gold });
    if (gold) { sfx.star(k); burst(s.position, 14, { colors: ['#f2c14e', '#ffe27a', '#fffaf0'], speed: 3, up: 4 }); }
    await wait(0.24);
  }
  await wait(1.0);
  const r = $('#stars').getBoundingClientRect();
  const hud = screenToWorld(r.left + r.width / 2, r.top + r.height / 2, 3.2);
  let got = 0;
  for (const s of stars) {
    if (!s.gold) { s.j.sc.t = 0; wait(0.3).then(() => s.j.kill()); continue; }
    const from = s.j.mesh.position.clone();
    tween(0.6 + got * 0.08, k => { s.j.mesh.position.lerpVectors(from, hud, k); s.j.mesh.position.y += Math.sin(k * Math.PI) * 1.5; s.j.base = lerp(1.1, 0.35, k); }, ease.inOutSine)
      .then(() => { s.j.kill(); addStars(gameId, 1); refreshStars(); bumpStars(); sfx.star(2); });
    got++;
  }
  tween(0.5, k => { m.position.y = center.y + 1 + k * 14; }, ease.inCubic).then(() => bj.kill());
  await wait(0.8);
  if (roundHook) await roundHook({ gameId, level, nStars, wrong });
}

/* ---------- paper-sheet transition ---------- */
let sheet = null;
function makeSheet() {
  const w = 30, h = 22;
  const m = cutMesh(w, h, (ctx, P) => {
    tornRect(ctx, -w / 2, -h / 2, w, h, 0.4, 0.12, 31); paint(ctx, P, '#f4bf8e', { shadow: false });
    const r = mulberry(9), cols = ['#e8574a', '#f2c14e', '#2f9e97', '#6fae52', '#3f7fc1', '#d9508f', '#fffaf0'];
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * (w - 1), y = (r() - 0.5) * (h - 1), s = 0.25 + r() * 0.4;
      ctx.fillStyle = cols[Math.floor(r() * cols.length)]; ctx.globalAlpha = 0.55;
      if (i % 3) { ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.save(); ctx.translate(x, y); starPath(ctx, 5, s * 1.4, s * 0.65); ctx.fill(); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
  }, { res: 24, rim: 0, pad: 0.2, shadow: false });
  m.visible = false; scene.add(m); return m;
}
export async function wipe(mid) {
  if (!sheet) sheet = makeSheet();
  const z = 10, a = screenToWorld(0, 0, z), b = screenToWorld(innerWidth, innerHeight, z);
  const W = Math.abs(b.x - a.x), H = Math.abs(b.y - a.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const s = Math.max(W * 1.25 / 30, H * 1.3 / 22);
  sheet.scale.set(s, s, 1); sheet.visible = true; sheet.rotation.z = rand(-0.04, 0.04);
  const span = W / 2 + 15 * s;
  sfx.paper();
  await tween(0.42, k => sheet.position.set(cx + span * (1 - k), cy, z), ease.inOutSine);
  await mid();
  await wait(0.08);
  sfx.paper();
  await tween(0.45, k => sheet.position.set(cx - span * k, cy, z), ease.inOutSine);
  sheet.visible = false;
}
