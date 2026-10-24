import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createRuins } from '../src/world/ruins.js';

const flat = () => 0;

function find(scene, name) {
  return scene.getObjectByName(name);
}

// --------------------------------------------------
// Required tests
// --------------------------------------------------

test('柱4本の当たり判定を返す', () => {
  const { colliders } = createRuins(new THREE.Scene(), flat);

  expect(colliders).toHaveLength(4);

  expect(colliders).toEqual(expect.arrayContaining([
    { x: -7, z: -14, radius: 0.8 },
    { x: -3, z: -14, radius: 0.8 },
    { x: 3, z: -14, radius: 0.8 },
    { x: 7, z: -14, radius: 0.8 },
  ]));
});

test('シーンに物が追加される', () => {
  const scene = new THREE.Scene();

  createRuins(scene, flat);

  expect(scene.children.length).toBeGreaterThan(0);
});

test('欠け方は毎回同じ', () => {
  const count = () => {
    const scene = new THREE.Scene();

    createRuins(scene, flat);

    let instances = 0;

    scene.traverse((o) => {
      if (o.isInstancedMesh) instances += o.count;
    });

    return instances;
  };

  expect(count()).toBe(count());
});

test('update(time) を呼んでもエラーにならない', () => {
  const ruins = createRuins(new THREE.Scene(), flat);

  expect(() => ruins.update(1.5)).not.toThrow();
});

// --------------------------------------------------
// Instancing tests
// --------------------------------------------------

test('石・木材をそれぞれ1個のInstancedMeshにまとめる', () => {
  const scene = new THREE.Scene();

  createRuins(scene, flat);

  expect(scene.children).toHaveLength(4);

  const stone = find(scene, 'ruins-stones');
  const wood = find(scene, 'ruins-flag-wood');

  expect(stone.isInstancedMesh).toBe(true);
  expect(wood.isInstancedMesh).toBe(true);

  expect(wood.count).toBe(4);

  expect(stone.material.isMeshStandardMaterial).toBe(true);
  expect(stone.material.roughness).toBeCloseTo(0.95);

  expect(stone.instanceColor).not.toBeNull();
});

// --------------------------------------------------
// Arch tests
// --------------------------------------------------

test('横木は必ず一部が欠け、両端が残る', () => {
  const scene = new THREE.Scene();

  createRuins(scene, flat);

  const stone = find(scene, 'ruins-stones');

  // 28 pillar blocks + 6 to 8 lintel blocks.
  expect(stone.count).toBeGreaterThanOrEqual(34);
  expect(stone.count).toBeLessThanOrEqual(36);

  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();

  const beamXs = [];

  for (let i = 0; i < stone.count; i++) {
    stone.getMatrixAt(i, matrix);

    pos.setFromMatrixPosition(matrix);

    if (pos.y > 7) {
      beamXs.push(pos.x);
    }
  }

  for (const edge of [-7, -3, 3, 7]) {
    expect(
      beamXs.some((x) => Math.abs(x - edge) < 0.1)
    ).toBe(true);
  }
});

test('同じシードで石の位置と色も再現される', () => {
  function snapshot() {
    const scene = new THREE.Scene();

    createRuins(scene, flat);

    const stones = find(scene, 'ruins-stones');

    return {
      transforms: [...stones.instanceMatrix.array],
      colors: [...stones.instanceColor.array],
    };
  }

  expect(snapshot()).toEqual(snapshot());
});

test('柱の根元は地面から0.2m埋まる', () => {
  const scene = new THREE.Scene();

  const ground = (x) => x * 0.1;

  createRuins(scene, ground);

  const stones = find(scene, 'ruins-stones');

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  // 横木の石はアーチごとに柱の後へ入るため、番号ではなく位置で各柱の一番下の石を探す
  for (const x of [-7, -3, 3, 7]) {
    let bottom = Infinity;

    for (let i = 0; i < stones.count; i++) {
      stones.getMatrixAt(i, matrix);

      matrix.decompose(position, rotation, scale);

      if (Math.abs(position.x - x) > 0.1) continue;

      bottom = Math.min(bottom, position.y - 1.1 * scale.y / 2);
    }

    expect(bottom).toBeCloseTo(
      ground(x, -14) - 0.2
    );
  }
});

test('石材・木材・布が影を落とし、影を受ける', () => {
  const scene = new THREE.Scene();

  createRuins(scene, flat);

  for (const obj of scene.children) {
    expect(obj.castShadow).toBe(true);
    expect(obj.receiveShadow).toBe(true);
  }
});

// --------------------------------------------------
// Flag tests
// --------------------------------------------------

test('旗は2本で、指定の位置と角度にある', () => {
  const scene = new THREE.Scene();

  createRuins(scene, flat);

  const first = find(scene, 'ruins-flag-cloth-0');
  const second = find(scene, 'ruins-flag-cloth-1');

  expect(first.position.toArray()).toEqual([
    -9, 0, 4,
  ]);

  expect(second.position.toArray()).toEqual([
    -7, 0, 6,
  ]);

  expect(first.rotation.y).toBeCloseTo(0.4);
  expect(second.rotation.y).toBeCloseTo(0.4);

  expect(first.material.side).toBe(THREE.DoubleSide);
});

test('布は縦8分割で、金色の紋章を同じジオメトリに持つ', () => {
  const scene = new THREE.Scene();

  createRuins(scene, flat);

  const first = find(scene, 'ruins-flag-cloth-0');
  const second = find(scene, 'ruins-flag-cloth-1');

  // Both flags share the same geometry.
  expect(first.geometry).toBe(second.geometry);

  const pos = first.geometry.getAttribute('position');
  const colors = first.geometry.getAttribute('color');

  // 8 strips * 12 rows * 6 vertices + emblem.
  expect(pos.count).toBeGreaterThan(8 * 12 * 6);

  expect(colors.count).toBe(pos.count);

  const gold = new THREE.Color('#c9a96a');

  let hasGold = false;

  for (let i = 0; i < colors.count; i++) {
    const match =
      Math.abs(colors.getX(i) - gold.r) < 1e-5 &&
      Math.abs(colors.getY(i) - gold.g) < 1e-5 &&
      Math.abs(colors.getZ(i) - gold.b) < 1e-5;

    if (match) {
      hasGold = true;
      break;
    }
  }

  expect(hasGold).toBe(true);
});

test('旗の上側は固定し、下側ほど大きく揺れるシェーダーを挿入する', () => {
  const scene = new THREE.Scene();

  const ruins = createRuins(scene, flat);

  const first = find(scene, 'ruins-flag-cloth-0');
  const second = find(scene, 'ruins-flag-cloth-1');

  // Simulate the shader setup without WebGL.
  const shader = {
    uniforms: {},
    vertexShader: `
      void main() {
        #include <begin_vertex>
      }
    `,
  };

  first.material.onBeforeCompile(shader);

  expect(shader.vertexShader).toContain(
    'uniform float uFlagTime;'
  );

  expect(shader.vertexShader).toContain(
    'falloff * falloff'
  );

  expect(shader.uniforms.uFlagTime.value).toBe(0);

  ruins.update(1.5);

  expect(shader.uniforms.uFlagTime.value).toBe(1.5);

  expect(
    second.material.userData.timeUniform.value
  ).toBe(1.5);

  // The two flags must not have identical phases.
  expect(
    first.material.userData.phaseUniform.value
  ).not.toBe(
    second.material.userData.phaseUniform.value
  );
});

test('旗の木製支柱の高さは3m', () => {
  const scene = new THREE.Scene();

  createRuins(scene, flat);

  const wood = find(scene, 'ruins-flag-wood');

  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  wood.getMatrixAt(0, matrix);

  matrix.decompose(pos, quaternion, scale);

  expect(scale.y).toBeCloseTo(3);
  expect(pos.y).toBeCloseTo(1.5);
});
