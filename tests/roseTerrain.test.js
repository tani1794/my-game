import { test, expect } from 'vitest';
import { roseTerrainHeight, VALLEY_FLOOR, plateauAt } from '../src/areas/rose/terrain.js';
import { ROSE } from '../src/areas/rose/layout.js';
import { floorHeight } from '../src/areas/kit.js';

const level = ROSE.level;
// 床の上の点を細かく拾う
function floorPoints(floor, step = 1) {
  const points = [];
  for (let x = -70; x <= 140; x += step) {
    for (let z = -20; z <= 80; z += step) {
      const y = floorHeight(floor, x, z);
      if (y !== null) points.push({ x, z, y });
    }
  }
  return points;
}

test('地形は、どの歩ける床の上にも突き出さない（床の上面より下）', () => {
  for (const floor of level.floors) {
    for (const p of floorPoints(floor)) {
      expect(roseTerrainHeight(p.x, p.z), `${floor.id} (${p.x}, ${p.z})`).toBeLessThanOrEqual(p.y + 0.001);
    }
  }
});

test('地面に乗る床（入口・庭園・あずまや・門前）は、地形の上にぴったり乗っている（浮かない）', () => {
  for (const id of ['entry', 'garden', 'arbor', 'gardenPath', 'oathPlaza', 'caveMouth']) {
    const floor = level.floors.find((f) => f.id === id);
    // 道や階段とつながる所は少し削れる（床の厚い石の台の下に隠れる）。それ以外は地面に乗っている
    const gaps = floorPoints(floor, 2).map((p) => p.y - roseTerrainHeight(p.x, p.z));
    expect(gaps.filter((g) => g >= 0.2).length / gaps.length, id).toBeLessThan(0.05);
    expect(Math.max(...gaps), id).toBeLessThan(1.2);
  }
});

test('橋の下は谷：本橋・昇降橋の下は、地形まで十分な高さがある（橋脚が必要）', () => {
  for (const z of [26, 30, 34]) expect(0 - roseTerrainHeight(0, z)).toBeGreaterThan(12);
  for (const x of [54, 60, 64]) expect(0 - roseTerrainHeight(x, 25)).toBeGreaterThan(12);
});

test('谷底には沢の窪みがあり、谷底より高い起伏もある（平らな板ではない）', () => {
  const samples = [];
  for (let x = -20; x <= 60; x += 4) for (let z = -30; z <= 20; z += 4) if (!plateauAt(x, z)) samples.push(roseTerrainHeight(x, z));
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  expect(min).toBeLessThan(VALLEY_FLOOR);
  expect(max - min).toBeGreaterThan(4);
});

test('城の高台：城の敷地全体が平らな岩の台の上（中心だけでなく四隅も）', () => {
  const corners = [[-45, -52], [45, -52], [-45, -112], [45, -112], [0, -85]];
  const heights = corners.map(([x, z]) => roseTerrainHeight(x, z));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.01);
  expect(heights[0]).toBeGreaterThan(-2);
});

test('外周は丘に囲まれ、どの向きも地面が続く（遠くほど高い所がある）', () => {
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const far = roseTerrainHeight(15 + Math.sin(a) * 230, -10 + Math.cos(a) * 230);
    expect(Number.isFinite(far)).toBe(true);
    expect(far).toBeGreaterThan(VALLEY_FLOOR - 5);
  }
  const ring = Array.from({ length: 16 }, (_, i) => roseTerrainHeight(15 + Math.sin(i) * 230, -10 + Math.cos(i) * 230));
  expect(Math.max(...ring) - Math.min(...ring)).toBeGreaterThan(15);
});
