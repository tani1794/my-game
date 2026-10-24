import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createTelegraphs } from '../src/world/telegraph.js';

const flat = () => 0;
const shown = (scene) => scene.children.filter(
  (o) =>
    o.name.startsWith('telegraph-') &&
    o.visible,
);
const sector = {
  type: 'sector',
  x: 0,
  z: -6,
  angle: 0,
  radius: 5,
  spread: 1.745,
};
const band = {
  type: 'band',
  x: 0,
  z: -6,
  angle: 0,
  width: 4,
  length: 14,
};
const circle = (x) => ({
  type: 'circle',
  x,
  z: 0,
  radius: 1.6,
});

test('扇・帯・円のそれぞれで、縁と塗りつぶしが見える', () => {
  for (const shape of [sector, band, circle(0)]) {
    const scene = new THREE.Scene();

    createTelegraphs(scene, flat).sync(
      {
        kind: 'slam',
        shapes: [shape],
        progress: 0.3,
        impact: false,
      },
      false,
    );

    const [group] = shown(scene);
    expect(
      group.getObjectByName('edge').visible,
    ).toBe(true);
    expect(
      group.getObjectByName('fill').visible,
    ).toBe(true);
  }
});

test('塗りつぶしは progress に合わせて広がる（帯は長さ方向だけ）', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);

  t.sync(
    {
      kind: 'slam',
      shapes: [circle(0)],
      progress: 0.5,
      impact: false,
    },
    false,
  );

  expect(
    shown(scene)[0]
      .getObjectByName('fill')
      .scale.x,
  ).toBeCloseTo(0.5);

  t.sync(
    {
      kind: 'charge',
      shapes: [band],
      progress: 0.25,
      impact: false,
    },
    false,
  );

  const fill = shown(scene)[0]
    .getObjectByName('fill');

  expect(fill.scale.z).toBeCloseTo(0.25);
  expect(fill.scale.x).toBeCloseTo(1);
});

test('5つ出した後に2つにすると、3つ隠れる。clear で全部隠れる', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);

  t.sync(
    {
      kind: 'rain',
      shapes: [0, 3, 6, 9, 12].map(circle),
      progress: 0.1,
      impact: false,
    },
    false,
  );
  expect(shown(scene)).toHaveLength(5);

  t.sync(
    {
      kind: 'rain',
      shapes: [0, 3].map(circle),
      progress: 0.2,
      impact: false,
    },
    false,
  );
  expect(shown(scene)).toHaveLength(2);

  t.clear();
  expect(shown(scene)).toHaveLength(0);
});

test('何度 sync してもシーンの物は増えない', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);
  const count = () => {
    let n = 0;
    scene.traverse(() => n++);
    return n;
  };

  t.sync(
    {
      kind: 'slam',
      shapes: [sector],
      progress: 0.1,
      impact: false,
    },
    false,
  );

  const before = count();

  for (let i = 0; i < 30; i++) {
    t.sync(
      {
        kind: 'slam',
        shapes: [sector],
        progress: i / 30,
        impact: false,
      },
      false,
    );
  }

  expect(count()).toBe(before);
});

test('怒り状態では縁が赤寄り、impact では塗りつぶしが全面', () => {
  const scene = new THREE.Scene();
  const t = createTelegraphs(scene, flat);

  t.sync(
    {
      kind: 'spin',
      shapes: [circle(0)],
      progress: 1,
      impact: true,
    },
    true,
  );

  const g = shown(scene)[0];

  expect(
    '#' +
      g
        .getObjectByName('edge')
        .material.color.getHexString(),
  ).toBe('#ff5a3c');
  expect(
    g.getObjectByName('fill').scale.x,
  ).toBeCloseTo(1);
  expect(
    g.getObjectByName('fill').material.opacity,
  ).toBeCloseTo(0.6);
});

test('地面の高さ + 0.04 に置き、向きを合わせる', () => {
  const scene = new THREE.Scene();

  createTelegraphs(scene, () => 0.3).sync(
    {
      kind: 'charge',
      shapes: [
        {
          ...band,
          angle: Math.PI,
        },
      ],
      progress: 0.5,
      impact: false,
    },
    false,
  );

  const g = shown(scene)[0];

  expect(g.position.y).toBeCloseTo(0.34);
  expect(g.rotation.y).toBeCloseTo(Math.PI);
});
