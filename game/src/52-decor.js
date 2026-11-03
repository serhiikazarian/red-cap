// Decor: braziers, the route lights that guide Red Cap to the exit, clutter along the walls, framed pictures, and each floor's
// theme: floor one is narcissism and madness (the Geezer's portraits, mirrors, newspapers full of crap), floor two anger and
// wrath (braziers, scorched floors, furious graffiti). Placement draws from the floor's seeded rng.
let KIT = null;
// geometry and materials shared by every brazier and route light
function kit() {
  return (
    KIT ||
    (KIT = {
      iron: share(new THREE.MeshLambertMaterial({ color: 0x241a14 })),
      post: share(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 6)),
      bowl: share(new THREE.CylinderGeometry(0.5, 0.28, 0.45, 8)),
      coals: share(new THREE.CircleGeometry(0.45, 8)),
      coalM: share(new THREE.MeshBasicMaterial({ color: 0xff6a1a })),
      stake: share(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 5)),
      tip: share(new THREE.ConeGeometry(0.06, 0.16, 5)),
      tipM: share(new THREE.MeshBasicMaterial({ color: 0xff8a2a })),
      brass: share(new THREE.MeshLambertMaterial({ color: 0x8a6a2a })),
      foot: share(new THREE.BoxGeometry(0.2, 0.14, 0.2)),
      lid: share(new THREE.BoxGeometry(0.14, 0.05, 0.14)),
      lidM: share(new THREE.MeshBasicMaterial({ color: 0xf6e7a0 }))
    })
  );
}
// a brazier: an iron bowl of coals on a post, burning (its heat zone goes to G.hot)
function brazier(fx, y, fz, r) {
  const K = kit(),
    g = still(new THREE.Group());
  g.position.set(fx, y, fz);
  G.group.add(g);
  keepOut(fx, fz, 0.8);
  const post = new THREE.Mesh(K.post, K.iron);
  post.position.y = 0.45;
  g.add(post);
  const bowl = new THREE.Mesh(K.bowl, K.iron);
  bowl.position.y = 1.05;
  g.add(bowl);
  const coals = new THREE.Mesh(K.coals, K.coalM);
  coals.rotation.x = -Math.PI / 2;
  coals.position.y = 1.26;
  g.add(coals);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 })
  );
  glow.position.set(fx, y + 1.75, fz);
  glow.scale.set(2, 2.5, 1);
  G.group.add(glow);
  G.fires.push({ x: fx, z: fz, glow });
  G.hot.push({ x: fx, z: fz, r });
}
// the route from the start to the exit, found on the grid
function routeCells(clearOfProps) {
  // the guide route steps round traps, pillars and pyramids; it falls back to the plain route if it must
  let start, goal;
  for (let z = 0; z < G.h; z++)
    for (let x = 0; x < G.w; x++) {
      if (G.map[z][x] === 'P') start = [x, z];
      if (G.map[z][x] === 'X') goal = [x, z];
    }
  if (!start || !goal) return [];
  const prev = new Map(),
    cost = new Map(),
    key = (x, z) => x + ',' + z,
    q = [[start, 0]];
  prev.set(key(...start), null);
  cost.set(key(...start), 0);
  while (q.length) {
    let bi = 0;
    for (let i = 1; i < q.length; i++) if (q[i][1] < q[bi][1]) bi = i; // cheapest first: a trap cell costs more, a pyramid or pillar is never crossed
    const [[x, z], c0] = q.splice(bi, 1)[0];
    if (c0 > cost.get(key(x, z))) continue;
    if (x === goal[0] && z === goal[1]) break;
    for (const [ax, az] of DIRS4) {
      const nx = x + ax,
        nz = z + az,
        k = key(nx, nz),
        c1 = c0 + 1 + (clearOfProps && ch(nx, nz) === 'o' ? 6 : 0);
      if (solid(nx, nz) || ch(nx, nz) === 'g' || !stepOK(x, z, nx, nz) || (clearOfProps && ch(nx, nz) === 'T') || (cost.has(k) && cost.get(k) <= c1))
        continue;
      cost.set(k, c1);
      prev.set(k, [x, z]);
      q.push([[nx, nz], c1]);
    }
  }
  if (clearOfProps && !prev.has(key(...goal))) return routeCells(false);
  const out = [];
  let c = goal;
  while (c) {
    out.unshift(c);
    c = prev.get(key(...c));
  }
  return out;
}
// lights only where the way is not obvious: a turn, a fork, the foot of a climb, and the exit
function guideMarks(cells) {
  const open = (x, z) => !solid(x, z) && ch(x, z) !== 'g',
    hc = (x, z) => heightAt((x + 0.5) * CELL, (z + 0.5) * CELL),
    marks = [];
  let lastI = -9;
  for (let i = 1; i < cells.length - 1; i++) {
    const [px, pz] = cells[i - 1],
      [x, z] = cells[i],
      [nx, nz] = cells[i + 1];
    const turn = x - px !== nx - x || z - pz !== nz - z;
    let exits = 0;
    for (const [ax, az] of DIRS4) if (open(x + ax, z + az) && stepOK(x, z, x + ax, z + az)) exits++;
    const climb = Math.abs(hc(nx, nz) - hc(x, z)) > 0.2 && Math.abs(hc(x, z) - hc(px, pz)) < 0.05;
    if ((turn && exits >= 3) || climb || (turn && i - lastI >= 6)) {
      if (i - lastI >= 4) {
        marks.push(i);
        lastI = i;
      }
    }
  }
  return marks;
}
// the route lights: small brass lamps along the way to the exit, where it turns or forks
function guidePath(F, rng) {
  const cells = routeCells(true);
  G.pathSet = new Set(cells.map(c => c.join(',')));
  if (cells.length < 3) return;
  const K = kit(),
    corridor = F.deco === 'corridor';
  const gt = corridor ? glowTex('#fff2b0', 'rgba(232,198,40,.55)') : fireTex;
  if (corridor) OWN.add(gt);
  const glowM = new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
  const light = (px, pz) => {
    const [pix, piz] = cellOf(px, pz);
    if (
      solid(pix, piz) ||
      wallDist(px, pz) < 0.25 ||
      kindAt(pix, piz) === 2 ||
      (propR(ch(pix, piz)) && Math.hypot(px - (pix + 0.5) * CELL, pz - (piz + 0.5) * CELL) < propR(ch(pix, piz)) + 0.3)
    )
      return;
    if (!clearOf(px, pz, 0.3)) return;
    keepOut(px, pz, 0.4);
    const g = still(new THREE.Group());
    g.position.set(px, heightAt(px, pz), pz);
    G.group.add(g);
    if (corridor) {
      const b = new THREE.Mesh(K.foot, K.brass);
      b.position.y = 0.07;
      g.add(b);
      const l = new THREE.Mesh(K.lid, K.lidM);
      l.position.y = 0.16;
      g.add(l);
    } else {
      const st = new THREE.Mesh(K.stake, K.iron);
      st.position.y = 0.45;
      g.add(st);
      const t = new THREE.Mesh(K.tip, K.tipM);
      t.position.y = 0.98;
      g.add(t);
      G.hot.push({ x: px, z: pz, r: 0.45 });
    }
    const sp = new THREE.Sprite(glowM);
    sp.position.y = corridor ? 0.3 : 1.05;
    sp.scale.setScalar(corridor ? 0.7 : 0.65);
    g.add(sp);
  };
  for (const i of guideMarks(cells)) {
    // a pair of lights on the doorway out of the marked cell, pointing the way
    const [ax, az] = cells[i],
      [bx, bz] = cells[i + 1],
      dx = bx - ax,
      dz = bz - az,
      cx = (ax + 0.5 + dx * 0.5) * CELL,
      cz = (az + 0.5 + dz * 0.5) * CELL;
    for (const sd of [-1, 1]) light(cx - dz * sd * 1.15, cz + dx * sd * 1.15);
  }
  // the exit: footlights on the first floor, a pair of braziers on the second
  const [ex, ez] = cells[cells.length - 1],
    [qx, qz] = cells[cells.length - 2],
    dx = ex - qx,
    dz = ez - qz,
    cx = (ex + 0.5) * CELL,
    cz = (ez + 0.5) * CELL;
  for (const sd of [-1, 1]) {
    const px = cx - dz * sd * 1.25,
      pz = cz + dx * sd * 1.25;
    if (corridor) light(px, pz);
    else if (wallDist(px, pz) > 0.5 && clearOf(px, pz, 0.5)) brazier(px, heightAt(px, pz), pz, 0.9);
  }
}
// clutter along the walls: newspaper stacks and chairs on the first floor, rubble and stakes on the second
function clutter(F, rng) {
  G.clutter = [];
  const paperMats = ['t_column', 't_crapwords', 't_textbox', 't_scribble'].map(t => new THREE.MeshLambertMaterial({ map: TEX[t] }));
  const side = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }),
    wood = new THREE.MeshLambertMaterial({ color: 0x4a3524 });
  const rubbleM = new THREE.MeshPhongMaterial({ color: 0x5a2a20, flatShading: true, shininess: 0 }),
    iron = new THREE.MeshLambertMaterial({ color: 0x1e1612 }),
    barrelM = new THREE.MeshLambertMaterial({ map: TEX.t_ember, color: 0x7a5a4a });
  wallFaces(rng, 0.34, (x, z, yaw, dx, dz) => {
    const ix = Math.floor((x - dx * 0.1) / CELL),
      iz = Math.floor((z - dz * 0.1) / CELL);
    if (kindAt(ix, iz) === 2) return;
    const along = (rng() - 0.5) * 1.6,
      px = x - dx * 0.55 - dz * along,
      pz = z - dz * 0.55 + dx * along;
    if (!clearOf(px, pz, 0.45)) return;
    const g = still(new THREE.Group());
    g.position.set(px, 0, pz);
    g.rotation.y = yaw + (rng() - 0.5) * 0.6;
    G.group.add(g);
    const pick3 = rng();
    if (F.deco === 'corridor') {
      if (pick3 < 0.55) {
        let y = 0;
        const n = 2 + ((rng() * 4) | 0);
        for (let k = 0; k < n; k++) {
          const h = 0.1 + rng() * 0.14;
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, h, 0.46), [side, side, paperMats[(rng() * 4) | 0], side, side, side]);
          b.position.set((rng() - 0.5) * 0.08, y + h / 2, (rng() - 0.5) * 0.08);
          b.rotation.y = (rng() - 0.5) * 0.3;
          g.add(b);
          y += h;
        }
      } else {
        // a chair, sometimes knocked over
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), wood);
        seat.position.y = 0.48;
        g.add(seat);
        for (const [lx, lz] of [
          [-0.21, -0.21],
          [0.21, -0.21],
          [-0.21, 0.21],
          [0.21, 0.21]
        ]) {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.05), wood);
          l.position.set(lx, 0.24, lz);
          g.add(l);
        }
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.05), wood);
        back.position.set(0, 0.78, -0.23);
        g.add(back);
        if (rng() < 0.35) {
          g.rotation.z = Math.PI / 2;
          g.position.y = 0.25;
        }
      }
    } else {
      if (pick3 < 0.5) {
        for (let k = 0; k < 4 + ((rng() * 3) | 0); k++) {
          const r = 0.14 + rng() * 0.22,
            b = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rubbleM);
          b.position.set((rng() - 0.5) * 0.8, r * 0.6, (rng() - 0.5) * 0.6);
          b.rotation.set(rng() * 3, rng() * 3, 0);
          g.add(b);
        }
      } else if (pick3 < 0.8) {
        for (let k = 0; k < 3; k++) {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 1.4 + rng() * 0.6, 5), iron);
          st.position.set((rng() - 0.5) * 0.6, 0.7, (rng() - 0.5) * 0.4);
          st.rotation.set((rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6);
          g.add(st);
        }
      } else {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.85, 10), barrelM);
        br.position.y = 0.42;
        g.add(br);
        if (rng() < 0.5) {
          br.rotation.z = Math.PI / 2;
          br.position.y = 0.32;
        }
      }
    }
    G.clutter.push({ x: px, z: pz, r: 0.38 });
  });
}
// calls fn(x, z, yaw, dx, dz) for wall faces beside open floor, each with chance prob (lifted with raised ground)
function wallFaces(rng, prob, fn) {
  for (let z = 1; z < G.h - 1; z++)
    for (let x = 1; x < G.w - 1; x++) {
      if (solid(x, z) || ch(x, z) === 'g') continue;
      for (const [dx, dz] of DIRS4)
        if (ch(x + dx, z + dz) === '#' && rng() < prob) {
          const n0 = G.group.children.length,
            h = kindAt(x, z) === 1 ? LIFT : 0;
          fn(x * CELL + CELL / 2 + dx * (CELL / 2 - 0.04), z * CELL + CELL / 2 + dz * (CELL / 2 - 0.04), Math.atan2(-dx, -dz), dx, dz);
          if (h) for (let k = n0; k < G.group.children.length; k++) G.group.children[k].position.y += h;
        }
    }
}
// calls fn(x, z) for n random open spots on the floor, clear of the story's ground (lifted with raised ground)
function floorSpots(rng, n, fn, r = 0.6) {
  for (let k = 0, tries = 0; k < n && tries < n * 8; tries++) {
    const x = rng() * G.w * CELL,
      z = rng() * G.h * CELL,
      [ix, iz] = cellOf(x, z);
    if (solid(ix, iz) || ch(ix, iz) === 'g' || ch(ix, iz) === 'o' || ch(ix, iz) === 'T' || kindAt(ix, iz) === 2 || !clearOf(x, z, r)) continue;
    const n0 = G.group.children.length,
      h = heightAt(x, z);
    fn(x, z);
    k++;
    if (h) for (let q = n0; q < G.group.children.length; q++) G.group.children[q].position.y += h;
  }
}
const GOLD = () => new THREE.MeshLambertMaterial({ color: 0xc9a23a });
// a picture in a gold frame on a wall, with a brass label; cut: the painting cut out along its outline; keep: leave it unbaked
function framed(tex, w, h, x, y, z, yaw, tilt, label, cut, keep) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  G.group.add(g);
  const inner = new THREE.Group();
  inner.rotation.z = tilt;
  g.add(inner);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ color: cut ? 0x3a2a1c : COL.paper }));
  bg.position.z = 0.02;
  inner.add(bg);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.92), new THREE.MeshLambertMaterial({ map: tex, alphaTest: cut ? 0.4 : 0 }));
  pic.position.z = 0.035;
  inner.add(pic);
  const gold = GOLD(),
    t = 0.11;
  [
    [0, h / 2, w + t, t],
    [0, -h / 2, w + t, t],
    [w / 2, 0, t, h + t],
    [-w / 2, 0, t, h + t]
  ].forEach(([fx, fy, fw, fh]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.09), gold);
    b.position.set(fx, fy, 0.05);
    inner.add(b);
  });
  if (label) {
    const l = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w, 1.3), 0.42),
      flat(new THREE.MeshBasicMaterial({ map: wordTex(label, '#c9a23a'), transparent: true, depthWrite: false }))
    );
    l.position.set(0, -h / 2 - 0.32, 0.05);
    inner.add(l);
  }
  return { g, inner, pic };
}
// Floor 1 is narcissism and madness: the Geezer's portraits everywhere, mirrors, newspapers full of crap
function decorNarcissism(rng) {
  const portraits = [
    ['geezer', ''],
    ['geezer', 'MY BEST SIDE'],
    ['geezer', 'ADORE ME'],
    ['geezer', 'GENIUS'],
    ['hero_head', 'WHO?'],
    ['t_crapman', ''],
    ['t_selling', ''],
    ['defuk', ''],
    ['t_canvas', '']
  ];
  wallFaces(rng, 0.22, (x, z, yaw) => {
    const [k, lab] = portraits[(rng() * portraits.length) | 0],
      cut = !k.startsWith('t_');
    const h = 1.05 + rng() * 0.55,
      w = cut ? Math.min(h * SHAPES[k].aspect, 1.8) : h * (k === 't_canvas' ? 1.7 : 1.05);
    still(framed(TEX[k], w, h, x, 1.8 + rng() * 0.5, z, yaw, (rng() - 0.5) * (rng() < 0.4 ? 0.6 : 0.12), lab, cut).g);
  });
  // standing mirrors: they only ever show the Geezer
  wallFaces(rng, 0.045, (x, z, yaw, dx, dz) => {
    if (!clearOf(x - dx * 0.3, z - dz * 0.3, 0.7)) return;
    const g = still(new THREE.Group());
    g.position.set(x - dx * 0.3, 0, z - dz * 0.3);
    g.rotation.y = yaw;
    G.group.add(g);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6, 28), GOLD());
    frame.scale.set(1, 1.6, 1);
    frame.position.y = 1.35;
    g.add(frame);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.54, 28), new THREE.MeshBasicMaterial({ color: 0xb8c4c8 }));
    glass.scale.set(1, 1.6, 1);
    glass.position.set(0, 1.35, -0.01);
    g.add(glass);
    const ghost = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 1),
      flat(new THREE.MeshBasicMaterial({ map: TEX.geezer, transparent: true, opacity: 0.45, depthWrite: false }))
    );
    ghost.position.set(0, 1.35, 0.01);
    g.add(ghost);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), GOLD());
    leg.position.y = 0.3;
    g.add(leg);
  });
  // newspapers on the floor, crumpled pages
  const sheets = ['t_column', 't_crapwords', 't_textbox', 't_scribble'];
  let k = 0;
  floorSpots(
    rng,
    30,
    (x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshLambertMaterial({ map: TEX[sheets[(rng() * 4) | 0]] }));
      m.rotation.set(-Math.PI / 2, 0, rng() * TAU);
      m.position.set(x, 0.02 + k++ * 0.0004, z);
      G.group.add(still(m));
    },
    0.8
  );
  const ballM = new THREE.MeshLambertMaterial({ color: COL.paper });
  floorSpots(
    rng,
    34,
    (x, z) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15 + rng() * 0.08, 0), ballM);
      b.position.set(x, 0.14, z);
      b.rotation.set(rng() * 3, rng() * 3, 0);
      G.group.add(still(b));
    },
    0.3
  );
  // magnifying glasses drifting overhead, a huge one above the Geezer
  floorSpots(rng, 4, (x, z) => {
    const m = paper('defuk', 1.6, 0.05, true);
    m.position.set(x, 3.4 + rng() * 1.5, z);
    G.group.add(m);
    G.deco.push({ m, spin: 0.4, bob: rng() * 6, y: m.position.y });
  });
  const big = paper('defuk', 4.5, 0.1, true);
  big.position.set(7.5 * CELL, 5.5, 12.5 * CELL);
  G.group.add(big);
  G.deco.push({ m: big, spin: 0.15, bob: 1, y: 5.5 });
  // loose pages falling all the time
  G.spirits = [];
  floorSpots(rng, 9, (x, z) => {
    const m = paper(['dd_scream', 'dd_grin', 'dd_eyes'][(rng() * 3) | 0], 1.1, 0.04);
    m.position.set(x, 2.6 + rng() * 1.4, z);
    G.group.add(seeThru(m, true, 'plain')); // the floating faces drift at camera height (no contour: it ran through the Usher)
    G.spirits.push({ m, ox: x, oz: z, oy: m.position.y, ph: rng() * 6, sp: 0.4 + rng() * 0.5 });
  });
  const pageG = new THREE.PlaneGeometry(0.38, 0.5),
    pageIM = sheets.map(t => {
      const im = new THREE.InstancedMesh(pageG, new THREE.MeshLambertMaterial({ map: TEX[t], side: THREE.DoubleSide }), 7);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      G.group.add(im);
      return im;
    });
  G.papers = {
    ims: pageIM,
    p: Array.from({ length: 26 }, (_, i) => ({
      im: pageIM[i % 4],
      k: (i / 4) | 0,
      pos: new THREE.Vector3(rand(0, G.w * CELL), rand(0, 9), rand(0, G.h * CELL)),
      rx: 0,
      rz: 0,
      ph: rand(0, 6),
      spin: rand(-2, 2)
    }))
  };
  pageIM.forEach((im, j) => {
    im.count = G.papers.p.filter(q => q.im === im).length;
  });
}
// Floor 2 is anger and wrath: braziers, scorched floors, furious graffiti, smashed furniture
function decorWrath(rng) {
  const words = ['SHAME!', 'THE END IS NIGH!', 'FORBIDDEN KNOWLEDGE!', 'SCORCHED EARTH', 'PAIN!', 'GUERA!', 'AGE OF CAPRICORN', 'ENOUGH'];
  wallFaces(rng, 0.2, (x, z, yaw) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 0.86),
      flat(new THREE.MeshBasicMaterial({ map: wordTex(words[(rng() * words.length) | 0], HEX.tie), transparent: true, depthWrite: false }))
    );
    m.position.set(x, 1.3 + rng() * 2.4, z);
    m.rotation.y = yaw;
    m.rotation.z = (rng() - 0.5) * 0.5;
    G.group.add(still(m));
    (G.wallWords = G.wallWords || []).push([x, z]); // the niches keep off these faces
  });
  // a few braziers for light, well apart and off the route; the route itself carries its own markers
  wallFaces(rng, 0.05, (x, z, yaw, dx, dz) => {
    const fx = x - dx * 0.75,
      fz = z - dz * 0.75;
    if (G.pathSet.has(cellOf(fx, fz).join(',')) || G.fires.some(f => Math.hypot(f.x - fx, f.z - fz) < 11) || !clearOf(fx, fz, 0.9)) return;
    brazier(fx, 0, fz, 1.35);
  });
  const scorch = flat(new THREE.MeshBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.55, depthWrite: false }));
  floorSpots(
    rng,
    22,
    (x, z) => {
      const m = new THREE.Mesh(decalGeo, scorch);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.018, z);
      m.scale.set(0.6 + rng() * 1.2, 0.4 + rng(), 1);
      m.rotation.z = rng() * 3;
      G.group.add(still(m));
    },
    1.2
  );
  const wood = new THREE.MeshLambertMaterial({ map: TEX.t_ember, color: 0x8a6a5a });
  wallFaces(rng, 0.06, (x, z, yaw, dx, dz) => {
    if (!clearOf(x - dx * 0.6, z - dz * 0.6, 1)) return;
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5 + rng() * 0.5, 0.3 + rng() * 0.4, 0.4 + rng() * 0.5), wood);
      b.position.set(x - dx * (0.4 + rng() * 0.4) + (rng() - 0.5) * 0.8, 0.2, z - dz * (0.4 + rng() * 0.4) + (rng() - 0.5) * 0.8);
      b.rotation.set((rng() - 0.5) * 0.8, rng() * 3, (rng() - 0.5) * 0.8);
      G.group.add(still(b));
    }
  });
}
// doodles scribbled on the floor
function doodleDecals(rng, tint) {
  const mat = flat(new THREE.MeshBasicMaterial({ map: TEX.doodles, transparent: true, opacity: 0.5, depthWrite: false, color: tint }));
  for (let k = 0; k < 14; k++) {
    const x = (1 + rng() * (G.w - 2)) | 0,
      z = (1 + rng() * (G.h - 2)) | 0;
    if (solid(x, z) || propR(ch(x, z))) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rng() * TAU;
    if (kindAt(x, z) === 2 || !clearOf(x * CELL + CELL / 2, z * CELL + CELL / 2, 1.3)) continue;
    m.position.set(x * CELL + CELL / 2, 0.025 + heightAt(x * CELL + CELL / 2, z * CELL + CELL / 2), z * CELL + CELL / 2);
    G.group.add(still(m));
  }
}
