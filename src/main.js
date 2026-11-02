// The browser wiring: level → game → scene → loop. All game rules are in src/game/, all drawing in src/render/.
// window.game is the API agents and tests drive the running page with: see docs/agent-api.md.
//
// URL params: ?level=main|flat|hop|mist|gallery  &view=<name>  &low  &hq  &noao  &noshadow  &paused  &debug
import * as THREE from "three";
import { createGame } from "./game/game.js";
import { createCameraRig } from "./game/cameraRig.js";
import { SCENARIOS, runScenario } from "./game/scenarios.js";
import { STEP, QUALITY } from "./game/config.js";
import { nextQuality } from "./game/lod.js";
import { walkTo, flyTo } from "./game/pilot.js";
import { LEVELS } from "./levels/index.js";
import { createRenderer } from "./render/renderer.js";
import { buildWorldScene } from "./render/worldScene.js";
import { buildActors } from "./render/actors.js";
import { addMist, mistUniforms } from "./render/materials.js";
import { buildDebug } from "./render/debug.js";
import { createInput } from "./input.js";
import { createHud } from "./hud.js";
import { createMap } from "./map.js";

const qs = new URLSearchParams(location.search);
const api = (window.game = { ready: false, error: null });

(async () => {
  try {
    const levelId = qs.get("level") ?? "main";
    if (!LEVELS[levelId]) throw new Error(`no level "${levelId}"; have ${Object.keys(LEVELS).join(", ")}`);
    await new Promise((r) => setTimeout(r, 20));   // let the loading text paint

    const T0 = performance.now(), loadTimes = {}, mark = (name) => { loadTimes[name] = Math.round(performance.now() - T0); };
    const game = createGame(LEVELS[levelId]); mark("game");
    const R = createRenderer(qs); mark("renderer");
    const rig = createCameraRig(game);
    const world = buildWorldScene(R.scene, game.world, R.skyState, { groundRes: qs.has("low") ? 450 : 800 }); mark("world");
    const actors = buildActors(R.scene, game); mark("actors");
    addMist(R.scene);   // again, for the actors just added
    const debug = buildDebug(game.world); debug.visible = qs.has("debug"); R.scene.add(debug);
    const hud = createHud(game, () => { const i = R.renderer.info.render; return `${i.calls} draws · ${Math.round(i.triangles / 1000)}k tris`; }), map = createMap(game);
    const input = createInput(R.renderer.domElement, rig, { onMap: () => map.toggle(), onEscape: () => map.show(false) });
    const { camera } = R;

    let paused = qs.has("paused");
    const camVec = new THREE.Vector3();

    /** Bring the picture up to date with the game (camera, meshes, world animation). Does not advance the game. */
    function present(dt) {
      rig.update(dt);
      camera.position.set(...rig.pos); camera.lookAt(...rig.target);
      if (Math.abs(camera.fov - rig.fov) > 0.01) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
      camVec.copy(camera.position);
      actors.sync(dt, camVec);
      world.update(game.state.time, camVec);
      const focus = game.state.mode === "fly" ? game.riding() : game.state.player;
      R.aimShadows(focus.x, focus.y, focus.z, game.state.mode === "fly" ? 160 : Math.min(260, 110 + rig.distance * 1.6));
      hud.update(dt);
      map.update();
    }

    // ---- real-time loop: fixed-step game, one render per frame
    const clock = new THREE.Clock(); let acc = 0, slowT = 0, slowN = 0, lastT = 0;
    const adaptive = !qs.has("hq") && !qs.has("low");
    function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, clock.getDelta());
      if (paused) return;   // paused: nothing moves or draws until an API call asks for it (fast, deterministic screenshots)
      acc += dt;
      while (acc >= STEP) { game.step({ ...input.take(), camYaw: rig.yaw }); acc -= STEP; }
      present(dt);
      R.draw();
      // adaptive quality: hold steady unless frames stay slow; ?hq and ?low opt out. Hidden tabs skip this: dt is capped and meaningless there
      if (adaptive && document.visibilityState === "visible") {
        slowT += clock.elapsedTime - lastT; slowN++; lastT = clock.elapsedTime;
        if (slowT > 2.5) { const avg = slowT / slowN, next = nextQuality(avg, R.qualityStep, QUALITY.length - 1); if (next !== R.qualityStep) R.setQuality(next); slowT = 0; slowN = 0; }
      }
    }

    // ---- agent API (see docs/agent-api.md)
    const toKeys = (keys) => (typeof keys === "string" ? Object.fromEntries(keys.split(",").filter(Boolean).map((k) => [k.trim(), true])) : keys ?? {});
    const stepFrames = (seconds, inputFn) => {
      const steps = Math.round(seconds / STEP), every = Math.max(1, Math.round(1 / 60 / STEP));
      for (let i = 0; i < steps; i++) { game.step({ camYaw: rig.yaw, ...inputFn() }); if (i % every === 0) { rig.update(every * STEP); } }
      present(0);
    };
    let scenarioRun = null;
    Object.assign(api, {
      LEVELS: Object.keys(LEVELS), SCENARIOS: Object.keys(SCENARIOS), raw: game, rig, scene: R.scene, camera, renderer: R.renderer,
      get state() { return game.state; },
      get events() { return game.events; },
      /** Stop / resume the real-time loop. While paused only advance() moves things, so screenshots are deterministic. */
      pause(on = true) { paused = on; return paused; },
      /** Advance the simulation with keys held ("w,space" or {w: true}), then render one frame. */
      advance(seconds, keys) { stepFrames(seconds, () => toKeys(keys)); R.draw(); return api.snapshot(); },
      /** Press and release a key once. */
      tap(key) { stepFrames(0.05, () => toKeys(key)); stepFrames(0.05, () => ({})); R.draw(); return api.snapshot(); },
      /** Autopilot: run real keys until there, or timeout. */
      walkTo(x, z, limit = 30) { const n = limit / STEP; for (let i = 0; i < n; i++) { const k = walkTo(game, x, z); if (!k) break; rig.yaw = k.camYaw; stepFrames(STEP, () => k); } R.draw(); return api.snapshot(); },
      flyTo(x, z, y, limit = 60) { const n = limit / STEP; for (let i = 0; i < n; i++) { const k = flyTo(game, x, z, y); if (!k) break; stepFrames(STEP, () => k); } R.draw(); return api.snapshot(); },
      /** Put the character on an island: teleport("market"), or teleport("market", 20, -30) with a local offset. */
      teleport(id, x = 0, z = 0) {
        if (game.state.mode !== "walk") throw new Error("teleport only works on foot");
        const isl = game.world.byId[id]; if (!isl) throw new Error(`no island "${id}"`);
        const p = game.state.player; p.x = isl.x + x; p.z = isl.z + z; game.state.island = id; p.y = isl.top; p.grounded = false;
        stepFrames(0.5, () => ({})); rig.override = null; rig.focus = [p.x, p.y + 9, p.z]; present(0.2); R.draw(); return api.snapshot();
      },
      /** Fix the camera (or pass nothing to hand it back to the game). */
      cam(pos, target) { rig.override = pos ? { pos, target } : null; present(0); R.draw(); },
      /** A named camera from the level (level.views): game.view("farm"). */
      view(name) { const v = game.world.views[name]; if (!v) throw new Error(`no view "${name}"; have ${Object.keys(game.world.views).join(", ")}`); api.cam(v[0], v[1]); },
      views() { return Object.keys(game.world.views); },
      /** Step through a scenario from src/game/scenarios.js; each call runs to its next photo stop. Returns {shot} or null at the end. */
      scenario(name) { if (SCENARIOS[name].level !== levelId) throw new Error(`scenario "${name}" needs ?level=${SCENARIOS[name].level}`); paused = true; scenarioRun = runScenario(game, SCENARIOS[name], (inp) => stepFrames(STEP, () => inp)); return api.scenarioNext(); },
      scenarioNext() {
        if (!scenarioRun) return null;
        const r = scenarioRun.next();
        if (r.done) { scenarioRun = null; present(0.1); R.draw(); return null; }
        if (r.value.from) rig.override = { pos: r.value.from, target: r.value.at }; else rig.override = null;
        for (let i = 0; i < 20; i++) present(1 / 30);   // let the camera settle
        R.draw(); return { shot: r.value.shot };
      },
      /** Small JSON picture of the game: enough to assert on. */
      snapshot() {
        const s = game.state, f = game.riding(), p = s.player;
        return { t: +s.time.toFixed(3), mode: s.mode, island: s.island, player: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), ship: f ? { id: f.id, pos: [f.x, f.y, f.z].map((v) => +v.toFixed(1)), speed: +Math.hypot(f.vx, f.vz).toFixed(0), landed: f.landed } : null, prompt: s.prompt?.action ?? null, cam: { pos: rig.pos.map((v) => +v.toFixed(0)), target: rig.target.map((v) => +v.toFixed(0)) } };
      },
      /** World-to-screen, in pixels; null if behind the camera. */
      screenOf(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return v.z > 1 ? null : [Math.round(((v.x + 1) / 2) * innerWidth), Math.round(((1 - v.y) / 2) * innerHeight)]; },
      /** Island LOD levels, and the quality step in use. */
      lod() { return { quality: R.qualityStep, islands: Object.fromEntries(world.islands.map((it) => [it.island.id, it.level])) }; },
      stats() { const i = R.renderer.info.render; return { drawCalls: i.calls, triangles: i.triangles, quality: R.qualityStep, level: levelId, islands: game.world.islands.length, props: game.world.props.length, ...api.snapshot() }; },
      /** The map screen: map(true) opens it, map(false) closes it, map() asks. */
      map(on) { if (on !== undefined) map.show(on); map.update(); return map.isOpen; },
      /** Map geometry, for checks: { mini, big } projections. */
      mapViews: () => map.views(),
      /** Rendering toggles: fx({ ao: false, hud: false, debug: true, mistTop: 200, mistBottom: 0, fogNear: 1400, fogFar: 30000 }). */
      fx(o = {}) {
        if (o.ao !== undefined) R.ao(o.ao);
        if (o.debug !== undefined) debug.visible = !!o.debug;
        if (o.hud !== undefined) for (const id of ["help", "prompt", "card", "speed", "stats", "title", "minimap"]) { const e = document.getElementById(id); if (e) e.style.visibility = o.hud ? "" : "hidden"; }
        if (o.mistTop !== undefined) mistUniforms.uMistTop.value = o.mistTop;
        if (o.mistBottom !== undefined) mistUniforms.uMistBottom.value = o.mistBottom;
        if (o.fogNear !== undefined) R.scene.fog.near = o.fogNear;
        if (o.fogFar !== undefined) R.scene.fog.far = o.fogFar;
        R.draw();
        return { ao: R.ao(), mistTop: mistUniforms.uMistTop.value, mistBottom: mistUniforms.uMistBottom.value };
      },
      render() { present(0); R.draw(); },
    });

    present(0.1); R.draw(); mark("firstFrame"); api.loadTimes = loadTimes;
    if (qs.get("view")) api.view(qs.get("view"));
    document.getElementById("loading")?.remove();
    api.ready = true;
    loop();
  } catch (err) {
    console.error(err);
    const el = document.getElementById("loading"); if (el) el.textContent = "ERROR: " + err.message;
    api.error = String(err.stack || err);
  }
})();
