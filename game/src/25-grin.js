// The Grin (G): a face on fire that never stops smilin'. A lit, lumpy ball with its painted face, inside a corona of flame
// (a shader eats the painting's edge with rising noise), and its grin cut out and hung in front.
// Its parts draw in a set order at the Grin's own distance (userData.sortRank, sortUnits in 02-render).
// Black ink thorns stick out unevenly from the ball: some round its outline, some on the front in a ragged ring round the face,
// each of those driven into a scorched, white-hot socket. The ones behind the outline draw before the ball, which hides their
// feet; the front ones (and their sockets) after it.
// Their places, sizes and tilts come from fixed dice (GRIN_SPIKE_SEED), never the game's: replays keep their rolls.
const GRIN_SPIKES = 14, // thorns on the ball
  GRIN_SPIKE_SEED = 23, // the dice for where they stand, how long, thick and crooked they are
  GRIN_SPIKE_JIT = 0.4, // how far a thorn strays from its even place round the ball, as a share of the gap (never touching)
  GRIN_SPIKE_SWAP = 0.2, // thorns take turns, front and rim; this share of them breaks the turn
  GRIN_FRONT_TILT = [0.85, 1.15], // a front thorn's angle from the line to the viewer, radians: clear of the face, its socket seen
  GRIN_RIM_TILT = [1.4, 1.85], // a rim thorn's: around the outline, a little before or behind it
  GRIN_SPIKE_LEN = [0.7, 1.45], // a thorn's length, in ball radii, from .. to
  GRIN_SPIKE_W = [0.12, 0.24], // a thorn's foot radius, in ball radii, from .. to
  GRIN_SPIKE_LEAN = 0.3, // how crooked a thorn may stand off the straight-out line
  GRIN_SPIKE_ROOT = 0.85, // where a thorn starts, in ball radii from the centre (its foot melts into the burning skin)
  GRIN_SOCKET = 2.2; // a socket's radius, in thorn foot radii
// a thorn's foot, as a share of its length: see-through, white-hot, violet, then solid ink from GRIN_SPIKE_INK on
const GRIN_SPIKE_INK = 0.3;

// the Grin's face painted into a fireball: a shader eats its edge with rising noise and lights it lavender
function grinFire(h) {
  const S = SHAPES.grin_fire,
    H = h * S.scale,
    W = H * S.aspect,
    geo = new THREE.PlaneGeometry(W, H);
  geo.translate(0, H / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      map: { value: TEX.grin_fire },
      time: { value: 0 },
      seed: { value: Math.random() * 50 },
      tint: { value: new THREE.Color(0xffffff) },
      opacity: { value: 1 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float time, seed, opacity; uniform vec3 tint; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }
      void main(){
        vec4 t = texture2D(map, vUv);
        float n = fbm(vUv * vec2(7., 6.) + vec2(seed, -time * 1.9));
        float n2 = fbm(vUv * vec2(14., 11.) + vec2(-time * .7 + seed, -time * 2.8));
        float edge = .5 + (n - .5) * .3 + (n2 - .5) * .14;              // the silhouette, chewed by rising noise
        float body = smoothstep(edge - .025, edge + .025, t.a);
        float reach = smoothstep(edge - .2 - .16 * n2, edge, t.a);       // lavender tongues licking outward
        float flame = reach * (1. - body) * (.45 + .55 * n2);
        vec3 hot = mix(vec3(.42, .16, .82), vec3(.97, .86, 1.), smoothstep(.25, 1., reach));
        float lip = 1. - smoothstep(0., .05, abs(t.a - edge));            // a thin white-hot lip where face meets fire
        vec3 col = mix(hot, t.rgb * tint, body) + vec3(.95, .8, 1.) * lip * .55;
        float a = max(body, flame);
        if (a < .02) discard;
        gl_FragColor = vec4(col, a * opacity);
      }`
  });
  mat.color = mat.uniforms.tint.value; // so the shared damage flash can tint it like any paper figure
  const m = new THREE.Mesh(geo, mat);
  m.userData.mat = mat;
  return m;
}
// the Grin in the round: a lumpy, lit head with the painted face wrapped on its front, inside the flame corona
function grinBall(h) {
  const g = new THREE.Group(),
    fire = grinFire(h),
    S = SHAPES.grin_fire,
    H = h * S.scale,
    W = H * S.aspect,
    cy = H / 2,
    R = h * 0.46;
  fire.position.z = -0.3;
  fire.scale.setScalar(1.12);
  g.add(fire); // the corona sits just behind and a little larger, so flames lick past the head
  const spikeMat = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, ...INK_HIDE });
  g.userData.spikeMats = [];
  for (const [geo, map, rank] of grinSpikeGeos(R, cy)) {
    const part = new THREE.Mesh(geo, spikeMat(map));
    part.userData.sortRank = rank;
    g.add(part);
    g.userData.spikeMats.push(part.material);
  }
  const mat = grinHeadMat(fire, W, H, cy);
  mat.color = mat.uniforms.tint.value;
  const ball = new THREE.Mesh(grinHeadGeo(R, cy), mat);
  fire.userData.sortRank = 1; // drawn in this order at the Grin's distance (sortUnits): its glow and flames, the fire card, the ball, the mouth
  ball.userData.sortRank = 2;
  g.add(ball);
  g.userData.mat = fire.userData.mat;
  g.userData.ballMat = mat;
  const mouth = grinMouth(W, H, cy, R);
  g.add(mouth);
  g.userData.mouth = mouth;
  g.userData.mouthMat = mouth.material;
  return g;
}
// the thorns, meshes shared by every Grin: [geometry, texture, draw rank] for the back thorns (before the ball), the front
// sockets and the front thorns (after it). Open cones standing out of the head (as wide and flat as it), spaced evenly round
// the line to the viewer, each a little off its place; their texture runs foot to tip (spikeTex). A socket is a disc on the
// skin round a thorn's foot.
let grinSpikeShared = null;
function grinSpikeGeos(R, cy) {
  if (grinSpikeShared) return grinSpikeShared;
  const dice = mulberry(GRIN_SPIKE_SEED),
    span = ([a, b]) => a + (b - a) * dice(),
    up = new THREE.Vector3(0, 1, 0),
    out = new THREE.Vector3(0, 0, 1),
    n = new THREE.Vector3(),
    dir = new THREE.Vector3(),
    one = new THREE.Vector3(1, 1, 1),
    back = [],
    front = [],
    sockets = [];
  for (let k = 0; k < GRIN_SPIKES; k++) {
    const tilt = span((k % 2 === 0) !== dice() < GRIN_SPIKE_SWAP ? GRIN_FRONT_TILT : GRIN_RIM_TILT),
      a = ((k + 0.5 + (dice() - 0.5) * GRIN_SPIKE_JIT) / GRIN_SPIKES) * Math.PI * 2,
      z = Math.cos(tilt),
      len = R * span(GRIN_SPIKE_LEN),
      w = R * span(GRIN_SPIKE_W);
    dir.set((dice() - 0.5) * GRIN_SPIKE_LEAN, (dice() - 0.5) * GRIN_SPIKE_LEAN, (dice() - 0.5) * GRIN_SPIKE_LEAN);
    n.set(Math.cos(a) * Math.sin(tilt) * 1.1, Math.sin(a) * Math.sin(tilt), z * 0.8);
    const foot = n.clone().multiplyScalar(R * GRIN_SPIKE_ROOT),
      skin = n.clone().multiplyScalar(R);
    foot.y += cy;
    skin.y += cy;
    n.normalize();
    dir.add(n).normalize();
    const cone = new THREE.ConeGeometry(w, len, 5, 1, true).translate(0, len / 2, 0);
    (z > 0 ? front : back).push([cone, new THREE.Matrix4().compose(foot, new THREE.Quaternion().setFromUnitVectors(up, dir), one)]);
    if (z > 0)
      sockets.push([
        new THREE.CircleGeometry(w * GRIN_SOCKET, 12),
        new THREE.Matrix4().compose(skin, new THREE.Quaternion().setFromUnitVectors(out, n), one)
      ]);
  }
  const merge = list => {
    const g = share(mergeGeos(list));
    list.forEach(([q]) => q.dispose());
    return g;
  };
  grinSpikeShared = [
    [merge(back), spikeTex, 1.5],
    [merge(sockets), socketTex, 2.4],
    [merge(front), spikeTex, 2.5]
  ];
  return grinSpikeShared;
}
// the head: a sphere made lumpy, a little wide and flat, its foot at y 0
function grinHeadGeo(R, cy) {
  const geo = new THREE.SphereGeometry(R, 40, 28),
    p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      n = 1 + 0.06 * Math.sin(x * 9 + y * 4) * Math.cos(z * 7 - y * 5) + 0.04 * Math.sin(y * 13 + x * 3);
    p.setXYZ(i, x * n * 1.1, y * n, z * n * 0.8);
  }
  geo.computeVertexNormals();
  geo.translate(0, cy, 0);
  return geo;
}
// the head's look: the painted face, lit from the front, its rim burning away into lavender fire
function grinHeadMat(fire, W, H, cy) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: TEX.grin_fire },
      tint: { value: new THREE.Color(0xffffff) },
      time: fire.userData.mat.uniforms.time,
      size: { value: new THREE.Vector2(W, H) },
      cy: { value: cy },
      fade: { value: 1 }
    },
    vertexShader: `uniform vec2 size; uniform float cy; varying vec2 vUv; varying vec3 vN, vV;
      void main(){ vUv = vec2(.5 + position.x / size.x, .5 + (position.y - cy) / size.y); vec4 mv = modelViewMatrix * vec4(position, 1.);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 tint; uniform float time, fade; varying vec2 vUv; varying vec3 vN, vV;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }
      void main(){ vec3 base = texture2D(map, vUv).rgb * tint;
        float facing = max(dot(vN, vV), 0.), n = fbm(vUv * vec2(9., 8.) + vec2(0., -time * 2.3)), n2 = fbm(vUv * vec2(17., 15.) + vec2(time * .6, -time * 3.1));
        float dif = .42 + .78 * max(dot(vN, normalize(vec3(-.45, .6, .65))), 0.);   // still lit like a head from the front
        float solid = smoothstep(.12, .62 + .3 * (n - .5), facing);                 // but its rim burns away into lavender fire, never a clean circle
        vec3 flame = mix(vec3(.42, .16, .82), vec3(.97, .86, 1.), smoothstep(.3, .9, n2));
        vec3 col = mix(flame, base * dif + vec3(.72, .42, 1.) * pow(1. - facing, 2.) * .8, solid);
        float a = solid + (1. - solid) * smoothstep(.0, .35, facing) * n2 * 1.1;
        if (a < .05) discard;
        gl_FragColor = vec4(col, clamp(a, 0., 1.) * fade); }`,
    transparent: true,
    depthWrite: false,
    ...INK_HIDE
  });
}
// the grin, cut from the same painting and inked round twice, hangs a hand's width in front of the face it was torn from
function grinMouth(W, H, cy, R) {
  const MS = SHAPES.grin_mouth,
    mmat = new THREE.MeshBasicMaterial({ map: TEX.grin_mouth, transparent: true, depthWrite: false, ...INK_HIDE });
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(MS.fw * W * 1.15, MS.fh * H * 1.15), mmat);
  mouth.position.set((MS.u0 - 0.5) * W, cy + (0.5 - MS.v0) * H, R * 0.8 + 0.14);
  mouth.userData.sortRank = 3;
  mouth.userData.base = mouth.position.clone();
  mouth.userData.jx = mouth.userData.jy = 0;
  return mouth;
}
// the burning ball in a violet glow with seven flames; drawnR (its ball and wiggle) keeps it out of a pyramid's foot
function makeGrin(e, add) {
  Object.assign(e, {
    name: 'Grin',
    hp: 3,
    maxHp: 3,
    pebbleDmg: 1,
    r: 0.75,
    drawnR: 0.95,
    fly: 2.0,
    palette: [0x7a2ad0, COL.ink, 0xc89cff, COL.cap]
  });
  const m = grinBall(1.7);
  e.tilt.add(m);
  e.mats.push(m.userData.mat, m.userData.ballMat, m.userData.mouthMat);
  e.mouth = m.userData.mouth;
  m.position.y = -0.8 - 1.7 * SHAPES.grin_fire.pad;
  e.body = m;
  e.t = rand(1, 2.5);
  const gl = glowSprite(violetTex, { transparent: true, opacity: 0.75 });
  gl.scale.set(2.8, 2.8, 1);
  gl.position.z = -0.2;
  gl.userData.sortRank = 0;
  e.tilt.add(gl);
  e.glow = gl;
  e.flames = Array.from({ length: 7 }, (_, k) => {
    const a = -Math.PI / 2 + (k / 7 - 0.5) * 3.6 + rand(-0.25, 0.25),
      r = rand(0.55, 0.95);
    const f = glowSprite(violetTex, { transparent: true });
    f.userData = { a, r, s: rand(0.5, 1.1), ph: rand(0, 6), up: rand(0.2, 0.7), sortRank: 0 };
    e.tilt.add(f);
    return f;
  });
  e.sortParts = [];
  e.tilt.traverse(o => o.userData.sortRank !== undefined && e.sortParts.push(o));
}
// hovers at a wary distance once it sees Red Cap (strafing), winds up (HAAA) and spits a fireball where he is going;
// too close, it bites
function updateGrin(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  if (animTick) e.fly = 2.0 + Math.sin(playT * 2 + e.seed) * 0.35;
  grinWiggle(e);
  e.y0 = e.fly - 0.8;
  e.y1 = e.fly + 0.8;
  const seen = dist < 22 && !hero.inSmoke && clearOfWalls(e.pos, hero.pos);
  if (e.st === 'idle') {
    if (seen || dist < 9) {
      e.st = 'hover';
      e.t = rand(1.2, 2.2);
    }
  } else if (e.st === 'hover') grinHover(e, seen, dist, ux, uz, mv);
  else if (e.st === 'wind') {
    if (animTick) {
      shake(e.tilt, 0.07);
      e.body.scale.setScalar(1 + (0.55 - e.t) * 0.4);
      e.tilt.rotation.x = -(0.55 - e.t) * 0.6;
    }
    if (e.t <= 0) grinSpit(e, dist);
  } else if (e.st === 'bite') {
    mv.x = ux;
    mv.z = uz;
    mv.sp = 6;
    e.fly = lerp(e.fly, 1.2, 0.3);
    if (dist < e.r + hero.r + 0.1) hurtHero(1, e.pos);
    if (e.t <= 0) {
      e.st = 'hover';
      e.t = rand(1, 2);
      e.knock.set(-ux * 6, -uz * 6);
    }
  }
  e.tilt.position.y = e.fly;
  grinFlames(e, dt);
}
// hovering: hunting him by the map until he is seen, then keeping a wary distance and strafing; too close, a bite; else, when
// its wait is over, the wind-up
function grinHover(e, seen, dist, ux, uz, mv) {
  if (!seen) {
    [mv.x, mv.z] = steer(e);
    mv.sp = 3.6;
  } else {
    const want = dist > 8 ? 1 : dist < 4.5 ? -1 : 0;
    const side = Math.sin(performance.now() / 900 + e.seed) > 0 ? 1 : -1;
    mv.x = ux * want + -uz * side * 0.8;
    mv.z = uz * want + ux * side * 0.8;
    mv.sp = 3.4;
  }
  if (dist < 1.9 && e.stagger <= 0) {
    e.st = 'bite';
    e.t = 0.3;
  } else if (seen && e.t <= 0 && e.stagger <= 0) {
    e.st = 'wind';
    e.t = 0.55;
    floatWord('HAAA', e.pos.clone().setY((e.gy || 0) + e.fly + 1.1), HEX.bile, 0.7);
  }
}
// the wind-up done: a fireball spat where he is going
function grinSpit(e, dist) {
  e.body.scale.setScalar(1);
  e.tilt.rotation.x = 0;
  e.tilt.position.set(0, e.fly, 0);
  const from = e.pos.clone().setY((e.gy || 0) + e.fly), // from the ball itself, raised ground too
    to = hero.pos
      .clone()
      .setY(hero.pos.y + 1.1)
      .addScaledVector(new THREE.Vector3(hero.vel.x, 0, hero.vel.y), (dist / 10.5) * 0.6);
  fireball(from, to.sub(from).normalize(), e);
  e.st = 'hover';
  e.t = rand(2, 3.2);
}
// its fire: sparks, the glow's flicker, the corona's flames
function grinFlames(e, dt) {
  if (Math.random() < dt * 18)
    burst(fxAt(e.pos, rand(-0.6, 0.6), e.fly + rand(-0.1, 0.7), rand(-0.6, 0.6)), [COL.hot, COL.bile, COL.tie], 1, 1, 0.22, {
      g: -5,
      life: 0.6
    });
  if (animTick) e.glow.scale.setScalar(2.5 + Math.random() * 0.7);
  const now2 = performance.now() / 1000;
  for (const f of e.flames) {
    const u = f.userData,
      fl = 0.65 + 0.35 * Math.sin(now2 * (7 + u.s * 5) + u.ph) + rand(-0.08, 0.08);
    f.position.set(Math.cos(u.a) * u.r, -Math.sin(u.a) * u.r * 0.85 + u.up * fl * 0.4, 0.05);
    f.scale.set(u.s * 0.7 * fl, u.s * (1.1 + fl * 0.6), 1);
    f.material.opacity = 0.55 + fl * 0.4;
  }
}
// a nervous wiggle in flight; the grin jitters on its face and gapes as it winds up or bites
function grinWiggle(e) {
  const n2 = performance.now() / 1000,
    wig = t => [Math.sin(t * 7.3 + e.seed) * 0.13 + Math.sin(t * 12.1 + e.seed * 2) * 0.05, Math.sin(t * 5.1 + e.seed) * 0.14];
  const [rz, px] = wig(n2);
  e.body.rotation.z = rz;
  e.body.position.x = px;
  e.body.userData.mat.uniforms.time.value = n2;
  const mo = e.mouth,
    u = mo.userData,
    gp = e.st === 'wind' ? 1 + (0.55 - Math.max(e.t, 0)) * 0.9 : e.st === 'bite' ? 1.3 : 1;
  if (animTick) {
    u.jx = rand(-0.035, 0.035);
    u.jy = rand(-0.03, 0.03);
    u.rz = rand(-0.06, 0.06);
  }
  mo.position.set(u.base.x - px * 0.7 + u.jx, u.base.y + u.jy + Math.sin(n2 * 3.1 + e.seed) * 0.04, u.base.z);
  mo.rotation.z = u.rz - rz * 0.7;
  mo.scale.x = lerp(mo.scale.x, gp, 0.25);
  mo.scale.y = lerp(mo.scale.y, 1 + (gp - 1) * 1.6, 0.25);
}

// a Grin's death: the fire eats it, it swells and rises as it fades
function grinDying(e, dt) {
  e.dying -= dt;
  const k = 1 - e.dying / 1.1,
    f = clamp(1 - k * 1.15, 0, 1),
    B = e.body.userData;
  B.ballMat.uniforms.fade.value = f;
  B.mat.uniforms.opacity.value = f;
  for (const m of B.spikeMats) m.opacity = f;
  B.mat.uniforms.time.value = performance.now() / 1000;
  e.body.scale.setScalar(1 + k * 0.3);
  e.glow.material.opacity = 0.75 * f;
  e.flames.forEach(fl => {
    fl.material.opacity = 0.8 * f;
    fl.position.y += dt * 1.5;
  });
  e.tilt.position.y = e.fly + k * 0.4;
  if (e.dying <= 0) gone(e);
}
// busted: the grin lifts off the dying face into the world and hangs on by itself (a second alone, then it shuts and fades)
function cheshire(e) {
  const mo = e.mouth;
  if (!mo) return;
  e.mouth = null;
  const p = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    sc = new THREE.Vector3();
  e.root.updateMatrixWorld(true);
  mo.matrixWorld.decompose(p, q, sc);
  mo.parent.remove(mo);
  e.sortParts = e.sortParts.filter(o => o !== mo); // out in the world on its own: sorted by its own place
  delete mo.userData.sortZ;
  mo.position.copy(p);
  mo.scale.copy(sc);
  mo.rotation.set(0, e.yaw || 0, 0);
  mo.material.color.setHex(0xffffff);
  G.group.add(mo);
  G.grins.push({ m: mo, t: 0, p, s: sc.clone(), yaw: e.yaw || 0 });
}
function updateGrins(dt) {
  if (!G.grins.length) return;
  for (let i = G.grins.length - 1; i >= 0; i--) {
    const g = G.grins[i],
      m = g.m;
    g.t += dt;
    if (g.t >= 1.15 && !g.laughed) {
      g.laughed = true;
      [0, 0.12, 0.24].forEach((at, k) => playTone({ f: 560 - k * 70, f2: 420 - k * 60, dur: 0.08, type: 'triangle', gain: 0.045, at }));
    }
    const target = Math.atan2(camera.position.x - g.p.x, camera.position.z - g.p.z);
    g.yaw += angDiff(g.yaw, target) * ease(4, dt);
    if (animTick) {
      m.userData.jx = rand(-0.03, 0.03);
      m.userData.jy = rand(-0.025, 0.025);
      m.userData.rz = rand(-0.05, 0.05);
    }
    const wide = 1 + Math.min(g.t, 2.1) * 0.08,
      shut = g.t > 2.1 ? Math.min((g.t - 2.1) / 0.6, 1) : 0;
    m.position.set(g.p.x + m.userData.jx, g.p.y + m.userData.jy + g.t * 0.12, g.p.z);
    m.rotation.set(0, g.yaw, m.userData.rz);
    m.scale.set(g.s.x * wide * (1 + shut * 0.25), g.s.y * wide * (1 - shut * 0.85), 1);
    m.material.opacity = 1 - shut;
    if (shut >= 1) {
      G.group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
      G.grins.splice(i, 1);
    }
  }
}
TALKERS.G = {
  make: makeGrin,
  update: updateGrin,
  dying: grinDying,
  holo: () => ({ map: TEX.grin_fire, aspect: SHAPES.grin_fire.aspect }), // a niche's hologram of a Grin (a ball): its drawing
  rim: { col: 0xb46cff, a: 0.55 },
  torn: cheshire, // its grin stays behind
  tornWord: 'BUSTED',
  drops: e => {
    dropsDefault(e);
    giveAmmo(1, e.pos);
  }
};
