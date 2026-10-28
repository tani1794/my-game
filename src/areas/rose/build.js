// 白薔薇の迷宮橋の見た目。遊べる床・仕掛け・敵の場所は layout.js のまま、まわりを地形と石造りで組み立てる。
// 下から：森に覆われた谷底と沢 → 斜面と岩肌 → 段丘・丘・城の高台（terrain.js）→ 擁壁と基礎 → 橋・塔・城。
// 本橋は入口の丘の橋台に埋め込み、橋脚は谷底まで下ろす。崩れた先は折れた橋脚と、谷底に落ちた瓦礫で見せる。
// 下層通路はアーチで支えた水道橋、巻き上げ機室は谷底から立ち上がる橋脚の塔の中、昇降橋は塔の踊り場から門前の丘へ。
import * as THREE from 'three';
import { loadGLTF } from '../../assets.js';
import { mulberry32 } from '../../world/random.js';
import { worldUV } from '../../chapter/materials.js';
import { floorMesh, wallMesh } from '../kitView.js';
import { createEchoStone, landmarkMaterial, createRoseBushes, waterPlane, cliffMaterial } from '../props.js';
import { ROSE, ROSE_HEIGHTS } from './layout.js';
import { roseTerrainHeight } from './terrain.js';
import { buildRoseTerrain } from './terrainView.js';
import { createBatch, archBridge, brokenPier, wall, roundTower, squareTower, archOpening, rubble } from './architecture.js';
import { buildCastle } from './castle.js';

const { GARDEN_Y, LOW_Y } = ROSE_HEIGHTS;
const groundAt = roseTerrainHeight;
// 巻き上げ機室と階段を囲む橋脚の塔（外壁の位置）
export const ROSE_TOWER = { x0: 20, x1: 46, z0: -14, z1: 19.5, roof: 3.6 };

function box(material, w, h, d, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), 2), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 王冠の紋章（石碑と旗に使う）：線で描いた画像
function crownTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(56, 150); ctx.lineTo(70, 82); ctx.lineTo(102, 120); ctx.lineTo(128, 66); ctx.lineTo(154, 120); ctx.lineTo(186, 82); ctx.lineTo(200, 150); ctx.closePath();
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(56, 172); ctx.lineTo(200, 172); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(128, 40); ctx.lineTo(128, 226); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(104, 196); ctx.lineTo(152, 196); ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 道・階段の見た目：勾配のある区間は段（主人公の膝ほどの高さ）にし、どの段も下を地面まで石で埋める
function stepsFor(batch, material, floor, { minDepth = 1, bottom = null } = {}) {
  for (let i = 0; i < floor.points.length - 1; i++) {
    const [ax, az, ay] = floor.points[i];
    const [bx, bz, by] = floor.points[i + 1];
    const flat = Math.hypot(bx - ax, bz - az);
    const ry = Math.atan2(bx - ax, bz - az);
    const rise = by - ay;
    const sloped = Math.abs(rise) > 0.3;
    const count = sloped ? Math.max(2, Math.round(Math.abs(rise) / 0.28)) : Math.max(1, Math.round(flat / 3));
    for (let k = 0; k < count; k++) {
      const tm = (k + 0.5) / count;
      const x = ax + (bx - ax) * tm;
      const z = az + (bz - az) * tm;
      // 段の上面は、その段の区間の高い方の端（坂の高さより少し上にならないよう、中央との差は半段まで）
      const top = ay + rise * (sloped ? (rise > 0 ? (k + 1) / count : k / count) : tm) - 0.02;
      const ground = bottom ?? Math.min(groundAt(x, z), top - minDepth);
      const h = top - ground + 0.4;
      batch.box(material, floor.width, h, flat / count + 0.04, [x, top - h / 2, z], [0, ry, 0]);
    }
  }
}

export async function buildRose(scene, materials, { lite = false, load = loadGLTF } = {}) {
  const root = new THREE.Group();
  root.name = 'area-rose';
  scene.add(root);
  const { level } = ROSE;
  const occluders = [];
  const keep = (mesh) => { root.add(mesh); occluders.push(mesh); return mesh; };
  const random = mulberry32(101);
  const owned = new Set();
  const own = (m) => { owned.add(m); return m; };
  // 見えないカメラ用の壁（形は石の束でまとめて描くので、当たりだけ別に持つ）
  const blocker = (w, h, d, x, y, z, ry = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.visible = false;
    mesh.updateMatrixWorld(true);
    return keep(mesh);
  };

  // ── 材質：湿った灰色の石（建物ごとに模様の大きさは同じ）、芝、生け垣、暗い開口 ──
  const paving = own(materials.chapelStone.clone());
  paving.color.set('#b9bbb8');
  const masonry = own(materials.stone.clone());
  masonry.color.set('#a3a49f');
  const lawn = own(materials.stone.clone());
  lawn.color.set('#7d8a69');
  // 生け垣：葉の粒の模様（明るい葉と影の葉）
  const leafMap = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4d6a43';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const light = random();
      ctx.fillStyle = light > 0.6 ? '#7d9a69' : light > 0.3 ? '#5e7d51' : '#2f4329';
      ctx.beginPath();
      ctx.ellipse(random() * 128, random() * 128, 2 + random() * 3, 1.2 + random() * 2, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  const hedgeMaterial = own(new THREE.MeshStandardMaterial({ map: leafMap, color: '#c9d4bf', roughness: 1 }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#0e1013', roughness: 1 }));
  const castleStone = own(landmarkMaterial(materials.chapelStone, 0.55));
  castleStone.color.set('#a9aaa6');
  const castleRoof = own(landmarkMaterial(materials.slate, 0.55));
  castleRoof.side = THREE.FrontSide;
  const farStone = own(landmarkMaterial(materials.stone, 0.35));
  farStone.color.set('#8d908c');
  const near = createBatch();
  const far = createBatch();

  // ── 1．地形・沢・霧・樹林・岩（橋や建物の足もとには木を生やさない） ──
  const keepOut = [
    { x0: -9, x1: 9, z0: -50, z1: 44, top: -1.5 },         // 本橋とその先（崩れた橋脚）
    { x0: -57, x1: 28, z0: -10, z1: 2, top: LOW_Y - 1.5 }, // 水道橋（下層通路）
    { x0: 16, x1: 54, z0: -18, z1: 34 },                    // 橋脚の塔と踊り場
    { x0: 47, x1: 78, z0: 19, z1: 31, top: -2 },            // 昇降橋の下
    { x0: -50, x1: 50, z0: -116, z1: -46 },                 // 城の敷地
  ];
  const terrain = await buildRoseTerrain(root, materials, { lite, keepOut, load });

  // ── 2．地面に乗る床：石畳と芝（地形にぴったり乗る、厚みのある台） ──
  for (const id of ['entry', 'arbor', 'gardenPath', 'arborPath', 'oathPlaza', 'caveMouth', 'garden']) {
    const floor = level.floors.find((f) => f.id === id);
    root.add(floorMesh(floor, id === 'garden' || id === 'arbor' ? lawn : paving, 1.4));
  }
  // 階段と道（段にして、下は地面まで石で埋める）
  for (const id of ['westLanding', 'westStairs', 'shortcut']) stepsFor(near, paving, level.floors.find((f) => f.id === id));
  // 庭園から下層への排水の階段（坂の四角）：段にする
  {
    const f = level.floors.find((fl) => fl.id === 'drainStairs');
    const count = 18;
    for (let k = 0; k < count; k++) {
      const z = f.z0 + ((k + 0.5) / count) * (f.z1 - f.z0);
      const top = f.y + ((k + 1) / count) * (f.toY - f.y) - 0.02;
      near.box(paving, f.x1 - f.x0, top - LOW_Y + 1.6, (f.z1 - f.z0) / count + 0.04, [(f.x0 + f.x1) / 2, (top + LOW_Y - 1.6) / 2, z]);
    }
    wall(near, masonry, [f.x0 - 0.4, -6], [f.x0 - 0.4, f.z1 + 0.4], { base: LOW_Y - 1.6, height: 6.9, thickness: 0.8 });
    wall(near, masonry, [f.x1 + 0.4, f.z0], [f.x1 + 0.4, f.z1 + 0.4], { base: LOW_Y - 1.6, height: 6.9, thickness: 0.8 });
    // 階段の下の踊り場
    root.add(floorMesh(level.floors.find((fl) => fl.id === 'drainLanding'), paving, 1.6));
  }

  // ── 3．本橋：入口の丘の橋台に埋め込んだ石のアーチ橋。崩れた先は折れた橋脚と谷底の瓦礫 ──
  const mainBridge = archBridge(near, paving, {
    from: [0, 42.2], to: [0, 0], y: 0, width: 9, deck: 1.3, rise: 0.75,
    piers: [9.2, 17.7], brokenAt: 18.2, groundAt, random,
  });
  // 橋台：橋の根元を丘の岩盤へ埋める大きな石の台
  near.box(masonry, 14, 14, 8, [0, -7.3, 44.5]);
  near.box(masonry, 16, 3, 10, [0, -14, 45]);
  // 向こう岸（城の高台の縁）から延びる橋の残り
  archBridge(near, paving, { from: [0, -48], to: [0, 0], y: 0, width: 9, deck: 1.3, rise: 0.75, piers: [7, 14], brokenAt: 15.5, groundAt, random });
  near.box(masonry, 14, 10, 6, [0, -6.2, -49.5]);
  // 中ほどの折れた橋脚（だんだん低く）
  brokenPier(near, paving, { x: 0, z: 14, top: -9, width: 9, ry: mainBridge.ry, groundAt, random });
  brokenPier(near, paving, { x: 0, z: 3, top: -16, width: 9, ry: mainBridge.ry, groundAt, random });
  brokenPier(near, paving, { x: 0, z: -8, top: -6, width: 9, ry: mainBridge.ry, groundAt, random });
  // 谷底に落ちた橋桁と石（宙には残さない）
  for (const [x, z, count] of [[2, 18, 18], [-3, 8, 22], [3, -2, 16], [-2, -14, 14]]) rubble(near, paving, { x, z, radius: 5, count, groundAt, random });
  for (const [x, z, ry] of [[4, 10, 0.4], [-5, -4, -0.6]]) near.box(paving, 9, 1.3, 7, [x, groundAt(x, z) + 0.4, z], [0.18, ry, 0.12]);

  // ── 4．下層通路：アーチで支えた水道橋。上は側壁と屋根の回廊（排水の階段の所は開ける） ──
  archBridge(near, masonry, {
    from: [-55, -4], to: [26, -4], y: LOW_Y, width: 4.6, deck: 1.4, rise: 0.8, parapet: false,
    piers: [15, 27, 37, 47, 57, 67, 77], groundAt, random,
  });
  wall(near, masonry, [20, -6.05], [-55, -6.05], { base: LOW_Y, height: 4.6, thickness: 0.6, coping: false, buttress: 7 });
  wall(near, masonry, [-47.6, -1.95], [20, -1.95], { base: LOW_Y, height: 4.6, thickness: 0.6, coping: false, buttress: 7 });
  wall(near, masonry, [-55, -1.7], [-55, -6.3], { base: LOW_Y, height: 4.6, thickness: 0.6, coping: false });
  near.box(masonry, 75.5, 0.6, 5.2, [-17.5, LOW_Y + 4.9, -4]);
  wall(near, masonry, [-55, -6.6], [20, -6.6], { base: LOW_Y + 4.6, height: 0.5, thickness: 0.5 });
  wall(near, masonry, [-55, -1.4], [20, -1.4], { base: LOW_Y + 4.6, height: 0.5, thickness: 0.5 });
  blocker(75, 4.6, 0.6, -17.5, LOW_Y + 2.3, -6.05);
  blocker(67.6, 4.6, 0.6, -13.8, LOW_Y + 2.3, -1.95);
  blocker(75.5, 0.6, 5.2, -17.5, LOW_Y + 4.9, -4);
  // 回廊の明かり取り（小さな尖頭窓）
  for (let x = -40; x < 18; x += 9) archOpening(near, masonry, dark, { w: 0.7, h: 1.4, depth: 0.3 }, [x, LOW_Y + 1.8, -1.68], 0);
  const tunnelWater = waterPlane(materials.water, 75, 3.6);
  tunnelWater.position.set(-13.5, LOW_Y + 0.9, -4);
  root.add(tunnelWater);
  const lanterns = [];
  const lampMaterial = own(new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
  for (let x = -44; x < 22; x += 11) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lampMaterial);
    lamp.position.set(x, LOW_Y + 2.8, -2.4);
    root.add(lamp);
    lanterns.push(lamp);
  }
  const tunnelLight = new THREE.PointLight('#ffd9a0', 6, 22, 1.6);
  tunnelLight.position.set(-14, LOW_Y + 3, -4);
  root.add(tunnelLight);

  // ── 5．橋脚の塔：谷底から立ち上がり、中に巻き上げ機室と階段。上に胸壁、壁に窓と控え壁 ──
  const T = ROSE_TOWER;
  const towerBase = Math.min(groundAt(T.x0, T.z0), groundAt(T.x1, T.z1), groundAt(T.x0, T.z1), groundAt(T.x1, T.z0)) - 1.5;
  const towerTop = T.roof + 1;
  // 外壁（控え壁は外側へ）。from → to の左手が外
  const towerWall = (from, to, base = towerBase, top = towerTop, crenels = true) => {
    wall(near, masonry, from, to, { base, height: top - base, thickness: 1.4, crenels, buttress: 7 });
    const [ax, az] = from;
    const [bx, bz] = to;
    blocker(Math.hypot(bx - ax, bz - az), top - base, 1.4, (ax + bx) / 2, (base + top) / 2, (az + bz) / 2, -Math.atan2(bz - az, bx - ax));
  };
  towerWall([T.x0, -1.4], [T.x0, T.z1]);
  towerWall([T.x0, T.z0], [T.x0, -6.6]);
  towerWall([T.x0, -6.6], [T.x0, -1.4], LOW_Y + 4.6);
  towerWall([T.x0, -6.6], [T.x0, -1.4], towerBase, LOW_Y - 1.4, false);
  towerWall([T.x1, T.z0], [T.x0, T.z0]);
  towerWall([T.x1, T.z1], [T.x1, T.z0]);
  towerWall([43.8, T.z1], [T.x1, T.z1]);
  towerWall([T.x0, T.z1], [40.2, T.z1]);
  towerWall([40.2, T.z1], [43.8, T.z1], 3.4, towerTop, true);
  // 塔の中の床（巻き上げ機室の高さ）と屋根
  near.box(masonry, T.x1 - T.x0, 1.2, T.z1 - T.z0, [(T.x0 + T.x1) / 2, LOW_Y - 0.6, (T.z0 + T.z1) / 2]);
  near.box(masonry, T.x1 - T.x0 + 1.4, 0.8, T.z1 - T.z0 + 1.4, [(T.x0 + T.x1) / 2, T.roof + 0.4, (T.z0 + T.z1) / 2]);
  blocker(T.x1 - T.x0 + 1.4, 0.8, T.z1 - T.z0 + 1.4, (T.x0 + T.x1) / 2, T.roof + 0.4, (T.z0 + T.z1) / 2);
  // 窓（階の高さに合わせて、南と東の面に）
  for (const x of [25, 31, 37]) archOpening(near, masonry, dark, { w: 1.1, h: 2.4, depth: 0.7 }, [x, -2.2, T.z1 + 0.72], 0);
  for (const z of [-8, 0, 8]) archOpening(near, masonry, dark, { w: 1.1, h: 2.4, depth: 0.7 }, [T.x1 + 0.72, -2.2, z], Math.PI / 2);
  for (const z of [-8, 2]) archOpening(near, masonry, dark, { w: 1.1, h: 2.4, depth: 0.7 }, [T.x1 + 0.72, -16, z], Math.PI / 2);
  // 階段（段にして、下は塔の中の床まで石で埋める）と、巻き上げ機室の床
  stepsFor(near, paving, level.floors.find((f) => f.id === 'machineStairs'), { bottom: LOW_Y - 0.6 });
  root.add(floorMesh(level.floors.find((f) => f.id === 'machine'), paving, 0.6));
  const stairLight = new THREE.PointLight('#ffcf90', 5, 20, 1.6);
  stairLight.position.set(36, -1.5, 10);
  root.add(stairLight);
  // 踊り場：塔に寄り添う砦（下は谷底まで石で埋める）。縁に欄干（昇降橋と塔の扉の所は空ける）
  const landing = level.floors.find((f) => f.id === 'landing');
  const landingBase = Math.min(groundAt(landing.x0, landing.z0), groundAt(landing.x1, landing.z1)) - 1.5;
  near.box(masonry, landing.x1 - landing.x0 + 0.4, -landingBase, landing.z1 - landing.z0 + 0.4, [(landing.x0 + landing.x1) / 2, landingBase / 2 - 0.02, (landing.z0 + landing.z1) / 2]);
  near.box(paving, landing.x1 - landing.x0, 0.2, landing.z1 - landing.z0, [(landing.x0 + landing.x1) / 2, -0.1, (landing.z0 + landing.z1) / 2]);
  const parapet = (from, to, base = 0) => wall(near, masonry, from, to, { base, height: 1, thickness: 0.55 });
  parapet([landing.x0 - 0.3, landing.z1 + 0.3], [landing.x1 + 0.3, landing.z1 + 0.3]);
  parapet([landing.x0 - 0.3, landing.z0 - 0.3], [landing.x0 - 0.3, landing.z1 + 0.3]);
  parapet([landing.x1 + 0.3, landing.z1 + 0.3], [landing.x1 + 0.3, 27.3]);
  parapet([landing.x1 + 0.3, 22.7], [landing.x1 + 0.3, landing.z0 - 0.3]);
  parapet([landing.x1 + 0.3, landing.z0 - 0.3], [46, landing.z0 - 0.3]);

  // ── 6．入口の丘：縁の欄干と擁壁、橋台、南の古い門（礼拝堂への道。閉ざされている） ──
  const entry = level.floors.find((f) => f.id === 'entry');
  parapet([-7.6, entry.z0 - 0.3], [-4.6, entry.z0 - 0.3]);
  parapet([4.6, entry.z0 - 0.3], [entry.x1 + 0.3, entry.z0 - 0.3]);
  parapet([entry.x1 + 0.3, entry.z0 - 0.3], [entry.x1 + 0.3, entry.z1 + 0.3]);
  parapet([entry.x0 - 0.3, 46], [entry.x0 - 0.3, 50.3]);
  parapet([entry.x0 - 0.3, 53.7], [entry.x0 - 0.3, entry.z1 + 0.3]);
  wall(near, masonry, [-4.6, 40.2], [-16, 40.2], { base: -9, height: 8.6, thickness: 1.4, coping: false, buttress: 6 });
  wall(near, masonry, [20, 40.2], [4.6, 40.2], { base: -9, height: 8.6, thickness: 1.4, coping: false, buttress: 6 });
  squareTower(near, masonry, castleRoof, { x: -6.5, z: 62.8, width: 3, height: 7, roof: 'none' });
  squareTower(near, masonry, castleRoof, { x: 6.5, z: 62.8, width: 3, height: 7, roof: 'none' });
  parapet([-5, 62.3], [-10.3, 62.3]);
  parapet([5, 62.3], [10.3, 62.3]);
  for (let i = -8; i <= 8; i++) near.box(materials.iron, 0.09, 3.2, 0.09, [i * 0.55, 1.6, 62.6]);
  near.box(materials.iron, 9.4, 0.12, 0.12, [0, 3.1, 62.6]);
  near.box(masonry, 10, 1.2, 1.6, [0, 6.6, 62.8]);
  parapet([-10, 50.3], [-18, 50.3]);
  parapet([-10, 53.7], [-18, 53.7]);

  // ── 7．庭園の段丘：縁の低い石壁（笠石）、北の擁壁、生け垣の石の台、崩れたアーチ ──
  const garden = level.floors.find((f) => f.id === 'garden');
  const gy = GARDEN_Y;
  parapet([garden.x0 - 0.3, garden.z1 + 0.3], [-35.7, garden.z1 + 0.3], gy);
  parapet([-32.3, garden.z1 + 0.3], [garden.x1 + 0.3, garden.z1 + 0.3], gy);
  parapet([garden.x0 - 0.3, garden.z0 - 0.3], [garden.x0 - 0.3, garden.z1 + 0.3], gy);
  parapet([garden.x1 + 0.3, garden.z0 - 0.3], [garden.x1 + 0.3, 23.4], gy);
  parapet([garden.x1 + 0.3, 26.6], [garden.x1 + 0.3, garden.z1 + 0.3], gy);
  parapet([-47.6, garden.z0 - 0.3], [garden.x1 + 0.3, garden.z0 - 0.3], gy);
  wall(near, masonry, [-55.4, -0.6], [-64, -0.6], { base: gy - 7, height: 7, thickness: 1.4, buttress: 5 });
  wall(near, masonry, [-18, -0.6], [-46.6, -0.6], { base: gy - 7, height: 7, thickness: 1.4, buttress: 6 });
  for (const w of level.wallBoxes) {
    if (Math.abs(w.y0 - GARDEN_Y) > 0.01) continue;
    near.box(masonry, w.hx * 2 + 0.3, 0.45, w.hz * 2 + 0.3, [w.x, w.y0 + 0.22, w.z], [0, w.angle, 0]);
  }
  // 崩れたアーチ（庭園の角と、あずまやへの道）
  for (const [x, z, ry] of [[-52.5, 32.5, 0.8], [-24, 6.5, -0.5], [-44, 46.2, 0]]) {
    near.box(masonry, 0.8, 3.6, 0.8, [x - Math.cos(ry) * 1.8, gy + 1.8, z + Math.sin(ry) * 1.8], [0, ry, 0]);
    near.box(masonry, 0.8, 2.4, 0.8, [x + Math.cos(ry) * 1.8, gy + 1.2, z - Math.sin(ry) * 1.8], [0, ry, 0]);
    // 折れたアーチの上の石：高い柱の上にだけ載り、少し張り出して途切れる（宙に浮かせない）
    near.box(masonry, 1.8, 0.6, 0.9, [x - Math.cos(ry) * 1.4, gy + 3.9, z + Math.sin(ry) * 1.4], [0, ry, 0]);
    rubble(near, masonry, { x: x + Math.cos(ry) * 2, z: z - Math.sin(ry) * 2, radius: 1.2, count: 5, groundAt: () => gy, random });
  }
  // 生け垣（歩けない壁）は葉、巻き上げ機室の壁は石。生け垣の上は丸く刈り込む
  for (const w of level.wallBoxes) {
    const isHedge = Math.abs(w.y0 - GARDEN_Y) < 0.01;
    const mesh = wallMesh(w, isHedge ? hedgeMaterial : masonry, isHedge ? 1.5 : 2);
    if (!isHedge) { keep(mesh); continue; }
    root.add(mesh);
    const top = new THREE.Mesh(worldUV(new THREE.CylinderGeometry(w.hz, w.hz, w.hx * 2, 10, 1, false, 0, Math.PI), 1.5), hedgeMaterial);
    // 円柱の軸を寝かせて生け垣の向きへ、丸い側を上に
    top.rotation.set(0, w.angle, Math.PI / 2, 'YZX');
    top.position.set(w.x, w.y1 - 0.02, w.z);
    top.castShadow = true;
    root.add(top);
  }
  keep(box(masonry, 14.8, 0.6, 16.8, 29, LOW_Y + 4.6, -4)); // 巻き上げ機室の天井

  // ── 8．誓剣の門前：縁の欄干（昇降橋と洞窟の所は空ける）、擁壁、昇降橋の橋台 ──
  const oath = level.floors.find((f) => f.id === 'oathPlaza');
  parapet([oath.x0 - 0.3, oath.z0 - 0.3], [oath.x0 - 0.3, 22.7]);
  parapet([oath.x0 - 0.3, 27.3], [oath.x0 - 0.3, oath.z1 + 0.3]);
  parapet([oath.x0 - 0.3, oath.z1 + 0.3], [oath.x1 + 0.3, oath.z1 + 0.3]);
  parapet([oath.x1 + 0.3, oath.z0 - 0.3], [oath.x1 + 0.3, oath.z1 + 0.3]);
  parapet([oath.x0 - 0.3, oath.z0 - 0.3], [89.6, oath.z0 - 0.3]);
  parapet([94.4, oath.z0 - 0.3], [oath.x1 + 0.3, oath.z0 - 0.3]);
  wall(near, masonry, [73.6, 10], [73.6, 40], { base: -10, height: 9.6, thickness: 1.4, coping: false, buttress: 6 });
  near.box(masonry, 3, 10, 9, [74.6, -5.2, 25]);

  // ── 昇降橋：踊り場の東の縁を軸に、上がった状態から降りる。塔の柱から鎖で吊る ──
  const lift = new THREE.Group();
  lift.add(box(materials.wood, 25, 0.5, 4, 12.5, -0.25, 0));
  for (let x = 1; x < 25; x += 2) lift.add(box(materials.iron, 0.12, 0.08, 4.1, x, 0.03, 0));
  for (const side of [-1, 1]) lift.add(box(materials.iron, 25, 0.12, 0.12, 12.5, 0.6, side * 1.9));
  lift.position.set(50, 0, 25);
  lift.rotation.z = 1.25;
  root.add(lift);
  // 回転軸と、鎖を吊る石の柱（固定の柱は動く部分の下に置かない）
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 5, 12), materials.iron);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(50, -0.3, 25);
  root.add(axle);
  for (const side of [-1, 1]) {
    keep(box(masonry, 1.6, 9, 1.6, 50.6, 4.5, 25 + side * 3));
    near.box(masonry, 2, 0.5, 2, [50.6, 9.25, 25 + side * 3]);
  }
  const up = new THREE.Vector3(0, 1, 0);
  const span = new THREE.Vector3();
  const stretch = (mesh, a, b) => {
    span.subVectors(b, a);
    mesh.position.copy(a).addScaledVector(span, 0.5);
    mesh.scale.set(1, span.length(), 1);
    mesh.quaternion.setFromUnitVectors(up, span.normalize());
  };
  const chains = [-1, 1].map((side) => {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), materials.iron);
    root.add(chain);
    return { chain, side };
  });
  function placeChains() {
    const a = lift.rotation.z;
    for (const { chain, side } of chains) {
      stretch(chain, new THREE.Vector3(50.6, 9.2, 25 + side * 1.9), new THREE.Vector3(50 + Math.cos(a) * 24, Math.sin(a) * 24 + 0.4, 25 + side * 1.9));
    }
  }
  const liftLever = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), materials.iron);
  liftLever.position.set(47, 0.6, 22.5);
  liftLever.rotation.x = -0.6;
  root.add(liftLever, box(materials.iron, 0.6, 0.4, 0.6, 47, 0.2, 22.5));

  // ── 庭園の仕掛け：噴水、水路、水門、像、近道の鉄柵、残響の碑 ──
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.8, 24), materials.chapelStone);
  fountain.position.set(-42, GARDEN_Y + 0.4, 19);
  root.add(fountain);
  const fountainWater = waterPlane(materials.water, 2.4, 2.4);
  fountainWater.position.set(-42, GARDEN_Y + 0.7, 19);
  root.add(fountainWater);
  const channels = [];
  for (const [x0, z0, x1, z1] of [[-53, 13, -23, 13], [-53, 25, -38, 25], [-31, 31, -23, 31]]) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    root.add(box(materials.stone, length, 0.1, 0.8, (x0 + x1) / 2, GARDEN_Y + 0.02, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0)));
    const water = waterPlane(materials.water, length, 0.7);
    water.position.set((x0 + x1) / 2, GARDEN_Y + 0.08, (z0 + z1) / 2);
    water.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    water.scale.y = 0.001;
    water.visible = false;
    root.add(water);
    channels.push(water);
  }
  root.add(box(materials.iron, 2, 2.2, 0.3, -50, GARDEN_Y + 1.1, 5.6));
  const waterLever = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), materials.iron);
  waterLever.position.set(-49, GARDEN_Y + 1, 6.4);
  waterLever.rotation.x = -0.6;
  root.add(waterLever);
  const statue = new THREE.Group();
  statue.add(box(materials.chapelStone, 1.2, 1.2, 1.2, 0, 0.6, 0), box(materials.chapelStone, 0.6, 1.8, 0.5, 0, 2.1, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), materials.chapelStone);
  head.position.y = 3.2;
  statue.add(head);
  statue.position.set(-50, GARDEN_Y, 56);
  root.add(statue);
  const shortcutBars = new THREE.Group();
  for (let z = -1.5; z <= 1.5; z += 0.35) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.6, 0.07), materials.iron);
    bar.position.set(0, 1.3, z);
    shortcutBars.add(bar);
  }
  shortcutBars.position.set(-20, GARDEN_Y, 25);
  root.add(shortcutBars);
  const landmark = own(landmarkMaterial(materials.chapelStone));
  const gardenStone = createEchoStone(materials, landmark);
  gardenStone.group.position.set(-28, GARDEN_Y, 31);
  root.add(gardenStone.group);

  // ── 巻き上げ機室：巻き胴と鎖、留め具 ──
  const winch = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 18), materials.wood);
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 1.4;
  winch.add(drum, box(materials.wood, 0.3, 2.2, 1.6, -1.45, 1.1, 0), box(materials.wood, 0.3, 2.2, 1.6, 1.45, 1.1, 0));
  const clamp = box(materials.iron, 0.5, 0.9, 0.4, 1.1, 1.6, 0.85);
  winch.add(clamp);
  winch.position.set(31, LOW_Y, -9);
  root.add(winch);
  // 巻き胴から、天井の穴を通って塔の上の柱へ（昇降橋とつながっていることが分かるように）
  const winchChain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), materials.iron);
  stretch(winchChain, new THREE.Vector3(31, LOW_Y + 2, -9), new THREE.Vector3(50.6, 9, 22));
  root.add(winchChain);
  const machineLight = new THREE.PointLight('#ffcf90', 8, 18, 1.6);
  machineLight.position.set(28, LOW_Y + 3.5, -4);
  root.add(machineLight);

  // ── 誓剣の門前：王冠の石碑、残響の碑、洞窟の入口（岩山に開いた口） ──
  const stele = new THREE.Group();
  stele.add(box(materials.chapelStone, 2.4, 3.4, 0.8, 0, 1.7, 0));
  const crownMap = crownTexture();
  const crownMaterial = own(new THREE.MeshBasicMaterial({ map: crownMap, transparent: true, color: '#8fd8ff', opacity: 0.35, depthWrite: false }));
  const crown = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), crownMaterial);
  crown.position.set(0, 2.2, 0.41);
  stele.add(crown);
  stele.position.set(88, 0, 24);
  root.add(stele);
  const oathStone = createEchoStone(materials, landmark);
  oathStone.group.position.set(82, 0, 31);
  root.add(oathStone.group);
  for (const [x, y, z, s] of [[87.5, 3, -2, 4.2], [96.5, 3, -2, 4.2], [92, 7.5, -3, 5.2], [92, 6, -8, 6], [86, 1.6, 2, 2.4], [98, 1.6, 2, 2.4]]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), cliffMaterial);
    rock.position.set(x, y, z);
    rock.rotation.set(random(), random(), random());
    rock.castShadow = true;
    root.add(rock);
    occluders.push(rock);
  }
  const caveDark = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), dark);
  caveDark.position.set(92, 3, -7.2);
  root.add(caveDark);

  // ── 9．城（城の高台の上）と、遠景の廃墟（丘の上の廃塔・古い城壁・谷向こうの廃城） ──
  const castle = buildCastle(far, root, { stone: castleStone, roof: castleRoof, dark, iron: materials.iron }, { groundAt, random });
  const onHill = (x, z) => groundAt(x, z) - 0.5;
  roundTower(far, farStone, castleRoof, { x: -138, z: 52, base: onHill(-138, 52), radius: 3.2, height: 16, broken: true });
  rubble(far, farStone, { x: -134, z: 55, radius: 5, count: 12, groundAt, random });
  squareTower(far, farStone, castleRoof, { x: 152, z: -24, base: onHill(152, -24), width: 6, height: 19, roof: 'none' });
  // 西の丘の古い城壁（稜線に沿って、ところどころ途切れる）
  const ridge = [[-150, -70], [-128, -96], [-104, -118], [-80, -132], [-54, -144]];
  for (let i = 0; i < ridge.length - 1; i++) {
    if (i === 2) continue;
    const [ax, az] = ridge[i];
    const [bx, bz] = ridge[i + 1];
    const base = Math.min(onHill(ax, az), onHill(bx, bz));
    wall(far, farStone, [ax, az], [bx, bz], { base, height: 7 + Math.max(onHill(ax, az), onHill(bx, bz)) - base, thickness: 1.8, crenels: true });
    roundTower(far, farStone, castleRoof, { x: bx, z: bz, base: onHill(bx, bz), radius: 2.4, height: 10, broken: i === 1 });
  }
  // 谷向こう（北東）の廃城：形だけ（霧に沈む）
  const ruinX = 175;
  const ruinZ = -175;
  const ruinBase = onHill(ruinX, ruinZ);
  wall(far, farStone, [ruinX - 24, ruinZ + 10], [ruinX + 24, ruinZ + 10], { base: ruinBase, height: 12, thickness: 3, crenels: true });
  for (const [dx, h, broken] of [[-24, 22, false], [24, 15, true], [-6, 34, false], [10, 26, false]]) {
    roundTower(far, farStone, castleRoof, { x: ruinX + dx, z: ruinZ + (dx === -6 || dx === 10 ? -6 : 10), base: ruinBase, radius: dx === -6 ? 4.6 : 3.4, height: h, broken });
  }

  // ── 10．白薔薇：まとまって咲く所（入口と出口、庭園の曲がり角、壁の上、碑のまわり、古い門）と、石肌の見える所を分ける ──
  const roses = await createRoseBushes(load, lite);
  const roseSpots = [];
  const cluster = (cx, cz, y, count, spread = 1.4) => {
    for (let i = 0; i < count; i++) roseSpots.push({ x: cx + (random() - 0.5) * spread * 2, y, z: cz + (random() - 0.5) * spread * 2, scale: 0.75 + random() * 0.5 });
  };
  // 生け垣の上：端と曲がり角の近くにだけ
  for (const w of level.wallBoxes) {
    if (Math.abs(w.y0 - GARDEN_Y) > 0.01) continue;
    const length = w.hx * 2;
    for (const s of [-length / 2 + 1.2, length / 2 - 1.2, (random() - 0.5) * length * 0.6]) {
      const x = w.x + Math.cos(w.angle) * s;
      const z = w.z - Math.sin(w.angle) * s;
      for (let i = 0; i < (lite ? 2 : 4); i++) roseSpots.push({ x: x + (random() - 0.5) * 1.6, y: w.y1 - 0.1, z: z + (random() - 0.5) * 0.5, scale: 0.7 + random() * 0.5 });
    }
  }
  cluster(-50, 53, GARDEN_Y, lite ? 14 : 26, 3.5);          // あずまや
  cluster(-28.5, 33.2, GARDEN_Y, 8, 1.2);                   // 残響の碑のまわり
  for (const [x, z] of [[-6.5, 60.5], [6.5, 60.5], [-8.6, 43.5], [8.6, 43.5]]) cluster(x, z, 0, lite ? 5 : 9, 1.2); // 入口・古い門
  for (const [x, z] of [[-53, 33], [-23, 33], [-53, 5], [-35, 44]]) cluster(x, z, GARDEN_Y, lite ? 5 : 8, 1.3); // 庭園の曲がり角
  for (const [x, z] of [[76, 36], [76, 14], [98, 16], [84, 36], [48.5, 28.5]]) cluster(x, z, 0, lite ? 5 : 8, 1.3); // 出口（門前・踊り場）
  // 縁の石壁の上（笠石の上）にも、ところどころ
  for (const [x, z, y] of [[-10.3, 47, 1.1], [10.3, 55, 1.1], [-54.3, 20, GARDEN_Y + 1.1], [-40, 34.3, GARDEN_Y + 1.1], [73.7, 33, 1.1]]) cluster(x, z, y, lite ? 4 : 7, 0.5);
  root.add(roses(roseSpots));

  // ── 石の束を、材質ごとにまとめて描く ──
  near.build(root, { shadows: true });
  far.build(root, { shadows: false });

  // ── 仕掛けの動き ──
  let drainT = -1;
  let liftT = -1;
  let clampT = -1;
  let waterLeverT = -1;

  function applyState(flags) {
    const drained = Boolean(flags.drained);
    tunnelWater.position.y = drained ? LOW_Y - 0.8 : LOW_Y + 0.9;
    tunnelWater.visible = !drained;
    for (const water of channels) { water.visible = drained; water.scale.y = drained ? 1 : 0.001; }
    waterLever.rotation.x = drained ? 0.6 : -0.6;
    shortcutBars.position.y = flags.shortcutOpen ? GARDEN_Y + 2.6 : GARDEN_Y;
    clamp.visible = !flags.clampFreed;
    lift.rotation.z = flags.bridgeLowered ? 0 : 1.25;
    liftLever.rotation.x = flags.bridgeLowered ? 0.6 : -0.6;
    placeChains();
    crownMaterial.opacity = flags.evolved ? 0.6 : 0.35;
    gardenStone.setActive(Boolean(flags.gardenStoneLit));
    oathStone.setActive(Boolean(flags.evolved));
    drainT = -1; liftT = -1; clampT = -1; waterLeverT = -1;
  }

  // 合図に合わせて、仕掛けを動かす（音は runner が鳴らす）。動かしたら true
  function handleAction(name) {
    if (name === 'divertWater') { drainT = 0; waterLeverT = 0; for (const water of channels) water.visible = true; return true; }
    if (name === 'openShortcut') { shortcutBars.position.y = GARDEN_Y + 2.6; return true; }
    if (name === 'unclamp') { clampT = 0; return true; }
    if (name === 'lowerBridge') { liftT = 0; return true; }
    if (name === 'evolveStart') { crownMaterial.opacity = 0.9; return true; }
    if (name === 'evolveEnd') { crownMaterial.opacity = 0.6; oathStone.setActive(true); return true; }
    if (name === 'stoneLit:garden') { gardenStone.setActive(true); return true; }
    return false;
  }

  function update(time, dt) {
    if (drainT >= 0 && drainT < 1) {
      drainT = Math.min(1, drainT + dt / 4);
      tunnelWater.position.y = LOW_Y + 0.9 - 1.7 * drainT;
      for (const water of channels) water.scale.y = Math.max(0.001, drainT);
      if (drainT >= 1) tunnelWater.visible = false;
    }
    if (waterLeverT >= 0 && waterLeverT < 1) {
      waterLeverT = Math.min(1, waterLeverT + dt / 0.5);
      waterLever.rotation.x = -0.6 + 1.2 * waterLeverT;
    }
    if (clampT >= 0 && clampT < 1) {
      clampT = Math.min(1, clampT + dt / 0.6);
      clamp.position.y = 1.6 - 1.5 * clampT;
      if (clampT >= 1) clamp.visible = false;
    }
    if (liftT >= 0 && liftT < 1) {
      liftT = Math.min(1, liftT + dt / 3.2);
      const eased = liftT * liftT * (3 - 2 * liftT);
      lift.rotation.z = 1.25 * (1 - eased);
      liftLever.rotation.x = -0.6 + 1.2 * Math.min(1, liftT * 3);
      drum.rotation.x += dt * 3;
      placeChains();
    }
    fountainWater.position.y = GARDEN_Y + 0.7 + Math.sin(time * 2) * 0.01;
    gardenStone.update(time);
    oathStone.update(time);
    terrain.update(time);
    for (const lamp of lanterns) lamp.scale.setScalar(0.9 + 0.1 * Math.sin(time * 7 + lamp.position.x));
  }

  function dispose() {
    scene.remove(root);
    root.traverse((object) => { object.geometry?.dispose(); });
    for (const m of owned) m.dispose();
    crownMap.dispose();
    leafMap.dispose();
    terrain.dispose();
    castle.dispose();
  }

  return { root, occluders, applyState, handleAction, update, dispose, groundAt, counts: terrain.counts };
}
