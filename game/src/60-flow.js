// The game's flow: starting, entering a floor (the ink veil, the paper scrap, building, preparing shaders and textures, timing
// the GPU, the floor's card), moving on, dying, winning, pausing, back to the title, and the title's slideshow.
// a new game from floor one (later: through the ink veil, from the title)
function startGame(later) {
  if (state === 'leave' || state === 'build') return; // already on the way into a floor
  auInit();
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
  renderer.compile(postScene, postCam);
  if (floorIdx === 2) texs.add(maskGlow());
  for (const t of texs) if (t && t.image) renderer.initTexture(t);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null); // hidden behind the card; the first real frame draws over it
  for (const o of culled) o.frustumCulled = true;
  scene.remove(WARM);
}
let floorTok = 0; // a newer enterFloor cancels a build still waiting to run
// to floor i: Red Cap's ties and pebbles are those he came in with (a retry restores them); later: through the veil and the
// scrap, else at once
function enterFloor(i, later) {
  if (later === true && (state === 'leave' || state === 'build')) return; // a floor is already on its way in
  stats.npc[i] = 0;
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
  hero.stun = 0;
  updAmmo();
  floorIdx = i;
  const tok = ++floorTok,
    live = () => tok === floorTok;
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
  setTimeout(() => {
    if (!live()) return;
    // cut: under full ink, the scrap shows while the floor is built (after it has been painted)
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
          tune(live, () => {
            loadMemSet(i, performance.now() - t0);
            snip.loaded();
          });
        }, 280)
      )
    );
  }, 360);
}
// The scissors cross their line at one even speed while the floor loads, cutting it open behind them, and the floor shows as
// they reach the end. Their run is the floor's least scrap time, or how long it took to load here (LOAD_KEY: the mean of the
// last load and the one remembered before, with SNIP_MARGIN), or LOAD_GUESS the first time; never over LOAD_MAX. A floor
// still loading when SNIP_SLOW_AT of the line is left slows them to SNIP_SLOW of their speed, and again each time that share
// of what was left remains (each slow stretch takes as long as the one before), down to SNIP_RATE_MIN of it, where they keep
// cutting at that pace; as it finishes they go back to their own speed. A change of speed keeps their place exactly (the
// browser's own rate change can lose it after a long slow stretch). Their arrival is checked every SNIP_TICK ms against the
// animation's own clock (or the wall clock, when there is no animation), so a floor always opens.
const LOAD_KEY = 'redcap.load.v1',
  LOAD_GUESS = [3000, 3000, 3500], // ms per floor: its run before any load has been timed here
  LOAD_MAX = 15000, // ms: a longer load (a hidden page) is not remembered, and no run is longer
  SNIP_MARGIN = 1.15, // the run is this much longer than the remembered load
  SNIP_SLOW_AT = 0.2,
  SNIP_SLOW = 0.5,
  SNIP_RATE_MIN = 1 / 16,
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
    m[i] = Math.round(m[i] ? (m[i] + ms) / 2 : ms);
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
// they have reached the end
function snipRun(run, live, arrive) {
  const a = $('#cutting .snip').getAnimations()[0],
    t0 = performance.now();
  const rate = r => {
    const t = a.currentTime;
    a.playbackRate = r;
    a.currentTime = t;
  };
  if (a) {
    a.currentTime = 0;
    rate(1);
  }
  let loaded = false,
    slowAt = SNIP_SLOW_AT;
  const clock = () => (a && a.playState !== 'idle' ? a.currentTime || 0 : performance.now() - t0), // ms of the run behind them
    tick = () => {
      if (!live()) return clearInterval(iv);
      const left = run - clock();
      if (!loaded) {
        if (a && left < slowAt * run && a.playbackRate > SNIP_RATE_MIN) {
          rate(Math.max(SNIP_RATE_MIN, a.playbackRate * SNIP_SLOW));
          slowAt *= SNIP_SLOW;
        }
      } else if (left <= 1) {
        clearInterval(iv);
        arrive();
      }
    },
    iv = setInterval(tick, SNIP_TICK);
  return {
    loaded() {
      loaded = true;
      if (a && a.playState !== 'idle') rate(1);
      tick();
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
// (the page never stalls, so the scissors stay smooth), from its opening view and CAL_VIEWS more spread over it in turn.
// First the frames settle: drawn at the screen's full ratio until their pace stops changing (the GPU has finished what the
// build left it). Then settings of resLadder are tried, the best first, then halving the rungs, and the best whose frames pass the
// controller's own test (02-render: a frame over LATE_AT screen frames is late) is kept, so play starts as sharp as it will
// stay; RES_MIN with single ink lines is taken as passing. Anything failing, or the whole taking over TUNE_MAX ms, ends it
// at the best setting found so far. The heaviest moments (thick smoke, the fog wall) are left to the controller.
const CAL_VIEWS = 4,
  SETTLE_MIN = 20, // frames: settling takes at least this many
  SETTLE_RUN = 6, // until the mean gap of the last this-many frames is within SETTLE_TOL of the run before
  SETTLE_TOL = 0.15,
  SETTLE_MAX = 120, // or this many frames
  TRY_WARM = 4, // a try: frames drawn at its setting before it is judged (new buffers, first draws)
  TRY_FRAMES = 30, // then frames judged
  TRY_LATE = 1, // and how many of them may be late
  TUNE_MAX = 15000, // ms
  FINAL_SCRAP_MS = 3000, // the scrap stays at least this long before floor three
  FIRST_SCRAP_MS = 1400; // and before floor one (its first build is the longest)
// the views drawn while a floor loads, each a camera place and turn: the floor's opening view first, then CAL_VIEWS more
function calViewsAll() {
  updCamera(1 / 60);
  return [[camera.position.clone(), camera.quaternion.clone()], ...calViews(CAL_VIEWS)];
}
function calLook([p, q]) {
  camera.position.copy(p);
  camera.quaternion.copy(q);
  camera.updateMatrixWorld();
}
// a drawing setting: [ratio, single ink lines (1) or double (0)]
function setRung([r, lite]) {
  post.uniforms.lite.value = lite;
  resScale = r;
  resize();
}
// the settings from the best down, as the controller steps them: the full ratio with double ink lines, then single lines,
// then the ratio RES_UP at a time to RES_MIN
function resLadder() {
  const out = [
    [resCap(), 0],
    [resCap(), 1]
  ];
  for (let r = resCap(); r > RES_MIN + 1e-3; ) out.push([(r = Math.max(RES_MIN, Math.round((r - RES_UP) * 100) / 100)), 1]);
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
// the floor's drawing settings, found while it loads; then done, from its opening view
function tune(live, done) {
  const views = calViewsAll(),
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
    k = 0,
    over = false;
  const finish = () => {
    if (over || !live()) return;
    over = true;
    setRung(L[hi]);
    calLook(views[0]);
    resFresh();
    done();
  };
  const next = () => {
    if (lo >= hi) return finish();
    mid = mid < 0 ? 0 : (lo + hi) >> 1;
    setRung(L[mid]);
    n = late = 0;
  };
  const frame = now => {
    if (over || !live()) return;
    try {
      const gap = last ? now - last : 0;
      last = now;
      if (performance.now() - t0 > TUNE_MAX) return finish();
      if (mid < 0) {
        if (gap) gaps.push(gap);
        if (settled(gaps)) next();
      } else {
        if (++n > TRY_WARM && gap > lateAt) late++;
        if (late > TRY_LATE || n >= TRY_WARM + TRY_FRAMES) {
          if (late > TRY_LATE) lo = mid + 1;
          else hi = mid;
          next();
        }
      }
      if (over) return;
      calLook(views[k++ % views.length]);
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
// n views spread over the floor for calibrate: from open cells taken evenly through the map, Red Cap's eye height above the
// ground, looking down the longest clear run of cells
function calViews(n) {
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
    const cx = (x + 0.5) * CELL,
      cz = (z + 0.5) * CELL,
      y = heightAt(cx, cz),
      eye = new THREE.PerspectiveCamera(); // a camera's lookAt turns its back (-z) to the target
    eye.position.set(cx, y + 2.4, cz);
    eye.lookAt(cx + dir[0] * 8, y + 1.4, cz + dir[1] * 8);
    out.push([eye.position, eye.quaternion]);
  }
  return out;
}
function floorShow(i) {
  state = 'intro';
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
  auInit();
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
  post.uniforms.psy.value = 0;
  state = 'dead';
  deadStill = false;
  const ex = sPlay('death_exhale'); // cut short with a fade
  if (ex) {
    const t = AU.ctx.currentTime;
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
  veilOff();
  $('#card').classList.remove('enter');
  slidesOn(true);
  droneStop();
  auInit();
  tmusWant(true); // every visit after the first (back from a game): music on
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
const SL = { els: [], i: -1, timer: 0 };
function slideNext() {
  const box = $('#slides');
  if (!SL.els.length)
    SL.els = SLIDES.map(([k, [s0, s1, x0, y0, x1, y1]]) => {
      const d = document.createElement('div');
      d.className = 'sl';
      d.style.backgroundImage = `url(${ASSETS[k]})`;
      Object.entries({ s0, s1, x0: x0 + '%', y0: y0 + '%', x1: x1 + '%', y1: y1 + '%' }).forEach(([v, val]) => d.style.setProperty('--' + v, val));
      box.prepend(d);
      return d;
    });
  const prev = SL.els[SL.i];
  SL.i = (SL.i + 1) % SL.els.length;
  const el = SL.els[SL.i];
  if (prev) {
    prev.classList.remove('top');
    setTimeout(() => {
      if (SL.els[SL.i] !== prev) prev.classList.remove('show');
    }, 2600);
  } // the old one stays under the new one until it has faded in
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show', 'top');
}
function slidesOn(on) {
  $('#slides').hidden = !on;
  clearInterval(SL.timer);
  if (!on) return;
  slideNext();
  SL.timer = setInterval(slideNext, 9000);
}
