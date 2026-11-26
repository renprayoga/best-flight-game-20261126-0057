// Keyboard + mouse. Arrows / WASD fly the plane, Shift/Ctrl work the
// throttle, mouse drag steers, wheel sets throttle, C swaps the camera,
// P pauses, R restarts, M mutes, 1/2/3 pick a mission on the title.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_RESET = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseDX = 0;
  let mouseDY = 0;
  let wheelDelta = 0;
  let missionKey = null;

  function code(e) {
    return e.code;
  }
  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(code(e));
    if (code(e) === 'Space' || code(e) === 'Enter') actions |= ACTION_CONFIRM;
    if (code(e) === 'KeyP' || code(e) === 'Escape') actions |= ACTION_PAUSE;
    if (code(e) === 'KeyC') actions |= ACTION_CAMERA;
    if (code(e) === 'KeyR') actions |= ACTION_RESET;
    if (code(e) === 'KeyM') actions |= ACTION_MUTE;
    if (code(e) === 'Digit1' || code(e) === 'Digit2' || code(e) === 'Digit3') {
      missionKey = code(e).slice(-1);
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code(e))) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(code(e));
  }
  function onMouseDown(e) {
    mouseDown = true;
    mouseDX = 0;
    mouseDY = 0;
    actions |= ACTION_CONFIRM;
    void e;
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onMouseMove(e) {
    if (!mouseDown) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
  function onWheel(e) {
    wheelDelta += e.deltaY;
    e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // The per-frame control vector the flight model reads.
  function direction() {
    const pitchUp = keys.has('ArrowDown') || keys.has('KeyS');
    const pitchDown = keys.has('ArrowUp') || keys.has('KeyW');
    const rollLeft = keys.has('ArrowLeft') || keys.has('KeyA');
    const rollRight = keys.has('ArrowRight') || keys.has('KeyD');
    const throttleUp = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const throttleDown = keys.has('ControlLeft') || keys.has('ControlRight');
    // Mouse drag: right = bank right, up = nose up (pull toward you).
    const rollAnalog = Math.max(-1, Math.min(1, mouseDX / 240));
    const pitchAnalog = Math.max(-1, Math.min(1, -mouseDY / 240));
    mouseDX *= 0.82;
    mouseDY *= 0.82;
    // Wheel nudges the throttle in steps (up = more throttle).
    let throttleNudge = 0;
    if (wheelDelta !== 0) {
      throttleNudge = wheelDelta < 0 ? 0.08 : -0.08;
      wheelDelta = 0;
    }
    return {
      pitchUp, pitchDown, rollLeft, rollRight,
      throttleUp, throttleDown,
      pitchAnalog, rollAnalog,
      throttleNudge,
    };
  }

  function takeActions() {
    const a = actions;
    actions = 0;
    return a;
  }
  function takeMissionKey() {
    const k = missionKey;
    missionKey = null;
    return k;
  }

  return { direction, takeActions, takeMissionKey };
}
