// usage: node tests/replay.js build out.json [quick]
// Plays fixed scenarios with a frozen clock, seeded dice and a scripted player (tests/harness.js), and records what matters
// to play (Red Cap, every talker, pickups, shots) every 10 frames. Two builds that play the same give identical files:
// compare them with tests/replay-cmp.js. The baseline is tests/baseline/replay.json.
const { chromium } = require('playwright');
const fs = require('fs');
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

(async () => {
  const [build, out, quick] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [],
    result = {};
  for (const [name, floor, seed, frames0, setup] of SCENARIOS) {
    const pg = await openGame(b, build, errs);
    const frames = quick ? Math.min(frames0, 600) : frames0;
    // one evaluate: nothing from outside can land between the start and the end of a run
    result[name] = await pg.evaluate(([floor, seed, frames, setup]) => (__R.start(floor, seed, setup), __R.run(frames)), [floor, seed, frames, setup]);
    console.error(name, result[name].length, 'samples');
    await pg.close();
  }
  result.errors = errs;
  fs.writeFileSync(out, JSON.stringify(result));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
