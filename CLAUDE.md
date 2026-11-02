Read `README.md` (≈3 min): layout, the rules of the codebase, and every tool you have.

Working loop for any change:
1. Game rules or feel → edit `src/game/` (numbers live in `src/game/config.js`) → `bun test` → `bun run sim -- <scenario>`.
2. World → edit `src/levels/` (plain data) → `bun test` (catches props off islands, overlaps, unknown models).
3. Anything visible → `bun run shot -- --views <names> --sheet` or `--scenario <name>` → **Read the PNGs** in `shots/` and the printed errors → iterate.
4. Input, HUD or main loop → `bun run e2e` (real key events in headless Chrome, about a minute).

Rules:
- `src/game/` and `src/levels/` never import three.js or touch the DOM: that is what keeps tests and headless simulation possible.
- `src/render/` reads game state and never changes it.
- New behaviour gets a unit test; new player-facing flows get a scenario in `src/game/scenarios.js` (the test suite runs them all).
- `src/engine/` is the tech demo's code; prefer adding models in `src/render/customModels.js` over editing it.
- Screenshots use software GL, so frame rates in them mean nothing. Feel can only be checked by a person: say so instead of claiming it.
