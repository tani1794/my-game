// 石造りの建築の部品：笠石つきの壁と胸壁、控え壁、尖頭アーチの窓と門（奥行きのある枠と暗い奥）、
// 円塔・角塔・尖塔、石のアーチ橋（橋桁・アーチ・橋脚・広い基礎・欄干）、崩れた橋脚、瓦礫。
// 部品はまず「石の束」に集め、最後に材質ごとに1つの形へまとめて描く（描く回数を減らす）。
// 石の模様は、どの建物でも同じ大きさ（1枚 2m）になるよう、置いた後の位置から uv を作る。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from '../../chapter/materials.js';

const STONE_TILE = 2;

// 部品を集めて、材質ごとにまとめる
export function createBatch() {
  const parts = new Map(); // material → geometries（置いた後の形）
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();

  function add(geometry, material, [x, y, z], [rx, ry, rz] = [0, 0, 0], order = 'XYZ') {
    euler.set(rx, ry, rz, order);
    quaternion.setFromEuler(euler);
    position.set(x, y, z);
    matrix.compose(position, quaternion, scale);
    const placed = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
    placed.deleteAttribute('uv');
    if (!parts.has(material)) parts.set(material, []);
    parts.get(material).push(placed);
    geometry.dispose();
  }

  const box = (material, w, h, d, at, rotation) => add(new THREE.BoxGeometry(w, h, d), material, at, rotation);

  // 材質ごとに1つの形にまとめて、root に足す
  function build(root, { shadows = true } = {}) {
    const meshes = [];
    for (const [material, list] of parts) {
      for (const g of list) { if (!g.getAttribute('normal')) g.computeVertexNormals(); }
      const merged = mergeGeometries(list.map((g) => {
        const keep = new THREE.BufferGeometry();
        keep.setAttribute('position', g.getAttribute('position'));
        keep.setAttribute('normal', g.getAttribute('normal'));
        return keep;
      }), false);
      for (const g of list) g.dispose();
      worldUV(merged, STONE_TILE);
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      root.add(mesh);
      meshes.push(mesh);
    }
    parts.clear();
    return meshes;
  }

  return { add, box, build };
}

// 尖頭アーチ（ゴシック）の輪郭（点の列）：幅 w、高さ h。肩から上は2つの円弧が頂点で交わる
export function pointedArchPoints(w, h, steps = 10) {
  const half = w / 2;
  const radius = w * 0.85;
  const shoulder = Math.max(0, h - Math.sqrt(radius * radius - (radius - half) ** 2));
  const points = [[-half, 0], [-half, shoulder]];
  // 左の弧：中心は (radius - half, shoulder)。肩（角度 π）から頂点（x=0）まで
  const cx = radius - half;
  const top = Math.acos(cx / radius);
  for (let i = 1; i <= steps; i++) {
    const angle = Math.PI - top * (i / steps);
    points.push([cx + Math.cos(angle) * radius, shoulder + Math.sin(angle) * radius]);
  }
  for (let i = steps - 1; i >= 1; i--) points.push([-points[i + 1][0], points[i + 1][1]]);
  points.push([half, shoulder], [half, 0]);
  return points;
}

function shapeFrom(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  return shape;
}

// 尖頭アーチの開口（窓・門）：壁の面に、厚みのある枠と、奥へ引っ込んだ暗い面
// at：開口の下端の中央、facing：壁の外向き（y 回転）
export function archOpening(batch, frameMaterial, darkMaterial, { w, h, depth = 0.6, frame = 0.22 }, at, facing) {
  const outer = shapeFrom(pointedArchPoints(w + frame * 2, h + frame));
  const inner = new THREE.Path();
  const innerPoints = pointedArchPoints(w, h);
  inner.moveTo(innerPoints[0][0], innerPoints[0][1]);
  for (const [x, y] of innerPoints.slice(1)) inner.lineTo(x, y);
  outer.holes.push(inner);
  const frameGeometry = new THREE.ExtrudeGeometry(outer, { depth: 0.25, bevelEnabled: false });
  frameGeometry.translate(0, 0, -0.05);
  const [x, y, z] = at;
  const sin = Math.sin(facing);
  const cos = Math.cos(facing);
  batch.add(frameGeometry, frameMaterial, [x, y, z], [0, facing, 0]);
  // 奥の暗い面（窓の奥行き）
  const back = new THREE.ShapeGeometry(shapeFrom(innerPoints));
  batch.add(back, darkMaterial, [x - sin * depth, y, z - cos * depth], [0, facing, 0]);
  // 開口の側面（壁の厚み）
  const side = (sx) => {
    const g = new THREE.BoxGeometry(0.08, h * 0.75, depth);
    batch.add(g, frameMaterial, [x + cos * sx - sin * depth / 2, y + h * 0.375, z - sin * sx - cos * depth / 2], [0, facing, 0]);
  };
  side(-w / 2);
  side(w / 2);
}

// 壁：from → to、高さ・厚み。上端に笠石、望めば胸壁（凹凸）と控え壁
export function wall(batch, material, from, to, { base = 0, height, thickness = 1.2, crenels = false, coping = true, buttress = 0 }) {
  const [ax, az] = from;
  const [bx, bz] = to;
  const length = Math.hypot(bx - ax, bz - az);
  const angle = Math.atan2(bz - az, bx - ax);
  const ry = -angle;
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  batch.box(material, length, height, thickness, [cx, base + height / 2, cz], [0, ry, 0]);
  if (coping) batch.box(material, length + 0.2, 0.22, thickness + 0.3, [cx, base + height + 0.11, cz], [0, ry, 0]);
  const dirX = Math.cos(angle);
  const dirZ = Math.sin(angle);
  if (crenels) {
    const merlon = 0.8;
    const gap = 0.7;
    const count = Math.floor((length - 0.4) / (merlon + gap));
    const start = -((count - 1) * (merlon + gap)) / 2;
    for (let i = 0; i < count; i++) {
      const s = start + i * (merlon + gap);
      batch.box(material, merlon, 1.0, thickness * 0.9, [cx + dirX * s, base + height + 0.22 + 0.5, cz + dirZ * s], [0, ry, 0]);
    }
  }
  if (buttress > 0) {
    // 控え壁：外側（左手）へ張り出し、下ほど厚い
    const nx = -dirZ;
    const nz = dirX;
    for (let s = -length / 2 + buttress / 2; s < length / 2 - 0.5; s += buttress) {
      const px = cx + dirX * s;
      const pz = cz + dirZ * s;
      batch.box(material, 1.0, height * 0.75, 1.2, [px + nx * (thickness / 2 + 0.6), base + height * 0.375, pz + nz * (thickness / 2 + 0.6)], [0, ry, 0]);
      batch.box(material, 1.0, height * 0.3, 1.0, [px + nx * (thickness / 2 + 0.4), base + height * 0.75 + height * 0.1, pz + nz * (thickness / 2 + 0.4)], [0.25, ry, 0], 'YXZ');
    }
  }
  return { length, angle };
}

// 円塔：胴・上の帯・胸壁・円錐の屋根
export function roundTower(batch, material, roofMaterial, { x, z, base = 0, radius, height, roof = true, broken = false }) {
  batch.add(new THREE.CylinderGeometry(radius, radius * 1.08, height, 18, 1), material, [x, base + height / 2, z]);
  batch.add(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.6, 18), material, [x, base + height + 0.3, z]);
  if (broken) {
    // 崩れた塔：上の縁が欠け、いくつかの石だけが残る
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      if (i % 3 === 0) continue;
      batch.box(material, 1.2, 1 + (i % 2) * 1.4, 1.0, [x + Math.sin(a) * radius * 0.95, base + height + 0.6 + (i % 2) * 0.7, z + Math.cos(a) * radius * 0.95], [0, a, 0]);
    }
    return;
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    batch.box(material, 0.8, 1, 0.6, [x + Math.sin(a) * radius, base + height + 1.1, z + Math.cos(a) * radius], [0, a, 0]);
  }
  if (roof) batch.add(new THREE.ConeGeometry(radius * 1.15, radius * 2.6, 18), roofMaterial, [x, base + height + 0.6 + radius * 1.3, z]);
}

// 角塔：胴・角の控え・胸壁・四角錐の屋根または尖塔
export function squareTower(batch, material, roofMaterial, { x, z, base = 0, width, height, ry = 0, roof = 'pyramid' }) {
  batch.box(material, width, height, width, [x, base + height / 2, z], [0, ry, 0]);
  batch.box(material, width + 0.5, 0.5, width + 0.5, [x, base + height + 0.25, z], [0, ry, 0]);
  const half = width / 2;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const local = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
  // 角の控え
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const [px, pz] = local(sx * (half + 0.3), sz * (half + 0.3));
    batch.box(material, 1.0, height * 0.7, 1.0, [px, base + height * 0.35, pz], [0, ry, 0]);
  }
  // 胸壁
  const count = Math.max(2, Math.floor(width / 1.5));
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const s = -half + (i + 0.5) * (width / count);
      const [ax, az] = local(s, side * half);
      batch.box(material, 0.7, 1, 0.5, [ax, base + height + 1, az], [0, ry, 0]);
      const [bx, bz] = local(side * half, s);
      batch.box(material, 0.5, 1, 0.7, [bx, base + height + 1, bz], [0, ry, 0]);
    }
  }
  if (roof === 'pyramid') batch.add(new THREE.ConeGeometry(width * 0.75, width * 1.1, 4), roofMaterial, [x, base + height + 0.5 + width * 0.55, z], [0, ry + Math.PI / 4, 0]);
  if (roof === 'spire') batch.add(new THREE.ConeGeometry(width * 0.45, width * 2.4, 8), roofMaterial, [x, base + height + 0.5 + width * 1.2, z]);
}

// 瓦礫：崩れた石が足もとに積もる（地面の高さ groundAt に合わせる）
export function rubble(batch, material, { x, z, radius, count, groundAt, random }) {
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2;
    const r = radius * Math.sqrt(random());
    const px = x + Math.sin(a) * r;
    const pz = z + Math.cos(a) * r;
    const s = 0.4 + random() * 0.9;
    batch.box(material, s * 1.4, s * 0.7, s, [px, groundAt(px, pz) + s * 0.25, pz], [random() * 0.6, random() * 3, random() * 0.6]);
  }
}

// 石のアーチ橋（向きは from → to）。piers：橋脚の位置（from からの距離）。
// 橋面の上端 y、幅 width。橋脚は groundAt で地面（谷底・岩棚）まで下ろし、下に広い基礎を置く。
// parapet：欄干（低い壁と笠石）を両側に。broken：この距離から先は崩れて無い
export function archBridge(batch, material, { from, to, y, width, piers, groundAt, parapet = true, deck = 1.2, rise = 0.8, brokenAt = null, random = Math.random }) {
  const [ax, az] = from;
  const [bx, bz] = to;
  const length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length;
  const dz = (bz - az) / length;
  const ry = -Math.atan2(dz, dx);
  const end = brokenAt ?? length;
  const at = (s) => [ax + dx * s, az + dz * s];
  // 橋桁（厚み）
  const [mx, mz] = at(end / 2);
  batch.box(material, end, deck, width, [mx, y - deck / 2, mz], [0, ry, 0]);
  // 欄干：低い壁＋笠石（橋面の縁に合わせる）
  if (parapet) {
    for (const side of [-1, 1]) {
      const ox = -dz * side * (width / 2 - 0.25);
      const oz = dx * side * (width / 2 - 0.25);
      batch.box(material, end, 0.95, 0.45, [mx + ox, y + 0.47, mz + oz], [0, ry, 0]);
      batch.box(material, end, 0.16, 0.62, [mx + ox, y + 1.02, mz + oz], [0, ry, 0]);
      // 欄干の柱（2.5m ごと）
      for (let s = 1.2; s < end - 0.5; s += 2.5) {
        const [px, pz] = at(s);
        batch.box(material, 0.6, 1.2, 0.62, [px + ox, y + 0.6, pz + oz], [0, ry, 0]);
      }
    }
  }
  // アーチ：橋脚と橋脚の間を、側面の石積み（スパンドレル）とアーチの輪で埋める
  const points = [0, ...piers.filter((p) => p < end), ...(brokenAt === null ? [length] : [])];
  for (let i = 0; i < points.length - 1; i++) {
    const s0 = points[i];
    const s1 = points[i + 1];
    const span = s1 - s0 - 2.4;
    if (span <= 1) continue;
    const springing = y - deck - span * 0.5 * rise - 0.6;
    const height = y - deck - springing;
    const outer = new THREE.Shape();
    outer.moveTo(-span / 2, 0);
    outer.lineTo(-span / 2, height);
    outer.lineTo(span / 2, height);
    outer.lineTo(span / 2, 0);
    // 半楕円の開口（アーチの内側）
    const hole = new THREE.Path();
    hole.moveTo(span / 2, 0);
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI;
      hole.lineTo(Math.cos(a) * span / 2, Math.sin(a) * span * 0.5 * rise);
    }
    hole.lineTo(-span / 2, 0);
    outer.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(outer, { depth: width - 0.2, bevelEnabled: false });
    geometry.translate(0, 0, -(width - 0.2) / 2);
    const [cx, cz] = at((s0 + s1) / 2);
    batch.add(geometry, material, [cx, springing, cz], [0, ry, 0]);
    // アーチの輪（迫石の帯）：開口のすぐ外側に、少し張り出す
    const ring = new THREE.Shape();
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI;
      const r = 1.0 + 0.55 / (span / 2);
      ring[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * span / 2 * r, Math.sin(a) * span * 0.5 * rise * r);
    }
    for (let k = 16; k >= 0; k--) {
      const a = (k / 16) * Math.PI;
      ring.lineTo(Math.cos(a) * span / 2, Math.sin(a) * span * 0.5 * rise);
    }
    const ringGeometry = new THREE.ExtrudeGeometry(ring, { depth: width + 0.1, bevelEnabled: false });
    ringGeometry.translate(0, 0, -(width + 0.1) / 2);
    batch.add(ringGeometry, material, [cx, springing, cz], [0, ry, 0]);
  }
  // 橋脚：橋桁の下から地面まで。下に広い基礎（2段）
  for (const s of piers) {
    if (s > end + 0.1) continue;
    const [px, pz] = at(s);
    const ground = Math.min(groundAt(px, pz), groundAt(px + dz * width / 2, pz - dx * width / 2), groundAt(px - dz * width / 2, pz + dx * width / 2));
    const top = y - deck;
    const bottom = ground - 1.2;
    // 地面が橋桁のすぐ下まで来ている所（斜面の上）には、橋脚はいらない
    if (bottom > top - 0.5) continue;
    batch.box(material, 2.4, top - bottom, width + 0.8, [px, (top + bottom) / 2, pz], [0, ry, 0]);
    // 水切り（三角に張り出す控え）
    batch.box(material, 1.6, (top - bottom) * 0.75, 1.6, [px, bottom + (top - bottom) * 0.375, pz], [0, ry + Math.PI / 4, 0]);
    batch.box(material, 3.6, 1.4, width + 2.2, [px, ground + 0.2, pz], [0, ry, 0]);
    batch.box(material, 4.6, 0.9, width + 3.2, [px, ground - 0.5, pz], [0, ry, 0]);
  }
  // 崩れた端：割れた石と、少し欠けた橋桁
  if (brokenAt !== null) {
    const [ex, ez] = at(end);
    for (let i = 0; i < 6; i++) {
      batch.box(material, 0.6 + random() * 1.2, 0.5 + random() * 0.8, 0.6 + random(), [ex - dx * random() * 1.2 + (random() - 0.5) * width * dz, y - deck - random() * 0.8, ez - dz * random() * 1.2 + (random() - 0.5) * width * dx], [random(), random() * 3, random()]);
    }
  }
  return { length, ry, at };
}

// 崩れた橋脚：途中で折れ、上がぎざぎざ
export function brokenPier(batch, material, { x, z, top, width, ry, groundAt, random }) {
  const ground = groundAt(x, z);
  const bottom = ground - 1.2;
  batch.box(material, 2.4, top - bottom, width + 0.8, [x, (top + bottom) / 2, z], [0, ry, 0]);
  batch.box(material, 3.6, 1.4, width + 2.2, [x, ground + 0.2, z], [0, ry, 0]);
  for (let i = 0; i < 4; i++) {
    const h = 0.8 + random() * 2.2;
    batch.box(material, 1.0 + random() * 0.6, h, 1.0 + random() * 0.8, [x + (random() - 0.5) * 1.2, top + h / 2 - 0.3, z + (random() - 0.5) * (width - 0.5)], [0, ry + random() * 0.4, 0]);
  }
}
