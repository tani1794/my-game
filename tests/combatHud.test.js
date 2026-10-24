// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createCombatHud } from '../src/ui/combatHud.js';

const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return { root, hud: createCombatHud(root) };
};

test('結晶獣の体力バー：表示・幅・怒り状態', () => {
  const { root, hud } = make();
  const bar = root.querySelector('.boss-bar');
  expect(bar.hidden).toBe(true);
  hud.setBeastVisible(true);
  hud.setBeast(0.5, false);
  expect(bar.hidden).toBe(false);
  expect(root.querySelector('.boss-bar-fill').style.width).toBe('50%');
  hud.setBeast(0.4, true);
  expect(bar.classList.contains('enraged')).toBe(true);
});

test('勝ちの画面に時間 4:05、もう一度で onRetry が呼ばれる', () => {
  const { root, hud } = make();
  const retry = vi.fn();
  hud.onRetry(retry);
  hud.showResult('won', 245);
  expect(root.querySelector('.result').hidden).toBe(false);
  expect(root.querySelector('.result-title').textContent).toBe('討伐完了');
  expect(root.querySelector('.result-time').textContent).toContain('4:05');
  root.querySelector('.result-retry').click();
  expect(retry).toHaveBeenCalledTimes(1);
  hud.hideResult();
  expect(root.querySelector('.result').hidden).toBe(true);
});

test('負けの画面', () => {
  const { root, hud } = make();
  hud.showResult('lost');
  expect(root.querySelector('.result-title').textContent).toBe('力尽きた');
});

test('ダメージの数字は最大8個で、0.6秒たつと消える', () => {
  const { root, hud } = make();
  for (let i = 0; i < 9; i++) hud.showDamage({ x: 100, y: 100 }, 10 + i);
  const numbers = root.querySelectorAll('.damage-number');
  expect(numbers).toHaveLength(8);
  expect(numbers[0].textContent).toBe('11');
  hud.update(0.7);
  expect(root.querySelectorAll('.damage-number')).toHaveLength(0);
});

test('照準マークと clear', () => {
  const { root, hud } = make();
  hud.setReticle({ x: 200, y: 120 });
  expect(root.querySelector('.reticle').hidden).toBe(false);
  hud.showDamage({ x: 1, y: 1 }, 5);
  hud.showResult('lost');
  hud.clear();
  expect(root.querySelector('.reticle').hidden).toBe(true);
  expect(root.querySelectorAll('.damage-number')).toHaveLength(0);
  expect(root.querySelector('.result').hidden).toBe(true);
});
