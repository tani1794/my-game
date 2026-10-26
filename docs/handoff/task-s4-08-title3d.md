# 依頼：タイトル画面の「3D写真」（src/ui/titleScene.js）

タイトル画像（1枚の絵）に「奥行きの地図」を組み合わせ、カメラが動くと手前と奥が別々にずれて立体的に見える表示を作ります。場面（ショット）を5秒ごとに溶けるように切り替え、火の粉を舞わせます。描画は呼び出し側の `THREE.WebGLRenderer` で `renderer.render(scene, camera)` するので、この部品は scene と camera を用意して、毎 frame の `update` で中身を動かすだけです。

## 作るファイル
- `src/ui/titleScene.js`（`import * as THREE from 'three'`。乱数は `import { mulberry32 } from '../world/random.js'`（`mulberry32(seed)` は 0〜1 を返す関数を返す））
- `tests/titleScene.test.js`（three.js は WebGL なしで scene・material を作れるので、DOM は不要）

## 渡される画像
- `image`：タイトルの絵（`THREE.Texture`、1672×941、`colorSpace = SRGBColorSpace` 済み）。ロゴの文字は消してある
- `depth`：同じ縦横比の「奥行きの地図」（`THREE.Texture`、色空間はそのまま）
  - **R**：奥行き。255 = いちばん手前、0 = いちばん奥
  - **G**：結晶の光の場所。255 = 結晶（青く光る部分）、0 = それ以外

## 公開するもの（名前と引数は変えないでください）
```js
export const SHOT_SECONDS = 5;   // 1場面の長さ
export const FADE_SECONDS = 0.8; // 場面の終わりの、次の場面へ溶けて切り替わる時間

// 場面。x, y は絵の中の「画面の中心に来る点」（0〜1、x は左から、y は上から）
// zoom：1 = 絵が画面をちょうど覆う大きさ（はみ出した上下か左右は切れる）。2 = その2倍に寄る
// lookX, lookY：カメラの横・縦のずれ（-1〜1）。これで手前と奥のずれ方が変わる
// 各場面は from から to へ、ゆっくり（両端がなめらかな easeInOut で）動く
export const TITLE_SHOTS = [
  { name: 'wide',  from: { x: 0.50, y: 0.45, zoom: 1.00, lookX: -1.0, lookY: 0.0 }, to: { x: 0.52, y: 0.45, zoom: 1.06, lookX: 1.0, lookY: 0.2 } },
  { name: 'beast', from: { x: 0.74, y: 0.45, zoom: 1.80, lookX: 0.6, lookY: -0.3 }, to: { x: 0.72, y: 0.46, zoom: 2.10, lookX: -0.4, lookY: 0.2 } },
  { name: 'hero',  from: { x: 0.30, y: 0.55, zoom: 1.70, lookX: -0.5, lookY: -0.6 }, to: { x: 0.30, y: 0.36, zoom: 1.85, lookX: 0.3, lookY: 0.5 } },
  { name: 'final', from: { x: 0.50, y: 0.42, zoom: 1.15, lookX: 0.5, lookY: 0.3 }, to: { x: 0.50, y: 0.45, zoom: 1.00, lookX: -0.3, lookY: 0.0 } },
];

// time 秒のときのカメラ。純粋な関数
// -> { a: Camera, b: Camera, mix: number }   Camera = { x, y, zoom, lookX, lookY }
export function shotAt(time, shots = TITLE_SHOTS)

export function createTitleScene({ image, depth })
// -> {
//   scene: THREE.Scene,
//   camera: THREE.Camera,
//   update(time /* 秒 */, width /* CSSピクセル */, height),
//   setReducedMotion(on: boolean),
//   dispose(),
// }
```

## shotAt の決まり
- 場面 i は `i * SHOT_SECONDS` 秒から `SHOT_SECONDS` 秒間。最後の場面のあとは最初に戻る（ずっと繰り返す）
- 場面の中の進み具合 p（0〜1）を easeInOut（`p * p * (3 - 2 * p)`）してから、`from` と `to` を直線で混ぜたものが `a`
- 場面の最後の `FADE_SECONDS` 秒は、次の場面の `from` を `b` とし、`mix` を 0 → 1 にする（`mix` も同じ easeInOut）。それ以外のときは `b` は `a` と同じ値、`mix` は 0
- time が負や数でないときは 0 とみなす

## 表示の決まり
- 画面いっぱいの板1枚（`OrthographicCamera(-1, 1, 1, -1, 0, 1)` と `PlaneGeometry(2, 2)`）に `ShaderMaterial`。`depthTest: false`、`depthWrite: false`
- 絵の置き方：画面の縦横比と絵の縦横比から「覆う」大きさを求め、`zoom` 倍に拡大し、カメラの `(x, y)` が画面中心に来るようにする。絵の外側を読まないよう、読み取る位置は 0〜1 に収める
- 立体のずれ：読み取る位置を `look * 強さ * (奥行き - 0.5) / zoom` だけずらす（強さは 0.03 くらい）。手前ほど大きくずれる。単純にずらすと輪郭が伸びて見えるので、数回（8回くらい）の段階で「その位置の奥行きでずらした結果が合うところ」を探す方法（視差遮蔽マッピングの簡単な形）にする
- 場面の切り替え：`a` と `b` の2つのカメラで絵を読み、`mix` で混ぜる（1回の描画で）
- 結晶の光：G の場所に、青緑 `#5ef2ff` を足す。強さは時間で 0.15〜0.45 をゆっくり（2.5 秒周期くらい）行き来
- 画面の端を少し暗く（周辺減光）
- 色：絵は sRGB。最後に `#include <colorspace_fragment>` を入れる（トーンマッピングは入れない）
- 火の粉：`THREE.Points` で 70 個。オレンジ（`#ff9a3c`〜`#ffd27a`）、加算合成、小さな丸（点の中で中心ほど明るく）。下から上へゆっくり昇りながら左右に揺れ、少しずつ消えて、上に出たら下からやり直す。位置は `mulberry32(7)` で決める（毎回同じ動き）。点の大きさは画面の高さに合わせる（`height` に比例。高さ 390 で 3〜6px くらい）
- `setReducedMotion(true)` のとき：カメラは常に `TITLE_SHOTS[0].from`、`mix` は 0、火の粉は動かさない（結晶の光の強弱も止める）
- `dispose()`：geometry・material を捨てる（渡されたテクスチャは捨てない）

## 必ず通るテスト
```js
import { test, expect } from 'vitest';
import * as THREE from 'three';
import { shotAt, createTitleScene, TITLE_SHOTS, SHOT_SECONDS, FADE_SECONDS } from '../src/ui/titleScene.js';

test('始まりは最初の場面の from、混ぜない', () => {
  const { a, mix } = shotAt(0);
  expect(a).toEqual(TITLE_SHOTS[0].from);
  expect(mix).toBe(0);
});
test('場面の途中は from と to の間', () => {
  const { a, mix } = shotAt(SHOT_SECONDS / 2);
  expect(a.zoom).toBeCloseTo((TITLE_SHOTS[0].from.zoom + TITLE_SHOTS[0].to.zoom) / 2);
  expect(mix).toBe(0);
});
test('場面の終わりは、次の場面の from へ溶ける', () => {
  const fading = shotAt(SHOT_SECONDS - FADE_SECONDS / 2);
  expect(fading.b).toEqual(TITLE_SHOTS[1].from);
  expect(fading.mix).toBeCloseTo(0.5);
  const next = shotAt(SHOT_SECONDS);
  expect(next.a).toEqual(TITLE_SHOTS[1].from);
  expect(next.mix).toBe(0);
});
test('最後の場面のあとは最初に戻る', () => {
  const total = SHOT_SECONDS * TITLE_SHOTS.length;
  expect(shotAt(total).a).toEqual(TITLE_SHOTS[0].from);
  expect(shotAt(total - FADE_SECONDS / 2).b).toEqual(TITLE_SHOTS[0].from);
});
test('scene に板と火の粉があり、update で動く', () => {
  const image = new THREE.Texture();
  const depth = new THREE.Texture();
  const title = createTitleScene({ image, depth });
  const meshes = title.scene.children.filter((child) => child.isMesh);
  const points = title.scene.children.filter((child) => child.isPoints);
  expect(meshes).toHaveLength(1);
  expect(points).toHaveLength(1);
  expect(points[0].geometry.getAttribute('position').count).toBe(70);
  const before = points[0].geometry.getAttribute('position').array.slice();
  title.update(1, 844, 390);
  title.update(2, 844, 390);
  expect(points[0].geometry.getAttribute('position').array).not.toEqual(before);
  title.dispose();
});
test('動きを減らす設定では、火の粉が止まる', () => {
  const title = createTitleScene({ image: new THREE.Texture(), depth: new THREE.Texture() });
  title.setReducedMotion(true);
  title.update(1, 844, 390);
  const points = title.scene.children.find((child) => child.isPoints);
  const before = points.geometry.getAttribute('position').array.slice();
  title.update(3, 844, 390);
  expect(points.geometry.getAttribute('position').array).toEqual(before);
});
```
