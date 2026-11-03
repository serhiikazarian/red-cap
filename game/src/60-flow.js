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
// behind the scrap (under the ink): a few real frames of the new floor, timed to the GPU. If this machine cannot draw them in CAL_MS, play
// starts at the resolution it can hold, the one the controller would otherwise reach a step a second into the floor (which made a retry
// feel lighter than a first visit). If it was lowered before (at 60 Hz the controller never climbs back), the screen's full ratio is tried
// first and kept when the floor's views fit; otherwise it only lowers. The controller goes on adapting from there
const CAL_MS = 13,
  CAL_HEAVY_MS = 18, // floor three's worst views; the controller steps down only past 21 ms a frame
  FINAL_SCRAP_MS = 3000, // the scrap stays at least this long before floor three
  FIRST_SCRAP_MS = 1400, // and before floor one (its first build is the longest)
  SNIP_SLACK = 3, // the cut's own course is this many times its plan, easing out, so a long build never leaves it stuck at the end
  SNIP_END = 250; // ms: the rest of a cut whose build ran past its plan
function calibrate() {
  const gl = renderer.getContext(),
    px = new Uint8Array(4),
    cap = resCap();
  const timed = () => {
    const t0 = performance.now();
    render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the GPU to finish the frame
    return performance.now() - t0;
  };
  const mid3 = () => [timed(), timed(), timed()].sort((a, b) => a - b)[1];
  const fit = (limit, view) => {
    for (let n = 0; n < 3; n++) {
      const cur = Math.min(resScale, cap),
        ms = view();
      if (ms <= limit || cur <= RES_LOW) return;
      if (!post.uniforms.lite.value) {
        post.uniforms.lite.value = 1; // single ink lines first
        continue;
      }
      resScale = Math.max(resFloor(cur), Math.floor(cur * Math.sqrt(limit / ms) * 20) / 20); // pixels cost by area
      resize();
    }
  };
  post.uniforms.lite.value = 0;
  updCamera(1 / 60); // the floor's opening view
  timed(); // anything still unready
  // floor three's heavy moments: the fog wall filling the view (from 5 m, the way Red Cap comes), and a full cloud of smoke in front of him
  const p0 = camera.position.clone(),
    q0 = camera.quaternion.clone(),
    ahead = camera.getWorldDirection(new THREE.Vector3()),
    cloud = [];
  if (floorIdx === 2)
    for (let k = 0; k < PUFF_MAX; k++) {
      const sp = { position: p0.clone().addScaledVector(ahead, rand(3, 9)), scale: new THREE.Vector3().setScalar(rand(3, 4.5)) };
      sp.position.x += rand(-2.5, 2.5);
      sp.position.y += rand(-1.2, 1.2);
      sp.position.z += rand(-2.5, 2.5);
      sp.material = { opacity: 0.6, rotation: rand(0, TAU) };
      sp.visible = true;
      cloud.push({ s: sp });
    }
  const heavy = () => {
    let ms = 0;
    if (G.fogWall) {
      G.fogWall.g.children.find(c => c.userData.core).getWorldPosition(seeA);
      camera.position.set(seeA.x, 2.6, seeA.z + 5);
      camera.lookAt(seeA.x, 1.6, seeA.z);
      ms = mid3();
    }
    camera.position.copy(p0);
    camera.quaternion.copy(q0);
    puffs.push(...cloud);
    ms = Math.max(ms, mid3());
    puffs.length -= cloud.length;
    return ms;
  };
  // lowered before: the screen's full ratio, if this floor's views fit in it
  if (Math.min(resScale, cap) < cap) {
    const was = resScale;
    resScale = cap;
    resize();
    timed(); // the new size's first frame
    if (mid3() <= CAL_MS && (floorIdx !== 2 || heavy() <= CAL_HEAVY_MS)) {
      resCeil = Math.max(resCeil, cap);
      return;
    }
    resScale = was;
    resize();
    timed();
  }
  fit(CAL_MS, mid3);
  if (floorIdx !== 2) return;
  fit(CAL_HEAVY_MS, heavy);
  camera.position.copy(p0);
  camera.quaternion.copy(q0);
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
  const ex = sPlay('death_exhale', 0.6); // quieter, and cut short with a fade
  if (ex) {
    const t = AU.ctx.currentTime;
    ex.g.gain.setValueAtTime(0.6, t + 0.7);
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
