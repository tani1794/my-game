// 敵「晶槍の亡兵」のモデルを作る（ブラウザで実行し、GLB に書き出す：scripts/build-spear-revenant.mjs）。
// 参考：全身を黒い鉄の鎧で覆った、成人の体格の亡兵。尖った王冠の付いた閉じた兜、鱗状の胸甲と重なった大きな肩当て、
// 足首まで届く破れた長衣と外套、肩・前腕・腿・膝から生えたシアンの結晶、柄に結晶の埋まった長槍。
// 元の skeleton_warrior.glb（KayKit Skeleton Warrior、CC0）の骨格と8個の動作をそのまま使い、
// 1) 骨の長さを、主人公と同じ成人の体格（身長約1.86m）へ伸ばす（scripts/models/crownedKnight.js の retarget）
// 2) 元の丸い体は使わず、鎧・衣・結晶を、それぞれの骨に付けた別の部品として作る（関節ごとに分かれて動く）
// 3) 外套は専用の骨5本（cape0〜4）。揺れは実行時に src/areas/foeViews.js が付ける。長衣の前の垂れは腿の骨に付き、脚と一緒に動く
// 単位はメートル。書き出したモデルは身長を合わせ直さない（userData.nativeScale）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ANIMATION_SPEED, clean, noiseTexture, loft, lerp3, dirOf, retarget, attach, mergeParts, buildCloak, spireShape } from './crownedKnight.js';
import { seeded, crystalCluster } from '../../src/areas/creatureKit.js';

function createMaterials() {
  const random = seeded(23);
  // 鱗状の鉄：下向きに重なる小札の列（縁は明るく、影は暗い）と、細かな傷
  const scales = noiseTexture(256, (ctx, s) => {
    ctx.fillStyle = '#8e8f93'; ctx.fillRect(0, 0, s, s);
    for (let y = -8; y < s + 16; y += 14) {
      for (let x = (y / 14) % 2 ? 8 : 0; x < s + 16; x += 16) {
        const v = 120 + Math.floor(random() * 60);
        ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
        ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.lineTo(x + 7, y + 10); ctx.lineTo(x, y + 15); ctx.lineTo(x - 7, y + 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(30,30,34,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(215,215,220,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y + 10); ctx.lineTo(x, y + 14); ctx.stroke();
      }
    }
    // 錆と傷
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(${110 + random() * 40},${70 + random() * 20},${50},0.25)`; ctx.fillRect(random() * s, random() * s, 2 + random() * 6, 1 + random() * 3); }
  });
  scales.colorSpace = THREE.SRGBColorSpace;
  scales.repeat.set(2, 2);
  const hammered = noiseTexture(128, (ctx, s) => {
    ctx.fillStyle = '#9a9a9c'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { const v = 100 + Math.floor(random() * 100); ctx.fillStyle = `rgba(${v},${v},${v},0.5)`; ctx.beginPath(); ctx.ellipse(random() * s, random() * s, 1 + random() * 4, 1 + random() * 3, random() * 3, 0, Math.PI * 2); ctx.fill(); }
  });
  hammered.colorSpace = THREE.SRGBColorSpace;
  const mail = noiseTexture(128, (ctx, s) => {
    ctx.fillStyle = '#1c1c1e'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#6e6e72'; ctx.lineWidth = 2;
    for (let y = 0; y < s; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < s; x += 8) { ctx.beginPath(); ctx.ellipse(x + 4, y + 4, 3.4, 2.6, 0, 0, Math.PI * 2); ctx.stroke(); }
  });
  mail.colorSpace = THREE.SRGBColorSpace;
  mail.repeat.set(5, 5);
  // 破れた黒い布：粗い織り目。裾は長く不揃いに裂け、穴があく。
  // 破れは模様の画像の透明な部分として焼き込む（GLB は透明の型を別の画像として保存できないため）
  const cloth = noiseTexture(256, (ctx, s) => {
    ctx.fillStyle = '#3a3a3e'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3000; i++) { const g = 40 + Math.floor(random() * 40); ctx.fillStyle = `rgba(${g},${g},${g + 3},0.4)`; ctx.fillRect(random() * s, random() * s, 1 + random() * 2, 4 + random() * 10); }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    // 裾（画像の下＝布の下端）：細い三角形の長い裂け目
    ctx.beginPath(); ctx.moveTo(0, s);
    for (let x = 0; x <= s; x += 5 + random() * 12) ctx.lineTo(x, s - 8 - random() * random() * 150);
    ctx.lineTo(s, s); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.ellipse(random() * s, s * (0.35 + random() * 0.6), 1 + random() * 5, 3 + random() * 12, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  });
  cloth.colorSpace = THREE.SRGBColorSpace;
  cloth.wrapS = THREE.ClampToEdgeWrapping;
  cloth.wrapT = THREE.ClampToEdgeWrapping;
  return {
    // 黒鉄：岩とは違う反射（金属らしく少し光る）。景色の映り込みが無くても形が読めるよう、色は真っ黒にしない
    iron: new THREE.MeshStandardMaterial({ name: 'revenant_iron', color: '#85868c', map: scales, metalness: 0.45, roughness: 0.42 }),
    ironPlain: new THREE.MeshStandardMaterial({ name: 'revenant_iron_plain', color: '#7a7b81', map: hammered, metalness: 0.45, roughness: 0.4 }),
    ironDark: new THREE.MeshStandardMaterial({ name: 'revenant_iron_dark', color: '#4a4b50', map: hammered, metalness: 0.4, roughness: 0.5 }),
    silver: new THREE.MeshStandardMaterial({ name: 'revenant_silver', color: '#b8b2a6', map: hammered, metalness: 0.6, roughness: 0.35 }),
    mail: new THREE.MeshStandardMaterial({ name: 'revenant_mail', color: '#8a8a8e', map: mail, metalness: 0.35, roughness: 0.6 }),
    leather: new THREE.MeshStandardMaterial({ name: 'revenant_leather', color: '#2e241d', roughness: 0.85 }),
    // 布：粗く、光沢なし
    cloth: new THREE.MeshStandardMaterial({ name: 'revenant_cloth', color: '#ffffff', map: cloth, alphaTest: 0.5, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    cloak: new THREE.MeshStandardMaterial({ name: 'revenant_cloak', color: '#d8d8dc', map: cloth, alphaTest: 0.5, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ name: 'revenant_shaft', color: '#2b2a2c', map: hammered, roughness: 0.6, metalness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ name: 'revenant_dark', color: '#050506', roughness: 1 }),
    eye: new THREE.MeshStandardMaterial({ name: 'revenant_eye', color: '#bff6ff', emissive: '#5fe8ff', emissiveIntensity: 1.8 }),
    // 結晶：シアン。平らな面で稜線の明るさと面の暗さを出す（全体を白く光らせない）
    crystal: new THREE.MeshStandardMaterial({ name: 'revenant_crystal', color: '#2aa6c4', emissive: '#0a6f8c', emissiveIntensity: 0.7, roughness: 0.18, metalness: 0.15, flatShading: true }),
  };
}

const mesh = (geometry, material) => new THREE.Mesh(geometry, material);
// 結晶の塊を一つの形に（材質ごとにまとめるため）
function crystals(center, normal, options) {
  return mergeGeometries(crystalCluster(center, normal, options).map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    const keep = new THREE.BufferGeometry();
    for (const n of ['position', 'normal']) keep.setAttribute(n, flat.getAttribute(n));
    keep.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count * 2), 2));
    return keep;
  }), false);
}
// 長衣の垂れ：上端を腰に、下へ長い布の帯。縦のひだ（波）を付け、下へ行くほど外へ広がる。y は上端 0 から下へ -length
function robePanel(width, length, folds = 3) {
  const g = new THREE.PlaneGeometry(width, length, 8, 8);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const t = (length / 2 - p.getY(i)) / length;
    p.setZ(i, Math.sin((x / width + 0.5) * Math.PI * 2 * folds) * 0.012 * (0.4 + t) + t * 0.05 - (x / width) ** 2 * 0.06);
  }
  g.translate(0, -length / 2, 0);
  g.computeVertexNormals();
  return g;
}
// 前の垂れ：腰と腿の骨に重みを分けた布。上端は腰、下へ行くほど腿の動きに半分ほど従う（脚を上げても板のように突き出さない）
function skinnedPanel(geometry, matrix, hipsBone, thighBone, material, name) {
  geometry.applyMatrix4(matrix);
  const p = geometry.getAttribute('position');
  let top = -Infinity;
  let bottom = Infinity;
  for (let i = 0; i < p.count; i++) { top = Math.max(top, p.getY(i)); bottom = Math.min(bottom, p.getY(i)); }
  const skinIndex = [];
  const skinWeight = [];
  for (let i = 0; i < p.count; i++) {
    const t = (top - p.getY(i)) / (top - bottom);
    const w = 0.6 * Math.min(1, t * 1.4);
    skinIndex.push(0, 1, 0, 0);
    skinWeight.push(1 - w, w, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  const panel = new THREE.SkinnedMesh(geometry, material);
  panel.name = name;
  panel.castShadow = true;
  panel.frustumCulled = false;
  panel.bind(new THREE.Skeleton([hipsBone, thighBone]));
  return panel;
}

export function buildSpearRevenant(gltf) {
  const root = gltf.scene;
  // 元の丸い体・兜・外套は外す（骨格と動作は残す）
  const old = [];
  root.traverse((o) => { if (o.isMesh) old.push(o); });
  for (const item of old) item.parent.remove(item);
  const bones = retarget(gltf);
  const m = createMaterials();
  const B = (name) => bones[clean(name)];
  const at = (name) => B(name).getWorldPosition(new THREE.Vector3()).toArray();
  const random = seeded(91);
  const hips = at('hips');
  const chest = at('chest');
  const neck = at('head');
  const sides = [['l', 1], ['r', -1]];

  // ── 胴：鎖帷子の下地 → 鱗状の胸甲（胸の張り、中央の稜線）→ 交差する革帯と胸の円い留め金 → 腹の板 → 帯と鎖 ──
  attach(B('spine'), mesh(loft([0, hips[1] - 0.05, 0], [0, chest[1] + 0.16, 0], [
    { t: 0, rx: 0.18, rz: 0.13 }, { t: 0.4, rx: 0.16, rz: 0.12 }, { t: 0.75, rx: 0.2, rz: 0.14 }, { t: 1, rx: 0.14, rz: 0.11 },
  ]), m.mail));
  attach(B('chest'), mesh(loft([0, chest[1] - 0.13, 0.004], [0, neck[1] + 0.005, 0.004], [
    { t: 0, rx: 0.18, rz: 0.13, cz: 0.01 }, { t: 0.35, rx: 0.215, rz: 0.15, cz: 0.025 }, { t: 0.7, rx: 0.225, rz: 0.142, cz: 0.02 },
    { t: 0.9, rx: 0.185, rz: 0.12, cz: 0.005 }, { t: 1, rx: 0.085, rz: 0.08 },
  ], { segments: 24 }), m.iron));
  attach(B('chest'), mesh(new THREE.BoxGeometry(0.018, 0.24, 0.02), m.ironDark), [0, chest[1] + 0.05, 0.17], [-0.12, 0, 0]);
  // 交差する革帯（肩から反対の腰へ）と、交わる所の円い留め金
  for (const sign of [1, -1]) {
    const strap = mesh(new THREE.BoxGeometry(0.045, 0.5, 0.012), m.leather);
    strap.position.set(0, chest[1] + 0.02, 0.172);
    strap.rotation.set(-0.08, 0, sign * 0.62);
    attach(B('chest'), strap);
  }
  attach(B('chest'), mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16).rotateX(Math.PI / 2), m.silver), [0, chest[1] + 0.02, 0.185]);
  attach(B('chest'), mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 18), m.ironDark), [0, chest[1] + 0.02, 0.196]);
  // 腹の板：2枚
  [[0.0, 0.17], [0.055, 0.172]].forEach(([dy, r], i) => {
    const y = chest[1] - 0.12 - dy;
    attach(B('spine'), mesh(loft([0, y - 0.06, 0.01], [0, y, 0.01], [{ t: 0, rx: r + 0.006, rz: r * 0.74, cz: 0.012 }, { t: 1, rx: r, rz: r * 0.72, cz: 0.01 }], { segments: 22 }), i % 2 ? m.ironDark : m.iron));
  });
  // 帯（革）と、留め金・腰から下がる鎖
  attach(B('hips'), mesh(loft([0, hips[1] - 0.02, 0], [0, hips[1] + 0.05, 0], [{ t: 0, rx: 0.185, rz: 0.135 }, { t: 1, rx: 0.185, rz: 0.135 }], { segments: 22 }), m.leather));
  attach(B('hips'), mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 14), m.silver), [0, hips[1] + 0.015, 0.14]);
  for (let k = 0; k < 4; k++) attach(B('hips'), mesh(new THREE.TorusGeometry(0.012, 0.004, 4, 8), m.ironDark), [-0.1 + k * 0.006, hips[1] - 0.02 - k * 0.022, 0.12], [0, k % 2 ? Math.PI / 2 : 0, 0]);
  // 鎖帷子の裾（腰から腿の上まで）
  attach(B('hips'), mesh(loft([0, hips[1] - 0.22, 0], [0, hips[1] - 0.01, 0], [{ t: 0, rx: 0.22, rz: 0.17 }, { t: 1, rx: 0.175, rz: 0.13 }], { segments: 22, capStart: false }), m.mail));
  // 長衣：前の左右の垂れは腿の骨に付け（脚と一緒に動く）、横の垂れは腰に付けて少し外へ離す。どれも足首近くまで
  for (const [s, sign] of sides) {
    const hip = at(`upperleg.${s}`);
    const place = new THREE.Matrix4().compose(new THREE.Vector3(hip[0] + sign * 0.01, hips[1] - 0.02, 0.15), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, sign * 0.15, 0)), new THREE.Vector3(1, 1, 1));
    root.add(skinnedPanel(robePanel(0.21, 0.86), place, B('hips'), B(`upperleg.${s}`), m.cloth, `Revenant_Robe_${s}`));
    const flank = mesh(robePanel(0.22, 0.82, 2), m.cloth);
    flank.position.set(sign * 0.21, hips[1] - 0.02, -0.02);
    flank.rotation.set(0, sign * Math.PI / 2, sign * 0.08);
    attach(B('hips'), flank);
  }

  // ── 首と兜：頭巾（破れた布）→ 首当て → 閉じた兜（縦の覗き穴の奥に光る目）→ 黒鉄の尖った王冠と結晶 ──
  attach(B('chest'), mesh(loft([0, neck[1] - 0.06, -0.01], [0, neck[1] + 0.09, 0], [{ t: 0, rx: 0.24, rz: 0.19 }, { t: 0.5, rx: 0.14, rz: 0.13 }, { t: 1, rx: 0.1, rz: 0.1 }], { segments: 20, arc: [-Math.PI * 0.2, Math.PI * 1.2] }), m.cloth));
  attach(B('chest'), mesh(loft([0, neck[1] - 0.04, 0], [0, neck[1] + 0.07, 0.005], [{ t: 0, rx: 0.15, rz: 0.12 }, { t: 0.45, rx: 0.1, rz: 0.095 }, { t: 1, rx: 0.078, rz: 0.078 }], { capStart: false, segments: 22 }), m.ironDark));
  const headY = neck[1] + 0.06;
  attach(B('head'), mesh(loft([0, headY, 0.005], [0, headY + 0.29, 0.0], [
    { t: 0, rx: 0.118, rz: 0.13, cz: 0.012 }, { t: 0.3, rx: 0.12, rz: 0.135, cz: 0.02 }, { t: 0.6, rx: 0.122, rz: 0.135, cz: 0.014 },
    { t: 0.85, rx: 0.11, rz: 0.12, cz: 0.006 }, { t: 1, rx: 0.06, rz: 0.065 },
  ], { segments: 26 }), m.ironPlain));
  // 面：前へ尖る稜線（くちばし状）と、縦の覗き穴・横の覗き穴（十字）。奥に光る目
  attach(B('head'), mesh(new THREE.ConeGeometry(0.05, 0.24, 4).rotateX(-Math.PI / 2).scale(1, 1, 0.6), m.ironDark), [0, headY + 0.11, 0.135]);
  attach(B('head'), mesh(new THREE.BoxGeometry(0.15, 0.016, 0.03), m.dark), [0, headY + 0.17, 0.138]);
  attach(B('head'), mesh(new THREE.BoxGeometry(0.016, 0.1, 0.03), m.dark), [0, headY + 0.12, 0.15]);
  for (const x of [-0.035, 0.035]) attach(B('head'), mesh(new THREE.SphereGeometry(0.009, 6, 4), m.eye), [x, headY + 0.17, 0.12]);
  for (const dy of [0.185, 0.155]) attach(B('head'), mesh(new THREE.BoxGeometry(0.17, 0.008, 0.014), m.silver), [0, headY + dy, 0.14]);
  // 王冠：低い輪と、高さの違う黒鉄の尖り（正面がいちばん高い）。尖りの間から結晶
  const crownY = headY + 0.2;
  attach(B('head'), mesh(new THREE.CylinderGeometry(0.128, 0.126, 0.05, 24, 1, true), m.ironDark), [0, crownY + 0.02, 0.0]);
  const spikes = [[0, 0.3, 0.075], [0.55, 0.2, 0.06], [-0.55, 0.2, 0.06], [1.1, 0.24, 0.06], [-1.1, 0.24, 0.06], [1.7, 0.16, 0.05], [-1.7, 0.16, 0.05], [2.4, 0.2, 0.05], [-2.4, 0.2, 0.05], [Math.PI, 0.15, 0.05]];
  for (const [angle, h, w] of spikes) {
    const g = new THREE.ExtrudeGeometry(spireShape(h, w), { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
    g.translate(0, 0, -0.005);
    const spike = mesh(g, m.ironDark);
    spike.position.set(Math.sin(angle) * 0.128, crownY + 0.04, Math.cos(angle) * 0.128);
    spike.rotation.set(-0.12, angle, 0, 'YXZ');
    attach(B('head'), spike);
  }
  attach(B('head'), mesh(crystals([0.1, crownY + 0.06, -0.04], [0.6, 1, -0.2], { count: 4, big: 0.14, random, spread: 0.04 }), m.crystal));
  attach(B('head'), mesh(crystals([-0.11, crownY + 0.0, 0.03], [-1, 0.6, 0.1], { count: 3, big: 0.1, random, spread: 0.03 }), m.crystal));

  // ── 腕：重なった大きな肩当て（4枚、鱗状）→ 上腕 → 肘当て → 段になった前腕の籠手 → 甲の板と拳。肩と前腕に結晶 ──
  for (const [s, sign] of sides) {
    const shoulder = at(`upperarm.${s}`);
    const elbow = at(`lowerarm.${s}`);
    const wrist = at(`wrist.${s}`);
    const hand = at(`hand.${s}`);
    const upper = B(`upperarm.${s}`);
    const lower = B(`lowerarm.${s}`);
    attach(upper, mesh(loft(shoulder, elbow, [{ t: 0, rx: 0.06, rz: 0.06 }, { t: 1, rx: 0.05, rz: 0.05 }]), m.mail));
    attach(lower, mesh(loft(elbow, wrist, [{ t: 0, rx: 0.048, rz: 0.048 }, { t: 1, rx: 0.038, rz: 0.038 }]), m.mail));
    for (let k = 0; k < 4; k++) {
      const radius = 0.16 - k * 0.018;
      const piece = mesh(new THREE.SphereGeometry(radius, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), k % 2 ? m.ironDark : m.iron);
      const p = lerp3(shoulder, elbow, k * 0.13);
      piece.position.set(p[0] + sign * 0.01, p[1] + 0.04 - k * 0.035, p[2]);
      piece.scale.set(1.08, 0.9 - k * 0.08, 1.18);
      piece.rotation.set(0, 0, -sign * (0.55 + k * 0.17));
      attach(upper, piece);
    }
    // 肩の結晶（左は大きな塊、右は小さめ）
    attach(upper, mesh(crystals([shoulder[0] + sign * 0.12, shoulder[1] + 0.12, shoulder[2] - 0.02], [sign * 0.7, 1, -0.2], { count: sign > 0 ? 7 : 4, big: sign > 0 ? 0.24 : 0.16, random, spread: 0.07 }), m.crystal));
    attach(upper, mesh(loft(lerp3(shoulder, elbow, 0.4), elbow, [{ t: 0, rx: 0.064, rz: 0.062 }, { t: 1, rx: 0.058, rz: 0.056 }], { segments: 16 }), m.iron));
    const couter = mesh(new THREE.SphereGeometry(0.062, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m.ironPlain);
    couter.position.set(...elbow);
    couter.rotation.set(Math.PI / 2, 0, 0);
    attach(lower, couter);
    // 前腕：重なった3段の籠手
    for (let k = 0; k < 3; k++) {
      const a = lerp3(elbow, wrist, 0.12 + k * 0.28);
      const b = lerp3(elbow, wrist, 0.12 + k * 0.28 + 0.32);
      attach(lower, mesh(loft(a, b, [{ t: 0, rx: 0.056 - k * 0.004, rz: 0.052 - k * 0.004 }, { t: 1, rx: 0.05 - k * 0.004, rz: 0.047 - k * 0.004 }], { segments: 14 }), k % 2 ? m.ironDark : m.iron));
    }
    attach(lower, mesh(crystals(lerp3(elbow, wrist, 0.45).map((v, i) => v + [sign * 0.05, 0.03, -0.03][i]), [sign, 0.4, -0.3], { count: 4, big: 0.13, random, spread: 0.06 }), m.crystal));
    // 籠手：甲の板と、握った指の塊、親指
    const dir = dirOf(wrist, hand);
    const handBone = B(`hand.${s}`);
    const hc = lerp3(hand, hand.map((x, i) => x + dir.toArray()[i] * 0.05), 0.5);
    attach(handBone, mesh(new RoundedBoxGeometry(0.09, 0.03, 0.085, 2, 0.01), m.iron), [hc[0], hc[1] + 0.012, hc[2]]);
    attach(handBone, mesh(new RoundedBoxGeometry(0.05, 0.06, 0.088, 2, 0.016), m.ironDark), [hc[0] + dir.x * 0.05, hc[1] - 0.018, hc[2] + dir.z * 0.05]);
    attach(handBone, mesh(new RoundedBoxGeometry(0.05, 0.022, 0.024, 2, 0.008), m.ironDark), [hc[0] + dir.x * 0.02, hc[1] - 0.012, hc[2] + 0.046]);
  }

  // ── 脚：鎖の腿 → 鱗状の腿当て → 膝当て（結晶）→ 脛当て → 尖った鉄靴 ──
  for (const [s, sign] of sides) {
    const hip = at(`upperleg.${s}`);
    const knee = at(`lowerleg.${s}`);
    const ankle = at(`foot.${s}`);
    const toes = at(`toes.${s}`);
    const upper = B(`upperleg.${s}`);
    const lower = B(`lowerleg.${s}`);
    const foot = B(`foot.${s}`);
    attach(upper, mesh(loft(hip, knee, [{ t: 0, rx: 0.09, rz: 0.09 }, { t: 1, rx: 0.062, rz: 0.062 }]), m.mail));
    attach(lower, mesh(loft(knee, ankle, [{ t: 0, rx: 0.06, rz: 0.06 }, { t: 0.7, rx: 0.052, rz: 0.052 }, { t: 1, rx: 0.04, rz: 0.04 }]), m.mail));
    attach(upper, mesh(loft(lerp3(hip, knee, 0.25), lerp3(hip, knee, 0.93), [{ t: 0, rx: 0.088, rz: 0.084, cz: 0.014 }, { t: 0.6, rx: 0.076, rz: 0.074, cz: 0.014 }, { t: 1, rx: 0.066, rz: 0.066, cz: 0.012 }], { segments: 18, side: [sign, 0, 0], arc: [-Math.PI * 1.05, Math.PI * 0.05] }), m.iron));
    attach(upper, mesh(crystals(lerp3(hip, knee, 0.55).map((v, i) => v + [sign * 0.06, 0, 0.05][i]), [sign, 0.3, 0.5], { count: 3, big: 0.12, random, spread: 0.04 }), m.crystal));
    const poleyn = mesh(new THREE.SphereGeometry(0.068, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m.ironPlain);
    poleyn.position.set(knee[0], knee[1], knee[2] + 0.035);
    poleyn.rotation.set(Math.PI / 2, 0, 0);
    poleyn.scale.set(1.05, 0.55, 1.4);
    attach(lower, poleyn);
    attach(lower, mesh(crystals([knee[0] + sign * 0.04, knee[1] + 0.02, knee[2] + 0.07], [sign * 0.5, 0.3, 1], { count: 3, big: 0.1, random, spread: 0.03 }), m.crystal));
    attach(lower, mesh(loft(lerp3(knee, ankle, 0.12), lerp3(knee, ankle, 0.97), [{ t: 0, rx: 0.066, rz: 0.068, cz: 0.012 }, { t: 0.45, rx: 0.062, rz: 0.068, cz: 0.014 }, { t: 1, rx: 0.048, rz: 0.052, cz: 0.008 }], { segments: 18, side: [sign, 0, 0] }), m.iron));
    // 鉄靴：足首の輪、甲の板3枚、前へ尖るつま先、靴底
    attach(foot, mesh(loft([ankle[0], ankle[1] - 0.06, ankle[2]], [ankle[0], ankle[1] + 0.03, ankle[2]], [{ t: 0, rx: 0.06, rz: 0.07 }, { t: 1, rx: 0.05, rz: 0.055 }]), m.ironDark));
    const sole = mesh(new RoundedBoxGeometry(0.1, 0.03, 0.27, 2, 0.01), m.leather);
    sole.position.set(ankle[0], 0.015, (ankle[2] + toes[2]) / 2 + 0.02);
    attach(foot, sole);
    for (let k = 0; k < 3; k++) {
      const lame = mesh(new RoundedBoxGeometry(0.096, 0.05, 0.06, 2, 0.015), k % 2 ? m.ironDark : m.iron);
      lame.position.set(ankle[0], 0.05 - k * 0.006, ankle[2] + 0.02 + k * 0.045);
      lame.rotation.x = 0.25;
      attach(foot, lame);
    }
    const toeCap = mesh(new THREE.ConeGeometry(0.05, 0.16, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.55, 1), m.ironPlain);
    toeCap.position.set(toes[0], 0.028, toes[2] + 0.07);
    attach(B(`toes.${s}`), toeCap);
  }

  // ── 長槍：右手の取り付け先に固定（柄は取り付け先の z に沿って -0.9 〜 1.9、穂先は +z）。柄に結晶が埋まり、穂先は刃のある黒鉄に結晶 ──
  const slot = B('handslot.r');
  const spear = new THREE.Group();
  spear.name = 'Revenant_Spear';
  const shaft = mesh(new THREE.CylinderGeometry(0.026, 0.03, 2.8, 8), m.wood);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.5;
  spear.add(shaft);
  for (const z of [-0.14, 0.16, 0.9, 1.5]) {
    const band = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 8), m.silver);
    band.rotation.x = Math.PI / 2;
    band.position.z = z;
    spear.add(band);
  }
  // 柄に埋まった小さな結晶
  const embedded = [];
  for (let i = 0; i < 9; i++) {
    const z = -0.7 + i * 0.27;
    if (Math.abs(z) < 0.2) continue;
    const a = i * 2.1;
    embedded.push(...crystalCluster([Math.cos(a) * 0.02, Math.sin(a) * 0.02, z], [Math.cos(a), Math.sin(a), 0.5], { count: 2, big: 0.08, random, spread: 0.01 }));
  }
  spear.add(mesh(mergeGeometries(embedded.map((g) => { const f = g.index ? g.toNonIndexed() : g; const k = new THREE.BufferGeometry(); k.setAttribute('position', f.getAttribute('position')); k.setAttribute('normal', f.getAttribute('normal')); k.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(f.getAttribute('position').count * 2), 2)); return k; }), false), m.crystal));
  // 穂先：受け口 → 細長い葉形の黒鉄の刃（縁はぎざぎざ）→ 中央に結晶
  const socket = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 8), m.ironDark);
  socket.rotation.x = Math.PI / 2;
  socket.position.z = 1.95;
  spear.add(socket);
  const blade = new THREE.Shape();
  blade.moveTo(0, 0); blade.lineTo(0.05, 0.08); blade.lineTo(0.035, 0.12); blade.lineTo(0.06, 0.2); blade.lineTo(0.04, 0.26); blade.lineTo(0.05, 0.32); blade.lineTo(0, 0.55);
  blade.lineTo(-0.05, 0.32); blade.lineTo(-0.04, 0.26); blade.lineTo(-0.06, 0.2); blade.lineTo(-0.035, 0.12); blade.lineTo(-0.05, 0.08); blade.lineTo(0, 0);
  const bladeGeometry = new THREE.ExtrudeGeometry(blade, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 });
  bladeGeometry.translate(0, 0, -0.004).rotateX(Math.PI / 2).translate(0, 0, 2.02);
  spear.add(mesh(bladeGeometry, m.ironPlain));
  const core = mesh(new THREE.OctahedronGeometry(0.03, 0), m.crystal);
  core.scale.set(0.8, 1, 5);
  core.position.z = 2.25;
  spear.add(core);
  const butt = mesh(new THREE.ConeGeometry(0.03, 0.14, 6), m.ironDark);
  butt.rotation.x = -Math.PI / 2;
  butt.position.z = -0.97;
  spear.add(butt);
  spear.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  slot.add(spear);

  // ── 外套：肩の後ろから足首まで。専用の骨5本に重みを分けた破れた布（揺れは実行時） ──
  const cloak = buildCloak(B('chest'), chest, neck, { cloak: m.cloak }, 'Revenant_Cloak');
  root.add(cloak.mesh);

  mergeParts(root);
  root.userData.nativeScale = true;
  root.userData.animationSpeed = { Walking_A: ANIMATION_SPEED.Walking_A };
  root.userData.model = 'spear-revenant';
  root.updateMatrixWorld(true);
  return { scene: root, animations: gltf.animations };
}
