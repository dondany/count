// Paper-cut illustrations shared by Words, Animals and the sticker album.
// Every draw(ctx, P) works in a ±1.4 box (y down) and paints with paint(), so the rim pass gives a white paper edge.
import { INK, paint, rr, starPath } from '../engine/paper.js';

const TAU = Math.PI * 2;
const C = (ctx, P, x, y, r, col) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); paint(ctx, P, col); };
const E = (ctx, P, x, y, rx, ry, col, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); paint(ctx, P, col); };
const G = (ctx, P, pts, col) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); paint(ctx, P, col); };
const B = (ctx, P, x, y, w, h, r, col) => { rr(ctx, x, y, w, h, r); paint(ctx, P, col); };
const line = (ctx, P, pts, col = INK, lw = 0.06) => { if (P.rim) return; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
const arcLine = (ctx, P, x, y, r, a0, a1, col = INK, lw = 0.06) => { if (P.rim) return; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
function eyes(ctx, P, x, y, dx, r = 0.12) {
  if (P.rim) return;
  for (const s of [-1, 1]) { C(ctx, P, x + s * dx, y, r, INK); C(ctx, P, x + s * dx + r * 0.35, y - r * 0.35, r * 0.35, '#fff'); }
}
const smile = (ctx, P, x, y, r = 0.22) => arcLine(ctx, P, x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);

/* ---------- things (for Words) ---------- */
export const PICS = {
  sun: { en: 'SUN', pl: 'SŁOŃCE', draw: (ctx, P) => { starPath(ctx, 12, 1.4, 1.05); paint(ctx, P, '#ffb347'); C(ctx, P, 0, 0, 0.9, '#ffd35a'); arcLine(ctx, P, -0.3, -0.05, 0.14, Math.PI * 1.1, Math.PI * 1.9); arcLine(ctx, P, 0.3, -0.05, 0.14, Math.PI * 1.1, Math.PI * 1.9); smile(ctx, P, 0, 0.2, 0.3); } },
  cat: { en: 'CAT', pl: 'KOT', draw: (ctx, P) => {
    G(ctx, P, [[-0.95, -0.25], [-0.8, -1.2], [-0.2, -0.75]], '#f08a3c'); G(ctx, P, [[0.95, -0.25], [0.8, -1.2], [0.2, -0.75]], '#f08a3c');
    E(ctx, P, 0, 0.15, 1.05, 0.9, '#f08a3c');
    if (!P.rim) { G(ctx, P, [[-0.75, -0.55], [-0.72, -0.95], [-0.45, -0.72]], '#f7b7a3'); G(ctx, P, [[0.75, -0.55], [0.72, -0.95], [0.45, -0.72]], '#f7b7a3'); }
    eyes(ctx, P, 0, 0, 0.38, 0.14); G(ctx, P, [[-0.12, 0.3], [0.12, 0.3], [0, 0.45]], '#e86a7a');
    for (const s of [-1, 1]) { line(ctx, P, [[s * 0.25, 0.42], [s * 1.0, 0.3]], INK, 0.035); line(ctx, P, [[s * 0.25, 0.5], [s * 1.0, 0.58]], INK, 0.035); }
  } },
  dog: { en: 'DOG', pl: 'PIES', draw: (ctx, P) => {
    E(ctx, P, -0.9, 0.1, 0.3, 0.7, '#8a5a3b', 0.35); E(ctx, P, 0.9, 0.1, 0.3, 0.7, '#8a5a3b', -0.35);
    E(ctx, P, 0, 0.1, 0.85, 0.95, '#c8894f'); E(ctx, P, 0, 0.55, 0.48, 0.38, '#f3dcc0');
    eyes(ctx, P, 0, -0.15, 0.32, 0.13); C(ctx, P, 0, 0.38, 0.15, INK); smile(ctx, P, 0, 0.5, 0.18);
  } },
  fish: { en: 'FISH', pl: 'RYBA', draw: (ctx, P) => {
    G(ctx, P, [[0.7, 0], [1.4, -0.65], [1.4, 0.65]], '#3f7fc1'); E(ctx, P, -0.15, 0, 1.05, 0.7, '#5aa7e0');
    G(ctx, P, [[-0.2, -0.6], [0.3, -1.0], [0.4, -0.5]], '#3f7fc1'); eyes(ctx, P, -0.65, -0.15, 0, 0.13);
    arcLine(ctx, P, 0.1, 0, 0.45, -0.9, 0.9, 'rgba(255,255,255,.6)', 0.07); arcLine(ctx, P, 0.45, 0, 0.35, -0.9, 0.9, 'rgba(255,255,255,.6)', 0.07);
  } },
  house: { en: 'HOUSE', pl: 'DOM', draw: (ctx, P) => {
    B(ctx, P, -1.0, -0.25, 2.0, 1.55, 0.05, '#f2c14e'); G(ctx, P, [[-1.3, -0.2], [0, -1.35], [1.3, -0.2]], '#e8574a');
    B(ctx, P, -0.28, 0.4, 0.56, 0.9, 0.08, '#8a5a3b'); B(ctx, P, 0.38, 0.05, 0.45, 0.42, 0.05, '#cde6f5'); B(ctx, P, -0.83, 0.05, 0.45, 0.42, 0.05, '#cde6f5');
  } },
  tree: { en: 'TREE', pl: 'DRZEWO', draw: (ctx, P) => {
    B(ctx, P, -0.18, 0.2, 0.36, 1.15, 0.05, '#8a5a3b'); C(ctx, P, -0.55, 0.0, 0.6, '#5f9844'); C(ctx, P, 0.55, 0.0, 0.6, '#5f9844'); C(ctx, P, 0, -0.45, 0.85, '#6fae52');
    C(ctx, P, -0.3, -0.5, 0.12, '#e8574a'); C(ctx, P, 0.35, -0.2, 0.12, '#e8574a'); C(ctx, P, 0.1, -0.85, 0.12, '#e8574a');
  } },
  ball: { en: 'BALL', pl: 'PIŁKA', draw: (ctx, P) => {
    C(ctx, P, 0, 0, 1.15, '#fffaf0'); if (P.rim) return;
    ['#e8574a', '#3f7fc1', '#f2c14e'].forEach((col, i) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1.15, i * TAU / 3, i * TAU / 3 + TAU / 6); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); });
    C(ctx, P, 0, 0, 0.2, '#fffaf0');
  } },
  apple: { en: 'APPLE', pl: 'JABŁKO', draw: (ctx, P) => {
    B(ctx, P, -0.06, -1.05, 0.12, 0.45, 0.05, '#8a5a3b'); E(ctx, P, 0.35, -0.85, 0.32, 0.15, '#6fae52', -0.5);
    C(ctx, P, -0.35, 0.2, 0.78, '#e8574a'); C(ctx, P, 0.35, 0.2, 0.78, '#e8574a'); if (!P.rim) E(ctx, P, -0.45, -0.1, 0.16, 0.28, 'rgba(255,255,255,.45)', 0.4);
  } },
  star: { en: 'STAR', pl: 'GWIAZDA', draw: (ctx, P) => { starPath(ctx, 5, 1.35, 0.6); paint(ctx, P, '#f2c14e'); eyes(ctx, P, 0, 0.05, 0.25, 0.1); smile(ctx, P, 0, 0.2, 0.18); } },
  car: { en: 'CAR', pl: 'AUTO', draw: (ctx, P) => {
    G(ctx, P, [[-0.75, -0.05], [-0.45, -0.7], [0.5, -0.7], [0.85, -0.05]], '#e8574a'); B(ctx, P, -1.35, -0.15, 2.7, 0.8, 0.25, '#e8574a');
    if (!P.rim) { G(ctx, P, [[-0.6, -0.1], [-0.38, -0.58], [0, -0.58], [0, -0.1]], '#cde6f5'); G(ctx, P, [[0.1, -0.1], [0.1, -0.58], [0.45, -0.58], [0.68, -0.1]], '#cde6f5'); }
    for (const x of [-0.7, 0.7]) { C(ctx, P, x, 0.68, 0.34, INK); C(ctx, P, x, 0.68, 0.13, '#bdb6ad'); }
  } },
  egg: { en: 'EGG', pl: 'JAJKO', draw: (ctx, P) => { E(ctx, P, 0, 0.1, 0.82, 1.1, '#fdf3dc'); if (!P.rim) { E(ctx, P, -0.3, -0.35, 0.14, 0.22, 'rgba(255,255,255,.8)', 0.4); C(ctx, P, 0.3, 0.3, 0.1, '#e9d3b0'); } } },
  hat: { en: 'HAT', pl: 'CZAPKA', draw: (ctx, P) => {
    C(ctx, P, 0, -1.0, 0.3, '#fffaf0'); ctx.beginPath(); ctx.arc(0, 0.25, 1.1, Math.PI, 0); ctx.closePath(); paint(ctx, P, '#3f7fc1');
    B(ctx, P, -1.2, 0.15, 2.4, 0.55, 0.2, '#2f5f9a'); for (const x of [-0.5, 0, 0.5]) line(ctx, P, [[x, -0.7 + Math.abs(x) * 0.4], [x, 0.1]], 'rgba(255,255,255,.35)', 0.06);
  } },
  owl: { en: 'OWL', pl: 'SOWA', draw: (ctx, P) => {
    G(ctx, P, [[-0.85, -0.5], [-0.9, -1.2], [-0.35, -0.85]], '#9a5a2e'); G(ctx, P, [[0.85, -0.5], [0.9, -1.2], [0.35, -0.85]], '#9a5a2e');
    E(ctx, P, 0, 0.15, 0.95, 1.1, '#b8733f'); E(ctx, P, 0, 0.5, 0.6, 0.62, '#f6dcb0');
    for (const s of [-1, 1]) { C(ctx, P, s * 0.4, -0.3, 0.36, '#fffaf0'); C(ctx, P, s * 0.4, -0.28, 0.17, INK); }
    G(ctx, P, [[-0.13, -0.05], [0.13, -0.05], [0, 0.22]], '#f08a3c');
  } },
  flower: { en: 'FLOWER', pl: 'KWIAT', draw: (ctx, P) => {
    B(ctx, P, -0.06, 0.1, 0.12, 1.3, 0.05, '#6fae52'); E(ctx, P, 0.35, 0.8, 0.35, 0.15, '#6fae52', -0.5);
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; C(ctx, P, Math.cos(a) * 0.5, -0.4 + Math.sin(a) * 0.5, 0.36, '#d9508f'); }
    C(ctx, P, 0, -0.4, 0.32, '#f2c14e');
  } },
  boat: { en: 'BOAT', pl: 'ŁÓDKA', draw: (ctx, P) => {
    B(ctx, P, -0.05, -1.25, 0.1, 1.6, 0.03, '#8a5a3b'); G(ctx, P, [[0.1, -1.15], [0.1, 0.2], [1.0, 0.2]], '#fffaf0'); G(ctx, P, [[-0.1, -1.0], [-0.1, 0.2], [-0.8, 0.2]], '#f2c14e');
    G(ctx, P, [[-1.35, 0.35], [1.35, 0.35], [0.95, 0.95], [-0.95, 0.95]], '#a0643b'); line(ctx, P, [[-1.1, 0.55], [1.1, 0.55]], 'rgba(255,255,255,.35)', 0.07);
  } },
  key: { en: 'KEY', pl: 'KLUCZ', draw: (ctx, P) => {
    B(ctx, P, -0.35, -0.13, 1.65, 0.26, 0.06, '#f2c14e'); B(ctx, P, 0.95, 0.08, 0.16, 0.38, 0.03, '#f2c14e'); B(ctx, P, 1.2, 0.08, 0.14, 0.28, 0.03, '#f2c14e');
    C(ctx, P, -0.75, 0, 0.55, '#f2c14e'); C(ctx, P, -0.75, 0, 0.2, '#c9a13c');
  } },
  cup: { en: 'CUP', pl: 'KUBEK', draw: (ctx, P) => {
    ctx.beginPath(); ctx.arc(0.6, 0.2, 0.45, -Math.PI / 2, Math.PI / 2); ctx.arc(0.6, 0.2, 0.22, Math.PI / 2, -Math.PI / 2, true); ctx.closePath(); paint(ctx, P, '#2f9e97');
    B(ctx, P, -0.85, -0.5, 1.45, 1.45, 0.22, '#2f9e97'); if (!P.rim) C(ctx, P, -0.15, 0.25, 0.25, '#fffaf0');
    for (const x of [-0.45, 0, 0.35]) line(ctx, P, [[x, -0.7], [x + 0.1, -0.95], [x, -1.2]], 'rgba(122,93,73,.5)', 0.05);
  } },
  heart: { en: 'HEART', pl: 'SERCE', draw: (ctx, P) => {
    ctx.beginPath(); ctx.moveTo(0, 1.1); ctx.bezierCurveTo(-1.7, -0.1, -0.7, -1.4, 0, -0.5); ctx.bezierCurveTo(0.7, -1.4, 1.7, -0.1, 0, 1.1); ctx.closePath(); paint(ctx, P, '#e8574a');
    if (!P.rim) E(ctx, P, -0.55, -0.4, 0.15, 0.25, 'rgba(255,255,255,.45)', 0.5);
  } },
  duck: { en: 'DUCK', pl: 'KACZKA', draw: (ctx, P) => {
    E(ctx, P, 0.15, 0.4, 1.05, 0.62, '#f2c14e'); C(ctx, P, -0.55, -0.4, 0.52, '#f2c14e');
    G(ctx, P, [[-1.0, -0.45], [-1.45, -0.3], [-1.0, -0.2]], '#f08a3c'); eyes(ctx, P, -0.65, -0.55, 0, 0.1); E(ctx, P, 0.3, 0.35, 0.5, 0.28, '#e9a825', -0.2);
  } },
  balloon: { en: 'BALLOON', pl: 'BALON', draw: (ctx, P) => {
    line(ctx, P, [[0, 0.65], [0.15, 0.95], [-0.1, 1.2], [0.05, 1.4]], INK, 0.04); G(ctx, P, [[-0.12, 0.72], [0.12, 0.72], [0, 0.58]], '#c2453a');
    E(ctx, P, 0, -0.35, 0.8, 1.0, '#e8574a'); if (!P.rim) E(ctx, P, -0.35, -0.7, 0.14, 0.26, 'rgba(255,255,255,.5)', 0.4);
  } },
  leaf: { en: 'LEAF', pl: 'LIŚĆ', draw: (ctx, P) => {
    ctx.beginPath(); ctx.moveTo(-1.2, 1.1); ctx.quadraticCurveTo(-1.0, -1.1, 1.2, -1.1); ctx.quadraticCurveTo(1.0, 1.0, -1.2, 1.1); ctx.closePath(); paint(ctx, P, '#e8a15a');
    line(ctx, P, [[-1.2, 1.1], [0.9, -0.85]], '#b8733f', 0.06); line(ctx, P, [[-0.4, 0.35], [-0.5, -0.25]], '#b8733f', 0.04); line(ctx, P, [[0.1, -0.15], [0.55, 0.15]], '#b8733f', 0.04);
  } },
  mouse: { en: 'MOUSE', pl: 'MYSZ', draw: (ctx, P) => {
    line(ctx, P, [[0.95, 0.5], [1.3, 0.2], [1.2, -0.3]], '#9a8f86', 0.07);
    C(ctx, P, -0.55, -0.55, 0.38, '#b9b4ad'); C(ctx, P, 0.05, -0.65, 0.38, '#b9b4ad'); E(ctx, P, 0.1, 0.3, 1.0, 0.68, '#b9b4ad');
    if (!P.rim) { C(ctx, P, -0.55, -0.55, 0.22, '#f2b8c6'); C(ctx, P, 0.05, -0.65, 0.22, '#f2b8c6'); }
    eyes(ctx, P, -0.45, 0.05, 0, 0.1); C(ctx, P, -0.92, 0.3, 0.1, '#e86a7a');
  } },
  bus: { en: 'BUS', pl: 'AUTOBUS', draw: (ctx, P) => {
    B(ctx, P, -1.4, -0.75, 2.8, 1.4, 0.25, '#f2c14e'); if (!P.rim) for (let k = 0; k < 4; k++) B(ctx, P, -1.2 + k * 0.62, -0.55, 0.48, 0.45, 0.06, '#cde6f5');
    B(ctx, P, -1.4, 0.2, 2.8, 0.12, 0.03, '#e8574a'); for (const x of [-0.8, 0.8]) { C(ctx, P, x, 0.68, 0.3, INK); C(ctx, P, x, 0.68, 0.11, '#bdb6ad'); }
  } },
};

/* ---------- animals (for Animals + stickers). cont: 0 EU, 1 AS, 2 AF, 3 NA, 4 SA, 5 OC ---------- */
const A = (id, cont, lon, lat, en, pl, easy, draw) => ({ id, cont, lon, lat, name: { en, pl }, easy, draw });
export const ANIMALS = [
  A('kangaroo', 5, 134, -24, 'kangaroo', 'kangur', true, (ctx, P) => {
    E(ctx, P, -0.42, -0.85, 0.2, 0.55, '#b87a42', -0.15); E(ctx, P, 0.42, -0.85, 0.2, 0.55, '#b87a42', 0.15);
    E(ctx, P, 0, 0.1, 0.75, 0.85, '#c98a50'); E(ctx, P, 0, 0.55, 0.42, 0.32, '#e0b07a'); eyes(ctx, P, 0, -0.1, 0.3); C(ctx, P, 0, 0.42, 0.12, INK); smile(ctx, P, 0, 0.55, 0.14);
  }),
  A('koala', 5, 148, -30, 'koala', 'koala', true, (ctx, P) => {
    C(ctx, P, -0.9, -0.5, 0.5, '#9aa0a6'); C(ctx, P, 0.9, -0.5, 0.5, '#9aa0a6'); if (!P.rim) { C(ctx, P, -0.9, -0.5, 0.28, '#e8d9e0'); C(ctx, P, 0.9, -0.5, 0.28, '#e8d9e0'); }
    C(ctx, P, 0, 0.12, 0.95, '#b3b8bd'); eyes(ctx, P, 0, -0.1, 0.4); E(ctx, P, 0, 0.3, 0.25, 0.36, INK);
  }),
  A('kiwi', 5, 174, -40, 'kiwi', 'kiwi', false, (ctx, P) => {
    line(ctx, P, [[0.1, 0.8], [0, 1.25]], '#c9a13c', 0.08); line(ctx, P, [[0.5, 0.8], [0.55, 1.25]], '#c9a13c', 0.08);
    G(ctx, P, [[-0.55, -0.15], [-1.45, 0.55], [-0.5, 0.05]], '#d9b36a'); E(ctx, P, 0.25, 0.15, 0.95, 0.75, '#8a6a45'); eyes(ctx, P, -0.4, -0.2, 0, 0.09);
  }),
  A('panda', 1, 104, 31, 'panda', 'panda', true, (ctx, P) => {
    C(ctx, P, -0.75, -0.72, 0.36, INK); C(ctx, P, 0.75, -0.72, 0.36, INK); C(ctx, P, 0, 0.1, 1.0, '#fffaf0');
    E(ctx, P, -0.38, 0.0, 0.24, 0.32, INK, 0.5); E(ctx, P, 0.38, 0.0, 0.24, 0.32, INK, -0.5);
    if (!P.rim) { C(ctx, P, -0.36, -0.02, 0.08, '#fff'); C(ctx, P, 0.36, -0.02, 0.08, '#fff'); }
    E(ctx, P, 0, 0.42, 0.15, 0.1, INK); smile(ctx, P, 0, 0.5, 0.15);
  }),
  A('tiger', 1, 80, 23, 'tiger', 'tygrys', true, (ctx, P) => {
    C(ctx, P, -0.7, -0.72, 0.32, '#f08a3c'); C(ctx, P, 0.7, -0.72, 0.32, '#f08a3c'); C(ctx, P, 0, 0.1, 1.0, '#f08a3c'); E(ctx, P, 0, 0.5, 0.55, 0.38, '#fffaf0');
    for (const s of [-1, 1]) { line(ctx, P, [[s * 0.95, -0.1], [s * 0.6, 0.0]], INK, 0.08); line(ctx, P, [[s * 0.92, 0.25], [s * 0.6, 0.25]], INK, 0.08); }
    line(ctx, P, [[-0.15, -0.85], [0, -0.55], [0.15, -0.85]], INK, 0.08);
    eyes(ctx, P, 0, -0.15, 0.35); G(ctx, P, [[-0.13, 0.32], [0.13, 0.32], [0, 0.45]], '#e86a7a');
  }),
  A('orangutan', 1, 114, 1, 'orangutan', 'orangutan', false, (ctx, P) => {
    C(ctx, P, 0, 0, 1.1, '#c0602a'); E(ctx, P, 0, 0.2, 0.68, 0.72, '#e8b88a'); eyes(ctx, P, 0, -0.1, 0.25); E(ctx, P, 0, 0.45, 0.3, 0.18, '#d49a70'); smile(ctx, P, 0, 0.45, 0.2);
  }),
  A('lion', 2, 22, 3, 'lion', 'lew', true, (ctx, P) => {
    starPath(ctx, 14, 1.38, 1.05); paint(ctx, P, '#c9731f'); C(ctx, P, 0, 0.05, 0.82, '#f2b33d');
    C(ctx, P, -0.55, -0.6, 0.2, '#f2b33d'); C(ctx, P, 0.55, -0.6, 0.2, '#f2b33d'); E(ctx, P, 0, 0.4, 0.4, 0.3, '#fbe3b0');
    eyes(ctx, P, 0, -0.1, 0.3); G(ctx, P, [[-0.13, 0.28], [0.13, 0.28], [0, 0.42]], '#8a5a3b');
  }),
  A('giraffe', 2, 36, 1, 'giraffe', 'żyrafa', true, (ctx, P) => {
    for (const s of [-1, 1]) { B(ctx, P, s * 0.3 - 0.05, -1.3, 0.1, 0.5, 0.03, '#c9a13c'); C(ctx, P, s * 0.3, -1.3, 0.12, '#8a5a3b'); E(ctx, P, s * 0.75, -0.6, 0.35, 0.14, '#f2c14e', s * 0.4); }
    E(ctx, P, 0, 0.05, 0.62, 0.95, '#f2c14e'); if (!P.rim) for (const [x, y] of [[-0.3, -0.5], [0.3, -0.3], [-0.35, 0.2], [0.35, 0.3]]) C(ctx, P, x, y, 0.12, '#c98a50');
    E(ctx, P, 0, 0.72, 0.45, 0.3, '#e0a458'); eyes(ctx, P, 0, -0.15, 0.3); C(ctx, P, -0.12, 0.7, 0.05, INK); C(ctx, P, 0.12, 0.7, 0.05, INK);
  }),
  A('zebra', 2, 32, -10, 'zebra', 'zebra', true, (ctx, P) => {
    G(ctx, P, [[-0.5, -0.8], [-0.7, -1.3], [-0.2, -0.95]], '#fffaf0'); G(ctx, P, [[0.5, -0.8], [0.7, -1.3], [0.2, -0.95]], '#fffaf0');
    E(ctx, P, 0, 0.05, 0.65, 1.02, '#fffaf0');
    for (const y of [-0.6, -0.3, 0.0, 0.25]) { line(ctx, P, [[-0.62, y], [-0.25, y + 0.08]], INK, 0.09); line(ctx, P, [[0.62, y], [0.25, y + 0.08]], INK, 0.09); }
    line(ctx, P, [[-0.15, -0.95], [0, -0.7], [0.15, -0.95]], INK, 0.09);
    E(ctx, P, 0, 0.75, 0.48, 0.32, '#5b5b5b'); eyes(ctx, P, 0, -0.15, 0.33, 0.1); C(ctx, P, -0.14, 0.72, 0.05, INK); C(ctx, P, 0.14, 0.72, 0.05, INK);
  }),
  A('hippo', 2, 24, -15, 'hippo', 'hipopotam', false, (ctx, P) => {
    C(ctx, P, -0.55, -0.65, 0.2, '#9b8fb5'); C(ctx, P, 0.55, -0.65, 0.2, '#9b8fb5'); E(ctx, P, 0, -0.15, 0.9, 0.65, '#9b8fb5');
    E(ctx, P, 0, 0.5, 1.15, 0.58, '#b3a7cc'); eyes(ctx, P, 0, -0.35, 0.35); C(ctx, P, -0.35, 0.4, 0.08, INK); C(ctx, P, 0.35, 0.4, 0.08, INK); smile(ctx, P, 0, 0.55, 0.4);
  }),
  A('raccoon', 3, -90, 40, 'raccoon', 'szop pracz', true, (ctx, P) => {
    G(ctx, P, [[-0.9, -0.4], [-0.75, -1.15], [-0.25, -0.75]], '#8a8f94'); G(ctx, P, [[0.9, -0.4], [0.75, -1.15], [0.25, -0.75]], '#8a8f94');
    C(ctx, P, 0, 0.12, 0.95, '#a7acb1'); E(ctx, P, 0, 0.0, 0.85, 0.3, '#3a3f44'); if (!P.rim) { C(ctx, P, -0.35, 0, 0.12, '#fff'); C(ctx, P, 0.35, 0, 0.12, '#fff'); }
    E(ctx, P, 0, 0.55, 0.42, 0.3, '#fffaf0'); C(ctx, P, 0, 0.42, 0.11, INK);
  }),
  A('eagle', 3, -118, 55, 'bald eagle', 'bielik', false, (ctx, P) => {
    E(ctx, P, 0, 1.0, 1.25, 0.5, '#6b4a2e'); E(ctx, P, 0, -0.1, 0.78, 0.9, '#fffaf0');
    G(ctx, P, [[-0.2, 0.05], [-0.9, 0.2], [-0.95, 0.55], [-0.6, 0.35], [-0.15, 0.3]], '#f2c14e'); eyes(ctx, P, -0.25, -0.25, 0, 0.1);
    line(ctx, P, [[-0.45, -0.45], [-0.05, -0.38]], INK, 0.06);
  }),
  A('llama', 4, -68, -18, 'llama', 'lama', true, (ctx, P) => {
    B(ctx, P, -0.35, 0.1, 0.7, 1.3, 0.2, '#f3e2c8'); E(ctx, P, -0.35, -1.1, 0.12, 0.35, '#f3e2c8', -0.2); E(ctx, P, 0.35, -1.1, 0.12, 0.35, '#f3e2c8', 0.2);
    E(ctx, P, 0, -0.3, 0.55, 0.72, '#f3e2c8'); C(ctx, P, 0, -0.95, 0.3, '#fffaf0'); E(ctx, P, 0, 0.12, 0.32, 0.25, '#e9d3b0');
    eyes(ctx, P, 0, -0.45, 0.25, 0.1); smile(ctx, P, 0, 0.1, 0.12);
  }),
  A('sloth', 4, -60, -5, 'sloth', 'leniwiec', false, (ctx, P) => {
    C(ctx, P, 0, 0.05, 1.0, '#b39a7c'); E(ctx, P, 0, 0.15, 0.78, 0.62, '#e8d6bd');
    E(ctx, P, -0.35, 0.02, 0.3, 0.18, '#6b4a2e', 0.4); E(ctx, P, 0.35, 0.02, 0.3, 0.18, '#6b4a2e', -0.4);
    if (!P.rim) { C(ctx, P, -0.35, 0.02, 0.08, '#fff'); C(ctx, P, 0.35, 0.02, 0.08, '#fff'); } E(ctx, P, 0, 0.32, 0.14, 0.09, INK); smile(ctx, P, 0, 0.35, 0.2);
  }),
  A('toucan', 4, -55, -12, 'toucan', 'tukan', true, (ctx, P) => {
    E(ctx, P, 0.45, 0.3, 0.72, 0.95, '#2b2b2b'); E(ctx, P, 0.2, -0.05, 0.38, 0.35, '#fffaf0');
    ctx.beginPath(); ctx.moveTo(0.0, -0.45); ctx.quadraticCurveTo(-1.2, -0.55, -1.4, 0.05); ctx.quadraticCurveTo(-0.6, -0.05, 0.0, 0.05); ctx.closePath(); paint(ctx, P, '#f08a3c');
    if (!P.rim) { ctx.beginPath(); ctx.moveTo(0.0, -0.45); ctx.quadraticCurveTo(-0.7, -0.5, -0.9, -0.3); ctx.lineTo(0, -0.2); ctx.closePath(); ctx.fillStyle = '#f2c14e'; ctx.fill(); }
    C(ctx, P, 0.3, -0.35, 0.14, '#5aa7e0'); C(ctx, P, 0.3, -0.35, 0.07, INK);
  }),
  A('wisent', 0, 23.5, 52.7, 'European bison', 'żubr', true, (ctx, P) => {
    G(ctx, P, [[-0.7, -0.55], [-1.2, -0.75], [-1.15, -1.1], [-0.95, -0.8], [-0.6, -0.75]], '#efe4d0'); G(ctx, P, [[0.7, -0.55], [1.2, -0.75], [1.15, -1.1], [0.95, -0.8], [0.6, -0.75]], '#efe4d0');
    E(ctx, P, 0, -0.45, 0.95, 0.55, '#4f3620'); E(ctx, P, 0, 0.2, 0.82, 0.78, '#6b4a2e'); E(ctx, P, 0, 0.95, 0.38, 0.3, '#4f3620');
    E(ctx, P, 0, 0.45, 0.4, 0.28, '#8a6a45'); eyes(ctx, P, 0, 0, 0.35, 0.1); C(ctx, P, -0.13, 0.45, 0.06, INK); C(ctx, P, 0.13, 0.45, 0.06, INK);
  }),
  A('chamois', 0, 10, 46.5, 'chamois', 'kozica', false, (ctx, P) => {
    for (const s of [-1, 1]) G(ctx, P, [[s * 0.25, -0.6], [s * 0.3, -1.25], [s * 0.55, -1.3], [s * 0.5, -1.1], [s * 0.4, -1.15], [s * 0.38, -0.6]], '#2b2b2b');
    E(ctx, P, -0.7, -0.45, 0.35, 0.14, '#b07a4a', 0.4); E(ctx, P, 0.7, -0.45, 0.35, 0.14, '#b07a4a', -0.4);
    E(ctx, P, 0, 0.1, 0.6, 0.9, '#f3e2c8'); for (const s of [-1, 1]) line(ctx, P, [[s * 0.3, -0.55], [s * 0.35, 0.1], [s * 0.2, 0.55]], '#4f3620', 0.14);
    eyes(ctx, P, 0, -0.1, 0.32, 0.09); E(ctx, P, 0, 0.8, 0.22, 0.12, INK);
  }),
];
