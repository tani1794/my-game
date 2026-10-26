import './titleScreen.css';

function formatSeconds(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function createTitleScreen(root, { image, logo = null }) {
  const callbacks = [];

  const screen = document.createElement('div');
  screen.className = 'title-screen';
  screen.hidden = true;

  const blur = document.createElement('div');
  blur.className = 'title-blur';
  blur.style.backgroundImage = `url(${JSON.stringify(image)})`;
  blur.setAttribute('aria-hidden', 'true');

  const art = document.createElement('img');
  art.className = 'title-art';
  art.setAttribute('src', image);
  art.setAttribute('alt', '');
  art.setAttribute('draggable', 'false');

  // 題字は絵から切り出したもの。背景が動いても、いつも下中央に重ねて出す（reveal で現れて、ゆっくり明滅する）
  const logoImage = document.createElement('img');
  logoImage.className = 'title-logo';
  logoImage.setAttribute('alt', 'THE SILENT CROWN');
  logoImage.setAttribute('draggable', 'false');
  logoImage.hidden = logo === null;
  if (logo !== null) logoImage.setAttribute('src', logo);

  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'title-start';
  start.textContent = 'TAP TO BEGIN';

  const best = document.createElement('div');
  best.className = 'title-best';
  best.hidden = true;

  const bestLabel = document.createElement('span');
  bestLabel.className = 'title-best-label';
  bestLabel.textContent = '最速記録';

  const bestTime = document.createElement('span');
  bestTime.className = 'title-best-time';

  best.append(bestLabel, ' ', bestTime);

  const notice = document.createElement('div');
  notice.className = 'title-notice';
  notice.hidden = true;

  screen.append(blur, art, logoImage, start, best, notice);
  root.append(screen);

  function begin() {
    for (const callback of [...callbacks]) {
      callback();
    }
  }

  // 画面のどこをタップしても始まる（TAP TO BEGIN のボタンもここに届く）
  screen.addEventListener('click', () => {
    if (!screen.hidden) begin();
  });

  // Enter キーでも始める。ボタンにフォーカスがあるときは、ブラウザがボタンを押す（click）ので二重にしない
  window.addEventListener('keydown', (event) => {
    if (screen.hidden || event.key !== 'Enter' || event.target === start) return;
    event.preventDefault();
    begin();
  });

  return {
    show(bestSeconds) {
      screen.hidden = false;
      root.classList.add('title-open');

      if (
        typeof bestSeconds === 'number'
        && Number.isFinite(bestSeconds)
      ) {
        bestTime.textContent = formatSeconds(bestSeconds);
        best.hidden = false;
      } else {
        best.hidden = true;
        bestTime.textContent = '';
      }
    },

    hide() {
      screen.hidden = true;
      root.classList.remove('title-open');
    },

    // 背景の準備ができたら呼ぶ：題字が約2秒で現れ、そのあと2秒周期でゆっくり消えては戻る
    reveal() {
      screen.classList.add('is-revealed');
    },

    // 3D表示（裏の canvas に描く）のときは、止まった絵を隠して透かす
    setDepthMode(on) {
      screen.classList.toggle('is-3d', Boolean(on));
    },

    // 開始できない理由などを、タイトル画面の中に出す
    showNotice(message) {
      notice.textContent = message;
      notice.hidden = false;
    },

    onStart(callback) {
      callbacks.push(callback);
    },
  };
}
