// game.contract.json must declare exactly the numbers the game uses (tests are generated from them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TUNING } from "../src/sim.js";

const contract = JSON.parse(readFileSync("game.contract.json", "utf8"));

test("contract header", () => {
  assert.equal(contract.contract_version, "1.1");
  assert.match(contract.team, /^2A202603410-/);
  for (const k of ["build_cmd", "run_cmd", "headless_cmd"]) assert.ok(contract[k], k);
});

test("contract tuning equals the game's TUNING", () => {
  assert.deepEqual(contract.tuning, JSON.parse(JSON.stringify(TUNING)));
  assert.equal(contract.tuning.lantern_count_night1, 5);
  assert.equal(contract.tuning.fall_enabled, true);
});
