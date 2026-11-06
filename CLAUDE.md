# Red Cap

Browser 3D comic-ink "paper" slasher made from the author's own paintings: three floors, three.js r128, built into one offline
HTML (~6 MB). Live: https://serhiikazarian.github.io/red-cap/ (GitHub Pages, from `main`).
Version: `git log -1 --format=%s --grep='^[0-9]*\.[0-9][0-9]$'`.

## Working with Serj
- Serj does not code: plain language, they/them. Reply with what changed, what was tested, what to check in play.
- Only what is asked. Ambiguous look, sound, play or workflow: one AskUserQuestion with options first.
- Before anything slow, one line on what runs and how long; relay progress as it lands (a difference the moment it shows).
- Done and every check passes: say so and ask whether to ship. Never push `main` without their yes (`tools/wip.sh` is fine).
- **Docs wait for the end of the chat.** During it change code (with its comments) and what shipping needs: the `#version`
  label and a `## N.NN (date)` entry in `docs/HISTORY.md`, one short bullet per change. On the end-of-chat summary, sync
  `CLAUDE.md`, `docs/ARCHITECTURE.md` and that chat's history once to the latest build. Mid-chat only when Serj asks, or
  when later work in the chat depends on it (say so first).

## Working surgically (tokens matter)
- Find, then read only around the hit (offset/limit): `rg -n "name" game/src` (always a path: bare `rg` waits on stdin);
  definitions `rg -n "^(async )?function name\b|^(const|let) name\b" game/src`. Never read a whole `game/src` file, nor
  `game/assets/`, `game/vendor/`, `tests/baseline/` or a built HTML.
- Edits are targeted (Edit, or a small exact-match patch), never a whole-file rewrite.
- Change the file that owns the behaviour, and tidy what you touch (names, dead lines, stale comments, long functions
  into named steps: `node tools/sizes.js`; none is 68 lines or more: keep it so). Comments say how things work now. Each
  file opens with its tuning numbers and often a comment with its rules: read that first.
- `tools/` scripts, one word out (`OK`, `SAME`, `SAVED`, `SHIPPED`, `PRERELEASED`); a sequence needed twice becomes one. Cut long output;
  long runs in the background (Monitor), never poll. A probe: `tests/shot.js` with one expression (in a file via
  `"$(cat f)"` when it holds `$`). One screenshot only for a visual change.

## Layout
- `game/src/*.js`, joined in name order into one script by `game/build.py` (one scope: any file calls any function; only
  top-level `const`/`let` must exist before use at load). 0x core (helpers, sound, drawing + ink pass, textures, floors,
  world grid, effects, HUD); 1x Red Cap, weapons; 20 shared talker code (`TALKERS[letter]`, hooks listed at its top), 21
  shots, 22–31 one file per talker; 4x floor features (pickups, traps, totems, 44 pyramids, niches, gates, cages, 48 bombs,
  49 floor-three secret); 5x building a floor (50 level, props, decor, 53 architecture, 54 dreamwork, 55 baking, 56
  see-through); 6x flow and loading, menus, input, camera, loop, boot.
- `game/index.html` (markers filled by the build), `game/style.css`, `game/assets/` (`img/*.webp` → ASSETS, `sfx/*.mp3` →
  SOUNDS, fonts, `shapes.json`), `game/vendor/three-r128.min.js`. `tests/` (Playwright probes), `tools/`,
  `docs/ARCHITECTURE.md` (deeper rules by section: read only the one you need).

## Checks
- Every change: `tools/check.sh` → `OK` (~15 s: format, build, lint, unused names, boot through the real loading screen).
- Play and looks unchanged: `tools/same.sh` → `SAME` (~75 s: 12 full replays with a frozen clock and seeded dice + 7
  pictures against `tests/baseline/`, three at a time, the touched floors first; `2>&1` streams a line a job). Replays enter
  floors directly: the loading screen needs its own probe.
- Meant to change: after Serj's yes, `tools/same.sh new` (seconds after a check of the same build; writes only what changed).
- Bigger changes: `NODE_PATH=$(npm root -g) node tests/soak.js game/red-cap.html 8` → `errors []` (~8 min).
- Probes and pictures: `docs/ARCHITECTURE.md` § Testing. The test browser draws on the CPU (a load ~40 s, frames 80–280 ms
  apart): real-GPU speed and smoothness can't be judged there; test timing logic with a fake clock instead.
- CI (`.github/workflows/pages.yml`) runs `check.sh` on pushes to `main` and `prerelease` and on pull requests; only `main`
  publishes, tags and releases. `prerelease` keeps the built game as a download (the run's Summary page, Artifacts, 30 days).

## Ship (only after Serj says yes)
1. Version = current + 0.01 (1.09 → 1.10) unless Serj names one: `#version` in `game/index.html` (`v1.10`) and
   `## N.NN (date)` in `docs/HISTORY.md`. Play or looks changed: `tools/same.sh new` first.
2. `tools/ship.sh N.NN "<attribution lines>"` → `SHIPPED N.NN` (checks, one commit on top of `main`, links the work branch).
   Never merge, squash or force-push by hand. Pages updates in ~3 min; CI tags `vN.NN`.
3. Undo: `git revert <commit>`, ship anew. An older version: `git fetch --tags`, `git checkout vN.NN -- game`, check, ship
   anew. Never rewrite `main`'s history.
- To try a version first (when Serj asks): label and history as for a ship, then `tools/prerelease.sh N.NN "<attribution
  lines>"` → `PRERELEASED N.NN` (checks, one commit on top of `prerelease`, and of `main` when it lacks it; the same
  version may go again). CI builds it; Serj downloads it from the run's Summary page (Artifacts). It needs no force push;
  `git push --force-with-lease origin HEAD:prerelease` is allowed (settings) to replace it outright, never another branch.
- Between versions (the stop hook asks): `tools/wip.sh "message" "<attribution lines>"` → `SAVED` (work branch only).

## Rules that bite
- **Load rule: anything new is prepared during the loading screen, never mid-game.** A new material or shader variant: a
  stand-in in `warmSet()` (60-flow) with the real one's key (material type and flags, `onBeforeCompile`, instancing, a
  `color` attribute). A new texture: `warmUp()`'s `texs`. A new floating word: `WORDS_FLOOR[floor]` (`WORD|#colour`, `_`
  for spaces). Verify by counting `renderer.info.programs` and `texImage2D` calls after `beginFloor`.
- Loading (60-flow): `tune()` finds the drawing settings from real frames (settle, calibrate, then `climb` judged by the
  controller's own late-frame rule) while the scissors cross at one speed (`snipRun`, timed by the remembered load time
  `redcap.load.v1`); the floor shows as they arrive.
- Never `//` mid-line before code (use `/* */`). GLSL: no names `flat`, `smooth`, `in`, `out`, `sample`; `smoothstep(a, b,
  x)` needs a < b.
- Player text spells -ing words as -in’ (typographic ’; not Sling/Ring/String). Censored: SH#T, F#CK.
- Layout rng is seeded per floor (`mulberry`): new decoration uses its own `mulberry(seed)`; per-start picks (bombs, empty
  pyramids) use `Math.random`.
- Still meshes are baked (`bakeStatics`): anything that moves or changes later is not `still()`.
- See-through: big props via `seeThru(o, dyn, how)`; never a global `renderOrder > 0` on a see-through part.
- Talker materials (`e.mats`) are brought back every frame to the hit flash or no tint (written only where different, so
  another writer's colour is undone): colour parts with textures or vertex colours.
- One talker's specifics go in its `TALKERS` entry, never `e.type === 'X'` in shared code.
- Core colours: `COL.ink` / `HEX.paper` … (00-util), `var(--ink)` … in style.css; never retype their hex values (the word
  lists write `${HEX.paper}`). Still typed out: the scissors' strokes in index.html. A cell's centre: `cellMid(i)`.
- A delay in play: `later(sec, fn)`, never `setTimeout` (screen flashes and `toast` keep `setTimeout` on purpose:
  `later()` stops on death and does not run on the title). Game rules run on `playT` (stops while paused, slows with
  hit-stop); `performance.now()` only for cosmetic wobble. Floor motion goes in `G.anim`.
- `G` declares every field in `newFloor` (50-level): never `G.x = G.x || []`.
- Loudness: `VOL` (01-audio), one share per sound name; never retype gains.

## Game
- Floors: 1 *The Usher's Corridor* (Ushers B, Shades q, Geezer Y); 2 *The Mouth* (Grins G, Priest R, Bruno Z caged, pyramids
  on T cells: 1–2 bombs, 1–2 empty, the rest a heart; three blows from Red Cap or talkers' shots break one); 3 *Stop Talkin’
  Sh#t* (Grump U, Smokers S/W, blocks, Jester M behind the fog gate, totems, hidden boss L).
- Red Cap: ties (hearts, 5), yo-yo, slingshot (pebbles, start 7, max 10), dodge. `CELL` = 3 m; floors in `FLOORS`.
- localStorage: talker catalogue `redcap.catalogue.v1`, load times `redcap.load.v1`.

## History
`docs/HISTORY.md` (1.05 on): open only when Serj asks when or why something changed, or for a likely regression; search,
then read around the hits. Older: `git show $(git rev-list --max-parents=0 HEAD):HISTORY.md | rg -n "word"`.

## Not verified by playing
On a real GPU: the loading's chosen sharpness (floors start crisp?), the scissors' pace, low-end frame rate, floor
three's busiest moments (smoke, fog wall). By ear: volumes (title music, pyramid scream, bomb blast), laughs, pops, the
exhale. By feel: the yo-yo's hit-stop inside slow motion (now short), see-through fades in motion, Grump ring cracks,
hologram gaze timing, Bruno's circle, talkers breaking pyramids. Touch on a real phone; controller on hardware.