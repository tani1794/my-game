// 白薔薇の迷宮橋のまわりの地形の見た目：起伏のある地面（苔・土・岩肌・湿った沢底を頂点の色で）、
// 沢の水、谷底に溜まる薄い霧、谷と斜面と丘の樹林、岩、低木。高さは terrain.js の式から作る。
// 木・岩・低木は種類ごとにまとめて描く（InstancedMesh）。葉には影を落とさせない（iPhone の負荷のため）。
import * as THREE from 'three';
import { loadGLTF, measureModel, withFallback } from '../../assets.js';
import { asset } from '../../paths.js';
import { mulberry32 } from '../../world/random.js';
import { floorHeight } from '../kit.js';
import { cliffMaterial } from '../props.js';
import { roseTerrainHeight, roseTerrainSlope, plateauAt, STREAM, VALLEY_FLOOR } from './terrain.js';
import { ROSE_FLOORS } from './layout.js';

const SIZE = 520;
const CENTER = { x: 15, z: -10 };

// 地面の色（頂点ごと）。細かな明暗は、別の粒の画像を掛け合わせて足す
const COLORS = {
  moss: new THREE.Color('#4f6640'),
  grass: new THREE.Color('#5f7046'),
  earth: new THREE.Color('#6f6553'),
  rock: new THREE.Color('#5f605a'),
  wet: new THREE.Color('#465240'),
  far: new THREE.Color('#6b7469'),
};

// 地面の粒（明るさだけの細かな模様）
function grainTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    const v = Math.floor(170 + random() * 85);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(random() * 128, random() * 128, 1 + random() * 3, 1 + random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 近くに床があるか（木を置かない）。margin m まで広げて調べる
function nearFloor(x, z, margin) {
  return ROSE_FLOORS.some((f) => {
    if (f.type === 'path') return floorHeight({ ...f, width: f.width + margin * 2 }, x, z) !== null;
    if (f.type === 'circle') return Math.hypot(x - f.x, z - f.z) < f.radius + margin;
    return x > f.x0 - margin && x < f.x1 + margin && z > f.z0 - margin && z < f.z1 + margin;
  });
}

// keepOut：建物・橋の足もとの四角 { x0, x1, z0, z1, top }（木の高さが top を超えるなら置かない）
export async function buildRoseTerrain(root, materials, { lite = false, keepOut = [], load = loadGLTF } = {}) {
  const random = mulberry32(907);
  const owned = new Set();
  const own = (m) => { owned.add(m); return m; };
  const geometries = [];

  // ── 地面 ──
  const segments = lite ? 130 : 180;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + CENTER.x;
    const z = position.getZ(i) + CENTER.z;
    const y = roseTerrainHeight(x, z);
    position.setXYZ(i, x, y, z);
    uv.setXY(i, x / 4, z / 4);
    const slope = roseTerrainSlope(x, z);
    const n = Math.sin(x * 0.31 + z * 0.17) * 0.5 + Math.sin(x * 0.07 - z * 0.13) * 0.5;
    // 平らな所は苔と草、急な所は岩肌、沢沿いは湿った暗い土、遠い丘は少し霞んだ色
    color.copy(COLORS.moss).lerp(COLORS.grass, 0.5 + n * 0.5);
    if (slope > 0.45) color.lerp(COLORS.earth, Math.min(1, (slope - 0.45) * 2));
    if (slope > 0.95) color.lerp(COLORS.rock, Math.min(1, (slope - 0.95) * 1.6));
    if (y < VALLEY_FLOOR - 1.2) color.lerp(COLORS.wet, 0.7);
    const r = Math.hypot(x - CENTER.x, z - CENTER.z);
    if (r > 160) color.lerp(COLORS.far, Math.min(0.6, (r - 160) / 160));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometries.push(geometry);
  const grain = grainTexture(random);
  const ground = new THREE.Mesh(geometry, own(new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 1 })));
  ground.receiveShadow = true;
  ground.name = 'rose-terrain';
  root.add(ground);

  // ── 沢：谷底の窪みに沿った細い水の帯 ──
  const streamPoints = [];
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i];
    const [bx, bz] = STREAM[i + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 3);
    for (let s = 0; s < steps; s++) streamPoints.push([ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps]);
  }
  const ribbon = [];
  const ribbonIndex = [];
  streamPoints.forEach(([x, z], i) => {
    const [nx, nz] = streamPoints[Math.min(i + 1, streamPoints.length - 1)];
    const len = Math.hypot(nx - x, nz - z) || 1;
    const sx = (-(nz - z) / len) * 1.8;
    const sz = ((nx - x) / len) * 1.8;
    const y = Math.max(roseTerrainHeight(x + sx, z + sz), roseTerrainHeight(x - sx, z - sz), roseTerrainHeight(x, z)) + 0.12;
    ribbon.push(x + sx, y, z + sz, x - sx, y, z - sz);
    if (i > 0) ribbonIndex.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
  });
  const streamGeometry = new THREE.BufferGeometry();
  streamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ribbon, 3));
  streamGeometry.setIndex(ribbonIndex);
  streamGeometry.computeVertexNormals();
  geometries.push(streamGeometry);
  const stream = new THREE.Mesh(streamGeometry, own(new THREE.MeshStandardMaterial({ color: '#6f8790', roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.85, side: THREE.DoubleSide })));
  root.add(stream);

  // ── 谷底の霧：低いほど濃い2枚（橋や通路の高さには届かせない） ──
  const mistTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 70; i++) {
      const x = random() * 256;
      const y = random() * 256;
      const r = 20 + random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
  })();
  const mists = [];
  for (const [y, opacity] of [[VALLEY_FLOOR + 2.5, 0.26], [VALLEY_FLOOR + 8, 0.12]]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), own(new THREE.MeshBasicMaterial({ map: mistTexture, color: '#b9c4c8', transparent: true, opacity, depthWrite: false })));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(CENTER.x, y, CENTER.z);
    plane.renderOrder = 2;
    root.add(plane);
    geometries.push(plane.geometry);
    mists.push(plane);
  }

  // ── 樹林・岩・低木の場所を決める ──
  const blocked = (x, z, top) => keepOut.some((k) => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1 && (k.top === undefined || top > k.top));
  const trees = [];
  const rocks = [];
  const shrubs = [];
  const spacing = lite ? 9 : 6.5;
  for (let gx = -230; gx <= 260; gx += spacing) {
    for (let gz = -240; gz <= 230; gz += spacing) {
      const x = gx + (random() - 0.5) * spacing * 0.9;
      const z = gz + (random() - 0.5) * spacing * 0.9;
      const r = Math.hypot(x - CENTER.x, z - CENTER.z);
      if (r > 245) continue;
      const y = roseTerrainHeight(x, z);
      const slope = roseTerrainSlope(x, z);
      const plateau = plateauAt(x, z);
      if (nearFloor(x, z, 4)) continue;
      // 急な崖：岩
      // 急な崖：岩肌が露出した大きな岩（崖の面に半分埋める）
      if (slope > 1.1) {
        if (random() < 0.55) rocks.push({ x, y: y - 1.2, z, s: 1.6 + random() * 2.6 });
        continue;
      }
      if (slope > 0.7 && random() < 0.18) rocks.push({ x, y: y - 0.4, z, s: 0.8 + random() * 1.6 });
      // 城の高台の上と、入口の丘の通路まわりは、建物と道を見せるため木を少なく
      const density = plateau?.id === 'castleMesa' ? 0.05 : plateau ? 0.35 : y < VALLEY_FLOOR + 3 ? 0.8 : 0.6;
      const height = 6 + random() * 9;
      if (random() < density && !blocked(x, z, y + height)) trees.push({ x, y, z, h: height, kind: Math.floor(random() * 4), turn: random() * 6.3, lean: (random() - 0.5) * 0.08 });
      else if (random() < 0.25 && !blocked(x, z, y + 2)) shrubs.push({ x, y, z, s: 0.8 + random() * 0.9, turn: random() * 6.3 });
    }
  }
  // 沢沿いの岩と低木
  for (const [x, z] of streamPoints) {
    if (random() < 0.35) rocks.push({ x: x + (random() - 0.5) * 7, y: roseTerrainHeight(x, z), z: z + (random() - 0.5) * 7, s: 0.5 + random() * 1.3 });
    if (random() < 0.5) shrubs.push({ x: x + (random() - 0.5) * 9, y: roseTerrainHeight(x, z), z: z + (random() - 0.5) * 9, s: 0.7 + random() * 0.6, turn: random() * 6 });
  }
  // 数を絞るときは、近い木（谷と斜面）を優先して残す。遠い丘はまばらでよい（霧に沈む）
  const maxTrees = lite ? 320 : 680;
  for (const t of trees) t.rank = Math.hypot(t.x - CENTER.x, t.z - CENTER.z) + random() * 80;
  trees.sort((a, b) => a.rank - b.rank);
  if (trees.length > maxTrees) trees.splice(maxTrees);

  // ── 木：Kenney の針葉樹と広葉樹（読めなければ、円錐の木） ──
  const tryLoad = (path) => withFallback(load(asset(path)).then((gltf) => { measureModel(gltf.scene); return gltf.scene; }), () => null);
  const models = await Promise.all(['models/nature/pine_tall.glb', 'models/nature/pine_round.glb', 'models/forest/oak_dark.glb', 'models/forest/default_dark.glb', 'models/forest/bush_large.glb'].map(tryLoad));
  const dummy = new THREE.Object3D();
  const leafTint = new THREE.Color('#9fb092');
  const placeModel = (model, list, sizeOf, fallback) => {
    if (list.length === 0) return;
    if (!model) {
      const mesh = new THREE.InstancedMesh(fallback.geometry, fallback.material, list.length);
      list.forEach((spot, i) => {
        dummy.position.set(spot.x, spot.y + sizeOf(spot) / 2, spot.z);
        dummy.rotation.set(0, spot.turn ?? 0, 0);
        dummy.scale.set(sizeOf(spot) * 0.35, sizeOf(spot), sizeOf(spot) * 0.35);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.computeBoundingSphere();
      root.add(mesh);
      return;
    }
    model.updateMatrixWorld(true);
    const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    model.traverse((part) => {
      if (!part.isMesh) return;
      const material = own(part.material.clone());
      // 彩度を落とし、湿った深い緑に寄せる
      material.color.multiply(leafTint);
      material.roughness = 1;
      const mesh = new THREE.InstancedMesh(part.geometry, material, list.length);
      list.forEach((spot, i) => {
        // 根元を少し地面に沈め、浮いて見えないようにする
        dummy.position.set(spot.x, spot.y - 0.3, spot.z);
        dummy.rotation.set(spot.lean ?? 0, spot.turn ?? 0, (spot.lean ?? 0) * 0.7);
        dummy.scale.setScalar(sizeOf(spot) / height);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix.clone().multiply(part.matrixWorld));
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      root.add(mesh);
    });
  };
  const fallbackTree = { geometry: own(new THREE.ConeGeometry(1, 1, 7)), material: own(new THREE.MeshStandardMaterial({ color: '#33452f', roughness: 1, flatShading: true })) };
  geometries.push(fallbackTree.geometry);
  for (let kind = 0; kind < 4; kind++) placeModel(models[kind], trees.filter((t) => t.kind === kind), (t) => t.h * (kind < 2 ? 1 : 0.8), fallbackTree);
  placeModel(models[4], shrubs, (s) => s.s * 1.4, fallbackTree);

  // ── 岩：崖と沢沿い（同じ形をまとめて描く） ──
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  geometries.push(rockGeometry);
  const rockMesh = new THREE.InstancedMesh(rockGeometry, cliffMaterial, rocks.length);
  rocks.forEach((rock, i) => {
    dummy.position.set(rock.x, rock.y + rock.s * 0.2, rock.z);
    dummy.rotation.set(random() * 3, random() * 3, random() * 3);
    dummy.scale.set(rock.s, rock.s * (0.6 + random() * 0.6), rock.s * (0.8 + random() * 0.4));
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
  });
  rockMesh.computeBoundingSphere();
  rockMesh.castShadow = !lite;
  rockMesh.receiveShadow = true;
  root.add(rockMesh);

  return {
    ground,
    counts: { trees: trees.length, rocks: rocks.length, shrubs: shrubs.length },
    update(time) {
      mists[0].material.map.offset.set(time * 0.004, time * 0.002);
      mists[1].position.y = VALLEY_FLOOR + 8 + Math.sin(time * 0.2) * 0.4;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of owned) m.dispose();
      mistTexture.dispose();
      grain.dispose();
    },
  };
}
