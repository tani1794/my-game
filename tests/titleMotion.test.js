import { test, expect } from 'vitest';
import {
  visibleSize, imageToScreen, cameraAt, BASE_ZOOM, CAMERA_PERIODS,
} from '../src/title/framing.js';
import {
  flightAt, FLIGHT_PERIOD, wingspanFraction, flapAt,
} from '../src/title/dragonFlight.js';

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

test('古龍は周期的に飛び、何周しても同じ道筋（瞬間移動しない）', () => {
  const a = flightAt(3.2);
  const b = flightAt(3.2 + FLIGHT_PERIOD * 5);
  expect(b.x).toBeCloseTo(a.x, 6);
  expect(b.y).toBeCloseTo(a.y, 6);
  // 1/60 秒ごとの移動が、どこでも小さい（つなぎ目でも飛ばない）
  let maxStep = 0;
  for (let t = 0; t < FLIGHT_PERIOD * 1.2; t += 1 / 60) {
    const p = flightAt(t);
    const q = flightAt(t + 1 / 60);
    maxStep = Math.max(maxStep, Math.hypot(q.x - p.x, q.y - p.y));
  }
  expect(maxStep).toBeLessThan(0.002);
});

test('古龍は城の上の空を飛ぶ（絵の上半分、左右は絵の中）', () => {
  for (let t = 0; t < FLIGHT_PERIOD; t += 0.5) {
    const p = flightAt(t);
    // 主人公（絵の左から 15〜35%）の頭の近くへは来ない
    expect(p.x).toBeGreaterThan(0.5);
    expect(p.x).toBeLessThan(0.97);
    // 横長の iPhone（844×340）でも見える高さ
    expect(p.y).toBeGreaterThan(0.17);
    expect(p.y).toBeLessThan(0.32);
  }
});

test('翼幅は画面幅の 12〜18%', () => {
  for (let t = 0; t < FLIGHT_PERIOD; t += 0.5) {
    const fraction = wingspanFraction(flightAt(t));
    expect(fraction).toBeGreaterThanOrEqual(0.12);
    expect(fraction).toBeLessThanOrEqual(0.18);
  }
});

test('向きは進む方向に合わせ、傾きはなめらかに変わる', () => {
  let maxTurn = 0;
  for (let t = 0; t < FLIGHT_PERIOD; t += 0.1) {
    const p = flightAt(t);
    const q = flightAt(t + 0.1);
    let turn = Math.abs(q.heading - p.heading);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    maxTurn = Math.max(maxTurn, turn, Math.abs(q.bank - p.bank));
  }
  expect(maxTurn).toBeLessThan(0.1);
});

test('羽ばたきは時々だけ。滑空している時間の方が長い', () => {
  let flapping = 0;
  const steps = 2000;
  for (let i = 0; i < steps; i += 1) {
    if (flapAt((i / steps) * FLIGHT_PERIOD).strength > 0.05) flapping += 1;
  }
  expect(flapping / steps).toBeGreaterThan(0.1);
  expect(flapping / steps).toBeLessThan(0.45);
  // 羽ばたきも周期的
  expect(flapAt(1.7 + FLIGHT_PERIOD).angle).toBeCloseTo(flapAt(1.7).angle, 6);
});
