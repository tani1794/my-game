// 晶冠峡谷の見た目：両側の崖と青い結晶、落ちた昇降路、反射器と光の筋、受光器、結晶糸、組み上がる光の橋、
// 共鳴の休み場、昇降路の塔と籠と巻き上げ機、上の段の3つの共鳴器と石板、晶冠の門、
// 共鳴の王座（直径55mの床・外周の巨大な結晶・王冠のような結晶群・崩れたアーチ・遠くの滝）、残響の鉱夫オルン。
import * as THREE from 'three';
import { mulberry32 } from '../../world/random.js';
import { worldUV } from '../../chapter/materials.js';
import { floorMesh } from '../kitView.js';
import { createEchoStone, cliffMaterial, landmarkMaterial } from '../props.js';
import { CRYSTAL, CRYSTAL_HEIGHTS, REFLECTORS, RESONATORS, ARENA } from './layout.js';

const { GROUND, TERRACE, MINE } = CRYSTAL_HEIGHTS;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 北・東・南・西（x, z）
const smooth = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

function box(material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), 2), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 刻印（線の数・矢じり・形）を描いた板
function engraving(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  draw(ctx);
  return new THREE.CanvasTexture(canvas);
}
const linesMark = (count) => engraving((ctx) => {
  for (let i = 0; i < count; i++) {
    const x = 64 + (i - (count - 1) / 2) * 26;
    ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x, 104); ctx.stroke();
  }
});
const arrowMark = engraving((ctx) => {
  ctx.beginPath(); ctx.moveTo(20, 64); ctx.lineTo(100, 64); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(76, 36); ctx.lineTo(106, 64); ctx.lineTo(76, 92); ctx.stroke();
});
const tabletMark = engraving((ctx) => {
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(30, 34, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, 56); ctx.lineTo(30, 70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(58, 20); ctx.lineTo(64, 48); ctx.moveTo(70, 20); ctx.lineTo(64, 48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(56, 56); ctx.lineTo(56, 70); ctx.moveTo(72, 56); ctx.lineTo(72, 70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(86, 46); ctx.lineTo(90, 22); ctx.lineTo(98, 38); ctx.lineTo(106, 18); ctx.lineTo(114, 38); ctx.lineTo(118, 46); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(92, 56); ctx.lineTo(92, 70); ctx.moveTo(102, 56); ctx.lineTo(102, 70); ctx.moveTo(112, 56); ctx.lineTo(112, 70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 100); ctx.lineTo(114, 100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(96, 88); ctx.lineTo(114, 100); ctx.lineTo(96, 112); ctx.stroke();
});

// 滝の筋（縦に流れる模様）
function waterfallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(220,240,255,0.35)';
  ctx.fillRect(0, 0, 64, 256);
  const random = mulberry32(5);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + random() * 0.5})`;
    ctx.fillRect(random() * 64, random() * 256, 1 + random() * 3, 20 + random() * 60);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 残響の鉱夫オルン：古い結晶に残った人影。透ける青い体、兜の灯り、肩のつるはし、ひげ
function createOrun() {
  const group = new THREE.Group();
  group.name = 'orun';
  const ghost = new THREE.MeshStandardMaterial({ color: '#bfefff', emissive: '#4fc6ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false });
  const add = (geometry, [x, y, z], [rx, ry, rz] = [0, 0, 0], material = ghost) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    group.add(mesh);
    return mesh;
  };
  add(new THREE.CapsuleGeometry(0.34, 0.75, 4, 10), [0, 0.95, 0]);
  add(new THREE.SphereGeometry(0.22, 12, 10), [0, 1.72, 0.02]);
  add(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, 1.8, 0]);
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14), [0, 1.8, 0]);
  add(new THREE.ConeGeometry(0.15, 0.4, 8), [0, 1.48, 0.17], [Math.PI, 0, 0]);
  const lampMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
  add(new THREE.SphereGeometry(0.06, 8, 6), [0, 1.86, 0.25], [0, 0, 0], lampMaterial);
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), [0.32, 1.45, -0.12], [0.3, 0, -0.9]);
  add(new THREE.BoxGeometry(0.62, 0.08, 0.08), [0.62, 1.86, -0.25], [0.3, 0, 0.6]);
  add(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), [0.4, 1.05, 0.05], [0.2, 0, 0.25]);
  add(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), [-0.4, 1.05, 0.05], [0.2, 0, -0.25]);
  const light = new THREE.PointLight('#9fe2ff', 2, 6, 2);
  light.position.set(0, 1.9, 0.4);
  group.add(light);
  return { group, ghost, light };
}

export async function buildCrystal(scene, materials, { lite = false } = {}) {
  const root = new THREE.Group();
  root.name = 'area-crystal';
  scene.add(root);
  const { level } = CRYSTAL;
  const occluders = [];
  const random = mulberry32(331);
  const owned = new Set();
  const own = (material) => { owned.add(material); return material; };

  const rockFloor = own(materials.stone.clone());
  rockFloor.color.set('#7a8590');
  const arenaStone = own(materials.stone.clone());
  arenaStone.color.set('#8d98a4');
  const crystalMaterial = own(new THREE.MeshStandardMaterial({ color: '#8fe9ff', emissive: '#2bb7ff', emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
  const farCrystal = own(landmarkMaterial(crystalMaterial, 0.3));
  const iron = materials.iron;

  // ── 床（光の橋と王座と出口は、別に作る） ──
  const special = new Set(['bridge', 'arena', 'exit']);
  for (const floor of level.floors) {
    if (special.has(floor.id)) continue;
    const depth = floor.id === 'terrace' ? TERRACE + 6 : floor.id === 'liftStairs' || floor.id === 'gateStairs' ? 9 : 6;
    const mesh = floorMesh(floor, rockFloor, depth);
    root.add(mesh);
    if (floor.id === 'terrace') mesh.traverse((m) => { if (m.isMesh) occluders.push(m); });
  }
  // 谷底（橋の下・まわり）：深い暗がり
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(260, 360), own(new THREE.MeshStandardMaterial({ color: '#16222b', roughness: 1 })));
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.set(0, -26, 90);
  root.add(abyss);

  // ── 両側の崖（谷の壁）と、崖に生えた結晶 ──
  const rock = cliffMaterial;
  const addRock = (x, y, z, s, sy = 1.6) => {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock);
    mesh.position.set(x, y, z);
    mesh.scale.y = sy;
    mesh.rotation.set(random() * 3, random() * 3, random() * 3);
    root.add(mesh);
    return mesh;
  };
  for (let z = -60; z <= 225; z += 11) {
    const westX = z > 140 ? -34 : z > 70 ? -42 : -46;
    // 東は旧坑道（x 42〜76）の外側まで崖を下げる
    const eastX = z > 140 && z < 194 ? 82 : z > 140 ? 32 : z > 70 ? 30 : 46;
    addRock(westX - 6 - random() * 6, 2 + random() * 6, z + random() * 4, 9 + random() * 5);
    addRock(eastX + 6 + random() * 6, 2 + random() * 6, z + random() * 4, 9 + random() * 5);
  }
  // 入口の後ろ（洞窟の出口側）と、東の岩棚のまわり
  for (let x = -30; x <= 30; x += 10) addRock(x, 4, 224 + random() * 4, 9);
  for (const [x, z] of [[30, 178], [26, 156], [34, 154], [46, 140], [36, 140]]) addRock(x, 0, z, 5, 1.4);
  // 結晶の群れ（崖のふもと・広場の縁）：まとめて1回で描く
  const shardGeometry = new THREE.OctahedronGeometry(1, 0);
  const shardSpots = [];
  const cluster = (x, y, z, count, size) => {
    for (let i = 0; i < count; i++) {
      shardSpots.push({
        x: x + (random() - 0.5) * size * 2.2, y: y + random() * size * 0.3, z: z + (random() - 0.5) * size * 2.2,
        s: size * (0.25 + random() * 0.35), h: size * (0.9 + random() * 1.6), rx: (random() - 0.5) * 0.7, rz: (random() - 0.5) * 0.7,
      });
    }
  };
  for (const [x, z, s] of [[-26, 196, 3], [16, 200, 2.5], [-26, 168, 3], [26, 150, 2.4], [-26, 140, 3.5], [-18, 128, 2.5], [16, 114, 2], [-16, 110, 2.6], [-34, 100, 3.5], [18, 92, 2.5], [-34, 70, 3], [28, 68, 3], [-28, 48, 2.5], [12, 30, 2], [-12, 30, 2]]) {
    cluster(x, GROUND, z, lite ? 3 : 6, s);
  }
  // 王座の外周の巨大な結晶（南の入口と北の出口は空ける）
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const south = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.32;
    const north = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.25;
    if (south || north) continue;
    const r = ARENA.radius + 4 + random() * 6;
    cluster(Math.sin(a) * r, GROUND - 1, Math.cos(a) * r, lite ? 2 : 4, 4 + random() * 3);
  }
  const shards = new THREE.InstancedMesh(shardGeometry, crystalMaterial, shardSpots.length);
  const dummy = new THREE.Object3D();
  shardSpots.forEach((spot, i) => {
    dummy.position.set(spot.x, spot.y + spot.h * 0.5, spot.z);
    dummy.rotation.set(spot.rx, random() * 3, spot.rz);
    dummy.scale.set(spot.s, spot.h, spot.s);
    dummy.updateMatrix();
    shards.setMatrixAt(i, dummy.matrix);
  });
  shards.castShadow = !lite;
  root.add(shards);

  // 遠景：峡谷の奥に並ぶ大きな結晶と、滝
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Mesh(shardGeometry, farCrystal);
    const s = 8 + random() * 10;
    c.scale.set(s * 0.35, s * 2.2, s * 0.35);
    const side = i % 2 ? 1 : -1;
    c.position.set(side * (70 + random() * 60), -10 + random() * 14, -40 + random() * 240);
    c.rotation.set((random() - 0.5) * 0.4, random() * 3, (random() - 0.5) * 0.4);
    root.add(c);
  }
  const fallTexture = waterfallTexture();
  const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(16, 90), own(new THREE.MeshBasicMaterial({ map: fallTexture, transparent: true, depthWrite: false, fog: true })));
  waterfall.position.set(-48, 6, -86);
  waterfall.rotation.y = 0.5;
  root.add(waterfall);
  const fall2 = waterfall.clone();
  fall2.position.set(62, 2, -70);
  fall2.rotation.y = -0.6;
  fall2.scale.set(0.6, 0.8, 1);
  root.add(fall2);

  // ── 入口：落ちた昇降路の籠と、折れたレール ──
  const wreck = new THREE.Group();
  wreck.add(box(materials.wood, 3.2, 0.25, 3.2, 0, 0.1, 0));
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) wreck.add(box(iron, 0.15, 3, 0.15, x, 1.5, z));
  wreck.add(box(iron, 3.2, 0.15, 0.15, 0, 3, -1.5), box(iron, 3.2, 0.15, 0.15, 0, 3, 1.5));
  wreck.position.set(-14, 0.3, 184);
  wreck.rotation.set(0.15, 0.6, 0.35);
  root.add(wreck);
  for (const x of [-18, -14]) {
    const rail = box(iron, 0.25, 22, 0.25, x, 10, 206);
    rail.rotation.x = 0.35;
    root.add(rail);
  }
  const entryStone = createEchoStone(materials);
  entryStone.group.position.set(5, GROUND, 191);
  root.add(entryStone.group);

  // ── 反射器2基（空から差す光を、向いた方へ） ──
  const beamMaterial = own(new THREE.MeshBasicMaterial({ color: '#d8f6ff', transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
  const shaftMaterial = own(new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const reflectorPos = { reflectorA: [-14, 149], reflectorB: [40, 149] };
  const goalLength = { reflectorA: 21.5, reflectorB: 31.5 };
  const reflectorViews = {};
  for (const [id, [x, z]] of Object.entries(reflectorPos)) {
    root.add(box(materials.stone, 1.5, 0.9, 1.5, x, 0.45, z));
    const mirror = new THREE.Group();
    mirror.add(box(iron, 1.4, 1.3, 0.12, 0, 0, 0));
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), own(new THREE.MeshBasicMaterial({ map: arrowMark, transparent: true, color: '#9fe3ff' })));
    mark.position.z = 0.07;
    mark.rotation.z = Math.PI / 2;
    mirror.add(mark);
    mirror.position.set(x, 1.6, z);
    root.add(mirror);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 16, 12, 1, true), shaftMaterial);
    shaft.position.set(x, 9.6, z);
    root.add(shaft);
    const inBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 14, 8), beamMaterial);
    inBeam.position.set(x, 8.6, z);
    root.add(inBeam);
    const outBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 8), beamMaterial);
    root.add(outBeam);
    reflectorViews[id] = { mirror, outBeam, x, z, plate: mirror.children };
  }
  function aim(id, dir) {
    const view = reflectorViews[id];
    const [dx, dz] = DIRS[dir];
    view.mirror.rotation.y = Math.atan2(dx, dz) + Math.PI;
    const length = dir === REFLECTORS[id].goal ? goalLength[id] : 5;
    view.outBeam.scale.y = length;
    view.outBeam.position.set(view.x + dx * length / 2, 1.6, view.z + dz * length / 2);
    view.outBeam.rotation.set(dz !== 0 ? Math.PI / 2 : 0, 0, dx !== 0 ? Math.PI / 2 : 0);
  }
  // 受光器：西と東に矢じりの刻印
  const receptorMaterial = own(crystalMaterial.clone());
  receptorMaterial.emissiveIntensity = 0.25;
  root.add(box(materials.stone, 2, 1, 2, 8, 0.5, 149));
  const receptor = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), receptorMaterial);
  receptor.scale.set(0.8, 2, 0.8);
  receptor.position.set(8, 3, 149);
  root.add(receptor);
  for (const side of [-1, 1]) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), own(new THREE.MeshBasicMaterial({ map: arrowMark, transparent: true, color: '#cfe8f0' })));
    mark.position.set(8 + side * 1.01, 0.55, 149);
    mark.rotation.y = side * Math.PI / 2;
    if (side > 0) mark.rotation.z = Math.PI;
    root.add(mark);
  }
  const receptorLight = new THREE.PointLight('#7fdcff', 0, 16, 1.6);
  receptorLight.position.set(8, 4, 149);
  root.add(receptorLight);

  // ── 結晶糸（東の側道を塞ぐ） ──
  const webMaterial = own(new THREE.MeshBasicMaterial({ color: '#dff7ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  const webGeometry = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2, 0); shape.lineTo(2, 0); shape.lineTo(1.6, 3); shape.lineTo(-1.6, 3); shape.closePath();
    return new THREE.ShapeGeometry(shape);
  })();
  const webViews = {};
  for (const b of CRYSTAL.breakables.filter((item) => item.look === 'web')) {
    const group = new THREE.Group();
    const sheet = new THREE.Mesh(webGeometry, webMaterial);
    group.add(sheet);
    for (let i = 0; i < 6; i++) {
      const strand = box(crystalMaterial, 0.05, 3.4, 0.05, -1.8 + i * 0.72, 1.5, 0);
      strand.rotation.z = (random() - 0.5) * 0.6;
      group.add(strand);
    }
    group.position.set(b.x, b.y, b.z);
    // 当たり判定の箱と同じ向き（web1 は南北に、web2 は斜めに道を塞ぐ）
    group.rotation.y = b.id === 'web1' ? Math.PI / 2 : -0.165;
    root.add(group);
    webViews[b.flag] = group;
  }

  // ── 旧坑道：岩の壁と低い天井、木の支柱、ランタン、トロッコ、落ちた鏡板、出口を塞ぐ崩れた支柱 ──
  const mineRock = (x, z, s = 2.6) => {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock);
    mesh.position.set(x, MINE + 1.6, z);
    mesh.scale.y = 1.3;
    mesh.rotation.set(random() * 3, random() * 3, random() * 3);
    root.add(mesh);
    occluders.push(mesh);
  };
  // 部屋と抜け道のまわりを岩で囲む（入口・抜け道・出口は空ける）
  for (let x = 54; x <= 70; x += 3.5) mineRock(x, 188);
  for (let z = 172; z <= 186; z += 3.5) { mineRock(72, z); if (z > 179) mineRock(52, z); }
  for (const x of [54, 57.5, 61, 68.5, 72]) mineRock(x, 170.5);
  for (let z = 161; z <= 169; z += 3) { mineRock(62.2, z, 1.8); mineRock(69.2, z, 1.8); }
  for (const x of [58, 61.5, 70, 73.5, 77]) mineRock(x, 162);
  for (let z = 146; z <= 160; z += 3.5) mineRock(78.2, z);
  for (let x = 58; x <= 76; x += 3.5) mineRock(x, 144);
  for (const z of [154, 157.5, 161]) mineRock(56.2, z);
  for (const [x, z] of [[49, 152], [52, 152.4], [49, 144.6], [53, 145.2], [46, 172], [48, 180], [52, 172.2], [45, 179]]) mineRock(x, z, 2.2);
  const mineCeiling = own(new THREE.MeshStandardMaterial({ color: '#1b2026', roughness: 1, side: THREE.DoubleSide }));
  for (const [x, z, w, d] of [[62, 179, 20, 18], [65.5, 165.5, 9, 13], [67, 153, 22, 18], [52, 148, 16, 8], [48, 175, 14, 9]]) {
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mineCeiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(x, MINE + 4.6, z);
    root.add(ceiling);
    occluders.push(ceiling);
    // 天井の上は、丘に見えるよう岩で覆う
    addRock(x, MINE + 9, z, Math.max(w, d) * 0.45, 0.6);
  }
  for (const [x, z] of [[58, 180], [66, 178], [67, 153]]) {
    root.add(box(materials.wood, 0.35, 4.6, 0.35, x, MINE + 2.3, z));
    root.add(box(materials.wood, 3.2, 0.3, 0.35, x, MINE + 4.4, z));
  }
  for (const [x, z] of [[56, 184], [68, 174], [60, 158]]) {
    const lamp = new THREE.PointLight('#ffcf8a', 4, 11, 1.8);
    lamp.position.set(x, MINE + 2.8, z);
    root.add(lamp);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), own(new THREE.MeshBasicMaterial({ color: '#ffd9a0' })));
    glass.position.copy(lamp.position);
    root.add(glass);
  }
  cluster(70, MINE, 184, lite ? 2 : 4, 1.4);
  cluster(75, MINE, 147, lite ? 2 : 4, 1.6);
  cluster(59, MINE, 147, lite ? 2 : 3, 1.2);
  // トロッコ
  const cart = new THREE.Group();
  cart.add(box(materials.wood, 1.5, 0.9, 2.4, 0, 0.75, 0));
  for (const [x, z] of [[-0.7, -0.8], [0.7, -0.8], [-0.7, 0.8], [0.7, 0.8]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), iron);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.28, z);
    cart.add(wheel);
  }
  cart.position.set(74, MINE, 156);
  cart.rotation.z = 0.25;
  root.add(cart);
  // 落ちた鏡板（拾うと消え、東の反射器にはまる）
  const looseMaterial = own(new THREE.MeshBasicMaterial({ map: arrowMark, transparent: true, color: '#9fe3ff' }));
  const loosePlate = new THREE.Group();
  loosePlate.add(box(iron, 1.4, 0.1, 1.3, 0, 0.06, 0));
  const looseMark = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), looseMaterial);
  looseMark.rotation.x = -Math.PI / 2;
  looseMark.position.y = 0.12;
  loosePlate.add(looseMark);
  loosePlate.position.set(73, MINE, 149.5);
  loosePlate.rotation.y = 0.4;
  root.add(loosePlate);
  const plateGlow = new THREE.PointLight('#9fe3ff', 2, 5, 2);
  plateGlow.position.set(73, MINE + 0.8, 149.5);
  root.add(plateGlow);
  // 出口を塞ぐ崩れた支柱（押すと、岩棚の側へ倒れる）
  const timber = new THREE.Group();
  const log = box(materials.wood, 0.5, 4.4, 0.5, 0, 2.2, 0);
  timber.add(log);
  timber.add(box(materials.wood, 0.4, 0.4, 3.6, 0, 3.4, 0));
  timber.position.set(55.5, MINE + 0.6, 149);
  timber.rotation.set(0, 1.25, 0.18);
  root.add(timber);

  // ── 光の橋：谷を渡る結晶の板。光が揃うと、手前から順に組み上がる ──
  const bridge = new THREE.Group();
  const bridgeMaterial = own(new THREE.MeshStandardMaterial({ color: '#bff3ff', emissive: '#4fc6ff', emissiveIntensity: 0.7, roughness: 0.15, transparent: true, opacity: 0.85 }));
  const bridgeSlabs = [];
  for (let z = 146; z > 127; z -= 2) {
    const slab = box(bridgeMaterial, 4, 0.35, 1.9, 0, -0.18, z - 1);
    bridge.add(slab);
    bridgeSlabs.push(slab);
  }
  for (const side of [-1, 1]) {
    for (let z = 145; z > 127; z -= 3) {
      const post = new THREE.Mesh(shardGeometry, crystalMaterial);
      post.position.set(side * 2.1, 0.7, z);
      post.scale.set(0.18, 0.9, 0.18);
      bridge.add(post);
    }
  }
  root.add(bridge);

  // ── 共鳴の休み場・昇降路の広場 ──
  const midStone = createEchoStone(materials);
  midStone.group.position.set(6, GROUND, 116);
  root.add(midStone.group);
  const songCrystals = [];
  for (const [x, z] of [[-9, 125], [9, 125], [-10, 111], [10, 110]]) {
    const c = new THREE.Mesh(shardGeometry, own(crystalMaterial.clone()));
    c.position.set(x, 1.8, z);
    c.scale.set(0.7, 2.6, 0.7);
    root.add(c);
    songCrystals.push(c);
  }
  // 昇降路の塔（階段を囲む鉄の枠）と籠
  for (const [x, z] of [[-24.2, 79], [-19.8, 79], [-24.2, 62], [-19.8, 62]]) root.add(box(iron, 0.35, 18, 0.35, x, 9, z));
  root.add(box(iron, 5, 0.4, 0.4, -22, 18, 79), box(iron, 5, 0.4, 0.4, -22, 18, 62), box(iron, 0.4, 0.4, 17, -24.2, 18, 70.5), box(iron, 0.4, 0.4, 17, -19.8, 18, 70.5));
  const cage = new THREE.Group();
  cage.add(box(materials.wood, 3.8, 0.25, 2.8, 0, 0.12, 0));
  for (const [x, z] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) cage.add(box(iron, 0.14, 3.4, 0.14, x, 1.7, z));
  cage.add(box(iron, 3.8, 0.14, 0.14, 0, 3.4, -1.3), box(iron, 3.8, 0.14, 0.14, 0, 3.4, 1.3), box(iron, 3.8, 0.1, 0.1, 0, 1.6, 1.3));
  cage.position.set(-22, GROUND, 76.5);
  root.add(cage);
  // 巻き上げ機と鎖
  root.add(box(materials.stone, 3.2, 1, 2, -14, 0.5, 84));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.4, 14), materials.wood);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(-14, 1.6, 84);
  root.add(drum);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 20, 6), iron);
  chain.position.set(-18, 9.8, 81.5);
  chain.rotation.set(0.12, 0, 0.42);
  root.add(chain);
  const winchCrystals = {};
  for (const b of CRYSTAL.breakables.filter((item) => item.look === 'crystal')) {
    const group = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(shardGeometry, crystalMaterial);
      c.position.set((random() - 0.5) * 0.9, 0.6 + random() * 0.4, (random() - 0.5) * 0.9);
      c.scale.set(0.3, 0.8 + random() * 0.6, 0.3);
      c.rotation.set((random() - 0.5) * 0.8, random() * 3, (random() - 0.5) * 0.8);
      group.add(c);
    }
    group.position.set(b.x, b.y, b.z);
    root.add(group);
    winchCrystals[b.flag] = group;
  }

  // ── 上の段：3つの共鳴器（輪・双刃・王冠）と、線の数の刻印。西の石板 ──
  const resonatorPos = { resonatorL: [-14, 58], resonatorC: [0, 63], resonatorR: [14, 58] };
  const resonatorViews = {};
  for (const [id, [x, z]] of Object.entries(resonatorPos)) {
    const r = RESONATORS[id];
    root.add(box(materials.stone, 2, 1.2, 2, x, TERRACE + 0.6, z));
    const material = own(crystalMaterial.clone());
    material.emissiveIntensity = 0.3;
    const shape = new THREE.Group();
    if (r.shape === '輪') {
      shape.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, 8, 24), material));
    } else if (r.shape === '双刃') {
      for (const tilt of [-0.35, 0.35]) {
        const blade = new THREE.Mesh(shardGeometry, material);
        blade.scale.set(0.16, 1.2, 0.4);
        blade.rotation.z = tilt;
        shape.add(blade);
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(shardGeometry, material);
        spike.position.set(Math.sin(a) * 0.55, i % 2 ? 0.1 : 0.3, Math.cos(a) * 0.55);
        spike.scale.set(0.16, i % 2 ? 0.55 : 0.85, 0.16);
        shape.add(spike);
      }
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 20), material);
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.35;
      shape.add(band);
    }
    shape.position.set(x, TERRACE + 2.4, z);
    root.add(shape);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), own(new THREE.MeshBasicMaterial({ map: linesMark(r.lines), transparent: true, color: '#cfe8f0' })));
    plaque.position.set(x, TERRACE + 0.65, z + 1.01);
    root.add(plaque);
    resonatorViews[id] = { shape, material, lit: false, pulse: 0, pitch: r.pitch };
  }
  root.add(box(materials.stone, 0.5, 2.6, 2.2, -25, TERRACE + 1.3, 56));
  const tablet = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), own(new THREE.MeshBasicMaterial({ map: tabletMark, transparent: true, color: '#d6eef5' })));
  tablet.position.set(-24.74, TERRACE + 1.5, 56);
  tablet.rotation.y = Math.PI / 2;
  root.add(tablet);

  // ── 晶冠の門：崩れたゴシックのアーチと、門を塞ぐ結晶の壁 ──
  const arch = (x, z, y, width, height, rotationY = 0) => {
    const group = new THREE.Group();
    group.add(box(materials.stone, 1, height, 1, -width / 2, height / 2, 0), box(materials.stone, 1, height, 1, width / 2, height / 2, 0));
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI;
      const stone = box(materials.stone, 1.1, 0.8, 1, Math.cos(a) * width / 2, height + Math.sin(a) * width * 0.6, 0);
      stone.rotation.z = a - Math.PI / 2;
      group.add(stone);
    }
    group.position.set(x, y, z);
    group.rotation.y = rotationY;
    root.add(group);
    return group;
  };
  arch(0, 46.5, TERRACE, 7.2, 5);
  const gateWall = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(shardGeometry, crystalMaterial);
    c.position.set(-2.6 + i * 0.86, 2.4, (random() - 0.5) * 0.4);
    c.scale.set(0.6, 2.6 + random(), 0.5);
    c.rotation.z = (random() - 0.5) * 0.3;
    gateWall.add(c);
  }
  gateWall.position.set(0, TERRACE, 46.5);
  root.add(gateWall);
  const gateStone = createEchoStone(materials);
  gateStone.group.position.set(5, GROUND, 32);
  root.add(gateStone.group);
  // 門の前から王座へ：崩れたアーチの並び
  const broken = arch(-6.5, 29, GROUND, 4, 6, Math.PI / 2);
  broken.children.slice(-3).forEach((stone) => { stone.visible = false; });
  arch(6.5, 29, GROUND, 4, 6, Math.PI / 2).children.slice(-2).forEach((stone) => { stone.visible = false; });

  // ── 共鳴の王座：直径55mの平らな床、中央に淡い円の模様 ──
  const arenaFloor = new THREE.Mesh(worldUV(new THREE.CylinderGeometry(ARENA.radius, ARENA.radius * 0.97, 4, 64), 3), arenaStone);
  arenaFloor.position.set(ARENA.x, GROUND - 2, ARENA.z);
  arenaFloor.receiveShadow = true;
  root.add(arenaFloor);
  const inlayMaterial = own(new THREE.MeshBasicMaterial({ color: '#9fe3ff', transparent: true, opacity: 0.18, depthWrite: false }));
  for (const r of [8, 17, 25]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r + 0.15, 96), inlayMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = GROUND + 0.02;
    root.add(ring);
  }
  // 外周の崩れたアーチ
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.abs(Math.cos(a)) > 0.92) continue;
    const r = ARENA.radius + 1.5;
    const ruin = arch(Math.sin(a) * r, Math.cos(a) * r, GROUND - 0.2, 5, 7 + random() * 3, a + Math.PI / 2);
    ruin.children.slice(-1 - Math.floor(random() * 4)).forEach((stone) => { stone.visible = false; });
  }
  // 北の奥：王冠のような結晶の群れ（ボスの登場で、順に光る）
  const crownMaterials = [];
  const crown = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3;
    const material = own(crystalMaterial.clone());
    material.emissiveIntensity = 0.35;
    crownMaterials.push(material);
    const spire = new THREE.Mesh(shardGeometry, material);
    const h = 14 - Math.abs(t) * 6 + (i % 2 ? -2 : 2);
    spire.scale.set(1.6, h, 1.6);
    spire.position.set(t * 15, h * 0.7 - 2, -42 - Math.abs(t) * -4);
    spire.rotation.z = -t * 0.18;
    crown.add(spire);
  }
  root.add(crown);
  const crownLight = new THREE.PointLight('#6fd6ff', 0, 60, 1.2);
  crownLight.position.set(0, 10, -34);
  root.add(crownLight);
  // 北の出口を塞ぐ結晶の壁（撃破後に崩れる）と、出口の道
  const exitWall = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(shardGeometry, crystalMaterial);
    c.position.set(-2.5 + i, 2.6, (random() - 0.5) * 0.5);
    c.scale.set(0.7, 3 + random(), 0.6);
    exitWall.add(c);
  }
  exitWall.position.set(0, GROUND, -27.6);
  root.add(exitWall);
  const exitPath = floorMesh(level.floors.find((f) => f.id === 'exit'), rockFloor, 6);
  root.add(exitPath);
  const afterStone = createEchoStone(materials);
  afterStone.group.position.set(5, GROUND, -18);
  root.add(afterStone.group);

  // ── 残響の鉱夫オルン（入口と昇降路の広場） ──
  const oruns = CRYSTAL.orun.map((spot) => {
    const orun = createOrun();
    orun.group.position.set(spot.x, spot.y, spot.z);
    orun.group.rotation.y = spot.facing;
    root.add(orun.group);
    owned.add(orun.ghost);
    return orun;
  });

  // ── 状態と動き ──
  let timberT = -1;
  let bridgeT = -1;
  let cageT = -1;
  let gateT = -1;
  let exitT = -1;
  let songT = -1;
  let crownT = -1;
  let fade = 1;
  let receptorTarget = 0.25;
  const flagsNow = {};

  function applyState(flags) {
    Object.assign(flagsNow, flags);
    for (const id of Object.keys(REFLECTORS)) aim(id, flags[REFLECTORS[id].flag] ? REFLECTORS[id].goal : REFLECTORS[id].start);
    const beams = (flags.reflectorA ? 1 : 0) + (flags.reflectorB ? 1 : 0);
    receptorTarget = [0.25, 1.2, 2.6][beams];
    for (const [flag, view] of Object.entries(webViews)) view.visible = !flags[flag];
    // 東の反射器：鏡板をはめるまでは枠だけ
    for (const part of reflectorViews.reflectorB.plate) part.visible = Boolean(flags.plateFit);
    reflectorViews.reflectorB.outBeam.visible = Boolean(flags.plateFit);
    loosePlate.visible = !flags.plateFound;
    plateGlow.intensity = flags.plateFound ? 0 : 2;
    timber.visible = !flags.timberDown;
    timber.rotation.z = 0.18;
    timberT = -1;
    bridge.visible = Boolean(flags.bridgeOn);
    bridgeSlabs.forEach((slab) => { slab.scale.set(1, 1, 1); });
    cage.position.y = flags.liftUp ? 12 : GROUND;
    for (const [flag, view] of Object.entries(winchCrystals)) view.visible = !flags[flag];
    for (const view of Object.values(resonatorViews)) { view.lit = Boolean(flags.crownGateOpen); view.pulse = 0; }
    gateWall.visible = !flags.crownGateOpen;
    gateWall.scale.set(1, 1, 1);
    exitWall.visible = !flags.vergrasDefeated;
    exitPath.visible = Boolean(flags.vergrasDefeated);
    crownMaterials.forEach((m) => { m.emissiveIntensity = flags.vergrasDefeated ? 0.15 : 0.35; });
    fade = flags.vergrasDefeated ? 0.35 : 1;
    crownLight.intensity = 0;
    bridgeT = -1; cageT = -1; gateT = -1; exitT = -1; crownT = -1;
  }

  function handleAction(name) {
    const [head, id, extra] = name.split(':');
    if (REFLECTORS[head] && id !== undefined) { aim(head, Number(id)); return true; }
    if (head === 'beam') { receptorTarget = flagsNow[id === 'reflectorA' ? 'reflectorB' : 'reflectorA'] ? 2.6 : 1.2; flagsNow[id] = true; return true; }
    if (name === 'pushTimber') { timberT = 0; return true; }
    if (name === 'fitPlate') {
      for (const part of reflectorViews.reflectorB.plate) part.visible = true;
      reflectorViews.reflectorB.outBeam.visible = true;
      return true;
    }
    if (name === 'bridgeForm') { bridge.visible = true; bridgeT = 0; receptorTarget = 2.6; return true; }
    if (name === 'raiseLift') { cageT = 0; return true; }
    if (head === 'resonate') { const v = resonatorViews[id]; if (v) v.pulse = 1; return Boolean(v && extra); }
    if (head === 'resonatorLit') { const v = resonatorViews[id]; if (v) v.lit = true; return true; }
    if (name === 'resonatorReset') { for (const v of Object.values(resonatorViews)) v.lit = false; return true; }
    if (name === 'openCrownGate') { gateT = 0; return true; }
    if (name === 'song') { songT = 0; return true; }
    if (name === 'bossCrystals') { crownT = 0; return true; }
    if (name === 'bossReady') { crownT = 3; return true; }
    if (name === 'bossFade') { exitT = 0; return true; }
    return false;
  }

  function update(time, dt, flags = {}) {
    receptorMaterial.emissiveIntensity += (receptorTarget - receptorMaterial.emissiveIntensity) * 0.06;
    receptorLight.intensity = receptorMaterial.emissiveIntensity * 2;
    shaftMaterial.opacity = 0.1 + 0.03 * Math.sin(time * 0.7);
    beamMaterial.opacity = 0.5 + 0.12 * Math.sin(time * 3);
    if (timberT >= 0 && timberT < 1) {
      timberT = Math.min(1, timberT + dt / 1.2);
      timber.rotation.z = 0.18 + 1.3 * timberT * timberT;
      timber.position.y = MINE + 0.6 - 1.2 * timberT;
      if (timberT >= 1) timber.visible = false;
    }
    if (bridgeT >= 0 && bridgeT < 1) {
      bridgeT = Math.min(1, bridgeT + dt / 3);
      bridgeSlabs.forEach((slab, i) => { slab.scale.setScalar(smooth(bridgeT * bridgeSlabs.length - i)); });
    }
    if (cageT >= 0 && cageT < 1) { cageT = Math.min(1, cageT + dt / 4); cage.position.y = GROUND + 12 * smooth(cageT); drum.rotation.x += dt * 4; }
    if (gateT >= 0 && gateT < 1) {
      gateT = Math.min(1, gateT + dt / 1.6);
      gateWall.scale.set(1 + gateT * 0.3, 1 - gateT, 1 + gateT * 0.3);
      if (gateT >= 1) gateWall.visible = false;
    }
    for (const view of Object.values(resonatorViews)) {
      view.pulse = Math.max(0, view.pulse - dt * 0.8);
      view.material.emissiveIntensity = (view.lit ? 1.6 : 0.3) + view.pulse * 2.5;
      // 震え：音の高さほど強く揺れる
      const strength = { low: 0.02, mid: 0.05, high: 0.1 }[view.pitch];
      view.shape.position.x = (view.shape.userData.x ??= view.shape.position.x) + Math.sin(time * 60) * strength * view.pulse;
      view.shape.rotation.y += dt * (view.lit ? 0.8 : 0.2);
    }
    if (songT >= 0) {
      songT += dt;
      songCrystals.forEach((c, i) => { c.material.emissiveIntensity = 0.9 + Math.max(0, Math.sin(songT * 3 - i * 0.8)) * 1.6 * Math.max(0, 1 - songT / 12); });
      if (songT > 12) songT = -1;
    }
    if (crownT >= 0 && crownT < 3) {
      crownT = Math.min(3, crownT + dt);
      crownMaterials.forEach((m, i) => { m.emissiveIntensity = 0.35 + 2 * smooth(crownT * 2.5 - Math.abs(i - 3) * 1.1); });
      crownLight.intensity = 12 * smooth(crownT / 2);
    } else if (crownT >= 3) {
      crownMaterials.forEach((m) => { m.emissiveIntensity = 2 + 0.3 * Math.sin(time * 2); });
      crownLight.intensity = 12;
    }
    if (exitT >= 0 && exitT < 1) {
      // 撃破：王座の光が弱まり、北の結晶の壁が崩れる
      exitT = Math.min(1, exitT + dt / 2.5);
      fade = 1 - 0.65 * exitT;
      crownMaterials.forEach((m) => { m.emissiveIntensity = 2 * (1 - exitT) + 0.15; });
      crownLight.intensity = 12 * (1 - exitT);
      exitWall.scale.set(1, Math.max(0.01, 1 - exitT), 1);
      if (exitT >= 1) { exitWall.visible = false; exitPath.visible = true; crownT = -1; }
    }
    crystalMaterial.emissiveIntensity = (0.75 + 0.15 * Math.sin(time * 0.8)) * fade;
    fallTexture.offset.y = (time * 0.6) % 1;
    for (const orun of oruns) {
      orun.ghost.opacity = 0.45 + 0.12 * Math.sin(time * 3.1);
      orun.light.intensity = 1.6 + 0.4 * Math.sin(time * 7);
    }
    loosePlate.visible = !flags.plateFound;
    plateGlow.intensity = flags.plateFound ? 0 : 1.6 + 0.6 * Math.sin(time * 3);
    entryStone.setActive(true);
    midStone.setActive(Boolean(flags.midStoneLit));
    gateStone.setActive(Boolean(flags.gateStoneLit));
    afterStone.setActive(Boolean(flags.vergrasDefeated));
    for (const stone of [entryStone, midStone, gateStone, afterStone]) stone.update(time);
  }

  function dispose() {
    scene.remove(root);
    root.traverse((object) => { object.geometry?.dispose(); });
    for (const material of owned) material.dispose();
    for (const texture of [arrowMark, tabletMark, fallTexture]) texture.dispose();
  }

  return { root, occluders, applyState, handleAction, update, dispose };
}
