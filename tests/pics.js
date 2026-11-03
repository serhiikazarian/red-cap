// usage: node tests/pics.js build outDir
// Fixed moments on each floor (frozen clock, seeded dice, the scripted player of tests/harness.js), drawn for real and saved
// as PNGs. Compare two builds' folders with tests/pics-cmp.py.
const { launch } = require('./browser');
const fs = require('fs');
const { openGame } = require('./harness');

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

(async () => {
  const [build, dir] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });
  const b = await launch();
  const errs = [];
  for (const [name, floor, seed, frames, setup] of SHOTS) {
    const pg = await openGame(b, build, errs);
    await pg.evaluate(([floor, seed, frames, setup]) => (__R.start(floor, seed, setup), __R.run(frames), __R.picture()), [floor, seed, frames, setup]);
    await pg.screenshot({ path: `${dir}/${name}.png` });
    await pg.close();
    console.error(name);
  }
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
