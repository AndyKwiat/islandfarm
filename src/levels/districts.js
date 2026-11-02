// Reusable pieces of a town, for filling big islands. Each function returns { props, paint, critters, fields, ships }
// around a local centre (cx, cz); apply them to a level with addDistricts(). `bun test` checks that everything lands on its
// island and that no two buildings overlap, so placing a piece is mostly a matter of picking a spot and running the tests.
const RED = { roof: "#d8603a" }, TEAL = { roof: "#2a9a90" }, BLUE = { roof: "#3a6ad0" }, PURPLE = { roof: "#7a4ab0" }, GOLD = { roof: "#e0a830" }, STRAW = { roof: "#c89a58", wall: "#f3e4c2", pillar: "#8a5a32" };
const ROOFS = [RED, TEAL, BLUE, PURPLE];

/** Four houses round a little square with a well. */
export function hamlet(island, cx, cz, { colors = STRAW, people = ["farmer", "lady"] } = {}) {
  const at = (model, x, z, rot = 0, c = colors) => ({ island, model, x: cx + x, z: cz + z, rot, colors: c });
  return {
    paint: [{ kind: "plaza", x: cx, z: cz + 12, r: 40 }],
    props: [
      at("home1", -29, -38), at("home2", 29, -38),
      at("home1", -58, 20, 1), at("home1", 58, 20, 3),
      { island, model: "well", x: cx, z: cz + 10 },
      { island, model: "lantern_post", x: cx - 22, z: cz + 42 }, { island, model: "lantern_post", x: cx + 22, z: cz + 42 },
      { island, model: "jars", x: cx + 28, z: cz - 12 }, { island, model: "tree_blossom", x: cx - 42, z: cz + 52 }, { island, model: "tree_fruit", x: cx + 46, z: cz + 54 },
    ],
    critters: [
      ...people.map((person, i) => ({ island, x: cx - 10 + i * 18, z: cz + 28, person, range: 34 })),
      { island, x: cx + 14, z: cz + 34, animal: "chicken", variant: 0, range: 18 },
    ],
  };
}

/** A shopping street along x: a paved road with buildings facing each other. count is the number of pairs. */
export function street(island, cx, cz, { count = 3, people = ["merchant", "lady", "scholar"] } = {}) {
  const props = [], critters = [], gap = 40, x0 = cx - ((count - 1) * gap) / 2, kinds = ["shop", "inn", "shop", "home2"];
  for (let i = 0; i < count; i++) {
    const x = x0 + i * gap;
    props.push({ island, model: kinds[i % 4], x, z: cz - 26, colors: ROOFS[i % 4] });
    props.push({ island, model: kinds[(i + 2) % 4], x, z: cz + 26, rot: 2, colors: ROOFS[(i + 1) % 4] });
  }
  for (const s of [-1, 1]) props.push({ island, model: "lantern_post", x: cx + s * ((count * gap) / 2 + 8), z: cz - 7 }, { island, model: "lantern_post", x: cx + s * ((count * gap) / 2 + 8), z: cz + 7 });
  people.forEach((person, i) => critters.push({ island, x: x0 + i * gap, z: cz + (i % 2 ? 3 : -3), person, range: 44 }));
  return { props, critters, paint: [{ kind: "path", points: [[x0 - gap * 0.9, cz], [x0 + (count - 1) * gap + gap * 0.9, cz]], width: 15 }] };
}

/** A pagoda on a paved court, with lions and incense. */
export function temple(island, cx, cz, { colors = RED } = {}) {
  return {
    paint: [{ kind: "plaza", x: cx, z: cz + 12, r: 50 }],
    props: [
      { island, model: "pagoda", x: cx, z: cz - 12, colors },
      { island, model: "incense_burner", x: cx, z: cz + 32 },
      { island, model: "lion_statue", x: cx - 30, z: cz + 34 }, { island, model: "lion_statue", x: cx + 30, z: cz + 34 },
      { island, model: "tree_pine", x: cx - 54, z: cz - 26 }, { island, model: "tree_pine", x: cx + 54, z: cz - 22 }, { island, model: "tree_pine", x: cx - 60, z: cz + 14 },
    ],
    critters: [{ island, x: cx + 14, z: cz + 20, person: "monk", range: 22 }],
  };
}

/** A walled compound and a manor beside it, under big old trees. */
export function estate(island, cx, cz, { colors = TEAL } = {}) {
  return {
    paint: [{ kind: "path", points: [[cx - 74, cz + 34], [cx + 74, cz + 34]], width: 9 }],
    props: [
      { island, model: "compound", x: cx - 36, z: cz - 12, colors },
      { island, model: "manor", x: cx + 48, z: cz - 8, colors: PURPLE },
      { island, model: "tree_camphor", x: cx - 90, z: cz + 14 }, { island, model: "tree_ginkgo", x: cx + 92, z: cz + 14 },
      { island, model: "lantern_post", x: cx - 14, z: cz + 28 }, { island, model: "lantern_post", x: cx + 14, z: cz + 28 },
    ],
    critters: [{ island, x: cx, z: cz + 40, person: "official", range: 36 }, { island, x: cx + 24, z: cz + 40, person: "lady", range: 30 }],
  };
}

/** Two fields, a hut, a scarecrow, a haystack and something grazing. */
export function farm(island, cx, cz, { crops = ["wheat", "cabbage"], colors = STRAW } = {}) {
  return {
    fields: [{ island, x: cx - 40, z: cz, w: 60, d: 44, crop: crops[0] }, { island, x: cx + 34, z: cz, w: 60, d: 44, crop: crops[1] }],
    props: [
      { island, model: "home1", x: cx - 6, z: cz - 56, colors },
      { island, model: "scarecrow", x: cx - 40, z: cz }, { island, model: "haystack", x: cx + 44, z: cz - 40 }, { island, model: "haystack", x: cx + 60, z: cz - 34 },
      { island, model: "barrow", x: cx - 50, z: cz - 40 }, { island, model: "tree_fruit", x: cx + 80, z: cz + 34 },
    ],
    critters: [{ island, x: cx, z: cz + 40, person: "farmer", range: 30 }, { island, x: cx - 40, z: cz + 44, animal: "cow", variant: "spotted", range: 24 }],
  };
}

/** Flower beds, a pond and blossom trees. */
export function garden(island, cx, cz) {
  return {
    props: [
      { island, model: "garden_pond", x: cx - 30, z: cz }, { island, model: "garden_flower", x: cx + 30, z: cz },
      ...[[-64, -24], [-60, 32], [64, -26], [66, 30], [0, -40], [0, 42]].map(([x, z]) => ({ island, model: "tree_blossom", x: cx + x, z: cz + z })),
    ],
    critters: [{ island, x: cx, z: cz + 22, person: "lady", range: 28 }, { island, x: cx - 10, z: cz - 24, animal: "cat", variant: 0, range: 20 }],
  };
}

/** A watch tower and a gate on a road. */
export function fort(island, cx, cz, { colors = RED } = {}) {
  return {
    paint: [{ kind: "path", points: [[cx, cz - 22], [cx, cz + 70]], width: 12 }],
    props: [
      { island, model: "city_gate", x: cx, z: cz + 8 },
      { island, model: "tower", x: cx - 62, z: cz - 6, colors }, { island, model: "tower", x: cx + 62, z: cz - 6, colors },
      { island, model: "crates", x: cx + 32, z: cz + 42 },
    ],
    critters: [{ island, x: cx - 12, z: cz + 36, person: "soldier", range: 0, yaw: 0 }, { island, x: cx + 12, z: cz + 36, person: "soldier", range: 0, yaw: 0 }],
  };
}

/** A stand of trees, for the empty parts. */
export function grove(island, cx, cz, model = "tree_pine") {
  return { props: [[-30, -18], [-8, -34], [18, -22], [34, 2], [8, 12], [-20, 18], [-42, 6], [24, 30]].map(([x, z]) => ({ island, model, x: cx + x, z: cz + z })) };
}

/** A big monument on a paved court. */
export function monument(island, cx, cz, model = "statue") {
  return {
    paint: [{ kind: "plaza", x: cx, z: cz + 8, r: 58 }],
    props: [
      { island, model, x: cx, z: cz - 8 },
      { island, model: "incense_burner", x: cx - 34, z: cz + 34 }, { island, model: "incense_burner", x: cx + 34, z: cz + 34 },
      { island, model: "tree_ginkgo", x: cx - 76, z: cz - 26 }, { island, model: "tree_ginkgo", x: cx + 76, z: cz - 26 },
    ],
    critters: [{ island, x: cx, z: cz + 44, person: "scholar", range: 26 }],
  };
}

/** An airship landing: a pad, a mast, stores. Pass ship to park one on the pad. */
export function dock(island, cx, cz, { ship = null } = {}) {
  return {
    props: [
      { island, model: "landing_pad", x: cx, z: cz }, { island, model: "mooring_mast", x: cx + 44, z: cz + 8 },
      { island, model: "crates", x: cx - 36, z: cz - 18 }, { island, model: "crates", x: cx - 44, z: cz + 2 }, { island, model: "jars", x: cx - 32, z: cz + 22 },
    ],
    ships: ship ? [{ ...ship, island, x: cx, z: cz }] : [],
    critters: [{ island, x: cx + 8, z: cz + 34, person: "porter", range: 26 }],
  };
}

/** Merge district pieces into a level definition: level.props, .fields, .ships, .critters, and each island's paint. */
export function addDistricts(level, pieces) {
  for (const piece of pieces) {
    level.props.push(...(piece.props ?? []));
    level.fields.push(...(piece.fields ?? []));
    level.ships.push(...(piece.ships ?? []));
    level.critters.push(...(piece.critters ?? []));
    const island = piece.props?.[0]?.island ?? piece.fields?.[0]?.island;
    const def = level.islands.find((i) => i.id === island);
    if (piece.paint?.length) (def.paint ??= []).push(...piece.paint);
  }
  return level;
}

export { GOLD };
