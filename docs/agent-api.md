# `window.game`: driving the running page

Wait for `game.ready` (or `game.error`). Open with `?paused` for deterministic work: nothing moves or draws until you ask,
and every method below renders one frame when it finishes. Without `?paused`, the real-time loop also runs.

## Move the game
| Call | Does | Returns |
|---|---|---|
| `advance(seconds, keys?)` | simulate with keys held: `"w,space"` or `{w: true}`. Key roles: `w a s d space shift e` | snapshot |
| `tap("e")` | press and release one key | snapshot |
| `walkTo(x, z, limit?)` | autopilot on foot, world coordinates, real keys | snapshot |
| `flyTo(x, z, y, limit?)` | autopilot in the air, real keys | snapshot |
| `teleport(islandId, x?, z?)` | put the character on an island, local offset (on foot only) | snapshot |
| `scenario(name)` then `scenarioNext()` | run a scenario to its next photo stop; `null` at the end. Page must be on the scenario's level | `{shot}` or `null` |
| `pause(on)` | stop or resume the real-time loop | bool |

## Look at it
| Call | Does |
|---|---|
| `view(name)`, `views()` | named camera from the level's `views` |
| `cam(pos, target)` / `cam()` | fix the camera at `[x,y,z]` / give it back to the game |
| `map(on?)` | open or close the map screen; returns whether it is open. `mapViews()` gives the projections |
| `fx({ao, hud, debug, mistTop, mistBottom, fogNear, fogFar})` | rendering toggles. `debug` shows colliders (red), walkable edge (yellow), board range (cyan) |
| `render()` | redraw now |
| `screenOf(x, y, z)` | world to screen pixels, or `null` if behind the camera |

## Read it
| Call | Returns |
|---|---|
| `snapshot()` | `{t, mode, island, player, ship: {id, pos, speed, landed}, prompt, cam}`: small, for assertions |
| `stats()` | snapshot + `drawCalls`, `triangles`, `level`, counts |
| `state` | the whole game state (live object) |
| `events` | log of `{t, type, ...}`: `boarded`, `took_off`, `landed`, `jumped_out`, `arrived`, `autoland`, `autoland_cancelled`, `cant_land`, `jumped` |
| `LEVELS`, `SCENARIOS` | names available |
| `raw`, `rig`, `scene`, `camera` | escape hatches: the game object, camera rig, three.js scene and camera |

## Without a browser
Everything in `src/game/` runs in Bun directly:
```js
import { createGame } from "./src/game/game.js";
import { LEVELS } from "./src/levels/index.js";
const g = createGame(LEVELS.hop);
g.advance(1, { w: true, camYaw: 0 });
console.log(g.state.player, g.events);
```
