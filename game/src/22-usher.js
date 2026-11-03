// The Usher (B): shows you to your seat, then charges at it.
// a cone body in a dark coat, his bow-tied face, brows that drop when he sees you, glowing eyes for the charge, two arms
function makeUsher(e, add) {
  Object.assign(e, { name: 'Usher', hp: 4.5, maxHp: 4.5, r: 0.7, hgt: 3, y1: 3, palette: [0xb3202f, 0x0d0b0a, 0xe8c628, 0x58622e] });
  const bmat = new THREE.MeshBasicMaterial({ map: TEX.t_dark, color: 0xc4c4b4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.62, 2.0, 7, 1), bmat);
  body.position.y = 1.0;
  e.tilt.add(body);
  e.mats.push(bmat);
  const head = add(paper('bowface', 1.05, 0.08));
  head.position.y = 1.4;
  head.position.z = 0.2;
  e.head = head;
  const browM = new THREE.MeshBasicMaterial({ color: 0x0d0b0a });
  e.brows = [
    [-0.225, 0.8, -0.42],
    [0.25, 0.81, 0.42]
  ].map(([x, y, rz]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.03), browM);
    b.position.set(x, y, 0.06);
    b.rotation.z = rz;
    b.userData.rz = rz;
    b.visible = false;
    head.add(b);
    return b;
  });
  e.chargeCd = 0;
  e.root.scale.setScalar(1.25);
  e.eyes = [
    [-0.233, 0.725],
    [0.349, 0.76]
  ].map(([x, y]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRed, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.set(x, y, 0.12);
    sp.scale.setScalar(0.38);
    sp.visible = false;
    head.add(sp);
    return sp;
  });
  const armMat = new THREE.MeshBasicMaterial({ color: 0x14100c });
  e.arms = [-1, 1].map(s => {
    const g = new THREE.Group(),
      a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.1), armMat);
    a.position.y = -0.6;
    g.add(a);
    g.position.set(s * 0.44, 1.75, 0);
    e.tilt.add(g);
    return g;
  });
}
// idle until he sees Red Cap (brows down), then chase; at range he aims (the tell) and charges in a straight line,
// close up he winds up and lunges. A charge into a wall stuns him (BONK). Bigger Ushers (e.k) are slower, longer and harder.
function updUsher(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  e.chargeCd -= dt;
  const K = e.k || 1,
    cs = 17 / (1 + (K - 1) * 0.3); // a bigger Usher: a longer tell, a slower but longer charge, a longer reach, and he hits harder
  const aim = () => {
    e.st = 'aim';
    e.t = 0.42 + (K - 1) * 0.4;
    SFX.growl();
    sTone({ f: 90 / K, f2: 55 / K, dur: 0.5 * K, type: 'sawtooth', gain: 0.12, filt: [500, 160] });
    floatWord('!!', e.pos.clone().setY(3 * K), '#d8212a', 0.9 * K);
  };
  if (e.rage > 0) e.rage -= dt;
  if (e.wantCharge) {
    e.wantCharge = false;
    e.stagger = 0;
    e.knock.set(0, 0);
    aim();
    e.t = 0.32;
  }
  if (e.st === 'idle') {
    if (animTick) e.head.rotation.z = Math.sin(performance.now() / 400 + e.seed) * 0.1;
    if ((dist < (e.sight || 20) && los(e.pos, hero.pos)) || dist < 8) {
      e.brows.forEach(b => (b.visible = true));
      if (losCover(e.pos, hero.pos, e.r + 0.15)) aim();
      else {
        e.st = 'chase';
        SFX.growl();
      }
      if (!G.usherHint) {
        G.usherHint = true;
        toast('Dodge sideways.');
      }
    }
  } else if (e.st === 'chase') {
    [mv.x, mv.z] = steer(e);
    mv.sp = 4.8 - (K - 1) * 1.1;
    if (animTick) e.arms.forEach((a, i) => (a.rotation.z = Math.sin(performance.now() / 160 + i * 3) * 0.3));
    if (dist < 2.8 * K && e.stagger <= 0) {
      e.st = 'wind';
      e.t = 0.3 * Math.sqrt(K);
    } else if (dist > 3.2 * K && dist < 14 + (K - 1) * 8 && e.chargeCd <= 0 && e.stagger <= 0 && losCover(e.pos, hero.pos, e.r + 0.15)) aim();
  } else if (e.st === 'aim') {
    // the tell: he stops, shakes, arms back, brows twitching
    if (animTick) {
      shake(e.tilt, 0.06);
      e.brows.forEach(b => {
        b.rotation.z = b.userData.rz * (1.2 + Math.random() * 0.3);
        b.position.y = 0.78 + Math.random() * 0.03;
      });
    }
    e.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 2.2));
    if (e.t <= 0) {
      e.st = 'charge';
      e.t = e.chargeT0 = Math.min(1.1 * Math.sqrt(K), (dist + 3 * K) / cs);
      {
        const lead = Math.min(dist / cs, 0.6) * 0.7,
          tx = hero.pos.x + hero.vel.x * lead - e.pos.x,
          tz = hero.pos.z + hero.vel.y * lead - e.pos.z,
          tl = Math.hypot(tx, tz) || 1;
        e.lx = tx / tl;
        e.lz = tz / tl;
      }
      e.cx0 = e.pos.x;
      e.cz0 = e.pos.z;
      e.tilt.position.set(0, 0, 0);
      sTone({ f: 140 / K, f2: 60 / K, dur: 0.4 * K, type: 'sawtooth', gain: 0.1 * Math.sqrt(K), filt: [700, 200] });
      if (K > 1) cam.shake = Math.max(cam.shake, 0.08 * K);
    }
  } else if (e.st === 'charge') {
    mv.x = e.lx;
    mv.z = e.lz;
    mv.sp = cs;
    if (animTick) {
      e.tilt.rotation.x = 0.3;
      e.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 1.4));
    }
    if (Math.random() < dt * 30) burst(e.pos.clone().setY(0.2), [0x8d8579, 0x0d0b0a], 1, 1.5, 0.12, { g: -2, life: 0.4 });
    e.trailT = (e.trailT || 0) - dt;
    if (e.trailT <= 0) {
      e.trailT = 0.045;
      usherTrail(e);
    }
    const moved = Math.hypot(e.pos.x - e.cx0, e.pos.z - e.cz0);
    e.cx0 = e.pos.x;
    e.cz0 = e.pos.z;
    if (e.t < e.chargeT0 - 0.12 && moved < cs * dt * 0.3) {
      e.st = 'recover';
      e.t = 1.4;
      e.stagger = 1.2;
      e.tilt.rotation.x = 0;
      SFX.boom();
      floatWord('BONK', e.pos.clone().setY(2.8 * K), '#ece6da', 0.8 * K);
      e.chargeCd = 2.5;
      cam.shake = Math.max(cam.shake, 0.15 * K * K);
    } else if (e.t <= 0 || dist < e.r + hero.r + 0.2) {
      e.mom = 0.45;
      if (dist < e.r + hero.r + 0.2 && hurtHero(2, e.pos)) {
        hero.knock.multiplyScalar(K);
        cam.shake = Math.max(cam.shake, 0.2 * K);
      }
      e.st = 'recover';
      e.t = 0.5;
      e.tilt.rotation.x = 0;
      e.chargeCd = rand(1.6, 2.4);
    }
  } else if (e.st === 'wind') {
    if (animTick) shake(e.tilt, 0.07);
    e.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 2.6));
    if (e.t <= 0) {
      e.st = 'lunge';
      e.t = 0.26 * Math.sqrt(K);
      e.lx = ux;
      e.lz = uz;
      SFX.growl();
    }
  } else if (e.st === 'lunge') {
    mv.x = e.lx;
    mv.z = e.lz;
    mv.sp = 8;
    e.arms.forEach(a => (a.rotation.z *= 0.8));
    if (e.t <= 0) {
      e.st = 'recover';
      e.t = 0.55;
      e.tilt.position.set(0, 0, 0);
    }
  } else if (e.st === 'recover') {
    if (e.t <= 0) e.st = 'chase';
  }
  if (e.st !== 'aim' && e.st !== 'idle' && animTick)
    e.brows.forEach(b => {
      b.rotation.z = b.userData.rz;
      b.position.y = 0.8;
    });
  e.eyes.forEach(s => {
    s.visible = e.st === 'aim' || e.st === 'charge';
    if (s.visible) s.scale.setScalar(0.34 + Math.random() * 0.08);
  });
  e.mom = Math.max(0, (e.mom || 0) - dt);
  if (dist < e.r + hero.r + 0.15 && e.stagger <= 0 && hurtHero(e.st === 'charge' || (K > 1 && (e.st === 'lunge' || e.mom > 0)) ? 2 : 1, e.pos))
    hero.knock.multiplyScalar(K); // a big one's charge and lunge take two hearts
}

const skidGeo = share(new THREE.PlaneGeometry(0.95, 0.5)); // the charge's skid marks
// behind the charge: a red-tinted smear of his face hangs in the air, and his feet leave skid marks
function usherTrail(e) {
  const hp = e.head.getWorldPosition(new THREE.Vector3());
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.bowface, transparent: true, opacity: 0.5, depthWrite: false, color: 0xff9a8a }));
  const k = e.root.scale.x / 1.25;
  s.position.set(hp.x, hp.y + 0.66 * k, hp.z);
  s.scale.set(1.44 * k, 1.31 * k, 1);
  scene.add(s);
  trail.push({ s, life: 0.32, max: 0.32, base: 0.5 });
  const sk = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x0d0b0a, transparent: true, opacity: 0.5, depthWrite: false }));
  sk.rotation.x = -Math.PI / 2;
  sk.rotation.z = Math.atan2(e.lx, e.lz) + Math.PI / 2;
  sk.position.set(e.pos.x + rand(-0.15, 0.15), heightAt(e.pos.x, e.pos.z) + 0.025, e.pos.z + rand(-0.15, 0.15));
  scene.add(sk);
  trail.push({ s: sk, life: 1.8, max: 1.8, base: 0.5 });
}
TALKERS.B = {
  make: makeUsher,
  update: updUsher,
  warn: e =>
    e.st === 'aim'
      ? { c: '#d8212a', k: clamp(1 - e.t / (0.42 + ((e.k || 1) - 1) * 0.4), 0, 1), cue: 'B' }
      : e.st === 'wind'
        ? { c: '#d8212a', k: 1, cue: 'b' }
        : null
};
