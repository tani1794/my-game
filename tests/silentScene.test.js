import { test, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createSilentScene } from '../src/title/silentScene.js';
import { cameraAt } from '../src/title/framing.js';

const make = (options = {}) => createSilentScene({
  art: new THREE.Texture(), depth: new THREE.Texture(), masks: new THREE.Texture(), ...options,
});

test('背景の絵（1枚の板）と、その上の古龍・埃', () => {
  const title = make();
  expect(title.pictureScene.children.filter((child) => child.isMesh)).toHaveLength(1);
  expect(title.overlayScene.children).toContain(title.dragon);
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

test('update でカメラ・時刻・古龍の位置が変わる', () => {
  const title = make();
  const uniforms = title.pictureScene.children[0].material.uniforms;
  title.update(5, 844, 390, 2);
  const camera = cameraAt(5);
  expect(uniforms.view.value.x).toBeCloseTo(camera.x);
  expect(uniforms.view.value.z).toBeCloseTo(camera.zoom);
  expect(uniforms.time.value).toBe(5);
  expect(uniforms.screenAspect.value).toBeCloseTo(844 / 390);
  const before = title.dragon.position.clone();
  title.update(12, 844, 390, 2);
  expect(title.dragon.position.distanceTo(before)).toBeGreaterThan(0.01);
  title.dispose();
});

test('動きを減らす設定：カメラ・古龍・埃・霧が止まる', () => {
  const title = make();
  title.setReducedMotion(true);
  title.update(3, 844, 390);
  const uniforms = title.pictureScene.children[0].material.uniforms;
  const dragonAt = title.dragon.position.clone();
  const dustAt = title.dust.geometry.getAttribute('position').array.slice();
  const timeAt = uniforms.time.value;
  title.update(30, 844, 390);
  expect(title.dragon.position.toArray()).toEqual(dragonAt.toArray());
  expect(title.dust.geometry.getAttribute('position').array).toEqual(dustAt);
  expect(uniforms.time.value).toBe(timeAt);
  title.dispose();
});

test('描画：背景を描いてから、奥行きだけ消して古龍と埃を重ねる', () => {
  const title = make();
  const calls = [];
  const renderer = {
    autoClear: true,
    getDrawingBufferSize: (target) => target.set(1688, 780),
    render: vi.fn((scene) => calls.push(scene === title.pictureScene ? 'picture' : 'overlay')),
    clearDepth: vi.fn(() => calls.push('clearDepth')),
  };
  title.update(1, 844, 390, 2);
  title.render(renderer);
  expect(calls).toEqual(['picture', 'clearDepth', 'overlay']);
  expect(renderer.autoClear).toBe(true);
  title.dispose();
});

test('古龍の隠れ方は、背景と同じ奥行きの地図と視差の向きで計算する', () => {
  const depth = new THREE.Texture();
  const title = createSilentScene({ art: new THREE.Texture(), depth, masks: new THREE.Texture() });
  title.update(17, 844, 390);
  const pictureUniforms = title.pictureScene.children[0].material.uniforms;
  const dragonMesh = title.dragon.getObjectByName('dragon-body');
  const dragonUniforms = dragonMesh.material.uniforms;
  expect(dragonUniforms.depthMap.value).toBe(depth);
  expect(dragonUniforms.look.value.toArray()).toEqual(pictureUniforms.look.value.toArray());
  // 古龍の絵の置き方は、空と同じではなく、背景と同じカメラ（ずらしは視差の計算で行う）
  expect(dragonUniforms.view.value.toArray()).toEqual(pictureUniforms.view.value.toArray());
  title.dispose();
});
