// Finds an installed Chrome, Edge or Chromium (used by tools/bench.mjs and tools/demo/record.mjs).
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { delimiter, join } from "node:path";

export function findBrowser(explicit) {
  const env = process.env;
  const win = ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"].flatMap((k) => (env[k] ? [
    join(env[k], "Google", "Chrome", "Application", "chrome.exe"), join(env[k], "Microsoft", "Edge", "Application", "msedge.exe"),
    join(env[k], "Chromium", "Application", "chrome.exe")] : []));
  const mac = ["Google Chrome.app/Contents/MacOS/Google Chrome", "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "Chromium.app/Contents/MacOS/Chromium"].map((p) => `/Applications/${p}`);
  const linux = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]
    .flatMap((n) => (env.PATH ?? "").split(delimiter).map((d) => join(d, n)));
  const list = [explicit, env.BENCH_BROWSER, ...(platform() === "win32" ? win : platform() === "darwin" ? mac : linux)];
  return list.find((p) => p && existsSync(p));
}
