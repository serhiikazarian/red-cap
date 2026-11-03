# Red Cap: change history

One entry per version, newest at the bottom: `## N.NN (date)`, short plain bullets, key names in backticks. Search it, don't
read it whole. Versions before 1.05 (the old numbering, up to 7.2) are not in the tree:
`git show 0508438:HISTORY.md | rg -n "name"`.

## 1.05 (3 Nov 2026)
- Fresh repository from Serj's 7.2 folder (same game). Version numbering restarts at 1.05: two digits after the point, +0.01
  per release; a version is the commit whose subject is exactly the number. The title screen shows it bottom left, in small
  grey letters (`#version`, `v1.05`).
- Each push to `main` builds, checks and publishes on GitHub Pages (`.github/workflows/pages.yml`). Built copies are not kept:
  `tools/build-at.sh N.NN` rebuilds any version. Docs: `CLAUDE.md` (always loaded), `docs/ARCHITECTURE.md` (on demand),
  `README.md` in English.

## 1.06 (3 Nov 2026), no change to the game
- Leaner for future sessions: this file keeps only versions from 1.05 on (the old log stays in git, see above); `CLAUDE.md`
  is shorter and says how to work surgically; probe notes moved to `docs/ARCHITECTURE.md` § Testing.
- One command per check: `tools/check.sh` → `OK` (format, build, lint, unused names, boot) and `tools/same.sh` → `SAME`
  (replays + pictures against the baselines; `full`, or `new` to remake them).
- The picture test photographed a blank screen (a fade frozen at its start covered every floor), so it proved nothing. It now
  lets fades finish and fixes the dice from the page's first line (the smoke texture is drawn at random at start-up), and
  shows each floor the same way every run; its baselines were remade.
- Title label `v1.06`.

## 1.07 (3 Nov 2026)
- When a boss opens up, a big yellow word flashes mid-screen in the marker font: `EXPOSED` (the Priest loses his last ghost),
  `UNMASKED` (the Jester's mask breaks), `WINDED` (the Geezer runs out of breath). Under it, a smaller red line
  `Attack him!` swells in and out. The small yellow "— hit him" line under the boss's name is gone.
- When the Geezer misses his last stare, `WINDED` takes over from `MISSED` at once.
- `bigWord(text, color, size, under)` takes an optional smaller line; a talker's `bar(e)` returns `[text, lit, word]`.
- Title label `v1.07`.

## 1.08 (3 Nov 2026)
- Each talker's own rules when hit or torn moved from the shared code into its file (`TALKERS` hooks `shielded`, `struck`,
  `hurt`, `escape`, `torn`, `drops`, `gone`, `trapped`, and traits such as `stagger`, `knock`, `rim`, `harmless`, `loud`);
  play unchanged.
- Long fights split into one step per state (`JESTER_ST`, `GEEZER_ST`, `USHER_ST`, `PRIEST_ST`, `SMOKER_ST`); floor one's dream
  corridor split into named pieces.
- New files: `48-bombs.js` (from the pyramids), `49-secret.js` (the plaques, the painting and the Laughin’ Jaw, from
  Livin’ / Dyin’), `54-dreamwork.js` (each floor's dream architecture, from the architecture file); baking and see-through
  are now `55-bake.js` and `56-see-through.js`.
- One colour palette in the code (`COL`, `HEX`, 00-util) and named page colours (`--alarm`, `--sheet`, `--muted`); the page's
  yellow is now the game's warmer `#f0cf2e` (EXPOSED / UNMASKED / WINDED, the lock ring).
- Five delays in play (the fog gate opening, the Jester's final mask, the win after his last laugh, a cough's echo, an
  onlooker's voice) now wait while the game is paused (`later`).
- Slow machines: below `RES_MIN` the quality control may go on to `RES_LOW` 0.6, with lighter smoke (`PUFF_LOW` 25). Fast
  machines unchanged.
- Small tidying: `loseJaw`, `START_AMMO`, the resolution controller in one place (`adaptResolution`, `resCap`), `bossInFight`,
  `touchControls`.
- Tools: CI runs `tools/check.sh ci`; the tools find their parser through eslint; the tests share `tests/browser.js`; the
  test pictures' quality is fixed. Replay baseline remade (the paused-timer change).
- Title label `v1.08`.
