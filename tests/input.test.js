// @vitest-environment happy-dom
import { test, expect } from 'vitest';
import { combineMove, createInput } from '../src/input.js';

test('キーボードとスティックを足すと、長さは1で頭打ち', () => {
  const m = combineMove({ x: 1, z: 0 }, { x: 0, z: 1 });
  expect(Math.hypot(m.x, m.z)).toBeCloseTo(1);
});

test('スティックを半分倒すと、その分だけ動く', () => {
  expect(combineMove({ x: 0, z: 0 }, { x: 0, z: 0.5 })).toEqual({ x: 0, z: 0.5 });
});

test('clear() でスティックの入力も消える', () => {
  const input = createInput();
  input.setStick({ x: 0, z: 1 });
  input.clear();
  expect(input.read()).toMatchObject({ moveX: 0, moveZ: 0, run: false });
});

test('read() にスティックの入力が反映される', () => {
  const input = createInput();
  input.setStick({ x: 0.3, z: 0.4 });
  expect(input.read().moveX).toBeCloseTo(0.3);
  expect(input.read().moveZ).toBeCloseTo(0.4);
});
