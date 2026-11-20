# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js view in `web/`) over pure JS game logic (`src/sim.js`) that the headless runner (`src/headless.mjs`) also uses.
Node ≥ 18, no npm dependencies (three.js is vendored in `web/vendor/`). Current scope: Ticket-03 (lantern fuel, drain, dawn win), 3 nights, Test Contract **v1.2**.

## Commands
- `npm test` — unit + one headless scenario per mechanic + contract check. Must be green before you stop (Stop hook enforces it).
- `npm run verify -- phase-N` — tests + every scenario + determinism (nights 1–3) + full-night timing → `docs/proof/phase-N/`.
- `npm start` — game at http://localhost:8000. Console: `__bench(night, frames)` = frame cost at the current size; `__playNight(n)`.
- `node src/headless.mjs --seed 1 --night 2 --ticks 600 --out run.jsonl [--scenario f] [--inputs f]` — Test Contract.

## Rules
- Gameplay rules live only in `src/sim.js`. `web/` reads input, renders state, plays effects; it never changes rules.
- Standard numbers (Ticket-02 part 1) are in `TUNING` (contract keys) and `RULES` (the rest); maps in `MAPS`. Never re-tune them.
- `game.contract.json` tuning == `TUNING` (`tests/contract.test.mjs`). Change both or neither.
- The per-tick order in `step()` is mandated by Ticket-02 ("Thứ tự xử lý"): keep the numbered sections in that order.
- Determinism: no `Math.random`, `Date`, or unordered iteration in `src/`; use the seeded rng.
- Headless field/event/state names are the contract: never rename; add only when a ticket says so.
- Every new mechanic gets a scenario in `tests/scenarios/` (with a `"night"` hint) and an assertion in `tests/headless.test.mjs`.
- When a ticket changes a rule, update the old test and write the reason in `docs/notes/phase-N.md` (never delete silently); list breaking changes in `CHANGELOG.md` and record the design decision in `docs/adr/`.
- Lantern fuel is integer 1/60 units (`l.f`); only `fuelOf()` rounds it for output. Use `hasSafeZone()` / `capacityOf()` / `winNeed()` instead of re-deriving those rules.
- Ambiguity → assumption in the phase notes (`A-xx`), referenced in code comments.
- Evidence comes from `npm run verify`; never edit `docs/proof/` by hand.
