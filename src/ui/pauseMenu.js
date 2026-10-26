import './pauseMenu.css';

const ACTIONS = [
  'pause',
  'resume',
  'retry',
  'title',
  'mute',
  'quality',
  'tutorial',
];

const QUALITY_TIERS = ['high', 'mid', 'low'];

export function createPauseMenu(root) {
  const pauseButton = document.createElement('button');
  pauseButton.className = 'pause-button';
  pauseButton.type = 'button';
  pauseButton.hidden = true;
  pauseButton.setAttribute('aria-label', '一時停止');
  pauseButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 5V19M16 5V19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    </svg>
  `;

  const pauseMenu = document.createElement('div');
  pauseMenu.className = 'pause-menu';
  pauseMenu.hidden = true;
  pauseMenu.setAttribute('role', 'dialog');
  pauseMenu.setAttribute('aria-modal', 'true');
  pauseMenu.setAttribute('aria-label', '一時停止メニュー');
  pauseMenu.innerHTML = `
    <div class="pause-panel">
      <div class="pause-title">一時停止</div>

      <button class="pause-resume" type="button" data-action="resume">
        続ける
      </button>

      <button type="button" data-action="retry">
        やり直す
      </button>

      <button type="button" data-action="title">
        タイトルへ
      </button>

      <button type="button" data-action="mute" aria-pressed="false">
        音 オン
      </button>

      <div class="pause-quality">
        <span class="pause-quality-label">画質</span>
        <button type="button" data-quality="high" aria-pressed="false">高</button>
        <button type="button" data-quality="mid" aria-pressed="false">中</button>
        <button type="button" data-quality="low" aria-pressed="false">低</button>
      </div>

      <button class="pause-tutorial" type="button" data-action="tutorial">
        遊び方をもう一度見る
      </button>
    </div>
  `;

  root.append(pauseButton, pauseMenu);

  const muteButton = pauseMenu.querySelector('[data-action="mute"]');
  const qualityButtons = Array.from(
    pauseMenu.querySelectorAll('[data-quality]'),
  );

  const callbacks = new Map(
    ACTIONS.map((action) => [action, []]),
  );

  function emit(action, ...args) {
    callbacks.get(action).slice().forEach((callback) => callback(...args));
  }

  pauseButton.addEventListener('click', () => {
    emit('pause');
  });

  pauseMenu.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      emit(button.dataset.action);
    });
  });

  qualityButtons.forEach((button) => {
    button.addEventListener('click', () => {
      emit('quality', button.dataset.quality);
    });
  });

  function setButtonVisible(visible) {
    pauseButton.hidden = !visible;
  }

  function setMuted(muted) {
    const isMuted = Boolean(muted);
    muteButton.textContent = isMuted ? '音 オフ' : '音 オン';
    muteButton.setAttribute('aria-pressed', String(isMuted));
  }

  function setQuality(tier) {
    qualityButtons.forEach((button) => {
      const selected = button.dataset.quality === tier;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function show({ muted, quality }) {
    setMuted(muted);
    setQuality(quality);
    pauseMenu.hidden = false;
  }

  function hide() {
    pauseMenu.hidden = true;
  }

  function on(action, callback) {
    if (!callbacks.has(action)) {
      throw new RangeError(`Unknown pause menu action: ${action}`);
    }
    if (typeof callback !== 'function') {
      throw new TypeError('Pause menu callback must be a function');
    }

    callbacks.get(action).push(callback);
  }

  return {
    setButtonVisible,
    show,
    hide,
    setMuted,
    setQuality,
    on,
  };
}
