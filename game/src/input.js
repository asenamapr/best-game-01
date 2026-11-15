// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (start, pause, mute, restart, level-up picks) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice. The mouse
// position is tracked in logical playfield coordinates for optional aiming and for clicking
// level-up cards.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_PICK_1 = 16;
export const ACTION_PICK_2 = 32;
export const ACTION_PICK_3 = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const PICK_1 = new Set(['Digit1', 'Numpad1']);
const PICK_2 = new Set(['Digit2', 'Numpad2']);
const PICK_3 = new Set(['Digit3', 'Numpad3']);

export function createInput(canvas, toLogical) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  // Mouse in logical coordinates; `mouseActive` is true once the pointer has moved, so the
  // cannon only aims at the mouse after the player actually uses it.
  const mouse = { x: 640, y: 360, active: false, movedAt: 0 };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (PICK_1.has(event.code)) { if (!event.repeat) actions |= ACTION_PICK_1; }
    else if (PICK_2.has(event.code)) { if (!event.repeat) actions |= ACTION_PICK_2; }
    else if (PICK_3.has(event.code)) { if (!event.repeat) actions |= ACTION_PICK_3; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false; down = false; left = false; right = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const logical = toLogical(event.clientX, event.clientY);
    mouse.x = logical.x;
    mouse.y = logical.y;
    mouse.active = true;
    mouse.movedAt = performance.now();
  });
  canvas.addEventListener('pointerdown', (event) => {
    const logical = toLogical(event.clientX, event.clientY);
    mouse.x = logical.x;
    mouse.y = logical.y;
    mouse.active = true;
    mouse.movedAt = performance.now();
    actions |= ACTION_CONFIRM;
  });

  return {
    mouse,
    /** Normalised steering vector from the held movement keys. */
    direction() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
