// @vitest-environment happy-dom
import { test, expect } from 'vitest';
import {
  createTutorial,
  createTutorialView,
  TUTORIAL_TEXT,
} from '../src/ui/tutorial.js';

const idle = {
  moving: false,
  hit: false,
  telegraph: false,
  lock: false,
};

test('移動 → 攻撃 → ロックの順に出る', () => {
  const t = createTutorial();
  t.start(true);
  expect(t.update(0.1, idle)).toBe('move');
  expect(t.update(1.0, { ...idle, moving: true })).toBe('move');
  expect(t.update(1.0, { ...idle, moving: true })).toBe('attack');
  expect(t.update(0.1, { ...idle, hit: true })).toBe('lock');
  expect(t.update(0.1, { ...idle, lock: true })).toBe(null);
});

test('予告が出ている間は回避の説明、予告が消えたら終わり', () => {
  const t = createTutorial();
  t.start(true);
  expect(t.update(0.1, { ...idle, telegraph: true })).toBe('dodge');
  expect(t.update(0.1, { ...idle, telegraph: true })).toBe('dodge');
  expect(t.update(0.1, idle)).toBe('move');
  expect(t.update(0.1, { ...idle, telegraph: true })).toBe('move');
});

test('先にロックを押していれば、ロックの説明は出ない', () => {
  const t = createTutorial();
  t.start(true);
  t.update(0.1, { ...idle, lock: true });
  t.update(2.0, { ...idle, moving: true });
  expect(t.update(0.1, { ...idle, hit: true })).toBe(null);
});

test('start(false) では何も出さず、start(true) でやり直せる', () => {
  const t = createTutorial();
  expect(t.update(0.1, idle)).toBe(null);
  t.start(false);
  expect(t.update(0.1, idle)).toBe(null);
  t.start(true);
  t.update(2.0, { ...idle, moving: true });
  t.start(true);
  expect(t.update(0.1, idle)).toBe('move');
});

test('表示：文と置き場所、null で隠す', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const view = createTutorialView(root);
  const hint = root.querySelector('.tutorial-hint');
  view.show('attack');
  expect(hint.hidden).toBe(false);
  expect(hint.textContent).toBe(TUTORIAL_TEXT.attack);
  expect(hint.dataset.hint).toBe('attack');
  view.show(null);
  expect(hint.hidden).toBe(true);
});

test('やり直したら、歩いた時間も0から数え直す', () => {
  const t = createTutorial();
  t.start(true);
  t.update(1.9, { ...idle, moving: true });
  t.start(true);
  expect(t.update(0.5, { ...idle, moving: true })).toBe('move');
});

test('同じ説明を続けて show しても、出るときの動きをやり直さない', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const view = createTutorialView(root);
  const hint = root.querySelector('.tutorial-hint');
  view.show('move');
  hint.classList.remove('is-entering');
  view.show('move');
  expect(hint.classList.contains('is-entering')).toBe(false);
});
