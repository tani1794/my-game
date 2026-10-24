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
// 攻撃と回避は、すぐに切り替わって見えるよう短いフェードにする
const QUICK_FADE_SECONDS = 0.06;
// 向き直りの速さ：半回転を 0.08 秒で
const TURN_SPEED = Math.PI / 0.08;

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

  function play({ name, loop, timeScale }, fade) {
    const action = actions[name];
    if (!action) return;
    action.timeScale = timeScale;
    if (current === name) return;

    // 攻撃・回避・のけぞり・倒れるは1回だけ再生して、最後の姿勢で止める
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;

    actions[current]?.fadeOut(fade);
    action.reset().fadeIn(fade).play();
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
    play({ name: 'Idle', loop: true, timeScale: 1 }, FADE_SECONDS);
  }

  async function load(url, loader = loadGLTF) {
    // 中身が空のモデルも、仮の体のまま続ける（measureModel が throw する）
    await withFallback(
      loader(url).then((gltf) => setupCharacter(gltf)),
      () => null,
    );
  }

  // 戦いの状態（playerActions の frame）に合わせて、動かし、向きを変え、アニメーションを切り替える
  function drive(dt, frame, colliders, heightAt) {
    if (mixer) {
      const quick = frame.mode === 'attack' || frame.mode === 'dodge';
      play(frame.animation, quick ? QUICK_FADE_SECONDS : FADE_SECONDS);
      mixer.update(dt);
    }

    const moving = frame.mode !== 'dead' && frame.move.speed > 0;
    if (moving) {
      const next = stepPosition(object.position, frame.move, frame.move.speed * dt, colliders);
      object.position.x = next.x;
      object.position.z = next.z;
    }

    // 向き：face があればその角度へ、なければ動く向きへ。半回転でも 0.08 秒で追いつく
    let target = frame.face;
    if (target === null && moving) target = Math.atan2(frame.move.x, frame.move.z);
    if (target !== null && frame.mode !== 'dead') {
      const diff = Math.atan2(Math.sin(target - object.rotation.y), Math.cos(target - object.rotation.y));
      const turn = Math.sign(diff) * Math.min(Math.abs(diff), TURN_SPEED * dt);
      object.rotation.y = Math.atan2(Math.sin(object.rotation.y + turn), Math.cos(object.rotation.y + turn));
    }

    object.position.y = heightAt(object.position.x, object.position.z);
  }

  return { object, drive, load, currentAnimation: () => current, actionFor: (name) => actions[name] };
}
