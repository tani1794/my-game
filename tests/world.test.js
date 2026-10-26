import { test, expect } from 'vitest';
import { AREAS, AREA_ORDER, areaOf, isCheckpoint } from '../src/story/world.js';

test('エリアの順番は固定', () => {
  expect(AREA_ORDER).toEqual(['chapter1', 'rose', 'cave', 'crystal', 'frost', 'ash', 'swords']);
});

test('復帰地点（残響の碑など）は、どれか1つのエリアに属する', () => {
  const all = AREA_ORDER.flatMap((id) => AREAS[id].checkpoints);
  expect(new Set(all).size).toBe(all.length);
  expect(areaOf('garden')).toBe('rose');
  expect(areaOf('caveMid')).toBe('cave');
  expect(areaOf('crystalGate')).toBe('crystal');
  expect(isCheckpoint('crystal', 'crystalMid')).toBe(true);
  expect(isCheckpoint('rose', 'crystalMid')).toBe(false);
});

test('各谷は、入口・中間・ボス前・撃破後の碑を持つ', () => {
  for (const id of ['crystal', 'frost', 'ash', 'swords']) {
    expect(AREAS[id].checkpoints).toEqual([`${id}Entry`, `${id}Mid`, `${id}Gate`, `${id}After`]);
  }
});
