import { test, expect } from 'vitest';
import * as THREE from 'three';
import {
  createBackdrop,
  createFallbackBackdrop,
} from '../src/world/backdrop.js';

const okLoader = { loadAsync: async () => new THREE.Texture() };
const badLoader = {
  loadAsync: async () => {
    throw new Error('404');
  },
};

test('画像の遠景は筒の内側に貼られ、霧の影響を受けない', async () => {
  const scene = new THREE.Scene();
  const mesh = await createBackdrop(
    scene,
    '/textures/backdrop.webp',
    okLoader,
  );

  expect(scene.getObjectByName('backdrop')).toBe(mesh);
  expect(mesh.material.side).toBe(THREE.BackSide);
  expect(mesh.material.fog).toBe(false);
  expect(mesh.material.map.colorSpace).toBe(THREE.SRGBColorSpace);
});

test('読み込みに失敗したら reject し、シーンに何も足さない', async () => {
  const scene = new THREE.Scene();

  await expect(
    createBackdrop(scene, '/missing.webp', badLoader),
  ).rejects.toThrow();

  expect(scene.children).toHaveLength(0);
});

test('代わりの遠景は空と3列の山', () => {
  const scene = new THREE.Scene();
  const group = createFallbackBackdrop(scene);

  expect(scene.getObjectByName('backdrop-fallback')).toBe(group);
  expect(group.children).toHaveLength(4);
});

test('代わりの遠景の山は半径 70〜85 にあり、毎回同じ形', () => {
  const positions = () => {
    const group = createFallbackBackdrop(new THREE.Scene());

    return group.children
      .slice(1)
      .map((mesh) => [
        ...mesh.geometry.getAttribute('position').array,
      ]);
  };

  const a = positions();
  expect(a).toEqual(positions());

  for (const ring of a) {
    for (let i = 0; i < ring.length; i += 3) {
      const radius = Math.hypot(ring[i], ring[i + 2]);
      expect(radius).toBeGreaterThanOrEqual(69.9);
      expect(radius).toBeLessThanOrEqual(85.1);
    }
  }
});

test('内側から見て左右が反転しない（画像を鏡写しで貼る）', async () => {
  const mesh = await createBackdrop(new THREE.Scene(), '/textures/backdrop.webp', okLoader);
  expect(mesh.material.map.wrapS).toBe(THREE.RepeatWrapping);
  expect(mesh.material.map.repeat.x).toBe(-1);
});

test('画像の左から25%にある太陽が、ワールドの太陽の方角に来る', async () => {
  const mesh = await createBackdrop(new THREE.Scene(), '/textures/backdrop.webp', okLoader);
  // 鏡写しにしたので、画像の横位置 0.25 は筒の u = 0.75 に来る。
  // 筒の u は、回転前のローカルで (sin(u·2π), cos(u·2π)) の向き
  const local = new THREE.Vector3(Math.sin(0.75 * Math.PI * 2), 0, Math.cos(0.75 * Math.PI * 2));
  const world = local.applyEuler(mesh.rotation);
  const sun = new THREE.Vector3(-30, 0, -40).normalize();
  expect(world.x).toBeCloseTo(sun.x, 5);
  expect(world.z).toBeCloseTo(sun.z, 5);
});
