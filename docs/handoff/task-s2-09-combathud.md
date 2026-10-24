# 依頼：戦闘の画面表示（src/ui/combatHud.js と combatHud.css）

結晶獣の体力バー、照準マーク、ダメージの数字、勝ち負けの画面です。戦いの状態は持たず、呼ばれたとおりに表示するだけです。既存の画面（`src/ui/hud.js`、`src/ui/hud.css`）は変更しないでください（読んで見た目を合わせてください）。

## 作るファイル
- `src/ui/combatHud.js`（先頭で `import './combatHud.css';`）
- `src/ui/combatHud.css`
- `tests/combatHud.test.js`（先頭に `// @vitest-environment happy-dom`）

## 公開する関数（名前と引数は変えないでください）
```js
export function createCombatHud(root /* HTMLElement */)
// -> {
//   setBeastVisible(visible: boolean),
//   setBeast(hpRatio /* 0〜1 */, enraged: boolean),
//   setReticle(point /* {x, y} CSSピクセル */ | null),
//   showDamage(point /* {x, y} */, value: number),
//   showResult(kind: 'won' | 'lost', timeSeconds?: number),
//   hideResult(),
//   onRetry(callback),        // 「もう一度」が押されたら呼ぶ。複数登録できる
//   update(dt: number),       // ダメージの数字を動かして、時間が来たら消す
//   clear(),                  // ダメージの数字・照準・結果画面を消す
// }
```

## 決まり（テストで使うクラス名は変えないでください）
- 全体を `div.combat-hud` に入れて `root` に追加する。`pointer-events: none`（「もう一度」ボタンだけ押せる）
- 結晶獣の体力バー：`div.boss-bar`（上部中央、最初は `hidden`）。中に「結晶獣」の文字と、`div.boss-bar-fill`（幅を `%` で）。色 `#c8423a`。怒り状態では `div.boss-bar` に `enraged` クラスを付け、色を `#8e1f1a` に
  - 上部には既存の左上の体力欄と右上のクエスト欄があるので、重ならないよう幅は画面の 36%、上から `calc(10px + env(safe-area-inset-top))`
- 照準マーク：`div.reticle`、金色 `#c9a96a` の直径 28px の輪。中心が point に来るように置く。`null` で `hidden`
- ダメージの数字：`div.damage-number` を point に出し、0.6 秒で 30px 上に動きながら消える（`update(dt)` で動かし、0.6 秒たったら DOM から取り除く）。同時に最大 8 個（9 個目を出したら最も古いものを取り除く）
- 結果画面：`div.result`（最初は `hidden`）。中に `div.result-title`（勝ち「討伐完了」／負け「力尽きた」）、`div.result-time`（勝ちのとき「時間 m:ss」、負けのときは空）、`button.result-retry`（「もう一度」）
- 見た目は既存 HUD に合わせる：半透明の濃紺 `#1b2530cc`、金の縁 `#c9a96a`、文字色 `#e8e2d0`、英数字以外はシステムフォント

## 必ず通るテスト
```js
// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createCombatHud } from '../src/ui/combatHud.js';
const make = () => { const root = document.createElement('div'); document.body.append(root); return { root, hud: createCombatHud(root) }; };

test('結晶獣の体力バー：表示・幅・怒り状態', () => {
  const { root, hud } = make();
  const bar = root.querySelector('.boss-bar');
  expect(bar.hidden).toBe(true);
  hud.setBeastVisible(true);
  hud.setBeast(0.5, false);
  expect(bar.hidden).toBe(false);
  expect(root.querySelector('.boss-bar-fill').style.width).toBe('50%');
  hud.setBeast(0.4, true);
  expect(bar.classList.contains('enraged')).toBe(true);
});
test('勝ちの画面に時間 4:05、もう一度で onRetry が呼ばれる', () => {
  const { root, hud } = make();
  const retry = vi.fn();
  hud.onRetry(retry);
  hud.showResult('won', 245);
  expect(root.querySelector('.result').hidden).toBe(false);
  expect(root.querySelector('.result-title').textContent).toBe('討伐完了');
  expect(root.querySelector('.result-time').textContent).toContain('4:05');
  root.querySelector('.result-retry').click();
  expect(retry).toHaveBeenCalledTimes(1);
  hud.hideResult();
  expect(root.querySelector('.result').hidden).toBe(true);
});
test('負けの画面', () => {
  const { root, hud } = make();
  hud.showResult('lost');
  expect(root.querySelector('.result-title').textContent).toBe('力尽きた');
});
test('ダメージの数字は最大8個で、0.6秒たつと消える', () => {
  const { root, hud } = make();
  for (let i = 0; i < 9; i++) hud.showDamage({ x: 100, y: 100 }, 10 + i);
  const numbers = root.querySelectorAll('.damage-number');
  expect(numbers).toHaveLength(8);
  expect(numbers[0].textContent).toBe('11');
  hud.update(0.7);
  expect(root.querySelectorAll('.damage-number')).toHaveLength(0);
});
test('照準マークと clear', () => {
  const { root, hud } = make();
  hud.setReticle({ x: 200, y: 120 });
  expect(root.querySelector('.reticle').hidden).toBe(false);
  hud.showDamage({ x: 1, y: 1 }, 5);
  hud.showResult('lost');
  hud.clear();
  expect(root.querySelector('.reticle').hidden).toBe(true);
  expect(root.querySelectorAll('.damage-number')).toHaveLength(0);
  expect(root.querySelector('.result').hidden).toBe(true);
});
```
