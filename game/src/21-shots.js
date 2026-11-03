// Talkers' shots: a Grin's fireball, the Priest's blood (drops and rain), the red orbs, Bruno's insults and embers.
// kind: 'fire' and 'word' hurt and burst; 'blood' soaks and falls; 'rain' (the Priest's) falls from above.
const shots = [];
function fireball(from, dir) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: violetTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRed, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(0.8);
  s.position.copy(from);
  scene.add(s);
  shots.push({ kind: 'fire', s, v: dir.clone().multiplyScalar(9), life: 3.5 });
  sTone({ f: 700, f2: 300, dur: 0.15, type: 'square', gain: 0.05 });
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
    b.life = 0; // updShots bursts it and takes it away
    hit = true;
    burst(b.s.position.clone(), [COL.hot, COL.paper, COL.ink], 14, 5, 0.18);
    sNoise({ dur: 0.18, f: 3200, f2: 1200, q: 2, gain: 0.22 });
    SFX.tink();
  }
  return hit;
}
function emberShot(from, dir) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(0.55);
  s.position.copy(from);
  scene.add(s);
  shots.push({ kind: 'fire', s, v: dir.multiplyScalar(13), life: 3 });
  sTone({ f: 900, f2: 300, dur: 0.15, type: 'triangle', gain: 0.1 });
}

// shots fly; walls and props stop them, and a pyramid takes one as a blow; blood and rain fall and may leave a pool; one that reaches Red Cap hurts him
// (blood soaks him even when the blow itself is not taken)
function updShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const b = shots[i];
    b.life -= dt;
    let dead = b.life <= 0;
    if (b.kind === 'blood') b.v.y -= 9 * dt;
    b.s.position.addScaledVector(b.v, dt);
    if ((b.kind === 'fire' || b.kind === 'word') && Math.random() < 0.6)
      burst(b.s.position, [0xffb030, 0xff5a1a, COL.bile], 1, 1.2, 0.14, { g: -2, life: 0.5 });
    if (b.kind === 'blood') b.s.rotation.z += dt * 10;
    const p = b.s.position,
      [ix, iz] = cellOf(p.x, p.z);
    if (solid(ix, iz)) dead = true;
    else {
      const pr = propR(ch(ix, iz));
      if (pr && p.y < 3.2 && Math.hypot(p.x - (ix * CELL + CELL / 2), p.z - (iz * CELL + CELL / 2)) < pr + 0.15) {
        dead = true;
        if (b.kind !== 'rain') hitPyr(p, 0.15, b.volley); /* a pyramid takes it as a blow (the rain strikes once as it lands) */
      }
    }
    if (b.kind === 'rain') b.v.y -= 9 * dt;
    if ((b.kind === 'blood' || b.kind === 'rain') && p.y < heightAt(p.x, p.z) + 0.05) {
      dead = true;
      if (Math.random() < 0.12) bloodPool(p.x, p.z, rand(0.25, 0.6));
    }
    const dh = Math.hypot(p.x - hero.pos.x, p.z - hero.pos.z);
    if (
      !dead &&
      b.kind !== 'rain' &&
      dh < (b.kind === 'fire' ? 0.7 : b.kind === 'word' ? 0.85 : 0.55) &&
      p.y - hero.pos.y < 2.2 &&
      p.y > hero.pos.y - 0.5
    ) {
      if (b.kind === 'blood' && hero.dodgeT <= 0 && (hero.dodgeIF || 0) <= 0) {
        soak();
        dead = true;
      }
      if (hurtHero(1, p)) dead = true;
      else if (b.kind === 'fire' && hero.dodgeT <= 0) dead = true;
    }
    if (dead) {
      if (b.kind !== 'blood' && b.kind !== 'rain') burst(p, [0xffb030, 0xff5a1a, COL.ink], 10, 4, 0.2);
      if (b.s.slot !== undefined) {
        if (b.s.slot != null) {
          BLOOD.setMatrixAt(b.s.slot, ZERO_M);
          bloodFree.push(b.s.slot);
          b.s.slot = null;
        }
      } else {
        scene.remove(b.s);
        b.s.material.dispose();
      }
      shots.splice(i, 1);
    } else if (b.s.slot != null) bloodSlot(b.s);
  }
  if (BLOOD) BLOOD.instanceMatrix.needsUpdate = true;
}
