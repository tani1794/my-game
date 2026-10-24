import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createBeast, createFallbackBeast } from '../src/world/beast.js';

const flat = () => 0;

function heightOf(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  return box.max.y - box.min.y;
}

// 細長い箱を「AIで作った獣」の代わりにする
function fakeGltf() {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 1.8),
    new THREE.MeshStandardMaterial({ map: new THREE.Texture() }),
  ));
  return { scene: root };
}

test('読み込んだ獣は高さ5mにそろえて (0, -6) に置く', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  expect(heightOf(beast.object)).toBeCloseTo(5, 1);
  expect(beast.object.position.x).toBeCloseTo(0);
  expect(beast.object.position.z).toBeCloseTo(-6);
  expect(beast.collider).toEqual({ x: 0, z: -6, radius: 2.6 });
});

test('足元を地面の高さに合わせる', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', () => 0.4, async () => fakeGltf());
  beast.object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(beast.object);
  expect(box.min.y).toBeCloseTo(0.4, 2);
});

test('読み込みに失敗したら、コードで作る獣で続ける', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/missing.glb', flat, async () => { throw new Error('404'); });
  expect(beast.object.name).toBe('beast-fallback');
  expect(scene.getObjectByName('beast-fallback')).toBe(beast.object);
});

test('代わりの獣は高さ5mで、光る結晶が20本ほどある', () => {
  const beast = createFallbackBeast(flat);
  expect(heightOf(beast.object)).toBeGreaterThan(4);
  expect(heightOf(beast.object)).toBeLessThan(6);
  let crystals = 0;
  beast.object.traverse((o) => { if (o.name === 'beast-crystals') crystals = o.count; });
  expect(crystals).toBeGreaterThanOrEqual(18);
  expect(beast.collider).toEqual({ x: 0, z: -6, radius: 2.6 });
});

test('update(time) で呼吸し、結晶が明滅する', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  beast.update(0);
  const y0 = beast.object.scale.y;
  const glow0 = beast.glow();
  beast.update(0.5);
  expect(beast.object.scale.y).not.toBeCloseTo(y0, 5);
  expect(beast.glow()).not.toBeCloseTo(glow0, 5);
});

test('AIの獣は、テクスチャの青緑色の部分を発光させるシェーダーを持つ', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  let material;
  beast.object.traverse((o) => { if (o.isMesh) material = o.material; });
  const shader = {
    uniforms: {},
    fragmentShader: 'void main() {\n#include <emissivemap_fragment>\n}',
  };
  material.onBeforeCompile(shader);
  expect(shader.fragmentShader).toContain('uCrystalGlow');
  expect(shader.uniforms.uCrystalGlow).toBeDefined();
});

test('胴が長い獣は、前後にも当たり判定の円を並べて頭や尻尾をすり抜けない', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  // 箱は高さ0.8・奥行き1.8 → 高さ5mにそろえると奥行き約11m
  expect(beast.colliders.length).toBeGreaterThanOrEqual(3);
  expect(beast.colliders).toContainEqual(beast.collider);
  const zs = beast.colliders.map((c) => c.z);
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(5);
});

test('中身が空の獣モデルは、コードで作る獣に切り替え、当たり判定も正常な数値', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => ({ scene: new THREE.Group() }));
  expect(beast.object.name).toBe('beast-fallback');
  expect(beast.colliders.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.radius))).toBe(true);
});
