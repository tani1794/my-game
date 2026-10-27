import { test, expect } from 'vitest';
import { createBossLogic } from '../src/areas/bossLogic.js';
import { bodyColliders } from '../src/combat/battle.js';

const boss = { start: { x: 0, z: -6, facing: 0 }, bounds: 9, hp: 1000, defense: 45 };
const sword = (x, z, angle) => ({ type: 'sector', x, z, angle, radius: 1.6, spread: (120 * Math.PI) / 180 });

test('始まるまでは動かず、当たりも出さない', () => {
  const logic = createBossLogic(boss);
  let calls = 0;
  for (let t = 0; t < 5; t += 0.05) logic.update(0.05, { x: 0, z: 0 }, () => { calls += 1; return true; });
  expect(calls).toBe(0);
  expect(logic.active()).toBe(false);
  expect(logic.swordHit(sword(0, -2.5, Math.PI), { attack: 35, power: 1, critical: false })).toBeNull();
});

test('戦いが始まると攻撃してくる（予告のあと当たる）', () => {
  const logic = createBossLogic(boss);
  logic.start();
  const damages = [];
  for (let t = 0; t < 12; t += 0.02) logic.update(0.02, { x: 0, z: -1 }, (damage) => { damages.push(damage); return true; });
  expect(damages.length).toBeGreaterThan(0);
  expect(damages.every((d) => [20, 25, 30, 35].includes(d))).toBe(true);
});

test('斬ると、防御つきのダメージの計算で減る（35・防御45・1段目 → 24）', () => {
  const logic = createBossLogic(boss);
  logic.start();
  const frame = logic.update(0.01, { x: 0, z: 0 }, () => false);
  const front = bodyColliders(frame.position, frame.facing)[0];
  const result = logic.swordHit(sword(front.x, front.z + front.radius + 1, Math.PI), { attack: 35, power: 1, critical: false });
  expect(result.damage).toBe(24);
  expect(logic.update(0.01, { x: 0, z: 0 }, () => false).hp).toBe(976);
});

test('体力0で倒れ、defeated の出来事が一度だけ出る。そのあとは攻撃しない', () => {
  const logic = createBossLogic({ ...boss, hp: 30 });
  logic.start();
  const frame = logic.update(0.01, { x: 0, z: 0 }, () => false);
  const front = bodyColliders(frame.position, frame.facing)[0];
  const result = logic.swordHit(sword(front.x, front.z + front.radius + 1, Math.PI), { attack: 35, power: 2.2, critical: false });
  expect(result.dead).toBe(true);
  const events = [];
  let calls = 0;
  for (let t = 0; t < 5; t += 0.05) events.push(...logic.update(0.05, { x: 0, z: -1 }, () => { calls += 1; return true; }).events);
  expect(events.filter((e) => e.type === 'defeated')).toHaveLength(1);
  expect(calls).toBe(0);
});

test('reset で体力も位置も戻り、待つ状態に戻る（倒れたあとの再挑戦）', () => {
  const logic = createBossLogic(boss);
  logic.start();
  for (let t = 0; t < 3; t += 0.05) logic.update(0.05, { x: 5, z: 0 }, () => true);
  logic.reset();
  expect(logic.active()).toBe(false);
  const frame = logic.update(0.01, { x: 0, z: 0 }, () => true);
  expect(frame.hp).toBe(1000);
  expect(frame.position).toEqual({ x: 0, z: -6 });
});
