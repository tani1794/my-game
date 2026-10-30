import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createGuardViews } from '../src/chapter/guards.js';

// 骸骨兵の代わり：読み込み後の名前（'handslot.r' は「.」が除かれて 'handslotr'）の右手と、箱の体
function fakeWarrior() {
  const scene = new THREE.Group();
  const slot = new THREE.Bone();
  slot.name = 'handslotr';
  slot.position.set(0.3, 1, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.3), new THREE.MeshStandardMaterial());
  body.position.y = 0.55;
  scene.add(slot, body);
  return { scene, animations: [] };
}
function fakeBlade() {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.1), new THREE.MeshStandardMaterial()));
  return { scene, animations: [] };
}

test('霧の衛兵は、右手に剣を持つ', async () => {
  const load = async (url) => (url.includes('skeleton_blade') ? fakeBlade() : fakeWarrior());
  const views = await createGuardViews(new THREE.Scene(), [{ id: 'g0', x: 0, z: 0 }], () => 0, { load });
  let blades = 0;
  views.object('g0').getObjectByName('handslotr').traverse((o) => { if (o.isMesh) blades += 1; });
  expect(blades).toBe(1);
});
