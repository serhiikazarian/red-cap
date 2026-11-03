// Input: the mouse (locked to the canvas during play: it turns the camera; left button yo-yo, right slingshot), the keyboard
// (WASD to move, Q / E to turn, J or F yo-yo, L or R slingshot, Space or K dodge, Esc or P pause, M mute; typing GOD skips
// a floor), touch controls, a game controller, and the screens' buttons.
let locked = false,
  dragLook = false;
const mouse = { x: 0, y: 0, in: false };
function lockPointer() {
  if (touchUI) return;
  try {
    const r = canvas.requestPointerLock && canvas.requestPointerLock();
    if (r && r.catch)
      r.catch(() => {
        dragLook = true;
      });
  } catch {
    dragLook = true;
  }
}
function unlock() {
  if (document.pointerLockElement) document.exitPointerLock();
}
document.addEventListener('pointerlockchange', () => {
  const was = locked;
  locked = document.pointerLockElement === canvas;
  if (was && !locked && state === 'play') pause(true);
});
document.addEventListener('pointerlockerror', () => {
  dragLook = true;
});
addEventListener('mousemove', e => {
  if (e.movementX || e.movementY) padClear(); // the mouse is back: buttons look as usual
  if (state !== 'play') return;
  // the camera follows the mouse whether or not the browser lets the page capture the pointer
  const mx = clamp(e.movementX || 0, -80, 80),
    my = clamp(e.movementY || 0, -80, 80);
  cam.yaw -= mx * (locked ? 0.0026 : 0.0034);
  cam.pitch = clamp(cam.pitch + my * (locked ? 0.0018 : 0.0024), -0.22, 0.8);
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.in = true;
});
canvas.addEventListener('mousedown', e => {
  if (state === 'intro') {
    auInit();
    beginFloor();
    return;
  }
  if (state !== 'play') return;
  auInit();
  if (!locked && !dragLook) lockPointer();
  e.button === 2 ? sling() : yoyo();
});
document.addEventListener('mouseleave', () => {
  mouse.in = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
// ----- the keyboard
let godKeys = ''; // the last letters typed while playing, for G-O-D
function godMode() {
  hero.hp = hero.maxHp;
  hero.ammo = hero.maxAmmo;
  drawTies();
  updAmmo();
  if (floorIdx + 1 < FLOORS.length) nextFloor();
  else win();
}
addEventListener('keydown', e => {
  if (state === 'play' && !e.repeat && /^Key[A-Z]$/.test(e.code)) {
    godKeys = (godKeys + e.code[3]).slice(-3);
    if (godKeys === 'GOD') {
      godKeys = '';
      godMode();
      return;
    }
  }
  if (menuKey(e)) return;
  if ((e.code === 'ArrowRight' || e.code === 'ArrowLeft') && (!$('#catalogue').hidden || !$('#win').hidden)) {
    e.preventDefault();
    flip(e.code === 'ArrowRight' ? 1 : -1);
    return;
  }
  if (state === 'intro') {
    e.preventDefault();
    if (!e.repeat && !['MetaLeft', 'MetaRight', 'AltLeft', 'AltRight'].includes(e.code)) beginFloor();
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (state === 'play') {
    if (e.code === 'KeyJ' || e.code === 'KeyF') yoyo();
    if (e.code === 'KeyL' || e.code === 'KeyR') sling();
    if (e.code === 'Space' || e.code === 'KeyK') dodge();
    if (e.code === 'Escape' || e.code === 'KeyP') pause(true);
  } else if (state === 'pause' && e.code === 'KeyP') pause(false);
  if (e.code === 'KeyM') setMute(!AU.muted);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  if (state === 'play') pause(true);
});
// ----- touch: a stick on the left, buttons on the right
$('#touch').addEventListener('pointerdown', () => {
  if (state === 'intro') beginFloor();
});
function touchControls() {
  const sz = $('#stickZone'),
    lz = $('#lookZone'),
    st = $('#stick'),
    knob = st.querySelector('i');
  let sid = null,
    sx = 0,
    sy = 0,
    lid = null,
    lx = 0,
    ly = 0;
  sz.addEventListener('pointerdown', e => {
    auInit();
    sid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    st.style.display = 'block';
    st.style.left = sx - 55 + 'px';
    st.style.top = sy - 55 + 'px';
    sz.setPointerCapture(e.pointerId);
  });
  sz.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - sx,
      dy = e.clientY - sy;
    const d = Math.hypot(dx, dy),
      m = 45;
    if (d > m) {
      dx *= m / d;
      dy *= m / d;
    }
    stick.x = dx / m;
    stick.y = -dy / m;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const endS = e => {
    if (e.pointerId !== sid) return;
    sid = null;
    stick.x = stick.y = 0;
    st.style.display = 'none';
    knob.style.transform = '';
  };
  sz.addEventListener('pointerup', endS);
  sz.addEventListener('pointercancel', endS);
  lz.addEventListener('pointerdown', e => {
    lid = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
    lz.setPointerCapture(e.pointerId);
  });
  lz.addEventListener('pointermove', e => {
    if (e.pointerId !== lid || state !== 'play') return;
    cam.yaw -= (e.clientX - lx) * 0.006;
    cam.pitch = clamp(cam.pitch + (e.clientY - ly) * 0.004, -0.22, 0.8);
    lx = e.clientX;
    ly = e.clientY;
  });
  const endL = e => {
    if (e.pointerId === lid) lid = null;
  };
  lz.addEventListener('pointerup', endL);
  lz.addEventListener('pointercancel', endL);
  $('#bYoyo').addEventListener('pointerdown', e => {
    e.preventDefault();
    yoyo();
  });
  $('#bSling').addEventListener('pointerdown', e => {
    e.preventDefault();
    sling();
  });
  $('#bDodge').addEventListener('pointerdown', e => {
    e.preventDefault();
    dodge();
  });
  // a press state set from the pointer, since :active is unreliable on these divs on touch screens
  for (const b of document.querySelectorAll('.tbtn')) {
    b.addEventListener('pointerdown', () => b.classList.add('down'));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('down'));
  }
}
touchControls();
// ----- a game controller: left stick moves, right stick looks, RT yo-yo, LT slingshot, A / B dodge, Start pauses; it also
// walks the menus
const PAD = { prev: [], move: { x: 0, y: 0 }, on: false, navT: 0, sel: null, active: false };
const padDZ = v => (Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8); // a dead zone so a resting stick does not drift
function padButtons() {
  // the buttons on whichever page is showing, in reading order
  const scr = ['title', 'card', 'pause', 'dead', 'win', 'catalogue'].map(id => $('#' + id)).find(el => !el.hidden);
  return scr
    ? [...scr.querySelectorAll('button')].filter(
        b =>
          !b.disabled &&
          b.offsetParent &&
          getComputedStyle(b).visibility !== 'hidden' &&
          getComputedStyle(b.closest('.pnav') || b).visibility !== 'hidden'
      )
    : [];
}
function padClear() {
  document.querySelectorAll('.padfocus').forEach(b => b.classList.remove('padfocus'));
  document.querySelectorAll('.padnav').forEach(b => b.classList.remove('padnav'));
  PAD.sel = null;
  PAD.active = false;
}
function padMark(bs) {
  // paint the selection: the selected button red, the rest of that page plain, nothing anywhere else
  const scr = bs.length ? bs[0].closest('.screen') : null;
  document.querySelectorAll('.padfocus').forEach(b => {
    if (b !== PAD.sel) b.classList.remove('padfocus');
  });
  document.querySelectorAll('.padnav').forEach(x => {
    if (x !== scr) x.classList.remove('padnav');
  });
  if (scr) scr.classList.add('padnav');
  if (PAD.sel) PAD.sel.classList.add('padfocus');
  const f = document.activeElement;
  if (f && f.tagName === 'BUTTON') f.blur(); // no browser focus ring, and no second press through the keyboard
}
function pollPad(dt) {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
  PAD.move.x = PAD.move.y = 0;
  if (!gp) {
    PAD.prev = [];
    return;
  }
  if (!PAD.on) {
    PAD.on = true;
    toast('Controller connected');
  }
  const B = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5)),
    hit = i => B(i) && !PAD.prev[i],
    ax = i => padDZ(gp.axes[i] || 0);
  let mx = ax(0),
    my = ax(1);
  if (B(12)) my -= 1;
  if (B(13)) my += 1;
  if (B(14)) mx -= 1;
  if (B(15)) mx += 1;
  if (state === 'play' || state === 'intro') PAD.hold = true;
  if (state === 'play') {
    if (PAD.active || PAD.sel) padClear(); // a menu opened later starts on its own main button
    PAD.move.x = clamp(mx, -1, 1);
    PAD.move.y = clamp(-my, -1, 1);
    cam.yaw -= ax(2) * 2.6 * dt;
    cam.pitch = clamp(cam.pitch + ax(3) * 1.6 * dt, -0.22, 0.8);
    if (B(7) || B(5) || B(2)) {
      auInit();
      yoyo();
    } // held, it keeps throwing as the cooldown allows, like a held key
    if (hit(6) || hit(4) || hit(3)) {
      auInit();
      sling();
    }
    if (hit(1) || hit(0)) dodge();
    if (hit(9)) pause(true);
  } else if (state === 'intro') {
    if (hit(0) || hit(1) || hit(9)) {
      auInit();
      beginFloor();
    }
  } else if (state !== 'leave' && state !== 'build') {
    const bs = padButtons();
    let nav = Math.abs(mx) > 0.5 || Math.abs(my) > 0.5 ? Math.sign(Math.abs(mx) > Math.abs(my) ? mx : my) : 0;
    if (!bs.length) PAD.hold = true; // nothing to pick yet (the death slow-down): a direction pushed now is still the game's
    if (PAD.hold) {
      if (nav) nav = 0;
      else PAD.hold = false;
    }
    if (nav || gp.buttons.some((_, i) => hit(i))) PAD.active = true; // any controller input in a menu: show the selection
    if (!bs.includes(PAD.sel))
      PAD.sel = bs.find(b => !b.classList.contains('ghost') && !b.closest('.pnav')) || bs.find(b => b.classList.contains('pnext')) || bs[0] || null; // the page's main button, else "next"
    PAD.navT -= dt;
    if (nav && PAD.navT <= 0 && bs.length) {
      PAD.sel = bs[(bs.indexOf(PAD.sel) + nav + bs.length) % bs.length];
      PAD.navT = 0.25;
    } else if (!nav) PAD.navT = 0;
    if (PAD.active) padMark(bs);
    if (hit(0) && PAD.sel) {
      auInit();
      PAD.sel.click();
    } else if (hit(4)) flip(-1);
    else if (hit(5)) flip(1);
    else if (hit(1) || hit(9)) {
      if (state === 'pause') pause(false);
      else if (!$('#catalogue').hidden) $('#catBack').click();
    }
  }
  if (hit(8)) setMute(!AU.muted);
  PAD.prev = gp.buttons.map((_, i) => B(i));
}
addEventListener('gamepaddisconnected', () => {
  PAD.on = false;
  PAD.move.x = PAD.move.y = 0;
  toast('Controller disconnected');
});
// ----- the screens' buttons
$('#startBtn').addEventListener('click', () => startGame(true));
$('#musicBtn').addEventListener('click', () => {
  auInit();
  tmusWant(!TMUS.want);
  TMUS.want ? tmusStart() : tmusStop();
});
$('#resumeBtn').addEventListener('click', () => pause(false));
$('#quitBtn').addEventListener('click', toTitle);
$('#retryBtn').addEventListener('click', () => enterFloor(floorIdx, true));
$('#restartBtn').addEventListener('click', () => {
  if (state !== 'pause') return;
  sprayStop();
  enterFloor(floorIdx, true);
});
$('#newGameBtn').addEventListener('click', () => startGame(true));
$('#pauseNewBtn').addEventListener('click', () => {
  if (state !== 'pause') return;
  sprayStop();
  startGame(true);
});
$('#titleBtn').addEventListener('click', toTitle);
$('#againBtn').addEventListener('click', () => startGame(true));
$('#winCatBtn').addEventListener('click', () => openCatalogue('win'));
$('#catBtn').addEventListener('click', () => openCatalogue('title'));
$('#catBack').addEventListener('click', () => showOnly(catFrom));
document.querySelectorAll('.pager .pprev').forEach(b => b.addEventListener('click', () => flip(-1)));
document.querySelectorAll('.pager .pnext').forEach(b => b.addEventListener('click', () => flip(1)));
