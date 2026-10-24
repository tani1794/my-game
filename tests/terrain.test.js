import { test, expect } from 'vitest';
import * as THREE from 'three';
import { heightAt, createTerrain } from '../src/world/terrain.js';

test('中央の広場（半径12）と道は平ら', () => {
  expect(heightAt(0, 0)).toBe(0);
  expect(heightAt(0, -6)).toBe(0);
  expect(heightAt(0.5, 10)).toBe(0);
  expect(heightAt(1, -13.5)).toBe(0);
});

test('起伏は 0〜0.6m に収まる', () => {
  for (let x = -28; x <= 28; x += 2) {
    for (let z = -28; z <= 28; z += 2) {
      const h = heightAt(x, z);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0.6);
    }
  }
});

test('広場の外には起伏がある', () => {
  const heights = [];
  for (let x = -26; x <= 26; x += 1) heights.push(heightAt(x, 20));
  expect(Math.max(...heights)).toBeGreaterThan(0.1);
});

test('崩れた崖が外周を囲む', () => {
  const { colliders } = createTerrain(new THREE.Scene());
  expect(colliders.length).toBeGreaterThan(20);

  // 崖の当たり判定は半径 22 より外側にある（中央の遊び場を塞がない）
  for (const c of colliders) {
    expect(Math.hypot(c.x, c.z)).toBeGreaterThan(22);
  }
});

test('外周に隙間がなく、崖の外へ出られない', () => {
  const { colliders } = createTerrain(new THREE.Scene());
  // 半径 26 の円周上のどの方向も、いずれかの崖の当たり判定(+プレイヤー半径0.4)で塞がれている
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 90) {
    const x = Math.cos(a) * 25;
    const z = Math.sin(a) * 25;
    const blocked = colliders.some((c) => Math.hypot(x - c.x, z - c.z) <= c.radius + 0.4);
    expect(blocked).toBe(true);
  }
});
