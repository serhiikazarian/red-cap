// Baking: after a floor is built, every still, opaque mesh is merged into one mesh per material look, so a floor costs a few
// dozen draw calls instead of several hundred. Transparent things are left alone, so their back-to-front order never changes.
// a transform from position, rotation and scale
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
// many transformed pieces ([geometry, matrix]) merged into one geometry: one draw call per structure
function mergeGeos(list) {
  let n = 0;
  const gs = list.map(([g, m]) => {
    const q = g.index ? g.toNonIndexed() : g.clone();
    q.applyMatrix4(m);
    n += q.attributes.position.count;
    return q;
  });
  const pos = new Float32Array(n * 3),
    nor = new Float32Array(n * 3),
    uv = new Float32Array(n * 2),
    col = gs.every(q => q.attributes.color) ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const q of gs) {
    const c = q.attributes.position.count;
    pos.set(q.attributes.position.array, o * 3);
    nor.set(q.attributes.normal.array, o * 3);
    if (q.attributes.uv) uv.set(q.attributes.uv.array, o * 2);
    if (col) col.set(q.attributes.color.array, o * 3);
    o += c;
    q.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// what can be baked: plain lit or unlit materials, opaque (or marked flat), no shader changes except floor two's wall shading
const BAKE_PROTO = THREE.Material.prototype.onBeforeCompile;
const bakeable = m =>
  (m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) &&
  (!m.transparent || m.userData.flat) &&
  (m.onBeforeCompile === BAKE_PROTO || m.onBeforeCompile === wallShade) &&
  !m.wireframe;
const hexOf = c => (c ? c.getHex() : -1);
const lookKey = m =>
  [
    m.type,
    m.map ? m.map.uuid : 0,
    hexOf(m.color),
    hexOf(m.emissive),
    hexOf(m.specular),
    m.shininess,
    m.side,
    m.vertexColors,
    m.flatShading,
    m.alphaTest,
    m.fog,
    m.depthTest,
    m.depthWrite,
    m.opacity,
    m.transparent,
    m.blending,
    m.onBeforeCompile === wallShade
  ].join('|');
const flat = m => ((m.userData.flat = true), m); // a see-through decal that lies flat on a wall or floor: safe to bake
function isStill(o) {
  for (let q = o; q && q !== G.group; q = q.parent) if (q.userData.static) return true;
  return false;
}
function bakeGeo(parts, colours) {
  let n = 0;
  for (const p of parts) n += p.s1 - p.s0;
  const pos = new Float32Array(n * 3),
    nor = new Float32Array(n * 3),
    uv = new Float32Array(n * 2),
    col = colours ? new Float32Array(n * 3).fill(1) : null;
  const v = new THREE.Vector3(),
    nm = new THREE.Matrix3();
  let o = 0;
  for (const p of parts) {
    const g = p.g,
      P3 = g.attributes.position,
      N = g.attributes.normal,
      U = g.attributes.uv,
      C = g.attributes.color,
      I = g.index;
    nm.getNormalMatrix(p.mw);
    for (let k = p.s0; k < p.s1; k++, o++) {
      const r = (k - p.s0) % 3,
        kk = p.flip ? (r === 1 ? k + 1 : r === 2 ? k - 1 : k) : k,
        i = I ? I.getX(kk) : kk; // a mirrored piece has its winding turned back
      v.fromBufferAttribute(P3, i).applyMatrix4(p.mw);
      pos[o * 3] = v.x;
      pos[o * 3 + 1] = v.y;
      pos[o * 3 + 2] = v.z;
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nor[o * 3] = v.x;
      nor[o * 3 + 1] = v.y;
      nor[o * 3 + 2] = v.z;
      if (U) {
        uv[o * 2] = U.getX(i);
        uv[o * 2 + 1] = U.getY(i);
      }
      if (col && C) {
        col[o * 3] = C.getX(i);
        col[o * 3 + 1] = C.getY(i);
        col[o * 3 + 2] = C.getZ(i);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
// every still mesh of the floor goes into one mesh per look (material, and see-through group if it fades)
function bakeStatics() {
  G.group.updateMatrixWorld(true);
  const looks = new Map(),
    gone = [];
  G.group.traverse(o => {
    if (takeStill(o, looks)) gone.push(o);
  });
  for (const o of gone) o.parent.remove(o);
  pruneEmpty(G.group);
  for (const b of looks.values()) G.group.add(bakedMesh(b));
  G.group.updateMatrixWorld(true);
}
// the see-through group a mesh belongs to, or null (a hard one never fades: it is baked with everything else, only its
// shape kept for the camera)
function seeGroupOf(o) {
  let see = null;
  for (let q = o; q && q !== G.group; q = q.parent) if (q.userData.seeId) see = G.see[q.userData.seeId - 1];
  if (see && see.hard) {
    see.baked = true;
    see = null;
  }
  return see;
}
// files a still mesh's triangles under their looks (each material group on its own); true if it was taken
function takeStill(o, looks) {
  if (!o.isMesh || o.isInstancedMesh || !o.visible || !isStill(o)) return false;
  const g = o.geometry,
    mats = Array.isArray(o.material) ? o.material : [o.material];
  if (!g.isBufferGeometry || !g.attributes.normal || g.attributes.position.itemSize !== 3 || mats.some(m => !bakeable(m))) return false;
  const total = g.index ? g.index.count : g.attributes.position.count,
    see = seeGroupOf(o);
  const take = (mat, s0, s1) => {
    const k = lookKey(mat) + (see ? '|see' + see.o.userData.seeId : '');
    let b = looks.get(k);
    if (!b) looks.set(k, (b = { mat, parts: [], see }));
    b.parts.push({ g, s0, s1, mw: o.matrixWorld, flip: o.matrixWorld.determinant() < 0 });
  };
  if (Array.isArray(o.material)) {
    for (const gr of g.groups) {
      const m = mats[gr.materialIndex];
      if (m && m.visible) take(m, gr.start, Math.min(total, gr.start + gr.count));
    }
  } else if (o.material.visible) take(o.material, 0, total);
  return true;
}
// still groups left empty go too
function pruneEmpty(o) {
  for (const c of [...o.children]) pruneEmpty(c);
  if (o !== G.group && o.isGroup && !o.children.length && isStill(o)) o.parent.remove(o);
}
function bakedMesh(b) {
  const m = new THREE.Mesh(bakeGeo(b.parts, b.mat.vertexColors), b.mat);
  m.matrixAutoUpdate = false;
  m.userData.static = true;
  if (b.see && b.see.solid) {
    // placed where it stands (not at the origin): faded, it is sorted against Red Cap by its own place, so its solid foot covers him
    m.geometry.computeBoundingBox();
    m.geometry.boundingBox.getCenter(m.position);
    m.geometry.translate(-m.position.x, -m.position.y, -m.position.z);
  }
  m.updateMatrix();
  if (b.mat.transparent) m.renderOrder = -1;
  if (b.see) {
    b.see.meshes.push(m);
    b.see.baked = true; // its own objects are gone from the floor now: only the baked mesh is left
  }
  return m;
}
