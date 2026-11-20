// Ticket-04 part 3: local leaderboard rules, the file on disk and the export command.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insert, isoLocal, validName } from "../src/leaderboard.js";

const e = (name, score, at, nights_won = 1) => ({ name, score, nights_won, achieved_at: at, seed: 7 });

test("names: 3-12 of [A-Za-z0-9_], Vietnamese letters allowed", () => {
  for (const ok of ["Huy", "may_2026", "ABCDEFGHIJKL", "Hoàng_Huy"]) assert.ok(validName(ok), ok);
  for (const bad of ["ab", "ABCDEFGHIJKLM", "a b c", "x-y-z", "", null]) assert.ok(!validName(bad), String(bad));
});

test("top 10 by score, ties keep whoever scored first", () => {
  let list = [];
  for (let i = 0; i < 12; i++) list = insert(list, e(`p${String(i).padStart(2, "0")}`, i * 10, `2026-11-20T10:00:${String(i).padStart(2, "0")}+07:00`));
  assert.equal(list.length, 10);
  assert.deepEqual(list.map((x) => x.score), [110, 100, 90, 80, 70, 60, 50, 40, 30, 20]);
  list = insert(list, e("late", 50, "2026-11-20T11:00:00+07:00"));
  list = insert(list, e("early", 50, "2026-11-20T09:00:00+07:00"));
  assert.deepEqual(list.filter((x) => x.score === 50).map((x) => x.name), ["early", "p05", "late"]);
  assert.throws(() => insert(list, e("ok_name", 5, "yesterday")), /achieved_at/);
});

test("achieved_at is ISO 8601 with the local offset", () => {
  assert.match(isoLocal(new Date(2026, 10, 20, 17, 5, 9)), /^2026-11-20T17:05:09[+-]\d\d:\d\d$/);
});

test("--export-leaderboard writes {entries} in order from the file on disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "ddl-lb-"));
  const entries = [e("Huy", 900, "2026-11-20T10:00:00+07:00", 3), e("Mây", 300, "2026-11-20T11:00:00+07:00")];
  writeFileSync(join(dir, "leaderboard.json"), JSON.stringify({ entries }));
  const out = join(dir, "out.json");
  const r = spawnSync(process.execPath, ["web/serve.mjs", "--export-leaderboard", out], { encoding: "utf8", env: { ...process.env, DDL_DATA_DIR: dir } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), { entries });
  const empty = mkdtempSync(join(tmpdir(), "ddl-lb-"));
  const r2 = spawnSync(process.execPath, ["web/serve.mjs", "--export-leaderboard", join(empty, "o.json")], { encoding: "utf8", env: { ...process.env, DDL_DATA_DIR: empty } });
  assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(empty, "o.json"), "utf8")), { entries: [] });
});
