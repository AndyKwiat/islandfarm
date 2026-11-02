// The main world: thirty islands above the mist, a third of them big enough to hold a town (see BIG TOWNS at the bottom). Pure data: edit freely, `bun test` will tell you if a prop fell off.
// Prop and ship x/z are LOCAL to their island (0, 0 = island centre). rot is in quarter turns; house fronts face +z.
// Island: x, z world position, top = height of the ground, radius = rough size, roughness = how wobbly the outline is.
// Gondola lines run along the z axis: keep the two station islands of a pair close, directly north and south of each other.
// Paint: { kind: "path", points: [[x, z], ...], width } | { kind: "plaza", x, z, r } (see src/render/islandMesh.js)
import { addDistricts, hamlet, street, temple, estate, farm, garden, fort, grove, monument, dock } from "./districts.js";

const STRAW_HUT = { roof: "#c89a58", wall: "#f3e4c2", pillar: "#8a5a32" };
const RED_ROOF = { roof: "#d8603a" }, TEAL_ROOF = { roof: "#2a9a90" }, BLUE_ROOF = { roof: "#3a6ad0" }, PURPLE_ROOF = { roof: "#7a4ab0" };

// Named cameras relative to an island, so they survive moving it: [island, [x, y, z] from its centre and top, look-at likewise].
// The level compiler resolves these into world coordinates.
const VIEWS = {
  overview: [null, [0, 3600, 6200], [0, 330, 300]],     // absolute: pair with game.fx({ fogFar: 30000 })
  home: ["home", [-70, 90, 230], [10, 0, -5]],
  farm: ["home", [30, 42, 90], [66, 0, -22]],
  hut: ["home", [-44, 22, 16], [-44, 10, -40]],
  cliff: ["home", [260, 70, 200], [60, -90, 40]],
  mist: ["home", [420, -80, 420], [0, -190, 0]],
  market: ["market", [20, 130, 310], [0, 0, -20]],
  pagoda: ["pagoda", [130, 70, 210], [0, 20, 0]],
  palace: ["palace", [120, 160, 440], [0, 40, -20]],
  gondola: ["station_low", [290, 180, -230], [0, 60, -240]],
  gondola2: ["quarry_low", [290, 180, -230], [0, 60, -240]],
  sage: ["sage", [160, 60, 260], [0, 40, 0]],
  silk: ["silk", [120, 210, 620], [0, 0, 40]],
  kites: ["kites", [100, 170, 560], [0, 0, 0]],
  temple: ["temple", [140, 180, 560], [0, 20, 0]],
  market_town: ["market", [-210, 90, 330], [-210, 10, 170]],
  street: ["silk", [-120, 26, 8], [60, 12, 0]],
  steppe: ["steppe", [60, 180, 340], [0, 0, 0]],
  tea: ["tea", [80, 70, 200], [0, 10, 0]],
};

const tree = (island, model, x, z) => ({ island, model, x, z });
const fenceRun = (island, x0, z0, count, axis) => Array.from({ length: count }, (_, i) => (
  axis === "x" ? { island, model: "fence", x: x0 + i * 20, z: z0 } : { island, model: "fence", x: x0, z: z0 + i * 20, rot: 1 }
));

const level = {
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
    { id: "market", name: "Lantern Market", x: -408, z: -978, top: 360, radius: 420, roughness: 0.2,
      paint: [{ kind: "plaza", x: 0, z: 0, r: 88 }, { kind: "path", points: [[0, 70], [-14, 138]], width: 9 }] },
    { id: "pagoda", name: "Pagoda Spire", x: 340, z: -470, top: 540, radius: 88, roughness: 0.14, flare: 0.14,
      paint: [{ kind: "plaza", x: 0, z: 0, r: 40 }] },
    { id: "pine", name: "Lone Pine", x: 165, z: 518, top: 280, radius: 62, roughness: 0.3, flare: 0.3 },
    { id: "manor", name: "Manor Terrace", x: -885, z: 514, top: 350, radius: 400, roughness: 0.26,
      paint: [{ kind: "path", points: [[0, 30], [0, 120]], width: 8 }] },
    { id: "bamboo", name: "Bamboo Shelf", x: 875, z: -554, top: 420, radius: 115, roughness: 0.32 },
    { id: "station_low", name: "Lower Station", x: 663, z: 465, top: 340, radius: 100, roughness: 0.18,
      paint: [{ kind: "path", points: [[0, 30], [10, 80]], width: 7 }] },
    { id: "station_high", name: "Upper Station", x: 663, z: -15, top: 490, radius: 105, roughness: 0.18 },
    { id: "orchard", name: "Orchard Rise", x: 45, z: 1335, top: 300, radius: 340, roughness: 0.3,
      mounds: [{ x: 30, z: 30, r: 70, h: 9 }] },
    { id: "palace", name: "Hall of Clouds", x: 1632, z: 112, top: 400, radius: 480, roughness: 0.12, flare: 0.16,
      paint: [{ kind: "plaza", x: 0, z: 150, r: 62 }, { kind: "path", points: [[0, 110], [0, 215]], width: 16 }] },
    { id: "tea", name: "Tea Terraces", x: -1617, z: -511, top: 380, radius: 350, roughness: 0.24,
      paint: [{ kind: "plaza", x: 0, z: 14, r: 44 }, { kind: "path", points: [[0, 50], [10, 118]], width: 7 }] },
    { id: "shrine", name: "Cloud Shrine", x: 507, z: -958, top: 600, radius: 75, roughness: 0.16, flare: 0.13,
      paint: [{ kind: "plaza", x: 0, z: 8, r: 30 }] },
    { id: "watch", name: "Watch Rock", x: 943, z: 980, top: 460, radius: 110, roughness: 0.2,
      paint: [{ kind: "path", points: [[0, 10], [0, 92]], width: 10 }] },
    { id: "goat", name: "Goat Crag", x: 969, z: -1054, top: 300, radius: 72, roughness: 0.32, flare: 0.3 },
    { id: "steppe", name: "Wheat Steppe", x: -1141, z: 1853, top: 330, radius: 470, roughness: 0.2,
      paint: [{ kind: "path", points: [[-120, 94], [0, 92], [110, 88]], width: 8 }] },
    { id: "blossom", name: "Blossom Hollow", x: 1544, z: -955, top: 430, radius: 125, roughness: 0.28,
      paint: [{ kind: "path", points: [[0, 20], [-20, 92]], width: 6 }] },
    { id: "quarry_low", name: "Quarry Landing", x: 424, z: -1476, top: 350, radius: 100, roughness: 0.2,
      paint: [{ kind: "path", points: [[0, 30], [-14, 80]], width: 7 }] },
    { id: "summit_high", name: "Summit Gate", x: 424, z: -1956, top: 530, radius: 100, roughness: 0.16 },
    { id: "scholars", name: "Scholars' Rest", x: 1125, z: 1890, top: 370, radius: 380, roughness: 0.22,
      paint: [{ kind: "path", points: [[0, -10], [0, 130]], width: 9 }] },
    { id: "silk", name: "Silk Quarter", x: -1443, z: -1771, top: 370, radius: 430, roughness: 0.16, mounds: [{ x: -250, z: -210, r: 90, h: 10 }] },
    { id: "temple", name: "Temple Hill", x: -2352, z: 1011, top: 450, radius: 400, roughness: 0.18, flare: 0.17, mounds: [{ x: 240, z: 170, r: 100, h: 12 }] },
    { id: "kites", name: "Kite Harbor", x: 47, z: 2500, top: 340, radius: 360, roughness: 0.2 },
    { id: "moon", name: "Moon Islet", x: -858, z: -285, top: 560, radius: 48, roughness: 0.18, flare: 0.12 },
    { id: "heron", name: "Heron Rock", x: -1742, z: 303, top: 320, radius: 66, roughness: 0.3, flare: 0.26 },
    { id: "plum", name: "Plum Step", x: 983, z: -1583, top: 390, radius: 80, roughness: 0.24 },
    { id: "cricket", name: "Cricket Knoll", x: -57, z: -1815, top: 300, radius: 58, roughness: 0.28, mounds: [{ x: 0, z: 0, r: 34, h: 6 }] },
    { id: "perch", name: "Kite Perch", x: 1463, z: 1097, top: 470, radius: 70, roughness: 0.2, flare: 0.15 },
    { id: "beacon", name: "Beacon Rock", x: -501, z: -1858, top: 430, radius: 55, roughness: 0.2, flare: 0.16 },
    { id: "moss", name: "Mossy Stair", x: 1534, z: -1593, top: 360, radius: 90, roughness: 0.3 },
    { id: "sage", name: "Stone Sage", x: 2019, z: 1093, top: 520, radius: 130, roughness: 0.14, flare: 0.15,
      paint: [{ kind: "plaza", x: 0, z: 30, r: 56 }] },
  ],

  // Crops on tilled soil. crop: cabbage | wheat
  fields: [
    { island: "home", x: 62, z: -40, w: 74, d: 34, crop: "cabbage" },
    { island: "home", x: 62, z: 4, w: 74, d: 34, crop: "wheat" },
    { island: "orchard", x: -62, z: -20, w: 52, d: 72, crop: "wheat" },
    { island: "tea", x: 72, z: -52, w: 50, d: 38, crop: "cabbage" },
    { island: "steppe", x: -74, z: -58, w: 96, d: 66, crop: "wheat" },
    { island: "steppe", x: 52, z: -66, w: 76, d: 62, crop: "wheat" },
    { island: "steppe", x: -18, z: 34, w: 88, d: 38, crop: "cabbage" },
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

    // ---- Tea Terraces: a teahouse with a view
    { island: "tea", model: "teahouse", x: 0, z: -34, colors: TEAL_ROOF },
    { island: "tea", model: "stall", x: -32, z: 16, rot: 1, colors: RED_ROOF }, { island: "tea", model: "stall", x: 32, z: 16, rot: 3, colors: TEAL_ROOF },
    { island: "tea", model: "jars", x: -30, z: -44 }, { island: "tea", model: "lantern_post", x: -12, z: 66 }, { island: "tea", model: "lantern_post", x: 16, z: 66 },
    tree("tea", "tree_blossom", -74, -30), tree("tea", "tree_blossom", -84, 18), tree("tea", "tree_round", 78, 30),

    // ---- Cloud Shrine: the highest, smallest place to land
    { island: "shrine", model: "incense_burner", x: 0, z: 8 },
    { island: "shrine", model: "lion_statue", x: -22, z: -14 }, { island: "shrine", model: "lion_statue", x: 22, z: -14 },
    tree("shrine", "tree_pine", -34, 20), tree("shrine", "tree_pine", 34, 22),

    // ---- Watch Rock: an old lookout
    { island: "watch", model: "tower", x: 0, z: -34, colors: RED_ROOF },
    { island: "watch", model: "city_gate", x: 0, z: 42 },
    tree("watch", "tree_pine", -62, -8), tree("watch", "tree_pine", 60, -14), tree("watch", "tree_pine", -46, -50),

    // ---- Goat Crag: nothing much, nicely
    { island: "goat", model: "haystack", x: -18, z: -14 }, { island: "goat", model: "tree_pine", x: 24, z: -20 },

    // ---- Wheat Steppe: the big farm
    { island: "steppe", model: "home1", x: 120, z: 44, rot: 3, colors: STRAW_HUT },
    { island: "steppe", model: "home2", x: -130, z: 40, rot: 1, colors: STRAW_HUT },
    { island: "steppe", model: "well", x: 56, z: 66 }, { island: "steppe", model: "oxcart", x: -40, z: 120 },
    { island: "steppe", model: "scarecrow", x: -74, z: -58 }, { island: "steppe", model: "scarecrow", x: 52, z: -66 },
    { island: "steppe", model: "haystack", x: 112, z: -40 }, { island: "steppe", model: "haystack", x: 126, z: -22 }, { island: "steppe", model: "haystack", x: -146, z: -40 },
    { island: "steppe", model: "barrow", x: 34, z: 26 },
    tree("steppe", "tree_fruit", 60, 130), tree("steppe", "tree_fruit", 88, 118), tree("steppe", "tree_round", -110, 118),

    // ---- Blossom Hollow: gardens under pink trees
    { island: "blossom", model: "garden_flower", x: 0, z: -2 }, { island: "blossom", model: "garden_pond", x: -46, z: -36 },
    ...[[-66, 20], [-44, 48], [36, 44], [62, 16], [56, -30], [18, -56], [-84, -14], [-10, 66]].map(([x, z]) => tree("blossom", "tree_blossom", x, z)),

    // ---- The second gondola line: Quarry Landing → Summit Gate
    { island: "quarry_low", model: "gondola_station_low", x: 0, z: 0, rot: 1, colors: BLUE_ROOF },
    { island: "quarry_low", model: "crates", x: -44, z: 34 }, { island: "quarry_low", model: "crates", x: -52, z: 20 }, { island: "quarry_low", model: "barrow", x: 40, z: 40, rot: 1 },
    tree("quarry_low", "tree_pine", 48, 58), 
    { island: "summit_high", model: "gondola_station_high", x: 0, z: 0, rot: 1, colors: BLUE_ROOF },
    { island: "summit_high", model: "lantern_post", x: 20, z: 42 }, { island: "summit_high", model: "lantern_post", x: -20, z: 42 },
    tree("summit_high", "tree_pine", -54, 24), tree("summit_high", "tree_pine", 52, 28), tree("summit_high", "tree_ginkgo", 8, 58),

    // ---- Scholars' Rest: a quiet college
    { island: "scholars", model: "hall_house", x: 0, z: -50, colors: PURPLE_ROOF },
    { island: "scholars", model: "compound", x: 74, z: 44, colors: BLUE_ROOF },
    { island: "scholars", model: "manor", x: -78, z: 34, colors: TEAL_ROOF },
    { island: "scholars", model: "lantern_post", x: -12, z: 60 }, { island: "scholars", model: "lantern_post", x: 12, z: 60 },
    tree("scholars", "tree_ginkgo", -86, -52), tree("scholars", "tree_camphor", 84, -50), tree("scholars", "bamboo", -30, 100), tree("scholars", "bamboo", 32, 104),

    // ---- the small newcomers
    { island: "moon", model: "incense_burner", x: 0, z: -6 }, tree("moon", "tree_pine", 20, 14),
    tree("heron", "tree_pine", -20, -14), tree("heron", "tree_pine", 18, -22), { island: "heron", model: "jars", x: 12, z: 16 },
    tree("plum", "tree_blossom", -26, -20), tree("plum", "tree_blossom", 24, -24), tree("plum", "tree_fruit", 0, 26), { island: "plum", model: "well", x: -2, z: -6 },
    tree("cricket", "tree_round", -8, -14), { island: "cricket", model: "haystack", x: 18, z: 12 },
    { island: "perch", model: "mooring_mast", x: 0, z: -14 }, { island: "perch", model: "crates", x: 26, z: 18 },
    { island: "beacon", model: "lantern_post", x: 0, z: -10 }, { island: "beacon", model: "lantern_post", x: -14, z: 8 }, { island: "beacon", model: "lantern_post", x: 14, z: 8 }, tree("beacon", "tree_pine", 0, 22),
    tree("moss", "bamboo", -34, -24), tree("moss", "bamboo", -14, -40), tree("moss", "bamboo", 22, -36), tree("moss", "tree_camphor", 8, 8), { island: "moss", model: "lion_statue", x: -36, z: 24 },

    // ---- Stone Sage: visible from a long way off
    { island: "sage", model: "statue", x: 0, z: -34 },
    { island: "sage", model: "incense_burner", x: -26, z: 34 }, { island: "sage", model: "incense_burner", x: 26, z: 34 },
    { island: "sage", model: "lion_statue", x: -40, z: 66 }, { island: "sage", model: "lion_statue", x: 40, z: 66 },
    tree("sage", "tree_pine", -78, -20), tree("sage", "tree_pine", 78, -24), tree("sage", "tree_blossom", -70, 40), tree("sage", "tree_blossom", 70, 44),
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
    { island: "tea", x: -14, z: 24, person: "lady", range: 40 }, { island: "tea", x: 14, z: 30, person: "merchant", range: 34 }, { island: "tea", x: 30, z: 60, animal: "cat", variant: 0, range: 20 },
    { island: "shrine", x: 10, z: 26, person: "monk", range: 12 },
    { island: "watch", x: -12, z: 8, person: "soldier", range: 0, yaw: 0 }, { island: "watch", x: 12, z: 8, person: "soldier", range: 0, yaw: 0 },
    { island: "goat", x: 0, z: 12, animal: "sheep", variant: 0, range: 18 }, { island: "goat", x: 12, z: 22, animal: "sheep", variant: 0, range: 18 }, { island: "goat", x: -14, z: 18, animal: "sheep", variant: 0, range: 18 },
    { island: "steppe", x: -20, z: 76, person: "farmer", range: 60 }, { island: "steppe", x: 80, z: 20, person: "farmer", range: 40 }, { island: "steppe", x: -100, z: 90, animal: "cow", variant: "spotted", range: 30 }, { island: "steppe", x: 20, z: 110, animal: "chicken", variant: 0, range: 24 }, { island: "steppe", x: 30, z: 104, animal: "chicken", variant: 0, range: 24 },
    { island: "blossom", x: 8, z: 40, person: "lady", range: 34 }, { island: "blossom", x: -10, z: 30, animal: "cat", variant: 2, range: 24 },
    { island: "quarry_low", x: 22, z: 42, person: "porter", range: 30 },
    { island: "summit_high", x: 0, z: 40, person: "daoist", range: 22 },
    { island: "scholars", x: 0, z: 30, person: "scholar", range: 50 }, { island: "scholars", x: -20, z: 70, person: "scholar", range: 30 },
    { island: "sage", x: 12, z: 40, person: "monk", range: 30 },
    { island: "moon", x: -12, z: 16, person: "daoist", range: 10 },
    { island: "heron", x: -8, z: 18, animal: "cat", variant: 0, range: 12 },
    { island: "plum", x: 10, z: 8, person: "kid", range: 22 },
    { island: "cricket", x: -14, z: 14, animal: "sheep", variant: 0, range: 12 },
    { island: "perch", x: -20, z: 20, person: "porter", range: 14 },
    { island: "palace", x: 16, z: 130, person: "soldier", range: 0, yaw: 0 }, { island: "palace", x: -16, z: 130, person: "soldier", range: 0, yaw: 0 }, { island: "palace", x: 24, z: 176, person: "official", range: 50 },
  ],

  // Visible from the home island: rope, two stations, one car shuttling
  gondolas: [
    { low: "station_low", high: "station_high", period: 44 },
    { low: "quarry_low", high: "summit_high", period: 52 },
  ],

  // Scenery traffic: circles the sky and never touches the player
  balloons: [
    { model: "airship_small", x: 300, z: -300, y: 660, radius: 700, speed: 0.04, phase: 0.5 },
    { model: "airship_small", x: -900, z: 500, y: 620, radius: 620, speed: -0.04, phase: 2.2, colors: { cloth: "#e04a3a" } },
    { model: "airship_small", x: 1000, z: 1000, y: 700, radius: 560, speed: 0.05, phase: 4.1 },
    { model: "airship_small", x: -1400, z: -1000, y: 680, radius: 600, speed: 0.045, phase: 1.4 },
    { model: "airship_small", x: 1300, z: -900, y: 720, radius: 620, speed: -0.04, phase: 5.2 },
    { model: "airship_cargo", x: -200, z: 100, y: 760, radius: 1900, speed: 0.02, phase: 1.1 },
    { model: "airship_cargo", x: 200, z: 300, y: 690, radius: 2500, speed: -0.015, phase: 3.7 },
    { model: "airship_cargo", x: 0, z: 0, y: 730, radius: 1100, speed: 0.03, phase: 5.9 },
  ],

  // Named cameras: game.view("home"), `bun run shot -- --views home`. See VIEWS at the top of this file.
  views: VIEWS,
};

// ---- BIG TOWNS: the bigger islands hold several districts each, out beyond whatever sits at their centre.
// Each line places one piece of src/levels/districts.js at a local position. Add, move and swap them freely.
export default addDistricts(level, [
  // Lantern Market grows into a real town
  street("market", -210, 170, { count: 3 }), street("market", 210, -220, { count: 3, people: ["merchant", "porter"] }), hamlet("market", 250, 130, { colors: { roof: "#d8603a" } }),
  temple("market", -240, -190, { colors: { roof: "#2a9a90" } }), grove("market", 40, 300, "tree_blossom"),
  // Manor Terrace: estates and gardens
  estate("manor", -190, -170), estate("manor", 190, 190, { colors: { roof: "#3a6ad0" } }), garden("manor", 210, -170), garden("manor", -210, 190), grove("manor", 10, -270, "tree_camphor"),
  // Orchard Rise: more orchard, more farm
  farm("orchard", -170, -180, { crops: ["cabbage", "wheat"] }), hamlet("orchard", 190, -170), grove("orchard", -165, 145, "tree_fruit"), grove("orchard", 170, 180, "tree_fruit"), grove("orchard", -20, 220, "tree_blossom"),
  // Hall of Clouds: the palace city around the hall
  fort("palace", 0, 300), estate("palace", -280, 120, { colors: { roof: "#e0a830" } }), estate("palace", 280, 120, { colors: { roof: "#e0a830" } }),
  garden("palace", -270, -190), garden("palace", 270, -190), monument("palace", 0, -270, "dragon_statue"),
  // Tea Terraces: gardens and small farms
  farm("tea", -190, 90, { crops: ["cabbage", "cabbage"] }), farm("tea", 145, 105, { crops: ["cabbage", "wheat"] }), garden("tea", -150, -170), hamlet("tea", 170, -130, { colors: { roof: "#2a9a90" } }),
  // Wheat Steppe: farms to the horizon, and a village
  farm("steppe", -280, -110), farm("steppe", 280, -130), farm("steppe", 240, 190, { crops: ["wheat", "wheat"] }), hamlet("steppe", -240, 210), hamlet("steppe", 20, 280, { people: ["farmer", "kid"] }), grove("steppe", 10, -290, "tree_round"),
  // Scholars' Rest: a college town
  street("scholars", -40, 210, { count: 3, people: ["scholar", "scholar", "official"] }), estate("scholars", 190, -170, { colors: { roof: "#7a4ab0" } }), temple("scholars", -190, -180, { colors: { roof: "#3a6ad0" } }), garden("scholars", 230, 140),
  // Silk Quarter: nothing but town
  street("silk", 0, 0, { count: 4 }), street("silk", 0, -170, { count: 3, people: ["merchant", "lady"] }), street("silk", 0, 170, { count: 3, people: ["lady", "merchant"] }),
  hamlet("silk", -250, 40, { colors: { roof: "#d8603a" } }), hamlet("silk", 250, 40, { colors: { roof: "#7a4ab0" } }), garden("silk", 210, -220), monument("silk", -220, 220, "dragon_statue"),
  // Temple Hill: temples, a great statue, quiet paths
  monument("temple", 0, 0), temple("temple", -210, -150), temple("temple", 210, -150, { colors: { roof: "#e0a830" } }), temple("temple", -180, 180, { colors: { roof: "#2a9a90" } }), hamlet("temple", 60, 230), grove("temple", 0, -240),
  // Kite Harbor: where airships come home
  dock("kites", -120, 150, { ship: { id: "swift", name: "Swift", yaw: 0.6, colors: { cloth: "#3aa060", roof: "#d8b040" } } }), dock("kites", 140, 170), dock("kites", 0, -220),
  street("kites", -40, -60, { count: 3, people: ["porter", "merchant"] }), fort("kites", 220, -60), hamlet("kites", -220, -90, { colors: { roof: "#2a9a90" } }),
]);
