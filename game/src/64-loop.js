// The main loop, once a frame: time (slowed by the finale's slow motion and the yo-yo's hit-stop), the resolution controller,
// the 12-a-second stop-motion tick, then a step of play, the effects, the floor's ambient motion, the camera, and the picture.
let slowT = 0, // the final blow: the world slows to a crawl for a moment
  hitStop = 0; // a beat of stillness when the yo-yo connects
let last = performance.now(),
  flowT = 0, // until the next flow field
  beatT = 0; // until the next heartbeat (low on ties)

function frame(now) {
  requestAnimationFrame(frame);
  const raw = now - last;
  let dt = Math.min(raw / 1000, 0.05);
  last = now;
  // both count down in unslowed time, so a hit-stop inside slow motion (a bomb, the finale) lasts as long as anywhere else
  const step = dt;
  if (slowT > 0) {
    slowT -= step;
    dt *= 0.2;
  }
  if (hitStop > 0) {
    hitStop -= step;
    dt *= 0.04;
  }
  adaptResolution(raw);
  animAcc += dt;
  animTick = animAcc >= 1 / 12;
  if (animTick) animAcc %= 1 / 12;
  pollPad(Math.min(raw / 1000, 0.05));
  if (state === 'dead' && deadStill) return; // the death screen holds the last picture: nothing behind it moves
  if (!G || !worldOn || state === 'title' || state === 'build') {
    // the title has its slideshow; the world waits (and is not drawn while the ink covers the title), and a floor being cut
    // under the ink is not drawn
    if (warnEdgeOn || WARN.some(w => w.on)) updWarn(); // a warning left up when the floor ended goes
    return;
  }
  if (state === 'play') {
    playT += dt;
    playStep(dt);
    tickLater(Math.min(raw / 1000, 0.25));
  }
  if (state === 'play' || state === 'dead' || state === 'intro') {
    updGrins(dt);
    updParts(dt);
    updFloaters(dt);
    updPuffs(dt);
  }
  if (state === 'play' && !locked && mouse.in && !touchUI) {
    // the mouse at the screen's edge turns the camera
    const ex = mouse.x / innerWidth,
      edge = 0.09;
    if (ex < edge) cam.yaw += 2.4 * dt * (1 - ex / edge);
    else if (ex > 1 - edge) cam.yaw -= 2.4 * dt * (1 - (1 - ex) / edge);
  }
  ambience(dt, now / 1000);
  G.lamp.position.set(hero.pos.x, 2.6, hero.pos.z);
  updCamera(dt);
  finFx(Math.min(raw / 1000, 0.05));
  camera.updateMatrixWorld();
  updWarn();
  pyrSort();
  render();
}
// a step of play: Red Cap, the flow field, every talker (their sounds come from where they are; the Grump's fill the floor),
// the floor's features, the Geezer's swirl, the boss bar, the heartbeat
function playStep(dt) {
  updHero(dt);
  flowT -= dt;
  if (flowT <= 0) {
    flowT = 0.25;
    flowField();
  }
  G.psyWind = 0;
  for (const e of G.enemies) {
    AU.at = TALKERS[e.type].loud ? null : e.pos; // what it sets off sounds from where it is (the Grump's shouting fills the floor)
    updEnemy(e, dt);
  }
  AU.at = null;
  sprayFollow();
  heroSafety();
  G.doorT = (G.doorT || 0) - dt;
  if (G.doorT <= 0) {
    G.doorT = 0.5;
    openDoor();
  }
  updPaperTrail(dt);
  updShots(dt);
  updSlabs(dt);
  updTotems(dt);
  pyrGlow();
  pyrTick(dt);
  updMines(dt);
  updSecrets(dt);
  updCages(dt);
  updCovers(dt);
  updDebris(dt);
  post.uniforms.psy.value = Math.min(1, Math.max(G.psyWind, hero.stun > 0 ? hero.stunPsy : 0));
  bossBar(bossInFight());
  if (hero.hp <= 2) {
    beatT -= dt;
    if (beatT <= 0) {
      beatT = hero.hp <= 1 ? 0.7 : 1.1;
      SFX.heartbeat();
    }
  }
}
// the boss whose bar shows: the nearest one in the fight (a boss is in it once close and face to face), within 26 m
function bossInFight() {
  let boss = null,
    bd = 1e9;
  for (const e of G.enemies) {
    if (!e.boss || e.noBar || e.dead || e.dying || e.dormant || e.away || e.waiting || e.caged) continue;
    const d = e.pos.distanceTo(hero.pos);
    if (!e.engaged && d < 9 && los(e.pos, hero.pos)) e.engaged = true;
    if (e.engaged && d < 26 && d < bd) {
      bd = d;
      boss = e;
    }
  }
  return boss;
}
// the floor's ambient motion: onlookers, animated decor, floating blocks, drifting doodle faces, falling newspapers, brazier
// sparks, floor two's embers, floor one's drips, the open door's glow
function ambience(dt, tsec) {
  updBystanders(dt);
  for (const f of G.anim) f(dt, tsec);
  if (animTick)
    for (const d of G.deco) {
      d.m.rotation.y += d.spin / 12;
      if (d.bob) d.m.position.y = d.y + Math.sin(tsec * 0.6 + d.bob) * 0.4;
      if (d.inst) syncBoxes([d.inst]);
    }
  if (G.spirits) driftSpirits(tsec);
  if (G.papers) fallingPapers(dt, tsec);
  if (G.fires) fireSparks(dt);
  if (G.F.deco === 'mouth' && state === 'play' && Math.random() < dt * 14)
    burst(new THREE.Vector3(hero.pos.x + rand(-10, 10), 0.3, hero.pos.z + rand(-10, 10)), [COL.hot, COL.bile], 1, 0.4, 0.09, { g: -1.2, life: 2.5 });
  if (G.drips) driftDrips(dt);
  if (G.portal && G.portal.open) {
    G.portal.hole.material.color.setHSL(0, 0.8, 0.35 + Math.sin(tsec * 6) * 0.1);
    if (Math.random() < 0.3)
      burst(new THREE.Vector3(G.portal.x + rand(-0.8, 0.8), 0.2, G.portal.z), [COL.tie, COL.ink], 1, 1, 0.15, { g: -3, life: 1 });
  }
}
// floor one's floating faces circle their spots, turned to the camera
function driftSpirits(tsec) {
  for (const sp of G.spirits) {
    sp.m.position.set(
      sp.ox + Math.cos(tsec * sp.sp + sp.ph) * 1.4,
      sp.oy + Math.sin(tsec * 2 + sp.ph) * 0.3,
      sp.oz + Math.sin(tsec * sp.sp + sp.ph) * 1.4
    );
    if (animTick) {
      sp.m.rotation.y = Math.atan2(camera.position.x - sp.m.position.x, camera.position.z - sp.m.position.z);
      sp.m.rotation.z = Math.sin(tsec * 3 + sp.ph) * 0.15;
    }
  }
}
// floor one's newspapers flutter down and start again high up near Red Cap
function fallingPapers(dt, tsec) {
  for (const p of G.papers.p) {
    p.pos.y -= 0.7 * dt;
    p.pos.x += Math.sin(tsec * 1.3 + p.ph) * 0.5 * dt;
    p.rx += dt * p.spin;
    p.rz += dt * 0.8;
    if (p.pos.y < 0.05) p.pos.set(hero.pos.x + rand(-12, 12), rand(6, 9), hero.pos.z + rand(-12, 12));
    dummy.position.copy(p.pos);
    dummy.rotation.set(p.rx, 0, p.rz);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    p.im.setMatrixAt(p.k, dummy.matrix);
  }
  G.papers.ims.forEach(im => {
    im.instanceMatrix.needsUpdate = true;
  });
}
// a brazier's flame flickers and throws sparks
function fireSparks(dt) {
  for (const f of G.fires) {
    if (animTick) f.glow.scale.set(1.8 + Math.random() * 0.6, 2.2 + Math.random() * 0.8, 1);
    if (Math.random() < dt * 9)
      burst(
        new THREE.Vector3(f.x + rand(-0.25, 0.25), f.glow.position.y - 0.45, f.z + rand(-0.25, 0.25)),
        [COL.hot, COL.bile, COL.tie],
        1,
        1.2,
        0.2,
        { g: -5, life: 0.6 }
      );
  }
}
// floor one's drips fall and start again high up near Red Cap
function driftDrips(dt) {
  const D = G.drips;
  D.d.forEach((d, k) => {
    d.y -= d.v * dt;
    if (d.y < 0) {
      d.y = rand(9, 13);
      d.x = hero.pos.x + rand(-14, 14);
      d.z = hero.pos.z + rand(-14, 14);
    }
    dummy.position.set(d.x, d.y, d.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    D.im.setMatrixAt(k, dummy.matrix);
  });
  D.im.instanceMatrix.needsUpdate = true;
}
