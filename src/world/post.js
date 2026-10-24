import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 光のにじみ（ブルーム）。明るい部分（結晶や空）だけをにじませる
// UnrealBloomPass は内部で画面の半分の解像度から縮小して処理する
export function createPost(renderer, scene, camera, preset) {
  const size = renderer.getSize(new THREE.Vector2());

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(size, 0.6, 0.4, 0.85));
  composer.addPass(new OutputPass());

  let bloom = preset.bloom;

  function render() {
    if (bloom) composer.render();
    else renderer.render(scene, camera);
  }

  function setSize(width, height) {
    composer.setSize(width, height);
  }

  function setQuality(nextPreset) {
    bloom = nextPreset.bloom;
    composer.setPixelRatio(renderer.getPixelRatio());
  }

  return { render, setSize, setQuality };
}
