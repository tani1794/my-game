# 依頼：タイトル画面（src/ui/titleScreen.js と titleScreen.css）

ゲームを開いたときに最初に出る画面です。背景は1枚の画像（ロゴ「OBLIVION ARENA」が絵の中に入っている）で、画面のどこかをタップすると始まります。状態は持たず、呼ばれたとおりに表示するだけです。

## 作るファイル
- `src/ui/titleScreen.js`（先頭で `import './titleScreen.css';`）
- `src/ui/titleScreen.css`
- `tests/titleScreen.test.js`（先頭に `// @vitest-environment happy-dom`）

## 公開する関数（名前と引数は変えないでください）
```js
export function createTitleScreen(root /* HTMLElement */, { image /* 画像のURL文字列 */ })
// -> {
//   show(bestSeconds /* number | null */),  // 表示する。bestSeconds が数なら「最速記録 m:ss」を出し、null なら出さない
//   hide(),
//   onStart(callback),   // タップされたら呼ぶ。複数登録できる。表示中だけ呼ぶ（hide 中のタップでは呼ばない）
// }
```

## 決まり（テストで使うクラス名は変えないでください）
- 全体を `div.title-screen` に入れて `root` に追加する。`position: fixed; inset: 0;`、`z-index: 30`（ほかの画面より上）。最初は `hidden`
- 背景は2層：
  - `div.title-blur`：同じ画像を `background-image` で画面いっぱいに（`cover`）敷き、`filter: blur(18px) brightness(0.55)`、少し拡大（`transform: scale(1.1)`）して端のぼけを隠す
  - `img.title-art`：画像全体が必ず見えるよう `object-fit: contain` で画面いっぱいに置く（ロゴと人物が切れないことが最重要）。`alt=""`、`draggable="false"`
- `div.title-start`：「タップで開始」。下中央、`bottom: calc(10px + env(safe-area-inset-bottom))`。2.4 秒周期でゆっくり明滅（不透明度 1 ↔ 0.35）。文字の影を濃くして、画像の上でも読めるように。`prefers-reduced-motion: reduce` のときは明滅しない
- `div.title-best`：「最速記録 m:ss」（数字の部分は Cinzel）。右上（`top: calc(12px + env(safe-area-inset-top))`、`right: calc(16px + env(safe-area-inset-right))`）。濃紺の板に金の縁。記録が無いときは `hidden`
- 時間の表示 `m:ss`：小数は切り捨て（`65.9` → `1:05`）
- タップの判定は `click`（iPhone で音を有効にできるのは指を離したときなので、`pointerdown` ではなく `click`）。`div.title-screen` 全体で受ける
- `user-select: none`、`-webkit-touch-callout: none`、`touch-action: manipulation`

## 必ず通るテスト
```js
// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createTitleScreen } from '../src/ui/titleScreen.js';
const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return { root, title: createTitleScreen(root, { image: '/textures/title.webp' }) };
};

test('最初は隠れていて、show で出る。画像が入る', () => {
  const { root, title } = make();
  const screen = root.querySelector('.title-screen');
  expect(screen.hidden).toBe(true);
  title.show(null);
  expect(screen.hidden).toBe(false);
  expect(root.querySelector('.title-art').getAttribute('src')).toBe('/textures/title.webp');
  expect(root.querySelector('.title-start').textContent).toBe('タップで開始');
});
test('最速記録：あれば m:ss、なければ隠す', () => {
  const { root, title } = make();
  title.show(65.9);
  const best = root.querySelector('.title-best');
  expect(best.hidden).toBe(false);
  expect(best.textContent).toContain('1:05');
  title.show(null);
  expect(best.hidden).toBe(true);
});
test('表示中のタップで onStart、隠れているときは呼ばない', () => {
  const { root, title } = make();
  const start = vi.fn();
  title.onStart(start);
  root.querySelector('.title-screen').click();
  expect(start).not.toHaveBeenCalled();
  title.show(null);
  root.querySelector('.title-art').click();
  expect(start).toHaveBeenCalledTimes(1);
  title.hide();
  expect(root.querySelector('.title-screen').hidden).toBe(true);
});
```
