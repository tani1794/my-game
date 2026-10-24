import { test, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createEffects } from '../src/world/effects.js';

const high = { bloom: true };
const low = { bloom: false };
const beast = { x: 0, z: -6 };

function countPoints(scene) {
  let total = 0;

  scene.traverse((o) => {
    if (o.isPoints) {
      total += o.geometry.getAttribute('position').count;
    }
  });

  return total;
}

// --------------------------------------------------
// Required tests
// --------------------------------------------------

test('通常画質は 60 + 150 粒', () => {
  const scene = new THREE.Scene();

  createEffects(scene, high, beast);

  expect(countPoints(scene)).toBe(210);
});

test('低画質は半分', () => {
  const scene = new THREE.Scene();

  createEffects(scene, low, beast);

  expect(countPoints(scene)).toBe(105);
});

test('update を呼んでもエラーにならず、粒が動く', () => {
  const scene = new THREE.Scene();

  const effects = createEffects(scene, high, beast);

  const before = [];

  scene.traverse((o) => {
    if (o.isPoints) {
      before.push([
        ...o.geometry.getAttribute('position').array
      ]);
    }
  });

  effects.update(
    0.1,
    1,
    new THREE.Vector3(0, 0, 6)
  );

  const after = [];

  scene.traverse((o) => {
    if (o.isPoints) {
      after.push([
        ...o.geometry.getAttribute('position').array
      ]);
    }
  });

  expect(after).not.toEqual(before);
});

// --------------------------------------------------
// Draw call tests
// --------------------------------------------------

test('描画オブジェクトはPointsが2つだけ', () => {
  const scene = new THREE.Scene();

  createEffects(scene, high, beast);

  expect(scene.children).toHaveLength(2);

  expect(
    scene.children.every((o) => o.isPoints)
  ).toBe(true);
});

// --------------------------------------------------
// Dust tests
// --------------------------------------------------

test('土ぼこりの範囲・色・サイズ・属性が正しい', () => {
  const scene = new THREE.Scene();

  createEffects(scene, high, beast);

  const dust = scene.getObjectByName('effects-dust');

  const pos = dust.geometry.getAttribute('position');
  const fade = dust.geometry.getAttribute('aFade');

  expect(pos.count).toBe(60);
  expect(fade.count).toBe(60);

  expect(dust.material.size).toBeCloseTo(0.25);
  expect(dust.material.sizeAttenuation).toBe(true);
  expect(dust.material.transparent).toBe(true);

  expect(
    dust.material.color.equals(
      new THREE.Color('#c8a477')
    )
  ).toBe(true);

  expect(dust.position.x).toBe(beast.x);
  expect(dust.position.z).toBe(beast.z);

  for (let i = 0; i < pos.count; i++) {
    const radius = Math.hypot(
      pos.getX(i),
      pos.getZ(i)
    );

    expect(radius).toBeLessThanOrEqual(3.00001);

    expect(pos.getY(i)).toBeGreaterThanOrEqual(0);
    expect(pos.getY(i)).toBeLessThan(2);

    expect(fade.getX(i)).toBeGreaterThanOrEqual(0);
    expect(fade.getX(i)).toBeLessThanOrEqual(1);
  }
});

test('土ぼこりは上昇し、薄くなり、上限で再出現する', () => {
  const random = vi.spyOn(
    Math,
    'random'
  ).mockReturnValue(0.5);

  try {
    const scene = new THREE.Scene();

    const effects = createEffects(scene, high, beast);
    const dust = scene.getObjectByName('effects-dust');

    const pos = dust.geometry.getAttribute('position');
    const fade = dust.geometry.getAttribute('aFade');

    expect(pos.getY(0)).toBeCloseTo(1);

    const initialAlpha = fade.getX(0);

    effects.update(
      1,
      1,
      { x: 0, y: 0, z: 0 }
    );

    expect(pos.getY(0)).toBeCloseTo(1.5);

    expect(
      fade.getX(0)
    ).toBeLessThan(initialAlpha);

    effects.update(
      2,
      3,
      { x: 0, y: 0, z: 0 }
    );

    expect(pos.getY(0)).toBeCloseTo(0.5);
    expect(fade.getX(0)).toBeGreaterThan(0);

    expect(pos.version).toBeGreaterThan(0);
    expect(fade.version).toBeGreaterThan(0);
  } finally {
    random.mockRestore();
  }
});

test('土ぼこりは結晶獣の移動を追う', () => {
  const scene = new THREE.Scene();

  const movingBeast = {
    x: 0,
    z: -6,
  };

  const effects = createEffects(
    scene,
    high,
    movingBeast
  );

  movingBeast.x = 5;
  movingBeast.z = -2;

  effects.update(
    0.1,
    1,
    { x: 0, y: 0, z: 0 }
  );

  const dust = scene.getObjectByName('effects-dust');

  expect(dust.position.x).toBe(5);
  expect(dust.position.z).toBe(-2);
});

// --------------------------------------------------
// Light tests
// --------------------------------------------------

test('光の粒は加算合成で、深度書き込みをしない', () => {
  const scene = new THREE.Scene();

  createEffects(scene, high, beast);

  const light = scene.getObjectByName('effects-light');

  expect(light.material.blending).toBe(
    THREE.AdditiveBlending
  );

  expect(light.material.depthWrite).toBe(false);
  expect(light.material.transparent).toBe(true);

  expect(
    light.material.color.equals(
      new THREE.Color('#ffe2a8')
    )
  ).toBe(true);
});

test('光の粒は中心の20m以内に留まり、高さは0.5〜4m', () => {
  const scene = new THREE.Scene();

  const effects = createEffects(scene, high, beast);

  const center = {
    x: 24,
    y: 2,
    z: -18,
  };

  effects.update(0.1, 2, center);

  const light = scene.getObjectByName('effects-light');
  const pos = light.geometry.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const radius = Math.hypot(
      pos.getX(i) - center.x,
      pos.getZ(i) - center.z
    );

    expect(radius).toBeLessThanOrEqual(20.00001);

    expect(pos.getY(i)).toBeGreaterThanOrEqual(0.49999);
    expect(pos.getY(i)).toBeLessThanOrEqual(4.00001);
  }

  // Simulate the player moving to a distant position.
  const otherCenter = {
    x: -30,
    y: 0,
    z: 12,
  };

  effects.update(0.1, 3, otherCenter);

  for (let i = 0; i < pos.count; i++) {
    const radius = Math.hypot(
      pos.getX(i) - otherCenter.x,
      pos.getZ(i) - otherCenter.z
    );

    expect(radius).toBeLessThanOrEqual(20.00001);
  }
});

// --------------------------------------------------
// Shader tests
// --------------------------------------------------

test('GPU側の円形描画と土ぼこりの個別フェードをシェーダーに挿入', () => {
  const scene = new THREE.Scene();

  createEffects(scene, high, beast);

  const dust = scene.getObjectByName('effects-dust');
  const light = scene.getObjectByName('effects-light');

  // Simulate shader setup without WebGL.
  const makeShader = () => ({
    vertexShader: `
      void main() {
        #include <begin_vertex>
      }
    `,
    fragmentShader: `
      void main() {
        #include <map_particle_fragment>
      }
    `,
  });

  const dustShader = makeShader();

  dust.material.onBeforeCompile(dustShader);

  expect(dustShader.vertexShader).toContain(
    'attribute float aFade;'
  );

  expect(dustShader.fragmentShader).toContain(
    'gl_PointCoord'
  );

  expect(dustShader.fragmentShader).toContain(
    'vParticleFade'
  );

  const lightShader = makeShader();

  light.material.onBeforeCompile(lightShader);

  expect(lightShader.fragmentShader).toContain(
    'gl_PointCoord'
  );

  expect(lightShader.vertexShader).not.toContain(
    'aFade'
  );

  // Different shaders must not share a cache key.
  expect(
    dust.material.customProgramCacheKey()
  ).not.toBe(
    light.material.customProgramCacheKey()
  );
});
