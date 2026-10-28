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

// ── 関節のある結晶獣（beast-crystal.glb）の姿勢 ──
// gait：歩きの周期（ラジアン、進んだ道のりで進む）、stride：脚の振りの大きさ（0 止まる 〜 1 歩く 〜 1.4 突進）。
// 回転は各関節の x（前後に振る）・z（外へ開く）。脚は前へ振ると x が負
const LEG_SIDES = ['l', 'r'];
// 叩きつけの体の動き。t は 0〜1（0.5 が当たる瞬間＝攻撃の始まり。前半は予告の間）。
// 溜め（頭が少し下がり沈む）→ 後ろ足を支点に前を持ち上げる → 速く振り下ろす → 前へ沈む反動 → 戻る。
// hindZ：体の中心から後ろ足までの距離。持ち上げる間、後ろ足が地面に残るよう体を上げる（lift）
export function slamBody(t, hindZ) {
  let pitch = 0;
  let sink = 0;
  if (t < 0.15) {
    const k = ease(t / 0.15);
    pitch = 4 * DEG * k;
    sink = 0.25 * k;
  } else if (t < 0.42) {
    const k = ease((t - 0.15) / 0.27);
    pitch = (4 - 28 * k) * DEG;
    sink = 0.25 * (1 - k);
  } else if (t < 0.5) {
    const k = ((t - 0.42) / 0.08) ** 2;
    pitch = (-24 + 29 * k) * DEG;
    sink = 0.3 * k;
  } else {
    const k = ease(Math.min(1, (t - 0.5) / 0.5));
    pitch = 5 * DEG * (1 - k);
    sink = 0.3 * (1 - k);
  }
  return { pitch, lift: pitch < 0 ? hindZ * Math.sin(-pitch) : 0, sink };
}

// 叩きつけの進み（0〜1、slamBody と同じ）：予告の間は 0〜0.5、攻撃の間は 0.5〜1。叩きつけでなければ null
export function slamProgress(frame) {
  if (frame.cue?.kind === 'slam') return 0.5 + frame.cue.t * 0.5;
  if (frame.phase === 'telegraph' && frame.attack?.kind === 'slam') return frame.attack.progress * 0.5;
  return null;
}

export function jointPose({ gait, stride, cue, phase, time, slam = null }) {
  const pose = {};
  const set = (name, x = 0, z = 0, y = 0) => { pose[name] = { x, y, z }; };
  // 対角の脚が同時に動く歩き（左前と右後ろ、右前と左後ろ）
  for (const side of LEG_SIDES) {
    const offset = side === 'l' ? 0 : Math.PI;
    const fore = gait + offset;
    const hind = gait + offset + Math.PI;
    const lift = (a) => Math.max(0, Math.cos(a));
    set(`fore_${side}_upper`, -Math.sin(fore) * 0.42 * stride);
    set(`fore_${side}_lower`, lift(fore) * 0.55 * stride);
    set(`fore_${side}_paw`, -lift(fore) * 0.3 * stride);
    set(`hind_${side}_upper`, -Math.sin(hind) * 0.38 * stride);
    set(`hind_${side}_lower`, lift(hind) * 0.5 * stride);
    set(`hind_${side}_foot`, -lift(hind) * 0.3 * stride);
  }
  set('head', Math.sin(time * 0.9) * 0.03, 0, Math.sin(time * 0.6) * 0.05);
  set('jaw', 0.04 + Math.sin(time * 1.3) * 0.02);
  set('neck', 0);
  set('tail1', 0, 0, Math.sin(time * 1.4 + gait) * 0.12);
  set('tail2', 0, 0, Math.sin(time * 1.4 + gait - 0.8) * 0.18);

  if (phase === 'telegraph') pose.jaw.x = 0.35;
  if (slam !== null) {
    // 溜めで脚を曲げ、持ち上げで前脚を振り上げ、振り下ろしで叩きつける。当たった後は前脚が衝撃で曲がり、戻る
    const s = slam;
    const crouch = s < 0.15 ? ease(s / 0.15) : s < 0.42 ? 1 - ease((s - 0.15) / 0.27) : 0;
    const up = s < 0.15 ? 0 : s < 0.42 ? ease((s - 0.15) / 0.27) : s < 0.5 ? 1 - ((s - 0.42) / 0.08) ** 2 : 0;
    const recoil = s >= 0.5 ? 1 - ease(Math.min(1, (s - 0.5) / 0.4)) : 0;
    const { pitch } = slamBody(s, 0);
    for (const side of LEG_SIDES) {
      pose[`fore_${side}_upper`].x = -1.1 * up;
      pose[`fore_${side}_lower`].x = 0.9 * up + 0.25 * crouch + 0.3 * recoil;
      pose[`fore_${side}_paw`].x = -0.25 * recoil;
      pose[`hind_${side}_lower`].x += 0.3 * crouch;
      // 体が傾いても、後ろ足の裏は地面に平らなまま
      pose[`hind_${side}_foot`].x = -pitch;
    }
    pose.head.x = -0.15 * up + 0.2 * recoil;
    pose.jaw.x = 0.4 * Math.max(up, recoil);
  } else if (cue?.kind === 'stagger') {
    // よろめき：脚がたわみ、頭が揺れる
    const wobble = Math.sin(cue.t * Math.PI * 6) * (1 - cue.t);
    for (const side of LEG_SIDES) {
      pose[`fore_${side}_lower`].x += 0.35 * Math.abs(wobble);
      pose[`hind_${side}_lower`].x += 0.25 * Math.abs(wobble);
    }
    pose.head.z = wobble * 0.2;
  } else if (cue?.kind === 'death') {
    // 倒れる：脚を外へ崩し、頭を垂れ、あごを落とす
    const k = ease(cue.t);
    for (const side of LEG_SIDES) {
      const out = side === 'l' ? -1 : 1;
      pose[`fore_${side}_upper`].z = out * 0.65 * k;
      pose[`fore_${side}_lower`].x = 0.6 * k;
      pose[`hind_${side}_upper`].z = out * 0.5 * k;
      pose[`hind_${side}_lower`].x = 0.5 * k;
    }
    pose.head.x = 0.45 * k;
    pose.jaw.x = 0.3 * k;
  }
  return pose;
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
function rig({ pivot, length, heightAt, bodyMaterials, crystals, joints = null }) {
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
  // 関節のある獣：進んだ道のりで脚を振る
  let gait = 0;
  let stride = 0;
  const lastPosition = { x: BEAST_X, z: BEAST_Z };
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

    const slam = slamProgress(frame);
    if (slam !== null) {
      // 予告の間に後ろ足を支点に持ち上げ、当たる瞬間に振り下ろして沈む（slamBody）
      const body = slamBody(slam, length * 0.25);
      pitch = body.pitch;
      sink = body.sink - body.lift;
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
    if (joints) moveJoints(frame, cue, dt, time);

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

  function moveJoints(frame, cue, dt, time) {
    const moved = Math.hypot(position.x - lastPosition.x, position.z - lastPosition.z);
    lastPosition.x = position.x;
    lastPosition.z = position.z;
    // 一歩 2.4m。突進・回転は大きく速く振る
    gait += (moved / 2.4) * Math.PI * 2;
    if (cue?.kind === 'spin') gait += dt * 9;
    const speed = dt > 0 ? moved / dt : 0;
    const target = frame.phase === 'dead' ? 0 : cue?.kind === 'charge' ? 1.4 : cue?.kind === 'spin' ? 0.8 : Math.min(1, speed / 2.5);
    stride += (target - stride) * Math.min(1, dt * 6);
    const pose = jointPose({ gait, stride, cue, phase: frame.phase, time, slam: slamProgress(frame) });
    for (const [name, angles] of Object.entries(pose)) {
      const node = joints[name];
      if (node) node.rotation.set(angles.x, angles.y, angles.z);
    }
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
  // 関節のある結晶獣（メートルで作ってある。結晶の高さまで含めて合わせ直すと体が縮むので、そのままの大きさ）
  if (model.getObjectByName('fore_l_upper')) return setupJointedModel(model, heightAt);
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

// 関節のある結晶獣：岩・結晶・爪の材質が分かれている。結晶の材質の光を、怒り・明滅に合わせて変える
function setupJointedModel(model, heightAt) {
  const pivot = new THREE.Group();
  pivot.name = 'beast';
  const { size } = measureModel(model);
  pivot.add(model);
  const bodyMaterials = new Set();
  const crystalMaterials = new Set();
  const joints = {};
  model.traverse((part) => {
    if (!part.isMesh) {
      if (part.name) joints[part.name] = part;
      return;
    }
    part.castShadow = true;
    part.receiveShadow = true;
    if (part.material.name === 'beast_crystal') crystalMaterials.add(part.material);
    else if (part.material.name.startsWith('beast_rock')) {
      part.material.emissive.copy(BODY_EMISSIVE);
      part.material.emissiveIntensity = BODY_EMISSIVE_INTENSITY;
      bodyMaterials.add(part.material);
    }
  });
  const crystalColor = CRYSTAL_COLOR.clone();
  return rig({
    pivot,
    length: size.z,
    heightAt,
    bodyMaterials: [...bodyMaterials],
    joints,
    crystals: {
      setColor: (color) => {
        crystalColor.copy(color);
        for (const m of crystalMaterials) { m.color.copy(color).multiplyScalar(0.7); m.emissive.copy(color).multiplyScalar(0.55); }
      },
      // 明滅の強さ（1.8 前後）を、面の明暗が読める程度の発光に直す
      setGlow: (value) => { for (const m of crystalMaterials) m.emissiveIntensity = value * 0.5; },
      hide: () => { for (const m of crystalMaterials) m.emissiveIntensity = 0; },
      show: () => {},
      color: () => crystalColor,
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
