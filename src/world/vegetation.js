import * as THREE from 'three';
import { loadGLTF, measureModel, withFallback } from '../assets.js';
import { mulberry32 } from './random.js';
import { distanceToPath, isOnPath } from './terrain.js';

const MAX_GRASS = 6000;
const AREA_RADIUS = 23.5;
const ARCH_COLUMNS = [-7, -3, 3, 7].map((x) => ({ x, z: -14 }));

const TREE_MODELS = ['/models/nature/pine_tall.glb', '/models/nature/pine_default.glb', '/models/nature/pine_round.glb'];
const ROCK_MODELS = ['/models/nature/stone_a.glb', '/models/nature/stone_c.glb', '/models/nature/stone_e.glb'];
// 素材の石は青白いので、アーチや崖に合わせた暖かい灰色に塗り直す
const ROCK_COLOR = '#9a958c';
// 素材の木は幹が明るいオレンジでおもちゃっぽいので、焦げ茶の幹と深い緑の葉にする
const TRUNK_COLOR = '#4a3a2a';
const LEAF_COLOR = '#2f5a3a';
const FLOWER_MODEL = '/models/nature/flower_purple.glb';

const near = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) < r;

// 木と岩を置いてはいけない場所：道、アーチ、結晶獣、開始位置
function blocksPlay(x, z, pathMargin) {
  return (
    distanceToPath(x, z) < pathMargin ||
    (Math.abs(x) < 9.5 && z > -17 && z < -11) ||
    near(x, z, 0, -6, 7) ||
    near(x, z, 0, 6, 5)
  );
}

// 木・岩・草・花の置き場所を、毎回同じ乱数で決める
export function placeVegetation() {
  const random = mulberry32(11);
  const trees = [];
  const rocks = [];

  function addTree(x, z) {
    if (Math.hypot(x, z) >= AREA_RADIUS || blocksPlay(x, z, 2.5)) return false;
    if (trees.some((t) => near(x, z, t.x, t.z, 2.2))) return false;
    trees.push({
      x,
      z,
      kind: Math.floor(random() * TREE_MODELS.length),
      height: 8 + random() * 5,
      turn: random() * Math.PI * 2,
    });
    return true;
  }

  // アーチの左右に、背の高い木をまとめる
  for (const side of [-1, 1]) {
    let placed = 0;
    for (let tries = 0; placed < 4 && tries < 200; tries++) {
      if (addTree(side * (11 + random() * 5), -12 - random() * 7)) placed++;
    }
  }

  // 残りは崖の内側にまばらに
  for (let tries = 0; trees.length < 24 && tries < 2000; tries++) {
    const angle = random() * Math.PI * 2;
    const radius = 15 + random() * 8;
    addTree(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  for (let tries = 0; rocks.length < 15 && tries < 2000; tries++) {
    const angle = random() * Math.PI * 2;
    const radius = 6 + random() * 16;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (blocksPlay(x, z, 1.5)) continue;
    if (ARCH_COLUMNS.some((c) => near(x, z, c.x, c.z, 2))) continue;
    if ([...trees, ...rocks].some((p) => near(x, z, p.x, p.z, 2.5))) continue;
    rocks.push({
      x,
      z,
      kind: Math.floor(random() * ROCK_MODELS.length),
      size: 0.9 + random() * 1.4,
      turn: random() * Math.PI * 2,
    });
  }

  function scatterOffPath(count) {
    const spots = [];
    while (spots.length < count) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * AREA_RADIUS;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (isOnPath(x, z) || distanceToPath(x, z) < 0.2) continue;
      spots.push({ x, z, turn: random() * Math.PI * 2, scale: 0.7 + random() * 0.6, shade: 0.75 + random() * 0.4 });
    }
    return spots;
  }

  return { trees, rocks, grass: scatterOffPath(MAX_GRASS), flowers: scatterOffPath(MAX_GRASS / 10) };
}

// 草1束：細い三角形3枚。根元は暗く、先は黄緑
function createTuftGeometry() {
  const positions = [];
  const colors = [];
  const base = new THREE.Color('#3b5229');
  const tip = new THREE.Color('#a3a855');

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI;
    const dx = Math.cos(angle) * 0.05;
    const dz = Math.sin(angle) * 0.05;
    const lean = 0.06 * (i - 1);
    const height = 0.38 + i * 0.07;
    positions.push(-dx, 0, -dz, dx, 0, dz, lean, height, lean * 0.5);
    colors.push(...base.toArray(), ...base.toArray(), ...tip.toArray());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // 法線をすべて真上にして、地面と同じように光を受ける（逆光で真っ黒にならない）
  const up = new Float32Array(positions.length);
  for (let i = 1; i < up.length; i += 3) up[i] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(up, 3));
  return geometry;
}

// 高さ（position.y）に比例して、風で揺らす
function addWind(material, timeUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windPhase = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
        #else
          float windPhase = 0.0;
        #endif
        float sway = sin(uWindTime * 1.7 + windPhase) * 0.08 * position.y / 0.5;
        transformed.x += sway;
        transformed.z += sway * 0.5;`,
      );

    // 両面表示の裏側では法線が下向きに反転して真っ黒になるので、草だけ反転させない
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
    );
  };
}

function placementMatrix(spot, heightAt, scale, out) {
  const dummy = new THREE.Object3D();
  dummy.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
  dummy.rotation.y = spot.turn;
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  return out.copy(dummy.matrix);
}

// 読み込んだモデルの部品ごとに InstancedMesh を作り、まとめて描く
function instanceModel(model, placements, heightAt, sizeOf, name) {
  const group = new THREE.Group();
  group.name = name;
  if (placements.length === 0) return group;

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  const matrix = new THREE.Matrix4();
  model.traverse((part) => {
    if (!part.isMesh) return;
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    placements.forEach((spot, i) => {
      placementMatrix(spot, heightAt, sizeOf(spot, size), matrix);
      mesh.setMatrixAt(i, matrix.multiply(part.matrixWorld));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });
  return group;
}

export async function createVegetation(scene, preset, heightAt, load = loadGLTF) {
  const layout = placeVegetation();
  // 読めない・中身が空のモデルは null にして、その種類は置かない
  const tryLoad = (url) =>
    withFallback(
      load(url).then((gltf) => {
        measureModel(gltf.scene);
        return gltf.scene;
      }),
      () => null,
    );

  const [treeModels, rockModels, flowerModel] = await Promise.all([
    Promise.all(TREE_MODELS.map(tryLoad)),
    Promise.all(ROCK_MODELS.map(tryLoad)),
    tryLoad(FLOWER_MODEL),
  ]);

  const colliders = [];

  // 木：高さ 8〜13m にそろえる。読み込めた種類だけ置く
  treeModels.forEach((model, kind) => {
    if (!model) return;
    model.traverse((part) => {
      if (!part.isMesh) return;
      const name = part.material.name.toLowerCase();
      if (name.includes('wood')) part.material.color.set(TRUNK_COLOR);
      if (name.includes('leaf')) part.material.color.set(LEAF_COLOR);
    });
    const spots = layout.trees.filter((t) => t.kind === kind);
    scene.add(instanceModel(model, spots, heightAt, (t, size) => t.height / size.y, `vegetation-trees-${kind}`));
  });
  for (const t of layout.trees) {
    if (treeModels[t.kind]) colliders.push({ x: t.x, z: t.z, radius: 0.5 });
  }

  // 岩：一番長い辺を size(m) にそろえる
  rockModels.forEach((model, kind) => {
    if (!model) return;
    model.traverse((part) => {
      if (part.isMesh) part.material.color.set(ROCK_COLOR);
    });
    const spots = layout.rocks.filter((r) => r.kind === kind);
    scene.add(instanceModel(model, spots, heightAt, (r, size) => r.size / Math.max(size.x, size.y, size.z), `vegetation-rocks-${kind}`));
  });
  for (const r of layout.rocks) {
    if (rockModels[r.kind]) colliders.push({ x: r.x, z: r.z, radius: r.size * 0.45 });
  }

  // 草：InstancedMesh 1つ。最大数で確保し、mesh.count で表示数を変える
  const windTime = { value: 0 };
  const grassMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  addWind(grassMaterial, windTime);

  const grass = new THREE.InstancedMesh(createTuftGeometry(), grassMaterial, MAX_GRASS);
  grass.name = 'vegetation-grass';
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  layout.grass.forEach((spot, i) => {
    grass.setMatrixAt(i, placementMatrix(spot, heightAt, spot.scale, matrix));
    grass.setColorAt(i, color.setScalar(spot.shade));
  });
  grass.receiveShadow = true;
  grass.frustumCulled = false;
  scene.add(grass);

  // 花：草の 1/10。読み込めたときだけ
  let flowers = null;
  if (flowerModel) {
    // 小さな花は逆光で黒い粒に見えるので、草と同じく法線を真上にする
    flowerModel.traverse((part) => {
      if (!part.isMesh) return;
      const normal = part.geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
    });
    flowers = instanceModel(flowerModel, layout.flowers, heightAt, (spot, size) => (0.35 * spot.scale) / size.y, 'vegetation-flowers');
    flowers.traverse((part) => {
      if (part.isInstancedMesh) part.castShadow = false;
    });
    scene.add(flowers);
  }

  function setGrassCount(n) {
    const count = Math.max(0, Math.min(MAX_GRASS, Math.floor(n)));
    grass.count = count;
    flowers?.traverse((part) => {
      if (part.isInstancedMesh) part.count = Math.floor(count / 10);
    });
  }

  setGrassCount(preset.grass);

  return {
    colliders,
    setGrassCount,
    update(time) {
      windTime.value = time;
    },
  };
}
