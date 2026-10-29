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

// 当たり判定の円の中に入り込んでいたら、いちばん近い外側へ押し出す（動く結晶獣に重なられたとき用）
export function pushOut(pos, colliders) {
  let { x, z } = pos;
  for (let pass = 0; pass < 4; pass++) {
    for (const c of colliders) {
      const limit = c.radius + PLAYER_RADIUS;
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      if (d >= limit) continue;
      const nx = d > 1e-6 ? dx / d : 1;
      const nz = d > 1e-6 ? dz / d : 0;
      x = c.x + nx * limit;
      z = c.z + nz * limit;
    }
  }
  return { x, z };
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

// 王冠の先まで。王冠の騎士はこの高さ（メートル）で作ってあるので、拡大縮小はほぼ 1 倍
const PLAYER_HEIGHT = 2.0;
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

  let cape = null;

  // キャラクターを読み込み、身長を合わせ、鎧に空の映り込みを付ける
  function setupCharacter(gltf) {
    const character = gltf.scene;
    character.name = 'character';

    const { box, size } = measureModel(character);
    character.scale.setScalar(PLAYER_HEIGHT / size.y);
    character.position.y = -box.min.y * character.scale.y;

    const environment = armorEnvironment();
    character.traverse((part) => {
      if (!part.isMesh) return;
      part.castShadow = true;
      // 腕を振ると体の外へ出る部分があるので、画面外判定で消えないようにする
      part.frustumCulled = false;
      if (part.material.metalness > 0) {
        part.material.envMap = environment;
        part.material.envMapIntensity = ENV_INTENSITY;
      }
    });

    placeholder.visible = false;
    object.add(character);
    object.updateMatrixWorld(true);
    cape = createCape(character);

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
      cape?.update(dt, frame);
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

  return { object, drive, load, currentAnimation: () => current, actionFor: (name) => actions[name], capeLift: () => cape?.lift() ?? 0 };
}

// ── 鎧の映り込み ──
// 金属は映り込むものが無いと黒くつぶれる。場面の空と地面の色（lighting.js の半球光と同じ）を
// 小さな画像にして、騎士の材質だけに映す。three.js が自動で映り込み用に変換する
const ENV_INTENSITY = 0.9;
let environmentTexture = null;

export function armorEnvironment() {
  if (environmentTexture) return environmentTexture;
  const width = 64;
  const height = 32;
  // 空の青をそのまま映すと黒鉄が紺に見えるので、灰色寄りにする
  const sky = new THREE.Color('#98a2ae');
  const horizon = new THREE.Color('#d2b088');
  const ground = new THREE.Color('#4a3d2c');
  const data = new Uint8Array(width * height * 4);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) {
    // DataTexture は 1 行目が画像の下端（真下）
    const up = ((y + 0.5) / height) * 2 - 1;
    if (up > 0) color.copy(horizon).lerp(sky, Math.min(1, up * 2.2));
    else color.copy(horizon).lerp(ground, Math.min(1, -up * 4));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = color.r * 255;
      data[i + 1] = color.g * 255;
      data[i + 2] = color.b * 255;
      data[i + 3] = 255;
    }
  }
  environmentTexture = new THREE.DataTexture(data, width, height);
  environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
  environmentTexture.colorSpace = THREE.SRGBColorSpace;
  environmentTexture.magFilter = THREE.LinearFilter;
  environmentTexture.needsUpdate = true;
  return environmentTexture;
}

// ── マント ──
// マントの骨（右・中・左に3節ずつ）を、動きの速さに合わせて後ろへなびかせる。布の計算はせず、
// 目標の角度へばねのように追いかけ、少し揺らすだけ（スマホでも軽い）。骨が無いモデルなら何もしない
const CAPE_CHAINS = ['l', 'c', 'r'];
// なびく角度を、付け根から順に何割ずつ曲げるか
const CAPE_SHARE = [0.4, 0.33, 0.27];
const CAPE_MAX_LIFT = 0.95; // 全力で走ったとき（ラジアン、約54°）
const CAPE_FOLLOW = 7; // 目標の角度へ追いつく速さ（1秒あたり）
// 倒れたときは体に沿わせて、地面に埋まらないよう少し体側へ寄せる
const CAPE_DEAD = -0.3;

export function capeTarget(frame) {
  if (frame.mode === 'dead') return CAPE_DEAD;
  if (frame.mode === 'attack') return 0.18;
  const speed = Math.min(1.2, frame.move.speed / 6);
  return CAPE_MAX_LIFT * speed ** 1.3;
}

function createCape(character) {
  const bones = [];
  const axis = new THREE.Vector3();
  const parentQuat = new THREE.Quaternion();
  for (const chain of CAPE_CHAINS) {
    for (let k = 1; k <= 3; k++) {
      const bone = character.getObjectByName(`cape_${chain}_${k}`);
      if (!bone) return null;
      // 騎士の左右の軸（+X）を、骨の親の向きで表したもの。これを軸に回すと後ろへ持ち上がる
      bone.parent.getWorldQuaternion(parentQuat);
      const local = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(character.getWorldQuaternion(new THREE.Quaternion()))
        .applyQuaternion(parentQuat.clone().invert())
        .normalize();
      bones.push({ bone, rest: bone.quaternion.clone(), axis: local, share: CAPE_SHARE[k - 1], phase: CAPE_CHAINS.indexOf(chain) * 1.7 + k });
    }
  }

  let lift = 0;
  let time = 0;
  const swing = new THREE.Quaternion();

  function update(dt, frame) {
    time += dt;
    lift += (capeTarget(frame) - lift) * (1 - Math.exp(-CAPE_FOLLOW * dt));
    const speed = Math.min(1, frame.move.speed / 6);
    for (const b of bones) {
      const flutter = (0.025 + 0.07 * speed) * Math.sin(time * (4 + 5 * speed) + b.phase) * (b.share + 0.2);
      axis.copy(b.axis);
      swing.setFromAxisAngle(axis, lift * b.share + flutter);
      b.bone.quaternion.multiplyQuaternions(swing, b.rest);
    }
  }

  return { update, lift: () => lift };
}
