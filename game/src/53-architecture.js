// Architecture: what is built on the walls. Floor two's painted wall depth, Gothic cornices and the cobwebs under them; floor
// three's paintings. Each floor's dream architecture overhead is in 54-dreamwork.js.
const BOX = share(new THREE.BoxGeometry(1, 1, 1));
const CORNICE = {};
// floor two's walls: fake depth painted from each face's uv (darker at the foot, under the cornice and at the edges; v = 1 at
// the top), kept through the bake; top faces stay plain
function wallShade(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWsh;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWsh = vec3(uv, abs(normal.y));');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWsh;').replace(
    '#include <tonemapping_fragment>',
    `float wsBase = mix(0.42, 1.0, smoothstep(0.0, 0.24, vWsh.y));
  float wsLip = mix(1.0, 0.48, smoothstep(0.7, 0.97, vWsh.y));
  float wsEdge = mix(0.6, 1.0, smoothstep(0.0, 0.15, min(vWsh.x, 1.0 - vWsh.x)));
  gl_FragColor.rgb *= mix(wsBase * wsLip * wsEdge, 1.0, step(0.5, vWsh.z));
  #include <tonemapping_fragment>`
  );
}
// one wall edge's cornice, made once per tilt (dy keeps crossing ledges at a corner off one plane); local +z faces the open
// floor, y = 0 the wall's top. Thick shapes only: thin railings flickered under the ink pass
function corniceGeo(dy) {
  if (CORNICE[dy]) return CORNICE[dy];
  const list = [[BOX, M4(0, -0.13 + dy, 0.02, 0, 0, 0, CELL, 0.34, 0.54)]]; // the ledge, overhanging the face
  for (const x of [-1, 0, 1]) {
    const h = x ? 0.85 : 1.35;
    list.push([BOX, M4(x, -0.48, 0.12, 0, 0, 0, 0.3, 0.36, 0.24)]); // a corbel under the ledge
    list.push([BOX, M4(x, 0.14 + dy, -0.12, 0, 0, 0, 0.46, 0.22, 0.46)]); // a plinth
    list.push([new THREE.ConeGeometry(0.3, h, 4), M4(x, 0.25 + dy + h / 2, -0.12, 0, Math.PI / 4, 0)]); // its pinnacle
  }
  return (CORNICE[dy] = share(mergeGeos(list)));
}
// the web texture: a corner web on the canvas's top 512 px (anchors along the top edge, apex at the bottom middle; canvas top =
// uv v 1), the long strip below it
function webTex() {
  return canvasTex(512, 768, (x, W) => {
    webCorner(x, W, 512);
    webStrip(x, W, 512);
  });
}
// the corner web: spokes from a hub to the triangle's edges, torn rings round it
function webCorner(x, W, H) {
  const r = mulberry(4711),
    hub = [W / 2 + (r() - 0.5) * 30, H * 0.3],
    edge = t => (t < 1 ? [t * W, 0] : t < 2 ? [W - (t - 1) * (W / 2), (t - 1) * H] : [(t - 2) * (W / 2), H - (t - 2) * H]),
    rad = [];
  for (let i = 0; i < 17; i++) rad.push(edge((i + 0.5 + (r() - 0.5) * 0.4) * (3 / 17)));
  x.strokeStyle = 'rgba(170,164,152,0.95)';
  x.lineCap = 'round';
  x.lineWidth = 7;
  x.beginPath();
  x.moveTo(4, 4);
  x.lineTo(W - 4, 4);
  x.lineTo(W / 2, H - 4);
  x.closePath();
  x.stroke();
  x.lineWidth = 5.5;
  for (const p of rad) {
    x.beginPath();
    x.moveTo(hub[0], hub[1]);
    x.lineTo(p[0], p[1]);
    x.stroke();
  }
  x.lineWidth = 4;
  x.strokeStyle = 'rgba(160,154,144,0.9)';
  for (let f = 0.1; f < 0.95; f += 0.07 + r() * 0.03) {
    for (let i = 0; i < rad.length; i++) {
      if (r() < 0.12) continue; // torn
      const a = rad[i],
        b = rad[(i + 1) % rad.length],
        pa = [hub[0] + (a[0] - hub[0]) * f, hub[1] + (a[1] - hub[1]) * f],
        pb = [hub[0] + (b[0] - hub[0]) * f, hub[1] + (b[1] - hub[1]) * f];
      x.beginPath();
      x.moveTo(pa[0], pa[1]);
      x.quadraticCurveTo(hub[0] + ((pa[0] + pb[0]) / 2 - hub[0]) * 0.9, hub[1] + ((pa[1] + pb[1]) / 2 - hub[1]) * 0.9, pb[0], pb[1]);
      x.stroke();
    }
  }
}
// the strip (canvas y H .. H + 256): threads sag between anchors along the ledge (top) and catch on the wall (bottom)
function webStrip(x, W, H) {
  const s = mulberry(4712),
    y0 = H + 4,
    y1 = H + 252,
    top = [],
    bot = [];
  for (let i = 0; i <= 9; i++) top.push(4 + (i / 9) * (W - 8) + (i % 9 ? (s() - 0.5) * 30 : 0));
  for (let i = 0; i <= 6; i++) bot.push(20 + (i / 6) * (W - 40) + (s() - 0.5) * 40);
  x.strokeStyle = 'rgba(170,164,152,0.9)';
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(top[0], y0);
  x.lineTo(top[9], y0); // the line along the ledge
  x.stroke();
  x.lineWidth = 4;
  for (let i = 0; i < 9; i++)
    for (let k = 0; k < 2; k++) {
      const a = top[i],
        b = top[Math.min(9, i + 1 + k)],
        sag = 40 + s() * 150 * (k + 0.6);
      x.beginPath();
      x.moveTo(a, y0);
      x.quadraticCurveTo((a + b) / 2, Math.min(y1, y0 + sag), b, y0); // sagging loops
      x.stroke();
    }
  x.lineWidth = 3.5;
  x.strokeStyle = 'rgba(160,154,144,0.85)';
  for (let i = 0; i < 16; i++) {
    const a = top[(s() * 10) | 0],
      b = bot[(s() * 7) | 0];
    x.beginPath();
    x.moveTo(a, y0);
    x.quadraticCurveTo((a + b) / 2 + (s() - 0.5) * 60, (y0 + y1) / 2 + 30, b, y1); // threads down to the wall
    x.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const ya = y0 + 40 + s() * 160,
      yb = y0 + 40 + s() * 160;
    x.beginPath();
    x.moveTo(s() * W * 0.3, ya);
    x.quadraticCurveTo(W / 2, Math.max(ya, yb) + 50, W - s() * W * 0.3, yb); // cross threads
    x.stroke();
  }
}
const STRIP = { odds: 0.45, half: 1.42, drop: [0.45, 0.8] };
// cobwebs high on the walls, one mesh: in inside corners, across straight faces, and long low strips along whole stretches
function addWebs(w, faces) {
  const web = { r: mulberry(4242 + w), pos: [], uv: [], used: [] };
  cornerWebs(web, w);
  faceWebs(web, faces);
  stripWebs(web, faces);
  if (web.pos.length) G.group.add(webMesh(web));
}
// a web in an inside corner where two wall tops meet, anchors on both, apex hanging between them
function cornerWebs({ r, pos, uv, used }, w) {
  const top = (x, z) => (cellAt(x, z) === '#' ? G.wallTop[x + z * w] : 0),
    H = CELL / 2 - 0.03;
  for (let z = 1; z < G.h - 1; z++)
    for (let x = 1; x < w - 1; x++) {
      const c = cellAt(x, z);
      if (c === '#' || c === 'g') continue;
      for (const [a, b] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]) {
        const hA = top(x + a, z),
          hB = top(x, z + b);
        if (!hA || !hB || r() > 0.95) continue;
        const cx = cellMid(x) + a * H,
          cz = cellMid(z) + b * H;
        if (used.some(([ux, uz]) => Math.hypot(ux - cx, uz - cz) < 2.2)) continue;
        const L = 1.8 + r() * 0.8,
          yt = Math.min(hA, hB) - 0.36,
          drop = Math.min(1.5 + r() * 0.8, yt - 1.9);
        if (drop < 0.9) continue;
        used.push([cx, cz]);
        const e1 = [cx, cz - b * L],
          e2 = [cx - a * L, cz],
          mx = (e1[0] + e2[0]) / 2,
          mz = (e1[1] + e2[1]) / 2;
        pos.push(e1[0], yt, e1[1], e2[0], yt, e2[1], mx + (cx - mx) * 0.35, yt - drop, mz + (cz - mz) * 0.35);
        uv.push(0, 1, 1, 1, 0.5, 1 / 3);
      }
    }
}
// straight faces: a web from the ledge's front edge down to the wall, spanning the corbels; kept off the red wall words
function faceWebs({ r, pos, uv, used }, faces) {
  for (let i = faces.length - 1; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }
  for (const [fx, fz, a, b, h] of faces) {
    if (r() > 0.45) continue;
    const t = r() - 0.5,
      cx = fx + b * t * 0.5,
      cz = fz + a * t * 0.5;
    if (used.some(([ux, uz]) => Math.hypot(ux - cx, uz - cz) < 2.2)) continue;
    if (G.wallWords.some(([wx, wz]) => Math.hypot(wx - cx, wz - cz) < 1.8)) continue;
    const W = 0.8 + r() * 0.4,
      yt = h - 0.32,
      drop = Math.min(1.2 + r() * 0.7, yt - 1.9);
    if (drop < 0.9) continue;
    used.push([cx, cz]);
    pos.push(
      cx - b * W + a * 0.33,
      yt,
      cz - a * W + b * 0.33,
      cx + b * W + a * 0.33,
      yt,
      cz + a * W + b * 0.33,
      cx + a * 0.04,
      yt - drop,
      cz + b * 0.04
    );
    uv.push(0, 1, 1, 1, 0.5, 1 / 3);
  }
}
/* long low strips: whole stretches of wall (blocks of 4 x 4 cells) take them or not, and a chosen stretch has one on every face,
   from the ledge's front edge to the wall; kept off the other webs and the red wall words */
function stripWebs({ r, pos, uv, used }, faces) {
  const take = {};
  for (const [fx, fz, a, b, h] of faces) {
    const k = [Math.floor(fx / (CELL * 4)), Math.floor(fz / (CELL * 4)), a, b].join();
    if (!(take[k] ??= r() < STRIP.odds)) continue;
    if (used.some(([ux, uz]) => Math.hypot(ux - fx, uz - fz) < 1.6)) continue;
    if (G.wallWords.some(([wx, wz]) => Math.hypot(wx - fx, wz - fz) < 1.8)) continue;
    const yt = h - 0.32,
      drop = Math.min(STRIP.drop[0] + r() * (STRIP.drop[1] - STRIP.drop[0]), yt - 1.9),
      W = STRIP.half;
    if (drop < 0.35) continue;
    const p = (u, o, y) => [fx + b * u + a * o, y, fz + a * u + b * o],
      tl = p(-W, 0.33, yt),
      tr = p(W, 0.33, yt),
      bl = p(-W * 0.94, 0.04, yt - drop),
      br = p(W * 0.94, 0.04, yt - drop);
    pos.push(...tl, ...tr, ...bl, ...tr, ...br, ...bl);
    uv.push(0, 1 / 3, 1, 1 / 3, 0, 0, 1, 1 / 3, 1, 0, 0, 0);
  }
}
// all the webs as one see-through mesh, softly blended so the ink pass keeps the wall's alpha
function webMesh({ pos, uv }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.MeshBasicMaterial({
    map: webTex(),
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    ...KEEP_INK
  });
  return new THREE.Mesh(g, m);
}
// Serj's painting (beard_painting, 3:4): HUNG on wall faces, on EASELS in open cells against a wall, facing away from it
const PAINT = { hung: 4, easels: 3, gap: 9 };
function addPaintings(w) {
  const r = mulberry(5150 + w),
    used = [],
    M = { art: new THREE.MeshLambertMaterial({ map: TEX.beard_painting }), wood: new THREE.MeshLambertMaterial({ color: 0x2a1d14 }) },
    spots = paintSpots(w, r),
    far = (px, pz) => !used.some(([ux, uz]) => Math.hypot(ux - px, uz - pz) < PAINT.gap);
  let hung = 0,
    easels = 0;
  for (const [x, z, dx, dz] of spots) {
    const base = G.blockBase[x + dx + (z + dz) * w] || 0,
      fx = cellMid(x) + dx * (CELL / 2 - 0.05),
      fz = cellMid(z) + dz * (CELL / 2 - 0.05);
    if (hung < PAINT.hung && base >= 2.4 && far(fx, fz)) {
      hangPainting(M, fx, fz, dx, dz);
      used.push([fx, fz]);
      hung++;
      continue;
    }
    const ex = cellMid(x) + dx * 0.55,
      ez = cellMid(z) + dz * 0.55;
    if (easels < PAINT.easels && far(ex, ez)) {
      paintEasel(M, r, ex, ez, dx, dz);
      used.push([ex, ez]);
      easels++;
    }
  }
  hangRootHeads(w, r, spots, used);
}
// the root heads (root_head, a cut-out): ROOT.n of them hang head down on the wall faces the paintings left free, size m across,
// their top at the block's top or ROOT.top m if that is higher, gap m from each other and from a painting, swaying by sway rad
const ROOT = { n: 6, size: 2.2, top: 4.2, gap: 7, sway: 0.07, rate: 0.9 };
function hangRootHeads(w, r, spots, used) {
  const mat = new THREE.MeshBasicMaterial({ map: TEX.root_head, transparent: true, alphaTest: 0.2 }),
    geo = new THREE.PlaneGeometry(ROOT.size, ROOT.size).translate(0, -ROOT.size / 2, 0); /* hung by its top edge */
  let n = 0;
  for (const [x, z, dx, dz] of spots) {
    if (n >= ROOT.n) break;
    const fx = cellMid(x) + dx * (CELL / 2 - 0.06),
      fz = cellMid(z) + dz * (CELL / 2 - 0.06);
    if (used.some(([ux, uz]) => Math.hypot(ux - fx, uz - fz) < ROOT.gap)) continue;
    used.push([fx, fz]);
    n++;
    const m = new THREE.Mesh(geo, mat),
      ph = r() * 6.28;
    m.position.set(fx, Math.max(G.blockBase[x + dx + (z + dz) * w] || 0, ROOT.top) + heightAt(cellMid(x), cellMid(z)), fz);
    m.rotation.y = Math.atan2(-dx, -dz);
    G.group.add(m);
    G.anim.push((dt, t) => (m.rotation.z = Math.sin(t * ROOT.rate + ph) * ROOT.sway));
  }
}
// every open cell's side against a wall, past the Jester's chamber, in a seeded shuffle: [x, z, dx, dz, key]
function paintSpots(w, r) {
  const spots = [];
  for (let z = 9; z < G.h - 1; z++)
    for (let x = 1; x < w - 1; x++) {
      if (cellAt(x, z) !== '.') continue;
      for (const [dx, dz] of DIRS4) if (cellAt(x + dx, z + dz) === '#') spots.push([x, z, dx, dz, r()]);
    }
  spots.sort((p, q) => p[4] - q[4]);
  return spots;
}
// the canvas on its stretcher, cw by chh, facing +z
function paintCanvas(g, cw, chh, { art, wood }) {
  const back = new THREE.Mesh(BOX, wood); // the stretcher behind the canvas
  back.scale.set(cw + 0.08, chh + 0.08, 0.06);
  back.position.z = -0.035;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh), art);
  g.add(back, face);
}
// hung on a wall face
function hangPainting(M, fx, fz, dx, dz) {
  const g = new THREE.Group();
  paintCanvas(g, 1.05, 1.4, M);
  g.position.set(fx, 1.6, fz);
  g.rotation.y = Math.atan2(-dx, -dz);
  G.group.add(still(g));
}
// on an easel in the open cell, facing away from the wall: two front legs leaning back, one behind, a shelf
function paintEasel(M, r, ex, ez, dx, dz) {
  const g = new THREE.Group(),
    art3 = new THREE.Group();
  for (const [lx, lz, rx] of [
    [-0.42, 0.12, 0],
    [0.42, 0.12, 0],
    [0, -0.38, 0.3]
  ]) {
    const leg = new THREE.Mesh(BOX, M.wood); // two front legs leaning back, one behind
    leg.scale.set(0.06, 2.05, 0.06);
    leg.position.set(lx, 1.0, lz);
    leg.rotation.x = rx || -0.12;
    g.add(leg);
  }
  const shelf = new THREE.Mesh(BOX, M.wood);
  shelf.scale.set(1.05, 0.06, 0.16);
  shelf.position.set(0, 0.72, 0.16);
  g.add(shelf);
  paintCanvas(art3, 0.9, 1.2, M);
  art3.position.set(0, 1.35, 0.14);
  art3.rotation.x = -0.12;
  g.add(art3);
  g.position.set(ex, 0, ez);
  g.rotation.y = Math.atan2(-dx, -dz) + (r() - 0.5) * 0.5;
  G.group.add(still(g));
}

// Crooked beams over doorways (floors with lintels): an open cell between two walls gets a beam across it, LINTEL.y m above the
// higher ground at its ends, in the floor's first wall painting. No dice: which doorways (two in three), how thick and how
// crooked each is come from the cell's own numbers, so no two are alike and the layout's rolls stay as they are
const LINTEL = { y: 3.1, thick: [0.34, 0.62], tilt: 0.05, skip: 3 };
function addLintels(F) {
  const mat = new THREE.MeshLambertMaterial({ map: TEX[F.walls[0].split(':')[0]], color: 0x8a8a8a }),
    open = (x, z) => !solid(x, z) && cellAt(x, z) !== 'g';
  for (let z = 1; z < G.h - 1; z++)
    for (let x = 1; x < G.w - 1; x++) {
      const k = x * 7 + z * 13,
        ew = cellAt(x - 1, z) === '#' && cellAt(x + 1, z) === '#' && open(x, z - 1) && open(x, z + 1),
        ns = cellAt(x, z - 1) === '#' && cellAt(x, z + 1) === '#' && open(x - 1, z) && open(x + 1, z);
      if (!open(x, z) || (!ew && !ns) || k % LINTEL.skip === 0) continue;
      const t = lerp(LINTEL.thick[0], LINTEL.thick[1], (k % 5) / 4),
        ends = ew
          ? [heightAt(cellMid(x), cellMid(z - 1)), heightAt(cellMid(x), cellMid(z + 1))]
          : [heightAt(cellMid(x - 1), cellMid(z)), heightAt(cellMid(x + 1), cellMid(z))],
        m = new THREE.Mesh(BOX, mat);
      m.scale.set(CELL + 0.3, t, t * 1.3);
      m.position.set(cellMid(x) + ((k % 3) - 1) * 0.08, Math.max(...ends) + LINTEL.y + t / 2, cellMid(z) + ((k % 4) - 1.5) * 0.12);
      m.rotation.set(0, ew ? 0 : Math.PI / 2, ((k % 7) - 3) * LINTEL.tilt);
      G.group.add(still(m));
    }
}
