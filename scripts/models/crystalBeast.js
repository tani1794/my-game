// 結晶獣（晶冠の守護獣ヴェルグラス）のモデルを作る（ブラウザで実行し、GLB に書き出す：scripts/build-crystal-beast.mjs）。
// 黒い岩の巨体：前脚と肩に重さを集め、頭は低く、胸は厚く、後脚で支える。背中・肩・前腕にシアンの結晶（大・中・小、根元は岩に埋まる）。
// 体は関節ごとに分かれた岩の部品（肩・肘・手首・股・膝・足首・首・あご・尾）。動きは実行時に src/world/beast.js が付ける。
// 単位はメートル。前は +z、全長 約10.7m、高さ 約5m（今までの結晶獣と同じ大きさ。当たり判定を変えない）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded, bodyLoft, plate, platesAlong, crystalCluster } from '../../src/areas/creatureKit.js';

// ── 材質 ──
function texture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
function createMaterials() {
  const random = seeded(41);
  // 岩肌：細かなひび割れと、粒の明暗
  const rockMap = texture(256, (ctx, s) => {
    ctx.fillStyle = '#9a9894'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3000; i++) { const v = 110 + Math.floor(random() * 110); ctx.fillStyle = `rgba(${v},${v - 4},${v - 8},0.5)`; ctx.fillRect(random() * s, random() * s, 1 + random() * 4, 1 + random() * 4); }
    ctx.strokeStyle = 'rgba(40,38,36,0.7)';
    for (let i = 0; i < 40; i++) {
      ctx.lineWidth = 1 + random() * 1.5;
      let x = random() * s; let y = random() * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (random() - 0.5) * 30; y += (random() - 0.5) * 30; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  rockMap.colorSpace = THREE.SRGBColorSpace;
  rockMap.repeat.set(2, 2);
  return {
    // 岩：粗く、金属の光沢なし。面の向きが読めるよう、平らな面で陰影をつける
    rock: new THREE.MeshStandardMaterial({ name: 'beast_rock', color: '#5d5a58', map: rockMap, roughness: 0.96, metalness: 0, flatShading: true }),
    rockDark: new THREE.MeshStandardMaterial({ name: 'beast_rock_dark', color: '#3f3d3c', map: rockMap, roughness: 0.98, metalness: 0, flatShading: true }),
    // 石の爪：岩より明るく、少しだけ滑らか
    claw: new THREE.MeshStandardMaterial({ name: 'beast_claw', color: '#6f6a62', roughness: 0.7, metalness: 0, flatShading: true }),
    // 結晶：シアン。稜線が明るく、面ごとに明暗が出るよう平らな面。光の強さは実行時に変える
    crystal: new THREE.MeshStandardMaterial({ name: 'beast_crystal', color: '#2fb6d2', emissive: '#0e86a8', emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, flatShading: true }),
    eye: new THREE.MeshStandardMaterial({ name: 'beast_eye', color: '#bff6ff', emissive: '#5fe8ff', emissiveIntensity: 2.4 }),
  };
}

// 部品（関節の節）：center は世界での回転の中心。子の部品はこの下に。
// 中心は書き出さない別の表に覚える（userData の pivot という名前は、書き出しと読み直しで位置が消えるため使わない）
const centers = new WeakMap();
function joint(name, parent, center) {
  const node = new THREE.Group();
  node.name = name;
  const parentWorld = centers.get(parent) ?? [0, 0, 0];
  node.position.set(center[0] - parentWorld[0], center[1] - parentWorld[1], center[2] - parentWorld[2]);
  centers.set(node, center);
  parent.add(node);
  return node;
}
// 世界の座標で作った形を、節の下に置く（節の位置を引く）
function put(node, geometries, material, name) {
  const [px, py, pz] = centers.get(node);
  const g = mergeGeometries(geometries.map((x) => (x.index ? x.toNonIndexed() : x)), false);
  g.translate(-px, -py, -pz);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = `${name}_mesh`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  node.add(mesh);
  return mesh;
}

export function buildCrystalBeast() {
  const random = seeded(7);
  const m = createMaterials();
  const root = new THREE.Group();
  root.name = 'CrystalBeast';
  const body = joint('body', root, [0, 2.9, 0]);

  // ── 胴：腰（低い）→ 胴 → 厚い胸と盛り上がった肩（高い）→ 首の付け根。上に岩の板の重なり ──
  const torso = [bodyLoft([
    { p: [0, 2.55, -3.5], rx: 0.8, ry: 0.75 },
    { p: [0, 2.75, -2.4], rx: 1.35, ry: 1.05 },
    { p: [0, 2.95, -0.9], rx: 1.55, ry: 1.25 },
    { p: [0, 3.25, 0.6], rx: 1.95, ry: 1.55 },
    { p: [0, 3.3, 1.7], rx: 2.0, ry: 1.5 },
    { p: [0, 3.0, 2.7], rx: 1.25, ry: 1.05 },
  ], { segments: 16, steps: 5, rough: 0.08, seed: 1 })];
  // 背骨に沿った大きな板（首 → 腰）と、脇へ下る板
  torso.push(...platesAlong([0, 3.4, 2.4], [0, 2.9, -3.0], 9, { radius: 1.3, around: [0, -0.7, 0.7], size: [0.75, 0.28, 0.7], seedBase: 100 }));
  torso.push(...platesAlong([0, 3.2, 1.8], [0, 2.8, -2.4], 6, { radius: 1.45, around: [-1.35, 1.35], size: [0.6, 0.24, 0.65], seedBase: 200 }));
  // 胸の前の重い板
  for (const [x, y, z] of [[0.7, 2.6, 2.6], [-0.7, 2.6, 2.6], [0, 2.1, 2.2]]) torso.push(plate([x, y, z], [x * 0.5, -0.2, 1], [0, -1, 0.2], [0.55, 0.25, 0.6], 300 + x * 10));
  put(body, torso, m.rock, 'torso');

  // ── 首・頭・あご：頭は肩より低く前へ。額と頬の重い板、細いシアンの目、石の牙 ──
  const neck = joint('neck', body, [0, 3.0, 2.6]);
  put(neck, [bodyLoft([{ p: [0, 3.05, 2.3], rx: 1.15, ry: 0.95 }, { p: [0, 2.85, 3.1], rx: 0.95, ry: 0.8 }, { p: [0, 2.7, 3.5], rx: 0.85, ry: 0.72 }], { segments: 14, steps: 4, rough: 0.07, seed: 3 })], m.rockDark, 'neck');
  const head = joint('head', neck, [0, 2.75, 3.4]);
  put(head, [
    bodyLoft([{ p: [0, 2.75, 3.3], rx: 0.85, ry: 0.65 }, { p: [0, 2.7, 4.2], rx: 0.82, ry: 0.55 }, { p: [0, 2.55, 5.0], rx: 0.55, ry: 0.38 }], { segments: 12, steps: 4, rough: 0.08, seed: 5 }),
    plate([0, 3.25, 3.9], [0, 1, 0.25], [0, -0.2, 1], [0.75, 0.22, 0.8], 401), // 額
    plate([0.62, 2.95, 4.2], [1, 0.4, 0.2], [0, -0.1, 1], [0.32, 0.18, 0.75], 402), // 頬
    plate([-0.62, 2.95, 4.2], [-1, 0.4, 0.2], [0, -0.1, 1], [0.32, 0.18, 0.75], 403),
    plate([0.45, 3.2, 3.5], [0.6, 1, -0.3], [0.3, 0.3, -1], [0.22, 0.12, 0.55], 404), // 頭の後ろへ伸びる角のような板
    plate([-0.45, 3.2, 3.5], [-0.6, 1, -0.3], [-0.3, 0.3, -1], [0.22, 0.12, 0.55], 405),
  ], m.rock, 'head');
  put(head, [
    new THREE.SphereGeometry(0.08, 8, 6).scale(1.6, 0.6, 1).translate(0.4, 2.9, 4.75),
    new THREE.SphereGeometry(0.08, 8, 6).scale(1.6, 0.6, 1).translate(-0.4, 2.9, 4.75),
  ], m.eye, 'eyes');
  const fangs = [];
  for (const x of [-0.38, -0.18, 0.18, 0.38]) fangs.push(new THREE.ConeGeometry(0.06, 0.32, 5).rotateX(Math.PI).translate(x, 2.25, 5.05));
  put(head, fangs, m.claw, 'fangs');
  const jaw = joint('jaw', head, [0, 2.4, 3.7]);
  put(jaw, [bodyLoft([{ p: [0, 2.3, 3.7], rx: 0.7, ry: 0.28 }, { p: [0, 2.15, 4.5], rx: 0.6, ry: 0.24 }, { p: [0, 2.15, 5.05], rx: 0.4, ry: 0.18 }], { segments: 10, steps: 3, rough: 0.08, seed: 7 })], m.rockDark, 'jaw');

  // ── 前脚（巨大）：肩 → 肘 → 手首 → こぶし。腕の流れに沿った板と、前腕の結晶。石の爪 ──
  const legs = [];
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const shoulder = [sign * 1.8, 3.65, 1.6];
    const elbow = [sign * 2.35, 2.0, 2.0];
    const wrist = [sign * 2.2, 0.7, 2.75];
    const upper = joint(`fore_${side}_upper`, body, shoulder);
    put(upper, [
      bodyLoft([{ p: [shoulder[0] - sign * 0.2, shoulder[1] + 0.25, shoulder[2]], rx: 1.08, ry: 1.05 }, { p: lerp(shoulder, elbow, 0.5), rx: 0.85, ry: 0.82 }, { p: elbow, rx: 0.62, ry: 0.6 }], { segments: 12, steps: 3, rough: 0.08, seed: 11 + sign }),
      ...platesAlong([shoulder[0] + sign * 0.2, shoulder[1] + 0.2, shoulder[2]], elbow, 3, { radius: 0.75, around: [-0.5, 0.4], size: [0.55, 0.22, 0.6], seedBase: 500 + sign * 50, outward: [sign, 0.6, 0] }),
    ], m.rock, `fore_${side}_upper`);
    const lower = joint(`fore_${side}_lower`, upper, elbow);
    put(lower, [
      bodyLoft([{ p: elbow, rx: 0.6, ry: 0.6 }, { p: lerp(elbow, wrist, 0.45), rx: 0.98, ry: 1.0 }, { p: wrist, rx: 0.62, ry: 0.6 }], { segments: 12, steps: 3, rough: 0.09, seed: 13 + sign }),
      ...platesAlong(elbow, wrist, 3, { radius: 0.78, around: [-0.6, 0, 0.6, 1.4], size: [0.45, 0.2, 0.55], seedBase: 600 + sign * 50, outward: [sign, 0, 0.3] }),
    ], m.rockDark, `fore_${side}_lower`);
    put(lower, crystalCluster(lerp(elbow, wrist, 0.3).map((v, i) => v + [sign * 0.6, 0.15, -0.2][i]), [sign * 0.8, 0.5, -0.4], { count: 6, big: 1.1, random, spread: 0.45 }), m.crystal, `fore_${side}_crystals`);
    const paw = joint(`fore_${side}_paw`, lower, wrist);
    const claws = [];
    for (let k = 0; k < 4; k++) {
      const x = wrist[0] + sign * (-0.4 + k * 0.27);
      claws.push(new THREE.ConeGeometry(0.1, 0.55, 5).rotateX(Math.PI / 2 + 0.75).translate(x, 0.16, wrist[2] + 0.72));
    }
    put(paw, [bodyLoft([{ p: [wrist[0], 0.55, wrist[2] - 0.15], rx: 0.6, ry: 0.42 }, { p: [wrist[0], 0.35, wrist[2] + 0.45], rx: 0.66, ry: 0.32 }], { segments: 10, steps: 3, rough: 0.1, seed: 17 + sign })], m.rock, `fore_${side}_paw`);
    put(paw, claws, m.claw, `fore_${side}_claws`);
    legs.push(upper, lower, paw);
  }

  // ── 後脚：股 → 膝 → 足首 → 足（体重を支える太い腿） ──
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const hip = [sign * 1.2, 2.6, -2.3];
    const knee = [sign * 1.5, 1.45, -1.7];
    const ankle = [sign * 1.4, 0.55, -2.55];
    const upper = joint(`hind_${side}_upper`, body, hip);
    put(upper, [
      bodyLoft([{ p: [hip[0], hip[1] + 0.2, hip[2] - 0.1], rx: 0.85, ry: 0.85 }, { p: lerp(hip, knee, 0.55), rx: 0.68, ry: 0.65 }, { p: knee, rx: 0.48, ry: 0.48 }], { segments: 12, steps: 3, rough: 0.08, seed: 19 + sign }),
      ...platesAlong(hip, knee, 2, { radius: 0.7, around: [0, 0.8], size: [0.5, 0.2, 0.55], seedBase: 700 + sign * 50, outward: [sign, 0.3, 0] }),
    ], m.rock, `hind_${side}_upper`);
    const lower = joint(`hind_${side}_lower`, upper, knee);
    put(lower, [bodyLoft([{ p: knee, rx: 0.46, ry: 0.46 }, { p: lerp(knee, ankle, 0.5), rx: 0.42, ry: 0.4 }, { p: ankle, rx: 0.34, ry: 0.32 }], { segments: 10, steps: 3, rough: 0.09, seed: 23 + sign })], m.rockDark, `hind_${side}_lower`);
    const foot = joint(`hind_${side}_foot`, lower, ankle);
    const claws = [];
    for (let k = 0; k < 3; k++) claws.push(new THREE.ConeGeometry(0.085, 0.42, 5).rotateX(Math.PI / 2 + 0.75).translate(ankle[0] + sign * (-0.24 + k * 0.24), 0.13, ankle[2] + 0.62));
    put(foot, [bodyLoft([{ p: [ankle[0], 0.42, ankle[2] - 0.1], rx: 0.42, ry: 0.32 }, { p: [ankle[0], 0.26, ankle[2] + 0.45], rx: 0.46, ry: 0.24 }], { segments: 10, steps: 3, rough: 0.1, seed: 29 + sign })], m.rock, `hind_${side}_foot`);
    put(foot, claws, m.claw, `hind_${side}_claws`);
    legs.push(upper, lower, foot);
  }

  // ── 尾：短く太い節が2つ。結晶の棘 ──
  const tail1 = joint('tail1', body, [0, 2.6, -3.3]);
  put(tail1, [bodyLoft([{ p: [0, 2.6, -3.3], rx: 0.7, ry: 0.62 }, { p: [0, 2.25, -4.25], rx: 0.5, ry: 0.45 }], { segments: 10, steps: 3, rough: 0.09, seed: 31 })], m.rock, 'tail1');
  put(tail1, crystalCluster([0, 3.0, -3.7], [0, 1, -0.6], { count: 4, big: 0.9, random, spread: 0.3 }), m.crystal, 'tail1_crystals');
  const tail2 = joint('tail2', tail1, [0, 2.25, -4.25]);
  put(tail2, [bodyLoft([{ p: [0, 2.25, -4.25], rx: 0.48, ry: 0.42 }, { p: [0, 1.75, -5.25], rx: 0.16, ry: 0.14 }], { segments: 10, steps: 3, rough: 0.08, seed: 37 })], m.rockDark, 'tail2');
  put(tail2, crystalCluster([0, 2.35, -4.75], [0, 0.8, -1], { count: 3, big: 0.6, random, spread: 0.18 }), m.crystal, 'tail2_crystals');

  // ── 背中・肩の結晶：肩と背骨に大きいもの（2m 前後）、脇腹は小さい。根元は板の間に埋まる ──
  const crystals = [];
  const spine = [[0, 4.75, 1.4, 2.4], [0.7, 4.55, 0.9, 1.9], [-0.7, 4.5, 0.7, 1.9], [0, 4.45, 0.0, 2.1], [0.55, 4.25, -0.8, 1.5], [-0.55, 4.2, -1.0, 1.5], [0, 3.95, -1.7, 1.35], [0, 3.6, -2.5, 1.0]];
  for (const [x, y, z, big] of spine) crystals.push(...crystalCluster([x, y, z], [x * 0.7, 1, -0.2], { count: 5, big, random, spread: 0.5 }));
  for (const sign of [-1, 1]) {
    crystals.push(...crystalCluster([sign * 1.8, 4.3, 1.5], [sign * 0.9, 1, 0.1], { count: 5, big: 1.5, random, spread: 0.45 }));
    crystals.push(...crystalCluster([sign * 1.45, 3.3, -0.7], [sign, 0.5, 0], { count: 3, big: 0.55, random, spread: 0.5 }));
  }
  put(body, crystals, m.crystal, 'back_crystals');

  root.userData.joints = [body, neck, head, jaw, ...legs, tail1, tail2].map((node) => node.name);
  root.userData.model = 'crystal-beast';
  return { scene: root };
}

const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
