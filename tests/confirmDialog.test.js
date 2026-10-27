// @vitest-environment happy-dom
import { test, expect } from 'vitest';
import { createConfirmDialog } from '../src/ui/confirmDialog.js';

const make = () => { const root = document.createElement('div'); document.body.append(root); return { root, dialog: createConfirmDialog(root) }; };

test('問いと補足を出し、「はい」で true', async () => {
  const { root, dialog } = make();
  const answer = dialog.ask({ title: '晶冠峡谷〈結晶の谷〉へ進みますか？', note: 'この先は、蒼響の洞穴を通る巡礼路です。' });
  expect(root.querySelector('.confirm-dialog').hidden).toBe(false);
  expect(root.querySelector('.confirm-title').textContent).toBe('晶冠峡谷〈結晶の谷〉へ進みますか？');
  expect(root.querySelector('.confirm-note').textContent).toBe('この先は、蒼響の洞穴を通る巡礼路です。');
  expect(dialog.open()).toBe(true);
  root.querySelector('[data-answer="yes"]').click();
  expect(await answer).toBe(true);
  expect(root.querySelector('.confirm-dialog').hidden).toBe(true);
  expect(dialog.open()).toBe(false);
});

test('「いいえ」・Escape で false。開いている間に重ねて開かない', async () => {
  const { root, dialog } = make();
  const first = dialog.ask({ title: 'a', note: 'b' });
  const second = dialog.ask({ title: 'c', note: 'd' });
  expect(root.querySelector('.confirm-title').textContent).toBe('a');
  root.querySelector('[data-answer="no"]').click();
  expect(await first).toBe(false);
  expect(await second).toBe(false);
  const third = dialog.ask({ title: 'e', note: 'f' });
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(await third).toBe(false);
});
