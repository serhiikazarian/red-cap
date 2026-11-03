# Red Cap: how the code fits together

Read the section you need when a task touches it. File names are in `game/src/`. Why each rule exists: search `docs/HISTORY.md`.

## Geometry, memory, baking (03-textures, 54-bake, 50-level)
- `paper(name, h, depth, lit, once)`: a painted cut-out from `SHAPES`. `once` for a one-off size (e.g. onlookers' random heights),
  which must not go into the shared shape cache.
- `share()` marks geometry/materials that are never disposed. A shape made again and again mid-fight is made once and shared.
- Textures owned by one floor go in `OWN` (`own(t)`). `clearLevel` frees what is still in `G.group`; anything removed for good
  mid-floor goes through `discard(o)` (frees its geometry and `OWN` textures; materials are left to the garbage collector,
  because disposing the last material of a kind destroys its shader program).
- `still()` means "baked": `bakeStatics()` (end of `buildLevel`) merges every still, opaque mesh (and transparent ones whose
  material is marked `flat()`) into one mesh per material look. Never keep a reference to a still mesh to change it later.
- Helpers: `mergeGeos([[geo, M4(...)]])` (keeps uv + vertex colours), `M4(x,y,z,rx,ry,rz,sx,sy,sz)`.
- Pools: particles, blood, drips, pages, motes and birds are `InstancedMesh` pools (`instPool`, `PMESH`, `BLOOD`, 06-fx);
  floor-3 block props and box-shaped floaters are instanced by texture (`instanceProps`, `syncBoxes` after any change, 51-props).
- Smoke is batched (06-fx): `puffs` hold stand-ins; `puffSync()` (start of `render()`) fills `PUFF_MESHES` (≤ 8 instanced
  draws). Never add a Sprite per puff. `PUFF_MAX` 45.
- A stand-in mesh inside frozen `G.group` needs `matrixWorldNeedsUpdate = true` when moved.

## World and placement (05-world, 04-floors)
- Grid `CELL = 3` m; `solid()` ('#', and 'g' while `G.gateClosed`); raised floor `LIFT = 1.5` (things built inside a raised
  cell are lifted automatically: don't add height twice); `heightAt` for ground height.
- Random set dressing must pass `clearOf(x, z, r)`; story things claim ground with `keepOut(x, z, r)`; `storyGround()` lays
  down the map's story cells and talkers.
- Map legend and per-floor settings live in `FLOORS` (04-floors); the optional fields `start` and `pitch` set the opening view.

## Drawing and the ink pass (02-render, 03-textures)
- Red Cap's cards use `markInk` blending (clears render-target alpha) and `featherEdge`; the post pass skips ink near
  alpha-cleared pixels, and `inkCard` gives him his own smooth outline. Grain and vignette live in the post shader.
- Soft alpha: soft-alpha things keep the target's alpha (`CustomBlending`, `blendSrcAlpha` Zero, `blendDstAlpha` One), so the
  ink lines round them are not cut. The ink pass skips where the render target's alpha < 1.
- Sorting: `renderer.setTransparentSort` draws far to near, but a figure of parts in a set order (a Grin: `userData.sortRank`,
  `sortZ` from `sortUnits()` each frame) sorts as one thing. Words keep `renderOrder` 10 (always on top).
- Resolution adapts (`resScale`); `calibrate()` (60-flow) times real frames under the ink during loading and lowers it to
  `CAL_MS`; floor three also measures the fog wall and a full smoke cloud (`CAL_HEAVY_MS`). The controller switches to `lite`
  (single ink lines) before lowering resolution.

## See-through (55-see-through: its header comment has the full rules)
- Anything that can stand between the camera and the fight is registered while the floor is built: `seeThru(o, dyn, how)`.
  `'hard'` (onlookers, floor one's easels) only keeps the camera off, never fades; `'plain'` fades evenly without a contour;
  the default fades with a contour. A new big prop or floater must be registered, or the camera can sit inside it.
- `seePrep` gives each a shape (column, spheres per part, box); a group can give its own spheres in `userData.seeSph`.
  `bakeStatics` bakes each see-through thing on its own so it can fade alone. `seeWarm` builds the faded shaders at load.
- Pillars and pyramids are decided by `seeSolid` (`SOLID[kind]`: `.line`, `.lens`, `.slow`); faded = material clones with no
  depth write, alphaTest fixed so no new shader mid-play. Removing one mid-floor: `seeOn(c, false)`, `c.off`, hide `c.meshes`.
- The contour is a half-size mask (`seeMask`) read by the ink pass, only inside the faded things' projected boxes
  (`seeBounds`): a new kind of thing drawn into the mask must be covered there too, or its contour is cut. Never give a
  see-through part a global `renderOrder > 0`.

## Pyramids (44-pyramids)
- Floor two's `T` cells. Destructible (`hitPyr`, `pyrShatter`); collision by square foot (`pyrPush`); glow, halo and floor pool
  share materials (one update a frame); own ink rim (`pyrRim`, drawn in `onAfterRender`; a mesh drawn with
  `renderBufferDirect` needs a stand-in in the scene so its shape is uploaded). The slingshot (not the yo-yo) can lock onto one.

## Talkers (20-talkers, 22–31)
- Registry `TALKERS[letter] = { make, update, dying, dazed, bar, warn }`; shared `damage`, `kill`. Each talker's file holds its
  build, fight and helpers, tuning at the top. Attack warnings: add a talker's tell to `warnOf` (07-hud, `updWarn`).
- `e.mats` are reset to white (or the hit flash) every frame: coloured parts use textures or vertex colours.

## Sound (01-audio)
- Synth: `sTone`, `sNoise`, `SFX.*`. Recorded clips: `sPlay(name, gain)` → `{ s, g }` (null before decoding; `AU.buf` is filled
  by `auInit` on the first click). Clips live in `game/data/sounds.js`.
- Where a sound comes from: `AU.at`; the loop sets it to each talker's position around its update, and sounds scale by
  `auK(AU.at)`. `hurtHero` clears it, so Red Cap's own sounds never fade. A long clip that follows its source keeps `.at`
  (`sprayFollow`). The Jester's laugh and the Grump are never distance-faded.

## Loading and flow (60-flow, 61-menus, 64-loop)
- Menu buttons and the exit door enter a floor in steps: `state` `'leave'` → `'build'` → `'intro'` (≥ 0.8 s). Plain
  `startGame()` / `enterFloor(i)` still build at once.
- Loading does real work: `warmUp` pre-draws `WORDS_SEED` + `WORDS_FLOOR[floor]` + words used this session and every `TEX`;
  `warmSet` compiles every material/shader variant from stand-ins; then `calibrate()`. The loading scrap stays ≥ 0.7 s.
- The death screen stops drawing the world (`deadStill`). HUD elements are cached in `EL`; write to the DOM only on change.
  Big centred words: `bigWord(text, color, size)`; hints: `toast(msg, ms)`.

## Testing (tests/)
- Playwright + swiftshader, viewport 880×500. First render of new shaders is slow (tens of seconds). A CSS compositor animation
  of the grain crashed swiftshader: keep the background-position version.
- `tests/harness.js`: frozen clock, seeded dice (three.js ids on their own dice), sound off, a scripted player; used by the
  replay and picture tests that prove a change alters nothing.
