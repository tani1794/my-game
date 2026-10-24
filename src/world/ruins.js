import * as THREE from 'three';
import { mulberry32 } from './random.js';

const ARCH_CENTERS = [-5, 5];
const ARCH_Z = -14;
const STONE_SIZE = 1.1;
// 柱は太めのブロックを4段積み、その上に半径2mの半円アーチを載せる
const PILLAR_HEIGHT = 4.8;
const PILLAR_LAYERS = 4;
const PILLAR_BLOCK_SCALE = 1.15;
const PILLAR_STEP =
  (PILLAR_HEIGHT + 0.2 - STONE_SIZE * PILLAR_BLOCK_SCALE) / (PILLAR_LAYERS - 1);
const ARCH_RADIUS = 2;
const ARCH_BLOCKS = 9;
// 夕日に照らされた、明るく暖かい灰色の石
const STONE_COLOR = '#8f8a82';

const FLAG_POSITIONS = [[-6, -1], [-4.5, 1.5]];
const FLAG_YAW = 0.4;
const FLAG_TOP = 2.66;
const FLAG_LENGTH = 1.6;

function buildStoneInstances(heightAt) {
  const blocks = [];
  const colliders = [];

  const gapsRandom = mulberry32(7);
  const detailsRandom = mulberry32(107);

  for (const centerX of ARCH_CENTERS) {
    const columnHeights = [];

    // Two pillars per arch.
    for (const offsetX of [-ARCH_RADIUS, ARCH_RADIUS]) {
      const x = centerX + offsetX;
      const ground = heightAt(x, ARCH_Z);

      columnHeights.push(ground);
      colliders.push({ x, z: ARCH_Z, radius: 0.8 });

      for (let layer = 0; layer < PILLAR_LAYERS; layer++) {
        const sy = PILLAR_BLOCK_SCALE * (0.97 + detailsRandom() * 0.06);

        blocks.push({
          x: x + (detailsRandom() - 0.5) * 0.10,
          y:
            ground -
            0.2 +
            STONE_SIZE * sy / 2 +
            layer * PILLAR_STEP,
          z: ARCH_Z + (detailsRandom() - 0.5) * 0.14,

          sx: PILLAR_BLOCK_SCALE * (0.96 + detailsRandom() * 0.08),
          sy,
          sz: PILLAR_BLOCK_SCALE * (0.96 + detailsRandom() * 0.08),

          rx: (detailsRandom() - 0.5) * 0.07,
          ry: (detailsRandom() - 0.5) * 0.13,
          rz: (detailsRandom() - 0.5) * 0.07,

          brightness: 0.8 + detailsRandom() * 0.35,
        });
      }
    }

    // 半円に並べる石（両端は残し、内側の1〜2個を欠けさせる）
    const interior = [1, 2, 3, 4, 5, 6, 7];

    for (let i = interior.length - 1; i > 0; i--) {
      const j = Math.floor(gapsRandom() * (i + 1));

      [interior[i], interior[j]] = [
        interior[j],
        interior[i],
      ];
    }

    const missingCount = gapsRandom() < 0.5 ? 1 : 2;
    const omitted = new Set(interior.slice(0, missingCount));

    // 半円の中心（アーチの起点）は柱の上端より少し上
    const springY = Math.max(...columnHeights) + PILLAR_HEIGHT + 0.4;

    for (let i = 0; i < ARCH_BLOCKS; i++) {
      if (omitted.has(i)) continue;

      const angle = (i / (ARCH_BLOCKS - 1)) * Math.PI;

      blocks.push({
        x:
          centerX +
          Math.cos(angle) * ARCH_RADIUS +
          (detailsRandom() - 0.5) * 0.06,

        y:
          springY +
          Math.sin(angle) * ARCH_RADIUS +
          (detailsRandom() - 0.5) * 0.04,

        z: ARCH_Z + (detailsRandom() - 0.5) * 0.08,

        // 円の接線方向に長い楔形の石
        sx: 0.85 + detailsRandom() * 0.06,
        sy: 0.7,
        sz: 1.15,

        rx: (detailsRandom() - 0.5) * 0.06,
        ry: (detailsRandom() - 0.5) * 0.08,
        rz: angle + Math.PI / 2 + (detailsRandom() - 0.5) * 0.08,

        brightness: 0.8 + detailsRandom() * 0.35,
      });
    }
  }

  const geometry = new THREE.BoxGeometry(
    STONE_SIZE,
    STONE_SIZE,
    STONE_SIZE
  );

  const material = new THREE.MeshStandardMaterial({
    color: STONE_COLOR,
    roughness: 0.95,
  });

  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    blocks.length
  );

  mesh.name = 'ruins-stones';
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const instanceColor = new THREE.Color();

  blocks.forEach((block, i) => {
    dummy.position.set(block.x, block.y, block.z);

    dummy.rotation.set(
      block.rx,
      block.ry,
      block.rz
    );

    dummy.scale.set(
      block.sx,
      block.sy,
      block.sz
    );

    dummy.updateMatrix();

    mesh.setMatrixAt(i, dummy.matrix);

    // Instance color multiplies the stone material color.
    instanceColor.setRGB(
      block.brightness,
      block.brightness,
      block.brightness
    );

    mesh.setColorAt(i, instanceColor);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  mesh.computeBoundingSphere();

  return { mesh, colliders };
}

/**
 * Build eight vertical cloth strips and a golden horn emblem.
 * Both use a single geometry and vertex colors.
 */
function buildFlagGeometry() {
  const positions = [];
  const colors = [];

  const blue = new THREE.Color('#1f3a6b');
  const gold = new THREE.Color('#c9a96a');

  function vertex(x, y, z, color) {
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
  }

  function quad(a, b, c, d, color) {
    for (const point of [a, b, c, a, c, d]) {
      vertex(
        point[0],
        point[1],
        point[2],
        color
      );
    }
  }

  const columns = 8;
  const rows = 12;

  const top = FLAG_TOP;
  const bottom = FLAG_TOP - FLAG_LENGTH;

  // Eight vertical fabric strips.
  // Each strip has enough vertices for smooth animation.
  for (let col = 0; col < columns; col++) {
    const left =
      -0.45 + (col / columns) * 0.9 + 0.002;

    const right =
      -0.45 + ((col + 1) / columns) * 0.9 - 0.002;

    for (let row = 0; row < rows; row++) {
      const yTop =
        top + (bottom - top) * row / rows;

      const yBottom =
        top + (bottom - top) * (row + 1) / rows;

      quad(
        [left, yTop, 0],
        [left, yBottom, 0],
        [right, yBottom, 0],
        [right, yTop, 0],
        blue
      );
    }
  }

  // Two upward-curving golden horns.
  // The emblem sits slightly in front of the cloth.
  // Because it shares the cloth shader, it waves with it.
  for (const sign of [-1, 1]) {
    const path = [
      { x: sign * 0.07, y: 1.54, width: 0.09 },
      { x: sign * 0.16, y: 1.76, width: 0.075 },
      { x: sign * 0.24, y: 1.98, width: 0.048 },
      { x: sign * 0.32, y: 2.32, width: 0.006 },
    ];

    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];

      quad(
        [a.x - a.width / 2, a.y, 0.025],
        [a.x + a.width / 2, a.y, 0.025],
        [b.x + b.width / 2, b.y, 0.025],
        [b.x - b.width / 2, b.y, 0.025],
        gold
      );
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  // Allow for displacement in the vertex shader.
  geometry.boundingSphere.radius += 0.3;

  return geometry;
}

/**
 * Create a waving flag material.
 * Different materials have different phase uniforms.
 */
function createFlagMaterial(phase) {
  const timeUniform = { value: 0 };
  const phaseUniform = { value: phase };

  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlagTime = timeUniform;
    shader.uniforms.uFlagPhase = phaseUniform;

    shader.vertexShader = `
      uniform float uFlagTime;
      uniform float uFlagPhase;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>

      float falloff = clamp(
        (${FLAG_TOP.toFixed(2)} - position.y)
          / ${FLAG_LENGTH.toFixed(1)},
        0.0,
        1.0
      );

      float flutter = falloff * falloff;

      float wave =
        uFlagTime * 3.2 +
        uFlagPhase +
        position.x * 8.0 -
        position.y * 1.6;

      transformed.z +=
        sin(wave) * 0.23 * flutter;

      transformed.x +=
        cos(wave * 0.7) * 0.045 * flutter;
      `
    );
  };

  // Keep uniforms available before and after shader compilation.
  material.userData.timeUniform = timeUniform;
  material.userData.phaseUniform = phaseUniform;

  return material;
}

function buildFlags(heightAt) {
  const woodParts = [];
  const cloths = [];

  const geometry = buildFlagGeometry();

  const yaw = FLAG_YAW;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);

  for (let index = 0; index < FLAG_POSITIONS.length; index++) {
    const [x, z] = FLAG_POSITIONS[index];
    const ground = heightAt(x, z);

    // Wooden post and horizontal crossbar.
    for (const part of [
      {
        x: -0.58,
        y: 1.5,
        z: 0,
        width: 0.16,
        height: 3,
        depth: 0.16,
      },
      {
        x: 0,
        y: 2.78,
        z: 0,
        width: 1.36,
        height: 0.12,
        depth: 0.13,
      },
    ]) {
      woodParts.push({
        x: x + part.x * cos + part.z * sin,
        y: ground + part.y,
        z: z - part.x * sin + part.z * cos,

        yaw,

        sx: part.width,
        sy: part.height,
        sz: part.depth,
      });
    }

    const material = createFlagMaterial(index * 1.7);

    const cloth = new THREE.Mesh(
      geometry,
      material
    );

    cloth.name = `ruins-flag-cloth-${index}`;

    cloth.position.set(x, ground, z);
    cloth.rotation.y = yaw;

    cloth.castShadow = true;
    cloth.receiveShadow = true;

    cloths.push(cloth);
  }

  // All wooden posts and crossbars in one InstancedMesh.
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),

    new THREE.MeshStandardMaterial({
      color: '#5a4630',
      roughness: 0.95,
    }),

    woodParts.length
  );

  mesh.name = 'ruins-flag-wood';

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();

  woodParts.forEach((part, i) => {
    dummy.position.set(
      part.x,
      part.y,
      part.z
    );

    dummy.rotation.set(0, part.yaw, 0);

    dummy.scale.set(
      part.sx,
      part.sy,
      part.sz
    );

    dummy.updateMatrix();

    mesh.setMatrixAt(i, dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();

  return {
    woodMesh: mesh,
    cloths,
  };
}

/**
 * Add two broken stone arches and two animated flags.
 *
 * @param {THREE.Scene} scene
 * @param {(x: number, z: number) => number} heightAt
 * @returns {{
 *   colliders: Array<{x:number,z:number,radius:number}>,
 *   update: (time:number) => void
 * }}
 */
export function createRuins(scene, heightAt) {
  const {
    mesh: stones,
    colliders,
  } = buildStoneInstances(heightAt);

  const {
    woodMesh,
    cloths,
  } = buildFlags(heightAt);

  scene.add(stones, woodMesh, ...cloths);

  return {
    colliders,

    update(time) {
      for (const cloth of cloths) {
        cloth.material.userData.timeUniform.value = time;
      }
    },
  };
}
