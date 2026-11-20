// Local leaderboard (Ticket-04 part 3), shared by web/serve.mjs (the file on disk) and web/main.js (the screens).
// Pure: no I/O here.

export const MAX_ENTRIES = 10;
// 3-12 characters: letters (Vietnamese with diacritics too), digits, underscore
const NAME = /^[\p{L}\p{M}\p{N}_]{3,12}$/u;

export const validName = (name) => typeof name === "string" && NAME.test(name.normalize("NFC"));

/** ISO 8601 with the local UTC offset, e.g. 2026-11-20T17:05:09+07:00. */
export function isoLocal(d) {
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    + `${off >= 0 ? "+" : "-"}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

/** Throws on a bad entry (the server answers 400 with the message). */
export function checkEntry(e) {
  if (!e || typeof e !== "object") throw new Error("entry: expected an object");
  if (!validName(e.name)) throw new Error("name: 3-12 letters, digits or _");
  if (!Number.isInteger(e.score) || e.score < 0) throw new Error("score: expected an integer >= 0");
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) throw new Error("nights_won: expected 0-3");
  if (typeof e.achieved_at !== "string" || Number.isNaN(Date.parse(e.achieved_at)) || !/(Z|[+-]\d\d:\d\d)$/.test(e.achieved_at)) {
    throw new Error("achieved_at: expected ISO 8601 with a time zone");
  }
  if (!Number.isInteger(e.seed)) throw new Error("seed: expected an integer");
  return { name: e.name.normalize("NFC"), score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed };
}

/** Score descending; equal scores => whoever got there first stays above. Keeps the top 10. */
export function insert(entries, entry) {
  const t = (x) => Date.parse(x.achieved_at);
  return [...entries, checkEntry(entry)]
    .map((x, i) => [x, i])
    .sort(([a, i], [b, j]) => b.score - a.score || t(a) - t(b) || i - j)
    .map(([x]) => x)
    .slice(0, MAX_ENTRIES);
}
