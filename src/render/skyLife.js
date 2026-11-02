// Draws game/skyTraffic.js: one instanced mesh per ship model and per bird species, whatever the numbers. Birds flap in the walk
// shader, so a flock costs a matrix per bird per frame and nothing else. Flocks far from the camera aren't updated or drawn.
import * as THREE from "three";
import { modelGeometry } from "../engine/models.js";
import { createSkyTraffic, shipPose, birdPose } from "../game/skyTraffic.js";
import { LOD } from "../game/config.js";
import { inst, walkMat, vmat } from "./materials.js";

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

function instancedSet(model, n, colors) {
  const geo = modelGeometry(model), walking = !!geo.attributes.aPart;
  const mesh = inst(geo, n, colors, walking ? walkMat : vmat);
  mesh.frustumCulled = false; mesh.userData.noAO = true; mesh.castShadow = false; mesh.receiveShadow = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.name = "sky:" + model;
  let walk = null;
  if (walking) { walk = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); walk.setUsage(THREE.DynamicDrawUsage); mesh.geometry.setAttribute("aWalk", walk); }
  return { mesh, walk };
}

export function buildSkyLife(scene, world) {
  const traffic = createSkyTraffic(world, world.skySpec);
  const group = new THREE.Group(); group.name = "sky"; scene.add(group);

  const shipSets = new Map();
  for (const ship of traffic.ships) { let s = shipSets.get(ship.model); if (!s) shipSets.set(ship.model, (s = { list: [] })); s.list.push(ship); }
  for (const [model, s] of shipSets) { Object.assign(s, instancedSet(model, s.list.length, s.list.map((o) => o.colors))); group.add(s.mesh); }

  const birdSets = new Map();
  for (const flock of traffic.flocks) {
    let s = birdSets.get(flock.species); if (!s) birdSets.set(flock.species, (s = { flocks: [], count: 0, type: flock.type }));
    flock.base = s.count; flock.shown = true; s.count += flock.members.length; s.flocks.push(flock);
  }
  for (const s of birdSets.values()) {
    // lanterns have just one colour each, and need slot colours: warm reds and golds
    const colors = s.type.model === "sky_lantern" ? Array.from({ length: s.count }, (_, i) => ({ cloth: ["#f05a30", "#f0a030", "#e8402a", "#f4c040"][i % 4] })) : null;
    Object.assign(s, instancedSet(s.type.model, s.count, colors)); group.add(s.mesh);
  }

  return {
    traffic,
    update(t, cam) {
      for (const s of shipSets.values()) {
        s.list.forEach((ship, i) => {
          const p = shipPose(ship, t);
          // the models face +x
          Q.setFromAxisAngle(UP, p.yaw - Math.PI / 2).multiply(Q2.setFromAxisAngle(X, p.bank));
          s.mesh.setMatrixAt(i, M4.compose(V.set(p.x, p.y, p.z), Q, S1));
          if (s.walk) { s.walk.array[i * 2] = p.flapPhase; s.walk.array[i * 2 + 1] = ship.type.flapAmp ?? 0.5; }
        });
        s.mesh.instanceMatrix.needsUpdate = true; if (s.walk) s.walk.needsUpdate = true;
      }
      for (const s of birdSets.values()) {
        const far = s.type.formation === "solo" ? LOD.bigBirds : s.type.formation === "vee" ? LOD.flocks * 2 : LOD.flocks;
        let any = false;
        for (const f of s.flocks) {
          const head = birdPose(f, 0, t), near = Math.hypot(head.x - cam.x, head.y - cam.y, head.z - cam.z) < far;
          if (!near) {
            if (f.shown) { f.members.forEach((_, i) => s.mesh.setMatrixAt(f.base + i, HIDDEN)); f.shown = false; s.mesh.instanceMatrix.needsUpdate = true; }
            continue;
          }
          f.shown = true; any = true;
          f.members.forEach((_, i) => {
            const p = i ? birdPose(f, i, t) : head;
            // birds face +z; roll into the bend
            Q.setFromAxisAngle(UP, p.yaw).multiply(Q2.setFromAxisAngle(Z, p.bank));
            s.mesh.setMatrixAt(f.base + i, M4.compose(V.set(p.x, p.y, p.z), Q, S1));
            if (s.walk) { s.walk.array[(f.base + i) * 2] = p.phase; s.walk.array[(f.base + i) * 2 + 1] = p.amp; }
          });
          s.mesh.instanceMatrix.needsUpdate = true; if (s.walk) s.walk.needsUpdate = true;
        }
        s.mesh.visible = any;
      }
    },
    /** Where something is right now, for cameras and checks: the first ship of a model, or first flock of a species. */
    find(name, t) {
      const ship = traffic.ships.find((o) => o.model === name || o.model === "airship_" + name);
      if (ship) { const p = shipPose(ship, t); return { x: p.x, y: p.y + ship.type.height / 2, z: p.z, yaw: p.yaw, size: ship.type.radius * 2.6 }; }
      const flock = traffic.flocks.find((f) => f.species === name);
      if (flock) { const p = birdPose(flock, 0, t); return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, size: Math.max(30, (flock.type.spread ?? 0) * 2, flock.type.formation === "solo" ? flock.type.radius * 2.4 : 0, flock.type.formation === "vee" ? flock.type.spacing * 3.5 : 0) }; }
      return null;
    },
    counts() {
      const ships = {}, birds = {};
      for (const o of traffic.ships) ships[o.model] = (ships[o.model] ?? 0) + 1;
      for (const f of traffic.flocks) birds[f.species] = (birds[f.species] ?? 0) + f.members.length;
      return { ships, birds };
    },
  };
}
