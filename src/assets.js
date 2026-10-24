import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export function loadGLTF(url) {
  return loader.loadAsync(url);
}

// モデルの大きさを測る。中身が空・高さ0・数値が壊れているものは読み込み失敗として throw する
// （大きさで割る処理が Infinity や NaN になり、当たり判定で主人公が動けなくなるのを防ぐ）
export function measureModel(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());

  const valid = !box.isEmpty() && [size.x, size.y, size.z].every(Number.isFinite) && size.y > 1e-6;
  if (!valid) throw new Error('モデルの中身が空か、大きさが不正です');

  return { box, size };
}

// 素材の読み込みに失敗しても、代わりの見た目で起動を続ける
export async function withFallback(promise, fallback) {
  try {
    return await promise;
  } catch (error) {
    console.warn('素材の読み込みに失敗したため、代わりを使います', error);
    return fallback();
  }
}
