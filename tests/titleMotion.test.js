import { test, expect } from 'vitest';
import {
  visibleSize, imageToScreen, cameraAt, BASE_ZOOM, CAMERA_PERIODS,
} from '../src/title/framing.js';

test('絵は画面を覆う大きさで置く（横長の画面では横いっぱい、上下が切れる）', () => {
  const wide = visibleSize(844 / 390, 1672 / 941, 1);
  expect(wide.x).toBeCloseTo(1);
  expect(wide.y).toBeCloseTo((1672 / 941) / (844 / 390));
  const tall = visibleSize(4 / 3, 1672 / 941, 1);
  expect(tall.y).toBeCloseTo(1);
  expect(tall.x).toBeCloseTo((4 / 3) / (1672 / 941));
  expect(visibleSize(844 / 390, 1672 / 941, 2).x).toBeCloseTo(0.5);
});

test('絵の中の点を、画面の座標（-1〜1）に移す', () => {
  const view = { x: 0.5, y: 0.5, zoom: 1 };
  expect(imageToScreen({ x: 0.5, y: 0.5 }, view, 844 / 390, 1672 / 941)).toEqual({ x: 0, y: 0 });
  // 横いっぱいなので、絵の右端は画面の右端。y は上が +
  const right = imageToScreen({ x: 1, y: 0.5 }, view, 844 / 390, 1672 / 941);
  expect(right.x).toBeCloseTo(1);
  const top = imageToScreen({ x: 0.5, y: 0.5 - visibleSize(844 / 390, 1672 / 941, 1).y / 2 }, view, 844 / 390, 1672 / 941);
  expect(top.y).toBeCloseTo(1);
});

test('カメラはごく小さく、周期的に動き、長く流しても寄り続けたりずれ続けたりしない', () => {
  const longest = Math.max(...CAMERA_PERIODS);
  for (const t of [0, 7.3, 31, 100, 1000, 54321]) {
    const camera = cameraAt(t);
    expect(Math.abs(camera.x - 0.5)).toBeLessThan(0.02);
    expect(Math.abs(camera.y - 0.5)).toBeLessThan(0.02);
    expect(camera.zoom).toBeGreaterThanOrEqual(BASE_ZOOM - 0.02);
    expect(camera.zoom).toBeLessThanOrEqual(BASE_ZOOM + 0.02);
    expect(Math.abs(camera.lookX)).toBeLessThanOrEqual(1);
  }
  // どの周期の整数倍でも同じ位置に戻る（すべての周期の公倍数の時刻で一致）
  const lcm = CAMERA_PERIODS.reduce((a, b) => a * b, 1);
  expect(cameraAt(lcm).x).toBeCloseTo(cameraAt(0).x, 6);
  expect(longest).toBeGreaterThan(20);
});
