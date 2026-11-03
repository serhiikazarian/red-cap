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
    const plan = i === 2 ? FINAL_SCRAP_MS : i === 0 ? FIRST_SCRAP_MS : 700;
    $('#cutting .snip').style.animationDuration = plan * SNIP_SLACK + 'ms'; // the cut slows as it goes (snipEnd finishes it)
    $('#cutting').hidden = false;
    const t0 = performance.now();
    // two painted frames and a moment of snipping before the build holds the page, so the scissors are always seen moving
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setTimeout(() => {
          if (!live()) return;
          floorBuilt(i);
          settle(SETTLE_ROUNDS[i], live, () => {
            calibrate();
            setTimeout(
              () => {
                if (!live()) return;
                // in: the veil dissolves into the new floor and the card fades in with it
                $('#cutting').hidden = true;
                floorShow(i);
                $('#card').classList.add('enter');
                veilOff();
              },
              snipEnd(plan, performance.now() - t0)
            );
          });
        }, 280)
      )
    );
  }, 360);
}
// the floor is built after e ms of a cut planned for plan. The cut runs most of the way in plan, then crawls (snip in
// style.css); from plan, or now if the build ran past it, its rest takes SNIP_END ms and the floor shows as the scissors arrive.
// Returns the wait until then.
function snipEnd(plan, e) {
  const lead = Math.max(0, plan - e);
  setTimeout(() => {
    const a = $('#cutting .snip').getAnimations()[0];
    if (!a) return;
    const left = plan * SNIP_SLACK - a.currentTime;
    if (left > 0) a.updatePlaybackRate(left / SNIP_END);
  }, lead);
  return lead + SNIP_END;
}
function veilOff() {
  $('#veil').classList.remove('on');
  $('#cutting').hidden = true;
}
function floorBuilt(i) {
  buildLevel(i);
  warmUp();
}
// behind the scrap (under the ink): real frames of the new floor, timed to the GPU, from its opening view and CAL_VIEWS more spread
// over the floor. Each floor starts from the screen's full ratio with double ink lines; if the second-slowest view takes longer than
// CAL_MS, single ink lines first, then the ratio it can hold. The heaviest moments (thick smoke, the fog wall) are left to the
// controller (02-render), which steps down while they last and back up after. Before floor three is timed, settle lets the GPU
// finish what the build left it, so a busy start does not set the floor's ratio too low.
const CAL_MS = 13,
  CAL_VIEWS = 4,
  SETTLE_ROUNDS = [0, 0, 8], // per floor: settle's least rounds (0: none); it stops when two rounds in a row agree
  SETTLE_TOL = 0.1, // within this share of each other
  SETTLE_MAX = 40, // and gives up after this many rounds
  FINAL_SCRAP_MS = 3000, // the scrap stays at least this long before floor three
  FIRST_SCRAP_MS = 1400, // and before floor one (its first build is the longest)
  SNIP_SLACK = 3, // the cut's own course is this many times its plan, easing out, so a long build never leaves it stuck at the end
  SNIP_END = 250; // ms: the rest of a cut whose build ran past its plan
const CAL_PX = new Uint8Array(4);
// one real frame, timed until the GPU has finished it (ms)
function calFrame() {
  const gl = renderer.getContext(),
    t0 = performance.now();
  render();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, CAL_PX); // waits for the GPU to finish the frame
  return performance.now() - t0;
}
// the views timed while a floor loads, each a camera place and turn: the floor's opening view first, then CAL_VIEWS more
function calViewsAll() {
  updCamera(1 / 60);
  return [[camera.position.clone(), camera.quaternion.clone()], ...calViews(CAL_VIEWS)];
}
function calLook([p, q]) {
  camera.position.copy(p);
  camera.quaternion.copy(q);
  camera.updateMatrixWorld();
}
// at the screen's full ratio with double ink lines, one round of frames from every view each animation frame, at least `rounds`
// of them, until the slowest view of two rounds in a row agrees within SETTLE_TOL (or SETTLE_MAX rounds); then done
function settle(rounds, live, done) {
  if (!rounds) return done();
  post.uniforms.lite.value = 0;
  resScale = resCap();
  resize();
  const views = calViewsAll();
  let n = 0,
    last = Infinity;
  const round = () => {
    if (!live()) return;
    const ms = Math.max(...views.map(v => (calLook(v), calFrame())));
    const steady = Math.abs(ms - last) <= SETTLE_TOL * last;
    last = ms;
    if (++n >= SETTLE_MAX || (n >= rounds && steady)) {
      calLook(views[0]);
      done();
    } else requestAnimationFrame(round);
  };
  requestAnimationFrame(round);
}
function calibrate() {
  const cap = resCap(),
    mid3 = () => [calFrame(), calFrame(), calFrame()].sort((a, b) => a - b)[1];
  post.uniforms.lite.value = 0;
  resScale = cap;
  resize();
  const views = calViewsAll();
  const slow = () => {
    const ms = views.map(v => {
      calLook(v);
      calFrame(); // anything this view needs that is still unready
      return mid3();
    });
    return ms.sort((a, b) => b - a)[Math.min(1, ms.length - 1)];
  };
  for (let n = 0; n < 4; n++) {
    const cur = Math.min(resScale, cap),
      ms = slow();
    if (ms <= CAL_MS || cur <= RES_LOW) break;
    if (!post.uniforms.lite.value) post.uniforms.lite.value = 1;
    else {
      resScale = Math.max(resFloor(cur), Math.floor(cur * Math.sqrt(CAL_MS / ms) * 20) / 20); // pixels cost by area
      resize();
    }
  }
  calLook(views[0]);
  resFresh();
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
