// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createPauseMenu } from '../src/ui/pauseMenu.js';

const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return { root, menu: createPauseMenu(root) };
};

test('一時停止ボタン：最初は隠れていて、押すと pause', () => {
  const { root, menu } = make();
  const button = root.querySelector('.pause-button');
  expect(button.hidden).toBe(true);
  menu.setButtonVisible(true);
  expect(button.hidden).toBe(false);
  const pause = vi.fn();
  menu.on('pause', pause);
  button.click();
  expect(pause).toHaveBeenCalledTimes(1);
});

test('メニューの表示と、各ボタンの知らせ', () => {
  const { root, menu } = make();
  const panel = root.querySelector('.pause-menu');
  expect(panel.hidden).toBe(true);
  menu.show({ muted: false, quality: 'mid' });
  expect(panel.hidden).toBe(false);
  for (const action of ['resume', 'retry', 'title', 'mute', 'tutorial']) {
    const callback = vi.fn();
    menu.on(action, callback);
    root.querySelector(`[data-action="${action}"]`).click();
    expect(callback).toHaveBeenCalledTimes(1);
  }
  menu.hide();
  expect(panel.hidden).toBe(true);
});

test('音の表示', () => {
  const { root, menu } = make();
  menu.show({ muted: true, quality: 'high' });
  const mute = root.querySelector('[data-action="mute"]');
  expect(mute.textContent).toContain('オフ');
  menu.setMuted(false);
  expect(mute.textContent).toContain('オン');
});

test('画質：選んだものを知らせ、表示を合わせる', () => {
  const { root, menu } = make();
  const quality = vi.fn();
  menu.on('quality', quality);
  menu.show({ muted: false, quality: 'mid' });
  expect(root.querySelector('[data-quality="mid"]').classList.contains('selected')).toBe(true);
  root.querySelector('[data-quality="low"]').click();
  expect(quality).toHaveBeenCalledWith('low');
  menu.setQuality('low');
  expect(root.querySelector('[data-quality="low"]').getAttribute('aria-pressed')).toBe('true');
  expect(root.querySelector('[data-quality="mid"]').classList.contains('selected')).toBe(false);
});

test('同じ action に複数の callback を登録できる', () => {
  const { root, menu } = make();
  const first = vi.fn();
  const second = vi.fn();

  menu.on('resume', first);
  menu.on('resume', second);
  root.querySelector('[data-action="resume"]').click();

  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
});
