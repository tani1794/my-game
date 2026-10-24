import * as THREE from 'three';

// 太陽は左奥。主人公から見てこの向きに置き、主人公を照らす（逆光）
const SUN_OFFSET = new THREE.Vector3(-30, 25, -40);
const SHADOW_RANGE = 15;

export function createLighting(scene, renderer) {
  // 夕方らしく、白く飛ばさず黄金色に寄せる色調補正
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // 遠くほど青く霞ませる（背景も同じ色にして境目を消す）
  scene.background = new THREE.Color('#9fb4c8');
  scene.fog = new THREE.FogExp2('#9fb4c8', 0.018);

  scene.add(new THREE.HemisphereLight('#9cc7ff', '#5a5236', 1.2));

  const sun = new THREE.DirectionalLight('#ffc27a', 3);
  sun.shadow.camera.left = -SHADOW_RANGE;
  sun.shadow.camera.right = SHADOW_RANGE;
  sun.shadow.camera.top = SHADOW_RANGE;
  sun.shadow.camera.bottom = -SHADOW_RANGE;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // 影を計算する範囲を、主人公の周りだけに絞って追いかける
  function update(playerPos) {
    sun.position.copy(playerPos).add(SUN_OFFSET);
    sun.target.position.copy(playerPos);
  }

  function setQuality(preset) {
    const changed = renderer.shadowMap.enabled !== preset.shadows;

    renderer.shadowMap.enabled = preset.shadows;
    sun.castShadow = preset.shadows;

    if (preset.shadows && sun.shadow.mapSize.x !== preset.shadowMapSize) {
      sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }

    // 影のオン・オフを切り替えたら、マテリアルを作り直させる
    if (changed) {
      scene.traverse((object) => {
        if (object.material) object.material.needsUpdate = true;
      });
    }
  }

  return { update, setQuality };
}
