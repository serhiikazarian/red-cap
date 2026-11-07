// The Geezer (Y): floor one's boss. Stares people mad, mostly himself, in mirrors.
const GEEZER_WARN_AGAIN = 2; // stares in a row that catch Red Cap before GAZING / Take cover! is called again (always on the first)

// his stare: walls and pillars hide Red Cap from it; an easel is too small to (though he still blinks round one, to spook)
const geezerSees = e => clearOfCover(e.pos, hero.pos, 0.3, false);

// a big floating head, with two eye glows over the painted eyes
function makeGeezer(e, add) {
  const H = 4.4;
  Object.assign(e, {
    name: 'The Geezer',
    hp: 27.5,
    maxHp: 27.5,
    r: 1.4,
    hgt: 4.8,
    y1: 4.9,
    palette: [0x2a2a1a, COL.paper, 0x8a2a1a, 0x9a9a9a],
    boss: true,
    exhaust: 0,
    flashT: 0
  });
  const m = add(paper('geezer', H, 0.2));
  m.position.y = 0.35;
  e.body = m;
  e.t = 2;
  const b = SHAPES.geezer.box,
    w = sizeOf('geezer', H).w,
    eyeTex = own(glowTex('#f4f0ff', 'rgba(180,140,255,.7)'));
  e.eyes = [265, 450].map(px => {
    const sp = glowSprite(eyeTex, { fog: false });
    sp.position.set(((px - b[0]) / (b[2] - b[0]) - 0.5) * w, 0.35 + (1 - (455 - b[1]) / (b[3] - b[1])) * H, 0.2);
    sp.visible = false;
    e.tilt.add(sp);
    return sp;
  });
}
// He drifts after Red Cap and stares: his eyes light up (gaze), then flash. Caught in the open, Red Cap is stunned and hurt
// (less from afar); a stare that misses everything leaves him winded (WHEEZE: hits do double). Close up he lashes with his
// beard (sweep); hidden from him he blinks to where he can see you. In his second half (p2) everything comes quicker.
function updateGeezer(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  const now = performance.now() / 1000,
    p2 = e.hp <= e.maxHp / 2;
  if (animTick && e.st !== 'blink') e.tilt.position.y = Math.sin(now * 1.3) * 0.18;
  e.exhaust = Math.max(0, e.exhaust - dt);
  e.flashT = Math.max(0, e.flashT - dt);
  e.pressure = Math.max(0, (e.pressure || 0) - dt * 0.7);
  const glow = e.st === 'gaze' ? clamp(1 - e.t / e.tWind, 0, 1) : 0;
  e.eyes.forEach(s => {
    s.visible = glow > 0 || e.flashT > 0;
    s.scale.setScalar(0.5 + glow * 1.6 + (e.flashT > 0 ? 3 : 0));
  });
  // the page swirls as his eyes light up: full within 9 m, gone by 22 m
  const seenK = (dist <= 9 ? 1 : Math.max(0, 1 - (dist - 9) / 13)) * (clearOfWalls(e.pos, hero.pos) ? 1 : 0.05);
  G.psyWind = Math.max(G.psyWind, (glow * 0.5 + (e.flashT > 0 ? 0.8 : 0)) * seenK);
  const step = GEEZER_STATES[e.st];
  if (step) step(e, dt, dist, ux, uz, mv, now, p2, seenK);
  if (dist < e.r + hero.r + 0.1) hurtHero(1, e.pos);
}
// a stare begins: GAZING / Take cover! on his first, and again only once two stares in a row have caught Red Cap
function geezerWarn(e) {
  if (e.gazes) e.caughtRow = e.gazeCaught ? (e.caughtRow || 0) + 1 : 0; /* how the last stare went */
  e.gazes = (e.gazes || 0) + 1;
  e.gazeCaught = false;
  if (e.gazes > 1 && e.caughtRow < GEEZER_WARN_AGAIN) return;
  e.caughtRow = 0;
  bigWord('GAZING', 'var(--alarm)', 1, 'Take cover!', 'var(--bile)'); /* the other way round from Attack him!: red, then yellow */
}
// his states, one step each (updateGeezer runs the one he is in)
const GEEZER_STATES = {
  idle(e, dt, dist, ux, uz, mv, now, p2, seenK) {
    if (hero.pos.z > 9 * CELL && clearOfWalls(e.pos, hero.pos)) {
      e.st = 'drift';
      e.t = 1.8;
      SFX.growl();
      floatWord('YOUNG MAN', e.pos.clone().setY(5.3), HEX.paper, 1.2);
      toast('Avoid his gaze.');
    }
  },
  drift(e, dt, dist, ux, uz, mv, now, p2, seenK) {
    if (dist > 3.4) {
      [mv.x, mv.z] = steer(e);
      mv.sp = p2 ? 2.6 : 2.0;
    }
    if (animTick) e.tilt.rotation.z = Math.sin(now * 2) * 0.05;
    if (e.t <= 0 && e.stagger <= 0) {
      if (dist < 4.6) {
        e.st = 'sweep';
        e.tWind = e.t = rand(0.55, 0.8);
        e.lashes = p2 && Math.random() < 0.35 ? 2 : 1;
        e.side = Math.random() < 0.5 ? 1 : -1;
        floatWord('HMMPH', e.pos.clone().setY(5.2), HEX.paper, 1);
        SFX.growl();
      } else if (!clearOfCover(e.pos, hero.pos) ? Math.random() < 0.5 : p2 && Math.random() < 0.45) {
        // hidden from him, an easel too, just to spook (or now and then in his second half): he blinks to where he can see you
        e.st = 'blink';
        e.t = 0.45;
        playNoise({ dur: 0.4, f: 3000, f2: 300, q: 2, gain: 0.2 });
      } else if (!geezerSees(e)) {
        e.t = rand(0.6, 1.2); // no stare at what he cannot see
      } else {
        e.st = 'gaze';
        e.tWind = e.t = p2 ? rand(0.75, 1.15) : rand(1, 1.5);
        e.flashes = (p2 ? 2 : 1) + (Math.random() < (p2 ? 0.35 : 0.3) ? 1 : 0);
        e.snap = false;
        e.missed = false;
        SFX.psyRise(e.tWind);
        floatWord('LOOK AT ME', e.pos.clone().setY(5.3), '#b48cff', 1.1);
        geezerWarn(e);
      }
    }
  },
  gaze(e, dt, dist, ux, uz, mv, now, p2, seenK) {
    if (animTick) shake(e.tilt, 0.04);
    if (e.t <= 0) {
      e.flashT = 0.25;
      SFX.psyFlash();
      const dodged = hero.dodgeT > 0 || performance.now() / 1000 - (hero.lastDodgeAt || -9) < 0.6;
      const exposed = dist < 24 && geezerSees(e) && !dodged && hero.stun <= 0;
      if (exposed) {
        e.gazeCaught = true;
        // the stare weakens with distance: full up close, less across the room, a dizzy blink from far away
        const far = dist > 17 ? 2 : dist > 9 ? 1 : 0;
        if (far === 2) stunHero(0.5, true, 0.2 * seenK);
        else {
          stunHero((p2 ? 1.9 : 1.5) * (far ? 0.6 : 1));
          hero.iframe = 0;
          hurtHero(far ? 1 : 2, e.pos);
        }
      } else if (hero.stun <= 0) e.missed = true; /* a miss leaves him winded (his boss bar says so) */
      e.flashes--;
      if (e.flashes > 0) {
        // another flash, after a gap you cannot count on
        e.t = e.tWind = rand(0.5, 0.95);
        SFX.psyRise(e.tWind);
      } else {
        const winded = e.missed && !e.snap;
        if (winded) {
          e.exhaust = rand(1.6, 2.2) * (p2 ? 0.85 : 1);
          floatWord('*WHEEZE*', e.pos.clone().setY(5.2), HEX.bile, 1.1);
        }
        e.st = 'recover';
        e.t = winded ? e.exhaust : rand(0.5, 0.9);
        e.tilt.position.x = e.tilt.position.z = 0;
      }
    }
  },
  sweep(e, dt, dist, ux, uz, mv, now, p2, seenK) {
    // a beard lash all around him
    if (animTick) e.tilt.rotation.z = (1 - e.t / e.tWind) * 0.36 * e.side;
    if (e.t <= 0) {
      e.tilt.rotation.z = -e.side * 0.3;
      SFX.dodge();
      cam.shake = Math.max(cam.shake, 0.25);
      for (let k = 0; k < 30; k++) {
        const a = rand(0, TAU),
          r = rand(1.5, 4.8);
        burst(fxAt(e.pos, Math.cos(a) * r, rand(0.4, 1.6), Math.sin(a) * r), [0xd8d4cc, 0x9a9a9a, 0x2a2a1a], 1, 2, 0.22, {
          g: 4,
          life: 0.6
        });
      }
      if (dist < 4.9 && hurtHero(1, e.pos)) hero.knock.set(ux * 14, uz * 14);
      if (--e.lashes > 0) {
        e.tWind = e.t = 0.42;
        e.side = -e.side;
        floatWord('AND AGAIN', e.pos.clone().setY(5.2), HEX.paper, 0.9);
        SFX.growl();
      } else {
        e.st = 'recover';
        e.t = rand(0.5, 0.9);
      }
    }
  },
  blink(e, dt, dist, ux, uz, mv, now, p2, seenK) {
    // vanishes and reappears somewhere he can see you, already staring
    const k = clamp(e.t / 0.45, 0, 1);
    e.body.scale.setScalar(Math.max(0.05, k));
    if (e.t <= 0) {
      for (let tries = 0; tries < 30; tries++) {
        const a = rand(0, TAU),
          r = rand(6.5, 9.5),
          x = hero.pos.x + Math.cos(a) * r,
          z = hero.pos.z + Math.sin(a) * r,
          [ix, iz] = cellOf(x, z);
        if (iz >= 10 && !solid(ix, iz) && !propRadius(cellAt(ix, iz)) && clearOfWalls(new THREE.Vector3(x, 0, z), hero.pos)) {
          e.pos.set(x, 0, z);
          break;
        }
      }
      e.body.scale.setScalar(1);
      burst(e.pos.clone().setY(2.5), [0xb48cff, 0x2a2a1a, COL.paper], 20, 5, 0.25);
      e.st = 'gaze';
      e.tWind = e.t = rand(0.85, 1.2);
      e.flashes = 1;
      e.snap = false;
      e.missed = false;
      SFX.psyRise(e.tWind);
    }
  },
  recover(e, dt, dist, ux, uz, mv, now, p2, seenK) {
    if (animTick && e.exhaust > 0) e.tilt.rotation.z = Math.sin(now * 4) * 0.12;
    if (e.t <= 0) {
      e.st = 'drift';
      e.t = p2 ? rand(0.6, 1.3) : rand(0.8, 1.8);
      e.tilt.rotation.z = 0;
    }
  }
};
TALKERS.Y = {
  make: makeGeezer,
  update: updateGeezer,
  bar: e => (e.exhaust > 0 ? ['Winded', 'orange'] : ['', false]),
  warn: e =>
    e.st === 'gaze'
      ? { c: '#b48cff', k: clamp(1 - e.t / e.tWind, 0, 1), cue: 'Y' + e.flashes }
      : e.st === 'sweep'
        ? { c: HEX.paper, k: clamp(1 - e.t / e.tWind, 0, 1), cue: 'y' + e.lashes }
        : e.st === 'blink'
          ? { c: '#b48cff', k: 0, cue: 'Y' }
          : null,
  // winded, he takes double; hit again and again up close and he snaps into a quick stare (or a lash)
  struck: (e, n) => {
    if (e.exhaust > 0) {
      floatWord('WINDED', e.pos.clone().setY(5.2), HEX.bile, 0.8);
      return n * 2;
    }
    if (e.dazedT > 0) return n;
    e.pressure = (e.pressure || 0) + 1;
    if (e.pressure >= 1.8 && (e.st === 'drift' || e.st === 'recover')) {
      e.pressure = 0;
      e.tilt.rotation.z = 0;
      if (Math.random() < 0.45 && heroDist(e.pos.x, e.pos.z) < 4.6) {
        e.st = 'sweep';
        e.tWind = e.t = rand(0.38, 0.5);
        e.lashes = 1;
        e.side = Math.random() < 0.5 ? 1 : -1;
        floatWord('HMMPH', e.pos.clone().setY(5.2), HEX.paper, 1);
        SFX.growl();
      } else {
        e.st = 'gaze';
        e.tWind = e.t = rand(0.38, 0.6);
        e.flashes = 1;
        e.snap = true;
        e.missed = false;
        SFX.psyRise(e.tWind);
      }
    }
    return n;
  },
  stagger: 0.12,
  noCover: true // the yo-yo reaches him through walls: he is in every mirror
};
