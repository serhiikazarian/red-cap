// Floor three's secret and its reward. Two plaques, LIVIN' and DYIN', on opposite walls, and a dark painting behind the start:
// hit both plaques and the painting wakes as Livin' / Dyin' (the hidden boss, 31-living-dying.js). Beaten, it leaves the
// Laughin' Jaw, which rides on Red Cap's shoulder and heckles the Jester into laughing (unmasked).
// the plaques and the sleeping painting, set up while floor three is built
function hideLivingDying() {
  G.plaques = [];
  for (const [name, x, z, yaw] of [
    ['ld_living', 3.04, 31.5, Math.PI / 2],
    ['ld_dying', 59.96, 31.5, -Math.PI / 2]
  ]) {
    const m = paper(name, 0.75, 0.06, true);
    m.position.set(x, 1.9, z);
    m.rotation.y = yaw;
    G.group.add(m);
    const glow = glowSprite(glowRed, { transparent: true, opacity: 0.25 });
    glow.position.set(x, 2.25, z);
    glow.scale.set(2.2, 1.4, 1);
    G.group.add(glow);
    G.plaques.push({ m, glow, x, z, lit: false, word: name === 'ld_living' ? 'LIVIN’' : 'DYIN’' });
  }
  const f = framed(TEX.t_ldcanvas, 2.7, 3.85, 10.5 * CELL, 2.6, (G.h - 1) * CELL - 0.05, Math.PI, 0, '', false);
  f.pic.material.color.setHex(0x3a3a3a);
  G.ldPainting = f;
  G.ld = null;
}
// a plaque hit lights up; both lit wake the painting
function hitPlaque(p, rad) {
  if (!G.plaques) return false;
  for (const q of G.plaques) {
    if (q.lit || Math.hypot(q.x - p.x, q.z - p.z) > rad + 1) continue;
    q.lit = true;
    q.glow.material.opacity = 1;
    q.glow.scale.set(3.2, 2, 1);
    q.m.userData.mat.emissive.setHex(0x661010);
    SFX.unmask();
    floatWord(q.word, new THREE.Vector3(q.x, 3, q.z), HEX.tie, 1.2);
    burst(new THREE.Vector3(q.x, 2, q.z), [COL.tie, COL.bile, 0x3a5ad8], 16, 4, 0.16);
    if (G.plaques.every(o => o.lit)) {
      toast('Behind where you started, a paintin’ opens its eyes.');
      G.ldWake = 2.2;
      SFX.villain();
    } else toast(q.word + '. Somewhere, the other word is listenin’.');
    return true;
  }
  return false;
}
// the reward: a jaw that will not stop laughing at the Jester
function spawnJaw(x, z) {
  const j = jawModel(1.1),
    m = j.g;
  m.position.set(x, 1, z);
  G.group.add(m);
  const glow = glowSprite(fireTex, { transparent: true, opacity: 0.7 });
  glow.position.set(x, 1.4, z);
  glow.scale.setScalar(2);
  G.group.add(glow);
  G.jawPickup = { m, glow, x, z, j };
  toast('Somethin’ is left behind, laughin’.');
}
// the plaques glow until hit; the painting shakes awake; the Jester's final mask; the jaw lies laughing until taken, then
// rides on Red Cap's shoulder
function updateSecrets(dt) {
  const now = performance.now() / 1000;
  if (G.plaques) for (const q of G.plaques) if (!q.lit) q.glow.material.opacity = 0.18 + Math.sin(now * 2.5 + q.x) * 0.12;
  if (G.ldWake > 0) {
    G.ldWake -= dt;
    if (animTick) G.ldPainting.g.position.x = 10.5 * CELL + rand(-0.05, 0.05);
    if (G.ldWake <= 0) livingDyingWakeUp();
  }
  if (G.finalMask) updateFinalMask(dt, now);
  if (G.jawPickup) jawPickup(dt, now);
  if (hero.hasJaw && hero.jawBuddy) jawBuddy(dt, now);
}
// the jaw on the floor, until Red Cap walks over it
function jawPickup(dt, now) {
  const j = G.jawPickup;
  j.m.position.y = 0.6 + Math.sin(now * 3) * 0.2;
  j.m.rotation.y += dt * 2;
  j.j.set(Math.abs(Math.sin(now * 13)) * 0.8);
  if (heroDist(j.x, j.z) < 1.2) {
    G.group.remove(j.m);
    G.group.remove(j.glow);
    G.jawPickup = null;
    hero.hasJaw = true;
    giveJawBuddy();
    SFX.villain(true);
    SFX.pickup();
    toast('The Laughin’ Jaw. The Jester cannot stand it.');
    $('#wJaw').hidden = false;
  }
}
// the jaw on his shoulder heckles the Jester into laughing (unmasked) every 8 s
function jawBuddy(dt, now) {
  const b = hero.jawBuddy,
    rx = Math.cos(cam.yaw),
    rz = -Math.sin(cam.yaw);
  b.position.set(hero.pos.x - rx * 0.7, 2.1 + Math.abs(Math.sin(now * 8)) * 0.1, hero.pos.z - rz * 0.7);
  b.rotation.y = cam.yaw;
  if (hero.jawBuddyJ) hero.jawBuddyJ.set(Math.abs(Math.sin(now * 12)) * 0.7);
  const J = jester();
  G.jawT -= dt;
  if (J && G.jawT <= 0 && J.masked && (J.st === 'walk' || J.st === 'idle') && J.pos.distanceTo(hero.pos) < 15) {
    G.jawT = 8;
    floatWord(pick(['NICE MASK', 'CLOWN', 'HA HA HA', 'SHOW YOUR FACE']), b.position.clone().setY(3.2), HEX.bile, 0.9);
    SFX.villain(true);
    J.st = 'laugh';
    J.t = 4.4;
    setMasked(J, false);
    floatWord("WHO'S LAUGHING?!", J.pos.clone().setY(4.8), HEX.tie, 1.2);
  }
}
// a cartoon jaw in two pieces: the top teeth and the jawbone, snapping open and shut
function jawModel(h) {
  const g = new THREE.Group(),
    up = paper('jaw_up', h * 0.44, 0.08),
    loP = new THREE.Group(),
    lo = paper('jaw_lo', h * 0.55, 0.08);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.95, h * 0.5), new THREE.MeshBasicMaterial({ color: 0x2a0608 }));
  mouth.position.set(0, h * 0.5, -0.07);
  g.add(mouth);
  loP.add(lo);
  g.add(loP, up);
  const base = h * 0.5;
  const set = o => {
    up.position.y = base + o * h * 0.2;
    up.rotation.z = o * 0.08;
    loP.position.y = -o * h * 0.06;
    loP.rotation.z = -o * 0.05;
    mouth.scale.y = 0.15 + o;
  };
  set(0);
  return { g, up, lo, set };
}
// the jaw on Red Cap's shoulder
function giveJawBuddy() {
  const j = jawModel(0.55);
  scene.add(j.g);
  hero.jawBuddy = j.g;
  hero.jawBuddyJ = j;
}
// the jaw lost (a new game, or a retry of the floor where he found it)
function loseJaw() {
  hero.hasJaw = false;
  if (hero.jawBuddy) {
    scene.remove(hero.jawBuddy);
    hero.jawBuddy = hero.jawBuddyJ = null;
  }
  $('#wJaw').hidden = true;
}
