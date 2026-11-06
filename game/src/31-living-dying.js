// Livin' / Dyin' (L): floor three's hidden boss. Hit both plaques and the painting behind the start wakes; the head comes apart
// into pieces you fight in turn (the hair, the two eyes, the jaw, the skull). The reward: the Laughin’ Jaw, which puts the
// Jester off his throw and heckles him into laughing. The plaques, the painting and the jaw: 49-secret.js.
const tmpS1 = new THREE.Vector3(),
  tmpS2 = new THREE.Vector3();

// each piece: its painting, height, flying height, health, radius and name; the jaw and the hair are models, the rest paper
const LIVING_DYING_PIECES = {
  whole: ['ld_whole', 4.2, 2.4, 99, 2, ''],
  hair: ['ld_hair', 2.2, 3.1, 6, 1.7, ' — the Hair'],
  eyeL: ['ld_eyeL', 1.15, 2.4, 3, 0.65, ' — an Eye'],
  eyeR: ['ld_eyeR', 1.15, 2.4, 3, 0.65, ' — an Eye'],
  jaw: ['jaw', 2, 0.95, 7, 1.3, ' — the Jaw'],
  skull: ['ld_skull', 3.1, 2.3, 9, 1.6, ' — the Skull']
};
function makeLivingDying(e, add, x, z, part) {
  const [art, h, fly, hp, r, name] = LIVING_DYING_PIECES[part];
  Object.assign(e, {
    name: 'Livin’ / Dyin’' + name,
    part,
    hp,
    maxHp: hp,
    r,
    fly,
    partH: h,
    boss: true,
    palette: [0xd8642a, 0x3a4a1c, COL.tie, COL.bile, 0x3a5ad8],
    daze: 0
  });
  if (part === 'jaw') {
    const j = jawModel(h);
    j.g.position.y = -h / 2;
    e.tilt.add(j.g);
    e.mats.push(j.up.userData.mat, j.lo.userData.mat);
    e.body = j.g;
    e.jaw = j;
  } else if (part === 'hair') {
    const hm = hairModel();
    e.tilt.add(hm.g);
    e.mats.push(...hm.mats);
    e.body = hm.g;
    e.hair = hm;
  } else {
    e.body = add(paper(art, h, 0.14));
    e.body.position.y = -h / 2;
  }
  e.t = rand(1, 2);
}
// a piece waiting its turn circles the arena out of reach; the others fight in their own way (LIVING_DYING_PARTS)
function updateLivingDying(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  const now = playT;
  e.daze = Math.max(0, e.daze - dt);
  e.y0 = e.fly - e.partH / 2;
  e.y1 = e.fly + e.partH / 2;
  if (e.waiting) {
    const c = G.ld.center,
      a = now * 0.35 + e.seed;
    e.pos.x = lerp(e.pos.x, c.x + Math.cos(a) * 5.5, ease(2, dt));
    e.pos.z = lerp(e.pos.z, c.z + Math.sin(a) * 5.5, ease(2, dt));
    e.fly = lerp(e.fly, 4.6 + Math.sin(now + e.seed) * 0.3, ease(2, dt));
    e.tilt.position.y = e.fly;
    e.root.position.copy(e.pos);
    return STOP;
  }
  const part = LIVING_DYING_PARTS[e.part];
  if (part) part(e, dt, dist, ux, uz, mv, now);
  e.tilt.position.y = e.fly;
}
const LIVING_DYING_PARTS = {
  whole: livingDyingWhole,
  hair: livingDyingHair,
  eyeL: livingDyingEye,
  eyeR: livingDyingEye,
  jaw: livingDyingJaw,
  skull: livingDyingSkull
};

// the whole head, shaking: it comes apart when its time is up
function livingDyingWhole(e, dt, dist, ux, uz, mv, now) {
  if (animTick) {
    shake(e.tilt, 0.06);
    e.body.scale.setScalar(1 + Math.sin(now * 9) * 0.03);
  }
  e.fly = 2.4 + Math.sin(now * 2) * 0.2;
  if (e.t <= 0) livingDyingSplit(e);
}

// the hair sways like a living wig, circles Red Cap, lashes all round when he crowds it (HSSS), snares him from afar (a strand
// that reels him in until a dodge tears it) or swoops at him and ends up tangled
function livingDyingHair(e, dt, dist, ux, uz, mv, now) {
  livingDyingHairSway(e, dt, now);
  const step = HAIR_STATES[e.st === 'idle' ? 'circle' : e.st];
  if (step) step(e, dist, ux, uz, mv, now);
}
// each move has a wind-up (a shiver) and then the move itself; e.t counts down each
const HAIR_STATES = {
  // round Red Cap, keeping 5 to 8 m off, until it picks a move
  circle(e, dist, ux, uz, mv) {
    e.st = 'circle';
    const side = Math.sin(e.seed) > 0 ? 1 : -1,
      want = dist > 8 ? 0.7 : dist < 5 ? -0.5 : 0;
    mv.x = -uz * side + ux * want;
    mv.z = ux * side + uz * want;
    mv.sp = 4.4;
    e.fly = lerp(e.fly, 2.6, 0.05);
    if (e.t <= 0) livingDyingHairPick(e, dist, ux, uz);
  },
  lashWind(e) {
    if (animTick) shake(e.tilt, 0.07);
    if (e.t > 0) return;
    e.st = 'lash';
    e.t = 0.45;
    e.lashHit = false;
    SFX.dodge();
    playNoise({ dur: 0.4, f: 1500, f2: 400, q: 0.8, gain: 0.25 });
  },
  lash: livingDyingHairLash,
  snareWind(e) {
    if (animTick) shake(e.tilt, 0.05);
    if (e.t > 0) return;
    e.st = 'snare';
    e.t = 0.35;
    livingDyingHairSnare(e);
  },
  snare(e) {
    if (e.t > 0) return;
    e.st = 'circle';
    e.t = hero.snared > 0 ? rand(0.9, 1.2) : rand(2, 3); // reeled in, he gets the lash
  },
  swoopWind(e) {
    if (animTick) shake(e.tilt, 0.08);
    e.fly = lerp(e.fly, 4, 0.08);
    if (e.t > 0) return;
    e.st = 'swoop';
    e.t = 0.8;
  },
  swoop(e, dist, ux, uz, mv) {
    mv.x = e.sx;
    mv.z = e.sz;
    mv.sp = 15;
    e.fly = lerp(e.fly, 1.2, 0.2);
    if (dist < e.r + hero.r) hurtHero(1, e.pos);
    if (e.t > 0) return;
    e.st = 'tangled';
    e.t = 1.6;
    e.daze = 1.6;
    floatWord('TANGLED', e.pos.clone().setY(3), HEX.bile, 0.9);
  },
  tangled(e, dist, ux, uz, mv, now) {
    if (animTick) e.tilt.rotation.z = Math.sin(now * 12) * 0.15;
    if (e.t > 0) return;
    e.st = 'circle';
    e.t = rand(2.2, 3.2);
    e.tilt.rotation.z = 0;
  }
};
// every strand sways; they reach out for the lash, pull in and bristle as it winds up; the wig spins
function livingDyingHairSway(e, dt, now) {
  const H = e.hair;
  H.reach = lerp(H.reach, e.st === 'lash' ? 2.4 : e.st === 'lashWind' ? 0.75 : 1, ease(e.st === 'lash' ? 22 : 6, dt));
  H.bristle = lerp(H.bristle, e.st === 'lashWind' || e.st === 'snareWind' ? 1 : 0, ease(8, dt));
  for (const c of H.clumps) {
    c.g.rotation.z = Math.sin(now * 2.2 + c.ph) * 0.25 + H.bristle * 0.7;
    c.g.rotation.x = Math.sin(now * 1.7 + c.ph * 2) * 0.2;
    c.g.scale.set(H.reach, 1 + H.bristle * 0.3, 1);
  }
  H.g.rotation.y += dt * (e.st === 'lash' ? 9 : 0.6);
}
// circling, its wait over: lash when Red Cap is close, else snare him from afar (or swoop)
function livingDyingHairPick(e, dist, ux, uz) {
  if (dist < 5.5) {
    e.st = 'lashWind';
    e.t = 0.65;
    playNoise({ dur: 0.6, f: 6000, f2: 2500, q: 1, gain: 0.14 });
    floatWord('HSSS', e.pos.clone().setY(4.2), '#d8642a', 0.9); // every strand stands on end
  } else if (dist < 15 && Math.random() < 0.55) {
    e.st = 'snareWind';
    e.t = 0.6;
    e.sx = ux;
    e.sz = uz;
    playNoise({ dur: 0.5, f: 5000, f2: 9000, q: 4, gain: 0.1 });
  } else {
    e.st = 'swoopWind';
    e.t = 0.8;
    e.sx = ux;
    e.sz = uz;
    floatWord('WHOOSH', e.pos.clone().setY(4.6), '#d8642a', 1);
    SFX.growl();
  }
}
// a full spin with every strand thrown out: dodge it or back off
function livingDyingHairLash(e, dist, ux, uz) {
  if (!e.lashHit && dist < 4.6) {
    e.lashHit = true;
    if (hurtHero(1, e.pos)) hero.knock.set(ux * 12, uz * 12);
  }
  if (animTick)
    for (let k = 0; k < 3; k++) {
      const a = rand(0, TAU),
        r = rand(1.5, 4.2);
      burst(e.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, e.fly - 0.6, Math.sin(a) * r)), [0xc8642a, 0xd8823a], 1, 2, 0.2, {
        g: 2,
        life: 0.4
      });
    }
  if (e.t <= 0) {
    e.st = 'circle';
    e.t = rand(1.8, 2.8);
  }
}
// one long strand whips out along the line; if it finds you, it wraps your legs and starts reeling you in
function livingDyingHairSnare(e) {
  const ex = hero.pos.x - e.pos.x,
    ez = hero.pos.z - e.pos.z,
    along = ex * e.sx + ez * e.sz,
    off = Math.abs(ex * e.sz - ez * e.sx);
  for (let k = 0; k < 14; k++)
    burst(new THREE.Vector3(e.pos.x + e.sx * k * 1.1, 1, e.pos.z + e.sz * k * 1.1), [0xc8642a, 0x6a3418], 1, 0.5, 0.14, { g: 0, life: 0.5 });
  if (along > 0 && along < 16 && off < 0.9 && hero.dodgeT <= 0 && hero.dodgeIF <= 0) {
    hero.snared = 1.6;
    hero.snareFrom = e;
    floatWord('SNAGGED', hero.pos.clone().setY(hero.pos.y + 2.4), '#d8642a', 0.9, true);
    playTone({ f: 300, f2: 120, dur: 0.3, type: 'sawtooth', gain: 0.08 });
  }
}

// the eyes strafe round Red Cap from opposite sides and fire bursts of red orbs (SEE YOU)
function livingDyingEye(e, dt, dist, ux, uz, mv, now) {
  const side = e.part === 'eyeL' ? 1 : -1,
    want = dist > 9 ? 1 : dist < 6 ? -1 : 0;
  mv.x = ux * want - uz * side * 0.9;
  mv.z = uz * want + ux * side * 0.9;
  mv.sp = 3.4;
  e.fly = 2.4 + Math.sin(now * 2 + e.seed) * 0.4;
  if (e.t <= 0 && !hero.inSmoke && clearOfWalls(e.pos, hero.pos)) {
    e.st = 'fire';
    e.t = 2.4;
    e.burst = 3;
    e.bt = 0;
    floatWord('SEE YOU', e.pos.clone().setY(3.4), HEX.tie, 0.7);
  }
  if (e.st === 'fire') {
    e.bt -= dt;
    if (e.burst > 0 && e.bt <= 0) {
      e.burst--;
      e.bt = 0.22;
      const from = e.pos.clone().setY((e.gy || 0) + e.fly),
        to = hero.pos.clone().setY(hero.pos.y + 1.2);
      redOrb(from, to.sub(from).normalize());
    }
    if (e.burst <= 0) e.st = 'idle';
  }
  if (dist < e.r + hero.r + 0.1) hurtHero(1, e.pos);
}

// the jaw hops after Red Cap laughing, chomps up close, and from afar charges (KILL); into a wall it is dazed
function livingDyingJaw(e, dt, dist, ux, uz, mv, now) {
  e.fly = 0.95 + Math.abs(Math.sin(now * 5)) * 0.55;
  const step = JAW_STATES[e.st === 'idle' ? 'hop' : e.st];
  if (step) step(e, dt, dist, ux, uz, mv, now);
  // the mouth: laughing (and now and then a HA) while it hops or reels, wide open for the charge
  if (e.st === 'hop' || e.st === 'dazed') {
    e.jaw.set(Math.abs(Math.sin(now * 14)) * 0.55);
    if (Math.random() < dt * 0.8) floatWord(pick(['HA', 'HA HA', 'HAHAHA']), e.pos.clone().setY((e.gy || 0) + e.fly + 1.6), HEX.bile, 0.8);
  } else if (e.st === 'chargeWind' || e.st === 'charge') e.jaw.set(0.9 + Math.sin(now * 30) * 0.1);
}
const JAW_CHARGE = 13; // m/s
const JAW_STATES = {
  hop(e, dt, dist, ux, uz, mv) {
    e.st = 'hop';
    [mv.x, mv.z] = steer(e);
    mv.sp = 3.2;
    if (dist < 3 && e.stagger <= 0) {
      e.st = 'chompWind';
      e.t = 0.5;
      floatWord('CHOMP', e.pos.clone().setY(2.6), HEX.paper, 0.9);
    } else if (e.t <= 0 && dist > 5) {
      e.st = 'chargeWind';
      e.t = 0.75;
      SFX.growl();
      floatWord('KILL', e.pos.clone().setY(2.8), HEX.tie, 1.2);
    }
  },
  chompWind(e, dt, dist) {
    e.jaw.set(Math.min(1, (0.5 - e.t) / 0.3));
    if (e.t > 0) return;
    e.jaw.set(0);
    SFX.hit();
    if (dist < 2.9) hurtHero(2, e.pos);
    e.st = 'hop';
    e.t = rand(1.5, 2.5);
  },
  chargeWind(e, dt, dist, ux, uz) {
    if (animTick) shake(e.tilt, 0.1);
    if (e.t > 0) return;
    e.st = 'charge';
    e.t = 0.85;
    e.cx = ux;
    e.cz = uz;
  },
  // straight on along the line it set off on; barely moving means a wall: dazed
  charge(e, dt, dist) {
    const before = e.pos.clone();
    e.pos.x += e.cx * JAW_CHARGE * dt;
    e.pos.z += e.cz * JAW_CHARGE * dt;
    collide(e.pos, e.r);
    if (dist < e.r + hero.r + 0.2) hurtHero(2, e.pos);
    if (e.pos.distanceTo(before) < JAW_CHARGE * dt * 0.25) {
      e.st = 'dazed';
      e.t = 2.2;
      e.daze = 2.2;
      SFX.boom();
      cam.shake = 0.5;
      floatWord('DAZED', e.pos.clone().setY(2.6), HEX.bile, 1);
    } else if (e.t <= 0) {
      e.st = 'hop';
      e.t = rand(2.5, 3.5);
    }
  },
  dazed(e, dt, dist, ux, uz, mv, now) {
    if (animTick) e.tilt.rotation.z = Math.sin(now * 14) * 0.15;
    if (e.t > 0) return;
    e.st = 'hop';
    e.t = 3;
    e.tilt.rotation.z = 0;
  }
};

// the skull follows slowly and shouts KILL in a fan of words, every third time a ring of red orbs (LIVIN' OR DYIN')
function livingDyingSkull(e, dt, dist, ux, uz, mv, now) {
  e.fly = 2.3 + Math.sin(now * 1.5) * 0.3;
  if (dist > 6) {
    [mv.x, mv.z] = steer(e);
    mv.sp = 1.6;
  }
  if (e.t <= 0 && e.stagger <= 0) {
    e.st = 'wind';
    e.t = 0.75;
    e.n = (e.n || 0) + 1;
    SFX.growl();
    floatWord(e.n % 3 === 0 ? 'LIVIN’ OR DYIN’' : 'KILL', e.pos.clone().setY(4.4), HEX.tie, 1.1);
  }
  if (e.st === 'wind') {
    if (animTick) shake(e.tilt, 0.08);
    if (e.t <= 0) {
      const from = e.pos.clone().setY(1.5),
        base = Math.atan2(ux, uz);
      if (e.n % 3 === 0)
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU;
          redOrb(from, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
        }
      else
        for (const off of [-0.5, -0.25, 0, 0.25, 0.5])
          insultShot(from, new THREE.Vector3(Math.sin(base + off), 0, Math.cos(base + off)), 'KILL', HEX.tie);
      e.st = 'idle';
      e.t = rand(2, 2.8);
      e.tilt.position.set(0, 0, 0);
    }
  }
  if (dist < e.r + hero.r + 0.1) hurtHero(1, e.pos);
}
TALKERS.L = {
  make: makeLivingDying,
  update: updateLivingDying,
  // the whole head, and a piece waiting its turn, cannot be hurt; a dazed piece takes double
  struck: (e, n) => {
    if (e.waiting || e.part === 'whole') {
      SFX.tink();
      floatWord('NOT YET', e.pos.clone().setY((e.gy || 0) + (e.fly || 2) + 1.5), HEX.paper, 0.8);
      return null;
    }
    return e.daze > 0 ? n * 2 : n;
  },
  drops: () => {}
};

// ----- waking, and the pieces in turn (the secret that wakes it and the reward: 49-secret.js)
// the painting wakes: the whole head appears, then splits into its pieces, fought in turn (stages)
function livingDyingWakeUp() {
  const f = G.ldPainting;
  f.pic.material.color.setHex(0xffffff);
  burst(new THREE.Vector3(10.5 * CELL, 2.6, (G.h - 1) * CELL - 0.5), [0xd8642a, 0x3a4a1c, COL.tie, COL.bile, 0x3a5ad8], 40, 7, 0.3);
  const c = new THREE.Vector3(10.5 * CELL, 0, (G.h - 3.5) * CELL);
  G.ld = { center: c, stages: [['hair'], ['eyeL', 'eyeR'], ['jaw'], ['skull']], stage: -1, parts: [] };
  const w = makeEnemy('L', c.x, (G.h - 2) * CELL, 'whole');
  w.t = 2.6;
  G.ld.whole = w;
  floatWord('LIVIN’ OR DYIN’?', w.pos.clone().setY(5.4), HEX.tie, 1.5);
  SFX.boom();
  cam.shake = 0.5;
  updateLeft();
}
function livingDyingSplit(w) {
  w.dead = true;
  G.group.remove(w.root);
  SFX.tear();
  SFX.villain(true);
  cam.shake = 0.6;
  burst(w.pos.clone().setY(2.4), [0xd8642a, 0x3a4a1c, COL.tie, COL.bile], 50, 9, 0.3);
  for (const part of ['hair', 'eyeL', 'eyeR', 'jaw', 'skull']) {
    const e = makeEnemy('L', w.pos.x + rand(-2, 2), w.pos.z + rand(-2, 2), part);
    e.waiting = true;
    e.fly = 3;
    G.ld.parts.push(e);
  }
  livingDyingNext();
}
function livingDyingNext() {
  G.ld.stage++;
  const names = G.ld.stages[G.ld.stage];
  if (!names) return;
  const lines = {
    hair: 'The hair comes loose first.',
    eyeL: 'The eyes tear free. Two of them.',
    jaw: 'The jaw starts hoppin’.',
    skull: 'Only the skull is left.'
  };
  toast(lines[names[0]]);
  for (const e of G.ld.parts)
    if (names.includes(e.part)) {
      e.waiting = false;
      e.t = 1.5;
      e.st = 'idle';
    }
}
// when the stage's pieces are torn, the next ones come; after the skull: the jaw to take, and a big heart
function livingDyingCheck() {
  if (!G.ld || G.ld.stage < 0) return;
  const names = G.ld.stages[G.ld.stage];
  if (names && G.ld.parts.filter(e => names.includes(e.part)).every(e => e.dead || e.dying)) {
    if (G.ld.stage === G.ld.stages.length - 1) {
      const sk = G.ld.parts.find(e => e.part === 'skull');
      spawnJaw(sk.pos.x, sk.pos.z);
      spawnPickup(sk.pos.x + 2, sk.pos.z, true);
      G.ld.stage = 99;
    } else livingDyingNext();
  }
}
// one strand of hair: a tube that tapers to a point, with its colour baked in
function hairStrand(curve, r, seg, colour) {
  const t = new THREE.TubeGeometry(curve, seg, r, 5, false),
    p = t.attributes.position,
    ring = 6,
    c = new THREE.Color(colour),
    cols = new Float32Array(p.count * 3),
    q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const k = Math.floor(i / ring) / seg,
      at = curve.getPointAt(Math.min(k, 1), q),
      f = 1 - 0.85 * k;
    p.setXYZ(i, at.x + (p.getX(i) - at.x) * f, at.y + (p.getY(i) - at.y) * f, at.z + (p.getZ(i) - at.z) * f);
    const sh = 0.8 + 0.35 * k;
    cols[i * 3] = c.r * sh;
    cols[i * 3 + 1] = c.g * sh;
    cols[i * 3 + 2] = c.b * sh;
  }
  t.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return t;
}
// the hair: a wild mop of crayon-orange strands in ten clumps, thick at the root and fine at the tip, inked like the drawing
const HAIR_COLS = [0xc8642a, 0xa24a1e, 0xe08a3e, 0x7a3a18, 0xd8723a];
function hairModel() {
  const g = new THREE.Group(),
    clumps = [],
    mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x220a02 }),
    ink = new THREE.MeshBasicMaterial({ color: COL.ink, side: THREE.BackSide });
  for (let c = 0; c < 10; c++) {
    const clump = hairClump(c, mat, ink);
    g.add(clump);
    clumps.push({ g: clump, ph: rand(0, 6) });
  }
  hairScalp(g, mat, ink);
  return { g, mats: [mat], clumps, reach: 1, bristle: 0 };
}
// clump c of ten round the head: eight strands, merged into one mesh and one ink outline (a slightly fatter tube, back faces)
function hairClump(c, mat, ink) {
  const clump = new THREE.Group(),
    body = [],
    line = [];
  clump.rotation.y = (c / 10) * TAU + rand(-0.15, 0.15);
  for (let k = 0; k < 8; k++) {
    const [curve, r] = hairCurve(k);
    body.push([hairStrand(curve, r, 12, HAIR_COLS[(k + c) % HAIR_COLS.length]), new THREE.Matrix4()]);
    line.push([new THREE.TubeGeometry(curve, 8, r + 0.03, 4, false), new THREE.Matrix4()]);
  }
  clump.add(new THREE.Mesh(mergeGeos(body), mat), new THREE.Mesh(mergeGeos(line), ink));
  return clump;
}
// strand k of a clump: out from the scalp, arching up then drooping, curling as it goes; its curve and root radius
function hairCurve(k) {
  const pts = [],
    up = rand(0.2, 1),
    out = rand(1.1, 2),
    curl = rand(3, 7),
    ph = rand(0, 6),
    sw = rand(0.1, 0.28),
    r = rand(0.05, 0.085),
    y0 = rand(-0.15, 0.35);
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    pts.push(
      new THREE.Vector3(
        0.3 + t * out,
        y0 + Math.sin(t * Math.PI * 0.9) * up - t * t * 0.7 + Math.sin(t * curl + ph) * sw * t,
        Math.cos(t * curl + ph) * sw * t + (k - 3.5) * 0.07
      )
    );
  }
  return [new THREE.CatmullRomCurve3(pts), r];
}
// the scalp, in the strands' material (so it flashes with them), and its ink
function hairScalp(g, mat, ink) {
  const cg = new THREE.SphereGeometry(0.6, 14, 10),
    cc = new THREE.Color(0x5a2a12);
  cg.setAttribute(
    'color',
    new THREE.BufferAttribute(
      new Float32Array(cg.attributes.position.count * 3).map((_, i) => [cc.r, cc.g, cc.b][i % 3]),
      3
    )
  );
  const core = new THREE.Mesh(cg, mat);
  core.scale.set(1.25, 0.75, 1.25);
  const coreInk = new THREE.Mesh(cg, ink);
  coreInk.scale.set(1.32, 0.82, 1.32);
  g.add(core, coreInk);
}
// the strand that holds Red Cap, stretched from the hair to his legs, reeling him in until a dodge tears it
function snareTick() {
  const s0 = hero.snareFrom,
    on = hero.snared > 0 && s0 && !s0.dead && !s0.dying;
  if (!on) {
    hero.snared = 0;
    if (hero.snareLine) {
      G.group.remove(hero.snareLine);
      hero.snareLine.geometry.dispose();
      hero.snareLine = null;
    }
    return;
  }
  const dx = s0.pos.x - hero.pos.x,
    dz = s0.pos.z - hero.pos.z,
    d = Math.hypot(dx, dz) || 1;
  if (d > 1.5) hero.knock.set((dx / d) * 5, (dz / d) * 5);
  if (!hero.snareLine) {
    hero.snareLine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.03, 1, 5),
      new THREE.MeshLambertMaterial({ color: 0xc8642a, emissive: 0x401404 })
    );
    G.group.add(hero.snareLine);
  }
  const a1 = tmpS1.copy(s0.pos).setY((s0.gy || 0) + (s0.fly || 2)),
    a2 = tmpS2.copy(hero.pos).setY(hero.pos.y + 0.35),
    L = a1.distanceTo(a2);
  hero.snareLine.position.copy(a1).add(a2).multiplyScalar(0.5);
  hero.snareLine.scale.set(1, L, 1);
  hero.snareLine.quaternion.setFromUnitVectors(UP, a2.sub(a1).normalize());
}
