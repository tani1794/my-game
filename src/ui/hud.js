import '@fontsource/cinzel/latin-600.css';
import './hud.css';

// ── アイコン（線で描くSVG） ──
const icon = (body) => `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const icons = {
  sword: icon('<path d="M19 3l-9.5 9.5M19 3h2v2l-9.5 9.5M8 11l5 5M6.5 14.5l3 3M7 17l-3 3"/>'),
  run: icon('<circle cx="14" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2.5V22M6 11l3-3h4l3 4h3M11 15l1.5-7"/>'),
  dodge: icon('<circle cx="15" cy="4.5" r="1.8"/><path d="M9 21l3-6 3 2.5V22M8 11l2.5-3h4l3 4h3M12 15l1.5-7M2 9h4M1 13h4M3 17h3"/>'),
  crosshair: icon('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  speaker: icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  speakerOff: icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>'),
  emblem: icon('<path d="M12 2l9 10-9 10-9-10z"/><path d="M12 7l1.6 3.4L17 12l-3.4 1.6L12 17l-1.6-3.4L7 12l3.4-1.6z"/>'),
};

// 画面の上に重ねるUIを作る。戦闘はまだ無いので、攻撃・回避・ロックは押した見た目だけ
export function createHud(root) {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="status">
      <div class="portrait"><img src="/textures/portrait.png" alt=""></div>
      <div class="bars">
        <div class="name plate">YUTO</div>
        <div class="bar hp"><span style="width: 100%"></span></div>
        <div class="bar stamina"><span style="width: 100%"></span></div>
      </div>
    </div>

    <button class="mute" aria-label="音を消す">${icons.speaker}</button>

    <div class="quest-column">
      <div class="quest plate">${icons.emblem}<span>結晶獣の討伐</span><span class="count">0 / 1</span></div>
      <canvas class="minimap"></canvas>
    </div>

    <div class="stick-area"></div>
    <button class="round run">${icons.run}<span>走る</span></button>

    <button class="round attack">${icons.sword}<span>攻撃</span></button>
    <button class="round lock">${icons.crosshair}<span>ロック</span></button>
    <button class="round dodge">${icons.dodge}<span>回避</span></button>

    <div class="logo">OBLIVION ARENA</div>
    <div class="fps" hidden></div>
    <div class="notice rotate">横向きにしてください</div>
  `;
  root.appendChild(hud);

  const actionButtons = {
    attack: hud.querySelector('.attack'),
    dodge: hud.querySelector('.dodge'),
    lock: hud.querySelector('.lock'),
  };

  // 押したときにへこむだけ（第2段階で戦闘につなぐ）
  Object.values(actionButtons).forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add('active');
    });
    const release = () => button.classList.remove('active');
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  const fps = hud.querySelector('.fps');
  const hpBar = hud.querySelector('.bar.hp span');
  const staminaBar = hud.querySelector('.bar.stamina span');
  const questCount = hud.querySelector('.quest .count');

  // 体力とスタミナ（どちらも 0〜100）
  function setVitals(hp, stamina) {
    hpBar.style.width = `${Math.max(0, Math.min(100, hp))}%`;
    staminaBar.style.width = `${Math.max(0, Math.min(100, stamina))}%`;
  }

  const muteButton = hud.querySelector('.mute');

  // 消音ボタンの見た目（消音中は斜線のスピーカー）
  function setMutedIcon(muted) {
    muteButton.classList.toggle('muted', muted);
    muteButton.innerHTML = muted ? icons.speakerOff : icons.speaker;
    muteButton.setAttribute('aria-label', muted ? '音を出す' : '音を消す');
  }

  function setQuest(done) {
    questCount.textContent = done ? '1 / 1' : '0 / 1';
  }

  function setFps(text) {
    fps.hidden = text === null;
    if (text !== null) fps.textContent = text;
  }

  function showNotice(message) {
    const notice = document.createElement('div');
    notice.className = 'notice';
    notice.textContent = message;
    hud.appendChild(notice);
  }

  return {
    stickArea: hud.querySelector('.stick-area'),
    runButton: hud.querySelector('.run'),
    actionButtons,
    minimapCanvas: hud.querySelector('.minimap'),
    setFps,
    showNotice,
    setVitals,
    setQuest,
    muteButton,
    setMutedIcon,
  };
}
