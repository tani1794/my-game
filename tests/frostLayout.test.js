import { test, expect, vi } from 'vitest';
import { reachable } from '../src/areas/kit.js';
import { FROST, FROST_ARENA } from '../src/areas/frost/layout.js';
import { FROST_FOES } from '../src/areas/frost/foes.js';

// 広い地図を格子でたどるので、ほかのテストと並ぶと時間がかかる
vi.setConfig({ testTimeout: 30000 });

const level = FROST.level;
const at = (name) => FROST.checkpoints[name];
const spot = (name) => FROST.interactables[name];
const thawed = { sluiceThawed: true };
const drained = { ...thawed, drainOpen: true };
const climbed = { ...drained, duelistDown: true };
const calm = { ...climbed, windCalm: true };
const gated = { ...calm, iceGateOpen: true };

test('野営地の仕掛け（灯守・風除け・弁・水門）には、最初から行ける', () => {
  for (const id of ['mirei', 'windbreak', 'valve', 'duct', 'sluice']) expect(reachable(level, at('frostEntry'), spot(id), {}), id).toBe(true);
});

test('崩れた橋の上は渡れない。水門が解けて水が引くと、橋の下を通って北岸（避難所）へ', () => {
  expect(reachable(level, at('frostEntry'), at('frostMid'), {})).toBe(false);
  expect(reachable(level, at('frostEntry'), at('frostMid'), thawed)).toBe(true);
});

test('中庭は排水するまで入れない。北岸から戻ることもできる', () => {
  expect(reachable(level, at('frostMid'), FROST.zones.yard, thawed)).toBe(false);
  expect(reachable(level, at('frostMid'), FROST.zones.yard, drained)).toBe(true);
  expect(reachable(level, at('frostMid'), at('frostEntry'), thawed)).toBe(true);
});

test('尾根へは、双剣士を倒して落とし格子が砕けるまで登れない', () => {
  expect(reachable(level, at('frostMid'), spot('vaneA'), drained)).toBe(false);
  expect(reachable(level, at('frostMid'), spot('vaneA'), climbed)).toBe(true);
});

test('吹雪が止むまで、尾根の東（最後の鎖）へは行けない', () => {
  expect(reachable(level, at('frostMid'), spot('chain'), climbed)).toBe(false);
  expect(reachable(level, at('frostMid'), spot('chain'), calm)).toBe(true);
});

test('風向板は2つとも吹雪の手前（西）にあり、吹雪が止む前に回せる', () => {
  expect(reachable(level, at('frostMid'), spot('vaneA'), climbed)).toBe(true);
  expect(reachable(level, at('frostMid'), spot('vaneB'), climbed)).toBe(true);
});

test('氷の門が開くまで、白角の静庭（ボス前の碑）へは下りられない', () => {
  expect(reachable(level, at('frostMid'), at('frostGate'), calm)).toBe(false);
  expect(reachable(level, at('frostMid'), at('frostGate'), gated)).toBe(true);
});

test('戦場は静庭の北。北の出口は撃破後にだけ通れる', () => {
  expect(reachable(level, at('frostGate'), { x: FROST_ARENA.x, z: FROST_ARENA.z }, gated)).toBe(true);
  expect(reachable(level, at('frostGate'), FROST.zones.exit, gated)).toBe(false);
  expect(reachable(level, at('frostGate'), FROST.zones.exit, { ...gated, isvalDefeated: true })).toBe(true);
});

test('敵は全員、定義があり、床の上にいる。10種類（通常7・精鋭2・ボス1）', () => {
  for (const post of FROST.enemies) {
    expect(FROST_FOES[post.type], post.id).toBeTruthy();
    expect(level.walkable(post.x, post.z, post.y, gated), post.id).toBe(true);
    expect(Boolean(post.elite)).toBe(Boolean(FROST_FOES[post.type].elite));
  }
  expect(new Set(FROST.enemies.map((e) => e.type)).size).toBe(10);
  expect(FROST.enemies.find((e) => e.id === FROST.boss.id).type).toBe('isval');
});

test('調べる場所は、すべて歩ける床の近くにある', () => {
  for (const [id, s] of Object.entries(FROST.interactables)) {
    const near = [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].some(([dx, dz]) => level.walkable(s.x + dx, s.z + dz, s.y, gated));
    expect(near, id).toBe(true);
  }
});
