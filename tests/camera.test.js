import { test, expect } from 'vitest';
import * as THREE from 'three';
import { cameraPose } from '../src/camera.js';

const origin = new THREE.Vector3(0, 0, 0);

test('yaw 0 では主人公の後ろ（+z側）・上から見下ろす', () => {
  const { position } = cameraPose(origin, 0, 0.25, 5.5, 0);
  expect(position.z).toBeGreaterThan(4);
  expect(position.y).toBeGreaterThan(1.3);
  expect(position.x).toBeCloseTo(0);
});

test('注視点は頭上1.3m', () => {
  const { lookAt } = cameraPose(origin, 0, 0.25, 5.5, 0);
  expect(lookAt.y).toBeCloseTo(1.3);
});

test('肩越しずらし：注視点とカメラを画面の右へずらすと、主人公は中央やや左に映る', () => {
  const { position, lookAt } = cameraPose(origin, 0, 0.25, 5.5, 0.7);
  // yaw 0 では画面の右は +x
  expect(lookAt.x).toBeCloseTo(0.7);
  expect(position.x).toBeCloseTo(0.7);
});

test('向きを変えても、ずらす方向は画面の右', () => {
  // yaw π/2：カメラは +x 側から -x を見る。画面の右は -z
  const { lookAt } = cameraPose(origin, Math.PI / 2, 0.25, 5.5, 0.7);
  expect(lookAt.z).toBeCloseTo(-0.7);
  expect(lookAt.x).toBeCloseTo(0);
});

// ── ロックオン・揺れ・回避時の遅れ（Task 12） ──
import { lockYaw, createCameraRig } from '../src/camera.js';

const run = (rig, target, seconds, dt = 0.01) => {
  let pose;
  for (let t = 0; t < seconds - 1e-9; t += dt) pose = rig.update(target, dt);
  return pose;
};
const hero = new THREE.Vector3(6, 0, -6);

test('lockYaw：主人公の後ろから結晶獣を見る向き', () => {
  expect(lockYaw({ x: 0, z: 6 }, { x: 0, z: -6 })).toBeCloseTo(0);
  expect(lockYaw({ x: 6, z: -6 }, { x: 0, z: -6 })).toBeCloseTo(Math.PI / 2);
});

test('ロック中は、1秒に180度までの速さで結晶獣のほうへ回る', () => {
  const rig = createCameraRig();
  rig.setLock({ x: 0, z: -6 });
  const pose = run(rig, hero, 0.25);
  expect(pose.yaw).toBeCloseTo(Math.PI / 4, 1);
  expect(run(rig, hero, 0.5).yaw).toBeCloseTo(Math.PI / 2, 2);
});

test('ロック中の横ドラッグは見回し（最大30度）で、離すと0.5秒で戻る。縦ドラッグは効く', () => {
  const rig = createCameraRig();
  rig.setLock({ x: 0, z: -6 });
  run(rig, hero, 1);
  rig.drag(-300, 40); // 横に約100度ぶん、縦にも
  const looking = run(rig, hero, 0.05);
  expect(looking.yaw - Math.PI / 2).toBeCloseTo(Math.PI / 6, 2);
  expect(looking.pitch).toBeGreaterThan(0.2);
  rig.release();
  expect(run(rig, hero, 0.55).yaw).toBeCloseTo(Math.PI / 2, 2);
});

test('解除すると、その時点の向きのまま', () => {
  const rig = createCameraRig();
  rig.setLock({ x: 0, z: -6 });
  run(rig, hero, 1);
  rig.setLock(null);
  expect(run(rig, hero, 1).yaw).toBeCloseTo(Math.PI / 2, 2);
});

test('揺れは 0.2 秒で消える', () => {
  const still = createCameraRig();
  const shaken = createCameraRig();
  const target = new THREE.Vector3(0, 0, 6);
  shaken.shake(1);
  const a = shaken.update(target, 0.05);
  const b = still.update(target, 0.05);
  expect(a.position.distanceTo(b.position)).toBeGreaterThan(0.01);
  run(shaken, target, 0.25);
  run(still, target, 0.25);
  expect(shaken.update(target, 0.01).position.distanceTo(still.update(target, 0.01).position)).toBeLessThan(1e-6);
});

test('回避中の遅れ：主人公が急に動くと、カメラは約0.2秒で追いつく', () => {
  const rig = createCameraRig();
  rig.update(new THREE.Vector3(0, 0, 6), 0.01);
  rig.setLag(true);
  const moved = new THREE.Vector3(2, 0, 6);
  const first = rig.update(moved, 0.016);
  expect(first.lookAt.x).toBeLessThan(1.1 + 1.5); // 肩越しのずらし 1.1 + まだ追いついていない
  const later = run(rig, moved, 0.3);
  expect(later.lookAt.x).toBeCloseTo(2 + 1.1, 1);
});

// ── 第一章：壁に埋まらない・地面の下へ行かない・向きを合わせる ──
import * as THREE_CAM from 'three';

test('注視点とカメラの間に壁があれば、その手前まで寄る（すぐに）。壁がなくなると、ゆっくり戻る', () => {
  const rig = createCameraRig();
  const target = new THREE_CAM.Vector3(0, 0, 0);
  const far = rig.update(target, 1 / 60);
  const full = far.position.distanceTo(far.lookAt);
  const near = rig.update(target, 1 / 60, { limit: () => 2 });
  expect(near.position.distanceTo(near.lookAt)).toBeCloseTo(2, 3);
  const back = rig.update(target, 0.1, {});
  const d = back.position.distanceTo(back.lookAt);
  expect(d).toBeGreaterThan(2);
  expect(d).toBeLessThan(full);
  let pose;
  for (let i = 0; i < 120; i++) pose = rig.update(target, 1 / 30, {});
  expect(pose.position.distanceTo(pose.lookAt)).toBeCloseTo(full, 3);
});

test('カメラは地面より下へ行かない', () => {
  const rig = createCameraRig();
  const pose = rig.update(new THREE_CAM.Vector3(0, 0, 0), 1 / 60, { ground: () => 5 });
  expect(pose.position.y).toBeGreaterThanOrEqual(5.4 - 1e-6);
});

test('setYaw で向きを合わせる（主人公の後ろから）', () => {
  const rig = createCameraRig();
  rig.setYaw(Math.PI / 2);
  expect(rig.yaw()).toBeCloseTo(Math.PI / 2);
});
