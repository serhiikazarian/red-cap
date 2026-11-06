// The Shade (q): one of the Priest's little ghosts, loose on the first floor. Harmless: it says boo and pinches a pebble.

function makeShade(e, add) {
  Object.assign(e, { name: 'Shade', hp: 1.5, maxHp: 1.5, pebbleDmg: 1.5, r: 0.55, fly: 1.6, palette: [0xd8d4cc, 0x6c6a66, COL.ink] });
  const m = add(paper(Math.random() < 0.5 ? 'ghost_a' : 'ghost_b', 1.3, 0.05));
  m.position.y = -0.65;
  e.body = m;
  m.userData.mat.transparent = true;
}
// bobs and flickers; once it sees Red Cap it weaves toward him; touching him frightens him (he slows) and steals a pebble,
// then it flees for a while
function updateShade(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  const now = playT;
  e.fly = 1.6 + Math.sin(now * 2.3 + e.seed) * 0.35;
  e.y0 = e.fly - 0.7;
  e.y1 = e.fly + 0.7;
  e.tilt.position.y = e.fly;
  if (e.st === 'idle') {
    if (dist < 12 && lineOfSight(e.pos, hero.pos)) {
      e.st = 'drift';
      floatWord('boo', e.pos.clone().setY(2.8), '#d8d4cc', 0.6);
    }
  } else if (e.st !== 'flee') {
    // weaving
    const w = Math.sin(now * 1.7 + e.seed) * 0.9;
    [mv.x, mv.z] = steer(e);
    const ox = mv.x;
    mv.x = mv.x - mv.z * w;
    mv.z = mv.z + ox * w;
    mv.sp = 3;
  }
  e.body.userData.mat.opacity = 0.55 + Math.sin(now * 6 + e.seed) * 0.25;
  for (const r of e.rims) r.opacity = e.body.userData.mat.opacity * 0.8;
  if (e.st === 'flee') {
    mv.x = -ux;
    mv.z = -uz;
    mv.sp = 4.2;
    if (e.t <= 0) e.st = 'drift';
  } else if (e.st === 'drift' && dist < e.r + hero.r + 0.2 && hero.dodgeT <= 0 && (hero.spook || 0) <= 0 && state === 'play') {
    hero.spook = 1.6;
    e.st = 'flee';
    e.t = 2.6;
    floatWord('BOO!', e.pos.clone().setY(e.fly + 1.2), '#d8d4cc', 0.9);
    playTone({ f: 700, f2: 180, dur: 0.45, type: 'sine', gain: 0.08 });
    playNoise({ dur: 0.4, f: 900, f2: 300, type: 'bandpass', gain: 0.12 });
    if (hero.ammo > 0) {
      hero.ammo--;
      e.stolen = (e.stolen || 0) + 1; // given back when it pops
      updateAmmo();
      floatWord('-1 PEBBLE', hero.pos.clone().setY(hero.pos.y + 2.3), '#d8d4cc', 0.6);
    }
  }
}
TALKERS.q = {
  make: makeShade,
  update: updateShade,
  pops: true,
  harmless: true,
  tornWord: 'POPPED',
  hurt: e => e.hp > 0 && Math.random() < 0.08 && giveAmmo(1, e.pos),
  drops: e => {
    dropsDefault(e);
    giveAmmo(Math.max(e.stolen || 0, Math.random() < 0.4 ? 1 : 0), e.pos); // and the pebbles it pinched
  }
};
