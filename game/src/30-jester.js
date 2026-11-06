// The Jester (M): floor three's last boss, behind the fog gate. Wears the mask for everyone; laughs last, until you.
// Nearly immune while masked (hits only TINK). Openings: he lifts the mask to laugh, it flies off when he slams into a wall,
// he throws it like a boomerang; and blows from his own world crack it (a totem's shout, a fallen face sent back at him).
const JESTER_DEEP = 0.3, // his laugh deepens once he is down to this share of his health
  JESTER_FACES = [3, 4, 5], // masks per drop as the fight goes on
  SLAB_MAX = 10, // masks on the floor at once, falling or lying
  FIN_LEN = 1.6; // seconds of the finale's shock ring
const FACE_RING_GEO = share(new THREE.RingGeometry(1.1, 1.4, 28)); // a falling face's mark
const slabs = [];
let slabBoomT = 0;
let MASK_GLOW = null;
const maskGlow = () => MASK_GLOW || (MASK_GLOW = glowTex('#fff6d0', 'rgba(240,207,46,.55)'));

// his paper figure and his mask on its own, set exactly where it sits in the drawing (so it can lift, tilt and fly)
function makeJester(e, add) {
  const H = 3.7;
  Object.assign(e, {
    name: 'The Jester',
    hp: 34.5,
    maxHp: 34.5,
    r: 1.15,
    hgt: H,
    y1: H,
    palette: [0x9a9e98, 0xe0a46a, COL.ink, COL.bile, COL.cap],
    boss: true,
    dormant: true,
    masked: true,
    actions: 0
  });
  const body = add(paper('jester', H, 0.3));
  e.body = body;
  const jb = SHAPES.jester.box,
    mb = SHAPES.jester_mask.box,
    s = H / (jb[3] - jb[1]);
  const mh = (mb[3] - mb[1]) * s,
    mask = paper('jester_mask', mh, 0.12);
  e.mats.push(mask.userData.mat);
  const mg = new THREE.Group();
  mg.add(mask);
  mask.position.y = -mh / 2;
  e.maskHome = new THREE.Vector3(((mb[0] + mb[2]) / 2 - (jb[0] + jb[2]) / 2) * s, (jb[3] - mb[3]) * s + mh / 2, 0.26);
  mg.position.copy(e.maskHome);
  e.tilt.add(mg);
  e.maskG = mg;
  e.maskMat = mask.userData.mat;
  e.t = 2.5;
  e.cracks = 0;
}
// his laugh fills the floor; deeper near the end
function jesterLaugh(J) {
  SFX.laugh(!!J && J.hp <= J.maxHp * JESTER_DEEP);
}
// the mask on (BACK ON) or off (he laughs: HA HA HA)
function setMasked(e, on) {
  if (e.masked === on) return;
  e.masked = on;
  if (on) return; // the mask goes back on without a word
  SFX.unmask();
  jesterLaugh(e);
  floatWord('HA HA HA', e.pos.clone().setY(4.4), HEX.bile, 1.1);
}
// Dormant until Red Cap comes through the gate. Then he walks after him, weaving, and picks an action: throw the mask like a
// boomerang (CATCH; not while Red Cap holds the Laughing Jaw), drop masks from the sky (faces), laugh with the mask lifted,
// or wind up and charge (HUSH); a charge into a wall stuns him, unmasked. r is how far the fight has gone (0 at full health,
// 1 at none): everything quickens, he hops aside and feints; from half health (p2) more of everything.
function updateJester(e, dt, dist, ux, uz, mv) {
  const p2 = e.hp <= e.maxHp / 2,
    r = clamp(1 - e.hp / e.maxHp, 0, 1),
    tq = 1 - 0.45 * r;
  if (e.dormant) {
    jesterWaits(e, dt);
    return;
  }
  if (p2 && !e.p2) {
    e.p2 = true;
    floatWord(spacedWord('NOT\nFUNNY'), e.pos.clone().setY(4.4), HEX.tie, 1.3); // two lines, letters spaced: the T ran into the F
    e.st = 'walk';
    e.t = 0.8;
    setMasked(e, true);
  }
  const mg = e.maskG;
  if (e.mBoom) maskFlight(e, dt, tq);
  if (animTick) maskPose(e, mg);
  const step = JESTER_STATES[e.st];
  if (step) step(e, dt, dist, ux, uz, mv, p2, r, tq, mg);
  if (e.st !== 'stun' && e.st !== 'charge' && dist < e.r + hero.r + 0.15) hurtHero(1, e.pos);
}
// behind the fog gate he waits, facing the camera, until Red Cap comes through
function jesterWaits(e, dt) {
  faceCam(e, dt);
  if (hero.pos.z < 8 * CELL && !G.gateClosed) {
    e.dormant = false;
    e.engaged = true;
    G.totemIdle = null; // the two nearest big totems flash at once
    if (G.F.lowHeart && hero.hp < 3) spawnPickup(cellMid(G.F.lowHeart[0]), cellMid(G.F.lowHeart[1]));
    e.t = 1.4;
    SFX.laugh();
    toast('Immune when masked. Ring a totem.');
    floatWord('WELCOME', e.pos.clone().setY(4.4), HEX.paper, 1.1);
  }
}
// the mask: home on the face, lifted above the head (laugh) or knocked askew (stun)
function maskPose(e, mg) {
  const want =
    e.st === 'laugh'
      ? new THREE.Vector3(e.maskHome.x + 0.6, e.maskHome.y + 1.5, 0.4)
      : e.st === 'stun'
        ? new THREE.Vector3(e.maskHome.x - 1.1, e.maskHome.y - 0.9, 0.5)
        : e.maskHome;
  mg.position.lerp(want, 0.45);
  mg.rotation.z = lerp(mg.rotation.z, e.st === 'laugh' ? 0.5 : e.st === 'stun' ? 1.1 : 0, 0.45);
}
// his states, one step each (p2: the second half of the fight; r: how worn down he is, 0..1; tq: his rests, shorter as he tires)
const JESTER_STATES = {
  walk(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    const v = steer(e),
      wv = Math.sin(playT * (2.2 + 3 * r) + e.seed) * r * 1.3; // a weave that widens as he tires of you
    const wx = v[0] - v[1] * wv,
      wz = v[1] + v[0] * wv,
      wl = Math.hypot(wx, wz) || 1;
    mv.x = wx / wl;
    mv.z = wz / wl;
    mv.sp = 2.5 + 2 * r;
    e.skipCd = (e.skipCd ?? 2) - dt;
    if (animTick) e.tilt.rotation.z = Math.sin(performance.now() / 260) * 0.07;
    if (e.t <= 0 && e.stagger <= 0) {
      e.actions++;
      const roll = Math.random();
      const third = e.hp <= (e.maxHp * 2) / 3,
        mayLaugh = p2 || hero.hasJaw || !e.demoLaugh; // early on he laughs once, to show you the face under the mask
      if (!hero.hasJaw && roll < (p2 ? 0.35 : 0.2)) {
        e.st = 'throw';
        e.t = 0.7;
        floatWord('CATCH', e.pos.clone().setY(4.3), HEX.paper, 1, true);
        SFX.growl();
      } else if (roll < (p2 ? 0.72 : third ? 0.62 : 0.3)) {
        e.st = 'faces';
        e.t = 0.5;
      } else if (mayLaugh && e.actions % (hero.hasJaw ? 2 : 3) === 0) {
        e.demoLaugh = true;
        e.st = 'laugh';
        e.t = (p2 ? 1.5 : 1.9) + (hero.hasJaw ? 2.4 : 0);
        setMasked(e, false);
      } else {
        e.st = 'wind';
        e.t = (0.8 - 0.4 * r) * rand(0.75, 1.2);
        e.feint = r > 0.25 && Math.random() < 0.3 + 0.2 * r;
        SFX.growl();
        floatWord('HUSH', e.pos.clone().setY(4.2), HEX.paper, 1);
      }
    } else if (e.st === 'walk' && r > 0.2 && e.skipCd <= 0 && Math.random() < dt * 1.4 * r) jesterSkip(e, ux, uz, r, false);
  },
  wind(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    if (animTick) {
      shake(e.tilt, 0.1);
      e.tilt.rotation.x = 0.25;
    }
    for (const m of e.mats) m.color.setHex(Math.floor(e.t * 5) % 2 ? 0xffa090 : 0xffffff);
    if (e.t <= 0) {
      e.tilt.position.set(0, 0, 0);
      e.tilt.rotation.x = 0;
      for (const m of e.mats) m.color.setHex(0xffffff);
      if (e.feint) {
        // a feint: he hops aside and goes again, faster
        e.feint = false;
        floatWord('HA!', e.pos.clone().setY(4.2), HEX.bile, 0.9);
        jesterSkip(e, ux, uz, r, true);
      } else {
        e.st = 'charge';
        e.t = 0.8 + 0.3 * r;
        e.cx = ux;
        e.cz = uz;
      }
    }
  },
  skip(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    mv.x = e.kx;
    mv.z = e.kz;
    mv.sp = 9 + 4 * r;
    if (animTick) e.tilt.rotation.z = -0.3 * e.kside;
    if (e.t <= 0) {
      e.tilt.rotation.z = 0;
      if (e.reWind) {
        e.reWind = false;
        e.st = 'wind';
        e.t = 0.28;
        e.feint = false;
        SFX.growl();
      } else {
        e.st = 'walk';
        e.t = Math.max(0.2, e.actT || 0.6);
      }
    }
  },
  charge(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    const sp = 12 + 6 * r;
    e.tilt.rotation.x = -0.18;
    if (r > 0) {
      // late in the fight the charge bends after you
      const a0 = Math.atan2(e.cx, e.cz),
        d = clamp(angDiff(a0, Math.atan2(ux, uz)), -1.5 * r * dt, 1.5 * r * dt);
      e.cx = Math.sin(a0 + d);
      e.cz = Math.cos(a0 + d);
    }
    const before = e.pos.clone();
    e.pos.x += e.cx * sp * dt;
    e.pos.z += e.cz * sp * dt;
    collide(e.pos, e.r);
    if (dist < e.r + hero.r + 0.2) hurtHero(2, e.pos);
    if (e.pos.distanceTo(before) < sp * dt * 0.25) {
      e.st = 'stun';
      e.t = hero.hasJaw ? 3.2 : 2;
      setMasked(e, false);
      cam.shake = 0.6;
      SFX.boom();
      burst(e.pos.clone().setY(1.6), [0x9a9e98, COL.paper], 20, 6, 0.25);
      floatWord('THUD', e.pos.clone().setY(4), HEX.paper, 1);
    } else if (e.t <= 0) {
      e.tilt.rotation.x = 0;
      if (r > 0.6 && !e.again && Math.random() < 0.45) {
        e.again = true;
        e.st = 'wind';
        e.t = 0.25;
        e.feint = false;
        floatWord('AGAIN!', e.pos.clone().setY(4.2), HEX.tie, 1);
        SFX.growl(); // near the end, a second charge straight after the first
      } else {
        e.again = false;
        e.st = 'walk';
        e.t = (p2 ? 2 : 2.8) * tq;
      }
    }
  },
  stun(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    if (animTick) {
      e.tilt.rotation.z = Math.sin(performance.now() / 90) * 0.1;
      e.tilt.rotation.x = 0.15;
    }
    if (e.t <= 0) {
      e.st = 'walk';
      e.t = 1.6;
      e.tilt.rotation.x = 0;
      setMasked(e, true);
    }
  },
  laugh(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    if (animTick) {
      e.tilt.rotation.z = Math.sin(performance.now() / 70) * 0.06;
      e.tilt.position.y = Math.abs(Math.sin(performance.now() / 120)) * 0.15;
    }
    if (Math.random() < dt * 2) floatWord(pick(['HA', 'HA HA', 'HEE']), e.pos.clone().setY(4.3 + rand(0, 0.6)), HEX.bile, 0.7);
    if (e.t <= 0) {
      e.st = 'walk';
      e.t = 2;
      e.tilt.position.y = 0;
      setMasked(e, true);
    }
  },
  faces(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    if (e.t <= 0) {
      dropFaces(JESTER_FACES[p2 ? 2 : e.hp <= (e.maxHp * 2) / 3 ? 1 : 0]);
      e.st = 'walk';
      e.t = (p2 ? 2.2 : 2.8) * tq;
    }
  },
  throw(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    if (animTick) shake(e.tilt, 0.06);
    if (e.t <= 0) {
      // the mask leaves his face: he is open until it comes back
      const m = paper('jester_mask', 1.9, 0.12);
      G.group.add(m);
      mg.visible = false;
      setMasked(e, false);
      const side = Math.random() < 0.5 ? 1 : -1;
      e.mBoom = { m, t: 0, dur: 2.6 - 0.9 * r, dx: ux, dz: uz, sx: -uz * side, sz: ux * side, reach: Math.min(dist, 13) };
      e.st = 'open';
      SFX.fireball();
    }
  },
  open(e, dt, dist, ux, uz, mv, p2, r, tq, mg) {
    faceCam(e, dt);
    if (animTick) e.tilt.rotation.z = Math.sin(performance.now() / 120) * 0.05;
  }
};
JESTER_STATES.idle = JESTER_STATES.walk;
// the thrown mask flies out and back in a loop, bending toward Red Cap on the way out; it takes two hearts; caught again, it
// goes back on
function maskFlight(e, dt, tq) {
  const b = e.mBoom;
  b.t += dt;
  const k = b.t / b.dur,
    out = Math.sin(Math.min(k, 1) * Math.PI);
  const home = e.pos.clone().setY(2.6);
  if (k < 0.45) {
    const hx = hero.pos.x - home.x,
      hz = hero.pos.z - home.z,
      hd = Math.hypot(hx, hz) || 1,
      f = ease(1.6, dt); // on the way out it bends toward you
    b.dx = lerp(b.dx, hx / hd, f);
    b.dz = lerp(b.dz, hz / hd, f);
    b.reach = lerp(b.reach, Math.min(hd, 13), f);
  }
  b.m.position.set(
    home.x + b.dx * b.reach * out + b.sx * Math.sin(k * TAU) * 1.3,
    1.4 + out * 0.4,
    home.z + b.dz * b.reach * out + b.sz * Math.sin(k * TAU) * 1.3
  );
  if (animTick) b.m.rotation.y += 1.1;
  if (heroDist(b.m.position.x, b.m.position.z) < 1.25) hurtHero(2, b.m.position);
  if (k >= 1) {
    G.group.remove(b.m);
    e.mBoom = null;
    e.maskG.visible = true;
    setMasked(e, true);
    e.st = 'walk';
    e.t = 1.6 * tq;
  }
}
// a quick hop to one side, keeping the action timer for when he lands (reWind: then wind up again)
function jesterSkip(e, ux, uz, r, reWind) {
  const sd = Math.random() < 0.5 ? 1 : -1;
  e.kside = sd;
  e.kx = -uz * sd;
  e.kz = ux * sd;
  e.actT = e.t;
  e.st = 'skip';
  e.t = 0.22 + 0.1 * r;
  e.skipCd = 1.1;
  e.reWind = reWind;
  playNoise({ dur: 0.18, f: 900, f2: 2600, q: 1, gain: 0.14 });
  if (!reWind && Math.random() < 0.5) floatWord(pick(['HOP', 'TA-DA', 'WHEE']), e.pos.clone().setY(4.2), HEX.bile, 0.8);
}
// the Jester in his fight (null before and after)
function jester() {
  return G.enemies.find(e => e.type === 'M' && !e.dead && !e.dying && !e.dormant);
}
// the mask cracks under blows from his own world: a totem's shout, or a fallen face knocked back at him
function jesterStruck(J, fx, fz) {
  const dx = J.pos.x - fx,
    dz = J.pos.z - fz,
    d = Math.hypot(dx, dz) || 1;
  if (!J.masked) {
    damage(J, 2, dx / d, dz / d);
    return;
  }
  J.cracks = (J.cracks || 0) + 1;
  SFX.boom();
  SFX.tink();
  cam.shake = Math.max(cam.shake, 0.3);
  burst(J.pos.clone().setY(2.8), [0x9a9e98, COL.paper, COL.ink], 16, 6, 0.2);
  if (J.cracks < 2) {
    floatWord('CRACK', J.pos.clone().setY(4.4), HEX.paper, 1.2);
  } else {
    J.cracks = 0;
    if (J.mBoom) {
      G.group.remove(J.mBoom.m);
      J.mBoom = null;
      J.maskG.visible = true;
    }
    J.st = 'stun';
    J.t = hero.hasJaw ? 4.8 : 3.2;
    setMasked(J, false);
  }
}
// a fallen face hit by the yo-yo or a pebble flies back at him
function kickFace(p, rad) {
  for (const s of slabs) {
    if (s.st !== 'lie' || Math.hypot(s.x - p.x, s.z - p.z) > rad + 1.1) continue;
    s.st = 'fly';
    s.t = 3;
    s.slab.rotation.set(0, 0, 0);
    s.slab.position.set(s.x, 1, s.z);
    G.group.remove(s.ring);
    SFX.yoyo();
    return true;
  }
  return false;
}
// torn at last: slow motion, a flash, the shock ring over the page (finaleShock), SILENCE; then his mask, huge, waits to be taken
function finale(J) {
  slowT = 1.2;
  G.finalFx = { t: 0 };
  cam.shake = Math.max(cam.shake, 0.7);
  cam.hurt = 0.34;
  const f = $('#flash');
  f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), 140); // screen time, not later(): a flash must always clear
  SFX.boom();
  SFX.tear();
  playTone({ f: 55, f2: 28, dur: 2.4, type: 'sawtooth', gain: 0.22, filt: [700, 70] });
  playNoise({ dur: 1.8, f: 2600, f2: 180, q: 0.8, gain: 0.26 });
  for (let k = 0; k < 4; k++) burst(J.pos.clone().setY(0.8 + k * 0.8), [COL.paper, COL.ink, COL.tie, COL.bile, 0x9a9e98], 40, 10, 0.34);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    burst(J.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.2, 2.2, Math.sin(a) * 1.2)), [COL.tie, COL.ink], 4, 12, 0.4);
  }
  floatWord(
    'SILENCE',
    camera.position.clone().addScaledVector(camera.getWorldDirection(tmpW), camera.position.distanceTo(J.pos)),
    HEX.tie,
    2.6,
    true
  );
  G.finalAt = J.pos.clone();
  later(2.2, () => G.finalAt && spawnFinalMask(G.finalAt.x, G.finalAt.z));
}
// the shock ring runs on real time (the world is in slow motion meanwhile), centred where he stood on screen
function finaleShock(rdt) {
  const f = G && G.finalFx,
    u = inkPass.uniforms;
  if (!f || f.t > FIN_LEN || !G.finalAt) {
    u.fin.value = 0;
    return;
  }
  f.t += rdt;
  tmpV.set(G.finalAt.x, 2.4, G.finalAt.z).project(camera);
  u.finC.value.set(clamp(tmpV.x * 0.5 + 0.5, -0.5, 1.5), clamp(tmpV.y * 0.5 + 0.5, -0.5, 1.5));
  u.finT.value = f.t;
  u.fin.value = 1 - THREE.MathUtils.smoothstep(f.t, 0.9, FIN_LEN);
}
// the mask, huge, turning in the air: the game ends only when you take it
function spawnFinalMask(x, z) {
  const m = paper('jester_mask', 3.4, 0.35);
  m.position.set(x, 1.1, z);
  G.group.add(m);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: maskGlow(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.8
    })
  );
  glow.position.set(x, 2.8, z);
  glow.scale.setScalar(7);
  G.group.add(glow);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.1, 40),
    new THREE.MeshBasicMaterial({ color: COL.bile, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.05, z);
  G.group.add(ring);
  G.finalMask = { m, glow, ring, x, z };
  playTone({ f: 220, f2: 440, dur: 1.6, type: 'triangle', gain: 0.08, a: 0.3 });
}
// the huge mask after the finale turns and glows; taking it is the last thing Red Cap does
function updateFinalMask(dt, now) {
  const f = G.finalMask;
  f.m.rotation.y += dt * 0.9;
  f.m.position.y = 1.1 + Math.sin(now * 1.6) * 0.25;
  f.glow.material.opacity = 0.6 + Math.sin(now * 3) * 0.2;
  f.ring.rotation.z += dt * 0.5;
  if (heroDist(f.x, f.z) < 2.3 && state === 'play') {
    G.finalMask = null;
    G.finalAt = null;
    G.group.remove(f.m);
    G.group.remove(f.glow);
    G.group.remove(f.ring);
    quietScreen();
    const fl = $('#flash');
    fl.classList.add('on');
    SFX.unmask();
    SFX.laugh(true); // the last laugh
    burst(new THREE.Vector3(f.x, 2, f.z), [COL.bile, COL.paper, COL.tie], 50, 8, 0.3);
    slowT = 0.8;
    later(0.9, () => {
      fl.classList.remove('on');
      win();
    });
  }
}
// The fallen faces: n masks drop from the sky, one on Red Cap's spot and the rest around him, each warned by a red ring; they
// hurt where they land, lie there for a while (yellow ring) and can be knocked back at him; then they sink.
function dropFaces(n) {
  // room for the new ones: the oldest lying masks sink early
  let over = slabs.filter(s => s.st !== 'gone').length + n - SLAB_MAX;
  for (const s of slabs) {
    if (over <= 0) break;
    if (s.st === 'lie' && s.t > 0.6) {
      s.t = 0.6;
      over--;
    }
  }
  const spots = [[hero.pos.x, hero.pos.z]];
  for (let i = 1; i < n; i++) {
    const a = rand(0, TAU),
      r = rand(2.4, 6.5);
    spots.push([hero.pos.x + Math.cos(a) * r, hero.pos.z + Math.sin(a) * r]);
  }
  for (const [x, z] of spots) {
    const ring = new THREE.Mesh(
      FACE_RING_GEO,
      new THREE.MeshBasicMaterial({ color: COL.tie, side: THREE.DoubleSide, transparent: true, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.05, z);
    G.group.add(ring);
    const slab = paper('jester_mask', 2.4, 0.35);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(x, 14, z + 1.2);
    slab.visible = false;
    G.group.add(slab);
    slabs.push({ ring, slab, x, z, t: 1.0, st: 'warn' });
  }
  jesterLaugh(jester());
}
// each falling mask's step; true once it is gone
const SLAB_STATES = {
  // a ring pulses where it will land
  warn(s) {
    s.ring.material.opacity = 0.4 + Math.sin(s.t * 30) * 0.4;
    s.ring.scale.setScalar(1 + s.t * 0.3);
    if (s.t > 0) return false;
    s.st = 'fall';
    s.slab.visible = true;
    s.t = 0.35;
    return false;
  },
  // down from 14 m; landing on Red Cap hurts
  fall(s) {
    s.slab.position.y = Math.max(0.2, 14 * (s.t / 0.35));
    if (s.t <= 0) slabLands(s);
    return false;
  },
  // it lies there a while, then sinks away
  lie(s, dt) {
    s.ring.material.opacity = 0.5 + Math.sin(s.t * 8) * 0.3;
    if (s.t < 0.6) s.slab.position.y -= dt * 1.2;
    if (s.t > 0) return false;
    G.group.remove(s.slab);
    G.group.remove(s.ring);
    return true;
  },
  // kicked back at the Jester (jesterBlow): it spins after him and strikes him, or crumbles when its time runs out
  fly(s, dt) {
    const J = jester();
    s.slab.rotation.y += dt * 9;
    if (J) {
      const dx = J.pos.x - s.slab.position.x,
        dz = J.pos.z - s.slab.position.z,
        d = Math.hypot(dx, dz) || 1;
      s.slab.position.x += (dx / d) * 14 * dt;
      s.slab.position.z += (dz / d) * 14 * dt;
      if (d < J.r + 0.8) {
        jesterStruck(J, s.slab.position.x, s.slab.position.z);
        s.t = 0;
      }
    }
    if (s.t > 0) return false;
    burst(s.slab.position.clone().setY(1.5), [0x9a9e98, COL.paper], 12, 5, 0.2);
    G.group.remove(s.slab);
    return true;
  }
};
function slabLands(s) {
  s.st = 'lie';
  s.t = 6;
  if (performance.now() - slabBoomT > 120) SFX.boom(); // masks landing together: one boom
  slabBoomT = performance.now();
  cam.shake = Math.max(cam.shake, 0.35);
  s.ring.material.color.setHex(COL.bile);
  s.ring.scale.setScalar(1);
  burst(new THREE.Vector3(s.x, 0.3, s.z), [0x9a9e98, COL.paper, COL.ink], 12, 5, 0.22);
  if (heroDist(s.x, s.z) < 1.4) hurtHero(1, new THREE.Vector3(s.x, 0, s.z));
}
function updateSlabs(dt) {
  for (let i = slabs.length - 1; i >= 0; i--) {
    const s = slabs[i];
    s.t -= dt;
    if (SLAB_STATES[s.st](s, dt)) slabs.splice(i, 1);
  }
}
TALKERS.M = {
  make: makeJester,
  update: updateJester,
  totemProof: true,
  bar: e => (e.masked ? ['Masked — immune', false] : ['', false, 'UNMASKED']),
  struck: jesterBlow,
  stagger: 0.12,
  knock: 2,
  rim: { a: 0.7, k: 0.45 },
  tornWord: null,
  drops: () => {},
  gone: e => {
    if (e.mBoom) {
      G.group.remove(e.mBoom.m);
      e.mBoom = null;
    }
    finale(e);
  }
};
// a blow on him: the mask takes it (only TINK), and a totem's shout or a fallen face cannot take the last of him: he reels and
// waits for Red Cap's own hand
function jesterBlow(e, n, weapon, force) {
  if (!force && !(e.dazedT > 0) && e.masked) {
    SFX.tink();
    burst(e.pos.clone().setY(2.6), [COL.paper, 0x9a9e98, COL.bile], 8, 4, 0.14);
    floatWord(pick(['HA!', 'TINK', 'NOPE', 'HA HA']), e.pos.clone().setY(4.1 + rand(0, 0.4)), HEX.paper, 0.9);
    return null;
  }
  if (weapon || e.hp - n > 0) return n;
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
  floatWord('REELIN’', e.pos.clone().setY(4.6), HEX.bile, 1.6, true);
  SFX.boom();
  SFX.tink();
  cam.shake = Math.max(cam.shake, 0.45);
  slowT = 0.5;
  playTone({ f: 70, f2: 40, dur: 1.2, type: 'sawtooth', gain: 0.16, filt: [500, 90] });
  burst(e.pos.clone().setY(3), [0x9a9e98, COL.paper, COL.bile], 30, 7, 0.26);
  return null;
}
