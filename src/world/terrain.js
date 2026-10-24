import * as THREE from 'three';
import { mulberry32 } from './random.js';

const PLAZA_RADIUS = 12;
const PATH_HALF_WIDTH = 1.5;
const PATH_Z_START = 12;
const PATH_Z_END = -14;
const BLEND = 4;
const CLIFF_COUNT = 56;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// 道（x = 0 に沿った幅3mの帯）からの距離
export function distanceToPath(x, z) {
  const dx = Math.max(Math.abs(x) - PATH_HALF_WIDTH, 0);
  const dz = Math.max(z - PATH_Z_START, PATH_Z_END - z, 0);
  return Math.hypot(dx, dz);
}

export function isOnPath(x, z) {
  return distanceToPath(x, z) === 0;
}

// 中央の広場と道は平ら。その外は sin を重ねたなだらかな起伏（0〜0.6m）を、4mかけてつなぐ
export function heightAt(x, z) {
  const fromPlaza = Math.max(Math.hypot(x, z) - PLAZA_RADIUS, 0);
  const fromFlat = Math.min(fromPlaza, distanceToPath(x, z));
  if (fromFlat === 0) return 0;

  const rolling =
    0.3 +
    0.15 * Math.sin(x * 0.35) * Math.cos(z * 0.3) +
    0.15 * Math.sin((x + z) * 0.21);

  return rolling * smoothstep(0, BLEND, fromFlat);
}

// ── 地面：起伏と、緑・黄緑・土色のむら ──
function createGround() {
  const geometry = new THREE.PlaneGeometry(60, 60, 80, 80);
  geometry.rotateX(-Math.PI / 2);

  const grass = new THREE.Color('#4f6b3a');
  const meadow = new THREE.Color('#7a8a44');
  const earth = new THREE.Color('#6b5a3e');
  const pathColor = new THREE.Color('#7a6e5c');
  const color = new THREE.Color();

  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, heightAt(x, z));

    const patch = 0.5 + 0.5 * Math.sin(x * 0.23 + Math.cos(z * 0.19) * 2);
    const dirt = 0.5 + 0.5 * Math.sin(z * 0.31 - x * 0.12);
    color.copy(grass).lerp(meadow, patch).lerp(earth, dirt * 0.35);

    // 道の上と、道のすぐ脇は土の色に寄せる
    const nearPath = 1 - smoothstep(0, 1.2, distanceToPath(x, z));
    color.lerp(pathColor, nearPath * 0.8);

    color.toArray(colors, i * 3);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  ground.receiveShadow = true;
  return ground;
}

// ── 石畳：道の上に平たい石を並べる ──
function createPathStones() {
  const random = mulberry32(5);
  const stones = [];

  for (let z = PATH_Z_START - 0.3; z > PATH_Z_END; z -= 0.62) {
    for (let x = -PATH_HALF_WIDTH + 0.3; x < PATH_HALF_WIDTH; x += 0.62) {
      // ところどころ石が抜けて、土が見えるようにする
      if (random() < 0.12) continue;
      stones.push({
        x: x + (random() - 0.5) * 0.12,
        z: z + (random() - 0.5) * 0.12,
        size: 0.48 + random() * 0.1,
        turn: random() * Math.PI,
        shade: 0.85 + random() * 0.25,
      });
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.52, 0.08, 6),
    new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.95 }),
    stones.length,
  );

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  stones.forEach((stone, i) => {
    dummy.position.set(stone.x, 0.02, stone.z);
    dummy.rotation.set(0, stone.turn, 0);
    dummy.scale.set(stone.size, 1, stone.size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.setScalar(stone.shade));
  });

  mesh.receiveShadow = true;
  return mesh;
}

// ── 崖：半径24〜27の輪に岩を並べる。左右と奥は高く厚く、手前（+z）は低く ──
function createCliffs() {
  const random = mulberry32(13);
  const rocks = [];
  const colliders = [];

  for (let i = 0; i < CLIFF_COUNT; i++) {
    const angle = (i / CLIFF_COUNT) * Math.PI * 2 + (random() - 0.5) * 0.04;
    const ring = 24.5 + random();
    const x = Math.cos(angle) * ring;
    const z = Math.sin(angle) * ring;

    // 手前（+z の方向）ほど低くする
    const front = smoothstep(0.2, 0.9, Math.sin(angle));
    const height = THREE.MathUtils.lerp(4 + random() * 4, 1.4 + random(), front);
    const width = 1.8 + random() * 0.6;

    rocks.push({ x, z, width, height, turn: random() * Math.PI, shade: 0.8 + random() * 0.3 });
    colliders.push({ x, z, radius: width });

    // 奥と左右は、外側にもう一列重ねて厚く見せる（外側なので当たり判定は不要）
    if (front < 0.5) {
      const outer = ring + 2.2;
      rocks.push({
        x: Math.cos(angle + 0.03) * outer,
        z: Math.sin(angle + 0.03) * outer,
        width: width * 1.2,
        height: height * (1.1 + random() * 0.4),
        turn: random() * Math.PI,
        shade: 0.7 + random() * 0.3,
      });
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: '#7a7468', roughness: 0.95, flatShading: true }),
    rocks.length,
  );

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  rocks.forEach((rock, i) => {
    dummy.position.set(rock.x, rock.height * 0.45 + heightAt(rock.x, rock.z) - 0.3, rock.z);
    dummy.rotation.set(0, rock.turn, 0);
    dummy.scale.set(rock.width, rock.height * 0.6, rock.width);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.setScalar(rock.shade));
  });

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, colliders };
}

export function createTerrain(scene) {
  scene.add(createGround());
  scene.add(createPathStones());

  const cliffs = createCliffs();
  scene.add(cliffs.mesh);

  return { colliders: cliffs.colliders, heightAt, isOnPath };
}
