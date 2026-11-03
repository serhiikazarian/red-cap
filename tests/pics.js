// usage: node tests/pics.js build outDir
// The fixed moments of tests/jobs.js (frozen clock, seeded dice, the scripted player of tests/harness.js), drawn for real and
// saved as PNGs, JOBS at a time. Compare two builds' folders with tests/pics-cmp.py.
const { launch } = require('./browser');
const fs = require('fs');
const { SHOTS, JOBS, picture, pool } = require('./jobs');

(async () => {
  const [build, dir] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });
  const b = await launch(),
    errs = [];
  await pool(SHOTS, JOBS, async s => {
    await picture(b, build, s, errs, `${dir}/${s[0]}.png`);
    console.error(s[0]);
  });
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
