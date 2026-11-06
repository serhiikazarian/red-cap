// Gates and doors: floor three's fog wall over the gate to the Jester (it lifts when the Grump is beaten), the exit door that
// opens once a floor is clear, and the paper trail that then leads Red Cap to it.
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
  updLeft();
  ldCheck();
  openDoor();
}
// walkable for the trail: open, not a prop's or pyramid's cell
const trailCell = (x, z) => !solid(x, z) && !propR(ch(x, z)) && !pyrAt(x, z) && ch(x, z) !== 'g';
// clear straight line for the trail between two points: no wall or prop, and no ledge (the ground's height changes gently all along)
function trailClear(a, b) {
  if (!losCover(a, b, 0.45)) return false;
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
      if (!(trailCell(nx, nz) || (nx === hx && nz === hz)) || !stepOK(x, z, nx, nz)) continue;
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
function updPaperTrail(dt) {
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
// the trail's instanced scraps, tinted the floor's word colour (the shape is made once: trailGeo)
function trailStart() {
  if (!TRAIL_GEO) TRAIL_GEO = share(trailGeo());
  const im = new THREE.InstancedMesh(
    TRAIL_GEO,
    new THREE.MeshBasicMaterial({ color: G.F.words, vertexColors: true, side: THREE.DoubleSide }),
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
        if (Math.hypot(x - hero.pos.x, z - hero.pos.z) < 1.6) break;
        pts.push({ x, z, yaw: Math.atan2(b.x - a.x, b.z - a.z), r: ((((x * 7.3 + z * 3.1) % 1) + 1) % 1) * 0.9 - 0.45 });
      }
      carry = u - len;
    }
    pts.reverse(); // nearest Red Cap first
  }
  return pts;
}
// the exit door: a black frame round a red hole, hidden until the floor is clear
function buildDoor(cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.25), new THREE.MeshBasicMaterial({ color: COL.ink }));
  frame.position.y = 1.7;
  g.add(frame);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3), new THREE.MeshBasicMaterial({ color: COL.tie, fog: false }));
  hole.position.set(0, 1.6, 0.14);
  g.add(hole);
  const hole2 = hole.clone();
  hole2.position.z = -0.14;
  hole2.rotation.y = Math.PI;
  g.add(hole2);
  g.visible = false;
  G.group.add(g);
  G.portal = { g, x: cx, z: cz, open: false, hole };
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
    const near = Math.hypot(p.x - hero.pos.x, p.z - hero.pos.z) < DOOR_NEAR,
      t = $('#toast');
    if (near || p.lineT >= DOOR_HOLD) {
      if (near) {
        if (t.textContent === DOOR_LINES[p.line]) t.style.opacity = 0; // only if no other hint has taken its place
        p.line = 2;
      } else if (++p.line < 2) {
        toast(DOOR_LINES[1], DOOR_HOLD * 1000);
        p.lineT = 0;
      }
    }
  }
  p.g.visible = true;
}
