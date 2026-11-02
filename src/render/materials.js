// Materials, taken from the tech demo's main.js: vertex colours × per-instance colour slots (roof / wall / pillar /
// cloth), the walk shader for tagged limbs, instancing, plus the one thing that is new here: the height mist.
import * as THREE from "three";
import { SLOT_DEFAULT } from "../engine/geo.js";
import { MIST } from "../game/config.js";

// The mist is the same colour as the horizon of the sky dome, so the world dissolves into one white. It is HDR because
// ACES tone mapping (see renderer.js) would otherwise turn it grey. Change it here and everything follows.
export const MIST_COLOR = new THREE.Color(5.0, 5.2, 5.5);

const SLOT_U = Object.fromEntries(Object.entries(SLOT_DEFAULT).map(([k, v]) => ["u" + k[0].toUpperCase() + k.slice(1), { value: new THREE.Color(v) }]));
const SLOT_GLSL = `attribute float aSlot;
#ifdef USE_INSTANCING
attribute vec3 iRoof; attribute vec3 iWall; attribute vec3 iPillar; attribute vec3 iCloth;
#endif
uniform vec3 uRoof; uniform vec3 uWall; uniform vec3 uPillar; uniform vec3 uCloth;
`;
const SLOT_APPLY = `#include <color_vertex>
#ifdef USE_INSTANCING
  vec3 sR = iRoof, sW = iWall, sP = iPillar, sC = iCloth;
#else
  vec3 sR = uRoof, sW = uWall, sP = uPillar, sC = uCloth;
#endif
  if ( aSlot > 0.5 ) vColor.rgb *= aSlot < 1.5 ? sR : aSlot < 2.5 ? sW : aSlot < 3.5 ? sP : sC;`;

function slotMaterial(extraKey = "", extra = null) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, SLOT_U); sh.vertexShader = SLOT_GLSL + sh.vertexShader.replace("#include <color_vertex>", SLOT_APPLY); extra?.(sh); };
  m.customProgramCacheKey = () => "slots" + extraKey;
  return m;
}

/** Static models. */
export const vmat = slotMaterial();

/** People and animals: limbs tagged per vertex (aPart, see engine/geo.js) swing by the per-instance aWalk = [phase, amp]. */
export const walkMat = slotMaterial("walk", (sh) => {
  sh.vertexShader = "attribute vec3 aPart;\nattribute vec2 aWalk;\n" + sh.vertexShader
    .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n\tfloat wK = abs( aPart.x ); bool wZ = wK > 2.5;\n\tfloat wAng = aPart.x == 0.0 ? 0.0 : sign( aPart.x ) * ( wK > 1.5 && wK < 2.5 ? 0.7 : 1.0 ) * sin( aWalk.x ) * aWalk.y;\n\tfloat wc = cos( wAng ), ws = sin( wAng );\n\tobjectNormal = wZ ? vec3( objectNormal.x * wc - objectNormal.y * ws, objectNormal.x * ws + objectNormal.y * wc, objectNormal.z ) : vec3( objectNormal.x, objectNormal.y * wc - objectNormal.z * ws, objectNormal.y * ws + objectNormal.z * wc );")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tif ( wZ ) { vec2 wd = vec2( transformed.x - aPart.z, transformed.y - aPart.y ); transformed.x = aPart.z + wd.x * wc - wd.y * ws; transformed.y = aPart.y + wd.x * ws + wd.y * wc; }\n\telse { vec2 wd = vec2( transformed.y - aPart.y, transformed.z - aPart.z ); transformed.y = aPart.y + wd.x * wc - wd.y * ws; transformed.z = aPart.z + wd.x * ws + wd.y * wc; }");
});

/** Ground cover and other vertex-coloured meshes that use no colour slots. */
export const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/** Cliffs: vertex colours × layered rock (wavy strata, dark seams), the terrain shader of the tech demo. */
export const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
rockMat.onBeforeCompile = (sh) => {
  sh.vertexShader = "varying vec3 vTW;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvTW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;");
  sh.fragmentShader = "varying vec3 vTW;\nfloat th( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\n" +
    sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float wav = 2.4 * sin( vTW.x * 0.045 + vTW.z * 0.031 ) + 1.6 * sin( vTW.z * 0.11 - vTW.x * 0.07 );
      float yy = vTW.y + wav, band = floor( yy / 5.0 ), f = fract( yy / 5.0 );
      float cell = floor( ( vTW.x + vTW.z ) / 37.0 );
      float s = mix( 0.74, 1.18, th( vec2( band, cell ) ) );
      if ( f < 0.12 && th( vec2( band, 7.0 ) ) > 0.4 ) s *= 0.66;
      s *= mix( 0.92, 1.06, th( vec2( floor( yy / 17.0 ), cell + 3.0 ) ) );
      diffuseColor.rgb *= s;`);
};
rockMat.customProgramCacheKey = () => "rock";

const C3 = new THREE.Color();
/** An InstancedMesh of a slot-coloured geometry, with per-instance slot colours (variants: [{roof, wall, ...}] or null). */
export function inst(geo, n, variants = null, mat = vmat) {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a);
  g.boundingSphere = geo.boundingSphere; g.boundingBox = geo.boundingBox; g.userData = geo.userData;
  for (const [slot, def] of Object.entries(SLOT_DEFAULT)) {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { C3.set(variants?.[i]?.[slot] ?? def); arr[i * 3] = C3.r; arr[i * 3 + 1] = C3.g; arr[i * 3 + 2] = C3.b; }
    g.setAttribute("i" + slot[0].toUpperCase() + slot.slice(1), new THREE.InstancedBufferAttribute(arr, 3));
  }
  return new THREE.InstancedMesh(g, mat, n);
}

// Distance fog and height mist together, mixed in log space: the mist colour is far brighter than the scene, and a plain
// mix would blow out to white at the first hint of fog. This way the fade is even all the way down.
const MIST_GLSL = `float mistH = 1.0 - smoothstep( uMistBottom, uMistTop, vMistY );
	float mistD = smoothstep( fogNear, fogFar, vFogDepth );
	float mistK = 1.0 - ( 1.0 - mistH ) * ( 1.0 - mistD );
	gl_FragColor.rgb = exp( mix( log( max( gl_FragColor.rgb, vec3( 0.002 ) ) ), log( uMistColor ), mistK ) );`;

const mistU = { uMistTop: { value: MIST.top }, uMistBottom: { value: MIST.bottom }, uMistColor: { value: MIST_COLOR } };
/** Set the mist band at runtime (for tuning): game.fx({ mistTop, mistBottom }). */
export const mistUniforms = mistU;

/**
 * Height mist. Injected into every fogged material in the tree: below uMistTop a surface fades to the mist colour, and by
 * uMistBottom it is gone. Call after the whole scene is built (see the tech demo's addDistanceDarkening for the pattern).
 */
export function addMist(root) {
  root.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m || !m.fog || m.userData.mist) continue;
      m.userData.mist = true;
      const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.bind(m);
      m.onBeforeCompile = (sh, r) => {
        prev.call(m, sh, r);
        Object.assign(sh.uniforms, mistU);
        sh.vertexShader = "varying float vMistY;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n\tvec4 mwp = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n\tmwp = instanceMatrix * mwp;\n#endif\n\tvMistY = ( modelMatrix * mwp ).y;");
        sh.fragmentShader = "uniform float uMistTop;\nuniform float uMistBottom;\nuniform vec3 uMistColor;\nvarying float vMistY;\n" +
          sh.fragmentShader.replace("#include <fog_fragment>", MIST_GLSL);
      };
      m.customProgramCacheKey = () => prevKey() + "|mist";
      m.needsUpdate = true;
    }
  });
}
