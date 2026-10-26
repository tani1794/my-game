import { test, expect } from 'vitest';
import { reachable } from '../src/areas/kit.js';
import { ROSE } from '../src/areas/rose/layout.js';

const { level, checkpoints, interactables, zones } = ROSE;
const start = { ...checkpoints.roseEntry, y: 0 };
const at = (spot) => ({ x: spot.x, z: spot.z });

test('入口から、崩れた橋の端・中央庭園・水門レバー・近道の閂へ行ける（仕掛けの前）', () => {
  for (const spot of [zones.collapse, zones.garden, interactables.waterLever, interactables.shortcutGate, interactables.roseStatue]) {
    expect(reachable(level, start, at(spot), {})).toBe(true);
  }
});

test('下層通路は水があるうちは通れず、排水すると東の機室（留め具）へ行ける', () => {
  expect(reachable(level, start, at(interactables.clamp), {})).toBe(false);
  expect(reachable(level, start, at(interactables.clamp), { drained: true })).toBe(true);
  expect(reachable(level, start, at(interactables.liftLever), { drained: true })).toBe(true);
});

test('昇降橋が降りるまで、誓剣の門前へは渡れない', () => {
  const flags = { drained: true, clampFreed: true };
  expect(reachable(level, start, at(zones.oath), flags)).toBe(false);
  expect(reachable(level, start, at(zones.oath), { ...flags, bridgeLowered: true })).toBe(true);
  expect(reachable(level, start, at(zones.caveMouth), { ...flags, bridgeLowered: true })).toBe(true);
});

test('城の本丸へは入れない（崩れた本橋の先は歩けない）', () => {
  expect(level.walkable(0, 15, 0, {})).toBe(false);
  expect(level.walkable(0, -20, 0, { drained: true, bridgeLowered: true })).toBe(false);
});

test('近道：閂を外すまで、庭園から入口へ直接は上がれない', () => {
  const gate = level.colliders({}).filter((c) => c.unless === 'shortcutOpen');
  expect(gate.length).toBe(1);
  expect(level.colliders({ shortcutOpen: true }).filter((c) => c.unless === 'shortcutOpen').length).toBe(0);
});

test('残響の碑（中央庭園・誓剣の門前）と復帰地点は、歩ける場所にある', () => {
  for (const [name, point] of Object.entries(checkpoints)) {
    const flags = name === 'oath' ? { drained: true, clampFreed: true, bridgeLowered: true } : {};
    expect(level.walkable(point.x, point.z, point.y ?? 0, flags)).toBe(true);
  }
});
