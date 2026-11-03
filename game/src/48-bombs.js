// Bombs (floor two): one or two pyramids hold a bomb instead of a tie, and one or two others leave no heart (they look the
// same), picked fresh each time the floor starts. The bomb shows through the glass like the tie, and goes off as its pyramid
// shatters: one tie off Red Cap in reach (two close by), a heavy blow to every talker in reach, and it breaks any cage it reaches.
const BOMB_R = 4.5, // metres: the blast's reach (one tie)
  BOMB_CLOSE = 2, // metres: this close, two ties
  BOMB_DMG = 3, // what it does to a talker in reach
  BOMB_TWO = 0.5, // the chance two pyramids hold a bomb (else one)
  PYR_EMPTY_TWO = 0.3; // the chance two pyramids leave no heart (else one)
const BOMB_SEEN = {}; // the bomb seen inside its pyramid: its shape, made once
// a fresh pick each time the floor starts (its own dice: the layout stays): 1 or 2 bombs, then 1 or 2 of the rest with no heart
function hideBombs() {
  const ks = Object.keys(G.pyr).sort(() => Math.random() - 0.5),
    bombs = Math.random() < BOMB_TWO ? 2 : 1,
    empty = Math.random() < PYR_EMPTY_TWO ? 2 : 1;
  for (const k of ks.slice(0, bombs)) {
    const q = G.pyr[k],
      old = q.tie,
      m = new THREE.Mesh(BOMB_SEEN.g || (BOMB_SEEN.g = share(new THREE.PlaneGeometry(0.62, 0.62).translate(0, 0.27, 0))), old.userData.mat.clone());
    m.material.map = bombTex();
    m.material.side = THREE.DoubleSide;
    m.position.copy(old.position);
    G.group.remove(old);
    G.group.add(m);
    q.tie = m;
    q.bomb = true;
  }
  for (const k of ks.slice(bombs, bombs + empty)) G.pyr[k].empty = true;
}
// a bomb drawn on paper: a round black ball with a pale ink rim and shine, its fuse and a spark (seen faintly inside a pyramid)
function bombTex() {
  if (BOMB_SEEN.t) return BOMB_SEEN.t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.lineCap = 'round';
  x.strokeStyle = HEX.paper;
  x.lineWidth = 7;
  x.beginPath();
  x.moveTo(78, 34);
  x.quadraticCurveTo(92, 14, 104, 18);
  x.stroke();
  x.strokeStyle = '#8a6a40';
  x.lineWidth = 4;
  x.stroke();
  x.fillStyle = HEX.paper;
  x.beginPath();
  x.arc(60, 76, 44, 0, TAU);
  x.fill();
  x.fillStyle = '#141012';
  x.beginPath();
  x.arc(60, 76, 38, 0, TAU);
  x.fill();
  x.fillStyle = HEX.paper;
  x.fillRect(66, 30, 18, 12);
  x.beginPath();
  x.ellipse(46, 60, 9, 5, -0.7, 0, TAU);
  x.fill();
  const sp = x.createRadialGradient(106, 16, 1, 106, 16, 16);
  sp.addColorStop(0, '#fff6c0');
  sp.addColorStop(0.5, '#ff8a20');
  sp.addColorStop(1, 'rgba(255,90,20,0)');
  x.fillStyle = sp;
  x.fillRect(88, 0, 36, 34);
  BOMB_SEEN.t = own(new THREE.CanvasTexture(c));
  return BOMB_SEEN.t;
}
// the bomb goes off: a flash, a moment of slow motion, a heart or two from Red Cap in reach, a big blow to the talkers
function bombBlast(x, z) {
  const p = new THREE.Vector3(x, heightAt(x, z) + 0.8, z),
    at = AU.at;
  AU.at = null; // full loudness wherever Red Cap is
  sTone({ f: 70, f2: 22, dur: 1.4, gain: 0.8 });
  sTone({ f: 140, f2: 40, dur: 0.6, type: 'sawtooth', gain: 0.35, filt: [900, 120] });
  sNoise({ dur: 1.3, f: 3000, f2: 120, q: 0.5, gain: 0.8 });
  sNoise({ dur: 0.4, f: 7000, f2: 1500, q: 0.8, gain: 0.4, at: 0.03 });
  for (let i = 0; i < 6; i++) sNoise({ dur: 0.12, f: rand(400, 1600), q: 2, gain: 0.25, at: 0.25 + i * rand(0.08, 0.16) }); // debris coming down
  AU.at = at;
  cam.shake = Math.max(cam.shake, 1.1);
  slowT = Math.max(slowT, 0.25);
  const fl = $('#flash');
  fl.classList.add('on');
  setTimeout(() => fl.classList.remove('on'), 110);
  SFX.boom();
  for (let i = 0; i < 3; i++) burst(p.clone().setY(p.y + i * 0.6), [0xfff0a0, COL.bile, COL.hot, COL.tie, 0x1a1618], 45, 13, 0.36, { g: 9 });
  for (let i = 0; i < 12; i++) smokePuff(p.clone().add(new THREE.Vector3(rand(-2.2, 2.2), rand(0, 2), rand(-2.2, 2.2))), rand(2, 3.4), 1.6, 1.2);
  floatWord('BOOM', p.clone().setY(p.y + 3), HEX.bile, 1.8, true);
  const d = Math.hypot(hero.pos.x - x, hero.pos.z - z);
  if (d < BOMB_R) hurtHero(d < BOMB_CLOSE ? 2 : 1, p, true);
  for (const e of G.enemies) {
    if (e.dead || e.dying || e.dormant || e.hidden) continue;
    const dx = e.pos.x - x,
      dz = e.pos.z - z,
      de = Math.hypot(dx, dz);
    if (de >= BOMB_R + (e.r || 0.5)) continue;
    const caged = e.caged;
    damage(e, BOMB_DMG, dx / (de || 1), dz / (de || 1), true);
    if (caged && !e.caged) damage(e, BOMB_DMG, dx / (de || 1), dz / (de || 1), true); // a cage or stake breaks, and the blast still lands
  }
}
