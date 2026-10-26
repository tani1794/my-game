# 依頼：物語パートの画面表示（src/ui/storyHud.js と storyHud.css）

森と礼拝堂を歩く物語パート用の画面部品です。目的の表示、字幕、会話の履歴、「調べる」ボタン、暗転・白転、章題、短いお知らせ、会話送りの受け付けを作ります。状態は持たず（履歴だけは持つ）、呼ばれたとおりに表示するだけです。既存の `src/ui/hud.js`・`hud.css`（左下にスティック、右下に攻撃・回避・ロック・走るの丸ボタン）は変更しないでください。読んで、重ならないように置いてください。

## 作るファイル
- `src/ui/storyHud.js`（先頭で `import './storyHud.css';`）
- `src/ui/storyHud.css`
- `tests/storyHud.test.js`（先頭に `// @vitest-environment happy-dom`）

## 公開する関数（名前と引数は変えないでください）
```js
export function createStoryHud(root /* HTMLElement */)
// -> {
//   setVisible(on: boolean),                  // 全体の表示（最初は隠れている）
//   setObjective(text: string | null),        // 上中央の「現在の目的」。null で隠す。変わったときに 0.4 秒でふわっと出る
//   say({ speaker: string, text: string }),   // 字幕を出す（前の字幕は置き換え）。同時に履歴へ追加
//   clearSubtitle(),                          // 字幕を消す
//   showInteract(label: string | null),       // 「調べる」ボタン。null で隠す。label は「調べる」「レバーを引く」など
//   onInteract(callback),                     // 「調べる」ボタンが押されたら呼ぶ（複数登録できる）
//   setAdvance(on: boolean),                  // 会話送りの受け付け。on の間は画面全体を覆う透明な層を出し、
//                                             // タップを受け止めて、下の攻撃ボタンなどへ届かないようにする。右下に小さく「タップで次へ ▸」
//   onAdvance(callback),                      // 受け付け中の層がタップされたら呼ぶ（複数登録できる）
//   fade(color: 'black' | 'white' | null, seconds: number) -> Promise<void>,
//                                             // 全画面をその色へ seconds 秒で変える。null で透明に戻す。終わったら resolve
//   showChapterTitle(text: string, seconds = 3.2) -> Promise<void>,
//                                             // 画面中央に章題を大きく出して消す（0.8 秒で出て、0.8 秒で消える）
//   toast(text: string),                      // 上中央（目的の下）に短いお知らせを 2.5 秒（「チェックポイント」など）
//   log(): Array<{ speaker, text }>,          // これまでの字幕（古い順）
//   clearLog(),
// }
```

## 決まり（テストで使うクラス名は変えないでください）
- 全体を `div.story-hud` に入れて `root` に追加。`position: fixed; inset: 0; pointer-events: none; z-index: 12`。最初は `hidden`
- `div.story-objective`：上中央。`top: calc(10px + env(safe-area-inset-top))`。濃紺の板に金の縁（既存HUDと同じ見た目、`clip-path` の切り落とし角）。先頭に小さなひし形の印。文字 14px（低い画面 12px）
- `div.story-subtitle`：下中央に置く。中は `span.story-speaker`（名前、金色 `#c9a96a`、少し小さく）と `span.story-text`（本文、`#e8e2d0`、15px、行間 1.6、低い画面 13px）
  - 位置：`left: 50%; transform: translateX(-50%); bottom: calc(var(--edge, 10px) + 10px + env(safe-area-inset-bottom));`
  - 幅：`max-width: calc(100vw - 2 * (var(--edge, 16px) + var(--sub-button, 84px) + var(--attack, 110px) + 34px))`（右下のボタンの塊と左下のスティックに重ならない幅。844×340 の画面で約 444px）
  - 背景は下から上へ薄くなる黒いグラデーション、文字に影。最大3行
- `button.story-interact`：字幕の上、下中央（`bottom: calc(var(--edge, 10px) + 96px + env(safe-area-inset-bottom))`）。丸みのある細長い板、金の縁、文字 14px。`pointer-events: auto`。`hidden` で隠す。押したら onInteract
- `button.story-log-button`：右上（`top: calc(10px + env(safe-area-inset-top)); right: calc(10px + env(safe-area-inset-right))`）、小さな丸ボタン（34px、本のアイコンの線SVG）、`aria-label="会話の履歴"`。押すと `div.story-log` を開閉
- `div.story-log`：画面中央の板（幅 min(80vw, 520px)、高さ最大 70vh、中は縦スクロール）。履歴を `div.story-log-line` で並べる（名前と本文）。右上に `button.story-log-close`「閉じる」。開いている間は `pointer-events: auto`
- `div.story-advance`：`setAdvance(true)` の間だけ出る、画面全体の透明な層（`pointer-events: auto; z-index` は字幕より上、履歴の板より下）。右下に `span.story-advance-hint`「タップで次へ ▸」（ゆっくり点滅。`prefers-reduced-motion` では点滅しない）。`pointerdown` は `preventDefault` してタップの貫通を防ぎ、`click` で onAdvance を呼ぶ
- `div.story-fade`：全画面、色の層（`pointer-events: none`、z-index 最上位）。`fade()` は `transition: opacity` で変え、`transitionend` か、念のため `seconds` 経過のタイマーのどちらか早い方で resolve（両方で二重に resolve しない）
- `div.story-chapter`：中央に章題（Cinzel ではなく明朝寄りの日本語の書体：`'Hiragino Mincho ProN', 'Yu Mincho', serif`、28px、字間広め、文字に影）。`showChapterTitle` で出して消す
- `div.story-toast`：目的の下に短く出る
- 文は日本語。新しいライブラリは使わない

## 必ず通るテスト
```js
// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createStoryHud } from '../src/ui/storyHud.js';
const make = () => { const root = document.createElement('div'); document.body.append(root); return { root, hud: createStoryHud(root) }; };

test('最初は隠れていて、setVisible で出る', () => {
  const { root, hud } = make();
  expect(root.querySelector('.story-hud').hidden).toBe(true);
  hud.setVisible(true);
  expect(root.querySelector('.story-hud').hidden).toBe(false);
});
test('目的の表示と非表示', () => {
  const { root, hud } = make();
  hud.setObjective('霧の森を進む');
  expect(root.querySelector('.story-objective').textContent).toContain('霧の森を進む');
  expect(root.querySelector('.story-objective').hidden).toBe(false);
  hud.setObjective(null);
  expect(root.querySelector('.story-objective').hidden).toBe(true);
});
test('字幕は置き換わり、履歴に残る', () => {
  const { root, hud } = make();
  hud.say({ speaker: 'エリア', text: '……聞こえますか？' });
  hud.say({ speaker: 'エリア', text: 'よかった。今度は、届いた。' });
  expect(root.querySelector('.story-speaker').textContent).toBe('エリア');
  expect(root.querySelector('.story-text').textContent).toBe('よかった。今度は、届いた。');
  expect(hud.log()).toEqual([
    { speaker: 'エリア', text: '……聞こえますか？' },
    { speaker: 'エリア', text: 'よかった。今度は、届いた。' },
  ]);
  hud.clearSubtitle();
  expect(root.querySelector('.story-subtitle').hidden).toBe(true);
});
test('調べるボタン', () => {
  const { root, hud } = make();
  const cb = vi.fn();
  hud.onInteract(cb);
  const button = root.querySelector('.story-interact');
  expect(button.hidden).toBe(true);
  hud.showInteract('レバーを引く');
  expect(button.hidden).toBe(false);
  expect(button.textContent).toContain('レバーを引く');
  button.click();
  expect(cb).toHaveBeenCalledTimes(1);
  hud.showInteract(null);
  expect(button.hidden).toBe(true);
});
test('会話送り：受け付け中だけ層が出て、タップで onAdvance', () => {
  const { root, hud } = make();
  const cb = vi.fn();
  hud.onAdvance(cb);
  const layer = root.querySelector('.story-advance');
  expect(layer.hidden).toBe(true);
  hud.setAdvance(true);
  expect(layer.hidden).toBe(false);
  const down = new Event('pointerdown', { bubbles: true, cancelable: true });
  layer.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  layer.click();
  expect(cb).toHaveBeenCalledTimes(1);
  hud.setAdvance(false);
  expect(layer.hidden).toBe(true);
});
test('履歴の板を開閉できる', () => {
  const { root, hud } = make();
  hud.say({ speaker: 'エリア', text: 'ここです。' });
  root.querySelector('.story-log-button').click();
  const panel = root.querySelector('.story-log');
  expect(panel.hidden).toBe(false);
  expect(panel.querySelectorAll('.story-log-line')).toHaveLength(1);
  root.querySelector('.story-log-close').click();
  expect(panel.hidden).toBe(true);
});
test('fade は時間がたつと resolve する（transitionend が来なくても）', async () => {
  vi.useFakeTimers();
  const { hud } = make();
  const done = vi.fn();
  hud.fade('black', 0.5).then(done);
  await vi.advanceTimersByTimeAsync(600);
  expect(done).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
