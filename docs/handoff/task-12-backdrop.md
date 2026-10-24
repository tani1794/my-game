（ここから下をすべて ChatGPT に貼り付けてください）

# 依頼：3Dゲームの「遠景（山並みと夕焼けの空）」を three.js で作ってください

## 前提
- スマホ（iPhone 14 の Safari、横向き）向けの3Dアクションゲーム「OBLIVION ARENA」を作っています。夕方の山あいの遺跡で、大きな結晶獣と向き合う場面です
- 技術：Vite 8、three.js 0.186（`import * as THREE from 'three'`）、素の JavaScript（ES modules）。TypeScript は使いません
- テスト：Vitest 5（Node 環境。WebGL も画像の読み込みも使えません。`THREE.Scene` や `Mesh` の生成はできます）
- **新しいライブラリは追加しないでください**
- スマホで 60fps を出したいので、描画は軽くしてください

## 世界の座標
- 地面は x-z 平面で、y が上。1単位 = 1m。遊べる範囲は中心から半径 28m 以内
- 太陽は左奥の `(-30, 25, -40)` の方向（原点から見た向き）
- シーンには `THREE.FogExp2('#9fb4c8', 0.018)` の霧があり、`scene.background` も同じ色です
- カメラの far は 200

## 作るファイル
- `src/world/backdrop.js`
- `tests/backdrop.test.js`（下のテストを含め、必要なら追加してよい）

## 公開する関数（名前と引数は変えないでください）

```js
// 遠景の画像（パノラマ、横長、WebP）を、周囲を囲む筒の内側に貼る
// 読み込みに失敗したら Promise を reject する（呼び出し側で代わりの遠景に切り替える）
// loader は省略時 new THREE.TextureLoader()。テストで差し替えられるようにするための引数
export function createBackdrop(scene, url, loader) // -> Promise<THREE.Mesh>

// 画像を使わずに、コードだけで作る代わりの遠景
export function createFallbackBackdrop(scene) // -> THREE.Group
```

## createBackdrop（画像の遠景）
- 半径 90、高さ 60 の、上下が開いた筒（`CylinderGeometry(90, 90, 60, 64, 1, true)`）の**内側**に画像を貼る
- `MeshBasicMaterial`、`side: THREE.BackSide`、`fog: false`、`depthWrite: false`
- テクスチャの色空間は `THREE.SRGBColorSpace`
- 筒の下端は y = -5 あたり（地平線が自然な高さに来るように）
- 画像の中の太陽は、横幅の左から 25% の位置にあるものとします。その位置が、ワールドの太陽の方向 `(-30, 25, -40)` の水平方向と合うように、筒を `rotation.y` で回してください（計算式をコメントで説明してください）
- `renderOrder` を小さく（例：-1）して、ほかの物より先に描く
- メッシュの名前は `'backdrop'`

## createFallbackBackdrop（コードだけの遠景）
- 空：内側から見る大きな球（半径 95）。上が `#5d86b8`、地平線が `#f3c58a` のグラデーション。太陽の方向がほんのり明るくなると、なお良い。`ShaderMaterial` か頂点カラーで作り、`fog: false`、`depthWrite: false`、`side: THREE.BackSide`
- 山：半径 70〜85 の円周に、ローポリの山のシルエットを**3重**に並べる
  - 奥の列ほど青く薄く（例：手前 `#4a5a5e`、中 `#6d8196`、奥 `#9fb0c4`）、奥ほど高く
  - 山の稜線は `mulberry32` で毎回同じ形にする（`src/world/random.js` に作成済み：`export function mulberry32(seed) // -> () => number`、0 以上 1 未満）
  - 各列は `BufferGeometry` 1つにまとめる（三角形の帯）。マテリアルは `MeshBasicMaterial`（`fog: false`）
  - 山の高さは 8〜30m 程度。左右と奥を高く、手前（+z 方向）は低めに
- グループの名前は `'backdrop-fallback'`

## テスト（必ず通ること）

```js
import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createBackdrop, createFallbackBackdrop } from '../src/world/backdrop.js';

const okLoader = { loadAsync: async () => new THREE.Texture() };
const badLoader = { loadAsync: async () => { throw new Error('404'); } };

test('画像の遠景は筒の内側に貼られ、霧の影響を受けない', async () => {
  const scene = new THREE.Scene();
  const mesh = await createBackdrop(scene, '/textures/backdrop.webp', okLoader);
  expect(scene.getObjectByName('backdrop')).toBe(mesh);
  expect(mesh.material.side).toBe(THREE.BackSide);
  expect(mesh.material.fog).toBe(false);
  expect(mesh.material.map.colorSpace).toBe(THREE.SRGBColorSpace);
});

test('読み込みに失敗したら reject し、シーンに何も足さない', async () => {
  const scene = new THREE.Scene();
  await expect(createBackdrop(scene, '/missing.webp', badLoader)).rejects.toThrow();
  expect(scene.children).toHaveLength(0);
});

test('代わりの遠景は空と3列の山', () => {
  const scene = new THREE.Scene();
  const group = createFallbackBackdrop(scene);
  expect(scene.getObjectByName('backdrop-fallback')).toBe(group);
  expect(group.children).toHaveLength(4);
});

test('代わりの遠景の山は半径 70〜85 にあり、毎回同じ形', () => {
  const positions = () => {
    const group = createFallbackBackdrop(new THREE.Scene());
    return group.children.slice(1).map((m) => [...m.geometry.getAttribute('position').array]);
  };
  const a = positions();
  expect(a).toEqual(positions());
  for (const ring of a) {
    for (let i = 0; i < ring.length; i += 3) {
      const r = Math.hypot(ring[i], ring[i + 2]);
      expect(r).toBeGreaterThanOrEqual(69.9);
      expect(r).toBeLessThanOrEqual(85.1);
    }
  }
});
```

## 返答の形式
- 2つのファイルの**全文**を、それぞれファイル名を書いたコードブロックで返してください
- ほかのファイルの変更の提案は不要です
- 説明は短めにして、迷って決めたところがあれば最後に箇条書きで書いてください
