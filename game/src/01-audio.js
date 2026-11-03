// Sound: everything is synthesised with Web Audio except a few recorded clips (assets/sfx, as SOUNDS).
// AU.at is where the sound being made comes from (null: Red Cap or the whole floor); sounds fade with distance from Red Cap.
const AU = { ctx: null, master: null, muted: false, drone: [], at: null },
  MASTER_GAIN = 0.75,
  SND_NEAR = 4; // full volume within this many metres
function auK(p) {
  if (!p) return 1;
  const d = Math.hypot(p.x - hero.pos.x, p.z - hero.pos.z);
  return d <= SND_NEAR ? 1 : Math.max(0.05, Math.pow(SND_NEAR / d, 1.4));
}
function auInit() {
  if (AU.ctx) {
    if (AU.ctx.state === 'suspended') AU.ctx.resume();
    return;
  }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  const ctx = (AU.ctx = new C());
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 6;
  AU.master = ctx.createGain();
  AU.master.gain.value = AU.muted ? 0 : MASTER_GAIN;
  AU.master.connect(comp);
  comp.connect(ctx.destination);
  // two seconds of white noise, shared by every noisy sound
  const len = ctx.sampleRate * 2,
    b = ctx.createBuffer(1, len, ctx.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = b;
  AU.buf = {};
  // the recorded clips decode in the background; sPlay skips one that is not ready yet
  for (const [k, url] of Object.entries(SOUNDS)) {
    const bin = atob(url.slice(url.indexOf(',') + 1)),
      bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    ctx.decodeAudioData(bytes.buffer).then(
      buf => (AU.buf[k] = buf),
      () => {}
    );
  }
}
// a recorded clip; returns its source and gain so it can be faded out
function sPlay(name, gain = 1) {
  if (!AU.ctx || !AU.buf || !AU.buf[name]) return null;
  const s = AU.ctx.createBufferSource(),
    g = AU.ctx.createGain();
  s.buffer = AU.buf[name];
  g.gain.value = gain * auK(AU.at);
  s.connect(g);
  g.connect(AU.master);
  s.start();
  return { s, g };
}
// an attack-decay envelope on gain g
function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
// filtered noise; at delays it, a is the attack
function sNoise({ dur = 0.2, f = 1200, f2 = null, q = 1, type = 'bandpass', gain = 0.4, at = 0, a = 0.005 }) {
  if (!AU.ctx) return;
  gain *= auK(AU.at);
  const t = AU.ctx.currentTime + at;
  const s = AU.ctx.createBufferSource();
  s.buffer = AU.noise;
  s.loop = true;
  const fl = AU.ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  fl.Q.value = q;
  const g = AU.ctx.createGain();
  env(g, t, a, gain, dur);
  s.connect(fl);
  fl.connect(g);
  g.connect(AU.master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}
// an oscillator, optionally gliding to f2 and through a gliding band-pass (filt: [from, to])
function sTone({ f = 440, f2 = null, dur = 0.2, type = 'sine', gain = 0.3, at = 0, a = 0.005, filt = null }) {
  if (!AU.ctx) return;
  gain *= auK(AU.at);
  const t = AU.ctx.currentTime + at;
  const o = AU.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = AU.ctx.createGain();
  env(g, t, a, gain, dur);
  let n = o;
  if (filt) {
    const fl = AU.ctx.createBiquadFilter();
    fl.type = 'bandpass';
    fl.Q.value = 3;
    fl.frequency.setValueAtTime(filt[0], t);
    fl.frequency.exponentialRampToValueAtTime(filt[1], t + dur);
    o.connect(fl);
    n = fl;
  }
  n.connect(g);
  g.connect(AU.master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
// the game's sound effects
const SFX = {
  yoyo() {
    sTone({ f: 300, f2: 900, dur: 0.16, type: 'sawtooth', gain: 0.06, filt: [600, 2400] });
    sTone({ f: 900, f2: 280, dur: 0.18, type: 'sawtooth', gain: 0.05, at: 0.17, filt: [2400, 600] });
    sNoise({ dur: 0.3, f: 1800, q: 6, gain: 0.08 });
  },
  sling() {
    sTone({ f: 180, f2: 620, dur: 0.09, type: 'triangle', gain: 0.25 });
    sNoise({ dur: 0.12, f: 3000, f2: 1200, q: 2, gain: 0.18, at: 0.02 });
  },
  hit(k = 1) {
    // k: pitch (a chained attack's hits rise, mixPitch)
    sTone({ f: 140 * k, f2: 50 * k, dur: 0.18, gain: 0.5 });
    sNoise({ dur: 0.22, f: 2400 * k, f2: 900 * k, q: 2, gain: 0.3, at: 0.01 });
  },
  tink() {
    sTone({ f: 1900, f2: 1700, dur: 0.25, type: 'triangle', gain: 0.14 });
    sTone({ f: 2850, dur: 0.18, type: 'sine', gain: 0.06 });
  },
  tear() {
    sNoise({ dur: 0.5, f: 3000, f2: 400, q: 3, gain: 0.35 });
    sTone({ f: 90, f2: 40, dur: 0.5, type: 'sawtooth', gain: 0.15 });
  },
  hurt() {
    sTone({ f: 220, f2: 70, dur: 0.3, type: 'square', gain: 0.16 });
    sNoise({ dur: 0.25, f: 500, q: 1, gain: 0.35 });
  },
  step() {
    sNoise({ dur: 0.06, f: 300 + Math.random() * 120, q: 2, gain: 0.07, type: 'lowpass' });
  },
  dodge() {
    sNoise({ dur: 0.22, f: 600, f2: 2600, q: 1, gain: 0.2 });
  },
  pickup() {
    [660, 880, 1320].forEach((f, i) => sTone({ f, dur: 0.25, gain: 0.14, at: i * 0.07, type: 'triangle' }));
  },
  portal() {
    [110, 165, 220, 277].forEach((f, i) => sTone({ f, dur: 1.6, gain: 0.1, at: i * 0.08, type: 'sawtooth', a: 0.2 }));
  },
  wah() {
    sTone({ f: 190, f2: 85, dur: 0.42, type: 'sawtooth', gain: 0.32, filt: [900, 380] });
    sTone({ f: 95, f2: 60, dur: 0.4, type: 'square', gain: 0.12 });
  },
  fireball() {
    sNoise({ dur: 0.45, f: 300, f2: 1400, q: 1.5, gain: 0.28 });
    sTone({ f: 120, f2: 300, dur: 0.3, type: 'sawtooth', gain: 0.07 });
  },
  boom() {
    sTone({ f: 80, f2: 30, dur: 0.6, gain: 0.6 });
    sNoise({ dur: 0.5, f: 900, f2: 120, type: 'lowpass', gain: 0.5 });
  },
  growl() {
    sTone({ f: 70, f2: 55, dur: 0.8, type: 'sawtooth', gain: 0.2, filt: [400, 200] });
  },
  bless() {
    sTone({ f: 330, f2: 440, dur: 0.7, gain: 0.12, a: 0.1 });
    sTone({ f: 415, f2: 554, dur: 0.7, gain: 0.08, a: 0.1 });
  },
  rain() {
    sNoise({ dur: 1.1, f: 700, q: 0.7, gain: 0.22, a: 0.15 });
  },
  villain(short) {
    // a cartoon villain's laugh, one HA per syllable [start, length, pitch from, to]
    const syl = short
      ? [
          [0, 0.32, 150, 124],
          [0.36, 0.15, 128, 118],
          [0.55, 0.15, 122, 112],
          [0.74, 0.5, 114, 84]
        ]
      : [
          [0, 0.55, 156, 122],
          [0.62, 0.16, 134, 124],
          [0.82, 0.16, 129, 119],
          [1.0, 0.16, 124, 114],
          [1.18, 0.16, 119, 108],
          [1.37, 0.18, 112, 100],
          [1.62, 1.1, 108, 72]
        ];
    syl.forEach(([at, d, f, f2]) => {
      sNoise({ dur: 0.07, f: 1500, q: 0.7, gain: 0.12, at }); // the breath of each HA
      for (const [c0, c1, g] of [
        [820, 640, 0.14],
        [1250, 980, 0.07]
      ])
        sTone({ f, f2, dur: d, type: 'sawtooth', gain: g, at: at + 0.03, a: 0.03, filt: [c0, c1] });
      sTone({ f: f / 2, f2: f2 / 2, dur: d, type: 'sine', gain: 0.13, at: at + 0.03, a: 0.03 });
    });
  },
  laugh(deep) {
    // the Jester's laugh fills the floor (never quieted by distance); deep: the last stretch of his fight, louder and an octave down
    const at = AU.at;
    AU.at = null;
    [0, 0.16, 0.32, 0.5].forEach((t, i) => {
      sTone({ f: 420 - i * 30, f2: 300 - i * 25, dur: 0.13, type: 'sawtooth', gain: deep ? 0.28 : 0.16, at: t, filt: [1400, 700] });
      if (deep) sTone({ f: 210 - i * 15, f2: 150 - i * 12, dur: 0.13, type: 'square', gain: 0.07, at: t, filt: [700, 350] });
    });
    AU.at = at;
  },
  pop() {
    // a Priest's ghost bursting like a soap bubble
    sNoise({ dur: 0.03, f: 5000, q: 0.8, gain: 0.225, a: 0.001 });
    sTone({ f: 380, f2: 1500, dur: 0.14, type: 'sine', gain: 0.225, a: 0.002 });
    sTone({ f: 1500, f2: 700, dur: 0.1, type: 'triangle', gain: 0.075, at: 0.06, a: 0.002 });
    sNoise({ dur: 0.15, f: 2500, f2: 900, q: 1.2, gain: 0.07, at: 0.03 });
  },
  shadePop() {
    // a Shade going like a burst gum bubble (lower than a ghost's pop)
    sNoise({ dur: 0.03, f: 3000, q: 0.7, gain: 0.25, a: 0.001 });
    sTone({ f: 700, f2: 150, dur: 0.22, type: 'sine', gain: 0.3, a: 0.002 });
    sTone({ f: 260, f2: 90, dur: 0.12, type: 'triangle', gain: 0.15, a: 0.002 });
    sNoise({ dur: 0.18, f: 1200, f2: 400, q: 1, gain: 0.06, at: 0.01 });
  },
  unmask() {
    sNoise({ dur: 0.3, f: 800, f2: 3000, q: 3, gain: 0.15 });
    sTone({ f: 523, f2: 784, dur: 0.3, type: 'triangle', gain: 0.12 });
  },
  alarm() {
    // the ending's phone alarm: a marimba riff, three times
    const notes = [1046.5, 1318.5, 1568, 2093, 1568, 1318.5, 1568, 2093];
    for (let r = 0; r < 3; r++)
      notes.forEach((f, i) => {
        const at = r * 1.45 + i * 0.15;
        sTone({ f, dur: 0.3, type: 'sine', gain: 0.1, at, a: 0.002 });
        sTone({ f: f * 4, dur: 0.06, type: 'sine', gain: 0.022, at, a: 0.001 });
        sTone({ f: f / 2, dur: 0.22, type: 'triangle', gain: 0.035, at, a: 0.002 });
      });
  },
  morning() {
    [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => sTone({ f, dur: 2.6, gain: 0.09, at: 4.6 + i * 0.2, type: 'triangle', a: 0.06 }));
  },
  psyRise(d) {
    sTone({ f: 180, f2: 900, dur: d, type: 'sine', gain: 0.12, a: 0.05 });
    sTone({ f: 270, f2: 1350, dur: d, type: 'triangle', gain: 0.06, a: 0.05 });
  },
  psyFlash() {
    sNoise({ dur: 0.35, f: 4000, f2: 600, q: 1, gain: 0.3 });
    sTone({ f: 1800, f2: 150, dur: 0.5, type: 'sine', gain: 0.2 });
  },
  click() {
    sTone({ f: 1600, dur: 0.04, type: 'square', gain: 0.08 });
  },
  heartbeat() {
    sTone({ f: 60, f2: 40, dur: 0.14, gain: 0.35 });
    sTone({ f: 55, f2: 38, dur: 0.14, gain: 0.25, at: 0.2 });
  }
};
// the Priest's spray: one looping clip whose loudness follows him
let sprayNode = null;
function sprayStart() {
  if (sprayNode) return;
  sprayNode = sPlay('vomit', 0.6);
  if (sprayNode) sprayNode.at = AU.at;
}
function sprayFollow() {
  if (!sprayNode || !sprayNode.at) return;
  sprayNode.g.gain.setTargetAtTime(0.6 * auK(sprayNode.at), AU.ctx.currentTime, 0.08);
}
function sprayStop() {
  if (!sprayNode) return;
  const { s, g } = sprayNode,
    t = AU.ctx.currentTime;
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + 0.6);
  s.stop(t + 0.65);
  sprayNode = null;
}
// each floor's background drone (FLOORS[].drone): detuned oscillators through a slowly wobbling low-pass
function droneStart(spec) {
  droneStop();
  if (!AU.ctx) return;
  const ctx = AU.ctx,
    t = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(spec.gain, t + 3);
  bus.connect(AU.master);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = spec.cut;
  lp.Q.value = 4;
  lp.connect(bus);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = spec.lfo;
  const lg = ctx.createGain();
  lg.gain.value = spec.cut * 0.6;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  lfo.start();
  const nodes = [bus, lfo];
  spec.notes.forEach((f, i) => {
    [-4, 4].forEach(dt => {
      const o = ctx.createOscillator();
      o.type = spec.wave;
      o.frequency.value = f;
      o.detune.value = dt + i * 2;
      o.connect(lp);
      o.start();
      nodes.push(o);
    });
  });
  AU.drone = nodes;
}
function droneStop() {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime;
  AU.drone.forEach(n => {
    if (n.gain) {
      n.gain.cancelScheduledValues(t);
      n.gain.setValueAtTime(n.gain.value, t);
      n.gain.linearRampToValueAtTime(0, t + 0.8);
    } else
      try {
        n.stop(t + 1);
      } catch {}
  });
  AU.drone = [];
}
// the title music: a low pad, a music-box melody (0 = rest) with an echo, and a bass thump every bar
const TMUS = { bus: null, nodes: [], timer: 0, next: 0, step: 0 },
  TMUS_BEAT = 0.75,
  TMUS_BOX = [293.66, 349.23, 415.3, 440, 554.37, 440, 415.3, 349.23, 293.66, 311.13, 415.3, 369.99, 293.66, 0, 277.18, 0];
function tmusStart() {
  if (!AU.ctx || TMUS.bus) return;
  const ctx = AU.ctx,
    t = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(0.55, t + 2.5);
  bus.connect(AU.master);
  const dl = ctx.createDelay(1),
    fb = ctx.createGain(),
    dlp = ctx.createBiquadFilter();
  dl.delayTime.value = TMUS_BEAT * 0.75;
  fb.gain.value = 0.38;
  dlp.type = 'lowpass';
  dlp.frequency.value = 1800;
  dl.connect(dlp);
  dlp.connect(fb);
  fb.connect(dl);
  dlp.connect(bus);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 160;
  lp.Q.value = 6;
  lp.connect(bus);
  const lfo = ctx.createOscillator(),
    lg = ctx.createGain();
  lfo.frequency.value = 0.07;
  lg.gain.value = 90;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  lfo.start();
  const nodes = [lfo];
  [
    [36.71, -7],
    [36.71, 6],
    [51.91, 3]
  ].forEach(([f, d]) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = d;
    g.gain.value = 0.22;
    o.connect(g);
    g.connect(lp);
    o.start();
    nodes.push(o);
  });
  Object.assign(TMUS, { bus, nodes, dl, next: t + 0.3, step: 0 });
  TMUS.timer = setInterval(tmusTick, 120);
  tmusTick();
}
function tmusNote(f, at, dur, gain, type) {
  const ctx = AU.ctx,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = (Math.random() - 0.5) * 18; // a little out of tune
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  o.connect(g);
  g.connect(TMUS.bus);
  g.connect(TMUS.dl);
  o.start(at);
  o.stop(at + dur + 0.05);
}
// schedules the notes of the next half second (called every 120 ms)
function tmusTick() {
  if (!TMUS.bus) return;
  const now0 = AU.ctx.currentTime;
  if (TMUS.next < now0) TMUS.next = now0 + 0.05; // after a sleeping tab: no burst of missed notes
  while (TMUS.next < now0 + 0.5) {
    const s = TMUS.step % TMUS_BOX.length,
      at = TMUS.next,
      f = TMUS_BOX[s];
    if (f) {
      tmusNote(f, at, 2.2, 0.09, 'sine');
      tmusNote(f * 2.01, at, 0.9, 0.025, 'triangle');
    }
    if (s % 8 === 0) {
      tmusNote(55, at, 0.5, 0.3, 'sine');
      tmusNote(41.2, at + 0.32, 0.45, 0.22, 'sine');
    }
    TMUS.step++;
    TMUS.next += TMUS_BEAT * (s === TMUS_BOX.length - 1 ? 2 : 1);
  }
}
function tmusStop() {
  if (!TMUS.bus) return;
  const t = AU.ctx.currentTime,
    b = TMUS.bus;
  clearInterval(TMUS.timer);
  b.gain.cancelScheduledValues(t);
  b.gain.setValueAtTime(b.gain.value, t);
  b.gain.linearRampToValueAtTime(0, t + 0.8);
  TMUS.nodes.forEach(n => n.stop(t + 0.9));
  setTimeout(() => b.disconnect(), 1500);
  TMUS.bus = null;
}
// whether the title music should play; showOnly starts and stops it with the title screen
function tmusWant(on) {
  TMUS.want = on;
  $('#musicBtn').classList.toggle('playing', on);
  $('#musicBtn').setAttribute('aria-label', on ? 'Music is on: turn it off' : 'Music is off: turn it on');
}
function setMute(m) {
  AU.muted = m;
  if (AU.master) AU.master.gain.value = m ? 0 : MASTER_GAIN;
}
