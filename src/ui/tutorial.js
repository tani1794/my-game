import './tutorial.css';

export const TUTORIAL_TEXT = {
  move: 'スティックで移動',
  attack: '攻撃ボタンで斬る（3回まで続けて出せる）',
  dodge: 'オレンジの予告が出たら、回避で逃げる',
  lock: 'ロックで結晶獣を捉え続ける',
};

export function createTutorial() {
  let enabled = false;
  let movingTime = 0;
  let telegraphWasActive = false;
  let completed = {};

  function start(nextEnabled) {
    enabled = Boolean(nextEnabled);
    movingTime = 0;
    telegraphWasActive = false;
    completed = {
      move: false,
      attack: false,
      dodge: false,
      lock: false,
    };
  }

  function update(dt, signals) {
    if (!enabled) return null;

    const current = signals ?? {};
    const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;

    if (!completed.move && current.moving) {
      movingTime += delta;
      if (movingTime >= 2) completed.move = true;
    }

    if (current.hit) completed.attack = true;
    if (current.lock) completed.lock = true;

    if (!completed.dodge) {
      if (telegraphWasActive && !current.telegraph) {
        completed.dodge = true;
      } else if (current.telegraph) {
        telegraphWasActive = true;
      }
    }

    if (current.telegraph && !completed.dodge) return 'dodge';
    if (!completed.move) return 'move';
    if (!completed.attack) return 'attack';
    if (!completed.lock) return 'lock';

    return null;
  }

  return { start, update };
}

export function createTutorialView(root) {
  const hint = document.createElement('div');
  hint.className = 'tutorial-hint';
  hint.hidden = true;
  root.appendChild(hint);

  let currentName = null;

  function show(name) {
    if (name === currentName) return;

    currentName = name;

    if (name === null) {
      hint.hidden = true;
      hint.classList.remove('is-entering');
      return;
    }

    hint.textContent = TUTORIAL_TEXT[name];
    hint.dataset.hint = name;
    hint.hidden = false;

    hint.classList.remove('is-entering');
    void hint.offsetWidth;
    hint.classList.add('is-entering');
  }

  return { show };
}
