// usage: node tests/same.js build [new]   (tools/same.sh runs it)
// Every replay and picture of tests/jobs.js against tests/baseline, JOBS at a time. The floors the change touches (files
// changed since main, by FLOOR_FILES) run first, and each result is compared as it lands, so a difference shows within
// seconds: one progress line a job (on stderr), then the answer (on stdout): SAME, DIFFERENT and what, or FAIL. The run is kept in out/same with the build's
// fingerprint. `new` makes the baselines from that run when it is of the current build (else runs first), writing only the
// files that changed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { launch } = require('./browser');
const { SCENARIOS, SHOTS, JOBS, replay, picture, pool, saveTrace, loadTraces, parts } = require('./jobs');

const BASE = 'tests/baseline',
  OUT = 'out/same',
  DIFF = 'out/same-diff';
// game files that belong to one floor (by their number); every other file can touch any floor
const FLOOR_FILES = { 0: [22, 23, 24], 1: [25, 26, 27, 44, 48], 2: [28, 29, 30, 31, 49] };

const [build, mode] = process.argv.slice(2);
const sha = crypto.createHash('sha1').update(fs.readFileSync(build)).digest('hex');
const t0 = Date.now(),
  secs = () => Math.round((Date.now() - t0) / 1000) + 's';

// the floors the change since main touches; empty when it may touch any
function touched() {
  let files = [];
  try {
    files = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'game/src'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
  const floors = new Set();
  for (const f of files) {
    const n = parseInt(path.basename(f), 10),
      fl = Object.keys(FLOOR_FILES).find(k => FLOOR_FILES[k].includes(n));
    if (fl === undefined) return [];
    floors.add(+fl);
  }
  return [...floors];
}
// one picture against its baseline: null when the same, else what differs (tests/pics-cmp.py)
function picDiff(name) {
  if (!fs.existsSync(path.join(BASE, 'pics', name + '.png'))) return 'new picture';
  const o = execFileSync('python3', ['tests/pics-cmp.py', path.join(BASE, 'pics'), path.join(OUT, 'pics'), DIFF, name], { encoding: 'utf8' }).trim().split('\n');
  return o[o.length - 1] === 'ALL SAME' ? null : o[0].trim();
}

async function run() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.rmSync(DIFF, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'pics'), { recursive: true });
  const base = fs.existsSync(path.join(BASE, 'replay')) ? loadTraces(path.join(BASE, 'replay')) : {};
  const first = touched();
  const jobs = [...SCENARIOS.map(s => ['replay', s]), ...SHOTS.map(s => ['picture', s])].sort(
    (a, b) => first.includes(b[1][1]) - first.includes(a[1][1]) || b[1][3] - a[1][3] // its floors first, then the longest
  );
  console.error(`${jobs.length} jobs, ${JOBS} at a time` + (first.length ? `, floor ${first.map(f => f + 1).join(' and ')} first` : ''));
  const b = await launch(),
    errs = [],
    diffs = [];
  let done = 0;
  await pool(jobs, JOBS, async ([kind, s]) => {
    const name = s[0];
    let what;
    if (kind === 'replay') {
      const t = await replay(b, build, s, errs);
      saveTrace(path.join(OUT, 'replay'), name, t);
      const i = base[name] ? parts(base[name], t) : 0;
      const at = base[name] && (base[name][i] || t[i]); // a sample: [frame, …], or ['end', frame, state]
      what = !base[name] ? 'new replay' : i < 0 ? null : `DIFFERS from frame ${at[0] === 'end' ? at[1] : at[0]}`;
    } else {
      await picture(b, build, s, errs, path.join(OUT, 'pics', name + '.png'));
      what = picDiff(name);
    }
    if (what) diffs.push(`${kind} ${name}: ${what}`);
    console.error(`${String(++done).padStart(2)}/${jobs.length} ${secs().padStart(4)}  ${kind.padEnd(7)} ${name.padEnd(9)} ${what || 'same'}`);
  });
  await b.close();
  fs.writeFileSync(path.join(OUT, 'run.json'), JSON.stringify({ sha, errs, diffs }));
  return { errs, diffs };
}

// the baselines from the kept run: only the files that changed are written
function promote() {
  const changed = [],
    put = (rel, from) => {
      const to = path.join(BASE, rel);
      if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) return;
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      changed.push(rel);
    };
  const { diffs } = JSON.parse(fs.readFileSync(path.join(OUT, 'run.json'), 'utf8'));
  for (const [name] of SCENARIOS) put(`replay/${name}.json`, path.join(OUT, 'replay', name + '.json'));
  // a picture within pics-cmp's tolerance keeps its old file (no change in git)
  for (const [name] of SHOTS) if (diffs.some(d => d.startsWith(`picture ${name}:`))) put(`pics/${name}.png`, path.join(OUT, 'pics', name + '.png'));
  // what the lists no longer hold (and the older single-file replays) goes
  const keep = new Set([...SCENARIOS.map(s => `replay/${s[0]}.json`), ...SHOTS.map(s => `pics/${s[0]}.png`)]);
  for (const dir of ['replay', 'pics']) for (const f of fs.existsSync(path.join(BASE, dir)) ? fs.readdirSync(path.join(BASE, dir)) : []) if (!keep.has(`${dir}/${f}`)) fs.rmSync(path.join(BASE, dir, f)), changed.push(`${dir}/${f} (removed)`);
  for (const f of ['replay.json', 'replay-quick.json']) if (fs.existsSync(path.join(BASE, f))) fs.rmSync(path.join(BASE, f)), changed.push(f + ' (removed)');
  console.log(changed.length ? `baselines remade: ${changed.join(', ')}` : 'baselines already match');
}

(async () => {
  if (mode === 'new') {
    const kept = fs.existsSync(path.join(OUT, 'run.json')) && JSON.parse(fs.readFileSync(path.join(OUT, 'run.json'), 'utf8'));
    if (kept && kept.sha === sha && !kept.errs.length) console.error('the last check ran this build: its results become the baselines');
    else {
      const { errs } = await run();
      if (errs.length) {
        console.log('errors', JSON.stringify(errs));
        console.log('FAIL errors: baselines not remade');
        process.exitCode = 1;
        return;
      }
    }
    return promote();
  }
  const { errs, diffs } = await run();
  if (errs.length) console.log('errors', JSON.stringify(errs));
  for (const d of diffs) console.log('  ' + d);
  console.log(errs.length ? 'FAIL errors' : diffs.length ? `DIFFERENT (${diffs.length} of ${SCENARIOS.length + SHOTS.length}, ${secs()})` : `SAME (${secs()})`);
  process.exitCode = errs.length || diffs.length ? 1 : 0;
})();
