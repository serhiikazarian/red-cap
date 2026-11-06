// Floor two's prisoners (FLOORS[].cages): Bruno tied to a stake, Grins in iron cages. Walk up and the prisoner rattles until
// the cage gives (he comes out enraged); smash it from range and he falls out dazed.
function buildCages(F) {
  G.cages = [];
  for (const [x, z, type] of F.cages || []) {
    const cx = cellMid(x),
      cz = cellMid(z);
    let e = G.enemies.find(q => q.type === type && cellOf(q.pos.x, q.pos.z)[0] === x && cellOf(q.pos.x, q.pos.z)[1] === z) || makeEnemy(type, cx, cz);
    e.caged = true;
    if (e.fly != null) e.fly = 1.3;
    const g = new THREE.Group();
    g.position.set(cx, heightAt(cx, cz), cz);
    G.group.add(g);
    const parts = type === 'Z' ? brunoStake(e, g) : { roof: ironCage(g) };
    G.cages.push({ g, ...parts, e, x: cx, z: cz, rattle: 0, broken: false });
    keepOut(cx, cz, 1.7);
  }
}
// Bruno's stake: it stands just behind him whichever way the camera looks, the ropes go round both, a scorch mark under him;
// the ropes are the cage's roof (they go when it breaks), the pole may stay
function brunoStake(e, g) {
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a5a2a, emissive: 0x4a1c08 }),
    cord = new THREE.MeshLambertMaterial({ color: 0xc9a25a, emissive: 0x2a1606 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 4.4, 10), wood);
  pole.position.set(0, 2.2, -0.38);
  e.face.add(pole);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), wood);
  tip.position.y = 2.45;
  pole.add(tip);
  const ropes = new THREE.Group(),
    half = sizeOf('bruno', 3).w * 0.33;
  for (const [y, k] of [
    [0.35, 1.05],
    [0.8, 1.12],
    [1.25, 1.06]
  ]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 5, 20), cord);
    t.rotation.x = Math.PI / 2;
    t.scale.set(half * k, 0.45, 1);
    t.position.set(0, y, -0.22);
    t.rotation.z = (Math.random() - 0.5) * 0.25;
    ropes.add(t);
  }
  e.tilt.add(ropes);
  const scorchM = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.5, depthWrite: false }));
  scorchM.rotation.x = -Math.PI / 2;
  scorchM.position.y = 0.02;
  scorchM.scale.setScalar(1.2);
  g.add(scorchM);
  return { roof: ropes, pole };
}
// a Grin's iron cage: a base, a lid and twenty bars, alternately iron and rust, a little crooked; returns the lid and bars
function ironCage(g) {
  const iron = new THREE.MeshLambertMaterial({ color: 0x2a2522 }),
    rust = new THREE.MeshLambertMaterial({ color: 0x7a281b });
  const W = 2.3,
    H = 2.9;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, W), iron);
  base.position.y = 0.08;
  g.add(base);
  const barG = new THREE.CylinderGeometry(0.05, 0.05, H, 6),
    ironL = [[new THREE.BoxGeometry(W, 0.18, W), M4(0, H, 0)]],
    rustL = [];
  for (let side = 0; side < 4; side++)
    for (let i = -2; i <= 2; i++) {
      const o = i * 0.46,
        h = W * 0.48;
      (i % 2 ? rustL : ironL).push([
        barG,
        M4(side < 2 ? o : side === 2 ? h : -h, H / 2, side < 2 ? (side ? -h : h) : o, 0, 0, (Math.random() - 0.5) * 0.07)
      ]);
    }
  const roof = new THREE.Mesh(mergeGeos(ironL), iron),
    rustBars = new THREE.Mesh(mergeGeos(rustL), rust);
  g.add(roof, rustBars);
  barG.dispose(); // merged into the two pieces above
  return roof;
}
function breakCage(c, byHit) {
  if (c.broken) return;
  c.broken = true;
  // a cage goes entirely; a stake stays standing (in the way, like a prop) with its scorch mark, only the ropes go
  if (!c.pole) c.g.visible = false;
  else c.roof.visible = false;
  if (c.pole) {
    const wp = c.pole.getWorldPosition(new THREE.Vector3());
    c.pole.parent.remove(c.pole);
    c.pole.position.copy(wp);
    c.pole.rotation.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
    G.group.add(c.pole);
    G.stakes.push({ x: wp.x, z: wp.z, r: 0.27 });
    sNoise({ dur: 0.3, f: 1800, f2: 600, q: 2, gain: 0.25 });
    burst(new THREE.Vector3(c.x, 1.3 + c.g.position.y, c.z), [0x9a7a4a, 0x6a4a2a, COL.hot], 26, 6, 0.2);
    cam.shake = Math.max(cam.shake, 0.25);
  } else {
    SFX.boom();
    sTone({ f: 260, f2: 35, dur: 0.35, type: 'square', gain: 0.12 });
    cam.shake = Math.max(cam.shake, 0.35);
    burst(new THREE.Vector3(c.x, 1.4 + c.g.position.y, c.z), [0x2a2522, 0x7a281b, 0xe8c628], 30, 9, 0.26);
  }
  const e = c.e;
  e.caged = false;
  if (byHit) {
    e.stagger = 1.6;
    floatWord('HUH?', e.pos.clone().setY(3), HEX.paper, 0.9);
  } else {
    e.enraged = true;
    e.t = 0;
    const dx = hero.pos.x - e.pos.x,
      dz = hero.pos.z - e.pos.z,
      d = Math.hypot(dx, dz) || 1;
    e.knock.set((dx / d) * 7, (dz / d) * 7);
    floatWord('LET ME OUT', e.pos.clone().setY(3.2), HEX.tie, 1);
  }
}
// rattling while Red Cap is near and in sight; it gives after 0.9 s of it
function updCages(dt) {
  for (const c of G.cages) {
    if (c.broken) continue;
    const d = Math.hypot(hero.pos.x - c.x, hero.pos.z - c.z);
    if (d < 5.5 && los(hero.pos, new THREE.Vector3(c.x, 0, c.z))) {
      c.rattle += dt;
      c.g.position.x = c.x + rand(-0.08, 0.08);
      c.g.position.z = c.z + rand(-0.08, 0.08);
      if (Math.random() < dt * 8) sTone({ f: rand(300, 500), dur: 0.05, type: 'square', gain: 0.05 });
      if (c.rattle > 0.9) breakCage(c, false);
    } else {
      c.rattle = Math.max(0, c.rattle - dt);
      c.g.position.x = c.x + Math.sin(performance.now() / 50 + c.x) * 0.015;
      c.g.position.z = c.z;
    }
  }
}
