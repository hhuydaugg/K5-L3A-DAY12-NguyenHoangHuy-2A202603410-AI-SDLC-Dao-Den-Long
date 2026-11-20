#!/usr/bin/env node
// Headless runner — Test Contract v1.2.
//   node src/headless.mjs --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json]
//                         --ticks <int> --out f.jsonl [--snapshot-every <int>]
// Exit 0 on success, 2 on bad arguments or malformed inputs/scenario, 1 on any other error.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createGame, inputTimeline, InputError, NIGHTS, snapshot, step, validateInputs, validateScenario } from "./sim.js";

const USAGE = "usage: headless --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]";

export function parseArgs(argv) {
  const opts = { snapshotEvery: 10 };
  const intArg = (name, v, min) => {
    if (v === undefined || !/^-?\d+$/.test(v) || Number(v) < min) throw new InputError(`${name}: expected an integer >= ${min}`);
    return Number(v);
  };
  for (let i = 0; i < argv.length; i++) {
    const [k, v] = [argv[i], argv[i + 1]];
    if (!k.startsWith("--")) throw new InputError(`unexpected argument '${k}'`);
    if (v === undefined || v.startsWith("--")) throw new InputError(`${k}: missing value`);
    i++;
    if (k === "--seed") opts.seed = intArg(k, v, -(2 ** 53));
    else if (k === "--night") opts.night = intArg(k, v, 1);
    else if (k === "--ticks") opts.ticks = intArg(k, v, 0);
    else if (k === "--snapshot-every") opts.snapshotEvery = intArg(k, v, 1);
    else if (k === "--scenario") opts.scenario = v;
    else if (k === "--inputs") opts.inputs = v;
    else if (k === "--out") opts.out = v;
    else throw new InputError(`unknown option '${k}'`);
  }
  for (const k of ["seed", "night", "ticks", "out"]) if (opts[k] === undefined) throw new InputError(`--${k} is required`);
  if (!NIGHTS.includes(opts.night)) throw new InputError(`--night ${opts.night}: expected one of ${NIGHTS.join(", ")}`);
  return opts;
}

function readJson(path, what) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new InputError(`${what} file '${path}': ${e.code ?? e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new InputError(`${what} file '${path}': invalid JSON (${e.message})`);
  }
}

/** Run one headless session and return the JSONL lines (also used by the tests). */
export function run(opts) {
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, "scenario"), opts.night) : {};
  const inputs = opts.inputs ? validateInputs(readJson(opts.inputs, "inputs")) : { frames: [] };
  const g = createGame({ seed: opts.seed, night: opts.night, scenario });
  const inputAt = inputTimeline(inputs);
  const lines = [JSON.stringify(snapshot(g)), JSON.stringify({ type: "event", tick: 0, name: "night_start", data: { night: opts.night } })];
  const running = () => g.state === "playing" || g.state === "paused";
  for (let k = 0; k < opts.ticks && running(); k++) {
    for (const e of step(g, inputAt(k))) lines.push(JSON.stringify(e));
    if (g.tick % opts.snapshotEvery === 0) lines.push(JSON.stringify(snapshot(g)));
  }
  // a paused run is still a night in progress for the end line
  lines.push(JSON.stringify({ type: "end", ticks: g.tick, state: g.state === "paused" ? "playing" : g.state, score: g.score }));
  return lines;
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    writeFileSync(opts.out, run(opts).join("\n") + "\n");
  } catch (e) {
    process.stderr.write(`headless: ${e.message}\n${e instanceof InputError ? USAGE + "\n" : ""}`);
    process.exit(e instanceof InputError ? 2 : 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
