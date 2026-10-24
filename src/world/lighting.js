import * as THREE from 'three';

export function createLighting(scene) {
  scene.background = new THREE.Color('#172b3b');
  scene.fog = new THREE.Fog('#172b3b', 24, 65);

  scene.add(new THREE.HemisphereLight(0xc5eaff, 0x394536, 2.5));

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(8, 15, 5);
  scene.add(sun);

  function update() {}

  function setQuality() {}

  return { update, setQuality };
}
