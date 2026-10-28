// 生き物の形の道具（three.js）：太さの変わる筒（胴・首・頭・手足）、角ばった岩や甲殻の板、結晶（六角の柱と尖った先）。
// ゲームの中の敵の見た目（src/areas/foeViews.js）と、モデル作りのスクリプト（scripts/models/）の両方で使う。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ── 乱れ（決まった値） ──
export function seeded(seed) {
  let n = seed;
  return () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
}
function hash(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function valueNoise(x, y, z) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
  const xf = x - xi; const yf = y - yi; const zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf); const v = s(yf); const w = s(zf);
  let total = 0;
  for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = 0; dz <= 1; dz++) {
    total += hash(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return total;
}
export const fbm = (x, y, z) => valueNoise(x, y, z) * 0.6 + valueNoise(x * 2.3, y * 2.3, z * 2.3) * 0.3 + valueNoise(x * 5.1, y * 5.1, z * 5.1) * 0.1;

// ── 形の道具 ──
// 岩の塊：楕円体の表面を乱して、角ばった面にする。facets：面の細かさ（0〜2）、rough：凹凸の強さ
export function rockBlob({ size, center = [0, 0, 0], rotation = [0, 0, 0], facets = 2, rough = 0.18, seed = 1, flatBottom = null }) {
  const g = new THREE.IcosahedronGeometry(1, facets).toNonIndexed();
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.7 + seed * 3.1, v.y * 1.7 + seed * 1.7, v.z * 1.7 + seed * 2.3);
    v.multiplyScalar(1 + (n - 0.5) * 2 * rough);
    v.set(v.x * size[0], v.y * size[1], v.z * size[2]);
    if (flatBottom !== null) v.y = Math.max(v.y, flatBottom);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.rotateX(rotation[0]); g.rotateY(rotation[1]); g.rotateZ(rotation[2]);
  g.translate(...center);
  g.computeVertexNormals();
  return g;
}

// 2点の間に、手足のような太い岩の塊（両端は丸く、真ん中が少し太い）
export function limbRock(a, b, radiusA, radiusB, seed, rough = 0.16) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const length = A.distanceTo(B);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const g = rockBlob({ size: [(radiusA + radiusB) / 2, length / 2 + Math.max(radiusA, radiusB) * 0.4, (radiusA + radiusB) / 2], facets: 2, rough, seed });
  // 片側を細く（A 側が radiusA、B 側が radiusB）
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = THREE.MathUtils.clamp((y / (length / 2 + Math.max(radiusA, radiusB) * 0.4) + 1) / 2, 0, 1);
    const r = THREE.MathUtils.lerp(radiusA, radiusB, t) / ((radiusA + radiusB) / 2);
    p.setX(i, p.getX(i) * r);
    p.setZ(i, p.getZ(i) * r);
  }
  // y 軸を A→B の向きへ
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate(mid.x, mid.y, mid.z);
  g.computeVertexNormals();
  return g;
}

// 岩の板：筋肉と関節の流れに沿って、平たい岩を重ねる（at：中心、dir：流れの向き、size：[幅, 厚み, 長さ]）
export function slab(at, dir, size, seed) {
  const g = rockBlob({ size, facets: 1, rough: 0.22, seed });
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize());
  g.applyQuaternion(q);
  g.translate(...at);
  return g;
}

// 結晶：六角の柱と尖った先。根元は surface から内側へ depth だけ埋める
export function crystal(root, dir, length, radius, random) {
  const shaft = new THREE.CylinderGeometry(radius * 0.92, radius, length * 0.72, 6, 1);
  shaft.translate(0, length * 0.36, 0);
  const tip = new THREE.ConeGeometry(radius * 0.92, length * 0.32, 6, 1);
  tip.translate(0, length * 0.72 + length * 0.16, 0);
  const g = mergeGeometries([shaft.toNonIndexed(), tip.toNonIndexed()], false);
  g.rotateY(random() * Math.PI);
  // 柱を少し歪めて、どれも同じ形に見えないようにする
  g.scale(1 + (random() - 0.5) * 0.3, 1, 1 + (random() - 0.5) * 0.3);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  g.applyQuaternion(q);
  g.translate(...root);
  g.computeVertexNormals();
  return g;
}

// 結晶の群れ：中心のまわりに大・中・小。方向は面の外向きを中心に少しずつずらす
export function crystalCluster(center, normal, { count, big, random, spread = 0.6 }) {
  const list = [];
  const n = new THREE.Vector3(...normal).normalize();
  const tangent = new THREE.Vector3(1, 0, 0);
  if (Math.abs(tangent.dot(n)) > 0.9) tangent.set(0, 0, 1);
  const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize();
  tangent.crossVectors(bitangent, n).normalize();
  for (let i = 0; i < count; i++) {
    const r = spread * Math.sqrt(random());
    const a = random() * Math.PI * 2;
    const offset = tangent.clone().multiplyScalar(Math.cos(a) * r).addScaledVector(bitangent, Math.sin(a) * r);
    const size = i === 0 ? big : big * (0.35 + random() * 0.45);
    const dir = n.clone().addScaledVector(offset, 0.6).add(new THREE.Vector3((random() - 0.5) * 0.3, 0, (random() - 0.5) * 0.3)).normalize();
    // 根元は岩の中に（長さの 25% を埋める）
    const root = new THREE.Vector3(...center).add(offset).addScaledVector(dir, -size * 0.25);
    list.push(crystal(root.toArray(), dir.toArray(), size, size * 0.17, random));
  }
  return list;
}

// 太さの変わる筒（胴・首・頭・手足）：点の列を滑らかにつなぎ、輪の半径（rx 横、ry 縦）を変える。
// 表面に軽い凹凸を付け、平らな面で陰影を出す（丸い玉を並べた見た目にしない）
export function bodyLoft(points, { segments = 14, steps = 6, rough = 0.06, seed = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(...q.p)));
  const count = (points.length - 1) * steps;
  const radius = (t, key) => {
    const f = t * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(f));
    const k = f - i;
    const a = points[i][key];
    const b = points[i + 1][key];
    return a + (b - a) * (k * k * (3 - 2 * k));
  };
  const positions = [];
  const index = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let r = 0; r <= count; r++) {
    const t = r / count;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    const vertical = new THREE.Vector3().crossVectors(tangent, side).normalize();
    const rx = radius(t, 'rx');
    const ry = radius(t, 'ry');
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const p = center.clone().addScaledVector(side, Math.cos(a) * rx).addScaledVector(vertical, Math.sin(a) * ry);
      const n = fbm(p.x * 0.9 + seed, p.y * 0.9, p.z * 0.9);
      p.addScaledVector(side, Math.cos(a) * rx * (n - 0.5) * 2 * rough).addScaledVector(vertical, Math.sin(a) * ry * (n - 0.5) * 2 * rough);
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let r = 0; r < count; r++) {
    for (let i = 0; i < segments; i++) {
      const a0 = r * segments + i;
      const a1 = r * segments + ((i + 1) % segments);
      // 外向きの面
      index.push(a0, a1, a0 + segments, a1, a1 + segments, a0 + segments);
    }
  }
  // 両端を閉じる
  for (const [r, flip] of [[0, true], [count, false]]) {
    const c = positions.length / 3;
    const center = curve.getPointAt(r / count);
    positions.push(center.x, center.y, center.z);
    for (let i = 0; i < segments; i++) {
      const p0 = r * segments + i;
      const p1 = r * segments + ((i + 1) % segments);
      if (flip) index.push(c, p1, p0); else index.push(c, p0, p1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  // 模様用の uv（位置から）
  const pos = flat.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) + pos.getZ(i)) * 0.35; uv[i * 2 + 1] = pos.getY(i) * 0.35; }
  flat.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return flat;
}

// 角ばった岩の板：面の外向き normal に沿って平たく、流れ flow の向きに長い。半分は体に埋める
export function plate(at, normal, flow, [width, thickness, length], seed) {
  const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const p = g.getAttribute('position');
  const random = seeded(seed * 97 + 13);
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + random() * 0.5;
    p.setXYZ(i, p.getX(i) * width * k, p.getY(i) * thickness, p.getZ(i) * length * k);
  }
  const n = new THREE.Vector3(...normal).normalize();
  const f = new THREE.Vector3(...flow);
  f.addScaledVector(n, -f.dot(n)).normalize();
  const side = new THREE.Vector3().crossVectors(n, f).normalize();
  const basis = new THREE.Matrix4().makeBasis(side, n, f);
  g.applyMatrix4(basis);
  // 板の中心を少し体の内側へ（根元を埋める）
  const c = new THREE.Vector3(...at).addScaledVector(n, -thickness * 0.35);
  g.translate(c.x, c.y, c.z);
  g.computeVertexNormals();
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 0.4; uv[i * 2 + 1] = p.getZ(i) * 0.4; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// 筒の表面に沿って板を並べる（a → b の線、外向きは sideDir の回り）
export function platesAlong(a, b, count, { radius, around, size, seedBase, outward = [0, 1, 0] }) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const flow = B.clone().sub(A).normalize();
  const list = [];
  const base = new THREE.Vector3(...outward).normalize();
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    for (const angle of around) {
      const n = base.clone().applyAxisAngle(flow, angle).normalize();
      const at = A.clone().lerp(B, t).addScaledVector(n, radius * (1 - t * 0.15));
      list.push(plate(at.toArray(), n.toArray(), flow.toArray(), size, seedBase + i * 7 + Math.round(angle * 10)));
    }
  }
  return list;
}

