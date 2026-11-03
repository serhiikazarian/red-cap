// The Grump (U): floor three's wall of a man. Eight metres of STOP TALKIN' SH#T; he never moves, he shouts rings that roll
// across the floor. Red Cap shelters behind the sound blocks ('o' props), which the shouting wears down; beating him opens the
// fog gate to the Jester.
const GRUMP_SHADE = { w: 1.5, full: 2, end: 3.2 }, // a block's shelter: half its width beyond its middle, full this far behind it, none past end
  GRUMP_REACH = 33, // how far a ring can hurt
  GRUMP_SWELL = new THREE.Vector3(1.1, 1.1, 1.3), // his size between two rings while he shouts (each ring puffs him up past it)
  WAVE_SH_N = 16, // blocks one ring can be cut by
  WAVE_T = { value: 0 }, // the rings' clock (their tears move)
  WAVE_WALL_N = 256, // directions round the Grump in which the walls are measured (waveWalls)
  WAVE_WALL_FAR = 48; // metres: as far as they are measured
// how much a block still protects: whole while its top box stands; once that falls it thins steadily to nothing at 15 % health
const COVER_SHED = [0.75, 0.45], // health at which the top box falls, then the middle one
  coverStrength = b => (b.lost ? clamp((b.hp - 0.15) / (COVER_SHED[0] - 0.15), 0, 1) : 1);
const COVER_HIT = new THREE.Color(0.58, 0.4, 0.26),
  coverCol = new THREE.Color();
const coverDebris = [];
const SHOUT_GEO = share(new THREE.CylinderGeometry(1, 1, 1.6, 56, 1, true)); // a ring: an open cylinder scaled out as it travels

// eight metres of STOP TALKIN' SH#T: one big paper figure
function makeGrump(e, add) {
  Object.assign(e, {
    name: 'The Grump',
    hp: 11,
    maxHp: 11,
    r: 2.7,
    hgt: 8,
    y1: 8,
    still: true,
    palette: [0x4fa9df, 0x9bd12c, 0xf2a35e, COL.ink, 0xe7b84a],
    boss: true,
    waveCount: 0
  });
  const m = add(paper('grump', 8, 0.9));
  e.body = m;
  e.st = 'pause';
  e.t = 2.2;
  e.waves = [];
  e.walls = waveWalls(e.pos.x, e.pos.z);
  G.texs.push(e.walls);
}
// a strip of distances for the rings' shader, one a direction (red: metres of WAVE_WALL_FAR), wrapping round
function wallStrip(px, n) {
  const t = new THREE.DataTexture(px, n, 1, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
// no wall anywhere (the loading screen's stand-in ring); made on first use, after the boot's own drawing
let WAVE_OPEN = null;
const waveOpen = () => WAVE_OPEN || (WAVE_OPEN = wallStrip(new Uint8Array([255, 255, 255, 255]), 1));
// how far the Grump's shout carries in each direction before a wall (or the closed gate) stops it, as it does in play (los):
// WAVE_WALL_N directions round him, the angle of each as the shader reads it (atan of z over x)
function waveWalls(x, z) {
  const px = new Uint8Array(WAVE_WALL_N * 4);
  for (let k = 0; k < WAVE_WALL_N; k++) {
    const a = ((k + 0.5) / WAVE_WALL_N) * TAU - Math.PI,
      ux = Math.cos(a),
      uz = Math.sin(a);
    let d = 0;
    while (d < WAVE_WALL_FAR && !solid(...cellOf(x + ux * d, z + uz * d))) d += 0.1;
    px.fill(Math.round((Math.min(d, WAVE_WALL_FAR) / WAVE_WALL_FAR) * 255), k * 4, k * 4 + 4);
  }
  return wallStrip(px, WAVE_WALL_N);
}
// He never moves: he catches his breath (pause), inflates (GRRR) and shouts four rings in a row.
function updGrump(e, dt, dist, ux, uz, mv) {
  faceCam(e, dt);
  const near = dist < 33;
  if (!e.wearOn && (e.engaged || dist < 16)) e.wearOn = true; // from here on, shouting wears the blocks down
  if (e.st === 'pause') {
    if (animTick) {
      e.body.scale.y = lerp(e.body.scale.y, 0.94, 0.3);
      e.body.scale.x = lerp(e.body.scale.x, 1.04, 0.3);
      e.tilt.position.set(0, 0, 0);
    }
    if (e.t <= 0 && near) {
      e.st = 'inflate';
      e.t = 0.55;
      SFX.growl();
      floatWord('GRRR', e.pos.clone().setY(8.8), HEX.tie, 2);
    }
  } else if (e.st === 'inflate') {
    const k = 1 - e.t / 0.55;
    if (animTick) {
      e.body.scale.set(1 + k * 0.12, 1 + k * 0.14, 1 + k * 0.5);
      shake(e.tilt, 0.05 * k);
    }
    if (e.t <= 0) {
      e.st = 'shout';
      e.waveCount = 4;
      e.t = 0;
    }
  } else if (e.st === 'shout') {
    if (animTick) shake(e.tilt, 0.08);
    if (e.t <= 0) {
      if (e.waveCount > 0) {
        e.waveCount--;
        e.t = 0.42;
        emitWave(e);
        e.body.scale.set(1.2, 1.18, 1.6);
      } else {
        e.st = 'pause';
        e.t = 2.3;
      }
    } else if (animTick) e.body.scale.lerp(GRUMP_SWELL, 0.4);
  }
  updWaves(e, dt, dist, ux, uz);
  if (dist < e.r + hero.r) {
    // pushed back out of his bulk on your own side, never through the gate wall behind him
    const nx = e.pos.x + ux * (e.r + hero.r),
      nz = e.pos.z + uz * (e.r + hero.r),
      ok = (x, z) => !solid(...cellOf(x, z));
    if (ok(nx, nz)) {
      hero.pos.x = nx;
      hero.pos.z = nz;
    } else if (ok(nx, hero.pos.z)) hero.pos.x = nx;
    else if (ok(hero.pos.x, nz)) hero.pos.z = nz;
    collide(hero.pos, hero.r);
  }
}
// the rings roll out: past GRUMP_REACH they fade and do nothing; each one that reaches Red Cap hurts by how much gets through
// (two hearts up close in the open, one further back; nothing behind a whole block; a worn block leaks)
function updWaves(e, dt, dist, ux, uz) {
  for (let i = e.waves.length - 1; i >= 0; i--) {
    const w = e.waves[i];
    WAVE_T.value = performance.now() / 1000;
    w.r += dt * 6;
    w.m.scale.set(w.r, 1, w.r);
    w.m.material.opacity =
      w.r <= GRUMP_REACH - 3 ? 1 : w.r <= GRUMP_REACH ? lerp(1, 0.15, (w.r - GRUMP_REACH + 3) / 3) : 0.15 * clamp(1 - (w.r - GRUMP_REACH) / 8, 0, 1);
    if (w.r <= GRUMP_REACH) grumpWear(e, w);
    if (animTick) waveShade(w); // a worn block's gap thins, a spent one's closes
    w.m.rotation.y += dt * 0.6;
    if (!w.hit && w.r <= GRUMP_REACH && Math.abs(dist - w.r) < 0.5) {
      // loudest up close; cover muffles it
      const near = clamp(1 - (dist - 5) / 26, 0.3, 1),
        open = near > 0.55 ? 2 : 1, // the open-ground blow: two hearts up close, one further back
        through = grumpThrough(e, open);
      if (hero.dodgeT > 0 || hero.dodgeIF > 0 || through <= 0) {
        w.hit = true; // a dodge timed right slips through; a whole block soaks it
        if (through <= 0 && !(hero.dodgeT > 0 || hero.dodgeIF > 0) && los(e.pos, hero.pos) && performance.now() - (e.muffledAt || 0) > 1500) {
          e.muffledAt = performance.now();
          bigWord('MUFFLED', HEX.paper, 1 / 1.7);
        }
      } else if (through < open) {
        // a worn block: part of the shout leaks through, and every whole heart's worth costs a heart
        w.hit = true;
        hero.shoutLeak = (hero.shoutLeak || 0) + through;
        const n = Math.floor(hero.shoutLeak + 1e-6);
        if (n > 0) {
          hero.shoutLeak -= n;
          if (hurtHero(n, e.pos)) hero.knock.set(ux * 5, uz * 5);
        }
      } else if (hurtHero(open, e.pos)) {
        w.hit = true;
        const kb = 4 + 9 * near;
        hero.knock.set(ux * kb, uz * kb);
      }
    }
    if (w.r > GRUMP_REACH + 8) {
      G.group.remove(w.m);
      w.m.material.dispose();
      e.waves.splice(i, 1);
    }
  }
}
TALKERS.U = {
  make: makeGrump,
  update: updGrump,
  bar: e => [e.st === 'pause' ? 'Catchin’ breath' : 'Shoutin’', e.st === 'pause'],
  hurt: e => e.st === 'pause' && (e.t = Math.min(e.t, 0.5)), // hit while he catches his breath and he shouts again sooner
  stagger: 0.12,
  loud: true,
  totemProof: true,
  // pebbles bounce off him
  bounce: (e, p) => {
    SFX.tink();
    burst(p, [COL.smoke, COL.paper], 5, 3, 0.1);
    bigWord('BOUNCE', HEX.paper, 1 / 1.7);
    floatWord(pick(['TOO THICK', 'HA']), e.pos.clone().setY(5.2 + rand(0, 1.2)), HEX.paper, 1.1);
  },
  drops: e => hero.hp < WELL.hp && dropHeart(e.pos.x, e.pos.z), // a heart, only when Red Cap is down to 3 ties or fewer
  // beaten: his rings stop and the fog gate to the Jester lifts
  gone: e => {
    e.waves.forEach(w => G.group.remove(w.m));
    e.waves.length = 0;
    openGate();
  }
};

// ----- the sound blocks
// the hearts a ring carries to Red Cap: 0 behind a sound block, rising as the block wears, the full amount (open) in the open.
// A block shelters him when it stands between them and he is pressed up behind it (GRUMP_SHADE); a wall is total cover.
function grumpThrough(e, open) {
  if (!los(e.pos, hero.pos)) return 0;
  const dx = hero.pos.x - e.pos.x,
    dz = hero.pos.z - e.pos.z,
    d = Math.hypot(dx, dz) || 1,
    ux = dx / d,
    uz = dz / d,
    [hx, hz] = cellOf(hero.pos.x, hero.pos.z);
  let best = open;
  for (let iz = hz - 2; iz <= hz + 2; iz++)
    for (let ix = hx - 2; ix <= hx + 2; ix++) {
      const pr = propR(ch(ix, iz));
      if (!pr) continue;
      const px = (ix + 0.5) * CELL,
        pz = (iz + 0.5) * CELL,
        t = (px - e.pos.x) * ux + (pz - e.pos.z) * uz;
      if (t <= 0 || t >= d) continue; // not between them
      const off = Math.abs((px - e.pos.x) * uz - (pz - e.pos.z) * ux),
        behind = d - t;
      // how well it hides him from here, and what it lets through while whole: in its shelter nothing, at the edge one heart
      const c = clamp((GRUMP_SHADE.w + 0.2 - off) / 0.5, 0, 1) * clamp((GRUMP_SHADE.end - behind) / (GRUMP_SHADE.end - GRUMP_SHADE.full), 0, 1);
      const sound = c >= 0.55 ? 0 : c >= 0.2 ? 1 : open;
      const b = G.props && G.props[ix + ',' + iz],
        st = b ? coverStrength(b) : 1;
      best = Math.min(best, sound + (open - sound) * (1 - st));
    }
  return best;
}
// each shout that rolls over a block flashes it; once Red Cap has come near the Grump it also wears the block down
function grumpWear(e, w) {
  if (!G.props) return;
  w.blk = w.blk || new Set();
  for (const k in G.props) {
    const b = G.props[k];
    if (b.hp <= 0 || w.blk.has(k)) continue;
    const dd = Math.hypot(b.x - e.pos.x, b.z - e.pos.z);
    if (Math.abs(dd - w.r) > 0.6 || !los(e.pos, tmpW.set(b.x, 0, b.z))) continue;
    w.blk.add(k);
    b.flashT = 3; // it flashes either way: at first only to show what shouting does to a block
    if (e.wearOn) b.hp -= 0.0224; // about nine bursts of shouting from whole to spent
    burst(FX_AT.set(b.x, 0.9, b.z), [0x4fa9df, 0x9bd12c, 0xf2a35e, 0xe7b84a, COL.ink], 4, 3, 0.14);
    // the shout splashes against it: bits of the ring thrown back and up off its face
    const ux = (e.pos.x - b.x) / (dd || 1),
      uz = (e.pos.z - b.z) / (dd || 1);
    for (let q = 0; q < 3; q++)
      burst(
        FX_AT.set(b.x + ux * 0.9 + rand(-0.6, 0.6), rand(0.4, 1.6), b.z + uz * 0.9 + rand(-0.6, 0.6)),
        [COL.bile, COL.paper, 0x4fa9df, COL.ink],
        4,
        4,
        0.16,
        { g: 6, life: 0.7 }
      );
    // the boxes come off first (top, then middle), so the block shows it is giving before anything gets through;
    // the base goes last, in the poof (the boxes are listed bottom first)
    const lose = b.hp <= COVER_SHED[1] ? 2 : b.hp <= COVER_SHED[0] ? 1 : 0,
      boxes = b.g.userData.boxes || [];
    while ((b.lost || 0) < lose && boxes.length - (b.lost || 0) > 1) {
      b.lost = (b.lost || 0) + 1;
      shedBox(b, boxes[boxes.length - b.lost], e);
    }
    if (coverStrength(b) <= 0) {
      // spent: it goes up in a puff of paper dust and is gone
      G.group.remove(b.g);
      if (b.g.userData.boxes) syncBoxes(b.g.userData.boxes, true);
      const [ix, iz] = cellOf(b.x, b.z);
      G.map[iz] = G.map[iz].slice(0, ix) + '.' + G.map[iz].slice(ix + 1);
      delete G.props[k];
      burst(FX_AT.set(b.x, 1, b.z), [0x4fa9df, 0x9bd12c, 0xf2a35e, 0xe7b84a, COL.ink], 24, 6, 0.26);
      for (let p = 0; p < 6; p++) smokePuff(FX_AT.set(b.x + rand(-0.8, 0.8), rand(0.4, 1.8), b.z + rand(-0.8, 0.8)), rand(1.2, 2), 0.9, 0.6);
      sNoise({ dur: 0.45, f: 900, f2: 200, q: 0.8, gain: 0.3 });
    }
  }
}
// a block hit by a ring pulses dim brown for a few seconds
function updCovers(dt) {
  if (!G.props) return;
  const now = performance.now() / 1000;
  for (const k in G.props) {
    const b = G.props[k];
    if (!b.g.userData.boxes || (b.flashT <= 0 && !b.flashing)) continue;
    b.flashT = Math.max(0, b.flashT - dt);
    const pulse = b.flashT > 0 ? (0.5 + 0.5 * Math.sin(now * 20)) * Math.min(1, b.flashT / 0.6) : 0;
    coverCol.copy(WHITE).lerp(COVER_HIT, pulse);
    for (const it of b.g.userData.boxes) {
      it.im.setColorAt(it.idx, coverCol);
      it.im.instanceColor.needsUpdate = true;
    }
    b.flashing = b.flashT > 0;
  }
}
// a box knocked off the top of a block tumbles away from the Grump and crumbles into dust where it lands
function shedBox(b, it, e) {
  const m = it.mesh;
  it.shed = true;
  if (it.see) {
    G.group.remove(it.see);
    it.see = null;
  }
  b.g.updateMatrix();
  tmpM.multiplyMatrices(b.g.matrix, m.matrix).decompose(m.position, m.quaternion, m.scale);
  it.im.setMatrixAt(it.idx, ZERO_M);
  it.im.instanceMatrix.needsUpdate = true;
  G.group.add(m);
  const dx = b.x - e.pos.x,
    dz = b.z - e.pos.z,
    d = Math.hypot(dx, dz) || 1;
  coverDebris.push({
    m,
    vx: (dx / d) * 2.2 + rand(-0.6, 0.6),
    vz: (dz / d) * 2.2 + rand(-0.6, 0.6),
    vy: 2.6,
    sx: rand(-5, 5),
    sz: rand(-5, 5),
    t: 0.75
  });
  burst(m.position.clone(), [0x4fa9df, 0x9bd12c, 0xf2a35e, 0xe7b84a, COL.ink], 8, 3, 0.16);
  sNoise({ dur: 0.18, f: 700, f2: 250, q: 1, gain: 0.18 });
}
function updDebris(dt) {
  for (let i = coverDebris.length - 1; i >= 0; i--) {
    const c = coverDebris[i];
    c.t -= dt;
    c.vy -= 14 * dt;
    c.m.position.x += c.vx * dt;
    c.m.position.y = Math.max(0.3, c.m.position.y + c.vy * dt);
    c.m.position.z += c.vz * dt;
    c.m.rotation.x += c.sx * dt;
    c.m.rotation.z += c.sz * dt;
    if (c.t <= 0) {
      burst(c.m.position.clone(), [0x4fa9df, 0x9bd12c, 0xf2a35e, 0xe7b84a, COL.ink], 12, 4, 0.18);
      smokePuff(c.m.position.clone(), rand(0.9, 1.4), 0.8, 0.5);
      G.group.remove(c.m);
      c.m.geometry.dispose();
      coverDebris.splice(i, 1);
    }
  }
}

// The rings: a zigzag STOP TALKIN' SH#T band (waveTex) whose shader cuts a torn gap where it runs behind a block
// (uSh: angle seen from the ring's middle, half-width, distance, strength), with a burning rim and cracks before it, and
// ends, torn, at the first wall in each direction (uWall, from waveWalls): a wall stops a ring for good.
function waveCompile(sh) {
  sh.uniforms.uSh = this.userData.uSh;
  sh.uniforms.uWall = this.userData.uWall;
  sh.uniforms.uWT = WAVE_T;
  sh.vertexShader =
    'varying vec2 vWP;\nvarying vec2 vMid;\nvarying float vWY;\n' +
    sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xz;\n  vWY = (modelMatrix * vec4(transformed, 1.0)).y;\n  vMid = vec2(modelMatrix[3][0], modelMatrix[3][2]);'
    );
  sh.fragmentShader =
    'varying vec2 vWP;\nvarying vec2 vMid;\nvarying float vWY;\nuniform float uWT;\nuniform sampler2D uWall;\nuniform vec4 uSh[' +
    WAVE_SH_N +
    '];\n' +
    sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
  {
    vec2 rel = vWP - vMid;
    float ang = atan(rel.y, rel.x), rad = length(rel), keep = 1.0, rim = 0.0, hot = 0.0;
    float wall = texture2D(uWall, vec2(ang / 6.2831853 + 0.5, 0.5)).r * ${WAVE_WALL_FAR.toFixed(1)} + 0.2 * sin(vWY * 7.0 + uWT * 11.0) + 0.12 * sin(vWY * 17.0 - uWT * 9.0);
    keep *= 1.0 - smoothstep(wall - 0.1, wall + 0.5, rad);
    for (int i = 0; i < ${WAVE_SH_N}; i++) {
      vec4 q = uSh[i];
      if (q.w <= 0.0) continue;
      float da = abs(mod(ang - q.x + 3.14159265, 6.2831853) - 3.14159265);
      if (da > q.y * 1.7 + 0.03 || rad < q.z - 3.7 || rad > q.z + ${(GRUMP_SHADE.end + 1.6).toFixed(1)}) continue;
      float fi = float(i);
      float reach = smoothstep(q.z - 0.2, q.z + 0.4, rad) * (1.0 - smoothstep(q.z + ${GRUMP_SHADE.full.toFixed(1)}, q.z + ${(GRUMP_SHADE.end + 1.5).toFixed(1)}, rad));
      float jag = 0.16 * sin(vWY * 7.0 + uWT * 11.0 + fi) + 0.1 * sin(vWY * 19.0 - uWT * 17.0 + rad * 3.0) + 0.07 * sin(rad * 9.0 - uWT * 6.0);
      float edge = q.y * (0.92 + 0.1 * sin(uWT * 4.3 + q.z + fi) + jag);
      float inside = 1.0 - smoothstep(edge, edge + q.y * 0.22, da);
      float cut = inside * reach;
      float pre = smoothstep(q.z - 3.5, q.z - 0.2, rad) * (1.0 - reach);
      float quake = 0.5 + 0.5 * sin(da * 70.0 - uWT * 22.0 + vWY * 6.0 + fi);
      float crack = inside * pre * pre * smoothstep(0.25, 0.85, quake * (0.6 + 0.4 * sin(uWT * 13.0 + rad * 4.0)));
      float shard = smoothstep(0.55, 0.95, sin(rad * 13.0 - uWT * 15.0 + da * 60.0) * sin(vWY * 9.0 + uWT * 8.0 + fi * 2.0));
      shard *= (1.0 - smoothstep(q.z + 0.3, q.z + ${GRUMP_SHADE.full.toFixed(1)}, rad)) * smoothstep(edge * 0.3, edge, da) * 0.55;
      keep *= (1.0 - cut * q.w * (1.0 - shard)) * (1.0 - crack * q.w * 0.8);
      float band = exp(-pow((da - edge - q.y * 0.11) / (q.y * 0.13 + 0.004), 2.0)) * max(reach, pre * (0.45 + 0.35 * sin(uWT * 17.0 + fi))) * q.w;
      float crackle = 0.55 + 0.45 * sin(vWY * 23.0 + uWT * 31.0 + rad * 5.0 + fi * 3.0);
      rim = max(rim, band * crackle);
      hot = max(hot, band * smoothstep(0.6, 1.0, sin(uWT * 9.0 + vWY * 4.0 + fi)));
    }
    diffuseColor.a *= keep;
    vec3 tear = mix(vec3(0.85, 0.13, 0.16), vec3(0.94, 0.81, 0.18), hot);
    diffuseColor.rgb = mix(diffuseColor.rgb, tear, rim);
    diffuseColor.a = max(diffuseColor.a, rim * 0.92 * opacity);
  }`
    );
}
// the gaps for one ring, from where it started: every block standing in its way (at most WAVE_SH_N), as strong as the block still is
function waveShade(w) {
  const sh = w.m.material.userData.uSh.value,
    c = w.m.position;
  let n = 0;
  for (const k in G.props || {}) {
    if (n >= WAVE_SH_N) break;
    const b = G.props[k],
      st = b.hp > 0 ? coverStrength(b) : 0;
    if (st <= 0) continue;
    const dx = b.x - c.x,
      dz = b.z - c.z,
      dd = Math.hypot(dx, dz);
    if (dd < 1.2 || !los(c, tmpW.set(b.x, 0, b.z))) continue;
    sh[n++].set(Math.atan2(dz, dx), Math.asin(Math.min(1, GRUMP_SHADE.w / dd)), dd, st);
  }
  for (; n < WAVE_SH_N; n++) sh[n].set(0, 0, 0, 0);
}
// one ring from the Grump
function emitWave(e) {
  const mat = new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
  mat.userData.uSh = { value: Array.from({ length: WAVE_SH_N }, () => new THREE.Vector4()) };
  mat.userData.uWall = { value: e.walls };
  mat.onBeforeCompile = waveCompile;
  const m = new THREE.Mesh(SHOUT_GEO, mat);
  m.position.set(e.pos.x, 0.9, e.pos.z);
  m.scale.set(e.r, 1, e.r);
  G.group.add(m);
  const w = { m, r: e.r, hit: false };
  e.waves.push(w);
  waveShade(w);
  SFX.wah();
  sTone({ f: 70, f2: 45, dur: 0.5, type: 'sawtooth', gain: 0.18, filt: [500, 200] });
  if (e.waveCount === 3) floatWord(pick(['BLAH', 'STOP', 'SHUT UP', 'GRR']), e.pos.clone().setY(8.8), HEX.ink, 1.8);
}
