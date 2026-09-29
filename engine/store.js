// Settings and progress, kept in localStorage (per browser).

const KEY = 'paperSchool.v1';
export const store = {
  lang: null, sound: true, voice: true, stars: {}, spent: 0, stickers: [], freePacks: 0,
  levels: {}, stats: {}, adaptive: true, daily: null, scene: [], hubCat: 'math',
};
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
try { // carry over stars from the original single-game "Paper Sums"
  const old = +localStorage.getItem('paperSums.stars');
  if (old && !store.stars.sums) store.stars.sums = old;
} catch (e) {}

export function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
export function addStars(id, n = 1) { store.stars[id] = (store.stars[id] || 0) + n; save(); }
export const totalStars = () => Object.values(store.stars).reduce((a, b) => a + b, 0);
// stars you can still spend on sticker packs
export const spendableStars = () => totalStars() - (store.spent || 0);
