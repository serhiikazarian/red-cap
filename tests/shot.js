// usage: node tests/shot.js build out.png "<js run after entering>" [floor] [waitMs]
const { chromium } = require('playwright');
(async () => {
  const [build, out, js, floor = '0', wait = '3000'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 880, height: 500 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  pg.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 600)));
  await pg.goto('file://' + require('path').resolve(build));
  await pg.waitForSelector('#startBtn:not([disabled])', { timeout: 120000 });
  await pg.click('#startBtn');
  await pg.waitForFunction("state === 'intro'", null, { timeout: 180000 });
  await pg.evaluate(f => { slidesOn(false); if (+f) enterFloor(+f); }, floor);
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { cardAt = 0; beginFloor(); });
  const r = await pg.evaluate(js);
  await pg.waitForTimeout(+wait);
  await pg.screenshot({ path: out });
  console.log(JSON.stringify(r), JSON.stringify(errs));
  await b.close();
})();
