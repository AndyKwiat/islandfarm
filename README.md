# Mist Isles

A cozy prototype: cliff-top islands above a white mist, ancient-China-ish with gondolas and steampunk airships. You have a
hut and a small farm. Run around, climb aboard your airship, fly to another island, land, jump out, wander. No game yet:
this exists to find out how walking and flying feel.

Plain ES modules + three.js, no build step. Engine, models and art style come from the Jade River City tech demo.

```sh
bun install
bun run dev          # http://localhost:3012
```

| | On foot | In the airship |
|---|---|---|
| **W / S** (or arrows) | run forward / back | throttle / brake and reverse |
| **A / D** | run left / right | turn |
| **Space** | jump | climb |
| **Shift** | sprint | descend (hold over ground to land) |
| **E** (or Enter) | board a nearby ship | land by itself and jump out / jump out |
| **Mouse** | click to capture, or drag: look · scroll: zoom | look around, recentres by itself |
| **M** | map screen (Esc closes it too) | same; the world keeps running, so you can steer by it |

## The world
Twenty islands (`src/levels/main.js`), far enough apart that a hop takes several seconds at full speed. Hearth Isle (home: your
hut, farm, airship *Sparrow*) and Lantern Market (a second ship, *Red Kite*) are joined by Pagoda Spire, Lone Pine, Manor
Terrace, Bamboo Shelf, Orchard Rise, Hall of Clouds, Tea Terraces, Cloud Shrine, Watch Rock, Goat Crag, Wheat Steppe, Blossom
Hollow, Scholars' Rest and Stone Sage. Two gondola lines: Lower Station ↔ Upper Station, Quarry Landing ↔ Summit Gate. The
two islands of a gondola pair stay close together: everything else is spread out, and a test holds both of those true.
Test levels (`?level=…`): `flat` (walking and collision), `hop` (two islands: take-off and landing),
`mist` (islands at every height: tuning the fade), `gallery` (every prop on one island).

## Layout

| Path | What |
|---|---|
| `src/game/config.js` | **every tuning number**: speeds, handling, cameras, the mist band |
| `src/game/game.js` | the simulation: walking, the ship, the mode machine (walk → boarding → fly → exiting), events |
| `src/game/world.js` | turns a level into islands; all spatial queries (`groundAt`, `islandAt`, collisions, landing spots) |
| `src/game/props.js` | each prop's collision shape and how far the ground is levelled around it |
| `src/game/cameraRig.js` | both cameras, as plain math: third-person on foot, chase in the air, blended on a mode change |
| `src/game/critters.js` | animals and villagers pottering about |
| `src/game/mapView.js` | map projection (world to pixels, fits the whole level), used by `src/map.js` |
| `src/game/pilot.js`, `scenarios.js` | autopilots that press real keys; scripted playthroughs |
| `src/levels/` | level data, plain objects, plus the registry `index.js` |
| `src/render/` | `renderer.js` (pipeline, lights) · `materials.js` (slots, walk shader, rock, **mist**) · `islandMesh.js` (top, cliff, ground paint, cover) · `worldScene.js` (props, sky, clouds, wisps, gondola, balloons) · `actors.js` (character, ships, critters, landing ring, wind) · `customModels.js` (skiff, fence, scarecrow, pad) · `debug.js` |
| `src/engine/` | copied from the tech demo (`~/waldo/polygon`, commit `fa24512`): `geo.js` (low-poly Builder), `models.js`, `figures.js`, `people.js`, `sky.js`. Changes: `railing`, `crate`, `spindle` are exported, and `spindle` winds its faces outward (the demo's were inside out) |
| `src/main.js`, `input.js`, `hud.js`, `map.js` | browser wiring; `window.game`; keyboard and mouse; on-screen text; minimap and map screen |
| `tests/` | `bun test`: world, walking, ship, camera, and every scenario |
| `scripts/` | `serve`, `shot` (screenshots), `sim` (headless), `e2e` (real input), `browser` (shared Chrome harness) |

**Two rules hold it together:** `src/game/` and `src/levels/` have no three.js and no DOM, so all game logic runs in tests
and headless at thousands of times real time. And `src/render/` only reads the state: drawing can never change the game.

## How the main things work
- **Islands** are a polar outline `r(θ)` from seeded sine harmonics. The top is rings of facets whose heights come straight
  from `surfaceHeight`, so the mesh matches physics. The cliff is jittered rings that flare outward going down.
- **The mist** (`addMist` in `materials.js`) is injected into every material: below `MIST.top` surfaces fade toward the mist
  colour, gone by `MIST.bottom`, mixed in log space together with distance fog. The sky dome's horizon and everything below
  it is that same colour, so no horizon line exists. It is HDR because ACES tone mapping would turn plain white grey.
- **On foot** you can't fall: an invisible wall sits just inside the rim (`WALK.edgeMargin`), boulders hint at it.
- **The ship can't get into trouble:** cliffs and buildings slide it aside; the mist, the ceiling and the world edge ease it
  back. Nothing crashes. Ground under it gets a landing ring: green means E will work, orange means a prop is in the way.
- **E in the air** picks a clear spot (`findLandingSpot`), drifts there, descends and jumps out. Any steering key cancels.
- **Models** come from the demo's `Builder`: flat-shaded, vertex-coloured triangles, with per-instance colour slots
  (`colors: { roof, wall, pillar, cloth }` in level data). Yaw: heading = (sin yaw, cos yaw); people face +z, ships +x.

## Recipes
- **Change how it feels:** `src/game/config.js`, then `bun test`. The tests in `tests/ship.test.js` pin "fast" and "nimble" as numbers.
- **Add an island or props:** edit `src/levels/main.js`, with coordinates local to the island. `bun test` reports what fell off, with the rim radius there. The maps pick it up by themselves.
- **Add a gondola line:** two islands directly north and south of each other, a `gondola_station_low` on the southern one and a `gondola_station_high` on the northern one (both `rot: 1`), and an entry in `gondolas`.
- **Add a test level:** add it to `src/levels/test.js` and `index.js`; open `?level=<id>`.
- **Add a model:** paint it in `src/render/customModels.js`, give it an entry in `src/game/props.js`. It shows up in `?level=gallery`.
- **Add a scripted flow:** a key in `SCENARIOS` (`src/game/scenarios.js`). It becomes a test, a `sim` run and a screenshot series.

## Agent tooling
```sh
bun test                                       # logic: under a second
bun run sim                                    # list scenarios
bun run sim -- fly_to_market --every 2         # play one with no browser: position trace and events (--json for machines)
bun run shot -- --views home,farm,cliff --sheet         # PNGs in shots/, prints errors and stats
bun run shot -- --scenario fly_to_market --out shots/f  # a PNG at each `shot` step of a scenario
bun run shot -- --level gallery --views top --eval "game.fx({debug:true})"   # with collider overlay
bun run shot -- --cam 0,500,400:0,330,0 --name mine     # any camera
bun run e2e                                    # real key and mouse events through the real-time loop
```
`window.game` drives the live page (`docs/agent-api.md`): `advance(secs, "w,space")`, `tap("e")`, `walkTo`, `flyTo`,
`teleport`, `view`, `cam`, `scenario`, `map`, `snapshot`, `stats`, `fx`, `screenOf`, `pause`. URL flags: `?level= &view= &low &noao
&noshadow &paused &debug`.
