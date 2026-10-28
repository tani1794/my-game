import { test, expect } from 'vitest';
import { pointedArchPoints } from '../src/areas/rose/architecture.js';

test('尖頭アーチの輪郭：幅と高さどおり、左右対称で、頂点は中央', () => {
  const points = pointedArchPoints(2, 4);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  expect(Math.min(...xs)).toBeCloseTo(-1);
  expect(Math.max(...xs)).toBeCloseTo(1);
  expect(Math.max(...ys)).toBeCloseTo(4, 5);
  const apex = points.find((p) => Math.abs(p[1] - 4) < 1e-6);
  expect(apex[0]).toBeCloseTo(0, 5);
  for (const [x, y] of points) expect(points.some(([x2, y2]) => Math.abs(x2 + x) < 1e-6 && Math.abs(y2 - y) < 1e-6)).toBe(true);
});
