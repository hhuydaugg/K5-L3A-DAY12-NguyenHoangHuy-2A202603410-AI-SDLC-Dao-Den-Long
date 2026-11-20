#!/usr/bin/env node
// Headless runner — Test Contract v1.0.
//   node src/headless.mjs --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                         --ticks <int> --out f.jsonl [--snapshot-every <int>]
// Exit 0 on success, 2 on bad arguments or malformed inputs/scenario, 1 on any other error.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createGame, inputTimeline, InputError, snapshot, step, validateInputs, validateScenario } from "./sim.js";

const USAGE = "usage: headless --seed <int> --night 1 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]";

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
  if (opts.night !== 1) throw new InputError(`--night ${opts.night}: only night 1 exists`);
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
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, "scenario")) : {};
  const inputs = opts.inputs ? validateInputs(readJson(opts.inputs, "inputs")) : { frames: [] };
  const g = createGame({ seed: opts.seed, scenario });
  const inputAt = inputTimeline(inputs);
  const lines = [JSON.stringify(snapshot(g))];
  for (let k = 0; k < opts.ticks && g.state === "playing"; k++) {
    for (const e of step(g, inputAt(k))) lines.push(JSON.stringify(e));
    if (g.steps % opts.snapshotEvery === 0) lines.push(JSON.stringify(snapshot(g)));
  }
  lines.push(JSON.stringify({ type: "end", ticks: g.steps, state: g.state, score: g.score }));
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
