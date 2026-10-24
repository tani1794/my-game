# 依頼：結晶獣の攻撃の「予告」の見た目（src/world/telegraph.js）

地面に出るオレンジの予告（扇・帯・円）です。当たり判定やタイマーは持たず、渡された状態を描くだけです。

## 作るファイル
- `src/world/telegraph.js`
- `tests/telegraph.test.js`

## 渡されるもの
```js
// 形（shapes.js と同じ）
{ type: 'circle', x, z, radius }
{ type: 'sector', x, z, angle, radius, spread }   // spread は全体の角度。angle を中心に ±spread/2
{ type: 'band',   x, z, angle, width, length }    // (x, z) から angle の向きへ length 伸びる幅 width の長方形
// attack（null のこともある）
{ kind: 'slam' | 'charge' | 'spin' | 'rain', shapes: Shape[], progress: number /* 0→1 */, impact: boolean }
```

## 公開する関数（名前と引数は変えないでください）
```js
export function createTelegraphs(scene, heightAt /* (x, z) => 地面の高さ */)
// -> { sync(attack | null, enraged: boolean), clear() }
```

## 決まり
- 形1つにつき `THREE.Group`（名前 `telegraph-0`〜`telegraph-4`）を1つ使い、その中に名前 `edge`（縁）と `fill`（塗りつぶし）の2つのメッシュを入れる
- グループは形の `(x, heightAt(x, z) + 0.04, z)` に置き、`rotation.y = angle`（円は0）。ジオメトリは +z 向きを前として作る
- 縁：明るいオレンジ `#ffb347`、不透明度 0.9、太さ 0.12m の輪郭（扇は弧と左右の辺、帯は四辺、円は円周）。怒り状態（`enraged`）では `#ff5a3c`
- 塗りつぶし：`#ff8a2b`、不透明度 0.35。**大きさを scale で表す**：円と扇は `fill.scale.x` と `fill.scale.z` を `progress` に、帯は `fill.scale.z` を `progress` に（帯は根元から先へ伸びる）。`impact` が true のときは scale 1・不透明度 0.6
- マテリアルは `MeshBasicMaterial`、`transparent: true`、`depthWrite: false`、`fog: false`、`side: THREE.DoubleSide`
- 同時に出る形は最大5つ。グループとメッシュは最初に5つ分作って使い回し、毎回作り直さない。形の種類が変わったときだけジオメトリを差し替えてよい（古いものは dispose）
- `sync(null)` と `clear()` ですべてのグループを `visible = false` にする

## 必ず通るテスト
```js
import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createTelegraphs } from '../src/world/telegraph.js';
const flat = () => 0;
const shown = (scene) => scene.children.filter((o) => o.name.startsWith('telegraph-') && o.visible);
const sector = { type: 'sector', x: 0, z: -6, angle: 0, radius: 5, spread: 1.745 };
const band = { type: 'band', x: 0, z: -6, angle: 0, width: 4, length: 14 };
const circle = (x) => ({ type: 'circle', x, z: 0, radius: 1.6 });

test('扇・帯・円のそれぞれで、縁と塗りつぶしが見える', () => {
  for (const shape of [sector, band, circle(0)]) {
    const scene = new THREE.Scene();
    createTelegraphs(scene, flat).sync({ kind: 'slam', shapes: [shape], progress: 0.3, impact: false }, false);
    const [group] = shown(scene);
    expect(group.getObjectByName('edge').visible).toBe(true);
    expect(group.getObjectByName('fill').visible).toBe(true);
  }
});
test('塗りつぶしは progress に合わせて広がる（帯は長さ方向だけ）', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);
  t.sync({ kind: 'slam', shapes: [circle(0)], progress: 0.5, impact: false }, false);
  expect(shown(scene)[0].getObjectByName('fill').scale.x).toBeCloseTo(0.5);
  t.sync({ kind: 'charge', shapes: [band], progress: 0.25, impact: false }, false);
  const fill = shown(scene)[0].getObjectByName('fill');
  expect(fill.scale.z).toBeCloseTo(0.25);
  expect(fill.scale.x).toBeCloseTo(1);
});
test('5つ出した後に2つにすると、3つ隠れる。clear で全部隠れる', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);
  t.sync({ kind: 'rain', shapes: [0, 3, 6, 9, 12].map(circle), progress: 0.1, impact: false }, false);
  expect(shown(scene)).toHaveLength(5);
  t.sync({ kind: 'rain', shapes: [0, 3].map(circle), progress: 0.2, impact: false }, false);
  expect(shown(scene)).toHaveLength(2);
  t.clear();
  expect(shown(scene)).toHaveLength(0);
});
test('何度 sync してもシーンの物は増えない', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);
  const count = () => { let n = 0; scene.traverse(() => n++); return n; };
  t.sync({ kind: 'slam', shapes: [sector], progress: 0.1, impact: false }, false);
  const before = count();
  for (let i = 0; i < 30; i++) t.sync({ kind: 'slam', shapes: [sector], progress: i / 30, impact: false }, false);
  expect(count()).toBe(before);
});
test('怒り状態では縁が赤寄り、impact では塗りつぶしが全面', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);
  t.sync({ kind: 'spin', shapes: [circle(0)], progress: 1, impact: true }, true);
  const g = shown(scene)[0];
  expect('#' + g.getObjectByName('edge').material.color.getHexString()).toBe('#ff5a3c');
  expect(g.getObjectByName('fill').scale.x).toBeCloseTo(1);
  expect(g.getObjectByName('fill').material.opacity).toBeCloseTo(0.6);
});
test('地面の高さ + 0.04 に置き、向きを合わせる', () => {
  const scene = new THREE.Scene();
  createTelegraphs(scene, () => 0.3).sync({ kind: 'charge', shapes: [{ ...band, angle: Math.PI }], progress: 0.5, impact: false }, false);
  const g = shown(scene)[0];
  expect(g.position.y).toBeCloseTo(0.34);
  expect(g.rotation.y).toBeCloseTo(Math.PI);
});
```
