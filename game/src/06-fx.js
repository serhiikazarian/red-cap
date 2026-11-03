// Effects: particles (one instanced mesh, a fixed pool of 520 reused oldest first), the Priest's blood drops (another pool),
// floating words over the action, ground shadows and blood pools.
const parts = [];
const triGeo = share(new THREE.CircleGeometry(0.5, 3));
const POOL = [];
let poolNext = 0,
  PMESH = null;
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0),
  dummy = new THREE.Object3D(),
  tmpC = new THREE.Color();
// instanced pieces: one draw call for the lot; a dead slot is scaled to nothing
function instPool(geo, n, parent) {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  tmpC.setRGB(1, 1, 1);
  for (let i = 0; i < n; i++) {
    m.setMatrixAt(i, ZERO_M);
    m.setColorAt(i, tmpC);
  }
  m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  parent.add(m);
  return m;
}
function poolInit() {
  PMESH = instPool(triGeo, 520, scene);
  for (let i = 0; i < 520; i++) POOL.push({ i, pos: new THREE.Vector3(), rx: 0, ry: 0, size: 1, v: new THREE.Vector3(), life: 0, g: 0, spin: 0 });
  bloodInit();
}
function partMat(p) {
  dummy.position.copy(p.pos);
  dummy.rotation.set(p.rx, p.ry, 0);
  dummy.scale.setScalar(p.size * clamp(p.life * 2, 0, 1));
  dummy.updateMatrix();
  PMESH.setMatrixAt(p.i, dummy.matrix);
}
function burst(pos, colors, n = 14, spd = 5, size = 0.16, opts = {}) {
  for (let i = 0; i < n; i++) {
    const p = POOL[poolNext];
    poolNext = (poolNext + 1) % POOL.length; // oldest piece gets reused
    if (p.life <= 0) parts.push(p);
    PMESH.setColorAt(p.i, tmpC.setHex(pick(colors)));
    p.pos.copy(pos);
    p.size = size * rand(0.6, 1.4);
    p.rx = rand(0, TAU);
    p.ry = rand(0, TAU);
    const a = rand(0, TAU),
      up = rand(0.3, 1);
    p.v.set(Math.cos(a) * spd * rand(0.3, 1), up * spd * (opts.up ?? 0.9), Math.sin(a) * spd * rand(0.3, 1));
    p.life = rand(0.6, 1.1) * (opts.life || 1);
    p.g = opts.g ?? 12;
    p.spin = rand(-12, 12);
    partMat(p);
  }
  PMESH.instanceColor.needsUpdate = true;
  PMESH.instanceMatrix.needsUpdate = true;
}
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.v.y -= p.g * dt;
    p.pos.addScaledVector(p.v, dt);
    const fl = heightAt(p.pos.x, p.pos.z) + 0.03;
    if (p.pos.y < fl) {
      p.pos.y = fl;
      p.v.multiplyScalar(0.5);
      p.v.y = 0;
    }
    p.rx += p.spin * dt;
    if (p.life <= 0) {
      PMESH.setMatrixAt(p.i, ZERO_M);
      parts.splice(i, 1);
    } else partMat(p);
  }
  if (PMESH) PMESH.instanceMatrix.needsUpdate = true;
}
// the Priest's blood drops: the same trick, a slot per drop (21-shots moves them)
let BLOOD = null;
const bloodFree = [],
  BLOOD_N = 640;
function bloodInit() {
  BLOOD = instPool(triGeo, BLOOD_N, scene);
  for (let i = BLOOD_N - 1; i >= 0; i--) bloodFree.push(i);
}
function bloodSlot(b) {
  dummy.position.copy(b.position);
  dummy.rotation.set(0, 0, b.rotation.z);
  dummy.scale.copy(b.scale);
  dummy.updateMatrix();
  BLOOD.setMatrixAt(b.slot, dummy.matrix);
}
function bloodFreeAll() {
  for (const b of shots)
    if (b.s.slot != null) {
      BLOOD.setMatrixAt(b.s.slot, ZERO_M);
      bloodFree.push(b.s.slot);
      b.s.slot = null;
    }
  BLOOD.instanceMatrix.needsUpdate = true;
}
// Floating words: a sprite that rises and fades. Small chatter gives way when the screen is busy; the same word never stutters;
// two words never overlap (unless must: then the older one makes way).
const floaters = [];
const lastWord = {};
// where a floating word sits on screen (pixels), from its position and size
const wordV = new THREE.Vector3();
function wordRect(pos, scale) {
  const v = wordV.copy(pos).project(camera),
    d = Math.max(0.5, camera.position.distanceTo(pos)),
    h = ((0.8 * scale) / (2 * d * Math.tan((camera.fov * Math.PI) / 360))) * innerHeight;
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, w: h * 2.875, h, behind: v.z > 1 };
}
const wordsMeet = (a, b) => !a.behind && !b.behind && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
function floatWord(text, pos, color, scale = 1.2, must, life = 0.9) {
  const now = performance.now();
  if (!must) {
    if (lastWord[text] && now - lastWord[text] < 1200) return;
    if ((scale < 0.95 && floaters.length >= 2) || floaters.length >= 4) return;
  }
  const r = wordRect(pos, scale),
    over = floaters.filter(f => f.life > 0.12 && wordsMeet(r, wordRect(f.s.position, f.scale)));
  if (over.length) {
    if (!must) return;
    for (const f of over) f.life = Math.min(f.life, 0.12);
  }
  lastWord[text] = now;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: wordTex(text, color), transparent: true, depthTest: false, depthWrite: false, fog: false })
  );
  s.position.copy(pos);
  s.scale.set(2.3 * scale, 0.8 * scale, 1);
  s.renderOrder = 10;
  scene.add(s);
  floaters.push({ s, life, vy: 1.1, scale });
}
function updFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.s.position.y += f.vy * dt;
    f.s.material.opacity = clamp(f.life * 2, 0, 1);
    if (f.life <= 0) {
      scene.remove(f.s);
      f.s.material.dispose();
      floaters.splice(i, 1);
    }
  }
}
const decalGeo = share(new THREE.CircleGeometry(1, 12));
// a soft dark oval on the ground under a figure
function groundShadow(parent, sx, sz, opacity) {
  const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.scale.set(sx, sz, 1);
  parent.add(m);
  return m;
}
// a blood pool on the ground (the oldest of 70 goes)
function bloodPool(x, z, r) {
  if (!G) return;
  if (G.decals.length > 70) {
    const d = G.decals.shift();
    G.group.remove(d);
  }
  const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0x6e0710, transparent: true, opacity: 0.85, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, heightAt(x, z) + 0.02 + Math.random() * 0.01, z);
  m.scale.set(r, r * rand(0.6, 1), 1);
  G.group.add(m);
  G.decals.push(m);
  return m;
}
// Smoke puffs (the Smokers, Brainless, the fog): every puff in a few instanced draws, each quad turned to the camera in its
// shader. The puffs are cut into groups wherever another see-through thing sorts between them (last frame's render list),
// so everything still falls between the puffs as it would with one sprite per puff; puffSync fills the draws before each render.
const puffs = [];
let smokeTex;
function makeSmokeTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(150,146,140,.95)');
  g.addColorStop(0.6, 'rgba(120,116,110,.7)');
  g.addColorStop(1, 'rgba(110,106,100,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(40,36,32,.35)';
  x.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * TAU,
      r = 10 + Math.random() * 35;
    x.beginPath();
    x.arc(64 + Math.cos(a) * r * 0.4, 64 + Math.sin(a) * r * 0.4, r * 0.5, a, a + 1.4);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
// the smoke picture is clear past 62 of its 64-pixel radius: a 16-sided shape round it draws the same puff without the empty
// corners (a fifth of every puff's pixels)
const PUFF_GEO = (() => {
  const n = 16,
    r = 0.5 / Math.cos(Math.PI / n),
    pos = [0, 0, 0],
    uv = [0.5, 0.5],
    idx = [];
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) * TAU) / n;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    uv.push(0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r);
    idx.push(0, k + 1, ((k + 1) % n) + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return share(g);
})();
const PUFF_MAX = 45,
  PUFF_LOW = 25, // the most on a slow machine (resScale below RES_MIN)
  PUFF_CAP = 96; // puffs one draw holds (PUFF_MAX alive, plus the ones fading out fast)
const PUFF_DRAWS = 8;
const PUFF_MESHES = [...Array(PUFF_DRAWS)].map(() => {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(PUFF_GEO.index);
  g.setAttribute('position', PUFF_GEO.attributes.position);
  g.setAttribute('uv', PUFF_GEO.attributes.uv);
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(PUFF_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSro', new THREE.InstancedBufferAttribute(new Float32Array(PUFF_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const m = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
      vertexShader: `attribute vec3 aPos, aSro; varying vec2 vUv; varying float vOp;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv; vOp = aSro.z;
        vec4 mvPosition = modelViewMatrix * vec4(aPos, 1.);
        vec2 p = position.xy * aSro.x, cs = vec2(cos(aSro.y), sin(aSro.y));
        mvPosition.xy += vec2(cs.x * p.x - cs.y * p.y, cs.y * p.x + cs.x * p.y);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vOp;
      #include <fog_pars_fragment>
      void main() {
        vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(t.rgb, t.a * vOp);
        #include <fog_fragment>
      }`,
      transparent: true,
      depthWrite: false,
      fog: true
    })
  );
  m.frustumCulled = false;
  m.userData.puff = true;
  return m;
});
const puffOrder = PUFF_MESHES.map(() => []),
  puffCuts = [],
  puffPS = new THREE.Matrix4();
function puffSync() {
  // the depth the renderer sorts by (the projected z of an object's origin), and where the other see-through things sat last frame
  camera.updateMatrixWorld();
  puffPS.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  puffCuts.length = 0;
  if (puffs.length) for (const it of renderer.renderLists.get(scene, 0).transparent) if (!it.object.userData.puff) puffCuts.push(it.z);
  puffCuts.sort((a, b) => a - b);
  for (const l of puffOrder) l.length = 0;
  for (const p of puffs) {
    if (!p.s.visible) continue;
    p.d = seeB.copy(p.s.position).applyMatrix4(puffPS).z;
    let lo = 0,
      hi = puffCuts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (puffCuts[mid] < p.d) lo = mid + 1;
      else hi = mid;
    }
    p.k = lo; // how many other see-through things lie in front of it
  }
  // one draw per group of puffs between two such things, nearest group first; past PUFF_DRAWS the farthest groups share the last draw
  let k = -1,
    last = -1;
  for (const p of puffs.filter(p => p.s.visible).sort((a, b) => a.k - b.k || b.d - a.d)) {
    if (p.k !== last && k < PUFF_DRAWS - 1) k++;
    last = p.k;
    puffOrder[k].push(p);
  }
  for (let k = 0; k < PUFF_DRAWS; k++) {
    const list = puffOrder[k].sort((a, b) => b.d - a.d),
      m = PUFF_MESHES[k],
      g = m.geometry,
      n = Math.min(list.length, PUFF_CAP),
      ap = g.attributes.aPos.array,
      as = g.attributes.aSro.array;
    m.visible = n > 0;
    if (!n) continue;
    m.position.set(0, 0, 0);
    for (let i = 0; i < n; i++) m.position.add(list[i].s.position);
    m.position.divideScalar(n); // the draw sorts by its puffs' middle, which lies between the same two things they do
    for (let i = 0; i < n; i++) {
      const s = list[i].s;
      ap[i * 3] = s.position.x - m.position.x;
      ap[i * 3 + 1] = s.position.y - m.position.y;
      ap[i * 3 + 2] = s.position.z - m.position.z;
      as[i * 3] = s.scale.x;
      as[i * 3 + 1] = s.material.rotation;
      as[i * 3 + 2] = s.material.opacity;
    }
    g.instanceCount = n;
    g.attributes.aPos.needsUpdate = g.attributes.aSro.needsUpdate = true;
  }
}
// a puff of smoke; past PUFF_MAX (PUFF_LOW on a slow machine) the oldest puff still at full life fades out quickly (its life
// runs six times as fast)
function smokePuff(pos, size, life, rise) {
  let live = 0;
  for (const p of puffs) if (!p.fast) live++;
  if (live >= (resScale < RES_MIN ? PUFF_LOW : PUFF_MAX)) {
    const o = puffs.find(p => !p.fast);
    if (o) o.fast = true;
  }
  // a stand-in with a sprite's fields: PUFF_MESHES draw it
  const s = { position: pos.clone(), scale: new THREE.Vector3().setScalar(size * 0.6), material: { opacity: 0, rotation: 0 }, visible: true };
  puffs.push({ s, life, max: life, size, rise, rot: rand(-1, 1) });
}
function updPuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.life -= p.fast ? dt * 6 : dt;
    const k = 1 - p.life / p.max;
    p.s.position.y += p.rise * dt;
    p.s.scale.setScalar(p.size * (0.6 + k * 0.7));
    p.s.material.rotation += p.rot * dt;
    p.s.material.opacity = Math.min(1, k * 6) * Math.min(1, p.life / (p.max * 0.4)) * 0.92;
    if (p.life <= 0) puffs.splice(i, 1);
  }
}
