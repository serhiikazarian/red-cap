// Start-up: load the pictures, make the canvas textures, build Red Cap and the particle pools, then the title. While the
// paper is still being cut ("Cuttin’ paper…" stays at least TITLE_MIN), the work every start would otherwise pay for is done:
// compile the ink pass and Red Cap, build and warm floor one once (its shaders compiled, its pictures uploaded, so the first
// loading screen only rebuilds it fresh), and decode the pictures off the main thread (each floor uploads its own in warmUp)
const TITLE_MIN = 1000; // ms "Cuttin’ paper…" stays on the title at least
async function titleWarm() {
  if (state !== 'title') return;
  renderer.compile(inkScene, postCam);
  renderer.compile(scene, camera);
  floorBuilt(0); // not drawn: the title covers the world, and Start builds floor one again with its own dice
  for (const t of Object.values(TEX)) {
    if (state !== 'title') return; // started: warmUp does the rest
    const im = t.image;
    if (im && im.decode) await im.decode().catch(() => {});
  }
}
(async function boot() {
  const bootAt = performance.now();
  slidesOn(true); // the slideshow runs from the first moment, while the paper is still being cut
  {
    const th = $('#titleHero');
    th.onload = () => th.classList.add('loaded');
    th.alt = 'Red Cap, the hero';
    th.src = ASSETS.hero_head;
  }
  try {
    const faces = ['64px "Permanent Marker"', '16px "Courier Prime"', '700 16px "Courier Prime"', '64px "Rock Salt"'].map(f =>
      document.fonts.load(f)
    );
    await Promise.race([Promise.all(faces), new Promise(r => setTimeout(r, 2500))]);
  } catch {}
  await loadTextures();
  fireTex = glowTex('#ffcf3a', 'rgba(255,70,20,.75)');
  violetTex = glowTex('#e4b8ff', 'rgba(132,44,232,.8)');
  spikeTex = spikeFootTex();
  glowRed = glowTex('#ff4a3a', 'rgba(216,33,42,.5)');
  waveTex = makeWaveTex();
  smokeTex = makeSmokeTex();
  for (const m of PUFF_MESHES) {
    m.material.uniforms.map.value = smokeTex;
    scene.add(m);
  }
  fogNoiseTex = makeFogNoise();
  poolInit();
  scene.add(buildHero());
  slingModel = buildSling();
  scene.add(slingModel);
  scene.matrixAutoUpdate = false;
  hero.parts.mats.forEach(m => {
    m.transparent = true;
  });
  titleWarm(); // compiles at once, then decodes in the background
  await new Promise(r => setTimeout(r, TITLE_MIN - (performance.now() - bootAt)));
  const sb = $('#startBtn');
  sb.disabled = false;
  sb.textContent = 'Start';
  if (!$('#title').hidden) sb.focus({ preventScroll: true }); // the title opened while it was still a label
  $('#catBtn').hidden = !catalogueSeen.won;
  requestAnimationFrame(frame);
})().catch(err => {
  $('#loading').textContent = 'Could not load: ' + err.message;
  console.error(err);
});
