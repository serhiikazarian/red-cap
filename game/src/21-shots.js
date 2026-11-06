// Talkers' shots: a Grin's fireball, the Priest's blood (drops and rain), the red orbs, Bruno's insults and embers.
// kind: 'fire' and 'word' hurt and burst; 'blood' soaks and falls; 'rain' (the Priest's) falls from above.
const shots = [];
function fireball(from, dir) {
  const s = glowSprite(violetTex, { fog: false });
  s.scale.setScalar(1.2);
  s.position.copy(from);
  scene.add(s);
  shots.push({ kind: 'fire', s, v: dir.clone().multiplyScalar(10.5), life: 4 });
  SFX.fireball();
}
// a blood drop is a slot in the BLOOD pool (06-fx) with a stand-in for a sprite's fields; none free: it is gone at once
function bloodDrop(from, v) {
  const slot = bloodFree.length ? bloodFree.pop() : null,
    m = {
      position: from.clone(),
      rotation: { z: 0 },
      scale: new THREE.Vector3(rand(0.2, 0.36), rand(0.4, 0.75), 1),
      slot,
      material: { dispose() {} }
    };
  if (slot != null) {
    BLOOD.setColorAt(slot, tmpC.setHex(pick([COL.cap, 0x8a0d18, COL.tie])));
    BLOOD.instanceColor.needsUpdate = true;
    bloodSlot(m);
  }
  const b = { kind: 'blood', s: m, v, life: slot == null ? 0 : 2 };
  shots.push(b);
  return b;
}
function redOrb(from, dir) {
  const s = glowSprite(glowRed, { fog: false });
  s.scale.setScalar(0.8);
  s.position.copy(from);
  scene.add(s);
  shots.push({ kind: 'fire', s, v: dir.clone().multiplyScalar(9), life: 3.5 });
  playTone({ f: 700, f2: 300, dur: 0.15, type: 'square', gain: 0.05 });
}
function insultShot(from, dir, word, color) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: wordTex(word || pick(['STUPID', 'MORON', 'TOOL']), color || HEX.hot),
      transparent: true,
      depthWrite: false,
      fog: false
    })
  );
  s.scale.set(2, 0.7, 1);
  s.position.copy(from).setY(1.5);
  scene.add(s);
  const b = { kind: 'word', s, v: dir.multiplyScalar(8.5), life: 3 };
  shots.push(b);
  return b;
}
// Bruno's insults (parry) can be struck down by the yo-yo's string at p (radius rad; pebbles fly through them to him): they burst into scraps; true if one did
function hitWord(p, rad) {
  let hit = false;
  for (const b of shots) {
    if (!b.parry || b.life <= 0 || Math.abs(b.s.position.y - p.y) > 0.6 || Math.hypot(b.s.position.x - p.x, b.s.position.z - p.z) > rad + 0.8)
      continue;
    b.life = 0; // updateShots bursts it and takes it away
    hit = true;
    burst(b.s.position.clone(), [COL.hot, COL.paper, COL.ink], 14, 5, 0.18);
    playNoise({ dur: 0.18, f: 3200, f2: 1200, q: 2, gain: 0.22 });
    SFX.tink();
  }
  return hit;
}
function emberShot(from, dir) {
  const s = glowSprite(fireTex, { fog: false });
  s.scale.setScalar(0.55);
  s.position.copy(from);
  scene.add(s);
  shots.push({ kind: 'fire', s, v: dir.multiplyScalar(13), life: 3 });
  playTone({ f: 900, f2: 300, dur: 0.15, type: 'triangle', gain: 0.1 });
}

const SHOT_FALL = 9, // m/s² pulling blood and rain down
  SHOT_REACH = { fire: 0.7, word: 0.85 }, // how close to Red Cap a shot hits him (any other kind: SHOT_REACH_ELSE)
  SHOT_REACH_ELSE = 0.55,
  FIRE_TRAIL = [0xffb030, 0xff5a1a, COL.bile],
  FIRE_BURST = [0xffb030, 0xff5a1a, COL.ink];
const falls = b => b.kind === 'blood' || b.kind === 'rain';

// Each frame every shot flies, then walls and props stop it (a pyramid takes it as a blow), blood and rain land (and may leave
// a pool), and one that reaches Red Cap hurts him (blood soaks him even when the blow itself is not taken). Every test runs
// each frame, even for a shot already spent: each may leave its mark, and the dice must roll the same way.
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i];
    shot.life -= dt;
    flyShot(shot, dt);
    let dead = shot.life <= 0;
    if (shotHitsScenery(shot)) dead = true;
    if (shotLands(shot)) dead = true;
    if (!dead && shotHitsHero(shot)) dead = true;
    if (dead) {
      endShot(shot);
      shots.splice(i, 1);
    } else if (shot.s.slot != null) bloodSlot(shot.s);
  }
  if (BLOOD) BLOOD.instanceMatrix.needsUpdate = true;
}
// blood starts falling before it moves, the Priest's rain after (as each was tuned); fire trails sparks, blood spins
function flyShot(shot, dt) {
  if (shot.kind === 'blood') shot.v.y -= SHOT_FALL * dt;
  shot.s.position.addScaledVector(shot.v, dt);
  if (shot.kind === 'rain') shot.v.y -= SHOT_FALL * dt;
  if ((shot.kind === 'fire' || shot.kind === 'word') && Math.random() < 0.6) burst(shot.s.position, FIRE_TRAIL, 1, 1.2, 0.14, { g: -2, life: 0.5 });
  if (shot.kind === 'blood') shot.s.rotation.z += dt * 10;
}
// a wall, or a prop's trunk (below 3.2 m); a pyramid takes it as a blow (the rain strikes once, as it lands)
function shotHitsScenery(shot) {
  const p = shot.s.position,
    [ix, iz] = cellOf(p.x, p.z);
  if (solid(ix, iz)) return true;
  const reach = propRadius(cellAt(ix, iz));
  if (!reach || p.y >= 3.2 || Math.hypot(p.x - cellMid(ix), p.z - cellMid(iz)) >= reach + 0.15) return false;
  if (shot.kind !== 'rain') hitPyr(p, 0.15, shot.volley);
  return true;
}
function shotLands(shot) {
  const p = shot.s.position;
  if (!falls(shot) || p.y >= heightAt(p.x, p.z) + 0.05) return false;
  if (Math.random() < 0.12) bloodPool(p.x, p.z, rand(0.25, 0.6));
  return true;
}
// the rain never strikes him on the way down (only where it lands); returns whether the shot is spent
function shotHitsHero(shot) {
  const p = shot.s.position,
    reach = SHOT_REACH[shot.kind] || SHOT_REACH_ELSE;
  if (shot.kind === 'rain' || heroDist(p.x, p.z) >= reach) return false;
  if (p.y - hero.pos.y >= 2.2 || p.y <= hero.pos.y - 0.5) return false;
  let spent = false;
  if (shot.kind === 'blood' && hero.dodgeT <= 0 && (hero.dodgeIF || 0) <= 0) {
    soak();
    spent = true;
  }
  if (hurtHero(1, p)) spent = true;
  else if (shot.kind === 'fire' && hero.dodgeT <= 0) spent = true;
  return spent;
}
// fire and words burst; a blood drop gives its slot back to the BLOOD pool, a sprite is taken away
function endShot(shot) {
  if (!falls(shot)) burst(shot.s.position, FIRE_BURST, 10, 4, 0.2);
  if (shot.s.slot === undefined) {
    scene.remove(shot.s);
    shot.s.material.dispose();
  } else if (shot.s.slot != null) {
    BLOOD.setMatrixAt(shot.s.slot, ZERO_M);
    bloodFree.push(shot.s.slot);
    shot.s.slot = null;
  }
}
