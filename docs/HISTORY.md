# Red Cap: change history

One entry per version, newest at the bottom: `## N.NN (date)`, short plain bullets, key names in backticks. Search it, don't
read it whole. Versions before 1.05 (the old numbering, up to 7.2) are not in the tree:
`git show $(git rev-list --max-parents=0 HEAD):HISTORY.md | rg -n "name"`. That old log runs v19 … v50, 8.0 … 14.6 (= 3.0), 3.1 … 4.7 (the rewrite,
renamed 6.0), 6.1 … 7.2; its own "v1.0" (= 10.3) and "v3.0" are unrelated to the current 1.xx numbers.

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

## 1.09 (3 Nov 2026), no change to the game
- Checked against Serj's 7.2 backup: the first commit, `game/data/`, the fonts and `game/vendor/` are byte-for-byte the same;
  every painting, shape, sound and floor field is used; the test baselines are new (not the old `v4.6` ones).
- Leftovers removed (set but never read): `hero.stunLight`, the Jester's `maskOff`, Livin' / Dyin''s `baseFly`, the onlookers'
  `r0`, the cages' `bars`, `G.webs`, `G.paintings` (and the unused fields of its placement list); two guards for paintings that
  always exist (`beard_painting`, `grin_fire`).
- Title label `v1.09`.

## 1.10 (3 Nov 2026), no change to the game
- Docs checked against 7.2's CONTEXT and HANDOFF and against the code: kept what is true, dropped notes from before the 4.7
  rewrite (the CSS grain), made the loading timings and the instanced pools precise.
- Recovered: Serj's decision that onlookers and easels stay out of see-through tweaks; why cornices are thick (thin railings
  flickered); what `game/data` holds and what a new painting needs; more "not verified by playing" items; the fog-wall option.
- This file's header explains the old numbering (its "v1.0" and "v3.0" are unrelated to 1.xx).
- `.ignore` keeps only what git saves but searches skip (the build and `out/` are already skipped through `.gitignore`).
- Title label `v1.10`.

## 1.11 (3 Nov 2026)
- Slow machines: the fog wall's floor bank at the Jester's gate is one sheet instead of two once quality is lowered
  (`fogWall`, `resScale` below `RES_MIN`; ~7 % of a frame when facing it). Normal machines unchanged.
- Removed `flatShading` from three Lambert materials (cornices, the DMT crown, pebble piles): r128's Lambert ignores it and
  warned about it; the look is unchanged.
- Title label `v1.11`.

## 1.12 (3 Nov 2026)
- Fewer hearts lying in the level: each one (a map `h` or a hidden one) is there by chance, fresh each time a floor starts
  (`placedHearts` in `FLOORS`: 0.7 on floors one and two, 0.9 on floor three; `heartPlaced`). Measured over 200 builds:
  floor one 2 → 1.33 on average, floor two 4 → 2.75, floor three 2 → 1.8. Same spots; the emergency hearts (`roomHeart`,
  `lowHeart`), talkers' drops and bosses' big hearts unchanged.
- Test baselines remade (the dice fall differently).
- Title label `v1.12`.

## 1.13 (3 Nov 2026), no change to the game
- The paintings, sounds and fonts are real files in `game/assets/` (`img/*.webp`, `sfx/*.mp3`, `fonts/*.woff2`, `fonts.css`;
  the outlines in `shapes.json`, one per line) instead of base64 text in `game/data/`. `game/build.py` packs them into the one
  offline file (`/*DATA …*/`, `/*SHAPES …*/` markers); the build is the same as 1.12's byte for byte, except that
  `beard_painting` now sits in `ASSETS` with the rest.
- Title label `v1.13`.

## 1.14 (3 Nov 2026), no change to the game
- At Serj's request, the history was rewritten once to drop the old `game/data/` (base64 text, ~3.6 MB) from every past
  commit; every commit now has a new id. Versions before 1.13 can no longer be built (`tools/build-at.sh` says so); a bundle
  of the history as it was is kept outside the repository. A second pass dropped the test files left from version 4.6
  (`pics-v4.6/`, `replay-v4.6*.json`, in the uploaded 7.2 folder) and 1.05's blank test pictures (copies of the same).
- The old 7.2 log is read with `git show $(git rev-list --max-parents=0 HEAD):HISTORY.md` (no fixed commit id).
- Title label `v1.14`.

## 1.15 (3 Nov 2026), no change to the game
- CI tags every version `vN.NN` and makes a GitHub release with that version's game file (`red-cap-vN.NN.html`, plays
  offline): new job `versions` in `.github/workflows/pages.yml`, after the deploy. Cloud sessions cannot push tags (the git
  proxy refuses), so GitHub does it. Versions before 1.13 get the tag only (they can no longer be built).
- `CLAUDE.md`: how tags and releases come about, and how to go back to an older version (`git checkout vN.NN -- game`).
  README and `docs/ARCHITECTURE.md`: older builds from 1.13 on.
- Title label `v1.15`.

## 1.16 (3 Nov 2026), no change to the game
- CI's `versions` job makes each version's tag through a GitHub release (`gh release create --target`): GitHub refused the
  tag pushed from CI on 1.05, the commit that brings in `.github/workflows/pages.yml`. Versions before 1.13 get a release
  without a game file (they can no longer be built).
- Title label `v1.16`.

## 1.17 (3 Nov 2026), no change to the game
- CI's `versions` job keeps going when GitHub refuses a version's release: CI's own token may only tag a commit whose
  workflow file matches `main`'s ("Resource not accessible by integration"), so each new version gets its tag and release
  as it is pushed, and older ones it cannot tag are left with a warning.
- Title label `v1.17`.

## 1.18 (3 Nov 2026), no change to the game
- CI's `versions` job releases only the version just pushed (tag `vN.NN`, its game file attached): 1.17 was the first.
  GitHub refuses CI's own token a tag on an older commit, so 1.05–1.16 have no tags (older builds: `tools/build-at.sh`,
  from 1.13 on). No more warnings or rebuilds of old versions in every run.
- Title label `v1.18`.

## 1.20 (3 Nov 2026)
- 1.19 skipped (Serj's choice of number).
- The resolution controller (`adaptResolution`) counts late frames each second instead of a running average: a stray
  hitch moves nothing, and it sharpens back after three good seconds (before, at 60 Hz a drop lasted the whole floor).
  Steps down: thinner smoke first (`RES.thin` → `PUFF_LOW`, only while there is that much smoke), then single ink lines,
  then the ratio; back up in reverse. A failed step up is undone and held back (`RES_WAIT`, doubling). `resCeil` is gone.
- Loading (`calibrate`) starts each floor at the screen's full ratio and times the opening view plus `CAL_VIEWS` views
  spread over the floor (`calViews`). Floor three no longer sizes itself for a full smoke cloud and the fog wall: it
  starts sharp and softens only while such moments last.
- Replays and pictures keep the controller off (`tests/harness.js`).
- Title label `v1.20`.

## 1.21 (3 Nov 2026)
- Floor one: each heart lying in the level is there by a 0.784 chance (`placedHearts`, was 0.7): 12 % more on average.
- Floor two opens turned right (`yaw` -2.85): the first Grin, close on Red Cap's left, no longer shows behind the card, even
  on a 21:9 screen.
- Floor two's slogan (`slogans()` in 50-level): on the Priest's wall 1.6 times smaller, its foot 0.5 m up and its top under
  the cornice; the copy in front of the door room on a soft dark backing. No wall word within 3.5 m of the Priest's slogan
  (`SLOGAN_AT`; the SCORCHED EARTH beside it is gone; the layout's dice are drawn as before).
- The Grump leaves a heart when beaten while Red Cap has 3 ties or fewer (`drops`, below `WELL.hp`).
- Quieter: the Shade's and the ghosts' pops at half volume; Red Cap's death exhale at 30 % (`DEATH_EXHALE`, was 60 %).
- Test baselines remade.
- Title label `v1.21`.

## 1.22 (3 Nov 2026), no change to the game
- Less garbage a frame (proved by `tools/same.sh`): the yo-yo's hand, tip, in-between tips and string middle are reused points
  (`yyHand`, `yyTip`, `yyStep`, `yyMid`; `yoyoTip` writes into one); talkers' sparks and smoke start from one reused point
  (`fxAt`, `FX_AT` in 06-fx); `avoidProps` adds each prop's push (`avoidOne`, `AVOID`) instead of building lists; the Grump's
  swell is a constant (`GRUMP_SWELL`).
- `tools/ship.sh N.NN` ships a version as one commit on top of `main` with exactly the current files (no merge, no force push),
  then links the work branch to it; `tools/wip.sh "message"` saves work to the work branch only. `CLAUDE.md` and `README.md`:
  both required, never merge, squash or force-push by hand; commands kept short (scripts that answer in one word).
- Title label `v1.22`.

## 1.23 (3 Nov 2026)
- Game rules run on a play clock (`playT`: stops while paused, slows with hit-stop and the finale) instead of the wall clock:
  the yo-yo combo and shot-chain windows, the big Usher's spam count, where Shades, Grins, Smokers and the hidden boss hover
  (their hit heights), the Priest's ghosts' circling, the Jester's weave, and the fog gate sinking (now in `G.anim`: it
  holds while paused and goes with the floor). Pausing no longer drops a combo; floaters freeze in hit-stop. Cosmetic wobble
  keeps the wall clock.
- One volume table, `VOL` (01-audio): each `SFX` entry and recorded clip plays at its share (pops 0.5, Red Cap's death
  exhale 0.3, the Priest's spray 0.6), the same loudness as 1.21–1.22.
- Shared code no longer asks a talker's type: new `TALKERS` hooks and traits `bounce` (the Grump and pebbles), `hushed` and
  `totemDaze` (Smokers and totems), `totemProof` (Jester, Grump), `aimParts` (the Priest's ghosts), `holo` (a Grin's
  hologram); `tuneUshers` moved to 22-usher.
- The floor's state `G` declares its fields in `newFloor`; the `G.x || []` guards are gone (`pyr`, `props`: null on floors
  without them).
- Test baselines remade. Title label `v1.23`.

## 1.24 (3 Nov 2026)
- Floor two: besides the 1 or 2 bomb pyramids, 1 or 2 others (two: `PYR_EMPTY_TWO`, 30%) are empty: no tie seen inside, no
  heart when they shatter (`hideBombs`, 48-bombs).
- Floor two: talkers' shots (a Grin's fireball, Bruno's insults and embers, the Priest's blood spray) strike a pyramid like
  Red Cap's blows, three to shatter it; one spray is one blow to each pyramid it reaches (`volley`), and the Priest's rain
  strikes each pyramid inside his circle once as it lands (`RAIN_R`).
- Floor three's loading: before `calibrate`, `settle` draws every timed view once an animation frame until two rounds agree
  (`SETTLE_ROUNDS`, `SETTLE_TOL`, `SETTLE_MAX`), so the GPU's leftover build work no longer sets the floor's ratio too low and
  it opens sharp instead of climbing during the first seconds.
- Test baselines remade. Title label `v1.24`.

## 1.25 (3 Nov 2026)
- Every floor's loading finds its drawing settings from real frames before play (`tune`, 60-flow): `settle` (now on every
  floor) until frame times stop changing, `calibrate` for a first pick, then `climb`: frames played at the better settings
  (`resLadder`) are judged by the controller's own late-frame rule (`tryRung`), and the best that passes is kept. A floor no
  longer starts blurry and sharpens a few seconds into play on a machine that holds the sharper setting.
- Checks: `tools/same.sh` runs every full replay and picture three at a time, the touched floors first, with a progress
  line a job (~75 s, was ~3 min with short replays); the harness enters floor one without its loading cut and shader
  warm-up. Replay baselines are one file per scenario, one sample a line (`tests/baseline/replay/`); `tools/same.sh new`
  takes the last check's run of the same build and writes only what changed. `tools/check.sh` boots alongside lint.
- Title label `v1.25`.

## 1.26 (3 Nov 2026)
- Loading scissors cross their line at one even speed and the floor shows as they arrive (`snipRun`, 60-flow); the run is
  timed by how long that floor took to load in this browser (`redcap.load.v1`, guess `LOAD_GUESS` the first time); a load
  that runs long slows them in even steps (`SNIP_SLOW_AT`, `SNIP_SLOW`) instead of stalling them at the end.
- `CLAUDE.md` condensed; docs are now synced once, at the end of a chat.
- Title label `v1.26`.

## 1.27 (3 Nov 2026)
- Loading no longer restarts or sticks: the scissors slow down only to `SNIP_RATE_MIN` and keep their place on a speed change
  (the browser's own rate change lost it after a long slow stretch); arrival is checked on a timer, not an animation promise;
  `enterFloor` ignores a second start while a floor is on its way in.
- `tune` draws one frame each animation frame (the one-shot `calibrate` is gone), tries the best setting first, ends on
  `TUNE_MAX` or a fault; remembered load times are averaged and capped (`LOAD_MAX`).
- The scissors cut the line open behind them (`.snip::before`).
- Floor one is built and warmed on the title (`titleWarm`), so its first loading screen is shorter; `LOAD_GUESS` lowered.
- The title's music button turns red under the controller's selection.
- Title label `v1.27`.

## 1.28 (3 Nov 2026)
- Shorter first loading screen: load times start afresh (`redcap.load.v2`: 1.26's could hold a stuck load), a faster load
  is taken at once and a slower one averaged in, `SNIP_MARGIN` 1.1, `LOAD_MAX` 10 s, `SETTLE_MIN` 12 frames.
- Title label `v1.28`.

## 1.29 (3 Nov 2026)
- Shorter loading screens: the sharpness search ends within `TUNE_MAX` 3 s (the controller goes on from there), settling
  within `SETTLE_MAX` 60 frames; the scissors' run is never planned past `LOAD_MAX` 5 s; `LOAD_GUESS` 2 s for floors one and two.
- Title label `v1.29`.

## 1.30 (3 Nov 2026)
- Floor three: the Grump's rings end, torn, at the first wall (or the closed fog gate) in each direction, as the rules already
  had it (`waveWalls`: the distance in `WAVE_WALL_N` directions, measured once at build, read by the rings' shader as `uWall`).
- `G.texs`: textures a floor makes that no mesh holds yet; `warmUp` uploads them.
- Title label `v1.30`.

## 1.31 (4 Nov 2026)
- Floor three: a ring meeting a wall tears as at a sound block (cracks ahead, a burning rim, shards, then a jagged fade);
  the wall distances are averaged over neighbouring directions (`WAVE_WALL_SOFT`), so the edge no longer follows the grid.
- Title label `v1.31`.

## 1.32 (4 Nov 2026)
- Resuming from the pause menu with Esc or a controller no longer leaves the cursor showing for the rest of the run: a
  refused mouse capture is asked again on the next key or click in play (the sticky `dragLook` is gone).
- Title label `v1.32`.

## 1.33 (4 Nov 2026)
- The first loading screen no longer freezes before the scissors show: the world isn't drawn while the ink covers the
  title (`worldOn`), so floor one's first, heaviest frame is drawn once, under the scissors (about 1.5 s sooner overall in
  the test browser).
- Scissors: `tune()` tells how long it expects still to take (`tuneLeft`), and they steer towards the pace that ends just
  then, each change eased over `SNIP_EASE`; the stepped halvings near the end (`SNIP_SLOW`) are gone, and slowing near the
  end is kept only for when no estimate is left.
- Title label `v1.33`.

## 1.34 (4 Nov 2026)
- Scissors no longer jump back to the start: a run that ended while the page was held up (a heavy frame) is left at its end
  until the floor is ready, as a speed change on an ended animation started it over; speed changes go through
  `updatePlaybackRate`, which keeps the place they are drawn at (setting the time again pulled them back while the page was
  busy).
- Title label `v1.34`.

## 1.35 (6 Nov 2026)
- The yo-yo's hit-stop counts down in unslowed time: inside slow motion (a bomb, the Jester stunned or torn) it lasted five
  times too long. The Jester replay's baseline is remade for it.
- The real-time screen flashes and hints (`setTimeout`) carry a note on why they don't use `later()`: it stops on death and
  doesn't run on the title.
- The six longest functions split into named steps, no change in play or looks: `updEnemy` (`updCaged`, `updDazed`,
  `keepClear`), `updCamera` (`camPivotAt`, `pushOffWall` for both wall pushes, `camReach`, `camEase`, `heroFade`,
  `updReticle`), `pyramid` (`pyrBuild`, `pyrShape`, `pyrInkRim`, `pyrCut`), `dreamBlocks` (`paperBirds`, `blockCritters`,
  `pastelMotes`), `ldHair` (`ldHairSway`, `ldHairPick`, `ldHairLash`, `ldHairSnare`), `decorNarcissism` (`narcPortraits`,
  `narcMirrors`, `narcNewsprint`, `narcGlasses`, `narcPages`).
- The other 24 functions of 68 lines or more split the same way, no change in play or looks: `addWebs` (`cornerWebs`,
  `faceWebs`, `stripWebs`, `webMesh`), `webTex` (`webCorner`, `webStrip`), `buildCells` (`buildCell`, `wallMaterials`,
  `blockWall`, `tallWall`, `standing`), `dreamMouth` (one step per decoration), `clutter` (one builder per kind), `guidePath`
  (`guideLamp`), `updWarn` (`warnMarkers`, `warnPlace`, `warnGlow`), `fogWall` (`fogMat`, `fogPuffs`, `fogTick`),
  `updPaperTrail` (`trailStart`, `trailGeo`, `trailLay`), `seePrep` (`seePyrShape`, `seeColumn`, `seeSpheres`), `seeTick`
  (`seeFocus`, `seeWant`, `seeLine`, `seeApply`), `touchControls`, `pollPad` (`padPlay`, `padMenu`), `ambience`, `updGrin`,
  `grinBall`, `pyrScream` (`screamBus`, `screamVoices`), `buildPyramid`, `buildProp`, `buildHero` (`heroFigure`,
  `buildYoyo`), `updBruno`, `buildCages` (`brunoStake`, `ironCage`), `addPaintings`, `enterFloor` (`floorSupplies`,
  `floorCut`). The unread cobweb counter `G.strips` is gone. Nothing in `game/src` is 68 lines or longer now.
- `cellMid(i)` (05-world, next to `cellOf`): the middle of a cell in metres, in place of `i * CELL + CELL / 2` and
  `(i + 0.5) * CELL` written out 71 times (the same numbers for whole cells); `blockWall` and `tallWall` work it out themselves from the cell.
- Every field of `G` is declared in `newFloor` now (33 were first set elsewhere: `G.doorT`, `G.npcHearts`, the hints, the
  final blow's, the secret's, …), starting as they behaved unset; the `|| 0`, `?? 6` and `|| 1` fallbacks are gone.
- `updEnemy`: a caged talker reaches its cage directly (`e.cage`, set by `buildCages`) instead of searching `G.cages` every
  frame; the stances that keep their own sway are one set made once (`OWN_SWAY`), not a list built per talker per frame.
  The hit-flash colour is still checked every frame (the Jester's blink relies on it being undone), but each material is
  written only when its colour is not already the one wanted (`HIT_RED`, `NO_TINT`).
- The floating-word lists (`WORDS_FLOOR`, 03-textures) name core colours (`${HEX.paper}` …) instead of typing them out
  (69 places); the lists come out the same, character for character.
- CI: pushes to `prerelease` build and check the game and keep it as a download on the run's page (30 days); only `main`
  publishes, tags and releases (a manual run on another branch could publish before).
- Tried on the `prerelease` branch first, then shipped to `main`. On `prerelease` four times: the second 1.35 added the 24
  splits, the third `cellMid` and the two `G` fields, the fourth the rest of `G`, the cage link, the review's fixes and the
  word lists' colours; the hit-flash check came with the ship.
- Title label `v1.35`.

## 1.36 (6 Nov 2026)
- Phones: no more lines sliding across floors and walls. The ink pass now reads depth at high precision (many phone GPUs
  rounded it into steps that the outlines drew as lines).
- Jester: no more RETURN TO SENDER word when a fallen face is knocked back at him.
- The "Esc pauses · M mutes" hint is gone from the bottom of the screen; the weapon labels keep their place.

## 1.37 (6 Nov 2026), no change to the game
- Work left on two older branches, brought in: `tools/prerelease.sh` (a version to try on the `prerelease` branch in one
  step, `PRERELEASED N.NN`) and the 1.35 sync of `CLAUDE.md` and `docs/ARCHITECTURE.md`; from 1.23, `tools/script.py`
  reads and writes with pathlib, and the long comment lines of `ship.sh` and `wip.sh` are wrapped (its ~5 min notes for
  `same.sh` were out of date and stay out).
- Docs: the ink pass's highp depth sampler (1.36), force-pushing `prerelease` allowed in the settings (only that branch).
- Every branch brought up to date with `main`.
- Title label `v1.37`.

## 1.38 (6 Nov 2026)
- Shout rings (the Grump's and the totems'): their inside (seen from within, or the far half through the near one) is the
  band in plain yellow, so the words never read mirrored (`RING_INSIDE_GLSL`, `ringInsideCompile`, `totemRingMat`; the
  totem ring's shader has its stand-in in `warmSet`).
- A snappier camera (`CAM_EASE`, `CAM_TURN`, `CAM_TILT` in 63-camera): turning with the keys, a stick or the screen's edge
  3.2 rad/s (was 2.4–2.6), a stick's tilt 2.0 (1.6); it keeps up with his height (ease 20, was 12) and the shoulder offset
  (18, was 12), and after a wall pulls back out sooner (0.2 s, was 0.35) and faster (10, was 6).
- The yo-yo's chain goes on only at a fast pace: the next throw within `YOYO_CHAIN` (0.85 s, press to press; was 1.1 s),
  else it starts over with a light first throw, so the slow heavy third comes only from three quick throws
  (`yoyoChained`; a throw at play time 0 no longer counts as never thrown).
- The rest of this version is a code clean-up, play unchanged:
- Plain names: 124 cryptic top-level names spelled out across the code and tests (`upd*` → `update*`, `sTone`/`sNoise` →
  `playTone`/`playNoise`, `ch` → `cellAt`, `los` → `lineOfSight`, `post` → `inkPass`, `AU` → `AUDIO`, `EL` → `HUD`, `tmus*` →
  `titleMusic*`, `ld*` → `livingDying*`, `*_ST` → `*_STATES`, …), renamed by scope (locals and fields untouched).
- Long functions split into named steps: shots (`flyShot`, `shotHitsScenery`, `shotLands`, `shotHitsHero`, `endShot`),
  `collide`, the frame loop (`slowedDt`, `edgeTurn`), pebbles, aiming (one `offer` for talkers, parts and pyramids), the yo-yo
  throw, bystanders, totems, Bruno's fire and model, `clearLevel`, raised ground, baking, the title music, smoke draws.
- State machines as tables, one step per state, like the talkers': bear traps (`MINE_STATES`), the Grump (`GRUMP_STATES`), the
  Jester's slabs (`SLAB_STATES`), the hidden boss's jaw and hair (`JAW_STATES`, `HAIR_STATES`).
- Bare numbers named where they were touched (`SHOT_REACH`, `STEP_MAX`, `RING`, `AIM`, `SLOW_MO`, `HIT_STOP`, `GRUMP_*`, …);
  the Grump ring's shader in three named GLSL pieces (its text byte-identical).
- Also split: `newFloor` (`floorState`, `floorLight`, `floorGround`), the loading's per-frame verdict (`judge` in `tune`),
  block critters, the hair model, the hidden boss's pieces (one `LIVING_DYING_PIECES` table, names included).
- Repeated code folded into shared helpers: `heroDist` (27 places), `ease` (21), `glowSprite` (12), `figureRig` (Red Cap,
  talkers, onlookers), `KEEP_INK` (the blending that leaves the picture's alpha alone).
- Title label `v1.38`.

## 1.39 (6 Nov 2026)
- The ending plays on a clean screen: from the Jester's final blow there is no 1 TALKER LEFT call, whoever is still
  counted (most often Brainless the Second away in his smoke, unseen but counted; or the hidden boss, if woken):
  `updateLeft` checks `G.finalFx`. Taking his mask clears whatever words and hint are showing (`quietScreen`, 07-hud).
- Tidy: the hair's lash state points straight at `livingDyingHairLash` (it only passed the call on).
- Docs synced to this build: `CLAUDE.md` condensed (half the size; the file map and the not-verified list moved to
  `docs/ARCHITECTURE.md`), which now also covers the state tables, the shout rings' inside and the ending's clean screen.
- Title label `v1.39`.

## 1.40 (6 Nov 2026)
- After a wall the camera waits 0.28 s of clear way before pulling back out (`CAM_EASE.hold`, was 0.2).
- Floor one: the drifting faces, glasses and boxes no longer push the camera in and out as they float across its arm; they
  only fade (`camThruFloaters` in 04-floors, `seeInside`'s `skipDyn`).
- The Geezer's stare goes past the easels (too small to hide behind): only walls and pillars hide Red Cap from it
  (`geezerSees`, `losCover`'s `props`). Behind an easel he still blinks round it now and then, just to spook.
- The crosshair locked on the Grump is white, not yellow (pebbles bounce off him); still red when the yo-yo reaches him
  (`proof` class on the reticle, from his `bounce` hook).
- Floor two: the talkers' shots (a Grin's fireball, the Priest's blood; not Bruno's insults) hurt a small talker they hit by
  accident, a pebble's blow (0.75); never the one who threw it, never a boss or the caged, and never the last blow: one
  that would tear it leaves it REELIN’ for Red Cap to finish (`strayShots` in 04-floors, `shotHitsTalker`, `STRAY_DMG`).
  Reeling shared with the traps (`leaveReeling`, `REEL` in 20-talkers); the pebble's hit test shared (`touchesTalker`).
- Spike, hit, shakes out 2 pebbles 20% of the time, 1 70%, none 10% (was always 2; the Hat and Long Hair still give 2):
  `HIT_PEBBLES`, `hitPebbles` in 41-bystanders.
- Hints rewritten by Serj: the Jester's "Immune when masked. Ring a totem.", the hidden boss's jaw "The jaw starts hoppin’.",
  the Geezer's "Avoid Geezer’s gaze."
- "The Grump" is now just "Grump": his health bar, the gallery card and the end screen's list.
- The Jester: no BACK ON when his mask goes back on; his second half starts with NOT / FUNNY (on two lines, letters spaced
  out: `spacedWord`; was ENOUGH). A floating word may set its own line break with `\n` (`wordTex`).
- Replays and pictures remade (the camera's wall wait changed floor three's, the stray shots the Priest fight's).
- Docs synced: `CLAUDE.md` (floor two's stray shots), `docs/ARCHITECTURE.md` (floor fields `camThruFloaters` and `strayShots`,
  `losCover`'s `props`, reeling and stray shots, the crosshair's colours, `\n` in a word, the not-verified list).
- Title label `v1.40`.

## 1.41 (6 Nov 2026)
- Red Cap's first words on a new game (not on a restarted floor), in marker font over his head, drifting up slowly: "How did
  I get here?" (`OPENING` in 60-flow; `floatWord`'s new `rise`).
- Title text: "A paper slasher in three floors. Silence the voices." (was "…, then awake.").
- Health bars: the Geezer's stare warning line is gone (WINDED stays), Bruno's reads "Flarin’" (was "Flarin’ — back
  off"), the Smoker's has no line (was "Hidin’ in his smoke" / "Every hit shakes out pebbles").
- Tidy, no change to play (replays SAME): floors say what they have instead of shared code asking which floor it is
  (`plainFloaters`, `pyramids`, `flatProps`, `embers` in 04-floors; `BUMP_R` in 05-world); the two sight checks say which
  they are: `clearOfWalls` (was `lineOfSight`), `clearOfCover` (was `losCover`).
- A Grin on raised ground spits its fireball from where it is drawn (was from 1.5 m lower, as if on the floor below):
  `grinSpit`.
- On raised ground, these come from where the talker is drawn too (were 1.5 m low): a Grin's HAAA, a Shade's BOO!, a
  Smoker's PSST and *COUGH*, the hidden boss's red orbs, laughs, NOT YET and its snaring strand (floor three is flat: no
  change there today).
- A boss's health bar shows only while no wall stands between him and Red Cap: it fades out behind one (after 0.3 s, so a
  corner can't make it blink) and fades back in when he is in sight (`bossInFight`, `#boss.on` in style.css). Seen with
  the Priest and Bruno.
- Build: a code file without a last line break gets one before the next file is joined on, so it can never run into it
  (`include` in game/build.py; every file has one today, so the built game is the same).
- Phone layout: the title row's repeated column rule removed (style.css; no change on screen).
- Priest replay remade (Grins on raised ground now fire from their real height).
- Docs synced: `CLAUDE.md` (sight helpers; floors say what they have), `docs/ARCHITECTURE.md` (the floor fields, the two
  sight checks, a talker's height, the boss bar behind walls, the opening line, the build's line breaks, not-verified list).
- Title label `v1.41`.

## 1.42 (6 Nov 2026)
- `CLAUDE.md`: Serj's own edit restored (he/him; "Be interactive and report your progress."), which shipping 1.41 had
  overwritten with the work branch's older copy.
- Phones play on their side only: held upright, a sheet covers the screen and asks to turn it ("Turn your phone sideways",
  `#turn` in style.css and index.html), and play pauses if turned upright mid-fight (62-input). No such rule was found in
  the history since the clean base, so this is new rather than repaired.
- Short windows (a phone on its side, a low desktop window: under 520 px tall): the catalogue and win sheets go compact
  (smaller heading, cards and padding) so whole rows fit; they used to run cards over the footer and arrows (3 cut off at
  740 x 360). Heights use `dvh` (the browser's bars left out); the card grid scrolls only if a row still cannot fit.
- Title label `v1.42`.

## 1.43 (6 Nov 2026)
- The Geezer: no WINDED / Attack him! call-out (the small WINDED over his head stays). As his first stare begins, GAZING /
  Take cover! in the same big lettering, colours swapped (GAZING red, Take cover! yellow: `bigWord`'s `underColor`); again only after two stares in a row have caught Red Cap (`geezerWarn`,
  `GEEZER_WARN_AGAIN`).
- The Jester: UNMASKED / Attack him! the first time his mask lifts, then again only if Red Cap has gone more than 35 s without
  a blow that hurts him (`JESTER_REMIND`; hitting the mask does not count).
- Bruno's insults: a short rough bark as he spits each volley (`SFX.bark`).
- Title label `v1.43`.

## 1.44 (6 Nov 2026)
- The keyboard "stopped working" on the title after the music was switched on: the music button kept the focus, so Enter
  and Space only toggled the music again. A click or tap on it now hands the focus back to Start (moved to it with the arrow
  keys, Enter still toggles it). Behind it a second fault: the focus that follows the mouse took the button back when its
  icon swapped under the pointer; it now moves only when the mouse reaches another button (`hoverBtn`, 61-menus).
- Title label `v1.44`.

## 1.45 (6 Nov 2026)
- The title's music button stays red while the mouse is on it (after a click the focus goes to Start, which took its red
  away): `#musicBtn:hover` in style.css, on screens with a mouse only.
- Title label `v1.45`.

## 1.46 (6 Nov 2026)
- Title focus, one red at a time: a click on the music button keeps the focus there (no more hand-off to Start, which left
  two buttons red); from it the arrows, WASD and Tab go anywhere and Enter presses whatever is red. Its hover red stays, but
  gives way when the keyboard has taken the focus to another button (`:has(button:focus…)` in style.css).
- Title label `v1.46`.

## 1.47 (6 Nov 2026)
- Floating words (Red Cap's opening line, HMMPH, BOO!, RING ME, NOT FUNNY…) are drawn over the finished page, after the ink
  pass (`wordScene` in 02-render): the pass no longer draws its edge lines across them (the holes in "How did I get here?"
  where a wall corner or a Shade lay behind), nor darkens them toward the screen's edges (the line greyed as it rose), and
  a nearly faded word no longer tints the page round it. Pictures remade (f1-fight, f2-fight, f3-fight, f3-start, jester).
- Title label `v1.47`.

## 1.48 (7 Nov 2026)
- The hints at the bottom (`toast`: "Dodge sideways.", "Avoid Geezer's gaze." ...) sit in a yellow comic caption box:
  black marker lettering, a thick ink border, a hard shadow, a slight tilt. Each new hint slides in from the left with a
  small overshoot and leaves off to the right (`toastOff` in 07-hud, used wherever the hint is cleared); the same hint
  again only stays longer. Plain fade under reduced motion. Done with CSS transitions, not keyframes: the test pictures
  jump transitions to their end, so the box shows settled there (picture remade: jester).
- Title label `v1.48`.
