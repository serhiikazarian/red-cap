// Pickups: hearts (ties) and pebble piles. Where a dropped heart lands, hearts hidden in quiet corners, and taking them.
const HEART_WALL = 1.2, // metres a heart keeps from a wall (a big one 1.6)
  PILE_PEBBLES = 3; // pebbles in a pile
// doing too well (4+ ties): random heart drops halve, and a floor entered that way hides half its hearts and piles
const WELL = { hp: 4, drop: 0.5, hearts: 0.5, piles: 0.5 };
let PILE = null; // the pile's shape and materials, made once

// a heart lying in the level (a map 'h' or a hidden one) is there by the floor's placedHearts chance, on fresh dice (the layout
// stays the same)
function heartPlaced(F) {
  return Math.random() < (F.placedHearts ?? 1);
}
// open floor: not a wall, prop, gate, or too near a wall or clutter
function openSpot(x, z) {
  const [ix, iz] = cellOf(x, z);
  return (
    !solid(ix, iz) &&
    !propRadius(cellAt(ix, iz)) &&
    cellAt(ix, iz) !== 'g' &&
    wallDist(x, z) > 0.6 &&
    !G.clutter.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 0.6)
  );
}
// a dropped heart lands on clear floor on the same level, in sight of where it fell; it moves the shortest way there (rings
// 0.3 m apart, up to 3.6 m), else stays put
function heartRoom(x, z, big) {
  const need = big ? 1.6 : HEART_WALL,
    y0 = heightAt(x, z),
    ok = (px, pz) => wallDist(px, pz) >= need && openSpot(px, pz) && Math.abs(heightAt(px, pz) - y0) < 0.2;
  if (ok(x, z)) return [x, z];
  const from = { x, z };
  for (let r = 0.3; r <= 3.61; r += 0.3)
    for (let k = 0, n = Math.max(8, Math.round(r * 8)); k < n; k++) {
      const a = (k / n) * TAU,
        px = x + Math.cos(a) * r,
        pz = z + Math.sin(a) * r;
      if (ok(px, pz) && lineOfSight(from, { x: px, z: pz })) return [px, pz];
    }
  return [x, z];
}
// a heart on clear floor between two points, nearer the first
function heartBetween(a, b) {
  for (const k of [0.4, 0.7, 0.15, 1]) {
    const x = lerp(a.x, b.x, k),
      z = lerp(a.z, b.z, k);
    if (k === 1 || (openSpot(x, z) && wallDist(x, z) >= HEART_WALL)) {
      spawnPickup(...heartRoom(x, z));
      return;
    }
  }
}
// on a floor that spreads its hearts, a drop beside another heart moves to the nearest open ground at least 9 m from every heart;
// a small one with nowhere to go within 15 m is not dropped at all
function dropHeart(x, z, big) {
  [x, z] = heartRoom(x, z, big);
  if (!G.F.spreadHearts) return spawnPickup(x, z, big);
  const far = (px, pz) => G.pickups.every(p => p.taken || Math.hypot(p.g.position.x - px, p.g.position.z - pz) >= 9);
  if (far(x, z)) return spawnPickup(x, z, big);
  let best = null,
    bd = 15;
  for (let iz = 1; iz < G.h - 1; iz++)
    for (let ix = 1; ix < G.w - 1; ix++) {
      const c = cellAt(ix, iz),
        cx = cellMid(ix),
        cz = cellMid(iz),
        d = Math.hypot(cx - x, cz - z);
      if (
        d >= bd ||
        solid(ix, iz) ||
        c === 'g' ||
        c === 'o' ||
        c === 'T' ||
        c === 'X' ||
        kindAt(ix, iz) === 2 ||
        !far(cx, cz) ||
        G.cages.some(q => !q.broken && Math.hypot(q.x - cx, q.z - cz) < 2)
      )
        continue;
      best = [cx, cz];
      bd = d;
    }
  if (best) return spawnPickup(best[0], best[1], big);
  if (big) spawnPickup(x, z, big);
}
// a floor's hidden hearts, then piles: open cells clear of the start (12 m) and the talkers (6 m); each pick is the cell
// furthest from the start and the ones already picked, with a bonus for walls round it (a corner, a dead end) and a little
// seeded chance, so it is the same every time
function hideHearts(n, piles = 0) {
  const rng = mulberry(floorIdx * 31 + 5),
    cand = [],
    got = [];
  for (let z = 1; z < G.h - 1; z++)
    for (let x = 1; x < G.w - 1; x++) {
      if (cellAt(x, z) !== '.' || kindAt(x, z) === 2) continue;
      const px = cellMid(x),
        pz = cellMid(z);
      if (!clearOf(px, pz, 0.8) || heroDist(px, pz) < 12) continue;
      if (G.enemies.some(e => Math.hypot(e.pos.x - px, e.pos.z - pz) < 6)) continue;
      const walls = DIRS4.filter(([a, b]) => solid(x + a, z + b)).length;
      cand.push({ x: px, z: pz, w: walls });
    }
  for (let k = 0; k < n + piles && cand.length; k++) {
    let best = null,
      bestS = -1;
    for (const c of cand) {
      const d = Math.min(heroDist(c.x, c.z), ...got.map(g => Math.hypot(c.x - g.x, c.z - g.z)));
      const sc = Math.min(d, 24) + c.w * 4 + rng() * 3;
      if (sc > bestS) {
        bestS = sc;
        best = c;
      }
    }
    got.push(best);
    cand.splice(cand.indexOf(best), 1);
    if (k >= n) {
      pebblePile(...heartRoom(best.x, best.z));
      continue;
    }
    spawnPickup(...heartRoom(best.x, best.z));
    G.pickups[G.pickups.length - 1].hid = true;
  }
}
// a few grey stones heaped up, with a shine that breathes and twinkles
function pebblePile(x, z) {
  if (!PILE) {
    const list = [],
      st = new THREE.IcosahedronGeometry(1, 0);
    [
      [0, 0.13, 0, 0.17],
      [0.2, 0.09, 0.08, 0.12],
      [-0.17, 0.09, 0.12, 0.13],
      [0.06, 0.08, -0.2, 0.11],
      [-0.12, 0.07, -0.14, 0.1],
      [0.05, 0.27, 0.03, 0.11],
      [0.24, 0.06, -0.12, 0.08]
    ].forEach(([px, py, pz, r], k) => list.push([st, M4(px, py, pz, k, k * 2, 0, r, r * 0.8, r)]));
    PILE = {
      g: share(mergeGeos(list)),
      m: share(new THREE.MeshLambertMaterial({ color: 0x6a7078, emissive: 0x2a3440 })),
      glow: share(
        new THREE.SpriteMaterial({
          map: glowTex('#f4f8ff', 'rgba(150,190,255,.65)'),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true
        })
      )
    };
  }
  const m = new THREE.Mesh(PILE.g, PILE.m);
  m.position.set(x, heightAt(x, z), z);
  m.rotation.y = x * 1.3 + z;
  m.scale.setScalar(1.5);
  G.group.add(m);
  const glow = new THREE.Sprite(PILE.glow.clone());
  glow.position.set(x, m.position.y + 0.45, z);
  G.group.add(glow);
  G.piles.push({ m, x, z, glow, ph: x + z });
}
// a tie (a heart) floating over a glow; big: all hearts back
function spawnPickup(x, z, big) {
  const by = heightAt(x, z),
    g = paper('tie', big ? 1.9 : 0.85, big ? 0.16 : 0.08);
  g.position.set(x, 0.9 + by, z);
  G.group.add(g);
  const glow = new THREE.Mesh(
    decalGeo,
    new THREE.MeshBasicMaterial({ map: big ? fireTex : glowRed, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.04 + by, z);
  glow.scale.setScalar(big ? 2 : 0.9);
  G.group.add(glow);
  G.pickups.push({ g, glow, ph: rand(0, 6), by: big ? by - 0.45 : by, big });
}
// ties (hearts) bob and are taken when Red Cap needs one; the room heart appears when he is low; pebble piles glow and are taken
function updatePickups(dt) {
  const now = performance.now() / 1000;
  if (G.F.roomHeart && !G.roomHeartGiven && hero.hp <= 2) {
    const rx = cellMid(G.F.roomHeart[0]),
      rz = cellMid(G.F.roomHeart[1]);
    if (heroDist(rx, rz) < 7) {
      G.roomHeartGiven = true;
      spawnPickup(rx, rz);
      burst(new THREE.Vector3(rx, 1, rz), [COL.tie, COL.bile, COL.paper], 12, 3, 0.14);
    }
  }
  for (const p of G.pickups) {
    if (p.taken) continue;
    p.g.position.y = (p.by || 0) + 0.9 + Math.sin(now * 3 + p.ph) * 0.15;
    p.g.rotation.y += dt * 2.2;
    p.glow.material.opacity = 0.45 + Math.sin(now * 5 + p.ph) * 0.2;
    if (heroDist(p.g.position.x, p.g.position.z) < 1.1 && hero.hp < hero.maxHp) {
      p.taken = true;
      G.group.remove(p.g);
      G.group.remove(p.glow);
      hero.hp = p.big ? hero.maxHp : Math.min(hero.maxHp, hero.hp + 1);
      drawTies();
      if (p.big) floatWord('ALL BETTER', hero.pos.clone().setY(hero.pos.y + 2.6), HEX.bile, 1);
      SFX.pickup();
      burst(p.g.position, [COL.tie, COL.bile, COL.paper], 14, 4, 0.14);
      if (!p.big) floatWord('+1 TIE', p.g.position.clone().setY(2.2), HEX.bile, 0.75);
    }
  }
  for (const p of G.piles)
    if (!p.taken) {
      const k = 0.5 + 0.5 * Math.sin(now * 3.2 + p.ph);
      p.glow.material.opacity = 0.45 + 0.4 * k + (Math.sin(now * 17 + p.ph * 3) > 0.93 ? 0.3 : 0);
      p.glow.scale.setScalar(1.3 + 0.35 * k);
    }
  for (const p of G.piles)
    if (!p.taken && hero.ammo < hero.maxAmmo && heroDist(p.x, p.z) < 1.1) {
      p.taken = true;
      G.group.remove(p.m);
      G.group.remove(p.glow);
      giveAmmo(PILE_PEBBLES, p.m.position);
      burst(p.m.position.clone().setY(p.m.position.y + 0.3), [0x6a7078, 0x2a2e33], 8, 3, 0.12);
    }
}
