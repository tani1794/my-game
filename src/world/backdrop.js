import * as THREE from 'three';
import { mulberry32 } from './random.js';

const TAU = Math.PI * 2;
const SUN_DIRECTION = new THREE.Vector3(-30, 25, -40).normalize();
const MOUNTAIN_BASE_Y = -5;
const MOUNTAIN_SEGMENTS = 48;

const MOUNTAIN_LAYERS = [
  {
    name: 'mountains-far',
    radius: 84,
    color: '#9fb0c4',
    minHeight: 12,
    maxHeight: 30,
    seed: 3103,
    renderOrder: -3,
  },
  {
    name: 'mountains-middle',
    radius: 77.5,
    color: '#6d8196',
    minHeight: 10,
    maxHeight: 26,
    seed: 2203,
    renderOrder: -2,
  },
  {
    name: 'mountains-near',
    radius: 71,
    color: '#4a5a5e',
    minHeight: 8,
    maxHeight: 22,
    seed: 1303,
    renderOrder: -1,
  },
];

function createSky() {
  const geometry = new THREE.SphereGeometry(95, 24, 12);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color('#5d86b8') },
      horizonColor: { value: new THREE.Color('#f3c58a') },
      sunColor: { value: new THREE.Color('#ffd9a0') },
      sunDirection: { value: SUN_DIRECTION.clone() },
    },
    vertexShader: `
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;

      varying vec3 vDirection;

      void main() {
        vec3 direction = normalize(vDirection);
        float skyHeight = smoothstep(-0.12, 0.72, direction.y);
        vec3 color = mix(horizonColor, topColor, skyHeight);

        float facingSun = max(dot(direction, normalize(sunDirection)), 0.0);
        float broadGlow = pow(facingSun, 8.0) * 0.08;
        float sunGlow = pow(facingSun, 48.0) * 0.18;
        color += sunColor * (broadGlow + sunGlow);

        gl_FragColor = vec4(color, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });

  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'backdrop-sky';
  sky.renderOrder = -4;
  return sky;
}

function createMountainRing(layer) {
  const random = mulberry32(layer.seed);
  const positions = new Float32Array((MOUNTAIN_SEGMENTS + 1) * 2 * 3);
  const indices = [];
  const ridgeHeights = [];

  for (let i = 0; i < MOUNTAIN_SEGMENTS; i++) {
    const angle = (i / MOUNTAIN_SEGMENTS) * TAU;

    // +z（angle = 0）の手前だけを低くし、左右と-z側を高くする。
    const awayFromFront = 1 - Math.max(0, Math.cos(angle));
    const heightRatio = Math.min(1, awayFromFront * 0.72 + random() * 0.28);

    ridgeHeights.push(
      THREE.MathUtils.lerp(layer.minHeight, layer.maxHeight, heightRatio),
    );
  }

  // 最初と最後の高さを一致させ、円周の継ぎ目を閉じる。
  ridgeHeights.push(ridgeHeights[0]);

  for (let i = 0; i <= MOUNTAIN_SEGMENTS; i++) {
    const angle = (i / MOUNTAIN_SEGMENTS) * TAU;
    const x = Math.sin(angle) * layer.radius;
    const z = Math.cos(angle) * layer.radius;
    const offset = i * 6;

    positions[offset] = x;
    positions[offset + 1] = MOUNTAIN_BASE_Y;
    positions[offset + 2] = z;

    positions[offset + 3] = x;
    positions[offset + 4] = ridgeHeights[i];
    positions[offset + 5] = z;
  }

  for (let i = 0; i < MOUNTAIN_SEGMENTS; i++) {
    const bottom = i * 2;
    const top = bottom + 1;
    const nextBottom = bottom + 2;
    const nextTop = bottom + 3;

    // 原点側を表面にする頂点順。
    indices.push(bottom, top, nextBottom);
    indices.push(top, nextTop, nextBottom);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material = new THREE.MeshBasicMaterial({
    color: layer.color,
    fog: false,
    depthWrite: false,
  });

  const mountains = new THREE.Mesh(geometry, material);
  mountains.name = layer.name;
  mountains.renderOrder = layer.renderOrder;
  return mountains;
}

export async function createBackdrop(
  scene,
  url,
  loader = new THREE.TextureLoader(),
) {
  // 読み込みが成功するまではジオメトリもシーン上のオブジェクトも作らない。
  const texture = await loader.loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;

  // 筒の内側から見ると画像が鏡写しになるため、横方向を反転して貼る
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;

  const geometry = new THREE.CylinderGeometry(90, 90, 60, 64, 1, true);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });

  const backdrop = new THREE.Mesh(geometry, material);
  backdrop.name = 'backdrop';
  backdrop.position.y = 25;
  backdrop.renderOrder = -1;

  /*
   * CylinderGeometry の u は、ローカル座標上で
   * x = sin(u * 2π), z = cos(u * 2π) の方向に対応する。
   * 画像を横に反転して貼ったので、画像の左から 25% にある太陽は u = 0.75 に来る。
   * その角度 1.5π を、ワールドの太陽の水平角 atan2(x, z) に合わせる。
   */
  const textureSunAngle = 0.75 * TAU;
  const worldSunAngle = Math.atan2(SUN_DIRECTION.x, SUN_DIRECTION.z);
  backdrop.rotation.y = worldSunAngle - textureSunAngle;

  scene.add(backdrop);
  return backdrop;
}

export function createFallbackBackdrop(scene) {
  const group = new THREE.Group();
  group.name = 'backdrop-fallback';

  group.add(createSky());

  for (const layer of MOUNTAIN_LAYERS) {
    group.add(createMountainRing(layer));
  }

  scene.add(group);
  return group;
}
