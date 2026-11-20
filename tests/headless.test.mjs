// Headless scenarios (Test Contract v1.2): format, every Ticket-02/03 mechanic through the CLI, determinism, exit codes.
// Each scenario file carries a "night" hint (ignored by the game) so tests and tools/verify.mjs know which night to run.
// Tests changed by Ticket-03 are listed with the reason in docs/notes/phase-3.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGame, step, TUNING, winNeed } from "../src/sim.js";

const SC = "tests/scenarios";
const tmp = mkdtempSync(join(tmpdir(), "ddl-"));
let runs = 0;

function headless(args) {
  const out = join(tmp, `run-${runs++}.jsonl`);
  const r = spawnSync(process.execPath, ["src/headless.mjs", ...args, "--out", out], { encoding: "utf8" });
  const raw = existsSync(out) ? readFileSync(out, "utf8") : "";
  return { code: r.status, stderr: r.stderr, raw, lines: raw ? raw.trim().split("\n").map((l) => JSON.parse(l)) : [] };
}

function scenario(name, ticks, every = 10) {
  const sc = `${SC}/${name}.scenario.json`, inp = `${SC}/${name}.inputs.json`;
  const night = existsSync(sc) ? JSON.parse(readFileSync(sc, "utf8")).night ?? 1 : 1;
  const args = ["--seed", "7", "--night", String(night), "--ticks", String(ticks), "--snapshot-every", String(every)];
  if (existsSync(sc)) args.push("--scenario", sc);
  if (existsSync(inp)) args.push("--inputs", inp);
  const r = headless(args);
  assert.equal(r.code, 0, r.stderr);
  const snaps = r.lines.filter((l) => l.type === "snapshot");
  return { ...r, events: r.lines.filter((l) => l.type === "event"), snaps, end: r.lines.at(-1),
    at: (tick) => snaps.find((s) => s.tick === tick), named: (n) => r.lines.filter((l) => l.type === "event" && l.name === n) };
}
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} != ${b} ± ${eps}`);
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// ---------------- format and contract ----------------

test("v1.2 snapshot fields, night_start, end line, night lengths 240/270/300 s", () => {
  const r = scenario("default_night", 100, 25);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 25, 50, 75, 100]);
  assert.deepEqual(r.lines[1], { type: "event", tick: 0, name: "night_start", data: { night: 1 } });
  const s0 = r.snaps[0];
  for (const k of ["type", "tick", "sim_tick", "night", "state", "time_left_s", "score", "wind", "player", "lanterns", "shades",
    "motes_active", "motes", "drifters", "charms"]) assert.ok(k in s0, k);
  for (const k of ["pos", "vel", "grounded", "flames", "carried", "invuln", "dash_cd_s", "pulse_cd_s", "charm_s", "capacity"]) assert.ok(k in s0.player, k);
  assert.equal(s0.player.capacity, 10);
  assert.deepEqual(s0.lanterns[0], { id: "L1", pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 });
  assert.deepEqual(s0.wind, { active: false, dir_deg: 0 });
  assert.equal(s0.motes_active, 20);
  assert.ok(s0.motes.every((m) => m.kind === "random" && m.ttl_s === null));
  assert.equal(new Set(s0.motes.map((m) => m.pos.join())).size, 20, "20 motes on 20 different points");
  assert.deepEqual(s0.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.deepEqual(Object.keys(r.end), ["type", "ticks", "state", "score"]);
  assert.equal(r.snaps.at(-1).time_left_s, 238.333);
  for (const [night, s] of [["2", 270], ["3", 300]]) {
    const n = headless(["--seed", "1", "--night", night, "--ticks", "0"]);
    assert.equal(n.lines[0].time_left_s, s, `night ${night}`);
  }
});

test("determinism: same seed/night/inputs => byte-identical output on all three nights", () => {
  for (const night of ["1", "2", "3"]) {
    const args = ["--seed", "42", "--night", night, "--ticks", "4000", "--inputs", `${SC}/default_night.inputs.json`];
    const a = headless(args), b = headless(args);
    assert.equal(a.code, 0, a.stderr);
    assert.equal(a.raw, b.raw, `night ${night}`);
  }
  const base = ["--night", "1", "--ticks", "600"];
  assert.notEqual(headless(["--seed", "1", ...base]).raw, headless(["--seed", "2", ...base]).raw);
});

test("malformed files and arguments exit with code 2", () => {
  const base = ["--seed", "1", "--night", "1", "--ticks", "10"];
  for (const f of ["bad_ticks.inputs.json", "bad_move.inputs.json", "bad_pause.inputs.json", "not_json.inputs.json"]) {
    const r = headless([...base, "--inputs", `${SC}/${f}`]);
    assert.equal(r.code, 2, f);
    assert.match(r.stderr, /headless:/);
  }
  for (const f of ["bad_lantern.scenario.json", "bad_shade_state.scenario.json", "bad_target.scenario.json", "bad_fuel.scenario.json"]) {
    assert.equal(headless([...base, "--scenario", `${SC}/${f}`]).code, 2, f);
  }
  assert.equal(headless(["--seed", "1", "--night", "2", "--ticks", "10", "--scenario", `${SC}/bad_lantern.scenario.json`]).code, 0, "L6 exists on night 2");
  assert.equal(headless(["--seed", "1", "--night", "1"]).code, 2, "missing --ticks");
  assert.equal(headless(["--seed", "1", "--night", "4", "--ticks", "10"]).code, 2, "night 4 does not exist");
});

// ---------------- Phase 1 behaviours with the standard numbers ----------------

test("pick 10 motes, deposit 10 into a lantern, it lights: score counts deposited motes", () => {
  const r = scenario("light_one_lantern", 200);
  assert.deepEqual(r.named("mote_picked").map((e) => e.data.carried), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(r.named("deposit")[0], { type: "event", tick: 131, name: "deposit", data: { lantern_id: "L1", amount: 10, deposited: 10 } });
  assert.deepEqual(r.named("lantern_lit")[0].data, { lantern_id: "L1", relight: false });
  assert.equal(r.end.score, 10 * TUNING.score.per_mote + TUNING.score.per_lantern);
  assert.equal(r.end.score, 150, "Ticket-03: +5 per mote");
});

// Ticket-03 replaced "win when every lantern is lit" (old test: win_all_lit, renamed and inverted)
test("lighting every lantern no longer ends the night; pre-lit lanterns score nothing", () => {
  const r = scenario("all_lit_keeps_playing", 600);
  assert.equal(r.snaps[0].score, 0);
  assert.deepEqual(r.events.slice(1).map((e) => e.name), ["deposit", "lantern_lit"]);
  assert.deepEqual(r.end, { type: "end", ticks: 600, state: "playing", score: 5 + 100 });
});

// Ticket-03 replaced the time bonus with a dawn bonus (old test: win_on_dawn_tick)
test("dawn with >= 3/5 lanterns lit wins: +50 + floor(fuel) per lit lantern, +50 per flame", () => {
  const r = scenario("dawn_win", 10);
  assert.deepEqual(r.named("game_over")[0], { type: "event", tick: 1, name: "game_over", data: { result: "won", reason: "dawn_survived" } });
  // L1-L4 burned one tick (99.98 => 99), L5 was lit this tick (100)
  assert.equal(r.end.score, 5 + 100 + 4 * (50 + 99) + (50 + 100) + 3 * 50);
});

test("dawn with too few lanterns lit loses; 0 flames on the dawn tick loses as no_flames", () => {
  assert.deepEqual(scenario("dawn_lose_two_lit", 10).named("game_over")[0].data, { result: "lost", reason: "dawn" });
  assert.deepEqual(scenario("night2_dawn_needs_four", 10).named("game_over")[0].data, { result: "lost", reason: "dawn" }, "3/6 < 4");
  assert.deepEqual(scenario("dawn_no_flames", 10).named("game_over")[0].data, { result: "lost", reason: "no_flames" });
  assert.deepEqual([5, 6, 7].map(winNeed), [3, 4, 5]);
});

test("shade contact: -1 flame, drops floor(carried/2), lose at 0 flames", () => {
  const r = scenario("shade_hit_lose", 300);
  const hit = r.named("player_hit")[0];
  assert.deepEqual(hit.data, { by: "shade", flames: 0, dropped: 2 });
  assert.ok(hit.tick === 15 || hit.tick === 16, `2 m at 4 m/s to 1 m => tick 15, got ${hit.tick}`);
  assert.deepEqual(r.named("game_over")[0].data, { result: "lost", reason: "no_flames" });
});

test("pulse: 3 motes, stun 120 ticks, 4 m push over 15 ticks, +5 per shade", () => {
  const r = scenario("pulse_stun", 140, 1);
  assert.deepEqual(r.named("pulse")[0], { type: "event", tick: 1, name: "pulse", data: { stunned_ids: ["S1"] } });
  assert.deepEqual(r.at(20).shades[0], { id: "S1", pos: [7, 1, 0], state: "stunned" });
  close(r.at(8).shades[0].pos[0], 3 + (4 * 8) / 15, 1e-3, "push is spread over 15 ticks");
  assert.equal(r.at(20).player.carried, 4 - 3);
  assert.equal(r.at(20).player.pulse_cd_s, 3 - 19 / 60 > 0 ? Math.round((3 - 19 / 60) * 1000) / 1000 : 0);
  assert.equal(r.at(120).shades[0].state, "stunned");
  assert.notEqual(r.at(122).shades[0].state, "stunned");
  assert.equal(r.end.score, 5);
});

test("pulse targets by 3D distance from feet + 0.8 m", () => {
  const r = scenario("pulse_3d_range", 5);
  assert.deepEqual(r.named("pulse")[0].data, { stunned_ids: ["S1"] }, "S2 is 5 m away in XZ but 5.004 m in 3D");
});

test("pulse needs 3 motes", () => {
  assert.equal(scenario("pulse_needs_three", 30).named("pulse").length, 0);
});

test("dawn loses", () => {
  const r = scenario("dawn", 600);
  assert.equal(r.end.ticks, 60);
  assert.deepEqual(r.named("game_over")[0], { type: "event", tick: 60, name: "game_over", data: { result: "lost", reason: "dawn" } });
});

test("shades stop at the 6 m edge of a lit lantern", () => {
  const r = scenario("safe_radius", 900);
  assert.equal(r.named("player_hit").length, 0);
  for (const s of r.snaps) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= 6 - 1e-3, `tick ${s.tick}`);
});

test("a shade inside a lantern that just lit is pushed to the edge within 30 ticks, harmless meanwhile", () => {
  const r = scenario("safe_eject", 400, 1);
  assert.equal(r.named("lantern_lit")[0].tick, 1);
  assert.equal(r.named("player_hit").length, 0);
  close(dxz(r.at(31).shades[0].pos, [0, 0, 1]), 6, 1e-3, "at the edge after 30 ticks");
});

test("interact picks the nearest unlit lantern, tie => lower id", () => {
  assert.equal(scenario("interact_tie", 5).named("deposit")[0].data.lantern_id, "L1");
});

test("camera yaw 90 + forward moves along +X; run speed reached in 0.1 s", () => {
  const r = scenario("camera_yaw_move", 60, 1);
  close(r.at(6).player.vel[0], 6, 1e-9, "6 m/s after 6 ticks");
  close(r.at(60).player.pos[0], 0.35 + 54 * 0.1, 2e-3);
  close(r.at(60).player.pos[2], 0, 1e-9);
});

// ---------------- Ticket-02 part 1: new standard mechanics ----------------

test("dash: 14 m/s for 0.2 s, 1.5 s cooldown from the start, facing direction when standing still", () => {
  const r = scenario("dash_cooldown", 200, 1);
  assert.deepEqual(r.named("dash").map((e) => e.tick), [1, 101]);
  close(r.at(12).player.pos[2], 2.8, 1e-6, "12 ticks x 14/60");
  close(r.at(40).player.pos[2], 2.8 + 0.25, 1e-6, "then stop within 0.1 s from run speed");
  close(r.at(2).player.dash_cd_s, 1.5 - 1 / 60, 1e-3);
});

test("air dash keeps the height", () => {
  const r = scenario("air_dash", 40, 1);
  assert.equal(r.named("dash")[0].tick, 11);
  assert.equal(r.at(22).player.pos[1], r.at(10).player.pos[1]);
  assert.ok(r.at(24).player.pos[1] < r.at(22).player.pos[1]);
});

test("falling off the island: -1 flame, lose all motes once, respawn at start after 60 ticks with invulnerability", () => {
  const r = scenario("fall_respawn", 400, 1);
  const fall = r.named("player_hit");
  assert.equal(fall.length, 1);
  assert.deepEqual(fall[0].data, { by: "fall", flames: 2, dropped: 0, lost: 4 });
  const back = r.at(fall[0].tick + 60);
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.equal(back.player.invuln, true);
  assert.equal(back.player.carried, 0);
});

test("hit drops floor(carried/2) motes on a 1.5-2.5 m ring for 480 ticks; the shade recoils", () => {
  const r = scenario("hit_drop", 700, 1);
  const hit = r.named("player_hit")[0];
  assert.deepEqual(hit.data, { by: "shade", flames: 8, dropped: 3 });
  const s = r.at(hit.tick);
  const dropped = s.motes.filter((m) => m.kind === "dropped");
  assert.equal(dropped.length, 3);
  for (const m of dropped) {
    assert.equal(m.ttl_s, 8);
    const d = dxz(m.pos, s.player.pos);
    assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, `ring distance ${d}`);
  }
  assert.equal(s.shades[0].state, "recoil");
  const ids = dropped.map((m) => m.id);
  assert.equal(r.at(hit.tick + 479).motes.filter((m) => ids.includes(m.id)).length, 3, "alive for 480 ticks");
  assert.equal(r.at(hit.tick + 480).motes.filter((m) => ids.includes(m.id)).length, 0, "then gone");
});

test("shade schedule: 2 at tick 300 (spawning), then 1 every 8 s on night 1", () => {
  const r = scenario("shade_spawn_schedule", 1300);
  assert.deepEqual(r.named("shade_spawned").map((e) => `${e.tick}:${e.data.id}`), ["300:S1", "300:S2", "780:S3", "1260:S4"]);
  assert.deepEqual(r.at(300).shades.map((s) => s.state), ["spawning", "spawning"]);
  for (const s of r.at(300).shades) close(Math.hypot(s.pos[0], s.pos[2]), 37, 1e-3);
  assert.ok(r.at(340).shades.every((s) => ["wander", "chase"].includes(s.state)));
});

test("pause freezes sim_tick and time while tick keeps counting", () => {
  const r = scenario("pause", 120, 10);
  assert.deepEqual(r.named("paused").map((e) => e.tick), [11]);
  assert.deepEqual(r.named("resumed").map((e) => e.tick), [71]);
  assert.equal(r.at(40).state, "paused");
  assert.equal(r.at(40).sim_tick, 10);
  assert.equal(r.at(40).time_left_s, Math.round((240 - 10 / 60) * 1000) / 1000);
  assert.equal(r.at(100).sim_tick, 40);
  assert.equal(r.end.ticks, 120);
});

// ---------------- Ticket-02 parts 2-3: maps and features ----------------

test("night 2 jump pad throws Mây over the sea to the other island", () => {
  const r = scenario("night2_jump_pad", 260, 1);
  assert.ok(Math.max(...r.snaps.map((s) => s.player.pos[1])) > 4, "flies");
  const last = r.snaps.at(-1).player;
  assert.equal(last.grounded, true);
  assert.ok(Math.hypot(last.pos[0] - 70, last.pos[2]) <= 28, `landed on island B: ${last.pos}`);
  assert.equal(r.named("player_hit").length, 0, "no fall");
});

test("night 3: tier walls block, ramps climb, the pad lands on tier 2", () => {
  const wall = scenario("night3_wall", 120).snaps.at(-1).player;
  assert.ok(wall.pos[2] <= -7.9 && wall.pos[2] > -8.6 && wall.pos[1] === 0, `stopped at the tier-2 wall: ${wall.pos}`);
  const up = scenario("night3_ramp", 220).snaps.at(-1).player;
  assert.equal(up.pos[1], 3, `walked up the 30° ramp onto tier 1: ${up.pos}`);
  const pad = scenario("night3_jump_pad", 200).snaps.at(-1).player;
  assert.equal(pad.pos[1], 6, `landed on tier 2: ${pad.pos}`);
  assert.ok(Math.hypot(pad.pos[0], pad.pos[2]) <= 8);
});

test("night 3 wind: a 5 s gust every 30 s pushes Mây at 2 m/s", () => {
  const r = scenario("wind_gust", 2200, 10);
  assert.equal(r.at(1790).wind.active, false);
  const w = r.at(1800).wind;
  assert.equal(w.active, true);
  assert.equal(r.at(2100).wind.active, false);
  const a = r.at(1800).player.pos, b = r.at(1860).player.pos;
  close(dxz(a, b), 2, 2e-3, "60 ticks x 2/60 m (positions rounded to 3 decimals)");
  close(Math.atan2(b[2] - a[2], b[0] - a[0]), Math.atan2(Math.sin((w.dir_deg * Math.PI) / 180), Math.cos((w.dir_deg * Math.PI) / 180)), 1e-3);
});

test("Gió Lạc chases a Mây carrying >= 5, steals 3 once, flees 240 ticks then is removed", () => {
  const r = scenario("drifter_steal", 400, 10);
  const st = r.named("drifter_steal");
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].data, { drifter_id: "D1", amount: 3, carried: 3 });
  assert.equal(r.at(Math.ceil((st[0].tick + 1) / 10) * 10).drifters[0].state, "flee");
  assert.deepEqual(r.at(st[0].tick + 250 - ((st[0].tick + 250) % 10)).drifters[0], { ...r.at(st[0].tick + 250 - ((st[0].tick + 250) % 10)).drifters[0], state: "removed", stolen: 3 });
  assert.equal(r.named("player_hit").length, 0, "Gió Lạc never costs a flame");
});

test("pulse on a chasing Gió Lạc: it flees without stealing", () => {
  const r = scenario("drifter_pulse_chase", 300, 10);
  assert.deepEqual(r.at(10).drifters[0].state, "flee");
  assert.equal(r.at(10).drifters[0].stolen, 0);
  assert.equal(r.at(10).player.carried, 6);
  assert.equal(r.named("drifter_steal").length, 0);
});

test("pulse on a fleeing Gió Lạc with loot: drops it as dropped motes, gone after 120 ticks", () => {
  const r = scenario("drifter_pulse_drop", 200, 1);
  assert.deepEqual(r.named("drifter_drop")[0].data, { drifter_id: "D1", amount: 3 });
  assert.equal(r.at(2).motes.filter((m) => m.kind === "dropped").length, 3);
  assert.equal(r.at(120).drifters[0].state, "flee", "pulse at tick 1: still there 119 ticks later");
  assert.equal(r.at(121).drifters[0].state, "removed", "gone exactly 120 ticks after the pulse");
  assert.equal(r.at(121).drifters[0].stolen, 0);
});

test("Bùa Gió: 600 ticks of 7.2 m/s and dash without cooldown; respawns after 2700 ticks", () => {
  const r = scenario("charm", 100, 1);
  const c = r.named("charm_picked")[0];
  assert.deepEqual(c.data, { charm_id: "C1", charm_ticks: 600 });
  close(r.at(c.tick + 20).player.vel[0], 7.2, 1e-9);
  assert.deepEqual(r.named("dash").map((e) => e.tick), [41, 61], "second dash 20 ticks later: no cooldown");
  assert.equal(r.at(42).player.dash_cd_s, 0, "no cooldown shown while charmed");
  const ch = r.at(c.tick).charms[0];
  assert.equal(ch.available, false);
  close(ch.respawn_s, 45, 1e-3);
});

// ---------------- Ticket-03: lantern fuel, drain, capacity ----------------

test("lit lanterns burn 1 fuel/s and go out at 0: lantern_out, deposited 0, ever_lit stays true", () => {
  const r = scenario("fuel_burn_out", 70, 1);
  assert.equal(r.at(30).lanterns[0].fuel, 0.5);
  assert.equal(r.at(30).lanterns[1].fuel, 99.5, "one decimal");
  assert.deepEqual(r.named("lantern_out").map((e) => [e.tick, e.data]), [[60, { lantern_id: "L1" }]]);
  assert.deepEqual(r.at(60).lanterns[0], { id: "L1", pos: [0, 0, 10], lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
});

test("relighting costs 5 motes, scores 5/mote + 40, counts relit_count and grows capacity by 2", () => {
  const r = scenario("relight", 5, 1);
  assert.deepEqual(r.named("deposit")[0].data, { lantern_id: "L1", amount: 5, deposited: 5 });
  assert.deepEqual(r.named("lantern_lit")[0].data, { lantern_id: "L1", relight: true });
  const s = r.at(1);
  assert.deepEqual([s.lanterns[0].fuel, s.lanterns[0].relit_count, s.player.carried, s.player.capacity, s.score], [100, 1, 1, 12, 65]);
});

test("refuel: used = min(carried, ceil((100 - fuel) / 10)), +10 fuel per mote up to 100, +5 per mote", () => {
  const full = scenario("refuel", 5, 1);
  assert.deepEqual(full.named("refuel")[0].data, { lantern_id: "L1", amount: 5, fuel: 100 }, "55 - 1 tick of burn => 5 motes");
  assert.deepEqual([full.at(1).player.carried, full.end.score], [3, 25]);
  const part = scenario("refuel_partial", 5, 1);
  assert.deepEqual(part.named("refuel")[0].data, { lantern_id: "L1", amount: 3, fuel: 50 });
  assert.equal(part.named("deposit").length, 0);
});

test("capacity = 10 + 2 x successful lights: pickups stop at it", () => {
  const r = scenario("capacity_pickup", 3, 1);
  assert.deepEqual(r.named("mote_picked").map((e) => e.data.carried), [12]);
  assert.equal(r.at(1).player.capacity, 12);
});

test("a wandering shade goes to a lantern under 30 fuel, drains 5/s within 2 m, fuel_drain every 60 ticks", () => {
  const r = scenario("shade_drain", 260, 1);
  assert.equal(r.at(59).shades[0].state, "wander");
  assert.deepEqual(r.at(60).shades[0], { id: "S1", pos: [0, 1, 12], state: "drain" }, "4 m at 4 m/s, stops at 2 m");
  assert.deepEqual(r.at(130).shades[0].pos, [0, 1, 12], "stands still");
  close(r.at(70).lanterns[0].fuel - r.at(130).lanterns[0].fuel, 6, 1e-9, "burn 1/s + drain 5/s");
  assert.deepEqual(r.named("fuel_drain").map((e) => [e.tick, e.data]),
    [[120, { lantern_id: "L1", shade_id: "S1", fuel: 13 }], [180, { lantern_id: "L1", shade_id: "S1", fuel: 7 }], [240, { lantern_id: "L1", shade_id: "S1", fuel: 1 }]]);
  assert.equal(r.named("lantern_out")[0].tick, 250);
  assert.equal(r.at(250).shades[0].state, "wander", "lantern out => back to wander");
});

test("several draining shades add up", () => {
  const r = scenario("shade_drain_two", 61, 1);
  assert.equal(r.at(60).lanterns[0].fuel, 9, "20 - 60 x (1 + 5 + 5) / 60");
  assert.deepEqual(r.named("fuel_drain").map((e) => e.data.shade_id), ["S1", "S2"]);
});

test("a draining shade chases Mây within 6 m", () => {
  const r = scenario("drain_to_chase", 60, 1);
  assert.equal(r.at(32).shades[0].state, "drain");
  assert.equal(r.at(33).shades[0].state, "chase");
  assert.ok(dxz(r.at(33).player.pos, r.at(33).shades[0].pos) <= 6 + 0.07);
});

test("refuel to >= 30 pushes draining shades to the 6 m edge in 30 ticks, harmless, back to wander", () => {
  const r = scenario("refuel_ejects_drain", 60, 1);
  assert.deepEqual(r.named("refuel")[0].data, { lantern_id: "L1", amount: 3, fuel: 49.9 });
  assert.equal(r.at(1).shades[0].state, "wander");
  close(dxz(r.at(31).shades[0].pos, [0, 0, 1.5]), 6, 1e-3);
  assert.equal(r.named("player_hit").length, 0);
});

test("pulse on a draining shade scores 15", () => {
  const r = scenario("pulse_drain_bonus", 3, 1);
  assert.deepEqual(r.named("pulse")[0].data, { stunned_ids: ["S1"] });
  assert.equal(r.end.score, 15);
});

test("a lantern keeps its safe zone at exactly 30 fuel and loses it below", () => {
  const r = scenario("safe_zone_threshold", 40, 1);
  assert.equal(r.at(30).lanterns[0].fuel, 30);
  assert.ok(dxz(r.at(30).shades[0].pos, [0, 0, 10]) >= 6 - 1e-3, "blocked at 30.0");
  assert.ok(dxz(r.at(31).shades[0].pos, [0, 0, 10]) < 6 - 0.05, "enters at 29.98");
});

test("refuelling a lantern already >= 30 does not eject shades pinned on its 6 m edge (review-phase-3 #1)", () => {
  const shades = Array.from({ length: 52 }, (_, i) => ({ pos: [9 * Math.cos((i * 2 * Math.PI) / 52), 0, 1 + 9 * Math.sin((i * 2 * Math.PI) / 52)] }));
  const g = createGame({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1], lit: true, fuel: 50 }], shades } });
  const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  for (let i = 0; i < 60; i++) step(g, idle);
  assert.ok(g.shades.every((s) => s.state === "chase"), "all pinned on the edge, chasing Mây inside the safe zone");
  step(g, { ...idle, interact: true });
  assert.equal(g.shades.filter((s) => s.eject).length, 0);
});

// ---------------- Ticket-04: benchmark scene ----------------

test("bench scene: 200 wandering shades, 100 motes, L1-L3 lit at 100; nothing spawns, burns, hurts or ends", async () => {
  const { createBench } = await import("../src/sim.js");
  const g = createBench(42);
  assert.equal(g.shades.length, 200);
  assert.ok(g.shades.every((s) => s.state === "wander" && Math.hypot(s.pos[0], s.pos[2]) <= 40));
  assert.equal(g.motes.length, 100);
  assert.deepEqual(g.lanterns.map((l) => [l.lit, l.f]), [[true, 6000], [true, 6000], [true, 6000], [false, 0], [false, 0]]);
  const before = g.shades.map((s) => s.pos.join());
  const idle = { move: [0, 0], cam_yaw_deg: 0 };
  for (let i = 0; i < 60 * 300; i++) step(g, idle); // a whole night and more
  assert.equal(g.state, "playing");
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
  assert.equal(g.player.flames, 3);
  assert.ok(g.lanterns.slice(0, 3).every((l) => l.f === 6000));
  assert.ok(g.shades.every((s) => s.state === "wander"), "no chase, no drain");
  assert.ok(g.shades.some((s, i) => s.pos.join() !== before[i]), "shades still move");
  assert.equal(JSON.stringify(createBench(42).shades.map((s) => s.pos)), JSON.stringify(createBench(42).shades.map((s) => s.pos)), "same seed, same scene");
});
