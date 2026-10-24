import { test, expect } from 'vitest';
import { withFallback } from '../src/assets.js';

test('読み込みに失敗したら代わりを返す', async () => {
  await expect(withFallback(Promise.reject(new Error('404')), () => 'fb')).resolves.toBe('fb');
});

test('成功したらそのまま返す', async () => {
  await expect(withFallback(Promise.resolve('ok'), () => 'fb')).resolves.toBe('ok');
});

import * as THREE from 'three';
import { measureModel } from '../src/assets.js';

test('中身のあるモデルは大きさを返す', () => {
  const model = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3));
  const { size } = measureModel(model);
  expect(size.y).toBeCloseTo(2);
});

test('中身が空のモデルは、読み込み失敗として扱う（代わりの見た目にするため）', () => {
  expect(() => measureModel(new THREE.Group())).toThrow();
});

test('高さが0のモデルも読み込み失敗として扱う', () => {
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  expect(() => measureModel(flat)).toThrow();
});
