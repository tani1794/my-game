# 依頼：戦闘の当たり判定の形（src/combat/shapes.js）

three.js も DOM も import しない、純粋な関数だけのファイルです。

## 作るファイル
- `src/combat/shapes.js`
- `tests/shapes.test.js`

## 形の書き方
```js
{ type: 'circle', x, z, radius }
{ type: 'sector', x, z, angle, radius, spread }   // spread は扇の全体の角度（ラジアン）。向き angle を中心に ±spread/2
{ type: 'band',   x, z, angle, width, length }    // (x, z) から angle の向きへ length 伸びる、幅 width の長方形（根元の後ろには伸びない）
```

## 公開する関数（名前と引数は変えないでください）
```js
export function shapeContains(shape, point /* {x, z} */) // -> boolean。境目は含む（小さな誤差 1e-9 は許す）
export function sectorHitsCircle(sector, circle /* {x, z, radius} */) // -> boolean。扇と円が少しでも重なれば true（円の中心が扇の外でも、円の縁が扇に入れば true。扇の弧・左右の辺・頂点との接触を含む）
export function angleTo(from /* {x,z} */, to /* {x,z} */) // -> from から to を向く角度（atan2(dx, dz)）
export function angleDiff(a, b) // -> a から b への差を −π〜π に正規化
```

## 必ず通るテスト
```js
import { test, expect } from 'vitest';
import { shapeContains, sectorHitsCircle, angleTo, angleDiff } from '../src/combat/shapes.js';
const P = (x, z) => ({ x, z });
test('円', () => {
  const c = { type: 'circle', x: 0, z: 0, radius: 2 };
  expect(shapeContains(c, P(2, 0))).toBe(true);
  expect(shapeContains(c, P(2.01, 0))).toBe(false);
});
test('扇：+z 向き、半径5、100度', () => {
  const s = { type: 'sector', x: 0, z: 0, angle: 0, radius: 5, spread: (100 * Math.PI) / 180 };
  expect(shapeContains(s, P(0, 4))).toBe(true);
  expect(shapeContains(s, P(0, -1))).toBe(false);
  expect(shapeContains(s, P(4, 1))).toBe(false);
  expect(shapeContains(s, P(0, 5.1))).toBe(false);
});
test('帯：-z 向き、幅4、長さ14', () => {
  const b = { type: 'band', x: 0, z: 0, angle: Math.PI, width: 4, length: 14 };
  expect(shapeContains(b, P(1.9, -13))).toBe(true);
  expect(shapeContains(b, P(2.1, -5))).toBe(false);
  expect(shapeContains(b, P(0, 0.5))).toBe(false);
});
test('扇と円の重なり（円の中心が扇の外でも、縁が入れば当たる）', () => {
  const s = { type: 'sector', x: 0, z: 0, angle: 0, radius: 2.2, spread: (120 * Math.PI) / 180 };
  expect(sectorHitsCircle(s, { x: 0, z: 4, radius: 2 })).toBe(true);
  expect(sectorHitsCircle(s, { x: 0, z: -3, radius: 0.5 })).toBe(false);
});
test('角度', () => {
  expect(angleTo(P(0, 0), P(1, 0))).toBeCloseTo(Math.PI / 2);
  expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
});
```
回転させた形（angle が 45 度など）、負の座標、扇の左右の辺に円が接する場合、扇の頂点に円が重なる場合のテストも追加してください。
