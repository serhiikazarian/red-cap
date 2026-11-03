// usage: node tests/menus.js build outDir -- opens the title, the catalogue (two pages), the pause menu; a picture of each; errors
const { launch, newPage, openTitle } = require('./browser');
(async () => {
  const [build, dir] = process.argv.slice(2);
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await launch(),
    errs = [],
    pg = await newPage(b, errs);
  await openTitle(pg, build);
  const still = () => pg.evaluate(() => document.getAnimations().forEach(a => (a.pause(), (a.currentTime = 0))));
  await pg.evaluate(() => { slidesOn(false); localStorage.clear(); catMem = {}; });
  await pg.evaluate(() => openCatalogue('title'));
  await pg.waitForTimeout(600);
  await still();
  await pg.screenshot({ path: dir + '/cat1.png' });
  await pg.keyboard.press('ArrowRight');
  await pg.waitForTimeout(600);
  await still();
  await pg.screenshot({ path: dir + '/cat2.png' });
  await pg.keyboard.press('Escape');
  await pg.click('#startBtn');
  await pg.waitForFunction("state === 'intro'", null, { timeout: 180000 });
  await pg.evaluate(() => { cardAt = 0; beginFloor(); pause(true); });
  await pg.waitForTimeout(600);
  await still();
  await pg.screenshot({ path: dir + '/pause.png' });
  console.log(JSON.stringify(errs));
  await b.close();
})();
