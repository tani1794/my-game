// 白薔薇の迷宮橋の見た目：崩れた本橋と閉ざされた城、霧の谷、生け垣の白薔薇の庭園、水路と下層通路、
// 巻き上げ機室、昇降橋、誓剣の門前の石碑と洞窟の入口。形と場所は layout.js から作る。
import * as THREE from 'three';
import { loadGLTF, measureModel, withFallback } from '../../assets.js';
import { mulberry32 } from '../../world/random.js';
import { asset } from '../../paths.js';
import { worldUV } from '../../chapter/materials.js';
import { floorMesh, wallMesh } from '../kitView.js';
import { createEchoStone, createCastle, createCliffs, landmarkMaterial, createRoseBushes, waterPlane, cliffMaterial } from '../props.js';
import { ROSE, ROSE_HEIGHTS } from './layout.js';

const { GARDEN_Y, LOW_Y } = ROSE_HEIGHTS;

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
  // 王冠に重なる一本の剣
  ctx.beginPath(); ctx.moveTo(128, 40); ctx.lineTo(128, 226); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(104, 196); ctx.lineTo(152, 196); ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function buildRose(scene, materials, { lite = false, load = loadGLTF } = {}) {
  const root = new THREE.Group();
  root.name = 'area-rose';
  scene.add(root);
  const { level } = ROSE;
  const occluders = [];
  const keep = (mesh) => { root.add(mesh); occluders.push(mesh); return mesh; };
  const random = mulberry32(101);

  // ── 床：場所ごとに厚み（台の下の支え）を変える。庭園は芝の色、橋は白っぽい石 ──
  const garden = materials.stone.clone();
  garden.color.set('#7f8f6e');
  const depths = { entry: 10, mainBridge: 2.4, garden: 9, machine: 3, landing: 14, oathPlaza: 12, liftBridge: 0.6 };
  const bridgeDeck = new THREE.Group();
  for (const floor of level.floors) {
    if (floor.id === 'liftBridge') continue;
    const material = floor.id === 'garden' || floor.id === 'arbor' ? garden : floor.id === 'drainTunnel' ? materials.stone : materials.chapelStone;
    const mesh = floorMesh(floor, material, depths[floor.id] ?? 1);
    root.add(mesh);
  }

  // ── 壁：生け垣は葉の色、機室は石 ──
  const hedge = new THREE.MeshStandardMaterial({ color: '#2c4026', roughness: 1 });
  for (const wall of level.wallBoxes) {
    const isHedge = Math.abs(wall.y0 - GARDEN_Y) < 0.01;
    const mesh = wallMesh(wall, isHedge ? hedge : materials.stone);
    if (isHedge) root.add(mesh); else keep(mesh);
  }

  // ── 崩れた本橋の先と、閉ざされた城（入れない） ──
  for (let z = 22; z > 8; z -= 3) {
    // 落ちた橋の欠片が谷へ点々と
    const piece = box(materials.chapelStone, 6 + random() * 2, 0.8, 2.5, (random() - 0.5) * 3, -6 - (22 - z) * 1.6, z);
    piece.rotation.set(random() - 0.5, random(), random() - 0.5);
    root.add(piece);
  }
  for (const z of [30, 38]) root.add(box(materials.chapelStone, 6, 30, 3, 0, -17.4, z)); // 本橋の橋脚
  root.add(box(materials.chapelStone, 8, 1.6, 30, 0, -0.8, -12));                  // 向こう岸の橋（入れない）
  for (const z of [-4, -18]) root.add(box(materials.chapelStone, 6, 30, 3, 0, -16, z));
  const landmark = landmarkMaterial(materials.chapelStone);
  root.add(createCastle(landmark, { x: 0, z: -60, width: 70 }));
  // 庭園・機室の支え柱、崖
  root.add(createCliffs(materials.rubble, [[-85, 30], [-80, -25], [125, 45], [128, -12], [60, 80], [-35, 90]], random));

  // ── 白薔薇：生け垣の上、あずまや、橋の入口、門前 ──
  const roses = await createRoseBushes(load, lite);
  const roseSpots = [];
  for (const wall of level.wallBoxes) {
    if (Math.abs(wall.y0 - GARDEN_Y) > 0.01) continue;
    const length = wall.hx * 2;
    for (let s = -length / 2; s < length / 2; s += lite ? 2.2 : 1.4) {
      const x = wall.x + Math.cos(wall.angle) * s;
      const z = wall.z - Math.sin(wall.angle) * s;
      roseSpots.push({ x: x + (random() - 0.5) * 0.4, y: wall.y1 - 0.1, z: z + (random() - 0.5) * 0.4, scale: 0.7 + random() * 0.5 });
    }
  }
  for (let i = 0; i < 26; i++) {
    const a = random() * Math.PI * 2;
    roseSpots.push({ x: -50 + Math.cos(a) * (3 + random()), y: GARDEN_Y, z: 53 + Math.sin(a) * (3 + random()), scale: 0.8 + random() * 0.5 });
  }
  for (const [cx, cz, y] of [[-9, 46, 0], [9, 46, 0], [-9, 58, 0], [9, 58, 0], [78, 36, 0], [98, 16, 0], [76, 14, 0]]) {
    for (let i = 0; i < 6; i++) roseSpots.push({ x: cx + (random() - 0.5) * 2.4, y, z: cz + (random() - 0.5) * 2.4, scale: 0.8 + random() * 0.4 });
  }
  root.add(roses(roseSpots));

  // ── 庭園：噴水、水路、水門、像、近道の鉄柵、残響の碑 ──
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.8, 24), materials.chapelStone);
  fountain.position.set(-42, GARDEN_Y + 0.4, 19);
  root.add(fountain);
  const fountainWater = waterPlane(materials.water, 2.4, 2.4);
  fountainWater.position.set(-42, GARDEN_Y + 0.7, 19);
  root.add(fountainWater);
  // 庭の水路（最初は乾いていて、水門を開くと水が流れる）
  const channels = [];
  for (const [x0, z0, x1, z1] of [[-53, 13, -23, 13], [-53, 25, -38, 25], [-31, 31, -23, 31]]) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const bed = box(materials.stone, length, 0.1, 0.8, (x0 + x1) / 2, GARDEN_Y + 0.02, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0));
    root.add(bed);
    const water = waterPlane(materials.water, length, 0.7);
    water.position.set((x0 + x1) / 2, GARDEN_Y + 0.08, (z0 + z1) / 2);
    water.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    water.scale.y = 0.001;
    water.visible = false;
    root.add(water);
    channels.push(water);
  }
  const gateFrame = box(materials.iron, 2, 2.2, 0.3, -50, GARDEN_Y + 1.1, 5.6);
  root.add(gateFrame);
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
  const gardenStone = createEchoStone(materials, landmark);
  gardenStone.group.position.set(-28, GARDEN_Y, 31);
  root.add(gardenStone.group);

  // ── 下層通路：天井と側壁で囲まれた細い石の通路。最初は水の下 ──
  for (const side of [-1, 1]) keep(box(materials.stone, 75, 4.2, 0.6, -13.5, LOW_Y + 2.1, -4 + side * 1.9));
  keep(box(materials.stone, 75, 0.5, 4.4, -13.5, LOW_Y + 4.4, -4));
  const tunnelWater = waterPlane(materials.water, 75, 3.6);
  tunnelWater.position.set(-13.5, LOW_Y + 0.9, -4);
  root.add(tunnelWater);
  const lanterns = [];
  for (let x = -44; x < 22; x += 11) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
    lamp.position.set(x, LOW_Y + 2.8, -2.4);
    root.add(lamp);
    lanterns.push(lamp);
  }
  const tunnelLight = new THREE.PointLight('#ffd9a0', 6, 22, 1.6);
  tunnelLight.position.set(-14, LOW_Y + 3, -4);
  root.add(tunnelLight);

  // ── 巻き上げ機室：巻き胴と鎖（天井の穴から昇降橋へ）、留め具 ──
  const winch = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 18), materials.wood);
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 1.4;
  winch.add(drum, box(materials.wood, 0.3, 2.2, 1.6, -1.45, 1.1, 0), box(materials.wood, 0.3, 2.2, 1.6, 1.45, 1.1, 0));
  const clamp = box(materials.iron, 0.5, 0.9, 0.4, 1.1, 1.6, 0.85);
  winch.add(clamp);
  winch.position.set(31, LOW_Y, -9);
  root.add(winch);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 12, 6), materials.iron);
  chain.position.set(31, LOW_Y + 7.8, -9);
  root.add(chain);
  keep(box(materials.stone, 14.8, 0.6, 16.8, 29, LOW_Y + 4.6, -4)); // 機室の天井
  const machineLight = new THREE.PointLight('#ffcf90', 8, 18, 1.6);
  machineLight.position.set(28, LOW_Y + 3.5, -4);
  root.add(machineLight);

  // ── 昇降橋：踊り場の東の縁を軸に、上がった状態から降りる ──
  const lift = new THREE.Group();
  const deck = box(materials.wood, 25, 0.5, 4, 12.5, -0.25, 0);
  lift.add(deck);
  for (const side of [-1, 1]) lift.add(box(materials.iron, 25, 0.12, 0.12, 12.5, 0.6, side * 1.9));
  lift.position.set(50, 0, 25);
  lift.rotation.z = 1.25;
  root.add(lift);
  for (const side of [-1, 1]) {
    keep(box(materials.chapelStone, 1.4, 9, 1.4, 50.6, 4.5, 25 + side * 3));
    root.add(box(materials.chapelStone, 1.4, 9, 1.4, 75, 4.5 - 9, 25 + side * 3));
  }
  const liftLever = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), materials.iron);
  liftLever.position.set(47, 0.6, 22.5);
  liftLever.rotation.x = -0.6;
  root.add(liftLever, box(materials.iron, 0.6, 0.4, 0.6, 47, 0.2, 22.5));

  // ── 誓剣の門前：王冠の石碑、残響の碑、洞窟の入口 ──
  const stele = new THREE.Group();
  stele.add(box(materials.chapelStone, 2.4, 3.4, 0.8, 0, 1.7, 0));
  const crownMaterial = new THREE.MeshBasicMaterial({ map: crownTexture(), transparent: true, color: '#8fd8ff', opacity: 0.35, depthWrite: false });
  const crown = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), crownMaterial);
  crown.position.set(0, 2.2, 0.41);
  stele.add(crown);
  stele.position.set(88, 0, 24);
  root.add(stele);
  const oathStone = createEchoStone(materials, landmark);
  oathStone.group.position.set(82, 0, 31);
  root.add(oathStone.group);
  // 洞窟の入口：岩の重なりで口を作る（中は暗い）
  for (const [x, y, z, s] of [[87.5, 3, -2, 4.2], [96.5, 3, -2, 4.2], [92, 7.5, -3, 5.2], [92, 6, -8, 6], [86, 1.6, 2, 2.4], [98, 1.6, 2, 2.4]]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), cliffMaterial);
    rock.position.set(x, y, z);
    rock.rotation.set(random(), random(), random());
    rock.castShadow = true;
    root.add(rock);
    occluders.push(rock);
  }
  const caveDark = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: '#05070a' }));
  caveDark.position.set(92, 3, -7.2);
  root.add(caveDark);

  // ── 遠景の谷底と霧 ──
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#4f5a5f', roughness: 1 }));
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.y = -46;
  root.add(abyss);

  // ── 仕掛けの動き ──
  let drainT = -1;
  let liftT = -1;
  let clampT = -1;
  let waterLeverT = -1;
  let flowTime = 0;

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
    flowTime += dt;
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
    }
    fountainWater.position.y = GARDEN_Y + 0.7 + Math.sin(time * 2) * 0.01;
    gardenStone.update(time);
    oathStone.update(time);
    for (const lamp of lanterns) lamp.scale.setScalar(0.9 + 0.1 * Math.sin(time * 7 + lamp.position.x));
  }

  function dispose() {
    scene.remove(root);
    root.traverse((object) => {
      object.geometry?.dispose();
      if (object.material && !Object.values(materials).includes(object.material)) object.material.dispose?.();
    });
  }

  return { root, occluders, applyState, handleAction, update, dispose, deck: bridgeDeck };
}
