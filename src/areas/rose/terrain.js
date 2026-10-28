// 白薔薇の迷宮橋のまわりの地形（three.js も DOM も使わない）：高さを返す式だけ。
// 谷底（沢と湿った窪地）→ 斜面 → 岩盤の高台（入口の丘・庭園の段丘・城の高台・門前の丘）、外周の丘と稜線。
// 歩ける床は今までどおり layout.js が決める。ここは見た目と、カメラが地面に潜らないための高さ。
// 高台の上は床の上面よりわずかに低くし、床（石の台）が地面に乗って見えるようにする。
// 斜面を通る道・階段の下は地形を削り（切り通し）、床より上に土が出ないようにする。
import { floorHeight } from '../kit.js';
import { ROSE_FLOORS } from './layout.js';

export const VALLEY_FLOOR = -30;

// 高台：角を丸めた四角。top は上面の高さ、cliff は斜面の幅（m）
export const PLATEAUS = [
  // 入口の丘（礼拝堂側）。南へ広がる
  { id: 'entryHill', x0: -16, x1: 20, z0: 40, z1: 150, top: -0.06, cliff: 13, round: 6 },
  // 白薔薇の中央庭園の段丘（西の降り口・あずまやを含む）
  { id: 'gardenTerrace', x0: -64, x1: -18, z0: 0, z1: 66, top: -4.06, cliff: 12, round: 8 },
  // 城の高台：城の敷地全体を支える岩の台
  { id: 'castleMesa', x0: -62, x1: 62, z0: -150, z1: -46, top: -1.06, cliff: 15, round: 14 },
  // 誓剣の門前の丘（洞窟の入口の岩山へ続く）
  { id: 'oathHill', x0: 72, x1: 135, z0: -40, z1: 72, top: -0.06, cliff: 11, round: 8 },
];

// 沢：谷を北西から南東へ抜ける（本橋の崩れた先の下と、昇降橋の下を通る）
export const STREAM = [[-170, -40], [-90, -24], [-40, -14], [-6, 6], [30, 12], [62, 30], [96, 82], [150, 120], [220, 150]];

// 外周の丘の中心と、谷が抜ける向き（そちらは低く残す）
const CENTER = { x: 15, z: -10 };
const OPENINGS = [Math.atan2(-170 - CENTER.x, -40 - CENTER.z), Math.atan2(220 - CENTER.x, 150 - CENTER.z)];

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 形を決める乱れ（決まった値。毎回同じ地形になる）
function noise(x, z) {
  return (
    Math.sin(x * 0.051 + Math.sin(z * 0.037) * 1.7) * 0.5
    + Math.sin(z * 0.043 - x * 0.021 + 1.3) * 0.35
    + Math.sin((x + z) * 0.11 + 2.1) * 0.15
  );
}

// 四角（角は round で丸める）の外側への距離。中なら 0
function outside(p, x, z) {
  const dx = Math.max(p.x0 + p.round - x, 0, x - (p.x1 - p.round));
  const dz = Math.max(p.z0 + p.round - z, 0, z - (p.z1 - p.round));
  return Math.max(0, Math.hypot(dx, dz) - p.round);
}

function streamDistance(x, z) {
  let best = Infinity;
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i];
    const [bx, bz] = STREAM[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

// 谷底：ゆるい起伏と、沢に向かって下がる窪み
function valleyFloor(x, z) {
  const d = streamDistance(x, z);
  const channel = -2.6 * (1 - smoothstep(0, 9, d)) - 1.5 * (1 - smoothstep(9, 40, d));
  return VALLEY_FLOOR + 1.8 + channel + noise(x, z) * 1.6;
}

// 外周の丘：中心から離れるほど高くなる。谷の抜ける向きは低く、高さは向きごとに変える
function rimRise(x, z) {
  const r = Math.hypot(x - CENTER.x, z - CENTER.z);
  if (r < 135) return 0;
  const angle = Math.atan2(x - CENTER.x, z - CENTER.z);
  const gap = Math.min(...OPENINGS.map((a) => Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a)))));
  const open = smoothstep(0.12, 0.45, gap);
  const ridge = 0.65 + 0.35 * Math.sin(angle * 3 + 0.8) + 0.25 * Math.sin(angle * 7 + 2.3);
  return smoothstep(135, 240, r) * 70 * ridge * (0.25 + 0.75 * open);
}

// 高台の上は平ら（少しだけ凹凸）、縁から cliff の幅で谷底へ落ちる。縁ほど急（岩肌が出る）
function plateauHeight(p, x, z, floor) {
  const d = outside(p, x, z);
  if (d === 0) return p.top;
  const wobble = noise(x * 1.7, z * 1.7) * 2.2;
  const drop = smoothstep(0, p.cliff, d + wobble * 0.5);
  return p.top + (floor - p.top) * drop;
}

// 床を少し広げたもの（切り通しの幅）
const CUT_MARGIN = 0.8;
const CUTS = ROSE_FLOORS.map((f) => {
  if (f.type === 'path') return { ...f, width: f.width + CUT_MARGIN * 2 };
  if (f.type === 'circle') return { ...f, radius: f.radius + CUT_MARGIN };
  return f;
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 床の下は、床の上面より下まで削る（四角い床は、広げた分も縁の高さで削る。坂でも傾きは変えない）
function cut(x, z, h) {
  let limit = h;
  for (const floor of CUTS) {
    let y;
    if (floor.type === 'rect') {
      if (x < floor.x0 - CUT_MARGIN || x > floor.x1 + CUT_MARGIN || z < floor.z0 - CUT_MARGIN || z > floor.z1 + CUT_MARGIN) continue;
      y = floorHeight(floor, clamp(x, floor.x0, floor.x1), clamp(z, floor.z0, floor.z1));
    } else {
      y = floorHeight(floor, x, z);
    }
    if (y !== null) limit = Math.min(limit, y - 0.08);
  }
  return limit;
}

export function roseTerrainHeight(x, z) {
  let h = valleyFloor(x, z);
  for (const p of PLATEAUS) h = Math.max(h, plateauHeight(p, x, z, h));
  // 洞窟の入口の北は岩山
  const cave = Math.hypot(x - 92, z + 18);
  const crag = 22 * (1 - smoothstep(6, 34, cave)) * smoothstep(-2, -16, z);
  if (crag > 0) h = Math.max(h, -0.06 + crag);
  return cut(x, z, h + rimRise(x, z));
}

// 傾き（0 平ら 〜 大きいほど急）。岩肌・木を置く場所を決める
export function roseTerrainSlope(x, z) {
  const e = 1;
  const dx = roseTerrainHeight(x + e, z) - roseTerrainHeight(x - e, z);
  const dz = roseTerrainHeight(x, z + e) - roseTerrainHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

export function plateauAt(x, z) {
  return PLATEAUS.find((p) => outside(p, x, z) === 0) ?? null;
}
