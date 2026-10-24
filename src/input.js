// ── 入力：キーボードとタッチを合流 ──
const keyMap = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

export function createInput() {
  const keys = new Set();
  const touches = new Map();
  const buttons = new Set();

  window.addEventListener('keydown', (event) => {
    if (keyMap[event.code]) {
      event.preventDefault();
      keys.add(event.code);
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  function held(action) {
    return (
      [...keys].some((code) => keyMap[code] === action) ||
      [...touches.values()].some((value) => value === action)
    );
  }

  function bindButton(button, action) {
    buttons.add(button);

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touches.set(event.pointerId, action);
      button.classList.add('active');
    });

    const release = (event) => {
      touches.delete(event.pointerId);
      if (![...touches.values()].includes(action)) {
        button.classList.remove('active');
      }
    };

    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  function read() {
    return {
      moveX: Number(held('right')) - Number(held('left')),
      moveZ: Number(held('up')) - Number(held('down')),
      run: held('run'),
    };
  }

  function clear() {
    keys.clear();
    touches.clear();
    buttons.forEach((button) => button.classList.remove('active'));
  }

  return { read, bindButton, clear };
}
