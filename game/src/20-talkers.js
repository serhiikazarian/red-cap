// Talkers (the enemies): what they all share. Each type lives in its own file (22-31) and registers itself:
//   TALKERS[letter] = { make(e, add, x, z, part, type), update(e, dt, dist, ux, uz, mv), and optionally
//     dying(e, dt): its own death (default: it topples), dazed(e): what else happens while it reels,
//     bar(e): [status text, lit, big word] for the boss bar (bossBar), warn(e): an attack warning (07-hud) }
// update decides the move (mv: direction x, z and speed sp); returning STOP skips the shared movement and collision.
// damage and kill hold the rules of being hit and torn, special cases included, in one place.
const TALKERS = {},
  STOP = 'stop',
  MOVE = { x: 0, z: 0, sp: 0 };
function shake(m, amt) {
  m.position.x = rand(-amt, amt);
  m.position.z = rand(-amt, amt);
}
// paper figures turn to face the camera, with a slight sway
function faceCam(e, dt) {
  const target = Math.atan2(camera.position.x - e.pos.x, camera.position.z - e.pos.z);
  e.yaw = e.yaw ?? target;
  e.yaw += angDiff(e.yaw, target) * (1 - Math.exp(-6 * dt));
  if (animTick) e.face.rotation.y = e.yaw + Math.sin(performance.now() / 700 + e.seed) * 0.1;
}
// a talker of the given map letter at (x, z): the shared parts (root > face > tilt), then its own (TALKERS[type].make)
function makeEnemy(type, x, z, part) {
  const root = new THREE.Group(),
    face = new THREE.Group(),
    tilt = new THREE.Group();
  root.add(face);
  face.add(tilt);
  const e = {
    type,
    root,
    face,
    tilt,
    pos: new THREE.Vector3(x, 0, z),
    r: 0.5,
    hp: 3,
    maxHp: 3,
    stagger: 0,
    knock: new THREE.Vector2(),
    t: rand(0, 2),
    st: 'idle',
    seed: rand(0, 100),
    mats: [],
    palette: [0xece6da, 0x0d0b0a],
    y0: 0,
    y1: 2,
    hgt: 2
  };
  const add = m => {
    tilt.add(m);
    if (m.userData.mat) e.mats.push(m.userData.mat);
    return m;
  };
  const T = TALKERS[type];
  if (T) T.make(e, add, x, z, part, type);
  rimify(e);
  e.shadow = groundShadow(root, e.r * 1.2, e.r * 0.8, 0.45);
  root.position.copy(e.pos);
  G.group.add(root);
  G.enemies.push(e);
  return e;
}
// a bright rim just behind every paper cut-out, so talkers stand off the painted walls
function rimify(e) {
  const col = e.type === 'G' ? 0xb46cff : e.type === 'Z' ? 0xffb35a : 0xfff3d6,
    list = [];
  e.tilt.traverse(o => {
    if (o.isMesh && o.geometry.type === 'ExtrudeGeometry' && !o.userData.noRim) list.push(o);
  });
  e.rims = list.map(m => {
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const w = bb.max.x - bb.min.x,
      h = bb.max.y - bb.min.y,
      d = bb.max.z - bb.min.z,
      t = (0.1 + h * 0.025) * (e.type === 'M' ? 0.45 : 1);
    const sx = (w + 2 * t) / w,
      sy = (h + 2 * t) / h,
      cx = (bb.min.x + bb.max.x) / 2,
      cy = (bb.min.y + bb.max.y) / 2;
    const mat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: e.type === 'M' ? 0.7 : e.type === 'G' ? 0.55 : 0.95,
      depthWrite: false,
      fog: false
    });
    const r = new THREE.Mesh(g, mat);
    r.scale.set(sx, sy, 0.5);
    r.position.set(cx * (1 - sx), cy * (1 - sy), -d * 0.5 - 0.01);
    m.add(r);
    return mat;
  });
  if (e.fade) e.fade.push(...e.rims);
}
// every frame: caged, dying and reeling talkers are handled here; otherwise its own update decides the move, then the shared
// part moves it (rage, stagger, knockback), keeps it off the others, walls, clutter and cages, and sets it on the ground
function updEnemy(e, dt) {
  if (e.dead) return;
  if (e.caged) {
    faceCam(e, dt);
    const c = (G.cages || []).find(q => q.e === e);
    if (c && animTick) {
      shake(e.tilt, c.rattle > 0 ? 0.12 : 0.02);
      if (c.pole) e.tilt.position.z = Math.abs(e.tilt.position.z) * 0.5;
    }
    if (e.fly != null) e.tilt.position.y = e.fly;
    e.gy = heightAt(e.pos.x, e.pos.z);
    e.pos.y = e.gy;
    e.root.position.copy(e.pos);
    return;
  }
  const T = TALKERS[e.type];
  if (e.dying) {
    ((T && T.dying) || topple)(e, dt);
    return;
  }
  e.flash = Math.max(0, (e.flash || 0) - dt);
  for (const m of e.mats) m.color.setHex(e.flash > 0 ? 0xff5050 : 0xffffff);
  if (e.dazedT > 0) {
    // reeling (a trap's bite, a totem's shout): no attacks, wobbling on the spot, waiting for the finishing blow
    e.dazedT -= dt;
    faceCam(e, dt);
    if (animTick) {
      e.tilt.rotation.z = Math.sin(performance.now() / 110) * 0.16;
      shake(e.tilt, 0.05);
    }
    if (Math.random() < dt * 3) floatWord(pick(['*', '@', '?']), e.pos.clone().setY(hitHeight(e) + 1.2 + rand(0, 0.6)), '#f0cf2e', 0.5);
    if (e.waves && e.waves.length) {
      e.waves.forEach(w => G.group.remove(w.m));
      e.waves.length = 0;
    }
    if (T && T.dazed) T.dazed(e);
    if (e.fade) {
      e.hidden = false;
      e.alpha = Math.min(1, (e.alpha || 0) + dt * 5);
      e.fade.forEach(m => (m.opacity = e.alpha));
      e.shadow.visible = true;
    }
    if (e.fly != null) e.tilt.position.y = e.fly;
    if (e.dazedT <= 0) {
      e.tilt.rotation.z = 0;
      e.tilt.position.set(0, e.fly != null ? e.fly : 0, 0);
    }
    e.root.position.copy(e.pos);
    return;
  }
  e.stagger = Math.max(0, e.stagger - dt);
  const dx = hero.pos.x - e.pos.x,
    dz = hero.pos.z - e.pos.z,
    dist = Math.hypot(dx, dz) || 0.001,
    ux = dx / dist,
    uz = dz / dist;
  const mv = MOVE;
  mv.x = mv.z = mv.sp = 0;
  e.t -= dt;
  if (T && T.update(e, dt, dist, ux, uz, mv) === STOP) return;
  if (e.enraged) {
    mv.sp *= 1.35;
    e.enragedT = (e.enragedT || 6) - dt;
    if (e.enragedT <= 0) e.enraged = false;
  }
  if (e.stagger > 0) mv.sp *= 0.15;
  e.pos.x += (mv.x * mv.sp + e.knock.x) * dt;
  e.pos.z += (mv.z * mv.sp + e.knock.y) * dt;
  e.knock.multiplyScalar(Math.exp(-8 * dt));
  if (!e.still) {
    for (const o of G.enemies) {
      if (o === e || o.dead || o.still) continue;
      const ox = e.pos.x - o.pos.x,
        oz = e.pos.z - o.pos.z,
        od = Math.hypot(ox, oz),
        rr = e.r + o.r;
      if (od < rr && od > 1e-3) {
        e.pos.x += (ox / od) * (rr - od) * 0.5;
        e.pos.z += (oz / od) * (rr - od) * 0.5;
      }
    }
    const ey = e.fly != null ? undefined : heightAt(e.pos.x, e.pos.z);
    collide(e.pos, e.r, ey, e);
    collide(e.pos, e.r, ey, e);
    if (e.fly == null)
      for (const c of G.clutter || []) {
        const ox = e.pos.x - c.x,
          oz = e.pos.z - c.z,
          od = Math.hypot(ox, oz);
        if (od < c.r + e.r && od > 1e-3) {
          e.pos.x = c.x + (ox / od) * (c.r + e.r);
          e.pos.z = c.z + (oz / od) * (c.r + e.r);
        }
      }
    for (const c of G.cages || [])
      if (!c.broken && c.e !== e) {
        const ox = e.pos.x - c.x,
          oz = e.pos.z - c.z,
          od = Math.hypot(ox, oz);
        if (od < 1.3 + e.r && od > 1e-3) {
          e.pos.x = c.x + (ox / od) * (1.3 + e.r);
          e.pos.z = c.z + (oz / od) * (1.3 + e.r);
        }
      }
  }
  e.gy = heightAt(e.pos.x, e.pos.z);
  e.pos.y = e.gy;
  e.root.position.copy(e.pos);
  if (animTick) {
    if (e.stagger > 0 && e.st !== 'wind') shake(e.tilt, 0.05);
    else if (!['wind', 'shout', 'inflate', 'stun', 'laugh'].includes(e.st)) {
      e.tilt.position.x = e.tilt.position.z = 0;
    }
  }
}
// the default death: the figure topples backwards and sinks (a Jester's mask flies off); then it is gone
function topple(e, dt) {
  e.dying -= dt;
  const k = 1 - e.dying / 1.1;
  if (animTick) {
    e.tilt.rotation.x = (-Math.min(k * 2.2, 1) * Math.PI) / 2;
    e.tilt.position.y = (e.fly != null ? e.fly * (1 - Math.min(k * 1.5, 1)) : 0) - Math.max(0, k - 0.5) * 2.5;
  }
  if (e.maskG && animTick) {
    e.maskG.position.y += 0.25;
    e.maskG.rotation.z += 0.5;
  }
  if (e.dying <= 0) gone(e);
}
function gone(e) {
  e.dead = true;
  discard(e.root);
  checkClear();
}
// the height a talker is hit and aimed at
function hitHeight(e) {
  const c = e.fly != null ? e.fly : e.hgt * 0.55;
  return c + (e.gy || 0);
}
// a blow of n to e from direction (dx, dz). force: past shields and masks; weapon: Red Cap's own hand (yo-yo or pebble)
function damage(e, n, dx, dz, force, weapon) {
  if (e.caged) {
    const c = (G.cages || []).find(q => q.e === e);
    if (c) breakCage(c, true);
    return;
  }
  if (!force && !(e.dazedT > 0) && e.type === 'R' && e.ghosts.some(g => g.wait <= 0)) {
    // the ghosts shield him while any is left
    SFX.tink();
    e.shieldFlash = 0.3;
    floatWord('SHIELDED', e.pos.clone().setY(3.4 + rand(0, 0.3)), '#d8d4cc', 0.8);
    return;
  }
  if (e.type === 'R' && e.dazedT > 0 && weapon) {
    // reeling: two blows finish him if all three ghosts were round him when he reeled, else one
    e.reelHits = (e.reelHits ?? 1) - 1;
    n = e.reelHits <= 0 ? e.hp + 1 : Math.min(n, Math.max(0, e.hp - 0.05));
  }
  if (weapon && e.boss) e.engaged = true;
  if (weapon && e.type === 'B' && (e.k || 1) >= 1.5 && e.st !== 'charge' && e.st !== 'aim') {
    // the biggest Usher will not stand being yo-yoed in the face: the 4th hit in a row and he charges
    const now = performance.now() / 1000;
    e.spam = now - (e.spamAt || -9) < 2.5 ? (e.spam || 0) + 1 : 1;
    e.spamAt = now;
    if (e.spam >= 4) {
      e.spam = 0;
      e.rage = 1.4;
      e.wantCharge = true;
      floatWord('ENOUGH!', e.pos.clone().setY(3 * e.k + 0.4), '#d8212a', 1.3, true);
    }
  }
  if (e.waiting || (e.type === 'L' && e.part === 'whole')) {
    SFX.tink();
    floatWord('NOT YET', e.pos.clone().setY((e.fly || 2) + 1.5), '#ece6da', 0.8);
    return;
  }
  if (e.type === 'L' && e.daze > 0) n *= 2;
  if (e.type === 'Y' && e.exhaust > 0) {
    n *= 2;
    floatWord('WINDED', e.pos.clone().setY(5.2), '#f0cf2e', 0.8);
  } else if (e.type === 'Y' && !(e.dazedT > 0)) {
    // hit him again and again up close and he snaps into a quick stare
    e.pressure = (e.pressure || 0) + 1;
    if (e.pressure >= 1.8 && (e.st === 'drift' || e.st === 'recover')) {
      e.pressure = 0;
      e.tilt.rotation.z = 0;
      if (Math.random() < 0.45 && Math.hypot(hero.pos.x - e.pos.x, hero.pos.z - e.pos.z) < 4.6) {
        e.st = 'sweep';
        e.tWind = e.t = rand(0.38, 0.5);
        e.lashes = 1;
        e.side = Math.random() < 0.5 ? 1 : -1;
        floatWord('HMMPH', e.pos.clone().setY(5.2), '#ece6da', 1);
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
  }
  if (!force && !(e.dazedT > 0) && e.type === 'M' && e.masked) {
    // the mask takes the hit
    SFX.tink();
    burst(e.pos.clone().setY(2.6), [0xece6da, 0x9a9e98, 0xf0cf2e], 8, 4, 0.14);
    floatWord(pick(['HA!', 'TINK', 'NOPE', 'HA HA']), e.pos.clone().setY(4.1 + rand(0, 0.4)), '#ece6da', 0.9);
    return;
  }
  if (e.type === 'M' && !weapon && e.hp - n <= 0) {
    // a totem's shout or a fallen face cannot take the last of him: he reels and waits for your hand
    e.hp = Math.min(e.hp, 0.5);
    e.dazedT = 6;
    e.flash = 0.3;
    if (e.mBoom) {
      G.group.remove(e.mBoom.m);
      e.mBoom = null;
      e.maskG.visible = true;
    }
    setMasked(e, false);
    e.st = 'stun';
    e.t = 0.01;
    e.maskG.position.set(e.maskHome.x - 1.1, e.maskHome.y - 0.9, 0.5);
    e.maskG.rotation.z = 1.1;
    floatWord('REELIN’', e.pos.clone().setY(4.6), '#f0cf2e', 1.6, true);
    SFX.boom();
    SFX.tink();
    cam.shake = Math.max(cam.shake, 0.45);
    slowT = 0.5;
    sTone({ f: 70, f2: 40, dur: 1.2, type: 'sawtooth', gain: 0.16, filt: [500, 90] });
    burst(e.pos.clone().setY(3), [0x9a9e98, 0xece6da, 0xf0cf2e], 30, 7, 0.26);
    return;
  }
  e.hp -= n;
  e.flash = 0.14;
  if (e.type === 'S') giveAmmo(Math.random() < 0.5 ? 2 : 3, e.pos); // every hit on the Smoker shakes pebbles out of him
  if (e.type === 'q' && e.hp > 0 && Math.random() < 0.08) giveAmmo(1, e.pos);
  e.stagger = e.rage > 0 ? 0 : e.type === 'M' || e.type === 'U' || e.type === 'Y' ? 0.12 : 0.38;
  if (!e.still && !(e.rage > 0)) e.knock.set(dx * (e.type === 'M' ? 2 : 7), dz * (e.type === 'M' ? 2 : 7));
  if (e.type !== 'q' || e.hp > 0) SFX.hit(weapon ? mixPitch() : 1); // a Shade's last blow is its pop alone (kill)
  burst(e.pos.clone().setY(hitHeight(e)), e.palette, 12, 5, 0.2);
  if (Math.random() < 0.3)
    floatWord(pick(['SH#T!', 'F#CK!', 'SHUT IT', 'STFU', 'F#CK OFF']), e.pos.clone().setY(hitHeight(e) + 1.4 + rand(0, 0.4)), '#d8212a', 0.9);
  if (e.type === 'U' && e.st === 'pause') e.t = Math.min(e.t, 0.5);
  if (e.type === 'R' && e.st === 'spray') {
    e.st = 'walk';
    e.t = 1.4;
    sprayStop();
  }
  if (e.hp <= 0) kill(e);
}
// torn: what each one leaves behind (hearts by the floor's odds, pebbles), and what it sets off (the gate, the finale)
function kill(e) {
  if (e.type === 'W' && e.lives > 1) {
    // not yet: he slips away in his smoke and comes back later
    e.lives--;
    e.hp = e.maxHp;
    e.away = true;
    e.hidden = true;
    e.t = 12;
    e.root.visible = false;
    e.st = 'hover';
    for (let k = 0; k < 14; k++)
      smokePuff(e.pos.clone().add(new THREE.Vector3(rand(-1.6, 1.6), (e.fly || 2) + rand(-1, 1), rand(-1.6, 1.6))), rand(2.4, 3.6), 4.5, 0.1);
    // the first time the game says it; the second time he does, and his line wins over the curse from the blow that sent him off
    if (e.lives === 2) toast('He went up in smoke. Beware');
    else floatWord("I'LL TAKE A BREAK", e.pos.clone().setY(3.8), '#ece6da', 1.1, true);
    giveAmmo(2, e.pos);
    SFX.tear();
    return;
  }
  if (e.ghosts)
    e.ghosts.forEach(g => {
      burst(g.m.position, [0xd8d4cc, 0x6c6a66], 6, 3, 0.12);
      G.group.remove(g.m);
    });
  if (e.rainRing) G.group.remove(e.rainRing);
  if (e.fireRing) G.group.remove(e.fireRing);
  e.dying = 1.1;
  stats.kills++;
  if (e.type === 'q') SFX.shadePop();
  else SFX.tear();
  sprayStop();
  if (e.type === 'G') cheshire(e);
  burst(e.pos.clone().setY(hitHeight(e)), e.palette, 34, 7, 0.28);
  if (e.type !== 'M')
    floatWord(e.type === 'q' ? 'POPPED' : e.type === 'G' ? 'BUSTED' : 'TORN', e.pos.clone().setY(hitHeight(e) + 1.8), '#ece6da', 1.1);
  if (e.type === 'W') {
    dropHeart(e.pos.x, e.pos.z);
    giveAmmo(2, e.pos);
  } else if (e.type === 'Z') {
    e.hot.r = 0; // the fire goes out with him
    dropHeart(e.pos.x, e.pos.z);
  } else if (e.boss && e.type !== 'M' && e.type !== 'L' && e.type !== 'U') dropHeart(e.pos.x, e.pos.z, true);
  else if (e.type === 'S' && hero.hp <= 2) dropHeart(e.pos.x, e.pos.z);
  else if (e.type === 'B' && (e.k || 1) >= 1.5) {
    if (hero.hp < hero.maxHp) dropHeart(e.pos.x, e.pos.z);
    else giveAmmo(Math.random() < 0.5 ? 2 : 3, e.pos);
  } else if (
    !e.boss &&
    !e.first &&
    Math.random() < (G.F.dropOdds ? (G.F.dropOdds[e.type] ?? 0) : e.type === 'q' ? 0.04 : 0.22) * (hero.hp >= WELL.hp ? WELL.drop : 1)
  )
    dropHeart(e.pos.x, e.pos.z);
  if (e.type === 'G' || e.type === 'S' || e.type === 'W') giveAmmo(e.type === 'W' ? 2 : e.type === 'S' ? 2 : 1, e.pos);
  if (e.type === 'q') giveAmmo(Math.max(e.stolen || 0, Math.random() < 0.4 ? 1 : 0), e.pos);
  bystandersReact(e.pos);
  if (e.type === 'U') {
    e.waves.forEach(w => G.group.remove(w.m));
    e.waves.length = 0;
    openGate();
  }
  if (e.type === 'M') {
    if (e.mBoom) {
      G.group.remove(e.mBoom.m);
      e.mBoom = null;
    }
    finale(e);
  }
}
// talkers left (harmless Shades do not keep a floor from being clear)
function aliveCount() {
  return G.enemies.filter(e => !e.dead && !e.dying && e.type !== 'q').length;
}
