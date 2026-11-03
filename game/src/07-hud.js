// HUD: hints at the bottom (toast), talkers left, the big centred words, the boss bar, attack warnings, Red Cap's ties.
// Each talker's boss-bar status and warning come from its own file (TALKERS[type].bar / .warn).
let toastT = null;
// a hint at the bottom of the screen; longer ones stay longer (ms: exactly this long)
function toast(msg, ms) {
  const t = $('#toast');
  t.textContent = msg;
  t.style.opacity = 1;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.style.opacity = 0), ms || Math.max(3000, 1200 + msg.length * 45));
}
function updLeft() {
  if (!G) return;
  const n = aliveCount();
  $('#left').innerHTML = `${n ? n + (n === 1 ? ' talker' : ' talkers') + ' left' : 'Floor quiet'}<small>${G.F.num} · ${G.F.name}</small>`;
  $('#left').classList.toggle('last', n === 1);
  if (n === 1 && G.leftN > 1) lastCall();
  G.leftN = n;
}
// a big word in the middle of the screen (HOT, MISSED, FRENZY ...), with an optional smaller line under it
function bigWord(text, color, size = 1, under = '') {
  const el = $('#bigWord');
  el.style.fontSize = size === 1 ? '' : `clamp(${(2.4 * size).toFixed(3)}rem, ${(8 * size).toFixed(3)}vw, ${(5.4 * size).toFixed(3)}rem)`;
  const [word, line] = el.firstChild.children;
  word.textContent = text;
  line.textContent = under;
  el.style.color = color;
  el.classList.remove('on');
  void el.offsetWidth; // restart the animation
  el.classList.add('on');
}
// one talker left: 1 TALKER LEFT and its sting (two low hits and a rising scrape)
function lastCall() {
  const el = $('#lastCall');
  el.classList.remove('on');
  void el.offsetWidth; // restart the animation
  el.classList.add('on');
  const at = AU.at;
  AU.at = null;
  sTone({ f: 98, f2: 60, dur: 0.5, type: 'sawtooth', gain: 0.22 });
  sTone({ f: 73, f2: 45, dur: 0.7, type: 'sawtooth', gain: 0.22, at: 0.22 });
  sNoise({ dur: 0.9, f: 600, f2: 3200, q: 2, gain: 0.12, at: 0.1 });
  AU.at = at;
}
let bossShown = null,
  bossFill = -1,
  bossWord = null;
const EL = {
  spook: $('#spook'),
  boss: $('#boss'),
  bossName: $('#boss .name'),
  bossFill: $('#boss .fill'),
  bossState: $('#boss .state'),
  ret: $('#reticle'),
  wYoyo: $('#wYoyo'),
  wSling: $('#wSling'),
  bYoyo: $('#bYoyo'),
  bSling: $('#bSling'),
  bDodge: $('#bDodge')
};
const txt = (el, t) => {
  if (el.textContent !== t) el.textContent = t;
};
function bossBar(e) {
  const b = EL.boss;
  if (!e) {
    if (!b.hidden) b.hidden = true;
    bossShown = bossWord = null;
    return;
  }
  if (bossShown !== e) {
    EL.bossName.textContent = e.name;
    bossShown = e;
    bossFill = -1;
    bossWord = null;
  }
  if (b.hidden) b.hidden = false;
  const fp = Math.max(0, Math.round((e.hp / e.maxHp) * 1000) / 10);
  if (fp !== bossFill) {
    bossFill = fp;
    EL.bossFill.style.width = fp + '%';
  }
  // the status under the bar: [text, lit, word]. lit highlights the line; word ("now's your chance": EXPOSED, WINDED…)
  // flashes big mid-screen once as that state begins, and the line stays empty while it lasts
  const T = TALKERS[e.type],
    [text, lit, word = null] = (T && T.bar && T.bar(e)) || ['', false];
  txt(EL.bossState, text);
  EL.bossState.classList.toggle('open', lit);
  if (word && word !== bossWord) bigWord(word, HEX.bile, 1, 'Attack him!');
  bossWord = word;
}
// attack warnings: a marker over the Usher about to charge and the Geezer about to stare or lash (warnOf)
const WARN_N = 3,
  WARN = [],
  warnV = new THREE.Vector3();
let warnEdgeOn = false;
// a talker's warning now: { c: colour, k: how close the blow is 0..1, cue: changes when a new warning starts } or null
function warnOf(e) {
  if (e.dead || e.dying || e.dormant || e.caged) return null;
  const T = TALKERS[e.type];
  return (T && T.warn && T.warn(e)) || null;
}
// the Usher's cue: short and sharp, at full loudness wherever he stands (the Geezer has his own wail)
function warnCue(cue) {
  const at = AU.at;
  AU.at = null;
  if (cue[0] === 'B' || cue[0] === 'b') {
    sTone({ f: 620, f2: 1400, dur: 0.12, type: 'square', gain: 0.07, filt: [1800, 2600] });
    sTone({ f: 620, f2: 1400, dur: 0.12, type: 'square', gain: 0.07, filt: [1800, 2600], at: 0.14 });
  }
  AU.at = at;
}
// up to three markers over the talkers about to strike; off screen they pin to the edge and point at him
function updWarn() {
  if (!WARN.length)
    for (let k = 0; k < WARN_N; k++) {
      const d = document.createElement('div');
      d.className = 'warn';
      d.innerHTML = '<i></i><b>!</b>';
      document.body.appendChild(d);
      WARN.push({ d, arr: d.firstChild, on: false });
    }
  const W = innerWidth,
    H = innerHeight,
    now = performance.now() / 1000;
  let n = 0,
    edge = null;
  if (G && state === 'play')
    for (const e of G.enemies) {
      const w = warnOf(e);
      if (!w || e.pos.distanceTo(hero.pos) > 30) {
        e.warnCue = null;
        continue;
      }
      if (w.cue !== e.warnCue) warnCue(w.cue);
      e.warnCue = w.cue;
      if (n >= WARN_N) continue;
      const m = WARN[n++];
      // in the camera's own space first: behind it, he is pinned to the bottom edge, on his side
      warnV.set(e.pos.x, e.pos.y + hitHeight(e) + (e.hgt || 3) * 0.55, e.pos.z).applyMatrix4(camera.matrixWorldInverse);
      const behind = warnV.z > -0.3;
      let x, y;
      if (behind) {
        const l = Math.hypot(warnV.x, Math.abs(warnV.z) + 0.5) || 1;
        x = (warnV.x / l) * 4;
        y = ((Math.abs(warnV.z) + 0.5) / l) * 4;
      } else {
        warnV.applyMatrix4(camera.projectionMatrix);
        x = warnV.x;
        y = -warnV.y;
      }
      const mx = 1 - 64 / (W / 2),
        my = 1 - 64 / (H / 2),
        out = behind || Math.abs(x) > mx || Math.abs(y) > my;
      if (out) {
        // pinned to the edge, pointing at him
        const s = Math.min(mx / Math.max(Math.abs(x), 1e-3), my / Math.max(Math.abs(y), 1e-3));
        x *= s;
        y *= s;
      }
      const px = ((x + 1) / 2) * W,
        py = ((y + 1) / 2) * H,
        pulse = 1 + (0.12 + 0.2 * w.k) * Math.abs(Math.sin(now * (8 + 14 * w.k)));
      m.d.style.setProperty('--wc', w.c);
      m.d.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${pulse.toFixed(3)})`;
      m.arr.style.display = out ? '' : 'none';
      if (out) m.arr.style.transform = `rotate(${Math.atan2(y * H, x * W).toFixed(3)}rad) translate(30px)`;
      if (!m.on) {
        m.d.style.display = 'block';
        m.on = true;
      }
      if (!edge || w.k > edge.k) edge = { c: w.c, k: w.k, x: px, y: py, out };
    }
  for (let k = n; k < WARN.length; k++)
    if (WARN[k].on) {
      WARN[k].d.style.display = 'none';
      WARN[k].on = false;
    }
  const el = $('#warnEdge');
  if (edge) {
    // the side of the screen he is on glows in his colour, brighter as the blow comes
    const ex = edge.x - W / 2,
      ey = edge.y - H / 2,
      s = Math.max(Math.abs(ex) / (W / 2), Math.abs(ey) / (H / 2), 1e-3),
      gx = W / 2 + ex / s,
      gy = H / 2 + ey / s;
    el.style.background = `radial-gradient(circle at ${gx.toFixed(0)}px ${gy.toFixed(0)}px, ${edge.c} 0, ${edge.c}66 ${Math.round(Math.min(W, H) * 0.25)}px, transparent ${Math.round(Math.min(W, H) * 0.6)}px)`;
    el.style.opacity = ((0.5 + 0.4 * edge.k) * (0.75 + 0.25 * Math.sin(now * 16))).toFixed(3);
    warnEdgeOn = true;
  } else if (warnEdgeOn) {
    el.style.opacity = 0;
    warnEdgeOn = false;
  }
}
// Red Cap's health: a row of ties
function drawTies() {
  $('#ties').innerHTML = Array.from({ length: hero.maxHp }, (_, i) => `<div class="tie${i < hero.hp ? '' : ' gone'}"></div>`).join('');
}
