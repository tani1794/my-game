import { test, expect } from 'vitest';
import * as THREE from 'three';
import { placeVegetation, createVegetation } from '../src/world/vegetation.js';
import { isOnPath } from '../src/world/terrain.js';

const flat = () => 0;
const preset = { grass: 3000 };
const layout = placeVegetation();

const near = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

test('配置は毎回同じ', () => {
  expect(placeVegetation()).toEqual(layout);
});

test('木は約24本、崖の内側（半径24未満）で、道・アーチ・獣・開始位置を塞がない', () => {
  expect(layout.trees.length).toBeGreaterThanOrEqual(20);
  expect(layout.trees.length).toBeLessThanOrEqual(28);
  for (const t of layout.trees) {
    expect(Math.hypot(t.x, t.z)).toBeLessThan(23.5);
    expect(isOnPath(t.x, t.z)).toBe(false);
    expect(Math.abs(t.x) < 9.5 && t.z > -17 && t.z < -11).toBe(false); // アーチ
    expect(near(t, 0, -6, 7)).toBe(false); // 結晶獣
    expect(near(t, 0, 6, 5)).toBe(false); // 開始位置
  }
});

test('アーチの左右には木をまとめて置く', () => {
  const left = layout.trees.filter((t) => t.x < -9 && t.z < -8);
  const right = layout.trees.filter((t) => t.x > 9 && t.z < -8);
  expect(left.length).toBeGreaterThanOrEqual(3);
  expect(right.length).toBeGreaterThanOrEqual(3);
});

test('岩は約15個で、道と広場の中央6mと獣と開始位置を避ける', () => {
  expect(layout.rocks.length).toBeGreaterThanOrEqual(12);
  expect(layout.rocks.length).toBeLessThanOrEqual(18);
  for (const r of layout.rocks) {
    expect(isOnPath(r.x, r.z)).toBe(false);
    expect(Math.hypot(r.x, r.z)).toBeGreaterThanOrEqual(6);
    expect(near(r, 0, -6, 7)).toBe(false);
    expect(near(r, 0, 6, 3)).toBe(false);
  }
});

test('草は最大6000束で、道の上には生やさない', () => {
  expect(layout.grass).toHaveLength(6000);
  for (const g of layout.grass) expect(isOnPath(g.x, g.z)).toBe(false);
});

test('読み込みに失敗しても、草だけで起動を続ける', async () => {
  const scene = new THREE.Scene();
  const vegetation = await createVegetation(scene, preset, flat, async () => { throw new Error('404'); });
  expect(vegetation.colliders).toEqual([]);
  const grass = scene.getObjectByName('vegetation-grass');
  expect(grass.count).toBe(3000);
});

test('setGrassCount で草の数を変え、花は草の1/10', async () => {
  const scene = new THREE.Scene();
  const vegetation = await createVegetation(scene, preset, flat, async () => { throw new Error('404'); });
  vegetation.setGrassCount(800);
  expect(scene.getObjectByName('vegetation-grass').count).toBe(800);
  vegetation.setGrassCount(99999);
  expect(scene.getObjectByName('vegetation-grass').count).toBe(6000);
});

test('木は幹ごとに半径0.5、岩は大きさに応じた当たり判定を持つ', async () => {
  const scene = new THREE.Scene();
  const fakeTree = async () => ({
    scene: new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 0.4), new THREE.MeshStandardMaterial()),
  });
  const vegetation = await createVegetation(scene, preset, flat, fakeTree);
  expect(vegetation.colliders).toHaveLength(layout.trees.length + layout.rocks.length);
  const trees = vegetation.colliders.slice(0, layout.trees.length);
  expect(trees.every((c) => c.radius === 0.5)).toBe(true);
  const rocks = vegetation.colliders.slice(layout.trees.length);
  expect(rocks.every((c) => c.radius > 0.4 && c.radius < 2)).toBe(true);
});
