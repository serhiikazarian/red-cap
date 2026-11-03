// Totems (floor three): hit one and it shouts a ring (STOP TALKIN'). A big totem's ring cracks the Jester's mask (twice
// shatters it) and dazes the flying heads; a small one's dazes anything it reaches. A big one and its nearest big mate then rest.
// In the Jester's fight the two ready ones nearest Red Cap flash until their shouts first break his mask (G.totemTaught), then
// until he rings one (and again after TOTEM_NAG s).
const TOTEM_NAG = 47,
  TOTEM_CD = 13, // s a big totem (and its nearest big mate) rests after a shout
  TOTEM_MINI_CD = 3.24;
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
      burst(new THREE.Vector3(t.x, t.mini ? 1 : 1.5, t.z), [0xf0cf2e, 0x4fa9df, 0x9bd12c], 10, 4, 0.16);
      const m = new THREE.Mesh(
        t.mini ? TOTEM_MINI_GEO : TOTEM_GEO,
        new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false })
      );
      m.position.set(t.x, t.mini ? 1.6 : 0.9, t.z);
      m.scale.set(0.8, 1, 0.8);
      G.group.add(m);
      t.waves.push({ m, r: 0.8, hit: false, struck: new Set() });
      floatWord(t.mini ? 'SHUSH' : 'STOP TALKIN’', new THREE.Vector3(t.x, t.mini ? 2.6 : 3.6, t.z), '#f0cf2e', t.mini ? 0.8 : 1);
    } else floatWord('\u2026', new THREE.Vector3(t.x, 3.4, t.z), '#0d0b0a', 0.6);
    return true;
  }
  return false;
}
function updTotems(dt) {
  const J = jester(),
    now = performance.now() / 1000;
  let nag = [];
  if (J && state === 'play') {
    G.totemIdle = G.totemIdle == null ? TOTEM_NAG : G.totemIdle + dt; // never rung yet counts as long ago
    if (G.totemIdle >= TOTEM_NAG || !G.totemTaught)
      nag = G.totems
        .filter(t => !t.mini && t.cd <= 0)
        .sort((a, b) => Math.hypot(a.x - hero.pos.x, a.z - hero.pos.z) - Math.hypot(b.x - hero.pos.x, b.z - hero.pos.z))
        .slice(0, 2);
  }
  for (const t of G.totems) {
    t.cd -= dt;
    const flash = nag.includes(t),
      fk = flash ? 0.5 + 0.5 * Math.sin(now * 9) : 0;
    t.m.userData.mat.color.setHex(t.cd > 0 ? 0x5a5a5a : 0xffffff);
    if (t.m.userData.mat.emissive) t.m.userData.mat.emissive.copy(totemGlow.setRGB(0.95, 0.8, 0.15).multiplyScalar(fk * 0.85));
    if (flash && Math.random() < dt * 6)
      burst(new THREE.Vector3(t.x + rand(-0.6, 0.6), rand(0.6, 2.6), t.z + rand(-0.6, 0.6)), [0xf0cf2e, 0xfff2a0, 0xece6da], 2, 2, 0.14, {
        g: -2,
        life: 0.8
      });
    if (flash && !t.nagged) floatWord('RING ME', new THREE.Vector3(t.x, 3.6, t.z), '#f0cf2e', 0.9);
    t.nagged = flash;
    const base = t.mini ? 0.7 : 1;
    if (t.mini)
      t.m.rotation.y += dt * 0.25; // the little ones keep turning
    else if (animTick) t.m.rotation.y = Math.atan2(camera.position.x - t.x, camera.position.z - t.z);
    if (animTick) t.m.scale.setScalar(base * (t.cd > 0 ? 1 : 1 + Math.sin(now * 6) * 0.03 + fk * 0.08));
    const maxR = t.mini ? 7 : 11;
    for (let i = t.waves.length - 1; i >= 0; i--) {
      const w = t.waves[i];
      w.r += dt * 8;
      w.m.scale.set(w.r, 1, w.r);
      w.m.material.opacity = clamp(1.3 - w.r / (maxR - 1), 0, 1);
      if (J && !w.hit && Math.abs(Math.hypot(J.pos.x - t.x, J.pos.z - t.z) - w.r) < J.r * 0.8 + 0.4) {
        w.hit = true;
        const was = J.masked;
        jesterStruck(J, t.x, t.z);
        if (was && !J.masked) G.totemTaught = true; // the player has seen what the totems are for
      }
      // the ring dazes what it reaches (a big one's: only the flying heads); a Smoker is shaken out of his smoke
      for (const e of G.enemies) {
        if (e.dead || e.dying || e.away || e.caged || e.waiting || e.type === 'M' || e.type === 'U' || w.struck.has(e)) continue;
        if (!t.mini && e.fly == null) continue;
        if (Math.abs(Math.hypot(e.pos.x - t.x, e.pos.z - t.z) - w.r) < e.r * 0.8 + 0.4) {
          w.struck.add(e);
          e.dazedT = Math.max(e.dazedT || 0, e.type === 'W' ? 1.8 : 2.2);
          e.flash = 0.2;
          if (e.type === 'S' || e.type === 'W') {
            e.st = 'hover';
            e.t = 2.5;
          }
          floatWord(pick(['SHH', 'HUSH', 'QUIET']), e.pos.clone().setY(hitHeight(e) + 1.4), '#f0cf2e', 0.8);
        }
      }
      if (w.r > maxR) {
        G.group.remove(w.m);
        w.m.material.dispose();
        t.waves.splice(i, 1);
      }
    }
  }
  if (J) J.maskMat.color.setHex(J.cracks >= 1 ? 0xb3a698 : 0xffffff);
}
