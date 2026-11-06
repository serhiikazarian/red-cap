// Bruno (Z): burns alive and calls you stupid. Madone! Too hot to stand next to.
let BRUNO_FIRE_M = null; // his tongues of fire share one material
const BRUNO_FLAMES = 16,
  BRUNO_AURA = 3.4, // touching distance: his fire takes two hearts
  BRUNO_SCORCH = 6.5, // inside this the heat builds up (HOT, then a heart, about every 0.7 s)
  BRUNO_FLARE = 7, // the flare's reach, and how close Red Cap must be for Bruno to start one
  BRUNO_RING_N = 48, // the scorch circle's pieces (each hidden when a wall stands between it and him)
  BRUNO_RING_GEO = share(new THREE.RingGeometry(BRUNO_SCORCH - 0.22, BRUNO_SCORCH + 0.22, 2, 1, 0, TAU / BRUNO_RING_N + 0.002));

// his paper figure tied to a stake (47-cages), a fire glow, the heat disc, the scorch circle and sixteen tongues of flame:
// an inner ring as far as his touch, an outer one to the edge of the heat
function makeBruno(e, add, x, z) {
  Object.assign(e, {
    name: 'Bruno',
    hp: 8,
    maxHp: 8,
    flareCd: 3,
    r: 0.8,
    wide: 1.2,
    hgt: 3,
    y1: 3,
    palette: [COL.hot, COL.tie, COL.ink, 0x9aa070],
    boss: true,
    aura: BRUNO_AURA,
    pebbleDmg: 1
  });
  e.hot = { x: x, z: z, r: 0, k: 1.6, see: true }; // his heat zone: off while he is tied up; a wall keeps it off Red Cap
  G.hot.push(e.hot);
  const m = add(paper('bruno', 3, 0.14));
  e.body = m;
  e.t = 2;
  const b = SHAPES.bruno.box,
    w = sizeOf('bruno', 3).w;
  e.mouth = new THREE.Vector3(((380 - b[0]) / (b[2] - b[0]) - 0.5) * w, (1 - (700 - b[1]) / (b[3] - b[1])) * 3, 0.1);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })
  );
  glow.scale.set(6, 4, 1);
  glow.position.y = 1.1;
  e.root.add(glow);
  e.glow = glow;
  const heat = new THREE.Mesh(
    decalGeo,
    new THREE.MeshBasicMaterial({ map: glowRed, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 })
  );
  heat.rotation.x = -Math.PI / 2;
  heat.position.y = 0.05;
  heat.scale.setScalar(e.aura);
  e.root.add(heat);
  e.heat = heat;
  const scorch = new THREE.Mesh(
    decalGeo,
    new THREE.MeshBasicMaterial({ map: glowRed, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2 })
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.04;
  scorch.scale.setScalar(BRUNO_SCORCH * 2);
  scorch.visible = false; // shown once he is free
  e.root.add(scorch);
  e.scorch = scorch;
  BRUNO_FIRE_M =
    BRUNO_FIRE_M || share(new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  e.flames = [];
  for (let k = 0; k < BRUNO_FLAMES; k++) {
    const inner = k < 6,
      f = new THREE.Sprite(BRUNO_FIRE_M);
    f.userData = {
      a: (k / (inner ? 6 : BRUNO_FLAMES - 6)) * TAU + (inner ? 0 : 0.4),
      r: inner ? rand(1.6, BRUNO_AURA) : rand(BRUNO_AURA + 0.6, BRUNO_SCORCH - 0.3),
      h: inner ? rand(2.2, 2.9) : rand(1.3, 2),
      ph: rand(0, TAU)
    };
    f.visible = false;
    e.root.add(f);
    e.flames.push(f);
  }
}
// out of his stake he walks after Red Cap shouting insults (three at a time, from his mouth); close, he flares (MADONE!) and
// his fire bursts out to BRUNO_FLARE; touching him burns two hearts; never through a wall
function updBruno(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  const now = performance.now() / 1000;
  brunoFire(e, dt, now);
  const seen = dist < 18 && !hero.inSmoke && los(e.pos, hero.pos);
  if (e.st === 'idle') {
    if (seen || dist < 10) {
      e.st = 'walk';
      e.t = 1.5;
    }
  } else if (e.st === 'walk') brunoWalk(e, dist, seen, mv);
  else if (e.st === 'flareWind') {
    // the fire gathers, then bursts out
    if (animTick) {
      shake(e.tilt, 0.07);
      const k = 1 - e.t / 0.95;
      e.heat.scale.setScalar(BRUNO_AURA + k * (BRUNO_FLARE - BRUNO_AURA) * (Math.floor(e.t * 14) % 2 ? 1 : 0.85));
      e.glow.scale.set(6.5 + k * 4, 4.5 + k * 3, 1);
    }
    if (e.t <= 0) brunoBurst(e);
  } else if (e.st === 'flare') {
    e.heat.scale.setScalar(BRUNO_FLARE);
    if (e.t <= 0) {
      e.aura = BRUNO_AURA;
      e.heat.scale.setScalar(BRUNO_AURA);
      e.st = 'walk';
      e.t = 1.2;
      e.tilt.position.set(0, 0, 0);
    }
  } else if (e.st === 'wind') {
    if (animTick) shake(e.tilt, 0.06);
    if (e.t <= 0) brunoInsults(e, ux, uz);
  }
  e.flareCd -= dt;
  if (dist < e.aura && los(e.pos, hero.pos)) hurtHero(2, e.pos);
}
// walking after Red Cap (no closer than 3.4 m); close and cooled down, the flare's wind-up; seen, an insult's
function brunoWalk(e, dist, seen, mv) {
  if (dist > 3.4) {
    [mv.x, mv.z] = steer(e);
    mv.sp = 1.5;
  }
  if (dist < BRUNO_FLARE && e.flareCd <= 0 && e.stagger <= 0) {
    e.st = 'flareWind';
    e.t = 0.95;
    e.flareCd = 4.5;
    SFX.growl();
    floatWord('MADONE!', e.pos.clone().setY(3.8), HEX.hot, 1.3, true);
    sNoise({ dur: 0.7, f: 900, f2: 400, q: 3, gain: 0.2 });
  } else if (seen && e.t <= 0 && e.stagger <= 0) {
    e.st = 'wind';
    e.t = 0.55;
    floatWord(pick(['MADONE!', 'STUPID!', 'MADONE!', 'YOU FOOL']), e.pos.clone().setY(3.7), HEX.hot, 1.1);
    SFX.growl();
  }
}
// the flare: his fire bursts out to BRUNO_FLARE
function brunoBurst(e) {
  e.st = 'flare';
  e.t = 0.55;
  e.aura = BRUNO_FLARE;
  SFX.boom();
  cam.shake = Math.max(cam.shake, 0.35);
  for (let k = 0; k < 56; k++) {
    const a = rand(0, TAU);
    burst(fxAt(e.pos, Math.cos(a) * rand(1, BRUNO_FLARE), 0.3, Math.sin(a) * rand(1, BRUNO_FLARE)), [COL.hot, COL.bile, COL.tie], 1, 3, 0.3, {
      g: -6,
      life: 0.8
    });
  }
}
// three insults fanned out at Red Cap from his mouth
function brunoInsults(e, ux, uz) {
  e.st = 'walk';
  e.t = rand(2.2, 3.2);
  e.tilt.position.set(0, 0, 0);
  const mouth = e.mouth.clone().applyAxisAngle(UP, e.face.rotation.y).add(e.pos);
  for (const off of [-0.28, 0, 0.28]) {
    const a = Math.atan2(ux, uz) + off;
    insultShot(mouth, new THREE.Vector3(Math.sin(a), 0, Math.cos(a))).parry = true; // Red Cap can strike it down (hitWord)
  }
}
// his fire: a flickering glow, the heat disc, tongues of flame round him and the scorch circle at the edge of his heat, none
// of it beyond a wall; embers over the burning ground; his heat zone follows him (heroHeat)
function brunoFire(e, dt, now) {
  if (animTick) {
    e.glow.material.opacity = 0.7 + Math.random() * 0.3;
    e.glow.scale.set(8 + Math.random() * 1.6, 5.2 + Math.random() * 1.2, 1);
    e.tilt.rotation.z = Math.sin(now * 9) * 0.03;
    e.heat.material.opacity = 0.65 + Math.random() * 0.25;
    e.scorch.material.opacity = 0.24 + Math.random() * 0.12;
    // each tongue sways round him and flickers; one that a wall cuts off from him is not drawn
    for (const f of e.flames) {
      const u = f.userData,
        a = u.a + now * 0.35,
        fx = Math.cos(a) * u.r,
        fz = Math.sin(a) * u.r,
        lick = 0.75 + 0.25 * Math.sin(now * 7 + u.ph) + Math.random() * 0.15;
      tmpW.set(e.pos.x + fx, 0, e.pos.z + fz);
      f.visible = !solid(...cellOf(tmpW.x, tmpW.z)) && los(e.pos, tmpW);
      f.position.set(fx, (u.h * lick) / 2, fz);
      f.scale.set(u.h * 0.62 * (0.85 + Math.random() * 0.3), u.h * lick, 1);
      f.material.opacity = 0.9;
    }
  }
  // embers all over the ground he burns, never beyond a wall
  if (Math.random() < dt * 45) {
    const a = rand(0, TAU),
      r = Math.sqrt(Math.random()) * BRUNO_SCORCH;
    tmpW.set(e.pos.x + Math.cos(a) * r, 0, e.pos.z + Math.sin(a) * r);
    if (los(e.pos, tmpW))
      burst(tmpW.clone().setY(e.pos.y + rand(0.1, 0.6)), [COL.hot, COL.bile, COL.tie, 0xfff2a0], 1, 1.6, 0.24, { g: -5, life: 0.9 });
  }
  e.hot.x = e.pos.x;
  e.hot.z = e.pos.z;
  e.hot.r = BRUNO_SCORCH;
  e.scorch.visible = true;
  if (!e.fireRing) {
    e.fireRing = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: COL.tie, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < BRUNO_RING_N; k++) {
      const seg = new THREE.Mesh(BRUNO_RING_GEO, mat);
      seg.rotation.set(-Math.PI / 2, 0, (k / BRUNO_RING_N) * TAU);
      seg.userData.a = ((k + 0.5) / BRUNO_RING_N) * TAU;
      e.fireRing.add(seg);
    }
    G.group.add(e.fireRing);
  }
  e.fireRing.position.set(e.pos.x, e.pos.y + 0.07, e.pos.z);
  e.fireRing.children[0].material.opacity = 0.55 + Math.sin(now * 6) * 0.35;
  if (animTick)
    for (const seg of e.fireRing.children) {
      tmpW.set(e.pos.x + Math.cos(seg.userData.a) * BRUNO_SCORCH, 0, e.pos.z - Math.sin(seg.userData.a) * BRUNO_SCORCH);
      seg.visible = !solid(...cellOf(tmpW.x, tmpW.z)) && los(e.pos, tmpW);
    }
  if (Math.random() < dt * 50)
    burst(fxAt(e.pos, rand(-1, 1), rand(0.1, 1.2), rand(-1, 1)), [COL.hot, COL.bile, COL.tie], 1, 2, 0.28, {
      g: -5,
      life: 0.8
    });
}
TALKERS.Z = {
  make: makeBruno,
  update: updBruno,
  bar: e => [e.st === 'flareWind' ? 'Flarin’ — back off' : '', false],
  rim: { col: 0xffb35a },
  torn: e => e.fireRing && G.group.remove(e.fireRing),
  // the fire goes out with him; he leaves a plain heart
  drops: e => {
    e.hot.r = 0;
    dropHeart(e.pos.x, e.pos.z);
  }
};
