#!/usr/bin/env node
// Static server for the browser game (stdlib only). Serves web/ and src/ (the shared game logic), and keeps the
// local leaderboard in a file on disk (Ticket-04 part 3).
//   node web/serve.mjs [port]                          -> http://localhost:8000   (or PORT=xxxx)
//   node web/serve.mjs --export-leaderboard out.json   -> writes {"entries": [...]} and exits
// The leaderboard lives in $DDL_DATA_DIR/leaderboard.json (default: data/ next to web/).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { insert } from "../src/leaderboard.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ALLOWED = ["web", "src"].map((d) => join(ROOT, d) + sep);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const dataDir = () => process.env.DDL_DATA_DIR || join(ROOT, "data");
const boardFile = () => join(dataDir(), "leaderboard.json");

export function readBoard() {
  try {
    return JSON.parse(readFileSync(boardFile(), "utf8")).entries ?? [];
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
function writeBoard(entries) { // write then rename: a crash never leaves half a file
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(boardFile() + ".tmp", JSON.stringify({ entries }, null, 2) + "\n");
  renameSync(boardFile() + ".tmp", boardFile());
}

const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
export const readBody = (req, limit = 1e6) => new Promise((ok, fail) => {
  const parts = [];
  let n = 0;
  req.on("data", (c) => { n += c.length; if (n > limit) req.destroy(); else parts.push(c); });
  req.on("end", () => ok(Buffer.concat(parts)));
  req.on("error", fail);
});

/** Start the server. `routes` adds handlers keyed "METHOD /path" -> (req, res) (tools/bench.mjs receives its result this way). */
export function startServer(port = 8000, routes = {}) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/") {
      res.writeHead(302, { Location: "/web/index.html" });
      return res.end();
    }
    if (path === "/api/leaderboard") {
      if (req.method === "GET") return json(res, 200, { entries: readBoard() });
      if (req.method === "POST") {
        try {
          const entry = JSON.parse(String(await readBody(req)));
          const entries = insert(readBoard(), entry);
          writeBoard(entries);
          return json(res, 200, { entries });
        } catch (e) {
          return json(res, 400, { error: e.message });
        }
      }
    }
    const route = routes[`${req.method} ${path}`];
    if (route) return route(req, res);
    const file = normalize(join(ROOT, path));
    if (!ALLOWED.some((dir) => file.startsWith(dir))) { // no path traversal outside web/ and src/
      res.writeHead(404);
      return res.end("not found");
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const exp = args.indexOf("--export-leaderboard");
  if (exp >= 0) {
    const out = args[exp + 1];
    if (!out) {
      console.error("usage: node web/serve.mjs --export-leaderboard out.json");
      process.exit(2);
    }
    writeFileSync(out, JSON.stringify({ entries: readBoard() }, null, 2) + "\n");
  } else {
    const port = Number(process.env.PORT || args.find((a) => /^\d+$/.test(a))) || 8000;
    startServer(port).then(() => console.log(`Đảo Đèn Lồng: open http://localhost:${port}`));
  }
}
