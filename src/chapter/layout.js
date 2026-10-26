// 第一章の地図（three.js を使わない純粋なデータと関数）。x が東、z が南、1 = 1m。
// 歩ける範囲・地面の高さ・当たり判定・出来事の場所を、ここだけで決める（描画と頭脳の両方がここを読む）。

// ── 道（線と幅）と広場（円）と区画（四角） ──
export const PATHS = [
  { points: [[0, 58], [2, 44], [-1, 32], [0, 24]], width: 4.6 },        // 開始 → 広場
  { points: [[0, 8], [0, 2]], width: 4.4 },                               // 広場 → 最初の戦い
  { points: [[0, -10], [-1, -15], [0, -19.5]], width: 4.2 },              // 最初の戦い → 門衛所
  { points: [[0, -28.5], [0, -36]], width: 3.6 },                         // 門衛所の裏 → 崖
  { points: [[-10, 20], [-21, 17], [-29, 14]], width: 3.4 },              // 広場 → 西の沢（寄り道）
  { points: [[10, 18], [20, 16], [24, 16], [30, 15], [36, 8], [36, -6], [35, -22], [36, -36.5]], width: 3.6 }, // 東の門 → 参道
  { points: [[36, -51.5], [36, -54]], width: 3.2 },                       // 橋 → 橋の先
  { points: [[36, -62], [36, -66]], width: 6 },                           // 橋の先 → 礼拝堂の前
];

export const CLEARINGS = [
  { x: 0, z: 57, radius: 7 },     // 開始
  { x: 0, z: 18, radius: 12.5 },  // 広場
  { x: 0, z: -4, radius: 9 },     // 最初の戦い
  { x: 0, z: -36, radius: 3.2 },  // 崖の見晴らし
  { x: -36, z: 11, radius: 9 },   // 西の沢
  { x: 36, z: -58, radius: 9.5 }, // 橋の先の戦い
];

// 四角い区画：門衛所の中、礼拝堂の敷地（外周を一周でき、中に入れる）
export const AREAS = [
  { x0: -5.5, x1: 5.5, z0: -28.6, z1: -19.4 }, // 門衛所の中
  { x0: 21, x1: 51, z0: -108, z1: -62 },       // 礼拝堂の敷地
];

// 谷：東西に走る。橋の上だけ渡れる
export const RAVINE = { north: -49, south: -39 };
export const BRIDGE = { x: 36, halfWidth: 1.3, z0: -51.5, z1: -36.5 };

// 礼拝堂（正面は南）。身廊・前の鐘塔・北の後陣・東の祭具室・西の側廊
export const CHAPEL = {
  x: 36,
  front: -71,       // 正面の壁の z
  back: -95,        // 身廊の奥（後陣の始まり）
  halfWidth: 7,     // 身廊の幅の半分（x 29〜43）
  wall: 0.8,
  door: 1.3,        // 入口の幅の半分
  apseRadius: 7,
  tower: { x0: 33, x1: 39, z0: -77, z1: -71, height: 30 },
  sacristy: { x0: 43, x1: 48, z0: -93, z1: -85, door: [-90, -88] },
  aisle: { x0: 25.5, x1: 29, z0: -92, z1: -76, collapse: [-88, -84] },
  windows: [-80, -85, -90],
  columns: [-79, -83, -87, -91],
  floor: 0.6,       // 床は敷地より 0.6m 高い（正面に階段）
};

export const GATEHOUSE = { x0: -6, x1: 6, z0: -29, z1: -19, wall: 0.7, door: 1.3 };
export const GATE = { x: 24, z: 16, halfWidth: 2.6 };
const YARD_HEIGHT = 0.3;

// ── 出来事の場所 ──
export const CHECKPOINTS = {
  start: { x: 0, z: 56, facing: Math.PI },
  gate: { x: 28, z: 15.5, facing: Math.PI / 2 },
  chapel: { x: 36, z: -64, facing: Math.PI },
};

export const ZONES = {
  plaza: { x: 0, z: 18, radius: 9 },
  fight1: { x: 0, z: -4, radius: 9 },
  overlook: { x: 0, z: -35, radius: 3.5 },
  bridgeEnd: { x: 36, z: -53, radius: 4 },
  fight2: { x: 36, z: -58, radius: 9.5 },
  chapelFront: { x: 36, z: -66, radius: 4.5 },
  nave: { x: 36, z: -82, radius: 5 },
};

// 調べられるもの（radius の内側で「調べる」が出る）
export const INTERACTABLES = {
  flowers: { x: -8.5, z: 24, radius: 2.4, label: '花を調べる' },
  gate: { x: 22.2, z: 16, radius: 2.6, label: '門を調べる' },
  winch: { x: -2.6, z: -25.2, radius: 2.2, label: '巻き上げ機を調べる' },
  lever: { x: 3.2, z: -26.4, radius: 2, label: 'レバーを引く' },
  memorial: { x: -41, z: 6.5, radius: 2.4, label: '記念碑を調べる' },
  mural: { x: 29.9, z: -91.5, radius: 2.4, label: '壁画を調べる' },
  altar: { x: 36, z: -92.2, radius: 2.4, label: '祭壇を調べる' },
  pilgrimPath: { x: 36, z: -105, radius: 3, label: '巡礼路を進む' },
};

export const GUARD_POSTS = [
  { id: 'guard-1', x: 0, z: -7, facing: 0, leash: 14 },
  { id: 'guard-2', x: 33, z: -61, facing: 0, leash: 13 },
  { id: 'guard-3', x: 39.5, z: -60, facing: 0, leash: 13 },
];

// ── 形の計算 ──
function distanceToSegment(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

export function distanceToPaths(x, z) {
  let best = Infinity;
  for (const path of PATHS) {
    for (let i = 0; i < path.points.length - 1; i++) {
      best = Math.min(best, distanceToSegment(x, z, path.points[i], path.points[i + 1]) - path.width / 2);
    }
  }
  return best;
}

const inArea = (x, z, a) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1;
export const onBridge = (x, z) => Math.abs(x - BRIDGE.x) <= BRIDGE.halfWidth && z >= BRIDGE.z0 && z <= BRIDGE.z1;
const inRavine = (x, z) => z > RAVINE.north && z < RAVINE.south;

// 歩ける場所か（道・広場・区画・橋）。谷は橋の上だけ
export function walkable(x, z) {
  if (onBridge(x, z)) return true;
  if (inRavine(x, z)) return false;
  if (distanceToPaths(x, z) <= 0) return true;
  if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) <= c.radius)) return true;
  return AREAS.some((a) => inArea(x, z, a));
}

const smooth = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

function baseHeight(x, z) {
  return 0.35 * Math.sin(x * 0.11) + 0.3 * Math.cos(z * 0.09) + 0.2 * Math.sin((x + z) * 0.21);
}

// 礼拝堂の敷地は平らにする（まわり 6m で元の起伏へ戻す）
function yardBlend(x, z) {
  const outside = Math.max(20 - x, x - 52, -110 - z, z + 60, 0);
  return 1 - smooth(outside / 6);
}

function inChapelFloor(x, z) {
  const { x: cx, front, back, halfWidth, apseRadius, sacristy } = CHAPEL;
  if (x >= cx - halfWidth && x <= cx + halfWidth && z <= front && z >= back) return true;
  if (z < back && Math.hypot(x - cx, z - back) <= apseRadius) return true;
  return inArea(x, z, sacristy);
}

// 地面（と床・橋）の高さ
export function heightAt(x, z) {
  if (onBridge(x, z)) {
    // 両岸の地面を結び、真ん中が少し持ち上がった橋（両端は地面と同じ高さ）
    const southEnd = groundHeight(BRIDGE.x, BRIDGE.z1);
    const northEnd = groundHeight(BRIDGE.x, BRIDGE.z0);
    const t = (z - BRIDGE.z1) / (BRIDGE.z0 - BRIDGE.z1);
    return southEnd + (northEnd - southEnd) * t + 0.6 * Math.sin(Math.PI * t);
  }
  return groundHeight(x, z);
}

// 橋を除いた地面の高さ
export function groundHeight(x, z) {
  let y = baseHeight(x, z);

  // 谷：縁から 2m で一気に深くなり、底は約 9m 下
  if (inRavine(x, z)) {
    const depth = Math.min(z - RAVINE.north, RAVINE.south - z);
    y -= 9 * smooth(depth / 2.5);
  }

  // 礼拝堂の敷地
  const blend = yardBlend(x, z);
  if (blend > 0) y = y * (1 - blend) + YARD_HEIGHT * blend;

  // 門衛所の床
  if (inArea(x, z, GATEHOUSE)) y = 0.2 + baseHeight(0, -24) * 0.5;

  // 礼拝堂の床と、正面の階段（入口の前 2m で 0.6m 上がる）
  if (inChapelFloor(x, z)) return YARD_HEIGHT + CHAPEL.floor;
  if (Math.abs(x - CHAPEL.x) <= CHAPEL.door + 1.2 && z <= CHAPEL.front + 2.2 && z > CHAPEL.front) {
    return YARD_HEIGHT + CHAPEL.floor * (1 - (z - CHAPEL.front) / 2.2);
  }
  return y;
}

// 壁の箱（向きのある四角）：中心・半分の幅と奥行き・向き
const box = (x0, z0, x1, z1) => ({
  type: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, angle: 0,
});
// 2点を結ぶ、厚み t の壁
function wall(ax, az, bx, bz, t) {
  const length = Math.hypot(bx - ax, bz - az);
  return { type: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: length / 2, hz: t / 2, angle: -Math.atan2(bz - az, bx - ax) };
}

function gatehouseColliders() {
  const { x0, x1, z0, z1, wall: t, door } = GATEHOUSE;
  return [
    box(x0, z0, -door, z0 + t),
    box(door, z0, x1, z0 + t),
    box(x0, z1 - t, -door, z1),
    box(door, z1 - t, x1, z1),
    box(x0, z0, x0 + t, z1),
    box(x1 - t, z0, x1, z1),
    box(-3.3, -25.8, -1.9, -24.6), // 巻き上げ機
    box(2.9, -27.4, 3.5, -26.8),   // レバー
  ];
}

function chapelColliders() {
  const { x: cx, front, back, halfWidth: hw, wall: t, door, apseRadius: r, sacristy: s, aisle: a } = CHAPEL;
  const west = cx - hw;
  const east = cx + hw;
  const list = [
    box(west, front - t, cx - door, front),
    box(cx + door, front - t, east, front),
    box(west, back, west + t, front),
    box(east - t, s.door[1], east, front),
    box(east - t, back, east, s.door[0]),
    // 祭具室
    box(s.x1 - t, s.z0, s.x1, s.z1),
    box(s.x0, s.z1 - t, s.x1, s.z1),
    box(s.x0, s.z0, s.x1, s.z0 + t),
    // 西の側廊（外壁の一部が崩れていて、そこから中を覗ける・入れる）
    box(a.x0, a.collapse[1], a.x0 + t, a.z1),
    box(a.x0, a.z0, a.x0 + t, a.collapse[0]),
    box(a.x0, a.z1 - t, a.x1, a.z1),
    box(a.x0, a.z0, a.x1, a.z0 + t),
    // 祭壇
    box(cx - 1.4, back + 0.6, cx + 1.4, back + 1.8),
  ];
  // 後陣：半円の壁を 7 枚の壁で
  for (let i = 0; i < 7; i++) {
    const a0 = Math.PI + (i / 7) * Math.PI;
    const a1 = Math.PI + ((i + 1) / 7) * Math.PI;
    list.push(wall(cx + Math.cos(a0) * r, back + Math.sin(a0) * r, cx + Math.cos(a1) * r, back + Math.sin(a1) * r, t));
  }
  // 身廊の柱と、鐘塔を支える柱
  for (const z of CHAPEL.columns) {
    list.push({ x: cx - 4.5, z, radius: 0.45 }, { x: cx + 4.5, z, radius: 0.45 });
  }
  list.push({ x: CHAPEL.tower.x0 + 0.5, z: CHAPEL.tower.z0 + 0.5, radius: 0.6 }, { x: CHAPEL.tower.x1 - 0.5, z: CHAPEL.tower.z0 + 0.5, radius: 0.6 });
  // 長椅子：中央の通路（幅 2.4m）の左右に 5 列
  for (let i = 0; i < 5; i++) {
    const z = -80 - i * 2;
    list.push(box(cx - 3.8, z - 0.3, cx - 1.2, z + 0.3), box(cx + 1.2, z - 0.3, cx + 3.8, z + 0.3));
  }
  return list;
}

// 当たり判定の一覧（円 { x, z, radius } と、箱 { type: 'box', x, z, hx, hz, angle }）
export function collidersFor({ gateOpen }) {
  const list = [
    { x: -3, z: 13.5, radius: 1.6 },                    // 広場の大木
    { x: -38.2, z: 3.5, radius: 0.6 }, { x: -33.8, z: 3.5, radius: 0.6 }, // 崩れたアーチの柱
    box(-41.4, 6.1, -40.6, 6.9),                        // 記念碑
    ...gatehouseColliders(),
    ...chapelColliders(),
  ];
  if (!gateOpen) list.push(box(GATE.x - 0.3, GATE.z - GATE.halfWidth, GATE.x + 0.3, GATE.z + GATE.halfWidth));
  return list;
}

// 調べられるものの中で、いちばん近いもの（radius の内側）。なければ null
export function nearestInteractable(x, z, available) {
  let best = null;
  for (const id of available) {
    const spot = INTERACTABLES[id];
    const distance = Math.hypot(x - spot.x, z - spot.z);
    if (distance <= spot.radius && (!best || distance < best.distance)) best = { id, distance };
  }
  return best?.id ?? null;
}

export const inZone = (x, z, zone) => Math.hypot(x - zone.x, z - zone.z) <= zone.radius;
