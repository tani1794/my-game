// 獣・虫・蝙蝠・蜘蛛の見た目（コードで形を作る）：関節ごとに分かれた部品と、その動き。
// 形は種類ごとに一度だけ作り（ひな形）、敵ごとには複製する（形の情報は共有）。動きは animate で関節を回す。
// 単位はメートル。前は +z。当たり判定と攻撃の届く範囲は、今までの数値（src/areas/*/foes.js）のまま。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded, bodyLoft, plate, platesAlong, crystalCluster } from './creatureKit.js';

// ── 材質（ひな形で共有。敵ごとの光り方は foeViews.js が複製して変える） ──
function canvasTexture(size, draw) {
  if (typeof document === 'undefined') return null; // テストなど、画面のない所では模様なし
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let materials = null;
function getMaterials() {
  if (materials) return materials;
  const random = seeded(77);
  // 重なった鱗（明るい縁と暗い影）
  const scales = canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#a8a8b0'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s + 16; y += 12) {
      for (let x = (y / 12) % 2 ? 6 : 0; x < s + 12; x += 12) {
        { const v = 150 + random() * 50; ctx.fillStyle = `rgb(${v},${v},${v + 6})`; }
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,46,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  });
  // 甲殻のひび
  const shell = canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#b4aebc'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { const v = 150 + random() * 70; ctx.fillStyle = `rgba(${v},${v - 6},${v + 6},0.5)`; ctx.fillRect(random() * s, random() * s, 2, 2); }
    ctx.strokeStyle = 'rgba(40,36,44,0.8)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { ctx.beginPath(); let x = random() * s; let y = random() * s; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (random() - 0.5) * 24; y += (random() - 0.5) * 24; ctx.lineTo(x, y); } ctx.stroke(); }
  });
  // 翼膜：灰色の薄い膜に、シアンの細い筋（光る）
  const veins = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#7fe6ff'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 18; i++) {
      let x = random() * s; let y = random() * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (random() - 0.5) * 50; y += (random() - 0.5) * 50; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  const membraneColor = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#8f9196'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) { const v = 110 + random() * 60; ctx.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; ctx.fillRect(random() * s, random() * s, 4 + random() * 10, 1 + random() * 3); }
  });
  materials = {
    hide: new THREE.MeshStandardMaterial({ name: 'creature_hide', color: '#7c808a', map: scales, roughness: 0.62, metalness: 0.12, flatShading: true }),
    hideDark: new THREE.MeshStandardMaterial({ name: 'creature_hide_dark', color: '#4c4e56', map: scales, roughness: 0.7, metalness: 0.1, flatShading: true }),
    shell: new THREE.MeshStandardMaterial({ name: 'creature_shell', color: '#6c6676', map: shell, roughness: 0.48, metalness: 0.22, flatShading: true }),
    shellDark: new THREE.MeshStandardMaterial({ name: 'creature_shell_dark', color: '#45404c', map: shell, roughness: 0.55, metalness: 0.18, flatShading: true }),
    // 鱗の板：黒に近く、少しだけ光を返す（面の向きが読める）
    plate: new THREE.MeshStandardMaterial({ name: 'creature_plate', color: '#4a4d57', map: shell, roughness: 0.42, metalness: 0.3, flatShading: true }),
    bone: new THREE.MeshStandardMaterial({ name: 'creature_bone', color: '#55555c', roughness: 0.55, metalness: 0.1 }),
    claw: new THREE.MeshStandardMaterial({ name: 'creature_claw', color: '#77726a', roughness: 0.6, flatShading: true }),
    membrane: new THREE.MeshStandardMaterial({ name: 'creature_membrane', color: '#c9ccd2', map: membraneColor, emissiveMap: veins, emissive: '#6fd8ff', emissiveIntensity: 0.6, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    crystal: new THREE.MeshStandardMaterial({ name: 'creature_crystal', color: '#2fb6d2', emissive: '#0e86a8', emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, flatShading: true }),
    eye: new THREE.MeshStandardMaterial({ name: 'creature_eye', color: '#bff6ff', emissive: '#5fe8ff', emissiveIntensity: 2.4 }),
  };
  return materials;
}

// ── 関節の道具：世界の座標で形を作り、節（回転の中心）の下へ置く ──
const centers = new WeakMap();
function joint(name, parent, center) {
  const node = new THREE.Group();
  node.name = name;
  const p = centers.get(parent) ?? [0, 0, 0];
  node.position.set(center[0] - p[0], center[1] - p[1], center[2] - p[2]);
  centers.set(node, center);
  parent.add(node);
  return node;
}
function put(node, geometries, material) {
  const [px, py, pz] = centers.get(node) ?? [0, 0, 0];
  const list = geometries.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    if (!flat.getAttribute('uv')) flat.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count * 2), 2));
    const keep = new THREE.BufferGeometry();
    for (const n of ['position', 'normal', 'uv']) keep.setAttribute(n, flat.getAttribute(n));
    return keep;
  });
  const g = mergeGeometries(list, false);
  g.translate(-px, -py, -pz);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = true;
  mesh.userData.shared = true; // 形は同じ種類の敵で共有（捨てない）
  node.add(mesh);
  return mesh;
}
// 止まる・動き出すときに、脚の振り幅をなめらかに変える
const ease = (from = 0, to, k) => from + (to - from) * Math.min(1, k);
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const cone = (r, h, at, rx, ry = 0, rz = 0) => new THREE.ConeGeometry(r, h, 5).rotateX(rx).rotateY(ry).rotateZ(rz).translate(...at);

// 鋭い結晶の棘：断面がひし形の細い錐（横に平たい）。root から dir の向きへ、根元は少し埋める
function shard(root, dir, length, width, flat = 0.5) {
  const g = new THREE.ConeGeometry(width, length, 4).translate(0, length / 2, 0).scale(1, 1, flat);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  g.applyQuaternion(q);
  const d = new THREE.Vector3(...dir).normalize().multiplyScalar(-length * 0.15);
  g.translate(root[0] + d.x, root[1] + d.y, root[2] + d.z);
  return g;
}

// 細い手足の一節（a → b、太さ ra → rb）
// 筋肉の膨らみ：付け根から 3 割のところがいちばん太く、先へ細くなる（前後に少し厚い）
const segment = (a, b, ra, rb, seed, rough = 0.05) => bodyLoft([
  { p: a, rx: ra * 0.92, ry: ra * 0.92 }, { p: lerp(a, b, 0.3), rx: ra * 1.05, ry: ra * 1.15 }, { p: lerp(a, b, 0.75), rx: (ra + rb) / 2, ry: (ra + rb) / 2 * 1.05 }, { p: b, rx: rb, ry: rb },
], { segments: 10, steps: 2, rough, seed });

// 3節の脚：付け根 → 曲がり目 → 足首 → 足先。joints を返す
function leg(parent, name, points, radii, material, seed, tipMaterial = null) {
  const [a, b, c, d] = points;
  const upper = joint(`${name}_upper`, parent, a);
  put(upper, [segment(a, b, radii[0], radii[1], seed)], material);
  const lower = joint(`${name}_lower`, upper, b);
  // 関節のふくらみ（膝・足首）：曲がる所が読めるように
  put(lower, [segment(b, c, radii[1], radii[2], seed + 1), new THREE.IcosahedronGeometry(radii[1] * 1.2, 0).translate(...b), new THREE.IcosahedronGeometry(radii[2] * 1.15, 0).translate(...c)], material);
  const foot = joint(`${name}_foot`, lower, c);
  put(foot, [segment(c, d, radii[2], radii[3], seed + 2)], tipMaterial ?? material);
  return { upper, lower, foot };
}

// ── 晶牙ハウンド：細身の四足。胸郭・腰・首・あご・足先を分け、背骨と尾に結晶 ──
function buildHound() {
  const m = getMaterials();
  const random = seeded(301);
  const root = new THREE.Group();
  const body = joint('body', root, [0, 0.92, 0]);
  // 胴：深い胸郭（前）→ くびれた腰（腹は高い）→ 腰。上半分を鱗の板が覆う（後ろ向きに重なる）
  const spine = [[0, 0.98, -0.62], [0, 1.0, -0.2], [0, 1.08, 0.3], [0, 1.16, 0.58]];
  put(body, [
    bodyLoft([
      { p: [0, 0.92, -0.66], rx: 0.15, ry: 0.19 }, { p: [0, 0.92, -0.42], rx: 0.17, ry: 0.21 },
      { p: [0, 0.92, -0.1], rx: 0.13, ry: 0.16 },
      { p: [0, 0.9, 0.28], rx: 0.19, ry: 0.28 }, { p: [0, 0.96, 0.58], rx: 0.18, ry: 0.25 },
    ], { segments: 14, steps: 4, rough: 0.05, seed: 1 }),
  ], m.hide);
  put(body, [
    ...platesAlong([0, 0.98, 0.62], [0, 0.95, -0.66], 11, { radius: 0.17, around: [0, -0.45, 0.45, -0.9, 0.9, -1.3, 1.3], size: [0.075, 0.022, 0.1], seedBase: 10 }),
    ...platesAlong([0, 0.86, 0.5], [0, 0.88, 0.05], 3, { radius: 0.24, around: [-1.7, 1.7], size: [0.08, 0.02, 0.1], seedBase: 60 }),
  ], m.plate);
  // 背骨の結晶：1本ずつの鋭い棘。肩がいちばん長く、腰へ短く、後ろへ傾く
  const spikes = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const p = lerp(lerp(spine[3], spine[1], Math.min(1, t * 1.5)), spine[0], Math.max(0, t * 1.5 - 0.5) * 2);
    const length = 0.34 - t * 0.2 + random() * 0.05;
    spikes.push(shard([p[0], p[1] + 0.12, p[2]], [(random() - 0.5) * 0.2, 1, -0.75], length, 0.035));
    if (i % 2 === 0 && i < 7) for (const sx of [-1, 1]) spikes.push(shard([sx * 0.09, p[1] + 0.08, p[2] - 0.03], [sx * 0.5, 1, -0.8], length * 0.55, 0.025));
  }
  // 肩の前と肘の外の小さな棘
  for (const sx of [-1, 1]) spikes.push(shard([sx * 0.17, 0.98, 0.62], [sx * 0.6, 0.7, 0.3], 0.16, 0.025), shard([sx * 0.2, 0.86, 0.52], [sx, 0.3, 0.1], 0.12, 0.02));
  put(body, spikes, m.crystal);
  // 首：肩から前上へ反る太い首、鱗の板、たてがみの棘
  const neck = joint('neck', body, [0, 1.1, 0.62]);
  put(neck, [bodyLoft([{ p: [0, 1.02, 0.55], rx: 0.15, ry: 0.19 }, { p: [0, 1.15, 0.78], rx: 0.12, ry: 0.14 }, { p: [0, 1.22, 0.9], rx: 0.1, ry: 0.11 }], { segments: 12, steps: 3, rough: 0.04, seed: 3 })], m.hide);
  put(neck, platesAlong([0, 1.1, 0.6], [0, 1.24, 0.9], 4, { radius: 0.13, around: [0, -0.6, 0.6, -1.2, 1.2], size: [0.06, 0.018, 0.08], seedBase: 80 }), m.plate);
  put(neck, [0, 1, 2, 3].map((i) => shard([0, 1.27 + i * 0.03, 0.66 + i * 0.08], [0, 1, -0.6], 0.2 + i * 0.015, 0.03)), m.crystal);
  // 頭：長い鼻先のくさび形、高く尖った耳、光る目
  const head = joint('head', neck, [0, 1.24, 0.92]);
  put(head, [
    bodyLoft([{ p: [0, 1.25, 0.88], rx: 0.1, ry: 0.11 }, { p: [0, 1.22, 1.06], rx: 0.085, ry: 0.085 }, { p: [0, 1.16, 1.28], rx: 0.05, ry: 0.05 }, { p: [0, 1.13, 1.36], rx: 0.03, ry: 0.03 }], { segments: 10, steps: 3, rough: 0.04, seed: 5 }),
    cone(0.045, 0.22, [0.065, 1.42, 0.9], -0.2, 0, -0.18), cone(0.045, 0.22, [-0.065, 1.42, 0.9], -0.2, 0, 0.18),
  ], m.hideDark);
  put(head, [plate([0, 1.33, 1.0], [0, 1, 0.2], [0, 0, 1], [0.06, 0.016, 0.12], 90), plate([0.07, 1.27, 1.04], [0.8, 0.6, 0], [0, 0, 1], [0.04, 0.012, 0.08], 91), plate([-0.07, 1.27, 1.04], [-0.8, 0.6, 0], [0, 0, 1], [0.04, 0.012, 0.08], 92)], m.plate);
  put(head, [new THREE.SphereGeometry(0.016, 6, 4).scale(1.4, 0.7, 1).translate(0.062, 1.28, 1.08), new THREE.SphereGeometry(0.016, 6, 4).scale(1.4, 0.7, 1).translate(-0.062, 1.28, 1.08)], m.eye);
  const jaw = joint('jaw', head, [0, 1.17, 0.98]);
  put(jaw, [
    bodyLoft([{ p: [0, 1.15, 0.98], rx: 0.07, ry: 0.035 }, { p: [0, 1.11, 1.3], rx: 0.035, ry: 0.022 }], { segments: 8, steps: 2, rough: 0.04, seed: 6 }),
  ], m.hideDark);
  put(jaw, [-0.028, 0.028].map((x) => cone(0.011, 0.055, [x, 1.15, 1.28], 0)), m.claw);
  // 脚：太い腿（筋肉の膨らみ）から細い足先へ。前は肩 → 肘 → 手首 → 足先、後ろは股 → 膝 → かかと（後ろへ）→ 足先。足に爪
  const legs = [];
  const paw = (node, at, sign) => {
    put(node, [bodyLoft([{ p: [at[0], 0.05, at[2] - 0.04], rx: 0.045, ry: 0.035 }, { p: [at[0], 0.035, at[2] + 0.07], rx: 0.05, ry: 0.03 }], { segments: 8, steps: 2, rough: 0.04, seed: 7 + sign })], m.hideDark);
    put(node, [-1, 0, 1].map((k) => cone(0.01, 0.06, [at[0] + k * 0.025, 0.02, at[2] + 0.11], Math.PI / 2 + 0.6)), m.claw);
  };
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    const fore = [[sign * 0.13, 0.98, 0.5], [sign * 0.15, 0.6, 0.4], [sign * 0.14, 0.18, 0.5], [sign * 0.14, 0.05, 0.56]];
    const hind = [[sign * 0.13, 0.95, -0.55], [sign * 0.16, 0.6, -0.32], [sign * 0.15, 0.25, -0.62], [sign * 0.15, 0.05, -0.52]];
    const f = { ...leg(body, `fore_${s}`, fore, [0.11, 0.065, 0.048, 0.04], m.hide, 20 + sign), hind: 0, sign };
    const h = { ...leg(body, `hind_${s}`, hind, [0.14, 0.08, 0.052, 0.04], m.hide, 30 + sign), hind: 1, sign };
    put(f.upper, platesAlong(fore[0], fore[1], 3, { radius: 0.1, around: [0, 0.7, -0.7], size: [0.055, 0.016, 0.07], seedBase: 100 + sign * 10, outward: [sign, 0, 0] }), m.plate);
    put(h.upper, platesAlong(hind[0], hind[1], 3, { radius: 0.12, around: [0, 0.7, -0.7], size: [0.06, 0.016, 0.075], seedBase: 130 + sign * 10, outward: [sign, 0, 0] }), m.plate);
    put(f.lower, platesAlong(fore[1], fore[2], 2, { radius: 0.05, around: [0, 1], size: [0.035, 0.012, 0.06], seedBase: 160 + sign * 10, outward: [0, 0, 1] }), m.plate);
    paw(f.foot, fore[3], sign);
    paw(h.foot, hind[3], sign + 4);
    legs.push(f, h);
  }
  // 尾：5節。下へ垂れてから先が上へ反る。上に棘が並び、先は長い結晶の刃
  let parent = body;
  const tailPoints = [[0, 0.95, -0.66], [0, 0.88, -0.9], [0, 0.76, -1.12], [0, 0.64, -1.32], [0, 0.6, -1.52], [0, 0.66, -1.7]];
  const tail = [];
  for (let i = 0; i < 5; i++) {
    const a = tailPoints[i];
    const b = tailPoints[i + 1];
    const node = joint(`tail${i}`, parent, a);
    put(node, [segment(a, b, 0.065 - i * 0.011, 0.055 - i * 0.011, 40 + i)], m.hide);
    const tip = i === 4;
    put(node, [
      shard(lerp(a, b, 0.5).map((v, k) => v + [0, 0.04 - i * 0.005, 0][k]), [0, 1, -0.8], 0.17 - i * 0.02, 0.025),
      ...(tip ? [shard(b, [0, 0.6, -1], 0.3, 0.035)] : [shard(lerp(a, b, 0.5), [0.7, 0.5, -0.6], 0.09, 0.015), shard(lerp(a, b, 0.5), [-0.7, 0.5, -0.6], 0.09, 0.015)]),
    ], m.crystal);
    tail.push(node);
    parent = node;
  }
  return { root, joints: { body, neck, head, jaw, legs, tail } };
}

function animateHound(rig, frame, dt, time, speed) {
  const { legs, head, jaw, tail, body } = rig.joints;
  const running = speed > 0.3 || (frame.phase === 'strike');
  rig.gait = (rig.gait ?? 0) + dt * (frame.phase === 'strike' ? 16 : 4 + speed * 2.2);
  rig.amp = ease(rig.amp, running ? Math.min(1, 0.4 + speed * 0.15) : 0, dt * 6);
  const amp = rig.amp;
  legs.forEach((l) => {
    // 対角の脚（前左と後右、前右と後左）が同時に出る。前へ振る間は、曲げて持ち上げる
    const phase = rig.gait + (l.sign > 0 ? 0 : Math.PI) + (l.hind ? Math.PI : 0);
    l.upper.rotation.x = -Math.sin(phase) * 0.55 * amp;
    l.lower.rotation.x = Math.max(0, Math.cos(phase)) * 0.65 * amp;
    l.foot.rotation.x = -l.lower.rotation.x * 0.5;
  });
  // 予兆：身を低くして前脚を曲げる。攻撃：伸び上がって跳ぶ
  const crouch = frame.phase === 'windup' ? 1 : 0;
  rig.crouch = (rig.crouch ?? 0) + (crouch - (rig.crouch ?? 0)) * Math.min(1, dt * 8);
  body.position.y = 0.92 - rig.crouch * 0.18 + (running ? Math.abs(Math.sin(rig.gait)) * 0.04 : 0);
  body.rotation.x = rig.crouch * 0.12 - (frame.phase === 'strike' ? 0.1 : 0);
  head.rotation.x = rig.crouch * 0.25 + Math.sin(time * 1.3) * 0.03;
  jaw.rotation.x = frame.phase === 'windup' || frame.phase === 'strike' ? 0.45 : 0.05 + Math.sin(time * 2) * 0.03;
  tail.forEach((t, i) => { t.rotation.y = Math.sin(time * 3 + i * 0.7) * 0.15; t.rotation.x = 0.03 * i; });
}

// ── 硝子羽の蝙蝠：腕と指の骨に沿って張った翼膜。付け根 → 肘 → 手首の順に動く ──
function buildBat() {
  const m = getMaterials();
  const random = seeded(411);
  const root = new THREE.Group();
  // 立つと身長 約1.6m：後ろへ曲がる長い脚、厚い胸、大きな耳。肩と背に結晶
  const body = joint('body', root, [0, 0.95, 0]);
  put(body, [
    bodyLoft([
      { p: [0, 0.76, -0.02], rx: 0.12, ry: 0.11 }, { p: [0, 0.95, 0], rx: 0.15, ry: 0.13 },
      { p: [0, 1.15, 0.03], rx: 0.21, ry: 0.17 }, { p: [0, 1.3, 0.02], rx: 0.2, ry: 0.15 }, { p: [0, 1.42, 0.03], rx: 0.1, ry: 0.09 },
    ], { segments: 14, steps: 3, rough: 0.07, seed: 1 }),
  ], m.hideDark);
  // 胸と背の毛のような重なった板
  put(body, [
    ...platesAlong([0, 1.36, 0.08], [0, 0.9, 0.1], 5, { radius: 0.13, around: [0, -0.7, 0.7], size: [0.07, 0.018, 0.08], seedBase: 50, outward: [0, 0, 1] }),
    ...platesAlong([0, 1.38, -0.06], [0, 0.85, -0.08], 5, { radius: 0.13, around: [-0.6, 0.6], size: [0.07, 0.018, 0.08], seedBase: 70, outward: [0, 0, -1] }),
  ], m.plate);
  const spikes = [];
  for (let i = 0; i < 6; i++) spikes.push(shard([0, 1.4 - i * 0.1, -0.13], [0, 0.5, -1], 0.16 - i * 0.015, 0.025));
  for (const sx of [-1, 1]) {
    spikes.push(...crystalCluster([sx * 0.2, 1.36, -0.03], [sx * 0.6, 1, -0.2], { count: 4, big: 0.2, random, spread: 0.06 }));
    spikes.push(shard([sx * 0.12, 1.4, 0.05], [sx * 0.4, 1, 0.3], 0.12, 0.02));
  }
  put(body, spikes, m.crystal);
  // 頭：狼のような鼻先、大きな耳（内側は暗い）、牙、光る目
  const head = joint('head', body, [0, 1.45, 0.04]);
  put(head, [
    bodyLoft([{ p: [0, 1.48, -0.02], rx: 0.1, ry: 0.1 }, { p: [0, 1.5, 0.1], rx: 0.085, ry: 0.08 }, { p: [0, 1.46, 0.21], rx: 0.045, ry: 0.04 }], { segments: 10, steps: 2, rough: 0.05, seed: 2 }),
    cone(0.075, 0.32, [0.09, 1.7, -0.02], -0.1, 0, -0.35), cone(0.075, 0.32, [-0.09, 1.7, -0.02], -0.1, 0, 0.35),
  ], m.hideDark);
  put(head, [...crystalCluster([0, 1.57, -0.05], [0, 1, -0.6], { count: 3, big: 0.12, random, spread: 0.03 })], m.crystal);
  put(head, [new THREE.SphereGeometry(0.016, 6, 4).translate(0.05, 1.52, 0.13), new THREE.SphereGeometry(0.016, 6, 4).translate(-0.05, 1.52, 0.13)], m.eye);
  put(head, [cone(0.01, 0.06, [0.025, 1.42, 0.2], Math.PI), cone(0.01, 0.06, [-0.025, 1.42, 0.2], Math.PI)], m.claw);
  // 翼：上腕 → 前腕 → 手（親指の鉤爪と、長い指の骨4本）。膜は骨に留めた点へ毎回張り直す（createCreature の stretch）
  const wings = [];
  const membranes = [];
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    const shoulder = [sign * 0.2, 1.3, 0];
    const elbow = [sign * 0.55, 1.45, -0.08];
    const wrist = [sign * 0.95, 1.6, -0.06];
    const upper = joint(`wing_${s}_upper`, body, shoulder);
    put(upper, [segment(shoulder, elbow, 0.045, 0.032, 60 + sign)], m.hideDark);
    const lower = joint(`wing_${s}_lower`, upper, elbow);
    put(lower, [segment(elbow, wrist, 0.032, 0.024, 62 + sign)], m.bone);
    const hand = joint(`wing_${s}_hand`, lower, wrist);
    const fingers = [[sign * 1.5, 1.35, -0.08], [sign * 1.55, 0.85, -0.09], [sign * 1.35, 0.45, -0.07], [sign * 1.0, 0.3, -0.05]];
    // 指は途中に節のある細い骨（2本の筒で、節が少し太い）
    const bones = [];
    fingers.forEach((tip, k) => {
      const knuckle = lerp(wrist, tip, 0.45);
      bones.push(segment(wrist, knuckle, 0.02, 0.014, 70 + k + sign, 0.02), segment(knuckle, tip, 0.014, 0.006, 74 + k + sign, 0.02));
    });
    put(hand, bones, m.bone);
    // 親指の鉤爪：手首から上へ伸び、先が内側へ曲がる
    const thumbTop = [wrist[0] + sign * 0.03, wrist[1] + 0.2, wrist[2]];
    put(hand, [segment(wrist, thumbTop, 0.022, 0.016, 80 + sign, 0.02), cone(0.018, 0.14, [thumbTop[0] - sign * 0.04, thumbTop[1] + 0.04, thumbTop[2]], 0, 0, sign * 1.1)], m.claw);
    // 膜：手首から指先、指先どうしの縁（内側へたわむ）、最後の指先から膝・腰・脇・肘へ
    const pin = (node, at) => ({ node: node.name, at, local: at.map((v, i) => v - centers.get(node)[i]) });
    const sag = (a, b2, toward, k) => lerp(lerp(a, b2, 0.5), toward, k);
    const side = [sign * 0.19, 1.22, -0.03];
    const hip = [sign * 0.12, 0.85, -0.03];
    membranes.push({
      material: m.membrane,
      knee: [sign * 0.14, 0.52, 0.12],
      side, hip,
      build: (legUpper) => ({
        material: m.membrane,
        pins: [
          pin(hand, wrist), ...fingers.map((f) => pin(hand, f)), // 0 手首、1〜4 指先
          pin(hand, sag(fingers[0], fingers[1], wrist, 0.2)), pin(hand, sag(fingers[1], fingers[2], wrist, 0.2)), pin(hand, sag(fingers[2], fingers[3], wrist, 0.2)), // 5〜7 縁
          pin(lower, elbow), pin(body, side), pin(body, hip), pin(legUpper, [sign * 0.14, 0.52, 0.12]), // 8 肘、9 脇、10 腰、11 膝
          pin(hand, lerp(lerp(fingers[3], [sign * 0.14, 0.52, 0.12], 0.5), elbow, 0.2)), // 12 後ろの縁
          pin(hand, lerp(wrist, fingers[0], 0.5)), // 13 前の縁（手首と第一指の間）
        ],
        tris: [[0, 13, 5], [13, 1, 5], [0, 5, 2], [0, 2, 6], [0, 6, 3], [0, 3, 7], [0, 7, 4], [8, 0, 4], [8, 4, 12], [8, 12, 11], [8, 11, 10], [8, 10, 9]],
      }),
    });
    wings.push({ upper, lower, hand, sign });
  }
  // 脚：後ろへ曲がる長い脚（股 → 膝は前 → かかとは後ろ → 鉤爪の足）
  const legs = [];
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    const points = [[sign * 0.1, 0.82, 0], [sign * 0.14, 0.52, 0.12], [sign * 0.13, 0.17, -0.08], [sign * 0.13, 0.03, 0.06]];
    const l = leg(body, `leg_${s}`, points, [0.07, 0.04, 0.028, 0.022], m.hideDark, 80 + sign);
    put(l.foot, [-1, 0, 1].map((k) => cone(0.012, 0.08, [points[3][0] + k * 0.03, 0.02, points[3][2] + 0.06], Math.PI / 2 + 0.5)), m.claw);
    legs.push(l);
  }
  // 膜の後ろの縁は膝に留める（脚が動くと膜も引かれる）
  const pinned = membranes.map((w, i) => w.build(legs[i].upper));
  return { root, joints: { body, head, wings, legs }, membranes: pinned };
}

function animateBat(rig, frame, dt, time) {
  const { wings, head, legs, body } = rig.joints;
  const flying = frame.height > 0.4;
  rig.flap = (rig.flap ?? 0) + dt * (flying ? 9 : 2.2);
  wings.forEach(({ upper, lower, hand, sign }) => {
    if (flying) {
      // 羽ばたき：付け根が先に動き、肘・手首が少し遅れてついてくる
      upper.rotation.z = sign * Math.sin(rig.flap) * 0.65;
      lower.rotation.z = sign * Math.sin(rig.flap - 0.5) * 0.35;
      hand.rotation.z = sign * Math.sin(rig.flap - 1.0) * 0.25;
      upper.rotation.y = 0;
    } else {
      // 地上：翼を高く半ば広げて構える（参考の立ち姿）。ゆっくり呼吸するように開閉
      const breathe = Math.sin(rig.flap) * 0.06;
      upper.rotation.z = sign * (0.45 + breathe);
      lower.rotation.z = sign * (0.15 + breathe * 0.5);
      hand.rotation.z = -sign * 0.1;
      upper.rotation.y = sign * 0.35; // 翼を少し前へ回して体を包む
    }
  });
  body.rotation.x = flying ? 0.5 : 0.05; // 飛ぶときは体を前へ倒す
  head.rotation.x = flying ? -0.4 : 0;
  legs.forEach((l, i) => {
    // 飛ぶ間は脚を後ろへたたむ。地上で動くときは交互に歩く
    l.upper.rotation.x = flying ? 0.7 : Math.sin(time * 6 + i * Math.PI) * 0.25 * Math.min(1, rig.speed ?? 0);
    l.lower.rotation.x = flying ? -0.6 : Math.max(0, Math.sin(time * 6 + i * Math.PI + 1)) * 0.2 * Math.min(1, rig.speed ?? 0);
  });
  if (frame.phase === 'windup') body.rotation.x = 0.9; // 急降下の構え
}

// ── 結晶甲虫：頭・胸・腹、重なった甲殻、大顎、6本の脚（3本ずつ交互に踏む） ──
function buildBeetle() {
  const m = getMaterials();
  const random = seeded(521);
  const root = new THREE.Group();
  const body = joint('body', root, [0, 0.42, 0]);
  // 腹：低く広い楕円。甲殻（左右の鞘翅）が上を覆う
  put(body, [bodyLoft([{ p: [0, 0.38, -0.85], rx: 0.25, ry: 0.15 }, { p: [0, 0.42, -0.45], rx: 0.6, ry: 0.28 }, { p: [0, 0.42, 0.05], rx: 0.66, ry: 0.3 }, { p: [0, 0.42, 0.32], rx: 0.5, ry: 0.24 }], { segments: 14, steps: 3, rough: 0.04, seed: 1 })], m.shellDark);
  const shell = [];
  for (const sign of [-1, 1]) {
    shell.push(bodyLoft([{ p: [sign * 0.27, 0.62, 0.3], rx: 0.28, ry: 0.1 }, { p: [sign * 0.33, 0.68, -0.15], rx: 0.36, ry: 0.13 }, { p: [sign * 0.22, 0.56, -0.75], rx: 0.2, ry: 0.07 }], { segments: 12, steps: 3, rough: 0.05, seed: 3 + sign }));
  }
  // 胸の盾（前の硬い板）
  shell.push(bodyLoft([{ p: [0, 0.5, 0.3], rx: 0.48, ry: 0.22 }, { p: [0, 0.55, 0.55], rx: 0.44, ry: 0.22 }, { p: [0, 0.5, 0.72], rx: 0.32, ry: 0.16 }], { segments: 12, steps: 2, rough: 0.04, seed: 5 }));
  put(body, shell, m.shell);
  // 鞘翅の稜線（前から後ろへ細い板の列）と、胸の盾の縁
  const ridges = [];
  for (const sign of [-1, 1]) {
    for (const [x, y0] of [[0.18, 0.78], [0.42, 0.74]]) ridges.push(...platesAlong([sign * x, y0, 0.22], [sign * x * 0.7, y0 - 0.14, -0.62], 6, { radius: 0.02, around: [0], size: [0.025, 0.02, 0.08], seedBase: 400 + Math.round(x * 100) + sign }));
  }
  ridges.push(...platesAlong([-0.4, 0.7, 0.62], [0.4, 0.7, 0.62], 7, { radius: 0.02, around: [0], size: [0.06, 0.025, 0.05], seedBase: 450, outward: [0, 0.6, 1] }));
  put(body, ridges, m.shellDark);
  // 甲殻に散らばる結晶の突起（大きい塊と、小さな粒）
  const studs = [];
  for (let i = 0; i < 14; i++) {
    const sx = i % 2 ? 1 : -1;
    const z = 0.15 - (i >> 1) * 0.12;
    const x = sx * (0.22 + random() * 0.22);
    const top = 0.66 + 0.12 * Math.sqrt(Math.max(0, 1 - ((Math.abs(x) - 0.33) / 0.36) ** 2)) - Math.max(0, -z - 0.3) * 0.15;
    studs.push(shard([x, top, z], [sx * 0.4, 1, -0.2], 0.08 + random() * 0.07, 0.025, 1));
  }
  put(body, studs, m.crystal);
  put(body, crystalCluster([0.25, 0.8, -0.1], [0.4, 1, 0], { count: 3, big: 0.3, random, spread: 0.1 }).concat(
    crystalCluster([-0.25, 0.8, -0.2], [-0.4, 1, 0], { count: 3, big: 0.28, random, spread: 0.1 }),
    crystalCluster([0, 0.7, 0.62], [0, 0.6, 1], { count: 2, big: 0.22, random, spread: 0.05 }),
  ), m.crystal);
  // 背中の継ぎ目（弱点。光り方は foeViews が変える）
  const seam = joint('seam', body, [0, 0.74, -0.25]);
  put(seam, [bodyLoft([{ p: [0, 0.67, 0.22], rx: 0.03, ry: 0.025 }, { p: [0, 0.76, -0.15], rx: 0.035, ry: 0.03 }, { p: [0, 0.62, -0.65], rx: 0.02, ry: 0.02 }], { segments: 6, steps: 4, rough: 0.02, seed: 8 })], new THREE.MeshStandardMaterial({ name: 'creature_seam', color: '#ffb37a', emissive: '#ff8a3b', emissiveIntensity: 1.2 }));
  // 頭と大顎
  const head = joint('head', body, [0, 0.42, 0.75]);
  put(head, [bodyLoft([{ p: [0, 0.42, 0.72], rx: 0.26, ry: 0.15 }, { p: [0, 0.4, 0.95], rx: 0.2, ry: 0.12 }], { segments: 10, steps: 2, rough: 0.04, seed: 7 }), cone(0.06, 0.4, [0, 0.62, 0.95], 1.1)], m.shell);
  put(head, [new THREE.SphereGeometry(0.03, 6, 4).translate(0.16, 0.48, 0.95), new THREE.SphereGeometry(0.03, 6, 4).translate(-0.16, 0.48, 0.95)], m.eye);
  const mandibles = [];
  for (const sign of [-1, 1]) {
    const node = joint(`mandible_${sign > 0 ? 'l' : 'r'}`, head, [sign * 0.12, 0.38, 1.0]);
    put(node, [bodyLoft([{ p: [sign * 0.12, 0.38, 1.0], rx: 0.04, ry: 0.035 }, { p: [sign * 0.16, 0.37, 1.18], rx: 0.03, ry: 0.025 }, { p: [sign * 0.05, 0.36, 1.32], rx: 0.012, ry: 0.012 }], { segments: 6, steps: 3, rough: 0.02, seed: 9 })], m.claw);
    mandibles.push({ node, sign });
  }
  // 6本の脚：付け根（胸の脇）→ 腿（上へ）→ すね（下へ）→ 足先
  const legs = [];
  [0.45, 0.05, -0.38].forEach((z, k) => {
    for (const [s, sign] of [['l', 1], ['r', -1]]) {
      legs.push({ ...leg(body, `leg${k}_${s}`, [[sign * 0.45, 0.38, z], [sign * 0.78, 0.55, z + 0.08 - k * 0.04], [sign * 1.0, 0.2, z + 0.15 - k * 0.12], [sign * 1.05, 0.0, z + 0.18 - k * 0.16]], [0.06, 0.045, 0.03, 0.015], m.shellDark, 100 + k * 3 + sign, m.claw), group: (k + (sign > 0 ? 0 : 1)) % 2, sign });
    }
  });
  return { root, joints: { body, head, mandibles, legs }, parts: [seam] };
}

function animateBeetle(rig, frame, dt, time, speed) {
  const { legs, mandibles, body } = rig.joints;
  rig.gait = (rig.gait ?? 0) + dt * (7 + speed * 2);
  rig.amp = ease(rig.amp, speed > 0.2 ? 1 : 0, dt * 6);
  const amp = rig.amp;
  // 三脚歩行：前と後ろの片側＋反対の中、の3本ずつが交互に
  legs.forEach((l) => {
    const phase = rig.gait + (l.group ? Math.PI : 0);
    l.upper.rotation.y = Math.sin(phase) * 0.35 * amp * l.sign;
    l.upper.rotation.z = l.sign * Math.max(0, -Math.cos(phase)) * 0.25 * amp; // 前へ振る間だけ持ち上げる
  });
  const open = frame.phase === 'windup' ? 0.5 : frame.phase === 'strike' ? -0.15 : 0.08 + Math.sin(time * 2) * 0.05;
  mandibles.forEach(({ node, sign }) => { node.rotation.y = sign * open; });
  body.position.y = 0.42 + (amp ? Math.sin(rig.gait * 2) * 0.01 : 0);
}

// ── 晶糸の蜘蛛：8本の脚を胴の脇から。膝を高く上げて下ろす。脚が交差しないよう、振りは小さく ──
function buildSpider() {
  const m = getMaterials();
  const random = seeded(631);
  const root = new THREE.Group();
  const body = joint('body', root, [0, 0.55, 0]);
  // 頭胸部（前）と、大きな腹部（後ろ）。腹部の背に結晶
  put(body, [bodyLoft([{ p: [0, 0.55, 0.05], rx: 0.24, ry: 0.15 }, { p: [0, 0.6, 0.3], rx: 0.28, ry: 0.18 }, { p: [0, 0.58, 0.52], rx: 0.18, ry: 0.13 }], { segments: 12, steps: 3, rough: 0.05, seed: 1 })], m.shell);
  // 頭胸部の背の甲板（中央の筋と左右の板）
  put(body, platesAlong([0, 0.72, 0.5], [0, 0.7, 0.08], 4, { radius: 0.02, around: [0, -0.9, 0.9], size: [0.09, 0.025, 0.09], seedBase: 500 }), m.shellDark);
  const abdomen = joint('abdomen', body, [0, 0.62, -0.05]);
  put(abdomen, [
    bodyLoft([{ p: [0, 0.62, -0.08], rx: 0.2, ry: 0.18 }, { p: [0, 0.72, -0.38], rx: 0.46, ry: 0.4 }, { p: [0, 0.7, -0.75], rx: 0.42, ry: 0.36 }, { p: [0, 0.62, -1.0], rx: 0.15, ry: 0.13 }], { segments: 14, steps: 4, rough: 0.07, seed: 3 }),
    ...Array.from({ length: 5 }, (_, i) => plate([0, 1.08 - Math.abs(i - 2) * 0.04, -0.3 - i * 0.12], [0, 1, -0.2 + i * 0.12], [0, 0, -1], [0.25, 0.04, 0.12], 70 + i)),
  ], m.shellDark);
  // 腹の節：外骨格の帯（横の輪）を前から後ろへ
  const bands = [];
  for (const [z, r, h] of [[-0.22, 0.36, 0.32], [-0.42, 0.45, 0.39], [-0.62, 0.45, 0.39], [-0.82, 0.36, 0.3]]) {
    bands.push(new THREE.TorusGeometry(1, 0.035, 4, 18, Math.PI * 1.15).rotateZ(-Math.PI * 0.075).scale(r, h, 1).translate(0, 0.72 - (z < -0.7 ? 0.04 : 0), z));
  }
  put(abdomen, bands, m.shell);
  put(abdomen, crystalCluster([0, 1.06, -0.5], [0, 1, -0.2], { count: 8, big: 0.42, random, spread: 0.25 }).concat(crystalCluster([0, 0.78, -1.02], [0, 0.2, -1], { count: 3, big: 0.18, random, spread: 0.05 })), m.crystal);
  // 目（前に並ぶ6つ）と、牙
  const eyes = [];
  for (const [x, y] of [[0.05, 0.7], [-0.05, 0.7], [0.11, 0.67], [-0.11, 0.67], [0.08, 0.63], [-0.08, 0.63]]) eyes.push(new THREE.SphereGeometry(0.02, 6, 4).translate(x, y, 0.58));
  put(body, eyes, m.eye);
  const fangs = joint('fangs', body, [0, 0.5, 0.58]);
  put(fangs, [cone(0.03, 0.18, [0.06, 0.42, 0.66], Math.PI - 0.4), cone(0.03, 0.18, [-0.06, 0.42, 0.66], Math.PI - 0.4)], m.crystal);
  // 脚：付け根は頭胸部の脇（前から後ろへ4対）。腿は上へ、すねは下へ、先は地面へ
  const legs = [];
  [0.42, 0.28, 0.14, 0.0].forEach((z, k) => {
    const spread = [0.75, 0.25, -0.25, -0.75][k]; // 前の脚は前へ、後ろの脚は後ろへ向く
    for (const [s, sign] of [['l', 1], ['r', -1]]) {
      const dir = [sign * Math.cos(spread * 0.9), Math.sin(spread * 0.9)];
      const at = (r, y) => [sign * 0.18 + dir[0] * r, y, z + dir[1] * r];
      legs.push({ ...leg(body, `leg${k}_${s}`, [at(0, 0.55), at(0.45, 0.95), at(0.95, 0.35), at(1.1, 0.0)], [0.045, 0.035, 0.022, 0.01], m.shellDark, 200 + k * 3 + sign, m.claw), group: (k + (sign > 0 ? 0 : 1)) % 2, sign, spread });
    }
  });
  return { root, joints: { body, abdomen, fangs, legs } };
}

function animateSpider(rig, frame, dt, time, speed) {
  const { legs, abdomen, fangs, body } = rig.joints;
  rig.gait = (rig.gait ?? 0) + dt * (8 + speed * 2);
  rig.amp = ease(rig.amp, speed > 0.2 ? 1 : 0, dt * 6);
  const amp = rig.amp;
  legs.forEach((l) => {
    const phase = rig.gait + (l.group ? Math.PI : 0);
    // 前後の振りは小さく（隣の脚と交差しない）、上げる時は膝ごと持ち上げる
    l.upper.rotation.y = Math.sin(phase) * 0.18 * amp * l.sign;
    l.upper.rotation.z = l.sign * Math.max(0, -Math.cos(phase)) * 0.3 * amp;
  });
  abdomen.rotation.x = Math.sin(time * 1.6) * 0.04 + (frame.phase === 'windup' ? -0.25 : 0);
  fangs.rotation.x = frame.phase === 'windup' || frame.phase === 'strike' ? -0.4 : 0;
  body.position.y = 0.55 + (amp ? Math.sin(rig.gait * 2) * 0.012 : 0) - (frame.phase === 'windup' ? 0.08 : 0);
}

const BUILDERS = { hound: [buildHound, animateHound], bat: [buildBat, animateBat], beetle: [buildBeetle, animateBeetle], spider: [buildSpider, animateSpider] };
const templates = new Map();

// 種類ごとのひな形を一度だけ作り、複製して返す（形と材質は共有。関節は名前で探し直す）
export function createCreature(look) {
  const entry = BUILDERS[look];
  if (!entry) return null;
  if (!templates.has(look)) templates.set(look, entry[0]());
  const template = templates.get(look);
  const root = template.root.clone(true);
  const find = (node) => root.getObjectByName(node.name);
  const remap = (value) => {
    if (value?.isObject3D) return find(value);
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === 'number' ? v : remap(v)]));
    return value;
  };
  const joints = remap(template.joints);
  // 翼膜：敵ごとに形を持ち、骨に留めた点へ毎回張り直す
  const membranes = (template.membranes ?? []).map(({ pins, tris, material }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pins.length * 3), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pins.flatMap((p) => [p.at[0] * 0.8, p.at[1] * 0.8])), 2));
    geometry.setIndex(tris.flat());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'membrane';
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    root.add(mesh);
    return { mesh, pins: pins.map((p) => ({ node: root.getObjectByName(p.node), local: new THREE.Vector3(...p.local) })) };
  });
  const inverse = new THREE.Matrix4();
  const point = new THREE.Vector3();
  function stretch() {
    if (!membranes.length) return;
    root.updateMatrixWorld(true);
    inverse.copy(root.matrixWorld).invert();
    for (const { mesh, pins } of membranes) {
      const position = mesh.geometry.getAttribute('position');
      pins.forEach((p, i) => {
        point.copy(p.local).applyMatrix4(p.node.matrixWorld).applyMatrix4(inverse);
        position.setXYZ(i, point.x, point.y, point.z);
      });
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  }
  stretch();
  // 歩きの周期などの、敵ごとの状態（ひな形とは別）
  const state = { joints, speed: 0 };
  return {
    body: root,
    joints,
    parts: (template.parts ?? []).map(find),
    membranes: membranes.map((m) => m.mesh),
    animate(frame, dt, time, speed) {
      state.speed = speed;
      entry[1](state, frame, dt, time, speed);
      stretch();
    },
  };
}

export const CREATURE_LOOKS = Object.keys(BUILDERS);
