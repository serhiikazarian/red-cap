# Red Cap: how the code fits together

Read the section you need when a task touches it. File names are in `game/src/`. Why a rule exists: search `docs/HISTORY.md`, or for older versions `git show $(git rev-list --max-parents=0 HEAD):HISTORY.md | rg -n "name"`.

## Geometry, memory, baking (03-textures, 55-bake, 50-level)
- `paper(name, h, depth, lit, once)`: a painted cut-out from `SHAPES`. `once` for a one-off size (e.g. onlookers' random heights),
  which must not go into the shared shape cache.
- `share()` marks geometry/materials that are never disposed. A shape made again and again mid-fight is made once and shared.
- Textures owned by one floor go in `OWN` (`own(t)`). `clearLevel` frees what is still in `G.group`; anything removed for good
  mid-floor goes through `discard(o)` (frees its geometry and `OWN` textures; materials are left to the garbage collector,
  because disposing the last material of a kind destroys its shader program).
- `still()` means "baked": `bakeStatics()` (end of `buildLevel`) merges every still, opaque mesh (and transparent ones whose
  material is marked `flat()`) into one mesh per material look. Never keep a reference to a still mesh to change it later.
- Helpers: `mergeGeos([[geo, M4(...)]])` (keeps uv + vertex colours), `M4(x,y,z,rx,ry,rz,sx,sy,sz)`.
- Instanced pools: particles and blood (`instPool`: `PMESH`, `BLOOD`, 06-fx), floor one's drips (50-level), falling pages
  (52-decor), motes and birds (54-dreamwork); floor-3 block props and box-shaped floaters are instanced by texture
  (`instanceProps`, `syncBoxes` after any change, 51-props).
- Smoke is batched (06-fx): `puffs` hold stand-ins; `puffSync()` (start of `render()`) fills `PUFF_MESHES` (≤ 8 instanced
  draws). Never add a Sprite per puff. `PUFF_MAX` 45 (`PUFF_LOW` 25 on a slow machine).
- A stand-in mesh inside frozen `G.group` needs `matrixWorldNeedsUpdate = true` when moved.

## Assets (game/assets)
- Real files; `game/build.py` packs them into the one offline file as data (`/*DATA ASSETS assets/img*/` and the other marker
  lines in index.html). The game never loads a file at run time: opened from disk, a browser would block that.
- `img/<name>.webp` → `ASSETS[name]`; every one becomes `TEX[name]` except the title's `slide_*`; `t_*` are wall and floor
  paintings (mirror-repeated). `shapes.json` (one cut-out per line) → `SHAPES[name]`: `{ aspect, pts }`, the painting's
  outline as 0..1 points, which `paper(name, …)` cuts and extrudes. `sfx/<name>.mp3` → `SOUNDS[name]`, played with
  `playClip(name, gain)`. `fonts/*.woff2`, declared in `game/fonts.css`. A new painting: drop its webp in `img/`, add an
  outline to `shapes.json` if it is a cut-out, and check it is uploaded during loading (`warmUp`).
- Made outside this repository: the source pictures, the pyramid model and the scripts that drew the jaw and the Grin's fire
  and mouth were in Serj's older project folders; they are not here.

## World and placement (05-world, 04-floors)
- Grid `CELL = 3` m; `solid()` ('#', and 'g' while `G.gateClosed`); raised floor `LIFT = 1.5` (things built inside a raised
  cell are lifted automatically: don't add height twice); `heightAt` for ground height. `cellOf(x, z)` gives the cell at a
  point, `cellMid(i)` the middle of cell i in metres.
- Random set dressing must pass `clearOf(x, z, r)`; story things claim ground with `keepOut(x, z, r)`; `storyGround()` lays
  down the map's story cells and talkers.
- Map legend and per-floor settings live in `FLOORS` (04-floors); the optional fields `start` and `pitch` set the opening view,
  `camThruFloaters` (floor one: drifting things never push the camera in), `plainFloaters` (floor one's floaters fade without
  a contour), `strayShots` (floor two: see Talkers), `pyramids`, `flatProps` and `embers` (floor two). Shared code reads these,
  never `F.deco` (that only picks what the floor builder makes). Obstacle sizes: `propRadius`, `BUMP_R`.
- "Can he see you?" has two answers; pick the one the rule means: `clearOfWalls` counts walls only; `clearOfCover` also pillars and props, or pillars only with `props = false` (the Geezer's stare:
  `geezerSees`; his blink still treats an easel as cover, to spook).

## Drawing and the ink pass (02-render, 03-textures)
- Red Cap's cards use `markInk` blending (clears render-target alpha) and `featherEdge`; the post pass skips ink near
  alpha-cleared pixels, and `inkCard` gives him his own smooth outline. Grain and vignette live in the post shader.
- Soft alpha: soft-alpha things keep the target's alpha (`CustomBlending`, `blendSrcAlpha` Zero, `blendDstAlpha` One), so the
  ink lines round them are not cut. The ink pass skips where the render target's alpha < 1.
- The ink pass reads depth through `uniform highp sampler2D tDep`: WebGL2 samplers default to lowp, which many phone GPUs
  honour, rounding depth into steps the outlines draw as lines sliding with the camera. A new depth read is highp too.
- Sorting: `renderer.setTransparentSort` draws far to near, but a figure of parts in a set order (a Grin: `userData.sortRank`,
  `sortZ` from `sortUnits()` each frame) sorts as one thing. Words keep `renderOrder` 10 (always on top).
- Resolution adapts (`resScale`, the controller at `adaptResolution` in 02-render). Under the ink during loading, `tune()`
  (60-flow) draws real frames from the opening view and `CALIBRATION_VIEWS` more spread over the floor (`calibrationViews`): `settle` until
  their times stop changing, then `calibrate` (GPU-timed: from the screen's full ratio, when the second-slowest view is over
  `CAL_MS` it switches to `lite`, single ink lines, then lowers the ratio), then `climb` (`tryRung`: frames at better
  settings, judged by the controller's own late-frame rule, halving the rungs of `resLadder` each try), so play starts at
  the best setting the machine holds. Heavy moments (thick smoke, the fog wall) are left to the controller: each second of play it
  counts late frames (over `LATE_AT` frames of a 60 Hz screen); over `LATE_DROP` it steps down (thinner smoke `RES.thin` →
  `PUFF_LOW`, only while there is that much smoke; then `lite`; then the ratio, to `RES_MIN`, then `RES_LOW`), and after three
  near-perfect seconds it steps back up in reverse order. A stray hitch moves nothing; a failed step up is undone and held back
  (`RES_WAIT`, doubling). Below `RES_MIN` the smoke is thin too and the fog wall's floor bank is one sheet (`fogWall`, ~7 % of a
  frame when facing it). Pixels per frame on floor three: ~1.3 screens of solid things, ~0.5 of see-through ones, up to ~9 in
  a full smoke cloud, then the ink pass (~10 texture reads a pixel). Game logic costs ~0.3 ms a frame:
  a slow machine is held back by drawing (pixels, the ink pass, overlapping smoke), so that is where speed is won.

## See-through (56-see-through: its header comment has the full rules)
- Anything that can stand between the camera and the fight is registered while the floor is built: `seeThru(o, dyn, how)`.
  `'hard'` (onlookers, floor one's easels) only keeps the camera off, never fades; `'plain'` fades evenly without a contour;
  the default fades with a contour. A new big prop or floater must be registered, or the camera can sit inside it (except on
  a floor with `camThruFloaters`: `camReach` passes `seeInside` its `skipDyn`, so moving things only fade).
  Serj's decision: onlookers and easels stay out of any further see-through tweaks.
- `seePrep` gives each a shape (column, spheres per part, box); a group can give its own spheres in `userData.seeSph`.
  `bakeStatics` bakes each see-through thing on its own so it can fade alone. `seeWarm` builds the faded shaders at load.
- Pillars and pyramids are decided by `seeSolid` (`SOLID[kind]`: `.line`, `.lens`, `.slow`); faded = material clones with no
  depth write, alphaTest fixed so no new shader mid-play. Removing one mid-floor: `seeOn(c, false)`, `c.off`, hide `c.meshes`.
- The contour is a half-size mask (`seeMask`) read by the ink pass, only inside the faded things' projected boxes
  (`seeBounds`): a new kind of thing drawn into the mask must be covered there too, or its contour is cut. Never give a
  see-through part a global `renderOrder > 0`.

## Pyramids (44-pyramids, 48-bombs)
- Floor two's `T` cells. Destructible (`hitPyr`, `pyrShatter`); collision by square foot (`pyrPush`); glow, halo and floor pool
  share materials (one update a frame); own ink rim (`pyrRim`, drawn in `onAfterRender`; a mesh drawn with
  `renderBufferDirect` needs a stand-in in the scene so its shape is uploaded). The slingshot (not the yo-yo) can lock onto one.

## Talkers (20-talkers, 22–31)
- Registry `TALKERS[letter]`: `make`, `update`, optional `dying`, `dazed`, `bar`, `warn`, the hit and kill hooks (`shielded`,
  `struck`, `hurt`, `escape`, `torn`, `drops`, `gone`, `trapped`, `bounce`, `hushed`, `aimParts`, `holo`) and traits
  (`stagger`, `knock`, `pops`, `tornWord`, `rim`, `harmless`, `loud`, `noCover`, `totemProof`, `totemDaze`), all listed at the
  top of 20-talkers.js; shared code never asks `e.type`; shared `damage`, `kill` call them in a fixed order
  (keep it: the dice rolls must stay in the same order). Long fights run one step per state (`JESTER_STATES[e.st]` …).
  Each talker's file holds its build, fight and helpers, tuning at the top. Attack warnings: a talker's `warn(e)` (07-hud
  `warnOf`, `updateWarn`).
- `e.mats` are brought back to no tint (or the hit flash's red) every frame, written only where the colour differs
  (`HIT_RED`, `NO_TINT`): another writer's colour (the Jester's blink) is undone the next frame, so coloured parts use
  textures or vertex colours. A caged talker's cage is `e.cage`.
- Other state machines follow the same table form, one step per state, returning true when a thing is done:
  `MINE_STATES` (bear traps), `GRUMP_STATES`, `SLAB_STATES` (the Jester's falling masks), `JAW_STATES` and `HAIR_STATES`
  (the hidden boss). Red Cap's yo-yo chain: `yoyoChained()` (the next throw within `YOYO_CHAIN`, press to press).
- Reeling (`leaveReeling`, `REEL`, `reelLeft` in 20-talkers): down to a sliver and dazed, for Red Cap to finish; a trap does it
  to a boss, a stray shot to anyone. Stray shots (21-shots `shotHitsTalker`, floors with `strayShots`): fire and blood that hit
  a small talker do `STRAY_DMG`, never to the thrower (`shot.by`), a boss or the caged, never the last blow; insults fly past.
  `touchesTalker(e, p, pad)` is the shared hit shape (pebbles too).
- A talker's height: `e.pos.y` / `e.gy` is its ground (raised floor included, unknown until its first move: use `e.gy || 0`),
  `e.fly` how high a flier is drawn above it; shots, words and strands it gives off start at `(e.gy || 0) + e.fly`.
- Big call-outs (`bigWord(text, colour, size, under, underColor)`, 07-hud): a boss's `bar` hook may name a word that flashes
  with Attack him! as a state begins (the Priest's EXPOSED; the Jester's UNMASKED only when `e.callOut`, latched as the mask
  lifts: first time, then after `JESTER_REMIND` s without a blow that hurts). The Geezer calls GAZING / Take cover! himself
  (`geezerWarn`: first stare, then after `GEEZER_WARN_AGAIN` stares in a row that caught Red Cap).
- The boss bar (`bossInFight` in 64-loop, `bossBar` in 07-hud): the nearest boss met, within 26 m and with no wall between
  (`clearOfWalls`); out of sight it fades out after 0.3 s (`#boss.on` in style.css), back in at once.
- The crosshair's lock: yellow, red when the yo-yo reaches (`reach`), white on a pyramid (`pyr`) or on a talker pebbles bounce
  off (`proof`, from its `bounce` hook: the Grump).
- Shout rings (the Grump's `emitWave`, the totems' `totemRingMat`) are open cylinders wrapped in `waveTex`; their back
  faces are drawn plain yellow (`RING_INSIDE_GLSL`) so the words never read mirrored. The Grump's adds the tear where blocks
  and walls stand (`waveCompile`: `waveWallGLSL`, `waveBlocksGLSL`); both have `warmSet` stand-ins.

## Sound (01-audio)
- Synth: `playTone`, `playNoise`, `SFX.*`. Recorded clips: `playClip(name)` → `{ s, g }` (null before decoding; `AUDIO.buf` is filled
  by `initAudio` on the first click). Clips live in `game/assets/sfx/`.
- Loudness: `VOL[name]` (an `SFX` entry's name or a clip's file name; left out = 1) is the one place to turn a sound up or
  down. Each `SFX` entry runs with `AUDIO.vol` set to its share (nested entries multiply), `playTone`/`playNoise` scale by it, and
  `playClip` starts a clip at its share.
- Where a sound comes from: `AUDIO.at`; the loop sets it to each talker's position around its update, and sounds scale by
  `distanceGain(AUDIO.at)`. `hurtHero` clears it, so Red Cap's own sounds never fade. A long clip that follows its source keeps `.at`
  (`sprayFollow`). The Jester's laugh and the Grump are never distance-faded.

## Loading and flow (60-flow, 61-menus, 64-loop)
- Menu focus: arrows / Tab / WASD move it, Enter / Space press the focused button; it follows the mouse only onto another
  button (`hoverBtn`). One red at a time: the focused button; the music button is also red while hovered, unless another button has the focus.
- Phones (`touchUI`, pointer coarse) play on their side: upright, `#turn` covers everything and play pauses. Short windows
  (under 520 px tall) get compact paged sheets (catalogue, win); `catLayout` fits whole rows of cards per page.
- Menu buttons and the exit door enter a floor in steps: `state` `'leave'` (the ink veil, 0.36 s) → `'build'` (the paper scrap
  while the floor is built: planned 1.4 s for floor one, 0.7 s for two, 3 s for three) → `'intro'`. Plain `startGame()` /
  `enterFloor(i)` still build at once.
- Floating words live in `wordScene` (02-render), drawn after the ink pass straight onto the page: never put a word sprite
  in `scene` (the pass would cut it with edge lines, darken it, and the see-through mask would catch its quad).
- Red Cap's first words on a new game: `OPENING` (60-flow), in marker font (`HERO_WORDS`), rising slowly (`floatWord`'s
  `rise`).
- Loading does real work: `warmUp` pre-draws `WORDS_SEED` + `WORDS_FLOOR[floor]` + words used this session and every `TEX`
  (a word with `\n` breaks there; `spacedWord` puts thin spaces between letters: the Jester's NOT FUNNY);
  `warmSet` compiles every material/shader variant from stand-ins; then `calibrate()`.
- The death screen stops drawing the world (`deadStill`). HUD elements are cached in `HUD`; write to the DOM only on change.
  Big centred words: `bigWord(text, color, size, under)` (`under`: a smaller red pulsing line); hints: `toast(msg, ms)`.
  The hint is a yellow caption box sliding in from the left (`.on`) and off to the right (`toastOff()`, `.out`): clear it
  only with `toastOff`. It moves by CSS transitions, not keyframes: test pictures jump transitions to their end but hold
  keyframe animations at their start, where the box is off-screen.
  The boss bar (`bossBar`) shows a talker's `bar(e)`: `[text, lit, word]`, where `word` (EXPOSED, UNMASKED, WINDED) flashes
  as a big word with "Attack him!" once as the opening begins, and the small line under the name stays empty meanwhile.
- Talkers left: `updateLeft` (on each talker gone) calls 1 TALKER LEFT (`lastCall`) when the count drops to one. A Smoker
  away in his smoke still counts (unseen); a hidden boss counts only once woken. From the Jester's final blow (`G.finalFx`)
  there is no call, and taking his mask clears the screen's words (`quietScreen`): the ending plays on a clean picture.

## Testing (tests/)
- Playwright + swiftshader (`tests/browser.js`), viewport 880×500. First render of new shaders is slow (tens of seconds).
- `tests/harness.js`: frozen clock, seeded dice (fixed from the page's first line, so start-up drawing such as the smoke
  texture repeats; three.js ids on their own dice), sound off, a scripted player; used by the replay and picture tests that
  prove a change alters nothing. The scenarios and pictures are listed in `tests/jobs.js`; `tools/same.sh` runs them all
  (`tests/same.js`: `JOBS` pages at a time, default 3; the floors touched since `main` first, by `FLOOR_FILES`; the run kept in
  `out/same` with the build's fingerprint, which `new` turns into the baselines). By hand: `tests/replay.js build outDir [name…]`
  + `tests/replay-cmp.js dirA dirB`, `tests/pics.js build dir` + `tests/pics-cmp.py dirA dirB [diffDir] [name]` (diffDir gets
  side-by-side + difference images). The harness enters floor one without its loading cut or shader warm-up (each run
  rebuilds its own floor) and fixes the drawing quality (`RES_MIN`, single ink lines); opening a page is most of a job's
  time (~4 s), the frames are cheap (600 in under a second). Run with `NODE_PATH=$(npm root -g)`, one browser at a time. When
  a replay differs and the cause isn't obvious: `DEEP=1 node tests/replay.js build outDir name` for both builds, then
  `node tests/replay-deep.js dirA dirB` names the first dice roll (with its call stack) or field where they part.
- The replays never press the controller or touch: probe them with `tests/shot.js` (a fake `navigator.getGamepads`, then
  `pollPad(dt)`; `PointerEvent`s on `#stickZone` / `#lookZone`).
- CI's boot test can fail on an overloaded runner ("Install checking tools" taking ~10 min, a `.trim()` on `null` from
  three.js): re-run the failed job before suspecting the code.
- Picture or probe: `node tests/shot.js game/red-cap.html out/x.png "<js>" <floor 0-2> <waitMs>` (`<js>` is one expression:
  wrap statements in `(async () => { ... })()`; what it returns is printed as JSON). To pin the camera, wrap
  `renderer.render` and set the camera when `c===camera`.
- Menus against an older version (1.13 or later): `tools/build-at.sh N.NN`, then `node tests/menus.js out/red-cap-N.NN.html out/a &&
  node tests/menus.js game/red-cap.html out/b && python3 tests/pics-cmp.py out/a out/b`.
- Probe gotchas: headless game time runs 5–10× slow, and Red Cap is held at floor start, so move the thing to him instead.
  Clicking `#startBtn` enters a floor in steps: wait for `state === 'intro'`. A probe entering floors directly calls
  `slidesOn(false)` first, moves `hero.root` with `hero.pos` and turns `hero.parts.face` to `cam.yaw`. The test browser locks
  the mouse in play: test hover on the title screen. God mode: type G-O-D in play (fills ties and pebbles, next floor; wins on
  floor 3). CPU profiles are useless under swiftshader: count programs, uploads, draw calls (`renderer.info.autoReset=false`);
  a material's program: `renderer.properties.get(m).currentProgram`. Some floor-2 ground is raised: use `heightAt`.

## File map (game/src, joined in name order)
0x core (00 util, 01 audio, 02 render + ink pass, 03 textures, 04 floors, 05 world grid, 06 fx, 07 HUD); 10 Red Cap,
11 weapons; 20 shared talker code (`TALKERS[letter]`, hooks listed at its top), 21 shots, 22–31 one file per talker; 4x
floor features (40 pickups, 41 bystanders, 42 traps, 43 totems, 44 pyramids, 45 niches, 46 gates, 47 cages, 48 bombs, 49
floor-three secret); 5x building a floor (50 level, 51 props, 52 decor, 53 architecture, 54 dreamwork, 55 baking, 56
see-through); 6x flow and loading, menus, input, camera, loop, boot (`game/build.py` joins them, a line break after each).
Also `game/index.html` (build markers; the scissors'
strokes are typed out there), `style.css`, `assets/` (`img/*.webp` → ASSETS, `sfx/*.mp3` → SOUNDS, fonts, `shapes.json`),
`vendor/three-r128.min.js`.

## Not verified by playing
On a real GPU: the loading's chosen sharpness, the scissors' pace, low-end frame rate, floor three's busiest moments (smoke,
fog wall), the 1.38 camera speeds and the 1.40 wall wait (0.28 s). By ear: volumes (title music, pyramid scream, bomb blast), laughs, pops, the exhale. By
feel: the yo-yo's hit-stop in slow motion, the 0.85 s chain, see-through fades in motion, Grump ring cracks, hologram gaze
timing, Bruno's circle, talkers breaking pyramids, floor one's floaters passing through the camera, floor two's stray
shots (how often Grins reel), Spike's pebble odds, the boss bar's fade at wall corners. Touch on a real phone; controller on hardware.
