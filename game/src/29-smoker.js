// The Smoker (S): hides in his own smoke. Psst. Every hit shakes pebbles out of him.
// Brainless the Second (W) is a giant one, smokier, never stops coughing, and slips away in his smoke twice before he is done.

// a see-through paper head (it fades in its smoke); e.tip is where his cigarette is
function makeSmoker(e, add, x, z, part, type) {
  const H = type === 'W' ? 4.2 : 1.1;
  Object.assign(e, {
    name: 'Smoker',
    hp: type === 'S' ? 4 : 3,
    maxHp: type === 'S' ? 4 : 3,
    noBar: true,
    r: 0.6,
    fly: 2.3,
    palette: [0xc8202c, 0xe6b48c, COL.ink, 0x9a9a9a],
    alpha: 1
  });
  if (type === 'W') Object.assign(e, { name: 'Brainless the Second', hp: 6, maxHp: 6, r: 1.8, boss: true, lives: 3, smoky: 2, coughT: 3 });
  const m = add(paper('smoker', H, 0.12));
  m.position.y = -H / 2;
  e.body = m;
  e.t = rand(2.5, 4);
  const side = SIDE_MAT.clone();
  side.transparent = true;
  m.material = [m.userData.mat, side];
  m.userData.mat.transparent = true;
  e.fade = [m.userData.mat, side];
  const b = SHAPES.smoker.box,
    w = sizeOf('smoker', H).w;
  e.tip = new THREE.Vector3(((562 - b[0]) / (b[2] - b[0]) - 0.5) * w, (1 - (975 - b[1]) / (b[3] - b[1])) * H - H / 2, 0.1);
}
// A flying head trailing smoke from his cigarette. Once he sees Red Cap he hovers at a distance; now and then he blows a cloud
// and hides in it (smoke), circling Red Cap under cover, then shows himself (PSST) and flicks an ember from his cigarette.
function updateSmoker(e, dt, dist, ux, uz, mv) {
  if (e.away) {
    // gone in his own smoke (Brainless only): he comes back near Red Cap when the time is up
    if (e.t > 0) {
      e.root.visible = false;
      e.root.position.copy(e.pos);
      return STOP;
    }
    smokerReturns(e);
  }
  faceCam(e, dt);
  const now = playT;
  if (animTick) e.fly = (e.smoky ? 3.4 : 2.3) + Math.sin(now * 1.7 + e.seed) * 0.3;
  e.y0 = e.fly - (e.smoky ? 2.1 : 0.6);
  e.y1 = e.fly + (e.smoky ? 2.1 : 0.6);
  if (e.smoky && !e.away) smokerCough(e, dt, dist, ux, uz);
  e.puff = (e.puff || 0) - dt;
  if (e.puff <= 0) {
    const k = e.smoky || 1;
    e.puff = (e.st === 'smoke' ? 0.18 : 0.25) / k;
    const ks = Math.sqrt(k);
    const tp = e.tip.clone();
    tp.y += e.fly;
    tp.applyAxisAngle(UP, e.face.rotation.y).add(e.pos);
    smokePuff(tp, (e.st === 'smoke' ? rand(1.4, 2.2) : 0.45) * ks * (e.smoky ? 1.5 : 1), (e.st === 'smoke' ? 3 : 1.6) * ks, 0.5);
  }
  const seen = dist < 20 && !hero.inSmoke && lineOfSight(e.pos, hero.pos);
  const step = SMOKER_STATES[e.st];
  if (step) step(e, dt, dist, ux, uz, mv, seen);
  e.alpha = lerp(e.alpha, e.hidden ? 0.08 : 1, 1 - Math.exp(-6 * dt));
  e.fade.forEach(m => (m.opacity = e.alpha));
  e.shadow.visible = !e.hidden;
  e.tilt.position.y = e.fly;
}
// his states, one step each (updateSmoker runs the one he is in)
const SMOKER_STATES = {
  idle(e, dt, dist, ux, uz, mv, seen) {
    if (seen || dist < 9) {
      e.st = 'hover';
      e.t = rand(2.5, 4);
    }
  },
  hover(e, dt, dist, ux, uz, mv, seen) {
    if (!seen) {
      [mv.x, mv.z] = steer(e);
      mv.sp = 3.2;
    } else {
      const want = dist > 7 ? 1 : dist < 4 ? -1 : 0;
      mv.x = ux * want;
      mv.z = uz * want;
      mv.sp = 3;
    }
    if (dist < 1.8 && e.stagger <= 0) hurtHero(1, e.pos);
    if (e.t <= 0 && seen) {
      e.st = 'smoke';
      e.t = 3.4;
      e.side = Math.random() < 0.5 ? 1 : -1;
      const k2 = e.smoky || 1;
      for (let k = 0; k < 7 * k2; k++)
        smokePuff(fxAt(e.pos, rand(-1.6, 1.6) * k2, e.fly + rand(-1.2, 0.8), rand(-1.6, 1.6) * k2), rand(2.4, 3.6) * k2, 4.5, 0.12);
      floatWord('*COUGH*', e.pos.clone().setY(e.fly + 1.2), HEX.smoke, 0.8);
      playNoise({ dur: 0.8, f: 500, f2: 180, type: 'lowpass', gain: 0.3 });
    }
  },
  smoke(e, dt, dist, ux, uz, mv, seen) {
    // hidden: circles round Red Cap under cover
    e.hidden = true;
    const rad = dist > 6 ? 0.6 : dist < 3.5 ? -0.6 : 0;
    mv.x = -uz * e.side + ux * rad;
    mv.z = ux * e.side + uz * rad;
    mv.sp = 5;
    if (e.t <= 0) {
      e.st = 'reveal';
      e.t = 0.4;
      e.hidden = false;
      floatWord('PSST', e.pos.clone().setY(e.fly + 1.1), HEX.paper, 0.7);
    }
  },
  reveal(e, dt, dist, ux, uz, mv, seen) {
    if (animTick) shake(e.tilt, 0.05);
    if (e.t <= 0) {
      const tp = e.tip.clone();
      tp.y += e.fly;
      tp.applyAxisAngle(UP, e.face.rotation.y).add(e.pos);
      emberShot(
        tp,
        hero.pos
          .clone()
          .setY(hero.pos.y + 1.2)
          .sub(tp)
          .normalize()
      );
      e.st = 'hover';
      e.t = rand(4, 6);
    }
  }
};
// back from his smoke somewhere near Red Cap where he can see him, in a cloud (MISS ME?)
function smokerReturns(e) {
  for (let tries = 0; tries < 40; tries++) {
    const a = rand(0, TAU),
      r = rand(5, 9),
      x = hero.pos.x + Math.cos(a) * r,
      z = hero.pos.z + Math.sin(a) * r,
      [ix, iz] = cellOf(x, z);
    if (!solid(ix, iz) && lineOfSight(new THREE.Vector3(x, 0, z), hero.pos)) {
      e.pos.set(x, 0, z);
      break;
    }
  }
  e.away = false;
  e.hidden = false;
  e.alpha = 0.1;
  e.root.visible = true;
  e.st = 'hover';
  e.t = rand(1.5, 2.5);
  const k2 = e.smoky || 1;
  for (let k = 0; k < 7 * k2; k++) smokePuff(fxAt(e.pos, rand(-1.4, 1.4) * k2, 2 + rand(-1, 1), rand(-1.4, 1.4) * k2), rand(2, 3.2) * k2, 3.5, 0.1);
  floatWord('MISS ME?', e.pos.clone().setY(3.8), HEX.paper, 1);
  playNoise({ dur: 0.8, f: 500, f2: 180, type: 'lowpass', gain: 0.3 });
}
// Brainless never stops coughing; close by, a fit of it rattles Red Cap for a moment
function smokerCough(e, dt, dist, ux, uz) {
  e.coughT -= dt;
  if (e.coughT <= 0) {
    e.coughT = rand(2.2, 3.4);
    playNoise({ dur: 0.35, f: 380, f2: 160, q: 1.5, gain: 0.28 });
    later(0.26, () => playNoise({ dur: 0.3, f: 340, f2: 150, q: 1.5, gain: 0.22 }));
    floatWord('*COUGH*', e.pos.clone().setY(e.fly + 2.6), HEX.smoke, 1);
    for (let k = 0; k < 6; k++) smokePuff(fxAt(e.pos, ux * k * 1.2, e.fly - 0.4, uz * k * 1.2), rand(1.8, 2.8), 2.5, 0.2);
    if (dist < 8.5 && lineOfSight(e.pos, hero.pos) && hero.dodgeT <= 0 && hero.stun <= 0 && state === 'play') stunHero(0.5, true);
  }
}
// a totem's ring shakes a Smoker out of his smoke
const smokerHushed = e => {
  e.st = 'hover';
  e.t = 2.5;
};
TALKERS.S = {
  make: makeSmoker,
  update: updateSmoker,
  hushed: smokerHushed,
  bar: e => [e.hidden ? 'Hidin’ in his smoke' : 'Every hit shakes out pebbles', !e.hidden],
  hurt: e => giveAmmo(Math.random() < 0.5 ? 2 : 3, e.pos), // every hit shakes pebbles out of him
  drops: e => {
    if (hero.hp <= 2) dropHeart(e.pos.x, e.pos.z);
    else dropsDefault(e);
    giveAmmo(2, e.pos);
  }
};
TALKERS.W = {
  make: makeSmoker,
  update: updateSmoker,
  hushed: smokerHushed,
  totemDaze: 1.8,
  bar: e => [e.lives > 1 ? 'Will slip away ' + (e.lives - 1) + ' more time' + (e.lives > 2 ? 's' : '') : 'Last breath', e.lives <= 1],
  // not yet: he slips away in his smoke and comes back later
  escape: e => {
    if (e.lives <= 1) return false;
    e.lives--;
    e.hp = e.maxHp;
    e.away = true;
    e.hidden = true;
    e.t = 12;
    e.root.visible = false;
    e.st = 'hover';
    for (let k = 0; k < 14; k++) smokePuff(fxAt(e.pos, rand(-1.6, 1.6), (e.fly || 2) + rand(-1, 1), rand(-1.6, 1.6)), rand(2.4, 3.6), 4.5, 0.1);
    // the first time the game says it; the second time he does, and his line wins over the curse from the blow that sent him off
    if (e.lives === 2) toast('He went up in smoke. Beware');
    else floatWord("I'LL TAKE A BREAK", e.pos.clone().setY(3.8), HEX.paper, 1.1, true);
    giveAmmo(2, e.pos);
    SFX.tear();
    return true;
  },
  drops: e => {
    dropHeart(e.pos.x, e.pos.z);
    giveAmmo(2, e.pos);
    giveAmmo(2, e.pos);
  }
};
