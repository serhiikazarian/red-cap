// Dream architecture: each floor's dreamwork overhead and around the walls. Floor one's red curtains, chevron floors and
// doorways that never end; floor two's fractal shards, thorn trees, hanging chairs and the DMT crown; floor three's paper birds
// and block critters. Placement draws from the floor's seeded rng; what moves is driven by G.anim.
let CROWN = null;
function wallTops(rng, n, gap) {
  // wall cells that face open floor, spread apart
  const cand = [],
    out = [];
  for (let z = 1; z < G.h - 1; z++)
    for (let x = 1; x < G.w - 1; x++)
      if (G.map[z][x] === '#' && DIRS4.some(([a, b]) => !solid(x + a, z + b))) cand.push([(x + 0.5) * CELL, (z + 0.5) * CELL]);
  for (let t = 0; t < n * 40 && out.length < n && cand.length; t++) {
    const c = cand[(rng() * cand.length) | 0];
    if (!out.some(o => Math.hypot(o[0] - c[0], o[1] - c[1]) < gap)) out.push(c);
  }
  return out;
}
function openSpots(rng, n, gap) {
  // open floor cells, spread apart, for things that hang in the air above the player
  const cand = [],
    out = [];
  for (let z = 1; z < G.h - 1; z++)
    for (let x = 1; x < G.w - 1; x++)
      if (!solid(x, z) && ch(x, z) !== 'g' && kindAt(x, z) === 0 && clearOf((x + 0.5) * CELL, (z + 0.5) * CELL, 1.5))
        cand.push([(x + 0.5) * CELL, (z + 0.5) * CELL]);
  for (let t = 0; t < n * 40 && out.length < n && cand.length; t++) {
    const c = cand[(rng() * cand.length) | 0];
    if (!out.some(o => Math.hypot(o[0] - c[0], o[1] - c[1]) < gap)) out.push(c);
  }
  return out;
}
function drosteTex() {
  // a doorway inside a doorway inside a doorway, each one turned a little further
  return canvasTex(256, 384, (x, w, h) => {
    const chev = x.createPattern(chevronTex().image, 'repeat');
    for (let k = 0; k < 13; k++) {
      const s = Math.pow(0.8, k);
      x.save();
      x.translate(w / 2, h * 0.56);
      x.rotate(k * 0.075);
      x.scale(s, s);
      const kind = k % 3;
      x.fillStyle = kind === 0 ? '#7a1016' : kind === 1 ? HEX.ink : chev;
      x.fillRect(-w / 2, -h * 0.56, w, h);
      if (kind === 0) {
        x.fillStyle = 'rgba(0,0,0,.28)';
        for (let i = 0; i < w; i += 18) x.fillRect(-w / 2 + i, -h * 0.56, 7, h);
      }
      x.strokeStyle = '#c9a23a';
      x.lineWidth = 6;
      x.strokeRect(-w / 2 + 3, -h * 0.56 + 3, w - 6, h - 6);
      x.restore();
    }
    x.fillStyle = HEX.cap;
    x.beginPath();
    x.arc(w / 2 + 1, h * 0.56, 3, 0, TAU);
    x.fill();
  });
}
function treeGeo(rng, depth, len, rad) {
  // a branching ink tree, grown recursively
  const list = [],
    cyl = new THREE.CylinderGeometry(0.6, 1, 1, 5, 1, true),
    up = new THREE.Vector3(0, 1, 0);
  const grow = (p, d, l, r, k) => {
    const q = new THREE.Quaternion().setFromUnitVectors(up, d);
    list.push([cyl, new THREE.Matrix4().compose(p.clone().addScaledVector(d, l / 2), q, new THREE.Vector3(r, l, r))]);
    const end = p.clone().addScaledVector(d, l);
    if (k <= 0) return;
    const nb = 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < nb; i++) {
      const axis = new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).normalize();
      const nd = d
        .clone()
        .applyAxisAngle(axis, 0.45 + rng() * 0.55)
        .applyAxisAngle(up, (i * TAU) / nb + rng());
      grow(end, nd.normalize(), l * (0.6 + rng() * 0.14), r * 0.66, k - 1);
    }
  };
  grow(new THREE.Vector3(), up.clone(), len, rad, depth);
  const g = mergeGeos(list);
  cyl.dispose();
  return g;
}
function spiralStair(rng, steps, r, rise) {
  // a stair winding round nothing, narrowing as it climbs, to a door frame with nothing behind it
  const list = [];
  for (let i = 0; i < steps; i++) {
    const a = i * 0.42,
      rr = r * (1 - (i / steps) * 0.4);
    list.push([BOX, M4(Math.cos(a) * rr, i * rise, Math.sin(a) * rr, 0, -a, 0, 1.1 * (1 - (i / steps) * 0.3), 0.09, 0.42)]);
  }
  const top = steps * rise,
    a = steps * 0.42,
    fx = Math.cos(a) * r * 0.6,
    fz = Math.sin(a) * r * 0.6;
  list.push(
    [BOX, M4(fx, top + 0.9, fz, 0, -a, 0, 0.09, 1.8, 0.09)],
    [BOX, M4(fx + Math.sin(a) * 0.45, top + 1.8, fz - Math.cos(a) * 0.45, 0, -a, 0, 0.09, 0.09, 1)]
  );
  return { g: mergeGeos(list), top, door: [fx, top, fz, a] };
}
function sierpinski(depth) {
  // a tetrahedron made of tetrahedra made of tetrahedra
  const v = [
      [1, 1, 1],
      [-1, -1, 1],
      [-1, 1, -1],
      [1, -1, -1]
    ].map(p => new THREE.Vector3(...p)),
    tet = new THREE.TetrahedronGeometry(1.73),
    list = [];
  const go = (c, s, k) => {
    if (k === 0) {
      list.push([tet, new THREE.Matrix4().compose(c, new THREE.Quaternion(), new THREE.Vector3(s, s, s))]);
      return;
    }
    for (const p of v) go(c.clone().addScaledVector(p, s / 2), s / 2, k - 1);
  };
  go(new THREE.Vector3(), 1, depth);
  const g = mergeGeos(list);
  tet.dispose();
  return g;
}
function chairParts(list, m) {
  // seat, four legs and a back, baked with matrix m
  const add = (x, y, z, sx, sy, sz) => list.push([BOX, m.clone().multiply(M4(x, y, z, 0, 0, 0, sx, sy, sz))]);
  add(0, 0.48, 0, 0.5, 0.06, 0.5);
  for (const [lx, lz] of [
    [-0.21, -0.21],
    [0.21, -0.21],
    [-0.21, 0.21],
    [0.21, 0.21]
  ])
    add(lx, 0.24, lz, 0.05, 0.48, 0.05);
  add(0, 0.78, -0.23, 0.5, 0.55, 0.05);
}
function dreamwork(F, rng) {
  const fw = G.w * CELL,
    fh = G.h * CELL;
  if (F.deco === 'corridor') dreamCorridor(rng, fw, fh);
  else if (F.deco === 'mouth') dreamMouth(rng, fw, fh);
  else dreamBlocks(rng, fw, fh);
}
// Floor 1: red curtains, chevron floors, doorways that never end, a parlour on the ceiling
function dreamCorridor(rng, fw, fh) {
  corridorCurtains(rng);
  corridorDroste(rng);
  const chevM = corridorChevron(rng);
  corridorStairs(rng);
  corridorTrees(rng);
  corridorParlours(rng, chevM);
  corridorSpirals(rng);
}
// red curtains hung along the walls
function corridorCurtains(rng) {
  const curtainGeo = new THREE.PlaneGeometry(2.6, 3.6, 26, 1);
  {
    const p = curtainGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.09);
    curtainGeo.computeVertexNormals();
  }
  const curtainM = new THREE.MeshLambertMaterial({ color: 0x8a1018, side: THREE.DoubleSide, emissive: 0x2a0306 });
  wallFaces(rng, 0.035, (x, z, yaw, dx, dz) => {
    const m = still(new THREE.Mesh(curtainGeo, curtainM));
    m.position.set(x - dx * 0.12, 1.8, z - dz * 0.12);
    m.rotation.y = yaw;
    G.group.add(m);
  });
}
// gilt-framed doorways on the walls that never end: a doorway inside a doorway, each turned a little further
function corridorDroste(rng) {
  const droste = drosteTex(),
    drosteM = new THREE.MeshBasicMaterial({ map: droste });
  wallFaces(rng, 0.025, (x, z, yaw, dx, dz) => {
    const m = still(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), drosteM));
    m.position.set(x - dx * 0.05, 1.5, z - dz * 0.05);
    m.rotation.y = yaw;
    G.group.add(m);
    const fr = still(
      new THREE.Mesh(
        mergeGeos([
          [BOX, M4(-0.85, 0, 0, 0, 0, 0, 0.12, 2.6, 0.12)],
          [BOX, M4(0.85, 0, 0, 0, 0, 0, 0.12, 2.6, 0.12)],
          [BOX, M4(0, 1.3, 0, 0, 0, 0, 1.82, 0.12, 0.12)]
        ]),
        GOLD()
      )
    );
    fr.position.copy(m.position);
    fr.rotation.y = yaw;
    G.group.add(fr);
  });
}
// chevron floors; returns their material (the parlours' rugs share it)
function corridorChevron(rng) {
  const chevM = new THREE.MeshLambertMaterial({
    map: (() => {
      const t = chevronTex();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 3);
      return t;
    })()
  });
  let chevN = 0;
  floorSpots(
    rng,
    4,
    (x, z) => {
      const m = still(new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 0.06), chevM));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = (((rng() * 4) | 0) * Math.PI) / 2;
      m.position.set(x, 0.02 + 0.008 * chevN++, z);
      G.group.add(m);
    },
    2.1
  );
  return chevM;
}
// stairs that climb out of the walls into the dark
function corridorStairs(rng) {
  const stairM = new THREE.MeshLambertMaterial({ color: 0x4a3524, emissive: 0x1c120a }),
    voidM = new THREE.MeshBasicMaterial({ color: COL.tie });
  for (const [x, z] of openSpots(rng, 3, 15)) {
    const st = spiralStair(rng, 34, 1.5, 0.26),
      m = still(new THREE.Mesh(st.g, stairM));
    m.position.set(x, 3.4, z);
    G.group.add(m);
    const d = still(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.7), voidM));
    d.position.set(x + st.door[0], 3.4 + st.top + 0.9, z + st.door[2]);
    d.rotation.y = -st.door[3] + Math.PI / 2;
    G.group.add(d);
  }
}
// ink trees growing off the tops of the walls
function corridorTrees(rng) {
  const inkM = new THREE.MeshLambertMaterial({ color: COL.ink });
  for (const [x, z] of wallTops(rng, 5, 10)) {
    const m = still(new THREE.Mesh(treeGeo(rng, 5, 2.2, 0.14), inkM));
    m.position.set(x, 5, z);
    m.rotation.y = rng() * TAU;
    m.scale.setScalar(0.9 + rng() * 0.6);
    G.group.add(m);
  }
}
// a parlour hanging upside down from a ceiling that is not there
function corridorParlours(rng, chevM) {
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a3524 }),
    red = new THREE.MeshLambertMaterial({ color: 0x8a1018 }),
    shade = new THREE.MeshBasicMaterial({ color: 0xf6dc9a });
  for (const [x, z] of openSpots(rng, 2, 15)) {
    const g = still(new THREE.Group());
    g.position.set(x, 5.6 + rng() * 0.8, z);
    g.rotation.set(Math.PI, rng() * TAU, 0);
    G.group.add(g);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), chevM);
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.01;
    g.add(rug);
    const chair = [],
      lamp = [];
    chairParts(chair, M4(-0.6, 0, 0, 0, 0.5, 0, 1.4, 1.4, 1.4));
    g.add(new THREE.Mesh(mergeGeos(chair), red));
    lamp.push([BOX, M4(0.9, 0.01, 0.3, 0, 0, 0, 0.3, 0.04, 0.3)], [BOX, M4(0.9, 0.85, 0.3, 0, 0, 0, 0.04, 1.7, 0.04)]);
    g.add(new THREE.Mesh(mergeGeos(lamp), wood));
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.36, 10, 1, true), shade);
    sh.position.set(0.9, 1.75, 0.3);
    g.add(sh);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: own(glowTex('#fff2c0', 'rgba(240,200,120,.5)')),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
      })
    );
    glow.position.set(0.9, 1.7, 0.3);
    glow.scale.setScalar(1.6);
    g.add(glow);
  }
}
// gold boards curling up into a spiral, smaller and smaller, forever
function corridorSpirals(rng) {
  for (const [x, z] of openSpots(rng, 2, 18)) {
    const g = new THREE.Group();
    g.position.set(x, 3.6, z);
    G.group.add(g);
    G.deco.push({ m: g, spin: 0.18, bob: rng() * 6, y: 3.6 });
    const frames = [],
      sph = [];
    for (let k = 0; k < 16; k++) {
      const s = 1.7 * Math.pow(0.84, k),
        w = s * SHAPES.geezer.aspect,
        a = k * 0.9,
        r = 0.25 * Math.pow(1.22, k);
      frames.push([BOX, M4(Math.cos(a) * r, k * 0.32, Math.sin(a) * r, 0, -a, 0, w + 0.12, s + 0.12, 0.04)]);
      sph.push(new THREE.Sphere(new THREE.Vector3(Math.cos(a) * r, k * 0.32, Math.sin(a) * r), Math.hypot(w, s) / 2));
    }
    g.add(new THREE.Mesh(mergeGeos(frames), GOLD()));
    g.userData.seeSph = sph; // its see-through shapes: one per board (the whole spiral is too big to be one)
  }
}
// Floor 2: fractal shards, thorn trees, chairs hanging in chains, stairs to burning doors
function dreamMouth(rng, fw, fh) {
  const shardM = new THREE.MeshPhongMaterial({ color: 0x6a1410, emissive: 0x2a0404, flatShading: true, shininess: 10 });
  for (const [x, z] of openSpots(rng, 3, 16)) {
    const g = new THREE.Mesh(sierpinski(3), shardM),
      y = 5.8 + rng() * 1.5;
    g.position.set(x, y, z);
    g.scale.setScalar(1.8 + rng() * 1.4);
    G.group.add(g);
    G.deco.push({ m: g, spin: 0.12 + rng() * 0.1, bob: rng() * 6, y });
  }
  // the sculptures on the wall tops (dmtCrown), turning slowly, each the other way from the last; their own random numbers
  const crownM = new THREE.MeshLambertMaterial({ vertexColors: true }),
    crng = mulberry(4242);
  wallTops(crng, 9, 8).forEach(([x, z], k) => {
    const ix = Math.floor(x / CELL),
      iz = Math.floor(z / CELL),
      m = new THREE.Mesh(dmtCrown(), crownM),
      y = (G.wallTop[ix + iz * G.w] || 5) - 0.12;
    m.position.set(x, y, z);
    m.rotation.y = crng() * TAU;
    m.scale.setScalar(1.35 + crng() * 0.4);
    G.group.add(m);
    G.deco.push({ m, spin: (k % 2 ? -1 : 1) * (0.12 + crng() * 0.1), bob: 0, y });
  });
  // floor two's walls broken up: arched niches here and there, dark, with a violet glow low inside (archNiche)
  const nrng = mulberry(777);
  wallFaces(nrng, 0.16, (x, z, yaw) => {
    const y = 0.55 + nrng() * 0.5;
    if (G.wallWords.some(([wx, wz]) => Math.hypot(wx - x, wz - z) < 0.5)) return; // a word is painted there
    const m = still(new THREE.Mesh(archNiche().g, archNiche().m));
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    G.group.add(m);
    G.niches.push({ m, nx: Math.sin(yaw), nz: Math.cos(yaw), look: 0 }); // read after wallFaces lifts it
  });
  const thornM = new THREE.MeshLambertMaterial({ color: 0x1a0d0a, emissive: 0x1a0302 });
  for (const [x, z] of wallTops(rng, 6, 9)) {
    const m = still(new THREE.Mesh(treeGeo(rng, 4, 2.4, 0.2), thornM));
    m.position.set(x, 5.5, z);
    m.rotation.y = rng() * TAU;
    m.scale.setScalar(0.9 + rng() * 0.7);
    G.group.add(m);
  }
  const chairM = new THREE.MeshLambertMaterial({ color: 0x2a1a14, emissive: 0x100404 });
  for (const [x, z] of openSpots(rng, 3, 12)) {
    const list = [];
    let y = 0,
      s = 1.3;
    for (let k = 0; k < 7; k++) {
      chairParts(list, M4(0, y, 0, Math.PI, k * 0.9, 0, s, s, s));
      list.push([BOX, M4(0, y + 0.05, 0, 0, 0, 0, 0.03, 1.1 * s, 0.03)]);
      y -= 1.15 * s;
      s *= 0.84;
    }
    const g = new THREE.Mesh(mergeGeos(list), chairM);
    g.position.set(x, 11, z);
    G.group.add(g);
    const ph = rng() * 6;
    G.anim.push((dt, t) => {
      g.rotation.z = Math.sin(t * 0.7 + ph) * 0.08;
      g.rotation.y += dt * 0.1;
    });
  }
  const ironM = new THREE.MeshLambertMaterial({ color: 0x1e1612 });
  for (const [x, z] of wallTops(rng, 2, 18)) {
    const list = [],
      yaw = rng() * TAU;
    for (let i = 0; i < 14; i++) list.push([BOX, M4(0, i * 0.32, i * 0.42, 0, 0, 0, 1.2, 0.1, 0.44)]);
    list.push(
      [BOX, M4(-0.6, 14 * 0.32 + 1, 14 * 0.42, 0, 0, 0, 0.12, 2, 0.12)],
      [BOX, M4(0.6, 14 * 0.32 + 1, 14 * 0.42, 0, 0, 0, 0.12, 2, 0.12)],
      [BOX, M4(0, 14 * 0.32 + 2, 14 * 0.42, 0, 0, 0, 1.32, 0.12, 0.12)]
    );
    const g = still(new THREE.Group());
    g.position.set(x, 5.2, z);
    g.rotation.y = yaw;
    G.group.add(g);
    g.add(new THREE.Mesh(mergeGeos(list), ironM));
    const fire = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 })
    );
    fire.position.set(0, 14 * 0.32 + 1, 14 * 0.42);
    fire.scale.set(1.4, 2.2, 1);
    g.add(fire);
    G.anim.push(() => {
      if (animTick) {
        fire.scale.set(1.2 + Math.random() * 0.4, 2 + Math.random() * 0.5, 1);
        fire.updateMatrix();
      }
    });
  }
}
// Floor 3: paper birds overhead, little block critters that scatter, pastel motes on the air
function dreamBlocks(rng, fw, fh) {
  paperBirds(rng, fw, fh);
  blockCritters(rng);
  pastelMotes(fw, fh);
}
// 14 paper birds circling high over the floor's middle, flapping (two instanced wings each)
function paperBirds(rng, fw, fh) {
  const wingM = new THREE.MeshBasicMaterial({ color: COL.paper, side: THREE.DoubleSide }),
    wingG = new THREE.BufferGeometry();
  wingG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.25, 0, 0, 0.25, 0.9, 0, 0.05]), 3));
  wingG.computeVertexNormals();
  const cx = fw / 2,
    cz = fh * 0.55,
    wings = new THREE.InstancedMesh(wingG, wingM, 28),
    mB = new THREE.Matrix4(),
    mW = new THREE.Matrix4(),
    mirror = new THREE.Matrix4().makeScale(-1, 1, 1),
    qY = new THREE.Quaternion(),
    one = new THREE.Vector3(1, 1, 1),
    bp = new THREE.Vector3();
  wings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wings.frustumCulled = false;
  G.group.add(wings);
  for (let k = 0; k < 14; k++) {
    const r = 6 + rng() * 14,
      h = 9 + rng() * 4,
      sp = (0.15 + rng() * 0.2) * (rng() < 0.5 ? 1 : -1),
      ph = rng() * TAU,
      fl = 7 + rng() * 4;
    G.anim.push((dt, t) => {
      const a = ph + t * sp;
      bp.set(cx + Math.cos(a) * r, h + Math.sin(t * 0.8 + ph) * 0.6, cz + Math.sin(a) * r);
      qY.setFromAxisAngle(UP, -a + (sp > 0 ? 0 : Math.PI));
      mB.compose(bp, qY, one);
      const f = Math.sin(t * fl + ph) * 0.7;
      wings.setMatrixAt(k * 2, mW.makeRotationZ(f).premultiply(mB));
      wings.setMatrixAt(k * 2 + 1, mW.makeRotationZ(-f).multiply(mirror).premultiply(mB));
      wings.instanceMatrix.needsUpdate = true;
    });
  }
}
// little painted blocks with eyes in the floor's far part: they wander, and scatter from Red Cap
function blockCritters(rng) {
  const eyeTex = canvasTex(64, 32, x => {
    for (const ex of [16, 48]) {
      x.fillStyle = HEX.paper;
      x.beginPath();
      x.arc(ex, 16, 12, 0, TAU);
      x.fill();
      x.lineWidth = 3;
      x.strokeStyle = HEX.ink;
      x.stroke();
      x.fillStyle = HEX.ink;
      x.beginPath();
      x.arc(ex + 3, 18, 5, 0, TAU);
      x.fill();
    }
  });
  const eyeM = new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true, alphaTest: 0.3 }),
    cols = ['t_blue', 't_lime', 't_orange', 't_ochre'];
  floorSpots(rng, 7, (x, z) => {
    if (z < 9 * CELL) return;
    const g = new THREE.Group(),
      m = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ map: TEX[pick(cols)] }));
    m.scale.setScalar(0.5);
    m.position.y = 0.25;
    g.add(m);
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), eyeM);
    eye.position.set(0, 0.34, 0.26);
    g.add(eye);
    g.position.set(x, 0, z);
    G.group.add(g);
    const c = { x, z, tx: x, tz: z, t: 0, hop: rng() * 6 };
    G.anim.push((dt, t) => {
      if (state !== 'play' && state !== 'title') return;
      c.t -= dt;
      const dh = Math.hypot(hero.pos.x - c.x, hero.pos.z - c.z);
      if (dh < 4.5) {
        c.tx = c.x + ((c.x - hero.pos.x) / dh) * 4;
        c.tz = c.z + ((c.z - hero.pos.z) / dh) * 4;
        c.t = 1;
      } else if (c.t <= 0) {
        c.tx = c.x + (Math.random() - 0.5) * 6;
        c.tz = c.z + (Math.random() - 0.5) * 6;
        c.t = 2 + Math.random() * 3;
      }
      const dx = c.tx - c.x,
        dz = c.tz - c.z,
        d = Math.hypot(dx, dz);
      if (d > 0.2) {
        const v = (dh < 4.5 ? 4 : 1.4) * dt,
          nx = c.x + (dx / d) * v,
          nz = c.z + (dz / d) * v,
          [ix, iz] = cellOf(nx, nz);
        if (!solid(ix, iz) && ch(ix, iz) !== 'g' && !propR(ch(ix, iz)) && iz >= 9 && critterRoom(nx, nz)) {
          c.x = nx;
          c.z = nz;
        } else c.t = 0;
        g.rotation.y = Math.atan2(dx, dz);
        g.position.y = Math.abs(Math.sin(t * 9 + c.hop)) * 0.35;
      } else g.position.y *= 0.8;
      g.position.x = c.x;
      g.position.z = c.z;
    });
  });
}
// 40 pastel motes drifting on the air around Red Cap
function pastelMotes(fw, fh) {
  const moteCols = [0x4fa9df, 0x9bd12c, 0xf2a35e, 0xe7b84a, COL.paper],
    moteIM = instPool(new THREE.PlaneGeometry(0.09, 0.09), 40, G.group);
  const motes = Array.from({ length: 40 }, (_, k) => {
    moteIM.setColorAt(k, tmpC.setHex(pick(moteCols)));
    return { position: new THREE.Vector3(rand(0, fw), rand(0.5, 5), rand(0, fh)), rotation: { x: 0, y: 0 }, ph: rand(0, 6) };
  });
  G.anim.push((dt, t) => {
    motes.forEach((m, k) => {
      m.position.x += Math.sin(t * 0.4 + m.ph) * 0.3 * dt + 0.12 * dt;
      m.position.y += Math.sin(t * 0.9 + m.ph * 2) * 0.15 * dt;
      m.rotation.x += dt;
      m.rotation.y += dt * 0.7;
      if (Math.abs(m.position.x - hero.pos.x) > 14) {
        m.position.x = hero.pos.x + rand(-12, 12);
        m.position.z = hero.pos.z + rand(-12, 12);
        m.position.y = rand(0.5, 5);
      }
      dummy.position.copy(m.position);
      dummy.rotation.set(m.rotation.x, m.rotation.y, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      moteIM.setMatrixAt(k, dummy.matrix);
    });
    moteIM.instanceMatrix.needsUpdate = true;
  });
}
// floor two's wall-top sculpture: one shape, made once, flat colours per part; base on y = 0, about 1.2 m round and 3 m tall
function dmtCrown() {
  if (CROWN) return CROWN;
  const list = [],
    put = (g, m, hex) => {
      const q = g.index ? g.toNonIndexed() : g.clone(),
        c = new THREE.Color(hex),
        a = new Float32Array(q.attributes.position.count * 3);
      for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
      q.setAttribute('color', new THREE.BufferAttribute(a, 3));
      list.push([q, m]);
    },
    star = (ro, ri, pts, d) => {
      const sh = new THREE.Shape();
      for (let k = 0; k < pts * 2; k++) {
        const r = k % 2 ? ri : ro,
          a = (k / (pts * 2)) * TAU;
        if (k) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        else sh.moveTo(r, 0);
      }
      return new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
    },
    oct = new THREE.OctahedronGeometry(1, 0);
  put(star(1.25, 0.62, 8, 0.3), M4(0, 0, 0, -Math.PI / 2, 0, 0), 0x241820);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    put(
      oct,
      M4(Math.cos(a) * 0.72, 0.62, Math.sin(a) * 0.72, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55, 0.16, 0.6, 0.16),
      k % 2 ? 0x2a2030 : 0x5a1420
    );
  }
  put(star(0.78, 0.4, 8, 0.22), M4(0, 0.5, 0, -Math.PI / 2, 0, TAU / 16), 0x7a1418);
  let y = 0.95,
    r = 0.42;
  for (let k = 0; k < 4; k++) {
    put(oct, M4(0, y + r, 0, 0, k * 0.4, 0, r, r * 1.25, r), [0x3a1840, 0x1a1418, 0x7a1018, 0x2a1838][k]);
    y += r * 2.1;
    r *= 0.74;
  }
  put(new THREE.SphereGeometry(0.34, 16, 12), M4(0, y + 0.32, 0), 0xd8d0c0); // the eye
  put(new THREE.SphereGeometry(0.2, 12, 10), M4(0, y + 0.32, 0.2), 0x9a0a12);
  put(new THREE.SphereGeometry(0.1, 10, 8), M4(0, y + 0.32, 0.31), COL.ink);
  CROWN = share(mergeGeos(list));
  return CROWN;
}
