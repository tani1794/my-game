import { test, expect } from 'vitest';
import { createDirector } from '../src/story/director.js';
import { createProgress } from '../src/story/progress.js';
import { createRoseRules, ROSE_OBJECTIVES, WEAPON_NAME } from '../src/areas/rose/rules.js';
import { attackPower } from '../src/combat/damage.js';

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
function enterRose(storage = memoryStorage()) {
  const progress = createProgress(storage);
  progress.set('gateOpen');
  progress.reach('chapel');
  progress.advance('CHAPTER_COMPLETE');
  progress.enterArea('rose', 'roseEntry');
  const director = createDirector(progress, createRoseRules());
  director.begin();
  run(director, 6);
  return { progress, director, storage };
}

test('崩れた橋 → 迂回路 → 庭園の台詞 → 水門', () => {
  const { director } = enterRose();
  expect(run(director, 12, { zones: ['collapse'] }).out.objective).toBe(ROSE_OBJECTIVES.detour);
  const garden = run(director, 12, { zones: ['garden'] });
  expect(garden.said).toContain('白い薔薇……この橋にも、咲いていたんですね。');
  expect(garden.said).toContain('誰かが、帰ってくる人のために植えたと聞きました。');
  expect(garden.out.objective).toBe(ROSE_OBJECTIVES.waterGate);
});

test('仕掛けの因果：水門 → 排水 → 留め具 → 昇降橋。順番を飛ばすとレバーは動かない', () => {
  const { director, progress } = enterRose();
  expect(run(director, 4, { interact: 'liftLever' }).said[0]).toContain('留め具で固定');
  const water = run(director, 8, { interact: 'waterLever' });
  expect(water.actions).toContain('divertWater');
  expect(progress.flag('drained')).toBe(true);
  expect(run(director, 6, { interact: 'clamp' }).actions).toContain('unclamp');
  const lift = run(director, 8, { interact: 'liftLever' });
  expect(lift.actions).toContain('lowerBridge');
  expect(progress.flag('bridgeLowered')).toBe(true);
  expect(lift.out.objective).toBe(ROSE_OBJECTIVES.cross);
});

test('中央庭園の残響の碑：近づくと保存（復帰地点）、調べると休む', () => {
  const { director, progress } = enterRose();
  run(director, 3, { zones: ['gardenStone'] });
  expect(progress.checkpoint()).toBe('garden');
  expect(run(director, 1, { interact: 'gardenStone' }).actions).toContain('rest');
});

test('武器の進化：一度だけ自動で始まり、スキップしても印・保存・名前は正しい', () => {
  const { director, progress, storage } = enterRose();
  progress.set('drained'); progress.set('clampFreed'); progress.set('bridgeLowered');
  const first = director.update(0.1, { ...quiet, zones: ['oath'] });
  expect(first.actions).toContain('evolveStart');
  const skipped = run(director, 1, { skip: true });
  expect(skipped.actions).toContain('evolveEnd');
  expect(skipped.actions).toContain('weaponName');
  expect(progress.flag('evolved')).toBe(true);
  expect(progress.checkpoint()).toBe('oath');
  const after = run(director, 15);
  expect(after.said).toContain('……名前だけ、覚えています。ルーメン。');
  expect(after.out.objective).toBe(ROSE_OBJECTIVES.cave);
  // もう一度入っても起きない。攻撃力は印から決まり、重ならない
  expect(run(director, 3, { zones: ['oath'] }).actions).not.toContain('evolveStart');
  const reloaded = createProgress(storage);
  expect(attackPower({ evolved: reloaded.flag('evolved') })).toBe(35);
  expect(WEAPON_NAME).toBe('誓剣ルーメン');
});

test('洞窟の入口：入った瞬間に一度だけ確認。中にいる間は繰り返さず、出て入り直すと再び出る。調べても出る', () => {
  const { director, progress } = enterRose();
  progress.set('evolved');
  expect(director.update(0.1, { ...quiet, zones: ['caveMouth'] }).actions).toContain('askCave');
  expect(director.update(0.1, { ...quiet, zones: ['caveMouth'] }).actions).not.toContain('askCave');
  director.update(0.1, quiet);
  expect(director.update(0.1, { ...quiet, zones: ['caveMouth'] }).actions).toContain('askCave');
  expect(director.update(0.1, { ...quiet, zones: ['caveMouth'], interact: 'caveMouth' }).actions).toContain('askCave');
});
