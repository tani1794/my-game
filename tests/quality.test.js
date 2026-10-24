import { test, expect } from 'vitest';
import { resolveQuality, createAutoDowngrade } from '../src/quality.js';

const run = (ad, fps, seconds) => {
  let r = null;
  for (let t = 0; t < seconds; t += 1 / fps) r = ad.update(1 / fps) ?? r;
  return r;
};

test('URL指定', () => {
  expect(resolveQuality('?q=high')).toEqual({ tier: 'high', locked: true, debug: false });
  expect(resolveQuality('?q=ultra&debug')).toEqual({ tier: 'mid', locked: false, debug: true });
  expect(resolveQuality('')).toEqual({ tier: 'mid', locked: false, debug: false });
});

test('30fpsが続けば mid→low、60fpsなら下げない', () => {
  expect(run(createAutoDowngrade('mid'), 30, 5)).toBe('low');
  expect(run(createAutoDowngrade('mid'), 60, 5)).toBeNull();
});

test('low より下には下げない', () => {
  expect(run(createAutoDowngrade('low'), 20, 10)).toBeNull();
});

test('裏に回った後の長いフレームは無視する', () => {
  const ad = createAutoDowngrade('mid');
  run(ad, 60, 2);
  ad.update(5);
  ad.update(3);
  expect(run(ad, 60, 3)).toBeNull();
});
