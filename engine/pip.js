// Pip the owl: a paper cut-out mascot with a speech bubble that reads hints aloud.
import * as THREE from 'three';
import { Spring, Juicy, rand, clamp } from './util.js';
import { INK, cutMesh, paint } from './paper.js';
import { scene, camera, S, addUpdate, addPost } from './core.js';
import { speak } from './audio.js';

function drawOwl(ctx, P) {
  const tufts = () => { ctx.beginPath(); ctx.moveTo(-0.9, -0.45); ctx.lineTo(-1.0, -1.08); ctx.lineTo(-0.42, -0.78); ctx.closePath(); ctx.moveTo(0.9, -0.45); ctx.lineTo(1.0, -1.08); ctx.lineTo(0.42, -0.78); ctx.closePath(); };
  const body = () => { ctx.beginPath(); ctx.ellipse(0, 0.25, 1.0, 1.12, 0, 0, Math.PI * 2); };
  const foot = s => { ctx.beginPath(); ctx.ellipse(s * 0.35, 1.34, 0.22, 0.11, 0, 0, Math.PI * 2); };
  const capBase = () => { ctx.beginPath(); ctx.rect(-0.46, -1.0, 0.92, 0.3); };
  const cap = () => { ctx.beginPath(); ctx.moveTo(-1.05, -1.06); ctx.lineTo(0, -1.36); ctx.lineTo(1.05, -1.06); ctx.lineTo(0, -0.8); ctx.closePath(); };
  if (P.rim) { for (const f of [tufts, body, capBase, cap, () => foot(-1), () => foot(1)]) { f(); paint(ctx, P); } return; }
  foot(-1); paint(ctx, P, '#f08a3c'); foot(1); paint(ctx, P, '#f08a3c');
  tufts(); paint(ctx, P, '#9a5a2e');
  body(); paint(ctx, P, '#b8733f');
  ctx.beginPath(); ctx.ellipse(0, 0.58, 0.66, 0.68, 0, 0, Math.PI * 2); paint(ctx, P, '#f6dcb0');
  ctx.strokeStyle = '#d9a86c'; ctx.lineWidth = 0.05;
  for (const [x, y] of [[-0.3, 0.4], [0, 0.4], [0.3, 0.4], [-0.15, 0.68], [0.15, 0.68], [-0.3, 0.95], [0, 0.95], [0.3, 0.95]]) { ctx.beginPath(); ctx.arc(x, y - 0.06, 0.1, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(s * 0.42, -0.18, 0.4, 0, Math.PI * 2); paint(ctx, P, '#f2c14e');
    ctx.beginPath(); ctx.arc(s * 0.42, -0.18, 0.32, 0, Math.PI * 2); paint(ctx, P, '#fffaf0', { shadow: false });
    ctx.beginPath(); ctx.arc(s * 0.42 + 0.05, -0.14, 0.17, 0, Math.PI * 2); paint(ctx, P, INK, { shadow: false });
    ctx.beginPath(); ctx.arc(s * 0.42 + 0.11, -0.21, 0.06, 0, Math.PI * 2); paint(ctx, P, '#fff', { shadow: false });
    ctx.beginPath(); ctx.ellipse(s * 0.8, 0.14, 0.14, 0.09, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(232,87,74,.4)'; ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(-0.14, 0.08); ctx.lineTo(0.14, 0.08); ctx.lineTo(0, 0.36); ctx.closePath(); paint(ctx, P, '#f08a3c');
  capBase(); paint(ctx, P, '#3a2c26'); cap(); paint(ctx, P, '#524039');
  ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(0, -1.06); ctx.lineTo(0.78, -0.98); ctx.lineTo(0.82, -0.6); ctx.stroke();
  ctx.beginPath(); ctx.rect(0.74, -0.62, 0.16, 0.26); paint(ctx, P, '#f2c14e');
}
function drawLids(ctx) {
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(s * 0.42, -0.18, 0.41, 0, Math.PI * 2); ctx.fillStyle = '#b8733f'; ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.42, -0.3, 0.24, 0.2 * Math.PI, 0.8 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 0.07; ctx.stroke();
  }
}
function drawWing(ctx, P) {
  ctx.beginPath(); ctx.ellipse(0, 0, 0.28, 0.6, 0, 0, Math.PI * 2); paint(ctx, P, '#9a5a2e');
  if (P.rim) return;
  ctx.strokeStyle = '#7d4623'; ctx.lineWidth = 0.04;
  for (const y of [0.05, 0.25, 0.42]) { ctx.beginPath(); ctx.arc(0, y - 0.1, 0.16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
}

export const pip = { lastSay: '' };
const bubble = document.getElementById('bubble'), bubbleText = document.getElementById('bubbleText'), hudEl = document.getElementById('hud');

export function buildPip() {
  const g = new THREE.Group();
  const body = cutMesh(2.3, 2.75, drawOwl, { res: 130, rim: 0.1 }); body.userData.kind = 'owl'; g.add(body);
  const lids = cutMesh(2.3, 2.75, drawLids, { res: 130, rim: 0, shadow: false }); lids.position.z = 0.01; lids.visible = false; body.add(lids);
  const wing = s => {
    const w = cutMesh(0.62, 1.25, drawWing, { res: 130, rim: 0.08 });
    w.geometry.translate(0, -0.5, 0); w.position.set(s * 0.92, 0.1, -0.05); w.userData.kind = 'owl'; g.add(w); return w;
  };
  Object.assign(pip, { group: g, body: new Juicy(body), lids, wl: wing(-1), wr: wing(1), hop: new Spring(0, 160, 9), flap: 0, blinkT: 2 });
  scene.add(g);
  addUpdate(updatePip);
  addPost(placeBubble);
}
export function owlHop(a = 1) { pip.hop.vel += 7 * a; pip.body.punch(-0.3 * a); }
export function owlCheer() { pip.flap = 1.5; owlHop(1.3); setTimeout(() => owlHop(1), 420); }
export function owlTilt() { pip.body.rot.vel += 4.5; }
// Pip's talking rules (keep him informative but quiet):
//  - how an activity works is explained once per visit (firstTime), later only the essentials are said;
//  - correct answers get a sound, not speech (use note() to show a fact silently);
//  - mistakes and hints are spoken, briefly.
const seen = new Set();
export function resetIntros() { seen.clear(); }
export function firstTime(key) { if (seen.has(key)) return false; seen.add(key); return true; }
// show text in the bubble without speaking (tapping Pip reads it aloud)
export function note(html) { say(html, { voice: false, hop: false }); }
// speech: optional different text to read aloud (e.g. say a word without showing its spelling)
export function say(html, { voice = true, hop = true, speech = null } = {}) {
  pip.lastSay = html; pip.lastSpeech = speech; bubbleText.innerHTML = html; bubble.classList.add('show');
  bubbleText.classList.remove('pop'); void bubbleText.offsetWidth; bubbleText.classList.add('pop');
  if (hop) owlHop(0.7);
  if (voice) speak(speech || html);
  if (window.__sayLog) window.__sayLog.push((voice ? 'SAY  ' : 'note ') + (speech || html).replace(/<[^>]+>/g, '')); // test hook
}
function updatePip(dt, t) {
  const L = S.L; pip.hop.step(dt);
  pip.group.position.set(L.owl[0], L.owl[1] + pip.hop.v + Math.sin(t * 2.2) * 0.04, 0.4);
  pip.group.scale.setScalar(L.owlS);
  pip.flap = Math.max(0, pip.flap - dt);
  const fl = pip.flap > 0 ? Math.abs(Math.sin(t * 20)) * 1.1 : 0.06 + Math.sin(t * 1.6) * 0.06;
  pip.wl.rotation.z = -0.1 - fl; pip.wr.rotation.z = 0.1 + fl;
  pip.blinkT -= dt;
  if (pip.blinkT < 0) { pip.lids.visible = true; if (pip.blinkT < -0.13) { pip.lids.visible = false; pip.blinkT = rand(2, 5); } }
}
const _o = new THREE.Vector3();
function placeBubble() {
  const s = S.L.owlS;
  _o.set(S.L.owl[0] + 1.25 * s, S.L.owl[1] + 0.15 * s + pip.hop.v, 0.4).project(camera);
  const x = (_o.x + 1) / 2 * innerWidth, y = (1 - _o.y) / 2 * innerHeight;
  const left = x + 18, maxW = Math.max(180, innerWidth - left - 14);
  bubble.style.maxWidth = Math.min(maxW, S.L.name === 'tall' ? 9999 : innerWidth * 0.52) + 'px';
  bubble.style.left = left + 'px';
  const hudB = hudEl.getBoundingClientRect().bottom + 8, bh = bubble.offsetHeight;
  const top = Math.max(hudB, y - bh / 2);
  bubble.style.top = top + 'px';
  bubble.style.setProperty('--ty', clamp(y - top, 18, bh - 18) + 'px');
}
