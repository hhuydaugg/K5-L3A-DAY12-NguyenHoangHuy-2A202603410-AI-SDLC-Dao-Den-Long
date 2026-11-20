// game.contract.json must declare exactly the numbers the game uses (tests are generated from them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TUNING } from "../src/sim.js";

const contract = JSON.parse(readFileSync("game.contract.json", "utf8"));

test("contract header", () => {
  assert.equal(contract.contract_version, "1.3");
  assert.match(contract.team, /^2A202603410-/);
  for (const k of ["build_cmd", "run_cmd", "headless_cmd", "bench_cmd", "soak_cmd"]) assert.ok(contract[k], k);
});

test("soak_cmd: 3 nights in one process, no crash, memory within 1.2x", () => {
  const out = join(mkdtempSync(join(tmpdir(), "ddl-soak-")), "soak.json");
  const [exe, ...args] = contract.soak_cmd.split(" ");
  const r = spawnSync(exe === "node" ? process.execPath : exe, [...args, "--seed", "7", "--nights", "3", "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(Object.keys(s), ["nights", "crashes", "results", "mem_start_mb", "mem_end_mb", "duration_s"]);
  assert.equal(s.nights, 3);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 3);
  assert.ok(s.results.every((x) => x === "won" || x === "lost"));
  assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} vs ${s.mem_start_mb}`);
});

test("contract tuning equals the game's TUNING", () => {
  assert.deepEqual(contract.tuning, JSON.parse(JSON.stringify(TUNING)));
  assert.equal(contract.tuning.lantern_count_night1, 5);
  assert.equal(contract.tuning.fall_enabled, true);
});
