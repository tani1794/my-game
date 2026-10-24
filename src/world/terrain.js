import * as THREE from 'three';
import { mulberry32 } from './random.js';

const PLAZA_RADIUS = 12;
const PATH_HALF_WIDTH = 1.5;
const PATH_Z_START = 12;
const PATH_Z_END = -14;
const BLEND = 4;
const CLIFF_COUNT = 56;
const PLAZA_CENTER_Z = -4;
const PLAZA_STONE_RADIUS = 8.5;
const GROUND_REPEAT = 10;

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
  ground.name = 'ground';
  ground.receiveShadow = true;

  // 地面の画像を貼る。画像の色に頂点色が掛け算されるので、頂点色は白寄りの淡い色むらに切り替える
  function setGroundTexture(texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const tinted = new Float32Array(colors.length);
    for (let i = 0; i < colors.length; i++) tinted[i] = colors[i] + (1 - colors[i]) * 0.6;
    geometry.setAttribute('color', new THREE.BufferAttribute(tinted, 3));

    ground.material.map = texture;
    ground.material.needsUpdate = true;
  }

  return { ground, setGroundTexture };
}

// 敷石の置き場所：道の上と、獣の前の広場（中心 (0, -4)、半径 8.5m）。
// 形と大きさを不揃いにし、広場の縁ほど抜けを多くして、苔に埋もれた古い石畳に見せる
export function placeFlagstones() {
  const random = mulberry32(5);
  const stones = [];
  const spacing = 0.7;

  for (let gz = PATH_Z_START; gz > PLAZA_CENTER_Z - PLAZA_STONE_RADIUS; gz -= spacing) {
    for (let gx = -PLAZA_STONE_RADIUS; gx <= PLAZA_STONE_RADIUS; gx += spacing) {
      const x = gx + (random() - 0.5) * 0.3;
      const z = gz + (random() - 0.5) * 0.3;
      const fromPlaza = Math.hypot(x, z - PLAZA_CENTER_Z);
      const onPath = isOnPath(x, z);
      if (!onPath && fromPlaza > PLAZA_STONE_RADIUS) continue;

      const skip = onPath ? 0.15 : 0.3 + 0.35 * (fromPlaza / PLAZA_STONE_RADIUS);
      if (random() < skip) continue;

      const size = 0.3 + random() * 0.2;
      const aspect = 0.65 + random() * 0.95;
      stones.push({
        x,
        z,
        sx: size * aspect,
        sz: size / aspect,
        thickness: 0.05 + random() * 0.05,
        turn: random() * Math.PI,
        shade: 0.72 + random() * 0.4,
      });
    }
  }

  return stones;
}

// ── 石畳：不揃いな七角形の平石を並べる ──
function createPathStones() {
  const stones = placeFlagstones();

  const mesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1.04, 1, 7),
    new THREE.MeshStandardMaterial({ color: '#82796c', roughness: 0.95, flatShading: true }),
    stones.length,
  );

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  stones.forEach((stone, i) => {
    dummy.position.set(stone.x, heightAt(stone.x, stone.z) + 0.01, stone.z);
    dummy.rotation.set(0, stone.turn, 0);
    dummy.scale.set(stone.sx, stone.thickness, stone.sz);
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
  const { ground, setGroundTexture } = createGround();
  scene.add(ground);
  scene.add(createPathStones());

  const cliffs = createCliffs();
  scene.add(cliffs.mesh);

  return { colliders: cliffs.colliders, heightAt, isOnPath, setGroundTexture };
}
