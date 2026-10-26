import './storyHud.css';

const bookIcon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22z"/>
    <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22z"/>
  </svg>
`;

export function createStoryHud(root) {
  const hud = document.createElement('div');
  hud.className = 'story-hud';
  hud.hidden = true;
  hud.innerHTML = `
    <div class="story-objective" hidden aria-live="polite">
      <span class="story-objective-mark" aria-hidden="true">◆</span>
      <span class="story-objective-text"></span>
    </div>

    <div class="story-toast" hidden aria-live="polite"></div>

    <div class="story-subtitle" hidden aria-live="polite">
      <span class="story-speaker"></span>
      <span class="story-text"></span>
    </div>

    <button class="story-interact" type="button" hidden></button>

    <button
      class="story-log-button"
      type="button"
      aria-label="会話の履歴"
      aria-expanded="false"
    >${bookIcon}</button>

    <div
      class="story-log"
      role="dialog"
      aria-modal="false"
      aria-label="会話の履歴"
      hidden
    >
      <div class="story-log-title">会話の履歴</div>
      <button class="story-log-close" type="button">閉じる</button>
      <div class="story-log-entries"></div>
    </div>

    <div class="story-advance" hidden>
      <span class="story-advance-hint">タップで次へ ▸</span>
      <button class="story-skip" type="button" hidden>スキップ ▸▸</button>
    </div>

    <div class="story-chapter" hidden></div>
    <div class="story-fade" aria-hidden="true"></div>
  `;
  root.appendChild(hud);

  const objective = hud.querySelector('.story-objective');
  const objectiveText = hud.querySelector('.story-objective-text');
  const subtitle = hud.querySelector('.story-subtitle');
  const speakerElement = hud.querySelector('.story-speaker');
  const textElement = hud.querySelector('.story-text');
  const interactButton = hud.querySelector('.story-interact');
  const logButton = hud.querySelector('.story-log-button');
  const logPanel = hud.querySelector('.story-log');
  const logCloseButton = hud.querySelector('.story-log-close');
  const logEntries = hud.querySelector('.story-log-entries');
  const advanceLayer = hud.querySelector('.story-advance');
  const skipButton = hud.querySelector('.story-skip');
  const skipCallbacks = [];
  const fadeLayer = hud.querySelector('.story-fade');
  const chapter = hud.querySelector('.story-chapter');
  const toastElement = hud.querySelector('.story-toast');

  const history = [];
  const interactCallbacks = [];
  const advanceCallbacks = [];

  let toastTimerId = null;
  let finishCurrentChapter = null;

  function setVisible(on) {
    hud.hidden = !on;
  }

  function setObjective(text) {
    if (text === null) {
      objective.hidden = true;
      objective.classList.remove('is-changing');
      return;
    }

    const nextText = String(text);
    const changed = objectiveText.textContent !== nextText;

    objectiveText.textContent = nextText;
    objective.hidden = false;

    if (changed) {
      objective.classList.remove('is-changing');
      void objective.offsetWidth;
      objective.classList.add('is-changing');
    }
  }

  function renderLog() {
    const fragment = document.createDocumentFragment();

    history.forEach(({ speaker, text }) => {
      const line = document.createElement('div');
      line.className = 'story-log-line';

      const lineSpeaker = document.createElement('span');
      lineSpeaker.className = 'story-log-speaker';
      lineSpeaker.textContent = speaker;

      const lineText = document.createElement('span');
      lineText.className = 'story-log-text';
      lineText.textContent = text;

      line.append(lineSpeaker, lineText);
      fragment.appendChild(line);
    });

    logEntries.replaceChildren(fragment);
  }

  function say({ speaker, text }) {
    const entry = {
      speaker: String(speaker),
      text: String(text),
    };

    history.push(entry);
    speakerElement.textContent = entry.speaker;
    textElement.textContent = entry.text;
    subtitle.hidden = false;

    if (!logPanel.hidden) {
      renderLog();
      logEntries.scrollTop = logEntries.scrollHeight;
    }
  }

  function clearSubtitle() {
    subtitle.hidden = true;
  }

  function showInteract(label) {
    if (label === null) {
      interactButton.hidden = true;
      interactButton.textContent = '';
      return;
    }

    interactButton.textContent = String(label);
    interactButton.hidden = false;
  }

  function onInteract(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onInteract には関数を指定してください');
    }
    interactCallbacks.push(callback);
  }

  function setAdvance(on) {
    advanceLayer.hidden = !on;
  }

  function onAdvance(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onAdvance には関数を指定してください');
    }
    advanceCallbacks.push(callback);
  }

  function fade(color, seconds) {
    const numericSeconds = Number(seconds);
    const duration = Number.isFinite(numericSeconds)
      ? Math.max(0, numericSeconds)
      : 0;

    return new Promise((resolve) => {
      let finished = false;
      let timerId;

      const finish = () => {
        if (finished) return;
        finished = true;

        fadeLayer.removeEventListener('transitionend', handleTransitionEnd);
        clearTimeout(timerId);

        if (color === null && fadeLayer.style.opacity === '0') {
          fadeLayer.style.backgroundColor = 'transparent';
        }

        resolve();
      };

      const handleTransitionEnd = (event) => {
        if (
          event.target === fadeLayer
          && (!event.propertyName || event.propertyName === 'opacity')
        ) {
          finish();
        }
      };

      fadeLayer.addEventListener('transitionend', handleTransitionEnd);
      fadeLayer.style.transitionDuration = `${duration}s`;

      if (color === null) {
        fadeLayer.style.opacity = '0';
      } else {
        fadeLayer.style.backgroundColor = color === 'white' ? '#fff' : '#000';
        fadeLayer.style.opacity = '1';
      }

      timerId = setTimeout(finish, duration * 1000);
    });
  }

  function showChapterTitle(text, seconds = 3.2) {
    if (finishCurrentChapter) {
      finishCurrentChapter();
    }

    const numericSeconds = Number(seconds);
    const totalMs = Number.isFinite(numericSeconds)
      ? Math.max(0, numericSeconds * 1000)
      : 3200;
    const fadeOutAt = Math.max(0, totalMs - 800);

    return new Promise((resolve) => {
      let finished = false;
      let fadeOutTimerId;
      let finishTimerId;

      const finish = () => {
        if (finished) return;
        finished = true;

        clearTimeout(fadeOutTimerId);
        clearTimeout(finishTimerId);
        chapter.classList.remove('is-visible');
        chapter.hidden = true;

        if (finishCurrentChapter === finish) {
          finishCurrentChapter = null;
        }

        resolve();
      };

      finishCurrentChapter = finish;
      chapter.textContent = String(text);
      chapter.hidden = false;
      chapter.classList.remove('is-visible');
      void chapter.offsetWidth;
      chapter.classList.add('is-visible');

      fadeOutTimerId = setTimeout(() => {
        chapter.classList.remove('is-visible');
      }, fadeOutAt);

      finishTimerId = setTimeout(finish, totalMs);
    });
  }

  function toast(text) {
    clearTimeout(toastTimerId);

    toastElement.textContent = String(text);
    toastElement.hidden = false;
    toastElement.classList.remove('is-showing');
    void toastElement.offsetWidth;
    toastElement.classList.add('is-showing');

    toastTimerId = setTimeout(() => {
      toastElement.hidden = true;
      toastElement.classList.remove('is-showing');
    }, 2500);
  }

  function log() {
    return history.map((entry) => ({ ...entry }));
  }

  function clearLog() {
    history.length = 0;
    renderLog();
  }

  interactButton.addEventListener('click', (event) => {
    event.stopPropagation();
    [...interactCallbacks].forEach((callback) => callback());
  });

  // スキップは受け付け中の層の上のボタン。押しても「次へ」にはしない
  skipButton.addEventListener('pointerdown', (event) => event.stopPropagation());
  skipButton.addEventListener('click', (event) => {
    event.stopPropagation();
    skipCallbacks.slice().forEach((callback) => callback());
  });

  advanceLayer.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  advanceLayer.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    [...advanceCallbacks].forEach((callback) => callback());
  });

  logButton.addEventListener('click', (event) => {
    event.stopPropagation();

    const willOpen = logPanel.hidden;
    if (willOpen) {
      renderLog();
      logPanel.hidden = false;
      logEntries.scrollTop = logEntries.scrollHeight;
    } else {
      logPanel.hidden = true;
    }

    logButton.setAttribute('aria-expanded', String(willOpen));
  });

  logCloseButton.addEventListener('click', (event) => {
    event.stopPropagation();
    logPanel.hidden = true;
    logButton.setAttribute('aria-expanded', 'false');
  });

  logPanel.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  logPanel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  return {
    setSkip: (on) => { skipButton.hidden = !on; },
    onSkip: (callback) => { skipCallbacks.push(callback); },
    setVisible,
    setObjective,
    say,
    clearSubtitle,
    showInteract,
    onInteract,
    setAdvance,
    onAdvance,
    fade,
    showChapterTitle,
    toast,
    log,
    clearLog,
  };
}
