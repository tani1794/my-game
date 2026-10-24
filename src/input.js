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

// 押した瞬間だけ数える操作（攻撃・回避・ロック）
const tapKeyMap = {
  KeyJ: 'attack',
  KeyK: 'dodge',
  Space: 'dodge',
  KeyL: 'lock',
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
  const presses = new Set();
  let stick = { x: 0, z: 0 };

  window.addEventListener('keydown', (event) => {
    if (keyMap[event.code]) {
      event.preventDefault();
      keys.add(event.code);
    }
    if (tapKeyMap[event.code]) {
      event.preventDefault();
      // 押しっぱなしによる繰り返しは数えない
      if (!event.repeat) presses.add(tapKeyMap[event.code]);
    }
  });

  // 画面のボタン：押した瞬間に1回だけ記録する（見た目のへこみは hud.js 側）
  function bindTap(element, action) {
    element.addEventListener('pointerdown', () => presses.add(action));
  }

  // 前回から押されたものを返して、記録を空にする
  function takePresses() {
    const taken = new Set(presses);
    presses.clear();
    return taken;
  }

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
    presses.clear();
    buttons.forEach((button) => button.classList.remove('active'));
  }

  return { read, bindButton, bindTap, takePresses, setStick, clear };
}
