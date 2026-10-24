import { test, expect } from 'vitest';
import {
  shapeContains,
  sectorHitsCircle,
  angleTo,
  angleDiff,
} from '../src/combat/shapes.js';

const P = (x, z) => ({ x, z });

test('円', () => {
  const c = { type: 'circle', x: 0, z: 0, radius: 2 };
  expect(shapeContains(c, P(2, 0))).toBe(true);
  expect(shapeContains(c, P(2.01, 0))).toBe(false);
});

test('扇：+z 向き、半径5、100度', () => {
  const s = {
    type: 'sector',
    x: 0,
    z: 0,
    angle: 0,
    radius: 5,
    spread: (100 * Math.PI) / 180,
  };

  expect(shapeContains(s, P(0, 4))).toBe(true);
  expect(shapeContains(s, P(0, -1))).toBe(false);
  expect(shapeContains(s, P(4, 1))).toBe(false);
  expect(shapeContains(s, P(0, 5.1))).toBe(false);
});

test('帯：-z 向き、幅4、長さ14', () => {
  const b = {
    type: 'band',
    x: 0,
    z: 0,
    angle: Math.PI,
    width: 4,
    length: 14,
  };

  expect(shapeContains(b, P(1.9, -13))).toBe(true);
  expect(shapeContains(b, P(2.1, -5))).toBe(false);
  expect(shapeContains(b, P(0, 0.5))).toBe(false);
});

test('扇と円の重なり（円の中心が扇の外でも、縁が入れば当たる）', () => {
  const s = {
    type: 'sector',
    x: 0,
    z: 0,
    angle: 0,
    radius: 2.2,
    spread: (120 * Math.PI) / 180,
  };

  expect(sectorHitsCircle(s, { x: 0, z: 4, radius: 2 })).toBe(true);
  expect(sectorHitsCircle(s, { x: 0, z: -3, radius: 0.5 })).toBe(false);
});

test('角度', () => {
  expect(angleTo(P(0, 0), P(1, 0))).toBeCloseTo(Math.PI / 2);
  expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
});

test('45度回転し、負の座標に置いた扇', () => {
  const angle = Math.PI / 4;
  const s = {
    type: 'sector',
    x: -3,
    z: -4,
    angle,
    radius: 4,
    spread: Math.PI / 3,
  };

  const inside = P(
    s.x + Math.sin(angle) * 3,
    s.z + Math.cos(angle) * 3,
  );
  const outsideAngle = angle + Math.PI / 2;
  const outside = P(
    s.x + Math.sin(outsideAngle) * 2,
    s.z + Math.cos(outsideAngle) * 2,
  );

  expect(shapeContains(s, inside)).toBe(true);
  expect(shapeContains(s, outside)).toBe(false);
});

test('45度回転し、負の座標に置いた帯', () => {
  const angle = Math.PI / 4;
  const b = {
    type: 'band',
    x: -5,
    z: -3,
    angle,
    width: 2,
    length: 6,
  };

  const forward = { x: Math.sin(angle), z: Math.cos(angle) };
  const sideways = { x: Math.cos(angle), z: -Math.sin(angle) };

  const inside = P(
    b.x + forward.x * 5 + sideways.x * 0.9,
    b.z + forward.z * 5 + sideways.z * 0.9,
  );
  const tooWide = P(
    b.x + forward.x * 3 + sideways.x * 1.01,
    b.z + forward.z * 3 + sideways.z * 1.01,
  );
  const behind = P(
    b.x - forward.x * 0.01,
    b.z - forward.z * 0.01,
  );

  expect(shapeContains(b, inside)).toBe(true);
  expect(shapeContains(b, tooWide)).toBe(false);
  expect(shapeContains(b, behind)).toBe(false);
});

test('扇の左右の辺に円が接する', () => {
  const s = {
    type: 'sector',
    x: 0,
    z: 0,
    angle: 0,
    radius: 5,
    spread: Math.PI / 2,
  };

  for (const side of [-1, 1]) {
    const edgeAngle = side * s.spread / 2;
    const alongEdge = 3;
    const circleRadius = 0.5;

    // 辺から扇の外側へ、円の半径と同じ距離だけ離す。
    const outward = {
      x: side * Math.cos(edgeAngle),
      z: -side * Math.sin(edgeAngle),
    };

    const touching = {
      x:
        Math.sin(edgeAngle) * alongEdge +
        outward.x * circleRadius,
      z:
        Math.cos(edgeAngle) * alongEdge +
        outward.z * circleRadius,
      radius: circleRadius,
    };

    const separated = {
      x:
        Math.sin(edgeAngle) * alongEdge +
        outward.x * (circleRadius + 0.00001),
      z:
        Math.cos(edgeAngle) * alongEdge +
        outward.z * (circleRadius + 0.00001),
      radius: circleRadius,
    };

    expect(sectorHitsCircle(s, touching)).toBe(true);
    expect(sectorHitsCircle(s, separated)).toBe(false);
  }
});

test('扇の頂点に円が接する', () => {
  const s = {
    type: 'sector',
    x: 0,
    z: 0,
    angle: 0,
    radius: 5,
    spread: Math.PI / 2,
  };

  expect(sectorHitsCircle(s, { x: 0, z: -1, radius: 1 })).toBe(true);
  expect(sectorHitsCircle(s, { x: 0, z: -1.001, radius: 1 })).toBe(false);
});

test('扇の外周の弧に円が接する', () => {
  const s = {
    type: 'sector',
    x: 0,
    z: 0,
    angle: 0,
    radius: 5,
    spread: Math.PI / 2,
  };

  expect(sectorHitsCircle(s, { x: 0, z: 6, radius: 1 })).toBe(true);
  expect(sectorHitsCircle(s, { x: 0, z: 6.001, radius: 1 })).toBe(false);
});
