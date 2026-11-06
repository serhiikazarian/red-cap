// Shared by replay.js and pics.js: opens a build, waits for its title, then takes over time (a frozen clock, timers and
// frames that advance only on H.step, seeded dice, no sound, no drawing) and installs a scripted player.
// In the page: R.start(floor, seed, setup) builds a floor and starts it, R.run(frames, sample) plays.
const path = require('path');
const { newPage } = require('./browser');

async function openGame(browser, build, errs) {
  const pg = await newPage(browser, errs);
  // dice fixed from the first line of the page: what start-up draws at random (the smoke texture) is the same every run
  await pg.addInitScript(() => {
    let s = 7;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await pg.goto('file://' + path.resolve(build));
  await pg.waitForSelector('#startBtn:not([disabled])', { timeout: 120000 });
  // straight into floor one, without the loading cut (its calibration draws dozens of full frames on the CPU: 10 s; the harness
  // sets the drawing quality itself) and without warming its shaders: every run rebuilds and warms its own floor (R.start)
  await pg.evaluate(() => {
    const warm = warmUp;
    warmUp = () => {};
    startGame();
    warmUp = warm;
  });
  await pg.waitForFunction("state === 'intro'", null, { timeout: 180000 });
  await pg.evaluate(() => slidesOn(false));
  await pg.evaluate(install);
  if (process.env.DEEP) await pg.evaluate(() => (window.__DEEP = 1));
  await pg.waitForTimeout(300); // a real frame already asked for runs once more, into the harness's queue
  return pg;
}

/* runs in the page */
function install() {
  // the pictures' quality is fixed (single ink lines at RES_MIN), so it does not depend on how fast this machine draws
  resScale = RES_MIN;
  inkPass.uniforms.lite.value = 1;
  resize();
  const H = (window.__H = { T: 1e6, timers: [], rafs: [], id: 1 });
  performance.now = () => H.T;
  window.setTimeout = (fn, ms = 0) => {
    H.timers.push({ at: H.T + (+ms || 0), fn, id: H.id });
    return H.id++;
  };
  window.clearTimeout = id => (H.timers = H.timers.filter(t => t.id !== id));
  window.setInterval = (fn, ms) => {
    const id = H.id++,
      again = () => H.timers.push({ at: H.T + ms, fn: () => (fn(), again()), id });
    again();
    return id;
  };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = fn => (H.rafs.push(fn), H.id++);
  H.draw = renderer.render.bind(renderer);
  renderer.render = () => {};
  // no sound: sounds load in the background, and code that waits on them must not change the run
  if (AUDIO.ctx) AUDIO.ctx.close();
  AUDIO.ctx = null;
  initAudio = () => {};
  H.step = () => {
    H.T += 1000 / 60;
    for (;;) {
      H.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      if (!H.timers.length || H.timers[0].at > H.T) break;
      H.timers.shift().fn();
    }
    const rs = H.rafs;
    H.rafs = [];
    for (const f of rs) f(H.T);
  };
  // two dice: three.js rolls for every object it makes (its ids), and how many objects get made depends on caches and history,
  // so those rolls come from their own dice and never shift the game's
  const mul = s => () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idFn = 'at ' + THREE.MathUtils.generateUUID.name + ' ';
  H.seed = s => {
    const game = mul(s),
      ids = mul(s + 999);
    Math.random = () => {
      const L = Error.stackTraceLimit;
      Error.stackTraceLimit = 3;
      const st = new Error().stack;
      Error.stackTraceLimit = L;
      return st.includes(idFn) ? ids() : game();
    };
  };

  const R = (window.__R = {});
  const live = e => !e.dead && !e.dying && !e.away && !e.hidden && !e.dormant && !e.waiting && !e.caged;
  // an open spot 4 to 8 m from a talker, with a clear line to it
  const openNear = e => {
    for (let r = 4; r <= 8; r += 2)
      for (let a = 0; a < 16; a++) {
        const x = e.pos.x + Math.cos((a / 16) * 6.283) * r,
          z = e.pos.z + Math.sin((a / 16) * 6.283) * r,
          [ix, iz] = cellOf(x, z);
        if (!solid(ix, iz) && lineOfSight(new THREE.Vector3(x, 1, z), e.pos)) return [x, z];
      }
    return null;
  };
  const jump = e => {
    const p = e && openNear(e);
    if (p) hero.pos.set(p[0], hero.pos.y, p[1]);
  };

  R.start = (floor, seed, setup) => {
    H.rafs = [];
    H.timers = [];
    H.seed(seed);
    last = H.T;
    hero.hp = hero.maxHp;
    hero.ammo = START_AMMO;
    hero.ammoFloor = -1;
    cam.yaw = 0;
    cam.pitch = 0.24;
    // the loop's running counters started when the page booted: zero them
    animAcc = 0;
    animTick = false;
    flowT = beatT = slowT = hitStop = slabBoomT = poolNext = playT = 0;
    adaptResolution = () => {}; // the drawing quality stays as install set it
    frame(H.T); // restart the loop inside the harness
    const built = floorBuilt;
    floorBuilt = i => {
      H.seed(seed); // the dice start here: whatever the title did before does not count
      if (window.__DEEP) {
        const D = Math.random;
        window.__ROLLS = [];
        Math.random = () => (window.__ROLLS.push(new Error().stack.split('\n').slice(2, 9).map(l => l.trim().replace(/^at /, '').replace(/\(.*?:(\d+):\d+\)/, '$1').replace(/file:.*?:(\d+):\d+/, '$1')).join(' < ')), D());
        built(i);
        Math.random = D;
      } else built(i);
    };
    enterFloor(floor);
    for (let i = 0; i < 600 && state !== 'intro'; i++) H.step();
    for (let i = 0; i < 60; i++) H.step();
    beginFloor();
    if (setup && setup.startsWith('near:')) jump(G.enemies.find(e => e.type === setup.slice(5)));
    if (setup === 'jester') {
      G.gateClosed = false;
      hero.pos.set(10.5 * CELL, hero.pos.y, 7.6 * CELL);
    }
    if (setup === 'finale') {
      // the Jester nearly beaten: the bot finishes him (finale, the huge mask, winning)
      G.gateClosed = false;
      hero.pos.set(10.5 * CELL, hero.pos.y, 7.6 * CELL);
      const J = G.enemies.find(e => e.type === 'M');
      J.hp = 2.5;
    }
    if (setup === 'ld') {
      // both plaques hit: the hidden boss wakes behind the start
      for (const q of G.plaques) hitPlaque(new THREE.Vector3(q.x, 2, q.z), 0.5);
      hero.pos.set(10.5 * CELL, hero.pos.y, (G.h - 5) * CELL);
    }
    R.f = 0;
    R.stuck = [hero.pos.x, hero.pos.z];
  };

  const r = n => Math.round(n * 1e5) / 1e5;
  R.run = (frames, every = 10) => {
    const trace = [],
      end = R.f + frames;
    for (; R.f < end && state === 'play'; R.f++) {
      const f = R.f;
      if (hero.hp <= 2) hero.hp = hero.maxHp; // keep the run going
      let t = null,
        bd = 1e9;
      for (const e of G.enemies)
        if (live(e)) {
          const d = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z);
          if (d < bd) (bd = d), (t = e);
        }
      keys.clear();
      if (f % 120 === 119) {
        // stuck on a wall for two seconds: hop to an open spot near the target
        if (t && Math.hypot(hero.pos.x - R.stuck[0], hero.pos.z - R.stuck[1]) < 1 && bd > 5) jump(t);
        R.stuck = [hero.pos.x, hero.pos.z];
      }
      if (t) {
        cam.yaw = Math.atan2(-(t.pos.x - hero.pos.x), -(t.pos.z - hero.pos.z));
        if (bd > 2.6) keys.add('KeyW');
        if (f % 120 < 30) keys.add('KeyD');
        if (bd < 5 && f % 12 === 0) yoyo();
        if (bd >= 5 && bd < 20 && f % 40 === 0) sling();
      } else {
        keys.add('KeyW');
        if (f % 200 < 50) keys.add('KeyQ');
      }
      if (f % 150 === 75) dodge();
      H.step();
      if (window.__DEEP && f % every === 0) {
        const flat = o => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || (v && v.isVector3)).map(([k, v]) => [k, v && v.isVector3 ? [v.x, v.y, v.z] : v]));
        trace.push(['deep', f, flat(hero), [cam.yaw, cam.pitch, camera.position.x, camera.position.z], G.enemies.map(flat)]);
      }
      if (f % every === 0)
        trace.push([
          f,
          state,
          r(hero.pos.x),
          r(hero.pos.y),
          r(hero.pos.z),
          hero.hp,
          hero.ammo,
          hero.combo || 0,
          hero.mix || 0,
          G.enemies.map(e => [e.type, r(e.pos.x), r(e.pos.z), r(e.hp), e.st || '', e.dead ? 1 : e.dying ? 2 : 0]),
          G.pickups ? G.pickups.filter(p => !p.taken).length : 0,
          (G.shots || []).length
        ]);
    }
    trace.push(['end', R.f, state]);
    if (window.__DEEP) trace.push(['rolls', window.__ROLLS]);
    return trace;
  };
  // one real picture of the current moment (the loop's own render, then the frame stays on the canvas)
  R.picture = () => {
    // page animations (CSS) run on the browser's own clock: fades (transitions) jump to their end, so the veil that lifts
    // off a new floor is gone; looping animations are held at their start
    for (const a of document.getAnimations()) {
      if (a instanceof CSSTransition) a.finish();
      else {
        a.pause();
        a.currentTime = 0;
      }
    }
    renderer.render = H.draw;
    render();
    renderer.render = () => {};
  };
}

module.exports = { openGame };
