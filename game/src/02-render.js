// Drawing: the scene renders into a target (colour + depth), then one full-screen pass turns it into an inked comic page:
// outlines from depth edges, posterised colour, halftone dots, paper grain, a vignette, and the special effects
// (the Geezer's swirl, the finale's shock ring, contours of see-through things).
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 160);
const touchUI = matchMedia('(pointer: coarse)').matches;

// see-through things draw far to near; a figure made of parts in a set order (a Grin: userData.sortRank 0-3) sorts at its own
// distance (userData.sortZ, set by sortUnits) so it moves through the order as one thing
const sortZ = it => (it.object.userData.sortZ !== undefined ? it.object.userData.sortZ - it.object.userData.sortRank * 1e-7 : it.z);
renderer.setTransparentSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || sortZ(b) - sortZ(a) || a.id - b.id);

const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
rt.depthTexture = new THREE.DepthTexture(4, 4);
rt.depthTexture.type = THREE.UnsignedIntType;
// see-through things are also drawn into this half-size mask (56-see-through); the ink pass draws a bold contour where it changes
const SEE_ZFAR = 64, // metres: a floater's distance is kept in the mask's blue channel as a share of this
  SEE_GZFAR = 24, // metres: a pillar's distance, in the alpha channel
  SOLID_GAP = [0.2, 0.45]; // metres beyond a pillar's near side where its contour fades in
const seeRT = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });

const post = new THREE.ShaderMaterial({
  uniforms: {
    tCol: { value: rt.texture },
    tDep: { value: rt.depthTexture },
    px: { value: new THREE.Vector2() },
    cn: { value: camera.near },
    cf: { value: camera.far },
    inkCol: { value: new THREE.Color(COL.ink) },
    dotScale: { value: 5 },
    far: { value: 30 },
    psy: { value: 0 }, // the Geezer's swirl, 0..1
    time: { value: 0 },
    dpr: { value: 1 },
    grainOff: { value: new THREE.Vector2() },
    tSee: { value: seeRT.texture },
    seeBox: { value: new THREE.Vector4(-1, -1, 2, 2) },
    heroBox: { value: new THREE.Vector4(-1, -1, 2, 2) },
    lite: { value: 0 }, // 1: single ink lines (cheaper)
    seeOn: { value: 0 },
    spx: { value: new THREE.Vector2() },
    fin: { value: 0 }, // the finale's shock ring
    finT: { value: 0 },
    finC: { value: new THREE.Vector2(0.5, 0.5) }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tCol, tDep, tSee; uniform vec4 seeBox, heroBox; uniform float lite; uniform vec2 px, grainOff, spx, finC; uniform float cn, cf, dotScale, far, psy, time, dpr, seeOn, fin, finT; uniform vec3 inkCol; varying vec2 vUv;
    float gh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float ild(vec2 uv){ float z = texture2D(tDep, uv).x * 2. - 1.; return (cf + cn - z * (cf - cn)) / (2. * cn * cf); } // 1 / linear depth
    float ld(vec2 uv){ return 1. / ild(uv); }
    float edgeAt(vec2 b, vec2 o, float c){
      float l = ild(b - vec2(o.x, 0.)), r = ild(b + vec2(o.x, 0.)), u = ild(b + vec2(0., o.y)), d = ild(b - vec2(0., o.y));
      return abs(l + r + u + d - 4. * c) / c;
    }
    void main(){
      vec2 uv = vUv, cc = vUv - .5; float rr = length(cc), ang = atan(cc.y, cc.x);
      if (psy > 0.) { // the Geezer's stare: the page swirls
        float a = ang + psy * .55 * sin(time * 2. - rr * 9.);
        uv = .5 + vec2(cos(a), sin(a)) * rr * (1. - psy * .04 * sin(time * 5.));
        uv += psy * .005 * vec2(sin(time * 13. + uv.y * 40.), cos(time * 11. + uv.x * 40.));
      }
      float finRing = 0., finRay = 0.;
      if (fin > 0.) { // the Jester torn: the shock ring bends the page as it passes; impact lines burst round him
        vec2 dv = (uv - finC) * vec2(px.y / px.x, 1.); float dr = length(dv), R = finT * 1.5, w = .05 + finT * .05;
        finRing = 1. - smoothstep(0., w, abs(dr - R));
        uv -= dv / max(dr, 1e-4) / vec2(px.y / px.x, 1.) * finRing * .04 * fin;
        float an = atan(dv.y, dv.x) * 7.6394; // 48 spokes
        finRay = smoothstep(.78, .93, abs(fract(an + floor(an * .5) * .37) * 2. - 1.)) * smoothstep(.18, .3, dr) * (1. - smoothstep(.5, 1.4, finT)) * (1. - smoothstep(R, R + .35, dr));
      }
      vec4 C = texture2D(tCol, uv); vec3 c = C.rgb;
      float c0 = ild(uv), D = 1. / c0;
      float e = lite > .5 ? edgeAt(uv, px * 1.6, c0) : max(edgeAt(uv, px * 1.25, c0), edgeAt(uv, px * 2.2, c0) * .7);
      vec2 o = px * 2.2;   // Red Cap clears alpha under himself: his own soft line replaces the stepped one here
      float hm = 1. - C.a;
      if (uv.x > heroBox.x && uv.y > heroBox.y && uv.x < heroBox.z && uv.y < heroBox.w) hm = max(hm, max(max(1. - texture2D(tCol, uv + vec2(o.x, 0.)).a, 1. - texture2D(tCol, uv - vec2(o.x, 0.)).a), max(1. - texture2D(tCol, uv + vec2(0., o.y)).a, 1. - texture2D(tCol, uv - vec2(0., o.y)).a)));
      float edge = smoothstep(.05, .14, e) * (1. - smoothstep(far * .6, far, D)) * (1. - smoothstep(.03, .25, hm));
      float L = dot(c, vec3(.299, .587, .114));
      float q = floor(L * 5. + .5) / 5.;
      vec3 col = mix(c, c * (q + .05) / (L + .05), .5);
      col = mix(vec3(dot(col, vec3(.3333))), col, 1.2);
      vec2 g = mat2(.7071, -.7071, .7071, .7071) * (gl_FragCoord.xy / dotScale);
      float dd = length(fract(g) - .5);
      float dark = 1. - smoothstep(.06, .4, L);
      float dots = 1. - smoothstep(dark * .5 - .06, dark * .5 + .06, dd);
      col *= 1. - dots * .5;
      col = mix(col, inkCol, edge * .92);
      if (fin > 0.) { // the first beat stark: ink and paper, and only the reds kept
        float Lf = dot(c, vec3(.299, .587, .114));
        vec3 stark = Lf > .4 ? vec3(.93, .9, .84) : inkCol;
        if (c.r > c.g * 1.7 && c.r > .3) stark = vec3(.85, .13, .16);
        col = mix(col, stark, fin * .92 * (1. - smoothstep(.2, .75, finT)));
        col = mix(col, inkCol, max(finRing * .9, finRay * .85) * fin);
      }
      if (psy > 0.) { float sp = .5 + .5 * sin(ang * 12. + time * 4. - rr * 22.); col = mix(col, col * vec3(.8, .62, 1.15) + vec3(.14, .05, .24) * sp, psy * .85); }
      vec2 sc = clamp(uv, 0., 1.); // the samples clamp at the screen's edge: so does the test for the box they can reach
      if (seeOn > .5 && sc.x > seeBox.x && sc.y > seeBox.y && sc.x < seeBox.z && sc.y < seeBox.w) { // see-through things: a contour round their outline (r: pillars, their distance in alpha; g: floaters, their distance in blue)
        vec4 t0 = texture2D(tSee, uv); vec2 s0 = t0.rg, hi = s0, lo = s0, up = vec2(0.);
        float fz = t0.g > .02 ? t0.b / t0.g : 1.; // the nearest floater sampled (blue / green: its depth, unblended at the edges)
        float pz = t0.r > .2 ? t0.a / t0.r : 1.; // the nearest pillar sampled (alpha / red)
        for (int k = 0; k < 8; k++) {
          vec2 dir = vec2(cos(float(k) * .7853982), sin(float(k) * .7853982)), d = dir * spx;
          vec4 t1 = texture2D(tSee, uv + d * 1.4), t2 = texture2D(tSee, uv + d * 2.8);
          vec2 s1 = t1.rg, s2 = t2.rg;
          hi = max(hi, max(s1, s2)); lo = min(lo, min(s1, s2));
          up += dir * (s1.r + s2.r);
          if (t1.g > .02) fz = min(fz, t1.b / t1.g);
          if (t2.g > .02) fz = min(fz, t2.b / t2.g);
          if (t1.r > .2) pz = min(pz, t1.a / t1.r);
          if (t2.r > .2) pz = min(pz, t2.a / t2.r);
        }
        float foot = length(up) > .5 ? smoothstep(.45, .8, normalize(up).y) : 0.; // the shape lies above: its bottom edge, on the floor, gets no line
        fz *= ${SEE_ZFAR.toFixed(1)}; // a floater's line is hidden where something nearer stands in front of it (a wall, Red Cap)
        pz *= ${SEE_GZFAR.toFixed(1)}; // a pillar's line lies only on what is beyond its near side: never on Red Cap or anyone in front of it
        float Dn = min(min(D, min(ld(uv + vec2(o.x, 0.)), ld(uv - vec2(o.x, 0.)))), min(ld(uv + vec2(0., o.y)), ld(uv - vec2(0., o.y)))); // the nearest within 2 pixels: a figure's own ink rim writes no depth
        col = mix(col, inkCol, max(smoothstep(.15, .6, hi.r - lo.r) * (1. - foot) * smoothstep(pz + ${SOLID_GAP[0].toFixed(2)}, pz + ${SOLID_GAP[1].toFixed(2)}, Dn), smoothstep(.15, .6, hi.g - lo.g) * smoothstep(fz - 1., fz - .3, D)));
      }
      col = clamp(col, 0., 1.);   // paper grain, one speck per page pixel, at 12 %
      float gv = gh(mod(floor(gl_FragCoord.xy / dpr) + grainOff, 160.));
      col = mix(col, mix(2. * col * gv, 1. - 2. * (1. - col) * (1. - gv), step(.5, col)), .12);
      float vt = length(cc * 2.) * .70710678, va = vt < .42 ? 0. : vt < .72 ? (vt - .42) / .3 * .32 : .32 + (vt - .72) / .28 * .46; // the vignette: clear to 42 %, darkening to the corners
      gl_FragColor = vec4(col * (1. - va), 1.);
    }`,
  depthTest: false,
  depthWrite: false
});
const postScene = new THREE.Scene(),
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

// a see-through-blended solid thing (it writes no depth): normal colour blending, and it lowers the picture's alpha so the ink pass
// draws no line of what is behind it across it
const INK_HIDE = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendEquationAlpha: THREE.AddEquation,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor
};

// The resolution controller. resScale is the drawing ratio, never above the screen's (resCap). calibrate (60-flow) sets it while a
// floor loads; then adaptResolution looks at each second of play. A frame is late when it takes 1.4 frames of a 60 Hz screen (or of
// the screen's own rate, if slower). Over a quarter of a second's frames late: one step down the ladder, thinner smoke first
// (RES.thin: PUFF_LOW puffs, only while there is that much smoke), then single ink lines, then the ratio, to RES_MIN and on to
// RES_LOW only from there (below RES_MIN the smoke is thin too). Three seconds in a row with hardly any late frame: one step back
// up, in the reverse order. A stray hitch moves nothing. A step down is not undone for RES_WAIT seconds; a step up that fails at
// once is taken back and held back twice as long each time.
const RES_MIN = 0.75,
  RES_LOW = 0.6,
  RES_UP = 0.1, // one step up the ratio
  LATE_AT = 1.4, // frames: a frame this long is late
  LATE_DROP = 0.25, // share of late frames in a second that steps down
  LATE_OK = 0.02, // at most this share, three seconds in a row, steps up
  RES_WAIT = 8, // seconds before a step that proved too much is tried again
  RES_WAIT_MAX = 120;
const RES = {
  ticks: [], // this second's frame times (ms)
  t: 0, // ms in this second
  frame: 0, // the screen's frame time: the lowest median of a second seen (0: not yet)
  thin: false, // thinner smoke
  good: 0, // good seconds in a row
  skip: 0, // seconds of play left before deciding (a floor's first frames)
  clock: 0, // seconds of play
  upAt: -99, // when the last step up was taken
  last: null, // which it was ('res', 'lite', 'thin'), and the ratio before it
  from: 0,
  wait: RES_WAIT,
  noRes: { above: Infinity, until: 0 }, // a ratio above this is not tried before then
  noLite: 0, // double ink lines are not tried again before then
  noThin: 0 // nor full smoke
};
let resScale = 1.75;
function resCap() {
  return Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 1.75);
}
// the lowest step down from ratio cur: RES_MIN first, RES_LOW only from there
function resFloor(cur) {
  return cur > RES_MIN ? RES_MIN : RES_LOW;
}
// a fresh start for a new floor (after calibrate): nothing is held back, and its first two seconds of play are not judged
function resFresh() {
  Object.assign(RES, { ticks: [], t: 0, thin: false, good: 0, skip: 2, upAt: -99, last: null, wait: RES_WAIT, noLite: 0, noThin: 0 });
  RES.noRes = { above: Infinity, until: 0 };
}
function adaptResolution(raw) {
  if (raw >= 250) return; // a hidden tab, or the page held while a floor is built
  RES.ticks.push(raw);
  RES.t += raw;
  if (RES.t < 1000) return;
  const ticks = RES.ticks.sort((a, b) => a - b),
    med = ticks[ticks.length >> 1];
  RES.ticks = [];
  RES.t = 0;
  RES.frame = Math.max(4, RES.frame ? Math.min(RES.frame, med) : med);
  if (!(G && state === 'play')) {
    RES.good = 0;
    return;
  }
  RES.clock++;
  if (RES.skip > 0) {
    RES.skip--;
    return;
  }
  const lateAt = LATE_AT * clamp(RES.frame, 1000 / 60, 20.1);
  let n = 0;
  for (let k = ticks.length - 1; k >= 0 && ticks[k] > lateAt; k--) n++;
  const late = n / ticks.length;
  if (late > LATE_DROP) resDown(late);
  else if (late <= LATE_OK && ++RES.good >= 3) resUp();
  else if (late > LATE_OK) RES.good = 0;
}
function resDown(late) {
  RES.good = 0;
  const failed = RES.clock - RES.upAt <= 3 && RES.last; // the step up just taken: undone, and held back twice as long as before
  RES.wait = failed ? Math.min(RES_WAIT_MAX, RES.wait * 2) : RES_WAIT;
  const until = RES.clock + RES.wait,
    cur = Math.min(resScale, resCap()),
    step = failed ? RES.last : !RES.thin && puffs.length > PUFF_LOW ? 'thin' : !post.uniforms.lite.value ? 'lite' : cur > RES_LOW ? 'res' : '';
  RES.last = null;
  if (step === 'thin') {
    RES.thin = true;
    RES.noThin = until;
  } else if (step === 'lite') {
    post.uniforms.lite.value = 1;
    RES.noLite = until;
  } else if (step) {
    RES.noRes = { above: cur - 0.01, until };
    resScale = failed ? RES.from : Math.max(resFloor(cur), cur - (late > 0.6 ? 0.25 : 0.12));
    resize();
  }
}
function resUp() {
  RES.good = 0;
  const cap = resCap(),
    cur = Math.min(resScale, cap),
    to = Math.min(cap, cur + RES_UP),
    held = RES.clock < RES.noRes.until && to > RES.noRes.above;
  if (cur < cap && !held) {
    [RES.last, RES.from] = ['res', cur];
    resScale = to;
    resize();
  } else if (post.uniforms.lite.value && RES.clock >= RES.noLite) {
    RES.last = 'lite';
    post.uniforms.lite.value = 0;
  } else if (RES.thin && RES.clock >= RES.noThin) {
    RES.last = 'thin';
    RES.thin = false;
  } else return;
  RES.upAt = RES.clock;
}

const drawSize = new THREE.Vector2();
function resize() {
  const w = innerWidth,
    h = innerHeight,
    dpr = Math.min(resCap(), resScale);
  renderer.getSize(drawSize); // reallocate the canvas only when its size or ratio really changes
  if (drawSize.x !== w || drawSize.y !== h || renderer.getPixelRatio() !== dpr) renderer.setDrawingBufferSize(w, h, dpr);
  const bw = Math.floor(w * dpr),
    bh = Math.floor(h * dpr);
  rt.setSize(bw, bh);
  seeRT.setSize(Math.max(1, bw >> 1), Math.max(1, bh >> 1));
  post.uniforms.spx.value.set(1 / Math.max(1, bw >> 1), 1 / Math.max(1, bh >> 1));
  post.uniforms.px.value.set(1 / bw, 1 / bh);
  post.uniforms.dotScale.value = 4.5 * dpr;
  post.uniforms.dpr.value = dpr;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// the paper grain jumps between four offsets, eight times a second (still when the player asks for reduced motion)
const GRAIN = [
    [0, 0],
    [-40, 30],
    [50, -20],
    [-20, -50]
  ],
  stillGrain = matchMedia('(prefers-reduced-motion: reduce)').matches;

// each sorted figure's distance for the see-through sort: its middle's depth on screen
const sortV = new THREE.Vector3();
function sortUnits() {
  if (!G) return;
  for (const e of G.enemies) {
    if (!e.sortParts) continue;
    sortV.set(e.pos.x, hitHeight(e), e.pos.z).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    for (const p of e.sortParts) p.userData.sortZ = sortV.z;
  }
}

// Red Cap's box on screen (with a margin): the ink pass looks for his soft outline only there
const HB = new THREE.Vector3();
function heroBoxSet() {
  const b = post.uniforms.heroBox.value;
  if (!G || !hero.root || !hero.root.parent) return b.set(-1, -1, -1, -1);
  let x0 = 2,
    y0 = 2,
    x1 = -1,
    y1 = -1;
  for (let k = 0; k < 8; k++) {
    HB.set(hero.pos.x + (k & 1 ? 1 : -1), hero.pos.y + (k & 2 ? 2.6 : -0.1), hero.pos.z + (k & 4 ? 1 : -1)).project(camera);
    if (HB.z > 1 || HB.z < -1) return b.set(-1, -1, 2, 2); // behind or too close: everywhere, to be safe
    x0 = Math.min(x0, HB.x * 0.5 + 0.5);
    x1 = Math.max(x1, HB.x * 0.5 + 0.5);
    y0 = Math.min(y0, HB.y * 0.5 + 0.5);
    y1 = Math.max(y1, HB.y * 0.5 + 0.5);
  }
  b.set(x0 - 0.04, y0 - 0.04, x1 + 0.04, y1 + 0.04);
}

function render() {
  puffSync();
  sortUnits();
  post.uniforms.time.value = performance.now() / 1000;
  const g = GRAIN[stillGrain ? 0 : Math.floor(performance.now() / 125) % 4];
  post.uniforms.grainOff.value.set(g[0], g[1]);
  if (state !== 'play' && state !== 'frozen') post.uniforms.psy.value = 0;
  heroBoxSet();
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  post.uniforms.seeOn.value = SEE.on ? 1 : 0;
  if (SEE.on) seeMask();
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}
