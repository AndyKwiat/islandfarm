// Renderer, post-processing and lights: the tech demo's pipeline minus the night machinery.
// Scene → GTAO (ambient occlusion) → output (ACES tone mapping + sRGB). URL flags: &low &noao &noshadow.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { skyState } from "../engine/sky.js";
import { MIST_COLOR } from "./materials.js";
import { QUALITY } from "../game/config.js";

const TIME_OF_DAY = 10.5;   // fixed for now; the demo's day cycle lives in engine/sky.js if you ever want it back

export function createRenderer(qs) {
  const LOW = qs.has("low"), HQ = qs.has("hq");
  const baseRatio = () => (LOW ? 1 : Math.min(devicePixelRatio, HQ ? 2 : QUALITY[0].pixelRatio));
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(baseRatio());
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !qs.has("noshadow");
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(MIST_COLOR, 1100, 6500);
  scene.background = MIST_COLOR.clone();
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 2, 16000);

  const st = skyState(TIME_OF_DAY);
  scene.add(new THREE.HemisphereLight(st.hs, "#c4c8cc", st.hi * 1.15));   // the white mist below bounces plenty of light back up
  const fill = new THREE.DirectionalLight("#b4d0ff", st.fi * 1.4);
  const sun = new THREE.DirectionalLight(st.sun, st.si); sun.castShadow = true;
  sun.shadow.mapSize.set(HQ ? 4096 : 2048, HQ ? 4096 : 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 2600 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target, fill, fill.target);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = st.ex;

  let AO = !qs.has("noao");
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: LOW ? 0 : HQ ? 4 : 2 }));
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.updateGtaoMaterial({ radius: 5, distanceExponent: 1.5, thickness: 3, scale: 1.1, samples: HQ ? 16 : 8, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: HQ ? 16 : 8 });
  gtao.blendIntensity = 0.85;
  // Soft see-through things (mist wisps, wind, the landing ring) must not cast occlusion: hide them from the AO's own pass.
  const hideExtra = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = () => { hideExtra(); scene.traverse((o) => { if (o.userData.noAO && o.visible) { gtao._visibilityCache.set(o, o.visible); o.visible = false; } }); };
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
  renderer.info.autoReset = false;
  renderer.shadowMap.autoUpdate = false;   // the AO pass re-renders the scene: draw the shadow map once per frame

  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

  let qualityStep = 0;
  const D = new THREE.Vector3();
  return {
    renderer, scene, camera, sun, skyState: st,
    /** Keep the shadow map around what the player is looking at. Stepped so that shadows don't shimmer. */
    aimShadows(x, y, z, extent) {
      sun.target.position.set(Math.round(x / 4) * 4, Math.round(y), Math.round(z / 4) * 4);
      sun.position.copy(sun.target.position).addScaledVector(D.copy(st.dir), 1100);
      fill.target.position.copy(sun.target.position); fill.position.copy(sun.target.position).add(D.set(-st.dir.x * 500, 300, -st.dir.z * 500));
      const e = sun.shadow.camera;
      if (e.right !== extent) { e.left = -extent; e.right = extent; e.top = extent; e.bottom = -extent; e.updateProjectionMatrix(); }
    },
    draw() { renderer.info.reset(); renderer.shadowMap.needsUpdate = true; gtao.enabled = AO; composer.render(); },
    ao(on) { if (on !== undefined) AO = !!on; return AO; },
    /** Apply a step of QUALITY (config.js). Never raises the resolution above what this screen started with. */
    setQuality(step) {
      qualityStep = step; const q = QUALITY[step], ratio = Math.min(baseRatio(), q.pixelRatio);
      if (!q.ao) AO = false;
      renderer.setPixelRatio(ratio); composer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    },
    get qualityStep() { return qualityStep; },
  };
}
