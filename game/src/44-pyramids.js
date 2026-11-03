// Pyramids (floor two's 'T' cells): Serj's model with a glowing core and a turning orb, an ink rim drawn right after it, a red
// pool of light, and a tie half-seen inside. Three blows shatter one (it screams at the first two); it leaves a heart, but one
// or two hold a bomb and one or two are empty (48-bombs.js). Walkers keep out of its square foot; sight lines and shots meet its two-piece shape (pyrParts).
const PYR_H = 2.3, // metres from its foot to its tip (its foot is 1.4 m square: Red Cap passes one in a corridor)
  PYR_R = 0.25 * PYR_H, // its body's half-width at mid-height: the round part sight lines and pebbles are stopped by (propR)
  PYR_PAD = 0.05, // metres beyond its square foot that Red Cap and the talkers are kept (collide, pyrPush)
  PYR_GLOW = [0.75, 0.12, 0.08], // its core and scratches' glow (the emissive colour on pyr_glow), breathing (pyrGlow)
  PYR_LIFT = 0.7, // its model's colours this far towards white, so the painting shows
  PYR_BRIGHT = 1.5, // and its lit colour this much brighter than the plain texture (floor two's light is dim and red)
  PYR_SPLIT = 70, // in the model's units: below, the body; above, the core and the orb (pyrParts)
  PYR_CAP_Y = 101, // in the model's units: triangles wholly above this are the capstone, left out (the orb stands there)
  PYR_ORB = [88, 192, 0.3], // the orb: radius and centre height in the model's units, and how far its dark colour is lifted towards white
  PYR_ORB_SPIN = 0.55, // the orb's turn, radians a second, round an axis tilted PYR_ORB_TILT from upright
  PYR_ORB_TILT = 0.35,
  PYR_ORB_COL = [0.16, 0.04, 0.06]; // its colour: near-black crimson; the painting and its glowing scratches show through
let PYR = null;
const PYR_HP = 3, // blows to shatter a pyramid
  PYR_TIE_OUT = 0.03, // its tie stands this far in front of the body's face at the seam, towards the camera
  PYR_TIE_Y = -0.53, // its foot this far above the seam (its middle 28 cm below it: the body hides its lowest tip)
  PYR_TIE_A = 0.2, // how strongly it shows through: barely
  PYR_RIM = 3; // its ink rim's width in screen pixels (of the page, before the device's pixel ratio)
// floor two's pyramid in a cell (G.pyr, set by buildLevel): where it stands and how its square foot is turned
const pyrAt = (ix, iz) => (G && G.pyr ? G.pyr[ix + iz * G.w] : undefined);

// its shape as two convex pieces (body; core and capstone) in its own space, each a square frustum turned by its own angle: y0..y1,
// half-width b0 at y0 narrowing by k a metre, (cs, sn) the turn; fitted round the model's own points
function pyrParts(pos, split) {
  const parts = [];
  for (const up of [false, true]) {
    const P = [];
    for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > split === up) P.push([pos[i], pos[i + 1], pos[i + 2]]);
    let w = P[0]; // the widest point: a corner, which gives the turn
    for (const p of P) if (Math.hypot(p[0], p[2]) > Math.hypot(w[0], w[2])) w = p;
    const t = Math.atan2(w[2], w[0]) - Math.PI / 4,
      cs = Math.cos(t),
      sn = Math.sin(t),
      half = p => Math.max(Math.abs(p[0] * cs + p[2] * sn), Math.abs(p[2] * cs - p[0] * sn)),
      y0 = Math.min(...P.map(p => p[1])),
      y1 = Math.max(...P.map(p => p[1]));
    let b1 = 0;
    for (const p of P) if (p[1] > y1 - 1e-4) b1 = Math.max(b1, half(p));
    let b0 = b1;
    for (const p of P) {
      const u = (p[1] - y0) / (y1 - y0);
      if (u < 1 - 1e-4) b0 = Math.max(b0, (half(p) - b1 * u) / (1 - u));
    }
    parts.push({ y0, y1, b0, k: (b0 - b1) / (y1 - y0), cs, sn });
  }
  return parts;
}
// a pyramid's mesh; the first call builds the shared shape (the model scaled to PYR_H, the capstone swapped for the orb), its
// material, its parts, the pool, and the rim (the same triangles with smoothed normals, pushed out in screen space)
function pyramid() {
  if (!PYR) {
    const S = PYR_SRC,
      keep = [];
    for (let t = 0; t < S.idx.length; t += 3)
      if (!(Math.min(...[0, 1, 2].map(j => S.pos[S.idx[t + j] * 3 + 1])) > PYR_CAP_Y)) keep.push(S.idx[t], S.idx[t + 1], S.idx[t + 2]);
    const orb = new THREE.SphereGeometry(PYR_ORB[0], 24, 16).toNonIndexed(),
      n = keep.length + orb.attributes.position.count,
      pos = new Float32Array(n * 3),
      uv = new Float32Array(n * 2),
      col = new Float32Array(n * 3);
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 1; i < S.pos.length; i += 3) {
      lo = Math.min(lo, S.pos[i]);
      hi = Math.max(hi, S.pos[i]);
    }
    const k = PYR_H / (hi - lo); // its foot on the ground, PYR_H tall
    keep.forEach((v, i) => {
      pos.set([S.pos[v * 3] * k, (S.pos[v * 3 + 1] - lo) * k, S.pos[v * 3 + 2] * k], i * 3);
      uv.set([S.uv[v * 2], S.uv[v * 2 + 1]], i * 2);
      col.set(
        S.pal.slice(S.col[v] * 3, S.col[v] * 3 + 3).map(c => lerp(c, 1, PYR_LIFT)),
        i * 3
      );
    });
    const OP = orb.attributes.position,
      OU = orb.attributes.uv,
      oc = PYR_ORB_COL.map(c => lerp(c, 1, PYR_ORB[2]));
    for (let j = 0, i = keep.length; j < OP.count; j++, i++) {
      pos.set([OP.getX(j) * k, (OP.getY(j) + PYR_ORB[1] - lo) * k, OP.getZ(j) * k], i * 3);
      uv.set([0.54 + 0.42 * OU.getX(j), 0.54 + 0.42 * OU.getY(j)], i * 2); // the painting's top quarter, wrapped round it
      col.set(oc, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals(); // flat: every triangle has its own corners
    for (let j = 0, i = keep.length; j < OP.count; j++, i++) {
      const v = new THREE.Vector3(OP.getX(j), OP.getY(j), OP.getZ(j)).normalize(); // but the orb is smooth
      g.attributes.normal.setXYZ(i, v.x, v.y, v.z);
    }
    orb.dispose();
    PYR = {
      geo: share(g),
      // the painted texture, the model's colours (lifted) and glow: lit paper, like everything here
      mat: share(
        new THREE.MeshLambertMaterial({
          map: TEX.pyr_base,
          emissiveMap: TEX.pyr_glow,
          vertexColors: true,
          color: new THREE.Color(PYR_BRIGHT, PYR_BRIGHT, PYR_BRIGHT),
          emissive: new THREE.Color(...PYR_GLOW),
          side: THREE.DoubleSide
        })
      ),
      parts: pyrParts(
        S.pos.map((v, i) => (i % 3 === 1 ? v - lo : v) * k),
        (PYR_SPLIT - lo) * k
      ) // with the capstone, not the orb
    };
    PYR.foot = PYR.parts[0].b0 + PYR_PAD; // the square Red Cap and the talkers are kept out of: half its side
    PYR.turn = Math.atan2(PYR.parts[0].sn, PYR.parts[0].cs); // the body's own turn in the model
    PYR.core = PYR.parts[1].y0 + 0.04 * PYR_H; // the glowing core's height, between the body and the orb
    // a pool of red light on the floor (additive, no depth written: light, not things)
    const glow = { map: glowRed, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false };
    PYR.poolM = share(new THREE.MeshBasicMaterial({ ...glow, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    PYR.poolG = share(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    // its ink rim: the same triangles with each corner's normal averaged over the faces that meet there (no gaps open at the edges)
    {
      const rg = g.clone(),
        P = rg.attributes.position,
        N = rg.attributes.normal,
        sum = new Map(),
        key = i => P.getX(i).toFixed(3) + ',' + P.getY(i).toFixed(3) + ',' + P.getZ(i).toFixed(3);
      for (let i = 0; i < P.count; i++) {
        const k = key(i),
          v = sum.get(k) || new THREE.Vector3();
        sum.set(k, v.add(new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i))));
      }
      for (let i = 0; i < P.count; i++) {
        const v = sum.get(key(i)).clone().normalize();
        N.setXYZ(i, v.x, v.y, v.z);
      }
      rg.deleteAttribute('uv');
      rg.deleteAttribute('color');
      PYR.rimGeo = share(rg);
      PYR.rimMat = share(
        new THREE.ShaderMaterial({
          uniforms: { res: { value: new THREE.Vector2(1, 1) }, w: { value: PYR_RIM }, ink: { value: new THREE.Color(COL.ink) } },
          vertexShader: `uniform vec2 res; uniform float w;
            void main(){
              vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.);
              vec2 n = (projectionMatrix * modelViewMatrix * vec4(normal, 0.)).xy * res;
              c.xy += normalize(n + vec2(1e-6)) / res * 2. * w * c.w;
              gl_Position = c;
            }`,
          fragmentShader: `uniform vec3 ink; void main(){ gl_FragColor = vec4(ink, 1.); }`,
          side: THREE.BackSide
        })
      );
    }
    // the orb is its own mesh (it turns); the body is the rest; the rim keeps both
    const cut = (a, b, dy) => {
      const q = new THREE.BufferGeometry();
      for (const [name, sz] of [
        ['position', 3],
        ['normal', 3],
        ['uv', 2],
        ['color', 3]
      ]) {
        const arr = g.attributes[name].array.slice(a * sz, b * sz);
        if (dy && name === 'position') for (let i = 1; i < arr.length; i += 3) arr[i] -= dy;
        q.setAttribute(name, new THREE.BufferAttribute(arr, sz));
      }
      return share(q);
    };
    PYR.orbY = (PYR_ORB[1] - lo) * k;
    PYR.orbGeo = cut(keep.length, n, PYR.orbY);
    PYR.geo = cut(0, keep.length);
  }
  return new THREE.Mesh(PYR.geo, PYR.mat);
}
// one pyramid in cell (x, z): the baked body (a pillar's see-through rules), the turning orb, the rim drawn by the body, the tie
// half seen inside, and the pool of light; squared to the corridors (one random number)
function buildPyramid(x, z, cx, cz, rng) {
  const w = G.w;
  const t = pyramid();
  t.position.set(cx, 0, cz);
  t.rotation.y = Math.floor(rng() * 4) * (TAU / 4);
  const turn = t.rotation.y - PYR.turn;
  const q = ((G.pyr ??= {})[x + z * w] = {
    x: cx,
    z: cz,
    y: 0,
    cs: Math.cos(turn),
    sn: Math.sin(turn),
    hp: PYR_HP,
    cd: 0,
    bomb: false,
    empty: false
  });
  G.group.add(seeThru(still(t), false, 'pyramid'));
  q.see = G.see[t.userData.seeId - 1];
  // what the slingshot's aim locks on (aimInfo), like a talker: the reticle and a pebble go for its orb
  q.tgt = {
    pyr: q,
    pos: new THREE.Vector3(cx, 0, cz),
    r: PYR.foot,
    gy: 0,
    get fly() {
      return q.y + PYR.orbY;
    },
    get dead() {
      return q.hp <= 0;
    },
    dying: false,
    hidden: false
  };
  const orb = new THREE.Mesh(PYR.orbGeo, PYR.mat); // not baked: it turns (pyrTick)
  orb.position.set(cx, PYR.orbY, cz);
  orb.rotation.set(PYR_ORB_TILT, x * 1.7 + z * 2.3, 0);
  G.group.add(orb);
  q.orb = orb;
  if (!G.rimUp) {
    // three.js sends a shape to the graphics card only for things in the scene: an invisible stand-in does it for the rims
    G.rimUp = new THREE.Mesh(PYR.rimGeo, HIDE_MAT);
    G.rimUp.frustumCulled = false;
    G.group.add(G.rimUp);
  }
  const rim = new THREE.Mesh(PYR.rimGeo, PYR.rimMat); // not in the scene: its pyramid draws it (pyrRim)
  rim.position.copy(t.position);
  rim.rotation.copy(t.rotation);
  q.rim = rim;
  // the tie it holds: pyrTick keeps it on the face towards the camera
  const tie = paper('tie', 0.5, 0.06),
    tm = tie.userData.mat,
    pool = new THREE.Mesh(PYR.poolG, PYR.poolM);
  Object.assign(tm, {
    transparent: true, // half seen: glimpsed in the pyramid rather than stuck on it
    opacity: PYR_TIE_A,
    alphaTest: 0.5 * PYR_TIE_A, // the same cut-out as at full strength
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor
  });
  tie.position.set(cx, PYR.core - 0.12, cz);
  pool.renderOrder = -1; // drawn before see-through things: a fading pyramid covers it by its own alpha
  pool.position.set(cx, 0.03, cz);
  pool.scale.setScalar(PYR_H * 2);
  G.group.add(tie, pool);
  q.tie = tie;
  q.pool = pool;
}
// the pyramids' glow breathes, all together: their core and scratches (emissive) and the pools on the floor
function pyrGlow() {
  if (!PYR || !G || G.F.deco !== 'mouth') return;
  const k = 0.78 + 0.22 * Math.sin(performance.now() / 650);
  PYR.mat.emissive.setRGB(PYR_GLOW[0] * k, PYR_GLOW[1] * k, PYR_GLOW[2] * k);
  PYR.poolM.opacity = 0.45 * k;
}
// a pyramid's scream (n = 1, 2: the blows before it shatters): voices moaning out of tune through a dark vowel closing from "aah"
// to "ooh", torn by distortion, with a breath under it and a cave's echo; the second louder, longer, higher, with a shriek on top
function pyrScream(n) {
  if (!AU.ctx) return;
  const c = AU.ctx,
    t = c.currentTime,
    two = n >= 2,
    dur = two ? 1.6 : 1.15,
    f0 = two ? 128 : 98,
    vol = (two ? 0.3 : 0.24) * auK(AU.at);
  if (vol < 0.002) return;
  const g = c.createGain(),
    sh = c.createWaveShaper(),
    lp = c.createBiquadFilter(),
    dl = c.createDelay(1),
    fb = c.createGain(),
    wet = c.createGain(),
    curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curve[i] = Math.tanh((i / 511.5 - 1) * 3.5);
  sh.curve = curve;
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(two ? 3200 : 2200, t);
  lp.frequency.linearRampToValueAtTime(700, t + dur);
  env(g, t, 0.09, vol, dur);
  g.connect(sh);
  sh.connect(lp);
  lp.connect(AU.master);
  dl.delayTime.value = 0.17; // the echo off a stone vault
  fb.gain.value = 0.38;
  wet.gain.value = 0.45;
  lp.connect(dl);
  dl.connect(fb);
  fb.connect(dl);
  dl.connect(wet);
  wet.connect(AU.master);
  const voices = [
    [1, 0.5],
    [1.013, 0.45],
    [0.497, 0.4],
    [1.414, 0.3]
  ];
  if (two) voices.push([2.83, 0.22]); // the shriek
  const vib = c.createOscillator(),
    vg = c.createGain();
  vib.frequency.value = 4.3;
  vg.gain.value = f0 * 0.035;
  vib.connect(vg);
  for (const [r, k] of voices) {
    const o = c.createOscillator(),
      og = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * r * 0.75, t);
    o.frequency.exponentialRampToValueAtTime(f0 * r * 1.3, t + dur * 0.22);
    o.frequency.exponentialRampToValueAtTime(f0 * r * 0.5, t + dur);
    vg.connect(o.frequency);
    og.gain.value = k;
    for (const [fa, fz, q, w] of [
      [760, 380, 5, 1],
      [1150, 760, 6, 0.7],
      [2500, 2300, 9, two ? 0.5 : 0.25]
    ]) {
      const bp = c.createBiquadFilter(),
        bg = c.createGain();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(fa, t);
      bp.frequency.linearRampToValueAtTime(fz, t + dur);
      bp.Q.value = q;
      bg.gain.value = w * 2.5;
      o.connect(bp);
      bp.connect(bg);
      bg.connect(og);
    }
    og.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  vib.start(t);
  vib.stop(t + dur + 0.05);
  sNoise({ dur: dur * 0.9, f: 1400, f2: 500, q: 1.4, gain: two ? 0.09 : 0.07, a: 0.08 }); // the breath under it
}
// a yo-yo or a pebble at p (radius rad) against the pyramids: true if it struck one
function hitPyr(p, rad) {
  if (!G || !G.pyr) return false;
  for (const k in G.pyr) {
    const q = G.pyr[k];
    q.y = heightAt(q.x, q.z); // its foot (a pyramid on the raised ground stands higher)
    if (q.hp <= 0 || Math.hypot(p.x - q.x, p.z - q.z) > PYR.parts[0].b0 + rad || p.y > q.y + PYR_H + 0.2) continue;
    if (q.cd > 0) return true;
    q.cd = 0.25;
    q.hp--;
    q.shake = 0.35;
    const at = AU.at;
    AU.at = tmpW.set(q.x, 0, q.z);
    if (q.hp > 0) {
      pyrScream(PYR_HP - q.hp);
      sNoise({ dur: 0.2, f: 1600, f2: 500, q: 2, gain: 0.22, at: 0.01 });
    }
    AU.at = at;
    burst(new THREE.Vector3(q.x, q.y + 1.2, q.z), [0x5a1210, COL.cap, 0x2a2a2a, COL.bile], 10, 4, 0.16);
    cam.shake = Math.max(cam.shake, 0.14);
    if (q.hp > 0) floatWord(q.hp === 1 ? 'AAAH!' : 'EEK!', new THREE.Vector3(q.x, q.y + PYR_H + 0.8, q.z), HEX.bile, 0.9);
    else pyrShatter(k, q);
    return true;
  }
  return false;
}
// shattered: it bursts into shards and dust, leaves the floor (and every see-through and collision list) for good, and its tie falls
function pyrShatter(k, q) {
  // the crash: a thud, a burst of breaking, cracks after it and shards tinkling down
  const at = AU.at;
  AU.at = tmpW.set(q.x, 0, q.z);
  sTone({ f: 110, f2: 38, dur: 0.45, gain: 0.4 });
  sNoise({ dur: 0.55, f: 3800, f2: 900, q: 0.7, gain: 0.4 });
  sNoise({ dur: 0.35, f: 7000, f2: 3000, q: 1.2, gain: 0.22, at: 0.02 });
  for (let i = 0; i < 4; i++) sNoise({ dur: 0.07, f: rand(1800, 4200), q: 3, gain: 0.18, at: 0.08 + i * rand(0.05, 0.09) });
  for (let i = 0; i < 9; i++) sTone({ f: rand(2600, 5600), dur: rand(0.05, 0.12), type: 'triangle', gain: 0.05, at: 0.12 + Math.random() * 0.55 });
  AU.at = at;
  cam.shake = Math.max(cam.shake, 0.35);
  for (let i = 0; i < 4; i++)
    burst(new THREE.Vector3(q.x, q.y + 0.3 + i * 0.5, q.z), [0x5a1210, COL.cap, 0x2a2a2a, COL.paper, COL.bile], 22, 7, 0.26, { g: 14 });
  for (let i = 0; i < 5; i++)
    smokePuff(new THREE.Vector3(q.x + rand(-0.8, 0.8), q.y + rand(0.3, 1.6), q.z + rand(-0.8, 0.8)), rand(1.2, 2), 0.9, 0.6);
  const c = q.see;
  if (c) {
    if (c.on) seeOn(c, false);
    c.a = 1;
    c.off = true;
    for (const m of c.meshes) m.visible = false;
  }
  for (const m of [q.tie, q.pool]) if (m) G.group.remove(m);
  q.rim = null;
  delete G.pyr[k];
  const ix = Math.floor(q.x / CELL),
    iz = Math.floor(q.z / CELL);
  G.map[iz] = G.map[iz].slice(0, ix) + '.' + G.map[iz].slice(ix + 1);
  if (q.bomb) bombBlast(q.x, q.z);
  else if (!q.empty) spawnPickup(...heartRoom(q.x, q.z));
}
// each frame: the orb turns, the tie keeps to the face the camera sees, and a struck pyramid shakes
function pyrTick(dt) {
  if (!G || !G.pyr) return;
  for (const k in G.pyr) {
    const q = G.pyr[k];
    q.cd -= dt;
    q.y = heightAt(q.x, q.z);
    if (q.tgt) q.tgt.pos.y = q.y;
    if (q.orb) q.orb.rotation.y += dt * PYR_ORB_SPIN;
    if (q.tie) {
      // set into the face the camera sees, in the seam between the body and the capstone: the faces round it hide part of it
      const dx = camera.position.x - q.x,
        dz = camera.position.z - q.z,
        d = Math.hypot(dx, dz) || 1;
      // the body's face towards the camera at the seam (a square: further out seen across a corner), and the tie just in front of it
      const ux = dx / d,
        uz = dz / d,
        B = PYR.parts[0],
        out = (B.b0 - B.k * B.y1) / Math.max(Math.abs(ux * q.cs + uz * q.sn), Math.abs(uz * q.cs - ux * q.sn)) + PYR_TIE_OUT;
      q.tie.position.set(q.x + ux * out, q.y + B.y1 + PYR_TIE_Y, q.z + uz * out);
      q.tie.rotation.y = Math.atan2(dx, dz);
    }
    if (q.shake > 0 || q.shook) {
      q.shake -= dt;
      q.shook = q.shake > 0;
      const j = q.shook ? 0.06 * (q.shake / 0.35) : 0;
      for (const m of [...(q.see ? q.see.meshes : []), q.rim]) {
        if (!m) continue;
        if (!m.userData.p0) m.userData.p0 = m.position.clone();
        m.position.set(m.userData.p0.x + rand(-j, j), m.userData.p0.y, m.userData.p0.z + rand(-j, j));
        m.updateMatrix();
        m.matrixWorldNeedsUpdate = true;
      }
    }
  }
}
// a pyramid draws its ink rim right after itself, in the main picture only (not in the see-through mask)
function pyrRim(r, scene, cam) {
  const q = this.userData.pyrQ;
  if (!q || !q.rim || cam !== camera || r.getRenderTarget() !== rt) return;
  const m = q.rim;
  m.updateMatrixWorld();
  m.modelViewMatrix.multiplyMatrices(cam.matrixWorldInverse, m.matrixWorld);
  m.normalMatrix.getNormalMatrix(m.modelViewMatrix);
  r.renderBufferDirect(cam, scene, PYR.rimGeo, PYR.rimMat, m, null);
}
// before each picture: the rim's width follows the drawing size; a pyramid's baked mesh gets its rim once it exists (after baking)
function pyrSort() {
  if (!G || !G.pyr || !PYR) return;
  renderer.getDrawingBufferSize(PYR.rimMat.uniforms.res.value);
  PYR.rimMat.uniforms.w.value = PYR_RIM * renderer.getPixelRatio();
  for (const k in G.pyr) {
    const q = G.pyr[k];
    if (!q.see || !q.see.meshes.length) continue;
    if (!q.hooked) {
      q.hooked = true;
      for (const m of q.see.meshes) {
        m.userData.pyrQ = q;
        m.onAfterRender = pyrRim;
        m.userData.sortRank = 1;
      }
      if (q.orb) {
        q.see.meshes.push(q.orb); // the orb fades and shatters with it (its rim is drawn with the body's)
        q.orb.userData.sortRank = 0;
      }
    }
    // faded, the orb always draws before the body: the rim, drawn after the body, then stays hidden behind the orb as it is
    // behind the body (otherwise the camera's angle decides, and the orb's far side shows as a solid dark ball)
    sortV
      .set(q.x, q.y + PYR_H / 2, q.z)
      .applyMatrix4(camera.matrixWorldInverse)
      .applyMatrix4(camera.projectionMatrix);
    for (const m of q.see.meshes) m.userData.sortZ = sortV.z;
  }
}
// keep p (radius r) out of a pyramid's square foot (PYR.foot), turned as it stands; its corners are rounded by r (collide passes a
// walker's drawn size where it is bigger than its collision radius: a Grin's ball)
function pyrPush(p, r, py) {
  const dx = p.x - py.x,
    dz = p.z - py.z,
    u = dx * py.cs - dz * py.sn,
    v = dx * py.sn + dz * py.cs,
    qu = Math.abs(u) - PYR.foot,
    qv = Math.abs(v) - PYR.foot;
  let nu, nv, d;
  if (qu > 0 || qv > 0) {
    // outside: the nearest point of the square is on a side or a corner
    const a = Math.max(qu, 0),
      b = Math.max(qv, 0);
    d = Math.hypot(a, b);
    nu = a / d;
    nv = b / d;
  } else if (qu > qv) {
    d = qu;
    nu = 1;
    nv = 0;
  } else {
    d = qv;
    nu = 0;
    nv = 1;
  }
  if (d >= r) return;
  nu *= u < 0 ? -1 : 1;
  nv *= v < 0 ? -1 : 1;
  p.x += (nu * py.cs + nv * py.sn) * (r - d);
  p.z += (nv * py.cs - nu * py.sn) * (r - d);
}
// a pyramid's piece q (pyrParts), p in the pyramid's own space: how far p lies outside it (metres to its furthest side; below 0 inside)
function pyrOut(q, x, y, z) {
  const u = Math.abs(x * q.cs + z * q.sn),
    v = Math.abs(z * q.cs - x * q.sn),
    b = q.b0 - q.k * (y - q.y0),
    n = Math.hypot(1, q.k);
  return Math.max(q.y0 - y, y - q.y1, (u - b) / n, (v - b) / n);
}
// does the segment a + t (b - a), t in 0..tMax (in the pyramid's own space), pass through piece q? Its six sides cut the line
// down to what lies inside all of them.
const pyrF = new Float64Array(12);
function pyrCross(a, b, q, tMax) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z,
    au = a.x * q.cs + a.z * q.sn,
    du = dx * q.cs + dz * q.sn,
    av = a.z * q.cs - a.x * q.sn,
    dv = dz * q.cs - dx * q.sn,
    c = q.b0 + q.k * q.y0,
    ky = q.k * a.y,
    kd = q.k * dy;
  pyrF.set([q.y0 - a.y, -dy, a.y - q.y1, dy, au + ky - c, du + kd, ky - au - c, kd - du, av + ky - c, dv + kd, ky - av - c, kd - dv]);
  let t0 = 0,
    t1 = tMax;
  for (let i = 0; i < 12; i += 2) {
    const f = pyrF[i],
      d = pyrF[i + 1]; // a side: f + t d <= 0 inside
    if (Math.abs(d) < 1e-9) {
      if (f > 0) return false;
    } else if (d > 0) t1 = Math.min(t1, -f / d);
    else t0 = Math.max(t0, -f / d);
    if (t0 >= t1) return false;
  }
  return true;
}
// Serj's model, pyramid_sinister.glb (a black body scored with red, a glowing red core, a capstone floating above it), with his
// painting from pyramid.glb laid on from above; its textures are baked into pyr_base (painting and scoring mixed, one copy per
// side) and pyr_glow. Positions and uvs in the model's own units; col indexes pal.
const PYR_SRC = {
  pos: [
    -64, 65.9, 64, -49.9, 24.9, 57.2, 49.9, 24.9, 57.2, 64, 65.9, 64, -130.3, -224.2, 137.6, -167, -253.5, 167, 167, -253.5, 167, 130.3, -224.2,
    137.6, 0, -97, 105.6, -60.8, 119.2, 27, -76.2, 107.9, 38.8, 38.8, 107.9, 76.2, 26.4, 119.2, 55.3, -3, 261.4, -2.5, 0, 295.5, 0, 0, 295.5, 0, -3,
    261.4, -2.5, 26.4, 119.2, 55.3, 38.8, 107.9, 76.2, 64, 65.9, 64, 57.2, 24.9, 49.9, 57.2, 24.9, -49.9, 64, 65.9, -64, 137.6, -224.2, 130.3, 167,
    -253.5, 167, 167, -253.5, -167, 137.6, -224.2, -130.3, 105.6, -97, 0, 27, 119.2, 60.8, 38.8, 107.9, 76.2, 76.2, 107.9, -38.8, 55.3, 119.2, -26.4,
    -2.5, 261.4, 3, 0, 295.5, 0, -2.5, 261.4, 3, 55.3, 119.2, -26.4, 76.2, 107.9, -38.8, 64, 65.9, -64, 49.9, 24.9, -57.2, -49.9, 24.9, -57.2, -64,
    65.9, -64, 130.3, -224.2, -137.6, 167, -253.5, -167, -167, -253.5, -167, -130.3, -224.2, -137.6, 0, -97, -105.6, 60.8, 119.2, -27, 76.2, 107.9,
    -38.8, -38.8, 107.9, -76.2, -26.4, 119.2, -55.3, 3, 261.4, 2.5, 0, 295.5, 0, 3, 261.4, 2.5, -26.4, 119.2, -55.3, -38.8, 107.9, -76.2, -64, 65.9,
    -64, -57.2, 24.9, -49.9, -57.2, 24.9, 49.9, -64, 65.9, 64, -137.6, -224.2, -130.3, -167, -253.5, -167, -167, -253.5, 167, -137.6, -224.2, 130.3,
    -105.6, -97, 0, -27, 119.2, -60.8, -38.8, 107.9, -76.2, -76.2, 107.9, 38.8, -55.3, 119.2, 26.4, 2.5, 261.4, -3, 2.5, 261.4, -3, -55.3, 119.2,
    26.4, -76.2, 107.9, 38.8, -64, 65.9, 64, 64, 65.9, 64, 0, 72.6, 0, 38.8, 107.9, 76.2, -76.2, 107.9, 38.8, 0, 101.3, 0, 64, 65.9, 64, 64, 65.9,
    -64, 0, 72.6, 0, 76.2, 107.9, -38.8, 38.8, 107.9, 76.2, 0, 101.3, 0, 64, 65.9, -64, -64, 65.9, -64, 0, 72.6, 0, -38.8, 107.9, -76.2, 76.2, 107.9,
    -38.8, 0, 101.3, 0, -64, 65.9, -64, -64, 65.9, 64, 0, 72.6, 0, -76.2, 107.9, 38.8, -38.8, 107.9, -76.2, 0, 101.3, 0, 0, 102, 0, -16.4, 86.9, 22.6,
    22.6, 86.9, 16.4, 0, 71.8, 0, 0, 102, 0, 22.6, 86.9, 16.4, 16.4, 86.9, -22.6, 0, 71.8, 0, 0, 102, 0, 16.4, 86.9, -22.6, -22.6, 86.9, -16.4, 0,
    71.8, 0, 0, 102, 0, -22.6, 86.9, -16.4, -16.4, 86.9, 22.6, 0, 71.8, 0
  ],
  uv: [
    0.6723, 0.8046, 0.68939, 0.77549, 0.81061, 0.77549, 0.8277, 0.8046, 0.5862, 0.56911, 0.54, 0.54, 0.96, 0.54, 0.9138, 0.56911, 0.75, 0.6723,
    0.6911, 0.81714, 0.6723, 0.8046, 0.8277, 0.8046, 0.8089, 0.81714, 0.75, 0.93493, 0.75, 0.96, 0.25, 0.46, 0.25, 0.43493, 0.3089, 0.31714, 0.3277,
    0.3046, 0.1723, 0.8046, 0.18939, 0.77549, 0.31061, 0.77549, 0.3277, 0.8046, 0.0862, 0.56911, 0.04, 0.54, 0.46, 0.54, 0.4138, 0.56911, 0.25,
    0.6723, 0.1911, 0.81714, 0.1723, 0.8046, 0.3277, 0.8046, 0.3089, 0.81714, 0.25, 0.93493, 0.25, 0.96, 0.75, 0.93493, 0.8089, 0.81714, 0.8277,
    0.8046, 0.6723, 0.3046, 0.68939, 0.27549, 0.81061, 0.27549, 0.8277, 0.3046, 0.5862, 0.06911, 0.54, 0.04, 0.96, 0.04, 0.9138, 0.06911, 0.75,
    0.1723, 0.6911, 0.31714, 0.6723, 0.3046, 0.8277, 0.3046, 0.8089, 0.31714, 0.75, 0.43493, 0.75, 0.46, 0.25, 0.93493, 0.3089, 0.81714, 0.3277,
    0.8046, 0.1723, 0.3046, 0.18939, 0.27549, 0.31061, 0.27549, 0.3277, 0.3046, 0.0862, 0.06911, 0.04, 0.04, 0.46, 0.04, 0.4138, 0.06911, 0.25,
    0.1723, 0.1911, 0.31714, 0.1723, 0.3046, 0.3277, 0.3046, 0.3089, 0.31714, 0.25, 0.43493, 0.75, 0.43493, 0.8089, 0.31714, 0.8277, 0.3046, 0.56,
    0.94, 0.56, 0.94, 0.56, 0.94, 0.56, 0.94, 0.56, 0.94, 0.56, 0.94, 0.06, 0.94, 0.06, 0.94, 0.06, 0.94, 0.06, 0.94, 0.06, 0.94, 0.06, 0.94, 0.56,
    0.44, 0.56, 0.44, 0.56, 0.44, 0.56, 0.44, 0.56, 0.44, 0.56, 0.44, 0.06, 0.44, 0.06, 0.44, 0.06, 0.44, 0.06, 0.44, 0.06, 0.44, 0.06, 0.44, 0.56,
    0.94, 0.56, 0.94, 0.56, 0.94, 0.56, 0.94, 0.06, 0.94, 0.06, 0.94, 0.06, 0.94, 0.06, 0.94, 0.56, 0.44, 0.56, 0.44, 0.56, 0.44, 0.56, 0.44, 0.06,
    0.44, 0.06, 0.44, 0.06, 0.44, 0.06, 0.44
  ],
  col: [
    0, 1, 1, 0, 1, 2, 2, 1, 0, 1, 3, 3, 1, 1, 4, 4, 1, 1, 3, 0, 1, 1, 0, 1, 2, 2, 1, 0, 1, 3, 3, 1, 1, 4, 1, 1, 3, 0, 1, 1, 0, 1, 2, 2, 1, 0, 1, 3, 3,
    1, 1, 4, 1, 1, 3, 0, 1, 1, 0, 1, 2, 2, 1, 0, 1, 3, 3, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
  ],
  pal: [0.75, 0.72, 0.76, 0.35, 0.04, 0.06, 0.18, 0.16, 0.19, 1, 0.18, 0.18, 0.95, 0.85, 0.88],
  idx: [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 5, 4, 0, 4, 1, 2, 7, 6, 2, 6, 3, 1, 4, 8, 4, 7, 8, 7, 2, 8, 2, 1, 8, 9, 10, 11, 9, 11, 12, 13, 10, 14, 13,
    9, 10, 15, 16, 17, 15, 17, 18, 13, 9, 12, 19, 20, 21, 19, 21, 22, 23, 24, 25, 23, 25, 26, 19, 24, 23, 19, 23, 20, 21, 26, 25, 21, 25, 22, 20, 23,
    27, 23, 26, 27, 26, 21, 27, 21, 20, 27, 28, 29, 30, 28, 30, 31, 32, 29, 33, 32, 28, 29, 14, 34, 35, 14, 35, 36, 32, 28, 31, 37, 38, 39, 37, 39,
    40, 41, 42, 43, 41, 43, 44, 37, 42, 41, 37, 41, 38, 39, 44, 43, 39, 43, 40, 38, 41, 45, 41, 44, 45, 44, 39, 45, 39, 38, 45, 46, 47, 48, 46, 48,
    49, 50, 47, 51, 50, 46, 47, 33, 52, 53, 33, 53, 54, 50, 46, 49, 55, 56, 57, 55, 57, 58, 59, 60, 61, 59, 61, 62, 55, 60, 59, 55, 59, 56, 57, 62,
    61, 57, 61, 58, 56, 59, 63, 59, 62, 63, 62, 57, 63, 57, 56, 63, 64, 65, 66, 64, 66, 67, 68, 65, 15, 68, 64, 65, 51, 69, 70, 51, 70, 71, 68, 64,
    67, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 98, 97, 100, 101, 102, 103,
    102, 101, 104, 105, 106, 107, 106, 105, 108, 109, 110, 111, 110, 109
  ]
};
