// Geography data: rough continent outlines (lon/lat), countries with capitals, and flags drawn with canvas.
// Continent index: 0 Europe, 1 Asia, 2 Africa, 3 North America, 4 South America, 5 Oceania.

export const CONTINENTS = [
  { color: '#eaa2b6', label: [16, 64], polys: [
    [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [0, 49], [4, 52], [8, 54], [8, 57], [5, 58], [5, 62], [12, 65], [18, 70], [28, 71], [40, 68], [45, 68], [60, 69], [60, 55], [50, 47], [40, 47], [38, 45], [29, 41], [26, 40], [23, 36], [20, 40], [19, 42], [16, 38], [12, 38], [15, 41], [12, 44], [8, 44], [3, 43], [0, 38], [-5, 36]],
    [[-6, 50], [2, 51], [1, 53], [-2, 56], [-3, 58.5], [-6, 58], [-5, 55], [-3, 54]],
    [[-6, 52], [-6, 55], [-10, 54], [-10, 51.5]],
    [[-24, 64], [-14, 64], [-13, 66], [-22, 66.5]],
  ] },
  { color: '#f2b58b', label: [95, 52], polys: [
    [[26, 40], [36, 36], [35, 33], [34, 28], [38, 21], [43, 13], [52, 17], [58, 21], [56, 26], [62, 25], [67, 24], [72, 20], [77, 8], [80, 15], [88, 22], [92, 21], [98, 16], [100, 13], [103, 1], [104, 10], [108, 15], [106, 20], [110, 21], [117, 24], [122, 30], [121, 40], [126, 38], [129, 35], [129, 42], [135, 43], [142, 47], [141, 53], [155, 59], [162, 58], [170, 60], [180, 66], [180, 69], [160, 70], [140, 72], [113, 73], [105, 78], [95, 76], [80, 73], [68, 70], [60, 69], [60, 55], [50, 47], [40, 47], [38, 45], [29, 41]],
    [[130, 31], [135, 34], [140, 35], [142, 40], [141, 45], [145, 44], [140, 41], [137, 37], [132, 34]],
    [[95, 5], [106, -6], [102, -5], [96, 1]],
    [[109, 2], [117, 7], [119, 1], [116, -4], [110, -3]],
    [[105, -6], [115, -8], [106, -7.5]],
    [[80, 9.5], [82, 7], [81, 6], [79.8, 7]],
  ] },
  { color: '#f2cf6b', label: [18, 8], polys: [
    [[-17, 15], [-17, 21], [-13, 28], [-9, 32], [-5, 36], [10, 37], [11, 33], [20, 31], [32, 31], [35, 28], [43, 12], [51, 12], [51, 11], [44, 4], [40, -3], [40, -15], [35, -24], [33, -27], [27, -34], [19, -35], [15, -27], [12, -17], [13, -10], [9, -1], [9, 4], [5, 6], [-8, 4], [-13, 8], [-17, 13]],
    [[43, -12], [50, -16], [47, -25], [44, -24]],
  ] },
  { color: '#9fd0c2', label: [-100, 52], polys: [
    [[-168, 66], [-162, 70], [-140, 70], [-125, 72], [-95, 74], [-80, 73], [-62, 67], [-55, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-82, 27], [-84, 30], [-90, 29], [-97, 26], [-97, 21], [-92, 18], [-88, 16], [-83, 10], [-79, 9], [-81, 8], [-86, 12], [-92, 14], [-100, 17], [-106, 23], [-112, 29], [-110, 23], [-115, 30], [-118, 34], [-124, 40], [-124, 48], [-130, 55], [-140, 60], [-152, 58], [-165, 60]],
    [[-50, 60], [-42, 60], [-20, 70], [-18, 80], [-40, 83], [-65, 80], [-72, 77], [-55, 70]],
    [[-85, 22], [-74, 20], [-78, 22.5]],
  ] },
  { color: '#b5d47c', label: [-58, -16], polys: [
    [[-80, 9], [-72, 12], [-62, 10], [-52, 5], [-35, -5], [-38, -13], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-65, -41], [-66, -47], [-69, -52], [-72, -54], [-75, -50], [-74, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 1], [-78, 7]],
  ] },
  { color: '#c3aee6', label: [128, -40], polys: [
    [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -25], [151, -34], [145, -38], [138, -35], [131, -31], [115, -34], [114, -28]],
    [[172, -35], [178, -38], [174, -41], [171, -45], [167, -46], [172, -41]],
    [[131, -1], [141, -3], [150, -10], [141, -9], [137, -5]],
  ] },
];

/* ---------- flag painting helpers (canvas y points down; flag spans -w/2..w/2, -h/2..h/2) ---------- */
const hs = (cols, wts) => (c, w, h) => {
  const W = wts || cols.map(() => 1), tot = W.reduce((a, b) => a + b, 0); let y = -h / 2;
  cols.forEach((col, i) => { const hh = h * W[i] / tot; c.fillStyle = col; c.fillRect(-w / 2, y, w, hh + 0.004); y += hh; });
};
const vs = cols => (c, w, h) => { let x = -w / 2; const ww = w / cols.length; cols.forEach(col => { c.fillStyle = col; c.fillRect(x, -h / 2, ww + 0.004, h); x += ww; }); };
function star(c, x, y, r, col, n = 5, rot = 0) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r * (n === 5 ? 0.4 : 0.5) : r, a = -Math.PI / 2 + rot + i * Math.PI / n; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = col; c.fill();
}
const dot = (c, x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
const bg = (c, w, h, col) => { c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h); };
const nordic = (back, cross, inner) => (c, w, h) => {
  bg(c, w, h, back); const cx = -w / 2 + w * 0.36;
  const bar = (t, col) => { c.fillStyle = col; c.fillRect(cx - t / 2, -h / 2, t, h); c.fillRect(-w / 2, -t / 2, w, t); };
  bar(h * 0.22, cross); if (inner) bar(h * 0.11, inner);
};
function union(c, x, y, w, h) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#012169'; c.fillRect(x, y, w, h);
  const diag = (lw, col) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke(); };
  diag(h * 0.2, '#fff'); diag(h * 0.07, '#c8102e');
  c.fillStyle = '#fff'; c.fillRect(x + w / 2 - h * 0.17, y, h * 0.34, h); c.fillRect(x, y + h / 2 - h * 0.17, w, h * 0.34);
  c.fillStyle = '#c8102e'; c.fillRect(x + w / 2 - h * 0.1, y, h * 0.2, h); c.fillRect(x, y + h / 2 - h * 0.1, w, h * 0.2);
  c.restore();
}

const FLAGS = {
  PL: hs(['#ffffff', '#dc143c']),
  DE: hs(['#1a1a1a', '#dd0000', '#ffce00']),
  FR: vs(['#0055a4', '#ffffff', '#ef4135']),
  IT: vs(['#009246', '#ffffff', '#ce2b37']),
  ES: hs(['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]),
  GB: (c, w, h) => union(c, -w / 2, -h / 2, w, h),
  IE: vs(['#169b62', '#ffffff', '#ff883e']),
  SE: nordic('#006aa7', '#fecc00'),
  NO: nordic('#ba0c2f', '#ffffff', '#00205b'),
  FI: nordic('#ffffff', '#003580'),
  DK: nordic('#c8102e', '#ffffff'),
  NL: hs(['#ae1c28', '#ffffff', '#21468b']),
  BE: vs(['#1a1a1a', '#fdda24', '#ef3340']),
  UA: hs(['#0057b7', '#ffd700']),
  CZ: (c, w, h) => { hs(['#ffffff', '#d7141a'])(c, w, h); c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(0, 0); c.lineTo(-w / 2, h / 2); c.closePath(); c.fillStyle = '#11457e'; c.fill(); },
  AT: hs(['#ed2939', '#ffffff', '#ed2939']),
  CH: (c, w, h) => { bg(c, w, h, '#da291c'); c.fillStyle = '#fff'; c.fillRect(-0.1, -0.36, 0.2, 0.72); c.fillRect(-0.36, -0.1, 0.72, 0.2); },
  LT: hs(['#fdb913', '#006a44', '#c1272d']),
  HU: hs(['#ce2939', '#ffffff', '#477050']),
  RO: vs(['#002b7f', '#fcd116', '#ce1126']),
  JP: (c, w, h) => { bg(c, w, h, '#ffffff'); dot(c, 0, 0, h * 0.3, '#bc002d'); },
  CN: (c, w, h) => {
    bg(c, w, h, '#de2910'); star(c, -0.6, -0.3, 0.18, '#ffde00');
    [[-0.3, -0.48], [-0.2, -0.36], [-0.2, -0.2], [-0.3, -0.08]].forEach(([x, y]) => star(c, x, y, 0.06, '#ffde00'));
  },
  IN: (c, w, h) => { hs(['#ff9933', '#ffffff', '#138808'])(c, w, h); c.beginPath(); c.arc(0, 0, 0.14, 0, Math.PI * 2); c.strokeStyle = '#000080'; c.lineWidth = 0.035; c.stroke(); dot(c, 0, 0, 0.03, '#000080'); },
  TR: (c, w, h) => { bg(c, w, h, '#e30a17'); dot(c, -0.25, 0, 0.3, '#ffffff'); dot(c, -0.17, 0, 0.24, '#e30a17'); star(c, 0.14, 0, 0.1, '#ffffff', 5, -Math.PI / 2); },
  VN: (c, w, h) => { bg(c, w, h, '#da251d'); star(c, 0, 0.02, 0.32, '#ffff00'); },
  ID: hs(['#ce1126', '#ffffff']),
  TH: hs(['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], [1, 1, 2, 1, 1]),
  BD: (c, w, h) => { bg(c, w, h, '#006a4e'); dot(c, -0.1, 0, 0.33, '#f42a41'); },
  EG: (c, w, h) => { hs(['#ce1126', '#ffffff', '#1a1a1a'])(c, w, h); dot(c, 0, 0, 0.1, '#c09300'); },
  NG: vs(['#008751', '#ffffff', '#008751']),
  GH: (c, w, h) => { hs(['#ce1126', '#fcd116', '#006b3f'])(c, w, h); star(c, 0, 0.02, 0.17, '#1a1a1a'); },
  MA: (c, w, h) => {
    bg(c, w, h, '#c1272d'); c.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; c.lineTo(Math.cos(a) * 0.28, 0.03 + Math.sin(a) * 0.28); }
    c.closePath(); c.strokeStyle = '#006233'; c.lineWidth = 0.05; c.stroke();
  },
  ZA: (c, w, h) => {
    bg(c, w, h, '#de3831'); c.fillStyle = '#002395'; c.fillRect(-w / 2, 0, w, h / 2);
    const y = (lw, col) => { c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(-0.15, 0); c.lineTo(w / 2, 0); c.moveTo(-w / 2, h / 2); c.lineTo(-0.15, 0); c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'miter'; c.stroke(); };
    y(0.42, '#ffffff'); y(0.26, '#007a4d');
    const tri = (s, col) => { c.beginPath(); c.moveTo(-w / 2, -0.4 * s); c.lineTo(-w / 2 + 0.6 * s, 0); c.lineTo(-w / 2, 0.4 * s); c.closePath(); c.fillStyle = col; c.fill(); };
    tri(1.15, '#ffb612'); tri(0.9, '#1a1a1a');
  },
  US: (c, w, h) => {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#b22234'; c.fillRect(-w / 2, -h / 2 + i * h / 13, w, h / 13 + 0.004); }
    const cw = w * 0.4, ch = h * 7 / 13; c.fillStyle = '#3c3b6e'; c.fillRect(-w / 2, -h / 2, cw, ch);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) dot(c, -w / 2 + (k + 0.5) * cw / 5, -h / 2 + (r + 0.5) * ch / 4, 0.025, '#ffffff');
  },
  CA: (c, w, h) => {
    bg(c, w, h, '#ffffff'); c.fillStyle = '#d52b1e'; c.fillRect(-w / 2, -h / 2, w / 4, h); c.fillRect(w / 4, -h / 2, w / 4, h);
    star(c, 0, -0.02, 0.3, '#d52b1e', 7); c.fillRect(-0.02, 0.1, 0.04, 0.2);
  },
  MX: (c, w, h) => { vs(['#006847', '#ffffff', '#ce1126'])(c, w, h); dot(c, 0, 0, 0.14, '#8a5a3b'); dot(c, 0, 0, 0.08, '#6f9e4c'); },
  BR: (c, w, h) => {
    bg(c, w, h, '#009c3b'); c.beginPath(); c.moveTo(0, -0.5); c.lineTo(0.78, 0); c.lineTo(0, 0.5); c.lineTo(-0.78, 0); c.closePath(); c.fillStyle = '#ffdf00'; c.fill();
    dot(c, 0, 0, 0.28, '#002776'); c.beginPath(); c.arc(0.1, 0.45, 0.5, -2.15, -0.95); c.strokeStyle = '#ffffff'; c.lineWidth = 0.05; c.stroke();
  },
  AR: (c, w, h) => { hs(['#74acdf', '#ffffff', '#74acdf'])(c, w, h); dot(c, 0, 0, 0.11, '#f6b40e'); },
  CO: hs(['#fcd116', '#003893', '#ce1126'], [2, 1, 1]),
  PE: vs(['#d91023', '#ffffff', '#d91023']),
  CL: (c, w, h) => { hs(['#ffffff', '#d52b1e'])(c, w, h); c.fillStyle = '#0039a6'; c.fillRect(-w / 2, -h / 2, 0.6, h / 2); star(c, -w / 2 + 0.3, -h / 4, 0.13, '#ffffff'); },
  AU: (c, w, h) => {
    bg(c, w, h, '#012169'); union(c, -w / 2, -h / 2, w / 2, h / 2); star(c, -0.45, 0.3, 0.17, '#ffffff', 7);
    [[0.45, -0.35], [0.25, 0.0], [0.62, -0.08], [0.45, 0.38]].forEach(([x, y]) => star(c, x, y, 0.08, '#ffffff', 7));
  },
  NZ: (c, w, h) => {
    bg(c, w, h, '#012169'); union(c, -w / 2, -h / 2, w / 2, h / 2);
    [[0.45, -0.32], [0.28, -0.02], [0.62, -0.08], [0.45, 0.36]].forEach(([x, y]) => { star(c, x, y, 0.12, '#ffffff'); star(c, x, y, 0.085, '#c8102e'); });
  },
};

// the rest of Europe (used by the Europe map); simplified, child-friendly versions of each flag
const shield = (c, x, y, w, h, fill, stroke = null) => {
  c.beginPath(); c.moveTo(x - w / 2, y - h / 2); c.lineTo(x + w / 2, y - h / 2); c.lineTo(x + w / 2, y + h * 0.1);
  c.quadraticCurveTo(x + w / 2, y + h / 2, x, y + h / 2); c.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h * 0.1); c.closePath();
  c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.025; c.stroke(); }
};
function eagle(c, x, y, s, col) { // a simple double-headed eagle silhouette
  c.fillStyle = col; c.beginPath(); c.ellipse(x, y + 0.05 * s, 0.12 * s, 0.2 * s, 0, 0, Math.PI * 2); c.fill();
  for (const d of [-1, 1]) {
    c.beginPath(); c.moveTo(x + d * 0.08 * s, y - 0.05 * s); c.lineTo(x + d * 0.42 * s, y - 0.3 * s); c.lineTo(x + d * 0.4 * s, y - 0.1 * s);
    c.lineTo(x + d * 0.36 * s, y + 0.05 * s); c.lineTo(x + d * 0.3 * s, y + 0.18 * s); c.lineTo(x + d * 0.1 * s, y + 0.15 * s); c.closePath(); c.fill();
    c.beginPath(); c.arc(x + d * 0.1 * s, y - 0.24 * s, 0.07 * s, 0, Math.PI * 2); c.fill();
  }
  c.beginPath(); c.moveTo(x - 0.1 * s, y + 0.22 * s); c.lineTo(x, y + 0.4 * s); c.lineTo(x + 0.1 * s, y + 0.22 * s); c.closePath(); c.fill();
}
Object.assign(FLAGS, {
  PT: (c, w, h) => { c.fillStyle = '#046a38'; c.fillRect(-w / 2, -h / 2, w * 0.4, h); c.fillStyle = '#da291c'; c.fillRect(-w / 2 + w * 0.4, -h / 2, w * 0.6, h);
    const x = -w / 2 + w * 0.4; dot(c, x, 0, 0.26, '#ffe900'); shield(c, x, 0, 0.26, 0.3, '#fff', '#da291c'); shield(c, x, 0, 0.16, 0.19, '#da291c'); },
  GR: (c, w, h) => { for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#fff' : '#0d5eaf'; c.fillRect(-w / 2, -h / 2 + i * h / 9, w, h / 9 + 0.004); }
    const s = h * 5 / 9; c.fillStyle = '#0d5eaf'; c.fillRect(-w / 2, -h / 2, s, s); c.fillStyle = '#fff'; c.fillRect(-w / 2 + s * 0.4, -h / 2, s * 0.2, s); c.fillRect(-w / 2, -h / 2 + s * 0.4, s, s * 0.2); },
  HR: (c, w, h) => { hs(['#ff0000', '#fff', '#171796'])(c, w, h); c.save(); shield(c, 0, 0.02, 0.36, 0.44, '#fff'); c.clip();
    for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) if ((r + k) % 2 === 0) { c.fillStyle = '#ff0000'; c.fillRect(-0.18 + k * 0.072, -0.2 + r * 0.088, 0.072, 0.088); } c.restore(); },
  RS: (c, w, h) => { hs(['#c6363c', '#0c4076', '#fff'])(c, w, h); shield(c, -0.35, -0.02, 0.3, 0.36, '#c6363c', '#e8b83d'); c.fillStyle = '#fff'; c.fillRect(-0.37, -0.15, 0.04, 0.24); c.fillRect(-0.45, -0.05, 0.2, 0.04); },
  SK: (c, w, h) => { hs(['#fff', '#0b4ea2', '#ee1c25'])(c, w, h); shield(c, -0.4, 0.02, 0.36, 0.46, '#ee1c25', '#fff');
    c.fillStyle = '#fff'; c.fillRect(-0.42, -0.16, 0.04, 0.26); c.fillRect(-0.49, -0.1, 0.18, 0.035); c.fillRect(-0.47, -0.03, 0.14, 0.035);
    c.beginPath(); c.arc(-0.4, 0.2, 0.1, Math.PI, 0); c.fillStyle = '#0b4ea2'; c.fill(); },
  SI: (c, w, h) => { hs(['#fff', '#005da4', '#ed1c24'])(c, w, h); shield(c, -0.5, -0.12, 0.26, 0.3, '#005da4', '#ed1c24');
    c.beginPath(); c.moveTo(-0.61, 0.0); c.lineTo(-0.5, -0.14); c.lineTo(-0.39, 0.0); c.closePath(); c.fillStyle = '#fff'; c.fill(); },
  BG: hs(['#fff', '#00966e', '#d62612']),
  EE: hs(['#0072ce', '#1a1a1a', '#fff']),
  LV: hs(['#9e3039', '#fff', '#9e3039'], [2, 1, 2]),
  LU: hs(['#ed2939', '#fff', '#00a1de']),
  MC: hs(['#ce1126', '#fff']),
  RU: hs(['#fff', '#0039a6', '#d52b1e']),
  IS: nordic('#02529c', '#fff', '#dc1e35'),
  AD: (c, w, h) => { c.fillStyle = '#10069f'; c.fillRect(-w / 2, -h / 2, w * 0.32, h); c.fillStyle = '#fedd00'; c.fillRect(-w / 2 + w * 0.32, -h / 2, w * 0.36, h); c.fillStyle = '#d50032'; c.fillRect(w / 2 - w * 0.32, -h / 2, w * 0.32, h); shield(c, 0, 0, 0.24, 0.3, '#c9a13c', '#8a5a3b'); },
  MD: (c, w, h) => { vs(['#0046ae', '#ffd200', '#cc092f'])(c, w, h); shield(c, 0, 0.02, 0.24, 0.3, '#8a5a3b'); eagle(c, 0, -0.06, 0.5, '#8a5a3b'); },
  BY: (c, w, h) => { hs(['#c8313e', '#4aa657'], [2, 1])(c, w, h); c.fillStyle = '#fff'; c.fillRect(-w / 2, -h / 2, 0.2, h);
    c.fillStyle = '#c8313e'; for (let k = 0; k < 6; k++) { const y = -h / 2 + 0.1 + k * 0.2; c.beginPath(); c.moveTo(-w / 2 + 0.1, y - 0.07); c.lineTo(-w / 2 + 0.17, y); c.lineTo(-w / 2 + 0.1, y + 0.07); c.lineTo(-w / 2 + 0.03, y); c.closePath(); c.fill(); } },
  AL: (c, w, h) => { bg(c, w, h, '#e41e20'); eagle(c, 0, 0, 1.0, '#1a1a1a'); },
  ME: (c, w, h) => { bg(c, w, h, '#c40308'); c.strokeStyle = '#d3ae3b'; c.lineWidth = 0.08; c.strokeRect(-w / 2 + 0.04, -h / 2 + 0.04, w - 0.08, h - 0.08); eagle(c, 0, 0, 0.75, '#d3ae3b'); },
  MK: (c, w, h) => { bg(c, w, h, '#d20000'); c.fillStyle = '#ffe600';
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8, a2 = a + 0.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - 0.1) * 1.2, Math.sin(a - 0.1) * 1.2); c.lineTo(Math.cos(a2) * 1.2, Math.sin(a2) * 1.2); c.closePath(); c.fill(); }
    dot(c, 0, 0, 0.2, '#d20000'); dot(c, 0, 0, 0.16, '#ffe600'); },
  BA: (c, w, h) => { bg(c, w, h, '#002395'); c.beginPath(); c.moveTo(-0.25, -h / 2); c.lineTo(0.45, -h / 2); c.lineTo(0.45, h / 2); c.closePath(); c.fillStyle = '#fecb00'; c.fill();
    for (let k = 0; k < 7; k++) star(c, -0.38 + k * 0.105, -0.55 + k * 0.165, 0.055, '#fff'); },
  XK: (c, w, h) => { bg(c, w, h, '#244aa5'); c.beginPath(); c.ellipse(0, 0.1, 0.3, 0.25, 0.2, 0, Math.PI * 2); c.fillStyle = '#d0a650'; c.fill();
    for (let k = 0; k < 6; k++) { const a = Math.PI * (1.15 + k * 0.14); star(c, Math.cos(a) * 0.42, 0.25 + Math.sin(a) * 0.42, 0.045, '#fff'); } },
  CY: (c, w, h) => { bg(c, w, h, '#fff'); c.beginPath(); c.ellipse(0.02, -0.08, 0.34, 0.12, -0.15, 0, Math.PI * 2); c.fillStyle = '#d57800'; c.fill();
    c.fillStyle = '#4e5b31'; // two olive branches with leaves
    for (const d of [-1, 1]) for (let k = 0; k < 5; k++) { const x = d * (0.06 + k * 0.07), y = 0.3 - k * 0.025; c.beginPath(); c.ellipse(x, y, 0.045, 0.02, d * 0.5, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(x - d * 0.02, y - 0.04, 0.035, 0.016, -d * 0.6, 0, Math.PI * 2); c.fill(); } },
  MT: (c, w, h) => { vs(['#fff', '#cf142b'])(c, w, h); c.fillStyle = '#b0b0b0'; c.fillRect(-0.72, -0.5, 0.05, 0.18); c.fillRect(-0.785, -0.435, 0.18, 0.05); },
  SM: (c, w, h) => { hs(['#fff', '#5eb6e4'])(c, w, h); shield(c, 0, 0, 0.22, 0.28, '#5eb6e4', '#c9a13c'); c.fillStyle = '#fff'; c.fillRect(-0.06, -0.06, 0.03, 0.08); c.fillRect(0.03, -0.06, 0.03, 0.08); },
  LI: (c, w, h) => { hs(['#002b7f', '#ce1126'])(c, w, h); c.fillStyle = '#ffd83d';
    c.beginPath(); c.moveTo(-0.62, -0.1); c.lineTo(-0.62, -0.3); c.lineTo(-0.54, -0.2); c.lineTo(-0.48, -0.34); c.lineTo(-0.42, -0.2); c.lineTo(-0.34, -0.3); c.lineTo(-0.34, -0.1); c.closePath(); c.fill(); },
  VA: (c, w, h) => { vs(['#ffe000', '#fff'])(c, w, h); c.strokeStyle = '#c9a13c'; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(0.28, -0.2); c.lineTo(0.62, 0.2); c.moveTo(0.62, -0.2); c.lineTo(0.28, 0.2); c.stroke(); dot(c, 0.45, -0.32, 0.07, '#c9a13c'); },
});
export { FLAGS };

// id, continent, lon, lat, names, capitals. `easy` flags are the most recognisable (level 1 pool).
const C = (id, cont, lon, lat, en, pl, capEn, capPl, easy = false) => ({ id, cont, lon, lat, name: { en, pl }, capital: { en: capEn, pl: capPl }, easy, draw: FLAGS[id] });
export const COUNTRIES = [
  C('PL', 0, 19.1, 52.1, 'Poland', 'Polska', 'Warsaw', 'Warszawa', true),
  C('DE', 0, 10.4, 51.1, 'Germany', 'Niemcy', 'Berlin', 'Berlin', true),
  C('FR', 0, 2.5, 46.6, 'France', 'Francja', 'Paris', 'Paryż', true),
  C('IT', 0, 12.6, 42.8, 'Italy', 'Włochy', 'Rome', 'Rzym', true),
  C('ES', 0, -3.7, 40.3, 'Spain', 'Hiszpania', 'Madrid', 'Madryt', true),
  C('GB', 0, -2, 53.5, 'the United Kingdom', 'Wielka Brytania', 'London', 'Londyn', true),
  C('IE', 0, -8, 53.3, 'Ireland', 'Irlandia', 'Dublin', 'Dublin'),
  C('SE', 0, 15, 62, 'Sweden', 'Szwecja', 'Stockholm', 'Sztokholm', true),
  C('NO', 0, 9, 61, 'Norway', 'Norwegia', 'Oslo', 'Oslo'),
  C('FI', 0, 26, 63, 'Finland', 'Finlandia', 'Helsinki', 'Helsinki'),
  C('DK', 0, 9.5, 56, 'Denmark', 'Dania', 'Copenhagen', 'Kopenhaga'),
  C('NL', 0, 5.3, 52.2, 'the Netherlands', 'Holandia', 'Amsterdam', 'Amsterdam'),
  C('BE', 0, 4.5, 50.6, 'Belgium', 'Belgia', 'Brussels', 'Bruksela'),
  C('UA', 0, 31, 49, 'Ukraine', 'Ukraina', 'Kyiv', 'Kijów', true),
  C('CZ', 0, 15.5, 49.8, 'Czechia', 'Czechy', 'Prague', 'Praga'),
  C('AT', 0, 14.5, 47.5, 'Austria', 'Austria', 'Vienna', 'Wiedeń'),
  C('CH', 0, 8.2, 46.8, 'Switzerland', 'Szwajcaria', 'Bern', 'Berno', true),
  C('LT', 0, 23.9, 55.2, 'Lithuania', 'Litwa', 'Vilnius', 'Wilno'),
  C('HU', 0, 19.5, 47.2, 'Hungary', 'Węgry', 'Budapest', 'Budapeszt'),
  C('RO', 0, 25, 45.9, 'Romania', 'Rumunia', 'Bucharest', 'Bukareszt'),
  C('JP', 1, 138, 36.5, 'Japan', 'Japonia', 'Tokyo', 'Tokio', true),
  C('CN', 1, 104, 35, 'China', 'Chiny', 'Beijing', 'Pekin', true),
  C('IN', 1, 79, 22, 'India', 'Indie', 'New Delhi', 'Nowe Delhi', true),
  C('TR', 1, 35, 39, 'Turkey', 'Turcja', 'Ankara', 'Ankara'),
  C('VN', 1, 106, 16, 'Vietnam', 'Wietnam', 'Hanoi', 'Hanoi'),
  C('ID', 1, 113, -1, 'Indonesia', 'Indonezja', 'Jakarta', 'Dżakarta'),
  C('TH', 1, 101, 15, 'Thailand', 'Tajlandia', 'Bangkok', 'Bangkok'),
  C('BD', 1, 90, 24, 'Bangladesh', 'Bangladesz', 'Dhaka', 'Dhaka'),
  C('EG', 2, 30, 27, 'Egypt', 'Egipt', 'Cairo', 'Kair', true),
  C('NG', 2, 8, 9.5, 'Nigeria', 'Nigeria', 'Abuja', 'Abudża'),
  C('GH', 2, -1, 8, 'Ghana', 'Ghana', 'Accra', 'Akra'),
  C('MA', 2, -6, 32, 'Morocco', 'Maroko', 'Rabat', 'Rabat'),
  C('ZA', 2, 24, -29, 'South Africa', 'RPA', 'Pretoria', 'Pretoria', true),
  C('US', 3, -98, 39, 'the United States', 'Stany Zjednoczone', 'Washington', 'Waszyngton', true),
  C('CA', 3, -106, 57, 'Canada', 'Kanada', 'Ottawa', 'Ottawa', true),
  C('MX', 3, -102, 23.6, 'Mexico', 'Meksyk', 'Mexico City', 'Meksyk', true),
  C('BR', 4, -51, -10, 'Brazil', 'Brazylia', 'Brasília', 'Brasília', true),
  C('AR', 4, -64, -34, 'Argentina', 'Argentyna', 'Buenos Aires', 'Buenos Aires', true),
  C('CO', 4, -74, 4, 'Colombia', 'Kolumbia', 'Bogotá', 'Bogota'),
  C('PE', 4, -75, -9.2, 'Peru', 'Peru', 'Lima', 'Lima'),
  C('CL', 4, -71, -35, 'Chile', 'Chile', 'Santiago', 'Santiago'),
  C('AU', 5, 134, -25, 'Australia', 'Australia', 'Canberra', 'Canberra', true),
  C('NZ', 5, 172, -41, 'New Zealand', 'Nowa Zelandia', 'Wellington', 'Wellington'),
];

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
