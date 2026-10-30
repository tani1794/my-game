// 蒼響の洞穴の見た目：岩の壁と天井、つらら、青く光る結晶、天井の裂け目から差す光、反射器と光の筋、
// 受光結晶（三日月）と偽の結晶（丸）、石扉、地下水路と水車と渡り板、出口の向こうの結晶の谷。
import * as THREE from 'three';
import { mulberry32 } from '../../world/random.js';
import { worldUV } from '../../chapter/materials.js';
import { floorMesh } from '../kitView.js';
import { createEchoStone, cliffMaterial, landmarkMaterial, rockMesh } from '../props.js';
import { CAVE, CAVE_HEIGHTS } from './layout.js';
import { caveRocks } from './rocks.js';
import { REFLECTOR_START } from './rules.js';

const { UP, LOW } = CAVE_HEIGHTS;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 北・東・南・西（x, z）

function box(material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), 2), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function engraving(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.beginPath();
  if (kind === 'crescent') {
    ctx.arc(64, 64, 40, Math.PI * 0.35, Math.PI * 1.65);
    ctx.arc(80, 64, 30, Math.PI * 1.55, Math.PI * 0.45, true);
    ctx.closePath();
  } else {
    ctx.arc(64, 64, 38, 0, Math.PI * 2);
  }
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export async function buildCave(scene, materials) {
  const root = new THREE.Group();
  root.name = 'area-cave';
  scene.add(root);
  const { level } = CAVE;
  const occluders = [];
  const random = mulberry32(211);
  const rockFloor = materials.stone.clone();
  rockFloor.color.set('#6a7078');

  for (const floor of level.floors) {
    if (floor.id === 'planks') continue;
    const mesh = floorMesh(floor, rockFloor, floor.id === 'southBank' || floor.id === 'northBank' ? 4 : 2);
    root.add(mesh);
    // 床の厚み（階段・坂の側面）も、カメラが向こうへ回り込まないよう遮る物に入れる
    mesh.traverse((m) => { if (m.isMesh) occluders.push(m); });
  }

  // ── 壁と天井：広間・下層・登りを囲む岩（遠すぎない所に、太い岩の塊を並べる） ──
  const rock = cliffMaterial;
  const addRock = (x, y, z, s, sy = 1.4) => {
    const mesh = rockMesh(rock, s, sy, [random() * 3, random() * 3, random() * 3]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    root.add(mesh);
    occluders.push(mesh);
  };
  // 位置と大きさは rocks.js（歩ける床の上には置かない）
  for (const r of caveRocks()) addRock(r.x, r.y, r.z, r.s, r.sy);
  // 天井：暗い岩の板と、つらら
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(80, 150), new THREE.MeshStandardMaterial({ color: '#1c2228', roughness: 1, side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 11, -5);
  root.add(ceiling);
  const stalactite = new THREE.ConeGeometry(0.6, 3.2, 6);
  const drip = new THREE.InstancedMesh(stalactite, rock, 80);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 80; i++) {
    dummy.position.set((random() - 0.5) * 50, 9.8 - random() * 1.2, -60 + random() * 120);
    dummy.rotation.set(Math.PI, random() * 3, 0);
    dummy.scale.set(0.6 + random(), 0.8 + random() * 1.6, 0.6 + random());
    dummy.updateMatrix();
    drip.setMatrixAt(i, dummy.matrix);
  }
  root.add(drip);

  // ── 青く光る結晶の群れ（明かりも兼ねる） ──
  const crystalMaterial = new THREE.MeshStandardMaterial({ color: '#7fe3ff', emissive: '#2bb7ff', emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 });
  const crystalGeometry = new THREE.OctahedronGeometry(0.5, 0);
  const crystalSpots = [[-28, UP, 30], [-12, UP, 38], [13, UP, 15], [-20, LOW, -2], [18, LOW, -5], [8, LOW, -28], [-9, LOW, -30], [12, -2, -44], [-3, 2, -58]];
  for (const [x, y, z] of crystalSpots) {
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(crystalGeometry, crystalMaterial);
      c.position.set(x + (random() - 0.5) * 2, y + 0.4 + random() * 0.6, z + (random() - 0.5) * 2);
      c.scale.set(0.5 + random() * 0.4, 1.4 + random() * 1.6, 0.5 + random() * 0.4);
      c.rotation.set((random() - 0.5) * 0.8, random() * 3, (random() - 0.5) * 0.8);
      root.add(c);
    }
    const light = new THREE.PointLight('#57c8ff', 5, 12, 1.8);
    light.position.set(x, y + 2, z);
    root.add(light);
  }

  // ── 天井の裂け目から差す光と、反射器 ──
  const shaftMaterial = new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 10, 12, 1, true), shaftMaterial);
  shaft.position.set(-6, 5.5, 34);
  root.add(shaft);
  const pedestal = box(materials.stone, 1.4, 0.9, 1.4, -6, 0.45, 24);
  root.add(pedestal);
  const mirror = new THREE.Group();
  const plate = box(materials.iron, 1.3, 1.2, 0.12, 0, 0, 0);
  mirror.add(plate);
  const mirrorMark = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: engraving('crescent'), transparent: true, color: '#9fe3ff' }));
  mirrorMark.position.z = 0.07;
  mirror.add(mirrorMark);
  mirror.position.set(-6, 1.6, 24);
  root.add(mirror);
  // 光の通り道：裂け目の真下 → 反射器 → 向いている方向へ
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#cff1ff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const inBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 10, 8), beamMaterial);
  inBeam.rotation.x = Math.PI / 2;
  inBeam.position.set(-6, 1.6, 29);
  root.add(inBeam);
  const outBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 8), beamMaterial);
  root.add(outBeam);
  // 受光結晶（東・三日月）と偽の結晶（西・丸）
  const receptorMaterial = crystalMaterial.clone();
  receptorMaterial.emissiveIntensity = 0.3;
  const receptor = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), receptorMaterial);
  receptor.scale.set(0.7, 1.8, 0.7);
  receptor.position.set(11, 1.8, 24);
  root.add(receptor);
  const decoyMaterial = crystalMaterial.clone();
  decoyMaterial.emissiveIntensity = 0.3;
  const decoy = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), decoyMaterial);
  decoy.scale.set(0.7, 1.8, 0.7);
  decoy.position.set(-13, 1.8, 24);
  root.add(decoy);
  for (const [x, kind] of [[11, 'crescent'], [-13, 'circle']]) {
    const stand = box(materials.stone, 1.6, 0.6, 1.6, x, 0.3, 24);
    root.add(stand);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: engraving(kind), transparent: true, color: '#cfe8f0' }));
    mark.position.set(x, 0.35, 24.81);
    root.add(mark);
  }
  // 西の小部屋の刻印の石板
  root.add(box(materials.stone, 2, 2.4, 0.4, -31, 1.2, 30));
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: engraving('crescent'), transparent: true, color: '#9fe3ff' }));
  runes.position.set(-30.78, 1.5, 30);
  runes.rotation.y = Math.PI / 2;
  root.add(runes);
  // 石扉
  const door = box(materials.stone, 3.6, 4, 0.8, 0, 2, 12);
  root.add(door);
  occluders.push(door);
  const doorFrame = [box(materials.stone, 1.2, 5, 1.2, -2.4, 2.5, 12), box(materials.stone, 1.2, 5, 1.2, 2.4, 2.5, 12), box(materials.stone, 6, 1, 1.2, 0, 5, 12)];
  root.add(...doorFrame);
  occluders.push(...doorFrame);

  // ── 地下水路：川、水門、水車、渡り板 ──
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 11), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, LOW - 0.8, -13.5);
  root.add(water);
  const sluiceGate = box(materials.wood, 2, 2.2, 0.3, -18, LOW + 1.1, -7.6);
  const sluicePosts = [box(materials.stone, 0.5, 3, 0.8, -19.3, LOW + 1.5, -7.6), box(materials.stone, 0.5, 3, 0.8, -16.7, LOW + 1.5, -7.6)];
  root.add(sluiceGate, ...sluicePosts);
  occluders.push(sluiceGate, ...sluicePosts);
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.15, 6, 24), materials.wood);
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const paddle = box(materials.wood, 0.25, 2.3, 0.9, 0, 0, 0);
    paddle.position.set(Math.cos((i / 8) * Math.PI * 2) * 1.6, Math.sin((i / 8) * Math.PI * 2) * 1.6, 0);
    paddle.rotation.z = (i / 8) * Math.PI * 2;
    wheel.add(paddle);
  }
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(-22, LOW + 0.8, -13);
  root.add(wheel);
  const planks = new THREE.Group();
  for (let z = 0; z < 11; z += 1.1) planks.add(box(materials.wood, 2.4, 0.2, 1, 0, -0.1, -z - 0.5));
  planks.position.set(-9, LOW, -8);
  root.add(planks);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 13, 6), materials.iron);
  chain.rotation.z = Math.PI / 2;
  chain.position.set(-15.5, LOW + 0.4, -13);
  root.add(chain);
  const midStone = createEchoStone(materials);
  midStone.group.position.set(6, LOW, -2);
  root.add(midStone.group);

  // ── 出口の向こう：結晶の谷（遠景） ──
  const far = landmarkMaterial(crystalMaterial, 0.25);
  for (let i = 0; i < 18; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), far);
    const s = 6 + random() * 10;
    c.scale.set(s * 0.4, s * 2, s * 0.4);
    c.position.set((random() - 0.5) * 140, -10 + random() * 10, -110 - random() * 90);
    c.rotation.set((random() - 0.5) * 0.5, random() * 3, (random() - 0.5) * 0.5);
    root.add(c);
  }
  const exitLight = new THREE.PointLight('#e8f6ff', 20, 30, 1.4);
  exitLight.position.set(0, 6, -66);
  root.add(exitLight);

  // ── 状態と動き ──
  let direction = REFLECTOR_START;
  let doorT = -1;
  let sluiceT = -1;
  let wheelSpeed = 0;
  const glowTarget = { receptor: 0.3 };

  function aimBeam(dir) {
    direction = dir;
    mirror.rotation.y = Math.atan2(DIRS[dir][0], DIRS[dir][1]) + Math.PI;
    // 光は向いた方向へ進み、結晶か壁で止まる
    const lengths = [11, 17, 8, 7];
    const length = lengths[dir];
    const [dx, dz] = DIRS[dir];
    outBeam.scale.y = length;
    outBeam.position.set(-6 + dx * length / 2, 1.6, 24 + dz * length / 2);
    outBeam.rotation.set(dz !== 0 ? Math.PI / 2 : 0, 0, dx !== 0 ? Math.PI / 2 : 0);
    glowTarget.receptor = dir === 1 ? 2.4 : 0.3;
    decoyMaterial.emissiveIntensity = dir === 3 ? 1.6 : 0.3;
  }

  function applyState(flags) {
    aimBeam(flags.lightOpen ? 1 : REFLECTOR_START);
    door.position.y = flags.lightOpen ? -2.2 : 2;
    receptorMaterial.emissiveIntensity = flags.lightOpen ? 2.4 : 0.3;
    planks.position.x = flags.planksSet ? 0 : -9;
    sluiceGate.position.y = flags.planksSet ? LOW + 2.6 : LOW + 1.1;
    wheelSpeed = flags.planksSet ? 0.8 : 0;
    midStone.setActive(Boolean(flags.midStoneLit));
    doorT = -1; sluiceT = -1;
  }

  function handleAction(name) {
    if (name.startsWith('reflector:')) { aimBeam(Number(name.split(':')[1])); return true; }
    if (name === 'openDoor') { doorT = 0; return true; }
    if (name === 'openSluice') { sluiceT = 0; return true; }
    return false;
  }

  function update(time, dt, flags) {
    receptorMaterial.emissiveIntensity += (glowTarget.receptor - receptorMaterial.emissiveIntensity) * 0.08;
    if (doorT >= 0 && doorT < 1) { doorT = Math.min(1, doorT + dt / 2.4); door.position.y = 2 - 4.2 * doorT; }
    if (sluiceT >= 0 && sluiceT < 1) {
      sluiceT = Math.min(1, sluiceT + dt / 4);
      sluiceGate.position.y = LOW + 1.1 + 1.5 * Math.min(1, sluiceT * 3);
      wheelSpeed = 0.8 * sluiceT;
      planks.position.x = -9 + 9 * (sluiceT * sluiceT * (3 - 2 * sluiceT));
    }
    wheel.rotation.x += wheelSpeed * dt;
    shaftMaterial.opacity = 0.1 + 0.03 * Math.sin(time * 0.7);
    beamMaterial.opacity = 0.5 + 0.1 * Math.sin(time * 3);
    midStone.setActive(Boolean(flags?.midStoneLit));
    midStone.update(time);
  }

  function dispose() {
    scene.remove(root);
    root.traverse((object) => {
      object.geometry?.dispose();
      if (object.material && !Object.values(materials).includes(object.material) && object.material !== cliffMaterial) object.material.dispose?.();
    });
  }

  return { root, occluders, applyState, handleAction, update, dispose };
}
