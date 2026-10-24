import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const glbJson = (path) => {
  const b = readFileSync(path);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};

test('騎士に戦闘のアニメーション12本が入っている', () => {
  const names = glbJson('public/models/knight.glb').animations.map((a) => a.name);
  for (const n of ['Idle', 'Walking_A', 'Running_A', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal',
    '1H_Melee_Attack_Chop', 'Dodge_Forward', 'Dodge_Backward', 'Dodge_Left', 'Dodge_Right', 'Hit_A', 'Death_A']) {
    expect(names).toContain(n);
  }
});
