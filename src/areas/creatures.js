// 獣・虫・蝙蝠・蜘蛛の見た目（コードで形を作る）：関節ごとに分かれた部品と、その動き。
// 形は種類ごとに一度だけ作り（ひな形）、敵ごとには複製する（形の情報は共有）。動きは animate で関節を回す。
// 単位はメートル。前は +z。当たり判定と攻撃の届く範囲は、今までの数値（src/areas/*/foes.js）のまま。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded, bodyLoft, plate, crystalCluster } from './creatureKit.js';

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
        ctx.fillStyle = `rgb(${150 + random() * 50},${150 + random() * 50},${158 + random() * 50})`;
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

// 細い手足の一節（a → b、太さ ra → rb）
const segment = (a, b, ra, rb, seed, rough = 0.05) => bodyLoft([{ p: a, rx: ra, ry: ra }, { p: lerp(a, b, 0.5), rx: (ra + rb) / 2 * 1.08, ry: (ra + rb) / 2 * 1.08 }, { p: b, rx: rb, ry: rb }], { segments: 8, steps: 2, rough, seed });

// 3節の脚：付け根 → 曲がり目 → 足首 → 足先。joints を返す
function leg(parent, name, points, radii, material, seed, tipMaterial = null) {
  const [a, b, c, d] = points;
  const upper = joint(`${name}_upper`, parent, a);
  put(upper, [segment(a, b, radii[0], radii[1], seed)], material);
  const lower = joint(`${name}_lower`, upper, b);
  put(lower, [segment(b, c, radii[1], radii[2], seed + 1)], material);
  const foot = joint(`${name}_foot`, lower, c);
  put(foot, [segment(c, d, radii[2], radii[3], seed + 2)], tipMaterial ?? material);
  return { upper, lower, foot };
}

// ── 晶牙ハウンド：細身の四足。胸郭・腰・首・あご・足先を分け、背骨と尾に結晶 ──
function buildHound() {
  const m = getMaterials();
  const random = seeded(301);
  const root = new THREE.Group();
  const body = joint('body', root, [0, 0.85, 0]);
  put(body, [
    bodyLoft([
      { p: [0, 0.82, -0.75], rx: 0.17, ry: 0.19 }, { p: [0, 0.86, -0.35], rx: 0.2, ry: 0.22 }, // 腰
      { p: [0, 0.84, 0.05], rx: 0.16, ry: 0.2 }, // 細い胴
      { p: [0, 0.86, 0.45], rx: 0.22, ry: 0.3 }, { p: [0, 0.92, 0.75], rx: 0.2, ry: 0.27 }, // 深い胸郭
    ], { segments: 12, steps: 4, rough: 0.05, seed: 1 }),
    // 背中の鱗の板
    ...Array.from({ length: 7 }, (_, i) => plate([0, 1.05 - Math.abs(i - 4) * 0.015, 0.7 - i * 0.22], [0, 1, 0], [0, 0, -1], [0.14, 0.04, 0.16], 10 + i)),
  ], m.hide);
  put(body, crystalCluster([0, 1.12, 0.55], [0, 1, -0.3], { count: 4, big: 0.42, random, spread: 0.1 }).concat(
    crystalCluster([0, 1.08, 0.2], [0, 1, -0.4], { count: 4, big: 0.36, random, spread: 0.08 }),
    crystalCluster([0, 1.04, -0.2], [0, 1, -0.5], { count: 3, big: 0.28, random, spread: 0.06 }),
  ), m.crystal);
  // 首と頭：長い鼻先、あご、尖った耳、光る目
  const neck = joint('neck', body, [0, 1.0, 0.8]);
  put(neck, [bodyLoft([{ p: [0, 0.98, 0.72], rx: 0.15, ry: 0.17 }, { p: [0, 1.12, 0.95], rx: 0.11, ry: 0.13 }], { segments: 10, steps: 2, rough: 0.05, seed: 3 })], m.hide);
  put(neck, crystalCluster([0, 1.2, 0.85], [0, 1, -0.6], { count: 2, big: 0.22, random, spread: 0.05 }), m.crystal);
  const head = joint('head', neck, [0, 1.15, 1.0]);
  put(head, [
    bodyLoft([{ p: [0, 1.17, 0.98], rx: 0.11, ry: 0.11 }, { p: [0, 1.14, 1.22], rx: 0.085, ry: 0.08 }, { p: [0, 1.08, 1.42], rx: 0.045, ry: 0.045 }], { segments: 10, steps: 3, rough: 0.04, seed: 5 }),
    cone(0.05, 0.16, [0.06, 1.3, 1.02], 0, 0, -0.25), cone(0.05, 0.16, [-0.06, 1.3, 1.02], 0, 0, 0.25),
  ], m.hideDark);
  put(head, [new THREE.SphereGeometry(0.018, 6, 4).translate(0.06, 1.2, 1.17), new THREE.SphereGeometry(0.018, 6, 4).translate(-0.06, 1.2, 1.17)], m.eye);
  const jaw = joint('jaw', head, [0, 1.09, 1.08]);
  put(jaw, [
    bodyLoft([{ p: [0, 1.07, 1.08], rx: 0.07, ry: 0.035 }, { p: [0, 1.04, 1.36], rx: 0.04, ry: 0.025 }], { segments: 8, steps: 2, rough: 0.04, seed: 6 }),
    ...[-0.03, 0.03].map((x) => cone(0.012, 0.06, [x, 1.09, 1.33], 0)),
  ], m.claw);
  // 脚：前は肩 → 肘 → 手首 → 足先、後ろは股 → 膝 → かかと（後ろへ曲がる）→ 足先
  const legs = [];
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    legs.push({ ...leg(body, `fore_${s}`, [[sign * 0.13, 0.85, 0.62], [sign * 0.15, 0.5, 0.56], [sign * 0.14, 0.16, 0.62], [sign * 0.14, 0.03, 0.72]], [0.095, 0.065, 0.045, 0.035], m.hide, 20 + sign), hind: 0, sign });
    legs.push({ ...leg(body, `hind_${s}`, [[sign * 0.13, 0.86, -0.6], [sign * 0.15, 0.55, -0.42], [sign * 0.14, 0.22, -0.68], [sign * 0.14, 0.03, -0.6]], [0.11, 0.07, 0.045, 0.035], m.hide, 30 + sign), hind: 1, sign });
  }
  // 尾：3節、結晶の棘
  let parent = body;
  let a = [0, 0.86, -0.78];
  const tail = [];
  for (let i = 0; i < 3; i++) {
    const b = [0, 0.86 - (i + 1) * 0.12, -0.78 - (i + 1) * 0.26];
    const node = joint(`tail${i}`, parent, a);
    put(node, [segment(a, b, 0.07 - i * 0.018, 0.05 - i * 0.015, 40 + i)], m.hide);
    put(node, crystalCluster(lerp(a, b, 0.5).map((v, k) => v + [0, 0.05, 0][k]), [0, 1, -0.5], { count: 2, big: 0.16 - i * 0.03, random, spread: 0.03 }), m.crystal);
    tail.push(node);
    parent = node;
    a = b;
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
  body.position.y = 0.85 - rig.crouch * 0.18 + (running ? Math.abs(Math.sin(rig.gait)) * 0.04 : 0);
  body.rotation.x = rig.crouch * 0.12 - (frame.phase === 'strike' ? 0.1 : 0);
  head.rotation.x = rig.crouch * 0.25 + Math.sin(time * 1.3) * 0.03;
  jaw.rotation.x = frame.phase === 'windup' || frame.phase === 'strike' ? 0.45 : 0.05 + Math.sin(time * 2) * 0.03;
  tail.forEach((t, i) => { t.rotation.y = Math.sin(time * 3 + i * 0.7) * 0.25; t.rotation.x = 0.1 * i; });
}

// ── 硝子羽の蝙蝠：腕と指の骨に沿って張った翼膜。付け根 → 肘 → 手首の順に動く ──
function buildBat() {
  const m = getMaterials();
  const random = seeded(411);
  const root = new THREE.Group();
  const body = joint('body', root, [0, 0.55, 0]);
  put(body, [
    bodyLoft([{ p: [0, 0.2, -0.02], rx: 0.13, ry: 0.12 }, { p: [0, 0.42, 0], rx: 0.2, ry: 0.18 }, { p: [0, 0.62, 0.02], rx: 0.23, ry: 0.19 }, { p: [0, 0.78, 0.03], rx: 0.15, ry: 0.13 }], { segments: 10, steps: 3, rough: 0.06, seed: 1 }),
    ...Array.from({ length: 4 }, (_, i) => plate([0, 0.72 - i * 0.12, 0.18], [0, 0, 1], [0, -1, 0], [0.12, 0.03, 0.08], 50 + i)),
  ], m.hideDark);
  put(body, crystalCluster([0, 0.72, -0.1], [0, 0.6, -1], { count: 4, big: 0.18, random, spread: 0.08 }).concat(crystalCluster([0.12, 0.68, 0.05], [1, 0.5, 0], { count: 2, big: 0.12, random, spread: 0.04 }), crystalCluster([-0.12, 0.68, 0.05], [-1, 0.5, 0], { count: 2, big: 0.12, random, spread: 0.04 })), m.crystal);
  const head = joint('head', body, [0, 0.82, 0.04]);
  put(head, [
    bodyLoft([{ p: [0, 0.83, 0.0], rx: 0.115, ry: 0.11 }, { p: [0, 0.86, 0.12], rx: 0.085, ry: 0.075 }, { p: [0, 0.84, 0.18], rx: 0.03, ry: 0.03 }], { segments: 8, steps: 2, rough: 0.05, seed: 2 }),
    // 大きな耳
    cone(0.06, 0.24, [0.07, 1.0, 0.0], 0, 0, -0.3), cone(0.06, 0.24, [-0.07, 1.0, 0.0], 0, 0, 0.3),
  ], m.hideDark);
  put(head, [new THREE.SphereGeometry(0.014, 6, 4).translate(0.04, 0.88, 0.12), new THREE.SphereGeometry(0.014, 6, 4).translate(-0.04, 0.88, 0.12)], m.eye);
  put(head, [cone(0.008, 0.05, [0.02, 0.8, 0.17], Math.PI), cone(0.008, 0.05, [-0.02, 0.8, 0.17], Math.PI)], m.claw);
  // 翼：上腕 → 前腕 → 指4本（長い骨）。膜は、指の骨の先と脇腹を結ぶ面
  const wings = [];
  const membranes = [];
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    const shoulder = [sign * 0.18, 0.72, 0];
    const elbow = [sign * 0.45, 0.82, -0.04];
    const wrist = [sign * 0.82, 0.75, -0.02];
    const upper = joint(`wing_${s}_upper`, body, shoulder);
    put(upper, [segment(shoulder, elbow, 0.03, 0.022, 60 + sign)], m.bone);
    const lower = joint(`wing_${s}_lower`, upper, elbow);
    put(lower, [segment(elbow, wrist, 0.022, 0.016, 62 + sign)], m.bone);
    const hand = joint(`wing_${s}_hand`, lower, wrist);
    const fingers = [[sign * 1.25, 0.95, -0.05], [sign * 1.3, 0.55, -0.06], [sign * 1.1, 0.2, -0.05], [sign * 0.75, 0.05, -0.03]];
    put(hand, fingers.map((tip, k) => segment(wrist, tip, 0.012, 0.006, 70 + k + sign)), m.bone);
    // 手首の上の爪
    put(hand, [cone(0.02, 0.12, [wrist[0] + sign * 0.02, wrist[1] + 0.1, wrist[2]], 0, 0, -sign * 0.3)], m.claw);
    // 膜：手首から指先、指先どうし、最後の指先から肘・脇腹へ。縁は少し内側へたわむ。
    // 膜の点は骨（手・肘・胴）に留め、動くたびに張り直す（createCreature の stretch）
    const pin = (node, at) => ({ node: node.name, at, local: at.map((v, i) => v - centers.get(node)[i]) });
    const sag = (a, b, toward, k) => lerp(lerp(a, b, 0.5), toward, k);
    const hip = [sign * 0.12, 0.24, -0.02];
    const side = [sign * 0.19, 0.68, -0.02];
    membranes.push({
      material: m.membrane,
      pins: [
        pin(hand, wrist), ...fingers.map((f) => pin(hand, f)), // 0 手首、1〜4 指先
        pin(hand, sag(fingers[0], fingers[1], wrist, 0.18)), pin(hand, sag(fingers[1], fingers[2], wrist, 0.18)), pin(hand, sag(fingers[2], fingers[3], wrist, 0.18)), // 5〜7 縁
        pin(lower, elbow), pin(body, side), pin(body, hip), pin(lower, sag(fingers[3], hip, elbow, 0.12)), // 8 肘、9 脇、10 腰、11 後ろの縁
      ],
      tris: [[0, 1, 5], [0, 5, 2], [0, 2, 6], [0, 6, 3], [0, 3, 7], [0, 7, 4], [8, 0, 4], [8, 4, 11], [8, 11, 10], [8, 10, 9]],
    });
    wings.push({ upper, lower, hand, sign });
  }
  // 脚：細く長い、後ろへ曲がる脚と鉤爪
  const legs = [];
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    legs.push(leg(body, `leg_${s}`, [[sign * 0.08, 0.24, 0], [sign * 0.1, 0.12, 0.1], [sign * 0.1, 0.02, -0.04], [sign * 0.1, 0.0, 0.06]], [0.03, 0.022, 0.016, 0.012], m.hideDark, 80 + sign, m.claw));
  }
  return { root, joints: { body, head, wings, legs }, membranes };
}

function animateBat(rig, frame, dt, time) {
  const { wings, head, legs, body } = rig.joints;
  const flying = frame.height > 0.4;
  rig.flap = (rig.flap ?? 0) + dt * (flying ? 9 : 0);
  wings.forEach(({ upper, lower, hand, sign }) => {
    if (flying) {
      // 羽ばたき：付け根が先に動き、肘・手首が少し遅れてついてくる
      upper.rotation.z = sign * Math.sin(rig.flap) * 0.65;
      lower.rotation.z = sign * Math.sin(rig.flap - 0.5) * 0.35;
      hand.rotation.z = sign * Math.sin(rig.flap - 1.0) * 0.25;
      upper.rotation.x = 0; lower.rotation.y = 0;
    } else {
      // 地上：翼をたたみ、肘を後ろへ、手首を下へ
      upper.rotation.z = sign * 0.9; lower.rotation.z = -sign * 1.6; hand.rotation.z = -sign * 0.9;
      upper.rotation.x = -0.3;
    }
  });
  body.rotation.x = flying ? 0.5 : 0.1; // 飛ぶときは体を前へ倒す
  head.rotation.x = flying ? -0.4 : 0;
  legs.forEach((l, i) => {
    l.upper.rotation.x = flying ? 0.6 : Math.sin(time * 6 + i * Math.PI) * 0.2 * Math.min(1, rig.speed ?? 0);
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
  const abdomen = joint('abdomen', body, [0, 0.62, -0.05]);
  put(abdomen, [
    bodyLoft([{ p: [0, 0.62, -0.08], rx: 0.2, ry: 0.18 }, { p: [0, 0.72, -0.38], rx: 0.46, ry: 0.4 }, { p: [0, 0.7, -0.75], rx: 0.42, ry: 0.36 }, { p: [0, 0.62, -1.0], rx: 0.15, ry: 0.13 }], { segments: 14, steps: 4, rough: 0.07, seed: 3 }),
    ...Array.from({ length: 5 }, (_, i) => plate([0, 1.08 - Math.abs(i - 2) * 0.04, -0.3 - i * 0.12], [0, 1, -0.2 + i * 0.12], [0, 0, -1], [0.25, 0.04, 0.12], 70 + i)),
  ], m.shellDark);
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
