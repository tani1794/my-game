// モデル作りの共通の道具（ブラウザで実行する）：GLB への書き出しと、確認用の画像（正面・横・後ろ、動作の途中の姿）。
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export async function exportGLB(scene, animations) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true, animations, onlyVisible: true });
  return new Uint8Array(result);
}

// GLB の中身（Uint8Array）を、送りやすい文字列にする
export function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// 確認用の画像：同じ距離・同じ光で、向きを変えて撮る。pose：{ clip, time } で動作の途中の姿
export function renderViews(object, { animations = [], views, size = [480, 640], height = 2.1, background = '#2b2b2e' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size[0], size[1]);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  scene.add(new THREE.HemisphereLight('#dfe6ee', '#3a3632', 1.6));
  const key = new THREE.DirectionalLight('#fff2e0', 2.4);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9fc8ff', 1.4);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  scene.add(object);
  const mixer = new THREE.AnimationMixer(object);
  const camera = new THREE.PerspectiveCamera(30, size[0] / size[1], 0.05, 100);
  const shots = [];
  for (const view of views) {
    mixer.stopAllAction();
    if (view.clip) {
      const clip = animations.find((c) => c.name === view.clip);
      const action = mixer.clipAction(clip);
      action.reset().play();
      mixer.setTime(view.time ?? 0);
    } else {
      object.traverse((o) => { if (o.isBone && o.userData.rest) { o.position.copy(o.userData.rest.p); o.quaternion.copy(o.userData.rest.q); } });
    }
    object.updateMatrixWorld(true);
    const distance = view.distance ?? height * 2.6;
    const angle = view.angle ?? 0;
    camera.position.set(Math.sin(angle) * distance, (view.eye ?? height * 0.55), Math.cos(angle) * distance);
    camera.lookAt(0, view.look ?? height * 0.5, 0);
    renderer.render(scene, camera);
    shots.push(renderer.domElement.toDataURL('image/png'));
  }
  scene.remove(object);
  renderer.dispose();
  return shots;
}

// 休みの姿勢を覚えておく（動作を止めて撮るときに戻す）
export function rememberRest(object) {
  object.traverse((o) => { if (o.isBone) o.userData.rest = { p: o.position.clone(), q: o.quaternion.clone() }; });
}

export { THREE };
