// Red Cap: his paper body, getting hurt, aiming, the dodge, and moving him every frame (updateHero).
// His weapons are in 11-weapons.js. The state object `hero` is declared with the world state (05-world.js).
let yoyoMesh, stringMesh;
// Red Cap and his yo-yo
function buildHero() {
  const root = heroFigure();
  groundShadow(root, 0.6, 0.35, 0.4);
  buildYoyo();
  return root;
}
// legs, body and head cut from his painting, each a paper card with a soft ink outline (hero.root, hero.parts)
function heroFigure() {
  const S = SHAPES,
    top = S.hero_head.box[1],
    foot = Math.max(S.hero_leg_l.box[3], S.hero_leg_r.box[3]);
  const sc = 1.95 / (foot - top),
    cx = (S.hero_body.box[0] + S.hero_body.box[2]) / 2;
  const { root, face, tilt } = figureRig();
  const part = (name, depth) => {
    const b = S[name].box,
      h = (b[3] - b[1]) * sc,
      m = paper(name, h, depth);
    return { m, b, h, x: ((b[0] + b[2]) / 2 - cx) * sc, y: (foot - b[3]) * sc };
  };
  const legs = ['hero_leg_l', 'hero_leg_r'].map((n, i) => {
    const p = part(n, 0.05),
      pivot = new THREE.Group();
    pivot.position.set(p.x, p.y + p.h - 0.04, -0.03 + i * 0.02);
    p.m.position.y = -p.h + 0.04;
    pivot.add(p.m);
    tilt.add(pivot);
    return pivot;
  });
  const body = part('hero_body', 0.1);
  body.m.position.set(body.x, body.y, 0);
  tilt.add(body.m);
  const head = part('hero_head', 0.12),
    hp = new THREE.Group();
  hp.position.set(-head.x, head.y + 0.1, 0.06);
  head.m.position.y = -0.1;
  head.m.scale.x = -1;
  hp.add(head.m);
  tilt.add(hp); // mirrored so the cap leads
  const inks = [],
    cards = [body.m, head.m, ...legs.map(l => l.children[0])];
  cards.forEach(m => inkCard(m, inks));
  hero.root = root;
  hero.parts = {
    face,
    tilt,
    legs,
    body: body.m,
    head: hp,
    bodyY: body.y,
    headY: head.y + 0.1,
    inks,
    mats: cards.map(m => m.userData.mat)
  };
  return root;
}
// the yo-yo: two red discs, a yellow axle ring, and a string (yoyoMesh, stringMesh)
function buildYoyo() {
  yoyoMesh = new THREE.Group();
  const disc = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 20);
  const red = new THREE.MeshBasicMaterial({ color: COL.tie }),
    yel = new THREE.MeshBasicMaterial({ color: COL.bile }),
    wht = new THREE.MeshBasicMaterial({ color: COL.paper });
  [-1, 1].forEach(s => {
    const d = new THREE.Mesh(disc, red);
    d.rotation.z = Math.PI / 2;
    d.position.x = s * 0.08;
    yoyoMesh.add(d);
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.14, 5), wht);
    star.position.x = s * 0.135;
    star.rotation.y = (s * Math.PI) / 2;
    yoyoMesh.add(star);
  });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12), yel);
  ring.rotation.z = Math.PI / 2;
  yoyoMesh.add(ring);
  yoyoMesh.visible = false;
  stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 4), new THREE.MeshBasicMaterial({ color: COL.ink }));
  stringMesh.visible = false;
}
// stunned: the Geezer's stare (FRENZY, the page swirls by psy) or, light, a cough of smoke
function stunHero(t, light, psy) {
  hero.stun = t;
  hero.stunPsy = psy ?? (light ? 0.2 : 0.75);
  hero.yy = null;
  yoyoMesh.visible = stringMesh.visible = false;
  if (light) {
    cam.hurt = 0.34;
    floatWord('*HACK*', hero.pos.clone().setY(2.8), HEX.smoke, 0.8);
    return;
  }
  cam.shake = 0.5;
  bigWord('FRENZY', '#b48cff');
  playTone({ f: 300, f2: 120, dur: 1.2, type: 'sawtooth', gain: 0.1, filt: [1200, 300] });
}
// a blow from `from` (a position): whole hearts only, one or two; then a second of grace. pierce ignores the grace.
// Returns whether it landed. His own sounds are never quieted by the distance of whoever hit him.
function hurtHero(dmg, from, pierce) {
  const at = AUDIO.at;
  AUDIO.at = null;
  try {
    return takeBlow(dmg, from, pierce);
  } finally {
    AUDIO.at = at;
  }
}
function takeBlow(dmg, from, pierce) {
  if ((hero.iframe > 0 && !pierce) || hero.dodgeT > 0 || hero.dodgeIF > 0 || state !== 'play') return false;
  dmg = clamp(Math.ceil(dmg), 1, 2);
  // a boss that lands a blow is in the fight (its bar shows)
  if (G) for (const e of G.enemies) if (e.boss && (from === e.pos || (e.mBoom && from === e.mBoom.m.position))) e.engaged = true;
  hero.hp -= dmg;
  hero.iframe = 1.0;
  hero.noBlink = false;
  stats.hits++;
  hero.ghostT = 0.24;
  hero.parts.mats[1].map = TEX.hero_ghost;
  hero.parts.mats.forEach((m, i) => {
    if (i !== 1) m.color.setHex(0xcfdcf0);
  });
  playTone({ f: 950, f2: 260, dur: 0.3, type: 'sine', gain: 0.09 });
  const dx = hero.pos.x - from.x,
    dz = hero.pos.z - from.z,
    d = Math.hypot(dx, dz) || 1;
  hero.knock.set((dx / d) * 9, (dz / d) * 9);
  cam.hurt = 0.34;
  SFX.hurt();
  $('#hurt').style.opacity = 1;
  setTimeout(() => ($('#hurt').style.opacity = 0), 160); // screen time, not later(): later() stops on death and would leave it red
  burst(hero.pos.clone().setY(hero.pos.y + 1.2), [COL.cap, 0x7a1d14, 0x3a6fb5], 10, 4, 0.14);
  drawTies();
  if (hero.hp <= 0) die();
  return true;
}
// the Priest's blood: each drop adds a third of a second of wet, up to three; wet, Red Cap moves at half speed and drips red
function soak() {
  const was = hero.wet > 0;
  hero.wet = Math.min(3, (hero.wet || 0) + 0.35);
  if (!was) {
    floatWord('BLESSED', hero.pos.clone().setY(hero.pos.y + 2.6), HEX.tie, 0.9, true);
    playNoise({ dur: 0.3, f: 700, f2: 250, type: 'lowpass', gain: 0.2 });
  }
  if (!G.wetHint) {
    G.wetHint = true;
    toast('Soaked.');
  }
}
// aim: the camera's forward on the ground, with a soft lock on the talker nearest the reticle (the Priest's ghosts one by one;
// with pyr, the slingshot's: floor two's pyramids too, a talker first)
const AIM = { cone: 0.42, near: 0.5, far: 26, partFar: 22, perMetre: 0.012 }; // rad off the aim; m; score per metre away
function aimInfo(pyr) {
  const fx = -Math.sin(cam.yaw),
    fz = -Math.cos(cam.yaw);
  let best = null,
    bestScore = 1e9;
  // one candidate standing at (x, z), seen at `to`: the lowest score wins (in front first, then close; bias shifts it).
  // False when it is out of range.
  const offer = (who, x, z, to, far, bias) => {
    const dx = x - hero.pos.x,
      dz = z - hero.pos.z,
      d = Math.hypot(dx, dz);
    if (d > far || d < AIM.near) return false;
    const off = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)),
      score = off + d * AIM.perMetre + bias;
    if (off < AIM.cone && score < bestScore && lineOfSight(hero.pos, to)) {
      bestScore = score;
      best = who;
    }
    return true;
  };
  for (const e of G.enemies) {
    if (e.dead || e.dying || e.dormant || e.hidden || e.waiting || e.part === 'whole') continue;
    if (!offer(e, e.pos.x, e.pos.z, e.pos, AIM.far, 0)) continue;
    const T = TALKERS[e.type];
    if (T.aimParts) T.aimParts(e, (at, tgt) => offer(tgt, at.x, at.z, at, AIM.partFar, -0.03)); // a part a little before its owner
  }
  for (const k in (pyr && G.pyr) || {}) {
    const q = G.pyr[k];
    if (q.hp > 0 && q.tgt) offer(q.tgt, q.x, q.z, q.tgt.pos, AIM.far, 0.08); // a pyramid after a talker
  }
  return { fx, fz, target: best };
}
// the dodge: a quick burst that eases off, with faint paper copies of him left along the way
const DODGE = 0.2; // seconds
const trail = [];
function afterimage() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.hero_head, transparent: true, opacity: 0.45, depthWrite: false, color: 0xcfdcf0 }));
  s.position.set(hero.pos.x, hero.pos.y + 1.45, hero.pos.z);
  s.scale.set(-1.05 * hero.flip, 1, 1);
  scene.add(s);
  trail.push({ s, life: 0.26 });
}
function updateTrail(dt) {
  for (let i = trail.length - 1; i >= 0; i--) {
    const t = trail[i];
    t.life -= dt;
    t.s.material.opacity = Math.max(0, (t.life / (t.max || 0.26)) * (t.base ?? 0.38));
    if (t.life <= 0) {
      scene.remove(t.s);
      t.s.material.dispose();
      trail.splice(i, 1);
    }
  }
}
function dodge() {
  if (state !== 'play' || hero.dodgeCd > 0 || hero.stun > 0) return;
  if (hero.snared > 0) {
    // a dodge tears the hidden boss's strand
    hero.snared = 0;
    burst(hero.pos.clone().setY(0.6), [0xc8642a, 0xd8823a], 10, 3, 0.14);
  }
  let mx = hero.vel.x,
    mz = hero.vel.y;
  const l = Math.hypot(mx, mz);
  if (l < 0.1) {
    mx = -Math.sin(cam.yaw);
    mz = -Math.cos(cam.yaw);
  } else {
    mx /= l;
    mz /= l;
  }
  hero.dodgeDir.set(mx, mz);
  hero.dodgeT = DODGE;
  hero.dodgeIF = 0.32;
  hero.dodgeCd = 0.45;
  hero.ghostTrail = 0;
  hero.lastDodgeAt = performance.now() / 1000;
  SFX.dodge();
}
// if anything ever shoves Red Cap into a wall or off the map, put him back where he last stood
function heroSafety() {
  const [ix, iz] = cellOf(hero.pos.x, hero.pos.z),
    out = ix < 0 || iz < 0 || ix >= G.w || iz >= G.h || !isFinite(hero.pos.x) || !isFinite(hero.pos.z);
  const jumped = hero.safe && hero.pos.distanceTo(hero.safe) > 1 && !lineOfSight(hero.safe, hero.pos); // passed through a wall in one step
  if (out || solid(ix, iz) || jumped) {
    if (hero.safe) {
      hero.pos.copy(hero.safe);
      hero.knock.set(0, 0);
      hero.vel.set(0, 0);
    }
  } else (hero.safe = hero.safe || new THREE.Vector3()).copy(hero.pos);
}
// every frame of play: timers, input, what slows him, moving with collisions, his stop-motion pose, his weapons, fire, pickups
function updateHero(dt) {
  heroTimers(dt);
  const [ix, iz] = heroInput(dt);
  const fx = -Math.sin(cam.yaw),
    fz = -Math.cos(cam.yaw),
    rx = Math.cos(cam.yaw),
    rz = -Math.sin(cam.yaw);
  const spd = heroConditions(dt);
  heroMove(dt, (fx * iz + rx * ix) * spd, (fz * iz + rz * ix) * spd);
  const moving = Math.hypot(hero.vel.x, hero.vel.y);
  hero.walk += dt * moving * 2.1;
  if (ix !== 0 && !hero.yy) hero.flip = ix > 0 ? 1 : -1;
  heroPose(moving, rx, rz);
  if (hero.ghostT > 0) {
    hero.ghostT -= dt;
    if (hero.ghostT <= 0) {
      hero.parts.mats[1].map = TEX.hero_head;
      hero.parts.mats.forEach(m => m.color.setHex(0xffffff));
    }
  }
  hero.root.position.copy(hero.pos);
  hero.root.visible = hero.ghostT > 0 || !(!hero.noBlink && hero.iframe > 0 && Math.floor(hero.iframe * 14) % 2 === 0); // blinks while hurt
  if (moving > 1) {
    hero.stepT -= dt;
    if (hero.stepT <= 0) {
      hero.stepT = 0.3;
      SFX.step();
    }
  }
  updateYoyo(dt);
  updatePebbles(dt);
  updateSling(dt);
  updateTrail(dt);
  updateNiches(dt);
  heroHeat(dt);
  updatePickups(dt);
  if (G.portal && G.portal.open && heroDist(G.portal.x, G.portal.z) < 1.3) nextFloor();
}
function heroTimers(dt) {
  hero.iframe = Math.max(0, hero.iframe - dt);
  hero.dodgeIF = Math.max(0, (hero.dodgeIF || 0) - dt);
  hero.yoyoCd = Math.max(0, hero.yoyoCd - dt);
  if (hero.yoyoQ && hero.yoyoCd === 0) yoyo(); // a press just before the yo-yo was ready
  hero.slingCd = Math.max(0, hero.slingCd - dt);
  hero.dodgeCd = Math.max(0, hero.dodgeCd - dt);
}
// the walk input (keys, touch stick, controller) as [right, forward], at most 1 long; Q / E turn the camera; stunned, he reels
function heroInput(dt) {
  let ix = 0,
    iz = 0;
  if (hero.stun > 0) hero.stun -= dt;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyD')) ix += 1;
  if (keys.has('KeyA')) ix -= 1;
  ix += stick.x + PAD.move.x;
  iz += stick.y + PAD.move.y;
  if (hero.stun > 0) {
    ix = iz = 0;
    cam.yaw += Math.sin(performance.now() / 300) * dt * 0.9;
  }
  const l = Math.hypot(ix, iz);
  if (l > 1) {
    ix /= l;
    iz /= l;
  }
  if (keys.has('KeyQ') || keys.has('ArrowLeft')) cam.yaw += CAM_TURN * dt;
  if (keys.has('KeyE') || keys.has('ArrowRight')) cam.yaw -= CAM_TURN * dt;
  return [ix, iz];
}
// what holds him back (a Shade's fright, a trap, the hidden boss's strand, the Priest's blood, a niche's blessing): his speed
function heroConditions(dt) {
  hero.spook = Math.max(0, (hero.spook || 0) - dt);
  const so = Math.round(Math.min(1, hero.spook / 1.6) * 80) / 100;
  if (so !== hero.spookShown) {
    hero.spookShown = so;
    HUD.spook.style.opacity = so;
  }
  hero.held = Math.max(0, (hero.held || 0) - dt);
  hero.snared = Math.max(0, (hero.snared || 0) - dt);
  snareTick();
  hero.wet = Math.max(0, (hero.wet || 0) - dt);
  hero.blest = Math.max(0, (hero.blest || 0) - dt); // a niche's blessing: the same look, less slow
  if ((hero.wet > 0 || hero.blest > 0) && Math.random() < dt * 14)
    burst(hero.pos.clone().setY(hero.pos.y + rand(0.4, 1.6)), [COL.cap, 0x8a0d18], 1, 0.6, 0.1, { g: 14, life: 0.6 });
  if (!(hero.ghostT > 0)) hero.parts.mats.forEach(m => m.color.setHex(hero.wet > 0 || hero.blest > 0 ? 0xffb4b4 : 0xffffff)); // red while soaked
  return (hero.held > 0 ? 0 : hero.snared > 0 ? 1.8 : hero.spook > 0 ? 3.1 : 5.2) * (hero.wet > 0 ? 0.5 : hero.blest > 0 ? 0.75 : 1);
}
// eases toward the wanted velocity (tvx, tvz), adds knockback or the dodge, and moves in small steps so nothing is passed through
function heroMove(dt, tvx, tvz) {
  hero.vel.x = lerp(hero.vel.x, tvx, ease(14, dt));
  hero.vel.y = lerp(hero.vel.y, tvz, ease(14, dt));
  let vx = hero.vel.x + hero.knock.x,
    vz = hero.vel.y + hero.knock.y;
  if (hero.dodgeT > 0) {
    // a quick burst that eases off and hands straight back to running, with no hard stop
    hero.dodgeT -= dt;
    const k = clamp(1 - hero.dodgeT / DODGE, 0, 1),
      spd = 30 * Math.pow(1 - k, 2) + 5.2 * k;
    vx = hero.dodgeDir.x * spd;
    vz = hero.dodgeDir.y * spd;
    if (hero.dodgeT <= 0) hero.vel.set(hero.dodgeDir.x * 5.2, hero.dodgeDir.y * 5.2);
    hero.ghostTrail -= dt;
    if (hero.ghostTrail <= 0) {
      hero.ghostTrail = 0.022;
      afterimage();
    }
  }
  hero.knock.multiplyScalar(Math.exp(-7 * dt));
  const nSub = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.1));
  for (let k = 0; k < nSub; k++) {
    hero.pos.x += (vx * dt) / nSub;
    hero.pos.z += (vz * dt) / nSub;
    collide(hero.pos, hero.r, hero.pos.y);
    collide(hero.pos, hero.r, hero.pos.y);
    for (const c of G.clutter) {
      const ox = hero.pos.x - c.x,
        oz = hero.pos.z - c.z,
        od = Math.hypot(ox, oz);
      if (od < c.r + hero.r && od > 1e-3) {
        hero.pos.x = c.x + (ox / od) * (c.r + hero.r);
        hero.pos.z = c.z + (oz / od) * (c.r + hero.r);
      }
    }
    for (const c of G.cages)
      if (!c.broken) {
        const ox = hero.pos.x - c.x,
          oz = hero.pos.z - c.z,
          od = Math.hypot(ox, oz);
        if (od < 1.3 + hero.r && od > 1e-3) {
          hero.pos.x = c.x + (ox / od) * (1.3 + hero.r);
          hero.pos.z = c.z + (oz / od) * (1.3 + hero.r);
        }
      }
    hero.pos.y = heightAt(hero.pos.x, hero.pos.z);
  }
}
// the stop-motion pose (12 a second): legs swing, body bobs, he leans into a dodge, a throw or a pull of the sling;
// the dodge's lean and squash are also smoothed every frame
function heroPose(moving, rx, rz) {
  const P = hero.parts;
  if (animTick) {
    const sw = Math.sin(hero.walk * 2) * Math.min(moving / 5, 1);
    P.legs[0].rotation.z = sw * 0.45;
    P.legs[1].rotation.z = -sw * 0.45;
    P.body.position.y = P.bodyY + Math.abs(sw) * 0.05;
    P.head.position.y = P.headY + Math.abs(sw) * 0.07;
    P.head.rotation.z = Math.sin(hero.walk * 2 + 1) * 0.07 * Math.min(moving / 5, 1);
    const dk = hero.dodgeT > 0 ? Math.sin(clamp(1 - hero.dodgeT / DODGE, 0, 1) * Math.PI) : 0,
      side = hero.dodgeDir.x * rx + hero.dodgeDir.y * rz;
    P.tilt.rotation.z = hero.dodgeT > 0 ? -Math.sign(side || hero.flip) * 0.45 * dk : -(hero.vel.x * rx + hero.vel.y * rz) * 0.025;
    P.tilt.scale.set(1 + dk * 0.12, 1 - dk * 0.14, 1);
    P.tilt.position.y = -dk * 0.1;
    P.face.scale.x = hero.flip;
    if (hero.yy) P.tilt.rotation.z = -hero.flip * 0.12;
    if (slingT > 0) P.tilt.rotation.z = (slingT > 0.49 ? 0.14 : -0.06) * hero.flip;
    if (hero.stun > 0) {
      P.head.rotation.z = Math.sin(performance.now() / 70) * 0.45;
      P.tilt.rotation.z = Math.sin(performance.now() / 160) * 0.2;
    }
  }
  if (hero.dodgeT > 0 || hero.wasDodging) {
    const k = clamp(1 - hero.dodgeT / DODGE, 0, 1),
      dk = hero.dodgeT > 0 ? Math.sin(k * Math.PI) : 0,
      side = hero.dodgeDir.x * rx + hero.dodgeDir.y * rz;
    P.tilt.rotation.z = -Math.sign(side || hero.flip) * 0.5 * dk;
    P.tilt.scale.set(1 + dk * 0.14, 1 - dk * 0.16, 1);
    P.tilt.position.y = -dk * 0.1;
    hero.wasDodging = hero.dodgeT > 0;
  }
  P.face.rotation.y = cam.yaw;
}
// standing in the heat of a brazier or a candle stake: a short grace, HOT, then it burns
function heroHeat(dt) {
  let nearFire = 0;
  for (const f of G.hot) if (heroDist(f.x, f.z) < f.r && (!f.see || lineOfSight(f, hero.pos))) nearFire = Math.max(nearFire, f.k || 1);
  if (nearFire) {
    hero.heat = (hero.heat || 0) + dt * nearFire;
    if (hero.heat > 0.45 && !hero.heatWarned) {
      hero.heatWarned = true;
      bigWord('HOT', HEX.hot);
      playNoise({ dur: 0.4, f: 2500, q: 1, gain: 0.12 });
    }
    if (Math.random() < dt * 20) burst(hero.pos.clone().setY(hero.pos.y + 0.3), [COL.hot, COL.bile], 1, 1, 0.14, { g: -4, life: 0.5 });
    if (hero.heat > 1.1) {
      hero.heat = 0;
      hero.heatWarned = false;
      if (hurtHero(1, hero.pos.clone().add(new THREE.Vector3(0.01, 0, 0)))) floatWord('BURNT', hero.pos.clone().setY(hero.pos.y + 2.8), HEX.hot, 0.9);
    }
  } else {
    hero.heat = Math.max(0, (hero.heat || 0) - dt * 2);
    if (hero.heat < 0.2) hero.heatWarned = false;
  }
}
