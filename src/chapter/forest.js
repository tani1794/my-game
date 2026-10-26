// 霧の森（第一章）：地面・谷・木々・下草・旧門衛所・東の門と石垣・橋・西の沢を作る。
// 形と場所は layout.js がすべて決める。ここはそれを立体にするだけ。
import * as THREE from 'three';
import { loadGLTF, measureModel, withFallback } from '../assets.js';
import { mulberry32 } from '../world/random.js';
import { asset } from '../paths.js';
import { worldUV } from './materials.js';
import {
  heightAt, groundHeight, distanceToWalkable, distanceToPaths, inRavineBand,
  RAVINE, BRIDGE, GATEHOUSE, GATE, INTERACTABLES,
} from './layout.js';

const FOREST_MODELS = {
  oak: 'models/forest/oak_dark.glb',
  detailed: 'models/forest/detailed_dark.glb',
  plain: 'models/forest/default_dark.glb',
  fat: 'models/forest/fat_dark.glb',
  pineTall: 'models/nature/pine_tall.glb',
  pine: 'models/nature/pine_default.glb',
  bush: 'models/forest/bush_large.glb',
  bushDetailed: 'models/forest/bush_detailed.glb',
  fern: 'models/forest/fern.glb',
  grass: 'models/forest/grass_large.glb',
  flower: 'models/forest/flower_yellow.glb',
  moss: 'models/forest/hanging_moss.glb',
  mushrooms: 'models/forest/mushroom_group.glb',
  log: 'models/forest/log_large.glb',
  stump: 'models/forest/stump_old.glb',
  rock: 'models/forest/rock_large_b.glb',
  rockTall: 'models/forest/rock_tall_a.glb',
  stoneTall: 'models/forest/stone_tall_b.glb',
};

// Kenney の色は明るく青緑なので、湿った深い森の色に塗り直す（材質の名前で見分ける）
function recolor(model) {
  model.traverse((part) => {
    if (!part.isMesh) return;
    part.material = part.material.clone();
    const name = part.material.name.toLowerCase();
    if (name.includes('leaf') || name.includes('grass')) part.material.color.set('#4f7346');
    else if (name.includes('wood')) part.material.color.set(name.includes('inner') ? '#8a7558' : '#5e4c3c');
    else if (name.includes('yellow')) part.material.color.set('#eeeee6');
    else if (name.includes('dirt')) part.material.color.set('#3d3428');
    else if (name.includes('tan')) part.material.color.set('#b49a78');
    else part.material.color.set('#7c7a72');
    part.material.roughness = 1;
  });
  return model;
}

// 葉と草だけ、高さに比例して風で小さく揺らす（幹の根元は動かない）
function addWind(material, timeUniform, amount) {
  // three.js は onBeforeCompile の文面が同じ材質を同じものとみなすので、揺れ方と法線の扱いごとに名前を分ける
  material.customProgramCacheKey = () => `forest-wind-${amount}-${Boolean(material.userData.upNormal)}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        #else
          float windPhase = 0.0;
        #endif
        float windSway = (sin(uWindTime * 1.1 + windPhase) * 0.7 + sin(uWindTime * 2.3 + windPhase * 1.7) * 0.3) * ${amount.toFixed(3)} * max(position.y, 0.0);
        transformed.x += windSway;
        transformed.z += windSway * 0.6;`,
      );
    // 小さな草花：裏から見ても法線を反転させない（上向きの法線のまま、黒くならない）
    if (material.userData.upNormal) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
      );
    }
  };
}

const dummy = new THREE.Object3D();
function matrixFor(spot, scale) {
  dummy.position.set(spot.x, spot.y ?? heightAt(spot.x, spot.z), spot.z);
  dummy.rotation.set(spot.tilt ?? 0, spot.turn ?? 0, 0);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  return dummy.matrix;
}

// 1つのモデルを、たくさんの場所に置く（部品ごとに InstancedMesh）
function instance(model, spots, sizeOf, { shadow = true, wind = null, receive = true } = {}) {
  const group = new THREE.Group();
  if (!model || spots.length === 0) return group;
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const matrix = new THREE.Matrix4();
  model.traverse((part) => {
    if (!part.isMesh) return;
    const material = part.material;
    const name = material.name.toLowerCase();
    if (wind && (name.includes('leaf') || name.includes('grass'))) addWind(material, wind.time, wind.amount);
    else if (material.userData.upNormal) addWind(material, { value: 0 }, 0); // 揺らさず、法線の向きだけ直す
    const mesh = new THREE.InstancedMesh(part.geometry, material, spots.length);
    spots.forEach((spot, i) => {
      matrix.copy(matrixFor(spot, sizeOf(spot, size)));
      mesh.setMatrixAt(i, matrix.multiply(part.matrixWorld));
    });
    mesh.castShadow = shadow;
    mesh.receiveShadow = receive;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });
  return group;
}

function box(material, w, h, d, x, y, z, ry = 0, uvSize = 2) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), uvSize), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── 地面：1m 格子。道は土、広場は苔、谷の壁は岩、礼拝堂の敷地は砂利の色 ──
function createGround(materials) {
  const x0 = -66; const x1 = 68; const z0 = -118; const z1 = 76;
  const nx = x1 - x0; const nz = z1 - z0;
  const geometry = new THREE.PlaneGeometry(nx, nz, nx, nz);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const uv = geometry.getAttribute('uv');
  const dirt = new THREE.Color(2.0, 1.65, 1.3);
  const moss = new THREE.Color(1.35, 1.75, 1.05);
  const floor = new THREE.Color(1.05, 1.2, 0.95);
  const rock = new THREE.Color(1.9, 1.85, 1.75);
  const gravel = new THREE.Color(1.7, 1.68, 1.62);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = groundHeight(x, z);
    position.setY(i, y);
    uv.setXY(i, x / 4, z / 4);
    const path = distanceToPaths(x, z);
    const edge = distanceToWalkable(x, z);
    color.copy(floor).lerp(moss, THREE.MathUtils.clamp(1 - edge / 3, 0, 1));
    color.lerp(dirt, THREE.MathUtils.clamp(0.6 - path, 0, 1));
    if (x > 20 && x < 52 && z > -108 && z < -62) color.lerp(gravel, 0.55);
    if (z > RAVINE.north - 0.5 && z < RAVINE.south + 0.5) {
      const steep = Math.abs(groundHeight(x, z + 0.5) - groundHeight(x, z - 0.5));
      color.lerp(rock, THREE.MathUtils.clamp(steep * 0.6, 0, 1));
    }
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, materials.ground);
  mesh.receiveShadow = true;
  mesh.name = 'forest-ground';
  return mesh;
}

// ── 木・下草の置き場所（毎回同じ乱数） ──
export function placeForest({ lite = false } = {}) {
  const random = mulberry32(23);
  const trees = [];
  const props = [];
  const spacing = lite ? 4.4 : 3.6;
  const busy = (x, z) => (
    inRavineBand(x, z)
    || (x > 19 && x < 53 && z > -109 && z < -61)              // 礼拝堂の敷地
    || (Math.abs(x - GATE.x) < 2.6 && z > -40 && z < 50)       // 東の石垣
    || (x > GATEHOUSE.x0 - 3 && x < GATEHOUSE.x1 + 3 && z > GATEHOUSE.z0 - 3 && z < GATEHOUSE.z1 + 3)
    || Math.hypot(x + 3, z - 13.5) < 5                         // 広場の大木
  );

  for (let x = -62; x <= 64; x += spacing) {
    for (let z = -114; z <= 72; z += spacing) {
      const px = x + (random() - 0.5) * spacing * 0.9;
      const pz = z + (random() - 0.5) * spacing * 0.9;
      const edge = distanceToWalkable(px, pz);
      if (edge < 1.6 || edge > 22 || busy(px, pz)) continue;
      if (random() > (edge < 8 ? 0.85 : 0.6)) continue;
      const north = pz < -45;
      const r = random();
      const kind = north
        ? (r < 0.5 ? 'pineTall' : r < 0.8 ? 'pine' : 'oak')
        : (r < 0.35 ? 'oak' : r < 0.6 ? 'detailed' : r < 0.8 ? 'fat' : r < 0.9 ? 'plain' : 'pineTall');
      trees.push({ x: px, z: pz, kind, height: (north ? 14 : 10) + random() * 7, turn: random() * Math.PI * 2, edge });
    }
  }

  // 道の縁の下草・岩・倒木・切り株・きのこ
  const step = lite ? 2.2 : 1.6;
  for (let x = -60; x <= 62; x += step) {
    for (let z = -112; z <= 70; z += step) {
      const px = x + (random() - 0.5) * step;
      const pz = z + (random() - 0.5) * step;
      const edge = distanceToWalkable(px, pz);
      if (edge < 0.35 || edge > 7 || busy(px, pz)) continue;
      if (random() > 0.55) continue;
      const r = random();
      const kind = r < 0.3 ? 'fern' : r < 0.5 ? 'bush' : r < 0.62 ? 'bushDetailed' : r < 0.75 ? 'grass'
        : r < 0.82 ? 'rock' : r < 0.86 ? 'mushrooms' : r < 0.9 ? 'stump' : r < 0.93 ? 'log' : r < 0.96 ? 'rockTall' : 'fern';
      props.push({ x: px, z: pz, kind, size: 0.6 + random() * 0.9, turn: random() * Math.PI * 2 });
    }
  }

  // 遠景：霧の向こうの針葉樹の壁
  const skyline = [];
  for (let i = 0; i < (lite ? 90 : 160); i++) {
    const a = (i / (lite ? 90 : 160)) * Math.PI * 2 + random() * 0.03;
    const radius = 82 + random() * 16;
    skyline.push({ x: Math.cos(a) * radius * 0.75, z: -20 + Math.sin(a) * radius, kind: random() < 0.5 ? 'pineTall' : 'pine', height: 22 + random() * 10, turn: random() * 6.28 });
  }
  return { trees, props, skyline };
}

// ── 旧門衛所：蔦に覆われた石造り。中に巻き上げ機とレバー。屋根は大半が崩れている ──
function createGatehouse(materials) {
  const group = new THREE.Group();
  group.name = 'gatehouse';
  const { x0, x1, z0, z1, wall: t, door } = GATEHOUSE;
  const floor = heightAt(0, -24);
  const h = 3.8;
  const walls = [];
  const add = (mesh) => { group.add(mesh); walls.push(mesh); return mesh; };
  const cx = (x0 + x1) / 2;
  // 南と北の壁（入口つき）：左右の壁と、入口の上のまぐさ石
  for (const z of [z0 + t / 2, z1 - t / 2]) {
    const sideW = (x1 - x0) / 2 - door;
    add(box(materials.stone, sideW, h, t, x0 + sideW / 2, floor + h / 2, z));
    add(box(materials.stone, sideW, h, t, x1 - sideW / 2, floor + h / 2, z));
    add(box(materials.stone, door * 2, h - 2.7, t, cx, floor + 2.7 + (h - 2.7) / 2, z));
  }
  add(box(materials.stone, t, h, z1 - z0, x0 + t / 2, floor + h / 2, (z0 + z1) / 2));
  // 東の壁は北東の角が崩れて低い
  add(box(materials.stone, t, h, (z1 - z0) * 0.6, x1 - t / 2, floor + h / 2, z1 - (z1 - z0) * 0.3));
  add(box(materials.stone, t, h * 0.55, (z1 - z0) * 0.4, x1 - t / 2, floor + h * 0.275, z0 + (z1 - z0) * 0.2));
  // 胸壁の凸凹（ところどころ欠けている）
  const random = mulberry32(5);
  for (let x = x0 + 0.5; x < x1; x += 1.3) {
    for (const z of [z0 + t / 2, z1 - t / 2]) {
      if (random() < 0.25) continue;
      group.add(box(materials.stone, 0.7, 0.6, t, x, floor + h + 0.3, z));
    }
  }
  // 崩れかけた屋根：梁と、わずかに残る石板
  for (let z = z0 + 1.5; z < z1 - 1; z += 2.2) {
    const beam = box(materials.wood, x1 - x0 - 0.4, 0.25, 0.3, cx, floor + h - 0.2, z, 0, 1);
    if (random() < 0.3) beam.rotation.z = 0.12;
    group.add(beam);
  }
  const roofPiece = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.6), materials.slate);
  roofPiece.rotation.set(-Math.PI / 2 + 0.25, 0, 0.05);
  roofPiece.position.set(x0 + 3, floor + h + 0.1, z1 - 2.2);
  group.add(roofPiece);
  // 床の石
  const slab = box(materials.stone, x1 - x0 - 1, 0.1, z1 - z0 - 1, cx, floor + 0.04, (z0 + z1) / 2, 0, 2);
  slab.castShadow = false;
  group.add(slab);
  return { group, walls, floor };
}

// 巻き上げ機（瓦礫が噛んでいる）とレバー
function createWinch(materials) {
  const group = new THREE.Group();
  const { x, z } = INTERACTABLES.winch;
  const floor = heightAt(x, z);
  const wx = -2.6; const wz = -25.2;
  for (const dx of [-0.75, 0.75]) group.add(box(materials.wood, 0.18, 1.4, 0.18, wx + dx, floor + 0.7, wz, 0, 1));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.25, 14), materials.wood);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(wx, floor + 1.05, wz);
  drum.castShadow = true;
  group.add(drum);
  const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), materials.iron);
  gear.rotation.z = Math.PI / 2;
  gear.position.set(wx + 0.72, floor + 1.05, wz);
  group.add(gear);
  // 噛んでいる瓦礫
  const rubble = new THREE.Group();
  const random = mulberry32(9);
  for (let i = 0; i < 6; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + random() * 0.14, 0), materials.rubble);
    rock.position.set(wx + 0.55 + random() * 0.35, floor + 0.85 + random() * 0.45, wz - 0.25 + random() * 0.5);
    rock.rotation.set(random() * 3, random() * 3, 0);
    rock.castShadow = true;
    rubble.add(rock);
  }
  group.add(rubble);
  const rockHome = rubble.children.map((rock) => rock.position.clone());

  const lever = new THREE.Group();
  const lx = INTERACTABLES.lever.x; const lz = -27.1;
  const lfloor = heightAt(lx, lz);
  group.add(box(materials.iron, 0.6, 0.3, 0.6, lx, lfloor + 0.15, lz, 0, 1));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), materials.iron);
  stick.position.y = 0.55;
  lever.add(stick);
  lever.position.set(lx, lfloor + 0.3, lz);
  lever.rotation.x = -0.6;
  group.add(lever);

  let rubbleT = -1;
  let leverT = -1;
  return {
    group,
    clearRubble(animate = true) {
      rubbleT = animate ? 0 : 1;
      if (!animate) rubble.visible = false;
    },
    pullLever(animate = true) {
      leverT = animate ? 0 : 1;
      if (!animate) lever.rotation.x = 0.6;
    },
    // 保存の状態どおりに戻す（はじめから、のときは瓦礫もレバーも元どおり）
    setState({ freed, pulled }) {
      rubbleT = -1;
      leverT = -1;
      rubble.visible = !freed;
      rubble.children.forEach((rock, i) => { rock.position.copy(rockHome[i]); });
      lever.rotation.x = pulled ? 0.6 : -0.6;
    },
    update(dt) {
      if (rubbleT >= 0 && rubbleT < 1) {
        rubbleT = Math.min(1, rubbleT + dt / 0.8);
        rubble.children.forEach((rock, i) => {
          rock.position.y -= dt * (1.2 + i * 0.2);
          rock.position.x += dt * 0.6;
        });
        if (rubbleT >= 1) rubble.visible = false;
      }
      if (leverT >= 0 && leverT < 1) {
        leverT = Math.min(1, leverT + dt / 0.5);
        lever.rotation.x = -0.6 + 1.2 * leverT;
        drum.rotation.x += dt * 4;
        gear.rotation.x += dt * 4;
      }
    },
  };
}

// ── 東の石垣と鉄の門（落とし格子。門衛所のレバーで巻き上がる）、門衛所へ延びる鎖 ──
function createEastGate(materials) {
  const group = new THREE.Group();
  const walls = [];
  const random = mulberry32(13);
  for (let z = -38; z < 48; z += 2) {
    if (z + 2 > GATE.z - GATE.halfWidth - 0.4 && z < GATE.z + GATE.halfWidth + 0.4) continue;
    const h = 1.6 + random() * 1.4;
    const y = groundHeight(GATE.x, z + 1);
    const piece = box(materials.stone, 0.9, h, 2, GATE.x, y + h / 2 - 0.2, z + 1);
    group.add(piece);
    walls.push(piece);
  }
  const groundY = heightAt(GATE.x, GATE.z);
  for (const side of [-1, 1]) {
    const pillar = box(materials.stone, 1.2, 4.4, 1.2, GATE.x, groundY + 2.2, GATE.z + side * (GATE.halfWidth + 0.6));
    group.add(pillar);
    walls.push(pillar);
  }
  group.add(box(materials.stone, 1.2, 0.8, GATE.halfWidth * 2 + 2.4, GATE.x, groundY + 4.2, GATE.z));

  const portcullis = new THREE.Group();
  const barGeometry = new THREE.BoxGeometry(0.08, 3.6, 0.08);
  for (let z = -GATE.halfWidth + 0.15; z <= GATE.halfWidth; z += 0.38) {
    const bar = new THREE.Mesh(barGeometry, materials.iron);
    bar.position.set(0, 1.8, z);
    bar.castShadow = true;
    portcullis.add(bar);
  }
  for (const y of [0.5, 1.8, 3.1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, GATE.halfWidth * 2), materials.iron);
    rail.position.y = y;
    portcullis.add(rail);
  }
  portcullis.position.set(GATE.x, groundY, GATE.z);
  group.add(portcullis);

  // 地面を這う錆びた鎖：門の柱から門衛所の東の壁まで
  const points = [];
  const from = new THREE.Vector2(GATE.x - 0.6, GATE.z - GATE.halfWidth - 0.6);
  const to = new THREE.Vector2(GATEHOUSE.x1 + 0.2, -24);
  const mid = new THREE.Vector2(14, -6);
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const p = new THREE.Vector2()
      .addScaledVector(from, (1 - t) * (1 - t)).addScaledVector(mid, 2 * t * (1 - t)).addScaledVector(to, t * t);
    points.push(new THREE.Vector3(p.x, groundHeight(p.x, p.y) + 0.08, p.y));
  }
  points[0].y += 1.8;
  points[points.length - 1].y += 1.1;
  const chain = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, 0.05, 5), materials.iron);
  chain.castShadow = true;
  group.add(chain);

  let openT = -1;
  return {
    group,
    walls,
    setOpen(open, animate = true) {
      if (!open) { openT = -1; portcullis.position.y = groundY; return; }
      openT = animate ? 0 : 1;
      if (!animate) portcullis.position.y = groundY + 3.7;
    },
    update(dt) {
      if (openT >= 0 && openT < 1) {
        openT = Math.min(1, openT + dt / 2.6);
        const eased = openT * openT * (3 - 2 * openT);
        portcullis.position.y = groundY + 3.7 * eased + Math.sin(openT * 40) * 0.015 * (1 - openT);
      }
    },
    opening: () => openT >= 0 && openT < 1,
  };
}

// ── 谷に架かる細い石橋（東）と、崩れた橋（門衛所の裏） ──
function createBridges(materials) {
  const group = new THREE.Group();
  for (let z = BRIDGE.z1; z > BRIDGE.z0; z -= 1) {
    const y = heightAt(BRIDGE.x, z - 0.5);
    group.add(box(materials.stone, BRIDGE.halfWidth * 2 + 0.4, 0.5, 1.05, BRIDGE.x, y - 0.25, z - 0.5));
    for (const side of [-1, 1]) group.add(box(materials.stone, 0.3, 0.55, 1.05, BRIDGE.x + side * (BRIDGE.halfWidth + 0.15), y + 0.27, z - 0.5));
  }
  for (const z of [-42, -46]) {
    const top = heightAt(BRIDGE.x, z);
    group.add(box(materials.stone, 2.4, top + 10, 1.6, BRIDGE.x, (top - 10) / 2, z));
  }
  // 崩れた橋：両岸の付け根だけが残り、谷底に破片
  for (const [z, dir] of [[RAVINE.south + 0.3, -1], [RAVINE.north - 0.3, 1]]) {
    const y = groundHeight(0, z);
    const stub = box(materials.stone, 3.2, 0.6, 3, 0, y - 0.3, z + dir * 1.4);
    stub.rotation.x = dir * 0.12;
    group.add(stub);
  }
  const random = mulberry32(17);
  for (let i = 0; i < 7; i++) {
    const piece = box(materials.stone, 1 + random() * 1.5, 0.5, 1 + random(), (random() - 0.5) * 5, -8.3, -44 + (random() - 0.5) * 4);
    piece.rotation.set(random() - 0.5, random() * 3, random() - 0.5);
    group.add(piece);
  }
  // 谷底の沢
  const water = new THREE.Mesh(new THREE.PlaneGeometry(140, 4), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -8.6, (RAVINE.north + RAVINE.south) / 2);
  group.add(water);
  return group;
}

// ── 西の沢：浅い流れ、飛び石、崩れたアーチ、小さな記念碑 ──
function createWestStream(materials) {
  const group = new THREE.Group();
  // 浅い流れ：南北に細長い水面を、地面の起伏に沿わせる
  const geometry = new THREE.PlaneGeometry(3.4, 46, 1, 46);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) - 33;
    const z = position.getZ(i) + 10;
    position.setXYZ(i, x, groundHeight(x, z) + 0.05, z);
  }
  geometry.computeVertexNormals();
  const water = new THREE.Mesh(geometry, materials.water);
  group.add(water);
  const random = mulberry32(31);
  for (let i = 0; i < 4; i++) {
    const z = 10.5 + i * 1.1;
    const stone = box(materials.stone, 0.9, 0.25, 0.8, -33.6 + i * 0.4, groundHeight(-33, z) + 0.1, z, random(), 1);
    group.add(stone);
  }
  // 崩れたアーチ：2本の柱と、尖頭アーチの石（右上が欠けている）
  const archY = groundHeight(-36, 3.5);
  for (const x of [-38.2, -33.8]) group.add(box(materials.stone, 1, 4.6, 1, x, archY + 2.3, 3.5));
  const shape = new THREE.Shape();
  shape.moveTo(-2.7, 0); shape.lineTo(-2.7, 1.2); shape.quadraticCurveTo(-2.5, 2.6, 0, 3.2);
  shape.quadraticCurveTo(1.2, 2.9, 1.6, 2.5); shape.lineTo(1.3, 1.6); shape.lineTo(2.7, 1.2); shape.lineTo(2.7, 0);
  const hole = new THREE.Path();
  hole.moveTo(-1.7, 0); hole.lineTo(-1.7, 0.9); hole.quadraticCurveTo(-1.5, 2.0, 0, 2.4);
  hole.quadraticCurveTo(1.5, 2.0, 1.7, 0.9); hole.lineTo(1.7, 0);
  shape.holes.push(hole);
  const arch = new THREE.Mesh(worldUV(new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false }), 2), materials.stone);
  arch.position.set(-36, archY + 4.6, 3.05);
  arch.castShadow = true;
  group.add(arch);
  // 記念碑
  const { x: mx, z: mz } = INTERACTABLES.memorial;
  const my = groundHeight(mx, mz);
  group.add(box(materials.stone, 0.8, 1.2, 0.35, mx - 0.5, my + 0.6, mz - 0.4, 0.3, 1));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 16, 1, false, 0, Math.PI), materials.stone);
  top.rotation.set(Math.PI / 2, 0.3, Math.PI / 2);
  top.position.set(mx - 0.5, my + 1.2, mz - 0.4);
  group.add(top);
  return group;
}

// 木漏れ日：上から斜めに差す、淡い光の板（加算）
function createLightShafts() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, 'rgba(255,255,240,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,240,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  const side = ctx.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 64, 256);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.16, fog: false });
  const group = new THREE.Group();
  const random = mulberry32(41);
  for (const [cx, cz, count] of [[0, 18, 4], [0, -4, 2], [2, 42, 2], [-36, 11, 2], [36, -10, 2]]) {
    for (let i = 0; i < count; i++) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + random() * 1.6, 16), material);
      shaft.position.set(cx + (random() - 0.5) * 10, heightAt(cx, cz) + 7, cz + (random() - 0.5) * 10);
      shaft.rotation.set(0.35, random() * Math.PI, 0.25);
      group.add(shaft);
    }
  }
  return group;
}

export async function createForest(scene, materials, { lite = false, load = loadGLTF } = {}) {
  const root = new THREE.Group();
  root.name = 'forest';
  scene.add(root);

  root.add(createGround(materials));
  const gatehouse = createGatehouse(materials);
  root.add(gatehouse.group);
  const winch = createWinch(materials);
  root.add(winch.group);
  const gate = createEastGate(materials);
  root.add(gate.group);
  root.add(createBridges(materials));
  root.add(createWestStream(materials));
  const shafts = createLightShafts();
  root.add(shafts);

  // カメラが埋まらないよう、線を遮る物（壁・柱・大木の幹）
  const occluders = [...gatehouse.walls, ...gate.walls];
  const trunkMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const addTrunk = (x, z, radius, height) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 6), trunkMaterial);
    trunk.position.set(x, heightAt(x, z) + height / 2, z);
    trunk.updateMatrixWorld();
    root.add(trunk);
    occluders.push(trunk);
  };
  addTrunk(-3, 13.5, 1.4, 10);

  // ── モデル ──
  const windTime = { value: 0 };
  const tryLoad = (path) => withFallback(load(asset(path)).then((gltf) => { measureModel(gltf.scene); return recolor(gltf.scene); }), () => null);
  const names = Object.keys(FOREST_MODELS);
  const loaded = await Promise.all(names.map((name) => tryLoad(FOREST_MODELS[name])));
  const models = Object.fromEntries(names.map((name, i) => [name, loaded[i]]));

  // 小さな草花は逆光で黒い粒に見えるので、法線を真上にして地面と同じように光を受ける
  for (const name of ['flower', 'grass', 'fern']) {
    models[name]?.traverse((part) => {
      if (!part.isMesh) return;
      part.geometry = part.geometry.clone();
      const normal = part.geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
      part.material.side = THREE.DoubleSide;
      part.material.userData.upNormal = true;
    });
  }

  const layout = placeForest({ lite });
  const byKind = (list, kind) => list.filter((spot) => spot.kind === kind);
  const treeWind = { time: windTime, amount: 0.035 };
  for (const kind of ['oak', 'detailed', 'plain', 'fat', 'pineTall', 'pine']) {
    // 影を落とすのは道の近くの木だけ（影の計算で森全体を描かないように）
    const trees = byKind(layout.trees, kind);
    root.add(instance(models[kind], trees.filter((t) => t.edge < 6), (t, size) => t.height / size.y, { wind: treeWind }));
    root.add(instance(models[kind], trees.filter((t) => t.edge >= 6), (t, size) => t.height / size.y, { wind: treeWind, shadow: false }));
    root.add(instance(models[kind], byKind(layout.skyline, kind), (t, size) => t.height / size.y, { shadow: false }));
  }
  for (const tree of layout.trees) if (tree.edge < 5) addTrunk(tree.x, tree.z, 0.45, 5);

  const propWind = { time: windTime, amount: 0.12 };
  const sizes = { fern: 1.4, bush: 1.6, bushDetailed: 1.2, grass: 0.9, rock: 1.4, rockTall: 2.4, mushrooms: 0.5, stump: 0.9, log: 2.6 };
  for (const kind of Object.keys(sizes)) {
    const small = kind === 'grass' || kind === 'fern';
    root.add(instance(models[kind], byKind(layout.props, kind), (p, size) => (sizes[kind] * p.size) / Math.max(size.x, size.y, size.z), { shadow: !small, receive: !small, wind: propWind }));
  }

  // 広場の大木
  root.add(instance(models.oak, [{ x: -3, z: 13.5, turn: 0.6 }], (t, size) => 19 / size.y, { wind: { time: windTime, amount: 0.02 } }));
  // 白い花の小さな群生（調べられる）
  const random = mulberry32(53);
  const flowers = [];
  const { x: fx, z: fz } = INTERACTABLES.flowers;
  for (let i = 0; i < 18; i++) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * 1.4;
    flowers.push({ x: fx + Math.cos(a) * r, z: fz + Math.sin(a) * r, turn: random() * 6.28, size: 0.8 + random() * 0.5 });
  }
  // 小さな草花は自分の影で真っ黒にならないよう、影を受けない
  root.add(instance(models.flower, flowers, (p, size) => (0.45 * p.size) / size.y, { shadow: false, receive: false, wind: propWind }));
  // 門衛所と石垣の蔦
  const ivy = [];
  for (let x = GATEHOUSE.x0 + 0.6; x < GATEHOUSE.x1; x += 1.1) {
    if (random() < 0.4) continue;
    // 蔦は壁の上から垂れ下がる（モデルを上下逆さにして、壁の外側に沿わせる）
    ivy.push({ x, z: GATEHOUSE.z1 + 0.15, y: heightAt(0, -24) + 3.8, turn: 0, tilt: Math.PI, size: 1 });
    ivy.push({ x, z: GATEHOUSE.z0 - 0.15, y: heightAt(0, -24) + 3.8, turn: Math.PI, tilt: Math.PI, size: 1 });
  }
  for (let z = -36; z < 46; z += 2.5) {
    if (random() < 0.5 || Math.abs(z - GATE.z) < 4) continue;
    ivy.push({ x: GATE.x - 0.55, z, y: groundHeight(GATE.x, z) + 2.2, turn: -Math.PI / 2, tilt: Math.PI, size: 1 });
  }
  root.add(instance(models.moss, ivy, (p, size) => 2.2 / size.y, { shadow: false, wind: propWind }));

  return {
    root,
    occluders,
    gate,
    winch,
    update(time, dt) {
      windTime.value = time;
      gate.update(dt);
      winch.update(dt);
    },
  };
}

