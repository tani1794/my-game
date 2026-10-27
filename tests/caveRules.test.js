import { test, expect } from 'vitest';
import { createDirector } from '../src/story/director.js';
import { createProgress } from '../src/story/progress.js';
import { createCaveRules, CAVE_OBJECTIVES } from '../src/areas/cave/rules.js';

function memoryStorage() {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}
const quiet = { zones: [], interact: null, noticed: [], defeated: [], advance: false, skip: false };
function run(director, seconds, signals = {}) {
  const said = []; const actions = []; let out;
  for (let t = 0; t < seconds; t += 0.1) {
    out = director.update(0.1, { ...quiet, ...signals });
    if (out.subtitle && said[said.length - 1] !== out.subtitle.text) said.push(out.subtitle.text);
    actions.push(...out.actions);
    signals = {};
  }
  return { said, actions, out };
}
function enterCave() {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.set('gateOpen'); progress.reach('chapel'); progress.advance('CHAPTER_COMPLETE'); progress.set('evolved');
  progress.enterArea('cave', 'caveEntry');
  const rules = createCaveRules();
  const director = createDirector(progress, rules);
  director.begin();
  run(director, 8);
  return { progress, director, rules, storage };
}

test('反射器を回すたびに向きが変わり、東（三日月の受光結晶）に向くと石扉が開く', () => {
  const { director, progress, rules } = enterCave();
  expect(rules.reflector()).toBe(2);
  run(director, 1, { interact: 'reflector' });
  run(director, 1, { interact: 'reflector' });
  expect(progress.flag('lightOpen')).toBe(false);
  expect(run(director, 1, { interact: 'reflector' }).actions).toContain('reflector:1');
  expect(rules.reflector()).toBe(1);
  expect(progress.flag('lightOpen')).toBe(true);
  expect(run(director, 10).out.objective).toBe(CAVE_OBJECTIVES.river);
});

test('西の偽の結晶（丸い刻印）に向けても開かない', () => {
  const { director, progress } = enterCave();
  const west = run(director, 4, { interact: 'reflector' });
  expect(west.actions).toContain('reflector:3');
  expect(progress.flag('lightOpen')).toBe(false);
  expect(west.out.interactables).toContain('reflector');
});

test('中間の碑で保存、水門で渡り板が定位置へ、出口で晶冠峡谷へ', () => {
  const { director, progress } = enterCave();
  for (let i = 0; i < 3; i++) run(director, 1, { interact: 'reflector' });
  run(director, 10);
  run(director, 2, { zones: ['midStone'] });
  expect(progress.checkpoint()).toBe('caveMid');
  const sluice = run(director, 12, { interact: 'sluice' });
  expect(sluice.actions).toContain('openSluice');
  expect(progress.flag('planksSet')).toBe(true);
  expect(sluice.out.objective).toBe(CAVE_OBJECTIVES.cross);
  expect(run(director, 1, { zones: ['vista'] }).actions).toContain('toCrystal');
});
