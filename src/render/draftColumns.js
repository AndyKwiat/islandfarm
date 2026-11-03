// Draws the drafts as columns of moving air: faint haze so you can pick them out against the white, and petals and leaves
// spiralling up an updraft, or grey-blue streaks falling down a downdraft, so you can tell which is which from a distance.
// One Points draw for all of them: everything moves in the vertex shader, from time alone.
import * as THREE from "three";
import { MIST } from "../game/config.js";
import { rng } from "../game/rng.js";

const VERT = `
  attribute vec4 aSpin;     // angle, radius fraction, phase, spin speed
  attribute vec4 aColumn;   // radius, height, direction (+1 up, -1 down), rise speed
  attribute vec2 aLook;     // world size, opacity
  attribute vec3 aColor;
  uniform float uTime, uScale, uMistTop, uMistBottom;
  varying vec3 vColor; varying float vAlpha; varying float vSoft;
  void main() {
    float h = fract( aSpin.z + uTime * aColumn.w / aColumn.y );
    float along = aColumn.z > 0.0 ? h : 1.0 - h;
    float y = position.y + along * aColumn.y;
    float a = aSpin.x + uTime * aSpin.w + along * 2.5;
    float r = aColumn.x * aSpin.y * ( 0.75 + 0.25 * sin( uTime * 0.8 + aSpin.x * 5.0 ) );
    vec4 mv = modelViewMatrix * vec4( position.x + cos( a ) * r, y, position.z + sin( a ) * r, 1.0 );
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    gl_PointSize = clamp( uScale * aLook.x / max( dist, 8.0 ), 2.2, 400.0 );
    vColor = aColor;
    vSoft = aLook.x > 20.0 ? 1.0 : 0.0;
    float ends = smoothstep( 0.0, 0.1, h ) * smoothstep( 1.0, 0.86, h );
    float mist = smoothstep( uMistBottom, uMistTop, y );
    float far = 1.0 - smoothstep( 1500.0, 4200.0, dist );
    vAlpha = aLook.y * ends * mist * far * smoothstep( 6.0, 40.0, dist );
  }`;
const FRAG = `
  varying vec3 vColor; varying float vAlpha; varying float vSoft;
  void main() {
    float d = length( gl_PointCoord - 0.5 ) * 2.0;
    if ( d > 1.0 ) discard;
    float a = vSoft > 0.5 ? ( 1.0 - d ) * ( 1.0 - d ) : smoothstep( 1.0, 0.86, d );
    gl_FragColor = vec4( vColor, a * vAlpha );
  }`;

const UP_FLECKS = ["#f8b8c8", "#f0c040", "#ffffff", "#f07a50", "#a8e080"], DOWN_FLECKS = ["#6a8ab0", "#8aa4c4", "#5a7498"];

export function buildDraftColumns(world, height) {
  if (!world.drafts.length) return null;
  const R = rng(61), P = [], spin = [], column = [], look = [], color = [], C = new THREE.Color();
  const add = (d, n, size, alpha, tint, rise, inner) => {
    for (let i = 0; i < n; i++) {
      const up = d.lift > 0, h = d.top - d.base;
      P.push(d.x, d.base, d.z);
      spin.push(R() * Math.PI * 2, inner ? R() * 0.55 : Math.sqrt(R()), R(), (up ? 0.8 : 0.3) * (0.7 + R() * 0.6));
      column.push(d.r, h, up ? 1 : -1, Math.abs(d.lift) * rise * (0.75 + R() * 0.5));
      look.push(size * (0.7 + R() * 0.6), alpha);
      C.set(tint(i)); color.push(C.r, C.g, C.b);
    }
  };
  for (const d of world.drafts) {
    const up = d.lift > 0, n = Math.round(d.r * 0.28);
    add(d, n, d.r * 1.6, up ? 0.3 : 0.34, () => (up ? "#9cc0e8" : "#607898"), 0.28, true);                                   // the haze
    add(d, n * 6, up ? 3.4 : 2.2, 0.95, (i) => (up ? UP_FLECKS : DOWN_FLECKS)[i % (up ? UP_FLECKS.length : DOWN_FLECKS.length)], 0.8, false);   // what it carries
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("aSpin", new THREE.Float32BufferAttribute(spin, 4));
  g.setAttribute("aColumn", new THREE.Float32BufferAttribute(column, 4));
  g.setAttribute("aLook", new THREE.Float32BufferAttribute(look, 2));
  g.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
  const uni = { uTime: { value: 0 }, uScale: { value: height }, uMistTop: { value: MIST.top }, uMistBottom: { value: MIST.bottom } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false });
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 6; points.name = "drafts"; points.userData.noAO = true;
  return { points, update(t, viewHeight) { uni.uTime.value = t; uni.uScale.value = viewHeight; } };
}
