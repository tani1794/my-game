（ここから下をすべて ChatGPT に貼り付けてください）

# 依頼：3Dゲームの「崩れた石のアーチ」と「旗」を three.js で作ってください

## 前提
- スマホ（iPhone 14 の Safari、横向き）向けの3Dアクションゲーム「OBLIVION ARENA」を作っています
- 技術：Vite 8、three.js 0.186（`import * as THREE from 'three'`）、素の JavaScript（ES modules）。TypeScript は使いません
- テスト：Vitest 5（Node 環境。WebGL は使えませんが、`THREE.Scene` や `Mesh` の生成はできます）
- **新しいライブラリは追加しないでください**。外部の画像や3Dモデルも使わず、すべてコードで形を作ってください
- スマホで 60fps を出したいので、描画の呼び出し回数（ドローコール）を少なくしてください

## 世界の座標
- 地面は x-z 平面で、y が上。1単位 = 1m
- プレイヤーは `(x: 0, z: 6)` あたりから、−z の方向（奥）を見ています
- 太陽は左奥 `(-30, 25, -40)` の方向にあり、影が有効です（`castShadow` / `receiveShadow` を設定してください）

## 使ってよい既存の部品

```js
// src/world/random.js（作成済み）
// 種から毎回同じ並びの乱数を返す。値は 0 以上 1 未満
export function mulberry32(seed) // -> () => number
```

## 作るファイル
- `src/world/ruins.js`
- `tests/ruins.test.js`（下のテストを含め、必要なら追加してよい）

## 公開する関数（名前と引数は変えないでください）

```js
// scene にアーチ2つと旗2本を追加する
// heightAt(x, z) はその地点の地面の高さ(m)を返す関数
// colliders：アーチの柱の当たり判定（円）。{ x, z, radius } の配列
// update(time)：旗をはためかせる。time は起動からの経過秒
export function createRuins(scene, heightAt) // -> { colliders, update(time) }
```

## アーチ（2つ）
- 中心の位置：`(-5, -14)` と `(5, -14)`。どちらもプレイヤーのほう（+z）を正面に向ける
- 柱は2本で、中心から x 方向に ±2m（柱の中心の間隔が 4m）。高さは 7m
- 柱は 1.1m 角の石ブロックを積んで作る。ブロックごとに少しだけ大きさ・向き・位置をずらし、手で積んだ感じにする
- 柱の上に、2本の柱をつなぐ横木（石ブロックの列）を載せる。横木のブロックのいくつかを `mulberry32(7)` で選んで**欠けさせる**（置かない）。ただし両端は残し、全部は欠けさせない
- 色は `#7d8288` を基準に、ブロックごとに明るさを ±10% の範囲で変える
- ブロックは `InstancedMesh` 1つ（または少数）にまとめ、色は `setColorAt` で変える。マテリアルは `MeshStandardMaterial`（roughness 0.95 程度）
- 柱の根元は、`heightAt` の高さより 0.2m 下から積み始める（地面の起伏に埋まって浮かないように）
- 当たり判定は、柱1本につき1つ、半径 0.8 の円。合計4つ

## 旗（2本）
- 位置：`(-9, 4)` と `(-7, 6)`
- 高さ 3m の木の柱（色 `#5a4630`）の上部に、横木を付ける
- 布は横木から吊るす。幅 0.9m、長さ 1.6m、色 `#1f3a6b`。縦に 8 分割した板
- 布は**下ほど大きく**揺らす。`MeshStandardMaterial` の `onBeforeCompile` で頂点シェーダーに時間の uniform を足し、`update(time)` でその値を更新する。2本の旗が同じ動きにならないよう、位相をずらす
- 布の表に、金色 `#c9a96a` の簡単な「角（つの）」の形の紋章を板で重ねる（布と一緒に揺れること）
- 布は両面から見えるようにする（`side: THREE.DoubleSide`）
- 2本とも、プレイヤーのほう（+z 方向）を向け、少し道（x = 0）のほうへ回す（`rotation.y` で 0.4 ラジアン程度）
- 旗には当たり判定は付けません

## テスト（必ず通ること）

```js
import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createRuins } from '../src/world/ruins.js';

const flat = () => 0;

test('柱4本の当たり判定を返す', () => {
  const { colliders } = createRuins(new THREE.Scene(), flat);
  expect(colliders).toHaveLength(4);
  expect(colliders).toEqual(expect.arrayContaining([
    { x: -7, z: -14, radius: 0.8 },
    { x: -3, z: -14, radius: 0.8 },
    { x: 3, z: -14, radius: 0.8 },
    { x: 7, z: -14, radius: 0.8 },
  ]));
});

test('シーンに物が追加される', () => {
  const scene = new THREE.Scene();
  createRuins(scene, flat);
  expect(scene.children.length).toBeGreaterThan(0);
});

test('欠け方は毎回同じ', () => {
  const count = () => {
    const scene = new THREE.Scene();
    createRuins(scene, flat);
    let instances = 0;
    scene.traverse((o) => { if (o.isInstancedMesh) instances += o.count; });
    return instances;
  };
  expect(count()).toBe(count());
});

test('update(time) を呼んでもエラーにならない', () => {
  const ruins = createRuins(new THREE.Scene(), flat);
  expect(() => ruins.update(1.5)).not.toThrow();
});
```

## 返答の形式
- 2つのファイルの**全文**を、それぞれファイル名を書いたコードブロックで返してください
- ほかのファイルの変更の提案は不要です
- 説明は短めにして、迷って決めたところがあれば最後に箇条書きで書いてください
