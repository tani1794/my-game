import { test, expect } from 'vitest';
import * as THREE from 'three';
import {
  shotAt,
  createTitleScene,
  TITLE_SHOTS,
  SHOT_SECONDS,
  FADE_SECONDS,
} from '../src/ui/titleScene.js';

test('始まりは最初の場面の from、混ぜない', () => {
  const { a, mix } = shotAt(0);
  expect(a).toEqual(TITLE_SHOTS[0].from);
  expect(mix).toBe(0);
});

test('場面の途中は from と to の間', () => {
  const { a, mix } = shotAt(SHOT_SECONDS / 2);
  expect(a.zoom).toBeCloseTo(
    (
      TITLE_SHOTS[0].from.zoom
      + TITLE_SHOTS[0].to.zoom
    ) / 2,
  );
  expect(mix).toBe(0);
});

test('場面の終わりは、次の場面の from へ溶ける', () => {
  const fading = shotAt(
    SHOT_SECONDS - FADE_SECONDS / 2,
  );
  expect(fading.b).toEqual(TITLE_SHOTS[1].from);
  expect(fading.mix).toBeCloseTo(0.5);

  const next = shotAt(SHOT_SECONDS);
  expect(next.a).toEqual(TITLE_SHOTS[1].from);
  expect(next.mix).toBe(0);
});

test('最後の場面のあとは最初に戻る', () => {
  const total = SHOT_SECONDS * TITLE_SHOTS.length;
  expect(shotAt(total).a).toEqual(
    TITLE_SHOTS[0].from,
  );
  expect(
    shotAt(total - FADE_SECONDS / 2).b,
  ).toEqual(TITLE_SHOTS[0].from);
});

test('scene に板と火の粉があり、update で動く', () => {
  const image = new THREE.Texture();
  const depth = new THREE.Texture();
  const title = createTitleScene({ image, depth });

  const meshes = title.scene.children.filter(
    (child) => child.isMesh,
  );
  const points = title.scene.children.filter(
    (child) => child.isPoints,
  );

  expect(meshes).toHaveLength(1);
  expect(points).toHaveLength(1);
  expect(
    points[0].geometry.getAttribute('position').count,
  ).toBe(70);

  const before = points[0].geometry
    .getAttribute('position')
    .array
    .slice();

  title.update(1, 844, 390);
  title.update(2, 844, 390);

  expect(
    points[0].geometry.getAttribute('position').array,
  ).not.toEqual(before);

  title.dispose();
});

test('動きを減らす設定では、火の粉が止まる', () => {
  const title = createTitleScene({
    image: new THREE.Texture(),
    depth: new THREE.Texture(),
  });

  title.setReducedMotion(true);
  title.update(1, 844, 390);

  const points = title.scene.children.find(
    (child) => child.isPoints,
  );
  const before = points.geometry
    .getAttribute('position')
    .array
    .slice();

  title.update(3, 844, 390);

  expect(
    points.geometry.getAttribute('position').array,
  ).toEqual(before);
});

test('場面の中の動きは、両端がなめらか（easeInOut）', () => {
  const { a } = shotAt(SHOT_SECONDS + SHOT_SECONDS / 4);
  const { from, to } = TITLE_SHOTS[1];
  expect(a.zoom).toBeCloseTo(from.zoom + (to.zoom - from.zoom) * 0.15625, 4);
});

test('どの場面も少し寄っておき、立体のずれで絵の端がはみ出さない', () => {
  for (const shot of TITLE_SHOTS) {
    expect(shot.from.zoom).toBeGreaterThanOrEqual(1.04);
    expect(shot.to.zoom).toBeGreaterThanOrEqual(1.04);
  }
});
