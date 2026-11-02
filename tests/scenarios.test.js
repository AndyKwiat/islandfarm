// Every scripted playthrough in src/game/scenarios.js must run to the end.
import { test } from "bun:test";
import { createGame } from "../src/game/game.js";
import { SCENARIOS, runScenario } from "../src/game/scenarios.js";
import { LEVELS } from "../src/levels/index.js";

for (const [name, sc] of Object.entries(SCENARIOS)) {
  test(`scenario ${name}`, () => { const g = createGame(LEVELS[sc.level]); for (const _ of runScenario(g, sc)) void _; }, 60000);
}
