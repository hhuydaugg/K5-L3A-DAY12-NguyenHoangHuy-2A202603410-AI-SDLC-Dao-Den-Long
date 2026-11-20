// Headless scenarios (Test Contract v1.0): format, mechanics through the CLI, determinism, exit codes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TUNING } from "../src/sim.js";

const SC = "tests/scenarios";
const tmp = mkdtempSync(join(tmpdir(), "ddl-"));

function headless(args) {
  const out = join(tmp, `run-${Math.random().toString(36).slice(2)}.jsonl`);
  const r = spawnSync(process.execPath, ["src/headless.mjs", ...args, "--out", out], { encoding: "utf8" });
  const lines = existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  return { code: r.status, stderr: r.stderr, lines, raw: existsSync(out) ? readFileSync(out, "utf8") : "" };
}

function scenario(name, ticks, extra = []) {
  const args = ["--seed", "7", "--night", "1", "--ticks", String(ticks), ...extra];
  if (existsSync(`${SC}/${name}.scenario.json`)) args.push("--scenario", `${SC}/${name}.scenario.json`);
  if (existsSync(`${SC}/${name}.inputs.json`)) args.push("--inputs", `${SC}/${name}.inputs.json`);
  const r = headless(args);
  assert.equal(r.code, 0, r.stderr);
  return { ...r, events: r.lines.filter((l) => l.type === "event"), snaps: r.lines.filter((l) => l.type === "snapshot"), end: r.lines.at(-1) };
}

test("output format: snapshot at tick 0, every N ticks, end line last", () => {
  const r = scenario("default_night", 100, ["--snapshot-every", "25"]);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 25, 50, 75, 100]);
  const s0 = r.snaps[0];
  for (const k of ["type", "tick", "sim_tick", "state", "time_left_s", "score", "player", "lanterns", "shades", "motes_active"]) assert.ok(k in s0, k);
  assert.deepEqual(s0.player, { pos: [0, 0, 0], flames: TUNING.flames, carried: 0 });
  assert.equal(s0.time_left_s, TUNING.night1_duration_s);
  assert.equal(s0.lanterns.length, TUNING.lantern_count_night1);
  assert.equal(r.end.type, "end");
  assert.deepEqual(Object.keys(r.end), ["type", "ticks", "state", "score"]);
  assert.equal(r.end.ticks, 100);
  assert.equal(r.snaps.at(-1).time_left_s, 298.333, "time_left_s = duration - steps/60, 3 decimals");
});

test("determinism: same seed, scenario and inputs give byte-identical output", () => {
  const args = ["--seed", "42", "--night", "1", "--ticks", "6000", "--inputs", `${SC}/default_night.inputs.json`];
  const a = headless(args), b = headless(args);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(a.raw, b.raw);
  assert.notEqual(a.raw, headless(["--seed", "43", ...args.slice(2)]).raw, "a different seed should change the level");
});

test("walk, pick 5 motes, deposit, lantern lit (score 5x10 + 100)", () => {
  const r = scenario("light_one_lantern", 120);
  assert.deepEqual(r.events.filter((e) => e.name === "mote_picked").map((e) => e.data.carried), [1, 2, 3, 4, 5]);
  const dep = r.events.find((e) => e.name === "deposit");
  assert.deepEqual(dep.data, { lantern_id: "L1", amount: 5, deposited: 5 });
  assert.equal(dep.tick, 61, "interact pressed at input tick 60 => event stamped tick 61");
  assert.deepEqual(r.events.find((e) => e.name === "lantern_lit").data, { lantern_id: "L1" });
  assert.equal(r.end.score, 5 * TUNING.score.per_mote + TUNING.score.per_lantern);
  assert.equal(r.end.state, "playing");
});

test("lighting the last lantern wins with time and flame bonus; pre-lit lanterns score nothing", () => {
  const r = scenario("win_all_lit", 600);
  assert.equal(r.snaps[0].score, 0);
  assert.deepEqual(r.events.map((e) => e.name), ["deposit", "lantern_lit", "game_over"]);
  assert.deepEqual(r.events.at(-1).data, { result: "won", reason: "all_lit" });
  assert.equal(r.end.state, "won");
  assert.equal(r.end.ticks, 1, "the run stops when the game ends");
  const s = TUNING.score;
  assert.equal(r.end.score, s.per_lantern + s.per_second_left * Math.floor(300 - 1 / 60) + s.per_flame_left * TUNING.flames);
});

test("shade contact: lose a flame, drop half the light, lose at 0 flames", () => {
  const r = scenario("shade_hit_lose", 600);
  const hit = r.events.find((e) => e.name === "player_hit");
  assert.deepEqual(hit.data, { by: "shade", flames: 0, dropped: 2 });
  assert.deepEqual(r.events.at(-1).data, { result: "lost", reason: "no_flames" });
  assert.equal(r.end.state, "lost");
  // shade starts 2 m away at 3.5 m/s and hits within 1 m: (2-1)/3.5 s = 17.1 ticks => tick 18
  assert.equal(hit.tick, 18);
});

test("pulse costs light, stuns and pushes only shades in range", () => {
  const r = scenario("pulse_stun", 30);
  const pulse = r.events.find((e) => e.name === "pulse");
  assert.equal(pulse.tick, 1);
  assert.deepEqual(pulse.data, { stunned_ids: ["S1"] });
  const s10 = r.snaps.find((s) => s.tick === 10);
  assert.equal(s10.player.carried, 2 - TUNING.pulse_cost);
  assert.deepEqual(s10.shades.find((s) => s.id === "S1"), { id: "S1", pos: [3 + TUNING.pulse_push_m, 1, 0], state: "stunned" });
  assert.equal(s10.shades.find((s) => s.id === "S2").state, "chase");
  assert.equal(r.end.score, TUNING.score.per_stun);
});

test("dawn: running out of time loses", () => {
  const r = scenario("dawn", 600);
  assert.equal(r.end.ticks, 60);
  assert.deepEqual(r.events.at(-1), { type: "event", tick: 60, name: "game_over", data: { result: "lost", reason: "dawn" } });
});

test("shades never enter the safe radius of a lit lantern", () => {
  const r = scenario("safe_radius", 1200);
  assert.equal(r.events.length, 0, "no hit while standing at a lit lantern");
  for (const s of r.snaps) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x, z) >= TUNING.safe_radius - 1e-3, `tick ${s.tick}: shade at ${x},${z}`);
  }
});

test("camera yaw rotates movement: yaw 90 + forward = +X at player_speed", () => {
  const r = scenario("camera_yaw_move", 60);
  assert.deepEqual(r.snaps.at(-1).player.pos, [TUNING.player_speed, 0, 0]);
});

test("malformed files and arguments exit with code 2", () => {
  const base = ["--seed", "1", "--night", "1", "--ticks", "10"];
  for (const f of ["bad_ticks.inputs.json", "bad_move.inputs.json", "not_json.inputs.json"]) {
    const r = headless([...base, "--inputs", `${SC}/${f}`]);
    assert.equal(r.code, 2, f);
    assert.match(r.stderr, /headless:/);
  }
  assert.equal(headless([...base, "--scenario", `${SC}/bad_lantern.scenario.json`]).code, 2);
  assert.equal(headless(["--seed", "1", "--night", "1"]).code, 2, "missing --ticks");
  assert.equal(headless([...base.slice(0, 2), "--night", "2", "--ticks", "10"]).code, 2, "night 2 does not exist");
});
