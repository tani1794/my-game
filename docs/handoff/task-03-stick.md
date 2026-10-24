（ここから下をすべて ChatGPT に貼り付けてください）

# 依頼：ブラウザゲームのアナログスティック部品を作ってください

## 前提
- スマホ（iPhone 14 の Safari、横向き）向けの3Dアクションゲーム「ECHO HUNT」を作っています
- 技術：Vite 8、three.js 0.186、素の JavaScript（ES modules）。TypeScript は使いません
- テスト：Vitest 5
- このファイルは three.js にも、ほかのファイルにも依存させないでください。**新しいライブラリも追加しないでください**
- 画面左下に置く仮想スティックです。同時に、右下の「走る」ボタンや、画面のほかの場所でのカメラ操作（ドラッグ）にも別の指が使われます

## 作るファイル
- `src/ui/stick.js`
- `tests/stick.test.js`（下のテストを含め、必要なら追加してよい）

## 公開する関数（名前と引数は変えないでください）

```js
// 指のずれ（dx は右が正、dy は画面の下が正）→ 移動量
// z は上に倒すと正。長さは 1 で頭打ち。長さが deadZone 以下なら { x: 0, z: 0 }
// デッドゾーンを超えた値は引き直さず、そのまま dx / radius などを使う
export function stickVector(dx, dy, radius, deadZone = 0.12) // -> { x, z }

// container の中にスティックの見た目を作り、入力が変わるたびに onChange({ x, z }) を呼ぶ
export function createStick(container, onChange) // -> { reset() }
```

## createStick の動き
- `container` の位置と大きさは呼び出し側が決めます（例：150×150px の div を左下に固定）。中身の要素とその見た目は、このファイルで作ってください。スタイルは `element.style` で直接設定し、CSS ファイルは使わないでください
- Pointer Events（`pointerdown`、`pointermove`、`pointerup`、`pointercancel`、`lostpointercapture`）を使います
- **最初に触れた1本の指だけ**を追います。ほかの指は無視します
- 触れたら `setPointerCapture` で指を捕まえ、`event.preventDefault()` を呼びます
- 中心は、ベースの円の中心で固定します。触れた位置に動かしません
- つまみは指を追いますが、ベースの円の半径より外には出ません
- 指を離したとき、キャンセルされたとき、捕捉が外れたときは、つまみを中央に戻し、`onChange({ x: 0, z: 0 })` を呼びます
- `reset()` も同じく、つまみを中央に戻して `onChange({ x: 0, z: 0 })` を呼びます（アプリが裏に回ったときに使います）
- `container` には `touch-action: none` と `user-select: none` を設定し、長押しでのメニュー表示も防いでください（`-webkit-touch-callout: none`）

## 見た目
- ベース：`container` いっぱいの円。背景 `#1b2530`、不透明度 0.65。縁取りは `#c9a96a`、太さ 1px、不透明度 0.6
- ベースの内側の上下左右に、小さな三角形の矢印（▲▼◀▶ に相当、色 `#e8e2d0`、不透明度 0.7）
- つまみ：直径 60px の円。色 `#e8e2d0`、不透明度 0.85。縁取りは `#c9a96a`、太さ 1px
- つまみの移動は `transform: translate(...)` で行ってください

## テスト（必ず通ること）

```js
import { test, expect } from 'vitest';
import { stickVector } from '../src/ui/stick.js';

test('上いっぱいで z=1、半分で 0.5、外へ引っ張っても 1', () => {
  expect(stickVector(0, -50, 50)).toEqual({ x: 0, z: 1 });
  expect(stickVector(25, 0, 50).x).toBeCloseTo(0.5);
  expect(Math.hypot(...Object.values(stickVector(80, -80, 50)))).toBeCloseTo(1);
});

test('デッドゾーン内は0', () => {
  expect(stickVector(5, 0, 50)).toEqual({ x: 0, z: 0 });
});
```

注意：1つ目のテストの `toEqual({ x: 0, z: 1 })` は、`-0` だと失敗します。`x` が `-0` にならないようにしてください。

## 返答の形式
- 2つのファイルの**全文**を、それぞれファイル名を書いたコードブロックで返してください
- ほかのファイルの変更の提案は不要です
- 説明は短めにして、迷って決めたところがあれば最後に箇条書きで書いてください
