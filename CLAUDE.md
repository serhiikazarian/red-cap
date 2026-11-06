# Red Cap

Browser 3D comic-ink "paper" slasher from the author's paintings: three floors, three.js r128, one offline HTML (~6 MB).
Live: https://serhiikazarian.github.io/red-cap/ (Pages, from `main`). Version: `git log -1 --format=%s --grep='^[0-9]*\.[0-9][0-9]$'`.
Deeper rules, file map, tests, unverified-by-play list: `docs/ARCHITECTURE.md` (read only the section you need).

## Working with Serj
- Serj does not code: plain language, they/them. Report what changed, what was tested, what to check in play.
- Only what is asked. Ambiguous look, sound, play or workflow: one AskUserQuestion with options first.
- Before anything slow, one line on what runs and how long.
- Checks pass: say so, ask whether to ship. Never push `main` without their yes.
- Docs wait for the end of the chat; meanwhile only code, the `#version` label and a `## N.NN (date)` entry in
  `docs/HISTORY.md` (one bullet per change). At the end sync `CLAUDE.md` and `docs/ARCHITECTURE.md` once.

## Code
- `game/src/*.js` joined in name order into one script (`game/build.py`, one scope; top-level `const`/`let` must exist
  before use at load). 0x core, 1x Red Cap and weapons, 2x talkers (`TALKERS[letter]` in 20), 4x floor features, 5x
  building a floor, 6x flow, menus, input, camera, loop.
- Find with `rg -n "name" game/src` (always a path), read around the hit only; never a whole `game/src` file, assets,
  vendor, baselines or a built HTML. Targeted edits only.
- Change the file that owns the behaviour; tidy what you touch. Each file opens with its tuning numbers and rules. No
  function 68+ lines (`node tools/sizes.js`) except `floorState`. State machines: one step per state in a table
  (`*_STATES`). Helpers: `heroDist`, `ease`, `glowSprite`, `figureRig`, `cellMid`, `KEEP_INK`/`INK_HIDE`. Name numbers.

## Checks
- Every change: `tools/check.sh` → `OK` (~15 s). Play/looks unchanged: `tools/same.sh` → `SAME` (~80 s, replays with
  seeded dice + pictures). Meant to change: after Serj's yes, `tools/same.sh new`. Big change: `NODE_PATH=$(npm root -g)
  node tests/soak.js game/red-cap.html 8` → `errors []` (~8 min).
- Replays skip the loading screen and some moves: probe those (`tests/shot.js`, or force states and compare with
  `tools/build-at.sh N.NN`). The test browser is CPU-drawn: judge timing with a fake clock, never feel. One screenshot
  per visual change. Long runs in the background, never poll.

## Ship (after Serj's yes)
- Version + 0.01 unless named: `#version` in `game/index.html` and the HISTORY entry; `tools/same.sh new` if play/looks
  changed; `tools/ship.sh N.NN "<attribution lines>"` → `SHIPPED`. Never merge, squash or force-push by hand. Undo:
  `git revert`, ship anew.
- Try first: `tools/prerelease.sh N.NN "<attribution lines>"` → `PRERELEASED` (may repeat); Serj downloads from the CI
  run's Summary → Artifacts: give them the run link. Between versions: `tools/wip.sh "msg" "<attribution lines>"`.

## Rules that bite
- **Load rule:** anything new is prepared on the loading screen, never mid-game: a new material/shader variant gets a
  stand-in in `warmSet()` (same type, flags, `onBeforeCompile`), a texture goes in `warmUp()`'s `texs`, a floating word in
  `WORDS_FLOOR`. Verify `renderer.info.programs` unchanged after `beginFloor`.
- Refactors keep every random roll in order (seeded replays). Layout rng: `mulberry(seed)` per floor; per-start picks
  `Math.random`.
- No `//` mid-line before code (use `/* */`). GLSL: no names `flat`, `smooth`, `in`, `out`, `sample`; `smoothstep(a,b,x)`
  needs a < b.
- Player text: -ing as -in’ (not Sling/Ring/String). Censored: SH#T, F#CK.
- Baked still meshes (`bakeStatics`): anything that moves is not `still()`. See-through: `seeThru(o, dyn, how)`; no global
  `renderOrder > 0` on see-through parts.
- Talker materials (`e.mats`) reset every frame: colour with textures or vertex colours. A talker's specifics stay in its
  `TALKERS` entry, never `e.type === 'X'` in shared code.
- Colours `COL`/`HEX` (00-util), `var(--ink)` (css), loudness `VOL` (01-audio): never retype values.
- Delays in play: `later(sec, fn)`, not `setTimeout`. Rules run on `playT`; `performance.now()` only for wobble. Floor
  motion in `G.anim`. Every `G` field is declared in `floorState` (50-level).

## Game
Floors: 1 *The Usher's Corridor* (Ushers B, Shades q, Geezer Y); 2 *The Mouth* (Grins G, Priest R, Bruno Z caged,
pyramids: bombs, empties, hearts); 3 *Stop Talkin’ Sh#t* (Grump U, Smokers S/W, Jester M behind the fog gate, totems,
hidden boss L). Red Cap: 5 ties, yo-yo (heavy third only within `YOYO_CHAIN` 0.85 s), slingshot (7–10 pebbles), dodge.
Camera: `CAM_EASE`, `CAM_TURN`. `CELL` = 3 m. HISTORY: open only when asked why/when, or for a likely regression; search it.
