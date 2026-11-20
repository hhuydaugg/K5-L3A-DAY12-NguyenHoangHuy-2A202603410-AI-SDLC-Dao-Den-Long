# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js view in `web/`) over pure JS game logic (`src/sim.js`) that the headless runner (`src/headless.mjs`) also uses.
Node ≥ 18, no npm dependencies (three.js is vendored in `web/vendor/`).

## Commands
- `npm test` — all tests (unit + headless scenarios + contract). Must be green before you stop (Stop hook enforces it).
- `npm run verify -- phase-N` — tests + every scenario + determinism + full-night timing → `docs/proof/phase-N/`.
- `npm start` — game at http://localhost:8000.
- `node src/headless.mjs --seed 1 --night 1 --ticks 600 --out run.jsonl [--scenario f] [--inputs f]` — Test Contract.

## Rules
- Gameplay rules live only in `src/sim.js`. `web/` reads input, renders state, plays effects; it never changes rules.
- Every tuning number is in `TUNING` and in `game.contract.json`; `tests/contract.test.mjs` keeps them equal. Change both or neither.
- Determinism: no `Math.random`, `Date`, or iteration over unordered sets in `src/`; use the seeded rng.
- Headless output fields/event names are the Test Contract: never rename; add only when a ticket says so.
- Every new mechanic gets a scenario in `tests/scenarios/` and an assertion in `tests/headless.test.mjs`.
- Requirements come from the current ticket in `docs/notes/`; quote it, do not invent rules. Ambiguity → write an assumption in the phase notes.
- Evidence comes from `npm run verify`; never edit `docs/proof/` by hand.
