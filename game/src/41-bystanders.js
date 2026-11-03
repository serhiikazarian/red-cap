// Onlookers: the Hat (hums), Spike (giggles), Long Hair (exhales smoke and opinions). They stand against walls, turn to watch
// Red Cap, step aside, and some slip him pebbles. Long Hair's smoke hides him from shooters. Hit one and they turn their back
// for good (and shake out pebbles, or a heart if he has been on his last tie a while).

// one onlooker against a wall (each a slightly different height); whether it will give pebbles is rolled once
function makeBystander(kind, x, z, wallYaw) {
  const root = new THREE.Group(),
    face = new THREE.Group(),
    tilt = new THREE.Group();
  root.add(face);
  face.add(tilt);
  const h = { npc_hat: 2.25, npc_spike: 2.05, npc_hair: 1.95 }[kind] * rand(0.92, 1.08);
  tilt.add(paper(kind, h, 0.05, false, true));
  groundShadow(root, 0.55, 0.3, 0.35);
  root.position.set(x, heightAt(x, z), z);
  G.group.add(seeThru(root, false, 'hard')); // never fades
  keepOut(x, z, 0.6);
  const fi = FLOORS.indexOf(G.F),
    gift = [1, 1, 2][fi] ?? 1,
    gives = Math.random() < [0.2, 0.45, 0.6][fi];
  G.npcs.push({
    root,
    face,
    tilt,
    pos: root.position,
    yaw: wallYaw,
    rest: wallYaw,
    seed: rand(0, 100),
    t: rand(3, 9),
    lean: 0,
    kind,
    h,
    smoke: 0,
    gift,
    gave: !gives,
    mat: tilt.children[0].userData.mat
  });
}
// count onlookers in floor cells with exactly one wall beside them, away from the start
function placeBystanders(rng, count) {
  const spots = [],
    [px, pz] = cellOf(hero.pos.x, hero.pos.z);
  for (let z = 1; z < G.h - 1; z++)
    for (let x = 1; x < G.w - 1; x++) {
      if (G.map[z][x] !== '.' || Math.abs(x - px) + Math.abs(z - pz) < 3 || kindAt(x, z) === 2) continue;
      const walls = DIRS4.filter(([a, b]) => G.map[z + b][x + a] === '#');
      if (walls.length === 1) spots.push([x, z, walls[0]]);
    }
  const kinds = ['npc_hat', 'npc_spike', 'npc_hair'];
  for (let k = 0; k < count && spots.length; ) {
    const [x, z, [wx, wz]] = spots.splice((rng() * spots.length) | 0, 1)[0];
    const side = (rng() - 0.5) * 1.4;
    const cx = x * CELL + CELL / 2 + wx * 1.05 + wz * side,
      cz = z * CELL + CELL / 2 + wz * 1.05 + wx * side;
    if (!clearOf(cx, cz, 0.5)) continue;
    makeBystander(kinds[k % 3], cx, cz, Math.atan2(-wx, -wz));
    k++;
  }
}
function updBystanders(dt) {
  const now = performance.now() / 1000;
  // inside Long Hair's smoke, shooters lose Red Cap
  hero.inSmoke = G.npcs.some(n => n.kind === 'npc_hair' && !n.offended && Math.hypot(hero.pos.x - n.pos.x, hero.pos.z - n.pos.z) < 1.8);
  for (const n of G.npcs) {
    const dx = hero.pos.x - n.pos.x,
      dz = hero.pos.z - n.pos.z,
      d = Math.hypot(dx, dz);
    const target = n.offended ? Math.atan2(dx, dz) + Math.PI : d < 11 ? Math.atan2(dx, dz) : n.rest;
    n.yaw += angDiff(n.yaw, target) * (1 - Math.exp(-2.2 * dt));
    n.lean = lerp(n.lean, d < 2.6 && !n.offended ? 0.22 : n.offended ? -0.08 : 0, 1 - Math.exp(-6 * dt));
    if (animTick) {
      n.face.rotation.y = n.yaw + Math.sin(now * 0.8 + n.seed) * 0.06;
      n.tilt.rotation.x = -n.lean;
      n.tilt.rotation.z = Math.sin(now * 1.3 + n.seed) * 0.03;
    }
    // onlookers step aside instead of pinning Red Cap against a wall
    if (!n.home) n.home = n.pos.clone();
    if (d < 1.3 && d > 1e-3) {
      n.pos.x -= (dx / d) * (1.3 - d) * 0.6;
      n.pos.z -= (dz / d) * (1.3 - d) * 0.6;
      collide(n.pos, 0.3, n.pos.y);
    } else {
      n.pos.x = lerp(n.pos.x, n.home.x, 1 - Math.exp(-1.5 * dt));
      n.pos.z = lerp(n.pos.z, n.home.z, 1 - Math.exp(-1.5 * dt));
    }
    if (d < 1.9 && !n.gave && state === 'play' && hero.ammo < hero.maxAmmo) {
      n.gave = true;
      npcVoice(n);
      giveAmmo(n.gift, n.pos);
    }
    n.pos.y = heightAt(n.pos.x, n.pos.z);
    if (n.kind === 'npc_spike' && d < 6 && animTick) n.tilt.rotation.z = rand(-0.14, 0.14); // can't keep still near Red Cap
    if (n.kind === 'npc_hair') {
      n.smoke -= dt;
      if (n.smoke <= 0) {
        n.smoke = 0.45; // Long Hair keeps exhaling smoke
        smokePuff(new THREE.Vector3(n.pos.x + Math.sin(n.yaw) * 0.35, n.pos.y + n.h * 0.7, n.pos.z + Math.cos(n.yaw) * 0.35), 0.35, 2.2, 0.45);
      }
    }
    n.t -= dt;
    if (n.t <= 0 && state === 'play') {
      n.t = rand(12, 24);
      if (d < 9 && !n.offended) npcVoice(n, 0.6);
    }
  }
  // how long Red Cap has been on his last tie (hitNpc)
  G.lastTieT = state === 'play' && hero.hp === 1 ? (G.lastTieT || 0) + dt : state === 'play' ? 0 : G.lastTieT || 0;
}
// each onlooker has a voice: the hat hums, the spiky one giggles, the long-haired one exhales and coughs
function npcVoice(n, vol = 1) {
  const g = vol;
  if (n.kind === 'npc_hat') {
    sTone({ f: 165, f2: 150, dur: 0.17, type: 'triangle', gain: 0.13 * g, filt: [700, 380] });
    sTone({ f: 178, f2: 160, dur: 0.22, type: 'triangle', gain: 0.13 * g, at: 0.24, filt: [700, 380] });
  } else if (n.kind === 'npc_spike') {
    for (let i = 0; i < 4; i++)
      sTone({ f: 880 + i * 95 + rand(-40, 40), f2: 760, dur: 0.07, type: 'square', gain: 0.035 * g, at: i * 0.085, filt: [2600, 1500] });
  } else {
    sNoise({ dur: 0.9, f: 900, f2: 380, type: 'lowpass', q: 0.7, gain: 0.11 * g });
    sNoise({ dur: 0.12, f: 520, q: 2, gain: 0.16 * g, at: 0.95 });
    sNoise({ dur: 0.1, f: 480, q: 2, gain: 0.12 * g, at: 1.12 });
  }
}
// hitting an onlooker shakes three pebbles loose, once; after that they turn their back and never help again
function hitNpc(p, rad) {
  if (!G || !G.npcs) return false;
  for (const n of G.npcs) {
    if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > 0.45 + rad || p.y < n.pos.y - 0.1 || p.y > n.pos.y + n.h + 0.2) continue;
    if (hero.hp === 1 && G.lastTieT > 16 && (G.npcHearts || 0) < 2) {
      // on the last tie for a while: the heart is shaken out of him
      G.npcHearts = (G.npcHearts || 0) + 1;
      G.lastTieT = 0;
      heartBetween(n.pos, hero.pos);
      burst(n.pos.clone().setY(n.pos.y + n.h * 0.6), [COL.tie, COL.paper], 10, 3, 0.14);
    }
    if (n.offended) {
      sTone({ f: 140, dur: 0.08, type: 'square', gain: 0.05 });
      return true;
    }
    n.offended = true;
    n.gave = true;
    stats.npc[floorIdx] = (stats.npc[floorIdx] || 0) + 1;
    n.mat.color.setHex(0x8a8580);
    n.tilt.position.x = 0.1;
    sTone({ f: 330, f2: 130, dur: 0.35, type: 'sawtooth', gain: 0.07, filt: [900, 300] });
    npcVoice(n, 0.5);
    burst(n.pos.clone().setY(n.pos.y + n.h * 0.6), [COL.paper, COL.smoke, COL.ink], 8, 3, 0.14);
    giveAmmo(2, n.pos);
    if (!G.npcHint) {
      G.npcHint = true;
      toast('They will remember that.');
    }
    return true;
  }
  return false;
}
// a talker torn nearby: some onlookers react
function bystandersReact(pos) {
  for (const n of G.npcs)
    if (!n.offended && n.pos.distanceTo(pos) < 12 && Math.random() < 0.25) later(rand(0.2, 0.9), () => G.npcs.includes(n) && npcVoice(n, 0.7));
}
