// The fixed runs that prove a change alters nothing, shared by replay.js, pics.js and same.js: replays (a scripted player
// with a frozen clock and seeded dice, sampled every 10 frames) and pictures (a fixed moment drawn for real). Each job opens
// its own page, so jobs run side by side (JOBS at a time, default 3) and finish in any order with the same results.
// A replay is saved as one file per scenario, one sample per line, so a change shows as the few lines and files it touches.
const fs = require('fs');
const path = require('path');
const { openGame } = require('./harness');

const SCENARIOS = [
  // [name, floor, seed, frames, setup]
  ['floor1', 0, 11, 2400, null],
  ['floor1b', 0, 23, 2400, null],
  ['geezer', 0, 5, 1800, 'near:Y'],
  ['floor2', 1, 11, 2400, null],
  ['floor2b', 1, 23, 2400, null],
  ['priest', 1, 7, 1800, 'near:R'],
  ['floor3', 2, 11, 2400, null],
  ['floor3b', 2, 23, 2400, null],
  ['grump', 2, 9, 1800, 'near:U'],
  ['jester', 2, 13, 2400, 'jester'],
  ['finale', 2, 19, 2400, 'finale'],
  ['hidden', 2, 17, 3600, 'ld']
];
const SHOTS = [
  // [name, floor, seed, frames before the picture, setup]
  ['f1-start', 0, 11, 0, null],
  ['f1-fight', 0, 11, 300, null],
  ['f2-start', 1, 11, 0, null],
  ['f2-fight', 1, 11, 420, null],
  ['f3-start', 2, 11, 0, null],
  ['f3-fight', 2, 11, 300, 'near:U'],
  ['jester', 2, 13, 360, 'jester']
];
const JOBS = Math.max(1, +process.env.JOBS || 3);

// one replay: its samples
async function replay(browser, build, [, floor, seed, frames, setup], errs) {
  const pg = await openGame(browser, build, errs);
  // one evaluate: nothing from outside can land between the start and the end of a run
  const t = await pg.evaluate(a => (__R.start(a[0], a[1], a[3]), __R.run(a[2])), [floor, seed, frames, setup]);
  await pg.close();
  return t;
}
// one picture, saved as file
async function picture(browser, build, [, floor, seed, frames, setup], errs, file) {
  const pg = await openGame(browser, build, errs);
  await pg.evaluate(a => (__R.start(a[0], a[1], a[3]), __R.run(a[2]), __R.picture()), [floor, seed, frames, setup]);
  await pg.screenshot({ path: file });
  await pg.close();
}
// runs fn on every item, n at a time, in the items' order
async function pool(items, n, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

const lines = trace => '[\n' + trace.map(s => JSON.stringify(s)).join(',\n') + '\n]\n';
function saveTrace(dir, name, trace) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), lines(trace));
}
// a folder of replays (or one older single file of them): { name: samples }
function loadTraces(where) {
  if (fs.statSync(where).isFile()) {
    const all = JSON.parse(fs.readFileSync(where, 'utf8'));
    delete all.errors;
    return all;
  }
  const out = {};
  for (const f of fs.readdirSync(where).sort()) if (f.endsWith('.json') && f !== 'errors.json') out[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(where, f), 'utf8'));
  return out;
}
// the first sample where two replays part, or -1 if they are the same
function parts(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return i;
  return -1;
}

module.exports = { SCENARIOS, SHOTS, JOBS, replay, picture, pool, saveTrace, loadTraces, parts, lines };
