// Menus: one screen shown at a time, the focused button is the red one (arrows, WASD, Tab, the mouse and a controller move it),
// and the Catalogue of Talkers: a page per talker met (remembered in localStorage), in floor groups, turned like a book.
// one screen at a time (null: none); the title's music plays only on the title; the first button takes the focus
function showOnly(id) {
  ['title', 'card', 'pause', 'dead', 'win', 'catalogue'].forEach(s => ($('#' + s).hidden = s !== id));
  if (id === 'title' && TITLE_MUSIC.want) titleMusicStart();
  else if (id !== 'title') titleMusicStop();
  menuAt = performance.now();
  requestAnimationFrame(() => {
    const b = menuBtns($('#' + id))[0];
    if (b && id !== 'card') b.focus({ preventScroll: true });
  });
}
let menuAt = 0;
let hoverBtn = null; // the button under the mouse: focus follows the mouse only onto another one
addEventListener('pointerover', e => {
  const b = e.target.closest && e.target.closest('.screen button');
  if (b === hoverBtn) return; // still the same button (the music button's icon swaps under the pointer when clicked)
  hoverBtn = b;
  if (b && !b.disabled && e.pointerType === 'mouse') b.focus({ preventScroll: true }); // the red (focus) follows the mouse too
});
const MENU_SHOWN = ['title', 'pause', 'dead', 'win', 'catalogue'];
const menuBtns = scr => (scr ? [...scr.querySelectorAll('button')].filter(b => !b.disabled && !b.hidden && b.offsetParent !== null) : []);
// a key in a menu: true when it was the menu's
function menuKey(e) {
  if (state === 'play' || state === 'intro') return false;
  const id = MENU_SHOWN.find(s => !$('#' + s).hidden);
  if (!id) return false;
  const btns = menuBtns($('#' + id)),
    i = btns.indexOf(document.activeElement),
    c = e.code;
  if (c === 'Escape') {
    e.preventDefault();
    if (id === 'pause') pause(false);
    else if (id === 'catalogue') $('#catBack').click();
    return true;
  }
  // on the catalogue and the ending, left and right turn pages
  if (!btns.length || ((id === 'catalogue' || id === 'win') && (c === 'ArrowLeft' || c === 'ArrowRight'))) return false;
  const dir =
    ['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(c) || (c === 'Tab' && !e.shiftKey)
      ? 1
      : ['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(c) || c === 'Tab'
        ? -1
        : 0;
  if (dir) {
    e.preventDefault();
    btns[i < 0 ? 0 : (i + dir + btns.length) % btns.length].focus({ preventScroll: true });
    return true;
  }
  if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') {
    e.preventDefault();
    if (!e.repeat && performance.now() - menuAt > 350) (i < 0 ? btns[0] : btns[i]).click();
    return true;
  }
  return false;
}

addEventListener('resize', () => {
  if (!$('#catalogue').hidden) catLayout();
});
// ----- the catalogue: [painting, name, where, line, (unlock key: 'ld' the hidden boss, 'spared' an onlooker left alone)]
const CATALOGUE = [
  ['bowface', 'Usher', 'Floor one', 'Shows you to your seat, then charges at it.'],
  ['ghost_a', 'Shade', 'Floor one', 'Harmless. Says boo and pinches your pebbles.'],
  ['geezer', 'The Geezer', 'Floor one', 'Stares people mad. Mostly himself, in mirrors.'],
  ['grin', 'Grin', 'Floor two', 'A face on fire that never stops smilin’.'],
  ['priest', 'The Priest', 'Floor two', 'God loves his children. The blessings are wet.'],
  ['bruno', 'Bruno', 'Floor two', 'Burns alive and calls you stupid. Madone!'],
  ['smoker', 'Smoker', 'Floor three', 'Hides in his own smoke. Psst.'],
  ['smoker', 'Brainless the Second', 'Floor three', 'Bigger, smokier, never stops coughin’.'],
  ['grump', 'Grump', 'Floor three', 'Eight metres of STOP TALKIN’ SH#T.'],
  ['ld_whole', 'Livin’ / Dyin’', 'Floor three, hidden', 'Comes apart: hair, eyes, a laughin’ jaw, a skull.', 'ld'],
  ['jester', 'The Jester', 'Floor three', 'Wears the mask for everyone. Laughs last, until you.'],
  ['npc_hat', 'The Hat', 'Onlooker', 'Hums. Slips you pebbles for the big ones.', 'spared'],
  ['npc_spike', 'Spike', 'Onlooker', 'Cannot keep still. Giggles when you pass.', 'spared'],
  ['npc_hair', 'Long Hair', 'Onlooker', 'Exhales smoke and opinions.', 'spared']
];
const CAT_KEY = 'redcap.catalogue.v1';
let catalogueSeen = (() => {
    try {
      return JSON.parse(localStorage.getItem(CAT_KEY)) || {};
    } catch {
      return {};
    }
  })(),
  catFrom = 'title';
// the pages follow the floors: each floor's talkers together under its name, the onlookers last
const CAT_FLOORS = [
  [FLOORS[0].num, FLOORS[0].name],
  [FLOORS[1].num, FLOORS[1].name],
  [FLOORS[2].num, FLOORS[2].name],
  ['Onlookers', 'On every floor']
];
const catFloor = c => (c[2] === 'Onlooker' ? 3 : c[2].startsWith('Floor three') ? 2 : c[2] === 'Floor two' ? 1 : 0);
let catGroups = [];
// the catalogue shows as many cards as fit the window, a page at a time
let catCards = [],
  catPage = 0,
  cardsPerPage = 6,
  winPage = 0,
  catPages = [];
function saveCatalogue() {
  try {
    localStorage.setItem(CAT_KEY, JSON.stringify(catalogueSeen));
  } catch {}
}
function cardUnlocked(c) {
  return c[4] === 'ld' ? !!catalogueSeen.ld : c[4] === 'spared' ? !!catalogueSeen.spared : !!catalogueSeen.won;
}
function unlockedCount() {
  return CATALOGUE.filter(cardUnlocked).length;
}
function openCatalogue(from) {
  catFrom = from;
  catPage = 0;
  catCards = CATALOGUE.map((c, i) => {
    const open = cardUnlocked(c),
      r = (((i * 37) % 7) - 3) * 0.4,
      fl = c[2].endsWith('hidden') ? 'Hidden' : '';
    return `<figure class="cat-card${open ? '' : ' locked'}" style="--r:${r}deg"><img src="${ASSETS[c[0]]}" alt="${open ? c[1] : 'Unknown'}">${fl ? `<div class="fl">${fl}</div>` : ''}<div class="nm">${open ? c[1] : '???'}</div>
      <div class="ln">${open ? c[3] : c[4] === 'spared' ? 'Finish the game without strikin’ a single onlooker.' : c[4] === 'ld' ? 'Someone hides on the last floor. Read the walls.' : 'Finish the game.'}</div>
      ${open ? `<span class="st ${c[4] === 'spared' ? 'spared' : 'silenced'}">${c[4] === 'spared' ? 'SPARED' : 'SILENCED'}</span>` : ''}</figure>`;
  });
  catGroups = CAT_FLOORS.map((f, k) => ({
    head: `<div class="cat-floor"><b>${f[0]}</b><span>${f[1]}</span></div>`,
    cards: catCards.filter((_, i) => catFloor(CATALOGUE[i]) === k)
  }));
  const n = unlockedCount();
  $('#catCount').textContent = `${n} of ${CATALOGUE.length} pages`;
  $('#catNote').textContent = n === CATALOGUE.length ? 'Complete. Every talker silenced, every onlooker spared.' : 'Some pages are still blank.';
  showOnly('catalogue');
  catLayout();
}
function catLayout() {
  // one floor to a page; a floor that does not fit the window runs on to a second page under the same name
  const grid = $('#catGrid');
  grid.innerHTML = catGroups[0].head + catCards[0];
  const head = grid.firstElementChild,
    card = grid.children[1];
  const cols = Math.max(1, Math.floor((grid.clientWidth + 12) / (Math.max(148, card.offsetWidth) + 12)));
  const rows = Math.max(1, Math.floor((grid.clientHeight - head.offsetHeight - 12 + 12) / (card.offsetHeight + 14)));
  cardsPerPage = cols * rows;
  catPages = [];
  for (const g of catGroups)
    for (let i = 0; i < g.cards.length; i += cardsPerPage) catPages.push(g.head + g.cards.slice(i, i + cardsPerPage).join(''));
  catShow(catPage);
}
function catShow(p) {
  const pages = Math.max(1, catPages.length);
  catPage = clamp(p, 0, pages - 1);
  $('#catGrid').innerHTML = catPages[catPage] || '';
  pagerNav($('#catalogue'), catPage, pages);
}
function pagerNav(root, p, pages) {
  root.querySelector('.pdots').innerHTML = Array.from({ length: pages }, (_, i) => `<i class="${i === p ? 'on' : ''}"></i>`).join('');
  root.querySelector('.pprev').disabled = p <= 0;
  root.querySelector('.pnext').disabled = p >= pages - 1;
  root.querySelector('.pnav').style.visibility = pages > 1 ? 'visible' : 'hidden';
}
function winShow(p) {
  const pages = [...document.querySelectorAll('#win .wpage')];
  winPage = clamp(p, 0, pages.length - 1);
  pages.forEach((el, i) => (el.hidden = i !== winPage)); // showing a page restarts its little animations
  pagerNav($('#win'), winPage, pages.length);
}
function flipPage(d) {
  if (!$('#catalogue').hidden) catShow(catPage + d);
  else if (!$('#win').hidden) winShow(winPage + d);
}
function catRecord() {
  // finishing fills the catalogue; how you finished decides which pages (this run's alone: a new finish replaces the old record)
  catalogueSeen = { won: true };
  if (hero.hasJaw) catalogueSeen.ld = true;
  if (stats.npc.every(v => !v)) catalogueSeen.spared = true;
  saveCatalogue();
  const n = unlockedCount();
  $('#winCat').textContent =
    `Catalogue unlocked: ${n} of ${CATALOGUE.length} pages.` + (stats.npc.every(v => !v) ? ' You never raised a hand to an onlooker.' : '');
  $('#catBtn').hidden = false;
}
