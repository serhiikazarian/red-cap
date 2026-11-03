# Red Cap: lean context (v7.2, 3 Nov 2026)

Serj's browser 3D comic-ink "paper" slasher made from his paintings. One self-contained HTML (three.js r128 inlined, ~5.7 MB). Serj does not code: plain language. Use they/them for Serj unless told otherwise.

## How Serj wants to work (strict)
- Implement **only what is asked**. If look/sound/play is ambiguous, ask one short question first (AskUserQuestion, with options).
- Output: **only the frozen build** `red-cap-vN.N.html` (SendUserFile, attach), unless asked otherwise. One screenshot only when it helps.
- Keep tokens low: grep, then `sed -n` ranges. Don't reread docs; HISTORY.md / HANDOFF.md only when a task touches older systems.
- Reply: short plain summary of what changed, what was tested, what to check in play.
- **Load rule: anything new must be prepared during the loading screen, never mid-game.** A new material or shader variant goes into `warmSet()` (60-flow.js) (a stand-in mesh; match the real one's key: same material type and flags, `onBeforeCompile`, instancing, and a `color` attribute if the real geometry has one). A new texture goes into `warmUp()`'s `texs` set (all `TEX` are already included). A new floating word goes into `WORDS_FLOOR[floor]` (`WORD|#colour`, `_` for spaces). Verify by counting `renderer.info.programs` and `texImage2D` calls after `beginFloor` (see Probes).

## Start a new session
1. Unzip `red-cap-v7.2.zip`, then `cd red-cap`. It is a git repository (branch `master`, one commit and tag per version, v4.7 and
   v6.0–v7.2). Only the latest frozen build is in the folder; older ones are in the tags (`git show v6.5:game/red-cap-v6.5.html`).
2. On GitHub, the repository is pushed from here: `git remote add origin <url> && git push -u origin master --tags` (once; after
   that, push each version's commit and tag).
3. `python3 game/build.py && cmp game/red-cap.html game/red-cap-v7.2.html` (must be byte-identical).

## Layout (since 4.7 = 6.0: a clean rewrite, same game)
- `game/src/*.js`: the game, one file per part, joined in name order into one script by `game/build.py` (one shared scope, so
  any file can call any function; only top-level `const`/`let` must be declared before they are used at load). `00-util.js`
  lists the groups: 0x core (helpers, sound, drawing + ink pass, textures, floor data, world grid, effects, HUD), 1x Red Cap
  and his weapons, 20 shared talker code (`TALKERS[letter] = { make, update, dying, dazed, bar, warn }`, `damage`, `kill`),
  21 shots, 22–31 one file per talker, 4x floor features (pickups, onlookers, traps, totems, pyramids, niches, gates, cages),
  5x building a floor (`buildLevel` in named steps, props, decor, architecture, baking, see-through), 6x flow, menus and
  catalogue, input, camera, main loop, start-up.
- `game/index.html` (page; `/*INCLUDE path*/` lines are replaced by files), `game/style.css`, `game/data/` (fonts, ASSETS,
  painting, SHAPES, SOUNDS), `game/vendor/three-r128.min.js`.
- Each talker's file holds its build, its fight and its own helpers; tuning numbers sit at the top of each file.

## Making a change (next: **7.3**)
- Edit the files in `game/src` directly (grep first; `node tools/sizes.js` lists the longest functions). Keep comments short
  (why, not what), no version history in code.
- Build and check, from `red-cap/` after `export NODE_PATH=$(npm root -g)`, one browser at a time:
  - `python3 tools/fmt.py && python3 game/build.py && tools/lint.sh && node tests/boot.js game/red-cap.html` → `formatted`, silent lint, `[]`
  - `node tools/unused.js` → names nothing uses (should print nothing)
  - `node tests/soak.js game/red-cap.html 8` → last line `errors []` (~8 min; only for bigger changes)
  - Picture or probe: `node tests/shot.js game/red-cap.html out.png "<js>" <floor 0-2> <waitMs>` (JS may be async and return JSON).
    To pin the camera, wrap `renderer.render` and set the camera when `c===camera`.
- Proving a change does NOT alter play or looks (tidying, optimising): the replay and picture tests run fixed scenarios with a
  frozen clock, seeded dice and a scripted player (`tests/harness.js`) and must match the previous version exactly:
  - `node tests/replay.js game/red-cap.html out/new.json quick && node tests/replay-cmp.js tests/baseline/replay-v4.6-quick.json out/new.json` → `ALL SAME` (2 min; full run without `quick`, against `replay-v4.6.json`)
  - `node tests/pics.js game/red-cap.html out/pics && python3 tests/pics-cmp.py tests/baseline/pics-v4.6 out/pics` → `ALL SAME`
  - `node tests/menus.js <old build> out/a && node tests/menus.js game/red-cap.html out/b && python3 tests/pics-cmp.py out/a out/b`
  - A change that is meant to alter play will differ: then make new baselines from the new build (`tests/baseline/`).
- Never put `//` mid-line before code. GLSL: avoid the names `flat`, `smooth`, `in`, `out`, `sample`. Player text spells -ing words as -in'.
- Ship:
  - Append "What changed in N.N" to HISTORY.md.
  - Bump the version lines: CONTEXT.md line 1 and the "next:" line, CLAUDE.md, HANDOFF.md lines 1 and 10.
  - `cp game/red-cap.html game/red-cap-vN.N.html`, commit, `git tag vN.N`, send only that html.

## Probe gotchas
- Headless game time runs about 5–10× slow. Red Cap's position is held at floor start, so move the thing to him instead.
- The test browser locks the mouse during play, so hover can't be tested on the pause menu (test hover on the title screen).
- In three r128, a material's program is `renderer.properties.get(m).currentProgram`.
- The CPU profile under swiftshader is useless (drawing is emulated on the CPU). Count work instead: programs, uploads, draw calls (`renderer.info.autoReset=false`).
- Still meshes are baked (`bakeStatics`), so animated parts need their own non-still mesh. Some floor-2 ground is raised: use `heightAt`.

## Game
- **Floors:**
  - 1 *The Usher's Corridor*: Ushers B, Shades q, Geezer Y.
  - 2 *The Mouth*: Grins G, Priest R, Bruno Z caged, pyramids on T cells, niches.
  - 3 *Stop Talkin' Shit*: Grump U, Smokers S/W, blocks, Jester M behind fog gate, totems, hidden boss.
- **Red Cap:** hearts (ties, 5), yo-yo, slingshot (pebbles, start 7, max 10), dodge.
- **Map:** cell `CELL` = 3 m; floor configs live in `FLOORS`.

## Recent changes (13.4 → 3.0, all Serj's requests; details in HISTORY.md)
- **God mode:** type G-O-D in play to fill ties and pebbles and skip to the next floor (on floor 3 it wins).
- **Menus:**
  - The focused button is always the only red one (`.screen:not(.padnav) button:focus`); arrows / WASD / Tab and mouse hover move it.
  - No focus outline.
  - Title: music icon button bottom-right (`#musicBtn`, crossed note = off); title music (`TMUS`) plays only after it is pressed.
- **Big centred marker words** (`bigWord(text, color, size)`): MUFFLED (1/1.7 size), HOT, FRENZY, Geezer's MISSED. Hints (`#toast`) sit low on screen. No BIG HEART word.
- **Grump's rings:**
  - Gaps behind blocks are wider (`GRUMP_SHADE.w` 1.5, shelter too), with animated torn rims and shards; they crack 3.5 m before a block.
  - Strong while they can hurt (`GRUMP_REACH` 33 m), then faint and fading.
  - Shader `waveCompile`, clock `WAVE_T`.
- **Bruno:** pulsing red ground circle at `BRUNO_SCORCH` (`e.fireRing`, hidden behind walls).
- **Kill words:** a Shade or Priest ghost shows POPPED.
- **Floor 2:**
  - Gothic cornice on wall tops (`corniceGeo`, thick shapes only: thin railings flickered).
  - Niches avoid red wall words (`G.wallWords`).
  - Niches (`G.niches`, `updNiches`): look straight at one for 2.5 s within 7 m and the nearest talker appears as a violet hologram (`holoShow`, `holoMat`). Hitting it blesses Red Cap (`hero.blest`, 3/4 speed for 3 s).
- **Loading scrap:** the scissors chop (two blade SVGs rotating, compositor-only).
- **Performance (3.0):**
  - All 62 `TEX` plus floor words, trail, hologram and wave shaders are prepared in `warmUp`/`warmSet`; measured: 0 shaders and 0 textures made mid-play in any boss phase.
  - `clearLevel` frees see-through materials.
  - Ink pass reads less: shared centre depth, Red Cap's outline only in `heroBox`.
  - Anisotropic filtering 4×.
  - The controller switches to `lite` (single ink lines) before lowering resolution.

## Key conventions
- **See-through:** use `seeThru(o, dyn, how)`; pyramids and pillars use `seeSolid`. Never give see-through parts a global `renderOrder > 0`.
- **Soft alpha:** soft-alpha things must keep dst alpha (`CustomBlending`, `blendSrcAlpha` Zero, `blendDstAlpha` One). The ink pass skips where RT alpha < 1.
- **Sounds:** `sTone` / `sNoise` / `SFX.*`, distance-faded by `AU.at` (null = full volume).
- **Layout rng** is seeded per floor (`mulberry`): new decoration uses its own `mulberry(seed)` and must not draw from the floor's rng.

## Not verified by playing
- Real-GPU frame rate on low-end machines (the 3.0 performance work is measured, not felt).
- Volumes: title music, pyramid scream, bomb blast.
- Feel of the Grump ring cracks, the hologram gaze timing, and Bruno's circle visibility.
