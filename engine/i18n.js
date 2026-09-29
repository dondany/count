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
  },
  pl: {
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
  },
};
