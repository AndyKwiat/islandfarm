// The on-screen bits: controls help (changes with the mode), the "E" prompt, island name cards, flight readout.
const HELP = {
  walk: "<b>WASD</b> run · <b>Shift</b> sprint · <b>Space</b> jump · <b>Mouse</b> look · <b>Scroll</b> zoom · <b>M</b> map",
  fly: "<b>W/S</b> throttle · <b>A/D</b> turn · <b>Space</b> climb · <b>Shift</b> descend · <b>Mouse</b> look · <b>M</b> map",
};

export function createHud(game, statsText = () => "") {
  const el = (id) => document.getElementById(id);
  const help = el("help"), prompt = el("prompt"), card = el("card"), speed = el("speed"), statsEl = el("stats");
  let cardT = 0, nextEvent = 0, lastPrompt = "", lastHelp = "", fpsN = 0, fpsT = 0;
  const show = (text, secs = 3) => { card.textContent = text; card.style.opacity = 1; cardT = secs; };
  return {
    show,
    update(dt) {
      const { state, events } = game;
      for (; nextEvent < events.length; nextEvent++) {
        const e = events[nextEvent];
        if (e.type === "arrived") show(e.name);
        if (e.type === "entered_draft") show(e.kind === "up" ? "Updraft!" : "Downdraft!", 1.4);
        if (e.type === "cant_land") show(e.reason === "no ground below" ? "Nothing to land on down there" : "No clear spot to land");
      }
      if ((cardT -= dt) <= 0) card.style.opacity = 0;

      const mode = state.mode === "fly" ? "fly" : "walk";
      if (lastHelp !== mode) { help.innerHTML = HELP[mode]; lastHelp = mode; }
      const p = state.prompt?.text ?? "";
      if (p !== lastPrompt) { prompt.innerHTML = p ? `<kbd>E</kbd> ${p}` : ""; prompt.style.opacity = p ? 1 : 0; lastPrompt = p; }

      const s = game.riding();
      if (state.mode === "fly" && s) { speed.style.opacity = 1; const rate = Math.round(s.climbRate / 10) * 10; speed.textContent = `${Math.round(Math.hypot(s.vx, s.vz))} kn · ${Math.round(s.y)} m ${rate > 15 ? "▲" : rate < -15 ? "▼" : "–"}`; }
      else speed.style.opacity = 0;

      fpsN++; fpsT += dt;
      if (fpsT > 1) { statsEl.textContent = `${Math.round(fpsN / fpsT)} fps · ${statsText()}`; fpsN = 0; fpsT = 0; }
    },
  };
}
