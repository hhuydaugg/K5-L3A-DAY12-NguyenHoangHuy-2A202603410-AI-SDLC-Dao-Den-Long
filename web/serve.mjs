#!/usr/bin/env node
// Static server for the browser game (stdlib only). Serves web/ and src/ (the shared game logic).
//   npm start            -> http://localhost:8000   (PORT=xxxx to change)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT || process.argv[2]) || 8000;
const ALLOWED = ["web", "src"].map((d) => join(ROOT, d) + sep);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/") {
    res.writeHead(302, { Location: "/web/index.html" });
    return res.end();
  }
  const file = normalize(join(ROOT, path));
  if (!ALLOWED.some((dir) => file.startsWith(dir))) {   // no path traversal outside web/ and src/
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
}).listen(PORT, () => console.log(`Đảo Đèn Lồng: open http://localhost:${PORT}`));
