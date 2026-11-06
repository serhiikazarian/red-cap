// usage: node tests/replay-cmp.js a b   (folders of replays from tests/replay.js, or older single files)
// Prints, for every scenario, whether the two replays are the same, or the first sample where they part.
const fs = require('fs');
const { loadTraces } = require('./jobs');
const errors = w => (fs.statSync(w).isFile() ? JSON.parse(fs.readFileSync(w, 'utf8')).errors : fs.existsSync(w + '/errors.json') ? JSON.parse(fs.readFileSync(w + '/errors.json', 'utf8')) : []);
const [wa, wb] = process.argv.slice(2),
  [a, b] = [wa, wb].map(loadTraces);
[a.errors, b.errors] = [errors(wa), errors(wb)];
let same = true;
for (const k of Object.keys(a)) {
  if (k === 'errors') continue;
  const x = a[k],
    y = b[k] || [];
  const i = x.findIndex((s, n) => JSON.stringify(s) !== JSON.stringify(y[n]));
  if (i < 0 && x.length === y.length) console.log(k.padEnd(9), 'same', x.length, 'samples');
  else {
    same = false;
    const n = i < 0 ? Math.min(x.length, y.length) : i;
    console.log(k.padEnd(9), 'DIFFERS at sample', n, 'frame', (x[n] || y[n] || [])[0]);
    console.log('  a:', JSON.stringify(x[n]).slice(0, 400));
    console.log('  b:', JSON.stringify(y[n]).slice(0, 400));
  }
}
console.log('errors a', JSON.stringify(a.errors), 'b', JSON.stringify(b.errors));
console.log(same ? 'ALL SAME' : 'DIFFERENT');
