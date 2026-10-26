import { test, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createSilentScene } from '../src/title/silentScene.js';
import { cameraAt } from '../src/title/framing.js';

const make = (options = {}) => createSilentScene({
  art: new THREE.Texture(), depth: new THREE.Texture(), masks: new THREE.Texture(), ...options,
});

test('背景の絵（1枚の板）と、その上の埃', () => {
  const title = make();
  expect(title.pictureScene.children.filter((child) => child.isMesh)).toHaveLength(1);
  expect(title.overlayScene.children).toContain(title.dust);
  expect(title.dust.geometry.getAttribute('position').count).toBe(70);
  title.dispose();
});

test('スマートフォン向け（lite）は埃と霧の模様を減らす', () => {
  const title = make({ lite: true });
  expect(title.dust.geometry.getAttribute('position').count).toBe(36);
  expect(title.pictureScene.children[0].material.uniforms.octaves.value).toBe(2);
  title.dispose();
});

test('update でカメラと時刻が変わる', () => {
  const title = make();
  const uniforms = title.pictureScene.children[0].material.uniforms;
  title.update(5, 844, 390, 2);
  const camera = cameraAt(5);
  expect(uniforms.view.value.x).toBeCloseTo(camera.x);
  expect(uniforms.view.value.z).toBeCloseTo(camera.zoom);
  expect(uniforms.time.value).toBe(5);
  expect(uniforms.screenAspect.value).toBeCloseTo(844 / 390);
  title.dispose();
});

test('動きを減らす設定：カメラ・埃・霧が止まる', () => {
  const title = make();
  title.setReducedMotion(true);
  title.update(3, 844, 390);
  const uniforms = title.pictureScene.children[0].material.uniforms;
  const dustAt = title.dust.geometry.getAttribute('position').array.slice();
  const timeAt = uniforms.time.value;
  title.update(30, 844, 390);
  expect(title.dust.geometry.getAttribute('position').array).toEqual(dustAt);
  expect(uniforms.time.value).toBe(timeAt);
  title.dispose();
});

test('描画：背景を描いてから、奥行きだけ消して埃を重ねる', () => {
  const title = make();
  const calls = [];
  const renderer = {
    autoClear: true,
    render: vi.fn((scene) => calls.push(scene === title.pictureScene ? 'picture' : 'overlay')),
    clearDepth: vi.fn(() => calls.push('clearDepth')),
  };
  title.update(1, 844, 390, 2);
  title.render(renderer);
  expect(calls).toEqual(['picture', 'clearDepth', 'overlay']);
  expect(renderer.autoClear).toBe(true);
  title.dispose();
});
