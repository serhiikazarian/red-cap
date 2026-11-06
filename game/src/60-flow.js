// The game's flow: starting, entering a floor (the ink veil, the paper scrap, building, preparing shaders and textures, timing
// the GPU, the floor's card), moving on, dying, winning, pausing, back to the title, and the title's slideshow.
// a new game from floor one (later: through the ink veil, from the title)
function startGame(later) {
  if (state === 'leave' || state === 'build') return; // already on the way into a floor
  initAudio();
  if (later !== true) slidesOn(false); // otherwise the slides go once the ink has covered them
  hero.ammo = START_AMMO;
  hero.hp = hero.maxHp;
  hero.ammoFloor = -1;
  loseJaw();
  stats.kills = 0;
  stats.hits = 0;
  stats.deaths = 0;
  stats.npc = [0, 0, 0];
  stats.start = performance.now();
  enterFloor(0, later === true);
}
// Loading rule: everything a floor will use is prepared during its loading screen, never mid-game. warmSet holds stand-ins
// for every kind of material that only appears later (shots, words, rings, holograms, the trail), so their shaders are built
// with the floor's; warmUp compiles them, uploads every texture and word, and draws one hidden frame.
const WARM = new THREE.Group();
function warmSet() {
  if (WARM.children.length) return;
  const g = share(new THREE.PlaneGeometry(0.01, 0.01));
  for (const map of [null, fireTex])
    for (const fog of [true, false]) {
      for (const side of [THREE.FrontSide, THREE.DoubleSide])
        WARM.add(
          new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map, fog, side, transparent: true, depthWrite: false })),
          new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map, fog, side }))
        );
      WARM.add(new THREE.Sprite(new THREE.SpriteMaterial({ map, fog, transparent: true, depthWrite: false })));
    }
  WARM.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
  const wm = new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
  wm.userData.uSh = { value: Array.from({ length: WAVE_SH_N }, () => new THREE.Vector4()) };
  wm.userData.uWall = { value: waveOpen() };
  wm.onBeforeCompile = waveCompile;
  WARM.add(new THREE.Mesh(g, wm)); // the Grump's rings
  WARM.add(new THREE.Mesh(g, holoMat(fireTex))); // the niche holograms
  const gc = share(new THREE.PlaneGeometry(0.01, 0.01)); // coloured like the trail's scraps (their colours are part of the shader)
  gc.setAttribute('color', new THREE.Float32BufferAttribute(new Array(gc.attributes.position.count * 3).fill(1), 3));
  WARM.add(new THREE.InstancedMesh(gc, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 1)); // the paper trail
  WARM.traverse(o => {
    o.frustumCulled = false;
    o.position.y = -50;
  });
}
function warmUp() {
  warmSet();
  scene.add(WARM);
  const culled = [],
    texs = new Set([...Object.values(TEX), ...Object.values(canvasTexCache), waveTex, fireTex, glowRed, violetTex, smokeTex]);
  scene.traverse(o => {
    if (o.frustumCulled) {
      o.frustumCulled = false;
      culled.push(o);
    }
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      if (m.map) texs.add(m.map);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) texs.add(u.value);
    }
  });
  renderer.compile(scene, camera);
  seeWarm();
  for (const [w, c] of [...WORDS_SEED, ...(WORDS_FLOOR[floorIdx] || []), ...(WORDS_USED[floorIdx] || new Map()).values()]) texs.add(wordTex(w, c));
  renderer.compile(inkScene, postCam);
  if (floorIdx === 2) texs.add(maskGlow());
  for (const t of G.texs) texs.add(t);
  for (const t of texs) if (t && t.image) renderer.initTexture(t);
  renderer.setRenderTarget(sceneTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null); // hidden behind the card; the first real frame draws over it
  for (const o of culled) o.frustumCulled = true;
  scene.remove(WARM);
}
let floorBuildId = 0; // a newer enterFloor cancels a build still waiting to run
// to floor i: Red Cap's ties and pebbles are those he came in with (a retry restores them); later: through the veil and the
// scrap, else at once
function enterFloor(i, later) {
  if (later === true && (state === 'leave' || state === 'build')) return; // a floor is already on its way in
  stats.npc[i] = 0;
  floorSupplies(i);
  hero.stun = 0;
  updateAmmo();
  floorIdx = i;
  const tok = ++floorBuildId,
    live = () => tok === floorBuildId;
  if (later !== true) {
    floorBuilt(i);
    floorShow(i);
    veilOff();
    return;
  }
  // out: the ink veil fades in over whatever is showing
  state = 'leave';
  $('#card').classList.remove('enter');
  $('#veil').classList.add('on');
  setTimeout(() => floorCut(i, live), 360);
}
// a new floor: remember the ties, pebbles and jaw he brings in; the same floor again (a retry): give those back
function floorSupplies(i) {
  if (i !== hero.ammoFloor) {
    hero.ammoFloor = i;
    hero.floorAmmo = hero.ammo;
    hero.floorHp = hero.hp;
    hero.floorJaw = !!hero.hasJaw;
  } else {
    hero.ammo = hero.floorAmmo;
    hero.hp = hero.floorHp;
    if (hero.hasJaw && !hero.floorJaw) loseJaw();
  }
}
// cut: under full ink, the scrap shows while the floor is built (after it has been painted); live: this entry is still the latest
function floorCut(i, live) {
  if (!live()) return;
  state = 'build';
  showOnly(null);
  slidesOn(false);
  droneStop();
  for (const id of ['#hud', '#reticle', '#touch']) $(id).hidden = true;
  $('#toast').style.opacity = 0;
  $('#cutNum').textContent = FLOORS[i].num;
  const run = snipPlan(i);
  $('#cutting .snip').style.animationDuration = run + 'ms';
  $('#cutting').hidden = false;
  const t0 = performance.now(),
    snip = snipRun(run, live, () => {
      // in: the veil dissolves into the new floor and the card fades in with it
      $('#cutting').hidden = true;
      floorShow(i);
      $('#card').classList.add('enter');
      veilOff();
    });
  // two painted frames and a moment of snipping before the build holds the page, so the scissors are always seen moving
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (!live()) return;
        floorBuilt(i);
        tune(
          live,
          () => {
            loadMemSet(i, performance.now() - t0);
            snip.loaded();
          },
          snip.expect
        );
      }, 280)
    )
  );
}
// The scissors cross their line at an even speed while the floor loads, cutting it open behind them, and the floor shows as
// they reach the end. Their run is the floor's least scrap time, or how long it took to load here (LOAD_KEY: a faster load
// is taken as it is, a slower one is averaged with the time remembered, with SNIP_MARGIN), or LOAD_GUESS the first time;
// never over LOAD_MAX. Every SNIP_TICK ms they steer, never faster than their own speed nor slower than SNIP_RATE_MIN of it:
// while tune() expects to go on (expect), towards the pace that brings them to the end just then; before it says, or once
// that time has passed with the floor still loading, from SNIP_SLOW_AT of the line left, slower the less is left. As it
// finishes they go back to their own speed. Each change eases in over SNIP_EASE ms, so the pace drifts rather than steps,
// through updatePlaybackRate, which keeps the place they are drawn at (setting currentTime again would pull them back to
// where the page last saw them, behind the screen while it is busy). Their arrival is checked against the animation's own clock (or the wall clock, when there is no animation), so a floor always opens.
const LOAD_KEY = 'redcap.load.v2',
  LOAD_GUESS = [2000, 2000, 3000], // ms per floor: its run before any load has been timed here
  LOAD_MAX = 5000, // ms: a longer load (a hidden page) is not remembered, and no run is longer
  SNIP_MARGIN = 1.1, // the run is this much longer than the remembered load
  SNIP_SLOW_AT = 0.2,
  SNIP_RATE_MIN = 1 / 16,
  SNIP_EASE = 300, // ms
  SNIP_TICK = 50; // ms
// how long floor i took to load here (ms), or undefined
function loadMemGet(i) {
  try {
    return (JSON.parse(localStorage.getItem(LOAD_KEY)) || [])[i];
  } catch {
    return undefined;
  }
}
function loadMemSet(i, ms) {
  if (document.hidden || ms > LOAD_MAX) return; // held up by a hidden page: it says nothing about this machine
  try {
    const m = JSON.parse(localStorage.getItem(LOAD_KEY)) || [];
    m[i] = Math.round(m[i] && ms > m[i] ? (m[i] + ms) / 2 : ms);
    localStorage.setItem(LOAD_KEY, JSON.stringify(m));
  } catch {
    /* not remembered: the next run is planned from the guess */
  }
}
function snipPlan(i) {
  const least = i === 2 ? FINAL_SCRAP_MS : i === 0 ? FIRST_SCRAP_MS : 700,
    mem = loadMemGet(i);
  return Math.round(clamp(mem ? mem * SNIP_MARGIN : LOAD_GUESS[i], least, LOAD_MAX));
}
// the scissors' run of `run` ms (the snip animation in style.css), from the start: arrive() once loaded() has been called and
// they have reached the end; expect(ms): the load expects to end in ms
function snipRun(run, live, arrive) {
  const a = $('#cutting .snip').getAnimations()[0],
    t0 = performance.now();
  if (a) {
    a.currentTime = 0;
    a.playbackRate = 1;
  }
  let loaded = false,
    endAt = 0, // when the load expects to end (performance.now()), 0: not said yet
    lastT = t0;
  const clock = () => (a && a.playState !== 'idle' ? a.currentTime || 0 : performance.now() - t0), // ms of the run behind them
    want = left => {
      if (loaded) return 1;
      const due = endAt - performance.now();
      return clamp(due > SNIP_TICK ? left / due : left / (SNIP_SLOW_AT * run), SNIP_RATE_MIN, 1);
    },
    tick = () => {
      if (!live()) return clearInterval(iv);
      const now = performance.now(),
        left = run - clock();
      if (loaded && left <= 1) {
        clearInterval(iv);
        return arrive();
      }
      if (a && a.playState === 'running') {
        // at the end (the page was held up past their run) they wait there: a rate change would start them over
        const r = a.playbackRate,
          to = r + (want(left) - r) * Math.min(1, (now - lastT) / SNIP_EASE);
        if (Math.abs(to - r) > 0.01) a.updatePlaybackRate(to);
      }
      lastT = now;
    },
    iv = setInterval(tick, SNIP_TICK);
  return {
    loaded() {
      loaded = true;
      tick();
    },
    expect(ms) {
      endAt = performance.now() + ms;
    }
  };
}
function veilOff() {
  $('#veil').classList.remove('on');
  $('#cutting').hidden = true;
}
function floorBuilt(i) {
  buildLevel(i);
  warmUp();
}
// Behind the scrap (under the ink), the floor's drawing settings are found from real frames of it, one each animation frame
// (the page never stalls, so the scissors stay smooth), from its opening view and CALIBRATION_VIEWS more spread over it in turn.
// First the frames settle: drawn at the screen's full ratio until their pace stops changing (the GPU has finished what the
// build left it). Then settings of resLadder are tried, the best first, then halving the rungs, and the best whose frames pass the
// controller's own test (02-render: a frame over LATE_AT screen frames is late) is kept, so play starts as sharp as it will
// stay; RES_MIN with single ink lines is taken as passing. Anything failing, or the whole taking over TUNE_MAX ms, ends it
// at the best setting found so far. The heaviest moments (thick smoke, the fog wall) are left to the controller.
const CALIBRATION_VIEWS = 4,
  SETTLE_MIN = 12, // frames: settling takes at least this many
  SETTLE_RUN = 6, // until the mean gap of the last this-many frames is within SETTLE_TOL of the run before
  SETTLE_TOL = 0.15,
  SETTLE_MAX = 60, // or this many frames
  TRY_WARM = 4, // a try: frames drawn at its setting before it is judged (new buffers, first draws)
  TRY_FRAMES = 30, // then frames judged
  TRY_LATE = 1, // and how many of them may be late
  TUNE_MAX = 3000, // ms: the controller (02-render) goes on from the best setting found by then
  FINAL_SCRAP_MS = 3000, // the scrap stays at least this long before floor three
  FIRST_SCRAP_MS = 1400; // and before floor one (its first build is the longest)
// the views drawn while a floor loads, each a camera place and turn: the floor's opening view first, then CALIBRATION_VIEWS more
function calibrationViewsAll() {
  updateCamera(1 / 60);
  return [[camera.position.clone(), camera.quaternion.clone()], ...calibrationViews(CALIBRATION_VIEWS)];
}
function calibrationLook([p, q]) {
  camera.position.copy(p);
  camera.quaternion.copy(q);
  camera.updateMatrixWorld();
}
// a drawing setting: [ratio, single ink lines (1) or double (0)]
function setRung([r, lite]) {
  inkPass.uniforms.lite.value = lite;
  resScale = r;
  resize();
}
// the settings from the best down, as the controller steps them: the full ratio with double ink lines, then single lines,
// then the ratio RES_UP at a time to RES_MIN
function resLadder() {
  const out = [
    [resolutionCap(), 0],
    [resolutionCap(), 1]
  ];
  for (let r = resolutionCap(); r > RES_MIN + 1e-3; ) out.push([(r = Math.max(RES_MIN, Math.round((r - RES_UP) * 100) / 100)), 1]);
  return out;
}
// settled: enough frames, and the pace of the last SETTLE_RUN agrees with the run before (or SETTLE_MAX frames)
function settled(gaps) {
  const n = gaps.length,
    mean = (a, b) => gaps.slice(a, b).reduce((x, y) => x + y, 0) / (b - a);
  if (n < SETTLE_MIN) return false;
  if (n >= SETTLE_MAX) return true;
  const now = mean(n - SETTLE_RUN, n),
    before = mean(n - 2 * SETTLE_RUN, n - SETTLE_RUN);
  return Math.abs(now - before) <= SETTLE_TOL * before;
}
// the floor's drawing settings, found while it loads; then done, from its opening view. expect(ms), each frame: how long it
// expects still to take (the frames left at the pace so far; while settling, one try when the frames are well inside the
// late-frame rule, else as many as halving the rungs takes), within TUNE_MAX
function tune(live, done, expect) {
  const views = calibrationViewsAll(),
    L = resLadder(),
    t0 = performance.now(),
    lateAt = LATE_AT * clamp(RES.frame || 1000 / 60, 1000 / 60, 20.1),
    gaps = [];
  let lo = 0,
    hi = L.length - 1, // the best rung known to pass
    mid = -1, // the rung being tried (-1: still settling; the first try is the best rung)
    n = 0,
    late = 0,
    last = 0,
    pace = 0, // ms: the recent frame gap
    k = 0,
    over = false;
  const finish = () => {
    if (over || !live()) return;
    over = true;
    setRung(L[hi]);
    calibrationLook(views[0]);
    resolutionFresh();
    done();
  };
  const next = () => {
    if (lo >= hi) return finish();
    mid = mid < 0 ? 0 : (lo + hi) >> 1;
    setRung(L[mid]);
    n = late = 0;
  };
  // a frame's verdict: still settling, or the try at rung mid passes (hi = mid) or fails (lo = mid + 1) once it is judged
  const judge = gap => {
    if (mid < 0) {
      if (gap) gaps.push(gap);
      if (settled(gaps)) next();
      return;
    }
    if (++n > TRY_WARM && gap > lateAt) late++;
    if (late <= TRY_LATE && n < TRY_WARM + TRY_FRAMES) return;
    if (late > TRY_LATE) lo = mid + 1;
    else hi = mid;
    next();
  };
  const frame = now => {
    if (over || !live()) return;
    try {
      const gap = last ? now - last : 0;
      last = now;
      if (gap) pace = pace ? pace + (gap - pace) * 0.2 : gap;
      if (performance.now() - t0 > TUNE_MAX) return finish();
      judge(gap);
      if (over) return;
      expect(Math.min(TUNE_MAX - (performance.now() - t0), tuneLeft(pace, gaps.length, mid, n, hi - lo, pace < 0.8 * lateAt)));
      calibrationLook(views[k++ % views.length]);
      render();
    } catch {
      return finish(); /* a fault while trying: play starts at the best setting known, the controller takes it from there */
    }
    requestAnimationFrame(frame);
  };
  setRung(L[0]);
  setTimeout(finish, TUNE_MAX + 1000); // no frames at all (a hidden page): the floor still opens
  requestAnimationFrame(frame);
}
// tune's time still to come (see tune), in ms: pace, the recent frame gap; settled, frames drawn while settling; mid and n,
// the rung being tried (-1: settling) and its frames so far; span, the rungs still in question; fast, frames well inside
// the late-frame rule (the best rung will likely pass)
function tuneLeft(pace, settled, mid, n, span, fast) {
  if (settled < 3) return Infinity;
  const search = Math.ceil(Math.log2(span + 1)), // tries until the rungs are halved down to one, this one included
    tries = mid < 0 ? (fast ? 1 : 1 + search) : mid === 0 && fast ? 1 : Math.max(search, 1),
    frames = (mid < 0 ? Math.max(SETTLE_MIN - settled, 0) : -n) + tries * (TRY_WARM + TRY_FRAMES);
  return Math.max(frames, 0) * pace;
}
// n views spread over the floor for calibrate: from open cells taken evenly through the map, Red Cap's eye height above the
// ground, looking down the longest clear run of cells
function calibrationViews(n) {
  const cells = [],
    out = [];
  for (let z = 1; z < G.h - 1; z++) for (let x = 1; x < G.w - 1; x++) if (G.map[z][x] === '.') cells.push([x, z]);
  for (let k = 0; k < n && cells.length; k++) {
    const [x, z] = cells[Math.floor(((k + 0.5) / n) * cells.length)];
    let run = 0,
      dir = null;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      let r = 0;
      while (r < 6 && !solid(x + dx * (r + 1), z + dz * (r + 1))) r++;
      if (r > run) [run, dir] = [r, [dx, dz]];
    }
    if (!dir) continue;
    const cx = cellMid(x),
      cz = cellMid(z),
      y = heightAt(cx, cz),
      eye = new THREE.PerspectiveCamera(); // a camera's lookAt turns its back (-z) to the target
    eye.position.set(cx, y + 2.4, cz);
    eye.lookAt(cx + dir[0] * 8, y + 1.4, cz + dir[1] * 8);
    out.push([eye.position, eye.quaternion]);
  }
  return out;
}
let worldOn = false; // the world has been shown since the title (until then the title and the ink cover it: not drawn)
function floorShow(i) {
  state = 'intro';
  worldOn = true;
  $('#hud').hidden = false;
  $('#weapons').hidden = touchUI;
  droneStart(FLOORS[i].drone);
  cardAt = performance.now();
  showOnly('card');
  $('#toast').style.opacity = 0;
  keys.clear();
  $('#cardNum').textContent = FLOORS[i].num;
  $('#cardName').textContent = FLOORS[i].name;
  $('#cardLine').textContent = FLOORS[i].line;
  $('#reticle').hidden = true;
  $('#touch').hidden = true;
}
// nothing moves, attacks, or hurts until the player dismisses the floor's card
let cardAt = 0;
const cardReady = () => performance.now() - cardAt > 900; // a key still held from walking through the door must not skip the card
function beginFloor() {
  if (state !== 'intro' || !cardReady()) return;
  state = 'play';
  showOnly(null);
  $('#card').classList.remove('enter');
  $('#touch').hidden = !touchUI;
  $('#reticle').hidden = touchUI;
  $('#reticle').classList.remove('show');
  hero.iframe = Math.max(hero.iframe, 0.8);
  keys.clear();
  lockPointer();
}
$('#card').addEventListener('pointerdown', e => {
  e.preventDefault();
  initAudio();
  beginFloor();
});
function nextFloor() {
  if (floorIdx + 1 < FLOORS.length) {
    for (const p of G.pickups) if (!p.taken && !p.hid) hero.hp = p.big ? hero.maxHp : Math.min(hero.maxHp, hero.hp + 1); // ties left behind come along
    drawTies();
    SFX.portal();
    enterFloor(floorIdx + 1, true);
  }
}
let deadStill = false; // the death screen is up: the world is no longer drawn (the main loop)
function die() {
  inkPass.uniforms.psy.value = 0;
  state = 'dead';
  deadStill = false;
  const ex = playClip('death_exhale'); // cut short with a fade
  if (ex) {
    const t = AUDIO.ctx.currentTime;
    ex.g.gain.setValueAtTime(VOL.death_exhale, t + 0.7);
    ex.g.gain.linearRampToValueAtTime(0, t + 1);
    ex.s.stop(t + 1.05);
  }
  stats.deaths++;
  sprayStop();
  droneStop();
  $('#reticle').hidden = true;
  setTimeout(() => {
    showOnly('dead');
    deadStill = state === 'dead';
    $('#deadLine').textContent = 'They got the last word.';
    unlock();
  }, 700);
}
function win() {
  if (state !== 'play') return;
  state = 'win';
  droneStop();
  SFX.alarm();
  SFX.morning();
  catRecord();
  const secret = hero.hasJaw ? [['ld_whole', 'Livin’ / Dyin’']] : [];
  $('#silenced').innerHTML = [
    ['bowface', 'Ushers'],
    ['geezer', 'The Geezer'],
    ['grin', 'Grins'],
    ['priest', 'Priest'],
    ['bruno', 'Bruno'],
    ['grump', 'The Grump'],
    ['smoker', 'Smokers'],
    ...secret,
    ['jester_mask', 'The Jester']
  ]
    .map(
      ([k, n], i) =>
        `<figure style="--d:${(0.7 + i * 0.2).toFixed(2)}s"><img src="${ASSETS[k]}" alt="${n}"><figcaption>${n} — silenced</figcaption></figure>`
    )
    .join('');
  showOnly('win');
  winShow(0);
  $('#hud').hidden = true;
  $('#touch').hidden = true;
  $('#reticle').hidden = true;
  const s = Math.round((performance.now() - stats.start) / 1000);
  $('#winStats').textContent =
    `${stats.kills} talkers torn · ${stats.hits} hits taken · ${stats.deaths} ${stats.deaths === 1 ? 'death' : 'deaths'} · ${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  unlock();
  SFX.portal();
}
function pause(on) {
  if (on && state === 'play') {
    state = 'pause';
    showOnly('pause');
    sprayStop();
  } else if (!on && state === 'pause') {
    state = 'play';
    showOnly(null);
    lockPointer();
  }
}
function toTitle() {
  state = 'title';
  worldOn = false;
  veilOff();
  $('#card').classList.remove('enter');
  slidesOn(true);
  droneStop();
  initAudio();
  titleMusicWant(true); // every visit after the first (back from a game): music on
  showOnly('title');
  $('#hud').hidden = true;
  $('#touch').hidden = true;
  $('#reticle').hidden = true;
  unlock();
}
// ----- the title's slideshow: Serj's paintings drifting slowly, one after another
const SLIDES = [
  // [asset, drift: start and end scale, then x / y offsets in %]  1 the Ushers' corridor, 2 the Geezer, 3 the Mouth, 4 the Priest, 5 the Grump
  ['slide_1', [1.06, 1.13, 1.5, -0.5, -1.5, 0.5]],
  ['slide_2', [1.14, 1.06, 0, 1.2, 0, -0.8]],
  ['slide_3', [1.05, 1.12, -1.2, 0, 1.2, -1]],
  ['slide_4', [1.12, 1.05, 1, -1, -1, 0.6]],
  ['slide_5', [1.05, 1.12, 0, -1.4, 0, 1]]
];
const SLIDE_SHOW = { els: [], i: -1, timer: 0 };
function slideNext() {
  const box = $('#slides');
  if (!SLIDE_SHOW.els.length)
    SLIDE_SHOW.els = SLIDES.map(([k, [s0, s1, x0, y0, x1, y1]]) => {
      const d = document.createElement('div');
      d.className = 'sl';
      d.style.backgroundImage = `url(${ASSETS[k]})`;
      Object.entries({ s0, s1, x0: x0 + '%', y0: y0 + '%', x1: x1 + '%', y1: y1 + '%' }).forEach(([v, val]) => d.style.setProperty('--' + v, val));
      box.prepend(d);
      return d;
    });
  const prev = SLIDE_SHOW.els[SLIDE_SHOW.i];
  SLIDE_SHOW.i = (SLIDE_SHOW.i + 1) % SLIDE_SHOW.els.length;
  const el = SLIDE_SHOW.els[SLIDE_SHOW.i];
  if (prev) {
    prev.classList.remove('top');
    setTimeout(() => {
      if (SLIDE_SHOW.els[SLIDE_SHOW.i] !== prev) prev.classList.remove('show');
    }, 2600);
  } // the old one stays under the new one until it has faded in
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show', 'top');
}
function slidesOn(on) {
  $('#slides').hidden = !on;
  clearInterval(SLIDE_SHOW.timer);
  if (!on) return;
  slideNext();
  SLIDE_SHOW.timer = setInterval(slideNext, 9000);
}
