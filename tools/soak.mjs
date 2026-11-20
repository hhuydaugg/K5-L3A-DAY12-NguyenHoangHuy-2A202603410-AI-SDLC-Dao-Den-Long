#!/usr/bin/env node
// Soak test (Ticket-04 part 2): many headless nights in ONE process with seeded random input, to catch crashes and leaks.
// Run with --jitless: on Linux the JIT compiler's own native memory alone grows RSS by 30-80% (docs/notes/phase-4.md A-26).
//   node --expose-gc --jitless tools/soak.mjs --seed 7 --nights 10 --out soak.json
// Night k (k = 0..n-1) is night 1, 2, 3, 1, ... with seed + k (A-25). Each night runs until it ends (dawn or no flames).
// Input: every 30 ticks a new move direction; each tick 5% jump, 3% dash, 2% pulse, 10% interact.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createGame, mulberry32, nightDuration, NIGHTS, step, TICK_HZ } from "../src/sim.js";

const mb = () => {
  globalThis.gc?.(); // with --expose-gc the numbers are live memory, not garbage that has not been collected yet
  return Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10;
};

export function playNight(g, seed) {
  const night = g.night;
  const rnd = mulberry32(seed ^ 0x5bd1e995); // input stream separate from the game's own rng
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const limit = nightDuration(night) * TICK_HZ + 1;
  for (let t = 0; t < limit && g.state === "playing"; t++) {
    if (t % 30 === 0) {
      const a = rnd() * 2 * Math.PI;
      input.move = [Math.cos(a), Math.sin(a)];
    }
    input.jump = rnd() < 0.05;
    input.dash = rnd() < 0.03;
    input.pulse = rnd() < 0.02;
    input.interact = rnd() < 0.1;
    step(g, input);
  }
  return g;
}

export function soak({ seed, nights }) {
  const t0 = process.hrtime.bigint();
  const results = [];
  let crashes = 0, memStart = null, g = null;
  for (let k = 0; k < nights; k++) {
    try {
      g = createGame({ seed: seed + k, night: NIGHTS[k % NIGHTS.length] });
      if (k === 0) memStart = mb(); // right after the first night is loaded
      playNight(g, seed + k);
      results.push(g.state === "won" ? "won" : g.state === "lost" ? "lost" : "unfinished");
    } catch (e) {
      crashes += 1;
      results.push("crash");
      process.stderr.write(`soak: night ${k + 1} crashed: ${e.stack}\n`);
    }
    g = null; // reset: nothing from this night may survive into the next
  }
  return { nights, crashes, results, mem_start_mb: memStart ?? mb(), mem_end_mb: mb(),
    duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e7) / 100 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
  const seed = Number(args.seed ?? 7), nights = Number(args.nights ?? 10);
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1 || !args.out) {
    process.stderr.write("usage: node --expose-gc tools/soak.mjs --seed 7 --nights 10 --out soak.json\n");
    process.exit(2);
  }
  const r = soak({ seed, nights });
  writeFileSync(args.out, JSON.stringify(r) + "\n");
  console.log(JSON.stringify(r));
  process.exit(r.crashes === 0 && r.mem_end_mb <= 1.2 * r.mem_start_mb ? 0 : 1);
}
