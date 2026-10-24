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

// キーボードとスティックの入力を足し、斜めでも速くならないよう長さを1で頭打ちにする
export function combineMove(keyboard, stick) {
  const x = keyboard.x + stick.x;
  const z = keyboard.z + stick.z;
  const length = Math.hypot(x, z);
  if (length <= 1) return { x, z };
  return { x: x / length, z: z / length };
}

export function createInput() {
  const keys = new Set();
  const touches = new Map();
  const buttons = new Set();
  let stick = { x: 0, z: 0 };

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

  function setStick(value) {
    stick = value;
  }

  function read() {
    const move = combineMove(
      {
        x: Number(held('right')) - Number(held('left')),
        z: Number(held('up')) - Number(held('down')),
      },
      stick,
    );
    return { moveX: move.x, moveZ: move.z, run: held('run') };
  }

  function clear() {
    keys.clear();
    touches.clear();
    stick = { x: 0, z: 0 };
    buttons.forEach((button) => button.classList.remove('active'));
  }

  return { read, bindButton, setStick, clear };
}
