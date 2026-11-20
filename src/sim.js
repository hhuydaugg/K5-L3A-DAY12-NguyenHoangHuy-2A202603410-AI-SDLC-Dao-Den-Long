// Đảo Đèn Lồng — game logic shared by the browser game and the headless runner (Test Contract v1.2).
// Pure: no DOM, no wall clock, no Math.random. Same seed + night + scenario + inputs => same states.
// Numbers and maps follow Ticket-02 "số liệu chuẩn" / "bản đồ chuẩn"; tick order follows its "Thứ tự xử lý".
// Ticket-03 "Đèn cạn dầu" replaces: lit lanterns burn fuel and can go out, shades drain weak lanterns,
// the night is won only at dawn with enough lanterns lit, capacity grows, new scoring (docs/adr/0001-lantern-fuel.md).

export const TICK_HZ = 60;
export const NIGHTS = [1, 2, 3];

// Declared 1:1 in game.contract.json "tuning" (tests/contract.test.mjs keeps them equal).
export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  // Ticket-03: +5 per mote put into a lantern, no time bonus; relight / drain-stun / dawn bonuses are in RULES
  score: Object.freeze({ per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50 }),
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  night2_duration_s: 270,
  night3_duration_s: 300,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
});

// Standard rules from Ticket-02 that are not contract keys, plus a few documented assumptions (marked A-xx,
// see docs/notes/phase-2.md).
export const RULES = Object.freeze({
  accel_s: 0.1, jump_speed: 7, gravity: 20, step_up: 0.3, pickup_dy: 1.5,
  motes_initial: 20, motes_cap: 30, mote_spawn_every: 240,
  drop_ring: [1.5, 2.5], drop_ttl: 480,
  fall_y: -10, respawn_wait: 60, respawn_invuln: 90,
  safe_eject_ticks: 30, pulse_center_dy: 0.8, pulse_push_ticks: 15, stun_ticks: 120,
  shade_detect: 12, shade_giveup: 18, shade_hit_dy: 1.5, recoil_m: 2, recoil_ticks: 60,
  shade_first_spawn: 300, shade_height: 1,
  shade_spawning_ticks: 30, shade_wander_speed: 1.5, // A-05, A-06
  shade_min_spawn_dist: 15,
  drifter_speed: 7, drifter_idle_speed: 2, drifter_max: 2, drifter_every: 1200, drifter_need: 5,
  drifter_range: 15, drifter_touch: 1.2, drifter_steal: 3, drifter_flee_ticks: 240, drifter_vanish_ticks: 120,
  drifter_height: 1.5, // A-08
  charm_ticks: 600, charm_speed: 7.2, charm_respawn: 2700,
  wind_every: 1800, wind_ticks: 300, wind_speed: 2, wind_warn: 120,
  // Ticket-03
  capacity_per_light: 2, drain_range: 2, drain_chase: 6, fuel_drain_event_every: 60,
  score_relight: 40, score_stun_drain: 15, score_dawn_lantern: 50,
});

// Fuel is kept in integer units of 1/60 (Ticket-03 "Độ chính xác"): decay = 1 unit/tick, drain = 5 units/tick.
const FU = TICK_HZ;
const FUEL_MAX = TUNING.fuel_max * FU, FUEL_LOW = TUNING.low_fuel_threshold * FU, FUEL_MOTE = TUNING.fuel_per_mote * FU;
const FUEL_DECAY = (TUNING.fuel_decay_per_s * FU) / TICK_HZ, FUEL_DRAIN = (TUNING.drain_per_s * FU) / TICK_HZ;
export const fuelOf = (l) => Math.round((l.f * 10) / FU) / 10; // 1 decimal, as the contract asks
export const hasSafeZone = (l) => l.lit && l.f >= FUEL_LOW; // exactly 30 still keeps the safe zone
export const capacityOf = (p) => Math.min(TUNING.capacity_max, TUNING.carry_capacity + RULES.capacity_per_light * p.lights);
export const winNeed = (n) => Math.ceil(TUNING.win_ratio * n - 1e-9);

const deg = (d) => (d * Math.PI) / 180;
// Map angles: from +X, counter-clockwise seen from above, in the XZ plane => (r cos a, r sin a).
const polar = (r, a, y = 0, cx = 0, cz = 0) => [cx + r * Math.cos(deg(a)), y, cz + r * Math.sin(deg(a))];
const ring = (r, from, stepDeg, n, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => polar(r, from + i * stepDeg, y, cx, cz));
const hyp = Math.hypot;

function ramp(x, z, angle) { // straight ramp 3 m wide along the radius: r 30 (Y 0) -> r 24 (Y 3)
  const ux = Math.cos(deg(angle)), uz = Math.sin(deg(angle));
  const s = x * ux + z * uz, side = Math.abs(-x * uz + z * ux);
  return side <= 1.5 && s >= 24 && s <= 30 ? (3 * (30 - s)) / 6 : null;
}

export const MAPS = {
  1: {
    name: "Đảo Bến", duration: TUNING.night1_duration_s, start: [0, 0, 0], shadeSpeed: 4,
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadePoints: ring(37, 15, 30, 12), shadeEvery: 480, shadeMax: 6,
    charms: [], pads: [], drifters: false, wind: false,
    ground: (x, z) => (hyp(x, z) <= 40 ? 0 : null),
  },
  2: {
    name: "Đảo Cau", duration: TUNING.night2_duration_s, start: [0, 0, 0], shadeSpeed: 4,
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8), ...ring(10, 0, 90, 4, 0, 70), ...ring(22, 0, 45, 8, 0, 70)],
    shadePoints: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, 70)], shadeEvery: 420, shadeMax: 8,
    charms: [[35, 0, 0]], drifters: true, wind: false,
    pads: [{ pos: [20, 0, 18], vy: 14, toward: [70, 0, 0], vh: 24 }, { pos: [50, 0, -18], vy: 14, toward: [0, 0, 0], vh: 24 }],
    ground: (x, z) => (hyp(x, z) <= 28 || hyp(x - 70, z) <= 28 || (x >= 26 && x <= 44 && z >= -2 && z <= 2) ? 0 : null),
  },
  3: {
    name: "Đảo Chuông", duration: TUNING.night3_duration_s, start: [0, 0, -30], shadeSpeed: 4.5, // A-10 start
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadePoints: ring(43, 0, 22.5, 16), shadeEvery: 360, shadeMax: 10,
    charms: [[30, 0, 25], [-30, 0, 25]], drifters: true, wind: true, obstacles: [{ pos: [0, 0, 0], r: 2 }], // bell tower
    pads: [{ pos: [0, 3, 13], vy: 12, dir: [0, -1], vh: 8 }],
    ground: (x, z) => {
      const r = hyp(x, z);
      if (r > 45) return null;
      if (r <= 2) return 14; // bell tower: 8 m on tier 2, unclimbable
      if (r <= 8) return 6;
      if (z > 0 && r >= 12 && r <= 24) return 3;
      return ramp(x, z, 30) ?? ramp(x, z, 150) ?? 0;
    },
  },
};

export const lanternCount = (night) => MAPS[night].lanterns.length;
export const nightDuration = (night) => MAPS[night].duration;
const T = (s) => Math.round(s * TICK_HZ);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dxz = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);
const d3 = (a, b) => hyp(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => Number(id.slice(1));

/** Build the starting state of one night. `scenario` must already be validated (validateScenario). */
export function createGame({ seed = 0, night = 1, scenario = {} } = {}) {
  const map = MAPS[night];
  const sp = scenario.player ?? {};
  const g = {
    night, map, rng: mulberry32(seed), tick: 0, steps: 0, state: "playing", paused: false, score: 0,
    timeStart: scenario.time_left_s ?? map.duration,
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    randomDrifters: scenario.random_drifters ?? map.drifters,
    windEnabled: scenario.wind_enabled ?? map.wind,
    wind: { active: false, dir_deg: 0, left: 0 },
    player: {
      pos: [...(sp.pos ?? map.start)], vel: [0, 0, 0], facing: [0, 1], grounded: true,
      flames: sp.flames ?? TUNING.flames, carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0, dashCd: sp.dash_cd_ticks ?? 0, pulseCd: sp.pulse_cd_ticks ?? 0, charm: sp.charm_ticks ?? 0,
      dash: 0, dashDir: [0, 1], launch: null, fallWait: 0, falling: false, lights: sp.successful_lights ?? 0,
    },
    lanterns: map.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0, f: 0, everLit: false, relit: 0 })),
    motes: [], shades: [], drifters: [],
    charms: map.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawn: 0 })),
    next: { M: 1, S: 1, D: 1, C: map.charms.length + 1 },
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    result: null,
  };
  const p = g.player;
  p.grounded = groundAt(g, p.pos) !== null && p.pos[1] <= groundAt(g, p.pos) + 1e-9;
  for (const upd of scenario.lanterns ?? []) {
    const l = g.lanterns.find((x) => x.id === upd.id);
    if (upd.pos) l.pos = [...upd.pos];
    if (upd.lit !== undefined) l.lit = upd.lit;
    if (upd.deposited !== undefined) l.deposited = upd.deposited;
    else if (l.lit) l.deposited = TUNING.lantern_cost;
    l.f = l.lit ? Math.round((upd.fuel ?? TUNING.fuel_max) * FU) : 0; // lit without fuel => 100
    l.everLit = upd.ever_lit ?? l.lit;
  }
  if (scenario.motes) scenario.motes.forEach((m) => addMote(g, m, "random", null));
  else if (g.randomMotes) {
    const pts = shuffled(g, map.motePoints.map((_, i) => i)).slice(0, RULES.motes_initial).sort((a, b) => a - b);
    pts.forEach((i) => addMote(g, map.motePoints[i], "random", null, i));
  }
  const DEFAULT_LEFT = { spawning: RULES.shade_spawning_ticks, stunned: RULES.stun_ticks, recoil: RULES.recoil_ticks, wander: 0, chase: 0, drain: 0 };
  for (const sc of scenario.shades ?? []) {
    const st = sc.state ?? "wander";
    const s = addShade(g, sc.pos, sc.id, st, sc.state_ticks_left ?? DEFAULT_LEFT[st]);
    s.lantern = sc.target_lantern_id ?? (st === "drain" ? nearestLantern(g.lanterns, s.pos)?.id : null) ?? null; // A-19
    if (st === "recoil") {
      const d = dxz(s.pos, p.pos);
      s.push = { dir: d > 1e-9 ? [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d] : [1, 0] };
    }
  }
  (scenario.drifters ?? []).forEach((d) => addDrifter(g, d.pos, d.id, d.state ?? "idle", d.stolen ?? 0));
  if (scenario.charms) {
    g.charms = scenario.charms.map((c, i) => ({ id: c.id ?? `C${i + 1}`, pos: [...c.pos], available: c.available ?? true,
      respawn: c.available === false ? (c.respawn_ticks ?? RULES.charm_respawn) : 0 }));
  }
  return g;
}

function shuffled(g, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(g.rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const groundAt = (g, pos) => g.map.ground(pos[0], pos[2]);

function addMote(g, pos, kind, ttl, point = null) {
  const gy = g.map.ground(pos[0], pos[2]);
  const m = { id: `M${g.next.M++}`, pos: [pos[0], gy ?? pos[1] ?? 0, pos[2]], kind, ttl, point, born: g.steps };
  g.motes.push(m);
  return m;
}

function addShade(g, pos, id, state = "spawning", left = RULES.shade_spawning_ticks) {
  if (!id) {
    while (g.shades.some((s) => s.id === `S${g.next.S}`)) g.next.S++;
    id = `S${g.next.S++}`;
  }
  const s = { id, pos: [pos[0], (g.map.ground(pos[0], pos[2]) ?? 0) + RULES.shade_height, pos[2]], state, left,
    push: null, eject: null, target: null, lantern: null, drained: 0, born: g.steps };
  g.shades.push(s);
  return s;
}

function addDrifter(g, pos, id, state = "idle", stolen = 0) {
  if (!id) {
    while (g.drifters.some((d) => d.id === `D${g.next.D}`)) g.next.D++;
    id = `D${g.next.D++}`;
  }
  const d = { id, pos: [pos[0], (g.map.ground(pos[0], pos[2]) ?? 0) + RULES.drifter_height, pos[2]], state, stolen,
    left: state === "flee" ? RULES.drifter_flee_ticks : 0, stoleOnce: stolen > 0, target: null, born: g.steps };
  g.drifters.push(d);
  return d;
}

// A-07: a drop over the cloud sea or on top of a higher tier / the tower lands at Mây's feet instead
function dropPoint(g, q) {
  const gy = g.map.ground(q[0], q[2]), p = g.player;
  return gy === null || gy > p.pos[1] + RULES.pickup_dy ? [p.pos[0], p.pos[1], p.pos[2]] : q;
}

export const timeLeft = (g) => g.timeStart - g.steps / TICK_HZ;

const nearestLantern = (list, pos) =>
  [...list].sort((a, b) => dxz(a.pos, pos) - dxz(b.pos, pos) || idNum(a.id) - idNum(b.id))[0] ?? null;

// Ticket-03: a wandering shade heads for the nearest lit lantern with fuel < 30; if none, the nearest unlit one.
// It keeps its lantern while that one still qualifies (A-19), so a scenario's target_lantern_id is honoured.
function wanderLantern(g, s) {
  const weak = (l) => l.lit && l.f < FUEL_LOW;
  const ok = g.lanterns.some(weak) ? weak : (l) => !l.lit;
  const cur = s.lantern && g.lanterns.find((l) => l.id === s.lantern);
  if (cur && ok(cur)) return cur;
  const best = nearestLantern(g.lanterns.filter(ok), s.pos);
  s.lantern = best?.id ?? null;
  return best;
}

function moveTowardXZ(pos, target, dist) {
  const d = dxz(pos, target);
  if (d <= 1e-12) return;
  const k = Math.min(1, dist / d);
  pos[0] += (target[0] - pos[0]) * k;
  pos[2] += (target[2] - pos[2]) * k;
}

function randomLandPoint(g, around, radius) {
  for (let i = 0; i < 12; i++) {
    const a = g.rng() * 2 * Math.PI, r = Math.sqrt(g.rng()) * radius;
    const q = [around[0] + r * Math.cos(a), 0, around[2] + r * Math.sin(a)];
    if (g.map.ground(q[0], q[2]) !== null) return q;
  }
  return [...around];
}

/** Advance one tick. `input` = held state { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash, pause }. */
export function step(g, input) {
  const events = [];
  if (g.state !== "playing" && g.state !== "paused") return events;
  g.tick += 1;
  const ev = (name, data) => events.push({ type: "event", tick: g.tick, name, data });
  const pressed = (k) => Boolean(input[k]) && !g.prev[k];
  const remember = () => {
    for (const k of Object.keys(g.prev)) g.prev[k] = Boolean(input[k]);
  };

  // 1. input: pause first (if we just paused, the step ends here)
  if (pressed("pause")) {
    g.paused = !g.paused;
    g.state = g.paused ? "paused" : "playing";
    ev(g.paused ? "paused" : "resumed", {});
    if (g.paused) { remember(); return events; }
  }
  if (g.paused) { remember(); return events; }
  g.steps += 1;
  const p = g.player, map = g.map;

  // 2. counters
  for (const k of ["invuln", "dashCd", "pulseCd", "charm"]) if (p[k] > 0) p[k] -= 1;
  for (const s of g.shades) if (s.left > 0) s.left -= 1;
  for (const m of g.motes) if (m.ttl !== null) m.ttl -= 1;
  g.motes = g.motes.filter((m) => m.ttl === null || m.ttl > 0);
  for (const c of g.charms) if (!c.available && --c.respawn <= 0) { c.available = true; c.respawn = 0; }
  if (g.windEnabled) {
    if (g.wind.active && --g.wind.left <= 0) g.wind.active = false;
    if (g.steps % RULES.wind_every === 0) {
      g.wind = { active: true, dir_deg: Math.round(g.rng() * 3600) / 10, left: RULES.wind_ticks };
    }
  }
  // fuel (Ticket-03): lit lanterns burn 1/s, each draining shade takes 5/s more; right after, empty lanterns go out
  for (const l of g.lanterns) if (l.lit) l.f -= FUEL_DECAY;
  const drains = [];
  for (const s of g.shades) {
    const l = s.state === "drain" && g.lanterns.find((x) => x.id === s.lantern);
    if (!l || !l.lit) continue;
    l.f -= FUEL_DRAIN;
    if (++s.drained % RULES.fuel_drain_event_every === 0) drains.push([l, s]);
  }
  for (const [l, s] of drains) ev("fuel_drain", { lantern_id: l.id, shade_id: s.id, fuel: fuelOf({ f: Math.max(0, l.f) }) });
  for (const l of g.lanterns) {
    if (!l.lit || l.f > 0) continue;
    Object.assign(l, { lit: false, f: 0, deposited: 0, everLit: true });
    ev("lantern_out", { lantern_id: l.id });
  }

  // 3. move Mây (run with 0.1 s accel, jump, dash, jump pads, wind), then the fall check
  if (p.fallWait > 0) {
    if (--p.fallWait === 0) {
      p.pos = [...map.start]; p.vel = [0, 0, 0]; p.grounded = true; p.falling = false; p.launch = null; p.dash = 0;
      p.invuln = RULES.respawn_invuln;
    }
  } else {
    const [mx, mz] = input.move ?? [0, 0];
    const th = deg(input.cam_yaw_deg ?? 0);
    let wx = mx * Math.cos(th) + mz * Math.sin(th), wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const len = hyp(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    if (len > 1e-9) { const l = hyp(wx, wz); p.facing = [wx / l, wz / l]; }
    const charmed = p.charm > 0;
    if (pressed("dash") && p.dash === 0 && (p.dashCd === 0 || charmed)) {
      p.dash = T(TUNING.dash_duration_s);
      p.dashDir = len > 1e-9 ? [wx / hyp(wx, wz), wz / hyp(wx, wz)] : [...p.facing];
      if (!charmed) p.dashCd = T(TUNING.dash_cooldown_s); // Bùa Gió: "Lướt không hồi chiêu"
      ev("dash", {});
    }
    if (pressed("jump") && p.grounded) { p.vel[1] = RULES.jump_speed; p.grounded = false; }
    const dashing = p.dash > 0;
    if (dashing) {
      p.vel[0] = p.dashDir[0] * TUNING.dash_speed;
      p.vel[2] = p.dashDir[1] * TUNING.dash_speed;
      p.vel[1] = 0; // dash keeps the height
      p.dash -= 1;
    } else if (p.launch) {
      p.vel[0] = p.launch[0];
      p.vel[2] = p.launch[1];
    } else {
      const speed = charmed ? RULES.charm_speed : TUNING.player_speed;
      const v0 = hyp(p.vel[0], p.vel[2]);
      if (v0 > speed) { p.vel[0] *= speed / v0; p.vel[2] *= speed / v0; } // after a dash: back to run speed, then normal accel/stop
      const maxDv = speed / (RULES.accel_s * TICK_HZ);
      const dvx = wx * speed - p.vel[0], dvz = wz * speed - p.vel[2], dv = hyp(dvx, dvz);
      const k = dv > maxDv ? maxDv / dv : 1;
      p.vel[0] += dvx * k;
      p.vel[2] += dvz * k;
    }
    // horizontal displacement (+ wind), blocked by walls higher than a step
    let nx = p.pos[0] + p.vel[0] / TICK_HZ, nz = p.pos[2] + p.vel[2] / TICK_HZ;
    if (g.wind.active) {
      nx += (Math.cos(deg(g.wind.dir_deg)) * RULES.wind_speed) / TICK_HZ;
      nz += (Math.sin(deg(g.wind.dir_deg)) * RULES.wind_speed) / TICK_HZ;
    }
    const gNew = map.ground(nx, nz);
    if (gNew !== null && gNew > p.pos[1] + RULES.step_up) {
      p.vel[0] = 0; p.vel[2] = 0; // vách đứng: cannot walk or fly into it
    } else { p.pos[0] = nx; p.pos[2] = nz; }
    // vertical
    if (!p.grounded && !dashing) p.vel[1] -= RULES.gravity / TICK_HZ;
    p.pos[1] += p.vel[1] / TICK_HZ;
    const gy = map.ground(p.pos[0], p.pos[2]);
    if (gy !== null && p.pos[1] <= gy && p.vel[1] <= 0) {
      p.pos[1] = gy; p.vel[1] = 0; p.grounded = true; p.launch = null;
    } else if (gy !== null && p.grounded && p.vel[1] <= 0 && p.pos[1] - gy <= RULES.step_up) {
      p.pos[1] = gy; // walk down ramps without bouncing
    } else {
      p.grounded = false;
    }
    if (p.grounded) {
      const pad = map.pads.find((q) => dxz(q.pos, p.pos) <= 1 && Math.abs(p.pos[1] - q.pos[1]) < 1e-6);
      if (pad) {
        const dir = pad.dir ?? (() => { const d = dxz(pad.toward, pad.pos); return [(pad.toward[0] - pad.pos[0]) / d, (pad.toward[2] - pad.pos[2]) / d]; })();
        p.launch = [dir[0] * pad.vh, dir[1] * pad.vh];
        p.vel = [p.launch[0], pad.vy, p.launch[1]];
        p.grounded = false;
      }
    }
    if (p.pos[1] < RULES.fall_y && !p.falling) { // fall: once, ignores invulnerability
      p.falling = true;
      const lost = p.carried;
      p.carried = 0;
      p.flames = Math.max(0, p.flames - 1);
      ev("player_hit", { by: "fall", flames: p.flames, dropped: 0, lost });
      if (p.flames > 0) p.fallWait = RULES.respawn_wait;
    }
  }
  const away = p.fallWait > 0 || p.falling; // waiting to respawn: no pickups, cannot be touched

  // 4. pick up motes and charms
  if (!away && p.flames > 0) {
    const reach = (pos) => dxz(pos, p.pos) <= TUNING.pickup_radius + 1e-9 && Math.abs(p.pos[1] - pos[1]) <= RULES.pickup_dy;
    for (const m of [...g.motes]) {
      if (p.carried >= capacityOf(p)) break;
      if (m.born < g.steps && reach(m.pos)) {
        g.motes.splice(g.motes.indexOf(m), 1);
        p.carried += 1;
        ev("mote_picked", { carried: p.carried });
      }
    }
    for (const c of g.charms) {
      if (c.available && reach(c.pos)) {
        c.available = false;
        c.respawn = RULES.charm_respawn;
        p.charm = RULES.charm_ticks;
        ev("charm_picked", { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // 5. interact with the nearest lantern that can take motes (unlit, or lit but not full; tie => lower id):
  //    unlit => deposit towards 10 (5 if it was lit before), lit => refuel 10 fuel per mote
  const litNow = [];
  if (!away && pressed("interact") && p.carried > 0) {
    const l = nearestLantern(g.lanterns.filter((x) => (!x.lit || x.f < FUEL_MAX)
      && dxz(x.pos, p.pos) <= TUNING.interact_radius + 1e-9 && Math.abs(x.pos[1] - p.pos[1]) <= RULES.pickup_dy), p.pos);
    if (l && l.lit) {
      const wasLow = l.f < FUEL_LOW;
      const used = Math.min(p.carried, Math.ceil((FUEL_MAX - l.f) / FUEL_MOTE));
      l.f = Math.min(FUEL_MAX, l.f + used * FUEL_MOTE);
      p.carried -= used;
      g.score += used * TUNING.score.per_mote;
      ev("refuel", { lantern_id: l.id, amount: used, fuel: fuelOf(l) });
      // raised from < 30 to >= 30: shades inside are pushed out like on lighting. Above 30 already, shades only sit
      // on the 6 m edge, and float rounding must not count them as inside (review-phase-3 #1)
      if (wasLow && l.f >= FUEL_LOW) litNow.push(l);
    } else if (l) {
      const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
      const amount = Math.min(p.carried, Math.max(0, cost - l.deposited));
      p.carried -= amount;
      l.deposited += amount;
      g.score += amount * TUNING.score.per_mote;
      ev("deposit", { lantern_id: l.id, amount, deposited: l.deposited });
      if (l.deposited >= cost) {
        const relight = l.everLit;
        Object.assign(l, { lit: true, f: FUEL_MAX, everLit: true, relit: l.relit + (relight ? 1 : 0) });
        p.lights += 1;
        g.score += relight ? RULES.score_relight : TUNING.score.per_lantern;
        litNow.push(l);
        ev("lantern_lit", { lantern_id: l.id, relight });
      }
    }
  }

  // 6. safe zones: shades inside a lantern that just lit (or was refuelled to >= 30) are pushed to its edge
  //    over <= 30 ticks, harmless meanwhile; a shade draining THIS lantern goes back to wander
  for (const l of litNow) {
    for (const s of g.shades) {
      const d = dxz(s.pos, l.pos);
      if (d < TUNING.safe_radius) {
        s.eject = { lantern: l.id, left: RULES.safe_eject_ticks };
        if (s.state === "drain" && s.lantern === l.id) s.state = "wander";
      }
    }
  }

  // 7. pulse: costs 3 motes; targets fixed now (3D distance to the shade centre <= 5 from feet + 0.8)
  if (!away && pressed("pulse") && p.carried >= TUNING.pulse_cost && p.pulseCd === 0) {
    p.carried -= TUNING.pulse_cost;
    p.pulseCd = T(TUNING.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + RULES.pulse_center_dy, p.pos[2]];
    const hit = g.shades.filter((s) => d3(s.pos, c) <= TUNING.pulse_radius + 1e-9);
    for (const s of hit) {
      const d = dxz(s.pos, c);
      g.score += s.state === "drain" ? RULES.score_stun_drain : TUNING.score.per_stun;
      s.state = "stunned";
      s.left = RULES.stun_ticks;
      s.push = { dir: d > 1e-9 ? [(s.pos[0] - c[0]) / d, (s.pos[2] - c[2]) / d] : [1, 0], left: RULES.pulse_push_ticks };
      s.eject = null;
    }
    ev("pulse", { stunned_ids: hit.map((s) => s.id) });
    for (const dr of g.drifters) {
      if (dr.state === "removed" || d3(dr.pos, c) > TUNING.pulse_radius + 1e-9) continue;
      if (dr.state === "chase" || dr.state === "idle") {
        if (dr.state === "chase") { dr.state = "flee"; dr.left = RULES.drifter_flee_ticks; dr.stoleOnce = true; dr.setAt = g.steps; }
      } else if (dr.state === "flee" && dr.stolen > 0) {
        const amount = dr.stolen;
        for (let i = 0; i < amount; i++) addMote(g, dropPoint(g, [dr.pos[0], 0, dr.pos[2]]), "dropped", RULES.drop_ttl);
        dr.stolen = 0;
        dr.left = RULES.drifter_vanish_ticks;
        dr.setAt = g.steps;
        ev("drifter_drop", { drifter_id: dr.id, amount });
      }
    }
  }

  // 8. move shades and drifters
  const shadeSpeed = map.shadeSpeed / TICK_HZ;
  for (const s of g.shades) {
    const ejecting = Boolean(s.eject);
    if (s.eject) {
      const l = g.lanterns.find((x) => x.id === s.eject.lantern);
      const d = dxz(s.pos, l.pos);
      const dir = d > 1e-9 ? [(s.pos[0] - l.pos[0]) / d, (s.pos[2] - l.pos[2]) / d] : [1, 0];
      const nd = d + (TUNING.safe_radius - d) / s.eject.left;
      s.pos[0] = l.pos[0] + dir[0] * nd;
      s.pos[2] = l.pos[2] + dir[1] * nd;
      if (--s.eject.left <= 0) s.eject = null;
    } else if (s.state === "drain") { // stands still; leaves drain on Mây within 6 m, lantern out, or > 2 m away
      const l = g.lanterns.find((x) => x.id === s.lantern);
      if (!away && p.flames > 0 && dxz(s.pos, p.pos) <= RULES.drain_chase + 1e-9) s.state = "chase";
      else if (!l || !l.lit || dxz(s.pos, l.pos) > RULES.drain_range + 1e-9) s.state = "wander";
    } else if (s.state === "stunned") {
      if (s.push && s.push.left > 0) {
        s.pos[0] += (s.push.dir[0] * TUNING.pulse_push_m) / RULES.pulse_push_ticks;
        s.pos[2] += (s.push.dir[1] * TUNING.pulse_push_m) / RULES.pulse_push_ticks;
        s.push.left -= 1;
      }
      if (s.left <= 0) { s.state = "wander"; s.push = null; }
    } else if (s.state === "recoil") {
      if (s.push) {
        s.pos[0] += (s.push.dir[0] * RULES.recoil_m) / RULES.recoil_ticks;
        s.pos[2] += (s.push.dir[1] * RULES.recoil_m) / RULES.recoil_ticks;
      }
      if (s.left <= 0) { s.state = "wander"; s.push = null; }
    } else if (s.state === "spawning") {
      if (s.left <= 0) s.state = "wander";
    }
    if (!ejecting && (s.state === "wander" || s.state === "chase")) {
      const d = dxz(s.pos, p.pos);
      const visible = !away && p.flames > 0;
      if (s.state === "wander" && visible && d <= RULES.shade_detect) s.state = "chase";
      else if (s.state === "chase" && (!visible || d > RULES.shade_giveup)) { s.state = "wander"; s.target = null; }
      const l = s.state === "wander" ? wanderLantern(g, s) : null;
      if (s.state === "chase") moveTowardXZ(s.pos, p.pos, shadeSpeed);
      else if (l) { // A-18: heading for a lantern at shade speed; within 2 m of a weak lit one => drain
        moveTowardXZ(s.pos, l.pos, shadeSpeed);
        if (l.lit && dxz(s.pos, l.pos) <= RULES.drain_range + 1e-9) { s.state = "drain"; s.drained = 0; }
      } else {
        if (!s.target || dxz(s.pos, s.target) < 0.5) s.target = randomLandPoint(g, s.pos, 8);
        moveTowardXZ(s.pos, s.target, RULES.shade_wander_speed / TICK_HZ);
      }
    }
    for (const l of g.lanterns) { // lanterns with fuel >= 30 block shades at the edge of their safe zone
      if (!hasSafeZone(l) || (s.eject && s.eject.lantern === l.id)) continue;
      const d = dxz(s.pos, l.pos);
      if (d < TUNING.safe_radius) {
        const dir = d > 1e-9 ? [(s.pos[0] - l.pos[0]) / d, (s.pos[2] - l.pos[2]) / d] : [1, 0];
        s.pos[0] = l.pos[0] + dir[0] * TUNING.safe_radius;
        s.pos[2] = l.pos[2] + dir[1] * TUNING.safe_radius;
      }
    }
    for (const o of map.obstacles ?? []) {
      const d = dxz(s.pos, o.pos);
      if (d < o.r) {
        const dir = d > 1e-9 ? [(s.pos[0] - o.pos[0]) / d, (s.pos[2] - o.pos[2]) / d] : [1, 0];
        s.pos[0] = o.pos[0] + dir[0] * o.r;
        s.pos[2] = o.pos[2] + dir[1] * o.r;
      }
    }
    s.pos[1] = (map.ground(s.pos[0], s.pos[2]) ?? 0) + RULES.shade_height;
  }
  for (const dr of g.drifters) {
    if (dr.state === "removed") continue;
    if (dr.state === "flee") {
      const d = dxz(dr.pos, p.pos);
      const dir = d > 1e-9 ? [(dr.pos[0] - p.pos[0]) / d, (dr.pos[2] - p.pos[2]) / d] : [1, 0];
      dr.pos[0] += (dir[0] * RULES.drifter_speed) / TICK_HZ;
      dr.pos[2] += (dir[1] * RULES.drifter_speed) / TICK_HZ;
      if (dr.setAt !== g.steps && --dr.left <= 0) dr.state = "removed";
    } else {
      const want = !away && !dr.stoleOnce && p.carried >= RULES.drifter_need && dxz(dr.pos, p.pos) <= RULES.drifter_range;
      dr.state = want ? "chase" : "idle";
      if (want) moveTowardXZ(dr.pos, p.pos, RULES.drifter_speed / TICK_HZ);
      else {
        if (!dr.target || dxz(dr.pos, dr.target) < 0.5) dr.target = randomLandPoint(g, dr.pos, 10);
        moveTowardXZ(dr.pos, dr.target, RULES.drifter_idle_speed / TICK_HZ);
      }
    }
    dr.pos[1] = (map.ground(dr.pos[0], dr.pos[2]) ?? 0) + RULES.drifter_height;
  }

  // 9. contact: drifters steal first, then shades hit (ascending id, at most one flame per tick)
  if (!away && p.flames > 0) {
    for (const dr of [...g.drifters].sort((a, b) => idNum(a.id) - idNum(b.id))) {
      if (dr.state !== "chase" || dr.born >= g.steps || dxz(dr.pos, p.pos) > RULES.drifter_touch + 1e-9) continue;
      const amount = Math.min(RULES.drifter_steal, p.carried);
      p.carried -= amount;
      dr.stolen = amount;
      dr.stoleOnce = true;
      dr.state = "flee";
      dr.left = RULES.drifter_flee_ticks;
      ev("drifter_steal", { drifter_id: dr.id, amount, carried: p.carried });
    }
    for (const s of [...g.shades].sort((a, b) => idNum(a.id) - idNum(b.id))) {
      if (!(s.state === "wander" || s.state === "chase") || s.eject || s.born >= g.steps) continue;
      if (dxz(s.pos, p.pos) > TUNING.shade_hit_radius + 1e-9 || Math.abs(s.pos[1] - p.pos[1]) > RULES.shade_hit_dy) continue;
      if (p.invuln > 0) continue; // touching an invulnerable Mây does nothing
      const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
      p.carried -= dropped;
      for (let i = 0; i < dropped; i++) {
        const a = g.rng() * 2 * Math.PI, r = RULES.drop_ring[0] + g.rng() * (RULES.drop_ring[1] - RULES.drop_ring[0]);
        addMote(g, dropPoint(g, [p.pos[0] + r * Math.cos(a), 0, p.pos[2] + r * Math.sin(a)]), "dropped", RULES.drop_ttl);
      }
      p.flames = Math.max(0, p.flames - 1);
      p.invuln = T(TUNING.invuln_s);
      const d = dxz(s.pos, p.pos);
      s.state = "recoil";
      s.left = RULES.recoil_ticks;
      s.push = { dir: d > 1e-9 ? [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d] : [1, 0] };
      ev("player_hit", { by: "shade", flames: p.flames, dropped });
      break;
    }
  }

  // 10. scheduled spawns (new entities interact from the next tick)
  if (g.randomMotes && g.steps % RULES.mote_spawn_every === 0 && g.motes.length < RULES.motes_cap) {
    const used = new Set(g.motes.filter((m) => m.point !== null).map((m) => m.point));
    const free = map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) {
      const i = free[Math.floor(g.rng() * free.length)];
      addMote(g, map.motePoints[i], "random", null, i);
    }
  }
  if (g.randomShades && g.steps >= RULES.shade_first_spawn && (g.steps - RULES.shade_first_spawn) % map.shadeEvery === 0) {
    const want = g.steps === RULES.shade_first_spawn ? 2 : 1;
    for (let i = 0; i < want && g.shades.length < map.shadeMax; i++) {
      const ok = map.shadePoints.filter((q) => dxz(q, p.pos) >= RULES.shade_min_spawn_dist
        && !g.lanterns.some((l) => hasSafeZone(l) && dxz(q, l.pos) < TUNING.safe_radius)
        && !g.shades.some((s) => dxz(s.pos, q) < 1e-6));
      if (!ok.length) break;
      ev("shade_spawned", { id: addShade(g, ok[Math.floor(g.rng() * ok.length)]).id });
    }
  }
  if (g.randomDrifters && g.steps % RULES.drifter_every === 0
      && g.drifters.filter((d) => d.state !== "removed").length < RULES.drifter_max) {
    addDrifter(g, map.shadePoints[Math.floor(g.rng() * map.shadePoints.length)]);
  }

  // 11. win / lose (Ticket-03): no early win; at dawn Mây wins with >= ceil(0.6 x lanterns) lit; 0 flames always loses first
  if (p.flames === 0) finish(g, "lost", "no_flames", ev);
  else if (timeLeft(g) <= 1e-9) {
    const lit = g.lanterns.filter((l) => l.lit);
    if (lit.length >= winNeed(g.lanterns.length)) {
      for (const l of lit) g.score += RULES.score_dawn_lantern + Math.floor(l.f / FU);
      g.score += TUNING.score.per_flame_left * p.flames;
      finish(g, "won", "dawn_survived", ev);
    } else finish(g, "lost", "dawn", ev);
  }

  remember();
  return events;
}

function finish(g, result, reason, ev) {
  g.state = result;
  g.result = { result, reason };
  ev("game_over", { result, reason });
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const vec = (v) => v.map(r3);
const secs = (ticks) => r3(Math.max(0, ticks) / TICK_HZ);

export function snapshot(g) {
  const p = g.player;
  return {
    type: "snapshot",
    tick: g.tick,
    sim_tick: g.steps,
    night: g.night,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.dir_deg },
    player: {
      pos: vec(p.pos), vel: vec(p.vel), grounded: p.grounded, flames: p.flames, carried: p.carried,
      invuln: p.invuln > 0, dash_cd_s: secs(p.dashCd), pulse_cd_s: secs(p.pulseCd), charm_s: secs(p.charm),
      capacity: capacityOf(p),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: vec(l.pos), lit: l.lit, deposited: l.deposited,
      fuel: fuelOf(l), ever_lit: l.everLit, relit_count: l.relit })),
    shades: g.shades.map((s) => ({ id: s.id, pos: vec(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: vec(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : secs(m.ttl) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: vec(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: vec(c.pos), available: c.available, respawn_s: secs(c.respawn) })),
  };
}

// ---------- validation of test files (malformed => headless exits with code 2) ----------

export class InputError extends Error {}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isTicks = (v) => Number.isInteger(v) && v >= 0;
const fail = (msg) => { throw new InputError(msg); };
const SHADE_STATES = ["spawning", "wander", "chase", "recoil", "stunned", "drain"];
const DRIFTER_STATES = ["idle", "chase", "flee", "removed"];

export function validateInputs(doc) {
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.frames)) fail("inputs: expected an object with a 'frames' array");
  let last = -1;
  doc.frames.forEach((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (!f || typeof f !== "object" || Array.isArray(f)) fail(`${where}: expected an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(`${where}.tick: expected a non-negative integer`);
    if (f.tick <= last) fail(`${where}.tick: ticks must strictly increase`);
    last = f.tick;
    if ("move" in f && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((v) => isNum(v) && v >= -1 && v <= 1))) {
      fail(`${where}.move: expected [x, z] with each value in [-1, 1]`);
    }
    if ("cam_yaw_deg" in f && !isNum(f.cam_yaw_deg)) fail(`${where}.cam_yaw_deg: expected a number`);
    for (const k of ["jump", "interact", "pulse", "dash", "pause"]) {
      if (k in f && typeof f[k] !== "boolean") fail(`${where}.${k}: expected a boolean`);
    }
  });
  return doc;
}

export function validateScenario(doc, night = 1) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) fail("scenario: expected an object");
  const pl = doc.player;
  if (pl !== undefined) {
    if (!pl || typeof pl !== "object" || Array.isArray(pl)) fail("scenario.player: expected an object");
    if ("pos" in pl && !isVec3(pl.pos)) fail("scenario.player.pos: expected [x, y, z]");
    if ("carried" in pl && !(isTicks(pl.carried) && pl.carried <= TUNING.capacity_max)) {
      fail(`scenario.player.carried: expected an integer in [0, ${TUNING.capacity_max}]`);
    }
    if ("successful_lights" in pl && !isTicks(pl.successful_lights)) fail("scenario.player.successful_lights: expected a non-negative integer");
    if ("flames" in pl && !(Number.isInteger(pl.flames) && pl.flames >= 1)) fail("scenario.player.flames: expected an integer >= 1");
    for (const k of ["invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks"]) {
      if (k in pl && !isTicks(pl[k])) fail(`scenario.player.${k}: expected a non-negative integer`);
    }
  }
  for (const k of ["random_motes", "random_shades", "random_drifters", "wind_enabled"]) {
    if (k in doc && typeof doc[k] !== "boolean") fail(`scenario.${k}: expected a boolean`);
  }
  if ("motes" in doc && !(Array.isArray(doc.motes) && doc.motes.every(isVec3))) fail("scenario.motes: expected a list of [x, y, z]");
  const list = (key, check) => {
    if (!(key in doc)) return;
    if (!Array.isArray(doc[key])) fail(`scenario.${key}: expected a list`);
    const ids = new Set();
    doc[key].forEach((s, i) => {
      if (!s || typeof s !== "object" || !isVec3(s.pos)) fail(`scenario.${key}[${i}].pos: expected [x, y, z]`);
      if ("id" in s && (typeof s.id !== "string" || !s.id || ids.has(s.id))) fail(`scenario.${key}[${i}].id: expected a unique string`);
      if ("id" in s) ids.add(s.id);
      check(s, `scenario.${key}[${i}]`);
    });
  };
  const n = lanternCount(night);
  const isLanternId = (id) => typeof id === "string" && /^L\d+$/.test(id) && idNum(id) >= 1 && idNum(id) <= n;
  list("shades", (s, w) => {
    if ("state" in s && !SHADE_STATES.includes(s.state)) fail(`${w}.state: expected one of ${SHADE_STATES.join(", ")}`);
    if ("state_ticks_left" in s && !isTicks(s.state_ticks_left)) fail(`${w}.state_ticks_left: expected a non-negative integer`);
    if ("target_lantern_id" in s && !isLanternId(s.target_lantern_id)) fail(`${w}.target_lantern_id: expected one of L1..L${n} for night ${night}`);
  });
  list("drifters", (d, w) => {
    if ("state" in d && !DRIFTER_STATES.includes(d.state)) fail(`${w}.state: expected one of ${DRIFTER_STATES.join(", ")}`);
    if ("stolen" in d && !isTicks(d.stolen)) fail(`${w}.stolen: expected a non-negative integer`);
  });
  list("charms", (c, w) => {
    if ("available" in c && typeof c.available !== "boolean") fail(`${w}.available: expected a boolean`);
    if ("respawn_ticks" in c && !isTicks(c.respawn_ticks)) fail(`${w}.respawn_ticks: expected a non-negative integer`);
  });
  if ("lanterns" in doc) {
    if (!Array.isArray(doc.lanterns)) fail("scenario.lanterns: expected a list");
    doc.lanterns.forEach((l, i) => {
      if (!l || typeof l !== "object" || !isLanternId(l.id)) fail(`scenario.lanterns[${i}].id: expected one of L1..L${n} for night ${night}`);
      if ("pos" in l && !isVec3(l.pos)) fail(`scenario.lanterns[${i}].pos: expected [x, y, z]`);
      if ("lit" in l && typeof l.lit !== "boolean") fail(`scenario.lanterns[${i}].lit: expected a boolean`);
      if ("ever_lit" in l && typeof l.ever_lit !== "boolean") fail(`scenario.lanterns[${i}].ever_lit: expected a boolean`);
      if ("fuel" in l && !(isNum(l.fuel) && l.fuel >= 0 && l.fuel <= TUNING.fuel_max)) {
        fail(`scenario.lanterns[${i}].fuel: expected a number in [0, ${TUNING.fuel_max}]`);
      }
      if ("deposited" in l && !(isTicks(l.deposited) && l.deposited <= TUNING.lantern_cost)) {
        fail(`scenario.lanterns[${i}].deposited: expected an integer in [0, ${TUNING.lantern_cost}]`);
      }
    });
  }
  if ("time_left_s" in doc && !(isNum(doc.time_left_s) && doc.time_left_s > 0)) fail("scenario.time_left_s: expected a number > 0");
  return doc;
}

/** Held input for each tick, from a validated inputs doc (frames change only the fields they carry). */
export function inputTimeline(doc) {
  const frames = doc?.frames ?? [];
  let i = 0;
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  return (tick) => {
    while (i < frames.length && frames[i].tick <= tick) {
      const { tick: _t, ...fields } = frames[i++];
      for (const k of Object.keys(cur)) if (k in fields) cur[k] = fields[k];
    }
    return cur;
  };
}
