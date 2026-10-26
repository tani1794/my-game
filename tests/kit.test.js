import { test, expect } from 'vitest';
import { createLevel, reachable } from '../src/areas/kit.js';

const level = createLevel({
  floors: [
    { id: 'low', type: 'rect', x0: 0, x1: 10, z0: 0, z1: 10, y: 0 },
    // 上の段（低い段の真上に重なる）
    { id: 'high', type: 'rect', x0: 0, x1: 10, z0: 20, z1: 30, y: 5 },
    { id: 'ledge', type: 'rect', x0: 2, x1: 8, z0: 4, z1: 8, y: 5 },
    // 坂：低い段から上の段へ
    { id: 'ramp', type: 'path', points: [[5, 10, 0], [5, 20, 5]], width: 3 },
    { id: 'bridge', type: 'path', points: [[10, 25, 5], [30, 25, 5]], width: 2, when: 'bridgeDown' },
    { id: 'far', type: 'circle', x: 34, z: 25, radius: 4, y: 5 },
    { id: 'flooded', type: 'rect', x0: -10, x1: 0, z0: 0, z1: 4, y: -1, when: 'drained' },
  ],
  walls: [{ from: [0, 15], to: [4, 15], thickness: 0.6, height: 3, unless: 'wallDown' }],
});

test('床の上の高さ。坂は途中の高さ', () => {
  expect(level.heightAt(5, 5, 0)).toBe(0);
  expect(level.heightAt(5, 15, 2.5)).toBeCloseTo(2.5);
  expect(level.heightAt(5, 25, 5)).toBe(5);
});

test('上下に重なる所：今いる高さに近い床を使う', () => {
  expect(level.heightAt(5, 6, 0)).toBe(0);
  expect(level.heightAt(5, 6, 5)).toBe(5);
});

test('高い所から、真下の低い床へは歩いて降りられない（縁で止まる）', () => {
  const state = {};
  expect(level.walkable(5, 6, 5, state)).toBe(true);
  // 上の段（ledge）の縁の外は、低い床があっても高さが合わないので歩けない
  expect(level.walkable(5, 9, 5, state)).toBe(false);
  expect(level.walkable(5, 9, 0, state)).toBe(true);
});

test('仕掛けで出る床・消える壁', () => {
  expect(level.walkable(20, 25, 5, {})).toBe(false);
  expect(level.walkable(20, 25, 5, { bridgeDown: true })).toBe(true);
  expect(level.walkable(-5, 2, 0, {})).toBe(false);
  expect(level.walkable(-5, 2, -0.5, { drained: true })).toBe(true);
  expect(level.colliders({}).length).toBe(1);
  expect(level.colliders({ wallDown: true }).length).toBe(0);
});

test('reachable：仕掛けの前後で、たどり着けるかが変わる', () => {
  const from = { x: 5, z: 2, y: 0 };
  const to = { x: 34, z: 25 };
  expect(reachable(level, from, to, {})).toBe(false);
  expect(reachable(level, from, to, { bridgeDown: true })).toBe(true);
});
