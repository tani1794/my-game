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

// ── 押した瞬間の入力（攻撃・回避・ロック） ──
test('bindTap した要素を押すと、takePresses に1回だけ入る', () => {
  const input = createInput();
  const button = document.createElement('button');
  input.bindTap(button, 'attack');
  button.dispatchEvent(new Event('pointerdown'));
  expect([...input.takePresses()]).toEqual(['attack']);
  expect(input.takePresses().size).toBe(0);
});

test('キーボード：J で攻撃、K と Space で回避、L でロック。押しっぱなしの繰り返しは数えない', () => {
  const input = createInput();
  const press = (code, repeat = false) => window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }));
  press('KeyJ');
  press('KeyJ', true);
  press('Space');
  press('KeyL');
  const presses = input.takePresses();
  expect([...presses].sort()).toEqual(['attack', 'dodge', 'lock']);
});

test('clear で押した記録も消える', () => {
  const input = createInput();
  const button = document.createElement('button');
  input.bindTap(button, 'dodge');
  button.dispatchEvent(new Event('pointerdown'));
  input.clear();
  expect(input.takePresses().size).toBe(0);
});
