#!/usr/bin/env node
// Benchmark (Ticket-04 part 1): opens the real game in a 1280x720 Chrome/Edge window with vsync off, runs the standard
// bench scene (web/main.js ?bench=1), and writes bench.json.
//   node tools/bench.mjs --seed 42 --duration 30 --out bench.json [--browser <path to chrome/edge/chromium>]
// The browser is found in the usual install places, or set BENCH_BROWSER / --browser. A fresh profile is used and deleted.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { cpus, platform, release, totalmem, type } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBody, startServer } from "../web/serve.mjs";
import { findBrowser } from "./browser.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const seed = Number(args.seed ?? 42), duration = Number(args.duration ?? 30), out = args.out;
if (!Number.isInteger(seed) || !(duration > 0) || !out) {
  console.error("usage: node tools/bench.mjs --seed 42 --duration 30 --out bench.json [--browser path]");
  process.exit(2);
}

const browser = findBrowser(args.browser);
if (!browser) {
  console.error("bench: no Chrome, Edge or Chromium found. Install one or pass --browser <path> (or BENCH_BROWSER).");
  process.exit(1);
}

let done;
const result = new Promise((ok) => { done = ok; });
const server = await startServer(0, {
  "POST /__bench": async (req, res) => { const body = await readBody(req); res.writeHead(204); res.end(); done(JSON.parse(String(body))); },
});
const port = server.address().port;
const profile = join(ROOT, "dist", `.bench-profile-${process.pid}`); // inside the project, removed afterwards
mkdirSync(profile, { recursive: true });
const url = `http://127.0.0.1:${port}/web/index.html?bench=1&seed=${seed}&duration=${duration}`;
const child = spawn(browser, [
  `--app=${url}`, `--user-data-dir=${profile}`, "--window-size=1280,720", "--window-position=40,40", "--force-device-scale-factor=1",
  "--disable-gpu-vsync", "--disable-frame-rate-limit", // vsync off: frames are not capped to the display refresh
  "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
], { stdio: "ignore" });

const timer = setTimeout(() => { console.error("bench: no result from the browser within the time limit"); finish(1); }, (duration + 90) * 1000);
function finish(code) {
  clearTimeout(timer);
  try { child.kill(); } catch { /* already gone */ }
  if (platform() === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  server.close();
  setTimeout(() => { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); process.exit(code); }, 1500);
}

const r = await result;
const bench = {
  contract_version: "1.3",
  avg_fps: r.avg_fps,
  p1_low_fps: r.p1_low_fps,
  frame_ms_p95: r.frame_ms_p95,
  frames: r.frames,
  load_ms: Math.round(r.first_frame_epoch_ms - performance.timeOrigin), // process start -> first bench frame
  peak_mem_mb: null, // web build: the browser does not expose process RSS to the page (see README "Benchmark")
  vsync_off: true,
  renderer: r.renderer,
  os: `${type()} ${release()} (${platform()}) · ${cpus()[0]?.model.trim()} · ${Math.round(totalmem() / 2 ** 30)} GB RAM`,
  js_heap_peak_mb: r.js_heap_peak_mb, // extra: peak JS heap of the page, the closest number the browser gives
  canvas: r.canvas,
};
writeFileSync(out, JSON.stringify(bench, null, 2) + "\n");
console.log(JSON.stringify(bench));
finish(0);
