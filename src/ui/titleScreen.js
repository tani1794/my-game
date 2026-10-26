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

  // ロゴは絵から切り出したもの。絵が動いても、いつも下中央に重ねて出す
  const logoImage = document.createElement('img');
  logoImage.className = 'title-logo';
  logoImage.setAttribute('alt', 'OBLIVION ARENA');
  logoImage.setAttribute('draggable', 'false');
  logoImage.hidden = logo === null;
  if (logo !== null) logoImage.setAttribute('src', logo);

  const start = document.createElement('div');
  start.className = 'title-start';
  start.textContent = 'タップで開始';

  const best = document.createElement('div');
  best.className = 'title-best';
  best.hidden = true;

  const bestLabel = document.createElement('span');
  bestLabel.className = 'title-best-label';
  bestLabel.textContent = '最速記録';

  const bestTime = document.createElement('span');
  bestTime.className = 'title-best-time';

  best.append(bestLabel, ' ', bestTime);
  screen.append(blur, art, logoImage, start, best);
  root.append(screen);

  screen.addEventListener('click', () => {
    if (screen.hidden) return;

    for (const callback of [...callbacks]) {
      callback();
    }
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

    // 3D表示（裏の canvas に描く）のときは、止まった絵を隠して透かす
    setDepthMode(on) {
      screen.classList.toggle('is-3d', Boolean(on));
    },

    onStart(callback) {
      callbacks.push(callback);
    },
  };
}
