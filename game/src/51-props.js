// Props ('o' cells): floor one's easels with a painting, floor two's bear traps, floor three's stacked pastel blocks (the
// Grump's sound blocks below the gate). Their boxes, and the floating wall blocks, are drawn as instances: one draw per look.
const tmpM = new THREE.Matrix4(),
  WHITE = new THREE.Color(1, 1, 1);
// items: [{ mesh, owner, local }]: each mesh becomes an instance of one InstancedMesh per look (with its own colour, so a single
// block can flash)
function instanceBoxes(items, box) {
  const looks = new Map();
  for (const it of items) {
    const k = lookKey(it.mesh.material);
    let b = looks.get(k);
    if (!b) looks.set(k, (b = { mat: it.mesh.material, list: [] }));
    b.list.push(it);
  }
  for (const b of looks.values()) {
    const im = new THREE.InstancedMesh(box, b.mat, b.list.length);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < b.list.length; i++) im.setColorAt(i, WHITE);
    im.frustumCulled = false;
    G.group.add(im);
    b.list.forEach((it, i) => {
      it.im = im;
      it.idx = i;
      it.mesh.parent && it.mesh.parent.remove(it.mesh);
    });
  }
}
// each box's instance follows its owner (or is hidden: gone, or fading on its own while see-through)
function syncBoxes(list, gone) {
  for (const it of list) {
    if (gone || it.see) it.im.setMatrixAt(it.idx, ZERO_M);
    else {
      it.owner.updateMatrix();
      it.im.setMatrixAt(it.idx, tmpM.multiplyMatrices(it.owner.matrix, it.local));
    }
    it.im.instanceMatrix.needsUpdate = true;
  }
}
// after the build: the blocks of the props and the floating wall blocks become instances
function instanceProps(box) {
  const items = [];
  for (const g of G.blockProps) {
    g.userData.boxes = [];
    for (const m of [...g.children]) {
      const p = m.geometry.parameters;
      m.updateMatrix();
      const it = { mesh: m, owner: g, local: m.matrix.clone().multiply(new THREE.Matrix4().makeScale(p.width, p.height, p.depth)) };
      items.push(it);
      g.userData.boxes.push(it);
    }
  }
  for (const d of G.deco)
    if (d.m.isMesh && d.m.geometry === box && !Array.isArray(d.m.material) && !d.m.material.transparent) {
      const it = { mesh: d.m, owner: d.m, local: new THREE.Matrix4() };
      items.push(it);
      d.inst = it;
    }
  if (!items.length) return;
  instanceBoxes(items, box);
  for (const g of G.blockProps) syncBoxes(g.userData.boxes);
  for (const d of G.deco) if (d.inst) syncBoxes([d.inst]);
}
// room on the floor here: clear of every standing talker and of the story's ground
function critterRoom(x, z) {
  for (const e of G.enemies) if (!e.dead && !e.dying && e.fly == null && Math.hypot(e.pos.x - x, e.pos.z - z) < e.r + 0.35) return false;
  for (const k of G.keep) if (Math.hypot(k.x - x, k.z - z) < k.r + 0.3) return false;
  return true;
}
// Breakin’ props: a prop that blocks the way (an easel, a stack of blocks; never a flat trap) takes PROP_BREAK.hits blows, one a
// yo-yo throw or a pebble, landing within r m of its middle and below top m, and falls apart: its cell is open floor after
const PROP_BREAK = { hits: 2, r: 0.8, top: 2.6 };
function hitProp(p, rad) {
  const k = cellOf(p.x, p.z).join(),
    b = G.breaks[k];
  if (!b || Math.hypot(b.x - p.x, b.z - p.z) > rad + PROP_BREAK.r || p.y - heightAt(b.x, b.z) > PROP_BREAK.top) return false;
  b.hits++;
  SFX.tink();
  burst(FX_AT.set(b.x, heightAt(b.x, b.z) + 1.1, b.z), [COL.paper, COL.smoke, COL.ink], 8, 4, 0.14);
  if (b.hits >= PROP_BREAK.hits) breakProp(b, k);
  return true;
}
// it is gone: its drawing (baked, or its instanced boxes), its place on the map, its cover
function breakProp(b, k) {
  G.group.remove(b.g);
  if (b.g.userData.boxes) syncBoxes(b.g.userData.boxes, true);
  const c = G.see.find(s => s.o === b.g);
  if (c) {
    c.gone = true;
    for (const m of c.meshes) m.visible = false;
  }
  const [ix, iz] = cellOf(b.x, b.z),
    y = heightAt(b.x, b.z);
  G.map[iz] = G.map[iz].slice(0, ix) + '.' + G.map[iz].slice(ix + 1);
  delete G.breaks[k];
  if (G.props) delete G.props[k];
  burst(FX_AT.set(b.x, y + 1, b.z), [COL.paper, COL.smoke, COL.ink], 24, 6, 0.24);
  for (let p = 0; p < 3; p++) burst(FX_AT.set(b.x + rand(-0.6, 0.6), y + rand(0.4, 1.8), b.z + rand(-0.6, 0.6)), [COL.paper, COL.smoke], 8, 3, 0.2);
  playNoise({ dur: 0.4, f: 900, f2: 200, q: 0.8, gain: 0.26 });
}
// one prop at (cx, cz), turned at random (seeded)
function buildProp(F, cx, cz, rng) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = rng() * TAU;
  if (F.deco === 'corridor') propEasel(g);
  else if (F.deco === 'mouth') propTrap(g, cx, cz);
  else propBlocks(g, rng);
  const iz = cellOf(cx, cz)[1];
  // a bear trap lies flat; an easel and the Grump's sound blocks never fade; the Jester chamber's stacks fade without a contour
  if (F.deco !== 'mouth') G.group.add(seeThru(g, false, F.deco === 'corridor' || iz > 8 ? 'hard' : 'plain'));
  else G.group.add(g);
  if (!F.flatProps) G.see[G.see.length - 1].own = true; /* baked on its own (55-bake): breakProp takes its drawing away */
  if (!F.flatProps) G.breaks[cellOf(cx, cz)[0] + ',' + iz] = { g, x: cx, z: cz, hits: 0 };
  if (F.deco === 'blocks' && iz > 8) (G.props ??= {})[cellOf(cx, cz)[0] + ',' + iz] = { g, x: cx, z: cz, hp: 1, flashT: 0, tint: 1 };
}
// floor one: an easel holding a painting
function propEasel(g) {
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a3524 });
  [
    [-0.5, 0.25, -0.12],
    [0.5, 0.25, -0.12],
    [0, -0.45, 0.2]
  ].forEach(([x, z, r]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), wood);
    l.position.set(x * 0.9, 1.15, z);
    l.rotation.x = r;
    l.rotation.z = -x * 0.18;
    g.add(l);
  });
  const canvasM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.05), [
    wood,
    wood,
    wood,
    wood,
    new THREE.MeshLambertMaterial({ map: TEX.t_canvas }),
    wood
  ]);
  canvasM.position.set(0, 1.55, 0.12);
  canvasM.rotation.x = -0.12;
  g.add(canvasM);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.16), wood);
  shelf.position.set(0, 1.1, 0.12);
  g.add(shelf);
  still(g);
}
// floor two: a bear trap, two toothed jaws lying open on an iron plate (the plate is baked; the jaws snap shut: G.mines)
function propTrap(g, cx, cz) {
  const K = trapKit(),
    base = new THREE.Mesh(K.base, K.iron),
    fixed = still(new THREE.Group());
  base.position.y = 0.04;
  fixed.add(base);
  fixed.position.copy(g.position);
  fixed.rotation.y = g.rotation.y;
  G.group.add(fixed);
  const pan = new THREE.Mesh(K.pan, K.rust);
  pan.position.y = 0.09;
  fixed.add(pan);
  fixed.add(new THREE.Mesh(K.extras, K.iron));
  const jaws = [1, -1].map(sd => {
    const j = new THREE.Group();
    j.add(new THREE.Mesh(K.jawRing, K.iron), new THREE.Mesh(K.jawTeeth, K.teeth));
    j.scale.z = sd;
    j.position.y = 0.09;
    g.add(j);
    return j;
  });
  const bp = bloodPool(cx + rand(-0.4, 0.4), cz + rand(-0.4, 0.4), 1.5);
  if (bp && kindAt(...cellOf(cx, cz)) === 1) bp.position.y -= LIFT; // the raised cell lifts it with the rest
  G.mines.push({ g, jaws, x: cx, z: cz, st: 'armed', t: 0, beep: 0, c: 0 });
}
// floor three: three pastel blocks stacked, each smaller
function propBlocks(g, rng) {
  const cols = ['t_blue', 't_lime', 't_orange', 't_ochre', 't_brown'];
  let y = 0;
  for (let k = 0; k < 3; k++) {
    const s = 1.3 - k * 0.25,
      m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), new THREE.MeshLambertMaterial({ map: TEX[cols[(rng() * cols.length) | 0]] }));
    m.position.set((rng() - 0.5) * 0.2, y + s * 0.4, (rng() - 0.5) * 0.2);
    m.rotation.y = rng();
    g.add(m);
    y += s * 0.8;
  }
  G.blockProps.push(g);
}
