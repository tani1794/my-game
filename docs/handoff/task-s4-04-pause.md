# 依頼：一時停止ボタンと一時停止メニュー（src/ui/pauseMenu.js と pauseMenu.css）

戦いの途中で止めるためのボタンと、止めたときに出すメニューです。状態は持たず、押されたことを知らせるだけです（止める処理は呼び出し側がします）。

## 作るファイル
- `src/ui/pauseMenu.js`（先頭で `import './pauseMenu.css';`）
- `src/ui/pauseMenu.css`
- `tests/pauseMenu.test.js`（先頭に `// @vitest-environment happy-dom`）

## 公開する関数（名前と引数は変えないでください）
```js
export function createPauseMenu(root /* HTMLElement */)
// -> {
//   setButtonVisible(visible: boolean),   // 一時停止ボタンの表示（最初は隠れている）
//   show({ muted: boolean, quality: 'high' | 'mid' | 'low' }),  // メニューを出す
//   hide(),
//   setMuted(muted: boolean),             // 「音」ボタンの表示を合わせる
//   setQuality(tier: 'high' | 'mid' | 'low'),  // 選ばれている画質の表示を合わせる
//   on(action, callback),
//     // action: 'pause' | 'resume' | 'retry' | 'title' | 'mute' | 'quality' | 'tutorial'
//     // 'quality' の callback には 'high' | 'mid' | 'low' を渡す。ほかは引数なし。同じ action に複数登録できる
// }
```

## 決まり（テストで使うクラス名は変えないでください）
- 一時停止ボタン：`button.pause-button`（`aria-label="一時停止"`）。2本の縦線のアイコン（線の SVG、`stroke="currentColor"`）。最初は `hidden`。押したら `'pause'` を知らせる
  - 置き場所：左上の消音ボタン（`src/ui/hud.css` の `.mute`）の**すぐ右**に、同じ大きさ・同じ見た目の丸ボタンで。`.mute` の位置は `top: calc(var(--edge) + 92px + env(safe-area-inset-top)); left: calc(var(--edge) + 6px + env(safe-area-inset-left)); width: 34px;`、低い画面（`max-height: 430px`）では `top: calc(var(--edge) + 70px + ...)`、`width: 30px`。左の間隔は 10px。`z-index: 20`
- メニュー：`div.pause-menu`（最初は `hidden`）。画面全体を `#07131d99` で暗くし、中央に濃紺の板。`z-index: 25`。中身（上から）：
  - `div.pause-title`：「一時停止」
  - `button[data-action="resume"]`：「続ける」（一番目立つ形）
  - `button[data-action="retry"]`：「やり直す」
  - `button[data-action="title"]`：「タイトルへ」
  - `button[data-action="mute"]`：「音 オン」／「音 オフ」（`setMuted`・`show` の `muted` に合わせる。muted が true なら「音 オフ」）
  - 画質の行：「画質」の文字と、`button[data-quality="high"]`「高」、`button[data-quality="mid"]`「中」、`button[data-quality="low"]`「低」。選ばれているボタンに `selected` クラスと `aria-pressed="true"`（ほかは `"false"`）
  - `button[data-action="tutorial"]`：「遊び方をもう一度見る」
- 高さ 340px の画面にも収まるように：ボタンを2列に並べる（「続ける」は2列ぶち抜き）など、縦に長くしすぎない。板の最大の高さは `calc(100% - 24px)`、はみ出すときは板の中だけ縦にスクロール
- ボタンはすべて `click` で反応（`type="button"`、`touch-action: manipulation`）。押したときに少し縮む（`:active` で `scale(0.96)`）
- メニューの外側（暗い部分）を押しても何もしない
- `user-select: none`

## 必ず通るテスト
```js
// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createPauseMenu } from '../src/ui/pauseMenu.js';
const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return { root, menu: createPauseMenu(root) };
};

test('一時停止ボタン：最初は隠れていて、押すと pause', () => {
  const { root, menu } = make();
  const button = root.querySelector('.pause-button');
  expect(button.hidden).toBe(true);
  menu.setButtonVisible(true);
  expect(button.hidden).toBe(false);
  const pause = vi.fn();
  menu.on('pause', pause);
  button.click();
  expect(pause).toHaveBeenCalledTimes(1);
});
test('メニューの表示と、各ボタンの知らせ', () => {
  const { root, menu } = make();
  const panel = root.querySelector('.pause-menu');
  expect(panel.hidden).toBe(true);
  menu.show({ muted: false, quality: 'mid' });
  expect(panel.hidden).toBe(false);
  for (const action of ['resume', 'retry', 'title', 'mute', 'tutorial']) {
    const callback = vi.fn();
    menu.on(action, callback);
    root.querySelector(`[data-action="${action}"]`).click();
    expect(callback).toHaveBeenCalledTimes(1);
  }
  menu.hide();
  expect(panel.hidden).toBe(true);
});
test('音の表示', () => {
  const { root, menu } = make();
  menu.show({ muted: true, quality: 'high' });
  const mute = root.querySelector('[data-action="mute"]');
  expect(mute.textContent).toContain('オフ');
  menu.setMuted(false);
  expect(mute.textContent).toContain('オン');
});
test('画質：選んだものを知らせ、表示を合わせる', () => {
  const { root, menu } = make();
  const quality = vi.fn();
  menu.on('quality', quality);
  menu.show({ muted: false, quality: 'mid' });
  expect(root.querySelector('[data-quality="mid"]').classList.contains('selected')).toBe(true);
  root.querySelector('[data-quality="low"]').click();
  expect(quality).toHaveBeenCalledWith('low');
  menu.setQuality('low');
  expect(root.querySelector('[data-quality="low"]').getAttribute('aria-pressed')).toBe('true');
  expect(root.querySelector('[data-quality="mid"]').classList.contains('selected')).toBe(false);
});
```
