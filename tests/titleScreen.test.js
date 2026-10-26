// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createTitleScreen } from '../src/ui/titleScreen.js';

const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return {
    root,
    title: createTitleScreen(root, {
      image: '/textures/title.webp',
    }),
  };
};

test('最初は隠れていて、show で出る。画像が入る', () => {
  const { root, title } = make();
  const screen = root.querySelector('.title-screen');
  expect(screen.hidden).toBe(true);
  title.show(null);
  expect(screen.hidden).toBe(false);
  expect(root.querySelector('.title-art').getAttribute('src')).toBe('/textures/title.webp');
  expect(root.querySelector('.title-start').textContent).toBe('タップで開始');
});

test('最速記録：あれば m:ss、なければ隠す', () => {
  const { root, title } = make();
  title.show(65.9);
  const best = root.querySelector('.title-best');
  expect(best.hidden).toBe(false);
  expect(best.textContent).toContain('1:05');
  title.show(null);
  expect(best.hidden).toBe(true);
});

test('表示中のタップで onStart、隠れているときは呼ばない', () => {
  const { root, title } = make();
  const start = vi.fn();
  title.onStart(start);
  root.querySelector('.title-screen').click();
  expect(start).not.toHaveBeenCalled();
  title.show(null);
  root.querySelector('.title-art').click();
  expect(start).toHaveBeenCalledTimes(1);
  title.hide();
  expect(root.querySelector('.title-screen').hidden).toBe(true);
});

test('ロゴを重ねて出し、3D表示に切り替えられる', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const title = createTitleScreen(root, { image: '/textures/title-art.webp', logo: '/textures/title-logo.webp' });
  const screen = root.querySelector('.title-screen');
  expect(root.querySelector('.title-logo').getAttribute('src')).toBe('/textures/title-logo.webp');
  expect(screen.classList.contains('is-3d')).toBe(false);
  title.setDepthMode(true);
  expect(screen.classList.contains('is-3d')).toBe(true);
});

test('タイトルを出している間は、root に title-open を付ける（ほかの画面を隠すため）', () => {
  const { root, title } = make();
  title.show(null);
  expect(root.classList.contains('title-open')).toBe(true);
  title.hide();
  expect(root.classList.contains('title-open')).toBe(false);
});
