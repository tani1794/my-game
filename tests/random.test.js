import { test, expect } from 'vitest';
import { mulberry32 } from '../src/world/random.js';

test('同じ種なら毎回同じ並びになる', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 5; i++) expect(a()).toBe(b());
});

test('種が違えば並びも違う', () => {
  expect(mulberry32(7)()).not.toBe(mulberry32(8)());
});

test('値は 0 以上 1 未満', () => {
  const next = mulberry32(3);
  for (let i = 0; i < 1000; i++) {
    const v = next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
