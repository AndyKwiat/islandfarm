// What each prop model means to the game: its collision shape and how far around it the ground is levelled.
// Rendering looks the model up by the same name in src/engine/models.js (or src/render/customModels.js).
//
//   box: [x0, x1, z0, z1]   collision rectangle in model space (rotates with the prop)
//   r: radius               collision circle (trees, posts); omit both for props you can walk through
//   h: height               colliders stop the camera and the airship below this height
//   flat: radius            ground is levelled inside this radius so the model sits flush
//
// Adding a prop to a level? Add it here too: `bun test` fails for a model with no entry.
export const PROPS = {
  // buildings
  home1: { box: [-15, 15, -10, 13], h: 25, flat: 26 },
  home2: { box: [-15, 15, -10, 13], h: 30, flat: 26 },
  shop: { box: [-15, 15, -10, 13], h: 25, flat: 26 },
  inn: { box: [-15, 15, -10, 13], h: 32, flat: 28 },
  manor: { box: [-17, 17, -13, 13], h: 19, flat: 28 },
  hall_house: { box: [-24, 24, -17, 13], h: 39, flat: 36 },
  compound: { box: [-30, 30, -20, 16], h: 22, flat: 42 },
  teahouse: { box: [-10, 13, -10, 13], h: 39, flat: 24 },
  pagoda: { box: [-15, 15, -15, 15], h: 62, flat: 30 },
  stall: { box: [-10, 10, -4, 4], h: 18, flat: 16 },
  tower: { box: [-14, 14, -14, 14], h: 59, flat: 28 },
  palace_great_hall: { box: [-95, 95, -70, 85], h: 190, flat: 125 },
  city_gate: { box: [-24, 24, -10, 14], h: 53, flat: 34 },
  // gardens and monuments
  garden_flower: { h: 2, flat: 24 },
  garden_pond: { box: [-14, 14, -10, 11], h: 3, flat: 24 },
  lion_statue: { box: [-7, 7, -9, 9], h: 24, flat: 14 },
  dragon_statue: { r: 9, h: 42, flat: 16 },
  incense_burner: { r: 6, h: 22, flat: 12 },
  statue: { box: [-22, 22, -19, 19], h: 95, flat: 34 },
  // trees: the trunk collides, the canopy does not
  tree_round: { r: 2, h: 19 },
  tree_fruit: { r: 2, h: 18 },
  tree_blossom: { r: 2, h: 18 },
  tree_pine: { r: 1.6, h: 20 },
  bamboo: { r: 2, h: 19 },
  tree_camphor: { r: 4.5, h: 46, flat: 14 },
  tree_ginkgo: { r: 4, h: 47, flat: 14 },
  // small things
  lantern_post: { r: 1, h: 13 },
  well: { r: 5, h: 16, flat: 10 },
  haystack: { r: 5.5, h: 9 },
  jars: { r: 4.5, h: 5 },
  crates: { r: 4.5, h: 9 },
  target: { r: 3, h: 12 },
  oxcart: { box: [-13, 15, -6, 6], h: 12, flat: 16 },
  barrow: { box: [-9, 5, -3, 3], h: 10 },
  rickshaw: { box: [-6, 9, -5, 5], h: 15 },
  // transport furniture
  mooring_mast: { box: [-7, 7, -7, 7], h: 47, flat: 12 },
  gondola_station_low: { box: [-20, 32, -19, 19], h: 37, flat: 40 },
  gondola_station_high: { box: [-23, 19, -9, 12], h: 24, flat: 28 },
  // from src/render/customModels.js
  fence: { box: [-10, 10, -0.6, 0.6], h: 3 },
  scarecrow: { r: 1.2, h: 13 },
  landing_pad: { flat: 26 },
};
