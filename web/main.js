// Đảo Đèn Lồng — browser view. All rules live in ../src/sim.js (the same code the headless runner uses);
// this file reads input, renders the state, plays sound and runs the menus. Nothing here changes headless output.
import * as THREE from "./vendor/three.module.min.js";
import { capacityOf, createBench, createGame, fuelOf, hasSafeZone, lanternCount, MAPS, step, timeLeft, TICK_HZ, TUNING, RULES, winNeed } from "../src/sim.js";
import { insert, isoLocal, validName } from "../src/leaderboard.js";

// ---------- Ticket-02 palette ----------
const C = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450, shirt: 0xe8e2d0, red: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};
const STORY = {
  1: "Ông Đăng: “Sương đen về sớm quá. Đèn thắp rồi vẫn cạn dầu, cháu nhớ châm thêm đom đóm. Bóng Mực sợ đèn sáng, nhưng đèn yếu thì chúng xúm lại hút dầu.”",
  2: "Ông Đăng: “Đảo Cau là hai hòn nối nhau bằng cầu tre. Bục nhảy sẽ hất cháu qua biển mây. Coi chừng Gió Lạc, chúng hay cướp đom đóm của người mang nhiều.”",
  3: "Ông Đăng: “Đảo Chuông có ba tầng đất và tháp chuông ở giữa. Thấy lá bay là sắp có gió mạnh, đứng vững nhé.”",
};
const REASON = { dawn_survived: "Trời sáng, đảo vẫn giữ được ánh đèn.", dawn: "Trời sáng mà không đủ đèn còn cháy.", no_flames: "Mây đã hết Ngọn Lửa." };
const $ = (id) => document.getElementById(id);

// ---------- settings (saved between sessions) ----------
// Ticket-04: every action can be rebound (camera stays on ← → and the mouse)
const ACTIONS = [["up", "Đi tới"], ["down", "Đi lùi"], ["left", "Sang trái"], ["right", "Sang phải"], ["jump", "Nhảy"], ["dash", "Lướt"],
  ["interact", "Thắp / châm dầu"], ["pulse", "Tỏa Sáng"], ["pause", "Tạm dừng"]];
const DEFAULT_KEYS = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", dash: "ShiftLeft", interact: "KeyE", pulse: "KeyF", pause: "Escape" };
const RESERVED = ["ArrowLeft", "ArrowRight"]; // camera
const settings = { volume: 0.6, sensitivity: 1, colorblind: false, reduceMotion: false, bigText: false, captions: true, keys: { ...DEFAULT_KEYS } };
try {
  const saved = JSON.parse(localStorage.getItem("ddl-settings") || "{}");
  Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...(saved.keys ?? {}) } });
} catch { /* private mode: defaults */ }
const saveSettings = () => { try { localStorage.setItem("ddl-settings", JSON.stringify(settings)); } catch { /* ignore */ } };
const applySettings = () => {
  document.body.classList.toggle("cb", settings.colorblind);
  document.body.classList.toggle("calm", settings.reduceMotion);
  document.documentElement.classList.toggle("big", settings.bigText);
};
applySettings();
const keyName = (code) => ({ Space: "Space", ShiftLeft: "Shift trái", ShiftRight: "Shift phải", Escape: "Esc", Enter: "Enter",
  ControlLeft: "Ctrl trái", ControlRight: "Ctrl phải", AltLeft: "Alt trái", Tab: "Tab", ArrowUp: "↑", ArrowDown: "↓" }[code]
  ?? code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num "));
const shadeRim = () => (settings.colorblind ? 0x00b3ff : C.shadeRim); // Ticket-03 "Bảng màu dễ phân biệt"

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.02);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
const ambient = new THREE.HemisphereLight(0xb8c4ff, C.sky, 0.15); // intensity = 0.15 + 0.55 x lit/total (Ticket-02)
const moon = new THREE.DirectionalLight(0x8090c0, 0.35);
moon.position.set(-30, 60, 20);
scene.add(ambient, moon);
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });

// ---------- player: Mây (shirt, red scarf, nón lá with a small lantern) ----------
const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.9, 12), std(C.shirt));
  body.position.y = 0.45;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), std(C.red));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), std(0xf1c7a3));
  head.position.y = 1.1;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.34, 24), std(C.sand));
  hat.position.y = 1.43;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), glow(C.lit));
  lamp.position.set(0.5, 1.12, 0.2);
  const light = new THREE.PointLight(C.lit, 5, 12, 1.6);
  light.position.copy(lamp.position);
  player.add(body, scarf, head, hat, lamp, light);
  player.userData.light = light;
}
scene.add(player);

// ---------- per-night world ----------
let world = null, views = null;
function buildWorld(night) {
  if (world) scene.remove(world);
  world = new THREE.Group();
  const map = MAPS[night];
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), std(C.sea, { roughness: 1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -8;
  world.add(sea);
  const disk = (r, h, x, z, color, y = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 64), std(color));
    m.position.set(x, y - h / 2, z);
    world.add(m);
    const rim = new THREE.Mesh(new THREE.RingGeometry(r - 0.8, r, 64), std(C.sand));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, y + 0.01, z);
    world.add(rim);
  };
  if (night === 1) disk(40, 4, 0, 0, C.grass);
  if (night === 2) {
    disk(28, 4, 0, 0, C.grass);
    disk(28, 4, 70, 0, C.grass);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), std(C.wood));
    bridge.position.set(35, -0.15, 0);
    world.add(bridge);
  }
  if (night === 3) {
    disk(45, 4, 0, 0, C.grass);
    const shape = new THREE.Shape(); // tier 1: half ring r 12-24 on the z > 0 side (shape y maps to world -z)
    shape.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
    shape.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 32 }), std(0x356a5b));
    tier1.rotation.x = -Math.PI / 2;
    world.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), std(0x3b7363));
    tier2.position.y = 3;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), std(C.wood));
    tower.position.y = 10;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(C.gold, { metalness: 0.6, roughness: 0.4 }));
    bell.position.y = 13.2;
    world.add(tier2, tower, bell);
    for (const a of [30, 150]) {
      const g = new THREE.Group();
      g.rotation.y = -(a * Math.PI) / 180;
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(6, 3), 0.3, 3), std(C.wood));
      rampMesh.position.set(27, 1.4, 0);
      rampMesh.rotation.z = -Math.atan2(3, 6);
      g.add(rampMesh);
      world.add(g);
    }
  }
  for (const pad of map.pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 24), new THREE.MeshStandardMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0.6 }));
    m.position.set(pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]);
    world.add(m);
  }
  { // decorative pines at fixed spots on the outer rim (visual only)
    let a = 11;
    const r01 = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const centers = night === 2 ? [[0, 28], [70, 28]] : [[0, night === 3 ? 45 : 40]];
    for (const [cx, R] of centers) for (let i = 0; i < 14; i++) {
      const ang = r01() * Math.PI * 2, rad = R - 4 + r01() * 3;
      const x = cx + Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (map.ground(x, z) !== 0) continue;
      const pine = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3 + r01() * 2, 7), std(0x1f3d33));
      pine.position.set(x, 1.6, z);
      world.add(pine);
    }
  }
  scene.add(world);
  views = { lanterns: new Map(), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
  for (let i = 0; i < map.lanterns.length; i++) views.lanterns.set(`L${i + 1}`, lanternView(map.lanterns[i]));
}

function lanternView(pos) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), std(C.wood));
  pole.position.y = 1.6;
  const lampMat = new THREE.MeshStandardMaterial({ color: C.off, emissive: 0x000000 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 12), lampMat);
  lamp.position.y = 3.6;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow(C.core));
  core.position.y = 3.6;
  core.visible = false;
  const light = new THREE.PointLight(C.lit, 0, 28, 1.3); // created up front: constant light count, no shader recompiles
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 48), glow(C.lit, 0.0001));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  // unlit lanterns are told apart without colour: the paper sags 20% and shows two dark tears (Ticket-03)
  const tears = new THREE.Group();
  for (const a of [0.6, 3.6]) {
    const tear = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.04), std(0x101018));
    tear.position.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
    tear.rotation.set(0, a, 0.5);
    tears.add(tear);
  }
  tears.position.y = 3.5;
  // fuel bar above a lit lantern (sprites always face the camera); the fill is left-aligned and scaled by fuel
  const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x0e1430, transparent: true, opacity: 0.8, depthWrite: false }));
  barBg.scale.set(1.5, 0.2, 1);
  const barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: C.lit, depthWrite: false }));
  barFill.center.set(0, 0.5);
  barFill.position.x = -0.7;
  const bar = new THREE.Group();
  bar.add(barBg, barFill);
  bar.position.y = 4.5;
  g.add(pole, lamp, core, light, ring, tears, bar);
  g.position.set(...pos);
  world.add(g);
  return { g, lamp, lampMat, core, light, ring, tears, bar, barFill };
}

const moteGeo = new THREE.SphereGeometry(0.15, 10, 8), haloGeo = new THREE.SphereGeometry(0.42, 10, 8);
const moteCoreMat = glow(C.moteCore), moteHaloMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
function moteView() {
  const v = new THREE.Group();
  v.add(new THREE.Mesh(moteGeo, moteCoreMat), new THREE.Mesh(haloGeo, moteHaloMat));
  world.add(v);
  return v;
}
function shadeView() {
  const g = new THREE.Group();
  const bodyMat = std(C.shade, { roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), bodyMat);
  const rimMat = new THREE.MeshBasicMaterial({ color: C.shadeRim, transparent: true, opacity: 0.45, side: THREE.BackSide });
  const rim = new THREE.Mesh(new THREE.SphereGeometry(0.92, 18, 14), rimMat);
  const eyeMat = glow(C.shadeRim);
  for (const x of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    eye.position.set(x, 0.2, 0.72);
    g.add(eye);
  }
  g.add(body, rim);
  world.add(g);
  return { g, bodyMat, rimMat, eyeMat };
}
function drifterView() {
  const geo = new THREE.PlaneGeometry(2.2, 0.35, 16, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  m.userData.base = geo.attributes.position.array.slice();
  world.add(m);
  return m;
}
function charmView() {
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.04), glow(C.gold));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.06), glow(C.red));
  g.add(border, paper);
  world.add(g);
  return g;
}

// ---------- effects ----------
const effects = [];
function pulseRing(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 48), new THREE.MeshBasicMaterial({ color: C.lit, transparent: true, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], pos[1] + RULES.pulse_center_dy, pos[2]);
  world.add(m);
  effects.push({ obj: m, t: 0, dur: 0.45, update: (k) => { m.scale.setScalar(1 + k * (TUNING.pulse_radius / 0.8 - 1)); m.material.opacity = 1 - k; } });
}
function skyLanterns(pos) { // creative: paper sky lanterns drift up from a newly lit lantern
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), new THREE.MeshBasicMaterial({ color: C.lit, transparent: true }));
    m.position.set(pos[0] + (Math.random() - 0.5) * 3, pos[1] + 4, pos[2] + (Math.random() - 0.5) * 3);
    world.add(m);
    const y0 = m.position.y;
    effects.push({ obj: m, t: 0, dur: 6 + Math.random() * 3, update: (k) => { m.position.y = y0 + k * 22; m.material.opacity = 1 - k * k; } });
  }
}
const leaves = [];
function windLeaves(on, dirDeg) {
  while (leaves.length && !on) world.remove(leaves.pop());
  if (!on || leaves.length) return;
  for (let i = 0; i < 40; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.12), new THREE.MeshBasicMaterial({ color: 0x9fbf6a, side: THREE.DoubleSide }));
    l.userData = { a: Math.random() * Math.PI * 2, r: 3 + Math.random() * 12, h: 0.5 + Math.random() * 4, dir: dirDeg };
    leaves.push(l);
    world.add(l);
  }
}

// ---------- audio (WebAudio, generated, no files) ----------
let ac = null, master = null, musicOn = false;
function audio() {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.connect(ac.destination);
    } catch { return null; }
  }
  master.gain.value = settings.volume;
  return ac;
}
function tone(freqs, dur = 0.25, type = "sine", gain = 0.08, gap = 0.07) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  freqs.forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(gain, t0 + i * gap);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * gap + dur);
    o.connect(g).connect(master);
    o.start(t0 + i * gap);
    o.stop(t0 + i * gap + dur + 0.02);
  });
}
const SFX = {
  pick: (n) => tone([880 + n * 40], 0.15, "triangle", 0.05),
  deposit: () => tone([523, 659], 0.3),
  lit: () => tone([523, 659, 784, 1047], 0.7, "sine", 0.07),
  pulse: () => tone([392, 262], 0.35, "sawtooth", 0.035),
  hit: () => tone([150, 95], 0.4, "square", 0.05),
  jump: () => tone([440, 660], 0.12, "triangle", 0.04, 0.04),
  dash: () => tone([300, 900], 0.12, "sawtooth", 0.025, 0.03),
  win: () => tone([523, 659, 784, 1047, 1319], 0.8, "sine", 0.07, 0.12),
  lose: () => tone([392, 330, 262, 196], 0.7, "triangle", 0.06, 0.18),
  shade: () => tone([110, 98], 0.6, "sawtooth", 0.03, 0.2),
  tick: () => tone([1200], 0.08, "square", 0.03),
  wind: () => tone([180, 220, 200], 0.9, "triangle", 0.02, 0.25),
  charm: () => tone([660, 990, 1320], 0.25, "triangle", 0.05, 0.05),
  out: () => tone([330, 247, 165], 0.5, "triangle", 0.05, 0.12),
};
function startMusic() { // slow night pad: two detuned triangle voices walking a minor progression
  const a = audio();
  if (!a || musicOn) return;
  musicOn = true;
  const chords = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
  let i = 0;
  const play = () => {
    const t0 = a.currentTime;
    for (const f of chords[i++ % chords.length]) {
      for (const det of [-4, 4]) {
        const o = a.createOscillator(), g = a.createGain();
        o.type = "triangle";
        o.frequency.value = f / 2;
        o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.012, t0 + 1.5);
        g.gain.linearRampToValueAtTime(0.0001, t0 + 4);
        o.connect(g).connect(master);
        o.start(t0);
        o.stop(t0 + 4.1);
      }
    }
  };
  play();
  setInterval(play, 4000);
}

// ---------- input ----------
const keys = new Set();
let camYaw = 0, dragX = null, rebinding = null; // rebinding = (code) => void while the settings screen waits for a key
addEventListener("keydown", (e) => {
  if (rebinding) { e.preventDefault(); rebinding(e.code); return; }
  if (e.target instanceof HTMLInputElement && e.target.type === "text") return; // typing a name: letters are not game keys
  if (e.repeat && [settings.keys.pause, "Enter"].includes(e.code)) return;
  keys.add(e.code);
  if (e.code === settings.keys.pause && (mode === "playing" || mode === "paused")) togglePause();
  else if (e.code === "Enter" && mode === "intro") beginNight();
  if (Object.values(settings.keys).includes(e.code) || RESERVED.includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); if (mode === "playing") togglePause(); });
renderer.domElement.addEventListener("pointerdown", (e) => { dragX = e.clientX; audio(); startMusic(); });
addEventListener("pointerup", () => { dragX = null; });
addEventListener("pointermove", (e) => {
  if (dragX === null) return;
  camYaw -= (e.clientX - dragX) * 0.3 * settings.sensitivity; // drag right => look right
  dragX = e.clientX;
});
const held = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
function readInput(dt) {
  if (keys.has("ArrowLeft")) camYaw += 90 * dt * settings.sensitivity;
  if (keys.has("ArrowRight")) camYaw -= 90 * dt * settings.sensitivity;
  const k = settings.keys, on = (a) => keys.has(k[a]);
  const f = (on("up") ? 1 : 0) - (on("down") ? 1 : 0);
  const r = (on("right") ? 1 : 0) - (on("left") ? 1 : 0);
  held.move = [-r, f]; // contract: x=+1 is world +X at yaw 0, which is screen-left for a camera looking along +Z
  held.cam_yaw_deg = camYaw;
  held.jump = on("jump");
  held.interact = on("interact");
  held.pulse = on("pulse");
  held.dash = on("dash");
  return held;
}

// ---------- game flow: menu -> intro -> play -> result -> next night -> Bình Minh ----------
let game = null, mode = "menu", night = 1, totalScore = 0, nightsWon = 0, runSeed = 0, acc = 0, last = performance.now(), lastSecond = null, wasGrounded = true;
function card(html, buttons) {
  $("card").innerHTML = html + `<div class="btns">${buttons.map(([label, , ghost], i) => `<button data-i="${i}" class="${ghost ? "ghost" : ""}">${label}</button>`).join("")}</div>`;
  $("card").querySelectorAll(".btns > button").forEach((b) => (b.onclick = () => { audio(); startMusic(); buttons[b.dataset.i][1](); }));
  $("overlay").hidden = false;
  $("card").querySelector("input[type=text], .btns > button")?.focus();
}
const controls = () => {
  const k = (a) => keyName(settings.keys[a]);
  return `<table>
  <tr><td>${k("up")} ${k("left")} ${k("down")} ${k("right")}</td><td>đi (theo hướng camera)</td></tr><tr><td>Kéo chuột / ← →</td><td>xoay camera</td></tr>
  <tr><td>${k("jump")}</td><td>nhảy</td></tr><tr><td>${k("dash")}</td><td>lướt</td></tr>
  <tr><td>${k("interact")}</td><td>thắp đèn / châm dầu cho đèn gần nhất</td></tr><tr><td>${k("pulse")}</td><td>Tỏa Sáng (tốn ${TUNING.pulse_cost} đom đóm)</td></tr>
  <tr><td>${k("pause")}</td><td>tạm dừng</td></tr></table>`;
};
function showMenu() {
  mode = "menu";
  card(`<h1>Đảo Đèn Lồng</h1><p>Giúp Mây gom đom đóm, thắp Đèn Lồng Lớn và giữ chúng cháy tới bình minh trên ba hòn đảo.</p>${controls()}`,
    [["Chơi", newRun], ["Bảng xếp hạng", () => showBoard(showMenu), true], ["Cài đặt", () => showSettings(showMenu), true]]);
}
function newRun() {
  totalScore = 0;
  nightsWon = 0;
  runSeed = (Date.now() % 1e9) | 0; // night n is played with runSeed + n - 1; the leaderboard keeps runSeed
  showIntro(1);
}
function showIntro(n) {
  night = n;
  mode = "intro";
  game = createGame({ seed: runSeed + n - 1, night });
  buildWorld(night);
  announced.clear();
  card(`<h2>Đêm ${night} — ${MAPS[night].name}</h2><p class="say">${STORY[night]}</p>
    <p>${lanternCount(night)} Đèn Lồng Lớn · ${MAPS[night].duration / 60 | 0} phút ${MAPS[night].duration % 60 ? `${MAPS[night].duration % 60} giây` : ""}</p>
    <p>Thắng khi trời sáng mà còn ít nhất <b>${winNeed(lanternCount(night))}</b> đèn đang cháy.</p>`,
    [["Bắt đầu (Enter)", beginNight]]);
}
function beginNight() {
  $("overlay").hidden = true;
  mode = "playing";
  acc = 0;
  lastSecond = null;
}
function togglePause() {
  if (mode === "playing") {
    mode = "paused";
    card("<h2>Tạm dừng</h2>", [["Tiếp tục", () => { $("overlay").hidden = true; mode = "playing"; }],
      ["Chơi lại Đêm", () => showIntro(night), true], ["Cài đặt", () => showSettings(() => { mode = "playing"; togglePause(); }), true],
      ["Về menu", showMenu, true]]);
  } else if (mode === "paused") { $("overlay").hidden = true; mode = "playing"; }
}
function showSettings(back) {
  mode = mode === "paused" ? "paused" : "settings";
  const check = (id, key, label) => `<label>${label} <input id="${id}" type="checkbox" ${settings[key] ? "checked" : ""}></label>`;
  card(`<h2>Cài đặt</h2>
    <label>Âm lượng <input id="s-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label>Độ nhạy chuột <input id="s-sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></label>
    ${check("s-cb", "colorblind", "Bảng màu dễ phân biệt")}
    ${check("s-calm", "reduceMotion", "Giảm chuyển động (tắt rung camera, chớp màn hình)")}
    ${check("s-big", "bigText", "Chữ lớn (×1,25)")}
    ${check("s-cap", "captions", "Phụ đề / chỉ báo hình ảnh")}
    <h2>Phím</h2><div class="keys">${ACTIONS.map(([a, label]) => `<span>${label}</span><button class="ghost" data-act="${a}">${keyName(settings.keys[a])}</button>`).join("")}</div>
    <p class="msg" id="s-msg" role="alert"></p>
    <p>Được lưu cho lần mở game sau.</p>`, [["Xong", () => { rebinding = null; back(); }], ["Khôi phục phím mặc định", () => {
    settings.keys = { ...DEFAULT_KEYS };
    saveSettings();
    showSettings(back);
  }, true]]);
  $("s-vol").oninput = (e) => { settings.volume = Number(e.target.value); saveSettings(); if (master) master.gain.value = settings.volume; };
  $("s-sens").oninput = (e) => { settings.sensitivity = Number(e.target.value); saveSettings(); };
  for (const [id, key] of [["s-cb", "colorblind"], ["s-calm", "reduceMotion"], ["s-big", "bigText"], ["s-cap", "captions"]]) {
    $(id).onchange = (e) => { settings[key] = e.target.checked; saveSettings(); applySettings(); };
  }
  $("card").querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
    const act = b.dataset.act;
    b.textContent = "Bấm phím mới…";
    $("s-msg").textContent = "";
    rebinding = (code) => {
      rebinding = null;
      const owner = ACTIONS.find(([a]) => a !== act && settings.keys[a] === code);
      if (owner || RESERVED.includes(code)) { // duplicate keys are refused and explained
        $("s-msg").textContent = `Phím ${keyName(code)} đang dùng cho “${owner ? owner[1] : "xoay camera"}”. Chọn phím khác.`;
      } else {
        settings.keys[act] = code;
        saveSettings();
      }
      b.textContent = keyName(settings.keys[act]);
      b.focus();
    };
  }));
}
function showResult(won, reason) {
  mode = "result";
  if (won) {
    totalScore += game.score;
    nightsWon += 1;
    SFX.win();
    if (night === 3) {
      card(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng đèn trở lại. Mặt trời lên trên biển mây.</p><p>Tổng điểm: <b>${totalScore}</b></p>${nameForm()}`,
        [["Lưu điểm", saveScore], ["Về menu", showMenu, true]]);
    } else {
      card(`<h2>Thắng Đêm ${night}</h2><p>${REASON[reason]}</p><p>Điểm Đêm này: <b>${game.score}</b> · Tổng: <b>${totalScore}</b></p>`,
        [[`Đêm ${night + 1}`, () => showIntro(night + 1)], ["Về menu", showMenu, true]]);
    }
  } else {
    SFX.lose();
    card(`<h2>Thua Đêm ${night}</h2><p>${REASON[reason]}</p><p>Tổng điểm các Đêm đã thắng: <b>${totalScore}</b></p>${nameForm()}`,
      [["Lưu điểm", saveScore], ["Chơi lại Đêm", () => showIntro(night), true], ["Về menu", showMenu, true]]);
  }
}

// ---------- leaderboard (Ticket-04 part 3): kept by the local server in data/leaderboard.json ----------
const nameForm = () => `<label>Tên của bạn <input id="lb-name" type="text" maxlength="12" autocomplete="off" placeholder="3–12 chữ, số hoặc _"></label>
  <p class="msg" id="lb-msg" role="alert"></p>`;
async function fetchBoard() {
  try {
    const r = await fetch("/api/leaderboard");
    if (r.ok) return (await r.json()).entries;
  } catch { /* opened without the server: fall back to this browser's storage */ }
  try { return JSON.parse(localStorage.getItem("ddl-leaderboard") || "[]"); } catch { return []; }
}
async function saveScore() {
  const name = $("lb-name").value.trim();
  if (!validName(name)) { $("lb-msg").textContent = "Tên cần 3–12 ký tự: chữ, số hoặc dấu _."; return; }
  const entry = { name, score: totalScore, nights_won: nightsWon, achieved_at: isoLocal(new Date()), seed: runSeed };
  let entries;
  try {
    const r = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
    if (!r.ok) throw new Error((await r.json()).error);
    entries = (await r.json()).entries;
  } catch {
    entries = insert(await fetchBoard(), entry);
    try { localStorage.setItem("ddl-leaderboard", JSON.stringify(entries)); } catch { /* ignore */ }
  }
  showBoard(showMenu, entry);
}
async function showBoard(back, mine = null) {
  mode = mode === "result" ? "result" : "board";
  const entries = await fetchBoard();
  const same = (e) => mine && e.name === mine.name && e.achieved_at === mine.achieved_at;
  const rows = entries.map((e, i) => `<tr class="${same(e) ? "me" : ""}"><td>${i + 1}</td><td>${e.name.replace(/[<&>]/g, "")}</td><td>${e.score}</td>
    <td>${e.nights_won}/3</td><td>${new Date(e.achieved_at).toLocaleDateString("vi-VN")}</td></tr>`).join("");
  card(`<h2>Bảng xếp hạng</h2>${entries.length ? `<table><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Ngày</th></tr>${rows}</table>`
    : "<p>Chưa có ai. Hãy là người đầu tiên!</p>"}${mine && !entries.some(same) ? "<p>Điểm của bạn chưa vào top 10.</p>" : ""}`, [["Về menu", back]]);
}

let toastTimer;
function toast(text) {
  $("toast").textContent = text;
  $("toast").style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").style.opacity = 0), 1700);
}
// captions / visual cues for sounds (Ticket-04 accessibility): shade appears, wind coming, last 10 s, lantern under 30
let captionTimer, shadeCue = null, shake = 0;
const announced = new Set();
function caption(html) {
  if (!settings.captions) return;
  $("h-caption").innerHTML = html;
  $("h-caption").hidden = false;
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => ($("h-caption").hidden = true), 3000);
}
function handle(e) {
  const p = game.player.pos;
  switch (e.name) {
    case "mote_picked": SFX.pick(e.data.carried); break;
    case "deposit": { const l = game.lanterns.find((x) => x.id === e.data.lantern_id); SFX.deposit(); toast(`Nạp ${e.data.amount} vào ${l.id} (${e.data.deposited}/${costOf(l)})`); break; }
    case "lantern_lit": { const l = game.lanterns.find((x) => x.id === e.data.lantern_id); SFX.lit(); toast(e.data.relight ? `Đèn ${l.id} sáng lại!` : `Đèn ${l.id} đã sáng!`); skyLanterns(l.pos); break; }
    case "refuel": SFX.deposit(); toast(`Châm dầu ${e.data.lantern_id}: ${e.data.fuel}/${TUNING.fuel_max}`); break;
    case "lantern_out": SFX.out(); toast(`Đèn ${e.data.lantern_id} đã tắt! Thắp lại chỉ cần ${TUNING.relight_cost} đom đóm`); break;
    case "pulse": SFX.pulse(); pulseRing(p); break;
    case "dash": SFX.dash(); break;
    case "player_hit":
      SFX.hit();
      if (!settings.reduceMotion) { // screen flash and camera shake are off in "Giảm chuyển động"
        $("flash").style.opacity = 0.4;
        setTimeout(() => ($("flash").style.opacity = 0), 160);
        shake = 0.35;
      }
      toast(e.data.by === "fall" ? `Rơi khỏi đảo! Mất ${e.data.lost} đom đóm` : `Bị Bóng Mực chạm! Rơi ${e.data.dropped} đom đóm`);
      break;
    case "shade_spawned":
      SFX.shade();
      shadeCue = { id: e.data.id, until: performance.now() + 3000 };
      caption('<span class="danger">Bóng Mực xuất hiện!</span> (mũi tên ở mép màn hình chỉ hướng)');
      break;
    case "charm_picked": SFX.charm(); toast("Bùa Gió: chạy nhanh hơn, lướt không cần chờ!"); break;
    case "drifter_steal": toast(`Gió Lạc cướp mất ${e.data.amount} đom đóm!`); break;
    case "drifter_drop": toast(`Gió Lạc đánh rơi ${e.data.amount} đom đóm`); break;
    case "game_over": showResult(e.data.result === "won", e.data.reason); break;
  }
}

// ---------- HUD ----------
const costOf = (l) => (l.everLit ? TUNING.relight_cost : TUNING.lantern_cost);
const low = (l) => l.lit && !hasSafeZone(l);
for (let i = 0; i < TUNING.capacity_max; i++) $("h-bar").append(document.createElement("i"));
const proj = new THREE.Vector3();
const flat = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);
function hud() {
  const p = game.player, tl = Math.max(0, timeLeft(game)), cap = capacityOf(p);
  $("h-flames").innerHTML = "🔥".repeat(p.flames) + `<span class="off">${"🔥".repeat(Math.max(0, TUNING.flames - p.flames))}</span>`;
  $("h-clock").textContent = `${String(Math.floor(tl / 60)).padStart(2, "0")}:${String(Math.floor(tl % 60)).padStart(2, "0")}`;
  $("h-clock").classList.toggle("danger", tl <= 30);
  const lit = game.lanterns.filter((l) => l.lit).length, need = winNeed(game.lanterns.length);
  $("h-right").innerHTML = `Đèn sáng <b>${lit}/${game.lanterns.length}</b> <span class="${lit < need ? "danger" : ""}">(cần ${need})</span><br>Điểm <b>${totalScore + game.score}</b>`;
  [...$("h-bar").children].forEach((c, i) => { c.hidden = i >= cap; c.classList.toggle("on", i < p.carried); });
  $("h-carry").textContent = `${p.carried} / ${cap}`;
  const cd = (el, left, total) => { el.style.setProperty("--p", `${Math.max(0, left / total) * 100}%`); };
  cd($("cd-dash"), p.charm > 0 ? 0 : p.dashCd, TUNING.dash_cooldown_s * TICK_HZ);
  cd($("cd-pulse"), p.pulseCd, TUNING.pulse_cooldown_s * TICK_HZ);
  const near = game.lanterns.filter((l) => (!l.lit || fuelOf(l) < TUNING.fuel_max) && flat(l, p) <= TUNING.interact_radius
    && Math.abs(l.pos[1] - p.pos[1]) <= RULES.pickup_dy).sort((a, b) => flat(a, p) - flat(b, p))[0];
  $("h-prompt").hidden = !near;
  const ek = keyName(settings.keys.interact);
  if (near) $("h-prompt").textContent = near.lit ? `${ek} — Châm dầu (${Math.floor(fuelOf(near))}/${TUNING.fuel_max})` : `${ek} — Thắp đèn (${near.deposited}/${costOf(near)})`;
  // arrow to the nearest lantern that needs Mây (low on fuel first, else unlit) when it is off screen
  const weak = game.lanterns.filter(low);
  const target = (weak.length ? weak : game.lanterns.filter((l) => !l.lit)).sort((a, b) => flat(a, p) - flat(b, p))[0];
  $("h-arrow").hidden = !(target && edgeArrow($("h-arrow"), target.pos, 3.6));
  const warn = game.windEnabled && !game.wind.active && game.steps % RULES.wind_every >= RULES.wind_every - RULES.wind_warn;
  if (warn && !leaves.length) { windLeaves(true, 0); SFX.wind(); caption("Lá đang bay… <b>gió mạnh sắp thổi!</b>"); }
  if (!warn && !game.wind.active && leaves.length) windLeaves(false);
  const sec = Math.ceil(tl);
  if (tl <= 10 && sec !== lastSecond && mode === "playing" && tl > 0) {
    SFX.tick();
    if (!announced.has("last10")) { announced.add("last10"); caption('<span class="danger">10 giây cuối!</span>'); }
  }
  lastSecond = sec;
  for (const l of game.lanterns) { // announce each time a lantern drops under 30 fuel
    const key = `low-${l.id}`;
    if (low(l) && !announced.has(key)) { announced.add(key); caption(`<span class="danger">Đèn ${l.id} sắp cạn dầu (${Math.floor(fuelOf(l))})!</span>`); }
    if (!low(l)) announced.delete(key);
  }
  // arrow at the screen edge towards a shade that just appeared (visual cue for its sound)
  const cue = shadeCue && performance.now() < shadeCue.until && settings.captions && game.shades.find((s) => s.id === shadeCue.id);
  $("h-shade-arrow").hidden = !(cue && edgeArrow($("h-shade-arrow"), cue.pos, 1));
}
function edgeArrow(el, pos, dy) { // place an arrow on the screen edge pointing at pos; false when pos is on screen
  proj.set(pos[0], pos[1] + dy, pos[2]).project(camera);
  const behind = proj.z > 1;
  let x = behind ? -proj.x : proj.x, y = behind ? -proj.y : proj.y;
  if (!behind && Math.abs(x) <= 1 && Math.abs(y) <= 1) return false;
  const k = 0.85 / Math.max(Math.abs(x), Math.abs(y), 1e-6);
  x *= k; y *= k;
  el.style.left = `${((x + 1) / 2) * innerWidth - 14}px`;
  el.style.top = `${((1 - y) / 2) * innerHeight - 15}px`;
  el.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
  return true;
}

// ---------- render ----------
const tmp = new THREE.Vector3();
function sync(views, list, make, update) {
  const ids = new Set(list.map((x) => x.id));
  for (const [id, v] of views) if (!ids.has(id)) { world.remove(v.g ?? v); views.delete(id); }
  for (const x of list) {
    let v = views.get(x.id);
    if (!v) { v = make(); views.set(x.id, v); }
    update(v, x);
  }
}
function render(dt, t) {
  const p = game.player;
  player.position.set(...p.pos);
  player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  player.visible = p.fallWait === 0 && (p.invuln === 0 || Math.floor(t * 12) % 2 === 0);
  player.userData.light.intensity = 3 + p.carried * 0.6;
  if (p.grounded === false && wasGrounded && p.vel[1] > 6) SFX.jump();
  wasGrounded = p.grounded;

  const blinkOff = Math.floor(t * 2) % 2 === 1; // 1 Hz: on half a second, off half a second
  for (const l of game.lanterns) {
    const v = views.lanterns.get(l.id);
    const fuel = fuelOf(l) / TUNING.fuel_max, dim = low(l) && blinkOff;
    const k = l.lit ? (dim ? 0.25 : 0.55 + 0.45 * fuel) : (l.deposited / costOf(l)) * 0.4;
    v.lampMat.color.setHex(l.lit ? C.lit : C.off);
    v.lampMat.emissive.setRGB(k, 0.7 * k, 0.28 * k);
    v.lamp.scale.y = l.lit ? 1 : 0.8; // sagging paper when out
    v.tears.visible = !l.lit;
    v.core.visible = l.lit && !dim;
    v.light.intensity = l.lit ? (dim ? 8 : (20 + 25 * fuel) + Math.sin(t * 3 + l.pos[0]) * 4) : 0;
    v.ring.material.opacity = hasSafeZone(l) ? 0.35 : 0.0001;
    v.bar.visible = l.lit && !dim;
    v.bar.quaternion.copy(camera.quaternion); // keep the bar's left edge on screen-left from any angle
    v.barFill.scale.set(1.4 * fuel, 0.12, 1);
    v.barFill.material.color.setHex(low(l) ? 0xff5a5f : C.lit);
  }
  sync(views.motes, game.motes, moteView, (v, m) => {
    v.position.set(m.pos[0], m.pos[1] + 0.8 + Math.sin(t * 2 + m.pos[0]) * 0.15, m.pos[2]);
    v.visible = m.kind === "random" || m.ttl > 120 || Math.floor(t * 8) % 2 === 0; // dropped motes blink before they fade
  });
  sync(views.shades, game.shades, shadeView, (v, s) => {
    v.g.position.set(s.pos[0], s.pos[1] + Math.sin(t * 4 + s.pos[2]) * 0.1, s.pos[2]);
    v.g.lookAt(tmp.set(p.pos[0], s.pos[1], p.pos[2]));
    const stunned = s.state === "stunned";
    v.bodyMat.color.setHex(stunned ? C.shadeStun : C.shade);
    v.rimMat.color.setHex(shadeRim());
    v.eyeMat.color.setHex(shadeRim());
    v.rimMat.opacity = s.state === "spawning" ? 0.15 : stunned ? 0.15 : 0.5;
    const sip = s.state === "drain" ? 1 + Math.sin(t * 10) * 0.08 : 1; // a draining shade throbs as it drinks
    v.g.scale.setScalar(s.state === "spawning" ? 0.5 + (1 - s.left / RULES.shade_spawning_ticks) * 0.5 : sip);
  });
  sync(views.drifters, game.drifters.filter((d) => d.state !== "removed"), drifterView, (m, d) => {
    m.position.set(d.pos[0], d.pos[1], d.pos[2]);
    m.lookAt(tmp.set(p.pos[0], d.pos[1], p.pos[2]));
    const pos = m.geometry.attributes.position, base = m.userData.base;
    for (let i = 0; i < pos.count; i++) pos.setY(i, base[i * 3 + 1] + Math.sin(t * 8 + base[i * 3] * 2.5) * 0.18);
    pos.needsUpdate = true;
  });
  sync(views.charms, game.charms, charmView, (v, c) => {
    v.visible = c.available;
    v.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(t * 2) * 0.15, c.pos[2]);
    v.rotation.y = t;
  });
  for (const l of leaves) {
    const u = l.userData;
    u.a += dt * 2;
    l.position.set(p.pos[0] + Math.cos(u.a) * u.r, p.pos[1] + u.h, p.pos[2] + Math.sin(u.a) * u.r);
    l.rotation.set(u.a, u.a * 1.3, 0);
  }
  const k = game.lanterns.filter((l) => l.lit).length / game.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * k;
  scene.fog.density = 0.02 - 0.012 * k;
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.t += dt;
    const kk = Math.min(1, fx.t / fx.dur);
    fx.update(kk);
    if (kk >= 1) { world.remove(fx.obj); effects.splice(i, 1); }
  }
  const th = (camYaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5.5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  if (shake > 0) { // short camera shake when hit (skipped in "Giảm chuyển động": shake is never set)
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
}

const BENCH = new URLSearchParams(location.search).get("bench") === "1";
function resize() {
  const [w, h] = BENCH ? [1280, 720] : [innerWidth, innerHeight]; // the bench always renders exactly 1280x720
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

let fpsFrames = 0, fpsT = performance.now();
window.__fps = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); // a hidden tab does not fast-forward the night
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
  hud();
  renderer.render(scene, camera);
  fpsFrames++;
  if (now - fpsT >= 1000) {
    window.__fps = (fpsFrames * 1000) / (now - fpsT);
    $("h-fps").textContent = `${window.__fps.toFixed(0)} FPS`;
    fpsFrames = 0;
    fpsT = now;
  }
  requestAnimationFrame(frame);
}

// Frame-cost benchmark (evidence for "≥ 30 FPS at 1280×720"): step + render + gl.finish() back to back, so the number
// does not depend on vsync or on the tab being in the foreground. Usage: open the console, run __bench(2, 600).
window.__bench = (benchNight = 1, frames = 600) => {
  showIntro(benchNight);
  beginNight();
  const gl = renderer.getContext(), idle = { ...held, move: [0.6, 0.8] };
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    for (const e of step(game, idle)) if (e.name !== "game_over") handle(e);
    render(1 / 60, i / 60);
    hud();
    renderer.render(scene, camera);
    gl.finish();
  }
  const ms = (performance.now() - t0) / frames;
  showMenu();
  return { night: benchNight, frames, size: [innerWidth, innerHeight], pixelRatio: renderer.getPixelRatio(), ms_per_frame: +ms.toFixed(2), fps_capacity: +(1000 / ms).toFixed(1) };
};

// ---------- benchmark mode (Ticket-04 part 1), opened by tools/bench.mjs as index.html?bench=1&seed=42&duration=30 ----------
// Standard scene from createBench(); no player input; camera orbits (0,0,0) at r 30, Y 15, from angle 0, counter-clockwise seen
// from above with the same angle convention as the maps, one turn per 15 s. 3 s warm-up, then `duration` s of frame times.
function runBench() {
  const q = new URLSearchParams(location.search);
  const seed = Number(q.get("seed") ?? 42), duration = Number(q.get("duration") ?? 30);
  document.body.classList.add("bench");
  renderer.setPixelRatio(1);
  resize();
  game = createBench(seed);
  buildWorld(1);
  mode = "bench";
  const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const dts = [];
  let t0 = null, prev = null, first = 0, heap = 0, simAcc = 0;
  const loop = (now) => {
    if (t0 === null) { t0 = now; first = performance.timeOrigin + now; }
    const el = (now - t0) / 1000, dt = prev === null ? 0 : now - prev;
    prev = now;
    if (el > 3) dts.push(dt);
    simAcc = Math.min(simAcc + dt / 1000, 0.25);
    while (simAcc >= 1 / TICK_HZ) { simAcc -= 1 / TICK_HZ; step(game, idle); }
    render(dt / 1000, el);
    const a = (2 * Math.PI * el) / 15;
    camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a));
    camera.lookAt(0, 0, 0);
    hud();
    renderer.render(scene, camera);
    heap = Math.max(heap, performance.memory?.usedJSHeapSize ?? 0);
    if (el < 3 + duration) requestAnimationFrame(loop);
    else finishBench(dts, first, heap);
  };
  requestAnimationFrame(loop);
}
function finishBench(dts, first, heap) {
  const N = dts.length, sorted = [...dts].sort((x, y) => x - y), r1 = (v) => Math.round(v * 10) / 10;
  const k = Math.max(1, Math.ceil(0.01 * N)), worst = sorted.slice(-k);
  const gl = renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const result = {
    avg_fps: r1((1000 * N) / dts.reduce((s, x) => s + x, 0)),
    p1_low_fps: r1(1000 / (worst.reduce((s, x) => s + x, 0) / k)),
    frame_ms_p95: r1(sorted[Math.ceil(0.95 * N) - 1]),
    frames: N,
    first_frame_epoch_ms: first,
    renderer: `three.js r${THREE.REVISION} · ${renderer.capabilities.isWebGL2 ? "WebGL2" : "WebGL"} · ${gpu} · ${navigator.userAgent.match(/(Edg|Chrome|Firefox)\/[\d.]+/)?.[0] ?? navigator.userAgent}`,
    js_heap_peak_mb: heap ? r1(heap / 2 ** 20) : null,
    canvas: [renderer.domElement.width, renderer.domElement.height],
  };
  window.__benchResult = result;
  toast(`Bench xong: ${result.avg_fps} FPS trung bình, 1% thấp ${result.p1_low_fps} FPS`);
  fetch("/__bench", { method: "POST", body: JSON.stringify(result) }).catch(() => console.log("bench result", result));
}

window.__playNight = (n) => { if (!runSeed) runSeed = 1; showIntro(n); beginNight(); }; // console shortcut for demos and screenshots
window.__game = () => game; // read-only peek for debugging and evidence screenshots
window.__frame = (n = 1) => { for (let i = 0; i < n; i++) { for (const e of step(game, held)) handle(e); render(1 / 60, performance.now() / 1000); } hud(); renderer.render(scene, camera); };

if (BENCH) runBench();
else {
  game = createGame({ seed: 1, night: 1 });
  buildWorld(1);
  showMenu();
  requestAnimationFrame(frame);
}
