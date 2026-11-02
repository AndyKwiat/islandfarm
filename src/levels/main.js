// The main world: ten islands above the mist. Pure data: edit freely, `bun test` will tell you if a prop fell off.
// Prop and ship x/z are LOCAL to their island (0, 0 = island centre). rot is in quarter turns; house fronts face +z.
// Island: x, z world position, top = height of the ground, radius = rough size, roughness = how wobbly the outline is.
// Paint: { kind: "path", points: [[x, z], ...], width } | { kind: "plaza", x, z, r } (see src/render/islandMesh.js)
const STRAW_HUT = { roof: "#c89a58", wall: "#f3e4c2", pillar: "#8a5a32" };
const RED_ROOF = { roof: "#d8603a" }, TEAL_ROOF = { roof: "#2a9a90" }, BLUE_ROOF = { roof: "#3a6ad0" }, PURPLE_ROOF = { roof: "#7a4ab0" };

const tree = (island, model, x, z) => ({ island, model, x, z });
const fenceRun = (island, x0, z0, count, axis) => Array.from({ length: count }, (_, i) => (
  axis === "x" ? { island, model: "fence", x: x0 + i * 20, z: z0 } : { island, model: "fence", x: x0, z: z0 + i * 20, rot: 1 }
));

export default {
  id: "main",
  name: "The Mist Isles",
  spawn: { island: "home", x: -24, z: 12, yaw: 2.75 },   // on the path, looking at the hut and the farm

  islands: [
    { id: "home", name: "Hearth Isle", x: 0, z: 0, top: 330, radius: 165, roughness: 0.22,
      paint: [
        { kind: "plaza", x: -36, z: -30, r: 18 },
        { kind: "path", points: [[-36, -30], [-22, 10], [-16, 62]], width: 7 },
        { kind: "path", points: [[-36, -30], [8, -22], [30, -22]], width: 6 },
      ],
      mounds: [{ x: 95, z: 80, r: 55, h: 7 }, { x: -110, z: 40, r: 40, h: 5 }] },
    { id: "market", name: "Lantern Market", x: 800, z: -220, top: 360, radius: 200, roughness: 0.2,
      paint: [{ kind: "plaza", x: 0, z: 0, r: 88 }, { kind: "path", points: [[0, 70], [-14, 138]], width: 9 }] },
    { id: "pagoda", name: "Pagoda Spire", x: 220, z: -780, top: 540, radius: 88, roughness: 0.14, flare: 0.14,
      paint: [{ kind: "plaza", x: 0, z: 0, r: 40 }] },
    { id: "pine", name: "Lone Pine", x: -500, z: -430, top: 280, radius: 62, roughness: 0.3, flare: 0.3 },
    { id: "manor", name: "Manor Terrace", x: -930, z: 170, top: 350, radius: 175, roughness: 0.26,
      paint: [{ kind: "path", points: [[0, 30], [0, 120]], width: 8 }] },
    { id: "bamboo", name: "Bamboo Shelf", x: -430, z: 650, top: 420, radius: 115, roughness: 0.32 },
    { id: "station_low", name: "Lower Station", x: 430, z: 1180, top: 340, radius: 100, roughness: 0.18,
      paint: [{ kind: "path", points: [[0, 30], [10, 80]], width: 7 }] },
    { id: "station_high", name: "Upper Station", x: 430, z: 700, top: 490, radius: 105, roughness: 0.18 },
    { id: "orchard", name: "Orchard Rise", x: 1040, z: 420, top: 300, radius: 140, roughness: 0.3,
      mounds: [{ x: 30, z: 30, r: 70, h: 9 }] },
    { id: "palace", name: "Hall of Clouds", x: -1000, z: -860, top: 400, radius: 240, roughness: 0.12, flare: 0.16,
      paint: [{ kind: "plaza", x: 0, z: 150, r: 62 }, { kind: "path", points: [[0, 110], [0, 215]], width: 16 }] },
  ],

  // Crops on tilled soil. crop: cabbage | wheat
  fields: [
    { island: "home", x: 62, z: -40, w: 74, d: 34, crop: "cabbage" },
    { island: "home", x: 62, z: 4, w: 74, d: 34, crop: "wheat" },
    { island: "orchard", x: -62, z: -20, w: 52, d: 72, crop: "wheat" },
  ],

  ships: [
    { id: "skiff", name: "Sparrow", island: "home", x: -16, z: 80, yaw: 1.2, colors: { cloth: "#e8583e", roof: "#2a8aa0" } },
    { id: "kite", name: "Red Kite", island: "market", x: -18, z: 150, yaw: -2.2, colors: { cloth: "#3a8ad0", roof: "#d8b040" } },
  ],

  props: [
    // ---- Hearth Isle: your hut and your little farm
    { island: "home", model: "home1", x: -44, z: -54, colors: STRAW_HUT },
    { island: "home", model: "well", x: -82, z: -14 },
    { island: "home", model: "jars", x: -76, z: -44 },
    { island: "home", model: "crates", x: -12, z: -60 },
    { island: "home", model: "haystack", x: 112, z: -60 },
    { island: "home", model: "haystack", x: 118, z: -44 },
    { island: "home", model: "barrow", x: 18, z: -48, rot: 1 },
    { island: "home", model: "scarecrow", x: 62, z: 4 },
    ...fenceRun("home", 26, -62, 4, "x"),
    ...fenceRun("home", 34, 26, 3, "x"),
    ...fenceRun("home", 106, -52, 4, "z"),
    { island: "home", model: "landing_pad", x: -16, z: 80 },
    { island: "home", model: "mooring_mast", x: 34, z: 92 },
    { island: "home", model: "lantern_post", x: -28, z: 48 },
    { island: "home", model: "lantern_post", x: 4, z: 48 },
    tree("home", "tree_blossom", -96, -56), tree("home", "tree_blossom", -60, 34), tree("home", "tree_fruit", 16, 22),
    tree("home", "tree_fruit", -112, 18), tree("home", "tree_round", 92, 76), tree("home", "tree_round", 104, 50),
    tree("home", "bamboo", -28, -92), tree("home", "bamboo", -58, -96), tree("home", "tree_pine", 96, 106), tree("home", "tree_pine", -92, 74),

    // ---- Lantern Market: stalls round a paved square
    { island: "market", model: "stall", x: -50, z: -38, colors: RED_ROOF },
    { island: "market", model: "stall", x: 0, z: -48, colors: TEAL_ROOF },
    { island: "market", model: "stall", x: 50, z: -38, colors: BLUE_ROOF },
    { island: "market", model: "stall", x: -62, z: 30, rot: 1, colors: PURPLE_ROOF },
    { island: "market", model: "stall", x: 62, z: 30, rot: 3, colors: RED_ROOF },
    { island: "market", model: "teahouse", x: -116, z: -66, colors: TEAL_ROOF },
    { island: "market", model: "inn", x: 110, z: -82, colors: RED_ROOF },
    { island: "market", model: "shop", x: 0, z: -112, colors: BLUE_ROOF },
    { island: "market", model: "shop", x: 118, z: 50, rot: 3, colors: PURPLE_ROOF },
    { island: "market", model: "dragon_statue", x: 0, z: 8 },
    ...[[-34, 40], [34, 40], [-80, -8], [80, -8]].map(([x, z]) => ({ island: "market", model: "lantern_post", x, z })),
    { island: "market", model: "crates", x: -30, z: -62 }, { island: "market", model: "jars", x: 30, z: -66 },
    tree("market", "tree_camphor", -128, 66), tree("market", "tree_blossom", 76, 112), tree("market", "tree_blossom", 104, 94),
    { island: "market", model: "landing_pad", x: -18, z: 150 },

    // ---- Pagoda Spire: tall, narrow, one landmark
    { island: "pagoda", model: "pagoda", x: 0, z: -8, colors: RED_ROOF },
    { island: "pagoda", model: "incense_burner", x: 0, z: 34 },
    { island: "pagoda", model: "lion_statue", x: -30, z: 36 }, { island: "pagoda", model: "lion_statue", x: 30, z: 36 },
    tree("pagoda", "tree_pine", -48, -22), tree("pagoda", "tree_pine", 46, -30),

    // ---- Lone Pine: barely room to land
    { island: "pine", model: "tree_ginkgo", x: -14, z: -14 },
    { island: "pine", model: "jars", x: 22, z: -18 },

    // ---- Manor Terrace: a quiet walled house and gardens
    { island: "manor", model: "manor", x: 0, z: -20, colors: PURPLE_ROOF },
    { island: "manor", model: "garden_pond", x: -80, z: 30 },
    { island: "manor", model: "garden_flower", x: 76, z: 34 },
    { island: "manor", model: "home2", x: 92, z: -56, colors: BLUE_ROOF },
    { island: "manor", model: "lantern_post", x: -12, z: 60 }, { island: "manor", model: "lantern_post", x: 12, z: 60 },
    tree("manor", "tree_blossom", -60, -60), tree("manor", "tree_blossom", -86, -26), tree("manor", "tree_camphor", -40, 96), tree("manor", "tree_round", 42, 100),

    // ---- Bamboo Shelf
    ...[[-46, -30], [-32, -52], [-12, -62], [14, -58], [40, -42], [54, -14], [-60, 8], [-50, 34], [48, 22], [26, 46], [-22, 52]].map(([x, z]) => tree("bamboo", "bamboo", x, z)),
    { island: "bamboo", model: "tree_ginkgo", x: 0, z: -10 },
    { island: "bamboo", model: "incense_burner", x: 2, z: 26 },

    // ---- The gondola line: Lower Station → Upper Station
    { island: "station_low", model: "gondola_station_low", x: 0, z: 0, rot: 1, colors: RED_ROOF },
    { island: "station_low", model: "crates", x: 40, z: 36 },
    tree("station_low", "tree_round", -46, 46), tree("station_low", "tree_pine", 48, 60),
    { island: "station_high", model: "gondola_station_high", x: 0, z: 0, rot: 1, colors: RED_ROOF },
    { island: "station_high", model: "lantern_post", x: 22, z: 44 }, { island: "station_high", model: "lantern_post", x: -22, z: 44 },
    tree("station_high", "tree_pine", -52, 30), tree("station_high", "tree_pine", 54, 22), tree("station_high", "tree_blossom", 40, 62),

    // ---- Orchard Rise
    ...[[10, -60], [40, -66], [72, -50], [18, -26], [50, -24], [84, -14], [14, 14], [48, 12], [82, 30], [16, 54], [50, 56]].map(([x, z], i) => tree("orchard", i % 3 === 2 ? "tree_blossom" : "tree_fruit", x, z)),
    { island: "orchard", model: "home1", x: -60, z: 62, rot: 1, colors: STRAW_HUT },
    { island: "orchard", model: "oxcart", x: -18, z: 86 },
    { island: "orchard", model: "scarecrow", x: -62, z: -20 },
    { island: "orchard", model: "haystack", x: -96, z: 24 },

    // ---- Hall of Clouds: the great hall, for scale
    { island: "palace", model: "palace_great_hall", x: 0, z: -44, colors: { roof: "#e0a830" } },
    { island: "palace", model: "lion_statue", x: -30, z: 118 }, { island: "palace", model: "lion_statue", x: 30, z: 118 },
    { island: "palace", model: "dragon_statue", x: -58, z: 160 }, { island: "palace", model: "dragon_statue", x: 58, z: 160 },
    { island: "palace", model: "incense_burner", x: 0, z: 150 },
    tree("palace", "tree_pine", -150, 90), tree("palace", "tree_pine", 150, 90), tree("palace", "tree_ginkgo", -130, 140), tree("palace", "tree_ginkgo", 130, 140),
  ],

  critters: [
    { island: "home", x: 6, z: 2, animal: "chicken", variant: 0 }, { island: "home", x: 2, z: 8, animal: "chicken", variant: 0 }, { island: "home", x: 10, z: 10, animal: "chicken", variant: 0 },
    { island: "home", x: -66, z: -16, animal: "cat", variant: 0, range: 14 },
    { island: "home", x: -48, z: 22, animal: "dog", variant: 0, range: 40 },
    { island: "market", x: -24, z: 20, person: "merchant", range: 50 }, { island: "market", x: 28, z: 16, person: "lady", range: 60 }, { island: "market", x: 8, z: 56, person: "scholar", range: 50 },
    { island: "market", x: -42, z: -22, person: "merchant", range: 0, yaw: 0 }, { island: "market", x: 0, z: -34, person: "merchant", range: 0, yaw: 0 }, { island: "market", x: 44, z: -22, person: "lady", range: 0, yaw: 0 },
    { island: "market", x: -60, z: 10, person: "porter", range: 70 }, { island: "market", x: 20, z: -14, animal: "dog", variant: 1, range: 40 },
    { island: "pagoda", x: 8, z: 22, person: "monk", range: 14 },
    { island: "manor", x: 0, z: 30, person: "official", range: 30 }, { island: "manor", x: -60, z: 60, person: "lady", range: 40 }, { island: "manor", x: 30, z: 20, animal: "cat", variant: 2, range: 24 },
    { island: "bamboo", x: 10, z: 36, person: "daoist", range: 12 },
    { island: "orchard", x: -20, z: 40, animal: "cow", variant: "spotted", range: 24 }, { island: "orchard", x: 30, z: 80, animal: "sheep", variant: 0 }, { island: "orchard", x: -30, z: 10, person: "farmer", range: 40 },
    { island: "station_low", x: 16, z: 40, person: "porter", range: 30 },
    { island: "station_high", x: -8, z: 40, person: "kid", range: 34 },
    { island: "palace", x: 16, z: 130, person: "soldier", range: 0, yaw: 0 }, { island: "palace", x: -16, z: 130, person: "soldier", range: 0, yaw: 0 }, { island: "palace", x: 24, z: 176, person: "official", range: 50 },
  ],

  // Visible from the home island: rope, two stations, one car shuttling
  gondolas: [{ low: "station_low", high: "station_high", period: 44 }],

  // Scenery traffic: circles the sky and never touches the player
  balloons: [
    { model: "airship_small", x: 300, z: -300, y: 620, radius: 420, speed: 0.05, phase: 0.5 },
    { model: "airship_small", x: -600, z: 300, y: 560, radius: 360, speed: -0.04, phase: 2.2, colors: { cloth: "#e04a3a" } },
    { model: "airship_small", x: 700, z: 700, y: 680, radius: 300, speed: 0.06, phase: 4.1 },
    { model: "airship_cargo", x: -200, z: -200, y: 700, radius: 1050, speed: 0.022, phase: 1.1 },
    { model: "airship_cargo", x: 200, z: 300, y: 590, radius: 1400, speed: -0.016, phase: 3.7 },
  ],

  // Named cameras: game.view("home"), `bun run shot -- --views home`. Position, target, in world coordinates.
  views: {
    overview: [[-100, 1400, 2500], [-100, 330, 100]],
    home: [[-70, 420, 230], [10, 330, -5]],
    farm: [[30, 372, 90], [66, 330, -22]],
    hut: [[-44, 352, 16], [-44, 340, -40]],
    cliff: [[260, 400, 200], [60, 240, 40]],
    mist: [[420, 250, 420], [0, 140, 0]],
    market: [[820, 490, 90], [800, 360, -240]],
    pagoda: [[350, 610, -570], [220, 560, -780]],
    palace: [[-880, 560, -420], [-1000, 440, -880]],
    gondola: [[720, 520, 950], [430, 400, 940]],
  },
};
