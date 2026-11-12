// The Usher (B): shows you to your seat, then charges at it.
// a cone body in a dark coat, his bow-tied face, brows that drop when he sees you, glowing eyes for the charge, two arms
// Calling the others: hurt to USHER_CALL.hp of his health, a chasing Usher backs off (at back m/s) and shouts for tell s. A blow
// in that time cuts the shout off, and he does not try again. Sleeping Ushers within reach m are fetched (usherFetch): they
// come round Red Cap's far side (off m past him, for flank s) and hold their charge while the caller is in his, so the two
// charge in turn. A fetched Usher ends the floor's quiet (G.announced, 60-flow).
const USHER_CALL = { hp: 0.6, tell: 1, back: 3.2, reach: 26, off: 4, flank: 8 };
const FLANK_AT = new THREE.Vector3();
const sleepingUshers = (pos, reach) =>
  G.enemies
    .filter(u => u.type === 'B' && u.st === 'idle' && !u.dead && !u.dying && !u.caged && u.pos.distanceTo(pos) < reach)
    .sort((a, b) => a.pos.distanceTo(pos) - b.pos.distanceTo(pos));
function usherCall(e) {
  Object.assign(e, { called: true, st: 'call', t: USHER_CALL.tell, callHp: e.hp });
  floatWord('USHERS!', e.pos.clone().setY(3 * (e.k || 1) + 0.4), HEX.tie, 1.2, true);
  playTone({ f: 520, f2: 760, dur: USHER_CALL.tell, type: 'square', gain: 0.07, filt: [1400, 900] });
  if (!G.callHint) {
    G.callHint = true;
    toast('Hit him before he calls.');
  }
}
// a sleeping Usher u is woken and comes: round the far side from the one who called (by)
function usherFetch(u, by) {
  Object.assign(u, { st: 'chase', flank: by, flankT: USHER_CALL.flank });
  u.brows.forEach(b => (b.visible = true));
  G.announced = true;
  SFX.growl();
  floatWord('!!', u.pos.clone().setY(3 * (u.k || 1)), HEX.tie, 0.9 * (u.k || 1));
}
// where a chasing Usher heads: Red Cap, or while he flanks, the spot past Red Cap from the caller (when that is open floor)
function usherGoal(e) {
  const c = e.flank;
  if (!c || e.flankT <= 0 || c.dead || c.dying || heroDist(e.pos.x, e.pos.z) < USHER_CALL.off) return hero.pos;
  const dx = hero.pos.x - c.pos.x,
    dz = hero.pos.z - c.pos.z,
    d = Math.hypot(dx, dz) || 1;
  FLANK_AT.set(hero.pos.x + (dx / d) * USHER_CALL.off, hero.pos.y, hero.pos.z + (dz / d) * USHER_CALL.off);
  return solid(...cellOf(FLANK_AT.x, FLANK_AT.z)) ? hero.pos : FLANK_AT;
}
// he holds his charge while the one who called him is in his own
const usherHolds = e => e.flank && !e.flank.dead && !e.flank.dying && (e.flank.st === 'aim' || e.flank.st === 'charge');
function makeUsher(e, add) {
  Object.assign(e, { name: 'Usher', hp: 4.5, maxHp: 4.5, r: 0.7, hgt: 3, y1: 3, palette: [COL.cap, COL.ink, 0xe8c628, 0x58622e] });
  const bmat = new THREE.MeshBasicMaterial({ map: TEX.t_dark, color: 0xc4c4b4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.62, 2.0, 7, 1), bmat);
  body.position.y = 1.0;
  e.tilt.add(body);
  e.mats.push(bmat);
  const head = add(paper('bowface', 1.05, 0.08));
  head.position.y = 1.4;
  head.position.z = 0.2;
  e.head = head;
  const browM = new THREE.MeshBasicMaterial({ color: COL.ink });
  e.brows = [
    [-0.225, 0.8, -0.42],
    [0.25, 0.81, 0.42]
  ].map(([x, y, rz]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.03), browM);
    b.position.set(x, y, 0.06);
    b.rotation.z = rz;
    b.userData.rz = rz;
    b.visible = false;
    head.add(b);
    return b;
  });
  e.chargeCd = 0;
  e.root.scale.setScalar(1.25);
  e.eyes = [
    [-0.233, 0.725],
    [0.349, 0.76]
  ].map(([x, y]) => {
    const sp = glowSprite(glowRed, { transparent: true });
    sp.position.set(x, y, 0.12);
    sp.scale.setScalar(0.38);
    sp.visible = false;
    head.add(sp);
    return sp;
  });
  const armMat = new THREE.MeshBasicMaterial({ color: 0x14100c });
  e.arms = [-1, 1].map(s => {
    const g = new THREE.Group(),
      a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.1), armMat);
    a.position.y = -0.6;
    g.add(a);
    g.position.set(s * 0.44, 1.75, 0);
    e.tilt.add(g);
    return g;
  });
}
// idle until he sees Red Cap (brows down), then chase; at range he aims (the tell) and charges in a straight line,
// close up he winds up and lunges. A charge into a wall stuns him (BONK). Bigger Ushers (e.k) are slower, longer and harder.
function updateUsher(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  e.chargeCd -= dt;
  const K = e.k || 1,
    cs = 17 / (1 + (K - 1) * 0.3); // a bigger Usher: a longer tell, a slower but longer charge, a longer reach, and he hits harder
  const aim = () => {
    e.st = 'aim';
    e.t = 0.42 + (K - 1) * 0.4;
    SFX.growl();
    playTone({ f: 90 / K, f2: 55 / K, dur: 0.5 * K, type: 'sawtooth', gain: 0.12, filt: [500, 160] });
    floatWord('!!', e.pos.clone().setY(3 * K), HEX.tie, 0.9 * K);
  };
  if (e.rage > 0) e.rage -= dt;
  if (e.flankT > 0) e.flankT -= dt;
  if (!e.called && e.st === 'chase' && e.hp <= e.maxHp * USHER_CALL.hp && e.stagger <= 0 && sleepingUshers(e.pos, USHER_CALL.reach).length)
    usherCall(e);
  if (e.wantCharge) {
    e.wantCharge = false;
    e.stagger = 0;
    e.knock.set(0, 0);
    aim();
    e.t = 0.32;
  }
  const step = USHER_STATES[e.st];
  if (step) step(e, dt, dist, ux, uz, mv, K, cs, aim);
  if (e.st !== 'aim' && e.st !== 'idle' && animTick)
    e.brows.forEach(b => {
      b.rotation.z = b.userData.rz;
      b.position.y = 0.8;
    });
  e.eyes.forEach(s => {
    s.visible = e.st === 'aim' || e.st === 'charge';
    if (s.visible) s.scale.setScalar(0.34 + Math.random() * 0.08);
  });
  e.mom = Math.max(0, (e.mom || 0) - dt);
  if (dist < e.r + hero.r + 0.15 && e.stagger <= 0 && hurtHero(e.st === 'charge' || (K > 1 && (e.st === 'lunge' || e.mom > 0)) ? 2 : 1, e.pos))
    hero.knock.multiplyScalar(K); // a big one's charge and lunge take two hearts
}
// his states, one step each (updateUsher runs the one he is in)
const USHER_STATES = {
  idle(e, dt, dist, ux, uz, mv, K, cs, aim) {
    if (animTick) e.head.rotation.z = Math.sin(performance.now() / 400 + e.seed) * 0.1;
    /* he wakes only when he sees Red Cap: never through a wall, however near */
    if (dist < (e.sight || 20) && clearOfWalls(e.pos, hero.pos)) {
      e.brows.forEach(b => (b.visible = true));
      if (clearOfCover(e.pos, hero.pos, e.r + 0.15)) aim();
      else {
        e.st = 'chase';
        SFX.growl();
      }
      if (!G.usherHint) {
        G.usherHint = true;
        toast('Dodge sideways.');
      }
    }
  },
  chase(e, dt, dist, ux, uz, mv, K, cs, aim) {
    [mv.x, mv.z] = steer(e, usherGoal(e));
    mv.sp = 4.8 - (K - 1) * 1.1;
    if (animTick) e.arms.forEach((a, i) => (a.rotation.z = Math.sin(performance.now() / 160 + i * 3) * 0.3));
    if (dist < 2.8 * K && e.stagger <= 0) {
      e.st = 'wind';
      e.t = 0.3 * Math.sqrt(K);
    } else if (
      dist > 3.2 * K &&
      dist < 14 + (K - 1) * 8 &&
      e.chargeCd <= 0 &&
      e.stagger <= 0 &&
      clearOfCover(e.pos, hero.pos, e.r + 0.15) &&
      !usherHolds(e)
    )
      aim();
  },
  // the shout: backing off, one arm up; a blow cuts it off, else the sleeping Ushers in reach come
  call(e, dt, dist, ux, uz, mv) {
    const cut = e.hp < e.callHp;
    if (cut) floatWord('GULP', e.pos.clone().setY(3 * (e.k || 1)), HEX.paper, 0.9);
    else if (e.t > 0) {
      mv.x = -ux;
      mv.z = -uz;
      mv.sp = USHER_CALL.back;
      if (animTick) shake(e.tilt, 0.04);
      e.arms.forEach((a, i) => (a.rotation.z = i ? 0 : 2.4));
      return;
    } else for (const u of sleepingUshers(e.pos, USHER_CALL.reach)) usherFetch(u, e);
    e.st = 'chase';
    e.tilt.position.set(0, 0, 0);
  },
  aim(e, dt, dist, ux, uz, mv, K, cs, aim) {
    // the tell: he stops, shakes, arms back, brows twitching
    if (animTick) {
      shake(e.tilt, 0.06);
      e.brows.forEach(b => {
        b.rotation.z = b.userData.rz * (1.2 + Math.random() * 0.3);
        b.position.y = 0.78 + Math.random() * 0.03;
      });
    }
    e.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 2.2));
    if (e.t <= 0) {
      e.st = 'charge';
      e.t = e.chargeT0 = Math.min(1.1 * Math.sqrt(K), (dist + 3 * K) / cs);
      {
        const lead = Math.min(dist / cs, 0.6) * 0.7,
          tx = hero.pos.x + hero.vel.x * lead - e.pos.x,
          tz = hero.pos.z + hero.vel.y * lead - e.pos.z,
          tl = Math.hypot(tx, tz) || 1;
        e.lx = tx / tl;
        e.lz = tz / tl;
      }
      e.cx0 = e.pos.x;
      e.cz0 = e.pos.z;
      e.tilt.position.set(0, 0, 0);
      playTone({ f: 140 / K, f2: 60 / K, dur: 0.4 * K, type: 'sawtooth', gain: 0.1 * Math.sqrt(K), filt: [700, 200] });
      if (K > 1) cam.shake = Math.max(cam.shake, 0.08 * K);
    }
  },
  charge(e, dt, dist, ux, uz, mv, K, cs, aim) {
    mv.x = e.lx;
    mv.z = e.lz;
    mv.sp = cs;
    if (animTick) {
      e.tilt.rotation.x = 0.3;
      e.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 1.4));
    }
    if (Math.random() < dt * 30) burst(e.pos.clone().setY(0.2), [COL.smoke, COL.ink], 1, 1.5, 0.12, { g: -2, life: 0.4 });
    e.trailT = (e.trailT || 0) - dt;
    if (e.trailT <= 0) {
      e.trailT = 0.045;
      usherTrail(e);
    }
    const moved = Math.hypot(e.pos.x - e.cx0, e.pos.z - e.cz0);
    e.cx0 = e.pos.x;
    e.cz0 = e.pos.z;
    if (e.t < e.chargeT0 - 0.12 && moved < cs * dt * 0.3) {
      e.st = 'recover';
      e.t = 1.4;
      e.stagger = 1.2;
      e.tilt.rotation.x = 0;
      SFX.boom();
      floatWord('BONK', e.pos.clone().setY(2.8 * K), HEX.paper, 0.8 * K);
      e.chargeCd = 2.5;
      cam.shake = Math.max(cam.shake, 0.15 * K * K);
    } else if (e.t <= 0 || dist < e.r + hero.r + 0.2) {
      e.mom = 0.45;
      if (dist < e.r + hero.r + 0.2 && hurtHero(2, e.pos)) {
        hero.knock.multiplyScalar(K);
        cam.shake = Math.max(cam.shake, 0.2 * K);
      }
      e.st = 'recover';
      e.t = 0.5;
      e.tilt.rotation.x = 0;
      e.chargeCd = rand(1.6, 2.4);
    }
  },
  wind(e, dt, dist, ux, uz, mv, K, cs, aim) {
    if (animTick) shake(e.tilt, 0.07);
    e.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 2.6));
    if (e.t <= 0) {
      e.st = 'lunge';
      e.t = 0.26 * Math.sqrt(K);
      e.lx = ux;
      e.lz = uz;
      SFX.growl();
    }
  },
  lunge(e, dt, dist, ux, uz, mv, K, cs, aim) {
    mv.x = e.lx;
    mv.z = e.lz;
    mv.sp = 8;
    e.arms.forEach(a => (a.rotation.z *= 0.8));
    if (e.t <= 0) {
      e.st = 'recover';
      e.t = 0.55;
      e.tilt.position.set(0, 0, 0);
    }
  },
  recover(e, dt, dist, ux, uz, mv, K, cs, aim) {
    if (e.t <= 0) e.st = 'chase';
  }
};

const skidGeo = share(new THREE.PlaneGeometry(0.95, 0.5)); // the charge's skid marks
// behind the charge: a red-tinted smear of his face hangs in the air, and his feet leave skid marks
function usherTrail(e) {
  const hp = e.head.getWorldPosition(new THREE.Vector3());
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.bowface, transparent: true, opacity: 0.5, depthWrite: false, color: 0xff9a8a }));
  const k = e.root.scale.x / 1.25;
  s.position.set(hp.x, hp.y + 0.66 * k, hp.z);
  s.scale.set(1.44 * k, 1.31 * k, 1);
  scene.add(s);
  trail.push({ s, life: 0.32, max: 0.32, base: 0.5 });
  const sk = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.5, depthWrite: false }));
  sk.rotation.x = -Math.PI / 2;
  sk.rotation.z = Math.atan2(e.lx, e.lz) + Math.PI / 2;
  sk.position.set(e.pos.x + rand(-0.15, 0.15), heightAt(e.pos.x, e.pos.z) + 0.025, e.pos.z + rand(-0.15, 0.15));
  scene.add(sk);
  trail.push({ s: sk, life: 1.8, max: 1.8, base: 0.5 });
}
// floor one's Ushers: the first one spots Red Cap from the far end of the row (and drops no heart); some are bigger (k: size,
// which scales his body, health, reach, charge and the force of his blows)
function tuneUshers(F) {
  if (F.firstUsher) {
    const u = G.enemies.find(e => e.type === 'B' && cellOf(e.pos.x, e.pos.z).join() === F.firstUsher.join());
    if (u) {
      u.sight = 22;
      u.first = true;
    }
  }
  for (const [x, z, k, hpSet] of F.usherSizes || []) {
    const u = G.enemies.find(e => e.type === 'B' && cellOf(e.pos.x, e.pos.z).join() === x + ',' + z);
    if (u) {
      const hp = hpSet || Math.round(4.5 + (k - 1) * 5.5);
      Object.assign(u, { k, hp, maxHp: hp, r: 0.7 * k, hgt: 3 * k, y1: 3 * k });
      u.root.scale.setScalar(1.25 * k);
    }
  }
}
TALKERS.B = {
  make: makeUsher,
  update: updateUsher,
  warn: e =>
    e.st === 'aim'
      ? { c: HEX.tie, k: clamp(1 - e.t / (0.42 + ((e.k || 1) - 1) * 0.4), 0, 1), cue: 'B' }
      : e.st === 'wind'
        ? { c: HEX.tie, k: 1, cue: 'b' }
        : null,
  // the biggest Usher will not stand being yo-yoed in the face: the 4th hit in a row and he charges
  struck: (e, n, weapon) => {
    if (weapon && (e.k || 1) >= 1.5 && e.st !== 'charge' && e.st !== 'aim') {
      const now = playT;
      e.spam = now - (e.spamAt || -9) < 2.5 ? (e.spam || 0) + 1 : 1;
      e.spamAt = now;
      if (e.spam >= 4) {
        e.spam = 0;
        e.rage = 1.4;
        e.wantCharge = true;
        floatWord('ENOUGH!', e.pos.clone().setY(3 * e.k + 0.4), HEX.tie, 1.3, true);
      }
    }
    return n;
  },
  // the biggest Usher leaves a heart when Red Cap is hurt, else pebbles
  drops: e => {
    if ((e.k || 1) < 1.5) dropsDefault(e);
    else if (hero.hp < hero.maxHp) dropHeart(e.pos.x, e.pos.z);
    else giveAmmo(Math.random() < 0.5 ? 2 : 3, e.pos);
  }
};
