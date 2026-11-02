// Everything that moves with the game state: the character, airships, critters, the landing ring, the wind.
// sync(state, dt) copies the state into the meshes; it never changes the game.
import * as THREE from "three";
import { modelGeometry } from "../engine/models.js";
import { personGeometry, animalGeometry } from "../engine/figures.js";
import { genPerson } from "../engine/people.js";
import { PROP_POSITIONS } from "./customModels.js";
import { groundAt, colliderTopAt } from "../game/world.js";
import { SHIP, LOD } from "../game/config.js";
import { rng } from "../game/rng.js";
import { inst, walkMat, vmat } from "./materials.js";

// The player's look: a farmer in a straw hat. Change anything here, see engine/figures.js for the options.
const PLAYER_LOOK = { arch: "farmer", skin: "#f0c498", hair: "#3a2a22", top: "#e04a3a", bottom: "#3a6ad8", sash: "#f0c040", shoe: "#3a2a22", dress: false, hat: "straw", hatColor: "#3a3440", item: null, beard: false, kid: false, bun: false };

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

/** A single figure with walk animation, as an InstancedMesh of one. */
function figure(geo) {
  const m = inst(geo, 1, null, geo.attributes.aPart ? walkMat : vmat);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const walk = new THREE.InstancedBufferAttribute(new Float32Array(2), 2); walk.setUsage(THREE.DynamicDrawUsage);
  if (geo.attributes.aPart) m.geometry.setAttribute("aWalk", walk);
  return { mesh: m, walk, amp: 0 };
}
function pose(f, x, y, z, yaw, phase, targetAmp, dt) {
  Q.setFromAxisAngle(UP, yaw);
  f.mesh.setMatrixAt(0, M4.compose(V.set(x, y, z), Q, S1)); f.mesh.instanceMatrix.needsUpdate = true;
  f.amp += (targetAmp - f.amp) * Math.min(1, dt * 10);
  f.walk.array[0] = phase; f.walk.array[1] = f.amp; f.walk.needsUpdate = true;
}

function buildShip(s, def) {
  const group = new THREE.Group(); group.name = "ship:" + s.id;
  const body = inst(modelGeometry("airship_skiff"), 1, [def.colors]); body.castShadow = body.receiveShadow = true; body.frustumCulled = false;
  group.add(body);
  const props = PROP_POSITIONS.map(([x, y, z], i) => {
    const m = new THREE.Mesh(modelGeometry("airship_prop"), vmat); m.position.set(x, y, z); m.castShadow = true;
    if (i) m.scale.setScalar(0.62);
    group.add(m); return m;
  });
  return { group, props };
}

export function buildActors(scene, game) {
  const { world, state } = game;
  const player = figure(personGeometry(PLAYER_LOOK)); scene.add(player.mesh);
  const ships = state.ships.map((s, i) => { const v = buildShip(s, world.ships[i]); scene.add(v.group); return v; });

  // Critters share meshes by look: two looks per kind of person, one per animal. One draw for each look, however many use it,
  // and looks with nobody near the camera aren't drawn at all.
  const R = rng(99), lookRng = { pick: (a) => a[Math.floor(R() * a.length)], chance: (p) => R() < p };
  const flocks = new Map(), HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  const critters = world.critters.map((c) => {
    const key = c.animal ? `a:${c.animal}:${c.variant ?? 0}` : `p:${c.person}:${c.id % 2}`;
    let f = flocks.get(key); if (!f) flocks.set(key, (f = { key, c, members: [] }));
    const entry = { flock: f, slot: f.members.length, amp: 0, shown: true }; f.members.push(entry); return entry;
  });
  for (const f of flocks.values()) {
    const geo = f.c.animal ? animalGeometry(f.c.animal, f.c.variant ?? 0) : personGeometry(genPerson(f.c.person, lookRng));
    const n = f.members.length, walking = !!geo.attributes.aPart;
    f.mesh = inst(geo, n, null, walking ? walkMat : vmat); f.mesh.castShadow = f.mesh.receiveShadow = true; f.mesh.frustumCulled = false; f.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    f.walk = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); f.walk.setUsage(THREE.DynamicDrawUsage);
    if (walking) f.mesh.geometry.setAttribute("aWalk", f.walk);
    scene.add(f.mesh);
  }

  // a ring on the ground below the ship: where you'll come down, and whether you can
  const ring = new THREE.Mesh(new THREE.RingGeometry(10, 12.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
  ring.userData.noAO = true; ring.visible = false; scene.add(ring);

  // wind: little streaks around the camera that stretch with speed, so you can feel how fast you are going
  const N = 140, P = new Float32Array(N * 6), dust = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(P, 3)),
    new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, fog: false }));
  dust.frustumCulled = false; dust.userData.noAO = true; scene.add(dust);
  const seeds = Array.from({ length: N }, () => [R() * 300, R() * 200, R() * 300]);
  const wrap = (v, c, span) => c + (((v - c) % span) + span * 1.5) % span - span / 2;

  const RIDER_LOCAL = new THREE.Vector3(1, SHIP.deckY, 0);
  return {
    player, ships, critters,
    /** Copy the state into the meshes. */
    sync(dt, cameraPos) {
      const time = state.time;
      state.ships.forEach((s, i) => {
        const v = ships[i], bob = s.landed ? 0 : Math.sin(time * 1.6 + i) * 0.7;
        v.group.position.set(s.x, s.y + bob, s.z);
        // the model faces +x: heading yaw → model yaw - 90°. Then bank about its length and pitch about its width.
        v.group.rotation.set(0, s.yaw - Math.PI / 2, 0, "YXZ");
        v.group.rotateX(s.bank);
        v.group.rotateZ(s.tilt);
        const propsOn = Math.hypot(s.x - cameraPos.x, s.y - cameraPos.y, s.z - cameraPos.z) < LOD.propellers;
        v.props.forEach((m) => { m.visible = propsOn; m.rotation.x = s.prop * (m === v.props[0] ? 1 : 1.4); });
      });
      // the character
      const p = state.player, ridden = state.mode === "fly" ? game.riding() : null;
      let phase = p.stride, amp = state.mode === "walk" ? (p.speed > 4 ? 0.7 : 0) : 0;
      if (!p.grounded && state.mode === "walk") amp = 0.25;
      if (state.mode === "boarding" || state.mode === "exiting") amp = 0.3;
      if (ridden) {
        const g = ships[state.ships.indexOf(ridden)].group;
        g.updateMatrixWorld();
        V.copy(RIDER_LOCAL).applyMatrix4(g.matrixWorld);
        Q.setFromRotationMatrix(g.matrixWorld).multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2));
        player.mesh.setMatrixAt(0, M4.compose(V, Q, S1)); player.mesh.instanceMatrix.needsUpdate = true;
        player.walk.array[1] = 0; player.walk.needsUpdate = true;
      } else pose(player, p.x, p.y, p.z, p.yaw, phase, amp, dt);
      // critters
      const flockList = [...flocks.values()];
      for (const f of flockList) f.any = false;
      state.critters.forEach((c, i) => {
        const e = critters[i], f = e.flock, near = Math.hypot(c.x - cameraPos.x, c.y - cameraPos.y, c.z - cameraPos.z) < LOD.critters;
        if (!near) { if (e.shown) { f.mesh.setMatrixAt(e.slot, HIDDEN); f.mesh.instanceMatrix.needsUpdate = true; e.shown = false; } return; }
        e.shown = true; f.any = true;
        Q.setFromAxisAngle(UP, c.yaw); f.mesh.setMatrixAt(e.slot, M4.compose(V.set(c.x, c.y, c.z), Q, S1)); f.mesh.instanceMatrix.needsUpdate = true;
        e.amp += ((c.moving ? 0.5 : 0) - e.amp) * Math.min(1, dt * 10);
        f.walk.array[e.slot * 2] = c.stride; f.walk.array[e.slot * 2 + 1] = e.amp; f.walk.needsUpdate = true;
      });
      for (const f of flockList) f.mesh.visible = f.any;
      // landing ring
      const flying = state.mode === "fly" && !ridden.landed;
      const ground = flying ? groundAt(world, ridden.x, ridden.z) : null;
      ring.visible = ground !== null && ridden.y - ground < 900;
      if (ring.visible) {
        ring.position.set(ridden.x, ground + 0.8, ridden.z);
        const clear = colliderTopAt(world, ridden.x, ridden.z, SHIP.radius * 0.6) <= ground, near = ridden.y - ground < SHIP.autoLandMaxHeight;
        ring.material.color.set(!clear ? "#ffb060" : near ? "#a0ffb0" : "#ffffff");
        ring.material.opacity = near ? 0.85 : 0.35;
      }
      // wind
      const sh = ridden, sp = sh ? Math.hypot(sh.vx, sh.vy, sh.vz) : 0, kk = Math.max(0, (sp - 60) / 280);
      dust.material.opacity = Math.min(0.38, kk * 0.38);
      dust.visible = kk > 0.01;
      if (dust.visible) {
        const len = 0.025 + kk * 0.04;
        seeds.forEach((q, i) => {
          const x = wrap(q[0], cameraPos.x, 300), y = wrap(q[1], cameraPos.y, 200), z = wrap(q[2], cameraPos.z, 300), j = i * 6;
          P[j] = x; P[j + 1] = y; P[j + 2] = z;
          P[j + 3] = x - sh.vx * len; P[j + 4] = y - sh.vy * len; P[j + 5] = z - sh.vz * len;
        });
        dust.geometry.attributes.position.needsUpdate = true;
      }
    },
  };
}
