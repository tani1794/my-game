import { test, expect } from 'vitest';
import { computeDamage, attackPower, STANDARD_DEFENSE, COMBO_POWER } from '../src/combat/damage.js';

test('進化前は、今までと同じ 10・12・22（防御なしの相手）', () => {
  const atk = attackPower({ evolved: false });
  expect(atk).toBe(10);
  expect(COMBO_POWER.map((power) => computeDamage({ attack: atk, power, defense: 0 }))).toEqual([10, 12, 22]);
});

test('進化後の攻撃力は 35。何度計算しても重ならない', () => {
  expect(attackPower({ evolved: true })).toBe(35);
  expect(attackPower({ evolved: true })).toBe(35);
});

test('標準の防御の敵への3段の平均は 30〜40', () => {
  const atk = attackPower({ evolved: true });
  const hits = COMBO_POWER.map((power) => computeDamage({ attack: atk, power, defense: STANDARD_DEFENSE }));
  const average = hits.reduce((a, b) => a + b, 0) / hits.length;
  expect(average).toBeGreaterThanOrEqual(30);
  expect(average).toBeLessThanOrEqual(40);
  // 相手ごとに違う（固定の 35 ではない）
  expect(new Set(hits).size).toBe(3);
});

test('弱点・会心・防御中は別の倍率で、防御が高いほど減る', () => {
  const base = computeDamage({ attack: 35, power: 1, defense: 45 });
  expect(computeDamage({ attack: 35, power: 1, defense: 45, weak: true })).toBe(Math.round(base * 1.5));
  expect(computeDamage({ attack: 35, power: 1, defense: 45, critical: true })).toBe(Math.round(base * 1.5));
  expect(computeDamage({ attack: 35, power: 1, defense: 45, guarding: true })).toBe(Math.max(1, Math.round(base * 0.3)));
  expect(computeDamage({ attack: 35, power: 1, defense: 120 })).toBeLessThan(base);
  expect(computeDamage({ attack: 1, power: 1, defense: 999, guarding: true })).toBe(1);
});
