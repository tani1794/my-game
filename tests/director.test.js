import { test, expect } from 'vitest';
import { createDirector } from '../src/story/director.js';
import { createProgress } from '../src/story/progress.js';
import { OBJECTIVES } from '../src/story/script.js';

function memoryStorage() {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

const quiet = { zones: [], interact: null, noticed: [], defeated: [], advance: false, skip: false };

// 秒数ぶん進め、出てきた字幕と合図を集める
function run(director, seconds, signals = {}) {
  const said = [];
  const actions = [];
  let out;
  for (let t = 0; t < seconds; t += 0.1) {
    out = director.update(0.1, { ...quiet, ...signals });
    if (out.subtitle && said[said.length - 1] !== out.subtitle.text) said.push(out.subtitle.text);
    actions.push(...out.actions);
    signals = {};
  }
  return { said, actions, out };
}

// タップで送る行が出るまで進めて、タップする
function tapThrough(director, taps) {
  const said = [];
  for (let i = 0; i < taps; i++) {
    let out;
    for (let n = 0; n < 200; n++) {
      out = director.update(0.1, quiet);
      if (out.waitingTap) break;
    }
    said.push(out.subtitle.text);
    director.update(0.1, { ...quiet, advance: true });
  }
  return said;
}

test('はじめて：目覚めの3行はタップで送り、そのあと歩けるようになる', () => {
  const progress = createProgress(memoryStorage());
  const director = createDirector(progress);
  const first = director.begin();
  expect(first.control).toBe(false);
  const said = tapThrough(director, 3);
  expect(said).toEqual(['……聞こえますか？', 'よかった。今度は、届いた。', 'ここです。あなたがかぶっている、その王冠から。']);
  const { out, said: later } = run(director, 15);
  expect(out.control).toBe(true);
  expect(later).toContain('私はエリア。……城へ帰らなければいけないんです。');
  expect(out.objective).toBe(OBJECTIVES.forest);
  expect(progress.phase()).toBe('FOREST');
});

test('タップを待っている間は、時間がたっても次へ進まない', () => {
  const director = createDirector(createProgress(memoryStorage()));
  director.begin();
  const { out } = run(director, 20);
  expect(out.waitingTap).toBe(true);
  expect(out.subtitle.text).toBe('……聞こえますか？');
});

function afterWake() {
  const progress = createProgress(memoryStorage());
  const director = createDirector(progress);
  director.begin();
  tapThrough(director, 3);
  run(director, 15);
  return { progress, director };
}

test('広場の会話は一度だけ', () => {
  const { director } = afterWake();
  const once = run(director, 12, { zones: ['plaza'] });
  expect(once.said).toContain('この広場……北に、古い門衛所があったはずです。');
  expect(once.out.objective).toBe(OBJECTIVES.gatehouse);
  const again = run(director, 12, { zones: ['plaza'] });
  expect(again.said).toHaveLength(0);
});

test('白い花は任意。調べると印が付き、調べられる物から消える', () => {
  const { director, progress } = afterWake();
  expect(director.update(0.1, quiet).interactables).toContain('flowers');
  const { said, out } = run(director, 15, { interact: 'flowers' });
  expect(said).toContain('……誰と一緒だったのかは、思い出せません。');
  expect(progress.flag('flowers')).toBe(true);
  expect(out.interactables).not.toContain('flowers');
});

test('門：巻き上げ機の前にレバーを引いても動かず、瓦礫をどけると門が開く', () => {
  const { director, progress } = afterWake();
  const stuck = run(director, 6, { interact: 'lever' });
  expect(stuck.said[0]).toContain('レバーは動かない');
  expect(progress.flag('gateOpen')).toBe(false);
  const winch = run(director, 10, { interact: 'winch' });
  expect(winch.actions).toContain('clearRubble');
  expect(progress.flag('winchFreed')).toBe(true);
  const lever = run(director, 10, { interact: 'lever' });
  expect(lever.actions).toContain('openGate');
  expect(progress.flag('gateOpen')).toBe(true);
  expect(progress.checkpoint()).toBe('gate');
  expect(lever.out.objective).toBe(OBJECTIVES.toChapel);
  expect(lever.out.interactables).not.toContain('gate');
  expect(lever.out.interactables).not.toContain('lever');
});

test('門を先に調べると、目的が巻き上げ機になる', () => {
  const { director } = afterWake();
  const { out } = run(director, 8, { interact: 'gate' });
  expect(out.objective).toBe(OBJECTIVES.winch);
});

test('最初の衛兵を倒したあとの会話。二人の衛兵に気づいたら、すぐ知らせる', () => {
  const { director, progress } = afterWake();
  const after = run(director, 15, { defeated: ['guard-1'] });
  expect(after.said).toContain('怪我は……？');
  expect(progress.defeated('guard-1')).toBe(true);
  run(director, 2, { zones: ['plaza'] });
  // 広場の会話の途中でも、危険の知らせが先に出る
  const warn = director.update(0.1, { ...quiet, noticed: ['guard-2'] });
  expect(warn.subtitle.text).toBe('二人います。……気をつけて。');
  const rest = run(director, 15);
  expect(rest.said).toContain('その先の橋を渡れば、礼拝堂へ行けます。');
  const twice = run(director, 5, { noticed: ['guard-3'] });
  expect(twice.said).not.toContain('二人います。……気をつけて。');
});

test('途中で倒れて復帰しても、出来事の結果（門・目的）は残り、同じ会話は繰り返さない', () => {
  const { director, progress } = afterWake();
  run(director, 10, { interact: 'winch' });
  director.update(0.1, { ...quiet, interact: 'lever' });
  director.respawn();
  expect(progress.flag('gateOpen')).toBe(true);
  const { said, out } = run(director, 10);
  expect(said).toHaveLength(0);
  expect(out.objective).toBe(OBJECTIVES.toChapel);
});

test('途中から：保存した段階と目的で始まり、目覚めは繰り返さない', () => {
  const storage = memoryStorage();
  const before = createProgress(storage);
  before.advance('FOREST');
  before.markSeen('wake');
  before.set('gateOpen');
  const director = createDirector(createProgress(storage));
  const out = director.begin();
  expect(out.control).toBe(true);
  expect(out.objective).toBe(OBJECTIVES.toChapel);
  expect(run(director, 5).said).toHaveLength(0);
});

function atChapel() {
  const { director, progress } = afterWake();
  progress.set('gateOpen');
  run(director, 12, { zones: ['chapelFront'] });
  run(director, 8, { zones: ['nave'] });
  return { director, progress };
}

test('礼拝堂：着くと復帰地点、中で壁画の目的', () => {
  const { director, progress } = atChapel();
  expect(progress.phase()).toBe('CHAPEL_INTERIOR');
  expect(progress.checkpoint()).toBe('chapel');
  expect(director.update(0.1, quiet).objective).toBe(OBJECTIVES.mural);
  expect(director.update(0.1, quiet).interactables).toContain('mural');
});

test('壁画の記憶はスキップでき、花を見ていないときの台詞になる', () => {
  const { director, progress } = atChapel();
  director.update(0.1, { ...quiet, interact: 'mural' });
  const skipped = run(director, 1, { skip: true });
  expect(skipped.actions).toContain('memoryEnd');
  expect(progress.flag('memorySeen')).toBe(true);
  const { said, out } = run(director, 20);
  expect(said).toContain('白い花を……持っていた気がします。');
  expect(out.objective).toBe(OBJECTIVES.altar);
  expect(out.interactables).not.toContain('mural');
});

test('花を見ていれば、記憶のあとの台詞が変わる', () => {
  const { director, progress } = atChapel();
  progress.set('flowers');
  director.update(0.1, { ...quiet, interact: 'mural' });
  tapThrough(director, 4);
  expect(run(director, 20).said).toContain('さっきの花。あのときも、持っていました。');
});

test('祭壇で章が終わり、巡礼路から結晶獣の区画へ', () => {
  const { director, progress } = atChapel();
  director.update(0.1, { ...quiet, interact: 'mural' });
  run(director, 1, { skip: true });
  run(director, 20);
  const altar = run(director, 20, { interact: 'altar' });
  expect(altar.actions).toContain('chapterComplete');
  expect(progress.phase()).toBe('CHAPTER_COMPLETE');
  expect(altar.out.objective).toBe(OBJECTIVES.next);
  expect(altar.out.interactables).toContain('pilgrimPath');
  const go = director.update(0.1, { ...quiet, interact: 'pilgrimPath' });
  expect(go.actions).toContain('toCrystal');
});

test('タップ待ちの場面の途中で敵に気づかれても、場面は止まらず、知らせはその直後に出る', () => {
  const progress = createProgress(memoryStorage());
  const director = createDirector(progress);
  director.begin();
  // 1行目のタップ待ちまで進める
  let out;
  for (let n = 0; n < 50 && !out?.waitingTap; n++) out = director.update(0.1, quiet);
  out = director.update(0.1, { ...quiet, noticed: ['guard-2'] });
  expect(out.waitingTap).toBe(true);
  expect(out.subtitle.text).toBe('……聞こえますか？');
  const rest = tapThrough(director, 3);
  expect(rest[0]).toBe('……聞こえますか？');
  expect(run(director, 30).said).toContain('二人います。……気をつけて。');
});

test('自動の場面に知らせが割り込んだあと、元の行を頭から出し直す', () => {
  const { director } = afterWake();
  director.update(0.1, { ...quiet, zones: ['plaza'] });
  run(director, 1);
  director.update(0.1, { ...quiet, noticed: ['guard-3'] });
  const { said } = run(director, 20);
  expect(said).toContain('この広場……北に、古い門衛所があったはずです。');
  expect(said).toContain('その先の橋を渡れば、礼拝堂へ行けます。');
});

test('調べたときの反応は、エリアの話の途中でもすぐに出る', () => {
  const { director } = afterWake();
  director.update(0.1, { ...quiet, zones: ['plaza'] });
  run(director, 1);
  const out = director.update(0.1, { ...quiet, interact: 'winch' });
  expect(out.subtitle.text).toBe('巻き上げ機の歯車に噛んでいた瓦礫を、取り除いた。');
});

test('瓦礫をどけた時点で、レバーが引ける', () => {
  const { director, progress } = afterWake();
  const first = director.update(0.1, { ...quiet, interact: 'winch' });
  expect(first.actions).toContain('clearRubble');
  expect(progress.flag('winchFreed')).toBe(true);
});

test('身廊の会話の途中で壁画を調べても、記憶のあとの目的は「祭壇を調べる」', () => {
  const { director, progress } = afterWake();
  progress.set('gateOpen');
  run(director, 12, { zones: ['chapelFront'] });
  director.update(0.1, { ...quiet, zones: ['nave'] });
  director.update(0.1, { ...quiet, interact: 'mural' });
  run(director, 1, { skip: true });
  const { out } = run(director, 30);
  expect(out.objective).toBe(OBJECTIVES.altar);
});

test('記憶が終われば、エリアが話している間も動ける', () => {
  const { director, progress } = atChapel();
  director.update(0.1, { ...quiet, interact: 'mural' });
  run(director, 1, { skip: true });
  const out = run(director, 2).out;
  expect(progress.flag('memorySeen')).toBe(true);
  expect(out.blocking).toBe(false);
  expect(out.inMemory).toBe(false);
});

test('場面の途中で物語を離れても、その場面は「見た」にならず、もう一度起こせる（詰まない）', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.set('gateOpen');
  progress.reach('chapel');
  progress.advance('CHAPEL_INTERIOR');
  progress.markSeen('wake');
  const director = createDirector(progress);
  director.begin();
  director.update(0.1, { ...quiet, interact: 'mural' });
  run(director, 2);
  // ここでタイトルへ戻って、もう一度始める
  const again = createDirector(createProgress(storage));
  again.begin();
  expect(again.update(0.1, quiet).interactables).toContain('mural');
  again.update(0.1, { ...quiet, interact: 'mural' });
  expect(run(again, 1, { skip: true }).actions).toContain('memoryEnd');
});

test('同じ場面は、流れている間にもう一度起こしても重ならない', () => {
  const { director } = afterWake();
  director.update(0.1, { ...quiet, interact: 'flowers' });
  director.update(0.1, { ...quiet, interact: 'flowers' });
  const { said } = run(director, 20);
  expect(said.filter((text) => text === '……誰と一緒だったのかは、思い出せません。')).toHaveLength(1);
});

test('結晶獣戦のあとに物語へ戻っても、目的は次の目的のまま', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage);
  progress.set('gateOpen');
  progress.advance('CRYSTAL_BATTLE');
  progress.reach('chapel');
  const director = createDirector(createProgress(storage));
  expect(director.begin().objective).toBe(OBJECTIVES.next);
  expect(director.update(0.1, quiet).interactables).toContain('pilgrimPath');
});

test('調べたことで割り込まれた会話は、あとから流し直さない（結果だけ確定する）', () => {
  const { director, progress } = afterWake();
  progress.set('gateOpen');
  run(director, 12, { zones: ['chapelFront'] });
  director.update(0.1, { ...quiet, zones: ['nave'] });
  run(director, 0.5);
  director.update(0.1, { ...quiet, interact: 'mural' });
  run(director, 1, { skip: true });
  const { said } = run(director, 30);
  expect(said).not.toContain('奥へ。左の壁に、絵があったはずです。');
  expect(progress.seen('nave')).toBe(true);
});
