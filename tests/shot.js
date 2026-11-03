// usage: node tests/shot.js build out.png "<js>" [floor] [waitMs]: <js> is one expression run after entering the floor (for statements
// use (() => { ... })(); it may return a promise); prints what it returns, then the errors
const { launch, newPage, openTitle, startGame } = require('./browser');
(async () => {
  const [build, out, js, floor = '0', wait = '3000'] = process.argv.slice(2);
  const b = await launch(),
    errs = [],
    pg = await newPage(b, errs);
  await openTitle(pg, build);
  await startGame(pg);
  await pg.evaluate(f => { slidesOn(false); if (+f) enterFloor(+f); }, floor);
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { cardAt = 0; beginFloor(); });
  const r = await pg.evaluate(js);
  await pg.waitForTimeout(+wait);
  await pg.screenshot({ path: out });
  console.log(JSON.stringify(r), JSON.stringify(errs));
  await b.close();
})();
