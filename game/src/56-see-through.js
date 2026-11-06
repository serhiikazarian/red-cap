// See-through: what stands between the camera and the fight fades. Pillars, props, totems, onlookers and the floating things
// over each floor are registered while the floor is built (seeThru). Each gets
// simple shapes: a standing column (x, z, r, y0..y1) for things on the ground, spheres that follow the moving ones. The camera keeps SEE_PAD
// off them, and one that stands across the line from the camera to Red Cap, the locked target or a boss in the fight fades to SEE_ALPHA, drawn
// without writing depth (what is behind keeps its ink). Baked things are baked per thing, so each fades alone; an instanced box is hidden
// and drawn by a stand-in while it fades. how: 'hard' (onlookers, easels) only keeps the camera off (never fades, baked with the rest);
// 'pillar' (floor one) and 'pyramid' (floor two) follow seeSolid's rules (a pillar with a bold contour while it hides Red Cap, a pyramid
// without); 'plain' (floor three's totems and chamber stacks, floor one's floaters) fades evenly without a contour; anything else (floors
// two and three's floaters) fades evenly with a bold contour. The contours come from the mask pass: pillars on layer 1 (SEE_MAT), floaters
// on layer 2 (SEE_DYN_MAT).
const SEE_ALPHA = 0.25,
  SEE_PAD = 0.3,
  // pillars and pyramids: one kind of thing ('solid'), one set of rules (seeSolid); what differs: their shapes, and whether the camera
  // right at one fades it (a 7 m pillar could fill the view; a pyramid stands below the camera and would only vanish as Red Cap passes)
  // line: a thick contour while it hides Red Cap; slow: its fades take this many times SOLID_T
  SOLID = { pillar: { lens: true, line: true, slow: 1 }, pyramid: { lens: false, line: false, slow: 1.5 } },
  SOLID_FOOT = [1.4, 3.0], // on a 7 m pillar: solid to this height above its foot, faded to SEE_ALPHA or SOLID_EVEN_A from this one (a shorter
  // thing in proportion to its height)
  SOLID_NEAR = 3, // metres: an enemy it hides fades it only while Red Cap is this near its side
  SOLID_LENS = 0.8, // metres: the camera this near it fades it too (no contour)
  SOLID_EVEN_A = 1 - (1 - SEE_ALPHA) * 0.63 * 0.82, // without a contour: a little less see-through
  SOLID_T = { in: 1, out: 1, hold: 0.6, swap: 0.6 }, // seconds: to fade, to come back, a reason kept after it ends, contour on <-> off
  // pillars: red where they stand (times their contour's strength, lvl), their distance from the camera in alpha (times red)
  SEE_MAT = share(
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { lvl: { value: 1 } },
      vertexShader: `#include <common>
        varying float vZ;
        void main() {
          #include <begin_vertex>
          #include <project_vertex>
          vZ = -mvPosition.z;
        }`,
      fragmentShader: `uniform float lvl; varying float vZ; void main(){ gl_FragColor = vec4(lvl, 0., 0., lvl * clamp(vZ / ${SEE_GZFAR.toFixed(1)}, 0., 1.)); }`
    })
  ),
  // floaters: green, and how far from the camera in blue (so the ink pass can tell when a wall stands in front of one)
  SEE_DYN_MAT = share(
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: `#include <common>
        varying float vZ;
        void main() {
          #include <begin_vertex>
          #include <project_vertex>
          vZ = -mvPosition.z;
        }`,
      fragmentShader: `varying float vZ; void main(){ gl_FragColor = vec4(0., 1., clamp(vZ / ${SEE_ZFAR.toFixed(1)}, 0., 1.), 0.); }`
    })
  ),
  // on: something with a contour is faded (gr: a pillar, dyn: a floater)
  SEE = { on: false, gr: false, dyn: false, tg: null },
  seeA = new THREE.Vector3(),
  seeB = new THREE.Vector3(),
  seeCol = new THREE.Color();
function seeThru(o, dyn, how) {
  G.see.push({
    o,
    dyn,
    hard: how === 'hard',
    solid: SOLID[how] ? how : null, // 'pillar' or 'pyramid': seeSolid
    line: how !== 'hard' && how !== 'plain' && (!SOLID[how] || SOLID[how].line), // has a contour while faded (a pillar: seeTick decides when)
    lvl: 1, // its contour's strength in the mask (a pillar's follows its look)
    g: 0, // a pillar or pyramid: 1 while hiding Red Cap (a pillar's contour), 0 otherwise, eased
    meshes: [],
    items: [],
    a: 1,
    on: false,
    w: []
  });
  o.userData.seeId = G.see.length;
  return o;
}
// after instanceProps, before baking: what each thing is drawn with, and its shapes
function seePrep() {
  // floor one's floaters (glasses, golden spirals, boxes) fade without a contour
  for (const d of G.deco) if (!d.m.userData.seeId) seeThru(d.m, true, G.F.deco === 'corridor' ? 'plain' : undefined);
  G.group.updateMatrixWorld(true);
  for (const c of G.see) {
    if (c.solid === 'pyramid') {
      seePyrShape(c);
      continue;
    }
    c.items = c.o.userData.boxes || [];
    const inst = G.deco.find(d => d.m === c.o && d.inst);
    if (inst) {
      c.items = [inst.inst];
      c.inst = true;
    }
    if (!c.dyn) seeColumn(c);
    else seeSpheres(c);
  }
}
// a pyramid: its own shape (pyrParts) in its own space, for the camera's keep-off and every reason to fade; x, z, r: the circle
// round its foot
function seePyrShape(c) {
  const M = c.o.matrixWorld,
    e = M.elements;
  c.items = [];
  c.w = [
    {
      pyr: true,
      parts: PYR.parts,
      inv: new THREE.Matrix4().copy(M).invert(),
      x: e[12],
      z: e[14],
      y0: e[13],
      y1: e[13] + PYR_H,
      r: PYR.parts[0].b0 * Math.SQRT2
    }
  ];
}
// a still thing: one upright column round its boxes (or the whole object); nothing there: off
function seeColumn(c) {
  const box = new THREE.Box3(),
    v = new THREE.Vector3();
  if (c.items.length)
    for (const it of c.items) {
      it.owner.updateMatrix();
      tmpM.multiplyMatrices(it.owner.matrix, it.local);
      for (let k = 0; k < 8; k++) box.expandByPoint(v.set(k & 1 ? 0.5 : -0.5, k & 2 ? 0.5 : -0.5, k & 4 ? 0.5 : -0.5).applyMatrix4(tmpM));
    }
  else box.setFromObject(c.o);
  if (box.isEmpty()) {
    c.off = true;
    return;
  }
  c.w = [
    {
      cap: true,
      x: (box.min.x + box.max.x) / 2,
      z: (box.min.z + box.max.z) / 2,
      r: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
      y0: box.min.y,
      y1: box.max.y
    }
  ];
  // an onlooker steps aside and back: its column goes with it (it never fades, so it has to be where it really stands)
  if (c.hard && !isStill(c.o)) c.at = [c.w[0].x - c.o.position.x, c.w[0].z - c.o.position.z, box.min.y - c.o.position.y, box.max.y - c.o.position.y];
}
// moving: spheres in the thing's own space, one per part (a part bigger than 3 m across is left to the others, if there are others)
function seeSpheres(c) {
  const M = c.o.parent ? c.o.matrixWorld : (c.o.updateMatrix(), c.o.matrix),
    inv = new THREE.Matrix4().copy(M).invert(),
    list = [];
  const add = (g, mw) => {
    if (!g.boundingSphere) g.computeBoundingSphere();
    const sp = g.boundingSphere.clone().applyMatrix4(mw).applyMatrix4(inv);
    list.push(sp);
  };
  if (c.inst) {
    c.w = [{ box: true, m: new THREE.Matrix4(), inv: new THREE.Matrix4(), sc: new THREE.Vector3() }];
    return;
  }
  if (c.o.userData.seeSph) list.push(...c.o.userData.seeSph.map(sp => sp.clone()));
  else c.o.traverse(m => m.isMesh && add(m.geometry, m.matrixWorld));
  const sc = M.getMaxScaleOnAxis(),
    small = list.filter(sp => sp.radius * sc <= 3);
  c.sph = small.length ? small : list;
  c.w = c.sph.map(() => ({ c: new THREE.Vector3(), r: 0 }));
}

// how far p stands from the thing's foot, across the ground: a pillar's round foot, a pyramid's square one
function seeSide(s, p) {
  if (!s.pyr) return Math.hypot(p.x - s.x, p.z - s.z) - s.r;
  const q = s.parts[0],
    l = seeA.copy(p).applyMatrix4(s.inv),
    u = Math.abs(l.x * q.cs + l.z * q.sn) - q.b0,
    v = Math.abs(l.z * q.cs - l.x * q.sn) - q.b0;
  return Math.hypot(Math.max(u, 0), Math.max(v, 0));
}
// after baking: the meshes each thing is drawn with now
function seeMeshes() {
  for (const c of G.see)
    if (!c.hard)
      c.o.traverse(m => {
        if (m.isMesh && !isStill(m) && !c.meshes.includes(m)) c.meshes.push(m);
      });
}
function seeShapes() {
  if (!G || !G.see.length) return;
  for (const c of G.see) {
    if (c.off) continue;
    if (!c.baked && !c.inst && !c.o.parent) {
      c.gone = true; // torn down (a spent cover block)
      continue;
    }
    if (c.at) {
      const s = c.w[0],
        p = c.o.position;
      s.x = p.x + c.at[0];
      s.z = p.z + c.at[1];
      s.y0 = p.y + c.at[2];
      s.y1 = p.y + c.at[3];
    }
    c.near = c.dyn || heroDist(c.w[0].x, c.w[0].z) < cam.dist + c.w[0].r + 4;
    if (!c.dyn) continue;
    if (c.inst) {
      const s = c.w[0],
        it = c.items[0];
      it.owner.updateMatrix();
      s.m.multiplyMatrices(it.owner.matrix, it.local);
      s.inv.copy(s.m).invert();
      s.sc.setFromMatrixScale(s.m);
      continue;
    }
    const M = c.o.parent ? c.o.matrixWorld : (c.o.updateMatrix(), c.o.matrix),
      sc = M.getMaxScaleOnAxis();
    c.sph.forEach((sp, k) => {
      c.w[k].c.copy(sp.center).applyMatrix4(M);
      c.w[k].r = sp.radius * sc;
    });
  }
}
function seeIn(p, s, pad) {
  if (s.box) {
    const q = seeA.copy(p).applyMatrix4(s.inv);
    return Math.abs(q.x) < 0.5 + pad / s.sc.x && Math.abs(q.y) < 0.5 + pad / s.sc.y && Math.abs(q.z) < 0.5 + pad / s.sc.z;
  }
  if (s.pyr) {
    const q = seeA.copy(p).applyMatrix4(s.inv);
    return pyrOut(s.parts[0], q.x, q.y, q.z) < pad || pyrOut(s.parts[1], q.x, q.y, q.z) < pad;
  }
  return s.cap
    ? p.y > s.y0 - pad && p.y < s.y1 + pad && Math.hypot(p.x - s.x, p.z - s.z) < s.r + pad
    : p.distanceToSquared(s.c) < (s.r + pad) * (s.r + pad);
}
function seeInside(p, pad) {
  for (const c of G.see) {
    if (c.off || c.gone || !c.near) continue;
    for (const s of c.w) if (seeIn(p, s, pad)) return true;
  }
  return false;
}
const seeRay = new THREE.Ray(),
  seeUnit = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
// does the line from a to b pass through the shape (leaving out its last 0.4 m, at the thing looked at)?
function seeCross(a, b, s) {
  const L = a.distanceTo(b);
  if (L < 0.5) return false;
  const tMax = 1 - 0.4 / L;
  if (s.box) {
    seeRay.origin.copy(a).applyMatrix4(s.inv);
    seeB.copy(b).applyMatrix4(s.inv);
    seeRay.direction.copy(seeB).sub(seeRay.origin);
    const l = seeRay.direction.length();
    seeRay.direction.divideScalar(l);
    return seeRay.intersectBox(seeUnit, seeA) !== null && seeA.distanceTo(seeRay.origin) < l * tMax;
  }
  if (s.pyr) {
    seeA.copy(a).applyMatrix4(s.inv);
    seeB.copy(b).applyMatrix4(s.inv);
    return pyrCross(seeA, seeB, s.parts[0], tMax) || pyrCross(seeA, seeB, s.parts[1], tMax);
  }
  if (s.cap) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      l2 = dx * dx + dz * dz,
      t = clamp(l2 > 1e-6 ? ((s.x - a.x) * dx + (s.z - a.z) * dz) / l2 : 0, 0, tMax),
      y = a.y + (b.y - a.y) * t;
    return y > s.y0 && y < s.y1 && Math.hypot(a.x + dx * t - s.x, a.z + dz * t - s.z) < s.r;
  }
  const t = clamp(seeA.copy(s.c).sub(a).dot(seeB.copy(b).sub(a)) / (L * L), 0, tMax);
  return seeB.multiplyScalar(t).add(a).distanceTo(s.c) < s.r * 0.85;
}
function seeMat(orig) {
  const m = orig.clone();
  m.transparent = true;
  m.depthWrite = false;
  if (m.alphaTest) m.alphaTest = Math.round(orig.alphaTest * SEE_ALPHA * 100) / 100; // a fixed value: a new one would build a new shader
  // solid at its foot, fading upwards: alpha falls from 1 at seeY0 to seeA at seeY1 (world heights)
  const u = (m.userData.seeU = { seeA: { value: 1 }, seeY0: { value: 0 }, seeY1: { value: 1 } });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader =
      'varying float vSeeY;\n' +
      sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vSeeY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader =
      'varying float vSeeY; uniform float seeA, seeY0, seeY1;\n' +
      sh.fragmentShader.replace(
        '#include <alphatest_fragment>',
        'diffuseColor.a *= mix(1.0, seeA, smoothstep(seeY0, seeY1, vSeeY));\n#include <alphatest_fragment>'
      );
  };
  m.customProgramCacheKey = () => 'see';
  return m;
}
const seeLayer = c => (c.dyn ? 2 : 1);
// what a thing is drawn with while faded (its meshes, and its instanced boxes' stand-ins)
const seeDrawn = c => [...c.meshes, ...c.items.map(it => it.see).filter(Boolean)];
// a thing's contour strength into the mask, just before the mask pass draws it
const seeLevel = c => (r, sc, cm, g, mat) => {
  if (mat !== SEE_MAT) return;
  mat.uniforms.lvl.value = c.lvl;
  mat.uniformsNeedUpdate = true;
};
function seeOn(c, on) {
  c.on = on;
  c.ln = on && c.line && !c.solid; // drawn into the mask: has a contour now (a pillar: seeTick decides)
  c.obr = c.obr || seeLevel(c);
  for (const m of c.meshes) {
    if (on) {
      const o = m.material;
      m.userData.seeOrig = o;
      if (!m.userData.seeMat) {
        m.userData.seeMat = Array.isArray(o) ? o.map(seeMat) : seeMat(o);
        for (const x of c.solid ? [].concat(m.userData.seeMat) : []) {
          x.side = THREE.FrontSide; // faded, its inside would show through
          if (c.solid === 'pyramid') x.depthWrite = true; // its ink lines and cover stay as it fades in (what is behind is drawn before it)
        }
      }
      m.material = m.userData.seeMat;
      m.onBeforeRender = c.obr;
      if (c.ln) m.layers.enable(seeLayer(c));
    } else {
      m.material = m.userData.seeOrig;
      if (c.line) m.layers.disable(seeLayer(c));
    }
  }
  for (const it of c.items) {
    if (on && !it.shed && !it.see) {
      it.see = new THREE.Mesh(it.im.geometry, (it.seeMat = it.seeMat || seeMat(it.im.material)));
      it.see.matrixAutoUpdate = false;
      it.see.onBeforeRender = c.obr;
      if (c.ln) it.see.layers.enable(seeLayer(c));
      G.group.add(it.see);
      it.im.setMatrixAt(it.idx, ZERO_M);
      it.im.instanceMatrix.needsUpdate = true;
    } else if (!on && it.see) {
      G.group.remove(it.see);
      it.see = null;
      if (!it.shed && !c.gone) syncBoxes([it]);
    }
  }
}
// Pillars and pyramids: solid by default; faded (keeping a solid foot, SOLID_FOOT) to
// SEE_ALPHA while it stands between the camera and Red Cap (a pillar with a contour, which never lies on anyone in front of it: SOLID_GAP), to
// SOLID_EVEN_A without a contour while it hides an enemy in the fight near him or (a pillar) stands right at the camera. "In the way" and
// "right at the camera" use the thing's own shape (a pillar's column, a pyramid's two frustums: seeCross, seeIn). A reason is kept
// SOLID_T.hold after it ends and every change is eased, so nothing flickers. Sets c.g (hiding Red Cap 1, else 0, eased) and returns the
// alpha it fades to.
const solidE = new THREE.Vector3();
function seeSolid(c, dt, cp, fo) {
  const s = c.w[0],
    here = !c.gone && c.near,
    front = here && (seeCross(cp, fo[0], s) || seeCross(cp, fo[1], s)),
    lens = here && !front && SOLID[c.solid].lens && seeIn(cp, s, SOLID_LENS),
    foe =
      here &&
      !front &&
      !lens &&
      seeSide(s, hero.pos) < SOLID_NEAR &&
      G.enemies.some(
        e =>
          !e.dead &&
          !e.dying &&
          !e.hidden &&
          !e.dormant &&
          !e.waiting &&
          e.pos.distanceTo(hero.pos) < 24 &&
          (seeCross(cp, solidE.set(e.pos.x, hitHeight(e), e.pos.z), s) ||
            (e.fly != null && seeCross(cp, solidE.set(e.pos.x, hitHeight(e) - 0.55, e.pos.z), s))) // a flyer: its lower part too
      );
  c.hf = front || lens || foe ? SOLID_T.hold : Math.max(0, (c.hf || 0) - dt); // faded
  c.hg = front ? SOLID_T.hold : Math.max(0, (c.hg || 0) - dt); // hiding Red Cap
  c.g = clamp(c.g + (c.hg > 0 ? dt : -dt) / SOLID_T.swap, 0, 1);
  return c.hg > 0 ? SEE_ALPHA : c.hf > 0 ? SOLID_EVEN_A : 1;
}
function seeTick(dt) {
  SEE.on = SEE.gr = SEE.dyn = false;
  if (!G || !G.see.length) return;
  const fo = seeFocus(),
    cp = camera.position;
  for (const c of G.see) {
    if (c.off || c.hard) continue;
    const want = seeWant(c, dt, cp, fo);
    // in over ~0.15 s, back over ~0.3 s; a pillar or pyramid over SOLID_T
    c.a =
      want < c.a
        ? Math.max(want, c.a - dt * (c.solid ? (1 - SEE_ALPHA) / (SOLID_T.in * SOLID[c.solid].slow) : 5))
        : Math.min(want, c.a + dt * (c.solid ? (1 - SEE_ALPHA) / (SOLID_T.out * SOLID[c.solid].slow) : 2.5));
    if (c.a < 0.999 && !c.on) seeOn(c, true);
    else if (c.a >= 0.999 && c.on) seeOn(c, false);
    if (!c.on) continue;
    if (c.solid && c.line) seeLine(c);
    if (c.ln) {
      SEE.on = true;
      if (c.dyn) SEE.dyn = true;
      else SEE.gr = true;
    }
    seeApply(c);
  }
}
// what the camera must see: Red Cap (chest and head), the locked target, any boss in the fight
function seeFocus() {
  const fo = [seeA.set(hero.pos.x, hero.pos.y + 0.9, hero.pos.z).clone(), seeA.set(hero.pos.x, hero.pos.y + 1.6, hero.pos.z).clone()];
  if (SEE.tg && !SEE.tg.dead) fo.push(new THREE.Vector3(SEE.tg.pos.x, hitHeight(SEE.tg), SEE.tg.pos.z));
  for (const e of G.enemies)
    if (e.boss && e !== SEE.tg && !e.dead && !e.dying && !e.hidden && !e.dormant && !e.waiting && e.pos.distanceTo(hero.pos) < 24)
      fo.push(new THREE.Vector3(e.pos.x, hitHeight(e), e.pos.z));
  return fo;
}
// how see-through a thing should be now: a pillar or pyramid by its own rules (seeSolid); anything else when it is right in front
// of the lens or between the camera and something it must see
function seeWant(c, dt, cp, fo) {
  let want = 1;
  if (c.solid) want = seeSolid(c, dt, cp, fo);
  else if (!c.gone && c.near)
    for (const s of c.w) {
      // right in front of the lens (or brushing it), it would fill the screen
      if (seeIn(cp, s, 0.8)) want = SEE_ALPHA;
      else for (const f of fo) if (seeCross(cp, f, s)) want = SEE_ALPHA;
      if (want < 1) break;
    }
  return want;
}
// a pillar's contour: only while it hides Red Cap, as strong as it has faded; in the mask only while there is one
function seeLine(c) {
  c.lvl = (c.g * (1 - c.a)) / (1 - SEE_ALPHA);
  const ln = c.lvl > 0.01;
  if (ln !== c.ln)
    for (const o of seeDrawn(c)) {
      if (ln) o.layers.enable(1);
      else o.layers.disable(1);
    }
  c.ln = ln;
}
// the fade on every material and instanced part of a thing
function seeApply(c) {
  const tall = c.solid ? Math.min(1, (c.w[0].y1 - c.w[0].y0) / 7) : 1; // a pillar or pyramid's height against a 7 m pillar (SOLID_FOOT)
  let foot = 1e9; // the thing's lowest point
  for (const s of c.w) foot = Math.min(foot, s.box ? s.m.elements[13] - 0.5 * s.sc.y : s.cap || s.pyr ? s.y0 : s.c.y - s.r);
  const fade = mm => {
    const u = mm.userData.seeU;
    u.seeA.value = c.a;
    // a pillar or pyramid keeps a solid foot; anything else fades evenly (the gradient sits below it)
    u.seeY0.value = foot + (c.solid ? SOLID_FOOT[0] * tall : -2);
    u.seeY1.value = foot + (c.solid ? SOLID_FOOT[1] * tall : -1);
  };
  for (const m of c.meshes)
    for (const mm of Array.isArray(m.material) ? m.material : [m.material]) {
      const o = mm === m.material ? m.userData.seeOrig : m.userData.seeOrig[m.material.indexOf(mm)];
      mm.opacity = o.opacity;
      fade(mm);
      mm.visible = o.visible;
      if (o.color) mm.color.copy(o.color);
      if (o.emissive) mm.emissive.copy(o.emissive);
    }
  for (const it of c.items)
    if (it.see) {
      it.owner.updateMatrix();
      it.see.matrix.multiplyMatrices(it.owner.matrix, it.local);
      it.see.matrixWorldNeedsUpdate = true; // its parent (G.group) is frozen, so nothing else would carry the new place into its world matrix
      fade(it.seeMat);
      if (it.im.instanceColor) it.im.getColorAt(it.idx, seeCol);
      else seeCol.set(1, 1, 1);
      it.seeMat.color.copy(it.im.material.color).multiply(seeCol);
    }
}
// the screen box (uv) the faded things' mask can reach, widened by the contour samples' reach; the ink pass looks only inside it
const seeBB = new THREE.Box3(),
  seeP = new THREE.Vector3();
function seeBounds(out) {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  const add = (geo, mw) => {
    if (!geo.boundingBox) geo.computeBoundingBox();
    seeBB.copy(geo.boundingBox).applyMatrix4(mw);
    for (let k = 0; k < 8; k++) {
      seeP.set(k & 1 ? seeBB.max.x : seeBB.min.x, k & 2 ? seeBB.max.y : seeBB.min.y, k & 4 ? seeBB.max.z : seeBB.min.z);
      seeP.applyMatrix4(camera.matrixWorldInverse);
      if (seeP.z > -camera.near) return false; // reaches behind the lens: it may cover any part of the screen
      seeP.applyMatrix4(camera.projectionMatrix);
      x0 = Math.min(x0, seeP.x);
      x1 = Math.max(x1, seeP.x);
      y0 = Math.min(y0, seeP.y);
      y1 = Math.max(y1, seeP.y);
    }
    return true;
  };
  for (const c of G.see) {
    if (!c.on || !c.ln) continue;
    for (const m of c.meshes) if (m.isInstancedMesh || !add(m.geometry, m.matrixWorld)) return out.set(-1, -1, 2, 2);
    for (const it of c.items) if (it.see && !add(it.see.geometry, it.see.matrixWorld)) return out.set(-1, -1, 2, 2);
  }
  const sp = inkPass.uniforms.spx.value; // one mask pixel; the samples reach 2.8 of them, bilinear filtering one more
  return out.set(x0 * 0.5 + 0.5 - 5 * sp.x, y0 * 0.5 + 0.5 - 5 * sp.y, x1 * 0.5 + 0.5 + 5 * sp.x, y1 * 0.5 + 0.5 + 5 * sp.y);
}
// the mask: only the see-through things, white on black, at half size
function seeMask() {
  seeBounds(inkPass.uniforms.seeBox.value);
  const bg = scene.background,
    cc = renderer.getClearColor(seeCol).getHex(),
    ca = renderer.getClearAlpha();
  const ac = renderer.autoClear;
  scene.background = null;
  scene.overrideMaterial = SEE_MAT;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(seeTarget);
  renderer.clear();
  renderer.autoClear = false;
  if (SEE.gr) {
    camera.layers.set(1);
    renderer.render(scene, camera); // pillars in red (their contour's strength), their distance in alpha
  }
  if (SEE.dyn) {
    camera.layers.set(2);
    scene.overrideMaterial = SEE_DYN_MAT; // floaters in green, on top (their whole outline is drawn), their distance in blue
    renderer.render(scene, camera);
  }
  renderer.autoClear = ac;
  camera.layers.set(0);
  scene.overrideMaterial = null;
  scene.background = bg;
  renderer.setClearColor(cc, ca);
}
// behind the floor card: draw every see-through thing faded once, so their shaders are built before play
function seeWarm() {
  if (!G || !G.see.length) return;
  const was = G.see.filter(c => !c.off && !c.hard && !c.on);
  for (const c of was) seeOn(c, true);
  renderer.compile(scene, camera);
  for (const c of was) if (c.solid && c.line) for (const o of seeDrawn(c)) o.layers.enable(1); // so the pillars' pass builds its shader
  SEE.on = SEE.gr = SEE.dyn = true;
  seeMask();
  SEE.on = SEE.gr = SEE.dyn = false;
  for (const c of was) seeOn(c, false);
}
