# Pip's Paper School 🦉

Playful, paper-cut-out maths games for kids aged 5–9, built with three.js. English and Polish, with every hint read aloud by Pip the owl.

**Play:** https://dondany.github.io/count/ — or share a single game: `#sums`, `#minus`, `#blocks`.

## Activities
- **Adding** (`#sums`): column addition on squared paper. Drag paper digits into the boxes, carry the 1, count dots on the ten-frames when stuck. Levels: Easy (no carrying) · Carry · Big (3-digit) · Make your own sum.
- **Taking away** (`#minus`): column subtraction with borrowing. Tap the tens digit to borrow: it's crossed out, a stick of ten flies over and the ones become 1x. The ten-frames count down.
- **Tens & ones** (`#blocks`): place value with paper blocks. *Build* rounds: drag hundreds, tens and ones onto the mat (10 ones swap into a ten automatically). *Read* rounds: count the blocks and write the number. Number words in both languages.
- **Clock** (`#clock`): *set* rounds — drag the paper hands (the long hand clicks in 5-minute steps and drags the hour hand along like real gears), then press Ready; *read* rounds — drag the matching digital time onto the clock. Levels: o'clock · half & quarter · 5 minutes. Times in words ("quarter past 3", "wpół do czwartej").
- **Fractions** (`#frac`): *make* rounds — drag pizza slices or chocolate pieces onto the plate; *read* rounds — count the pieces and write the fraction with digit tiles. Fractions in words ("three quarters", "trzy czwarte").
- **Words** (`#words`): look at a paper picture, listen to Pip and spell the word with letter tiles (Polish letters included). Levels: trace the letters · spell · long words with decoy letters.
- **Animals** (`#animals`): drag 17 paper animals (kangaroo, panda, żubr…) onto the continent where they live.
- **Stickers** (`#stickers`): spend stars on sticker packs and fill a 40-sticker album; tap a sticker to hear its name.
- **Flags** (`#flags`): a paper world map with ~40 countries. Flags: drag the right flag onto a country's pin · Continents: drag a flag onto its continent · World: match several "?" pins to their flags. Pip tells you the continent and capital each time.

Help is layered everywhere: Pip explains, the 💡 button first counts things out with you, then makes the right piece glow; stars (1–3 per task) are saved in the browser.

## Run locally
The app uses JavaScript modules, which browsers won't load from a double-clicked file. From this folder run:

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Code layout
No build step — plain ES modules, three.js from a CDN.

```
index.html        page shell, HUD, styles
app.js            boot, hub ⇄ game switching (#hash links), HUD wiring
engine/           shared by every activity
  core.js         renderer, layout (wide/tall), picking, dragging, confetti, loop
  paper.js        cut-out paper textures, digits, shared materials
  pip.js          the owl + speech bubble   pencil.js  "do this next" pointer
  tray.js         strip of draggable pieces  ui.js      banner/stars, page wipe
  audio.js        synthesized sounds + read-aloud
  i18n.js         EN/PL strings, plurals, number words   store.js  saved progress
  world.js        sky, sun, hills, trees
games/            hub.js, column.js (adding + taking away), blocks.js, clock.js, fractions.js, flags.js, words.js,
                  animals.js, stickers.js; shared: panel.js (ten-frames), worldMap.js, pictures.js, flagsData.js
dev/test.html     headless test harness (drives the games via ?test&drive hooks)
```

A new activity is an object with `levels / enter / exit / setLevel / relayout / update / pointer / help / prompt / idle / canDrag / dragOpts / onLang`, registered in `app.js` and given a card in `games/hub.js`.

## GitHub Pages
Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)`.
