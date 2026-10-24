import * as THREE from 'three';
import { loadGLTF, measureModel, withFallback } from './assets.js';

const WALK_SPEED = 3;
const RUN_SPEED = 6;
const PLAYER_RADIUS = 0.4;

// スティックの向き（moveZ が正なら前進）を、カメラの向き yaw を基準にワールドの向きへ変換
export function moveToWorld(moveX, moveZ, yaw) {
  return {
    x: moveX * Math.cos(yaw) - moveZ * Math.sin(yaw),
    z: -moveX * Math.sin(yaw) - moveZ * Math.cos(yaw),
  };
}

export function speedFor({ moveX, moveZ, run }) {
  if (run) return RUN_SPEED;
  return WALK_SPEED * Math.min(1, Math.hypot(moveX, moveZ));
}

// 当たり判定の外へ出る移動は許す。すでに中に入り込んでいる場合（後から読み込まれた木など）は、
// 中心から遠ざかる移動だけ許して、閉じ込められないようにする
function canMove(fromX, fromZ, x, z, colliders, bound) {
  if (Math.abs(x) > bound || Math.abs(z) > bound) return false;

  return colliders.every((collider) => {
    const limit = collider.radius + PLAYER_RADIUS;
    const after = Math.hypot(x - collider.x, z - collider.z);
    if (after > limit) return true;
    return after > Math.hypot(fromX - collider.x, fromZ - collider.z);
  });
}

// x と z を別々に判定して、ぶつかった方向だけ止める（壁沿いに滑る）
export function stepPosition(pos, dir, distance, colliders, bound = 28) {
  let { x, z } = pos;

  const nextX = x + dir.x * distance;
  if (canMove(x, z, nextX, z, colliders, bound)) x = nextX;

  const nextZ = z + dir.z * distance;
  if (canMove(x, z, x, nextZ, colliders, bound)) z = nextZ;

  return { x, z };
}

const PLAYER_HEIGHT = 1.8;
const CAPE_COLOR = '#5a7fd6';
const FADE_SECONDS = 0.2;

// 速さに合わせて、待機・歩き・走りを選ぶ
function animationFor(speed) {
  if (speed === 0) return 'Idle';
  return speed > WALK_SPEED + 0.1 ? 'Running_A' : 'Walking_A';
}

export function createPlayer(scene) {
  const object = new THREE.Group();

  // ── 仮の体：青い胴体＋頭＋正面の目印。キャラクターを読み込めたら隠す ──
  const placeholder = new THREE.Group();
  placeholder.name = 'placeholder';
  object.add(placeholder);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.65, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#37a5d5' }),
  );
  body.position.y = 0.85;
  placeholder.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 8),
    new THREE.MeshStandardMaterial({ color: '#e3c1a1' }),
  );
  head.position.y = 1.6;
  placeholder.add(head);

  const front = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.18),
    new THREE.MeshStandardMaterial({ color: '#f7d67c' }),
  );
  front.position.set(0, 1.6, 0.25);
  placeholder.add(front);

  object.traverse((part) => {
    part.castShadow = true;
  });
  scene.add(object);

  let mixer = null;
  let actions = {};
  let current = null;

  function play(name, timeScale) {
    const action = actions[name];
    if (!action) return;
    action.timeScale = timeScale;
    if (current === name) return;

    actions[current]?.fadeOut(FADE_SECONDS);
    action.reset().fadeIn(FADE_SECONDS).play();
    current = name;
  }

  // キャラクターを読み込み、身長を合わせ、マントを青く染める
  function setupCharacter(gltf) {
    const character = gltf.scene;
    character.name = 'character';

    const { box, size } = measureModel(character);
    character.scale.setScalar(PLAYER_HEIGHT / size.y);
    character.position.y = -box.min.y * character.scale.y;

    character.traverse((part) => {
      if (!part.isMesh) return;
      part.castShadow = true;
      if (part.name === 'Knight_Cape') {
        part.material = part.material.clone();
        part.material.color.set(CAPE_COLOR);
      }
    });

    placeholder.visible = false;
    object.add(character);

    mixer = new THREE.AnimationMixer(character);
    actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    play('Idle', 1);
  }

  async function load(url, loader = loadGLTF) {
    // 中身が空のモデルも、仮の体のまま続ける（measureModel が throw する）
    await withFallback(
      loader(url).then((gltf) => setupCharacter(gltf)),
      () => null,
    );
  }

  function update(dt, input, yaw, colliders, heightAt) {
    const direction = moveToWorld(input.moveX, input.moveZ, yaw);
    const length = Math.hypot(direction.x, direction.z);
    const speed = length > 0 ? speedFor(input) : 0;

    if (mixer) {
      const name = animationFor(speed);
      // 歩きは、スティックの倒し具合に合わせて足の運びも遅くする
      play(name, name === 'Walking_A' ? Math.max(0.5, speed / WALK_SPEED) : 1);
      mixer.update(dt);
    }

    if (length > 0) {
      direction.x /= length;
      direction.z /= length;

      const next = stepPosition(
        object.position,
        direction,
        speedFor(input) * dt,
        colliders,
      );
      object.position.x = next.x;
      object.position.z = next.z;
      object.rotation.y = Math.atan2(direction.x, direction.z);
    }

    object.position.y = heightAt(object.position.x, object.position.z);
  }

  return { object, update, load, currentAnimation: () => current };
}
