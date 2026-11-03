# Red Cap

Serj's browser 3D comic-ink "paper" slasher made from their own paintings: three floors, three.js r128, built into one
self-contained HTML (~6 MB, no network needed). Live: https://serhiikazarian.github.io/red-cap/ (GitHub Pages, from `main`).
Current version: the newest commit whose subject is just `N.NN` (`git log -1 --format=%s --grep='^[0-9]*\.[0-9][0-9]$'`);
every version's details are in `docs/HISTORY.md`.

## Working with Serj
- Serj does not code: plain language, they/them unless told otherwise. Reply with what changed, what was tested, what to check in play.
- Implement **only what is asked**. If look, sound or play is ambiguous, ask one short question first (AskUserQuestion, with options).
- The game is settled for a festival demo: nothing that changes how it plays, looks or sounds unless Serj asks.
- When a task is done and every check passes, say so and **ask whether to push**. Never push without their yes.
- Keep tokens low: grep `game/src`, then read line ranges. One screenshot only when the change is visual. Don't reread docs.

## Layout
- `game/src/*.js`: the game, one file per part, joined in name order into one script by `game/build.py` (one shared scope: any
  file can call any function; only top-level `const`/`let` must exist before they are used at load). Groups: 0x core (helpers,
  sound, drawing + ink pass, textures, floor data, world grid, effects, HUD), 1x Red Cap and weapons, 20 shared talker code
  (`TALKERS[letter] = { make, update, dying, dazed, bar, warn }`), 21 shots, 22–31 one file per talker, 4x floor features,
  5x building a floor, 6x flow, menus, input, camera, loop, boot. Tuning numbers sit at the top of each file; many files open
  with a comment explaining their rules: read it first.
- `game/index.html` (page; `/*INCLUDE path*/` lines are replaced by files), `game/style.css`, `game/data/` (fonts, ASSETS,
  painting, SHAPES, SOUNDS: huge one-line blobs, never read them), `game/vendor/three-r128.min.js`.
- `tests/` (headless Playwright probes), `tools/` (format, lint, sizes, unused names, build-at), `docs/`.

## Build and check
From the repo root, `export NODE_PATH=$(npm root -g)`, one browser at a time:
- `python3 tools/fmt.py && python3 game/build.py && tools/lint.sh && node tests/boot.js game/red-cap.html` → `formatted`, silent lint, `[]`
- `node tools/unused.js` → prints nothing. `node tools/sizes.js` lists the longest functions.
- `node tests/soak.js game/red-cap.html 8` → last line `errors []` (~8 min; bigger changes only).
- Picture or probe: `node tests/shot.js game/red-cap.html out/x.png "<js>" <floor 0-2> <waitMs>` (JS may be async and return
  JSON). To pin the camera, wrap `renderer.render` and set the camera when `c===camera`.
- Proving a change does NOT alter play or looks (tidying, optimising): fixed scenarios with a frozen clock, seeded dice and a
  scripted player (`tests/harness.js`) must match exactly:
  - `node tests/replay.js game/red-cap.html out/new.json quick && node tests/replay-cmp.js tests/baseline/replay-quick.json out/new.json` → `ALL SAME` (full: no `quick`, `replay.json`)
  - `node tests/pics.js game/red-cap.html out/pics && python3 tests/pics-cmp.py tests/baseline/pics out/pics` → `ALL SAME`
  - Menus against an older version: `tools/build-at.sh N.NN`, then `node tests/menus.js out/red-cap-N.NN.html out/a && node tests/menus.js game/red-cap.html out/b && python3 tests/pics-cmp.py out/a out/b`
  - A change meant to alter play will differ: then make new baselines from the new build (`tests/baseline/`).
- CI (`.github/workflows/pages.yml`) runs build, format check, lint, unused and boot on every push and pull request.

## Ship (only after Serj says yes)
1. Version = current + 0.01, always two digits after the point (1.05 → 1.06; 1.09 → 1.10; 1.99 → 2.00). Set the title
   screen's label to match (`#version` in `game/index.html`, bottom left: `v1.06`). Append `## What changed in N.NN (date)`
   to `docs/HISTORY.md`: short plain bullets, key names in backticks.
2. One commit with the subject exactly `N.NN` on the finished state (that commit is the version: `tools/build-at.sh N.NN` finds it), `git push origin main`.
   Pages updates in ~3 min (Actions tab). Cloud sessions can't push tags (the proxy drops them): don't rely on tags.
   Never push a draft version commit you may replace later (force-pushing is blocked).
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
- Deeper rules (rendering, see-through, baking and memory, sound, loading): `docs/ARCHITECTURE.md`, read when touching those.

## Probe gotchas
- Headless game time runs 5–10× slow; Red Cap is held at floor start, so move the thing to him instead.
- Clicking `#startBtn` enters a floor in steps: wait for `state === 'intro'`. A probe entering floors directly calls
  `slidesOn(false)` first, moves `hero.root` with `hero.pos` and turns `hero.parts.face` to `cam.yaw`.
- The test browser locks the mouse in play: test hover on the title screen. God mode: type G-O-D in play (fills ties and pebbles, next floor; wins on floor 3).
- Under swiftshader CPU profiles are useless: count programs, uploads, draw calls (`renderer.info.autoReset=false`).
  A material's program: `renderer.properties.get(m).currentProgram`. Some floor-2 ground is raised: use `heightAt`.
- `rg` with no path waits on stdin in this shell: always give a path (`rg -n name game/src`).

## Game
- Floors: 1 *The Usher's Corridor* (Ushers B, Shades q, Geezer Y); 2 *The Mouth* (Grins G, Priest R, Bruno Z caged, pyramids
  on T cells, niches); 3 *Stop Talkin’ Sh#t* (Grump U, Smokers S/W, blocks, Jester M behind the fog gate, totems, hidden boss L).
- Red Cap: ties (hearts, 5), yo-yo, slingshot (pebbles, start 7, max 10), dodge. Map cell `CELL` = 3 m; floors in `FLOORS`.
- Catalogue of talkers in localStorage `redcap.catalogue.v1`.

## History
`docs/HISTORY.md` (~35k tokens, from the first builds to now) is the record of why things are the way they are. Never read it whole. Open it only
when a task touches an older system, a bug looks like a regression, or Serj asks when or why something changed: search first
(`rg -n "pyramid|PYR_" docs/HISTORY.md`), then `sed -n` the few lines around the hits. Old builds: `tools/build-at.sh N.NN` (from 1.05 on).

## Not verified by playing
Real-GPU frame rate on low-end machines; volumes (title music, pyramid scream, bomb blast); feel of the Grump ring cracks,
the hologram gaze timing, Bruno's circle; touch on a real phone; controller on hardware.
