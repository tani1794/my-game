// 敵「晶槍の亡兵」のモデルを作る（ブラウザで実行し、GLB に書き出す：scripts/build-spear-revenant.mjs）。
// 元の skeleton_warrior.glb（KayKit Skeleton Warrior、CC0）の骨格と8個の動作をそのまま使い、
// 1) 骨の長さを、主人公と同じ成人の体格（身長約1.86m）へ伸ばす（scripts/models/crownedKnight.js の retarget）
// 2) 元の丸い体は使わず、骨（肋骨・背骨・骨盤・手足の骨・頭蓋）と、古びた鎧（錆びた半胸甲・片方の肩当て・脛当て・鉄靴・兜）、
//    破れた布（腰布・背の布）を、それぞれの骨に付けた別の部品として作る
// 3) 結晶の生えた長槍（右手の取り付け先に固定）。肩・背・兜から結晶が生えている
// 単位はメートル。書き出したモデルは身長を合わせ直さない（userData.nativeScale）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ANIMATION_SPEED, clean, noiseTexture, loft, lerp3, retarget, attach, mergeParts } from './crownedKnight.js';
import { seeded, crystalCluster } from '../../src/areas/creatureKit.js';

function createMaterials() {
  const random = seeded(23);
  // 古い骨：黄ばんだ地に、細かなしみと筋
  const boneMap = noiseTexture(128, (ctx, s) => {
    ctx.fillStyle = '#d8d0bc'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) { const v = 150 + Math.floor(random() * 80); ctx.fillStyle = `rgba(${v},${v - 10},${v - 30},0.45)`; ctx.fillRect(random() * s, random() * s, 1 + random() * 3, 3 + random() * 8); }
  });
  boneMap.colorSpace = THREE.SRGBColorSpace;
  // 錆びた鉄：まだらの赤茶と、へこみの暗い点
  const rust = noiseTexture(256, (ctx, s) => {
    ctx.fillStyle = '#9a9a98'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i++) {
      const r = random();
      ctx.fillStyle = r < 0.55 ? `rgba(${120 + random() * 50},${70 + random() * 30},${40 + random() * 20},0.5)` : `rgba(${60 + random() * 40},${60 + random() * 40},${60 + random() * 40},0.45)`;
      ctx.beginPath(); ctx.ellipse(random() * s, random() * s, 2 + random() * 9, 1 + random() * 6, random() * 3, 0, Math.PI * 2); ctx.fill();
    }
  });
  rust.colorSpace = THREE.SRGBColorSpace;
  // 破れた布：くすんだ灰緑。裾は不揃いに欠け、ところどころ穴
  const rag = noiseTexture(256, (ctx, s) => {
    ctx.fillStyle = '#596158'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) { const g = 60 + Math.floor(random() * 40); ctx.fillStyle = `rgba(${g},${g + 6},${g},0.4)`; ctx.fillRect(random() * s, random() * s, 1 + random() * 2, 4 + random() * 8); }
  });
  rag.colorSpace = THREE.SRGBColorSpace;
  const tatter = noiseTexture(256, (ctx, s) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.moveTo(0, s);
    for (let x = 0; x <= s; x += 6 + random() * 16) ctx.lineTo(x, s - 10 - random() * random() * 120);
    ctx.lineTo(s, s); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.ellipse(random() * s, s * (0.3 + random() * 0.6), 2 + random() * 6, 3 + random() * 10, 0, 0, Math.PI * 2); ctx.fill(); }
  });
  tatter.wrapS = THREE.ClampToEdgeWrapping;
  tatter.wrapT = THREE.ClampToEdgeWrapping;
  return {
    bone: new THREE.MeshStandardMaterial({ name: 'revenant_bone', color: '#bdb39c', map: boneMap, roughness: 0.78, metalness: 0 }),
    rust: new THREE.MeshStandardMaterial({ name: 'revenant_rust', color: '#a88e78', map: rust, roughness: 0.7, metalness: 0.2 }),
    rustDark: new THREE.MeshStandardMaterial({ name: 'revenant_rust_dark', color: '#6e625a', map: rust, roughness: 0.75, metalness: 0.2 }),
    leather: new THREE.MeshStandardMaterial({ name: 'revenant_leather', color: '#3d2c21', roughness: 0.85 }),
    rag: new THREE.MeshStandardMaterial({ name: 'revenant_rag', color: '#ffffff', map: rag, alphaMap: tatter, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ name: 'revenant_wood', color: '#5a4636', roughness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ name: 'revenant_socket', color: '#070708', roughness: 1 }),
    eye: new THREE.MeshStandardMaterial({ name: 'revenant_eye', color: '#bff6ff', emissive: '#5fe8ff', emissiveIntensity: 2.2 }),
    crystal: new THREE.MeshStandardMaterial({ name: 'revenant_crystal', color: '#2fb6d2', emissive: '#0e86a8', emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, flatShading: true }),
  };
}

const mesh = (geometry, material) => new THREE.Mesh(geometry, material);
// 細い骨：両端に関節のふくらみ
function longBone(a, b, ra, rb) {
  const parts = [loft(a, b, [{ t: 0, rx: ra * 1.5, rz: ra * 1.4 }, { t: 0.12, rx: ra, rz: ra }, { t: 0.85, rx: rb, rz: rb }, { t: 1, rx: rb * 1.5, rz: rb * 1.4 }], { segments: 10 })];
  return mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
}
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

  // ── 胴：背骨 → 肋骨（前が開いた籠）→ 胸骨 → 錆びた半胸甲（左の脇が欠けている）→ 骨盤と革帯 ──
  attach(B('spine'), mesh(loft([0, hips[1] - 0.02, -0.06], [0, neck[1] + 0.02, -0.05], [{ t: 0, rx: 0.03, rz: 0.03 }, { t: 0.5, rx: 0.026, rz: 0.03, cz: -0.015 }, { t: 1, rx: 0.024, rz: 0.026 }], { segments: 8 }), m.bone));
  for (let k = 0; k < 6; k++) {
    const y = chest[1] + 0.13 - k * 0.055;
    const r = 0.15 - Math.abs(k - 1.5) * 0.012;
    // 輪の一部（前の +z を 0.35π だけ開ける）を水平に寝かせ、前へ向かって下げる
    const ring = new THREE.TorusGeometry(r, 0.011, 5, 20, Math.PI * 1.65).rotateZ(Math.PI * 0.675).rotateX(Math.PI / 2);
    const rib = mesh(ring, m.bone);
    rib.position.set(0, y, -0.01);
    rib.rotation.x = 0.25;
    rib.scale.set(1, 1, 0.78);
    attach(B('chest'), rib);
  }
  attach(B('chest'), mesh(new RoundedBoxGeometry(0.035, 0.2, 0.02, 2, 0.008), m.bone), [0, chest[1] + 0.03, 0.115]);
  // 半胸甲：前の右から中央すぎまでを覆う、へこんだ板
  attach(B('chest'), mesh(loft([0, chest[1] - 0.06, 0], [0, neck[1] - 0.01, 0], [
    { t: 0, rx: 0.17, rz: 0.13, cz: 0.012 }, { t: 0.45, rx: 0.19, rz: 0.142, cz: 0.02 }, { t: 0.85, rx: 0.17, rz: 0.12, cz: 0.01 }, { t: 1, rx: 0.12, rz: 0.09 },
  ], { segments: 20, arc: [-Math.PI * 1.02, -Math.PI * 0.38] }), m.rust));
  // 半胸甲を吊る革紐（右肩）
  attach(B('chest'), mesh(new THREE.TorusGeometry(0.11, 0.012, 4, 14, Math.PI), m.leather), [-0.09, neck[1] - 0.02, 0], [0, Math.PI / 2, 0]);
  // 骨盤と革帯
  attach(B('hips'), mesh(loft([0, hips[1] - 0.07, 0], [0, hips[1] + 0.04, 0], [{ t: 0, rx: 0.1, rz: 0.06 }, { t: 0.6, rx: 0.15, rz: 0.08 }, { t: 1, rx: 0.13, rz: 0.07 }], { segments: 14 }), m.bone));
  attach(B('hips'), mesh(loft([0, hips[1] + 0.02, 0], [0, hips[1] + 0.07, 0], [{ t: 0, rx: 0.165, rz: 0.11 }, { t: 1, rx: 0.16, rz: 0.105 }], { segments: 18 }), m.leather));
  attach(B('hips'), mesh(new RoundedBoxGeometry(0.05, 0.045, 0.02, 2, 0.006), m.rust), [0.03, hips[1] + 0.045, 0.108]);
  // 腰布：前と後ろに破れた布（脚とぶつからないよう、前は短く少し前へ離す）
  const front = mesh(new THREE.PlaneGeometry(0.2, 0.34, 1, 3), m.rag);
  front.position.set(0, hips[1] - 0.13, 0.13);
  front.rotation.x = -0.08;
  attach(B('hips'), front);
  const backFlap = mesh(new THREE.PlaneGeometry(0.26, 0.46, 1, 3), m.rag);
  backFlap.position.set(0, hips[1] - 0.18, -0.12);
  backFlap.rotation.x = 0.12;
  attach(B('hips'), backFlap);
  // 背の布：肩から腰の下まで（胸の骨に付く。裾は破れている）
  attach(B('chest'), mesh(loft([0, hips[1] - 0.3, -0.08], [0, neck[1] - 0.02, -0.06], [
    { t: 0, rx: 0.24, rz: 0.2, cz: -0.06 }, { t: 0.5, rx: 0.21, rz: 0.17, cz: -0.03 }, { t: 1, rx: 0.17, rz: 0.13 },
  ], { segments: 14, arc: [Math.PI * 0.12, Math.PI * 0.88] }), m.rag));
  // 背と右肩の結晶
  attach(B('chest'), mesh(crystals([0.05, chest[1] + 0.12, -0.14], [0.2, 0.6, -1], { count: 5, big: 0.26, random, spread: 0.08 }), m.crystal));

  // ── 頭：首の骨 → 頭蓋（目の穴に光る目）→ あご → 古い鉄の帽子兜（つば広、結晶が突き抜けている） ──
  attach(B('chest'), mesh(loft([0, neck[1] - 0.04, -0.03], [0, neck[1] + 0.07, -0.01], [{ t: 0, rx: 0.025, rz: 0.025 }, { t: 1, rx: 0.022, rz: 0.022 }], { segments: 8 }), m.bone));
  const headY = neck[1] + 0.06;
  attach(B('head'), mesh(loft([0, headY + 0.02, -0.005], [0, headY + 0.24, -0.01], [
    { t: 0, rx: 0.06, rz: 0.07, cz: 0.02 }, { t: 0.3, rx: 0.085, rz: 0.1, cz: 0.012 }, { t: 0.7, rx: 0.095, rz: 0.11 }, { t: 1, rx: 0.04, rz: 0.05 },
  ], { segments: 16 }), m.bone));
  for (const sign of [1, -1]) {
    attach(B('head'), mesh(new THREE.SphereGeometry(0.026, 8, 6), m.dark), [sign * 0.035, headY + 0.13, 0.085]);
    attach(B('head'), mesh(new THREE.SphereGeometry(0.011, 6, 4), m.eye), [sign * 0.035, headY + 0.13, 0.1]);
  }
  attach(B('head'), mesh(new THREE.ConeGeometry(0.014, 0.03, 3), m.dark), [0, headY + 0.085, 0.1], [Math.PI, 0, 0]);
  // あご（歯の列）
  attach(B('head'), mesh(loft([0, headY - 0.0, 0.0], [0, headY + 0.04, 0.0], [{ t: 0, rx: 0.05, rz: 0.06, cz: 0.03 }, { t: 1, rx: 0.06, rz: 0.07, cz: 0.025 }], { segments: 12 }), m.bone));
  for (let i = 0; i < 6; i++) attach(B('head'), mesh(new THREE.BoxGeometry(0.01, 0.016, 0.01), m.bone), [-0.027 + i * 0.011, headY + 0.05, 0.09]);
  // 兜：鉢と広いつば（少し傾いている）
  const helm = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0.16), new THREE.Vector2(0.05, 0.155), new THREE.Vector2(0.095, 0.12), new THREE.Vector2(0.115, 0.06),
    new THREE.Vector2(0.12, 0.02), new THREE.Vector2(0.19, -0.01), new THREE.Vector2(0.2, -0.025), new THREE.Vector2(0.12, 0.0),
  ], 20);
  attach(B('head'), mesh(helm, m.rust), [0, headY + 0.17, -0.01], [0.08, 0, 0.1]);
  attach(B('head'), mesh(crystals([-0.06, headY + 0.3, -0.02], [-0.5, 1, -0.2], { count: 3, big: 0.16, random, spread: 0.03 }), m.crystal));

  // ── 腕：骨（上腕・前腕は2本）、肘と手の骨。左は錆びた肩当てと籠手、右は革の巻き ──
  for (const [s, sign] of sides) {
    const shoulder = at(`upperarm.${s}`);
    const elbow = at(`lowerarm.${s}`);
    const wrist = at(`wrist.${s}`);
    const hand = at(`hand.${s}`);
    const upper = B(`upperarm.${s}`);
    const lower = B(`lowerarm.${s}`);
    attach(upper, mesh(longBone(shoulder, elbow, 0.024, 0.02), m.bone));
    for (const dz of [0.013, -0.013]) attach(lower, mesh(longBone([elbow[0], elbow[1], elbow[2] + dz], [wrist[0], wrist[1], wrist[2] + dz], 0.013, 0.011), m.bone));
    attach(lower, mesh(new THREE.SphereGeometry(0.03, 8, 6), m.bone), elbow);
    // 骨ばった拳
    const handBone = B(`hand.${s}`);
    const fist = mesh(new RoundedBoxGeometry(0.07, 0.05, 0.075, 2, 0.015), m.bone);
    fist.position.set(sign * 0.012 + hand[0], hand[1] - 0.005, hand[2] + 0.005);
    attach(handBone, fist);
    if (sign > 0) {
      // 左：錆びた肩当て（2枚）と籠手
      for (let k = 0; k < 2; k++) {
        const radius = 0.13 - k * 0.02;
        const cap = mesh(new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), k ? m.rustDark : m.rust);
        const p = lerp3(shoulder, elbow, k * 0.2);
        cap.position.set(p[0], p[1] + 0.03 - k * 0.04, p[2]);
        cap.scale.set(1.05, 0.85, 1.12);
        cap.rotation.set(0, 0, -(0.5 + k * 0.2));
        attach(upper, cap);
      }
      attach(lower, mesh(loft(lerp3(elbow, wrist, 0.3), wrist, [{ t: 0, rx: 0.048, rz: 0.044 }, { t: 1, rx: 0.042, rz: 0.04 }], { segments: 12 }), m.rust));
    } else {
      // 右：革の巻き（前腕）と、肩から生えた結晶
      attach(lower, mesh(loft(lerp3(elbow, wrist, 0.35), lerp3(elbow, wrist, 0.95), [{ t: 0, rx: 0.034, rz: 0.032 }, { t: 1, rx: 0.03, rz: 0.028 }], { segments: 10 }), m.leather));
      attach(upper, mesh(crystals([shoulder[0] - 0.03, shoulder[1] + 0.05, shoulder[2] - 0.02], [-0.6, 1, -0.2], { count: 4, big: 0.2, random, spread: 0.05 }), m.crystal));
    }
  }

  // ── 脚：大腿骨・膝の皿・脛の骨。錆びた脛当て（前だけ）と鉄靴 ──
  for (const [s, sign] of sides) {
    const hip = at(`upperleg.${s}`);
    const knee = at(`lowerleg.${s}`);
    const ankle = at(`foot.${s}`);
    const toes = at(`toes.${s}`);
    const upper = B(`upperleg.${s}`);
    const lower = B(`lowerleg.${s}`);
    attach(upper, mesh(longBone(hip, knee, 0.03, 0.026), m.bone));
    attach(lower, mesh(longBone(knee, ankle, 0.024, 0.02), m.bone));
    const patella = mesh(new THREE.SphereGeometry(0.032, 10, 8), m.bone);
    patella.scale.set(1, 1.2, 0.6);
    attach(lower, patella, [knee[0], knee[1], knee[2] + 0.03]);
    // 腿の布の巻き（ぼろ）
    attach(upper, mesh(loft(lerp3(hip, knee, 0.15), lerp3(hip, knee, 0.55), [{ t: 0, rx: 0.07, rz: 0.065 }, { t: 1, rx: 0.055, rz: 0.05 }], { segments: 12, capStart: false, capEnd: false }), m.rag));
    attach(lower, mesh(loft(lerp3(knee, ankle, 0.1), lerp3(knee, ankle, 0.92), [{ t: 0, rx: 0.058, rz: 0.06, cz: 0.012 }, { t: 1, rx: 0.044, rz: 0.048, cz: 0.008 }], { segments: 16, side: [sign, 0, 0], arc: [-Math.PI * 0.95, -Math.PI * 0.05] }), sign > 0 ? m.rust : m.rustDark));
    // 鉄靴：足首の輪、甲の板、つま先、靴底
    const foot = B(`foot.${s}`);
    attach(foot, mesh(loft([ankle[0], ankle[1] - 0.05, ankle[2]], [ankle[0], ankle[1] + 0.03, ankle[2]], [{ t: 0, rx: 0.055, rz: 0.065 }, { t: 1, rx: 0.045, rz: 0.05 }], { segments: 12 }), m.rustDark));
    const sole = mesh(new RoundedBoxGeometry(0.095, 0.028, 0.25, 2, 0.01), m.leather);
    sole.position.set(ankle[0], 0.014, (ankle[2] + toes[2]) / 2 + 0.02);
    attach(foot, sole);
    const instep = mesh(new RoundedBoxGeometry(0.09, 0.05, 0.12, 2, 0.015), m.rust);
    instep.position.set(ankle[0], 0.045, ankle[2] + 0.06);
    instep.rotation.x = 0.25;
    attach(foot, instep);
    const toeCap = mesh(new THREE.SphereGeometry(0.047, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m.rustDark);
    toeCap.position.set(toes[0], 0.024, toes[2] + 0.035);
    toeCap.scale.set(0.95, 0.6, 1.4);
    attach(B(`toes.${s}`), toeCap);
  }

  // ── 長槍：右手の取り付け先に固定（今までの槍と同じ向き・長さ：柄は取り付け先の z に沿って -0.9 〜 1.9、穂先は +z） ──
  const slot = B('handslot.r');
  const spear = new THREE.Group();
  spear.name = 'Revenant_Spear';
  const shaft = mesh(new THREE.CylinderGeometry(0.03, 0.034, 2.8, 8), m.wood);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.5;
  spear.add(shaft);
  // 鉄の帯（握りの上下と、穂先の受け口）
  for (const z of [-0.12, 0.14, 1.72]) {
    const band = mesh(new THREE.CylinderGeometry(0.04, 0.04, z > 1 ? 0.12 : 0.04, 8), m.rustDark);
    band.rotation.x = Math.PI / 2;
    band.position.z = z;
    spear.add(band);
  }
  // 穂先：細長い結晶（中心の1本と、根元の小さな2本）
  const tip = mesh(new THREE.OctahedronGeometry(0.1, 0), m.crystal);
  tip.scale.set(0.8, 0.8, 4.2);
  tip.position.z = 2.18;
  spear.add(tip);
  for (const sign of [1, -1]) {
    const shard = mesh(new THREE.OctahedronGeometry(0.05, 0), m.crystal);
    shard.scale.set(0.7, 0.7, 3);
    shard.position.set(sign * 0.05, 0, 1.86);
    shard.rotation.y = sign * 0.35;
    spear.add(shard);
  }
  // 石突き
  const butt = mesh(new THREE.ConeGeometry(0.035, 0.12, 6), m.rustDark);
  butt.rotation.x = -Math.PI / 2;
  butt.position.z = -0.96;
  spear.add(butt);
  spear.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  slot.add(spear);

  mergeParts(root);
  root.userData.nativeScale = true;
  root.userData.animationSpeed = { Walking_A: ANIMATION_SPEED.Walking_A };
  root.userData.model = 'spear-revenant';
  root.updateMatrixWorld(true);
  return { scene: root, animations: gltf.animations };
}
