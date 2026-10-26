import { test, expect } from 'vitest';
import * as THREE from 'three';
import {
  shotAt,
  createTitleScene,
  TITLE_SHOTS,
  TITLE_PICTURES,
} from '../src/ui/titleScene.js';

// 場面 i が始まる時刻
const startOf = (index) => TITLE_SHOTS.slice(0, index).reduce((sum, shot) => sum + shot.seconds, 0);
const total = startOf(TITLE_SHOTS.length);
const indexOf = (picture) => TITLE_SHOTS.findIndex((shot) => shot.picture === picture);

const makePictures = () => Object.fromEntries(
  TITLE_PICTURES.map((name) => [name, { image: new THREE.Texture(), depth: new THREE.Texture() }]),
);

test('場面の並び：静か → 光る → 稲妻 → 衝突', () => {
  expect(TITLE_SHOTS.map((shot) => shot.picture)).toEqual(['calm', 'glow', 'surge', 'clash']);
  expect(TITLE_PICTURES).toEqual(['calm', 'glow', 'surge', 'clash']);
});

test('始まりは最初の場面の from、混ぜない、閃光なし', () => {
  const state = shotAt(0);
  expect(state.a).toEqual(TITLE_SHOTS[0].from);
  expect(state.pictureA).toBe('calm');
  expect(state.mix).toBe(0);
  expect(state.flash).toBe(0);
  expect(state.shake).toBe(0);
});

test('場面の中の動きは、両端がなめらか（easeInOut）', () => {
  const shot = TITLE_SHOTS[0];
  const { a } = shotAt(shot.seconds / 4);
  expect(a.zoom).toBeCloseTo(shot.from.zoom + (shot.to.zoom - shot.from.zoom) * 0.15625, 4);
});

test('溶ける切り替え：同じカメラのまま、次の絵へ少しずつ変わる', () => {
  const calm = TITLE_SHOTS[0];
  const middle = shotAt(calm.seconds - calm.fade / 2);
  expect(middle.pictureA).toBe('calm');
  expect(middle.pictureB).toBe('glow');
  expect(middle.b).toEqual(TITLE_SHOTS[1].from);
  expect(middle.mix).toBeCloseTo(0.5);
  expect(middle.flash).toBe(0);
  const next = shotAt(calm.seconds);
  expect(next.pictureA).toBe('glow');
  expect(next.a).toEqual(TITLE_SHOTS[1].from);
  expect(next.mix).toBe(0);
});

test('光る → 稲妻 は、カメラの動きが途切れない（前の場面の to が次の from）', () => {
  for (const [from, to] of [['calm', 'glow'], ['glow', 'surge']]) {
    expect(TITLE_SHOTS[indexOf(to)].from).toEqual(TITLE_SHOTS[indexOf(from)].to);
  }
});

test('稲妻 → 衝突 は閃光：明るさが山になり、いちばん明るい所で絵が切り替わる', () => {
  const surge = TITLE_SHOTS[indexOf('surge')];
  expect(surge.transition).toBe('flash');
  const end = startOf(indexOf('surge')) + surge.seconds;
  const before = shotAt(end - surge.fade * 0.75);
  const peak = shotAt(end - surge.fade / 2 + 0.001);
  const after = shotAt(end - surge.fade * 0.25);
  expect(before.mix).toBe(0);
  expect(before.flash).toBeGreaterThan(0);
  expect(before.flash).toBeLessThan(peak.flash);
  expect(peak.flash).toBeGreaterThan(0.95);
  expect(after.mix).toBe(1);
  expect(after.pictureB).toBe('clash');
  expect(after.flash).toBeLessThan(peak.flash);
});

test('閃光のあとの衝突の場面は、始めに一度だけ揺れて、すぐ収まる', () => {
  const start = startOf(indexOf('clash'));
  expect(shotAt(start).shake).toBeCloseTo(1);
  expect(shotAt(start + 0.2).shake).toBeGreaterThan(0);
  expect(shotAt(start + 0.2).shake).toBeLessThan(1);
  expect(shotAt(start + 0.5).shake).toBe(0);
  // 溶けて入る場面は揺れない
  expect(shotAt(TITLE_SHOTS[0].seconds).shake).toBe(0);
});

test('最後の場面のあとは最初に戻る', () => {
  const last = TITLE_SHOTS[TITLE_SHOTS.length - 1];
  expect(shotAt(total).a).toEqual(TITLE_SHOTS[0].from);
  expect(shotAt(total).pictureA).toBe('calm');
  const fading = shotAt(total - last.fade / 2);
  expect(fading.b).toEqual(TITLE_SHOTS[0].from);
  expect(fading.pictureB).toBe('calm');
});

test('どの場面も少し寄っておき、立体のずれで絵の端がはみ出さない', () => {
  for (const shot of TITLE_SHOTS) {
    expect(shot.from.zoom).toBeGreaterThanOrEqual(1.04);
    expect(shot.to.zoom).toBeGreaterThanOrEqual(1.04);
  }
});

test('時刻が負や数でないときは 0 とみなす', () => {
  expect(shotAt(-3)).toEqual(shotAt(0));
  expect(shotAt(Number.NaN)).toEqual(shotAt(0));
});

test('scene に板と火の粉があり、update で動く', () => {
  const title = createTitleScene({ pictures: makePictures() });
  const meshes = title.scene.children.filter((child) => child.isMesh);
  const points = title.scene.children.filter((child) => child.isPoints);
  expect(meshes).toHaveLength(1);
  expect(points).toHaveLength(1);
  expect(points[0].geometry.getAttribute('position').count).toBe(70);
  const before = points[0].geometry.getAttribute('position').array.slice();
  title.update(1, 844, 390);
  title.update(2, 844, 390);
  expect(points[0].geometry.getAttribute('position').array).not.toEqual(before);
  title.dispose();
});

test('update で、その時刻の2枚の絵を描く板に渡す', () => {
  const pictures = makePictures();
  const title = createTitleScene({ pictures });
  const { uniforms } = title.scene.children.find((child) => child.isMesh).material;
  const calm = TITLE_SHOTS[0];
  title.update(calm.seconds - calm.fade / 2, 844, 390);
  expect(uniforms.imageA.value).toBe(pictures.calm.image);
  expect(uniforms.depthA.value).toBe(pictures.calm.depth);
  expect(uniforms.imageB.value).toBe(pictures.glow.image);
  expect(uniforms.depthB.value).toBe(pictures.glow.depth);
  const surge = TITLE_SHOTS[indexOf('surge')];
  title.update(startOf(indexOf('surge')) + surge.seconds - surge.fade / 2 + 0.001, 844, 390);
  expect(uniforms.flash.value).toBeGreaterThan(0.95);
});

test('動きを減らす設定では、最初の絵とカメラのまま、火の粉も止まる', () => {
  const pictures = makePictures();
  const title = createTitleScene({ pictures });
  title.setReducedMotion(true);
  title.update(1, 844, 390);
  const points = title.scene.children.find((child) => child.isPoints);
  const { uniforms } = title.scene.children.find((child) => child.isMesh).material;
  const before = points.geometry.getAttribute('position').array.slice();
  title.update(startOf(indexOf('clash')) + 0.1, 844, 390);
  expect(points.geometry.getAttribute('position').array).toEqual(before);
  expect(uniforms.imageA.value).toBe(pictures.calm.image);
  expect(uniforms.flash.value).toBe(0);
});
