（ここから下をすべて ChatGPT に貼り付けてください）

# 依頼：3Dゲームの「土ぼこり」と「光の粒」の演出を three.js で作ってください

## 前提
- スマホ（iPhone 14 の Safari、横向き）向けの3Dアクションゲーム「OBLIVION ARENA」を作っています。夕方の山あいの遺跡で、大きな結晶獣と向き合う場面です
- 技術：Vite 8、three.js 0.186（`import * as THREE from 'three'`）、素の JavaScript（ES modules）。TypeScript は使いません
- テスト：Vitest 5（Node 環境。WebGL は使えませんが、`THREE.Scene` や `Points` の生成はできます）
- **新しいライブラリは追加しないでください**。外部の画像も使わないでください（粒の形が必要なら、シェーダーで丸くするか、`CanvasTexture` を使わずに済む方法にしてください）
- スマホで 60fps を出したいので、粒はそれぞれ `THREE.Points` 1つにまとめ、毎フレームの処理を軽くしてください

## 世界の座標
- 地面は x-z 平面で、y が上。1単位 = 1m。地面の高さは 0 と考えてかまいません
- 結晶獣の位置は呼び出し側から渡されます（例：`{ x: 0, z: -6 }`）

## 作るファイル
- `src/world/effects.js`
- `tests/effects.test.js`（下のテストを含め、必要なら追加してよい）

## 公開する関数（名前と引数は変えないでください）

```js
// preset は画質の設定。preset.bloom が false のときは「低画質」とみなし、粒の数を半分にする
// beastPos は { x, z }
// center は光の粒を漂わせる中心（ふつうはプレイヤーの位置）。THREE.Vector3 か { x, y, z }
export function createEffects(scene, preset, beastPos) // -> { update(dt, time, center) }
```

## 土ぼこり
- 結晶獣の足元、半径 3m の範囲に 60 粒（低画質では 30 粒）
- ゆっくり上がりながら薄くなって消え、また下から出てくる（ループ）
- 高さは 0〜2m 程度、上昇速度は 0.3〜0.7 m/秒程度でばらつかせる
- 色は `#c8a477`、半透明。粒の大きさは画面上で目立ちすぎない程度（`sizeAttenuation: true`、0.25m 前後）
- 粒ごとの「消え具合」は、`onBeforeCompile` でアトリビュートを使う方法か、`ShaderMaterial` で実装してください

## 光の粒
- `center` の周り 20m の範囲に 150 粒（低画質では 75 粒）
- 加算合成（`THREE.AdditiveBlending`）で、薄い暖色（例：`#ffe2a8`）
- 高さ 0.5〜4m の範囲で、ゆらゆら漂わせる（sin/cos でゆっくり揺らす程度でよい）
- `center` から遠く離れた粒は、反対側に回り込ませて、常にプレイヤーの周りに粒があるようにする
- `depthWrite: false` にして、ほかの物の描画を邪魔しないようにする

## テスト（必ず通ること）

```js
import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createEffects } from '../src/world/effects.js';

const high = { bloom: true };
const low = { bloom: false };
const beast = { x: 0, z: -6 };

function countPoints(scene) {
  let total = 0;
  scene.traverse((o) => {
    if (o.isPoints) total += o.geometry.getAttribute('position').count;
  });
  return total;
}

test('通常画質は 60 + 150 粒', () => {
  const scene = new THREE.Scene();
  createEffects(scene, high, beast);
  expect(countPoints(scene)).toBe(210);
});

test('低画質は半分', () => {
  const scene = new THREE.Scene();
  createEffects(scene, low, beast);
  expect(countPoints(scene)).toBe(105);
});

test('update を呼んでもエラーにならず、粒が動く', () => {
  const scene = new THREE.Scene();
  const effects = createEffects(scene, high, beast);
  const before = [];
  scene.traverse((o) => { if (o.isPoints) before.push([...o.geometry.getAttribute('position').array]); });
  effects.update(0.1, 1, new THREE.Vector3(0, 0, 6));
  const after = [];
  scene.traverse((o) => { if (o.isPoints) after.push([...o.geometry.getAttribute('position').array]); });
  expect(after).not.toEqual(before);
});
```

## 返答の形式
- 2つのファイルの**全文**を、それぞれファイル名を書いたコードブロックで返してください
- ほかのファイルの変更の提案は不要です
- 説明は短めにして、迷って決めたところがあれば最後に箇条書きで書いてください
