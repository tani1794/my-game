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

// 当たり判定の表面までの距離（主人公の太さを引いた値。負なら入り込んでいる）
// 円 { x, z, radius } と、向きのある箱 { type: 'box', x, z, hx, hz, angle } に対応する。
// 箱の angle は three.js の rotation.y と同じ（箱の x 方向は (cos, -sin)、z 方向は (sin, cos)）
function clearance(collider, x, z) {
  const dx = x - collider.x;
  const dz = z - collider.z;
  if (collider.type !== 'box') return Math.hypot(dx, dz) - collider.radius - PLAYER_RADIUS;

  const cos = Math.cos(collider.angle);
  const sin = Math.sin(collider.angle);
  const lx = Math.abs(dx * cos - dz * sin) - collider.hx;
  const lz = Math.abs(dx * sin + dz * cos) - collider.hz;
  const outside = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
  return (outside > 0 ? outside : Math.max(lx, lz)) - PLAYER_RADIUS;
}

// 歩ける範囲：数なら原点を中心とした正方形の半径、関数なら (x, z) => 歩けるか
function inBounds(x, z, bound) {
  if (typeof bound === 'function') return bound(x, z);
  return Math.abs(x) <= bound && Math.abs(z) <= bound;
}

// 当たり判定の外へ出る移動は許す。すでに中に入り込んでいる場合（後から読み込まれた木など）は、
// 表面から遠ざかる移動だけ許して、閉じ込められないようにする
function canMove(fromX, fromZ, x, z, colliders, bound) {
  if (!inBounds(x, z, bound)) return false;

  return colliders.every((collider) => {
    const after = clearance(collider, x, z);
    if (after > 0) return true;
    return after > clearance(collider, fromX, fromZ);
  });
}

// 当たり判定の中に入り込んでいたら、いちばん近い外側へ押し出す（動く結晶獣に重なられたとき用）
export function pushOut(pos, colliders) {
  let { x, z } = pos;
  for (let pass = 0; pass < 4; pass++) {
    for (const c of colliders) {
      if (clearance(c, x, z) >= 0) continue;
      if (c.type === 'box') {
        // 箱の中：近い方の面の外へ出す
        const cos = Math.cos(c.angle);
        const sin = Math.sin(c.angle);
        const dx = x - c.x;
        const dz = z - c.z;
        let lx = dx * cos - dz * sin;
        let lz = dx * sin + dz * cos;
        const outX = c.hx + PLAYER_RADIUS - Math.abs(lx);
        const outZ = c.hz + PLAYER_RADIUS - Math.abs(lz);
        if (outX < outZ) lx = Math.sign(lx || 1) * (c.hx + PLAYER_RADIUS);
        else lz = Math.sign(lz || 1) * (c.hz + PLAYER_RADIUS);
        x = c.x + lx * cos + lz * sin;
        z = c.z - lx * sin + lz * cos;
        continue;
      }
      const limit = c.radius + PLAYER_RADIUS;
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const nx = d > 1e-6 ? dx / d : 1;
      const nz = d > 1e-6 ? dz / d : 0;
      x = c.x + nx * limit;
      z = c.z + nz * limit;
    }
  }
  return { x, z };
}

// x と z を別々に判定して、ぶつかった方向だけ止める（壁沿いに滑る）
// bound は歩ける範囲（数か関数。上の inBounds）
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
  // モデルごとの設定（王冠の騎士：メートルで作ってあり、脚が長いので歩き・走りをゆっくり再生）
  let speedOf = {};
  // マントの骨（cape1〜4）と前垂れ。動作には含まれないので、ここで揺らす
  let capeBones = [];
  let tabard = null;
  let lean = 0;
  let sway = 0;
  const lastPosition = new THREE.Vector3();

  function play({ name, loop, timeScale }, fade) {
    const action = actions[name];
    if (!action) return;
    action.timeScale = timeScale * (speedOf[name] ?? 1);
    if (current === name) return;

    // 攻撃・回避・のけぞり・倒れるは1回だけ再生して、最後の姿勢で止める
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;

    actions[current]?.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    current = name;
  }

  // キャラクターを読み込み、身長を合わせ、マントを青く染める（KayKit の騎士）。
  // 王冠の騎士（knight-crowned.glb）はメートルで作ってあるので、身長は合わせ直さない
  function setupCharacter(gltf) {
    const character = gltf.scene;
    character.name = 'character';

    const { box, size } = measureModel(character);
    let info = null;
    character.traverse((part) => { if (part.userData?.nativeScale) info = part.userData; });
    if (info) {
      character.position.y = 0;
      speedOf = info.animationSpeed ?? {};
    } else {
      character.scale.setScalar(PLAYER_HEIGHT / size.y);
      character.position.y = -box.min.y * character.scale.y;
    }
    capeBones = [1, 2, 3, 4].map((i) => character.getObjectByName(`cape${i}`)).filter(Boolean);
    tabard = character.getObjectByName('tabard') ?? null;
    lastPosition.copy(object.position);

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
  // bound：歩ける範囲（数か関数）。結晶獣戦は 28m の正方形、物語パートは地図の関数
  function drive(dt, frame, colliders, heightAt, bound = 28) {
    if (mixer) {
      const quick = frame.mode === 'attack' || frame.mode === 'dodge';
      play(frame.animation, quick ? QUICK_FADE_SECONDS : FADE_SECONDS);
      mixer.update(dt);
    }

    const moving = frame.mode !== 'dead' && frame.move.speed > 0;
    if (moving) {
      const next = stepPosition(object.position, frame.move, frame.move.speed * dt, colliders, bound);
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
    moveCloth(dt, frame);
  }

  // マント：走るほど後ろへなびき、少し揺れる（ばねのように追いつく）。前垂れは上がった腿に合わせて前へ
  const kneeL = new THREE.Vector3();
  const hipL = new THREE.Vector3();
  function moveCloth(dt, frame) {
    if (dt <= 0) return;
    const speed = Math.hypot(object.position.x - lastPosition.x, object.position.z - lastPosition.z) / dt;
    lastPosition.copy(object.position);
    if (capeBones.length) {
      const target = Math.min(0.75, speed * 0.085) + (frame.mode === 'dodge' ? 0.25 : 0);
      lean += (target - lean) * Math.min(1, dt * 5);
      sway += dt * (1.6 + speed * 0.5);
      capeBones.forEach((bone, i) => {
        bone.rotation.x = lean * (i === 0 ? 0.7 : 0.18) + Math.sin(sway - i * 0.7) * (0.02 + speed * 0.006);
        bone.rotation.z = Math.sin(sway * 0.7 - i) * 0.015;
      });
    }
    if (tabard) {
      // 左右の腿のうち、前へ上がっている方に合わせる
      let lift = 0;
      for (const side of ['l', 'r']) {
        const upper = object.getObjectByName(`upperleg${side}`);
        const lower = object.getObjectByName(`lowerleg${side}`);
        if (!upper || !lower) continue;
        object.worldToLocal(upper.getWorldPosition(hipL));
        object.worldToLocal(lower.getWorldPosition(kneeL));
        lift = Math.max(lift, Math.atan2(kneeL.z - hipL.z, hipL.y - kneeL.y));
      }
      tabard.rotation.x += (-Math.max(0, lift) * 0.9 - tabard.rotation.x) * Math.min(1, dt * 12);
    }
  }

  return { object, drive, load, currentAnimation: () => current, actionFor: (name) => actions[name] };
}
