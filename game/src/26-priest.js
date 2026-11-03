// The Priest (R): floor two's boss. God loves his children; the blessings are wet.
// Three little ghosts circle him and shield him while any is left (pop them: they rise again 7 s after the last one goes).
// He sprays blood from his mouth (KNEEL), and close up rains it inside a red circle (PREY). Blood soaks Red Cap (half speed).
const PRIEST_GHOST = 1.8; // his ghosts' size
const RAIN_RING_GEO = share(new THREE.RingGeometry(4.3, 4.7, 40)); // the red circle his blood rains inside

// his paper figure, the white shield ring on the ground, and the ghosts; each ghost has a target stand-in so it can be aimed at
function makePriest(e, add) {
  Object.assign(e, {
    name: 'Priest',
    hp: 11,
    maxHp: 11,
    rainCd: 3,
    r: 0.75,
    hgt: 2.6,
    y1: 2.6,
    palette: [COL.ink, COL.cap, 0xe6b48c, 0xe8c628],
    boss: true
  });
  const m = add(paper('priest', 2.6, 0.12));
  e.body = m;
  e.mouth = new THREE.Vector3((0.34 - 0.5) * sizeOf('priest', 2.6).w, 0.58 * 2.6, 0.1);
  e.t = 1.5;
  const shield = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.5, 36),
    new THREE.MeshBasicMaterial({ color: COL.paper, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
  );
  shield.rotation.x = -Math.PI / 2;
  shield.position.y = 0.06;
  e.root.add(shield);
  e.shield = shield;
  e.ghosts = [0, 1, 2].map(k => {
    const gm = paper(k % 2 ? 'ghost_a' : 'ghost_b', 0.62 * PRIEST_GHOST, 0.04);
    G.group.add(gm);
    return { m: gm, a: (k / 3) * TAU, rad: 2.0 + (k % 2) * 0.6, wait: 0, ph: rand(0, 6) };
  });
  e.ghosts.forEach(g => {
    g.tgt = {
      ghost: g,
      priest: e,
      pos: g.m.position,
      gy: 0,
      r: 0.4 * PRIEST_GHOST,
      get fly() {
        return g.m.position.y + 0.3 * PRIEST_GHOST;
      },
      get dead() {
        return g.wait > 0 || e.dead;
      },
      get dying() {
        return !!e.dying;
      },
      hidden: false
    };
  });
}
function updPriest(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  if (e.reelGhosts) {
    e.reelGhosts = false;
    e.reelHits = null;
    e.ghosts.forEach(g => (g.m.visible = g.wait <= 0));
  }
  const seen = dist < 20 && !hero.inSmoke && los(e.pos, hero.pos);
  const step = PRIEST_ST[e.st];
  if (step) step(e, dt, dist, ux, uz, mv, seen);
  if (dist < e.r + hero.r + 0.1) hurtHero(1, e.pos);
  e.rainCd -= dt;
  e.shieldFlash = Math.max(0, (e.shieldFlash || 0) - dt);
  const shielded = e.ghosts.some(g => g.wait <= 0);
  if (e.ghostsBack > 0 && (e.ghostsBack -= dt) <= 0) {
    // all three rise again at once
    e.ghostsBack = 0;
    for (const g of e.ghosts) {
      g.wait = 0;
      g.m.visible = true;
      burst(e.pos.clone().setY(1.2), [0xd8d4cc, 0x6c6a66, COL.ink], 6, 3, 0.12);
    }
    floatWord('RISE', e.pos.clone().setY(3.6), '#d8d4cc', 1);
    sTone({ f: 200, f2: 600, dur: 0.4, gain: 0.1 });
  }
  e.shield.visible = shielded;
  e.shield.material.opacity = e.shieldFlash > 0 ? 0.8 : 0.3;
  if (animTick) e.shield.rotation.z += 0.3;
  updGhosts(e, dt);
}
// his states, one step each (updPriest runs the one he is in)
const PRIEST_ST = {
  idle(e, dt, dist, ux, uz, mv, seen) {
    if (seen || dist < 10) {
      e.st = 'walk';
      e.t = 1;
    }
  },
  walk(e, dt, dist, ux, uz, mv, seen) {
    if (dist > 5) {
      [mv.x, mv.z] = steer(e);
      mv.sp = 1.9;
    }
    if (animTick) e.tilt.rotation.z = Math.sin(performance.now() / 300) * 0.05;
    if (dist < 4.8 && e.rainCd <= 0 && e.stagger <= 0) {
      e.st = 'rainWind';
      e.t = 1;
      e.rainCd = 6.5;
      SFX.bless();
      floatWord('PREY', e.pos.clone().setY(3.8), HEX.tie, 1.5, true, 1.6);
      const ring = new THREE.Mesh(
        RAIN_RING_GEO,
        new THREE.MeshBasicMaterial({ color: COL.tie, transparent: true, depthWrite: false, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(e.pos.x, 0.07, e.pos.z);
      G.group.add(ring);
      e.rainRing = ring;
    } else if (seen && dist < 9 && e.t <= 0 && e.stagger <= 0) {
      e.st = 'wind';
      e.t = 0.8;
      SFX.bless();
      floatWord('KNEEL', e.pos.clone().setY(3.4), HEX.paper, 1);
    }
  },
  rainWind(e, dt, dist, ux, uz, mv, seen) {
    // arms up: blood will rain inside the red circle
    if (animTick) {
      e.tilt.rotation.x = -0.25;
      shake(e.tilt, 0.04);
    }
    e.rainRing.material.opacity = 0.5 + Math.sin(e.t * 25) * 0.4;
    if (e.t <= 0) {
      e.st = 'rain';
      e.t = 0.38;
      SFX.rain();
      for (let k = 0; k < 70; k++) {
        const a = rand(0, TAU),
          r = Math.sqrt(Math.random()) * 4.5;
        const b = bloodDrop(new THREE.Vector3(e.pos.x + Math.cos(a) * r, rand(5, 7), e.pos.z + Math.sin(a) * r), new THREE.Vector3(0, -12, 0));
        b.kind = 'rain';
      }
    }
  },
  rain(e, dt, dist, ux, uz, mv, seen) {
    if (e.t <= 0) {
      G.group.remove(e.rainRing);
      e.st = 'walk';
      e.t = 1.4;
      e.tilt.rotation.x = 0;
      if (dist < 4.6 && hurtHero(1, e.pos)) hero.knock.set(ux * 11, uz * 11);
      for (let k = 0; k < 4; k++) bloodPool(e.pos.x + rand(-3.5, 3.5), e.pos.z + rand(-3.5, 3.5), rand(0.5, 1.1));
    }
  },
  wind(e, dt, dist, ux, uz, mv, seen) {
    if (animTick) {
      e.tilt.rotation.x = -(0.8 - e.t) * 0.35;
      shake(e.tilt, 0.03);
    }
    if (e.t <= 0) {
      e.st = 'spray';
      e.t = 1.9;
      e.aim = Math.atan2(ux, uz);
      e.emit = 0;
      sprayStart();
      e.tilt.position.set(0, 0, 0);
    }
  },
  spray(e, dt, dist, ux, uz, mv, seen) {
    e.tilt.rotation.x = lerp(e.tilt.rotation.x, 0.12, 0.2);
    e.aim += angDiff(e.aim, Math.atan2(ux, uz)) * (1 - Math.exp(-1.6 * dt));
    const sweep = e.aim + Math.sin((1.9 - e.t) * 4.2) * 0.38;
    e.emit += dt * 90;
    const mouth = e.mouth.clone().applyAxisAngle(UP, e.face.rotation.y).add(e.pos);
    while (e.emit > 1) {
      e.emit--;
      const a = sweep + rand(-0.09, 0.09),
        s = rand(7.5, 10);
      bloodDrop(mouth, new THREE.Vector3(Math.sin(a) * s, rand(0.5, 2.4), Math.cos(a) * s));
    }
    if (Math.random() < 0.2) bloodPool(e.pos.x + rand(-0.6, 0.6), e.pos.z + rand(-0.6, 0.6), rand(0.3, 0.7));
    if (e.t <= 0) {
      e.st = 'walk';
      e.t = rand(2.2, 3);
      sprayStop();
      e.tilt.rotation.x = 0;
    }
  }
};
// the ghosts circle him, bobbing; touching one hurts
function updGhosts(e, dt) {
  const now = performance.now() / 1000;
  for (const g of e.ghosts) {
    if (g.wait > 0) {
      g.m.visible = false;
      continue;
    }
    g.a += dt * (1.5 + g.rad * 0.1);
    const rr = g.rad + Math.sin(now * 2 + g.ph) * 0.4;
    g.m.position.set(e.pos.x + Math.cos(g.a) * rr, 0.55 + Math.sin(now * 3 + g.ph) * 0.3, e.pos.z + Math.sin(g.a) * rr);
    if (animTick) g.m.rotation.y = Math.atan2(camera.position.x - g.m.position.x, camera.position.z - g.m.position.z);
    if (Math.hypot(g.m.position.x - hero.pos.x, g.m.position.z - hero.pos.z) < 0.6) hurtHero(1, g.m.position);
  }
}
// a ghost hit by the yo-yo string or a pebble pops
function hitGhost(p, rad) {
  for (const e of G.enemies) {
    if (e.type !== 'R' || e.dead || e.dying || e.dazedT > 0) continue;
    for (const g of e.ghosts) {
      if (g.wait > 0) continue;
      const gp = g.m.position;
      if (Math.hypot(gp.x - p.x, gp.z - p.z) < rad + 0.4 && Math.abs(gp.y + 0.3 - p.y) < 1) {
        g.wait = Infinity;
        if (e.ghosts.every(q => q.wait > 0)) e.ghostsBack = 7;
        burst(gp.clone().setY(gp.y + 0.3), [0xd8d4cc, 0x6c6a66, COL.ink], 8, 3, 0.12);
        floatWord('POPPED', gp.clone().setY(gp.y + 1.2), HEX.paper, 0.55);
        SFX.pop();
        return true;
      }
    }
  }
  return false;
}
TALKERS.R = {
  make: makePriest,
  update: updPriest,
  // reeling, he stops spraying and his ghosts leave him
  dazed: e => {
    sprayStop();
    e.ghosts.forEach(g => (g.m.visible = false));
    e.reelGhosts = true;
  },
  bar: e => {
    const n = e.ghosts.filter(g => g.wait <= 0).length;
    return n ? ['Shielded by ' + n + ' ghost' + (n > 1 ? 's' : ''), false] : ['', false, 'EXPOSED'];
  },
  // the ghosts shield him while any is left
  shielded: e => {
    if (!e.ghosts.some(g => g.wait <= 0)) return false;
    SFX.tink();
    e.shieldFlash = 0.3;
    floatWord('SHIELDED', e.pos.clone().setY(3.4 + rand(0, 0.3)), '#d8d4cc', 0.8);
    return true;
  },
  // reeling: two blows finish him if all three ghosts were round him when he reeled, else one
  struck: (e, n, weapon) => {
    if (!(e.dazedT > 0 && weapon)) return n;
    e.reelHits = (e.reelHits ?? 1) - 1;
    return e.reelHits <= 0 ? e.hp + 1 : Math.min(n, Math.max(0, e.hp - 0.05));
  },
  // a blow stops his spray
  hurt: e => {
    if (e.st !== 'spray') return;
    e.st = 'walk';
    e.t = 1.4;
    sprayStop();
  },
  // a trap leaves him reeling: he stops spraying, and two blows finish him if all his ghosts are round him, else one
  trapped: e => {
    e.reelHits = e.ghosts.every(g => g.wait <= 0) ? 2 : 1;
    if (e.st !== 'spray') return;
    e.st = 'walk';
    e.t = 2.6;
    sprayStop();
  },
  torn: e => {
    e.ghosts.forEach(g => {
      burst(g.m.position, [0xd8d4cc, 0x6c6a66], 6, 3, 0.12);
      G.group.remove(g.m);
    });
    if (e.rainRing) G.group.remove(e.rainRing);
  }
};
