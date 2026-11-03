// The test browser, shared by every probe: headless Chromium drawing WebGL on the CPU (swiftshader), pages at 880×500 that
// collect errors, opening a build's title, and Start up to a floor's intro.
const { chromium } = require('playwright');
const path = require('path');

const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function newPage(browser, errs) {
  const pg = await browser.newPage({ viewport: { width: 880, height: 500 } });
  pg.on('pageerror', e => errs.push(String(e)));
  pg.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 600)));
  return pg;
}
// the build's title, once its Start button is ready
async function openTitle(pg, build) {
  await pg.goto('file://' + path.resolve(build));
  await pg.waitForSelector('#startBtn:not([disabled])', { timeout: 120000 });
}
// Start, then wait for floor one's intro card
async function startGame(pg) {
  await pg.click('#startBtn');
  await pg.waitForFunction("state === 'intro'", null, { timeout: 180000 });
}
module.exports = { launch, newPage, openTitle, startGame };
