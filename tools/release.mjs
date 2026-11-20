#!/usr/bin/env node
// Builds the runnable release archive from the committed tree: dist/dao-den-long-v<version>.zip
// (the game folder: web/ + src/ + tools/ + docs needed to run it; play with `node web/serve.mjs`, Node >= 18, no npm packages).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const name = `dao-den-long-v${version}`;
mkdirSync("dist", { recursive: true });
const files = ["web", "src", "tools", "package.json", "game.contract.json", "README.md", "CHANGELOG.md", "CREDITS.md", "LICENSE"];
const r = spawnSync("git", ["archive", "--format=zip", `--prefix=${name}/`, "-o", `dist/${name}.zip`, "HEAD", ...files], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`dist/${name}.zip (${(statSync(`dist/${name}.zip`).size / 2 ** 20).toFixed(1)} MB) — from commit HEAD; unzip, then: cd ${name} && node web/serve.mjs`);
