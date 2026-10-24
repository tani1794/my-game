（ここから下をすべて ChatGPT に貼り付けてください）

# 依頼：ブラウザゲームのミニマップ部品を作ってください

## 前提
- スマホ（iPhone 14 の Safari、横向き）向けの3Dアクションゲーム「ECHO HUNT」を作っています
- 技術：Vite 8、three.js 0.186、素の JavaScript（ES modules）。TypeScript は使いません
- テスト：Vitest 5
- このファイルは three.js にも、ほかのファイルにも依存させないでください。**新しいライブラリも追加しないでください**

## 作るファイル
- `src/ui/minimap.js`
- `tests/minimap.test.js`（下のテストを含め、必要なら追加してよい）

## 世界の座標
- 地面は x-z 平面です。移動できる範囲は `|x| ≤ 28`、`|z| ≤ 28`
- 北は −z 方向で、ミニマップでは上に表示します
- プレイヤーの向き `rotationY` は `Math.atan2(進行方向x, 進行方向z)` で決まります。−z を向いているときは `Math.PI`、+x を向いているときは `Math.PI / 2` です

## 公開する関数（名前と引数は変えないでください）

```js
// ワールド座標 → キャンバス座標（CSSピクセル）。中心が原点、北(-z)が上
export function worldToMinimap(x, z, size, worldRadius = 28) // -> { u, v }

// rotationY → キャンバス上の回転角。上向きが 0、時計回りが正（ラジアン）
export function headingToMinimapAngle(rotationY) // -> number

// 渡された canvas に描く。draw は毎フレーム呼ばれるが、実際に描くのは 1 秒に 10 回まで
export function createMinimap(canvas) // -> { draw(player: { x, z, rotationY }, beast: { x, z }) }
```

## 見た目
- canvas の表示サイズは CSS で決まります（例：160×160px）。`devicePixelRatio` に合わせて、くっきり描いてください
- 描く順番と色
  1. 円形の背景：`#1b2530`、不透明度 0.8
  2. 外周の縁取り：`#c9a96a`、太さ 1.5px
  3. 歩ける範囲の輪郭：中心から半径 24（ワールド単位）の円。色 `#8a949e`、太さ 1px、不透明度 0.6
  4. 上端の内側に「N」：色 `#e8e2d0`、11px、`system-ui`
  5. 結晶獣のマーク：赤 `#e5484d` の小さな円（半径 5px）に、短い角を2本
  6. プレイヤーの矢印：`#f5efe0` の三角形（長さ 12px）。向きは `headingToMinimapAngle` で決める
- 円の外にはみ出したものは描かないでください（クリップする）

## テスト（必ず通ること）

```js
import { test, expect } from 'vitest';
import { worldToMinimap, headingToMinimapAngle } from '../src/ui/minimap.js';

test('座標の変換', () => {
  expect(worldToMinimap(0, 0, 160)).toEqual({ u: 80, v: 80 });
  expect(worldToMinimap(0, -28, 160)).toEqual({ u: 80, v: 0 });
  expect(worldToMinimap(28, 0, 160)).toEqual({ u: 160, v: 80 });
});

test('向き：-z を向いていれば上(0)、+x なら右(π/2)', () => {
  expect(headingToMinimapAngle(Math.PI)).toBeCloseTo(0);
  expect(headingToMinimapAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
});
```

## 返答の形式
- 2つのファイルの**全文**を、それぞれファイル名を書いたコードブロックで返してください
- ほかのファイルの変更の提案は不要です
- 説明は短めにして、迷って決めたところがあれば最後に箇条書きで書いてください
