// Synthesized sound effects (Web Audio) and read-aloud (speechSynthesis) in the current language.
import { store } from './store.js';
import { lang } from './i18n.js';
import { rand } from './util.js';

let AC = null, master = null, noiseBuf = null;
export function ensureAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.2, delay = 0, attack = 0.006 }) {
  if (!store.sound || !AC) return;
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise({ dur = 0.1, vol = 0.2, freq = 2000, f2 = null, q = 1, delay = 0 }) {
  if (!store.sound || !AC) return;
  const t0 = AC.currentTime + delay, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(freq, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl).connect(g).connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
const PENTA = [0, 2, 4, 7, 9];
const note = i => 523.25 * 2 ** ((PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12);
export const sfx = {
  pick() { tone({ f: 480, f2: 900, type: 'triangle', dur: 0.1, vol: 0.13 }); noise({ dur: 0.05, vol: 0.06, freq: 3500 }); },
  snap() { noise({ dur: 0.07, vol: 0.3, freq: 1800, q: 0.7 }); tone({ f: 170, f2: 70, dur: 0.1, vol: 0.3 }); },
  good(n) { const f = note((n % 8) + 2); tone({ f, type: 'triangle', dur: 0.18, vol: 0.16 }); tone({ f: f * 1.5, dur: 0.32, vol: 0.12, delay: 0.08 }); },
  bad() { tone({ f: 260, f2: 185, dur: 0.34, vol: 0.2 }); tone({ f: 205, f2: 150, type: 'triangle', dur: 0.3, vol: 0.07, delay: 0.05 }); },
  dot(i) { tone({ f: note(i), dur: 0.14, vol: 0.13 }); tone({ f: note(i) * 2, dur: 0.06, vol: 0.03 }); },
  undot(i) { tone({ f: note(i), f2: note(i) * 0.7, dur: 0.16, vol: 0.12, type: 'triangle' }); },
  ten() { [0, 4, 7, 12].forEach((s, k) => tone({ f: 660 * 2 ** (s / 12), type: 'triangle', dur: 0.26, vol: 0.12, delay: k * 0.06 })); },
  win() {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, k) => tone({ f: 523 * 2 ** (s / 12), type: 'triangle', dur: 0.32, vol: 0.13, delay: k * 0.075 }));
    for (let k = 0; k < 6; k++) tone({ f: rand(1800, 3200), dur: 0.08, vol: 0.04, delay: 0.55 + k * 0.06 });
  },
  whoosh() { noise({ dur: 0.35, vol: 0.12, freq: 350, f2: 2600, q: 0.8 }); },
  paper() { noise({ dur: 0.45, vol: 0.18, freq: 900, f2: 3500, q: 0.5 }); noise({ dur: 0.2, vol: 0.08, freq: 5000, q: 1.2, delay: 0.1 }); },
  hoot() { tone({ f: 430, f2: 390, dur: 0.18, vol: 0.14 }); tone({ f: 370, f2: 320, dur: 0.26, vol: 0.14, delay: 0.21 }); },
  tap() { tone({ f: 720, f2: 480, dur: 0.08, vol: 0.09 }); },
  star(i) { tone({ f: 880 * 2 ** (i * 4 / 12), type: 'triangle', dur: 0.28, vol: 0.14 }); },
};

/* ---------- read-aloud ---------- */
const voices = {};
function pickVoice(l) {
  if (!('speechSynthesis' in window)) return null;
  if (voices[l] !== undefined) return voices[l];
  const all = speechSynthesis.getVoices(); if (!all.length) return null;
  const mine = all.filter(v => v.lang.toLowerCase().startsWith(l));
  const nice = l === 'pl' ? /Zosia|Google polski|Paulina|Ewa|Maja/i : /Samantha|Google US English|Karen|Serena|Tessa|Moira|Female/i;
  return (voices[l] = mine.find(v => nice.test(v.name)) || mine[0] || null);
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { for (const k in voices) delete voices[k]; };
const busy = () => speechSynthesis.speaking || speechSynthesis.pending;
export function stopSpeech() { if ('speechSynthesis' in window && busy()) speechSynthesis.cancel(); }
// Browsers drop speech in a few quiet ways, so this is defensive:
//  - an utterance nobody references can be garbage-collected before it plays (Chrome) -> keep it in `live`;
//  - cancel() on an idle engine can leave the queue paused (Chrome/Safari) -> only cancel when busy, then resume();
//  - a line that never starts is retried once.
const live = new Set();
let speakTok = 0;
function utter(t, tok, retry) {
  if (tok !== speakTok) return;
  const u = new SpeechSynthesisUtterance(t), v = pickVoice(lang);
  u.rate = 0.95; u.pitch = 1.2; u.lang = v ? v.lang : (lang === 'pl' ? 'pl-PL' : 'en-US');
  if (v) u.voice = v;
  let started = false;
  u.onstart = () => { started = true; };
  u.onend = u.onerror = () => live.delete(u);
  live.add(u);
  speechSynthesis.resume(); speechSynthesis.speak(u);
  if (retry) setTimeout(() => {
    if (started || tok !== speakTok || !store.voice) return;
    live.delete(u); speechSynthesis.cancel(); setTimeout(() => utter(t, tok, false), 120);
  }, 1500);
}
export function speak(html) {
  if (!store.voice || !('speechSynthesis' in window)) return;
  const eq = lang === 'pl' ? ' równa się ' : ' equals ';
  let t = html.replace(/<[^>]+>/g, ' ').replace(/\p{Extended_Pictographic}/gu, '').replace(/[↖→↗✓✨👇️]/g, '')
    .replace(/\+/g, ' plus ').replace(/\s[−-]\s/g, ' minus ').replace(/=/g, eq).replace(/\s+/g, ' ').replace(/\s+([?!.,:;])/g, '$1').trim();
  if (!t) return;
  if (!/[.!?…]$/.test(t)) t += '.'; // a lone word ("Polska") is spoken more reliably as a sentence
  try {
    const tok = ++speakTok;
    if (busy()) { speechSynthesis.cancel(); setTimeout(() => utter(t, tok, true), 120); }
    else utter(t, tok, true);
  } catch (e) {}
}
