# 依頼：遊び方の説明（src/ui/tutorial.js と tutorial.css）

最初の3回の戦いで、操作の説明を1つずつ出します。「いつ、どの説明を出すか」の判断（純粋な関数、DOM を使わない）と、その表示の2つを作ります。何回目の戦いかは呼び出し側が数えます。

## 作るファイル
- `src/ui/tutorial.js`（先頭で `import './tutorial.css';`）
- `src/ui/tutorial.css`
- `tests/tutorial.test.js`（先頭に `// @vitest-environment happy-dom`）

## 公開する関数（名前と引数は変えないでください）
```js
export const TUTORIAL_TEXT = {
  move: 'スティックで移動',
  attack: '攻撃ボタンで斬る（3回まで続けて出せる）',
  dodge: 'オレンジの予告が出たら、回避で逃げる',
  lock: 'ロックで結晶獣を捉え続ける',
};

export function createTutorial()
// 判断の係。DOM を使わない
// -> {
//   start(enabled: boolean),   // 戦いの始まりに呼ぶ。終わった説明をすべて未完了に戻す。enabled が false なら何も出さない
//   update(dt: number, signals) -> 'move' | 'attack' | 'dodge' | 'lock' | null,  // 今出す説明
//     // signals = { moving: boolean, hit: boolean, telegraph: boolean, lock: boolean }
//     //   moving   : この frame で主人公が歩いている（スティックやキーで動かしている）
//     //   hit      : この frame で攻撃が結晶獣に当たった
//     //   telegraph: この frame で結晶獣の攻撃の予告が出ている
//     //   lock     : この frame でロックが押された
// }

export function createTutorialView(root /* HTMLElement */)
// 表示の係
// -> { show(name /* 'move' | 'attack' | 'dodge' | 'lock' | null */) }
```

## 判断の決まり
- 終わる条件（説明を表示していないときに満たしても、その説明は終わりにする）：
  - `move`：`moving` が true の時間の合計が 2 秒以上になった
  - `attack`：`hit` が true になった
  - `dodge`：予告が出て、そのあと予告が消えた（`telegraph` が true → false になった）
  - `lock`：`lock` が true になった
- 出す順番：
  1. `telegraph` が true で、`dodge` がまだ終わっていなければ `dodge`
  2. それ以外は、`move` → `attack` → `lock` のうち、まだ終わっていない最初のもの（`dodge` は予告が出ているときだけ出す）
  3. すべて終わっていれば `null`
- `start(false)` のあとは常に `null`
- `start` を呼ぶ前は、`start(false)` と同じ（何も出さない）

## 表示の決まり（テストで使うクラス名は変えないでください）
- `div.tutorial-hint` を1つ作って `root` に追加。`pointer-events: none`、`z-index: 15`。`show(null)` で `hidden`
- `show(name)` で `TUTORIAL_TEXT[name]` を表示し、`data-hint` 属性に name を入れる。CSS で `data-hint` ごとに置き場所を変える（画面は `src/ui/hud.css` のボタン配置を読んで合わせる）：
  - `move`：左下のスティック（`.stick-area`）の上
  - `attack`：右下の攻撃ボタン（`.attack`）の左
  - `dodge`：画面中央の少し上（上から 28% くらい）。目立つように、文字を少し大きく、縁をオレンジ `#ff9a3c` に
  - `lock`：ロックボタン（`.lock`）の左
- 見た目：濃紺の板に金の縁、文字 14px（低い画面では 12px）。出るときに 0.2 秒でふわっと出る。同じ name で続けて `show` されたときは何もしない（毎 frame 呼ばれるので、アニメーションを最初からやり直さない）

## 必ず通るテスト
```js
// @vitest-environment happy-dom
import { test, expect } from 'vitest';
import { createTutorial, createTutorialView, TUTORIAL_TEXT } from '../src/ui/tutorial.js';
const idle = { moving: false, hit: false, telegraph: false, lock: false };

test('移動 → 攻撃 → ロックの順に出る', () => {
  const t = createTutorial();
  t.start(true);
  expect(t.update(0.1, idle)).toBe('move');
  expect(t.update(1.0, { ...idle, moving: true })).toBe('move');
  expect(t.update(1.0, { ...idle, moving: true })).toBe('attack');
  expect(t.update(0.1, { ...idle, hit: true })).toBe('lock');
  expect(t.update(0.1, { ...idle, lock: true })).toBe(null);
});
test('予告が出ている間は回避の説明、予告が消えたら終わり', () => {
  const t = createTutorial();
  t.start(true);
  expect(t.update(0.1, { ...idle, telegraph: true })).toBe('dodge');
  expect(t.update(0.1, { ...idle, telegraph: true })).toBe('dodge');
  expect(t.update(0.1, idle)).toBe('move');
  expect(t.update(0.1, { ...idle, telegraph: true })).toBe('move');
});
test('先にロックを押していれば、ロックの説明は出ない', () => {
  const t = createTutorial();
  t.start(true);
  t.update(0.1, { ...idle, lock: true });
  t.update(2.0, { ...idle, moving: true });
  expect(t.update(0.1, { ...idle, hit: true })).toBe(null);
});
test('start(false) では何も出さず、start(true) でやり直せる', () => {
  const t = createTutorial();
  expect(t.update(0.1, idle)).toBe(null);
  t.start(false);
  expect(t.update(0.1, idle)).toBe(null);
  t.start(true);
  t.update(2.0, { ...idle, moving: true });
  t.start(true);
  expect(t.update(0.1, idle)).toBe('move');
});
test('表示：文と置き場所、null で隠す', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const view = createTutorialView(root);
  const hint = root.querySelector('.tutorial-hint');
  view.show('attack');
  expect(hint.hidden).toBe(false);
  expect(hint.textContent).toBe(TUTORIAL_TEXT.attack);
  expect(hint.dataset.hint).toBe('attack');
  view.show(null);
  expect(hint.hidden).toBe(true);
});
```
