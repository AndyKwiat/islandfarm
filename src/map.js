// The minimap (always on, bottom right) and the map screen (M). Both show the whole world, always: no fog of war.
// Drawn in 2D on canvases, painted like an old parchment chart. The islands are drawn once; only the markers move.
import { mapView, mapHeading, placeLabels } from "./game/mapView.js";

const INK = "#4a3a28", PARCHMENT = "#efe3c4", LAND = "#8fb56a", LAND_DARK = "#6d8f4e", RIM = "#6a5a44", ROPE = "#7a3a24", HOME = "#d8342a", YOU = "#d8342a", SHIP = "#2a6a9a";
const FONT = "'Fredoka', ui-rounded, system-ui, sans-serif";

function makeCanvas(el, size) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  el.width = el.height = Math.round(size * dpr); el.style.width = el.style.height = size + "px";
  const g = el.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

/** The parts that never change: paper, islands, gondola lines, names. Returned as a canvas to blit each frame. */
function paintBase(world, view, { labels }) {
  const c = document.createElement("canvas"), g = makeCanvas(c, view.size), { size } = view;
  g.fillStyle = PARCHMENT; g.fillRect(0, 0, size, size);
  // faint mist bands on the paper
  g.strokeStyle = "rgba(120,100,70,0.11)"; g.lineWidth = 1;
  for (let y = size * 0.08; y < size; y += size * 0.085) { g.beginPath(); for (let x = 0; x <= size; x += 6) { const w = y + Math.sin(x * (34 / size) + y) * (size * 0.008); if (x) g.lineTo(x, w); else g.moveTo(x, w); } g.stroke(); }

  g.lineJoin = "round";
  for (const isl of world.islands) {
    const pts = view.outline(isl);
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    path(); g.save(); g.translate(0, Math.max(1, size * 0.003)); g.fillStyle = RIM; g.fill(); g.restore();   // a little depth under the land
    path(); g.fillStyle = LAND; g.fill(); g.strokeStyle = LAND_DARK; g.lineWidth = 1; g.stroke();
  }
  // drafts: gold rings with a lift mark for updrafts, blue with the mark turned down for downdrafts
  for (const d of world.drafts) {
    const [x, y] = view.toMap(d.x, d.z), r = Math.max(labels ? 5 : 2.2, d.r * view.scale), up = d.lift > 0;
    g.strokeStyle = up ? "#c88a20" : "#3a6a9a"; g.lineWidth = labels ? 1.6 : 1;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    if (labels) { const k = up ? -1 : 1; g.beginPath(); g.moveTo(x - r * 0.5, y - k * r * 0.25); g.lineTo(x, y + k * r * 0.45); g.lineTo(x + r * 0.5, y - k * r * 0.25); g.stroke(); }
  }
  // gondola lines
  g.strokeStyle = ROPE; g.lineWidth = labels ? 2 : 1.25; g.setLineDash(labels ? [5, 4] : [2.5, 2.5]);
  for (const line of world.gondolas) { const [ax, ay] = view.toMap(line.from[0], line.from[2]), [bx, by] = view.toMap(line.to[0], line.to[2]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
  g.setLineDash([]);
  if (labels) {
    g.font = `600 12px ${FONT}`; g.textAlign = "center"; g.textBaseline = "top";
    const north = world.gondolaIslands.map((pair) => pair.high);   // the northern island of a gondola pair: label above, clear of the rope
    for (const l of placeLabels(world, view, (t) => g.measureText(t).width, { north })) {
      g.lineWidth = 3; g.strokeStyle = PARCHMENT; g.strokeText(l.text, l.x, l.y); g.fillStyle = INK; g.fillText(l.text, l.x, l.y);
    }
  }
  return c;
}

/** An arrowhead at (x, y) pointing along the heading. */
function arrow(g, x, y, yaw, s, fill) {
  const [dx, dy] = mapHeading(yaw);
  g.save(); g.translate(x, y); g.rotate(Math.atan2(dy, dx));
  g.beginPath(); g.moveTo(s * 1.25, 0); g.lineTo(-s * 0.85, s * 0.8); g.lineTo(-s * 0.35, 0); g.lineTo(-s * 0.85, -s * 0.8); g.closePath();
  g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1, s * 0.28); g.strokeStyle = "#fff8e8"; g.stroke();
  g.restore();
}

export function createMap(game) {
  const { world, state } = game;
  const miniEl = document.getElementById("minimap-canvas"), bigEl = document.getElementById("map-canvas"), screen = document.getElementById("mapscreen");
  let mini, big, open = false;

  function layout() {
    const miniSize = 190, bigSize = Math.round(Math.max(280, Math.min(innerWidth - 80, innerHeight - 130, 680)));
    const mv = mapView(world, miniSize, { pad: 12, minRadius: 3 });
    const bv = mapView(world, bigSize, { pad: 34, minRadius: 7 });
    mini = { view: mv, g: makeCanvas(miniEl, miniSize), base: paintBase(world, mv, { labels: false }), markers: 5.5 };
    big = { view: bv, g: makeCanvas(bigEl, bigSize), base: paintBase(world, bv, { labels: true }), markers: 8 };
  }

  function draw(m, labelled) {
    const { g, view, base, markers: s } = m, { size } = view;
    g.clearRect(0, 0, size, size);
    g.drawImage(base, 0, 0, size, size);
    // home: a red seal on your island
    const home = world.islands.find((i) => i.id === "home") ?? world.byId[world.props[0]?.island];
    if (home) { const [x, y] = view.toMap(home.x, home.z), r = s * 0.42; g.fillStyle = HOME; g.fillRect(x - r, y - r, r * 2, r * 2); }
    // highlight where you are
    if (state.island && labelled) { g.strokeStyle = YOU; g.lineWidth = 2; const pts = view.outline(world.byId[state.island]); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke(); }
    // parked ships
    for (const sh of state.ships) {
      if (sh === game.riding()) continue;
      const [x, y] = view.toMap(sh.x, sh.z);
      g.beginPath(); g.ellipse(x, y, s * 0.8, s * 0.5, 0, 0, Math.PI * 2); g.fillStyle = SHIP; g.fill(); g.lineWidth = 1; g.strokeStyle = "#fff8e8"; g.stroke();
    }
    // you
    const me = game.riding() ?? state.player, [px, py] = view.toMap(me.x, me.z);
    arrow(g, px, py, me.yaw, s, YOU);
  }

  layout();
  addEventListener("resize", layout);

  return {
    /** Redraw whatever is showing. */
    update() { draw(mini, false); if (open) draw(big, true); },
    /** Open / close the map screen; returns whether it is open. */
    show(on) { open = !!on; screen.style.display = open ? "flex" : "none"; if (open) draw(big, true); return open; },
    toggle() { return this.show(!open); },
    get isOpen() { return open; },
    views: () => ({ mini: mini.view, big: big.view }),
  };
}
