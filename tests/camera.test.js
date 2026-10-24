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
