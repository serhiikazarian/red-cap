// The camera: over Red Cap's shoulder (the shoulder side shrinks against a wall), never inside a wall or a raised floor, held
// off see-through things, shaking on big blows and dipping when he is hurt.
// how quickly it keeps up (ease rates, per second): its height on ramps and raised ground, the shoulder offset near a wall, the
// arm drawing in against a wall, and back out once the way has stayed clear for CAM_EASE.hold s
const CAM_EASE = { height: 20, shoulder: 18, armIn: 22, armOut: 10, hold: 0.28 },
  CAM_TURN = 3.2, // rad/s: turning with the keys, a stick at full tilt, or the mouse at the screen's edge
  CAM_TILT = 2.0; // rad/s: a stick looking up or down
const camPivot = new THREE.Vector3(), // reused vectors: no garbage every frame
  camArm = new THREE.Vector3(),
  camProbe = new THREE.Vector3();

function updateCamera(dt) {
  cam.hy = cam.hy == null ? hero.pos.y : lerp(cam.hy, hero.pos.y, ease(CAM_EASE.height, dt));
  const fx = -Math.sin(cam.yaw),
    fz = -Math.cos(cam.yaw),
    pivot = pushOffWall(camPivotAt(dt), 0.6, 0.62);
  const cp = Math.cos(cam.pitch),
    arm = camArm.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
  camEase(camReach(pivot, arm), dt);
  camera.position.copy(pivot).addScaledVector(arm, cam.cur);
  pushOffWall(camera.position, 0.43, 0.45); // a hand's width off any wall
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt);
    const a = cam.shake * 0.35;
    camera.position.x += rand(-a, a);
    camera.position.y += rand(-a, a);
  }
  camera.lookAt(pivot.x + fx * 2.5, pivot.y - 0.1, pivot.z + fz * 2.5);
  if (cam.hurt > 0) {
    // a short soft jolt when hit: two slow sines that fade out, no random jitter
    cam.hurt = Math.max(0, cam.hurt - dt);
    const k = cam.hurt / 0.34,
      env = k * k,
      t = 0.34 - cam.hurt;
    camera.rotateZ(Math.sin(t * 36) * 0.02 * env);
    camera.translateX(Math.sin(t * 30 + 1) * 0.06 * env);
    camera.translateY(Math.sin(t * 42) * 0.035 * env);
  }
  heroFade();
  if (state === 'play') updateReticle(dt);
  camera.updateMatrixWorld();
  seeTick(dt);
}
// the point the camera orbits: over Red Cap's right shoulder, the offset shrinking (quickly, without snapping) near a wall
function camPivotAt(dt) {
  const rx = Math.cos(cam.yaw),
    rz = -Math.sin(cam.yaw);
  let shWant = camera.aspect < 1 ? 0.3 : 0.65;
  for (let k = 0; k < 5 && shWant > 0 && wallDist(hero.pos.x + rx * shWant, hero.pos.z + rz * shWant) < 0.4; k++) shWant -= 0.15;
  shWant = Math.max(0, shWant);
  cam.sh = cam.sh == null ? shWant : lerp(cam.sh, shWant, ease(CAM_EASE.shoulder, dt));
  return camPivot.set(hero.pos.x + rx * cam.sh, 1.75 + cam.hy, hero.pos.z + rz * cam.sh);
}
// closer than `near` to a wall: slide out along the wall's normal to `to`, never through it (moves p; returns it)
function pushOffWall(p, near, to) {
  for (let k = 0; k < 3; k++) {
    const d = wallDist(p.x, p.z);
    if (d >= near) break;
    const gx = wallDist(p.x + 0.06, p.z) - wallDist(p.x - 0.06, p.z),
      gz = wallDist(p.x, p.z + 0.06) - wallDist(p.x, p.z - 0.06),
      gl = Math.hypot(gx, gz);
    if (gl < 1e-4) break;
    p.x += (gx / gl) * (to - d);
    p.z += (gz / gl) * (to - d);
  }
  return p;
}
// how far back along the arm the camera may sit
function camReach(pivot, arm) {
  // probe along the arm: stop short of walls and raised floors
  let hit = cam.dist;
  for (let st = 0.15; st <= cam.dist; st += 0.08) {
    const q = camProbe.copy(pivot).addScaledVector(arm, st);
    if (wallDist(q.x, q.z) < 0.52 || q.y < heightAt(q.x, q.z) + 0.3) {
      hit = Math.max(0.3, st - 0.12);
      break;
    }
  }
  // nor inside or flush against a pillar, prop or floating thing: it may stand behind one (which then fades), never in one
  // (a floor with camThruFloaters: its drifting things don't push it in, they only fade)
  seeShapes();
  {
    let st = hit;
    while (st > 0.3 && seeInside(camProbe.copy(pivot).addScaledVector(arm, st), SEE_PAD, G.F.camThruFloaters)) st -= 0.08;
    if (st > 0.3) hit = st; // nowhere clear along the arm (he is pressed against one): stay, and it fades
  }
  return hit;
}
// the arm's length follows the reach (cam.cur)
function camEase(hit, dt) {
  // in fast but not in one jump; back out only once the way has stayed clear for a moment, so a flickering probe can't make it drift
  if (cam.cur != null && hit < cam.cur - 0.05) cam.hold = CAM_EASE.hold;
  else cam.hold = Math.max(0, (cam.hold || 0) - dt);
  if (cam.cur == null) cam.cur = hit;
  else if (hit < cam.cur) cam.cur = Math.min(lerp(cam.cur, hit, ease(CAM_EASE.armIn, dt)), hit + 0.15);
  else if (cam.hold <= 0) cam.cur = lerp(cam.cur, hit, ease(CAM_EASE.armOut, dt));
}
// when the camera is pressed right up behind him, Red Cap goes see-through instead of filling the screen
function heroFade() {
  const fade = clamp((cam.cur - 0.7) / 1.2, 0.28, 1) * (hero.inSmoke ? 0.55 : 1); // greyed out while hidden in smoke
  if (hero.parts.mats)
    hero.parts.mats.forEach(m => {
      m.opacity = fade;
    });
  if (hero.parts.inks)
    hero.parts.inks.forEach(u => {
      u.value = fade;
    });
}
// the crosshair only shows when there is something to aim at, or for a moment after a throw or a shot
function updateReticle(dt) {
  const a = aimInfo(true), // the reticle shows the slingshot's lock (a pyramid too)
    ret = HUD.ret;
  hero.aimT = Math.max(0, (hero.aimT || 0) - dt);
  const show = (a.target && a.target.pos.distanceTo(hero.pos) < 20) || hero.aimT > 0;
  if (show) {
    if (a.target) tmpV.set(a.target.pos.x, hitHeight(a.target), a.target.pos.z);
    else tmpV.set(hero.pos.x + a.fx * 14, 1.35 + hero.pos.y, hero.pos.z + a.fz * 14);
    tmpV.project(camera);
    const tf = `translate(${Math.round((tmpV.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-tmpV.y * 0.5 + 0.5) * innerHeight)}px)`;
    if (tf !== ret.dataset.tf) {
      ret.dataset.tf = tf;
      ret.style.transform = tf;
    }
  }
  SEE.tg = a.target;
  ret.classList.toggle('show', !!show);
  ret.classList.toggle('lock', !!a.target);
  ret.classList.toggle('pyr', !!a.target && !!a.target.pyr); // a pyramid: the lock's ring stays white
  ret.classList.toggle('reach', !!a.target && !a.target.pyr && yoyoReachFor(a.target, yoyoNextThird() ? 4.5 : 3.8) !== null);
  HUD.wYoyo.classList.toggle('cd', hero.yoyoCd > 0);
  HUD.wSling.classList.toggle('cd', hero.slingCd > 0);
  if (touchUI) {
    HUD.bYoyo.classList.toggle('cd', hero.yoyoCd > 0);
    HUD.bSling.classList.toggle('cd', hero.slingCd > 0 || hero.ammo <= 0);
    HUD.bDodge.classList.toggle('cd', hero.dodgeCd > 0);
  }
}
