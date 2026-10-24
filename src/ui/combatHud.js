import './combatHud.css';

const DAMAGE_LIFETIME = 0.6;
const DAMAGE_DISTANCE = 30;
const MAX_DAMAGE_NUMBERS = 8;

function formatTime(timeSeconds) {
  const totalSeconds = Number.isFinite(timeSeconds)
    ? Math.max(0, Math.floor(timeSeconds))
    : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function createCombatHud(root) {
  const hud = document.createElement('div');
  hud.className = 'combat-hud';
  hud.innerHTML = `
    <div class="boss-bar" hidden>
      <div class="boss-bar-name">結晶獣</div>
      <div class="boss-bar-track">
        <div class="boss-bar-fill"></div>
      </div>
    </div>

    <div class="reticle" hidden></div>

    <div class="result" hidden>
      <div class="result-title"></div>
      <div class="result-time"></div>
      <button class="result-retry" type="button">もう一度</button>
    </div>
  `;
  root.appendChild(hud);

  const bossBar = hud.querySelector('.boss-bar');
  const bossBarFill = hud.querySelector('.boss-bar-fill');
  const reticle = hud.querySelector('.reticle');
  const result = hud.querySelector('.result');
  const resultTitle = hud.querySelector('.result-title');
  const resultTime = hud.querySelector('.result-time');
  const retryButton = hud.querySelector('.result-retry');

  const damageNumbers = [];
  const retryCallbacks = [];

  retryButton.addEventListener('click', () => {
    retryCallbacks.slice().forEach((callback) => callback());
  });

  function setBeastVisible(visible) {
    bossBar.hidden = !visible;
  }

  function setBeast(hpRatio, enraged) {
    const ratio = Number.isFinite(hpRatio)
      ? Math.min(1, Math.max(0, hpRatio))
      : 0;

    bossBarFill.style.width = `${ratio * 100}%`;
    bossBar.classList.toggle('enraged', Boolean(enraged));
  }

  function setReticle(point) {
    if (point === null) {
      reticle.hidden = true;
      return;
    }

    reticle.style.left = `${point.x}px`;
    reticle.style.top = `${point.y}px`;
    reticle.hidden = false;
  }

  function showDamage(point, value) {
    if (damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
      const oldest = damageNumbers.shift();
      oldest.element.remove();
    }

    const element = document.createElement('div');
    element.className = 'damage-number';
    element.textContent = String(value);
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    hud.appendChild(element);

    damageNumbers.push({
      element,
      age: 0,
      startY: point.y,
    });
  }

  function showResult(kind, timeSeconds) {
    const won = kind === 'won';

    resultTitle.textContent = won ? '討伐完了' : '力尽きた';
    resultTime.textContent = won ? `時間 ${formatTime(timeSeconds)}` : '';
    result.hidden = false;
  }

  function hideResult() {
    result.hidden = true;
  }

  function onRetry(callback) {
    retryCallbacks.push(callback);
  }

  function update(dt) {
    const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;

    for (let index = damageNumbers.length - 1; index >= 0; index -= 1) {
      const damage = damageNumbers[index];
      damage.age += delta;

      if (damage.age >= DAMAGE_LIFETIME) {
        damage.element.remove();
        damageNumbers.splice(index, 1);
        continue;
      }

      const progress = damage.age / DAMAGE_LIFETIME;
      damage.element.style.top =
        `${damage.startY - DAMAGE_DISTANCE * progress}px`;
      damage.element.style.opacity = String(1 - progress);
    }
  }

  function clear() {
    damageNumbers.forEach(({ element }) => element.remove());
    damageNumbers.length = 0;
    reticle.hidden = true;
    result.hidden = true;
  }

  return {
    setBeastVisible,
    setBeast,
    setReticle,
    showDamage,
    showResult,
    hideResult,
    onRetry,
    update,
    clear,
  };
}
