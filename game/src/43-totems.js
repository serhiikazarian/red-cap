// Totems (floor three): hit one and it shouts a ring (STOP TALKIN'). A big totem's ring cracks the Jester's mask (twice
// shatters it) and dazes the flying heads; a small one's dazes anything it reaches. A big one and its nearest big mate then rest.
// In the Jester's fight the two ready ones nearest Red Cap flash until their shouts first break his mask (G.totemTaught), then
// until he rings one (and again after TOTEM_NAG s).
const TOTEM_NAG = 47,
  TOTEM_CD = 13, // s a big totem (and its nearest big mate) rests after a shout
  TOTEM_MINI_CD = 3.24,
  TOTEM_DAZE = 2.2; // s a ring dazes a talker (its own totemDaze if it has one)
const TOTEM_GEO = share(new THREE.CylinderGeometry(1, 1, 1.6, 48, 1, true)),
  TOTEM_MINI_GEO = share(new THREE.CylinderGeometry(1, 1, 1.1, 48, 1, true)); // their shout rings
const totemGlow = new THREE.Color();

// a totem: a big one (the Jester's chamber) faces the camera; a small one turns slowly
function buildTotem(cx, cz, mini, rng) {
  if (!mini) {
    const t = paper('grump', 2.6, 0.35, true);
    t.position.set(cx, 0, cz);
    G.group.add(seeThru(t, false, 'plain'));
    G.totems.push({ m: t, x: cx, z: cz, cd: 0, waves: [] });
    return;
  }
  const t = paper('grump', 2.2, 0.3, true);
  t.position.set(cx, 0, cz);
  t.rotation.y = rng() * TAU;
  t.scale.setScalar(0.7);
  G.group.add(seeThru(t, false, 'plain'));
  G.totems.push({ m: t, x: cx, z: cz, cd: 0, waves: [], mini: true });
}
// a totem hit by the yo-yo string or a pebble: it shouts if it is ready, else only mutters
function hitTotem(p, rad) {
  for (const t of G.totems) {
    if (Math.hypot(t.x - p.x, t.z - p.z) > rad + 0.9) continue;
    if (t.cd <= 0) {
      t.cd = t.mini ? TOTEM_MINI_CD : TOTEM_CD;
      if (!t.mini) G.totemIdle = 0; // a big one rung: the nearest ones stop flashing
      SFX.wah();
      if (!t.mini) {
        const mate = G.totems.filter(o => !o.mini && o !== t).sort((a, b) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(b.x - t.x, b.z - t.z))[0];
        if (mate) mate.cd = Math.max(mate.cd, TOTEM_CD);
      }
      burst(new THREE.Vector3(t.x, t.mini ? 1 : 1.5, t.z), [COL.bile, 0x4fa9df, 0x9bd12c], 10, 4, 0.16);
      const m = new THREE.Mesh(
        t.mini ? TOTEM_MINI_GEO : TOTEM_GEO,
        new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false })
      );
      m.position.set(t.x, t.mini ? 1.6 : 0.9, t.z);
      m.scale.set(0.8, 1, 0.8);
      G.group.add(m);
      t.waves.push({ m, r: 0.8, hit: false, struck: new Set() });
      floatWord(t.mini ? 'SHUSH' : 'STOP TALKIN’', new THREE.Vector3(t.x, t.mini ? 2.6 : 3.6, t.z), HEX.bile, t.mini ? 0.8 : 1);
    } else floatWord('\u2026', new THREE.Vector3(t.x, 3.4, t.z), HEX.ink, 0.6);
    return true;
  }
  return false;
}
const RING = { speed: 8, reach: 11, miniReach: 7 }; // a shout ring's spread (m/s) and how far it runs
function updateTotems(dt) {
  const J = jester(),
    now = performance.now() / 1000,
    nag = naggingTotems(J, dt);
  for (const t of G.totems) {
    t.cd -= dt;
    totemLook(t, nag.includes(t), now, dt);
    for (let i = t.waves.length - 1; i >= 0; i--) if (spreadRing(t, t.waves[i], J, dt)) t.waves.splice(i, 1);
  }
  if (J) J.maskMat.color.setHex(J.cracks >= 1 ? 0xb3a698 : 0xffffff);
}
// in the Jester's fight: the two ready big totems nearest Red Cap, until he has learnt them and again after TOTEM_NAG s idle
function naggingTotems(J, dt) {
  if (!J || state !== 'play') return [];
  G.totemIdle = G.totemIdle == null ? TOTEM_NAG : G.totemIdle + dt; // never rung yet counts as long ago
  if (G.totemIdle < TOTEM_NAG && G.totemTaught) return [];
  const away = t => heroDist(t.x, t.z);
  return G.totems
    .filter(t => !t.mini && t.cd <= 0)
    .sort((a, b) => away(a) - away(b))
    .slice(0, 2);
}
// grey while resting; a nagging one flashes, sparks and says so once; big ones face the camera, small ones keep turning
function totemLook(t, flash, now, dt) {
  const mat = t.m.userData.mat,
    fk = flash ? 0.5 + 0.5 * Math.sin(now * 9) : 0;
  mat.color.setHex(t.cd > 0 ? 0x5a5a5a : 0xffffff);
  if (mat.emissive) mat.emissive.copy(totemGlow.setRGB(0.95, 0.8, 0.15).multiplyScalar(fk * 0.85));
  if (flash && Math.random() < dt * 6)
    burst(new THREE.Vector3(t.x + rand(-0.6, 0.6), rand(0.6, 2.6), t.z + rand(-0.6, 0.6)), [COL.bile, 0xfff2a0, COL.paper], 2, 2, 0.14, {
      g: -2,
      life: 0.8
    });
  if (flash && !t.nagged) floatWord('RING ME', new THREE.Vector3(t.x, 3.6, t.z), HEX.bile, 0.9);
  t.nagged = flash;
  if (t.mini) t.m.rotation.y += dt * 0.25;
  else if (animTick) t.m.rotation.y = Math.atan2(camera.position.x - t.x, camera.position.z - t.z);
  if (animTick) t.m.scale.setScalar((t.mini ? 0.7 : 1) * (t.cd > 0 ? 1 : 1 + Math.sin(now * 6) * 0.03 + fk * 0.08));
}
// does totem t's ring w (radius w.r) pass over who right now?
const ringOn = (t, w, who) => Math.abs(Math.hypot(who.pos.x - t.x, who.pos.z - t.z) - w.r) < who.r * 0.8 + 0.4;
// one shout ring grows and fades; it strikes the Jester once and dazes what it reaches; true once it has run its course
function spreadRing(t, w, J, dt) {
  const reach = t.mini ? RING.miniReach : RING.reach;
  w.r += dt * RING.speed;
  w.m.scale.set(w.r, 1, w.r);
  w.m.material.opacity = clamp(1.3 - w.r / (reach - 1), 0, 1);
  if (J && !w.hit && ringOn(t, w, J)) {
    w.hit = true;
    const was = J.masked;
    jesterStruck(J, t.x, t.z);
    if (was && !J.masked) G.totemTaught = true; // the player has seen what the totems are for
  }
  for (const e of G.enemies) if (ringDazes(t, w, e)) dazeByRing(e, w);
  if (w.r <= reach) return false;
  G.group.remove(w.m);
  w.m.material.dispose();
  return true;
}
// a big totem's ring dazes only the flying heads, a small one's anything awake it reaches (once each)
function ringDazes(t, w, e) {
  if (e.dead || e.dying || e.away || e.caged || e.waiting || TALKERS[e.type].totemProof || w.struck.has(e)) return false;
  if (!t.mini && e.fly == null) return false;
  return ringOn(t, w, e);
}
// a Smoker is shaken out of his smoke (his hushed hook)
function dazeByRing(e, w) {
  const T = TALKERS[e.type];
  w.struck.add(e);
  e.dazedT = Math.max(e.dazedT || 0, T.totemDaze || TOTEM_DAZE);
  e.flash = 0.2;
  if (T.hushed) T.hushed(e);
  floatWord(pick(['SHH', 'HUSH', 'QUIET']), e.pos.clone().setY(hitHeight(e) + 1.4), HEX.bile, 0.8);
}
