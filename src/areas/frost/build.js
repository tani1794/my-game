// 霜葬峡谷の見た目：雪の崖と雪をかぶった針葉樹、灯守の小屋と炉、風除け、熱の導管と弁（波・矢じり・灯の刻印）、
// 崩れた石橋と凍った川・水門、橋の下の水路、白灯の避難所（記録・白い灯）、排水の輪と水の張った中庭、
// 凍った落とし格子、尾根の吹雪・風向板・裂けた旗・鎖と氷の門、白角の静庭、戦場（氷の柱・枝角のような氷）、降る雪。
import * as THREE from 'three';
import { mulberry32 } from '../../world/random.js';
import { worldUV } from '../../chapter/materials.js';
import { loadGLTF, measureModel, withFallback } from '../../assets.js';
import { asset } from '../../paths.js';
import { floorMesh } from '../kitView.js';
import { createEchoStone, cliffMaterial, landmarkMaterial } from '../props.js';
import { FROST, FROST_HEIGHTS, FROST_ARENA, VALVE, VANES } from './layout.js';

const { GROUND, CHANNEL, YARD, RIDGE } = FROST_HEIGHTS;
const smooth = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
// 弁の向き（0 東・1 北・2 西）の、熱の出口
const VALVE_DIRS = [[1, 0], [0, -1], [-1, 0]];
const VANE_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 北・東・南・西（x, z）

function box(material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), 2), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function engraving(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  draw(ctx);
  return new THREE.CanvasTexture(canvas);
}
// 波（西の水門）・矢じり（北の橋）・灯（東の小屋）
const MARKS = {
  wave: () => engraving((ctx) => {
    for (const y of [44, 84]) {
      ctx.beginPath();
      for (let x = 14; x <= 114; x += 4) ctx.lineTo(x, y + Math.sin(x / 10) * 10);
      ctx.stroke();
    }
  }),
  arrow: () => engraving((ctx) => {
    ctx.beginPath(); ctx.moveTo(64, 110); ctx.lineTo(64, 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(36, 52); ctx.lineTo(64, 20); ctx.lineTo(92, 52); ctx.stroke();
  }),
  lamp: () => engraving((ctx) => {
    ctx.beginPath(); ctx.moveTo(64, 20); ctx.quadraticCurveTo(92, 60, 64, 84); ctx.quadraticCurveTo(36, 60, 64, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, 104); ctx.lineTo(88, 104); ctx.stroke();
  }),
};

// 灯守ミレイ：厚い外套に頭巾、手には小さなランタン。仮の姿（専用の模型はない）
function createMirei() {
  const group = new THREE.Group();
  group.name = 'mirei';
  const coat = new THREE.MeshStandardMaterial({ color: '#7a3a2e', roughness: 0.95 });
  const wool = new THREE.MeshStandardMaterial({ color: '#e9e2d6', roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e7c8ae', roughness: 0.8 });
  const add = (geometry, material, [x, y, z], [rx, ry, rz] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(new THREE.ConeGeometry(0.48, 1.35, 12), coat, [0, 0.68, 0]);
  add(new THREE.SphereGeometry(0.17, 12, 10), skin, [0, 1.52, 0.03]);
  add(new THREE.ConeGeometry(0.27, 0.45, 12, 1, true), coat, [0, 1.66, -0.02]);
  add(new THREE.TorusGeometry(0.2, 0.07, 6, 16), wool, [0, 1.36, 0], [Math.PI / 2, 0, 0]);
  add(new THREE.CapsuleGeometry(0.07, 0.4, 4, 6), coat, [0.3, 1.0, 0.12], [0.5, 0, 0.3]);
  add(new THREE.CapsuleGeometry(0.07, 0.4, 4, 6), coat, [-0.3, 1.05, 0.05], [0.2, 0, -0.25]);
  const lantern = add(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 6), new THREE.MeshBasicMaterial({ color: '#ffe0a0' }), [0.38, 0.78, 0.32]);
  const light = new THREE.PointLight('#ffcf8a', 3, 8, 1.8);
  light.position.copy(lantern.position);
  group.add(light);
  return { group, light, materials: [coat, wool, skin, lantern.material] };
}

export async function buildFrost(scene, materials, { lite = false, load = loadGLTF } = {}) {
  const root = new THREE.Group();
  root.name = 'area-frost';
  scene.add(root);
  const { level } = FROST;
  const occluders = [];
  const random = mulberry32(457);
  const owned = new Set();
  const own = (material) => { owned.add(material); return material; };
  const textures = [];

  const snow = own(materials.stone.clone());
  snow.color.set('#e9eef2');
  const stone = own(materials.stone.clone());
  stone.color.set('#8a949b');
  const channelStone = own(materials.stone.clone());
  channelStone.color.set('#5f6b73');
  const snowCapEarly = own(new THREE.MeshStandardMaterial({ color: '#f2f6f9', roughness: 1 }));
  const ice = own(new THREE.MeshStandardMaterial({ color: '#cfeefc', emissive: '#6fc6ff', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.88 }));
  const iron = materials.iron;
  const wood = materials.wood;

  // ── 床 ──
  const special = new Set(['arena', 'exit']);
  for (const floor of level.floors) {
    if (special.has(floor.id)) continue;
    const material = floor.id === 'channel' || floor.id === 'yard' ? channelStone : floor.id.includes('Stairs') || floor.id.startsWith('bridge') ? stone : snow;
    const depth = floor.id === 'ridge' ? RIDGE + 8 : floor.id === 'climb' || floor.id === 'gateStairs' ? 9 : 6;
    const mesh = floorMesh(floor, material, depth);
    root.add(mesh);
    if (floor.id === 'ridge') mesh.traverse((m) => { if (m.isMesh) occluders.push(m); });
    // 中庭は、排水するまで見えない（水の下）
    if (floor.id === 'yard' || floor.id === 'yardStairs') mesh.userData.drained = true;
  }
  const drainedFloors = root.children.filter((m) => m.userData.drained);
  // 歩ける床のまわりの雪原（見た目だけ。歩ける範囲の端には雪の吹きだまりを置く）
  for (const [z0, z1] of [[150, 226], [106, 129], [-62, 31]]) {
    const field = new THREE.Mesh(new THREE.PlaneGeometry(90, z1 - z0), snow);
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, -0.04, (z0 + z1) / 2);
    field.receiveShadow = true;
    root.add(field);
  }
  // 水路と中庭の縁の土手（階段と橋の所は空ける）
  const bank = (x0, x1, z0, z1, bottom) => {
    const mesh = box(snow, x1 - x0, -bottom, z1 - z0, (x0 + x1) / 2, bottom / 2 - 0.05, (z0 + z1) / 2);
    root.add(mesh);
  };
  bank(-45, -13.6, 146.6, 150, CHANNEL);
  bank(-10.4, -2.2, 146.6, 150, CHANNEL);
  bank(2.2, 45, 146.6, 150, CHANNEL);
  bank(-45, -2.2, 128.9, 131.6, CHANNEL);
  bank(2.2, 12.4, 128.9, 131.6, CHANNEL);
  bank(15.6, 45, 128.9, 131.6, CHANNEL);
  bank(-45, -2.2, 103, 106, YARD);
  bank(2.2, 45, 103, 106, YARD);
  const drift = (x, z, s) => {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snowCapEarly);
    mound.scale.y = 0.45;
    mound.position.set(x, 0, z);
    root.add(mound);
  };
  for (let z = 152; z <= 174; z += 3.2) { drift(-17.6, z, 1.8); drift(17.6, z, 1.8); }
  for (let z = 177; z <= 188; z += 3) { drift(-3.6, z, 1.4); drift(3.6, z, 1.4); }
  for (let z = 107; z <= 127; z += 3.2) { drift(-15.6, z, 1.8); drift(15.6, z, 1.8); }
  for (const x of [-12, -8, -4, 4, 8, 12]) drift(x, 105, 1.2);
  for (let a = 0; a < Math.PI * 2; a += 0.22) {
    const south = Math.cos(a) > 0.97;
    const north = Math.cos(a) < -0.97;
    if (!south && !north) drift(FROST_ARENA.x + Math.sin(a) * (FROST_ARENA.radius + 1.2), FROST_ARENA.z + Math.cos(a) * (FROST_ARENA.radius + 1.2), 1.6);
  }
  const valleyFloor = new THREE.Mesh(new THREE.PlaneGeometry(260, 360), own(new THREE.MeshStandardMaterial({ color: '#cfd8de', roughness: 1 })));
  valleyFloor.rotation.x = -Math.PI / 2;
  valleyFloor.position.set(0, -14, 90);
  root.add(valleyFloor);

  // ── 雪の崖（谷の壁） ──
  const snowCap = own(new THREE.MeshStandardMaterial({ color: '#f2f6f9', roughness: 1, flatShading: true }));
  const addRock = (x, y, z, s, sy = 1.6) => {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), cliffMaterial);
    mesh.position.set(x, y, z);
    mesh.scale.y = sy;
    mesh.rotation.set(random() * 3, random() * 3, random() * 3);
    root.add(mesh);
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.75, 0), snowCap);
    cap.position.set(x, y + s * sy * 0.75, z);
    cap.scale.y = 0.45;
    cap.rotation.y = random() * 3;
    root.add(cap);
    return mesh;
  };
  for (let z = -60; z <= 225; z += 11) {
    const half = z > 145 ? 22 : z > 105 ? 24 : z > 68 ? 26 : z > 30 ? 32 : 34;
    addRock(-half - 8 - random() * 6, 2 + random() * 6, z + random() * 4, 9 + random() * 5);
    addRock(half + 8 + random() * 6, 2 + random() * 6, z + random() * 4, 9 + random() * 5);
  }
  for (let x = -30; x <= 30; x += 10) addRock(x, 4, 224 + random() * 4, 9);
  // 遠景：凍った滝と白い峰
  const far = own(landmarkMaterial(snowCap, 0.3));
  for (let i = 0; i < 12; i++) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(18 + random() * 14, 50 + random() * 40, 6), far);
    const side = i % 2 ? 1 : -1;
    peak.position.set(side * (90 + random() * 60), 0, -60 + random() * 260);
    root.add(peak);
  }
  const frozenFall = new THREE.Mesh(new THREE.PlaneGeometry(14, 70), own(new THREE.MeshStandardMaterial({ color: '#d9f2ff', emissive: '#7fcfff', emissiveIntensity: 0.25, roughness: 0.2, transparent: true, opacity: 0.85 })));
  frozenFall.position.set(-40, 10, -60);
  frozenFall.rotation.y = 0.45;
  root.add(frozenFall);

  // ── 雪をかぶった針葉樹（読めなければ、円錐の木） ──
  const pine = await withFallback(load(asset('models/nature/pine_default.glb')).then((gltf) => { measureModel(gltf.scene); return gltf.scene; }), () => null);
  const treeSpots = [];
  for (let z = 150; z <= 210; z += 6) { treeSpots.push([-18 - random() * 4, z]); treeSpots.push([18 + random() * 4, z]); }
  for (let z = 108; z <= 128; z += 7) { treeSpots.push([-17 - random() * 3, z]); treeSpots.push([17 + random() * 3, z]); }
  for (const [x, z] of [[-12, 30], [12, 30], [-10, 22], [10, 22]]) treeSpots.push([x, z]);
  const treeMaterial = own(new THREE.MeshStandardMaterial({ color: '#4a6a5c', roughness: 1, flatShading: true }));
  const treeSnow = own(new THREE.MeshStandardMaterial({ color: '#f4f8fa', roughness: 1, flatShading: true }));
  const shown = lite ? treeSpots.filter((_, i) => i % 2 === 0) : treeSpots;
  for (const [x, z] of shown) {
    const tree = new THREE.Group();
    if (pine) {
      const model = pine.clone();
      const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
      model.scale.setScalar((5 + random() * 3) / height);
      model.traverse((part) => { if (part.isMesh) { part.material = treeMaterial; part.castShadow = !lite; } });
      tree.add(model);
    } else {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 7), treeMaterial);
      cone.position.y = 3;
      tree.add(cone);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), treeSnow);
    cap.position.y = 5.2;
    tree.add(cap);
    tree.position.set(x, 0, z);
    tree.rotation.y = random() * 6;
    root.add(tree);
  }

  // ── 入口の碑 ──
  const entryStone = createEchoStone(materials);
  entryStone.group.position.set(5, GROUND, 193);
  root.add(entryStone.group);

  // ── 灯守の野営地：小屋・炉・風除け・導管と弁 ──
  const hut = new THREE.Group();
  hut.add(box(wood, 6, 3, 4.8, 0, 1.5, 0));
  const roof = box(snowCap, 6.8, 0.5, 3.2, 0, 3.4, -1.2);
  roof.rotation.x = 0.5;
  const roof2 = box(snowCap, 6.8, 0.5, 3.2, 0, 3.4, 1.2);
  roof2.rotation.x = -0.5;
  hut.add(roof, roof2);
  const window1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), own(new THREE.MeshBasicMaterial({ color: '#ffd59a' })));
  window1.position.set(1.4, 1.8, 2.41);
  hut.add(window1);
  hut.position.set(-9, GROUND, 169);
  root.add(hut);
  occluders.push(hut.children[0]);
  // 炉：石の輪と火（風除けを上げるまでは弱々しい）
  root.add(box(stone, 3.2, 1, 3.2, 8, 0.5, 162));
  const fireMaterial = own(new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0.9 }));
  const fire = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45 - i * 0.07, 1.6 - i * 0.2, 6), fireMaterial);
    flame.position.set((i - 1.5) * 0.25, 1.6, (i % 2) * 0.3 - 0.15);
    fire.add(flame);
  }
  fire.position.set(8, 0, 162);
  root.add(fire);
  const fireLight = new THREE.PointLight('#ff9d4a', 3, 18, 1.6);
  fireLight.position.set(8, 2.6, 162);
  root.add(fireLight);
  // 風除け：炉の北に立つ鉄の板（上げると風を遮る）とレバー
  const shutters = new THREE.Group();
  for (let i = 0; i < 4; i++) shutters.add(box(iron, 1.2, 2.6, 0.12, -1.8 + i * 1.2, 1.3, 0));
  shutters.position.set(8, -2.4, 159.4);
  root.add(shutters);
  root.add(box(iron, 0.2, 1.2, 0.2, 12.5, 0.6, 168.6));
  const windLever = box(iron, 0.12, 0.9, 0.12, 12.5, 1.3, 168.6);
  windLever.rotation.x = 0.6;
  root.add(windLever);
  // 導管：炉 → 分かれ目（弁）→ 西（水門）・北（橋）・東（小屋）
  const pipeMaterial = own(new THREE.MeshStandardMaterial({ color: '#6e5a4a', metalness: 0.5, roughness: 0.6, emissive: '#ff6a2a', emissiveIntensity: 0 }));
  const pipe = (ax, az, bx, bz, material = pipeMaterial) => {
    const length = Math.hypot(bx - ax, bz - az);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, length, 8), material);
    mesh.position.set((ax + bx) / 2, 0.45, (az + bz) / 2);
    // 円柱（縦向き）を寝かせてから、管の向きへ回す
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(Math.PI / 2, Math.atan2(bx - ax, bz - az), 0);
    root.add(mesh);
    return mesh;
  };
  pipe(8, 160.5, 0, 154);
  const outlets = [
    { to: [-9, 166.6], mark: 'lamp', at: [4, 154] },
    { to: [0, 150.5], mark: 'arrow', at: [0, 152] },
    { to: [-19, 150.5], mark: 'wave', at: [-4, 154] },
  ].map((outlet) => {
    const material = own(pipeMaterial.clone());
    const mesh = pipe(0, 154, outlet.to[0], outlet.to[1], material);
    const texture = MARKS[outlet.mark]();
    textures.push(texture);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: '#ffe2c4' })));
    plaque.rotation.x = -Math.PI / 2;
    plaque.position.set(outlet.at[0], 0.72, outlet.at[1]);
    root.add(plaque);
    return { mesh, material };
  });
  // 西の管の口（凍った水門の上）
  pipe(-19, 150.5, -19, 145);
  const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 16), iron);
  valveWheel.rotation.x = Math.PI / 2;
  valveWheel.position.set(0, 1.4, 154);
  root.add(valveWheel, box(iron, 0.5, 1.2, 0.5, 0, 0.6, 154));
  const valveArrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 4), own(new THREE.MeshBasicMaterial({ color: '#ffcf8a' })));
  valveArrow.rotation.order = 'YXZ';
  root.add(valveArrow);

  // ── 崩れた石橋・凍った川・水門・橋の下の水路 ──
  for (const z of [146.5, 130]) {
    const deck = box(stone, 4.4, 0.6, z > 140 ? 7 : 4, 0, -0.3, z);
    root.add(deck);
  }
  for (const x of [-3, 3]) root.add(box(stone, 2, CHANNEL * -1 + 0.2, 2, x, CHANNEL / 2, 138));
  // 落ちた橋の石
  for (let i = 0; i < 5; i++) {
    const rubble = box(stone, 1.6, 0.8, 1.2, (random() - 0.5) * 6, CHANNEL + 0.4, 136 + random() * 4);
    rubble.rotation.set(random(), random(), random());
    root.add(rubble);
  }
  const riverIce = new THREE.Mesh(new THREE.PlaneGeometry(80, 14), own(new THREE.MeshStandardMaterial({ color: '#d4ecf7', roughness: 0.2, metalness: 0.1 })));
  riverIce.rotation.x = -Math.PI / 2;
  riverIce.position.set(0, CHANNEL + 2.2, 139);
  root.add(riverIce);
  const riverWater = new THREE.Mesh(new THREE.PlaneGeometry(80, 14), materials.water);
  riverWater.rotation.x = -Math.PI / 2;
  riverWater.position.set(0, CHANNEL - 0.5, 139);
  root.add(riverWater);
  for (const side of [-1, 1]) root.add(box(channelStone, 40, 4.4, 1, 0, CHANNEL + 2, 139 + side * 7.4));
  const sluiceIce = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), ice);
    shard.position.set((random() - 0.5) * 0.8, CHANNEL + 1 + random() * 3, 135.5 + i * 1.6);
    shard.scale.set(0.8, 1.6, 0.8);
    sluiceIce.add(shard);
  }
  sluiceIce.position.x = -20;
  root.add(sluiceIce, box(stone, 1, 6, 9, -21.5, CHANNEL + 3, 139));

  // ── 白灯の避難所 ──
  const shelter = new THREE.Group();
  shelter.add(box(stone, 6.8, 3.2, 6, 0, 1.6, 0));
  const shelterRoof = box(snowCap, 7.4, 0.6, 6.6, 0, 3.5, 0);
  shelter.add(shelterRoof);
  shelter.position.set(-8, GROUND, 117);
  root.add(shelter);
  occluders.push(shelter.children[0]);
  const whiteLamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), own(new THREE.MeshBasicMaterial({ color: '#f4fbff' })));
  whiteLamp.position.set(-4.4, 2.2, 115);
  root.add(whiteLamp, box(wood, 0.12, 2.2, 0.12, -4.4, 1.1, 115));
  const whiteLight = new THREE.PointLight('#e8f4ff', 4, 14, 1.6);
  whiteLight.position.set(-4.4, 2.4, 115);
  root.add(whiteLight);
  // 記録の束
  root.add(box(wood, 1.2, 0.9, 0.8, -4.2, 0.45, 112.5));
  for (let i = 0; i < 4; i++) root.add(box(own(new THREE.MeshStandardMaterial({ color: ['#cbb89a', '#b9a688', '#d6c6aa', '#a8987c'][i] })), 0.5, 0.12, 0.7, -4.4 + (i % 2) * 0.4, 0.96 + i * 0.12, 112.5));
  const midStone = createEchoStone(materials);
  midStone.group.position.set(5, GROUND, 114);
  root.add(midStone.group);

  // ── 排水の輪と、中庭の水 ──
  root.add(box(stone, 1.6, 1.2, 1.6, 11, 0.6, 108));
  const drainWheel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 6, 18), iron);
  drainWheel.position.set(11, 1.8, 108.9);
  root.add(drainWheel);
  const yardWater = new THREE.Mesh(new THREE.PlaneGeometry(36, 34), own(new THREE.MeshStandardMaterial({ color: '#9fc4d6', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 })));
  yardWater.rotation.x = -Math.PI / 2;
  yardWater.position.set(0, -0.6, 88);
  root.add(yardWater);
  for (const [x, z] of [[-19, 88], [19, 88]]) root.add(box(channelStone, 1.2, 4, 34, x, YARD + 1, z));

  // ── 登り口の凍った落とし格子 ──
  const portcullis = new THREE.Group();
  for (let i = 0; i < 6; i++) portcullis.add(box(ice, 0.25, 4, 0.25, -1.8 + i * 0.72, 2, 0));
  portcullis.add(box(ice, 4.2, 0.3, 0.3, 0, 3.8, 0));
  portcullis.position.set(-12.5, YARD, 71);
  portcullis.rotation.y = -0.6;
  root.add(portcullis);

  // ── 尾根：吹雪の壁・風向板・裂けた旗・鎖の柱と氷の門 ──
  const stormMaterial = own(new THREE.MeshBasicMaterial({ color: '#f6f9fb', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  const storm = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), stormMaterial);
    sheet.rotation.y = Math.PI / 2;
    sheet.position.set(i * 0.8, 4, 0);
    storm.add(sheet);
  }
  const stormCount = lite ? 300 : 700;
  const stormPositions = new Float32Array(stormCount * 3);
  for (let i = 0; i < stormCount; i++) stormPositions.set([random() * 6 - 1, random() * 8, (random() - 0.5) * 22], i * 3);
  const stormGeometry = new THREE.BufferGeometry();
  stormGeometry.setAttribute('position', new THREE.BufferAttribute(stormPositions, 3));
  const stormFlakes = new THREE.Points(stormGeometry, own(new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.9, depthWrite: false })));
  storm.add(stormFlakes);
  storm.position.set(3, RIDGE, 45);
  root.add(storm);
  const vanes = {};
  for (const [id, x, z] of [['vaneA', -18, 46], ['vaneB', -3, 38]]) {
    root.add(box(iron, 0.25, 3.2, 0.25, x, RIDGE + 1.6, z));
    const vane = new THREE.Group();
    const blade = box(iron, 0.1, 1.2, 1.8, 0, 0, -0.6);
    vane.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), iron);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = 0.6;
    vane.add(tip);
    vane.position.set(x, RIDGE + 3.2, z);
    root.add(vane);
    vanes[id] = vane;
  }
  const bannerMaterial = own(new THREE.MeshStandardMaterial({ color: '#8a2f2a', side: THREE.DoubleSide, roughness: 1 }));
  const banners = [];
  for (const [x, z] of [[-22, 52], [-10, 54], [20, 54]]) {
    root.add(box(wood, 0.15, 4, 0.15, x, RIDGE + 2, z));
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6, 1, 4), bannerMaterial);
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.set(x, RIDGE + 3.6, z + 0.9);
    root.add(cloth);
    banners.push(cloth);
  }
  root.add(box(iron, 0.6, 3, 0.6, 20, RIDGE + 1.5, 37));
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 20, 6), iron);
  chain.position.set(10, RIDGE + 3, 35.6);
  chain.rotation.z = Math.PI / 2 + 0.1;
  root.add(chain);
  // 氷の門（アーチと、塞ぐ氷）
  for (const x of [-3.6, 3.6]) root.add(box(stone, 1, 6, 1, x, RIDGE + 3, 34.5));
  root.add(box(stone, 8.2, 1, 1.2, 0, RIDGE + 6.2, 34.5));
  const iceGate = box(ice, 6.2, 5.6, 0.8, 0, RIDGE + 2.8, 34.5);
  root.add(iceGate);

  // ── 白角の静庭：石灯籠と白い枯れ木 ──
  const gateStone = createEchoStone(materials);
  gateStone.group.position.set(5, GROUND, 22);
  root.add(gateStone.group);
  for (const x of [-6, 6]) {
    root.add(box(stone, 0.6, 1.4, 0.6, x, 0.7, 24));
    root.add(box(stone, 1.1, 0.5, 1.1, x, 1.6, 24));
  }

  // ── 戦場：雪の円い床、外周の氷の柱、北の枝角のような氷（登場で光る） ──
  const arenaFloor = new THREE.Mesh(worldUV(new THREE.CylinderGeometry(FROST_ARENA.radius, FROST_ARENA.radius * 0.97, 4, 64), 3), snow);
  arenaFloor.position.set(FROST_ARENA.x, GROUND - 2, FROST_ARENA.z);
  arenaFloor.receiveShadow = true;
  root.add(arenaFloor);
  const pillarGeometry = new THREE.OctahedronGeometry(1, 0);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    if (Math.abs(Math.cos(a)) > 0.95) continue;
    const r = FROST_ARENA.radius + 2 + random() * 3;
    const pillar = new THREE.Mesh(pillarGeometry, ice);
    pillar.position.set(FROST_ARENA.x + Math.sin(a) * r, 2 + random() * 2, FROST_ARENA.z + Math.cos(a) * r);
    pillar.scale.set(1.2, 4 + random() * 4, 1.2);
    pillar.rotation.set((random() - 0.5) * 0.3, random() * 3, (random() - 0.5) * 0.3);
    root.add(pillar);
  }
  const hornMaterials = [];
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) / 4;
    const material = own(ice.clone());
    material.emissiveIntensity = 0.15;
    hornMaterials.push(material);
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 14 - Math.abs(t) * 6, 6), material);
    horn.position.set(t * 16, 4, -38 - Math.abs(t) * -5);
    horn.rotation.z = -t * 0.5;
    root.add(horn);
  }
  const hornLight = new THREE.PointLight('#9fe2ff', 0, 60, 1.2);
  hornLight.position.set(0, 10, -30);
  root.add(hornLight);
  const exitIce = box(ice, 6, 6, 1.2, 0, 3, -31.6);
  root.add(exitIce);
  const exitPath = floorMesh(level.floors.find((f) => f.id === 'exit'), snow, 6);
  root.add(exitPath);
  const afterStone = createEchoStone(materials);
  afterStone.group.position.set(5, GROUND, -24);
  root.add(afterStone.group);

  // ── 灯守ミレイ（野営地と避難所） ──
  const mireis = FROST.mirei.map((spot) => {
    const mirei = createMirei();
    mirei.group.position.set(spot.x, spot.y, spot.z);
    mirei.group.rotation.y = spot.facing;
    root.add(mirei.group);
    for (const m of mirei.materials) owned.add(m);
    return mirei;
  });

  // ── 降る雪（谷全体を、少しずつ落ちる点で） ──
  const SNOW = lite ? 1200 : 3000;
  const flakePositions = new Float32Array(SNOW * 3);
  for (let i = 0; i < SNOW; i++) flakePositions.set([(random() - 0.5) * 70, random() * 30 - 4, -40 + random() * 260], i * 3);
  const flakeGeometry = new THREE.BufferGeometry();
  flakeGeometry.setAttribute('position', new THREE.BufferAttribute(flakePositions, 3));
  const snowfall = new THREE.Points(flakeGeometry, own(new THREE.PointsMaterial({ color: '#ffffff', size: 0.1, transparent: true, opacity: 0.85, depthWrite: false })));
  snowfall.frustumCulled = false;
  root.add(snowfall);

  // ── 状態と動き ──
  let valve = VALVE.start;
  let shutterT = -1;
  let thawT = -1;
  let drainT = -1;
  let gateT = -1;
  let portT = -1;
  let calmT = -1;
  let memoryT = -1;
  let hornT = -1;
  let exitT = -1;
  const flagsNow = {};

  function aimValve(dir) {
    valve = dir;
    const [dx, dz] = VALVE_DIRS[dir];
    valveArrow.position.set(dx * 1.1, 1.4, 154 + dz * 1.1);
    valveArrow.rotation.set(Math.PI / 2, Math.atan2(dx, dz), 0);
    valveWheel.rotation.z = dir * 1.3;
  }
  function aimVane(id, dir) {
    const [dx, dz] = VANE_DIRS[dir];
    vanes[id].rotation.y = Math.atan2(dx, dz);
  }

  function applyState(flags) {
    Object.assign(flagsNow, flags);
    aimValve(flags.sluiceThawed ? VALVE.goal : VALVE.start);
    for (const [id, v] of Object.entries(VANES)) aimVane(id, flags.windCalm ? v.goal : v.start);
    shutters.position.y = flags.windGuard ? 0 : -2.4;
    windLever.rotation.x = flags.windGuard ? -0.6 : 0.6;
    sluiceIce.visible = !flags.sluiceThawed;
    sluiceIce.scale.set(1, 1, 1);
    riverIce.visible = !flags.sluiceThawed;
    riverWater.position.y = flags.sluiceThawed ? CHANNEL - 0.5 : CHANNEL + 2;
    for (const mesh of drainedFloors) mesh.visible = Boolean(flags.drainOpen);
    yardWater.visible = !flags.drainOpen;
    yardWater.position.y = -0.6;
    portcullis.visible = !flags.duelistDown;
    portcullis.scale.set(1, 1, 1);
    storm.visible = !flags.windCalm;
    stormMaterial.opacity = 0.55;
    chain.visible = !flags.iceGateOpen;
    iceGate.visible = !flags.iceGateOpen;
    iceGate.scale.set(1, 1, 1);
    exitIce.visible = !flags.isvalDefeated;
    exitPath.visible = Boolean(flags.isvalDefeated);
    hornMaterials.forEach((m) => { m.emissiveIntensity = flags.isvalDefeated ? 0.1 : 0.15; });
    hornLight.intensity = 0;
    shutterT = -1; thawT = -1; drainT = -1; gateT = -1; portT = -1; calmT = -1; hornT = -1; exitT = -1;
  }

  function handleAction(name) {
    const [head, value] = name.split(':');
    if (head === 'valve') { aimValve(Number(value)); return true; }
    if (VANES[head] && value !== undefined) { aimVane(head, Number(value)); return true; }
    if (name === 'raiseShutters') { shutterT = 0; flagsNow.windGuard = true; return true; }
    if (name === 'thawSluice') { thawT = 0; return true; }
    if (name === 'drainWater') { drainT = 0; for (const mesh of drainedFloors) mesh.visible = true; return true; }
    if (name === 'breakPortcullis') { portT = 0; return true; }
    if (name === 'calmWind') { calmT = 0; return true; }
    if (name === 'dropChain') { gateT = 0; chain.visible = false; return true; }
    if (name === 'memoryLight') { memoryT = 0; return true; }
    if (name === 'bossCrystals') { hornT = 0; return true; }
    if (name === 'bossReady') { hornT = 3; return true; }
    if (name === 'bossFade') { exitT = 0; return true; }
    return false;
  }

  function update(time, dt, flags = {}) {
    // 炉の火：風除けがないと小さく揺れ、あると大きく安定して燃える
    const strong = flags.windGuard ? 1 : 0.45;
    fire.scale.set(strong, strong * (0.85 + 0.15 * Math.sin(time * 13)), strong);
    fireLight.intensity = (flags.windGuard ? 5 : 2) + Math.sin(time * 17) * 0.6;
    // 熱の通る管が赤く光る（風除けがあるときだけ、強く）
    outlets.forEach((outlet, i) => {
      const hot = i === valve ? (flags.windGuard ? 1.2 : 0.35) : 0;
      outlet.material.emissiveIntensity += (hot * (0.8 + 0.2 * Math.sin(time * 4)) - outlet.material.emissiveIntensity) * 0.08;
    });
    pipeMaterial.emissiveIntensity = flags.windGuard ? 0.6 : 0.2;
    if (shutterT >= 0 && shutterT < 1) {
      shutterT = Math.min(1, shutterT + dt / 1.5);
      shutters.position.y = -2.4 + 2.4 * smooth(shutterT);
      windLever.rotation.x = 0.6 - 1.2 * shutterT;
    }
    if (thawT >= 0 && thawT < 1) {
      // 水門の氷が解け、川の氷が消え、水位が下がる
      thawT = Math.min(1, thawT + dt / 4);
      sluiceIce.scale.set(1 - thawT * 0.8, 1 - thawT, 1 - thawT * 0.8);
      riverIce.visible = thawT < 0.6;
      riverWater.position.y = CHANNEL + 2 - 2.5 * smooth(thawT);
      if (thawT >= 1) sluiceIce.visible = false;
    }
    if (drainT >= 0 && drainT < 1) {
      drainT = Math.min(1, drainT + dt / 3.5);
      drainWheel.rotation.z += dt * 3;
      yardWater.position.y = -0.6 - 2.6 * smooth(drainT);
      if (drainT >= 1) yardWater.visible = false;
    }
    if (portT >= 0 && portT < 1) {
      portT = Math.min(1, portT + dt / 1.2);
      portcullis.scale.set(1, Math.max(0.01, 1 - portT), 1);
      if (portT >= 1) portcullis.visible = false;
    }
    if (calmT >= 0 && calmT < 1) {
      calmT = Math.min(1, calmT + dt / 2.5);
      stormMaterial.opacity = 0.55 * (1 - calmT);
      stormFlakes.material.opacity = 0.9 * (1 - calmT);
      if (calmT >= 1) storm.visible = false;
    } else if (storm.visible) {
      // 吹雪：雪片が東から西へ流れ続ける
      const position = stormGeometry.getAttribute('position');
      for (let i = 0; i < stormCount; i++) {
        let x = position.getX(i) - dt * 9;
        if (x < -1) x += 6;
        position.setX(i, x);
      }
      position.needsUpdate = true;
    }
    if (gateT >= 0 && gateT < 1) {
      gateT = Math.min(1, gateT + dt / 1.8);
      iceGate.scale.set(1 + gateT * 0.2, Math.max(0.01, 1 - gateT), 1);
      if (gateT >= 1) iceGate.visible = false;
    }
    if (memoryT >= 0) {
      memoryT += dt;
      whiteLight.intensity = 4 + Math.max(0, Math.sin(memoryT * 2)) * 6 * Math.max(0, 1 - memoryT / 10);
      if (memoryT > 10) memoryT = -1;
    }
    if (hornT >= 0 && hornT < 3) {
      hornT = Math.min(3, hornT + dt);
      hornMaterials.forEach((m, i) => { m.emissiveIntensity = 0.15 + 1.6 * smooth(hornT * 2.5 - Math.abs(i - 4) * 0.9); });
      hornLight.intensity = 10 * smooth(hornT / 2);
    } else if (hornT >= 3) {
      hornMaterials.forEach((m) => { m.emissiveIntensity = 1.6 + 0.3 * Math.sin(time * 2); });
      hornLight.intensity = 10;
    }
    if (exitT >= 0 && exitT < 1) {
      exitT = Math.min(1, exitT + dt / 2.5);
      hornMaterials.forEach((m) => { m.emissiveIntensity = 1.6 * (1 - exitT) + 0.1; });
      hornLight.intensity = 10 * (1 - exitT);
      exitIce.scale.set(1, Math.max(0.01, 1 - exitT), 1);
      if (exitT >= 1) { exitIce.visible = false; exitPath.visible = true; hornT = -1; }
    }
    // 旗は南へなびく（風は北から）。吹雪が止むと、だらりと下がる
    banners.forEach((cloth, i) => {
      cloth.rotation.x = flags.windCalm ? -Math.PI / 2 + 1.3 : -Math.PI / 2 + 0.15 * Math.sin(time * 6 + i);
    });
    // 降る雪
    const flakes = flakeGeometry.getAttribute('position');
    for (let i = 0; i < SNOW; i++) {
      let y = flakes.getY(i) - dt * 1.4;
      if (y < -4) y += 30;
      flakes.setY(i, y);
    }
    flakes.needsUpdate = true;
    for (const mirei of mireis) mirei.light.intensity = 2.6 + Math.sin(time * 11) * 0.4;
    entryStone.setActive(true);
    midStone.setActive(Boolean(flags.frostMidLit));
    gateStone.setActive(Boolean(flags.frostGateLit));
    afterStone.setActive(Boolean(flags.isvalDefeated));
    for (const echo of [entryStone, midStone, gateStone, afterStone]) echo.update(time);
  }

  function dispose() {
    scene.remove(root);
    root.traverse((object) => { object.geometry?.dispose(); });
    for (const material of owned) material.dispose();
    for (const texture of textures) texture.dispose();
  }

  return { root, occluders, applyState, handleAction, update, dispose };
}
