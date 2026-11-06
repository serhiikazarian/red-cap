// Game state and the world grid: G is the floor in play (rebuilt by buildLevel), hero is Red Cap, cam the camera's aim.
// The grid: cells of CELL metres from FLOORS[].map, with raised ground and ramps (heights), collision, sight lines and the
// flow field the talkers follow to reach Red Cap.
let G = null,
  state = 'title', // title, build, intro, play, frozen, paused, dead, won ...
  floorIdx = 0;
const stats = { kills: 0, hits: 0, deaths: 0, start: 0, npc: [0, 0, 0] };
const START_AMMO = 7; // pebbles at the start of a game (a retry restores what he had on entering the floor)
const hero = {
  stun: 0,
  ammo: START_AMMO,
  maxAmmo: 10,
  ammoFloor: -1,
  floorAmmo: 5,
  floorHp: 5,
  pos: new THREE.Vector3(),
  vel: new THREE.Vector2(),
  knock: new THREE.Vector2(),
  r: 0.34,
  hp: 5,
  maxHp: 5,
  iframe: 0,
  dodgeT: 0,
  dodgeCd: 0,
  dodgeDir: new THREE.Vector2(),
  yoyoCd: 0,
  slingCd: 0,
  walk: 0,
  flip: 1,
  stepT: 0,
  root: null,
  parts: {},
  yy: null,
  noBlink: true
};
const cam = { yaw: 0, pitch: 0.24, dist: 4.8, shake: 0, hurt: 0 };
const keys = new Set();
const stick = { x: 0, y: 0 };
let animTick = false, // stop-motion: poses update at 12 frames a second, on frames where animTick is true
  animAcc = 0,
  playT = 0; // seconds of play: it stops while paused and slows with hit-stop and the finale. Game rules run on it (timings,
// what moves where talkers can be hit); the wall clock (performance.now) only drives cosmetic wobble and flicker

// a timer in play time: fn runs once sec seconds of play have passed (real seconds, not slowed by slow motion, held while the
// game is paused); a new floor drops the old floor's timers
function later(sec, fn) {
  G.later.push({ t: sec, fn });
}
function tickLater(rdt) {
  for (const w of G.later.slice()) {
    if ((w.t -= rdt) > 0) continue;
    G.later.splice(G.later.indexOf(w), 1);
    w.fn();
  }
}
function cellOf(x, z) {
  return [Math.floor(x / CELL), Math.floor(z / CELL)];
}
// the middle of cell i along one axis, in metres (the other way from cellOf)
function cellMid(i) {
  return i * CELL + CELL / 2;
}
function ch(ix, iz) {
  if (!G || iz < 0 || iz >= G.h || ix < 0 || ix >= G.w) return '#';
  return G.map[iz][ix];
}
function solid(ix, iz) {
  const c = ch(ix, iz);
  return c === '#' || (c === 'g' && G.gateClosed);
}
// how far a pillar or prop in a cell reaches from the cell's centre (0: nothing to bump into)
function propR(c) {
  return c === 'T' ? (G && G.F.deco === 'mouth' ? PYR_R : 0.5) : c === 'o' ? (G && G.F.deco === 'mouth' ? 0 : 0.6) : 0;
}
// line of sight that also counts pillars and props as cover
function losCover(a, b, pad = 0.3) {
  if (!los(a, b)) return false;
  const dx = b.x - a.x,
    dz = b.z - a.z,
    d = Math.hypot(dx, dz),
    n = Math.ceil(d / 0.3);
  for (let i = 1; i < n; i++) {
    const t = i / n,
      x = a.x + dx * t,
      z = a.z + dz * t,
      [ix, iz] = cellOf(x, z),
      pr = propR(ch(ix, iz));
    if (pr && Math.hypot(x - cellMid(ix), z - cellMid(iz)) < pr + pad) return false;
  }
  return true;
}
// raised ground: G.hk per cell is 0 floor, 1 raised by LIFT, 2 a ramp (G.rd: the direction it rises to)
const LIFT = 1.5;
function kindAt(ix, iz) {
  if (!G || !G.hk || ix < 0 || iz < 0 || ix >= G.w || iz >= G.h) return 0;
  return G.hk[ix + iz * G.w];
}
// the ground's height in a cell at a point (clamped into the cell)
function cellH(ix, iz, x, z) {
  const k = kindAt(ix, iz);
  if (k === 1) return LIFT;
  if (k !== 2) return 0;
  const d = G.rd[ix + iz * G.w],
    ux = clamp(x / CELL - ix, 0, 1),
    uz = clamp(z / CELL - iz, 0, 1);
  return LIFT * (d === 'N' ? 1 - uz : d === 'S' ? uz : d === 'W' ? 1 - ux : ux);
}
function heightAt(x, z) {
  if (!G || !G.hk) return 0;
  const [ix, iz] = cellOf(x, z);
  return cellH(ix, iz, x, z);
}
// can a walker go from one cell to its neighbour (not up or down a drop)?
function stepOK(ax, az, bx, bz) {
  const ka = kindAt(ax, az),
    kb = kindAt(bx, bz);
  const rampOK = (rx, rz, ox, oz, ko) => {
    const d = G.rd[rx + rz * G.w],
      hi = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[d];
    if (ox - rx === hi[0] && oz - rz === hi[1]) return ko !== 0;
    if (ox - rx === -hi[0] && oz - rz === -hi[1]) return ko !== 1;
    return false;
  };
  if (ka === 2 && kb === 2) return true;
  if (ka === 2) return rampOK(ax, az, bx, bz, kb);
  if (kb === 2) return rampOK(bx, bz, ax, az, ka);
  return ka === kb;
}
function buildHeights(F) {
  G.hk = new Uint8Array(G.w * G.h);
  G.rd = {};
  for (const [x0, z0, x1, z1] of F.raise || [])
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (G.map[z][x] !== '#') G.hk[x + z * G.w] = 1;
  for (const [x, z, d] of F.ramps || []) {
    G.hk[x + z * G.w] = 2;
    G.rd[x + z * G.w] = d;
  }
}
// ground the story stands on: nothing random (clutter, decor) is set down inside these discs
function keepOut(x, z, r) {
  G.keep.push({ x, z, r });
}
function clearOf(x, z, r) {
  for (const k of G.keep) if (Math.hypot(k.x - x, k.z - z) < k.r + r) return false;
  return true;
}
function storyGround(F) {
  const mouth = F.deco === 'mouth',
    keep = { o: mouth ? 1.9 : 1.1, T: mouth ? 1.4 : 1.1, X: 1.8, h: 0.8, P: 1 };
  G.keep = [];
  for (let z = 0; z < G.h; z++)
    for (let x = 0; x < G.w; x++) {
      const r = keep[G.map[z][x]];
      if (r) keepOut(cellMid(x), cellMid(z), r);
    }
  for (const e of G.enemies) keepOut(e.pos.x, e.pos.z, Math.max(e.r + 0.5, 1.1));
  if (F.lowHeart) keepOut(cellMid(F.lowHeart[0]), cellMid(F.lowHeart[1]), 0.8); // hearts that may come later
  if (F.roomHeart) keepOut(cellMid(F.roomHeart[0]), cellMid(F.roomHeart[1]), 0.8);
}
// is any cell around (x, z) raised? (walls there are built taller)
function nearRaised(x, z) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (kindAt(x + dx, z + dz)) return true;
  return false;
}
// raised blocks with a rail along every drop, and ramp wedges
function buildRaised(F) {
  if (!F.raise) return;
  const top = new THREE.MeshLambertMaterial({ map: texRepeat(F.floor, 0.6, 0.6), color: 0xd8d0c4 }),
    side = new THREE.MeshLambertMaterial({ map: TEX[F.walls[0]], color: 0x9a9a9a });
  const rail = new THREE.MeshLambertMaterial({ color: F.deco === 'mouth' ? 0x4a1a12 : 0x2a2418 });
  const h = CELL / 2,
    P3 = [],
    UV = [],
    tri = (a, b, c) => {
      for (const v of [a, b, c]) {
        P3.push(v[0], v[1], v[2]);
        UV.push(v[3], v[4]);
      }
    };
  const A = [-h, 0, -h, 0, 0],
    B = [-h, 0, h, 0, 1],
    C = [h, LIFT, h, 1, 1],
    D = [h, LIFT, -h, 1, 0]; // the slope, rising toward +x
  tri(A, B, C);
  tri(A, C, D);
  const s0 = [-h, 0, h, 0, 0],
    s1 = [h, 0, h, 1, 0],
    s2 = [h, LIFT, h, 1, LIFT / CELL],
    n0 = [-h, 0, -h, 0, 0],
    n1 = [h, 0, -h, 1, 0],
    n2 = [h, LIFT, -h, 1, LIFT / CELL];
  tri(s0, s1, s2);
  tri(n0, n2, n1); // the two triangular sides
  const wedge = new THREE.BufferGeometry();
  wedge.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3));
  wedge.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  wedge.computeVertexNormals();
  wedge.addGroup(0, 6, 1);
  wedge.addGroup(6, 6, 0);
  for (let z = 0; z < G.h; z++)
    for (let x = 0; x < G.w; x++) {
      const k = kindAt(x, z),
        cx = cellMid(x),
        cz = cellMid(z);
      if (k === 1) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(CELL, LIFT, CELL), [side, side, top, side, side, side]);
        b.position.set(cx, LIFT / 2, cz);
        G.group.add(still(b));
        for (const [dx, dz] of DIRS4)
          if (!solid(x + dx, z + dz) && kindAt(x + dx, z + dz) === 0) {
            // a rail along every drop
            const r = new THREE.Mesh(dx ? new THREE.BoxGeometry(0.12, 0.9, CELL) : new THREE.BoxGeometry(CELL, 0.9, 0.12), rail);
            r.position.set(cx + dx * (CELL / 2 - 0.06), LIFT + 0.45, cz + dz * (CELL / 2 - 0.06));
            G.group.add(still(r));
          }
      } else if (k === 2) {
        const m = new THREE.Mesh(wedge, [side, top]);
        m.position.set(cx, 0, cz);
        m.rotation.y = { E: 0, W: Math.PI, N: Math.PI / 2, S: -Math.PI / 2 }[G.rd[x + z * G.w]];
        G.group.add(still(m));
      }
    }
}
// pushes a circle (centre p, radius r) out of walls, cells at another height (when y is given), props, pyramids and stakes
function collide(p, r, y, who) {
  const [cx, cz] = cellOf(p.x, p.z);
  for (let iz = cz - 1; iz <= cz + 1; iz++)
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      const nx0 = clamp(p.x, ix * CELL + 0.001, ix * CELL + CELL - 0.001),
        nz0 = clamp(p.z, iz * CELL + 0.001, iz * CELL + CELL - 0.001);
      if (solid(ix, iz) || (y != null && G.hk && Math.abs(cellH(ix, iz, nx0, nz0) - y) > 0.6)) {
        const nx = clamp(p.x, ix * CELL, ix * CELL + CELL),
          nz = clamp(p.z, iz * CELL, iz * CELL + CELL);
        const dx = p.x - nx,
          dz = p.z - nz,
          d = Math.hypot(dx, dz);
        if (d < r) {
          if (d > 1e-4) {
            p.x = nx + (dx / d) * r;
            p.z = nz + (dz / d) * r;
          } else {
            // inside a solid cell: leave by the nearest open side, never by marching on through the wall
            let bs = null,
              bd = 1e9;
            for (const [ax, az] of DIRS4) {
              if (solid(ix + ax, iz + az)) continue;
              const e = ax > 0 ? ix * CELL + CELL - p.x : ax < 0 ? p.x - ix * CELL : az > 0 ? iz * CELL + CELL - p.z : p.z - iz * CELL;
              if (e < bd) {
                bd = e;
                bs = [ax, az];
              }
            }
            if (bs) {
              if (bs[0]) p.x = bs[0] > 0 ? ix * CELL + CELL + r : ix * CELL - r;
              else p.z = bs[1] > 0 ? iz * CELL + CELL + r : iz * CELL - r;
            }
          }
        }
      } else if (pyrAt(ix, iz)) pyrPush(p, Math.max(r, (who && who.drawnR) || 0), pyrAt(ix, iz));
      else {
        const pr = propR(ch(ix, iz));
        if (pr) {
          const px = cellMid(ix),
            pz = cellMid(iz),
            dx = p.x - px,
            dz = p.z - pz,
            d = Math.hypot(dx, dz),
            rr = r + pr;
          if (d < rr && d > 1e-4) {
            p.x = px + (dx / d) * rr;
            p.z = pz + (dz / d) * rr;
          }
        }
      }
    }
  for (const st of G.stakes) {
    const dx = p.x - st.x,
      dz = p.z - st.z,
      d = Math.hypot(dx, dz),
      rr = Math.max(r, (who && who.wide) || 0) + st.r;
    if (d < rr && d > 1e-4) {
      const out = rr - d > 0.25 ? 0.05 : rr - d;
      p.x += (dx / d) * out;
      p.z += (dz / d) * out;
    }
  }
}
// a clear straight line between two points (walls only)
function los(a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    d = Math.hypot(dx, dz),
    n = Math.ceil(d / 0.4);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [ix, iz] = cellOf(a.x + dx * t, a.z + dz * t);
    if (solid(ix, iz)) return false;
  }
  return true;
}
// G.dist: steps from every cell to Red Cap's cell (refreshed four times a second); talkers walk down it
function flowField() {
  const [hx, hz] = cellOf(hero.pos.x, hero.pos.z),
    D = G.dist;
  D.fill(1e9);
  if (solid(hx, hz)) return;
  const q = [hx + hz * G.w];
  D[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi],
      x = i % G.w,
      z = (i / G.w) | 0;
    for (const [ax, az] of DIRS4) {
      const nx = x + ax,
        nz = z + az;
      if (solid(nx, nz) || !stepOK(x, z, nx, nz)) continue;
      const j = nx + nz * G.w;
      if (D[j] > D[i] + 1) {
        D[j] = D[i] + 1;
        q.push(j);
      }
    }
  }
}
// a prop ahead and close to the line of travel bends the heading round it, to the same side for a given walker and prop: the
// round props in the 3 x 3 cells round the walker, then the stakes, each adding its push to AVOID (reused: no garbage a frame)
const AVOID = { x: 0, z: 0 };
function avoidProps(e, vx, vz) {
  const [cx, cz] = cellOf(e.pos.x, e.pos.z);
  AVOID.x = AVOID.z = 0;
  for (let iz = cz - 1; iz <= cz + 1; iz++)
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      const pr = pyrAt(ix, iz) ? PYR.foot * Math.SQRT2 : propR(ch(ix, iz));
      if (pr) avoidOne(e, vx, vz, cellMid(ix), cellMid(iz), pr, ix + iz * 999);
    }
  for (let k = 0; k < G.stakes.length; k++) {
    const st = G.stakes[k];
    avoidOne(e, vx, vz, st.x, st.z, st.r + Math.max(0, (e.wide || 0) - e.r), -1 - k);
  }
  const ox = AVOID.x,
    oz = AVOID.z;
  if (!ox && !oz) return [vx, vz];
  const nx = vx + ox,
    nz = vz + oz,
    l = Math.hypot(nx, nz) || 1;
  return [nx / l, nz / l];
}
// one prop of radius pr at (qx, qz); key names it, so a walker keeps the side it chose
function avoidOne(e, vx, vz, qx, qz, pr, key) {
  const px = qx - e.pos.x,
    pz = qz - e.pos.z,
    ahead = px * vx + pz * vz,
    lat = px * -vz + pz * vx,
    clear = pr + e.r + 0.3;
  if (ahead <= -0.2 || ahead > clear + 2 || Math.abs(lat) >= clear) return;
  let side = e.avCell === key ? e.avSide : 0;
  if (!side) {
    const room = sd => {
        let m = 9;
        for (let k = 0; k <= 8; k++) {
          const t = (k / 8) * Math.PI,
            R = pr + e.r + 0.05,
            ux = Math.cos(t) * vx + Math.sin(t) * -vz * sd,
            uz = Math.cos(t) * vz + Math.sin(t) * vx * sd;
          m = Math.min(m, wallDist(px + e.pos.x + ux * R, pz + e.pos.z + uz * R));
        }
        return m;
      },
      nat = Math.abs(lat) < 0.05 ? (Math.sin(e.seed) > 0 ? 1 : -1) : -Math.sign(lat);
    side = room(nat) >= e.r * 0.95 || room(nat) >= room(-nat) ? nat : -nat;
    e.avCell = key;
    e.avSide = side;
  }
  const w = (1 - Math.abs(lat) / clear) * 2.2;
  AVOID.x += -vz * side * w;
  AVOID.z += vx * side * w;
}
// the heading for a talker going to target: straight when the way is clear and level, else down the flow field; round props
function steer(e, target = hero.pos) {
  const [sx, sz] = steerRaw(e, target);
  return avoidProps(e, sx, sz);
}
function steerRaw(e, target) {
  if (Math.abs(heightAt(target.x, target.z) - heightAt(e.pos.x, e.pos.z)) < 0.5 && losCover(e.pos, target, e.r + 0.1)) {
    const dx = target.x - e.pos.x,
      dz = target.z - e.pos.z,
      d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  }
  const [x, z] = cellOf(e.pos.x, e.pos.z);
  let best = G.dist[x + z * G.w] ?? 1e9,
    bx = x,
    bz = z;
  for (const [ax, az] of DIRS4) {
    const nx = x + ax,
      nz = z + az;
    if (solid(nx, nz) || !stepOK(x, z, nx, nz)) continue;
    const v = G.dist[nx + nz * G.w];
    if (v < best) {
      best = v;
      bx = nx;
      bz = nz;
    }
  }
  const tx = cellMid(bx) - e.pos.x,
    tz = cellMid(bz) - e.pos.z,
    d = Math.hypot(tx, tz) || 1;
  return [tx / d, tz / d];
}
// distance from a point to the nearest solid cell (at most 9)
function wallDist(x, z) {
  const [cx, cz] = cellOf(x, z);
  let best = 9;
  for (let iz = cz - 1; iz <= cz + 1; iz++)
    for (let ix = cx - 1; ix <= cx + 1; ix++)
      if (solid(ix, iz)) {
        const nx = clamp(x, ix * CELL, ix * CELL + CELL),
          nz = clamp(z, iz * CELL, iz * CELL + CELL);
        best = Math.min(best, Math.hypot(x - nx, z - nz));
      }
  return best;
}
