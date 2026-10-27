import { test, expect } from 'vitest';
import { createDirector } from '../src/story/director.js';
import { createProgress } from '../src/story/progress.js';
import { createFrostRules, FROST_OBJECTIVES } from '../src/areas/frost/rules.js';

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
function enterValley(flags = []) {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.set('gateOpen'); progress.reach('chapel'); progress.advance('CHAPTER_COMPLETE'); progress.set('evolved');
  progress.enterArea('frost', 'frostEntry');
  for (const flag of flags) progress.set(flag);
  const rules = createFrostRules();
  const director = createDirector(progress, rules);
  director.begin();
  run(director, 10);
  return { progress, director, rules, storage };
}
const turn = (director, id, times) => {
  const actions = [];
  for (let i = 0; i < times; i++) actions.push(...run(director, 0.5, { interact: id }).actions);
  return actions;
};

test('灯守ミレイの話を聞くと、目的が「風除け → 弁」に変わる', () => {
  const { director } = enterValley();
  expect(run(director, 0.2).out.objective).toBe(FROST_OBJECTIVES.mirei);
  const { said, out } = run(director, 40, { interact: 'mirei' });
  expect(said.some((line) => line.includes('風除け'))).toBe(true);
  expect(out.objective).toBe(FROST_OBJECTIVES.thaw);
});

test('風除けを上げる前に弁を西へ回しても、火が細くて水門は解けない', () => {
  const { director, progress } = enterValley(['metMirei']);
  // 東 → 北 → 西（2回）
  turn(director, 'valve', 1);
  const { said } = run(director, 4, { interact: 'valve' });
  expect(progress.flag('sluiceThawed')).toBe(false);
  expect(said[0]).toContain('火が細すぎる');
});

test('風除け → 弁を西へ で水門が解け、すぐ保存される。北や東では解けない', () => {
  const { director, progress, rules } = enterValley(['metMirei']);
  run(director, 5, { interact: 'windbreak' });
  expect(progress.flag('windGuard')).toBe(true);
  // 東(0) → 北(1) → 西(2)
  turn(director, 'valve', 1);
  expect(rules.valve()).toBe(1);
  expect(progress.flag('sluiceThawed')).toBe(false);
  turn(director, 'valve', 1);
  expect(rules.valve()).toBe(2);
  expect(progress.flag('sluiceThawed')).toBe(true);
  expect(run(director, 12).out.objective).toBe(FROST_OBJECTIVES.under);
});

test('白灯の避難所で中間の保存。記録を読むと、エリアの記憶（スキップできる）', () => {
  const { director, progress } = enterValley(['sluiceThawed']);
  run(director, 6, { zones: ['shelter'] });
  expect(progress.checkpoint()).toBe('frostMid');
  const first = run(director, 0.3, { interact: 'record' });
  expect(first.out.inMemory).toBe(true);
  const { said } = run(director, 20, { skip: true });
  expect(said).toContain('誰かが待っていたのは……私？');
  expect(progress.flag('recordRead')).toBe(true);
});

test('排水 → 双剣士を倒す → 登り口が開く（印はすぐ保存）', () => {
  const { director, progress } = enterValley(['sluiceThawed', 'frostMidLit']);
  expect(run(director, 0.2).out.objective).toBe(FROST_OBJECTIVES.drain);
  run(director, 0.3, { interact: 'drain' });
  expect(progress.flag('drainOpen')).toBe(true);
  expect(run(director, 8).out.objective).toBe(FROST_OBJECTIVES.duelist);
  run(director, 0.2, { defeated: ['fr-duelist'] });
  expect(progress.flag('duelistDown')).toBe(true);
  expect(progress.defeated('fr-duelist')).toBe(true);
});

test('風向板を2つとも北へ向けると吹雪が止み、鎖を外すと氷の門が開く', () => {
  const { director, progress } = enterValley(['sluiceThawed', 'drainOpen', 'duelistDown']);
  // A：東 → 南 → 西 → 北（3回）、B：南 → 西 → 北（2回）
  turn(director, 'vaneA', 3);
  expect(progress.flag('windCalm')).toBe(false);
  turn(director, 'vaneB', 2);
  expect(progress.flag('windCalm')).toBe(true);
  run(director, 8);
  expect(run(director, 0.2).out.interactables).toContain('chain');
  run(director, 0.3, { interact: 'chain' });
  expect(progress.flag('iceGateOpen')).toBe(true);
});

test('倒れて戻ると、回し途中の弁と風向板は最初の向きに戻る', () => {
  const { director, rules } = enterValley(['metMirei', 'duelistDown', 'sluiceThawed', 'drainOpen']);
  turn(director, 'vaneA', 1);
  director.respawn();
  expect(rules.vane('vaneA')).toBe(1);
  expect(rules.valve()).toBe(0);
});

test('静庭でボス前の保存。戦場に入ると登場の演出（スキップ可）。倒すと撃破の記録と保存', () => {
  const { director, progress } = enterValley(['sluiceThawed', 'drainOpen', 'duelistDown', 'windCalm', 'iceGateOpen']);
  run(director, 2, { zones: ['gate'] });
  expect(progress.checkpoint()).toBe('frostGate');
  const intro = run(director, 0.3, { zones: ['arena'] });
  expect(intro.actions).toContain('bossTremor');
  expect(intro.out.inMemory).toBe(true);
  expect(run(director, 3, { skip: true }).actions).toContain('bossStart');
  const { said, actions, out } = run(director, 12, { defeated: ['fr-isval'] });
  expect(actions).toContain('voiceCut');
  expect(said.some((line) => line.includes('あたたかい'))).toBe(true);
  expect(progress.flag('isvalDefeated')).toBe(true);
  expect(progress.checkpoint()).toBe('frostAfter');
  expect(out.objective).toBe(FROST_OBJECTIVES.exit);
  expect(run(director, 0.5, { zones: ['exit'] }).actions).toContain('toAsh');
});
