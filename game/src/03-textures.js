// Textures and paper figures: every painting in assets/img (ASSETS) becomes TEX[name]; a figure is its painting cut out along its
// outline (assets/shapes.json, SHAPES) and extruded into a thin card. Also the texts drawn into the world (wordTex) and canvas textures.
const TEX = {};
// every asset becomes a texture except the title's slides (plain page images); wall paintings (t_*) mirror-repeat
function loadTextures() {
  const L = new THREE.TextureLoader(),
    aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return Promise.all(
    Object.entries(ASSETS)
      .filter(([k]) => !k.startsWith('slide_'))
      .map(
        ([k, src]) =>
          new Promise((res, rej) =>
            L.load(
              src,
              t => {
                t.anisotropy = aniso;
                if (k.startsWith('t_')) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
                TEX[k] = t;
                res();
              },
              undefined,
              rej
            )
          )
      )
  );
}
// Lifetimes: clearLevel frees everything in the floor's group except what is SHARED (made once, used by every floor); OWN marks
// textures that belong to the floor and are freed with it. still() marks a mesh that never moves, so bakeStatics may merge it.
const SHARED = new WeakSet(),
  OWN = new WeakSet(),
  share = o => (SHARED.add(o), o),
  own = t => (OWN.add(t), t),
  still = o => ((o.userData.static = true), o);
function texRepeat(name, rx, ry) {
  const t = TEX[name].clone();
  OWN.add(t);
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return t;
}
// takes a thing out of the world for good while the floor goes on: frees its own geometry and this floor's textures
// (materials are left to the garbage collector, so no shader in use is thrown away)
function discard(o) {
  if (!o) return;
  if (o.parent) o.parent.remove(o);
  o.traverse(c => {
    if (c.geometry && !c.isSprite && !SHARED.has(c.geometry)) c.geometry.dispose();
    for (const m of Array.isArray(c.material) ? c.material : c.material ? [c.material] : []) if (m.map && OWN.has(m.map)) m.map.dispose();
  });
}
const SIDE_MAT = share(new THREE.MeshBasicMaterial({ color: 0x1a1512 }));
const HIDE_MAT = share(new THREE.MeshBasicMaterial({ visible: false }));
// a figure drawn this way clears the picture's alpha under itself: the ink pass reads that as "no ink here"
const markInk = m => Object.assign(m, INK_HIDE);
// the painting's alpha cut at one half, softened over exactly one screen pixel at any distance
function featherEdge(mat) {
  mat.extensions = { derivatives: true };
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `vec4 texelColor = texture2D( map, vUv ); texelColor = mapTexelToLinear( texelColor );
    float fwA = max( fwidth( texelColor.a ), 1e-3 ); diffuseColor.rgb *= texelColor.rgb; diffuseColor.a *= smoothstep( .5 - fwA * .75, .5 + fwA * .75, texelColor.a );`
    );
  };
  mat.customProgramCacheKey = () => 'feather';
}
// Red Cap's look: a flat card with a soft-edged ink outline drawn by its own plane just behind it (opacity in inks)
function inkCard(m, inks) {
  const mat = m.userData.mat,
    g = m.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  mat.alphaTest = 0.04;
  mat.transparent = true;
  markInk(mat);
  featherEdge(mat);
  m.material = [mat, HIDE_MAT]; // no extruded sides to show as a dark band from above
  const [w, h] = m.userData.frame,
    d = bb.max.z - bb.min.z,
    t = 0.024,
    pw = w + t * 3,
    ph = h + t * 3;
  const ink = markInk(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      extensions: { derivatives: true },
      uniforms: {
        map: { value: mat.map },
        rad: { value: new THREE.Vector2(t / w, t / h) },
        pad: { value: new THREE.Vector2(pw / w, ph / h) },
        opacity: { value: 1 },
        ink: { value: new THREE.Color(COL.ink) }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform sampler2D map; uniform vec2 rad, pad; uniform float opacity; uniform vec3 ink; varying vec2 vUv;
      float A(vec2 u){ return (u.x < 0. || u.x > 1. || u.y < 0. || u.y > 1.) ? 0. : texture2D(map, u).a; }
      void main(){
        vec2 u = (vUv - .5) * pad + .5; float a = A(u);
        for (int i = 0; i < 12; i++) { float r = float(i) * .5235988; vec2 dir = vec2(cos(r), sin(r)); a = max(a, max(A(u + dir * rad), A(u + dir * rad * .5))); }
        float w = max(fwidth(a), 1e-3), k = smoothstep(.5 - w * .75, .5 + w * .75, a);
        if (k < .01) discard;
        gl_FragColor = vec4(ink, k * opacity);
      }`
    })
  );
  const pg = new THREE.PlaneGeometry(pw, ph);
  pg.translate(0, h / 2, d / 2 - 0.002 + 0.001); // a hair behind the painted face: any deeper and it slides off the figure at an angle
  const o = new THREE.Mesh(pg, ink);
  o.position.z = -0.001;
  m.add(o);
  inks.push(ink.uniforms.opacity);
}
// a painting's outline extruded to a card h tall; cached by size unless once (a one-off size, freed with the floor)
const geoCache = {};
function paperGeo(name, h, depth, once) {
  const key = name + '|' + h + '|' + depth;
  if (!once && geoCache[key]) return geoCache[key];
  const s = SHAPES[name];
  const shape = new THREE.Shape(s.pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.translate(-0.5, 0, -depth / 2);
  g.scale(s.aspect * h, h, 1);
  if (once) return g;
  SHARED.add(g);
  return (geoCache[key] = g);
}
// a paper figure: its painting on the faces, dark sides; unlit (lit: Lambert) so it reads clearly against the painted walls
function paper(name, h, depth = 0.08, lit = false, once = false) {
  const mat = lit
    ? new THREE.MeshLambertMaterial({ map: TEX[name], alphaTest: 0.5 })
    : new THREE.MeshBasicMaterial({ map: TEX[name], alphaTest: 0.5 });
  const m = new THREE.Mesh(paperGeo(name, h, depth, once), [mat, SIDE_MAT]);
  m.userData.mat = mat;
  m.userData.frame = [SHAPES[name].aspect * h, h];
  return m;
}
function sizeOf(name, h) {
  return { w: SHAPES[name].aspect * h, h };
}
// Words drawn into the world. Counts ("+1 TIE") and words about Red Cap use the marker font, everything else Rock Salt.
// Each word's texture is made once; the words a floor will need are drawn during its loading screen (warmUp), so play never waits.
const canvasTexCache = {};
const WORLD_FONT = '"Rock Salt", "Permanent Marker", Impact, sans-serif',
  MARKER_FONT = '"Permanent Marker", Impact, sans-serif',
  HERO_WORDS = new Set(['HOT', 'BURNT', 'ALL BETTER', 'BIG HEART', 'BLESSED', 'SNAGGED', 'TORN', 'EMPTY', 'BUSTED', 'How did I get here?']);
// the words each floor has shown this session (drawn again when the floor is built next)
const WORDS_USED = [new Map(), new Map(), new Map()],
  WORDS_SEED = [
    'SH#T!',
    'F#CK!',
    'SHUT IT',
    'STFU',
    'F#CK OFF',
    'THWIP',
    'TORN',
    'EMPTY',
    '+1 TIE',
    '+1 PEBBLES',
    '+2 PEBBLES',
    '+3 PEBBLES',
    'BIG HEART'
  ].map(w => [w, /^(THWIP|TORN)$/.test(w) ? HEX.paper : w === 'EMPTY' ? HEX.smoke : /^\+|BIG/.test(w) ? HEX.bile : HEX.tie]),
  // each floor's words, as word|colour with _ for a space
  WORDS_FLOOR = [
    `How_did_I_get_here?|${HEX.paper} POPPED|${HEX.paper} YOUNG_MAN|${HEX.paper} WINDED|${HEX.bile} BONK|${HEX.paper} HMMPH|${HEX.paper} MISSED|${HEX.paper} LOOK_AT_ME|#b48cff *WHEEZE*|${HEX.bile} boo|#d8d4cc BOO!|#d8d4cc !!|${HEX.tie} USHERS!|${HEX.tie} GULP|${HEX.paper} TELLIN’|#d8d4cc PSST|#d8d4cc`,
    `POPPED|${HEX.paper} BUSTED|${HEX.paper} ENOUGH|${HEX.tie} AGE_OF_CAPRICORN|${HEX.tie} PAIN!|${HEX.tie} SCORCHED_EARTH|${HEX.tie} SHAME!|${HEX.tie} THE_END_IS_NIGH!|${HEX.tie} FORBIDDEN_KNOWLEDGE!|${HEX.tie} PREY|${HEX.tie} LET_ME_OUT|${HEX.tie} BLESSED|${HEX.tie} HAAA|${HEX.bile} HUH?|${HEX.paper} BOO|${HEX.paper} KNEEL|${HEX.paper} SHIELDED|#d8d4cc RISE|#d8d4cc HOT|${HEX.hot} BURNT|${HEX.hot} EEK!|${HEX.bile} AAAH!|${HEX.bile} MADONE!|${HEX.hot} STUPID|${HEX.hot} STUPID!|${HEX.hot} MORON|${HEX.hot} TOOL|${HEX.hot} YOU_FOOL|${HEX.hot}`,
    `${spacedWord('NOT\nFUNNY')}|${HEX.tie} SILENCE|${HEX.tie} WELCOME|${HEX.paper} CATCH|${HEX.paper} CRACK|${HEX.paper} PSST|${HEX.paper} HA|${HEX.paper} HA!|${HEX.paper} HA_HA|${HEX.paper} HUSH|${HEX.paper} TOO_THICK|${HEX.paper} TINK|${HEX.paper} BOUNCE|${HEX.paper} NOPE|${HEX.paper} MISS_ME?|${HEX.paper} I'LL_TAKE_A_BREAK|${HEX.paper} STOP_TALKIN’|${HEX.bile} RING_ME|${HEX.bile} QUIET|${HEX.bile} HUSH|${HEX.bile} HA_HA_HA|${HEX.bile} HEE|${HEX.bile} WHEE|${HEX.bile} ?|${HEX.bile} @|${HEX.bile} GRRR|${HEX.tie} GRR|${HEX.ink} SHUT_UP|${HEX.ink} STOP|${HEX.ink} BLAH|${HEX.ink} \u2026|${HEX.ink} *COUGH*|${HEX.smoke} *HACK*|${HEX.smoke}`
  ].map(l => l.split(' ').map(p => p.replace(/_/g, ' ').split('|')));
// a word with a thin space between its letters, a little airier (the Jester's NOT FUNNY: on one line the T ran into the F)
function spacedWord(w) {
  return w
    .split('\n')
    .map(l => [...l].join('\u2009'))
    .join('\n');
}
// a word on a 512 x 176 canvas, inked round, on two lines if long (or where it has a \n), shrunk until it fits
function wordTex(text, color = HEX.tie, stroke = HEX.ink) {
  if (G && WORDS_USED[floorIdx]) WORDS_USED[floorIdx].set(text + '|' + color, [text, color]);
  const face = /^[+-]\d/.test(text) || HERO_WORDS.has(text) ? MARKER_FONT : WORLD_FONT;
  const key = text + color;
  if (canvasTexCache[key]) return canvasTexCache[key];
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 176;
  const x = c.getContext('2d');
  const sp = text.indexOf(' ', Math.floor(text.length / 2) - 3),
    lines = text.includes('\n') ? text.split('\n') : text.length > 13 && sp > 0 ? [text.slice(0, sp), text.slice(sp + 1)] : [text]; // \n: its own break
  const lw = lines.length > 1 ? 13 : 18,
    pad = lw / 2 + 6,
    ink = l => {
      const m = x.measureText(l);
      return {
        l: m.actualBoundingBoxLeft,
        w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        a: m.actualBoundingBoxAscent,
        d: m.actualBoundingBoxDescent
      };
    },
    tall = (box, gap) => box.reduce((h, b) => h + b.a + b.d, 0) + gap * (lines.length - 1);
  let fs = lines.length > 1 ? 70 : 100,
    box;
  for (;;) {
    x.font = fs + 'px ' + face;
    box = lines.map(ink);
    if ((Math.max(...box.map(b => b.w)) <= c.width - 2 * pad && tall(box, fs * 0.08) <= c.height - 2 * pad) || fs <= 30) break;
    fs -= 4;
  }
  x.textAlign = 'left';
  x.textBaseline = 'alphabetic';
  x.lineWidth = lw;
  x.strokeStyle = stroke;
  x.lineJoin = 'round';
  x.fillStyle = color;
  let y = (c.height - tall(box, fs * 0.08)) / 2;
  lines.forEach((l, i) => {
    const b = box[i],
      lx = (c.width - b.w) / 2 + b.l;
    y += b.a;
    x.strokeText(l, lx, y);
    x.fillText(l, lx, y);
    y += b.d + fs * 0.08;
  });
  const t = new THREE.CanvasTexture(c);
  return (canvasTexCache[key] = t);
}
// a sprite that glows: its light adds to what is behind, and it writes no depth (extra: more of the material's settings)
const glowSprite = (map, extra) => new THREE.Sprite(new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false, ...extra }));
// a soft round glow
function glowTex(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(0.3, inner);
  g.addColorStop(0.7, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let waveTex, fireTex, glowRed, violetTex, fogNoiseTex; // made at boot
// the Grump's shout ring: a yellow zigzag band with STOP TALKIN' SH#T, two to a tile
function makeWaveTex() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const x = c.getContext('2d');
  x.beginPath();
  const amp = 12;
  x.moveTo(0, 30);
  for (let i = 0; i <= 1024; i += 32) x.lineTo(i, i % 64 ? 30 - amp : 30 + amp);
  for (let i = 1024; i >= 0; i -= 32) x.lineTo(i, i % 64 ? 98 + amp : 98 - amp);
  x.closePath();
  x.fillStyle = HEX.bile;
  x.fill();
  x.lineWidth = 7;
  x.strokeStyle = HEX.ink;
  x.stroke();
  const say = 'STOP  TALKIN’  SH#T';
  x.font = '40px ' + WORLD_FONT;
  const m = x.measureText(say),
    fs = Math.floor(40 * Math.min(1, 460 / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight))); // room at the seam
  x.font = fs + 'px ' + WORLD_FONT;
  x.fillStyle = HEX.ink;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(say, 256, 66);
  x.fillText(say, 768, 66);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}
// a shout ring's inside (its back faces: seen from within, or its far half through the near one) is the band in plain yellow,
// so the words never read mirrored; the band keeps its shape (the texture's alpha). Both rings' shaders add it (waveCompile,
// ringInsideCompile).
const RING_INSIDE_GLSL = (c => `\n  if (!gl_FrontFacing) diffuseColor.rgb = vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)});`)(
  new THREE.Color(COL.bile)
);
function ringInsideCompile(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>' + RING_INSIDE_GLSL);
}
// a totem's shout ring (the Grump's has its own shader, waveCompile)
function totemRingMat() {
  const m = new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
  m.onBeforeCompile = ringInsideCompile;
  return m;
}
// a texture drawn by draw(ctx, w, h); it belongs to the floor
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  OWN.add(t);
  return t;
}
// black and cream zigzag stripes
function chevronTex() {
  return canvasTex(128, 128, (x, w) => {
    x.fillStyle = '#e9e1cf';
    x.fillRect(0, 0, w, w);
    x.fillStyle = HEX.ink;
    for (let r = -1; r < 5; r++) {
      x.beginPath();
      for (let k = 0; k <= 8; k++) x.lineTo(k * 16, r * 32 + (k % 2 ? 16 : 0));
      for (let k = 8; k >= 0; k--) x.lineTo(k * 16, r * 32 + 16 + (k % 2 ? 16 : 0));
      x.fill();
    }
  });
}
// the fog wall's noise: four octaves of smooth value noise, tiling, 16 cells across at the lowest octave
function makeFogNoise() {
  const N = 256,
    out = new Uint8Array(N * N * 4),
    sum = new Float32Array(N * N);
  for (let o = 0, cells = 16, amp = 0.5; o < 4; o++, cells *= 2, amp *= 0.5) {
    const lat = new Float32Array(cells * cells).map(() => Math.random()),
      step = N / cells;
    for (let y = 0; y < N; y++) {
      const gy = y / step,
        iy = Math.floor(gy),
        fy = gy - iy,
        sy = fy * fy * (3 - 2 * fy),
        y0 = iy % cells,
        y1 = (iy + 1) % cells;
      for (let x = 0; x < N; x++) {
        const gx = x / step,
          ix = Math.floor(gx),
          fx = gx - ix,
          sx = fx * fx * (3 - 2 * fx),
          x0 = ix % cells,
          x1 = (ix + 1) % cells;
        const a = lat[y0 * cells + x0],
          b = lat[y0 * cells + x1],
          c = lat[y1 * cells + x0],
          d = lat[y1 * cells + x1];
        sum[y * N + x] += amp * (a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy);
      }
    }
  }
  for (let i = 0; i < N * N; i++) {
    const v = Math.round((sum[i] / 0.9375) * 255);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
