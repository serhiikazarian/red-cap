// Boot smoke test: load the build, click Start, wait for the floor intro; print errors ([] = clean).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 880, height: 500 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto('file://' + require('path').resolve(process.argv[2] || 'game/red-cap.html'));
  await pg.waitForSelector('#startBtn:not([disabled])', { timeout: 120000 });
  await pg.click('#startBtn');
  await pg.waitForFunction("state === 'intro'", null, { timeout: 180000 });
  await pg.waitForTimeout(2000);
  if (process.argv[3]) await pg.screenshot({ path: process.argv[3] });
  console.log(JSON.stringify(errs));
  await b.close();
})();
