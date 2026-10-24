import { test, expect } from 'vitest';
import { moveToWorld, speedFor, stepPosition } from '../src/player.js';

test('yaw 0 で前進すると -z へ進む', () => {
  const d = moveToWorld(0, 1, 0);
  expect(d.x).toBeCloseTo(0);
  expect(d.z).toBeCloseTo(-1);
});

test('速さ：走りは6、スティック半分は1.5、倒し量は1で頭打ち', () => {
  expect(speedFor({ moveX: 0, moveZ: 1, run: true })).toBe(6);
  expect(speedFor({ moveX: 0, moveZ: 0.5, run: false })).toBeCloseTo(1.5);
  expect(speedFor({ moveX: 1, moveZ: 1, run: false })).toBeCloseTo(3);
});

test('岩に正面からぶつかると止まり、斜めなら壁沿いに滑る', () => {
  const rock = [{ x: 0, z: -1, radius: 0.5 }];
  expect(stepPosition({ x: 0, z: 0 }, { x: 0, z: -1 }, 0.2, rock)).toEqual({ x: 0, z: 0 });
  const slid = stepPosition({ x: 0, z: 0 }, { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, 0.2, rock);
  expect(slid.x).toBeGreaterThan(0);
  expect(slid.z).toBe(0);
});

test('移動範囲 28 の外には出ない', () => {
  expect(stepPosition({ x: 27.9, z: 0 }, { x: 1, z: 0 }, 1, []).x).toBe(27.9);
});
