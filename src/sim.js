// Đảo Đèn Lồng — game logic shared by the browser game and the headless runner.
// Pure: no DOM, no wall clock, no Math.random. Same seed + scenario + inputs => same states.

export const TICK_HZ = 60;
export const NIGHTS = [1];

// Every number here is declared in game.contract.json "tuning" (tests/contract.test.mjs keeps them equal).
export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 3,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1.5,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: Object.freeze({ per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 }),
});

// Level constants that are not part of the contract (documented in docs/notes/phase-1.md).
export const WORLD = Object.freeze({
  island_radius: 40,
  lantern_ring_radius: 25,
  jump_speed: 7,
  gravity: 20,
  shade_height: 1,
  motes_initial: 20,
  motes_target: 20,
  mote_respawn_s: 3,
  mote_min_r: 4,
  mote_max_r: 36,
  shades_initial: 2,
  shades_max: 5,
  shade_spawn_s: 45,
  shade_spawn_min_r: 34,
  shade_spawn_max_r: 38,
});

const T = (s) => Math.round(s * TICK_HZ);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hdist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function randomPointInRing(rng, rMin, rMax) {
  const ang = rng() * Math.PI * 2;
  const r = Math.sqrt(rMin * rMin + rng() * (rMax * rMax - rMin * rMin)); // uniform over the ring area
  return [r * Math.sin(ang), 0, r * Math.cos(ang)];
}

function defaultLanterns() {
  const out = [];
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const ang = (i * 2 * Math.PI) / TUNING.lantern_count_night1; // L1 at (0, 0, 25), then clockwise from above
    const r = WORLD.lantern_ring_radius;
    out.push({ id: `L${i + 1}`, pos: [r * Math.sin(ang), 0, r * Math.cos(ang)], lit: false, deposited: 0 });
  }
  return out;
}

/** Build the starting state. `scenario` must already be validated (see validateScenario). */
export function createGame({ seed = 0, scenario = {} } = {}) {
  const rng = mulberry32(seed);
  const g = {
    rng,
    steps: 0,
    state: "playing",
    score: 0,
    timeStart: scenario.time_left_s ?? TUNING.night1_duration_s,
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
    player: {
      pos: [...(scenario.player?.pos ?? [0, 0, 0])],
      vy: 0,
      flames: scenario.player?.flames ?? TUNING.flames,
      carried: scenario.player?.carried ?? 0,
      invuln: 0,
    },
    lanterns: defaultLanterns(),
    motes: [],
    shades: [],
    nextMote: 1,
    nextShade: 1,
    lastPulseStep: -Infinity,
    prev: { jump: false, interact: false, pulse: false, dash: false },
    gameOver: null,
  };
  for (const upd of scenario.lanterns ?? []) {
    const l = g.lanterns.find((x) => x.id === upd.id);
    if (upd.pos) l.pos = [...upd.pos];
    if (upd.lit !== undefined) l.lit = upd.lit;
    if (upd.deposited !== undefined) l.deposited = upd.deposited;
    else if (l.lit) l.deposited = TUNING.lantern_cost;
  }
  if (scenario.motes) scenario.motes.forEach((p) => addMote(g, [p[0], 0, p[2]]));
  else if (g.randomMotes) for (let i = 0; i < WORLD.motes_initial; i++) addMote(g, randomPointInRing(rng, WORLD.mote_min_r, WORLD.mote_max_r));
  if (scenario.shades) scenario.shades.forEach((s) => addShade(g, s.pos, s.id));
  else if (g.randomShades) for (let i = 0; i < WORLD.shades_initial; i++) addShade(g, shadeSpawnPoint(g));
  return g;
}

function addMote(g, pos) {
  const m = { id: `M${g.nextMote++}`, pos };
  g.motes.push(m);
  return m;
}

function addShade(g, pos, id) {
  if (!id) {
    while (g.shades.some((s) => s.id === `S${g.nextShade}`)) g.nextShade++;
    id = `S${g.nextShade++}`;
  }
  const s = { id, pos: [pos[0], WORLD.shade_height, pos[2]], state: "chase", stun: 0 };
  g.shades.push(s);
  return s;
}

function shadeSpawnPoint(g) {
  for (let i = 0; i < 20; i++) {
    const p = randomPointInRing(g.rng, WORLD.shade_spawn_min_r, WORLD.shade_spawn_max_r);
    if (hdist(p, g.player.pos) >= 15) return p;
  }
  const p = g.player.pos; // shortcut: island edge opposite the player, only reached if 20 draws all landed close
  const r = Math.hypot(p[0], p[2]) || 1;
  return [(-p[0] / r) * WORLD.shade_spawn_max_r, 0, (-p[2] / r) * WORLD.shade_spawn_max_r];
}

export const timeLeft = (g) => g.timeStart - g.steps / TICK_HZ;

function finish(g, result, reason, events, tick) {
  g.state = result;
  g.gameOver = { result, reason };
  events.push({ type: "event", tick, name: "game_over", data: { result, reason } });
}

/**
 * Advance one tick. `input` = { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash } (already the held state
 * for this tick). Returns the events of this step, stamped tick = steps after the step.
 */
export function step(g, input) {
  const events = [];
  if (g.state !== "playing") return events;
  g.steps += 1;
  const tick = g.steps;
  const ev = (name, data) => events.push({ type: "event", tick, name, data });
  const pressed = (k) => Boolean(input[k]) && !g.prev[k];
  const p = g.player;

  // 1. movement relative to camera yaw (contract formula), clamped to the island (no falling in Night 1)
  let [mx, mz] = input.move ?? [0, 0];
  const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
  let wx = mx * Math.cos(th) + mz * Math.sin(th);
  let wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const len = Math.hypot(wx, wz);
  if (len > 1) { wx /= len; wz /= len; }
  p.pos[0] += (wx * TUNING.player_speed) / TICK_HZ;
  p.pos[2] += (wz * TUNING.player_speed) / TICK_HZ;
  const pr = Math.hypot(p.pos[0], p.pos[2]);
  if (pr > WORLD.island_radius) {
    p.pos[0] *= WORLD.island_radius / pr;
    p.pos[2] *= WORLD.island_radius / pr;
  }
  const grounded = p.pos[1] <= 0 && p.vy <= 0;
  if (pressed("jump") && grounded) p.vy = WORLD.jump_speed;
  if (!grounded || p.vy > 0) {
    p.vy -= WORLD.gravity / TICK_HZ;
    p.pos[1] += p.vy / TICK_HZ;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // 2. pulse: costs light (carried motes), stuns and pushes shades in range
  if (pressed("pulse") && p.carried >= TUNING.pulse_cost && g.steps - g.lastPulseStep >= T(TUNING.pulse_cooldown_s)) {
    p.carried -= TUNING.pulse_cost;
    g.lastPulseStep = g.steps;
    const stunned = [];
    for (const s of g.shades) {
      const d = hdist(s.pos, p.pos);
      if (d > TUNING.pulse_radius) continue;
      const ux = d > 0 ? (s.pos[0] - p.pos[0]) / d : 1;
      const uz = d > 0 ? (s.pos[2] - p.pos[2]) / d : 0;
      s.pos[0] += ux * TUNING.pulse_push_m;
      s.pos[2] += uz * TUNING.pulse_push_m;
      s.state = "stunned";
      s.stun = T(TUNING.pulse_stun_s);
      stunned.push(s.id);
    }
    g.score += stunned.length * TUNING.score.per_stun;
    ev("pulse", { stunned_ids: stunned });
  }

  // 3. interact: deposit carried light into the nearest unlit lantern in range
  if (pressed("interact") && p.carried > 0) {
    let best = null;
    for (const l of g.lanterns) {
      const d = hdist(l.pos, p.pos);
      if (!l.lit && d <= TUNING.interact_radius && (!best || d < best.d)) best = { l, d };
    }
    if (best) {
      const l = best.l;
      const amount = Math.min(p.carried, TUNING.lantern_cost - l.deposited);
      p.carried -= amount;
      l.deposited += amount;
      ev("deposit", { lantern_id: l.id, amount, deposited: l.deposited });
      if (l.deposited >= TUNING.lantern_cost) {
        l.lit = true;
        g.score += TUNING.score.per_lantern;
        ev("lantern_lit", { lantern_id: l.id });
        if (g.lanterns.every((x) => x.lit)) {
          g.score += TUNING.score.per_second_left * Math.floor(Math.max(0, timeLeft(g)));
          g.score += TUNING.score.per_flame_left * p.flames;
          finish(g, "won", "all_lit", events, tick);
          g.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash };
          return events;
        }
      }
    }
  }

  // 4. pick up motes in range (id order) while there is room
  for (const m of [...g.motes]) {
    if (p.carried >= TUNING.carry_capacity) break;
    if (hdist(m.pos, p.pos) <= TUNING.pickup_radius) {
      g.motes.splice(g.motes.indexOf(m), 1);
      p.carried += 1;
      g.score += TUNING.score.per_mote;
      ev("mote_picked", { carried: p.carried });
    }
  }

  // 5. shades: stunned ones wait, the rest chase; none may stand inside a lit lantern's safe radius
  for (const s of g.shades) {
    if (s.state === "stunned") {
      s.stun -= 1;
      if (s.stun <= 0) s.state = "chase";
    } else {
      const d = hdist(s.pos, p.pos);
      const stepLen = Math.min(d, TUNING.shade_speed / TICK_HZ);
      if (d > 0) {
        s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * stepLen;
        s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * stepLen;
      }
    }
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const d = hdist(s.pos, l.pos);
      if (d < TUNING.safe_radius) {
        const ux = d > 0 ? (s.pos[0] - l.pos[0]) / d : 1;
        const uz = d > 0 ? (s.pos[2] - l.pos[2]) / d : 0;
        s.pos[0] = l.pos[0] + ux * TUNING.safe_radius;
        s.pos[2] = l.pos[2] + uz * TUNING.safe_radius;
      }
    }
    const r = Math.hypot(s.pos[0], s.pos[2]);
    if (r > WORLD.island_radius) {
      s.pos[0] *= WORLD.island_radius / r;
      s.pos[2] *= WORLD.island_radius / r;
    }
  }

  // 6. shade contact: lose a flame, drop part of the carried light, short invulnerability
  if (p.invuln > 0) p.invuln -= 1;
  else {
    const hit = g.shades.find((s) => s.state !== "stunned" && hdist(s.pos, p.pos) <= TUNING.shade_hit_radius);
    if (hit) {
      const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
      p.carried -= dropped;
      p.flames = Math.max(0, p.flames - 1);
      p.invuln = T(TUNING.invuln_s);
      ev("player_hit", { by: "shade", flames: p.flames, dropped });
      if (p.flames === 0) {
        finish(g, "lost", "no_flames", events, tick);
        g.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash };
        return events;
      }
    }
  }

  // 7. spawns (only when the scenario keeps random spawning on)
  if (g.randomMotes && g.steps % T(WORLD.mote_respawn_s) === 0 && g.motes.length < WORLD.motes_target) {
    addMote(g, randomPointInRing(g.rng, WORLD.mote_min_r, WORLD.mote_max_r));
  }
  if (g.randomShades && g.steps % T(WORLD.shade_spawn_s) === 0 && g.shades.length < WORLD.shades_max) {
    ev("shade_spawned", { id: addShade(g, shadeSpawnPoint(g)).id });
  }

  // 8. dawn
  if (timeLeft(g) <= 1e-9) finish(g, "lost", "dawn", events, tick);

  g.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash };
  return events;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const vec = (p) => p.map(r3);

export function snapshot(g) {
  return {
    type: "snapshot",
    tick: g.steps,
    sim_tick: g.steps,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    player: { pos: vec(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: vec(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: vec(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: vec(m.pos) })),
  };
}

// ---------- validation of test files (malformed => headless exits with code 2) ----------

export class InputError extends Error {}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const fail = (msg) => { throw new InputError(msg); };

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
    for (const k of ["jump", "interact", "pulse", "dash"]) {
      if (k in f && typeof f[k] !== "boolean") fail(`${where}.${k}: expected a boolean`);
    }
  });
  return doc;
}

export function validateScenario(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) fail("scenario: expected an object");
  const pl = doc.player;
  if (pl !== undefined) {
    if (!pl || typeof pl !== "object") fail("scenario.player: expected an object");
    if ("pos" in pl && !isVec3(pl.pos)) fail("scenario.player.pos: expected [x, y, z]");
    if ("carried" in pl && !(Number.isInteger(pl.carried) && pl.carried >= 0 && pl.carried <= TUNING.carry_capacity)) {
      fail(`scenario.player.carried: expected an integer in [0, ${TUNING.carry_capacity}]`);
    }
    if ("flames" in pl && !(Number.isInteger(pl.flames) && pl.flames >= 1)) fail("scenario.player.flames: expected an integer >= 1");
  }
  for (const k of ["random_motes", "random_shades"]) if (k in doc && typeof doc[k] !== "boolean") fail(`scenario.${k}: expected a boolean`);
  if ("motes" in doc && !(Array.isArray(doc.motes) && doc.motes.every(isVec3))) fail("scenario.motes: expected a list of [x, y, z]");
  if ("shades" in doc) {
    if (!Array.isArray(doc.shades)) fail("scenario.shades: expected a list");
    const ids = new Set();
    doc.shades.forEach((s, i) => {
      if (!s || typeof s !== "object" || !isVec3(s.pos)) fail(`scenario.shades[${i}].pos: expected [x, y, z]`);
      if ("id" in s && (typeof s.id !== "string" || !s.id || ids.has(s.id))) fail(`scenario.shades[${i}].id: expected a unique string`);
      if ("id" in s) ids.add(s.id);
    });
  }
  if ("lanterns" in doc) {
    if (!Array.isArray(doc.lanterns)) fail("scenario.lanterns: expected a list");
    const valid = new Set(defaultLanterns().map((l) => l.id));
    doc.lanterns.forEach((l, i) => {
      if (!l || typeof l !== "object" || !valid.has(l.id)) fail(`scenario.lanterns[${i}].id: expected one of L1..L${TUNING.lantern_count_night1}`);
      if ("pos" in l && !isVec3(l.pos)) fail(`scenario.lanterns[${i}].pos: expected [x, y, z]`);
      if ("lit" in l && typeof l.lit !== "boolean") fail(`scenario.lanterns[${i}].lit: expected a boolean`);
      if ("deposited" in l && !(Number.isInteger(l.deposited) && l.deposited >= 0 && l.deposited <= TUNING.lantern_cost)) {
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
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  return (tick) => {
    while (i < frames.length && frames[i].tick <= tick) {
      const { tick: _t, ...fields } = frames[i++];
      for (const k of Object.keys(cur)) if (k in fields) cur[k] = fields[k];
    }
    return cur;
  };
}
