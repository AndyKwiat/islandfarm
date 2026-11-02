// Keyboard and mouse → the game's input roles. Everything else in the game only knows roles (w, a, s, d, space, shift, e).
const KEYMAP = {
  KeyW: "w", ArrowUp: "w", KeyS: "s", ArrowDown: "s", KeyA: "a", ArrowLeft: "a", KeyD: "d", ArrowRight: "d",
  Space: "space", ShiftLeft: "shift", ShiftRight: "shift", KeyE: "e", Enter: "e",
};

export function createInput(canvas, rig) {
  const held = {};
  const blur = () => { for (const k of Object.keys(held)) held[k] = false; };
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = KEYMAP[e.code]; if (!k) return;
    held[k] = true; e.preventDefault();
  });
  addEventListener("keyup", (e) => { const k = KEYMAP[e.code]; if (k) held[k] = false; });
  addEventListener("blur", blur);

  // Mouse: click the canvas to capture the pointer (Esc releases it). Dragging works too, if capture isn't available.
  let dragging = false, lastX = 0, lastY = 0, downAt = null;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = [e.clientX, e.clientY]; });
  addEventListener("pointerup", (e) => {
    dragging = false;
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4 && document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
    downAt = null;
  });
  addEventListener("pointermove", (e) => {
    if (document.pointerLockElement === canvas) rig.look(e.movementX, e.movementY);
    else if (dragging) { rig.look(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; }
  });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); rig.zoom(e.deltaY); }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  return { held };
}
