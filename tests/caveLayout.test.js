import { test, expect } from 'vitest';
import { reachable } from '../src/areas/kit.js';
import { CAVE } from '../src/areas/cave/layout.js';

const { level, checkpoints, interactables, zones } = CAVE;
const start = { ...checkpoints.caveEntry };
const at = (spot) => ({ x: spot.x, z: spot.z });

test('入口から上層の広間・反射器・寄り道の小部屋へ行ける', () => {
  for (const spot of [interactables.reflector, interactables.receptor, interactables.alcoveRunes]) {
    expect(reachable(level, start, at(spot), {})).toBe(true);
  }
});

test('光を通すまで石扉は閉じ、開くと下層（中間の碑・水門）へ降りられる', () => {
  expect(reachable(level, start, at(interactables.sluice), {})).toBe(false);
  expect(reachable(level, start, at(interactables.sluice), { lightOpen: true })).toBe(true);
  expect(reachable(level, start, at(interactables.midStone), { lightOpen: true })).toBe(true);
});

test('渡り板が定位置に来るまで対岸（出口）へ渡れない', () => {
  expect(reachable(level, start, at(zones.vista), { lightOpen: true })).toBe(false);
  expect(reachable(level, start, at(zones.vista), { lightOpen: true, planksSet: true })).toBe(true);
});

test('上層の縁から、下層へ飛び降りられない', () => {
  // 広間（y 0）の北の縁の外は、下層の岸（y -6）の真上でも歩けない
  expect(level.walkable(-10, 2, 0, { lightOpen: true })).toBe(false);
});
