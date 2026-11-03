// usage: node tests/replay-cmp.js a.json b.json
// Prints, for every scenario, whether the two replays are the same, or the first sample where they part.
const fs = require('fs');
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
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
