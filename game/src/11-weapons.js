// Red Cap's weapons. The yo-yo: a chain of three throws (the third slow and heavy) that sweeps a loop out and back; anything the
// string brushes is hit. The slingshot: a pull, then a pebble that homes a little on the locked target. The mix chain: switching
// between the two within MIX.win builds a chain (up to 5) that shortens waits (hits come faster), adds power and raises the hits' pitch.
const YOYO_DMG = 1.5,
  PEBBLE_DMG = 0.75; // the yo-yo is the honest weapon; the slingshot is for reach, not for winning
// the chain's [cooldown, swing] for throws 1, 2, 3: 2 cuts 1 a little and is quick, 3 is slow and heavy
const YOYO_TIME = [
    [0.36, 0.42],
    [0.34, 0.34],
    [0.96, 0.6]
  ],
  YOYO_QUEUE = 0.15, // a press this early is kept and thrown when ready
  YOYO_CUT_BLEND = 0.07, // seconds a cut-short throw takes to blend into the new one
  YOYO_STRETCH = 1.2, // metres the reach may stretch to meet a locked target
  YOYO_GRACE = 0.15; // what the string looks like it brushes, it hits
const MIX = { win: 1.2, max: 5, cd: 0.09, pow: 0.03, semi: 2 }; // semi: semitones each step of the chain raises a hit
const PEBBLE_RANGE = 24; // metres a pebble flies before it drops
const mixCd = () => 1 - MIX.cd * (hero.mix || 0),
  mixPow = () => 1 + MIX.pow * (hero.mix || 0),
  mixPitch = () => (hero.mix && performance.now() / 1000 - hero.mixAt < MIX.win ? Math.pow(2, (MIX.semi * hero.mix) / 12) : 1);
const yoyoNextThird = () => hero.combo === 2 && performance.now() / 1000 - (hero.lastThrow || -9) < 1.1;
const yoyoStop = y => (hitStop = Math.max(hitStop, y.power > 1 ? 0.09 : 0.055)); // a beat of stillness when it connects
// reused points (no garbage a frame): the throwing hand, the yo-yo, the string's in-between tips, the middle of a string or band
const tmpY = new THREE.Vector3(),
  yyHand = new THREE.Vector3(),
  yyTip = new THREE.Vector3(),
  yyStep = new THREE.Vector3(),
  yyMid = new THREE.Vector3();
// the yo-yo's tail in the air: a black ink stroke along the last part of its path (YY_TRAIL.k of a throw's time), thick at
// the yo-yo and tapering to nothing; it shrinks away once the throw ends
const YY_TRAIL = { n: 48, k: 0.2, w: 0.075 },
  yyTrail = (() => {
    const g = share(new THREE.BufferGeometry()),
      idx = [];
    for (let i = 0; i < YY_TRAIL.n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(YY_TRAIL.n * 6), 3));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, share(new THREE.MeshBasicMaterial({ color: COL.ink, side: THREE.DoubleSide })));
    m.frustumCulled = false;
    m.userData = { pts: [], clock: 0, span: 0.1 };
    return m;
  })(),
  yyA = new THREE.Vector3(),
  yyB = new THREE.Vector3();
// each frame: p (the yo-yo, or null between throws) joins the stroke, points older than its span leave, and the ribbon is
// rebuilt facing the camera
function yyTrailTick(dt, p) {
  const u = yyTrail.userData,
    pts = u.pts,
    P = yyTrail.geometry.attributes.position;
  u.clock += dt;
  if (p) pts.push({ x: p.x, y: p.y, z: p.z, t: u.clock });
  while (pts.length > YY_TRAIL.n || (pts.length && u.clock - pts[0].t > u.span)) pts.shift();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)],
      q = pts[i];
    yyA.set(b.x - a.x, b.y - a.y, b.z - a.z); // along the path
    yyB.set(camera.position.x - q.x, camera.position.y - q.y, camera.position.z - q.z); // to the camera
    yyA.cross(yyB);
    const l = yyA.length(),
      w = (YY_TRAIL.w * (i + 1)) / n; // thin at the tail, full at the yo-yo
    if (l > 1e-6) yyA.multiplyScalar(w / l);
    else yyA.set(0, w, 0);
    P.setXYZ(i * 2, q.x + yyA.x, q.y + yyA.y, q.z + yyA.z);
    P.setXYZ(i * 2 + 1, q.x - yyA.x, q.y - yyA.y, q.z - yyA.z);
  }
  P.needsUpdate = true;
  yyTrail.geometry.setDrawRange(0, Math.max(0, n - 1) * 6);
}
const pebbles = [];
const pebbleGeo = share(new THREE.IcosahedronGeometry(0.13, 0)),
  pebbleMat = share(new THREE.MeshBasicMaterial({ color: COL.smoke }));
let slingG = null,
  slingT = 0, // the pull's time left (0.62 s: draw back, release at 0.13 s, the band settles)
  slingFired = true;
const slingDir = new THREE.Vector3(0, 0, -1);

// how far the yo-yo has to fly to meet a target: its usual reach if that is enough, a stretched one, or null (out of reach)
function yoyoReachFor(t, base) {
  const need = Math.hypot(t.pos.x - hero.pos.x, t.pos.z - hero.pos.z) - 0.25 - (t.r || 0.4) - 0.25; // the tip just inside its near edge
  return need <= base ? base : need <= base + YOYO_STRETCH ? need : null;
}
// a shot of kind 'y' or 's': the chain grows on a switch made in time, else starts again
function mixStep(kind) {
  const now = performance.now() / 1000;
  hero.mix = hero.mixLast && hero.mixLast !== kind && now - hero.mixAt < MIX.win ? Math.min(MIX.max, (hero.mix || 0) + 1) : 0;
  hero.mixLast = kind;
  hero.mixAt = now;
}
function yoyo() {
  if (state === 'play' && hero.yoyoCd > 0 && hero.yoyoCd < YOYO_QUEUE) hero.yoyoQ = true;
  if (state !== 'play' || hero.yoyoCd > 0 || hero.dodgeT > 0 || hero.stun > 0) return;
  hero.yoyoQ = false;
  const a = aimInfo(),
    third = yoyoNextThird(),
    base = third ? 4.5 : 3.8,
    reach = a.target ? yoyoReachFor(a.target, base) : null;
  let fx = a.fx,
    fz = a.fz;
  if (reach !== null) {
    // in reach (stretched or not): the throw turns to the target
    const dx = a.target.pos.x - hero.pos.x,
      dz = a.target.pos.z - hero.pos.z,
      d = Math.hypot(dx, dz) || 1;
    fx = dx / d;
    fz = dz / d;
  }
  G.yySide = -(G.yySide || 1);
  const now = performance.now() / 1000;
  hero.combo = third ? 3 : now - (hero.lastThrow || -9) < 1.1 ? ((hero.combo || 0) % 3) + 1 : 1;
  hero.lastThrow = now;
  const power = third ? 2 : 1,
    tm = YOYO_TIME[hero.combo - 1],
    cut = hero.yy ? yoyoMesh.position.clone() : null; // the last throw is still coming back: this one starts where it is
  hero.aimT = 1.1;
  mixStep('y');
  hero.yoyoCd = tm[0] * mixCd();
  yyTrail.userData.pts.length = 0; // a new throw, a new stroke
  yyTrail.userData.span = tm[1] * YY_TRAIL.k;
  hero.yy = { t: 0, dur: tm[1], fx, fz, hit: new Set(), reach: reach ?? base, side: G.yySide, power, cut, mixP: mixPow() };
  SFX.yoyo();
  if (third) {
    sTone({ f: 110, f2: 70, dur: 0.25, type: 'sawtooth', gain: 0.12, filt: [800, 200] });
    yoyoMesh.scale.setScalar(1.5);
  } else yoyoMesh.scale.setScalar(1);
  hero.flip = fx * Math.cos(cam.yaw) - fz * Math.sin(cam.yaw) >= 0 ? 1 : -1;
  yoyoMesh.visible = stringMesh.visible = true;
  // point blank: hit at once
  for (const e of G.enemies) {
    if (e.dead || e.dying || e.away) continue;
    const d = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z);
    if (d < e.r + 0.9 && (TALKERS[e.type].noCover || los(hero.pos, e.pos))) {
      hero.yy.hit.add(e);
      damage(e, YOYO_DMG * hero.yy.power * hero.yy.mixP, fx * hero.yy.power, fz * hero.yy.power, false, true);
      yoyoStop(hero.yy);
    }
  }
}
function updYoyo(dt) {
  const y = hero.yy;
  if (!y) {
    yyTrailTick(dt, null);
    return;
  }
  y.t += dt;
  const k = y.t / y.dur;
  const hand = yyHand.set(hero.pos.x + y.fz * 0.25 * hero.flip, 1.05 + hero.pos.y, hero.pos.z - y.fx * 0.25 * hero.flip),
    p = yoyoTip(y, hand, k, yyTip);
  if (y.cut && y.t < YOYO_CUT_BLEND) p.lerp(y.cut, 1 - y.t / YOYO_CUT_BLEND);
  burst(p, [COL.tie, COL.bile, COL.paper], y.power > 1 ? 3 : 1, y.power > 1 ? 0.9 : 0.4, y.power > 1 ? 0.26 : 0.2, { g: 0, life: 0.3 });
  // a wall turns it back
  const [ix, iz] = cellOf(p.x, p.z);
  if (solid(ix, iz) && k < 0.5) {
    y.t = y.dur * (1 - k);
    y.k0next = 1 - k;
    burst(p, [COL.paper, COL.ink], 5, 3, 0.12);
  }
  yoyoMesh.position.copy(p);
  yyTrailTick(dt, p);
  yoyoMesh.rotation.y = Math.atan2(y.fx, y.fz);
  yoyoMesh.children.forEach(c => (c.rotation.x += dt * 40));
  const mid = yyMid.copy(hand).add(p).multiplyScalar(0.5),
    len = hand.distanceTo(p);
  stringMesh.position.copy(mid);
  stringMesh.scale.set(1, Math.max(len, 0.01), 1);
  stringMesh.quaternion.setFromUnitVectors(UP, tmpY.copy(p).sub(hand).normalize());
  const k0 = Math.min(y.k0 ?? 0, k),
    steps = Math.min(6, Math.max(1, Math.ceil((k - k0) * 12)));
  // the string is tested at most a twelfth of the swing apart, so a fast throw skips nothing
  y.k0 = y.k0next ?? k;
  y.k0next = null;
  for (let i = 1; i <= steps; i++) yoyoHits(y, hand, i === steps ? p : yoyoTip(y, hand, k0 + ((k - k0) * i) / steps, yyStep));
  if (k >= 1) {
    hero.yy = null;
    yoyoMesh.visible = stringMesh.visible = false;
  }
}
// where the yo-yo is at k (0..1) of its swing (into out): out on one side, back on the other, a wide loop that is easy to read
function yoyoTip(y, hand, k, out) {
  const o = Math.sin(Math.min(k, 1) * Math.PI),
    lat = y.side * 1.6 * Math.sin(Math.min(k, 1) * TAU);
  return out.set(hand.x + y.fx * y.reach * o - y.fz * lat, 1.15 + hero.pos.y + o * 0.35, hand.z + y.fz * y.reach * o + y.fx * lat);
}
// the string's point (x, z) is out in the open, reached from the hand, and sees the talker: no blows through a wall or round a
// corner (the Geezer is left as he was)
function yoyoClear(hand, x, z, at) {
  return !solid(...cellOf(x, z)) && los(hand, tmpY.set(x, 0, z)) && los(tmpY, at);
}
// the string from hand to p: each talker it brushes is hit once per throw; ghosts, holograms, totems, pyramids, fallen faces
// and plaques along it too; onlookers only by the yo-yo itself (brushing one with the string is never a strike)
function yoyoHits(y, hand, p) {
  const sx = p.x - hand.x,
    sz = p.z - hand.z,
    sl = sx * sx + sz * sz || 1e-6;
  for (const e of G.enemies) {
    if (e.dead || e.dying || e.away || y.hit.has(e)) continue;
    const t = clamp(((e.pos.x - hand.x) * sx + (e.pos.z - hand.z) * sz) / sl, 0, 1),
      qx = hand.x + sx * t,
      qz = hand.z + sz * t;
    const d = Math.hypot(e.pos.x - qx, e.pos.z - qz),
      py = lerp(hand.y, p.y, t) - (e.gy || 0),
      tip = t > 0.96,
      g = YOYO_GRACE;
    if (
      d < e.r + (tip ? 0.45 : 0.32) + g &&
      py > e.y0 - 0.5 - g &&
      py < e.y1 + 0.5 + g &&
      (TALKERS[e.type].noCover || yoyoClear(hand, qx, qz, e.pos))
    ) {
      y.hit.add(e);
      damage(e, YOYO_DMG * y.power * y.mixP, y.fx * y.power, y.fz * y.power, false, true);
      cam.shake = Math.max(cam.shake, y.power > 1 ? 0.22 : 0.15);
      yoyoStop(y);
    }
  }
  const ns = Math.max(1, Math.ceil(Math.sqrt(sl) / 0.5)),
    g = YOYO_GRACE;
  for (let i = 1; i <= ns; i++) {
    const k2 = i / ns,
      q = tmpY.set(hand.x + sx * k2, lerp(hand.y, p.y, k2), hand.z + sz * k2);
    hitGhost(q, 0.3 + g);
    hitHolo(q, 0.2 + g);
    if (!y.totem && hitTotem(q, 0.25 + g)) y.totem = true;
    if (!y.pyr && hitPyr(q, 0.2 + g)) y.pyr = true;
    kickFace(q, 0.5 + g);
    hitPlaque(q, 0.3 + g);
    hitWord(q, 0.3 + g);
  }
  if (!y.npc && hitNpc(p, 0.3)) y.npc = true;
}
// the slingshot: a wooden fork with a yellow grip, two red bands and a pouch
function buildSling() {
  const g = new THREE.Group(),
    wood = new THREE.MeshBasicMaterial({ color: 0xa8662c });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 8), wood);
  handle.position.y = -0.25;
  g.add(handle);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.2, 8), new THREE.MeshBasicMaterial({ color: COL.bile }));
  grip.position.y = -0.34;
  g.add(grip);
  [-1, 1].forEach(s => {
    const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.06, 0.42, 8), wood);
    pr.position.set(s * 0.13, 0.17, 0);
    pr.rotation.z = -s * 0.55;
    g.add(pr);
  });
  const bandM = new THREE.MeshBasicMaterial({ color: 0xe0303a });
  g.userData.bands = [0, 1].map(() => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 5), bandM);
    g.add(b);
    return b;
  });
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.07), new THREE.MeshBasicMaterial({ color: 0x3a2414 }));
  pouch.position.y = 0.3;
  g.add(pouch);
  g.userData.pouch = pouch;
  g.userData.tips = [new THREE.Vector3(-0.24, 0.35, 0), new THREE.Vector3(0.24, 0.35, 0)];
  g.visible = false;
  return g;
}
function updSling(dt) {
  if (!slingG) return;
  if (slingT <= 0) {
    slingG.visible = false;
    return;
  }
  slingT -= dt;
  const el = 0.62 - slingT;
  const pouch = slingG.userData.pouch;
  // held out to the camera's right of Red Cap (never hidden behind him), pointed at the shot
  slingG.visible = true;
  const crx = Math.cos(cam.yaw),
    crz = -Math.sin(cam.yaw);
  slingG.position.set(hero.pos.x + crx * 0.62 + slingDir.x * 0.3, 1.35 + hero.pos.y, hero.pos.z + crz * 0.62 + slingDir.z * 0.3);
  slingG.rotation.y = Math.atan2(slingDir.x, slingDir.z);
  if (el < 0.13)
    pouch.position.z = -0.1 - (el / 0.13) * 0.5; // draw back
  else {
    if (!slingFired) fireSling();
    const k = el - 0.13;
    pouch.position.z = 0.06 + Math.sin(k * 40) * 0.12 * Math.exp(-k * 7);
  }
  slingG.scale.setScalar(1.4 * (slingT < 0.12 ? Math.max(slingT, 0) / 0.12 : 1));
  slingG.userData.bands.forEach((b, i) => {
    const tip = slingG.userData.tips[i],
      pp = pouch.position,
      mid = yyMid.copy(tip).add(pp).multiplyScalar(0.5);
    b.position.copy(mid);
    b.scale.y = Math.max(tip.distanceTo(pp), 0.01);
    b.quaternion.setFromUnitVectors(UP, tmpY.copy(pp).sub(tip).normalize());
  });
}
// the pebble count on the weapon buttons
function updAmmo() {
  $('#wSling').textContent = 'Slingshot \u00d7' + hero.ammo;
  $('#bSling').textContent = 'Sling ' + hero.ammo;
}
function giveAmmo(n, pos) {
  const add = Math.min(n, hero.maxAmmo - hero.ammo);
  if (add <= 0) return;
  hero.ammo += add;
  updAmmo();
  SFX.pickup();
  floatWord('+' + add + ' PEBBLES', pos.clone().setY(2.6), HEX.bile, 0.7);
}
function sling() {
  if (state !== 'play' || hero.slingCd > 0 || hero.dodgeT > 0 || hero.stun > 0) return;
  if (hero.ammo <= 0) {
    hero.slingCd = 0.35;
    sTone({ f: 220, dur: 0.05, type: 'square', gain: 0.08 });
    floatWord('EMPTY', hero.pos.clone().setY(2.6), HEX.smoke, 0.7);
    return;
  }
  hero.ammo--;
  updAmmo();
  hero.aimT = 1.4;
  mixStep('s');
  hero.slingCd = 0.55 * mixCd();
  hero.slingMixP = mixPow(); // the pebble pulled now carries the chain's power
  slingT = 0.62;
  slingFired = false;
  const a = aimInfo(true);
  hero.slingTarget = a.target; // the lock is taken at the pull, not when the pebble leaves
  if (a.target) {
    const dx = a.target.pos.x - hero.pos.x,
      dz = a.target.pos.z - hero.pos.z,
      d = Math.hypot(dx, dz) || 1;
    slingDir.set(dx / d, 0, dz / d);
  } else slingDir.set(a.fx, 0, a.fz);
  hero.flip = slingDir.x * Math.cos(cam.yaw) - slingDir.z * Math.sin(cam.yaw) >= 0 ? 1 : -1;
  sTone({ f: 140, f2: 240, dur: 0.13, type: 'triangle', gain: 0.1 });
}
function fireSling() {
  slingFired = true;
  SFX.sling();
  slingG.updateMatrixWorld(true);
  const a = aimInfo(true),
    from = slingG.localToWorld(slingG.userData.pouch.position.clone()),
    held = hero.slingTarget;
  if (held && !held.dead && !held.dying && !held.hidden) a.target = held;
  let to;
  if (a.target) to = a.target.pos.clone().setY(hitHeight(a.target));
  else to = new THREE.Vector3(hero.pos.x + slingDir.x * 25, 1.35 + hero.pos.y, hero.pos.z + slingDir.z * 25);
  const dir = to.sub(from).normalize();
  const m = new THREE.Mesh(pebbleGeo, pebbleMat);
  m.position.copy(from).addScaledVector(dir, 0.2);
  G.group.add(m);
  pebbles.push({ m, v: dir.multiplyScalar(26), life: 1.3, target: a.target, pw: hero.slingMixP || 1 });
  floatWord('THWIP', from.clone().setY(2.4), HEX.paper, 0.6);
  burst(from, [COL.paper, COL.bile], 5, 3, 0.1, { g: 0, life: 0.4 });
}
// pebbles fly in three steps a frame; walls, the floor, range and anything they meet stop them; the Grump is too thick
function updPebbles(dt) {
  for (let i = pebbles.length - 1; i >= 0; i--) {
    const b = pebbles[i];
    b.life -= dt;
    let dead = b.life <= 0;
    if (b.target && !b.target.dead && !b.target.dying && !b.target.hidden) {
      // a little homing, so a fair shot lands (strong on a ghost)
      const want = tmpV.set(b.target.pos.x, hitHeight(b.target), b.target.pos.z).sub(b.m.position).normalize().multiplyScalar(26);
      b.v.lerp(want, 1 - Math.exp(-(b.target.ghost ? 14 : 5) * dt));
    }
    const steps = 3;
    for (let s = 0; s < steps && !dead; s++) {
      b.m.position.addScaledVector(b.v, dt / steps);
      b.went = (b.went || 0) + (b.v.length() * dt) / steps;
      if (b.went > PEBBLE_RANGE) {
        dead = true;
        burst(b.m.position, [COL.smoke, COL.paper], 3, 2, 0.1);
        break;
      }
      const p = b.m.position;
      const [ix, iz] = cellOf(p.x, p.z);
      if (solid(ix, iz) || p.y < 0) {
        dead = true;
        burst(p, [COL.smoke, COL.paper], 4, 3, 0.1);
        break;
      }
      if (hitGhost(p, 0.15) || hitHolo(p, 0.1) || hitTotem(p, 0.1) || hitPyr(p, 0.1) || kickFace(p, 0.2) || hitPlaque(p, 0.1) || hitNpc(p, 0.1)) {
        dead = true;
        break;
      }
      for (const e of G.enemies) {
        if (e.dead || e.dying || e.dormant || e.away || (b.target && b.target.ghost && e === b.target.priest)) continue; // a shot meant for a ghost flies past the Priest
        if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < e.r + 0.2 && p.y - (e.gy || 0) > e.y0 - 0.2 && p.y - (e.gy || 0) < e.y1 + 0.2) {
          dead = true;
          if (e.type === 'U') {
            SFX.tink();
            burst(p.clone(), [COL.smoke, COL.paper], 5, 3, 0.1);
            bigWord('BOUNCE', HEX.paper, 1 / 1.7);
            floatWord(pick(['TOO THICK', 'HA']), e.pos.clone().setY(5.2 + rand(0, 1.2)), HEX.paper, 1.1);
            break;
          }
          const l = Math.hypot(b.v.x, b.v.z) || 1;
          damage(e, (e.pebbleDmg || PEBBLE_DMG) * (b.pw || 1), b.v.x / l, b.v.z / l, false, true);
          break;
        }
      }
    }
    b.m.rotation.x += dt * 20;
    if (dead) {
      G.group.remove(b.m);
      pebbles.splice(i, 1);
    }
  }
}
