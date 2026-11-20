---
name: verify-phase
description: Use when a phase or ticket item is done and needs evidence — runs the tests, every headless scenario, the determinism check and the full-night timing, and writes docs/proof/<phase>/.
---

# Verify a phase

1. `npm test` must be green. If red, fix the code (not the test) unless the ticket changed the rule; then update the test and write why in the phase notes.
2. `npm run verify -- phase-N` (N = current phase). It writes `docs/proof/phase-N/README.md` (summary table), `tests.txt` and `scenarios/*.jsonl`.
3. Read `docs/proof/phase-N/README.md`: every scenario row must match what the phase notes promise; determinism lines must say IDENTICAL; full-night timing must stay under the contract limit.
4. For visual requirements, start the game (`npm start`), take a screenshot, save it under `docs/proof/phase-N/` and name what it shows.
5. Update the requirement → evidence table in `docs/notes/phase-N.md`. Mark anything unmet as "chưa đạt" with the reason.
6. Never edit files under `docs/proof/` by hand; re-run the command instead.
