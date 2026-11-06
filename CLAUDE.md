# Red Cap

Browser 3D comic-ink "paper" slasher from the author's paintings: three floors, three.js r128, built into one offline HTML
(~6 MB). Live: https://serhiikazarian.github.io/red-cap/ (Pages, from `main`). Version: `git log -1 --format=%s
--grep='^[0-9]*\.[0-9][0-9]$'`.

## Working with Serj
- Serj does not code: plain language, they/them. Reply with what changed, what was tested, what to check in play.
- Only what is asked. Ambiguous look, sound, play or workflow: one AskUserQuestion with options first.
- Before anything slow, one line on what runs and how long; relay progress as it lands.
- All checks pass: say so, ask whether to ship. Never push `main` without their yes (`tools/wip.sh` is fine).
- Docs wait for the end of the chat: meanwhile only code (and its comments), the `#version` label and a `## N.NN (date)`
  entry in `docs/HISTORY.md` (one short bullet per change). At the end, sync `CLAUDE.md`, `docs/ARCHITECTURE.md` and the
  history once. Earlier only if Serj asks or later work depends on it (say so first).

## Working surgically
- `rg -n "name" game/src` (always a path), definitions `rg -n "^(async )?function name\b|^(const|let) name\b" game/src`;
  read around the hit only. Never read a whole `game/src` file, `game/assets/`, `game/vendor/`, `tests/baseline/` or a
  built HTML. Edits targeted, never whole-file rewrites.
- Change the file that owns the behaviour; tidy what you touch. Comments say how things work now. Each file opens with
  its tuning numbers and rules: read that first. No function 68+ lines (`node tools/sizes.js`) except `floorState`
  (G's field list).
- Conventions: a state machine is a table of one step per state (`PRIEST_STATES`, `MINE_STATES`, `GRUMP_STATES`…);
  shared helpers `heroDist(x, z)`, `ease(rate, dt)`, `glowSprite(map, extra)`, `figureRig()`, `cellMid(i)`, `KEEP_INK`
  / `INK_HIDE` (blending); bare numbers get names.
- `tools/` scripts print one word (`OK`, `SAME`, `SAVED`, `SHIPPED`, `PRERELEASED`). Long runs in the background, never
  poll. A probe: `tests/shot.js` with one expression (from a file via `"$(cat f)"` when it holds `$`). One screenshot
  only for a visual change.

## Layout
- `game/src/*.js` joined in name order into one script (`game/build.py`; one scope; only top-level `const`/`let` must
  exist before use at load). 0x core (util, audio, render + ink pass, textures, floors, world grid, fx, HUD); 1x Red Cap,
  weapons; 20 talker code (`TALKERS[letter]`, hooks at its top), 21 shots, 22–31 one file per talker; 4x floor features
  (pickups, traps, totems, 44 pyramids, niches, gates, cages, 48 bombs, 49 floor-three secret); 5x building a floor (50
  level, props, decor, architecture, dreamwork, 55 baking, 56 see-through); 6x flow + loading, menus, input, camera,
  loop, boot.
- `game/index.html` (build markers), `style.css`, `assets/` (`img/*.webp` → ASSETS, `sfx/*.mp3` → SOUNDS, fonts,
  `shapes.json`), `vendor/three-r128.min.js`. `tests/` (Playwright), `tools/`, `docs/ARCHITECTURE.md` (by section: read
  only the one you need).

## Checks
- Every change: `tools/check.sh` → `OK` (~15 s: format, build, lint, unused names, boot through the real loading screen).
- Play/looks unchanged: `tools/same.sh` → `SAME` (~80 s: 12 replays on a frozen clock with seeded dice + 7 pictures vs
  `tests/baseline/`). Replays enter floors directly (the loading screen needs its own probe) and miss some moves: force
  states in a probe and compare against `tools/build-at.sh N.NN` (old builds need the old `tests/harness.js`).
- Meant to change: after Serj's yes, `tools/same.sh new` (writes only what changed).
- Bigger changes: `NODE_PATH=$(npm root -g) node tests/soak.js game/red-cap.html 8` → `errors []` (~8 min).
- The test browser draws on the CPU (load ~40 s, frames 80–280 ms apart): judge timing with a fake clock, never feel.
- CI (`.github/workflows/pages.yml`) runs `check.sh` on `main`, `prerelease` and PRs; only `main` publishes and tags.

## Ship (only after Serj says yes)
1. Version = current + 0.01 unless Serj names one: `#version` in `game/index.html` and `## N.NN (date)` in HISTORY.
   Play/looks changed: `tools/same.sh new` first.
2. `tools/ship.sh N.NN "<attribution lines>"` → `SHIPPED N.NN`. Never merge, squash or force-push by hand. Pages ~3 min.
3. Undo: `git revert`, ship anew. An old version: `git fetch --tags; git checkout vN.NN -- game`, check, ship anew.
- To try first (Serj asks): label + history as for a ship, `tools/prerelease.sh N.NN "<attribution lines>"` →
  `PRERELEASED N.NN` (same version may go again). Serj downloads it from the CI run's Summary → Artifacts (30 days);
  give them the run link.
- Between versions: `tools/wip.sh "message" "<attribution lines>"` → `SAVED` (work branch only).

## Rules that bite
- **Load rule: anything new is prepared on the loading screen, never mid-game.** A new material or shader variant: a
  stand-in in `warmSet()` (60-flow) with the same key (type, flags, `onBeforeCompile`, instancing, `color` attribute). A
  new texture: `warmUp()`'s `texs`. A new floating word: `WORDS_FLOOR[floor]` (`WORD|#colour`, `_` for spaces). Verify:
  `renderer.info.programs` and `texImage2D` counts unchanged after `beginFloor`.
- Never `//` mid-line before code (use `/* */`). GLSL: no names `flat`, `smooth`, `in`, `out`, `sample`;
  `smoothstep(a, b, x)` needs a < b.
- Player text: -ing words as -in’ (typographic ’; not Sling/Ring/String). Censored: SH#T, F#CK.
- Layout rng is seeded per floor (`mulberry`): new decoration uses its own `mulberry(seed)`; per-start picks use
  `Math.random`. A refactor keeps every random roll in the same order (replays use seeded dice).
- Still meshes are baked (`bakeStatics`): anything that moves or changes is not `still()`. Big props see-through via
  `seeThru(o, dyn, how)`; never a global `renderOrder > 0` on a see-through part.
- Talker materials (`e.mats`) are reset every frame to the hit flash or no tint: colour parts with textures or vertex
  colours. One talker's specifics live in its `TALKERS` entry, never `e.type === 'X'` in shared code.
- Colours: `COL.ink` / `HEX.paper` … (00-util), `var(--ink)` … (style.css); never retype their hex (word lists write
  `${HEX.paper}`). Loudness: `VOL` (01-audio), one share per sound; never retype gains.
- A delay in play: `later(sec, fn)`, never `setTimeout` (screen flashes and `toast` keep it on purpose). Game rules run on
  `playT`; `performance.now()` only for cosmetic wobble. Floor motion goes in `G.anim`.
- `G` declares every field in `floorState` (50-level): never `G.x = G.x || []`.

## Game
- Floors: 1 *The Usher's Corridor* (Ushers B, Shades q, Geezer Y); 2 *The Mouth* (Grins G, Priest R, Bruno Z caged,
  pyramids on T cells: 1–2 bombs, 1–2 empty, the rest a heart; three blows break one); 3 *Stop Talkin’ Sh#t* (Grump U,
  Smokers S/W, blocks, Jester M behind the fog gate, totems, hidden boss L).
- Red Cap: ties (hearts, 5), yo-yo (a chain of three, the heavy third only within `YOYO_CHAIN` 0.85 s press to press),
  slingshot (pebbles, start 7, max 10), dodge. Camera speeds: `CAM_EASE`, `CAM_TURN` (63-camera). `CELL` = 3 m.
- localStorage: `redcap.catalogue.v1` (talker catalogue), `redcap.load.v1` (load times).

## History
`docs/HISTORY.md` (1.05 on): open only when Serj asks when/why something changed, or for a likely regression; search,
then read around hits. Older: `git show $(git rev-list --max-parents=0 HEAD):HISTORY.md | rg -n "word"`.

## Not verified by playing
On a real GPU: loading sharpness, scissors' pace, low-end frame rate, floor three's busiest moments, the 1.38 camera
speeds. By ear: volumes (title music, pyramid scream, bomb blast), laughs, pops, the exhale. By feel: yo-yo hit-stop in
slow motion, the 0.85 s chain, see-through fades in motion, Grump ring cracks, hologram gaze, Bruno's circle, talkers
breaking pyramids. Touch on a real phone; controller on hardware.
