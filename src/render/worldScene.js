// Everything in the world that does not belong to the game state: islands, props, sky, clouds, mist, the gondola, and
// the balloons drifting about. buildWorldScene(scene, world) builds it all; update(time, cameraPos) animates it.
import * as THREE from "three";
import { Builder } from "../engine/geo.js";
import { modelGeometry } from "../engine/models.js";
import "./customModels.js";
import { rng } from "../game/rng.js";
import { MIST } from "../game/config.js";
import { inst, addMist, MIST_COLOR } from "./materials.js";
import { buildIsland } from "./islandMesh.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/** Sky dome: the horizon and everything below it is exactly the mist colour, so there is no horizon line to see. */
function buildSky(st) {
  const uni = { uZen: { value: st.zen }, uHor: { value: MIST_COLOR }, uSunDir: { value: st.dir.clone().setY(Math.max(0.03, st.dir.y * 0.55)).normalize() }, uSun: { value: st.sun } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14000, 32, 16), new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vDir; void main() { vDir = normalize( position ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }",
    fragmentShader: `uniform vec3 uZen, uHor, uSun, uSunDir; varying vec3 vDir;
      void main() { float h = normalize( vDir ).y;
        vec3 c = exp( mix( log( uHor ), log( uZen ), pow( smoothstep( 0.0, 0.42, h ), 0.55 ) ) );
        float d = max( dot( normalize( vDir ), uSunDir ), 0.0 );
        c += uSun * step( 0.0, h ) * ( pow( d, 900.0 ) * 6.0 + pow( d, 60.0 ) * 0.35 );
        gl_FragColor = vec4( c, 1.0 ); }`,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false; dome.userData.noAO = true;
  return dome;
}

/** Puffy low-poly cumulus at flying height, merged into one mesh that drifts as a whole: one draw call for the lot. */
function buildClouds() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true, emissive: new THREE.Color("#8a93a6") });
  const R = rng(44), geos = [], T = new THREE.Matrix4();
  for (let k = 0; k < 30; k++) {
    const b = new Builder(), n = 3 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) { const r = 22 + R() * 34; b.blob((i - n / 2) * 34 + R() * 18, R() * 10, (R() - 0.5) * 44, r * 1.35, r * 0.7, r, ["#dfe6f0", "#f4f7fb", "#ffffff"], { seed: k * 13 + i, detail: 1, jitter: 0.14, flat: -0.25 }); }
    const a = R() * Math.PI * 2, d = 500 + R() * 4200, g = b.build(); g.userData = {}; g.deleteAttribute("aSlot");
    g.applyMatrix4(T.compose(V.set(Math.cos(a) * d, 640 + R() * 420, Math.sin(a) * d), Q.identity(), SC.setScalar(1 + R() * 1.1)));
    geos.push(g);
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat); mesh.name = "clouds"; mesh.userData.noAO = true; mesh.frustumCulled = false;
  return { group: mesh, update(t) { mesh.position.set(Math.sin(t * 0.01) * 240, 0, Math.cos(t * 0.008) * 110); } };
}

/**
 * Mist wisps: big soft quads lying in the mist band, drifting, so the white has some slow life and cliffs don't end on a
 * perfectly straight line. They wrap around the camera so they are always there, wherever you fly.
 */
function buildWisps() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(0.5, "rgba(255,255,255,0.4)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: MIST_COLOR.clone().multiplyScalar(0.5), transparent: true, depthWrite: false, opacity: 0.4, side: THREE.DoubleSide, fog: false });
  const N = 44, geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), im = new THREE.InstancedMesh(geo, mat, N);
  im.frustumCulled = false; im.userData.noAO = true; im.renderOrder = 5; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const R = rng(91), SPAN = 4200, list = Array.from({ length: N }, () => ({ x: R() * SPAN, z: R() * SPAN, y: MIST.bottom + R() * (MIST.top - MIST.bottom + 30), s: 520 + R() * 720, sp: 2 + R() * 5, sy: 1 }));
  const wrap = (v, centre) => { const d = ((v - centre) % SPAN + SPAN * 1.5) % SPAN - SPAN / 2; return centre + d; };
  return { mesh: im, update(t, cx, cz) {
    list.forEach((w, i) => { im.setMatrixAt(i, M4.compose(V.set(wrap(w.x + t * w.sp, cx), w.y, wrap(w.z + t * w.sp * 0.4, cz)), Q.identity(), SC.set(w.s, 1, w.s * 0.8))); });
    im.instanceMatrix.needsUpdate = true;
  } };
}

/** Gondola: a sagging rope between two stations, one car shuttling back and forth. */
function buildGondola(g) {
  const group = new THREE.Group(); group.name = "gondola";
  const a = new THREE.Vector3(...g.from), b = new THREE.Vector3(...g.to), pts = [];
  const at = (t, out = new THREE.Vector3()) => out.lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 26);
  for (let i = 0; i <= 40; i++) pts.push(at(i / 40));
  const ropeMat = new THREE.MeshLambertMaterial({ color: "#6a4a2a" });
  const rope = new THREE.Mesh(mergeGeometries([-1.2, 1.2].map((dx) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().setX(p.x + dx))), 36, 0.4, 4))), ropeMat);
  group.add(rope);
  const car = inst(modelGeometry("gondola_car"), 1); car.castShadow = true; car.frustumCulled = false; car.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(car);
  return { group, update(time) {
    const phase = (time / g.period) % 1, t = 0.06 + 0.88 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)), p = at(t);
    car.setMatrixAt(0, M4.makeTranslation(p.x, p.y - 23.5, p.z)); car.instanceMatrix.needsUpdate = true;
  } };
}

/** Balloons and cargo ships in the distance, circling. One instanced draw per model. */
function buildBalloons(world) {
  const group = new THREE.Group(); group.name = "balloons";
  const byModel = new Map(); for (const d of world.balloons) (byModel.get(d.model) ?? byModel.set(d.model, []).get(d.model)).push(d);
  const sets = [...byModel].map(([model, list]) => {
    const m = inst(modelGeometry(model), list.length, list.map((d) => d.colors ?? null)); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.userData.noAO = true; group.add(m);
    return { m, list };
  });
  return { group, update(time) {
    for (const { m, list } of sets) {
      list.forEach((d, i) => {
        const a = d.phase + time * d.speed, x = d.x + Math.cos(a) * d.radius, z = d.z + Math.sin(a) * d.radius;
        // the models face +x; fly along the tangent of the circle
        const dirX = -Math.sin(a) * Math.sign(d.speed), dirZ = Math.cos(a) * Math.sign(d.speed);
        Q.setFromAxisAngle(UP, Math.atan2(-dirZ, dirX));
        m.setMatrixAt(i, M4.compose(V.set(x, d.y + Math.sin(time * 0.3 + d.phase) * 6, z), Q, SC.setScalar(1)));
      });
      m.instanceMatrix.needsUpdate = true;
    }
  } };
}

/** Build the world into a scene. Call addMist(scene) afterwards (actors are added later; see main.js). */
export function buildWorldScene(scene, world, st, { groundRes = 800 } = {}) {
  const sky = buildSky(st); scene.add(sky);
  const islands = world.islands.map((isl) => { const it = buildIsland(isl, world, groundRes); scene.add(it.group); return it; });
  const clouds = buildClouds(), wisps = buildWisps(), balloons = buildBalloons(world), gondolas = world.gondolas.map(buildGondola);
  scene.add(clouds.group, wisps.mesh, balloons.group, ...gondolas.map((g) => g.group));
  addMist(scene);
  return {
    islands,
    update(time, cam) {
      sky.position.copy(cam);
      for (const it of islands) it.update(cam);
      clouds.update(time); wisps.update(time, cam.x, cam.z); balloons.update(time);
      for (const g of gondolas) g.update(time);
    },
  };
}
