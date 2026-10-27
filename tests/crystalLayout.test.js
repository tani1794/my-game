import { test, expect } from 'vitest';
import { reachable } from '../src/areas/kit.js';
import { CRYSTAL, ARENA } from '../src/areas/crystal/layout.js';
import { CRYSTAL_FOES } from '../src/areas/crystal/foes.js';

const level = CRYSTAL.level;
const at = (name) => CRYSTAL.checkpoints[name];
const spot = (name) => CRYSTAL.interactables[name];
const opened = { webCut1: true, webCut2: true };
const bridged = { ...opened, reflectorA: true, reflectorB: true, bridgeOn: true };
const lifted = { ...bridged, winchA: true, winchB: true, winchC: true, liftUp: true };
const gated = { ...lifted, crownGateOpen: true };

test('入口から反射器Aと受光器には、最初から行ける', () => {
  expect(reachable(level, at('crystalEntry'), spot('reflectorA'), {})).toBe(true);
  expect(reachable(level, at('crystalEntry'), spot('receptor'), {})).toBe(true);
});

test('東の岩棚（反射器B）へは、結晶糸を2本切るまで行けない', () => {
  expect(reachable(level, at('crystalEntry'), spot('reflectorB'), {})).toBe(false);
  expect(reachable(level, at('crystalEntry'), spot('reflectorB'), { webCut1: true })).toBe(false);
  expect(reachable(level, at('crystalEntry'), spot('reflectorB'), opened)).toBe(true);
});

test('光の橋が出るまで、共鳴の休み場へは渡れない', () => {
  expect(reachable(level, at('crystalEntry'), at('crystalMid'), opened)).toBe(false);
  expect(reachable(level, at('crystalEntry'), at('crystalMid'), bridged)).toBe(true);
});

test('籠が上がるまで、上の段（共鳴器）へは登れない', () => {
  expect(reachable(level, at('crystalMid'), spot('resonatorL'), bridged)).toBe(false);
  expect(reachable(level, at('crystalMid'), spot('resonatorL'), lifted)).toBe(true);
  expect(reachable(level, at('crystalMid'), spot('resonatorR'), lifted)).toBe(true);
  expect(reachable(level, at('crystalMid'), spot('tablet'), lifted)).toBe(true);
});

test('晶冠の門が開くまで、門の前（ボス前の碑）へは下りられない', () => {
  expect(reachable(level, at('crystalMid'), at('crystalGate'), lifted)).toBe(false);
  expect(reachable(level, at('crystalMid'), at('crystalGate'), gated)).toBe(true);
});

test('王座は直径55m、門の前（南）から入れる。北の出口は撃破後にだけ通れる', () => {
  expect(ARENA.radius * 2).toBe(55);
  expect(reachable(level, at('crystalGate'), { x: 0, z: 0 }, gated)).toBe(true);
  expect(reachable(level, at('crystalGate'), CRYSTAL.zones.exit, gated)).toBe(false);
  expect(reachable(level, at('crystalGate'), CRYSTAL.zones.exit, { ...gated, vergrasDefeated: true })).toBe(true);
});

test('敵は全員、決めた種類の定義があり、床の上にいる', () => {
  for (const post of CRYSTAL.enemies) {
    expect(CRYSTAL_FOES[post.type], post.id).toBeTruthy();
    expect(level.walkable(post.x, post.z, post.y), post.id).toBe(true);
    expect(level.heightAt(post.x, post.z, post.y)).toBe(post.y);
  }
});

test('谷には10種類の敵：通常7種と精鋭2種が配置され、精鋭は印つき', () => {
  const types = new Set(CRYSTAL.enemies.map((e) => e.type));
  expect(types.size).toBe(9);
  for (const post of CRYSTAL.enemies) expect(Boolean(post.elite)).toBe(Boolean(CRYSTAL_FOES[post.type].elite));
  expect(CRYSTAL.boss.id).toBe('vergras');
});

test('調べる場所・碑・壊せる物は、すべて歩ける床の近くにある', () => {
  for (const [id, s] of Object.entries(CRYSTAL.interactables)) {
    const near = [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].some(([dx, dz]) => level.walkable(s.x + dx, s.z + dz, s.y, gated));
    expect(near, id).toBe(true);
  }
  for (const b of CRYSTAL.breakables) expect(level.walkable(b.x + 1.5, b.z, b.y, {}) || level.walkable(b.x - 1.5, b.z, b.y, {}), b.id).toBe(true);
});
