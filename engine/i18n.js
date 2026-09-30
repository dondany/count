// English + Polish strings. Values are strings, arrays or functions (for messages with numbers / grammar).
import { store, save } from './store.js';

export let lang = store.lang || ((navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en');
const subs = new Set();
export const onLang = fn => subs.add(fn);
export function setLang(l) {
  if (l === lang) return;
  lang = l; store.lang = l; save(); applyDom(); subs.forEach(f => f());
}
export function applyDom() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
}
export function tr(key, ...a) {
  const d = STR[lang], v = key in d ? d[key] : STR.en[key];
  return typeof v === 'function' ? v(...a) : v ?? key;
}
// en: [one, many]; pl: [one, few (2-4), many]
export function plural(n, forms) {
  if (forms.length < 3) return n === 1 ? forms[0] : forms[1];
  if (n === 1) return forms[0];
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? forms[1] : forms[2];
}

/* ---------- column / place names ---------- */
const EN_COLS = ['ones', 'tens', 'hundreds', 'thousands'];
const PL_COLS = ['jedności', 'dziesiątki', 'setki', 'tysiące'];
const PL_GEN = ['jedności', 'dziesiątek', 'setek', 'tysięcy'];
const PL_LOC = ['jednościach', 'dziesiątkach', 'setkach', 'tysiącach'];
const PL_INS = ['jednościami', 'dziesiątkami', 'setkami', 'tysiącami'];
const UNITS = {
  en: [['one', 'ones'], ['ten', 'tens'], ['hundred', 'hundreds']],
  pl: [['jedność', 'jedności', 'jedności'], ['dziesiątka', 'dziesiątki', 'dziesiątek'], ['setka', 'setki', 'setek']],
};
export const colName = i => (lang === 'pl' ? PL_COLS : EN_COLS)[i];
export const unit = (p, n) => `${n} ${plural(n, UNITS[lang][p])}`;
function joinAnd(parts) {
  const and = lang === 'pl' ? ' i ' : ' and ';
  return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + and + parts[parts.length - 1];
}
// digs little-endian: [ones, tens, hundreds] -> "3 hundreds, 4 tens and 7 ones"
export function splitWords(digs) {
  const parts = [];
  for (let p = digs.length - 1; p >= 0; p--) parts.push(unit(p, digs[p]));
  return joinAnd(parts);
}

/* ---------- numbers as words ---------- */
const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const PL_ONES = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const PL_TENS = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const PL_HUND = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
function wordsEn(n) {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : '');
  const r = n % 100; return EN_ONES[Math.floor(n / 100)] + ' hundred' + (r ? ' and ' + wordsEn(r) : '');
}
function wordsPl(n) {
  if (n < 20) return PL_ONES[n];
  if (n < 100) return PL_TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + PL_ONES[n % 10] : '');
  const r = n % 100; return PL_HUND[Math.floor(n / 100)] + (r ? ' ' + wordsPl(r) : '');
}
export const words = n => (lang === 'pl' ? wordsPl : wordsEn)(n);

const CA = '<span class="ca">1</span>';

/* ---------- time in words (12-hour clock) ---------- */
const PL_ORD_NOM = ['', 'pierwsza', 'druga', 'trzecia', 'czwarta', 'piąta', 'szósta', 'siódma', 'ósma', 'dziewiąta', 'dziesiąta', 'jedenasta', 'dwunasta'];
const PL_ORD_GEN = ['', 'pierwszej', 'drugiej', 'trzeciej', 'czwartej', 'piątej', 'szóstej', 'siódmej', 'ósmej', 'dziewiątej', 'dziesiątej', 'jedenastej', 'dwunastej'];
const PL_MIN = { 5: 'pięć', 10: 'dziesięć', 20: 'dwadzieścia', 25: 'dwadzieścia pięć' };
const EN_MIN = { 5: 'five', 10: 'ten', 20: 'twenty', 25: 'twenty-five' };
export function timeWords(h, m) {
  const nx = h % 12 + 1;
  if (lang === 'pl') {
    if (m === 0) return `godzina ${PL_ORD_NOM[h]}`;
    if (m === 15) return `kwadrans po ${PL_ORD_GEN[h]}`;
    if (m === 30) return `wpół do ${PL_ORD_GEN[nx]}`;
    if (m === 45) return `za kwadrans ${PL_ORD_NOM[nx]}`;
    return m < 30 ? `${PL_MIN[m]} po ${PL_ORD_GEN[h]}` : `za ${PL_MIN[60 - m]} ${PL_ORD_NOM[nx]}`;
  }
  if (m === 0) return `${EN_ONES[h] || wordsEn(h)} o'clock`;
  if (m === 15) return `quarter past ${wordsEn(h)}`;
  if (m === 30) return `half past ${wordsEn(h)}`;
  if (m === 45) return `quarter to ${wordsEn(nx)}`;
  return m < 30 ? `${EN_MIN[m]} past ${wordsEn(h)}` : `${EN_MIN[60 - m]} to ${wordsEn(nx)}`;
}
export const timeDigits = (h, m) => `${h}:${String(m).padStart(2, '0')}`;

/* ---------- fractions in words ---------- */
const EN_DEN = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['quarter', 'quarters'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 7: ['seventh', 'sevenths'], 8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'] };
const PL_DEN = {
  2: ['druga', 'drugie', 'drugich'], 3: ['trzecia', 'trzecie', 'trzecich'], 4: ['czwarta', 'czwarte', 'czwartych'], 5: ['piąta', 'piąte', 'piątych'],
  6: ['szósta', 'szóste', 'szóstych'], 7: ['siódma', 'siódme', 'siódmych'], 8: ['ósma', 'ósme', 'ósmych'], 9: ['dziewiąta', 'dziewiąte', 'dziewiątych'],
};
export function fracWords(n, d) {
  if (lang === 'pl') return `${n === 1 ? 'jedna' : n === 2 ? 'dwie' : PL_ONES[n]} ${plural(n, PL_DEN[d])}`;
  return `${EN_ONES[n]} ${plural(n, EN_DEN[d])}`;
}

/* ---------- continents ---------- */
const EN_CONT = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
const PL_CONT = ['Europa', 'Azja', 'Afryka', 'Ameryka Północna', 'Ameryka Południowa', 'Oceania'];
const PL_CONT_LOC = ['Europie', 'Azji', 'Afryce', 'Ameryce Północnej', 'Ameryce Południowej', 'Oceanii'];
export const contName = i => (lang === 'pl' ? PL_CONT : EN_CONT)[i];
export const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- dictionary ---------- */
const STR = {
  en: {
    // short prompts, used once the activity has been explained
    colShort: (i, eq) => `${cap1(EN_COLS[i])}: ${eq} = <b>?</b>`, subShort: (i, t, b) => `${cap1(EN_COLS[i])}: ${t} − ${b} = <b>?</b>`,
    borrowShort: x => `Borrow — tap the <b>${x}</b>!`, carryShort: `Carry the ${CA}!`,
    blkBuildShort: n => `Build <b>${n}</b>!`, clkSetShort: (t, w) => `<b>${t}</b> — ${w}`, frMakeShort: (f, w) => `<b>${f}</b> — ${w}`,
    tmShort: (a, b) => `<b>${a} × ${b}</b>`, flFindShort: n => `<b>${cap1(n)}</b>`, flContShort: n => `<b>${cap1(n)}</b>`,
    euFindShort: n => `<b>${cap1(n)}</b>`, anWhereShort: n => `Where does the <b>${n}</b> live?`, wrShort: l => `<b>${l}</b>`,
    // app
    title: ['Paper', 'School'], appName: "Pip's Paper School",
    subtitle: 'Learn maths with <b>Pip</b> the owl 🦉',
    loading: 'Loading…', play: "Let's play!", tiny: 'Drag the paper pieces with your finger or mouse!',
    help: 'Help', home: 'Home', sound: 'Sounds', voice: 'Read aloud', language: 'Język: Polski', on: 'on', off: 'off',
    nudge: 'Need a hand? Tap the 💡 button!',
    glow: 'Psst… look for the glowing piece at the bottom! ✨',
    praise: ['Yes!', 'Nice!', 'You got it!', 'Brilliant!', 'Super!', 'Wow!', 'Great!'],
    banners: ['Hooray!', 'Super!', 'Amazing!', 'Great job!', 'Wow!', 'Brilliant!'],
    winTail: ['You did it!', 'Amazing!', 'You are a maths champion!', 'Fantastic!'],
    countTitle: "Let's count!", countTap: 'tap here to count!',
    // hub
    hubHello: "Hi, I'm Pip! What shall we learn today? Tap a card!",
    hubLocked: 'That one is still being cut out of paper. Coming soon! ✂️',
    gSums: 'Adding', gMinus: 'Taking away', gBlocks: 'Tens & ones', gClock: 'Clock', gFrac: 'Fractions', soon: 'soon',
    // levels
    lvEasy: 'Easy', lvCarry: 'Carry', lvBig: 'Big', lvMake: 'Make', lvBorrow: 'Borrow', lv50: 'To 50', lv99: 'To 99', lvHund: 'Hundreds',
    // adding
    addStart: (a, b, eq) => `${a} + ${b}. Let's add! We always start on the right, with the <b>ones</b>. ${eq} = <b>?</b>`,
    addCol: (i, eq) => `Now the <b>${EN_COLS[i]}</b>: ${eq} = <b>?</b>`,
    onlyCarry: i => `Only the carried ${CA} is left in the <b>${EN_COLS[i]}</b>. Bring it down!`,
    order: i => `Not that one yet! We finish the <b>${EN_COLS[i]}</b> first — follow the pencil ✏️`,
    tensDigit: (eq, s) => `${eq} = <b>${s}</b>. That's too big for one box! Put the <b>${s % 10}</b> here and carry the ${CA}.`,
    forgotCarry: i => `Almost! Don't forget the carried ${CA} on top of the ${EN_COLS[i]}!`,
    close: "So close! Let's count the dots together.",
    noCarry: (eq, s) => `No carrying there! ${eq} = ${s}, and that's less than 10.`,
    carryOne: `We only ever carry a ${CA}. Try a 1!`,
    notQuite: "Hmm, not quite. Let's count the dots!",
    carryNow: (o, i) => `Yes! The <b>${o}</b> stays here, and we carry the ${CA} to the top of the <b>${EN_COLS[i]}</b>!`,
    carryFirst: (i, eq) => `Great carrying! Now, what goes in the <b>${EN_COLS[i]}</b> box? ${eq} = <b>?</b>`,
    helpCount: eq => `Let's count the dots together! ${eq}`,
    helpCarry: i => `When a column makes 10 or more, we carry 1 to the next column. Carry the ${CA} up to the <b>${EN_COLS[i]}</b>!`,
    addWin: (a, b, s, tail) => `${a} + ${b} = <b>${s}</b>! ${tail}`,
    buildStart: 'Make your own sum! ✏️ Drag numbers into the <b>top two rows</b>. Start with the <b>ones</b> on the right.',
    buildReady: "Great numbers! Press <b>Let's add!</b> when you're ready.",
    buildHelp: 'Drag a number from the bottom into the top-right box, and one into the box under it.',
    buildHelpReady: "Press <b>Let's add!</b> to solve your sum.",
    go: "Let's add! ➜", tagCarry: 'carry',
    // taking away
    subStart: (a, b) => `${a} − ${b}. Let's take away! We start on the right, with the <b>ones</b>.`,
    subAsk: (t, b) => `${t} − ${b} = <b>?</b>`,
    subCol: i => `Now the <b>${EN_COLS[i]}</b>:`,
    needBorrow: (t, b, x, i) => `${t} is smaller than ${b}, so we can't take ${b} away! Let's borrow ${CA} from the <b>${EN_COLS[i]}</b>. Tap the <b>${x}</b>!`,
    borrowed: (x, t, b) => `The ${x} became ${x - 1}, and the ${t} became <b>${t + 10}</b>! Now ${t + 10} − ${b} = <b>?</b>`,
    borrowFirst: x => `Wait! First we borrow — tap the <b>${x}</b>!`,
    noBorrow: 'No borrowing needed here — the top number is big enough!',
    forgotTen: (t, b) => `Careful! The top is now <b>${t}</b>. Take ${b} away from ${t}.`,
    forgotLent: o => `Remember, we borrowed from this column — the ${o} is now <b>${o - 1}</b>!`,
    subHelp: (t, b) => `Let's count! We start with ${t} dots and take ${b} away.`,
    subWin: (a, b, r, tail) => `${a} − ${b} = <b>${r}</b>! ${tail}`,
    tagBorrow: 'borrow!',
    // tens & ones
    blkBuild: (n, w, h) => `Build the number <b>${n}</b> — ${w}! Drag ${h ? 'hundreds, ' : ''}tens and ones onto the mat.`,
    blkRead: h => `What number is on the mat? Count the ${h ? 'hundreds, ' : ''}tens and ones, then write it!`,
    blkWrongCol: p => `That's ${p === 0 ? 'a one' : p === 1 ? 'a ten' : 'a hundred'}! It goes in the <b>${EN_COLS[p]}</b> column.`,
    blkTrade: p => `10 ${EN_COLS[p]} make 1 ${UNITS.en[p + 1][0]}! Swap!`,
    blkTooMany: p => `Too many ${EN_COLS[p]}! Tap one to take it back.`,
    blkSplit: (n, s) => `${n} is ${s}.`,
    blkReadWrong: p => `Let's count the ${EN_COLS[p]} together!`,
    blkWin: (n, w, tail) => `<b>${n}</b> — ${w}! ${tail}`,
    blkTarget: 'Build', blkWhat: 'What number?',
    // clock
    gFlags: 'Flags',
    lvHour: "O'clock", lvHalf: 'Half & quarter', lv5: '5 minutes',
    clkSet: (t, w) => `Set the clock to <b>${t}</b> — ${w}! Drag the hands, then press <b>Ready!</b>`,
    clkRead: 'What time does the clock show? Drag the right card onto the clock.',
    clkReady: 'Ready!', clkWhat: 'What time?', clkSetTitle: 'Set the clock',
    clkHourOk: 'The short hand is right! Now the long hand — it shows the minutes.',
    clkMinOk: 'The long hand is right! Now move the short hand — it shows the hour.',
    clkBoth: 'Not yet! The short hand shows the hour, the long hand shows the minutes.',
    clkHelp: (t, h, m) => m === 0 ? `At ${t} the long hand points straight up to 12, and the short hand points to ${h}.`
      : `For ${t} the long hand points to ${m / 5} — that's ${m} minutes — and the short hand is ${m === 30 ? 'halfway' : 'a bit'} past the ${h}.`,
    clkGhost: 'Watch the see-through hands — copy them!',
    clkReadWrong: 'Look again! The short hand shows the hour, the long hand shows the minutes.',
    clkWin: (t, w, tail) => `<b>${t}</b> — ${w}! ${tail}`,
    // fractions
    lvMore: 'More parts', lvTricky: 'Tricky',
    frMake: (f, w) => `Make <b>${f}</b> — ${w}! Drag pieces onto the plate.`,
    frRead: 'What part is there? Count the pieces and write the fraction!',
    frTooMany: 'Too many pieces! Tap one to take it back.',
    frHelp: (n, d) => `The bottom number says how many equal parts the whole has: <b>${d}</b>. The top number says how many parts we take: <b>${n}</b>.`,
    frNumWrong: "Count the pieces that are there — that's the top number!",
    frDenWrong: "How many equal parts is the whole cut into? That's the bottom number!",
    frWin: (f, w, tail) => `<b>${f}</b> — ${w}! ${tail}`,
    frMakeTitle: 'Make', frWhat: 'What part?',
    // flags
    lvFlags: 'Flags', lvCont: 'Continents', lvWorld: 'World',
    flFind: n => `Find the flag of <b>${n}</b> and drag it onto the pin!`,
    flOops: n => `Oops, that's the flag of ${n}!`,
    flFact: (n, c, cap) => `Yes! ${cap1(n)} is in ${EN_CONT[c]}. Its capital is ${cap}.`,
    flWhichCont: n => `<b>${cap1(n)}</b>! Which continent is it on? Drag the flag onto the map.`,
    flNotCont: c => `Not ${EN_CONT[c]} — try another continent!`,
    flIsIn: (n, c) => `Psst… ${n} is in <b>${EN_CONT[c]}</b>!`,
    flWhere: 'Where in the world? Drag each flag onto its pin!',
    flNotHere: n => `That pin isn't ${n}! Where could ${n} be?`,
    flWin: (k, tail) => `${tail} You placed ${k} flags!`,
    flCapital: 'Capital', flMystery: 'Where in the world?',
    lvEurope: 'Europe', euFind: n => `Where is <b>${n}</b>? Drag its flag onto the map of Europe!`,
    euYes: (n, cap) => `Yes! That's ${n}. Its capital is ${cap}.`, euNo: n => `That's ${n}! Try another country.`,
    euHint: n => `Look where it's glowing — that's ${n}!`, euProgress: (k, n) => `Painted: ${k} / ${n}`,
    euAll: 'You painted the whole of Europe! Let\'s paint it again!',
    // words
    gWords: 'Words', gAnimals: 'Animals', gStickers: 'Stickers',
    lvTrace: 'Trace', lvSpell: 'Spell', lvLong: 'Long words',
    wrdTrace: 'Put the letters in the boxes! ✏️', wrdSpell: "What's in the picture? Spell it! 🔊",
    wrdSay: w => `${w}!`, wrdWrong: g => `That's <b>${g}</b>. Listen to the word again and try another letter!`,
    wrdHelp: w => `Listen carefully: ${w}. Which letter comes next?`, wrdListen: 'Listen', wrdWin: (w, tail) => `<b>${w}</b>! ${tail}`,
    // animals
    lvHomes: 'Homes', lvMoreAnimals: 'More animals', lvHerd: 'Herd',
    anWhere: n => `Where does the <b>${n}</b> live? Drag it onto the map!`,
    anYes: (n, c) => `Yes! The ${n} lives in ${EN_CONT[c]}.`,
    anNo: (n, c) => `The ${n} doesn't live in ${EN_CONT[c]}. Try again!`,
    anHint: (n, c) => `Psst… the ${n} lives in <b>${EN_CONT[c]}</b>!`,
    anMany: 'Help these animals get home! Drag each one onto its continent.',
    anWin: (k, tail) => `${tail} ${k} animals are home!`, anTitle: 'Where do I live?',
    // stickers
    stkHello: (cost, n) => `Your sticker album! A pack costs ${cost} stars — you have ${n}.`,
    stkNeed: k => `You need ${k} more ${k === 1 ? 'star' : 'stars'}. Play a game to earn ${k === 1 ? 'it' : 'them'}!`,
    stkNew: n => `A new sticker: <b>${n}</b>!`, stkAll: "You've collected every sticker! Amazing!",
    stkOpen: 'Open!', stkPack: 'Sticker pack', stkFree: 'Free!',
    // hub categories, daily challenge, adaptive levels
    catMath: 'Maths', catWorld: 'World & words', catPlay: 'Play',
    dailyTag: (d, g) => `Today ${d}/${g}`,
    dailyHello: n => `Today's challenge: win 3 rounds of <b>${n}</b> for a free sticker pack! 🎁`,
    dailyStep: (d, g) => `Daily challenge: ${d} of ${g}!`,
    dailyDone: 'Daily challenge complete! You earned a free sticker pack! 🎁',
    levelUp: l => `You're on fire! Let's try <b>${l}</b>!`, levelDown: l => `Let's practise with <b>${l}</b> for a bit.`,
    // times tables garden
    gTimes: 'Times garden', lvT1: '×2 ×5 ×10', lvT2: '×2 – ×5', lvT3: '×6 – ×9',
    tmPlant: (a, b) => `${a} × ${b}: plant <b>${a} rows</b> with <b>${b} flowers</b> in each!`,
    tmAnswer: (a, b) => `${a} rows of ${b} — how many flowers? Write the answer!`,
    tmEnough: a => `That's enough rows — we need ${a}.`,
    tmWrongStrip: (n, b) => `This row has ${n} flowers, but we need ${b}.`,
    tmSkip: (b, list) => `Count in ${b}s: ${list}!`,
    tmWin: (a, b, p, tail) => `${a} × ${b} = <b>${p}</b>! ${tail}`,
    // solar system
    gSpace: 'Solar system', lvGuided: 'With hints', lvInOrder: 'In order', lvQuiz: 'Quiz',
    planets: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    spStart: 'Put the planets in order, starting next to the Sun!',
    spCloser: n => `That's ${n} — it goes closer to the Sun.`, spFurther: n => `That's ${n} — it goes further from the Sun.`,
    spFacts: ['Mercury is the closest planet to the Sun.', 'Venus is the hottest planet.', 'Earth is our home!', 'Mars is the red planet.',
      'Jupiter is the biggest planet.', 'Saturn has beautiful rings.', 'Uranus rolls around on its side.', 'Neptune is the furthest and windiest planet.'],
    spQ: ['Which planet is closest to the Sun?', 'Which planet is the hottest?', 'Which planet is our home?', 'Which planet is red?',
      'Which planet is the biggest?', 'Which planet has big rings?', 'Which planet rolls on its side?', 'Which planet is furthest from the Sun?'],
    spQuizStart: 'Planet quiz! Drag the right planet onto the question card.',
    spQuizWrong: n => `That's ${n}. Try another one!`,
    spHelp: 'From the Sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune!',
    spWin: tail => `${tail} Every planet is in its place!`, spTitle: 'From the Sun', spQTitle: 'Question',
    lvExplore: 'Explore', lvPlace: 'Place', spTap: 'Tap a planet!',
    spExplore: 'This is our solar system! Tap a planet to find out about it.',
    spPlace: 'Drag each planet onto its orbit — Mercury is closest to the Sun!',
    // writing
    gWrite: 'Writing', lvUpper: 'ABC', lvLower: 'abc', lvDigits: '123', lvMix: 'Practice',
    wrStart: l => `Let's write <b>${l}</b>! Start at the green dot and follow the grey path in one go. Tap ▶ to watch how.`,
    wrKeep: 'Oops — keep your finger down all the way to the end of the line!',
    wrWatch: 'Watch first — this is how we write it!',
    wrNext: n => `Great! Now line ${n}.`, wrStartDot: 'Start at the green dot!', wrStay: 'Stay on the grey path!',
    wrDone: (l, w) => w ? `<b>${l}</b> — like ${w}!` : `<b>${l}</b> — well done!`,
    // pattern train
    gPattern: 'Pattern train', lvPat1: 'Shapes', lvPat2: 'Tricky', lvPat3: 'Numbers',
    colors: ['red', 'blue', 'yellow', 'green', 'purple'], shapes: ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'],
    item: (c, s) => `${c} ${s}`,
    ptStart: 'What comes next? Finish the pattern on the train!',
    ptListen: seq => `Listen to the pattern: ${seq}…`,
    ptStep: d => d > 0 ? `Each wagon adds ${d}!` : `Each wagon takes away ${-d}!`,
    ptWin: tail => `${tail} All aboard! Choo choo!`,
    // paper scene
    gScene: 'Paper scene',
    scHello: 'Make your own paper picture! Drag things onto the scene. Tap one to change its size.',
    scMore: 'Collect stickers to get more things for your picture!',
    scSnap: 'Click! What a beautiful picture!', scClearAsk: 'Tap the bin again to clear the picture.', scCleared: 'All clean — start a new picture!',
    // parent corner
    mParents: 'Parent corner', pcTitle: 'Parent corner', pcGate: (a, b) => `For grown-ups: what is ${a} × ${b}?`, pcEnter: 'Open', pcWrongGate: 'Not quite — try again.',
    pcActivity: 'Activity', pcRounds: 'Rounds', pcStars: 'Stars', pcAvg: 'Avg ★', pcLevel: 'Level', pcLast: 'Last played', pcNever: '—',
    pcMistakes: 'Most common mistakes', pcNone: 'No mistakes recorded yet.', pcAdaptive: 'Adjust difficulty automatically',
    pcReset: 'Reset all progress', pcResetAsk: 'Reset all stars, stickers and progress on this device?', pcClose: 'Close',
    pcDaily: 'Daily challenge', pcStickers: 'Stickers', pcSummary: (r, s, k, n) => `${r} rounds played · ${s} stars earned · ${k} of ${n} stickers`,
    mk: {
      tensDigit: 'Writes the tens of a column sum in the ones box', forgotCarry: 'Forgets the carried 1', close: 'Off by one',
      wrong: 'Other wrong digits', noCarry: 'Carries when not needed', carryOne: 'Carries more than 1', forgotTen: 'Forgets the borrowed ten',
      forgotLent: 'Forgets a column was borrowed from', wrongCol: 'Puts blocks in the wrong column', tooMany: 'Uses too many pieces',
      readWrong: 'Miscounts blocks', hour: 'Hour (short) hand', minute: 'Minute (long) hand', both: 'Both clock hands', read: 'Reading the clock',
      num: 'Top number of a fraction', den: 'Bottom number of a fraction', flag: 'Flags', cont: 'Continents', europe: 'Countries of Europe', letter: 'Letters in words',
      answer: 'Times-table answers', start: 'Starts a line in the wrong place', path: 'Leaves the writing path', strip: 'Row length in the garden', order: 'Order (planets / columns)', quiz: 'Planet facts', pattern: 'Patterns',
    },
  },
  pl: {
    colShort: (i, eq) => `${cap1(PL_COLS[i])}: ${eq} = <b>?</b>`, subShort: (i, t, b) => `${cap1(PL_COLS[i])}: ${t} − ${b} = <b>?</b>`,
    borrowShort: x => `Pożycz — kliknij <b>${x}</b>!`, carryShort: `Przenieś ${CA}!`,
    blkBuildShort: n => `Zbuduj <b>${n}</b>!`, clkSetShort: (t, w) => `<b>${t}</b> — ${w}`, frMakeShort: (f, w) => `<b>${f}</b> — ${w}`,
    tmShort: (a, b) => `<b>${a} × ${b}</b>`, flFindShort: n => `<b>${cap1(n)}</b>`, flContShort: n => `<b>${cap1(n)}</b>`,
    euFindShort: n => `<b>${cap1(n)}</b>`, anWhereShort: n => `Gdzie mieszka <b>${n}</b>?`, wrShort: l => `<b>${l}</b>`,
    title: ['Papierowa', 'Szkoła'], appName: 'Papierowa Szkoła Pipa',
    subtitle: 'Ucz się matematyki z sową <b>Pipem</b> 🦉',
    loading: 'Ładowanie…', play: 'Gramy!', tiny: 'Przeciągaj papierowe elementy palcem lub myszką!',
    help: 'Pomoc', home: 'Start', sound: 'Dźwięki', voice: 'Czytanie na głos', language: 'Language: English', on: 'wł.', off: 'wył.',
    nudge: 'Potrzebujesz pomocy? Kliknij 💡!',
    glow: 'Psst… poszukaj świecącego elementu na dole! ✨',
    praise: ['Tak!', 'Super!', 'Brawo!', 'Świetnie!', 'Ekstra!', 'Wow!', 'Doskonale!'],
    banners: ['Hurra!', 'Super!', 'Brawo!', 'Świetnie!', 'Wow!', 'Mistrz!'],
    winTail: ['Udało się!', 'Wspaniale!', 'Jesteś mistrzem matematyki!', 'Fantastycznie!'],
    countTitle: 'Policzmy!', countTap: 'kliknij, aby policzyć!',
    hubHello: 'Cześć, jestem Pip! Czego dziś się uczymy? Kliknij kartę!',
    hubLocked: 'Ta karta jest jeszcze wycinana z papieru. Już wkrótce! ✂️',
    gSums: 'Dodawanie', gMinus: 'Odejmowanie', gBlocks: 'Dziesiątki i jedności', gClock: 'Zegar', gFrac: 'Ułamki', soon: 'wkrótce',
    lvEasy: 'Łatwe', lvCarry: 'Przenoszenie', lvBig: 'Duże', lvMake: 'Własne', lvBorrow: 'Pożyczanie', lv50: 'Do 50', lv99: 'Do 99', lvHund: 'Setki',
    addStart: (a, b, eq) => `${a} + ${b}. Dodajemy! Zawsze zaczynamy od prawej, od <b>jedności</b>. ${eq} = <b>?</b>`,
    addCol: (i, eq) => `Teraz <b>${PL_COLS[i]}</b>: ${eq} = <b>?</b>`,
    onlyCarry: i => `W ${PL_LOC[i]} została tylko przeniesiona ${CA}. Przepisz ją na dół!`,
    order: i => `Jeszcze nie tutaj! Najpierw kończymy <b>${PL_COLS[i]}</b> — idź za ołówkiem ✏️`,
    tensDigit: (eq, s) => `${eq} = <b>${s}</b>. To za dużo na jedno okienko! Wpisz tu <b>${s % 10}</b>, a ${CA} przenieś dalej.`,
    forgotCarry: i => `Prawie! Nie zapomnij o przeniesionej ${CA} nad ${PL_INS[i]}!`,
    close: 'Blisko! Policzmy razem kropki.',
    noCarry: (eq, s) => `Tu nic nie przenosimy! ${eq} = ${s}, a to mniej niż 10.`,
    carryOne: `Przenosimy zawsze tylko ${CA}. Spróbuj!`,
    notQuite: 'Hmm, nie całkiem. Policzmy kropki!',
    carryNow: (o, i) => `Tak! <b>${o}</b> zostaje tutaj, a ${CA} przenosimy na górę, nad <b>${PL_INS[i]}</b>!`,
    carryFirst: (i, eq) => `Świetnie przeniesione! A co wpiszemy w okienko ${PL_GEN[i]}? ${eq} = <b>?</b>`,
    helpCount: eq => `Policzmy razem kropki! ${eq}`,
    helpCarry: i => `Gdy w kolumnie wyjdzie 10 albo więcej, przenosimy 1 do następnej kolumny. Przenieś ${CA} nad <b>${PL_INS[i]}</b>!`,
    addWin: (a, b, s, tail) => `${a} + ${b} = <b>${s}</b>! ${tail}`,
    buildStart: 'Ułóż własne działanie! ✏️ Przeciągnij cyfry do <b>dwóch górnych rzędów</b>. Zacznij od <b>jedności</b> po prawej.',
    buildReady: 'Super liczby! Naciśnij <b>Liczymy!</b>, kiedy zechcesz.',
    buildHelp: 'Przeciągnij cyfrę z dołu do prawego górnego okienka, a drugą do okienka pod nim.',
    buildHelpReady: 'Naciśnij <b>Liczymy!</b>, żeby rozwiązać działanie.',
    go: 'Liczymy! ➜', tagCarry: 'przenieś',
    subStart: (a, b) => `${a} − ${b}. Odejmujemy! Zaczynamy od prawej, od <b>jedności</b>.`,
    subAsk: (t, b) => `${t} − ${b} = <b>?</b>`,
    subCol: i => `Teraz <b>${PL_COLS[i]}</b>:`,
    needBorrow: (t, b, x, i) => `${t} to mniej niż ${b}, więc nie odejmiemy! Pożyczmy ${CA} od <b>${PL_GEN[i]}</b>. Kliknij <b>${x}</b>!`,
    borrowed: (x, t, b) => `Z ${x} zrobiło się ${x - 1}, a z ${t} — <b>${t + 10}</b>! Teraz ${t + 10} − ${b} = <b>?</b>`,
    borrowFirst: x => `Chwileczkę! Najpierw pożyczamy — kliknij <b>${x}</b>!`,
    noBorrow: 'Tu nie trzeba pożyczać — na górze jest wystarczająco dużo!',
    forgotTen: (t, b) => `Uwaga! Na górze jest teraz <b>${t}</b>. Odejmij ${b} od ${t}.`,
    forgotLent: o => `Pamiętaj, pożyczyliśmy z tej kolumny — ${o} to teraz <b>${o - 1}</b>!`,
    subHelp: (t, b) => `Policzmy! Mamy ${t} i zabieramy ${b}.`,
    subWin: (a, b, r, tail) => `${a} − ${b} = <b>${r}</b>! ${tail}`,
    tagBorrow: 'pożycz!',
    blkBuild: (n, w, h) => `Zbuduj liczbę <b>${n}</b> — ${w}! Przeciągnij ${h ? 'setki, ' : ''}dziesiątki i jedności na matę.`,
    blkRead: h => `Jaka liczba jest na macie? Policz ${h ? 'setki, ' : ''}dziesiątki i jedności, a potem ją zapisz!`,
    blkWrongCol: p => `To jest ${UNITS.pl[p][0]}! Połóż ją w kolumnie <b>${PL_GEN[p]}</b>.`,
    blkTrade: p => `10 ${PL_GEN[p]} to 1 ${UNITS.pl[p + 1][0]}! Zamiana!`,
    blkTooMany: p => `Za dużo ${PL_GEN[p]}! Kliknij jedną, żeby ją zabrać.`,
    blkSplit: (n, s) => `${n} to ${s}.`,
    blkReadWrong: p => `Policzmy razem ${PL_COLS[p]}!`,
    blkWin: (n, w, tail) => `<b>${n}</b> — ${w}! ${tail}`,
    blkTarget: 'Zbuduj', blkWhat: 'Jaka to liczba?',
    gFlags: 'Flagi',
    lvHour: 'Pełne godziny', lvHalf: 'Połówki i kwadranse', lv5: 'Co 5 minut',
    clkSet: (t, w) => `Ustaw zegar na <b>${t}</b> — ${w}! Przeciągnij wskazówki i naciśnij <b>Gotowe!</b>`,
    clkRead: 'Którą godzinę pokazuje zegar? Przeciągnij dobrą kartę na zegar.',
    clkReady: 'Gotowe!', clkWhat: 'Która godzina?', clkSetTitle: 'Ustaw zegar',
    clkHourOk: 'Krótka wskazówka jest dobrze! Teraz długa — ona pokazuje minuty.',
    clkMinOk: 'Długa wskazówka jest dobrze! Teraz przesuń krótką — ona pokazuje godzinę.',
    clkBoth: 'Jeszcze nie! Krótka wskazówka pokazuje godzinę, a długa minuty.',
    clkHelp: (t, h, m) => m === 0 ? `O ${t} długa wskazówka pokazuje prosto w górę na 12, a krótka na ${h}.`
      : `Przy ${t} długa wskazówka pokazuje ${m / 5} — to ${m} minut — a krótka jest ${m === 30 ? 'w połowie drogi' : 'trochę'} za ${h}.`,
    clkGhost: 'Popatrz na przezroczyste wskazówki — ustaw tak samo!',
    clkReadWrong: 'Spójrz jeszcze raz! Krótka wskazówka to godzina, a długa to minuty.',
    clkWin: (t, w, tail) => `<b>${t}</b> — ${w}! ${tail}`,
    lvMore: 'Więcej części', lvTricky: 'Trudne',
    frMake: (f, w) => `Ułóż <b>${f}</b> — ${w}! Przeciągnij kawałki na talerz.`,
    frRead: 'Jaka to część? Policz kawałki i zapisz ułamek!',
    frTooMany: 'Za dużo kawałków! Kliknij jeden, żeby go zabrać.',
    frHelp: (n, d) => `Dolna liczba mówi, na ile równych części podzielono całość: <b>${d}</b>. Górna mówi, ile części bierzemy: <b>${n}</b>.`,
    frNumWrong: 'Policz kawałki, które są — to górna liczba!',
    frDenWrong: 'Na ile równych części podzielono całość? To dolna liczba!',
    frWin: (f, w, tail) => `<b>${f}</b> — ${w}! ${tail}`,
    frMakeTitle: 'Ułóż', frWhat: 'Jaka część?',
    lvFlags: 'Flagi', lvCont: 'Kontynenty', lvWorld: 'Świat',
    flFind: n => `Znajdź flagę: <b>${n}</b>. Przeciągnij ją na pinezkę!`,
    flOops: n => `Ups, to flaga: ${n}!`,
    flFact: (n, c, cap) => `Tak! ${n} to kraj w ${PL_CONT_LOC[c]}. Stolica to ${cap}.`,
    flWhichCont: n => `<b>${n}</b>! Na którym kontynencie? Przeciągnij flagę na mapę.`,
    flNotCont: c => `To nie ${PL_CONT[c]} — spróbuj innego kontynentu!`,
    flIsIn: (n, c) => `Psst… ${n} to kraj w <b>${PL_CONT_LOC[c]}</b>!`,
    flWhere: 'Gdzie na świecie? Przeciągnij każdą flagę na jej pinezkę!',
    flNotHere: n => `To nie tutaj! Gdzie może być ${n}?`,
    flWin: (k, tail) => `${tail} Masz ${k} ${plural(k, ['flagę', 'flagi', 'flag'])} na mapie!`,
    flCapital: 'Stolica', flMystery: 'Gdzie na świecie?',
    lvEurope: 'Europa', euFind: n => `Gdzie leży <b>${n}</b>? Przeciągnij flagę na mapę Europy!`,
    euYes: (n, cap) => `Tak! To ${n}. Stolica to ${cap}.`, euNo: n => `To jest ${n}! Spróbuj inny kraj.`,
    euHint: n => `Popatrz, gdzie świeci — tam jest ${n}!`, euProgress: (k, n) => `Pomalowane: ${k} / ${n}`,
    euAll: 'Cała Europa pomalowana! Malujemy od nowa!',
    gWords: 'Słowa', gAnimals: 'Zwierzęta', gStickers: 'Naklejki',
    lvTrace: 'Po śladzie', lvSpell: 'Literuj', lvLong: 'Długie słowa',
    wrdTrace: 'Ułóż litery w okienkach! ✏️', wrdSpell: 'Co jest na obrazku? Ułóż to słowo! 🔊',
    wrdSay: w => `${w}!`, wrdWrong: g => `To jest <b>${g}</b>. Posłuchaj słowa jeszcze raz i spróbuj innej litery!`,
    wrdHelp: w => `Posłuchaj uważnie: ${w}. Jaka litera jest następna?`, wrdListen: 'Posłuchaj', wrdWin: (w, tail) => `<b>${w}</b>! ${tail}`,
    lvHomes: 'Domy', lvMoreAnimals: 'Więcej zwierząt', lvHerd: 'Stado',
    anWhere: n => `Gdzie mieszka <b>${n}</b>? Przeciągnij na mapę!`,
    anYes: (n, c) => `Tak! ${cap1(n)} mieszka w ${PL_CONT_LOC[c]}.`,
    anNo: (n, c) => `${cap1(n)} nie mieszka w ${PL_CONT_LOC[c]}. Spróbuj jeszcze raz!`,
    anHint: (n, c) => `Psst… ${n} mieszka w <b>${PL_CONT_LOC[c]}</b>!`,
    anMany: 'Pomóż zwierzętom wrócić do domu! Przeciągnij każde na jego kontynent.',
    anWin: (k, tail) => `${tail} ${k} ${plural(k, ['zwierzę jest', 'zwierzęta są', 'zwierząt jest'])} w domu!`, anTitle: 'Gdzie mieszkam?',
    stkHello: (cost, n) => `Twój album z naklejkami! Paczka kosztuje ${cost} gwiazdek — masz ${n}.`,
    stkNeed: k => `Brakuje ci jeszcze ${k} ${plural(k, ['gwiazdki', 'gwiazdek', 'gwiazdek'])}. Zagraj w grę, żeby je zdobyć!`,
    stkNew: n => `Nowa naklejka: <b>${n}</b>!`, stkAll: 'Masz wszystkie naklejki! Niesamowite!',
    stkOpen: 'Otwórz!', stkPack: 'Paczka naklejek', stkFree: 'Gratis!',
    catMath: 'Matematyka', catWorld: 'Świat i słowa', catPlay: 'Zabawa',
    dailyTag: (d, g) => `Dziś ${d}/${g}`,
    dailyHello: n => `Wyzwanie dnia: wygraj 3 rundy w grze <b>${n}</b>, a dostaniesz darmową paczkę naklejek! 🎁`,
    dailyStep: (d, g) => `Wyzwanie dnia: ${d} z ${g}!`,
    dailyDone: 'Wyzwanie dnia zaliczone! Masz darmową paczkę naklejek! 🎁',
    levelUp: l => `Świetnie ci idzie! Spróbujmy: <b>${l}</b>!`, levelDown: l => `Poćwiczmy chwilę: <b>${l}</b>.`,
    gTimes: 'Ogród mnożenia', lvT1: '×2 ×5 ×10', lvT2: '×2 – ×5', lvT3: '×6 – ×9',
    tmPlant: (a, b) => `${a} × ${b}: posadź <b>${a} ${plural(a, ['rząd', 'rzędy', 'rzędów'])}</b> po <b>${b} ${plural(b, ['kwiatku', 'kwiatki', 'kwiatków'])}</b>!`,
    tmAnswer: (a, b) => `${a} × ${b} — ile jest kwiatków? Wpisz wynik!`,
    tmEnough: a => `Wystarczy! Potrzebujemy ${a} ${plural(a, ['rzędu', 'rzędów', 'rzędów'])}.`,
    tmWrongStrip: (n, b) => `Ten rząd ma ${n} ${plural(n, ['kwiatek', 'kwiatki', 'kwiatków'])}, a potrzebujemy ${b}.`,
    tmSkip: (b, list) => `Liczymy co ${b}: ${list}!`,
    tmWin: (a, b, p, tail) => `${a} × ${b} = <b>${p}</b>! ${tail}`,
    gSpace: 'Układ Słoneczny', lvGuided: 'Z podpowiedzią', lvInOrder: 'Po kolei', lvQuiz: 'Quiz',
    planets: ['Merkury', 'Wenus', 'Ziemia', 'Mars', 'Jowisz', 'Saturn', 'Uran', 'Neptun'],
    spStart: 'Ułóż planety po kolei, zaczynając od Słońca!',
    spCloser: n => `To ${n} — leży bliżej Słońca.`, spFurther: n => `To ${n} — leży dalej od Słońca.`,
    spFacts: ['Merkury jest najbliżej Słońca.', 'Wenus to najgorętsza planeta.', 'Ziemia to nasz dom!', 'Mars to czerwona planeta.',
      'Jowisz to największa planeta.', 'Saturn ma piękne pierścienie.', 'Uran toczy się na boku.', 'Neptun jest najdalej od Słońca i bardzo tam wieje.'],
    spQ: ['Która planeta jest najbliżej Słońca?', 'Która planeta jest najgorętsza?', 'Która planeta jest naszym domem?', 'Która planeta jest czerwona?',
      'Która planeta jest największa?', 'Która planeta ma duże pierścienie?', 'Która planeta toczy się na boku?', 'Która planeta jest najdalej od Słońca?'],
    spQuizStart: 'Quiz o planetach! Przeciągnij dobrą planetę na kartę z pytaniem.',
    spQuizWrong: n => `To ${n}. Spróbuj innej!`,
    spHelp: 'Od Słońca: Merkury, Wenus, Ziemia, Mars, Jowisz, Saturn, Uran, Neptun!',
    spWin: tail => `${tail} Każda planeta jest na swoim miejscu!`, spTitle: 'Od Słońca', spQTitle: 'Pytanie',
    lvExplore: 'Odkrywaj', lvPlace: 'Ułóż', spTap: 'Kliknij planetę!',
    spExplore: 'Oto nasz Układ Słoneczny! Kliknij planetę, żeby coś o niej usłyszeć.',
    spPlace: 'Przeciągnij każdą planetę na jej orbitę — Merkury jest najbliżej Słońca!',
    gWrite: 'Pisanie', lvUpper: 'ABC', lvLower: 'abc', lvDigits: '123', lvMix: 'Ćwiczenia',
    wrStart: l => `Piszemy <b>${l}</b>! Zacznij od zielonej kropki i prowadź palec po szarej ścieżce bez odrywania. Kliknij ▶, żeby zobaczyć jak.`,
    wrKeep: 'Ups — nie odrywaj palca aż do końca linii!',
    wrWatch: 'Najpierw popatrz, jak to się pisze!',
    wrNext: n => `Super! Teraz linia ${n}.`, wrStartDot: 'Zacznij od zielonej kropki!', wrStay: 'Trzymaj się szarej ścieżki!',
    wrDone: (l, w) => w ? `<b>${l}</b> — jak ${w}!` : `<b>${l}</b> — brawo!`,
    gPattern: 'Pociąg wzorów', lvPat1: 'Kształty', lvPat2: 'Trudne', lvPat3: 'Liczby',
    colors: [{ m: 'czerwony', f: 'czerwona', n: 'czerwone' }, { m: 'niebieski', f: 'niebieska', n: 'niebieskie' }, { m: 'żółty', f: 'żółta', n: 'żółte' },
      { m: 'zielony', f: 'zielona', n: 'zielone' }, { m: 'fioletowy', f: 'fioletowa', n: 'fioletowe' }],
    shapes: [['koło', 'n'], ['kwadrat', 'm'], ['trójkąt', 'm'], ['gwiazda', 'f'], ['serce', 'n'], ['romb', 'm']],
    item: (c, s) => `${c[s[1]]} ${s[0]}`,
    ptStart: 'Co będzie dalej? Dokończ wzór w pociągu!',
    ptListen: seq => `Posłuchaj wzoru: ${seq}…`,
    ptStep: d => d > 0 ? `Każdy wagon to ${d} więcej!` : `Każdy wagon to ${-d} mniej!`,
    ptWin: tail => `${tail} Wszyscy wsiadać! Ciuch, ciuch!`,
    gScene: 'Papierowa scenka',
    scHello: 'Ułóż własny papierowy obrazek! Przeciągaj rzeczy na scenkę. Kliknij rzecz, żeby zmienić jej rozmiar.',
    scMore: 'Zbieraj naklejki, a będziesz mieć więcej rzeczy do obrazka!',
    scSnap: 'Pstryk! Jaki piękny obrazek!', scClearAsk: 'Kliknij kosz jeszcze raz, żeby wyczyścić obrazek.', scCleared: 'Czysto — zacznij nowy obrazek!',
    mParents: 'Kącik rodzica', pcTitle: 'Kącik rodzica', pcGate: (a, b) => `Dla dorosłych: ile to ${a} × ${b}?`, pcEnter: 'Otwórz', pcWrongGate: 'Niezupełnie — spróbuj ponownie.',
    pcActivity: 'Zajęcie', pcRounds: 'Rundy', pcStars: 'Gwiazdki', pcAvg: 'Śr. ★', pcLevel: 'Poziom', pcLast: 'Ostatnio', pcNever: '—',
    pcMistakes: 'Najczęstsze błędy', pcNone: 'Brak zapisanych błędów.', pcAdaptive: 'Automatycznie dopasuj poziom',
    pcReset: 'Wyzeruj postępy', pcResetAsk: 'Wyzerować wszystkie gwiazdki, naklejki i postępy na tym urządzeniu?', pcClose: 'Zamknij',
    pcDaily: 'Wyzwanie dnia', pcStickers: 'Naklejki', pcSummary: (r, s, k, n) => `${r} rozegranych rund · ${s} zdobytych gwiazdek · ${k} z ${n} naklejek`,
    mk: {
      tensDigit: 'Wpisuje dziesiątki sumy w okienko jedności', forgotCarry: 'Zapomina o przeniesionej 1', close: 'Myli się o jeden',
      wrong: 'Inne błędne cyfry', noCarry: 'Przenosi, gdy nie trzeba', carryOne: 'Przenosi więcej niż 1', forgotTen: 'Zapomina o pożyczonej dziesiątce',
      forgotLent: 'Zapomina, że z kolumny pożyczono', wrongCol: 'Kładzie klocki w złej kolumnie', tooMany: 'Używa za dużo elementów',
      readWrong: 'Źle liczy klocki', hour: 'Krótka wskazówka (godziny)', minute: 'Długa wskazówka (minuty)', both: 'Obie wskazówki', read: 'Odczytywanie zegara',
      num: 'Licznik ułamka (góra)', den: 'Mianownik ułamka (dół)', flag: 'Flagi', cont: 'Kontynenty', europe: 'Kraje Europy', letter: 'Litery w słowach',
      answer: 'Wyniki mnożenia', start: 'Zaczyna linię w złym miejscu', path: 'Zjeżdża ze ścieżki pisania', strip: 'Długość rzędu w ogrodzie', order: 'Kolejność (planety / kolumny)', quiz: 'Wiedza o planetach', pattern: 'Wzory',
    },
  },
};
