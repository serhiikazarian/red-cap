// Building a floor from FLOORS[i]: clearLevel frees the last one; buildLevel makes the new one in a fixed order. Its layout
// draws from a seeded generator (rng), so a floor looks the same every time; only a few things roll fresh dice (which
// pyramids hold bombs, the corner room's pile, sky decor).

// frees everything of the floor that ends, and puts back what lives outside it (particles, shots, words, Red Cap's state)
function clearLevel() {
  if (G) {
    scene.remove(G.group);
    const keep = new Set([hero.root, yoyoMesh, stringMesh, yyTrail]);
    const free = o => {
      if (keep.has(o)) return;
      o.children.forEach(free);
      if (o.geometry && !o.isSprite && !SHARED.has(o.geometry)) o.geometry.dispose();
      const ud = o.userData || {};
      for (const m of new Set([o.material, ud.seeMat, ud.seeOrig].flat().filter(Boolean))) {
        if (SHARED.has(m)) continue;
        if (m.map && OWN.has(m.map)) m.map.dispose();
        m.dispose();
      }
    };
    free(G.group);
    for (const c of G.see || []) for (const it of c.items || []) if (it.seeMat) it.seeMat.dispose();
  }
  hero.heat = 0;
  hero.spook = 0;
  slingT = 0;
  hero.yy = null;
  yoyoMesh.visible = stringMesh.visible = false;
  hitStop = 0;
  hero.yoyoQ = false;
  hero.mix = 0;
  hero.mixLast = null;
  parts.forEach(p => {
    PMESH.setMatrixAt(p.i, ZERO_M);
    p.life = 0;
  });
  parts.length = 0;
  PMESH.instanceMatrix.needsUpdate = true;
  bloodFreeAll();
  // things that live in the scene, outside the floor's group
  const drop = list => {
    for (const x of list) {
      scene.remove(x.s);
      x.s.material.dispose();
    }
    list.length = 0;
  };
  puffs.length = 0;
  puffSync();
  drop(shots);
  drop(floaters);
  drop(trail);
  // the words come back as the next floor uses them
  for (const k in canvasTexCache) {
    canvasTexCache[k].dispose();
    delete canvasTexCache[k];
  }
  slabs.length = 0;
  coverDebris.length = 0;
  pebbles.length = 0;
  sprayStop();
}
function buildLevel(i) {
  clearLevel();
  const F = FLOORS[i],
    w = Math.max(...F.map.map(r => r.length));
  newFloor(F, w);
  const box = new THREE.BoxGeometry(1, 1, 1),
    rng = mulberry(i * 99 + 7);
  buildCells(F, w, box, rng);
  buildRaised(F);
  hero.pos.y = heightAt(hero.pos.x, hero.pos.z);
  storyGround(F);
  if (G.pyr) hideBombs();
  if (F.roomPile && Math.random() < F.roomPile[4]) roomPile(F);
  const well = i > 0 && hero.hp >= WELL.hp; // doing too well: a leaner floor
  if (F.hiddenHearts || F.hiddenPiles)
    hideHearts(Math.floor((F.hiddenHearts || 0) * (well ? WELL.hearts : 1)), Math.floor((F.hiddenPiles || 0) * (well ? WELL.piles : 1)));
  skyDecor(F, w, box);
  placeBystanders(rng, i === 2 ? 8 : 9);
  doodleDecals(rng, F.words);
  if (F.deco === 'blocks' && !hero.hasJaw) hideLivingDying();
  buildCages(F);
  tuneUshers(F);
  if (F.deco !== 'blocks') guidePath(F, rng);
  if (F.deco === 'corridor') decorNarcissism(rng);
  else if (F.deco === 'mouth') decorWrath(rng);
  if (F.deco !== 'blocks') clutter(F, rng);
  dreamwork(F, rng);
  if (F.deco === 'blocks') fogWall(8); // the wall behind the Grump is fog, and it lifts when he falls
  instanceProps(box);
  seePrep();
  // nothing marked static ever moves again: compute its matrices once and skip it every frame after
  G.group.traverse(o => {
    if (o.userData.static)
      o.traverse(c => {
        c.updateMatrix();
        c.matrixAutoUpdate = false;
      });
  });
  G.group.matrixAutoUpdate = false;
  G.group.updateMatrix();
  G.group.updateMatrixWorld(true);
  bakeStatics();
  seeMeshes();
  heroOnFloor(F);
  flowField();
}
// the floor's state (G), its light and fog, and the ground
function newFloor(F, w) {
  const map = F.map.map(r => r.padEnd(w, '#'));
  G = {
    F,
    map,
    w,
    h: map.length,
    group: new THREE.Group(),
    blockProps: [],
    enemies: [],
    npcs: [],
    pickups: [],
    decals: [],
    gate: [],
    totems: [],
    mines: [],
    gateClosed: true,
    later: [], // timers in play time (later)
    portal: null,
    deco: [],
    fires: [],
    hot: [],
    pathSet: new Set(),
    dist: new Float32Array(w * map.length),
    stakes: []
  };
  buildHeights(F);
  scene.add(G.group);
  SEE.on = false;
  SEE.tg = null;
  scene.background = new THREE.Color(F.bg);
  scene.fog = new THREE.Fog(F.fog, F.near, F.far);
  post.uniforms.far.value = F.far;
  G.group.add(new THREE.AmbientLight(F.amb[0], F.amb[1]));
  G.group.add(new THREE.HemisphereLight(F.hemi[0], F.hemi[1], F.hemi[2]));
  const lamp = new THREE.PointLight(F.lamp[0], F.lamp[1], F.lamp[2], 1.6);
  G.lamp = lamp;
  G.group.add(lamp);
  const fw = w * CELL,
    fh = G.h * CELL;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(fw + 30, fh + 30),
    new THREE.MeshLambertMaterial({ map: texRepeat(F.floor, (fw + 30) / 5, (fh + 30) / 5), color: F.deco === 'blocks' ? 0xf4efe6 : 0xbbbbbb })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(fw / 2, 0, fh / 2);
  G.group.add(still(floor));
}
// every cell of the map: walls (floor three's stacked blocks; elsewhere one tall box, floor two's with a cornice and a
// floating block now and then), the gate, pillars, pyramids and totems, props, the start, talkers, hearts and the exit door.
// Things on raised ground are lifted with it.
function buildCells(F, w, box, rng) {
  const map = G.map;
  const wallMats = F.walls.map(t => {
    const [k, c] = t.split(':'); // a tint after the colon (floor two's darker walls)
    const m = new THREE.MeshLambertMaterial({ map: TEX[k], color: c ? +c : 0xffffff });
    if (F.deco === 'mouth') m.onBeforeCompile = wallShade;
    return m;
  });
  const cornice = [], // floor two's wall tops (corniceGeo), merged after the walls
    webFaces = []; // and the faces under them, for the webs (addWebs)
  G.wallTop = {}; // each wall cell's height (x + z * width), for things set on top
  G.blockBase = {}; // floor three: each wall cell's bottom block height (the paintings hang on it)
  const movedFrom = {},
    movedTo = new Set();
  for (const [fx, fz, tx, tz] of F.blockMoved || []) {
    movedFrom[fx + ',' + fz] = [tx, tz];
    movedTo.add(tx + ',' + tz);
  }
  for (let z = 0; z < G.h; z++)
    for (let x = 0; x < w; x++) {
      const c = map[z][x],
        cx = x * CELL + CELL / 2,
        cz = z * CELL + CELL / 2,
        nBefore = G.group.children.length;
      const mv = movedFrom[x + ',' + z];
      if (mv) buildProp(F, mv[0] * CELL + CELL / 2, mv[1] * CELL + CELL / 2, rng);
      if (c === '#') {
        if (F.deco === 'blocks') {
          let y = 0;
          const n = 2 + ((rng() * 2) | 0);
          for (let k = 0; k < n; k++) {
            const h = 1.2 + rng() * 2.2,
              m = new THREE.Mesh(box, wallMats[(rng() * wallMats.length) | 0]);
            const inset = k ? rng() * 0.5 : 0;
            m.scale.set(CELL - inset, h, CELL - inset);
            m.position.set(cx + (k ? (rng() - 0.5) * 0.5 : 0), y + h / 2, cz + (k ? (rng() - 0.5) * 0.5 : 0));
            m.rotation.y = k ? (rng() - 0.5) * 0.15 : 0;
            G.group.add(still(m));
            if (!k) G.blockBase[x + z * w] = h;
            y += h;
          }
        } else {
          const h = F.wallH[0] + rng() * (F.wallH[1] - F.wallH[0]) + (nearRaised(x, z) ? LIFT : 0),
            m = new THREE.Mesh(box, wallMats[(rng() * wallMats.length) | 0]);
          m.scale.set(CELL, h, CELL);
          m.position.set(cx, h / 2, cz);
          G.group.add(still(m));
          G.wallTop[x + z * w] = h;
          if (F.deco === 'mouth')
            for (const [a, b] of DIRS4) {
              const nc = ch(x + a, z + b);
              if (nc && nc !== '#') {
                cornice.push([corniceGeo(a ? 0.04 : 0.06), M4(cx + (a * CELL) / 2, h, cz + (b * CELL) / 2, 0, Math.atan2(a, b), 0)]);
                webFaces.push([cx + (a * CELL) / 2, cz + (b * CELL) / 2, a, b, h]);
              }
            }
          if (rng() < 0.25) {
            const f = new THREE.Mesh(box, wallMats[(rng() * wallMats.length) | 0]);
            f.scale.set(CELL * (0.5 + rng() * 0.6), 0.8 + rng() * 1.6, CELL * (0.5 + rng() * 0.6));
            f.position.set(cx + (rng() - 0.5), h + 1 + rng() * 2.5, cz + (rng() - 0.5));
            f.rotation.set((rng() - 0.5) * 0.5, rng() * 3, (rng() - 0.5) * 0.5);
            G.group.add(f);
            G.deco.push({ m: f, spin: (rng() - 0.5) * 0.3, bob: rng() * 6, y: f.position.y });
          }
        }
      } else if (c === 'g') {
        const h = 4.2,
          m = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ map: TEX.t_coal, color: 0x888888 }));
        m.scale.set(CELL, h, CELL * 0.8);
        m.position.set(cx, h / 2, cz);
        m.userData = { y0: h / 2, h };
        G.group.add(m);
        G.gate.push(m);
        if (F.deco === 'blocks') m.visible = false;
      } else if (c === 'T') {
        if (F.deco === 'blocks' && z < 8)
          buildTotem(cx, cz, false, rng); // in the Jester's chamber
        else if (F.deco === 'mouth') buildPyramid(x, z, cx, cz, rng);
        else if (F.deco === 'blocks') buildTotem(cx, cz, true, rng);
        else {
          const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 7, 8), new THREE.MeshLambertMaterial({ color: 0x1a1612 }));
          t.position.set(cx, 3.5, cz);
          G.group.add(seeThru(still(t), false, 'pillar')); // a pillar's rules: seeSolid
        }
      } else if (c === 'o') {
        if (!movedTo.has(x + ',' + z)) buildProp(F, cx, cz, rng);
      } else if (c === '_') for (let k = 0; k < 13; k++) rng();
      else if (c === 'P')
        hero.pos.set(F.start ? F.start[0] : cx, 0, F.start ? F.start[1] : cz); // F.start: a spot off the cell's centre
      else if ('BGRUMZSYWq'.includes(c)) makeEnemy(c, cx, cz);
      else if (c === 'h') spawnPickup(cx, cz);
      else if (c === 'X') buildDoor(cx, cz);
      if (c !== '#' && kindAt(x, z) === 1) for (let k = nBefore; k < G.group.children.length; k++) G.group.children[k].position.y += LIFT;
    }
  if (cornice.length) G.group.add(still(new THREE.Mesh(mergeGeos(cornice), new THREE.MeshLambertMaterial({ color: 0x24100c, emissive: 0x1a0402 }))));
  if (F.deco === 'mouth') addWebs(w, webFaces);
  if (F.deco === 'blocks') addPaintings(w);
}
// floor one's corner room (the curtain and the endless doorway): sometimes a pile of pebbles somewhere in it
function roomPile(F) {
  const [x0, z0, x1, z1] = F.roomPile,
    cells = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (ch(x, z) === '.') cells.push([x, z]);
  const [cx, cz] = pick(cells);
  pebblePile(...heartRoom((cx + 0.2 + Math.random() * 0.6) * CELL, (cz + 0.2 + Math.random() * 0.6) * CELL));
}
// overhead: floor one's yellow drips, floor two's stalactites, the Grin in the sky and its slogans, floor three's floating blocks
// and the chamber's red floor
function skyDecor(F, w, box) {
  const fw = w * CELL,
    fh = G.h * CELL;
  if (F.deco === 'corridor') {
    const dg = new THREE.ConeGeometry(0.07, 0.5, 4);
    dg.rotateX(Math.PI);
    const im = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ color: 0xe8c628 }), 60);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    G.group.add(im);
    G.drips = { im, d: Array.from({ length: 60 }, () => ({ x: rand(0, fw), y: rand(0, 12), z: rand(0, fh), v: rand(4, 7) })) };
  } else if (F.deco === 'mouth') {
    const tm = new THREE.MeshPhongMaterial({ color: 0xe9dccb, flatShading: true, shininess: 0 });
    for (let k = 0; k < 34; k++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(rand(0.7, 1.5), rand(2.5, 5), 4), tm);
      t.rotation.x = Math.PI;
      t.position.set(rand(0, fw), rand(10, 12.5), rand(0, fh));
      t.rotation.y = rand(0, 3);
      G.group.add(still(t));
    }
    const sky = paper('grin', 34, 0.5);
    sky.rotation.x = Math.PI / 2;
    sky.position.set(fw / 2, 20, fh / 2 - 17);
    sky.userData.mat.fog = false;
    G.group.add(sky);
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(5, 6.2), new THREE.MeshBasicMaterial({ map: TEX.slogan, transparent: true, alphaTest: 0.2 }));
    sl.position.set(8.5 * CELL, 3.6, 12 * CELL - 0.03);
    sl.rotation.y = Math.PI;
    G.group.add(sl);
    const sl2 = sl.clone();
    sl2.scale.setScalar(0.6);
    sl2.position.set(8.5 * CELL, 2.6, 7 * CELL - 0.03);
    G.group.add(sl2);
  } else if (F.deco === 'blocks') {
    const cols = ['t_blue', 't_lime', 't_orange', 't_ochre', 't_brown'];
    for (let k = 0; k < 26; k++) {
      const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ map: TEX[pick(cols)] }));
      m.scale.set(rand(1, 4), rand(0.3, 1.5), rand(1, 4));
      m.position.set(rand(0, fw), rand(7, 13), rand(0, fh));
      m.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
      G.group.add(m);
      G.deco.push({ m, spin: rand(-0.2, 0.2), bob: rand(0, 6), y: m.position.y });
    }
    const chamberFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(19 * CELL, 7 * CELL),
      new THREE.MeshLambertMaterial({ map: texRepeat('t_red', 6, 3), color: 0x999999 })
    );
    chamberFloor.rotation.x = -Math.PI / 2;
    chamberFloor.position.set((w * CELL) / 2, 0.015, 4.5 * CELL);
    G.group.add(still(chamberFloor));
  }
}
// floor one's Ushers: the first one spots Red Cap from the far end of the row (and drops no heart); some are bigger (k: size,
// which scales his body, health, reach, charge and the force of his blows)
function tuneUshers(F) {
  if (F.firstUsher) {
    const u = G.enemies.find(e => e.type === 'B' && cellOf(e.pos.x, e.pos.z).join() === F.firstUsher.join());
    if (u) {
      u.sight = 22;
      u.first = true;
    }
  }
  for (const [x, z, k, hpSet] of F.usherSizes || []) {
    const u = G.enemies.find(e => e.type === 'B' && cellOf(e.pos.x, e.pos.z).join() === x + ',' + z);
    if (u) {
      const hp = hpSet || Math.round(4.5 + (k - 1) * 5.5);
      Object.assign(u, { k, hp, maxHp: hp, r: 0.7 * k, hgt: 3 * k, y1: 3 * k });
      u.root.scale.setScalar(1.25 * k);
    }
  }
}
// Red Cap steps onto the new floor: the camera turns to the floor's way, he gets a moment of grace and nothing carries over
function heroOnFloor(F) {
  hero.root.position.copy(hero.pos);
  G.group.add(hero.root, yoyoMesh, stringMesh, yyTrail);
  cam.yaw = F.yaw;
  if (F.pitch != null) cam.pitch = F.pitch;
  cam.cur = null;
  cam.sh = null;
  cam.hy = null;
  cam.hold = 0;
  hero.safe = hero.pos.clone();
  slowT = 0;
  hero.snared = 0;
  hero.held = 0;
  hero.snareLine = null;
  hero.wet = 0;
  hero.blest = 0;
  hero.shoutLeak = 0;
  hero.iframe = 1.5;
  hero.noBlink = true;
  hero.knock.set(0, 0);
  hero.vel.set(0, 0);
  hero.dodgeT = 0;
  hero.yy = null;
  yoyoMesh.visible = stringMesh.visible = false;
  drawTies();
  updLeft();
  bossBar(null);
}
