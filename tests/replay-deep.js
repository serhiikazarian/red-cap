// usage: node tests/replay-deep.js a b : the first deep sample where two DEEP=1 replays (folders from tests/replay.js)
// differ, field by field
const { loadTraces } = require('./jobs');
const [a, b] = process.argv.slice(2).map(loadTraces);
for (const k of Object.keys(a)) {
  if (k === 'errors') continue;
  const x = a[k], y = b[k];
  for (let i = 0; i < x.length; i++) {
    const p = x[i], q = y[i];
    if (!q || p[0] !== 'deep') continue;
    const d = [];
    const cmp = (o1, o2, pre) => {
      for (const kk of new Set([...Object.keys(o1 || {}), ...Object.keys(o2 || {})])) {
        const v1 = JSON.stringify((o1 || {})[kk]), v2 = JSON.stringify((o2 || {})[kk]);
        if (v1 !== v2) d.push(pre + kk + ': ' + v1 + ' | ' + v2);
      }
    };
    cmp(p[2], q[2], 'hero.');
    cmp({ c: p[3] }, { c: q[3] }, 'cam.');
    p[4].forEach((e, j) => cmp(e, q[4][j], 'e' + j + '(' + e.type + ').'));
    if (d.length) {
      console.log(k, 'frame', p[1]);
      d.slice(0, 8).forEach(s => console.log('   ', s.slice(0, 150)));
      break;
    }
  }
}
