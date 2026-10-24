import * as THREE from 'three';
import { loadGLTF, withFallback } from '../assets.js';
import { mulberry32 } from './random.js';

const BEAST_X = 0;
const BEAST_Z = -6;
const BEAST_HEIGHT = 5;
// AIで作ったモデルの正面を、プレイヤーのいる +z に向けるための回転
const BEAST_YAW = 0;
const COLLIDER_RADIUS = 2.6;
const CRYSTAL_COLOR = new THREE.Color('#3fe0d0');

// 光る強さ：1.5 を中心に明滅させる
function glowAt(time) {
  return 1.5 + 0.8 * Math.sin(time * 2.2);
}

// 呼吸：足元を支点に、縦方向へわずかに伸び縮みする
function breathAt(time) {
  return 1 + 0.015 * Math.sin(time * 1.6);
}

// テクスチャの色が青緑寄りの部分（結晶）だけを光らせる
function addCrystalGlow(material, glowUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCrystalGlow = glowUniform;
    shader.uniforms.uCrystalColor = { value: CRYSTAL_COLOR };

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uCrystalGlow;\nuniform vec3 uCrystalColor;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float crystal = smoothstep(0.15, 0.35, (diffuseColor.g + diffuseColor.b) * 0.5 - diffuseColor.r);
        totalEmissiveRadiance += uCrystalColor * crystal * uCrystalGlow;`,
      );
  };
}

// 獣の向き（BEAST_YAW）に沿って、胴の前後にも当たり判定の円を並べる
function collidersAlong(length) {
  const center = { x: BEAST_X, z: BEAST_Z, radius: COLLIDER_RADIUS };
  const reach = Math.max(0, length / 2 - COLLIDER_RADIUS);
  const dx = Math.sin(BEAST_YAW) * reach;
  const dz = Math.cos(BEAST_YAW) * reach;

  return [
    center,
    { x: BEAST_X + dx, z: BEAST_Z + dz, radius: COLLIDER_RADIUS },
    { x: BEAST_X - dx, z: BEAST_Z - dz, radius: COLLIDER_RADIUS },
  ];
}

function placeOnGround(pivot, heightAt) {
  pivot.position.set(BEAST_X, heightAt(BEAST_X, BEAST_Z), BEAST_Z);
  pivot.rotation.y = BEAST_YAW;
}

function animate(pivot, glowUniform) {
  const baseScale = pivot.scale.y;

  return (time) => {
    pivot.scale.y = baseScale * breathAt(time);
    glowUniform.value = glowAt(time);
  };
}

// AIで作ったモデルを、高さ5m・足元が原点のピボットに収める
function setupModel(model, heightAt) {
  const pivot = new THREE.Group();
  pivot.name = 'beast';

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = BEAST_HEIGHT / size.y;

  model.scale.setScalar(scale);
  model.position.set(
    -(box.min.x + size.x / 2) * scale,
    -box.min.y * scale,
    -(box.min.z + size.z / 2) * scale,
  );
  pivot.add(model);

  const glowUniform = { value: glowAt(0) };
  model.traverse((part) => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.receiveShadow = true;
    addCrystalGlow(part.material, glowUniform);
  });

  placeOnGround(pivot, heightAt);

  // 回転前の奥行き（z）が、獣の前後の長さ
  const colliders = collidersAlong(size.z * scale);

  return {
    object: pivot,
    collider: colliders[0],
    colliders,
    update: animate(pivot, glowUniform),
    glow: () => glowUniform.value,
  };
}

// 読み込みに失敗したときの代わり：岩の塊に光る結晶を生やした獣
export function createFallbackBeast(heightAt) {
  const pivot = new THREE.Group();
  pivot.name = 'beast-fallback';

  const rock = new THREE.MeshStandardMaterial({ color: '#4a4744', roughness: 0.95, flatShading: true });
  const lump = new THREE.DodecahedronGeometry(1, 0);

  const parts = [
    // [x, y, z, 幅, 高さ, 奥行き]
    [0, 2.6, 0, 2.2, 1.5, 3.4], // 胴
    [0, 2.9, 3.2, 1.2, 1.0, 1.3], // 頭
    [-1.3, 0.9, 1.9, 0.6, 1.0, 0.6], // 前脚
    [1.3, 0.9, 1.9, 0.6, 1.0, 0.6],
    [-1.3, 0.9, -1.9, 0.65, 1.0, 0.65], // 後脚
    [1.3, 0.9, -1.9, 0.65, 1.0, 0.65],
  ];

  for (const [x, y, z, w, h, d] of parts) {
    const mesh = new THREE.Mesh(lump, rock);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
  }

  const glowUniform = { value: glowAt(0) };
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: CRYSTAL_COLOR,
    emissive: CRYSTAL_COLOR,
    emissiveIntensity: glowUniform.value,
    roughness: 0.3,
    flatShading: true,
  });

  const random = mulberry32(3);
  const crystalCount = 22;
  const crystals = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 1, 5), crystalMaterial, crystalCount);
  crystals.name = 'beast-crystals';

  const dummy = new THREE.Object3D();
  for (let i = 0; i < crystalCount; i++) {
    // 背中の稜線に沿って、少し外へ傾けて生やす
    const along = (random() - 0.5) * 5.2;
    const side = (random() - 0.5) * 1.6;
    const length = 0.8 + random() * 1.3;
    dummy.position.set(side, 3.7 + length * 0.4, along);
    dummy.rotation.set((random() - 0.5) * 0.5, 0, -side * 0.45);
    dummy.scale.set(1, length, 1);
    dummy.updateMatrix();
    crystals.setMatrixAt(i, dummy.matrix);
  }
  crystals.castShadow = true;
  pivot.add(crystals);

  placeOnGround(pivot, heightAt);

  const breathe = animate(pivot, glowUniform);
  const colliders = collidersAlong(6.2);

  return {
    object: pivot,
    collider: colliders[0],
    colliders,
    update(time) {
      breathe(time);
      crystalMaterial.emissiveIntensity = glowUniform.value;
    },
    glow: () => glowUniform.value,
  };
}

export async function createBeast(scene, url, heightAt, load = loadGLTF) {
  const beast = await withFallback(
    load(url).then((gltf) => setupModel(gltf.scene, heightAt)),
    () => createFallbackBeast(heightAt),
  );
  scene.add(beast.object);
  return beast;
}
