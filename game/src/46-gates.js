// Gates and doors: floor three's fog wall over the gate to the Jester (it lifts when the Grump is beaten), the exit door that
// opens once a floor is clear (floor one's with stairs down: STAIRS), and the paper trail that then leads Red Cap to it.
const TRAIL_N = 32, // scraps at most
  TRAIL_STEP = 2, // metres between scraps
  TRAIL_SIZE = 0.8; // a scrap is about 0.8 m by 0.55 m
let TRAIL_GEO = null;

// thick, slow-moving fog along a whole row of the map: two layers of shader noise (a dense core that also hides what is behind
// it from the ink outlines, and a lighter sheet on Red Cap's side), a bank of it on the floor (two sheets; on a slow machine,
// resScale below RES_MIN, only the lower one), and drifting puffs
function fogWall(row) {
  const xs = [];
  for (let x = 0; x < G.w; x++) if (G.map[row][x] === 'g') xs.push(x);
  if (!xs.length) return;
  const x0 = xs[0] * CELL,
    x1 = (xs[xs.length - 1] + 1) * CELL,
    W = x1 - x0,
    cz = cellMid(row),
    H = 7;
  const U = { time: { value: 0 }, fade: { value: 1 }, len: { value: W } };
  const mat = fogMat(U, 0),
    low = fogMat(U, 1),
    core = fogMat(U, 0, 0.6);
  const g = new THREE.Group();
  G.group.add(g);
  for (const dz of [0, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), dz ? mat : core);
    m.position.set(x0 + W / 2, H / 2 - 0.05, cz + dz * 1.1);
    m.userData.core = !dz;
    g.add(m);
  }
  const bank = [0.25, 0.7].map(y => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, 9), low);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x0 + W / 2, y, cz);
    g.add(m);
    return m;
  });
  const puffs = fogPuffs(g, x0, W, cz);
  G.fogWall = { g, mat, puffs, fade: 1, going: false };
  G.anim.push((dt, t) => fogTick(dt, t, U, bank, puffs));
}
// a fog layer's material (lay 1: the bank on the floor); cut > 0: the dense core, which writes depth so it hides what is behind it
function fogMat(U, lay, cut = 0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: cut > 0,
    side: THREE.DoubleSide,
    uniforms: { ...U, nz: { value: fogNoiseTex }, lay: { value: lay }, cut: { value: cut } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float time, fade, len, lay, cut; varying vec2 vUv;
    uniform sampler2D nz;
    float fbm(vec2 p){ return texture2D(nz, p / 16.).r * .9375; } // the same four-octave sum, baked into a tiling texture 16 noise cells wide
    void main(){
      vec2 p = vec2(vUv.x * len / 4., vUv.y * 2.);
      float n = fbm(p + vec2(time * .08, -time * .05)) * .6 + fbm(p * 1.9 - vec2(time * .05, time * .11)) * .4;
      float top = 1.; if (lay < .5) top = .42 + .6 * fbm(vec2(vUv.x * len / 5. + time * .04, time * .05));
      float dense = lay > .5 ? 1. - smoothstep(.1, 1., abs(vUv.y - .5) * 2.) : 1. - smoothstep(top - .14, top + .04, vUv.y); // a billowing top edge
      float w = smoothstep(.35, .75, n); // the swirls, picked out light on dark
      float a = clamp((.86 + w * .3) * dense, 0., 1.) * fade * (lay > .5 ? .85 : 1.);
      if (a < max(.02, cut)) discard; // the dense core also hides what is behind it from the ink outlines
      gl_FragColor = vec4(mix(vec3(.5, .52, .57), vec3(.92, .93, .95), w), a); // cold, against the warm paper haze
    }`
  });
}
// 14 puffs of smoke drifting through the fog
function fogPuffs(g, x0, W, cz) {
  const puffs = [];
  for (let k = 0; k < 14; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.3, color: 0xb8c0cc }));
    sp.geometry = PUFF_GEO;
    sp.position.set(x0 + rand(0, W), rand(0.6, 3.8), cz + rand(-2.2, 2.2));
    sp.scale.setScalar(rand(4, 7));
    sp.userData = { ph: rand(0, 6), x: sp.position.x };
    g.add(sp);
    puffs.push(sp);
  }
  return puffs;
}
// every frame: the fog churns; once going, it fades out and is gone
function fogTick(dt, t, U, bank, puffs) {
  const f = G.fogWall;
  if (!f) return;
  U.time.value = t;
  bank[1].visible = resScale >= RES_MIN;
  if (f.going) {
    f.fade = Math.max(0, f.fade - dt / 2.2);
    U.fade.value = f.fade;
    if (f.fade <= 0) {
      discard(f.g);
      G.fogWall = null;
      return;
    }
  }
  for (const p of puffs) {
    const u = p.userData;
    p.position.x = u.x + Math.sin(t * 0.3 + u.ph) * 1.2;
    p.material.opacity = (0.28 + Math.sin(t * 0.7 + u.ph) * 0.1) * f.fade;
  }
}
// the Grump beaten: the gate sinks, the fog thins away, the way to the Jester opens
function openGate() {
  toast('The shoutin’ stops.');
  const t0 = playT;
  // the gate sinks over 1.6 s of play, with the floor's other motion (it stops while paused and goes with the floor)
  G.anim.push(() => {
    const k = Math.min((playT - t0) / 1.6, 1);
    for (const m of G.gate) m.position.y = m.userData.y0 - k * (m.userData.h + 0.2);
  });
  SFX.boom();
  if (G.fogWall) G.fogWall.going = true;
  later(0.9, () => {
    G.gateClosed = false;
    flowField();
  });
}
// a talker gone: the count, the hidden boss's stages, the door
function checkClear() {
  if (!G) return;
  updateLeft();
  livingDyingCheck();
  openDoor();
}
// walkable for the trail: open, not a prop's or pyramid's cell
const trailCell = (x, z) => !solid(x, z) && !propRadius(cellAt(x, z)) && !pyrAt(x, z) && cellAt(x, z) !== 'g';
// clear straight line for the trail between two points: no wall or prop, and no ledge (the ground's height changes gently all along)
function trailClear(a, b) {
  if (!clearOfCover(a, b, 0.45)) return false;
  const d = Math.hypot(b.x - a.x, b.z - a.z),
    n = Math.ceil(d / 0.4);
  let y = heightAt(a.x, a.z);
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      y2 = heightAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (Math.abs(y2 - y) > 0.3) return false;
    y = y2;
  }
  return true;
}
// the way from Red Cap to the door: cells by breadth-first search from the door, then straightened where the line is clear
function trailPath() {
  const W = G.w,
    D = G.trailD,
    [dx, dz] = cellOf(G.portal.x, G.portal.z),
    [hx, hz] = cellOf(hero.pos.x, hero.pos.z);
  D.fill(-1);
  D[dx + dz * W] = 0;
  const q = [dx + dz * W];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi],
      x = i % W,
      z = (i / W) | 0;
    for (const [ax, az] of DIRS4) {
      const nx = x + ax,
        nz = z + az,
        j = nx + nz * W;
      if (nx < 0 || nz < 0 || nx >= W || nz >= G.h || D[j] >= 0) continue;
      if (!(trailCell(nx, nz) || (nx === hx && nz === hz)) || !canStep(x, z, nx, nz)) continue;
      D[j] = D[i] + 1;
      q.push(j);
    }
  }
  if (D[hx + hz * W] < 0) return null;
  const pts = [{ x: hero.pos.x, z: hero.pos.z }];
  for (let x = hx, z = hz, k = D[hx + hz * W]; k > 0; ) {
    for (const [ax, az] of DIRS4)
      if (D[x + ax + (z + az) * W] === k - 1) {
        x += ax;
        z += az;
        break;
      }
    k--;
    pts.push({ x: cellMid(x), z: cellMid(z) });
  }
  pts[pts.length - 1] = { x: G.portal.x, z: G.portal.z };
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; ) {
    let j = pts.length - 1;
    while (j > i + 1 && !trailClear(pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
// scraps of torn paper on the floor from Red Cap to the door, laid again whenever he steps into another cell
function updatePaperTrail(dt) {
  if (!G || !G.portal || !G.portal.open) return;
  const T = G.paperTrail || trailStart();
  T.t += dt;
  const cell = cellOf(hero.pos.x, hero.pos.z).join();
  if (cell !== T.cell) {
    T.cell = cell;
    T.pts = trailLay();
    T.shown = -1;
  }
  // the scraps come out from Red Cap towards the door over the first 2 s, then lie still
  const shown = Math.min(T.pts.length, Math.floor((T.t / 2) * T.pts.length) + 1);
  if (shown === T.shown) return;
  T.shown = shown;
  for (let i = 0; i < shown; i++) {
    const p = T.pts[i];
    dummy.position.set(p.x, heightAt(p.x, p.z) + 0.04, p.z);
    dummy.rotation.set(0, p.yaw + p.r, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    T.im.setMatrixAt(i, dummy.matrix);
  }
  T.im.count = shown;
  T.im.instanceMatrix.needsUpdate = true;
}
// the trail's instanced scraps, tinted the floor's trail colour, else its word colour (the shape is made once: trailGeo)
function trailStart() {
  if (!TRAIL_GEO) TRAIL_GEO = share(trailGeo());
  const im = new THREE.InstancedMesh(
    TRAIL_GEO,
    new THREE.MeshBasicMaterial({ color: G.F.trail ?? G.F.words, vertexColors: true, side: THREE.DoubleSide }),
    TRAIL_N
  );
  im.count = 0;
  im.frustumCulled = false;
  G.group.add(im);
  return (G.paperTrail = { im, pts: [], t: 0, cell: '', shown: -1 });
}
// a scrap of torn paper edged in ink: a jagged shape over a larger dark one (vertex colours: the material's colour tints the paper)
function trailGeo() {
  const scrap = (grow, shade) => {
    const sh = new THREE.Shape(),
      n = 11;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU,
        r = ((k % 2 ? 0.26 : 0.36) * (0.85 + ((k * 37) % 10) / 30) + grow) * TRAIL_SIZE;
      if (k) sh.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r);
      else sh.moveTo(Math.cos(a) * r * 1.35, Math.sin(a) * r);
    }
    const g = new THREE.ShapeGeometry(sh);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(shade), 3));
    return g;
  };
  return mergeGeos([
    [scrap(0.07, 0.06), M4(0, 0, 0, -Math.PI / 2, 0, 0, 1, 1, 1)],
    [scrap(0, 1), M4(0, 0.012, 0, -Math.PI / 2, 0, 0, 1, 1, 1)]
  ]);
}
// the scraps' places, laid from the door so the ones on the same way stay put, up to TRAIL_N, nearest Red Cap first
function trailLay() {
  const path = trailPath();
  const pts = [];
  if (path) {
    path.reverse();
    for (let i = 0, carry = 1.4; i < path.length - 1 && pts.length < TRAIL_N; i++) {
      const a = path[i],
        b = path[i + 1],
        len = Math.hypot(b.x - a.x, b.z - a.z);
      let u = carry;
      for (; u < len && pts.length < TRAIL_N; u += TRAIL_STEP) {
        const x = a.x + ((b.x - a.x) * u) / len,
          z = a.z + ((b.z - a.z) * u) / len;
        if (heroDist(x, z) < 1.6) break;
        pts.push({ x, z, yaw: Math.atan2(b.x - a.x, b.z - a.z), r: ((((x * 7.3 + z * 3.1) % 1) + 1) % 1) * 0.9 - 0.45 });
      }
      carry = u - len;
    }
    pts.reverse(); // nearest Red Cap first
  }
  return pts;
}
// the exit door: a black frame round a red hole, hidden until the floor is clear. On a floor with stairs (FLOORS) the hole shows
// red steps going down into the dark, and a stairway is built under the floor for the way out (buildStairs)
function buildDoor(cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  const ink = new THREE.MeshBasicMaterial({ color: COL.ink }),
    frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.25), ink);
  frame.position.y = 1.7;
  g.add(frame);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3), new THREE.MeshBasicMaterial({ color: COL.tie, fog: false }));
  hole.position.set(0, 1.6, 0.14);
  if (G.F.stairs) stepsPicture(hole, ink);
  g.add(hole);
  const hole2 = hole.clone();
  hole2.position.z = -0.14;
  hole2.rotation.y = Math.PI;
  g.add(hole2);
  g.visible = false;
  G.group.add(g);
  G.portal = { g, x: cx, z: cz, open: false, hole };
  if (G.F.stairs) buildStairs(cx, cz);
}

// Floor one's way out (FLOORS .stairs): a descent. The door's hole shows steps going down (stepsPicture). Walking into it
// (leaveByDoor) sets state 'descend': the page dips to ink for STAIRS.dip s, then Red Cap is on a stairway STAIRS.deep m under
// the floor (buildStairs: made with the floor, so nothing new is drawn for the first time here) and walks down it by himself at
// STAIRS.speed for STAIRS.walk s, the camera behind him (descentCamera, in place of the camera), the fog black, his lamp dying,
// a red glow far below, each step echoing; the ink closes STAIRS.out s before the end and the next floor follows (nextFloor)
const STAIRS = {
  rise: 0.34,
  run: 0.52, // one step
  wide: 2.6,
  tall: 3.6, // the stairway
  deep: 12, // its landing under the floor
  back: 4, // the landing's length, behind the first step
  more: 12, // steps beyond where he stops, into the dark
  tint: 0x8a8a8a, // its walls wear the floor's own wall paintings, darker; its steps the first of them, as they are
  dip: 0.35,
  walk: 3.2,
  out: 0.45,
  speed: 2.3,
  pace: 0.36, // seconds between footfalls
  cam: { side: 0.8, back: 3.3, up: 3, ahead: 3.5, drop: 1.9 }, // beside, behind and above him, looking this far ahead and this far down
  glow: 3.4, // the red glow at the foot, m across
  fog: [2, 15],
  lamp: 0.15 // the share of his lamp left at the bottom
};
// the door's picture of the stairs, drawn over the hole h: all dark but the treads, each smaller and higher than the last
// (they pulse red with the hole: its own material)
function stepsPicture(h, ink) {
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3), ink);
  dark.position.z = 0.02;
  h.add(dark);
  for (let i = 0, y = -1.42, k = 1; i < 9; i++, k *= 0.8) {
    const tread = new THREE.Mesh(new THREE.PlaneGeometry(1.5 * k, 0.26 * k), h.material);
    tread.position.set(0, y + 0.13 * k, 0.04);
    h.add(tread);
    y += 0.33 * k;
  }
}
// how high the stairway's ground is at z (the landing, then the steps as a slope)
const stairsY = z => -STAIRS.deep - (Math.max(0, z - G.stairs.z) / STAIRS.run) * STAIRS.rise;
// the stairway under the door at (cx, cz), going down to the south: a landing, the steps, walls in 3 m lengths wearing the
// floor's wall paintings, a sloped dark ceiling, a red glow at the foot
function buildStairs(cx, cz) {
  const S = STAIRS,
    F = G.F,
    n = Math.ceil((S.speed * S.walk) / S.run) + S.more,
    zEnd = cz + n * S.run,
    paint = t => new THREE.MeshLambertMaterial({ map: TEX[t.split(':')[0]], color: S.tint }),
    steps = [[BOX, M4(cx, -S.deep - 0.5, cz - S.back / 2, 0, 0, 0, S.wide, 1, S.back)]];
  G.stairs = { x: cx, z: cz };
  for (let i = 0; i < n; i++) steps.push([BOX, M4(cx, -S.deep - (i + 1) * S.rise - 0.5, cz + (i + 0.5) * S.run, 0, 0, 0, S.wide, 1, S.run)]);
  G.group.add(still(new THREE.Mesh(mergeGeos(steps), new THREE.MeshLambertMaterial({ map: TEX[F.stairs] }))));
  for (let za = cz - S.back, k = 0; za < zEnd; za += CELL)
    for (const side of [-1, 1]) {
      const top = stairsY(za) + S.tall + 0.5,
        foot = stairsY(za + CELL) - 0.5,
        m = new THREE.Mesh(BOX, paint(F.walls[k++ % F.walls.length]));
      m.scale.set(1, top - foot, CELL);
      m.position.set(cx + side * (S.wide / 2 + 0.5), (top + foot) / 2, za + CELL / 2);
      G.group.add(still(m));
    }
  const roof = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: 0x1a1612 })),
    len = zEnd - cz + S.back,
    zMid = (zEnd + cz - S.back) / 2;
  roof.scale.set(S.wide + 2, 0.6, Math.hypot(len, (len / S.run) * S.rise) + 2);
  roof.position.set(cx, -S.deep - ((zMid - cz) / S.run) * S.rise + S.tall + 0.3, zMid);
  roof.rotation.x = Math.atan2(S.rise, S.run);
  G.group.add(still(roof));
  const glow = glowSprite(glowRed, { fog: false });
  glow.position.set(cx, stairsY(zEnd) + 1.6, zEnd);
  glow.scale.setScalar(S.glow);
  G.group.add(glow);
}
// Red Cap walks into the open door: down the stairs where the floor has them, else straight to the next floor
function leaveByDoor() {
  if (!G.stairs) return nextFloor();
  state = 'descend';
  G.descent = { t: 0, on: false, out: false, done: false, stepT: 0, lamp: G.lamp.intensity };
  $('#veil').classList.add('on');
  $('#reticle').hidden = true;
  toastOff();
  SFX.portal();
}
// a step of the descent (the main loop runs it in place of play)
function descentStep(dt) {
  const d = G.descent,
    S = STAIRS;
  if (d.done) return;
  d.t += dt;
  if (!d.on) {
    if (d.t < S.dip) return;
    d.on = true;
    d.t = 0;
    veilOff();
    scene.background = new THREE.Color(COL.ink);
    scene.fog.color.setHex(COL.ink);
    [scene.fog.near, scene.fog.far] = S.fog;
    inkPass.uniforms.far.value = S.fog[1];
    cam.yaw = Math.PI; /* he walks south, his back to us */
    hero.vel.set(0, S.speed);
    hero.root.visible = true;
    SFX.descent();
  }
  const z = G.stairs.z + d.t * S.speed;
  hero.pos.set(G.stairs.x, stairsY(z), z);
  hero.walk += dt * S.speed * 2.1;
  heroPose(S.speed, -1, 0);
  hero.root.position.copy(hero.pos);
  G.lamp.intensity = d.lamp * lerp(1, S.lamp, clamp(d.t / S.walk, 0, 1));
  d.stepT -= dt;
  if (d.stepT <= 0) {
    d.stepT = S.pace;
    SFX.stairStep();
  }
  if (!d.out && d.t >= S.walk - S.out) {
    d.out = true;
    $('#veil').classList.add('on');
  }
  if (d.t >= S.walk) {
    d.done = true;
    nextFloor();
  }
}
// the camera on the stairs: behind and above him, looking down them (and his lamp with him)
function descentCamera() {
  const C = STAIRS.cam;
  if (!G.descent.on) return;
  G.lamp.position.set(hero.pos.x, hero.pos.y + 2.6, hero.pos.z);
  camera.position.set(hero.pos.x + C.side, hero.pos.y + C.up, hero.pos.z - C.back);
  camera.lookAt(hero.pos.x - C.side * 0.4, hero.pos.y + C.up - C.drop, hero.pos.z + C.ahead);
  camera.updateMatrixWorld();
}
// the exit door appears once the floor is clear, and stays shown whatever else happens. Its two lines (DOOR_LINES) hold
// DOOR_HOLD s each, one after the other; Red Cap within DOOR_NEAR of the door cuts them short
const DOOR_LINES = ['A door tears open on this floor.', 'Follow the Paper Trails'],
  DOOR_HOLD = 7,
  DOOR_NEAR = 2.5;
function openDoor() {
  if (!G || !G.portal || aliveCount() > 0) return;
  const p = G.portal;
  if (!p.open) {
    p.open = true;
    SFX.portal();
    toast(DOOR_LINES[0], DOOR_HOLD * 1000);
    p.line = 0;
    p.lineT = 0;
  } else if (p.line < 2) {
    p.lineT += 0.5; // openDoor runs every half second of play
    const near = heroDist(p.x, p.z) < DOOR_NEAR,
      t = $('#toast');
    if (near || p.lineT >= DOOR_HOLD) {
      if (near) {
        if (t.textContent === DOOR_LINES[p.line]) toastOff(); // only if no other hint has taken its place
        p.line = 2;
      } else if (++p.line < 2) {
        toast(DOOR_LINES[1], DOOR_HOLD * 1000);
        p.lineT = 0;
      }
    }
  }
  p.g.visible = true;
}
