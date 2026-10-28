// 主人公「王冠の騎士」のモデルを作る（ブラウザで実行し、GLB に書き出す：scripts/build-crowned-knight.mjs）。
// 元の knight.glb（KayKit Knight、CC0）の骨格と12個の動作をそのまま使い、
// 1) 骨の長さを成人の体格（約7.5頭身・身長1.86m）へ伸ばし、動作の「位置」の値も同じ割合で伸ばす
// 2) 元の丸い体は使わず、兜と王冠・胸当て・腹の板・肩当て・腕・籠手・腿・膝・脛・鉄靴を、それぞれの骨に付けた別の部品として作る
//    （関節ごとに分かれて動く。下には鎖帷子と布の層）
// 3) フードとマント（マントは専用の骨5本。揺れは実行時にコードで付ける）、前垂れ、長剣
// 単位はメートル。書き出したモデルは身長を合わせ直さない（userData.nativeScale）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 骨の位置（親から見た位置）：元の値 → 新しい値。動作の位置の値もこの割合で伸ばす
export const BONE_OFFSETS = {
  hips: [0, 0.98, 0],
  spine: [0, 0.14, 0],
  chest: [0, 0.24, 0],
  head: [0, 0.205, 0],
  'upperarm.l': [0.185, 0.125, 0],
  'upperarm.r': [-0.185, 0.125, 0],
  'lowerarm.l': [0, 0.29, 0],
  'lowerarm.r': [0, 0.29, 0],
  'wrist.l': [0, 0.25, 0],
  'wrist.r': [0, 0.25, 0],
  'hand.l': [0, 0.06, 0],
  'hand.r': [0, 0.06, 0],
  'handslot.l': [0, 0.075, -0.035],
  'handslot.r': [0, 0.075, -0.035],
  'upperleg.l': [0.1, -0.045, 0],
  'upperleg.r': [-0.1, -0.045, 0],
  'lowerleg.l': [0, 0.43, 0],
  'lowerleg.r': [0, 0.43, 0],
  'foot.l': [0, 0.41, 0],
  'foot.r': [0, 0.41, 0],
  'toes.l': [0, 0.13, 0],
  'toes.r': [0, 0.13, 0],
};
// 歩き・走りは脚が長くなった分だけ一歩が大きいので、動作をゆっくり再生して足の滑りを抑える
export const ANIMATION_SPEED = { Walking_A: 0.62, Running_A: 0.66 };

export const clean = (name) => name.replace(/\./g, '');

// ── 材質（色だけでなく、粗さと反射で違いを出す） ──
export function noiseTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
function seeded(seed) {
  let n = seed;
  return () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
}

export function createMaterials() {
  const random = seeded(17);
  // 叩き出した鉄：細かな凹凸の明暗（色）と、粗さのむら
  const hammered = noiseTexture(256, (ctx, s) => {
    ctx.fillStyle = '#cfcfcf'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + Math.floor(random() * 90);
      ctx.fillStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.beginPath(); ctx.ellipse(random() * s, random() * s, 2 + random() * 5, 1.5 + random() * 4, random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // 細い傷
    ctx.strokeStyle = 'rgba(210,210,210,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) { ctx.beginPath(); const x = random() * s; const y = random() * s; ctx.moveTo(x, y); ctx.lineTo(x + (random() - 0.5) * 30, y + (random() - 0.5) * 30); ctx.stroke(); }
  });
  hammered.colorSpace = THREE.SRGBColorSpace;
  const roughMap = noiseTexture(128, (ctx, s) => {
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { const v = 80 + Math.floor(random() * 140); ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(random() * s, random() * s, 2 + random() * 6, 2 + random() * 6); }
  });
  // 鎖帷子の目
  const mail = noiseTexture(128, (ctx, s) => {
    ctx.fillStyle = '#2a2b2d'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#8d8e90'; ctx.lineWidth = 2;
    for (let y = 0; y < s; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < s; x += 8) { ctx.beginPath(); ctx.ellipse(x + 4, y + 4, 3.4, 2.6, 0, 0, Math.PI * 2); ctx.stroke(); }
  });
  mail.colorSpace = THREE.SRGBColorSpace;
  mail.repeat.set(6, 6);
  // 外套の布：くすんだ深緑に、金糸の蔓の刺繍（ところどころ擦り切れて薄い）
  const cloth = noiseTexture(512, (ctx, s) => {
    ctx.fillStyle = '#2b3427'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) { const g = 30 + Math.floor(random() * 30); ctx.fillStyle = `rgba(${g},${g + 8},${g - 4},0.35)`; ctx.fillRect(random() * s, random() * s, 1 + random() * 2, 3 + random() * 6); }
    ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = `rgba(160,128,62,${0.25 + random() * 0.35})`;
      let x = random() * s; let y = 0;
      ctx.beginPath(); ctx.moveTo(x, y);
      while (y < s) {
        const nx = x + (random() - 0.5) * 40; const ny = y + 18 + random() * 22;
        ctx.quadraticCurveTo(x + (random() - 0.5) * 50, (y + ny) / 2, nx, ny);
        // 小さな葉
        if (random() < 0.6) { ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx + 12, ny - 6, nx + 16, ny + 4); ctx.moveTo(nx, ny); }
        x = nx; y = ny;
      }
      ctx.stroke();
    }
  });
  cloth.colorSpace = THREE.SRGBColorSpace;
  // 破れた裾（透明の型）：下の方ほど不揃いに欠ける
  const tatter = noiseTexture(256, (ctx, s) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.moveTo(0, s);
    for (let x = 0; x <= s; x += 4 + random() * 10) ctx.lineTo(x, s - 6 - random() * random() * 46);
    ctx.lineTo(s, s); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(random() * s, s * (0.7 + random() * 0.28), 1 + random() * 4, 2 + random() * 7, 0, 0, Math.PI * 2); ctx.fill(); }
  });
  tatter.wrapS = THREE.ClampToEdgeWrapping;
  tatter.wrapT = THREE.ClampToEdgeWrapping;

  return {
    // 景色の映り込み（環境マップ）が無い場面でも形が読めるよう、金属の反射は控えめにして、光の当たる面で明るさを出す
    iron: new THREE.MeshStandardMaterial({ name: 'black_iron', color: '#7a7b80', map: hammered, roughnessMap: roughMap, metalness: 0.4, roughness: 0.4 }),
    ironDark: new THREE.MeshStandardMaterial({ name: 'black_iron_dark', color: '#3e3f43', map: hammered, roughnessMap: roughMap, metalness: 0.35, roughness: 0.5 }),
    silver: new THREE.MeshStandardMaterial({ name: 'dull_silver', color: '#c2bcae', map: hammered, metalness: 0.6, roughness: 0.32 }),
    crown: new THREE.MeshStandardMaterial({ name: 'crown_silver', color: '#d0c9bb', map: hammered, roughnessMap: roughMap, metalness: 0.65, roughness: 0.28 }),
    leather: new THREE.MeshStandardMaterial({ name: 'leather', color: '#3b2b20', roughness: 0.82, metalness: 0 }),
    mail: new THREE.MeshStandardMaterial({ name: 'chain_mail', color: '#8a8a8a', map: mail, metalness: 0.35, roughness: 0.62 }),
    gambeson: new THREE.MeshStandardMaterial({ name: 'gambeson', color: '#34322c', roughness: 0.95 }),
    cloak: new THREE.MeshStandardMaterial({ name: 'cloak', color: '#ffffff', map: cloth, alphaMap: tatter, alphaTest: 0.5, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    hood: new THREE.MeshStandardMaterial({ name: 'hood', color: '#c9cfc6', map: cloth, roughness: 1, side: THREE.DoubleSide }),
    blade: new THREE.MeshStandardMaterial({ name: 'blade', color: '#d2d7da', map: hammered, metalness: 0.7, roughness: 0.24 }),
    dark: new THREE.MeshStandardMaterial({ name: 'visor_dark', color: '#050506', roughness: 1 }),
    gem: new THREE.MeshStandardMaterial({ name: 'crown_gem', color: '#5fe4f2', emissive: '#1fb4c8', emissiveIntensity: 0.9, roughness: 0.2 }),
  };
}

// ── 形の道具 ──
// 輪切りをつないだ筒：a → b の向きに、楕円の輪（rings: { t, rx, rz, cx?, cz? }）を並べる。両端は閉じる
// side：輪の横の向きの基準（rx の向き）。省くと世界の x と up から決める
// arc：輪の一部だけ（[始まり, 終わり] の角度。前の開いたフードなど）。そのときは両端を閉じない
export function loft(a, b, rings, { segments = 18, side = null, capStart = true, capEnd = true, arc = null } = {}) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const axis = B.clone().sub(A);
  const length = axis.length();
  axis.normalize();
  let u = side ? new THREE.Vector3(...side) : new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(axis)) > 0.9) u = new THREE.Vector3(0, 0, 1);
  u = u.sub(axis.clone().multiplyScalar(u.dot(axis))).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();
  // cz（前への張り出し）は -v の向き。縦の筒なら +z（体の前）
  const positions = [];
  const index = [];
  rings.forEach((ring) => {
    const center = A.clone().addScaledVector(axis, ring.t * length).addScaledVector(u, ring.cx ?? 0).addScaledVector(v, -(ring.cz ?? 0));
    const count = arc ? segments + 1 : segments;
    for (let i = 0; i < count; i++) {
      const angle = arc ? arc[0] + (arc[1] - arc[0]) * (i / segments) : (i / segments) * Math.PI * 2;
      const p = center.clone().addScaledVector(u, Math.cos(angle) * ring.rx).addScaledVector(v, Math.sin(angle) * ring.rz);
      positions.push(p.x, p.y, p.z);
    }
  });
  const per = arc ? segments + 1 : segments;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a0 = r * per + i;
      const a1 = r * per + (arc ? i + 1 : (i + 1) % segments);
      const b0 = a0 + per;
      const b1 = a1 + per;
      // 外向きの面（反時計回り）
      index.push(a0, a1, b0, a1, b1, b0);
    }
  }
  if (arc) { capStart = false; capEnd = false; }
  const addCap = (r, flip) => {
    const ring = rings[r];
    const center = A.clone().addScaledVector(axis, ring.t * length).addScaledVector(u, ring.cx ?? 0).addScaledVector(v, -(ring.cz ?? 0));
    const c = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    for (let i = 0; i < segments; i++) {
      const p0 = r * segments + i;
      const p1 = r * segments + ((i + 1) % segments);
      if (flip) index.push(c, p0, p1); else index.push(c, p1, p0);
    }
  };
  if (capStart) addCap(0, false);
  if (capEnd) addCap(rings.length - 1, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // 模様用の uv（輪の向きと長さ）
  const uv = [];
  rings.forEach((ring) => { for (let i = 0; i < per; i++) uv.push(i / segments, ring.t * length * 2); });
  if (capStart) uv.push(0.5, 0);
  if (capEnd) uv.push(0.5, 1);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geometry;
}

// 2点の間の向き
export const dirOf = (a, b) => new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
export const lerp3 = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

// 尖頭の飾り（王冠の尖塔）：細長い尖りに、左右の小さな棘
export function spireShape(height, width) {
  const s = new THREE.Shape();
  const h = height;
  const w = width;
  s.moveTo(-w / 2, 0);
  s.lineTo(-w * 0.32, h * 0.35);
  s.lineTo(-w * 0.75, h * 0.48); // 棘
  s.lineTo(-w * 0.22, h * 0.55);
  s.lineTo(-w * 0.14, h * 0.8);
  s.lineTo(-w * 0.42, h * 0.84); // 小さな棘
  s.lineTo(-w * 0.08, h * 0.9);
  s.lineTo(0, h);
  s.lineTo(w * 0.08, h * 0.9);
  s.lineTo(w * 0.42, h * 0.84);
  s.lineTo(w * 0.14, h * 0.8);
  s.lineTo(w * 0.22, h * 0.55);
  s.lineTo(w * 0.75, h * 0.48);
  s.lineTo(w * 0.32, h * 0.35);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

// ── 骨格を伸ばす ──
export function retarget(gltf, offsets = BONE_OFFSETS) {
  const root = gltf.scene;
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const factors = {};
  for (const [name, target] of Object.entries(offsets)) {
    const bone = bones[clean(name)];
    if (!bone) continue;
    const old = bone.position.clone();
    // 成分ごとの割合（元が 0 の成分は、新しい値をそのまま足す）
    factors[bone.name] = { old, target: new THREE.Vector3(...target) };
    bone.position.set(...target);
  }
  // 動作の位置の値：元の休みの位置との差は、骨の長さに合わせて縮尺し、新しい休みの位置に足す。
  // 同じ値の配列を複数の動作が共有していることがある（読み込み時に共有される）ので、配列ごとに一度だけ直す
  const done = new Set();
  for (const clip of gltf.animations) {
    for (const track of clip.tracks) {
      const [node, prop] = track.name.split('.');
      if (prop !== 'position' || !factors[node] || done.has(track.values)) continue;
      done.add(track.values);
      const { old, target } = factors[node];
      const scale = target.length() / Math.max(1e-6, old.length());
      const values = track.values;
      for (let i = 0; i < values.length; i += 3) {
        values[i] = target.x + (values[i] - old.x) * scale;
        values[i + 1] = target.y + (values[i + 1] - old.y) * scale;
        values[i + 2] = target.z + (values[i + 2] - old.z) * scale;
      }
    }
  }
  root.updateMatrixWorld(true);
  return bones;
}

// 部品を世界の位置（休みの姿勢）で作って、骨へ付ける（骨と一緒に動く）。pos・rot は世界での位置と回転
export function attach(bone, mesh, pos = null, rot = null) {
  if (pos) mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  bone.attach(mesh);
  return mesh;
}

export function buildCrownedKnight(gltf) {
  const root = gltf.scene;
  // 元の丸い体・兜・マント・短い剣は外す（骨格と動作は残す）
  const old = [];
  root.traverse((o) => { if (o.isMesh) old.push(o); });
  for (const mesh of old) mesh.parent.remove(mesh);
  const bones = retarget(gltf);
  const m = createMaterials();
  const B = (name) => bones[clean(name)];
  const at = (name) => B(name).getWorldPosition(new THREE.Vector3()).toArray();
  const mesh = (geometry, material) => new THREE.Mesh(geometry, material);

  const hips = at('hips');
  const chest = at('chest');
  const neck = at('head');
  const sides = [['l', 1], ['r', -1]];

  // ── 胴：鎧下（布）→ 鎖帷子 → 胸当て（胸の張り出し、中央の稜線）→ 腹の板3枚 → 革の帯 ──
  attach(B('spine'), mesh(loft([0, hips[1] - 0.05, 0], [0, chest[1] + 0.16, 0], [
    { t: 0, rx: 0.17, rz: 0.12 }, { t: 0.4, rx: 0.15, rz: 0.11 }, { t: 0.75, rx: 0.19, rz: 0.13 }, { t: 1, rx: 0.13, rz: 0.1 },
  ]), m.gambeson));
  attach(B('chest'), mesh(loft([0, chest[1] - 0.12, 0.004], [0, neck[1] + 0.005, 0.004], [
    { t: 0, rx: 0.175, rz: 0.125, cz: 0.01 }, { t: 0.35, rx: 0.205, rz: 0.142, cz: 0.025 }, { t: 0.7, rx: 0.215, rz: 0.135, cz: 0.02 },
    { t: 0.9, rx: 0.175, rz: 0.115, cz: 0.005 }, { t: 1, rx: 0.08, rz: 0.075 },
  ], { segments: 24 }), m.iron));
  // 胸の中央の稜線と、銀の縁取り
  attach(B('chest'), mesh(new THREE.BoxGeometry(0.018, 0.24, 0.02), m.silver), [0, chest[1] + 0.06, 0.162], [-0.12, 0, 0]);
  attach(B('chest'), mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 28, Math.PI), m.silver), [0, neck[1] - 0.05, 0.02], [-Math.PI / 2 + 0.25, 0, 0]);
  // 腹の板（上から少しずつ重なる）
  // 腹の板：胸当ての下に、体に沿った細い板を2枚（上の板の下に少し潜る）
  [[0.0, 0.168], [0.055, 0.17]].forEach(([dy, r], i) => {
    const y = chest[1] - 0.115 - dy;
    attach(B('spine'), mesh(loft([0, y - 0.06, 0.01], [0, y, 0.01], [{ t: 0, rx: r + 0.006, rz: r * 0.74, cz: 0.012 }, { t: 1, rx: r, rz: r * 0.72, cz: 0.01 }], { segments: 22 }), i % 2 ? m.ironDark : m.iron));
  });
  // 革の帯と、銀の留め金
  attach(B('hips'), mesh(loft([0, hips[1] - 0.02, 0], [0, hips[1] + 0.045, 0], [{ t: 0, rx: 0.18, rz: 0.13 }, { t: 1, rx: 0.18, rz: 0.13 }], { segments: 22 }), m.leather));
  attach(B('hips'), mesh(new RoundedBoxGeometry(0.06, 0.05, 0.02, 2, 0.006), m.silver), [0, hips[1] + 0.012, 0.132]);
  // 鎖帷子の裾（腰から腿の上まで）
  attach(B('hips'), mesh(loft([0, hips[1] - 0.2, 0], [0, hips[1] - 0.01, 0], [{ t: 0, rx: 0.22, rz: 0.17 }, { t: 1, rx: 0.17, rz: 0.125 }], { segments: 22, capStart: false }), m.mail));
  // 腿の板（腰から下がる2段の板。腿の骨に付けて、脚と一緒に動く）
  for (const [s, sign] of sides) {
    const hip = at(`upperleg.${s}`);
    for (let k = 0; k < 2; k++) {
      const tasset = mesh(new RoundedBoxGeometry(0.15, 0.1, 0.02, 2, 0.008), k ? m.ironDark : m.iron);
      tasset.position.set(hip[0] + sign * 0.03, hips[1] - 0.06 - k * 0.075, 0.125);
      tasset.rotation.set(-0.12, sign * 0.25, 0);
      attach(B(`upperleg.${s}`), tasset);
    }
  }
  // 前垂れ（布）：実行時に、上がった方の腿へ合わせて揺らす
  const tabard = new THREE.Group();
  tabard.name = 'tabard';
  tabard.position.set(0, hips[1] - 0.02, 0.135);
  const flap = mesh(new THREE.PlaneGeometry(0.2, 0.46, 1, 4), m.hood);
  flap.position.set(0, -0.23, 0.005);
  tabard.add(flap);
  attach(B('hips'), tabard);

  // ── 首と兜：鎖の頸当て → 兜（鉢・面頬の覗き穴・通気孔・中央の稜線）→ 王冠（細長い尖塔、古びた銀の厚み、正面に石） ──
  // 首当て：鉄の板（下は肩へ広がる）
  attach(B('chest'), mesh(loft([0, neck[1] - 0.05, 0], [0, neck[1] + 0.07, 0.005], [{ t: 0, rx: 0.16, rz: 0.13 }, { t: 0.45, rx: 0.1, rz: 0.095 }, { t: 1, rx: 0.075, rz: 0.075 }], { capStart: false, segments: 22 }), m.ironDark));
  const headY = neck[1] + 0.06;
  const helm = loft([0, headY, 0.01], [0, headY + 0.3, 0.005], [
    { t: 0, rx: 0.115, rz: 0.125, cz: 0.01 }, { t: 0.2, rx: 0.118, rz: 0.13, cz: 0.012 }, { t: 0.55, rx: 0.12, rz: 0.135, cz: 0.012 },
    { t: 0.8, rx: 0.112, rz: 0.125, cz: 0.006 }, { t: 0.93, rx: 0.085, rz: 0.095 }, { t: 1, rx: 0.03, rz: 0.035 },
  ], { segments: 26 });
  attach(B('head'), mesh(helm, m.iron));
  // 面頬：前へ尖る板と、横に長い覗き穴（暗い）
  const visor = loft([0, headY + 0.015, 0.06], [0, headY + 0.19, 0.06], [{ t: 0, rx: 0.1, rz: 0.08, cz: 0.04 }, { t: 0.5, rx: 0.112, rz: 0.088, cz: 0.05 }, { t: 1, rx: 0.1, rz: 0.08, cz: 0.04 }], { segments: 26 });
  attach(B('head'), mesh(visor, m.ironDark));
  attach(B('head'), mesh(new THREE.BoxGeometry(0.19, 0.02, 0.02), m.dark), [0, headY + 0.165, 0.152]);
  // 覗き穴の上下の縁と、額の帯（くすんだ銀）
  for (const dy of [0.181, 0.149]) attach(B('head'), mesh(new THREE.BoxGeometry(0.2, 0.008, 0.014), m.silver), [0, headY + dy, 0.155]);
  attach(B('head'), mesh(new THREE.TorusGeometry(0.122, 0.006, 6, 30), m.silver), [0, headY + 0.2, 0.01], [Math.PI / 2, 0, 0]);
  attach(B('head'), mesh(new THREE.BoxGeometry(0.014, 0.17, 0.03), m.silver), [0, headY + 0.1, 0.158]);
  for (const x of [-0.045, -0.025, 0.025, 0.045]) attach(B('head'), mesh(new THREE.BoxGeometry(0.008, 0.05, 0.02), m.dark), [x, headY + 0.07, 0.15]);
  // 王冠
  const crownY = headY + 0.22;
  const band = new THREE.LatheGeometry([new THREE.Vector2(0.122, 0), new THREE.Vector2(0.136, 0.0), new THREE.Vector2(0.14, 0.06), new THREE.Vector2(0.126, 0.065), new THREE.Vector2(0.122, 0)], 32);
  attach(B('head'), mesh(band, m.crown), [0, crownY, 0.005]);
  // 尖塔：正面の中央がいちばん高く、左右へ高低を交互に。後ろは低い
  const spires = [[0, 0.36, 0.07], [0.42, 0.22, 0.055], [-0.42, 0.22, 0.055], [0.84, 0.29, 0.06], [-0.84, 0.29, 0.06], [1.28, 0.18, 0.05], [-1.28, 0.18, 0.05], [1.85, 0.22, 0.05], [-1.85, 0.22, 0.05], [Math.PI, 0.16, 0.05]];
  for (const [angle, h, w] of spires) {
    const g = new THREE.ExtrudeGeometry(spireShape(h, w), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    g.translate(0, 0, -0.004);
    const spire = mesh(g, m.crown);
    spire.position.set(Math.sin(angle) * 0.136, crownY + 0.055, 0.005 + Math.cos(angle) * 0.136);
    spire.rotation.set(-0.08, angle, 0, 'YXZ');
    attach(B('head'), spire);
  }
  attach(B('head'), mesh(new THREE.OctahedronGeometry(0.014, 0), m.gem), [0, crownY + 0.032, 0.146]);
  // フード：兜の後ろから肩へ垂れる布
  attach(B('chest'), mesh(loft([0, neck[1] - 0.06, -0.03], [0, headY + 0.24, -0.02], [
    { t: 0, rx: 0.26, rz: 0.19, cz: -0.02 }, { t: 0.3, rx: 0.17, rz: 0.15, cz: -0.03 }, { t: 0.7, rx: 0.15, rz: 0.15, cz: -0.04 }, { t: 1, rx: 0.1, rz: 0.11, cz: -0.06 },
  ], { segments: 22, arc: [-Math.PI * 0.18, Math.PI * 1.18] }), m.hood));

  // ── 腕：肩当て（3枚の重なり）→ 上腕 → 肘当て → 前腕 → 籠手（甲と指の板） ──
  for (const [s, sign] of sides) {
    const shoulder = at(`upperarm.${s}`);
    const elbow = at(`lowerarm.${s}`);
    const wrist = at(`wrist.${s}`);
    const hand = at(`hand.${s}`);
    const upper = B(`upperarm.${s}`);
    const lower = B(`lowerarm.${s}`);
    // 布の袖（関節の隙間を埋める）
    attach(upper, mesh(loft(shoulder, elbow, [{ t: 0, rx: 0.06, rz: 0.06 }, { t: 1, rx: 0.048, rz: 0.048 }]), m.gambeson));
    attach(lower, mesh(loft(elbow, wrist, [{ t: 0, rx: 0.046, rz: 0.046 }, { t: 1, rx: 0.036, rz: 0.036 }]), m.gambeson));
    // 肩当て：肩を覆う大きな半球と、腕へ下がる2枚
    for (let k = 0; k < 3; k++) {
      const radius = 0.145 - k * 0.016;
      const cap = new THREE.SphereGeometry(radius, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42);
      const piece = mesh(cap, k === 0 ? m.iron : m.ironDark);
      const p = lerp3(shoulder, elbow, k * 0.16);
      piece.position.set(p[0] - sign * 0.005, p[1] + 0.03 - k * 0.035, p[2]);
      piece.scale.set(1.05, 0.9 - k * 0.1, 1.15);
      piece.rotation.set(0, 0, -sign * (0.55 + k * 0.18));
      const world = piece.position.clone();
      attach(upper, piece);
      // いちばん上の板の縁（銀）。位置は骨に付ける前の世界の位置で決める
      if (k === 0) {
        const rim = mesh(new THREE.TorusGeometry(radius * 1.02, 0.007, 6, 28), m.silver);
        rim.position.copy(world);
        rim.rotation.set(Math.PI / 2, 0, -sign * 0.55, 'ZXY');
        rim.scale.set(1.05, 1.15, 1);
        attach(upper, rim);
      }
    }
    // 上腕の板
    attach(upper, mesh(loft(lerp3(shoulder, elbow, 0.35), elbow, [{ t: 0, rx: 0.062, rz: 0.06 }, { t: 1, rx: 0.056, rz: 0.054 }], { segments: 16 }), m.iron));
    // 肘当て：丸い当てと、外側の扇形の羽
    const couter = mesh(new THREE.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m.iron);
    couter.position.set(...elbow);
    couter.rotation.set(Math.PI / 2, 0, 0);
    attach(lower, couter);
    const wing = mesh(new THREE.ConeGeometry(0.055, 0.03, 12, 1, true), m.silver);
    wing.position.set(elbow[0], elbow[1], elbow[2] - 0.05);
    wing.rotation.set(-Math.PI / 2, 0, 0);
    attach(lower, wing);
    // 前腕（手首へ細くなり、手首で少し開く）
    attach(lower, mesh(loft(lerp3(elbow, wrist, 0.12), wrist, [{ t: 0, rx: 0.054, rz: 0.05 }, { t: 0.8, rx: 0.044, rz: 0.042 }, { t: 1, rx: 0.058, rz: 0.054 }], { segments: 16 }), m.iron));
    // 籠手：甲の板、指の4枚の板（握った形）、親指
    const dir = dirOf(wrist, hand);
    const handBone = B(`hand.${s}`);
    const back = mesh(new RoundedBoxGeometry(0.09, 0.03, 0.085, 2, 0.01), m.iron);
    const hc = lerp3(hand, hand.map((x, i) => x + dir.toArray()[i] * 0.05), 0.5);
    back.position.set(hc[0], hc[1] + 0.012, hc[2]);
    attach(handBone, back);
    // 握った指：甲の先から下へ曲がる一つの塊（指の板の段は模様で見せる）
    const fist = mesh(new RoundedBoxGeometry(0.05, 0.06, 0.088, 2, 0.016), m.ironDark);
    fist.position.set(hc[0] + dir.x * 0.05, hc[1] - 0.018, hc[2] + dir.z * 0.05);
    attach(handBone, fist);
    const thumb = mesh(new RoundedBoxGeometry(0.05, 0.022, 0.024, 2, 0.008), m.ironDark);
    thumb.position.set(hc[0] + dir.x * 0.02, hc[1] - 0.012, hc[2] + 0.046);
    attach(handBone, thumb);
  }

  // ── 脚：腿の鎧 → 膝当て（丸い当てと横の羽）→ 脛当て → 鉄靴（重なった板とつま先） ──
  for (const [s, sign] of sides) {
    const hip = at(`upperleg.${s}`);
    const knee = at(`lowerleg.${s}`);
    const ankle = at(`foot.${s}`);
    const toes = at(`toes.${s}`);
    const upper = B(`upperleg.${s}`);
    const lower = B(`lowerleg.${s}`);
    const foot = B(`foot.${s}`);
    const toesBone = B(`toes.${s}`);
    attach(upper, mesh(loft(hip, knee, [{ t: 0, rx: 0.09, rz: 0.09 }, { t: 1, rx: 0.06, rz: 0.06 }]), m.gambeson));
    attach(lower, mesh(loft(knee, ankle, [{ t: 0, rx: 0.058, rz: 0.058 }, { t: 0.7, rx: 0.05, rz: 0.05 }, { t: 1, rx: 0.038, rz: 0.038 }]), m.gambeson));
    // 腿：前を覆う板（後ろは開いている形にせず、厚い筒）
    attach(upper, mesh(loft(lerp3(hip, knee, 0.15), lerp3(hip, knee, 0.92), [{ t: 0, rx: 0.088, rz: 0.084, cz: 0.012 }, { t: 0.6, rx: 0.074, rz: 0.072, cz: 0.012 }, { t: 1, rx: 0.064, rz: 0.064, cz: 0.012 }], { segments: 18, side: [sign, 0, 0] }), m.iron));
    // 膝当て
    const poleyn = mesh(new THREE.SphereGeometry(0.065, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m.iron);
    poleyn.position.set(knee[0], knee[1], knee[2] + 0.035);
    poleyn.rotation.set(Math.PI / 2, 0, 0);
    // 平たい当て板（丸い玉に見えないよう、前後に薄く、上下に長く）
    poleyn.scale.set(1.05, 0.55, 1.35);
    attach(lower, poleyn);
    const kneeWing = mesh(new THREE.ConeGeometry(0.06, 0.025, 12, 1, true), m.silver);
    kneeWing.position.set(knee[0] + sign * 0.06, knee[1], knee[2] + 0.01);
    kneeWing.rotation.set(0, 0, sign * Math.PI / 2);
    attach(lower, kneeWing);
    // 脛当て：前へ少し尖った筒
    attach(lower, mesh(loft(lerp3(knee, ankle, 0.12), lerp3(knee, ankle, 0.97), [{ t: 0, rx: 0.064, rz: 0.066, cz: 0.012 }, { t: 0.45, rx: 0.06, rz: 0.066, cz: 0.014 }, { t: 1, rx: 0.046, rz: 0.05, cz: 0.008 }], { segments: 18, side: [sign, 0, 0] }), m.iron));
    // 鉄靴：足首の輪、甲の板3枚、つま先、革の靴底
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
    const toeCap = mesh(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.iron);
    toeCap.position.set(toes[0], 0.025, toes[2] + 0.04);
    toeCap.scale.set(0.95, 0.6, 1.5);
    attach(toesBone, toeCap);
  }

  // ── 長剣：右手の取り付け先の「上」へ伸びる。握りの中心が手の位置 ──
  const slot = B('handslot.r');
  const sword = new THREE.Group();
  sword.name = 'Crowned_Sword';
  const blade = new THREE.Shape();
  blade.moveTo(-0.022, 0); blade.lineTo(-0.022, 0.78); blade.lineTo(-0.012, 0.88); blade.lineTo(0, 0.93); blade.lineTo(0.012, 0.88); blade.lineTo(0.022, 0.78); blade.lineTo(0.022, 0); blade.lineTo(-0.022, 0);
  const bladeGeometry = new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 });
  bladeGeometry.translate(0, 0.13, -0.003);
  sword.add(mesh(bladeGeometry, m.blade));
  const fuller = mesh(new THREE.BoxGeometry(0.008, 0.6, 0.012), m.ironDark);
  fuller.position.y = 0.45;
  sword.add(fuller);
  const guard = mesh(new RoundedBoxGeometry(0.24, 0.022, 0.03, 2, 0.008), m.silver);
  guard.position.y = 0.12;
  sword.add(guard);
  for (const x of [-0.12, 0.12]) { const tip = mesh(new THREE.SphereGeometry(0.016, 10, 8), m.silver); tip.position.set(x, 0.118, 0); sword.add(tip); }
  const grip = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.22, 10), m.leather);
  sword.add(grip);
  const pommel = mesh(new THREE.SphereGeometry(0.026, 12, 10), m.silver);
  pommel.position.y = -0.125;
  pommel.scale.set(1, 0.8, 0.55);
  sword.add(pommel);
  sword.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  slot.add(sword);

  // ── マント：肩の後ろから足首まで。専用の骨5本に重みを分けた布（裾は破れている） ──
  const cloak = buildCloak(B('chest'), chest, neck, m);
  root.add(cloak.mesh);

  mergeParts(root);
  root.userData.nativeScale = true;
  root.userData.animationSpeed = ANIMATION_SPEED;
  root.userData.model = 'crowned-knight';
  root.updateMatrixWorld(true);
  return { scene: root, animations: gltf.animations };
}

export function buildCloak(chestBone, chest, neck, m, name = 'Crowned_Cloak') {
  const ROWS = 14;
  const COLS = 16;
  const top = neck[1] - 0.04;
  const bottom = 0.1;
  // 骨：肩の後ろ（胸の骨の子）から、下へ4つ
  const bones = [];
  const rootBone = new THREE.Bone();
  rootBone.name = 'cape0';
  chestBone.add(rootBone);
  rootBone.position.copy(chestBone.worldToLocal(new THREE.Vector3(0, top, -0.16)));
  // 胸の骨の回転を打ち消し、マントの骨は世界の向きでまっすぐ下へ
  const chestQ = chestBone.getWorldQuaternion(new THREE.Quaternion());
  rootBone.quaternion.copy(chestQ.clone().invert());
  bones.push(rootBone);
  const step = (top - bottom) / 4;
  for (let i = 1; i <= 4; i++) {
    const bone = new THREE.Bone();
    bone.name = `cape${i}`;
    bone.position.set(0, -step, -0.035);
    bones[i - 1].add(bone);
    bones.push(bone);
  }
  chestBone.updateMatrixWorld(true);
  const positions = [];
  const uvs = [];
  const skinIndex = [];
  const skinWeight = [];
  const index = [];
  for (let r = 0; r <= ROWS; r++) {
    const v = r / ROWS;
    const y = top - (top - bottom) * v;
    // 上は肩を包み（狭く深い）、下は広がる。後ろへ少し流れる
    const spread = 1.95 - 0.35 * (1 - v); // 角度の幅（ラジアン）
    const radius = 0.2 + 0.28 * v;
    const back = -0.12 - 0.14 * v;
    for (let c = 0; c <= COLS; c++) {
      const u = c / COLS;
      const a = Math.PI + (u - 0.5) * spread;
      // 折り目：縦の波
      const fold = 0.025 * Math.sin(u * Math.PI * 7) * (0.3 + v);
      const x = Math.sin(a) * (radius + fold) * 1.15;
      const z = Math.cos(a) * (radius * 0.7 + fold) + back;
      positions.push(x, y, z);
      uvs.push(u, 1 - v);
      // 高さに応じて、隣り合う2本の骨に重みを分ける
      const t = v * 4;
      const i0 = Math.min(4, Math.floor(t));
      const i1 = Math.min(4, i0 + 1);
      const w1 = t - Math.floor(t);
      skinIndex.push(i0, i1, 0, 0);
      skinWeight.push(1 - w1, i1 === i0 ? 0 : w1, 0, 0);
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c;
      const b = a + COLS + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(geometry, m.cloak);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  return { mesh, bones };
}

// 同じ親（骨や剣）に付いた、同じ材質の部品を1つの形にまとめる（描く回数を減らす。動きは同じ）
export function mergeParts(root) {
  const parents = new Set();
  root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.parent) parents.add(o.parent); });
  for (const parent of parents) {
    const groups = new Map();
    for (const child of [...parent.children]) {
      if (!child.isMesh || child.isSkinnedMesh || child.children.length) continue;
      if (!groups.has(child.material)) groups.set(child.material, []);
      groups.get(child.material).push(child);
    }
    for (const [material, list] of groups) {
      if (list.length < 2) continue;
      const geometries = list.map((child) => {
        child.updateMatrix();
        const g = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(child.matrix);
        const keep = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) if (g.getAttribute(name)) keep.setAttribute(name, g.getAttribute(name));
        if (!keep.getAttribute('uv')) keep.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((keep.getAttribute('position').count) * 2), 2));
        return keep;
      });
      const merged = new THREE.Mesh(mergeGeometries(geometries, false), material);
      merged.name = `${parent.name}_${material.name}`;
      merged.castShadow = true;
      merged.receiveShadow = true;
      for (const child of list) parent.remove(child);
      parent.add(merged);
    }
  }
}
