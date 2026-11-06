// usage: node tests/replay.js build outDir [name…]
// Plays the fixed scenarios of tests/jobs.js (all, or the ones named), JOBS at a time, and saves each as outDir/<name>.json
// (what matters to play every 10 frames: Red Cap, every talker, pickups, shots) and outDir/errors.json. Two builds that play
// the same give identical files: compare them with tests/replay-cmp.js. The baseline is tests/baseline/replay/.
const { launch } = require('./browser');
const fs = require('fs');
const { SCENARIOS, JOBS, replay, pool, saveTrace } = require('./jobs');

(async () => {
  const [build, out, ...names] = process.argv.slice(2);
  const b = await launch(),
    errs = [];
  await pool(
    SCENARIOS.filter(s => !names.length || names.includes(s[0])),
    JOBS,
    async s => {
      const t = await replay(b, build, s, errs);
      saveTrace(out, s[0], t);
      console.error(s[0], t.length, 'samples');
    }
  );
  fs.writeFileSync(out + '/errors.json', JSON.stringify(errs));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
