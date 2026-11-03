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
| **W / S** (or arrows) | run forward / back | throttle / brake and reverse (she coasts: plan ahead) |
| **A / D** | run left / right | turn (wide at speed: slow down for tight turns) |
| **Space** | jump | climb |
| **Shift** | sprint | descend (hold over ground to land) |
| **E** (or Enter) | board a nearby ship | land by itself and jump out / jump out |
| **Mouse** | click to capture, or drag: look · scroll: zoom | look around, recentres by itself |
| **M** | map screen (Esc closes it too) | same; the world keeps running, so you can steer by it |

## The world
Thirty islands (`src/levels/main.js`), close enough that the next one is always in view. Ten are big towns with several
districts each (`BIG TOWNS` at the bottom of that file): Lantern Market, Manor Terrace, Orchard Rise, Hall of Clouds, Tea
Terraces, Wheat Steppe, Scholars' Rest, Silk Quarter, Temple Hill and Kite Harbor. The rest run from your home, Hearth Isle
(hut, farm, airship *Sparrow*), down to rocks with one tree on. Parked ships wait at Lantern Market (*Red Kite*) and Kite Harbor
(*Swift*). Two gondola lines: Lower Station ↔ Upper Station, Quarry Landing ↔ Summit Gate. 
The sky is busy (`sky` in `main.js`): skiffs, balloons, cargo ships, flying junks, festival dragons, paddle steamers, twin-envelope
liners, ornithopters and crate barges on their rounds; swallows, finches and pigeons round the islands; geese and cranes in Vs;
eagles soaring over the rocks; three giant rocs high up; drifting sky lanterns. Scenery only: it never touches you.

Test levels (`?level=…`): `flat` (walking and collision), `hop` (two islands: take-off and landing), `flight` (an updraft and a downdraft in plain view),
`mist` (islands at every height: tuning the fade), `gallery` (every prop on one island).

## Layout

| Path | What |
|---|---|
| `src/game/config.js` | **every tuning number**: speeds, handling, cameras, the mist band |
| `src/game/game.js` | the simulation: walking, the ship, the mode machine (walk → boarding → fly → exiting), events |
| `src/game/world.js` | turns a level into islands; all spatial queries (`groundAt`, `islandAt`, collisions, landing spots) |
| `src/game/props.js` | each prop's collision shape and how far the ground is levelled around it |
| `src/game/cameraRig.js` | both cameras, as plain math: third-person on foot, chase in the air, blended on a mode change |
| `src/game/lod.js` | detail level by distance, adaptive quality: decisions only, numbers in `LOD` and `QUALITY` in config.js |
| `src/game/drafts.js` | updrafts and downdrafts: placing them, and the air at any point |
| `src/game/skyTraffic.js` | airships and birds: types, generated routes, positions as a pure function of time |
| `src/game/critters.js` | animals and villagers pottering about |
| `src/game/mapView.js` | map projection (world to pixels, fits the whole level), used by `src/map.js` |
| `src/game/pilot.js`, `scenarios.js` | autopilots that press real keys; scripted playthroughs |
| `src/levels/` | level data, plain objects: `main.js`, test levels, the registry `index.js`, and `districts.js`: town pieces (street, hamlet, temple, farm, garden, estate, fort, dock, monument, grove) |
| `src/render/` | `renderer.js` (pipeline, lights) · `materials.js` (slots, walk shader, rock, **mist**) · `islandMesh.js` (top, cliff, ground paint, cover, crops, an island's detail levels) · `bake.js` (props merged per island, automatic far proxies) · `worldScene.js` (sky, clouds, wisps, gondola) · `skyLife.js` (instanced airships and birds) · `draftColumns.js` (drafts, one animated Points draw) · `actors.js` (character, ships, critters, landing ring, wind) · `customModels.js` (skiff, fence, scarecrow, pad) · `debug.js` |
| `src/engine/` | copied from the tech demo (`~/waldo/polygon`, commit `fa24512`): `geo.js` (low-poly Builder), `models.js`, `figures.js`, `people.js`, `sky.js`. Changes: `railing`, `crate`, `spindle` are exported, `spindle` winds its faces outward (the demo's were inside out), and `box({ top: false })` skips the top face (it used to paint it magenta) |
| `src/main.js`, `input.js`, `hud.js`, `map.js` | browser wiring; `window.game`; keyboard and mouse; on-screen text; minimap and map screen |
| `tests/` | `bun test`: world, walking, ship, camera, and every scenario |
| `scripts/` | `serve`, `shot` (screenshots), `sim` (headless), `e2e` (real input), `perf` (benchmark), `browser` (shared Chrome harness) |

**Two rules hold it together:** `src/game/` and `src/levels/` have no three.js and no DOM, so all game logic runs in tests
and headless at thousands of times real time. And `src/render/` only reads the state: drawing can never change the game.

## How the main things work
- **Islands** are a polar outline `r(θ)` from seeded sine harmonics. The top is rings of facets whose heights come straight
  from `surfaceHeight`, so the mesh matches physics. The cliff is jittered rings that flare outward going down.
- **The mist** (`addMist` in `materials.js`) is injected into every material: below `MIST.top` surfaces fade toward the mist
  colour, gone by `MIST.bottom`, mixed in log space together with distance fog. The sky dome's horizon and everything below
  it is that same colour, so no horizon line exists. It is HDR because ACES tone mapping would turn plain white grey.
- **On foot** you can't fall: an invisible wall sits just inside the rim (`WALK.edgeMargin`), boulders hint at it.
- **The ship is rickety, not hard.** She is slow to start and stop turning, slides through corners, coasts a long way and turns tighter when you slow down. The engine coughs, wind nudges her along, and the hull swings on its ropes (a spring pendulum in `game.js`; the hull and envelope are separate meshes). All of it fades close to the ground, so landing stays easy; `RICKETY` in config.js is the dial, and setting its amounts to 0 gives a steady ship.
- **Drafts** (`drafts.js`) are columns of moving air in the gaps between islands, visible as haze with petals rising or grey streaks falling, and marked on both maps. An updraft climbs about twice as fast as the engine; passing through gives a kick, and staying in one (hold position, it spins you gently) is the quick way up. Downdrafts push harder than you can climb. Auto-land ignores them.
- **The ship can't get into trouble:** cliffs and buildings slide it aside; the mist, the ceiling and the world edge ease it
  back. Nothing crashes. Ground under it gets a landing ring: green means E will work, orange means a prop is in the way.
- **E in the air** picks a clear spot (`findLandingSpot`), drifts there, descends and jumps out. Any steering key cancels.
- **Models** come from the demo's `Builder`: flat-shaded, vertex-coloured triangles, with per-instance colour slots
  (`colors: { roof, wall, pillar, cloth }` in level data). Yaw: heading = (sin yaw, cos yaw); people face +z, ships +x.

## Performance
`bun run perf` prints draw calls and triangles from fixed cameras and fails above its budget. Before the performance pass, and
now (the "now" includes the 64 airships and 645 birds and lanterns in the sky):

| View | Draw calls | Triangles |
|---|---|---|
| On foot at home | 707 → 111 | 1.68M → 313K |
| On foot in a town | 563 → 88 | 1.07M → 448K |
| Across the isles | 713 → 114 | 1.62M → 312K |
| High over the centre | 787 → 120 | 1.90M → 235K |
| Whole world | 953 → 134 | 2.78M → 141K |

What does it, biggest first:
- **Props are baked per island** (`bake.js`): one merged mesh, one draw, culled as a whole. Before, each model was one instanced draw spanning the world, so nothing could be culled.
- **Island detail levels** (`buildIsland`, `lod.js`): near has everything; middle has simplified terrain; far replaces each building with about 30 triangles of boxes generated from the model itself. Grass, crops, critters and propellers drop out by distance.
- **Only near islands pay for extra passes:** ambient occlusion re-renders the scene and shadows do too, so everything but level 0 skips both. A far island costs one pass, not three. Cliffs never cast shadows.
- **Critters share meshes by look;** clouds are one mesh; balloons are instanced.
- **GPU settings:** resolution capped at 1.5× (was 2×), 2× MSAA (was 4×), a 2048 shadow map (was 4096), 8 AO samples (was 16). `?hq` restores them. Adaptive quality steps resolution and then AO down if frames stay under about 38 fps; it never steps back up.
- **Simulation:** colliders are found through a grid, critters step at a quarter rate. 60 s of game went from 2,495 ms to 77 ms of CPU.

The on-screen readout under the title shows fps, draw calls and triangles. Headless runs use software GL, so frame rates there say nothing about a real GPU: judge those on a real machine.

## Recipes
- **Change how it feels:** `src/game/config.js`, then `bun test`. The tests in `tests/ship.test.js` pin how she handles as numbers, so a change of feel will fail them: update them on purpose.
- **Add an island or props:** edit `src/levels/main.js`, with coordinates local to the island. `bun test` reports what fell off, with the rim radius there. The maps pick it up by themselves.
- **Add a gondola line:** two islands directly north and south of each other, a `gondola_station_low` on the southern one and a `gondola_station_high` on the northern one (both `rot: 1`), and an entry in `gondolas`.
- **Fill a big island:** add a line to `BIG TOWNS` in `src/levels/main.js`, like `street("market", -210, 170, { count: 3 })`. New kinds of district go in `src/levels/districts.js`. `bun test` catches buildings standing in each other.
- **Change what's in the sky:** edit the counts in `sky` in `src/levels/main.js`. A new kind: paint it in `src/render/customModels.js`, add it to `SHIP_TYPES` or `BIRD_TYPES` in `src/game/skyTraffic.js`. See one with `bun run shot -- --eval "game.lookAtSky('dragon')" --name dragon`.
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
bun run perf                                   # draw calls and triangles from fixed cameras, against a budget
```
`window.game` drives the live page (`docs/agent-api.md`): `advance(secs, "w,space")`, `tap("e")`, `walkTo`, `flyTo`,
`teleport`, `view`, `cam`, `scenario`, `map`, `lod`, `sky`, `lookAtSky`, `snapshot`, `stats`, `fx`, `screenOf`, `pause`. URL flags: `?level= &view= &low &hq &noao
&noshadow &paused &debug`.
