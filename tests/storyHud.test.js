// @vitest-environment happy-dom
import { test, expect, vi } from 'vitest';
import { createStoryHud } from '../src/ui/storyHud.js';

const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  return { root, hud: createStoryHud(root) };
};

test('最初は隠れていて、setVisible で出る', () => {
  const { root, hud } = make();
  expect(root.querySelector('.story-hud').hidden).toBe(true);
  hud.setVisible(true);
  expect(root.querySelector('.story-hud').hidden).toBe(false);
});

test('目的の表示と非表示', () => {
  const { root, hud } = make();
  hud.setObjective('霧の森を進む');
  expect(root.querySelector('.story-objective').textContent).toContain('霧の森を進む');
  expect(root.querySelector('.story-objective').hidden).toBe(false);
  hud.setObjective(null);
  expect(root.querySelector('.story-objective').hidden).toBe(true);
});

test('字幕は置き換わり、履歴に残る', () => {
  const { root, hud } = make();
  hud.say({ speaker: 'エリア', text: '……聞こえますか？' });
  hud.say({ speaker: 'エリア', text: 'よかった。今度は、届いた。' });
  expect(root.querySelector('.story-speaker').textContent).toBe('エリア');
  expect(root.querySelector('.story-text').textContent).toBe('よかった。今度は、届いた。');
  expect(hud.log()).toEqual([
    { speaker: 'エリア', text: '……聞こえますか？' },
    { speaker: 'エリア', text: 'よかった。今度は、届いた。' },
  ]);
  hud.clearSubtitle();
  expect(root.querySelector('.story-subtitle').hidden).toBe(true);
});

test('調べるボタン', () => {
  const { root, hud } = make();
  const cb = vi.fn();
  hud.onInteract(cb);
  const button = root.querySelector('.story-interact');
  expect(button.hidden).toBe(true);
  hud.showInteract('レバーを引く');
  expect(button.hidden).toBe(false);
  expect(button.textContent).toContain('レバーを引く');
  button.click();
  expect(cb).toHaveBeenCalledTimes(1);
  hud.showInteract(null);
  expect(button.hidden).toBe(true);
});

test('会話送り：受け付け中だけ層が出て、タップで onAdvance', () => {
  const { root, hud } = make();
  const cb = vi.fn();
  hud.onAdvance(cb);
  const layer = root.querySelector('.story-advance');
  expect(layer.hidden).toBe(true);
  hud.setAdvance(true);
  expect(layer.hidden).toBe(false);
  const down = new Event('pointerdown', { bubbles: true, cancelable: true });
  layer.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  layer.click();
  expect(cb).toHaveBeenCalledTimes(1);
  hud.setAdvance(false);
  expect(layer.hidden).toBe(true);
});

test('履歴の板を開閉できる', () => {
  const { root, hud } = make();
  hud.say({ speaker: 'エリア', text: 'ここです。' });
  root.querySelector('.story-log-button').click();
  const panel = root.querySelector('.story-log');
  expect(panel.hidden).toBe(false);
  expect(panel.querySelectorAll('.story-log-line')).toHaveLength(1);
  root.querySelector('.story-log-close').click();
  expect(panel.hidden).toBe(true);
});

test('fade は時間がたつと resolve する（transitionend が来なくても）', async () => {
  vi.useFakeTimers();
  const { hud } = make();
  const done = vi.fn();
  hud.fade('black', 0.5).then(done);
  await vi.advanceTimersByTimeAsync(600);
  expect(done).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

test('スキップ：受け付け中の層の左上に「スキップ」。押すと onSkip だけ（onAdvance は呼ばない）', () => {
  const { root, hud } = make();
  const skip = vi.fn();
  const advance = vi.fn();
  hud.onSkip(skip);
  hud.onAdvance(advance);
  hud.setAdvance(true);
  const button = root.querySelector('.story-skip');
  expect(button.hidden).toBe(true);
  hud.setSkip(true);
  expect(button.hidden).toBe(false);
  button.click();
  expect(skip).toHaveBeenCalledTimes(1);
  expect(advance).not.toHaveBeenCalled();
  hud.setSkip(false);
  expect(button.hidden).toBe(true);
});
