// soak: each floor live for a while, Red Cap (unhurtable) walking and attacking at random; prints errors ([] = clean)
const { chromium } = require('playwright');
(async () => {
  const [build, secs = '20'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 880, height: 500 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  pg.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
  await pg.goto('file://' + require('path').resolve(build));
  await pg.waitForSelector('#startBtn:not([disabled])', { timeout: 120000 });
  await pg.click('#startBtn');
  await pg.waitForFunction("state === 'intro'", null, { timeout: 180000 });
  for (const f of [0, 1, 2]) {
    await pg.evaluate(f => { if (f !== floorIdx) enterFloor(f); slidesOn(false); cardAt = 0; beginFloor(); }, f);
    const t0 = Date.now();
    const keys = ['w', 'a', 's', 'd'];
    while (Date.now() - t0 < +secs * 1000) {
      await pg.evaluate(() => { hero.iframe = 9; hero.hp = Math.max(hero.hp, 3); });
      const k = keys[(Math.random() * 4) | 0];
      await pg.keyboard.down(k);
      await pg.mouse.click(440 + Math.random() * 200 - 100, 250);
      await pg.waitForTimeout(700);
      await pg.keyboard.up(k);
    }
    // the floor cleared: the trail and the door
    const r = await pg.evaluate(() => { for (const e of G.enemies) if (!e.dead && !e.dying && e.type !== 'M') { e.caged = false; e.dormant = false; kill(e); } return aliveCount(); });
    await pg.waitForTimeout(6000);
    console.log('floor', f, 'alive after', r, JSON.stringify(await pg.evaluate(() => ({ state, hp: hero.hp, trail: G.paperTrail ? G.paperTrail.im.count : null, door: !!(G.portal && G.portal.open), pyr: G.pyr ? Object.keys(G.pyr).length : null }))));
  }
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
