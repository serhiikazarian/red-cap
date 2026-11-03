// Boot smoke test: load the build, click Start, wait for the floor intro; print errors ([] = clean).
const { launch, newPage, openTitle, startGame } = require('./browser');
(async () => {
  const b = await launch(),
    errs = [],
    pg = await newPage(b, errs);
  await openTitle(pg, process.argv[2] || 'game/red-cap.html');
  await startGame(pg);
  await pg.waitForTimeout(2000);
  if (process.argv[3]) await pg.screenshot({ path: process.argv[3] });
  console.log(JSON.stringify(errs));
  await b.close();
})();
