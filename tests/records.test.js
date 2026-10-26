import { test, expect } from 'vitest';
import { createRecords } from '../src/game/records.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
  };
}

test('最速記録：速いときだけ更新する', () => {
  const storage = memoryStorage();
  const records = createRecords(storage);
  expect(records.best()).toBe(null);
  expect(records.submit(100)).toEqual({ best: 100, isNew: true });
  expect(records.submit(120)).toEqual({ best: 100, isNew: false });
  expect(records.submit(90.5)).toEqual({ best: 90.5, isNew: true });
  expect(storage.data['oa-best']).toBe('90.5');
  expect(createRecords(storage).best()).toBe(90.5);
});

test('遊んだ回数を数えて保存する', () => {
  const storage = memoryStorage();
  const records = createRecords(storage);
  expect(records.plays()).toBe(0);
  expect(records.countPlay()).toBe(1);
  expect(records.countPlay()).toBe(2);
  expect(createRecords(storage).plays()).toBe(2);
});

test('壊れた値は、記録なし・回数0', () => {
  for (const bad of ['abc', '-5', '0', '']) {
    const records = createRecords(memoryStorage({ 'oa-best': bad, 'oa-plays': bad }));
    expect(records.best()).toBe(null);
    expect(records.plays()).toBe(0);
  }
});

test('保存できない環境でも動き、その起動の間は数える', () => {
  const broken = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
  };
  for (const storage of [broken, null]) {
    const records = createRecords(storage);
    expect(records.best()).toBe(null);
    expect(records.submit(80)).toEqual({ best: 80, isNew: true });
    expect(records.best()).toBe(80);
    expect(records.countPlay()).toBe(1);
    expect(records.countPlay()).toBe(2);
  }
});
