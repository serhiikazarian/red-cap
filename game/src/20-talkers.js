// Talkers (the enemies): what they all share. Each type lives in its own file (22-31) and registers itself:
//   TALKERS[letter] = { make(e, add, x, z, part, type), update(e, dt, dist, ux, uz, mv), and optionally
//     dying(e, dt): its own death (default: it topples), dazed(e): what else happens while it reels,
//     bar(e): [status text, lit, big word] for the boss bar (bossBar), warn(e): an attack warning (07-hud),
//   and what is special when hit or torn (damage, kill):
//     shielded(e): true when the blow never reaches it (and the fight does not count as started)
//     struck(e, n, weapon, force): the blow's strength n changed, or null when it is turned away
//     hurt(e): after the blow lands; stagger (s, default 0.38) and knock (default 7): how much a blow shakes and pushes it
//     pops: it pops instead of tearing (no hit sound for its last blow)
//     escape(e): true when it gets away instead (kill stops there); torn(e): before it falls apart
//     tornWord: the word when torn (default TORN, null for none); drops(e): what it leaves (default dropsDefault); gone(e): after
//     trapped(e): a bear trap leaves it reeling (42-traps); bounce(e, p): a pebble bounces off it at p (its reaction)
//     hushed(e): what else a totem's ring does to it (43-totems); aimParts(e, aim): parts the soft lock aims at, aim(at, tgt) each
//     holo(): its drawing for a niche's hologram when it has no drawn frame (45-niches)
//   and traits: rim { col, a, k } (its rim light: colour, opacity, thickness), harmless (does not count as a talker left),
//     loud (its sounds fill the floor instead of coming from where it is), noCover (the yo-yo reaches it without a clear line),
//     totemProof (a totem's ring passes it by), totemDaze (seconds a ring dazes it, default TOTEM_DAZE) }
// update decides the move (mv: direction x, z and speed sp); returning STOP skips the shared movement and collision.
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
    palette: [COL.paper, COL.ink],
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
  const rim = { col: 0xfff3d6, a: 0.95, k: 1, ...TALKERS[e.type].rim },
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
      t = (0.1 + h * 0.025) * rim.k;
    const sx = (w + 2 * t) / w,
      sy = (h + 2 * t) / h,
      cx = (bb.min.x + bb.max.x) / 2,
      cy = (bb.min.y + bb.max.y) / 2;
    const mat = new THREE.MeshBasicMaterial({
      color: rim.col,
      transparent: true,
      opacity: rim.a,
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
// stances that keep their own sway: the shared part leaves the figure's offset alone
const OWN_SWAY = new Set(['wind', 'shout', 'inflate', 'stun', 'laugh']);
// every frame: caged, dying and reeling talkers are handled here; otherwise its own update decides the move, then the shared
// part moves it (rage, stagger, knockback), keeps it off the others, walls, clutter and cages, and sets it on the ground
function updEnemy(e, dt) {
  if (e.dead) return;
  if (e.caged) return updCaged(e, dt);
  const T = TALKERS[e.type];
  if (e.dying) {
    ((T && T.dying) || topple)(e, dt);
    return;
  }
  e.flash = Math.max(0, (e.flash || 0) - dt);
  for (const m of e.mats) m.color.setHex(e.flash > 0 ? 0xff5050 : 0xffffff);
  if (e.dazedT > 0) return updDazed(e, T, dt);
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
  if (!e.still) keepClear(e);
  e.gy = heightAt(e.pos.x, e.pos.z);
  e.pos.y = e.gy;
  e.root.position.copy(e.pos);
  if (animTick) {
    if (e.stagger > 0 && e.st !== 'wind') shake(e.tilt, 0.05);
    else if (!OWN_SWAY.has(e.st)) {
      e.tilt.position.x = e.tilt.position.z = 0;
    }
  }
}
// in a cage: faces Red Cap and rattles (harder while the cage is being hit), standing on the ground
function updCaged(e, dt) {
  faceCam(e, dt);
  const c = e.cage;
  if (c && animTick) {
    shake(e.tilt, c.rattle > 0 ? 0.12 : 0.02);
    if (c.pole) e.tilt.position.z = Math.abs(e.tilt.position.z) * 0.5;
  }
  if (e.fly != null) e.tilt.position.y = e.fly;
  e.gy = heightAt(e.pos.x, e.pos.z);
  e.pos.y = e.gy;
  e.root.position.copy(e.pos);
}
// reeling (a trap's bite, a totem's shout): no attacks, wobbling on the spot, waiting for the finishing blow
function updDazed(e, T, dt) {
  e.dazedT -= dt;
  faceCam(e, dt);
  if (animTick) {
    e.tilt.rotation.z = Math.sin(performance.now() / 110) * 0.16;
    shake(e.tilt, 0.05);
  }
  if (Math.random() < dt * 3) floatWord(pick(['*', '@', '?']), e.pos.clone().setY(hitHeight(e) + 1.2 + rand(0, 0.6)), HEX.bile, 0.5);
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
}
// pushed apart from the other talkers, then off walls, clutter and cages (a flier ignores the ground and the clutter)
function keepClear(e) {
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
    for (const c of G.clutter) {
      const ox = e.pos.x - c.x,
        oz = e.pos.z - c.z,
        od = Math.hypot(ox, oz);
      if (od < c.r + e.r && od > 1e-3) {
        e.pos.x = c.x + (ox / od) * (c.r + e.r);
        e.pos.z = c.z + (oz / od) * (c.r + e.r);
      }
    }
  for (const c of G.cages)
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
// a blow of n to e from direction (dx, dz). force: past shields and masks; weapon: Red Cap's own hand (yo-yo or pebble).
// What is special about a talker comes from its TALKERS entry (see the top of this file), in this order: shielded, struck, hurt
function damage(e, n, dx, dz, force, weapon) {
  if (e.caged) {
    if (e.cage) breakCage(e.cage, true);
    return;
  }
  const T = TALKERS[e.type];
  if (!force && !(e.dazedT > 0) && T.shielded && T.shielded(e)) return;
  if (weapon && e.boss) e.engaged = true;
  if (T.struck) {
    n = T.struck(e, n, weapon, force);
    if (n == null) return;
  }
  e.hp -= n;
  e.flash = 0.14;
  if (T.hurt) T.hurt(e);
  e.stagger = e.rage > 0 ? 0 : (T.stagger ?? 0.38);
  if (!e.still && !(e.rage > 0)) e.knock.set(dx * (T.knock ?? 7), dz * (T.knock ?? 7));
  if (!T.pops || e.hp > 0) SFX.hit(weapon ? mixPitch() : 1); // a talker that pops (the Shade) has its pop alone for the last blow
  burst(e.pos.clone().setY(hitHeight(e)), e.palette, 12, 5, 0.2);
  if (Math.random() < 0.3)
    floatWord(pick(['SH#T!', 'F#CK!', 'SHUT IT', 'STFU', 'F#CK OFF']), e.pos.clone().setY(hitHeight(e) + 1.4 + rand(0, 0.4)), HEX.tie, 0.9);
  if (e.hp <= 0) kill(e);
}
// a heart maybe, by the floor's odds (fewer while Red Cap is well); a boss always leaves a big one
function dropsDefault(e) {
  if (e.boss) dropHeart(e.pos.x, e.pos.z, true);
  else if (!e.first && Math.random() < (G.F.dropOdds[e.type] ?? 0) * (hero.hp >= WELL.hp ? WELL.drop : 1)) dropHeart(e.pos.x, e.pos.z);
}
// torn: the word, what it leaves behind (drops, or dropsDefault) and what it sets off (gone: the gate, the finale)
function kill(e) {
  const T = TALKERS[e.type];
  if (T.escape && T.escape(e)) return;
  if (T.torn) T.torn(e);
  e.dying = 1.1;
  stats.kills++;
  if (T.pops) SFX.shadePop();
  else SFX.tear();
  sprayStop();
  burst(e.pos.clone().setY(hitHeight(e)), e.palette, 34, 7, 0.28);
  const word = T.tornWord === undefined ? 'TORN' : T.tornWord;
  if (word) floatWord(word, e.pos.clone().setY(hitHeight(e) + 1.8), HEX.paper, 1.1);
  (T.drops || dropsDefault)(e);
  bystandersReact(e.pos);
  if (T.gone) T.gone(e);
}
// talkers left (harmless ones, the Shades, do not keep a floor from being clear)
function aliveCount() {
  return G.enemies.filter(e => !e.dead && !e.dying && !TALKERS[e.type].harmless).length;
}
