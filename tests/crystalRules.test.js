import { test, expect } from 'vitest';
import { createDirector } from '../src/story/director.js';
import { createProgress } from '../src/story/progress.js';
import { createCrystalRules, CRYSTAL_OBJECTIVES } from '../src/areas/crystal/rules.js';

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
  progress.enterArea('crystal', 'crystalEntry');
  for (const flag of flags) progress.set(flag);
  const rules = createCrystalRules();
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

test('オルンの話を聞くと、目的が反射器に変わる', () => {
  const { director, progress } = enterValley();
  expect(run(director, 0.2).out.objective).toBe(CRYSTAL_OBJECTIVES.orun);
  const { said, out } = run(director, 30, { interact: 'orunEntry' });
  expect(said.some((line) => line.includes('反射器が2基'))).toBe(true);
  expect(out.objective).toBe(CRYSTAL_OBJECTIVES.plate);
  expect(progress.flag('metOrun')).toBe(true);
});

test('東の反射器：鏡板がないうちは回せない。坑道で拾い、岩棚に戻るとはめ込まれる', () => {
  const { director, progress } = enterValley(['metOrun']);
  let out = run(director, 0.2).out;
  expect(out.interactables).toContain('reflectorEmpty');
  expect(out.interactables).not.toContain('reflectorB');
  expect(run(director, 4, { interact: 'reflectorEmpty' }).said[0]).toContain('鏡板が外れて');
  run(director, 14, { interact: 'mirrorPlate' });
  expect(progress.flag('plateFound')).toBe(true);
  expect(run(director, 0.2).out.objective).toBe(CRYSTAL_OBJECTIVES.reflectors);
  const { actions } = run(director, 6, { interact: 'timber' });
  expect(actions).toContain('pushTimber');
  expect(progress.flag('timberDown')).toBe(true);
  expect(run(director, 6, { zones: ['ledge'] }).actions).toContain('fitPlate');
  out = run(director, 0.2).out;
  expect(out.interactables).toContain('reflectorB');
  expect(out.interactables).not.toContain('reflectorEmpty');
});

test('反射器は2基とも正しい向きにして、はじめて光の橋が出る', () => {
  const { director, progress } = enterValley(['metOrun', 'webCut1', 'webCut2', 'plateFound', 'plateFit']);
  // A：南 → 西 → 北 → 東（3回）
  turn(director, 'reflectorA', 3);
  run(director, 6);
  expect(progress.flag('reflectorA')).toBe(true);
  expect(progress.flag('bridgeOn')).toBe(false);
  // B：北 → 東 → 南 → 西（3回）
  const actions = turn(director, 'reflectorB', 3);
  expect(actions).toContain('reflectorB:3');
  const { actions: later, out } = run(director, 12);
  expect(later).toContain('bridgeForm');
  expect(progress.flag('bridgeOn')).toBe(true);
  expect(out.objective).toBe(CRYSTAL_OBJECTIVES.winch);
});

test('合わせ終わった反射器は、もう回せない（光が外れない）', () => {
  const { director } = enterValley(['reflectorA']);
  expect(run(director, 0.2).out.interactables).not.toContain('reflectorA');
});

test('共鳴の休み場で中間の保存。エリアが歌を思い出す', () => {
  const { director, progress } = enterValley(['bridgeOn']);
  const { said } = run(director, 20, { zones: ['rest'] });
  expect(progress.checkpoint()).toBe('crystalMid');
  expect(said).toContain('……私、ここで歌ったことがある。');
});

test('巻き上げ機：結晶を3つ砕くと調べられ、巨兵を倒すまでは動かない', () => {
  const { director, progress } = enterValley(['bridgeOn', 'winchA', 'winchB']);
  expect(run(director, 0.2).out.interactables).not.toContain('winch');
  progress.set('winchC');
  expect(run(director, 0.2).out.interactables).toContain('winch');
  run(director, 4, { interact: 'winch' });
  expect(progress.flag('liftUp')).toBe(false);
  run(director, 0.2, { defeated: ['cr-giant'] });
  const { actions } = run(director, 8, { interact: 'winch' });
  expect(actions).toContain('raiseLift');
  expect(progress.flag('liftUp')).toBe(true);
});

test('共鳴器：低い輪 → 双刃 → 王冠 の順で門が開く。順を間違えると最初から', () => {
  const { director, progress } = enterValley(['bridgeOn', 'liftUp']);
  let actions = turn(director, 'resonatorR', 1);
  expect(actions).toContain('resonatorLit:resonatorR');
  expect(actions.some((a) => a.includes('輪の刻印（線一本）') && a.includes('低い音') && a.includes('かすかな震え'))).toBe(true);
  actions = turn(director, 'resonatorC', 1);
  expect(actions).toContain('resonatorReset');
  // 間違えたあとは最初から：いきなり双刃を鳴らしても灯らない
  expect(turn(director, 'resonatorL', 1)).not.toContain('resonatorLit:resonatorL');
  turn(director, 'resonatorR', 1);
  turn(director, 'resonatorL', 1);
  expect(progress.flag('crownGateOpen')).toBe(false);
  actions = [...turn(director, 'resonatorC', 1), ...run(director, 8).actions];
  expect(actions).toContain('openCrownGate');
  expect(progress.flag('crownGateOpen')).toBe(true);
});

test('晶冠の門でボス前の保存', () => {
  const { director, progress } = enterValley(['bridgeOn', 'liftUp', 'crownGateOpen']);
  run(director, 2, { zones: ['gate'] });
  expect(progress.checkpoint()).toBe('crystalGate');
});

test('王座に入ると登場の演出（操作を止める・スキップできる）。戦いの間は流し直さない', () => {
  const { director } = enterValley(['bridgeOn', 'liftUp', 'crownGateOpen']);
  const first = run(director, 0.3, { zones: ['arena'] });
  expect(first.actions).toContain('bossTremor');
  expect(first.out.blocking).toBe(true);
  expect(first.out.inMemory).toBe(true);
  const skipped = run(director, 3, { skip: true });
  expect(skipped.actions).toContain('bossReady');
  expect(skipped.actions).toContain('bossStart');
  expect(skipped.actions).not.toContain('bossRise');
  // 戦っている間（bossActive）は、王座の中にいても演出は出ない
  const during = run(director, 1, { zones: ['arena'], bossActive: true });
  expect(during.actions).not.toContain('bossTremor');
});

test('ヴェルグラスを倒すと、撃破の記録・保存・エリアの声', () => {
  const { director, progress } = enterValley(['bridgeOn', 'liftUp', 'crownGateOpen']);
  const { said, actions, out } = run(director, 12, { defeated: ['vergras'] });
  expect(actions).toContain('bossFade');
  expect(actions).toContain('voiceCut');
  expect(said).toContain('……大丈夫。少し、遠くにいた気がしただけ。');
  expect(progress.flag('vergrasDefeated')).toBe(true);
  expect(progress.defeated('vergras')).toBe(true);
  expect(progress.checkpoint()).toBe('crystalAfter');
  expect(out.objective).toBe(CRYSTAL_OBJECTIVES.exit);
  expect(run(director, 0.5, { zones: ['exit'] }).actions).toContain('toFrost');
});

test('仕掛けの途中で保存しても、読み込み直すと解いた所は残る', () => {
  const { director, storage } = enterValley(['metOrun', 'webCut1', 'webCut2', 'plateFound']);
  turn(director, 'reflectorA', 3);
  run(director, 6);
  const progress = createProgress(storage);
  expect(progress.flag('reflectorA')).toBe(true);
  expect(progress.flag('webCut1')).toBe(true);
  expect(progress.area()).toBe('crystal');
});
