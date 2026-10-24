import * as THREE from 'three';
import { loadGLTF, measureModel, withFallback } from '../assets.js';
import { mulberry32 } from './random.js';

const BEAST_X = 0;
const BEAST_Z = -6;
const BEAST_HEIGHT = 5;
// AIで作ったモデルの正面を、プレイヤーのいる +z に向けるための回転
const BEAST_YAW = 0;
const COLLIDER_RADIUS = 2.6;
const CRYSTAL_COLOR = new THREE.Color('#55e6ee');
// 怒り状態では結晶を赤寄りに（40% 混ぜる）、強く（1.3 倍）光らせる
const ENRAGED_TINT = new THREE.Color('#ff7a6a');
const ENRAGED_MIX = 0.4;
const ENRAGED_GLOW = 1.3;
const BODY_EMISSIVE = new THREE.Color('#242521');
const BODY_EMISSIVE_INTENSITY = 0.35;
const FLASH_TIME = 0.12;
const SHARD_COUNT = 12;
const SHARD_LIFE = 0.5;
const DEG = Math.PI / 180;

// 光る強さ：1.8 を中心に明滅させる（ブルームがない画質でも結晶だと分かる明るさ）
function glowAt(time) {
  return 1.8 + 0.6 * Math.sin(time * 2.2);
}

// 呼吸：足元を支点に、縦方向へわずかに伸び縮みする
function breathAt(time) {
  return 1 + 0.015 * Math.sin(time * 1.6);
}

const ease = (t) => t * t * (3 - 2 * t);

// テクスチャの色が青緑寄りの部分（結晶）だけを光らせる
function addCrystalGlow(material, glowUniform, colorUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCrystalGlow = glowUniform;
    shader.uniforms.uCrystalColor = colorUniform;

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

// 胴の前・中・後の当たり判定。位置と向きが変わったら、同じ配列の中身を書き換える
function placeColliders(colliders, position, facing, length) {
  const reach = Math.max(0, length / 2 - COLLIDER_RADIUS);
  const offsets = [0, reach, -reach];
  offsets.forEach((offset, i) => {
    colliders[i].x = position.x + Math.sin(facing) * offset;
    colliders[i].z = position.z + Math.cos(facing) * offset;
  });
}

// 当たったときに飛び散る結晶のかけら（Points を1つ使い回す）
function createShards(color) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SHARD_COUNT * 3), 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color, size: 0.18, transparent: true, depthWrite: false }),
  );
  points.name = 'beast-shards';
  points.visible = false;
  points.frustumCulled = false;
  return points;
}

// AIの獣と代わりの獣で共通の、動き・光・かけら・当たり判定
function rig({ pivot, length, heightAt, bodyMaterials, crystals }) {
  const position = { x: BEAST_X, z: BEAST_Z };
  const colliders = [0, 1, 2].map(() => ({ x: 0, z: 0, radius: COLLIDER_RADIUS }));
  const baseScaleY = pivot.scale.y;
  const shards = createShards(CRYSTAL_COLOR);
  const shardVelocities = Array.from({ length: SHARD_COUNT }, () => new THREE.Vector3());
  const random = mulberry32(17);

  pivot.add(shards);
  pivot.rotation.order = 'YXZ';

  let glow = glowAt(0);
  let flash = 0;
  let shardAge = SHARD_LIFE;
  let lastTime = null;

  // 当たったところ（ワールド座標）から、かけらを飛ばす
  function hitFlash(at = position) {
    flash = FLASH_TIME;
    shardAge = 0;
    const local = pivot.worldToLocal(new THREE.Vector3(at.x, pivot.position.y + 2.5, at.z));
    const array = shards.geometry.attributes.position.array;
    for (let i = 0; i < SHARD_COUNT; i++) {
      array[i * 3] = local.x;
      array[i * 3 + 1] = local.y;
      array[i * 3 + 2] = local.z;
      shardVelocities[i].set((random() - 0.5) * 6, 2 + random() * 4, (random() - 0.5) * 6);
    }
    shards.geometry.attributes.position.needsUpdate = true;
    shards.visible = true;
  }

  function animateShards(dt) {
    if (!shards.visible) return;
    shardAge += dt;
    if (shardAge >= SHARD_LIFE) {
      shards.visible = false;
      return;
    }
    const array = shards.geometry.attributes.position.array;
    for (let i = 0; i < SHARD_COUNT; i++) {
      shardVelocities[i].y -= 9.8 * dt;
      array[i * 3] += shardVelocities[i].x * dt;
      array[i * 3 + 1] += shardVelocities[i].y * dt;
      array[i * 3 + 2] += shardVelocities[i].z * dt;
    }
    shards.geometry.attributes.position.needsUpdate = true;
    shards.material.opacity = 1 - shardAge / SHARD_LIFE;
  }

  // 戦いの状態（beastBrain の frame）に合わせて、位置・向き・体の動き・光を決める
  function apply(frame, time) {
    const dt = lastTime === null ? 0 : Math.max(0, time - lastTime);
    lastTime = time;

    position.x = frame.position.x;
    position.z = frame.position.z;

    let yaw = frame.facing;
    let pitch = 0;
    let roll = 0;
    let sink = 0;
    let bob = 0;
    const cue = frame.cue;

    if (cue?.kind === 'slam') {
      // 前半で頭側を 25 度持ち上げ、後半で振り下ろして 3 度沈む
      pitch = cue.t < 0.5 ? -25 * DEG * ease(cue.t / 0.5) : (-25 + 28 * ease((cue.t - 0.5) / 0.5)) * DEG;
    } else if (cue?.kind === 'charge') {
      pitch = 8 * DEG * Math.sin(Math.PI * Math.min(1, cue.t * 1.2));
    } else if (cue?.kind === 'spin') {
      yaw += Math.PI * 2 * ease(cue.t);
    } else if (cue?.kind === 'stagger') {
      roll = 6 * DEG * Math.sin(cue.t * Math.PI * 6) * (1 - cue.t);
    } else if (cue?.kind === 'death') {
      roll = 70 * DEG * ease(cue.t);
      sink = 0.6 * ease(cue.t);
    }
    if (frame.phase === 'approach') bob = Math.abs(Math.sin(time * 4)) * 0.06;

    // 当たり判定は、見えている体と同じ向き（回転攻撃の途中も含む）に置く
    placeColliders(colliders, position, yaw, length);

    pivot.position.set(position.x, heightAt(position.x, position.z) - sink + bob, position.z);
    pivot.rotation.set(pitch, yaw, roll);
    pivot.scale.y = baseScaleY * (frame.phase === 'dead' ? 1 : breathAt(time));

    // 結晶の色と光：怒り状態で赤寄り・強く、倒れたら消える
    const dead = frame.phase === 'dead';
    crystals.setColor(frame.enraged ? CRYSTAL_COLOR.clone().lerp(ENRAGED_TINT, ENRAGED_MIX) : CRYSTAL_COLOR);
    glow = dead ? 0 : glowAt(time) * (frame.enraged ? ENRAGED_GLOW : 1);
    crystals.setGlow(glow);
    if (dead && cue && cue.t > 0.4) crystals.hide();
    else if (!dead) crystals.show();

    // 当たったときの白い光
    flash = Math.max(0, flash - dt);
    const level = flash / FLASH_TIME;
    for (const material of bodyMaterials) {
      material.emissive.copy(BODY_EMISSIVE).lerp(new THREE.Color('#ffffff'), level);
      material.emissiveIntensity = BODY_EMISSIVE_INTENSITY + level * 1.5;
    }
    animateShards(dt);
  }

  // 戦いが始まる前（または戦いの外）は、その場で呼吸と明滅だけする
  function update(time) {
    pivot.scale.y = baseScaleY * breathAt(time);
    glow = glowAt(time);
    crystals.setGlow(glow);
  }

  placeColliders(colliders, position, BEAST_YAW, length);
  pivot.position.set(BEAST_X, heightAt(BEAST_X, BEAST_Z), BEAST_Z);
  pivot.rotation.y = BEAST_YAW;

  return {
    object: pivot,
    position,
    collider: colliders[0],
    colliders,
    apply,
    update,
    hitFlash,
    glow: () => glow,
    flashLevel: () => flash / FLASH_TIME,
    crystalColor: () => crystals.color(),
  };
}

// AIで作ったモデルを、高さ5m・足元が原点のピボットに収める
function setupModel(model, heightAt) {
  const pivot = new THREE.Group();
  pivot.name = 'beast';

  const { box, size } = measureModel(model);
  const scale = BEAST_HEIGHT / size.y;

  model.scale.setScalar(scale);
  model.position.set(
    -(box.min.x + size.x / 2) * scale,
    -box.min.y * scale,
    -(box.min.z + size.z / 2) * scale,
  );
  pivot.add(model);

  const glowUniform = { value: glowAt(0) };
  const colorUniform = { value: CRYSTAL_COLOR.clone() };
  const bodyMaterials = [];
  model.traverse((part) => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.receiveShadow = true;
    // 真後ろからの逆光で岩肌が黒く潰れないよう、色を持ち上げ、ほんのり自ら光らせる
    part.material.color.multiplyScalar(1.4);
    part.material.emissive.copy(BODY_EMISSIVE);
    part.material.emissiveIntensity = BODY_EMISSIVE_INTENSITY;
    addCrystalGlow(part.material, glowUniform, colorUniform);
    bodyMaterials.push(part.material);
  });

  return rig({
    pivot,
    // 回転前の奥行き（z）が、獣の前後の長さ
    length: size.z * scale,
    heightAt,
    bodyMaterials,
    crystals: {
      setColor: (color) => colorUniform.value.copy(color),
      setGlow: (value) => { glowUniform.value = value; },
      hide: () => { glowUniform.value = 0; },
      show: () => {},
      color: () => colorUniform.value,
    },
  });
}

// 読み込みに失敗したときの代わり：岩の塊に光る結晶を生やした獣
export function createFallbackBeast(heightAt) {
  const pivot = new THREE.Group();
  pivot.name = 'beast-fallback';

  const rock = new THREE.MeshStandardMaterial({
    color: '#4a4744',
    roughness: 0.95,
    flatShading: true,
    emissive: BODY_EMISSIVE,
    emissiveIntensity: BODY_EMISSIVE_INTENSITY,
  });
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

  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: CRYSTAL_COLOR,
    emissive: CRYSTAL_COLOR,
    emissiveIntensity: glowAt(0),
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

  return rig({
    pivot,
    length: 6.2,
    heightAt,
    bodyMaterials: [rock],
    crystals: {
      setColor: (color) => {
        crystalMaterial.color.copy(color);
        crystalMaterial.emissive.copy(color);
      },
      setGlow: (value) => { crystalMaterial.emissiveIntensity = value; },
      hide: () => { crystals.visible = false; },
      show: () => { crystals.visible = true; },
      color: () => crystalMaterial.color,
    },
  });
}

export async function createBeast(scene, url, heightAt, load = loadGLTF) {
  const beast = await withFallback(
    load(url).then((gltf) => setupModel(gltf.scene, heightAt)),
    () => createFallbackBeast(heightAt),
  );
  scene.add(beast.object);
  return beast;
}
