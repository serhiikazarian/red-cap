// Niches (floor two): pointed arches in the walls. Look straight at one from close by for a moment and the nearest talker
// appears in it as a violet hologram; hit the hologram and Red Cap is blessed (slowed, less than the Priest's blood).
const NICHE_LOOK = 2.5, // seconds of looking before the hologram shows
  NICHE_NEAR = 7,
  NICHE_T = { value: 0 }, // the holograms' clock (their scan lines roll)
  HOLO_GEO = share(new THREE.PlaneGeometry(1, 1));
let ARCH = null;

// the niche: a pointed arch cut into the wall, dark, with a violet glow rising from its foot (made once)
function archNiche() {
  if (ARCH) return ARCH;
  const w = 1.25,
    hr = 1.5,
    ht = 2.35,
    sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.lineTo(-w / 2, hr);
  sh.quadraticCurveTo(-w / 2, hr + w * 0.5, 0, ht);
  sh.quadraticCurveTo(w / 2, hr + w * 0.5, w / 2, hr);
  sh.lineTo(w / 2, 0);
  sh.lineTo(-w / 2, 0);
  const g = new THREE.ShapeGeometry(sh, 12),
    P = g.attributes.position,
    U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / w + 0.5, P.getY(i) / ht);
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = '#08040b';
  x.fillRect(0, 0, 128, 256);
  const gr = x.createRadialGradient(64, 236, 4, 64, 236, 170);
  gr.addColorStop(0, 'rgba(150,60,190,.75)');
  gr.addColorStop(0.45, 'rgba(70,20,90,.35)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(cv);
  ARCH = {
    g: share(g),
    m: share(new THREE.MeshBasicMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
  };
  return ARCH;
}
// the hologram's look: violet, scan lines and a bright band rolling up
function holoCompile(sh) {
  sh.uniforms.uNT = NICHE_T;
  sh.fragmentShader =
    'uniform float uNT;\n' +
    sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
  {
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = vec3(0.62, 0.42, 1.0) * (0.6 + 0.9 * lum) + vec3(0.3) * lum;
    float line = 0.55 + 0.45 * step(0.5, fract(vUv.y * 46.0 - uNT * 2.5));
    float band = 1.0 + 0.8 * smoothstep(0.96, 1.0, sin(vUv.y * 5.0 - uNT * 3.0));
    diffuseColor.a *= line * band;
  }`
    );
}
// additive, see-through, flickering
function holoMat(map) {
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor // it glows (adds light) and, like INK_HIDE, hides the ink lines behind it
  });
  mat.onBeforeCompile = holoCompile;
  return mat;
}
// the nearest talker's picture: the largest paper part of him
function talkerArt(e) {
  let best = null;
  e.root.traverse(o => {
    if (o.userData && o.userData.frame && o.userData.mat && o.userData.mat.map && (!best || o.userData.frame[1] > best.userData.frame[1])) best = o;
  });
  if (best) return { map: best.userData.mat.map, aspect: best.userData.frame[0] / best.userData.frame[1] };
  return e.type === 'G' && TEX.grin_fire ? { map: TEX.grin_fire, aspect: SHAPES.grin_fire.aspect } : null; // a Grin is a ball: its drawing
}
// the hologram of the talker nearest the niche
function holoShow(n) {
  let near = null,
    nd = Infinity;
  for (const e of G.enemies) {
    if (e.dead || e.dying || e.away) continue;
    const d = Math.hypot(e.pos.x - n.m.position.x, e.pos.z - n.m.position.z);
    if (d < nd) {
      nd = d;
      near = e;
    }
  }
  const art = near && talkerArt(near);
  if (!art) return;
  const mat = holoMat(art.map);
  const h = Math.min(1.5, 1.0 / art.aspect),
    m = new THREE.Mesh(HOLO_GEO, mat);
  m.scale.set(h * art.aspect, h, 1);
  m.rotation.y = n.m.rotation.y;
  G.group.add(m);
  n.holo = { m, a: 0, y: n.m.position.y + 1.15 };
}
function holoGone(n) {
  G.group.remove(n.holo.m);
  n.holo.m.material.dispose();
  n.holo = null;
}
// a niche looked at long enough shows its hologram; looking away, it fades; it flickers and jitters while it shows
function updNiches(dt) {
  if (!G.niches) return;
  const now = performance.now() / 1000,
    fx = -Math.sin(cam.yaw),
    fz = -Math.cos(cam.yaw);
  NICHE_T.value = now;
  for (const n of G.niches) {
    const p = n.m.position,
      dx = hero.pos.x - p.x,
      dz = hero.pos.z - p.z,
      d = Math.hypot(dx, dz) || 1,
      front = (dx * n.nx + dz * n.nz) / d, // 1: straight in front of it
      aim = (-dx * fx - dz * fz) / d; // 1: the camera looks right at it
    const looking = d < NICHE_NEAR && front > 0.8 && aim > 0.96 && los(hero.pos, tmpW.set(p.x + n.nx * 0.4, 0, p.z + n.nz * 0.4));
    n.look = looking ? n.look + dt : 0;
    if (looking && n.look >= NICHE_LOOK && !n.holo) holoShow(n);
    if (!n.holo) continue;
    const H = n.holo;
    H.a = looking ? Math.min(1, H.a + dt * 2) : H.a - dt / 1.5;
    if (H.a <= 0) {
      holoGone(n);
      continue;
    }
    H.m.material.opacity = H.a * (0.85 + 0.15 * Math.sin(now * 23) * Math.sin(now * 7.3) + (Math.random() < 0.06 ? -0.4 : 0));
    H.m.position.set(
      p.x + n.nx * 0.14 + (Math.random() < 0.08 ? (Math.random() - 0.5) * 0.08 : 0),
      H.y + Math.sin(now * 1.7) * 0.05,
      p.z + n.nz * 0.14
    );
  }
}
// a hologram struck: it bursts, and the blessing slows Red Cap (less than the Priest's)
function hitHolo(p, rad) {
  for (const n of G.niches || []) {
    if (!n.holo || n.holo.a < 0.3) continue;
    const q = n.holo.m.position;
    if (Math.hypot(q.x - p.x, q.z - p.z) < 0.55 + rad && Math.abs(q.y - p.y) < n.holo.m.scale.y / 2 + 0.3) {
      burst(q.clone(), [0xc9a0ff, 0x8a3cff, 0xece6da], 22, 4, 0.12);
      holoGone(n);
      n.look = 0;
      hero.blest = 3;
      floatWord('BLESSED', hero.pos.clone().setY(hero.pos.y + 2.6), '#d8212a', 0.9, true);
      sNoise({ dur: 0.3, f: 700, f2: 250, type: 'lowpass', gain: 0.2 });
      return true;
    }
  }
  return false;
}
