# Red Cap

Serj's browser 3D comic-ink "paper" slasher made from their own paintings: three floors, three.js r128, built into one
self-contained HTML (~6 MB, no network needed). Live: https://serhiikazarian.github.io/red-cap/ (GitHub Pages, from `main`).
Current version: `git log -1 --format=%s --grep='^[0-9]*\.[0-9][0-9]$'`.

## Working with Serj
- Serj does not code: plain language, they/them unless told otherwise. Reply with what changed, what was tested, what to check in play.
- Implement **only what is asked**. If look, sound or play is ambiguous, ask one short question first (AskUserQuestion, with options).
- The game is settled for a festival demo: nothing that changes how it plays, looks or sounds unless Serj asks.
- When a task is done and every check passes, say so and **ask whether to push**. Never push without their yes.

## Working surgically (tokens matter)
- Find before reading: `rg -n "name" game/src` (always give a path: bare `rg` waits on stdin). Definitions:
  `rg -n "^(async )?function name\b|^(const|let) name\b" game/src`. Then read only the lines around the hit (offset/limit).
  Never read a whole file in `game/src`; never open `game/data/`, `game/vendor/`, `tests/baseline/` or a built HTML.
- Make the change in the file that owns the behaviour. When rewriting code, tidy what you touch in the same pass: clearer
  names, dead or duplicated lines, stale comments, a long function split into named steps (`node tools/sizes.js` lists the
  longest). Tidying must not change play or looks: when the task itself doesn't alter play, prove it with `tools/same.sh`.
- Comments describe how things work now, never what they used to be or what was changed.
- Tuning numbers sit at the top of each file; many files open with a comment explaining their rules: read that first.
- Don't reread docs already in context. One screenshot only when the change is visual.

## Layout
- `game/src/*.js`: the game, one file per part, joined in name order into one script by `game/build.py` (one shared scope: any
  file can call any function; only top-level `const`/`let` must exist before they are used at load). Groups: 0x core (helpers,
  sound, drawing + ink pass, textures, floor data, world grid, effects, HUD), 1x Red Cap and weapons, 20 shared talker code
  (`TALKERS[letter] = { make, update, dying, dazed, bar, warn }`), 21 shots, 22–31 one file per talker, 4x floor features,
  5x building a floor, 6x flow, menus, input, camera, loop, boot.
- `game/index.html` (page; `/*INCLUDE path*/` lines are replaced by files), `game/style.css`, `game/data/` (fonts, ASSETS,
  painting, SHAPES, SOUNDS: huge one-line blobs), `game/vendor/three-r128.min.js`.
- `tests/` (headless Playwright probes), `tools/`, `docs/ARCHITECTURE.md` (deeper rules, by section: read only the one you need).

## Checks
- After every change: `tools/check.sh` → `OK` (format, build, lint, unused names, boot; else `FAIL <step>` and its output).
- Proving a change does NOT alter play or looks (tidying, optimising): `tools/same.sh` → `SAME` (~2 min: scripted replays with a
  frozen clock and seeded dice, plus fixed pictures of each floor, against `tests/baseline/`; `full` for the long replay).
- A change meant to alter play or looks will differ: after Serj approves it, `tools/same.sh new` remakes the baselines.
- Bigger changes: `NODE_PATH=$(npm root -g) node tests/soak.js game/red-cap.html 8` → last line `errors []` (~8 min).
- Writing a probe or taking a picture: read `docs/ARCHITECTURE.md` § Testing first.
- CI (`.github/workflows/pages.yml`) runs the same quick checks on every push and pull request, and publishes `main`.

## Ship (only after Serj says yes)
1. Version = current + 0.01, two digits after the point (1.06 → 1.07; 1.09 → 1.10; 1.99 → 2.00). Set the title label to match
   (`#version` in `game/index.html`: `v1.07`). Append `## N.NN (date)` to `docs/HISTORY.md`: short plain bullets, key names
   in backticks.
2. One commit with the subject exactly `N.NN` on the finished state, `git push origin main`. Pages updates in ~3 min.
   No tags (cloud sessions can't push them); never push a draft version commit you may replace later.
3. Undo: `git revert <commit>`, push (a new version). Never rewrite `main`'s history.

## Rules that bite
- **Load rule: anything new is prepared during the loading screen, never mid-game.** A new material or shader variant goes into
  `warmSet()` (60-flow.js) as a stand-in mesh matching the real one's key (material type and flags, `onBeforeCompile`,
  instancing, a `color` attribute if the real geometry has one). A new texture goes into `warmUp()`'s `texs` (all `TEX` are in).
  A new floating word goes into `WORDS_FLOOR[floor]` (`WORD|#colour`, `_` for spaces). Verify by counting
  `renderer.info.programs` and `texImage2D` calls after `beginFloor`.
- Never put `//` mid-line before code (use `/* */`). GLSL: no names `flat`, `smooth`, `in`, `out`, `sample`; `smoothstep(a, b, x)` needs a < b.
- Player text spells -ing words as -in’ (typographic ’; not Sling/Ring/String). Censored: SH#T, F#CK.
- Layout rng is seeded per floor (`mulberry`): new decoration uses its own `mulberry(seed)`, never the floor's rng.
- Still meshes are baked (`bakeStatics`): anything that moves or changes later must not be marked `still()`.
- See-through: register big props with `seeThru(o, dyn, how)`; never give a see-through part a global `renderOrder > 0`.
- Talker materials (`e.mats`) get their colour reset every frame (hit flash): colour parts with textures or vertex colours.

## Game
- Floors: 1 *The Usher's Corridor* (Ushers B, Shades q, Geezer Y); 2 *The Mouth* (Grins G, Priest R, Bruno Z caged, pyramids
  on T cells, niches); 3 *Stop Talkin’ Sh#t* (Grump U, Smokers S/W, blocks, Jester M behind the fog gate, totems, hidden boss L).
- Red Cap: ties (hearts, 5), yo-yo, slingshot (pebbles, start 7, max 10), dodge. Map cell `CELL` = 3 m; floors in `FLOORS`.
- Catalogue of talkers in localStorage `redcap.catalogue.v1`.

## History
`docs/HISTORY.md` holds the versions from 1.05 on. Open it only when Serj asks when or why something changed, or a bug looks
like a regression: search, then read the few lines around the hits. Older versions are not in the tree: search them with
`git show 0508438:HISTORY.md | rg -n "pyramid"` (never read it whole).

## Not verified by playing
Real-GPU frame rate on low-end machines; volumes (title music, pyramid scream, bomb blast); feel of the Grump ring cracks,
the hologram gaze timing, Bruno's circle; touch on a real phone; controller on hardware.
