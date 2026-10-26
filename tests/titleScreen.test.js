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
  const start = root.querySelector('.title-start');
  expect(start.tagName).toBe('BUTTON');
  expect(start.textContent).toBe('TAP TO BEGIN');
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

test('題字は読み込みが終わるまで出さず、reveal で現れて明滅を始める', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const title = createTitleScreen(root, { image: '/textures/silent-art.webp', logo: '/textures/silent-title.webp' });
  title.show(null);
  const screen = root.querySelector('.title-screen');
  expect(root.querySelector('.title-logo').getAttribute('alt')).toBe('THE SILENT CROWN');
  expect(screen.classList.contains('is-revealed')).toBe(false);
  title.reveal();
  expect(screen.classList.contains('is-revealed')).toBe(true);
});

test('TAP TO BEGIN を押すと1回だけ開始。Enter キーでも開始できる', () => {
  const { root, title } = make();
  const start = vi.fn();
  title.onStart(start);
  title.show(null);
  root.querySelector('.title-start').click();
  expect(start).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(start).toHaveBeenCalledTimes(2);
  title.hide();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(start).toHaveBeenCalledTimes(2);
});

test('ボタンにフォーカスがあるときの Enter は、ボタンの押下（click）に任せて二重に開始しない', () => {
  const { root, title } = make();
  const start = vi.fn();
  title.onStart(start);
  title.show(null);
  const button = root.querySelector('.title-start');
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(start).toHaveBeenCalledTimes(0);
});

test('お知らせはタイトル画面の中に出す（タイトル中もほかの画面は隠れているため）', () => {
  const { root, title } = make();
  title.show(null);
  title.showNotice('この端末では遊べません');
  const notice = root.querySelector('.title-screen .title-notice');
  expect(notice.textContent).toBe('この端末では遊べません');
  expect(notice.hidden).toBe(false);
});

test('はじめの1回（setPrelude）：TAP TO AWAKEN を押すと onAwaken だけ。そのあと TAP TO BEGIN で開始', () => {
  const { root, title } = make();
  const awaken = vi.fn();
  const start = vi.fn();
  title.onAwaken(awaken);
  title.onStart(start);
  title.setPrelude(true);
  title.show(null);
  const button = root.querySelector('.title-start');
  expect(button.textContent).toBe('TAP TO AWAKEN');
  root.querySelector('.title-screen').click();
  expect(awaken).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
  expect(button.textContent).toBe('TAP TO BEGIN');
  button.click();
  expect(start).toHaveBeenCalledTimes(1);
  expect(awaken).toHaveBeenCalledTimes(1);
});

test('はじめの1回は Enter キーでも同じ（1回目は音、2回目で開始）', () => {
  const { title } = make();
  const awaken = vi.fn();
  const start = vi.fn();
  title.onAwaken(awaken);
  title.onStart(start);
  title.setPrelude(true);
  title.show(null);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(awaken).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(start).toHaveBeenCalledTimes(1);
});

test('はじめから：保存があるときだけ出て、2回押すと onNewGame（画面のタップとしては数えない）', () => {
  const { root, title } = make();
  const start = vi.fn();
  const fresh = vi.fn();
  title.onStart(start);
  title.onNewGame(fresh);
  title.show(null);
  const button = root.querySelector('.title-new-game');
  expect(button.hidden).toBe(true);
  title.setNewGame(true);
  expect(button.hidden).toBe(false);
  button.click();
  expect(fresh).not.toHaveBeenCalled();
  expect(button.textContent).toContain('もう一度');
  button.click();
  expect(fresh).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
  expect(button.hidden).toBe(true);
});
