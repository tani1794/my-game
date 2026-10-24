import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export function loadGLTF(url) {
  return loader.loadAsync(url);
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
