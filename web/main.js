// Đảo Đèn Lồng — browser view. All rules live in ../src/sim.js (same code the headless runner uses);
// this file only reads input, renders the state and plays effects. Nothing here changes headless output.
import * as THREE from "./vendor/three.module.min.js";
import { createGame, step, timeLeft, TICK_HZ, TUNING, WORLD } from "../src/sim.js";

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x0d0a1a), DAWNISH = new THREE.Color(0x3a2a4a);
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(0x140c26, 0.035);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const ambient = new THREE.HemisphereLight(0x8a7ad0, 0x2a2050, 0.7);
scene.add(ambient);

// ---------- static world ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 3, 3, 64), mat(0x2b3a2e));
island.position.y = -1.5;
scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(220, 48), mat(0x2a1f45, { roughness: 1 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -4;
scene.add(sea);
{ // decorative rocks and pines, fixed layout (visual only)
  let a = 7;
  const r01 = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const ang = r01() * Math.PI * 2, rad = 30 + r01() * 8; // edge only: pines must not hide Mây from the camera
    const pine = new THREE.Mesh(new THREE.ConeGeometry(0.8 + r01(), 2.5 + r01() * 2, 7), mat(0x1f3326));
    pine.position.set(Math.sin(ang) * rad, 1.4, Math.cos(ang) * rad);
    scene.add(pine);
  }
}

// ---------- Mây: conical hat (nón lá) with a small lantern hanging from the brim ----------
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.9, 12), mat(0x7a3b52));
body.position.y = 0.45;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xf1c7a3));
head.position.y = 1.08;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.34, 24), mat(0xe8d39a));
hat.position.y = 1.42;
const miniLantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), new THREE.MeshStandardMaterial({ color: 0xffa64d, emissive: 0xff8a2a, emissiveIntensity: 2 }));
miniLantern.position.set(0.5, 1.08, 0.2);
const playerLight = new THREE.PointLight(0xffa64d, 6, 12, 1.6);
playerLight.position.copy(miniLantern.position);
player.add(body, head, hat, miniLantern, playerLight);
scene.add(player);

// ---------- dynamic objects keyed by sim id ----------
const lanternViews = new Map(), moteViews = new Map(), shadeViews = new Map();
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd36b });
const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const haloMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
const haloGeo = new THREE.SphereGeometry(0.45, 10, 8);

function lanternView(l) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), mat(0x3b2a20));
  pole.position.y = 1.6;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a2a30, emissive: 0x000000 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 12), lampMat);
  lamp.position.y = 3.6;
  const light = new THREE.PointLight(0xffa040, 0, 26, 1.3);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(pole, lamp, light, ring);
  g.position.set(...l.pos);
  scene.add(g);
  return { g, lampMat, light, ring, lit: false };
}

function shadeView() {
  const g = new THREE.Group();
  const blobMat = new THREE.MeshStandardMaterial({ color: 0x1a0f2e, emissive: 0x2a1048, roughness: 0.4 });
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), blobMat);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc58cff });
  for (const x of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    eye.position.set(x, 0.2, 0.7);
    g.add(eye);
  }
  g.add(blob);
  scene.add(g);
  return { g, blobMat, eyeMat };
}

// ---------- effects (visual + sound only) ----------
const effects = [];
function pulseRing(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 48), new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], 0.2, pos[2]);
  scene.add(m);
  effects.push({ obj: m, t: 0, dur: 0.5, update: (k) => { m.scale.setScalar(1 + k * (TUNING.pulse_radius / 0.8 - 1)); m.material.opacity = 1 - k; } });
}
function skyLanterns(pos) { // "đèn trời": paper lanterns drift up from a newly lit lantern
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true }));
    const dx = (Math.random() - 0.5) * 3, dz = (Math.random() - 0.5) * 3;
    m.position.set(pos[0] + dx, 4, pos[2] + dz);
    scene.add(m);
    effects.push({ obj: m, t: 0, dur: 6 + Math.random() * 3, update: (k) => { m.position.y = 4 + k * 22; m.position.x += Math.sin(k * 9 + i) * 0.01; m.material.opacity = 1 - k * k; } });
  }
}
let audio;
function tone(freqs, dur = 0.25, type = "sine", gain = 0.08) {
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    freqs.forEach((f, i) => {
      const o = audio.createOscillator(), gn = audio.createGain();
      o.type = type;
      o.frequency.value = f;
      gn.gain.setValueAtTime(gain, t0 + i * 0.07);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.07 + dur);
      o.connect(gn).connect(audio.destination);
      o.start(t0 + i * 0.07);
      o.stop(t0 + i * 0.07 + dur);
    });
  } catch { /* audio is optional */ }
}
let toastTimer;
function toast(text) {
  $("toast").textContent = text;
  $("toast").style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").style.opacity = 0), 1600);
}

// ---------- input ----------
const keys = new Set();
const held = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
let camYaw = 0, dragX = null;
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Enter" && mode !== "playing") startGame();
  if (e.code === "KeyR" && mode === "over") startGame();
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
renderer.domElement.addEventListener("pointerdown", (e) => { dragX = e.clientX; });
addEventListener("pointerup", () => { dragX = null; });
addEventListener("pointermove", (e) => {
  if (dragX === null) return;
  camYaw -= (e.clientX - dragX) * 0.3; // drag right => look right (yaw decreases, see contract formula)
  dragX = e.clientX;
});

function readInput(dt) {
  if (keys.has("ArrowLeft")) camYaw += 90 * dt;
  if (keys.has("ArrowRight")) camYaw -= 90 * dt;
  const f = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const r = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  held.move = [-r, f]; // contract: x=+1 is world +X at yaw 0, which is screen-left for a camera looking along +Z
  held.cam_yaw_deg = camYaw;
  held.jump = keys.has("Space");
  held.interact = keys.has("KeyE");
  held.pulse = keys.has("KeyF");
  return held;
}

// ---------- game state ----------
let game, mode = "title", acc = 0, last = performance.now(), litCount = 0;
const reasons = { all_lit: "Bạn đã thắp lại cả 5 Đèn Lồng Lớn!", dawn: "Trời đã sáng mà đảo vẫn còn tối.", no_flames: "Mây đã hết lửa." };

function startGame() {
  for (const m of [lanternViews, moteViews, shadeViews]) { for (const v of m.values()) scene.remove(v.g ?? v); m.clear(); }
  game = createGame({ seed: (Date.now() & 0x7fffffff) });
  game.lanterns.forEach((l) => lanternViews.set(l.id, lanternView(l)));
  mode = "playing";
  acc = 0;
  litCount = 0;
  $("overlay").hidden = true;
  $("hint").textContent = "WASD: đi · Kéo chuột / ←→: xoay camera · Space: nhảy · E: nạp đèn · F: tỏa sáng";
}

function handle(e) {
  const p = game.player.pos;
  if (e.name === "mote_picked") tone([880 + e.data.carried * 60], 0.18, "triangle", 0.05);
  if (e.name === "deposit") { tone([523, 659], 0.3); toast(`Nạp ${e.data.amount} đom đóm vào ${e.data.lantern_id} (${e.data.deposited}/${TUNING.lantern_cost})`); }
  if (e.name === "lantern_lit") {
    const l = game.lanterns.find((x) => x.id === e.data.lantern_id);
    tone([523, 659, 784, 1047], 0.6, "sine", 0.07);
    toast(`Đèn ${l.id} đã sáng!`);
    skyLanterns(l.pos);
  }
  if (e.name === "pulse") { pulseRing(p); tone([330, 220], 0.35, "sawtooth", 0.04); }
  if (e.name === "player_hit") {
    tone([140, 90], 0.4, "square", 0.05);
    $("flash").style.opacity = 0.45;
    setTimeout(() => ($("flash").style.opacity = 0), 180);
    toast(`Bị Bóng Mực chạm! Rơi ${e.data.dropped} đom đóm`);
  }
  if (e.name === "shade_spawned") toast("Một Bóng Mực mới trồi lên từ sương…");
  if (e.name === "game_over") {
    mode = "over";
    const won = e.data.result === "won";
    showCard(won ? "Thắng rồi!" : "Thua mất rồi", reasons[e.data.reason], `Điểm: <b>${game.score}</b>`, "Chơi lại (R)");
  }
}

function showCard(title, line1, line2, button) {
  $("card").innerHTML = `<h1>${title}</h1><p>${line1}</p><p>${line2}</p><button id="go">${button}</button>`;
  $("overlay").hidden = false;
  $("go").onclick = startGame;
  $("go").focus();
}

// ---------- render ----------
const tmp = new THREE.Vector3();
function render(dt, t) {
  const p = game.player;
  player.position.set(...p.pos);
  const mv = held.move;
  if (mv[0] || mv[1]) {
    const th = (held.cam_yaw_deg * Math.PI) / 180;
    player.rotation.y = Math.atan2(mv[0] * Math.cos(th) + mv[1] * Math.sin(th), -mv[0] * Math.sin(th) + mv[1] * Math.cos(th));
  }
  player.visible = p.invuln === 0 || Math.floor(t * 12) % 2 === 0;
  playerLight.intensity = 3 + p.carried * 1.2;

  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    if (l.lit && !v.lit) v.lit = true;
    const k = v.lit ? 1 : l.deposited / TUNING.lantern_cost * 0.35;
    v.lampMat.emissive.setRGB(1.0 * k, 0.55 * k, 0.15 * k);
    v.light.intensity = v.lit ? 40 + Math.sin(t * 3 + l.pos[0]) * 4 : 0;
    v.ring.material.opacity = v.lit ? 0.35 : 0;
  }
  const ids = new Set(game.motes.map((m) => m.id));
  for (const [id, v] of moteViews) if (!ids.has(id)) { scene.remove(v); moteViews.delete(id); }
  for (const m of game.motes) {
    let v = moteViews.get(m.id);
    if (!v) { v = new THREE.Group(); v.add(new THREE.Mesh(moteGeo, glowMat), new THREE.Mesh(haloGeo, haloMat)); scene.add(v); moteViews.set(m.id, v); }
    v.position.set(m.pos[0], 0.8 + Math.sin(t * 2 + m.pos[0]) * 0.2, m.pos[2]);
  }
  for (const s of game.shades) {
    let v = shadeViews.get(s.id);
    if (!v) { v = shadeView(); shadeViews.set(s.id, v); }
    v.g.position.set(s.pos[0], s.pos[1] + Math.sin(t * 4 + s.pos[2]) * 0.12, s.pos[2]);
    v.g.lookAt(tmp.set(p.pos[0], s.pos[1], p.pos[2]));
    const stunned = s.state === "stunned";
    v.blobMat.emissive.setHex(stunned ? 0x4a4a6a : 0x2a1048);
    v.eyeMat.color.setHex(stunned ? 0x8888aa : 0xc58cff);
  }
  // island brightens as lanterns light up
  litCount = game.lanterns.filter((l) => l.lit).length;
  const k = litCount / game.lanterns.length;
  ambient.intensity = 0.7 + k * 0.9;
  scene.fog.density = 0.035 - k * 0.022;
  scene.background.copy(NIGHT).lerp(DAWNISH, k);

  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.t += dt;
    const kk = Math.min(1, fx.t / fx.dur);
    fx.update(kk);
    if (kk >= 1) { scene.remove(fx.obj); effects.splice(i, 1); }
  }

  const th = (camYaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5.5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  const tl = Math.max(0, timeLeft(game));
  $("h-flames").textContent = "●".repeat(p.flames) + "○".repeat(Math.max(0, TUNING.flames - p.flames));
  $("h-carried").textContent = `${p.carried}/${TUNING.carry_capacity}`;
  $("h-lit").textContent = `${litCount}/${game.lanterns.length}`;
  $("h-time").textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, "0")}`;
  $("h-score").textContent = game.score;
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); // after a hidden tab, do not fast-forward the night
  last = now;
  if (mode === "playing") {
    acc += dt;
    const input = readInput(dt);
    while (acc >= 1 / TICK_HZ && mode === "playing") {
      acc -= 1 / TICK_HZ;
      for (const e of step(game, input)) handle(e);
    }
  }
  render(dt, now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

game = createGame({ seed: 1 });
game.lanterns.forEach((l) => lanternViews.set(l.id, lanternView(l)));
showCard("Đảo Đèn Lồng",
  "Sương đen đã nuốt ánh sáng của đảo. Giúp Mây gom đom đóm và thắp lại 5 Đèn Lồng Lớn trước khi trời sáng.",
  `<table>
    <tr><td>WASD</td><td>đi lại</td></tr><tr><td>Kéo chuột / ← →</td><td>xoay camera</td></tr>
    <tr><td>Space</td><td>nhảy</td></tr><tr><td>E</td><td>nạp đom đóm vào đèn gần nhất</td></tr>
    <tr><td>F</td><td>tỏa sáng (tốn ${TUNING.pulse_cost} đom đóm), xua Bóng Mực</td></tr>
    <tr><td>R</td><td>chơi lại</td></tr></table>`,
  "Bắt đầu (Enter)");
requestAnimationFrame(frame);
