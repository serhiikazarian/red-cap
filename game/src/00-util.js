'use strict';
/* global ASSETS, SHAPES, SOUNDS */
// Red Cap. The files in game/src are joined in name order into one script (game/build.py), so they share one scope:
// 0x core (helpers, sound, drawing, textures, floor data, the world grid, effects, HUD), 1x Red Cap and his weapons,
// 2x-3x the talkers (shared code, then one file each), 4x floor features, 5x building a floor, 6x screens, input, camera, loop.

const $ = s => document.querySelector(s);
const TAU = Math.PI * 2,
  CELL = 3; // metres per map cell
const UP = new THREE.Vector3(0, 1, 0);
const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]; // the four neighbours of a map cell (read only)
const tmpV = new THREE.Vector3(),
  tmpW = new THREE.Vector3(); // scratch vectors, valid only until the next call that uses them

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
// the shortest signed turn from angle a to angle b
const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
// a small seeded random generator: layouts use it so a floor looks the same every time
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
