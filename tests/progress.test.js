import { test, expect } from 'vitest';
import { createProgress, PHASES, SAVE_KEY } from '../src/story/progress.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

test('段階の並び', () => {
  expect(PHASES).toEqual(['TITLE', 'PROLOGUE', 'FOREST', 'CHAPEL_APPROACH', 'CHAPEL_INTERIOR', 'CHAPTER_COMPLETE', 'CRYSTAL_BATTLE']);
});

test('保存がなければ、はじめから（PROLOGUE・開始地点）', () => {
  const progress = createProgress(memoryStorage());
  expect(progress.hasSave()).toBe(false);
  expect(progress.phase()).toBe('PROLOGUE');
  expect(progress.checkpoint()).toBe('start');
  expect(progress.flag('flowers')).toBe(false);
});

test('段階は先へだけ進む', () => {
  const progress = createProgress(memoryStorage());
  progress.advance('FOREST');
  progress.advance('CHAPEL_APPROACH');
  progress.advance('FOREST');
  expect(progress.phase()).toBe('CHAPEL_APPROACH');
});

test('印・一度きりの会話・倒した敵・復帰地点を保存し、読み直せる', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.advance('FOREST');
  progress.set('flowers');
  progress.set('gateOpen');
  progress.markSeen('wake');
  progress.defeat('guard-1');
  progress.reach('gate');
  const saved = JSON.parse(storage.data[SAVE_KEY]);
  expect(saved.version).toBe(2);
  const again = createProgress(storage);
  expect(again.hasSave()).toBe(true);
  expect(again.phase()).toBe('FOREST');
  expect(again.checkpoint()).toBe('gate');
  expect(again.flag('flowers')).toBe(true);
  expect(again.flag('gateOpen')).toBe(true);
  expect(again.seen('wake')).toBe(true);
  expect(again.seen('plaza')).toBe(false);
  expect(again.defeated('guard-1')).toBe(true);
  expect(again.defeated('guard-2')).toBe(false);
});

test('印や会話は、その場で保存される（復帰地点の前に死んでも繰り返さない）', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.markSeen('flowers-talk');
  expect(createProgress(storage).seen('flowers-talk')).toBe(true);
});

test('壊れた保存・違う版・ありえない値は、はじめからにする', () => {
  for (const bad of ['{', 'null', '[]', JSON.stringify({ version: 99, phase: 'FOREST' }), JSON.stringify({ version: 1, phase: 'NOPE', checkpoint: 'start' }), JSON.stringify({ version: 1, phase: 'FOREST', checkpoint: 'moon' })]) {
    const progress = createProgress(memoryStorage({ [SAVE_KEY]: bad }));
    expect(progress.hasSave()).toBe(false);
    expect(progress.phase()).toBe('PROLOGUE');
    expect(progress.checkpoint()).toBe('start');
  }
});

test('保存できない環境でも、その起動の間は覚えている', () => {
  const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  for (const storage of [broken, null]) {
    const progress = createProgress(storage);
    progress.set('gateOpen');
    progress.reach('gate');
    expect(progress.flag('gateOpen')).toBe(true);
    expect(progress.checkpoint()).toBe('gate');
  }
});

test('はじめから（newGame）で全部消える', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.set('flowers');
  progress.reach('chapel');
  progress.newGame();
  expect(progress.flag('flowers')).toBe(false);
  expect(progress.checkpoint()).toBe('start');
  expect(progress.phase()).toBe('PROLOGUE');
  expect(createProgress(storage).hasSave()).toBe(false);
});

test('矛盾した保存（門が閉じたまま門の先や礼拝堂から再開、礼拝堂の段階なのに門の手前）は、はじめからにする', () => {
  const bad = [
    { version: 1, phase: 'FOREST', checkpoint: 'chapel', flags: {}, seen: [], defeated: [] },
    { version: 1, phase: 'FOREST', checkpoint: 'gate', flags: {}, seen: [], defeated: [] },
    { version: 1, phase: 'CHAPEL_INTERIOR', checkpoint: 'chapel', flags: {}, seen: [], defeated: [] },
    { version: 1, phase: 'CHAPEL_APPROACH', checkpoint: 'start', flags: { gateOpen: true }, seen: [], defeated: [] },
  ];
  for (const data of bad) {
    const progress = createProgress(memoryStorage({ [SAVE_KEY]: JSON.stringify(data) }));
    expect(progress.hasSave()).toBe(false);
    expect(progress.checkpoint()).toBe('start');
  }
  const good = createProgress(memoryStorage({ [SAVE_KEY]: JSON.stringify({ version: 1, phase: 'CHAPEL_INTERIOR', checkpoint: 'chapel', flags: { gateOpen: true }, seen: [], defeated: [] }) }));
  expect(good.hasSave()).toBe(true);
});

// ── 第二章：版 2（エリアと復帰地点） ──
test('版 1（第一章）の保存は、版 2 へ移し替えて読める', () => {
  const v1 = { version: 1, phase: 'CHAPEL_INTERIOR', checkpoint: 'chapel', flags: { gateOpen: true }, seen: ['wake'], defeated: ['guard-1'] };
  const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(v1) });
  const progress = createProgress(storage);
  expect(progress.hasSave()).toBe(true);
  expect(progress.area()).toBe('chapter1');
  expect(progress.checkpoint()).toBe('chapel');
  expect(progress.seen('wake')).toBe(true);
  progress.set('x');
  expect(JSON.parse(storage.data[SAVE_KEY]).version).toBe(2);
});

test('次のエリアへ移ると、エリアと復帰地点を一緒に保存する', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.set('gateOpen');
  progress.advance('CHAPTER_COMPLETE');
  progress.enterArea('rose', 'roseEntry');
  const again = createProgress(storage);
  expect(again.area()).toBe('rose');
  expect(again.checkpoint()).toBe('roseEntry');
});

test('エリアと復帰地点が合わない保存は、はじめから', () => {
  const bad = { version: 2, area: 'rose', phase: 'CHAPTER_COMPLETE', checkpoint: 'crystalMid', flags: { gateOpen: true }, seen: [], defeated: [] };
  expect(createProgress(memoryStorage({ [SAVE_KEY]: JSON.stringify(bad) })).hasSave()).toBe(false);
  const unknown = { ...bad, area: 'moon', checkpoint: 'roseEntry' };
  expect(createProgress(memoryStorage({ [SAVE_KEY]: JSON.stringify(unknown) })).hasSave()).toBe(false);
});
