// Bear traps (G.mines): something steps near, it clicks (a moment to get clear), then snaps shut twice, half opening between
// bites; each bite takes a heart from Red Cap (and holds him) or a chunk from a talker. A boss already low is never finished
// by a trap: it is left reeling for Red Cap to finish. Then the trap opens again.
let TRAPKIT = null;
// shared by every trap: a heavy plate, a rusty pan, spring arms, a chain and stake, and one big toothed jaw (mirrored for the other)
function trapKit() {
  if (TRAPKIT) return TRAPKIT;
  const R = 1.25,
    ring = new THREE.TorusGeometry(R, 0.08, 6, 22, Math.PI);
  ring.rotateX(Math.PI / 2);
  const tooth = new THREE.ConeGeometry(0.1, 1, 4),
    teeth = [];
  for (let i = 1; i < 16; i++) {
    const a = (i / 16) * Math.PI,
      L = i % 2 ? 0.52 : 0.34;
    teeth.push([tooth, M4(Math.cos(a) * R, L / 2 + 0.02, Math.sin(a) * R, (Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25, 1, L, 1)]);
  }
  const link = new THREE.TorusGeometry(0.09, 0.025, 4, 8),
    chain = [];
  for (let i = 0; i < 9; i++) chain.push([link, M4(R + 0.25 + i * 0.15, 0.04, Math.sin(i * 0.9) * 0.1, Math.PI / 2, i % 2 ? Math.PI / 2 : 0, 0)]);
  chain.push([new THREE.CylinderGeometry(0.05, 0.02, 0.7, 5), M4(R + 1.65, 0.2, 0, 0, 0, 0.3)]);
  const springs = [
    [new THREE.BoxGeometry(0.5, 0.07, 0.16), M4(-R - 0.2, 0.05, 0)],
    [new THREE.BoxGeometry(0.5, 0.07, 0.16), M4(R + 0.1, 0.05, 0)]
  ];
  const jawRing = mergeGeos([[ring, new THREE.Matrix4()]]),
    jawTeeth = mergeGeos(teeth),
    extras = mergeGeos([...chain, ...springs]);
  ring.dispose();
  tooth.dispose();
  link.dispose();
  return (TRAPKIT = {
    base: share(new THREE.CylinderGeometry(R + 0.1, R + 0.14, 0.08, 24)),
    pan: share(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14)),
    jawRing: share(jawRing),
    jawTeeth: share(jawTeeth),
    extras: share(extras),
    iron: share(new THREE.MeshPhongMaterial({ color: 0x2e2826, emissive: 0x100806, flatShading: true, shininess: 50 })),
    rust: share(new THREE.MeshLambertMaterial({ color: 0x7a3a22 })),
    teeth: share(new THREE.MeshPhongMaterial({ color: 0xeee4d2, emissive: 0x3a2a22, flatShading: true, shininess: 30 }))
  });
}
// the jaws c of the way shut (jaw 1 is mirrored, so it swings the other way)
function trapClose(m, c) {
  m.c = c;
  m.jaws[0].rotation.x = (-c * Math.PI) / 2;
  m.jaws[1].rotation.x = (c * Math.PI) / 2;
}
function trapBite(m) {
  SFX.tink();
  playTone({ f: 520, f2: 120, dur: 0.16, type: 'square', gain: 0.16 });
  playTone({ f: 60, f2: 40, dur: 0.3, type: 'sawtooth', gain: 0.14, filt: [400, 120] });
  playNoise({ dur: 0.12, f: 3200, q: 2, gain: 0.26 });
  cam.shake = Math.max(cam.shake, 0.3);
  const at = new THREE.Vector3(m.x, 0.5, m.z);
  burst(at, [0x3a3430, COL.paper, COL.ink], 10, 5, 0.14);
  if (heroDist(m.x, m.z) < 1.55 && hurtHero(1, at, true)) {
    hero.held = 0.5;
    hero.knock.set(0, 0);
    burst(hero.pos.clone().setY(0.4), [COL.tie, 0x7a1d14], 8, 3, 0.12);
  }
  for (const e of G.enemies) {
    if (e.dead || e.dying || e.fly != null) continue;
    const dx = e.pos.x - m.x,
      dz = e.pos.z - m.z,
      d = Math.hypot(dx, dz),
      k = d || 1;
    if (d > 1.35 + e.r * 0.5) continue;
    e.stagger = Math.max(e.stagger, 0.8);
    bloodPool(e.pos.x, e.pos.z, 0.9);
    if (!e.boss || e.hp - 1.5 > 0) damage(e, 1.5, dx / k, dz / k, true);
    else {
      // a boss down to a sliver, reeling, for Red Cap to finish
      const left = Math.max(0.02 * e.maxHp, 0.2);
      e.hp = Math.min(e.hp, left);
      e.flash = 0.3;
      e.engaged = true;
      e.stagger = 2.6;
      e.dazedT = 2.6;
      floatWord('REELIN’', e.pos.clone().setY(hitHeight(e) + 1.6), HEX.bile, 1.1, true);
      const T = TALKERS[e.type];
      if (T.trapped) T.trapped(e);
    }
  }
}
const SNAP = { first: 0.07, second: 0.29 }; // s into the snap of each bite
// how shut the jaws are k s into the snap: shut at the first bite, back open to 0.45 by 0.22 s, shut again at the second
function snapShut(k) {
  if (k < SNAP.first) return k / SNAP.first;
  if (k < 0.22) return 1 - ((k - SNAP.first) / 0.15) * 0.55;
  if (k < SNAP.second) return 0.45 + ((k - 0.22) / 0.07) * 0.55;
  return 1;
}
// each state's step (m.t counts down in every state); a state moves on by naming the next one
const MINE_STATES = {
  // anything on foot near the pan sets it off
  armed(m) {
    const near =
      heroDist(m.x, m.z) < 1.5 ||
      G.enemies.some(e => !e.dead && !e.dying && e.fly == null && !e.still && Math.hypot(e.pos.x - m.x, e.pos.z - m.z) < e.r + 1.1);
    if (!near) return;
    m.st = 'click';
    m.t = 0.4;
    SFX.click();
    if (!G.mineHint) {
      G.mineHint = true;
      toast('Bear trap. Lure the enemy onto one.');
    }
  },
  // the pan sinks, the jaws shiver: a moment to get out
  click(m, dt) {
    trapClose(m, 0.04 + Math.random() * 0.04);
    m.beep -= dt;
    if (m.beep <= 0) {
      m.beep = 0.12;
      SFX.click();
    }
    if (m.t <= 0) {
      m.st = 'snap';
      m.t = 0;
      m.bites = 0;
    }
  },
  // shut, half open, shut again: two bites
  snap(m) {
    const k = -m.t;
    trapClose(m, snapShut(k));
    if (k >= SNAP.first && m.bites === 0) {
      m.bites = 1;
      trapBite(m);
    }
    if (k >= SNAP.second && m.bites === 1) {
      m.bites = 2;
      trapBite(m);
    }
    if (k > 0.9) {
      m.st = 'shut';
      m.t = 4;
    }
  },
  shut(m) {
    if (m.t > 0) return;
    m.st = 'open';
    m.t = 0.8;
  },
  open(m) {
    trapClose(m, Math.max(0, m.t / 0.8));
    if (m.t > 0) return;
    trapClose(m, 0);
    m.st = 'armed';
  }
};
function updateMines(dt) {
  for (const m of G.mines) {
    m.t -= dt;
    MINE_STATES[m.st](m, dt);
  }
}
