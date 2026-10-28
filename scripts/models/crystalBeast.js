// 結晶獣（晶冠の守護獣ヴェルグラス）のモデルを作る（ブラウザで実行し、GLB に書き出す：scripts/build-crystal-beast.mjs）。
// 黒い岩の巨体：前脚と肩に重さを集め、頭は低く、胸は厚く、後脚で支える。背中・肩・前腕にシアンの結晶（大・中・小、根元は岩に埋まる）。
// 体は関節ごとに分かれた岩の部品（肩・肘・手首・股・膝・足首・首・あご・尾）。動きは実行時に src/world/beast.js が付ける。
// 単位はメートル。前は +z、全長 約10.6m（今までの結晶獣とほぼ同じ。当たり判定は beastBrain の数値のままで変えない）。
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
    rock: new THREE.MeshStandardMaterial({ name: 'beast_rock', color: '#55524f', map: rockMap, roughness: 0.96, metalness: 0, flatShading: true }),
    rockDark: new THREE.MeshStandardMaterial({ name: 'beast_rock_dark', color: '#3b3938', map: rockMap, roughness: 0.98, metalness: 0, flatShading: true }),
    // 石の爪：岩より明るく、少しだけ滑らか
    claw: new THREE.MeshStandardMaterial({ name: 'beast_claw', color: '#6f6a62', roughness: 0.7, metalness: 0, flatShading: true }),
    // 結晶：シアン。稜線が明るく、面ごとに明暗が出るよう平らな面。光の強さは実行時に変える
    crystal: new THREE.MeshStandardMaterial({ name: 'beast_crystal', color: '#2aa6c4', emissive: '#0a6f8c', emissiveIntensity: 0.75, roughness: 0.18, metalness: 0.15, flatShading: true }),
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
  const body = joint('body', root, [0, 3.2, 0]);

  // ── 胴：腰（低い）→ 背中は肩へ向かって高く盛り上がる → 厚い胸は低く垂れる。上に岩の板の重なり ──
  // 背中の線（z → 背の高さ）：腰 3.65、肩の盛り上がり 5.25、胸の前 4.45。頭は肩より低い
  const torso = [
    bodyLoft([
      { p: [0, 2.85, -3.3], rx: 0.85, ry: 0.8 },
      { p: [0, 3.1, -2.3], rx: 1.4, ry: 1.1 },
      { p: [0, 3.4, -1.0], rx: 1.6, ry: 1.3 },
      { p: [0, 3.8, 0.6], rx: 2.0, ry: 1.45 },
      { p: [0, 3.75, 1.7], rx: 2.05, ry: 1.45 },
      { p: [0, 3.25, 2.6], rx: 1.4, ry: 1.2 },
    ], { segments: 18, steps: 5, rough: 0.09, seed: 1 }),
    // 深い胸：前脚の間へ垂れる塊
    bodyLoft([{ p: [0, 2.85, 0.4], rx: 1.25, ry: 0.85 }, { p: [0, 2.55, 1.6], rx: 1.3, ry: 0.95 }, { p: [0, 2.65, 2.5], rx: 0.95, ry: 0.75 }], { segments: 14, steps: 3, rough: 0.1, seed: 2 }),
  ];
  // 背骨に沿った大きな板（首 → 腰）、脇腹へ下る板の列、胸の前の重い板。大きさを変え、少しずつ重ねる
  torso.push(...platesAlong([0, 4.4, 2.4], [0, 3.4, -3.1], 11, { radius: 1.25, around: [0, -0.55, 0.55, -1.05, 1.05], size: [0.7, 0.26, 0.75], seedBase: 100 }));
  torso.push(...platesAlong([0, 3.6, 2.0], [0, 3.0, -2.6], 8, { radius: 1.55, around: [-1.5, 1.5, -1.9, 1.9], size: [0.55, 0.22, 0.6], seedBase: 200 }));
  for (const [x, y, z, w] of [[0.75, 2.75, 2.85, 0.6], [-0.75, 2.75, 2.85, 0.6], [0, 2.3, 2.6, 0.7], [0.55, 2.0, 1.9, 0.5], [-0.55, 2.0, 1.9, 0.5]]) {
    torso.push(plate([x, y, z], [x * 0.6, -0.35, 1], [0, -1, 0.15], [w, 0.24, 0.62], 300 + Math.round(x * 10 + y * 7)));
  }
  put(body, torso, m.rock, 'torso');

  // ── 首・頭・あご：頭は両肩の間に低く、前へ突き出す。重い眉の板、頭頂と頬の結晶、細い目、石の牙 ──
  const neck = joint('neck', body, [0, 3.45, 2.4]);
  put(neck, [
    bodyLoft([{ p: [0, 3.55, 2.2], rx: 1.2, ry: 1.0 }, { p: [0, 3.15, 3.0], rx: 1.0, ry: 0.85 }, { p: [0, 2.95, 3.4], rx: 0.9, ry: 0.75 }], { segments: 14, steps: 4, rough: 0.08, seed: 3 }),
    ...platesAlong([0, 3.9, 2.4], [0, 3.5, 3.3], 3, { radius: 0.85, around: [0, -0.7, 0.7], size: [0.5, 0.2, 0.5], seedBase: 380 }),
  ], m.rockDark, 'neck');
  const head = joint('head', neck, [0, 2.95, 3.4]);
  put(head, [
    // 頭蓋：幅が広く、前へくさび形に細くなる
    bodyLoft([{ p: [0, 3.0, 3.25], rx: 0.95, ry: 0.72 }, { p: [0, 2.85, 4.05], rx: 0.85, ry: 0.6 }, { p: [0, 2.55, 4.75], rx: 0.58, ry: 0.4 }], { segments: 14, steps: 4, rough: 0.09, seed: 5 }),
    plate([0, 3.5, 3.85], [0, 1, 0.3], [0, -0.25, 1], [0.8, 0.24, 0.85], 401), // 額
    plate([0.5, 3.25, 4.2], [0.7, 0.8, 0.5], [0.15, -0.3, 1], [0.38, 0.2, 0.55], 406), // 重い眉
    plate([-0.5, 3.25, 4.2], [-0.7, 0.8, 0.5], [-0.15, -0.3, 1], [0.38, 0.2, 0.55], 407),
    plate([0.72, 2.95, 4.0], [1, 0.3, 0.1], [0, -0.15, 1], [0.34, 0.2, 0.8], 402), // 頬
    plate([-0.72, 2.95, 4.0], [-1, 0.3, 0.1], [0, -0.15, 1], [0.34, 0.2, 0.8], 403),
    plate([0, 2.85, 4.75], [0, 0.6, 1], [0, 1, -0.2], [0.42, 0.18, 0.35], 408), // 鼻先
  ], m.rock, 'head');
  put(head, [
    ...crystalCluster([0, 3.6, 3.5], [0, 1, -0.5], { count: 6, big: 0.75, random, spread: 0.35 }),
    ...crystalCluster([0.75, 3.15, 3.55], [0.8, 0.6, -0.5], { count: 3, big: 0.4, random, spread: 0.12 }),
    ...crystalCluster([-0.75, 3.15, 3.55], [-0.8, 0.6, -0.5], { count: 3, big: 0.4, random, spread: 0.12 }),
  ], m.crystal, 'head_crystals');
  put(head, [
    new THREE.SphereGeometry(0.08, 8, 6).scale(1.7, 0.55, 1).translate(0.42, 3.02, 4.42),
    new THREE.SphereGeometry(0.08, 8, 6).scale(1.7, 0.55, 1).translate(-0.42, 3.02, 4.42),
  ], m.eye, 'eyes');
  const fangs = [];
  for (const [x, h] of [[-0.42, 0.42], [-0.22, 0.3], [0.22, 0.3], [0.42, 0.42]]) fangs.push(new THREE.ConeGeometry(0.07, h, 5).rotateX(Math.PI).translate(x, 2.32, 4.7));
  put(head, fangs, m.claw, 'fangs');
  const jaw = joint('jaw', head, [0, 2.55, 3.6]);
  put(jaw, [
    bodyLoft([{ p: [0, 2.45, 3.6], rx: 0.78, ry: 0.32 }, { p: [0, 2.25, 4.35], rx: 0.66, ry: 0.27 }, { p: [0, 2.2, 4.85], rx: 0.42, ry: 0.2 }], { segments: 12, steps: 3, rough: 0.09, seed: 7 }),
    plate([0.5, 2.3, 4.1], [1, -0.4, 0], [0, 0, 1], [0.24, 0.14, 0.5], 409),
    plate([-0.5, 2.3, 4.1], [-1, -0.4, 0], [0, 0, 1], [0.24, 0.14, 0.5], 410),
  ], m.rockDark, 'jaw');
  put(jaw, [-0.3, 0.3].map((x) => new THREE.ConeGeometry(0.06, 0.3, 5).translate(x, 2.55, 4.6)), m.claw, 'jaw_fangs');

  // ── 前脚（巨大で長い柱）：盛り上がった肩 → 外へ張る肘 → 太い前腕 → 大きな拳。腕に沿った板、肩と前腕の結晶、5本の石の爪 ──
  const legs = [];
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const shoulder = [sign * 1.85, 4.2, 1.5];
    const elbow = [sign * 2.5, 2.45, 1.9];
    const wrist = [sign * 2.35, 0.9, 2.65];
    const upper = joint(`fore_${side}_upper`, body, shoulder);
    put(upper, [
      bodyLoft([{ p: [shoulder[0] + sign * 0.1, shoulder[1] + 0.35, shoulder[2] - 0.1], rx: 1.2, ry: 1.1 }, { p: lerp(shoulder, elbow, 0.5), rx: 0.92, ry: 0.9 }, { p: lerp(shoulder, elbow, 0.94), rx: 0.66, ry: 0.64 }], { segments: 14, steps: 3, rough: 0.09, seed: 11 + sign }),
      ...platesAlong([shoulder[0] + sign * 0.3, shoulder[1] + 0.4, shoulder[2]], elbow, 4, { radius: 0.85, around: [-0.9, -0.3, 0.3, 0.9, 1.5], size: [0.6, 0.24, 0.6], seedBase: 500 + sign * 50, outward: [sign, 0.7, 0] }),
    ], m.rock, `fore_${side}_upper`);
    put(upper, crystalCluster([shoulder[0] + sign * 0.55, shoulder[1] + 0.85, shoulder[2] - 0.1], [sign * 0.75, 1, -0.15], { count: 6, big: 1.45, random, spread: 0.45 }), m.crystal, `fore_${side}_shoulder_crystals`);
    const lower = joint(`fore_${side}_lower`, upper, elbow);
    put(lower, [
      bodyLoft([{ p: lerp(elbow, wrist, 0.04), rx: 0.68, ry: 0.68 }, { p: lerp(elbow, wrist, 0.42), rx: 1.12, ry: 1.08 }, { p: lerp(elbow, wrist, 0.95), rx: 0.7, ry: 0.68 }], { segments: 14, steps: 3, rough: 0.1, seed: 13 + sign }),
      ...platesAlong(elbow, wrist, 4, { radius: 0.92, around: [-1.0, -0.4, 0.2, 0.8, 1.4, 2.2], size: [0.5, 0.22, 0.55], seedBase: 600 + sign * 50, outward: [sign, 0, 0.3] }),
    ], m.rockDark, `fore_${side}_lower`);
    // 前腕の外側から、後ろ上へ向かう結晶
    put(lower, crystalCluster(lerp(elbow, wrist, 0.3).map((v, i) => v + [sign * 0.75, 0.2, -0.45][i]), [sign * 0.7, 0.65, -0.6], { count: 7, big: 1.15, random, spread: 0.5 }), m.crystal, `fore_${side}_crystals`);
    const paw = joint(`fore_${side}_paw`, lower, wrist);
    const claws = [];
    for (let k = 0; k < 5; k++) {
      const x = wrist[0] + sign * (-0.52 + k * 0.26);
      claws.push(new THREE.ConeGeometry(0.13, 0.62, 5).rotateX(Math.PI / 2 + 0.8).translate(x, 0.17, wrist[2] + 0.82 - Math.abs(k - 2) * 0.08));
    }
    put(paw, [
      bodyLoft([{ p: [wrist[0], 0.72, wrist[2] - 0.2], rx: 0.78, ry: 0.55 }, { p: [wrist[0], 0.42, wrist[2] + 0.55], rx: 0.82, ry: 0.36 }], { segments: 12, steps: 3, rough: 0.12, seed: 17 + sign }),
      plate([wrist[0], 0.85, wrist[2] + 0.2], [0, 1, 0.4], [0, 0, 1], [0.6, 0.2, 0.5], 620 + sign),
    ], m.rock, `fore_${side}_paw`);
    put(paw, claws, m.claw, `fore_${side}_claws`);
    legs.push(upper, lower, paw);
  }

  // ── 後脚：腰で体重を支える太い腿 → 前へ出る膝 → 後ろへ曲がる足首 → 足 ──
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const hip = [sign * 1.3, 3.0, -2.4];
    const knee = [sign * 1.6, 1.7, -1.6];
    const ankle = [sign * 1.5, 0.65, -2.6];
    const upper = joint(`hind_${side}_upper`, body, hip);
    put(upper, [
      bodyLoft([{ p: [hip[0], hip[1] + 0.25, hip[2] - 0.15], rx: 0.95, ry: 0.95 }, { p: lerp(hip, knee, 0.55), rx: 0.78, ry: 0.74 }, { p: lerp(hip, knee, 0.95), rx: 0.52, ry: 0.5 }], { segments: 12, steps: 3, rough: 0.09, seed: 19 + sign }),
      ...platesAlong(hip, knee, 3, { radius: 0.78, around: [-0.4, 0.3, 1.0], size: [0.5, 0.2, 0.55], seedBase: 700 + sign * 50, outward: [sign, 0.3, 0] }),
    ], m.rock, `hind_${side}_upper`);
    put(upper, crystalCluster([hip[0] + sign * 0.45, hip[1] + 0.55, hip[2]], [sign * 0.6, 1, -0.3], { count: 3, big: 0.65, random, spread: 0.25 }), m.crystal, `hind_${side}_crystals`);
    const lower = joint(`hind_${side}_lower`, upper, knee);
    put(lower, [
      bodyLoft([{ p: lerp(knee, ankle, 0.04), rx: 0.5, ry: 0.5 }, { p: lerp(knee, ankle, 0.5), rx: 0.46, ry: 0.44 }, { p: ankle, rx: 0.36, ry: 0.34 }], { segments: 10, steps: 3, rough: 0.1, seed: 23 + sign }),
      ...platesAlong(knee, ankle, 2, { radius: 0.45, around: [0, 0.9], size: [0.36, 0.16, 0.4], seedBase: 760 + sign * 50, outward: [sign, 0, 1] }),
    ], m.rockDark, `hind_${side}_lower`);
    const foot = joint(`hind_${side}_foot`, lower, ankle);
    const claws = [];
    for (let k = 0; k < 3; k++) claws.push(new THREE.ConeGeometry(0.1, 0.46, 5).rotateX(Math.PI / 2 + 0.8).translate(ankle[0] + sign * (-0.26 + k * 0.26), 0.14, ankle[2] + 0.68));
    put(foot, [bodyLoft([{ p: [ankle[0], 0.48, ankle[2] - 0.12], rx: 0.48, ry: 0.36 }, { p: [ankle[0], 0.28, ankle[2] + 0.5], rx: 0.52, ry: 0.26 }], { segments: 10, steps: 3, rough: 0.12, seed: 29 + sign })], m.rock, `hind_${side}_foot`);
    put(foot, claws, m.claw, `hind_${side}_claws`);
    legs.push(upper, lower, foot);
  }

  // ── 尾：太い根元から細くなる2節。上に並ぶ結晶の棘（先へ小さく） ──
  const tail1 = joint('tail1', body, [0, 2.9, -3.2]);
  put(tail1, [
    bodyLoft([{ p: [0, 2.9, -3.2], rx: 0.75, ry: 0.68 }, { p: [0, 2.3, -4.3], rx: 0.52, ry: 0.46 }], { segments: 12, steps: 3, rough: 0.1, seed: 31 }),
    ...platesAlong([0, 3.0, -3.3], [0, 2.35, -4.3], 2, { radius: 0.55, around: [-0.8, 0, 0.8], size: [0.4, 0.16, 0.45], seedBase: 800 }),
  ], m.rock, 'tail1');
  put(tail1, [...crystalCluster([0, 3.4, -3.6], [0, 1, -0.5], { count: 5, big: 0.95, random, spread: 0.22 }), ...crystalCluster([0, 2.85, -4.15], [0, 1, -0.7], { count: 4, big: 0.7, random, spread: 0.15 })], m.crystal, 'tail1_crystals');
  const tail2 = joint('tail2', tail1, [0, 2.3, -4.3]);
  put(tail2, [bodyLoft([{ p: [0, 2.3, -4.3], rx: 0.5, ry: 0.44 }, { p: [0, 1.75, -5.0], rx: 0.32, ry: 0.28 }, { p: [0, 1.25, -5.6], rx: 0.12, ry: 0.1 }], { segments: 10, steps: 3, rough: 0.08, seed: 37 })], m.rockDark, 'tail2');
  put(tail2, [...crystalCluster([0, 2.55, -4.7], [0, 0.9, -0.7], { count: 4, big: 0.6, random, spread: 0.12 }), ...crystalCluster([0, 1.95, -5.2], [0, 0.6, -1], { count: 3, big: 0.45, random, spread: 0.08 })], m.crystal, 'tail2_crystals');

  // ── 背中の結晶：首から腰まで背骨に沿って列にする。肩の上がいちばん大きく（約2.4m）、前後へ小さく。両脇に小さな列。根元は板の間に埋まる ──
  const crystals = [];
  const spine = [[2.3, 4.6, 1.3], [1.6, 5.0, 2.1], [0.9, 5.1, 2.4], [0.1, 5.0, 2.0], [-0.7, 4.8, 1.7], [-1.5, 4.45, 1.4], [-2.3, 4.0, 1.1], [-3.0, 3.7, 0.8]];
  for (const [z, y, big] of spine) crystals.push(...crystalCluster([0, y, z], [0, 1, -0.25], { count: 8, big: big * 1.25, random, spread: 0.5 }));
  for (const sign of [-1, 1]) {
    for (const [z, y, big] of [[1.2, 4.7, 1.2], [0.0, 4.55, 1.0], [-1.3, 4.1, 0.75]]) {
      crystals.push(...crystalCluster([sign * 0.95, y, z], [sign * 0.7, 1, -0.2], { count: 6, big: big * 1.2, random, spread: 0.4 }));
    }
    crystals.push(...crystalCluster([sign * 1.6, 3.4, -0.6], [sign, 0.45, 0], { count: 3, big: 0.5, random, spread: 0.4 }));
  }
  crystals.push(...crystalCluster([0, 4.35, 2.9], [0, 1, 0.1], { count: 5, big: 0.9, random, spread: 0.3 })); // 首の後ろ
  put(body, crystals, m.crystal, 'back_crystals');

  root.userData.joints = [body, neck, head, jaw, ...legs, tail1, tail2].map((node) => node.name);
  root.userData.model = 'crystal-beast';
  return { scene: root };
}

const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
