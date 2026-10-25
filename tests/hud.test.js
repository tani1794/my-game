// @vitest-environment happy-dom
import { test, expect } from 'vitest';
import { createHud } from '../src/ui/hud.js';

const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return { root, hud: createHud(root) };
};

test('体力とスタミナのバーが値に合わせて伸び縮みする', () => {
  const { root, hud } = make();
  hud.setVitals(50, 25);
  expect(root.querySelector('.bar.hp span').style.width).toBe('50%');
  expect(root.querySelector('.bar.stamina span').style.width).toBe('25%');
});

test('クエストの進み具合：討伐で 1 / 1、やり直しで 0 / 1', () => {
  const { root, hud } = make();
  hud.setQuest(true);
  expect(root.querySelector('.quest .count').textContent).toBe('1 / 1');
  hud.setQuest(false);
  expect(root.querySelector('.quest .count').textContent).toBe('0 / 1');
});

test('消音ボタン：消音にすると muted の見た目になり、戻すと外れる', () => {
  const { hud } = make();
  expect(hud.muteButton).toBeTruthy();
  hud.setMutedIcon(true);
  expect(hud.muteButton.classList.contains('muted')).toBe(true);
  expect(hud.muteButton.getAttribute('aria-label')).toBe('音を出す');
  hud.setMutedIcon(false);
  expect(hud.muteButton.classList.contains('muted')).toBe(false);
  expect(hud.muteButton.getAttribute('aria-label')).toBe('音を消す');
});
