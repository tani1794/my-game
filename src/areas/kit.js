// 地図の部品（three.js も DOM も使わない）：床（四角・道・円）と壁で、歩ける範囲と高さを決める。
// 上下に重なる場所（洞窟の岩棚など）もあるので、高さは「今いる高さから行ける床」で決める。
// 仕掛けで出る床・消える壁は when（その印があるとき）／unless（その印がないとき）で表す。
//
// 床：
//   { type: 'rect', x0, x1, z0, z1, y }                  平らな四角
//   { type: 'rect', x0, x1, z0, z1, y, toY, axis: 'z' }  坂（axis の向きに y → toY）
//   { type: 'path', points: [[x, z, y], ...], width }    道・橋・階段（点の間で高さをつなぐ）
//   { type: 'circle', x, z, radius, y }                  円い広場
// 壁：{ from: [x, z], to: [x, z], thickness, height, base? }（base は壁の下端の高さ。省くと 0）
// 当たり判定の箱・円：{ type: 'box', x, z, hx, hz, angle, y0?, y1? }、{ x, z, radius, y0?, y1? }
export const STEP = 0.75; // 1回の移動で上り下りできる高さ
const PLAYER_MARGIN = 0.3;

function active(item, state) {
  if (item.when && !state[item.when]) return false;
  if (item.unless && state[item.unless]) return false;
  return true;
}

// 床の上なら、その場所の高さ。床の外なら null
export function floorHeight(floor, x, z) {
  if (floor.type === 'rect') {
    if (x < floor.x0 || x > floor.x1 || z < floor.z0 || z > floor.z1) return null;
    if (floor.toY === undefined) return floor.y;
    const t = floor.axis === 'x' ? (x - floor.x0) / (floor.x1 - floor.x0) : (z - floor.z0) / (floor.z1 - floor.z0);
    return floor.y + (floor.toY - floor.y) * t;
  }
  if (floor.type === 'circle') {
    return Math.hypot(x - floor.x, z - floor.z) <= floor.radius ? floor.y : null;
  }
  // 道：いちばん近い区間で、幅の内側なら高さをつなぐ
  let best = null;
  const half = floor.width / 2;
  for (let i = 0; i < floor.points.length - 1; i++) {
    const [ax, az, ay] = floor.points[i];
    const [bx, bz, by] = floor.points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d <= half && (!best || d < best.d)) best = { d, y: ay + (by - ay) * t };
  }
  return best ? best.y : null;
}

export function wallBox(wall) {
  const [ax, az] = wall.from;
  const [bx, bz] = wall.to;
  const length = Math.hypot(bx - ax, bz - az);
  const base = wall.base ?? 0;
  return {
    type: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: length / 2, hz: wall.thickness / 2,
    angle: -Math.atan2(bz - az, bx - ax), y0: base, y1: base + wall.height, when: wall.when, unless: wall.unless,
  };
}

export function createLevel({ floors = [], walls = [], colliders: extra = [] }) {
  const wallBoxes = walls.map(wallBox);
  const all = [...wallBoxes, ...extra];

  // (x, z) にある床の高さの一覧（仕掛けの状態つき）
  function heights(x, z, state) {
    const list = [];
    for (const floor of floors) {
      if (!active(floor, state)) continue;
      const h = floorHeight(floor, x, z);
      if (h !== null) list.push(h);
    }
    return list;
  }

  // 今の高さ y にいちばん近い床の高さ。床がなければ y のまま
  function heightAt(x, z, y = 0, state = {}) {
    let best = null;
    for (const h of heights(x, z, state)) {
      if (best === null || Math.abs(h - y) < Math.abs(best - y)) best = h;
    }
    return best ?? y;
  }

  // 今の高さ y から歩いて行ける床があるか
  function walkable(x, z, y = 0, state = {}) {
    return heights(x, z, state).some((h) => Math.abs(h - y) <= STEP);
  }

  // 当たり判定（仕掛けの状態と、今の高さに合うものだけ）
  function colliders(state = {}, y = null) {
    return all.filter((c) => {
      if (!active(c, state)) return false;
      if (y === null || c.y0 === undefined) return true;
      return y >= c.y0 - 1 && y <= c.y1;
    });
  }

  return { floors, walls, wallBoxes, extra, heightAt, walkable, colliders };
}

function blocked(colliders, x, z) {
  return colliders.some((c) => {
    if (c.type === 'box') {
      const dx = x - c.x;
      const dz = z - c.z;
      const lx = dx * Math.cos(c.angle) - dz * Math.sin(c.angle);
      const lz = dx * Math.sin(c.angle) + dz * Math.cos(c.angle);
      return Math.abs(lx) < c.hx + PLAYER_MARGIN && Math.abs(lz) < c.hz + PLAYER_MARGIN;
    }
    return Math.hypot(x - c.x, z - c.z) < c.radius + PLAYER_MARGIN;
  });
}

// 格子（step m）の上を歩いてたどり、from から to（の 1.5m 以内）へ行けるか。仕掛けの前後の確認用
export function reachable(level, from, to, state = {}, { step = 0.5, limit = 400000 } = {}) {
  const key = (x, z, y) => `${Math.round(x / step)},${Math.round(z / step)},${Math.round(y * 2)}`;
  const start = { x: from.x, z: from.z, y: level.heightAt(from.x, from.z, from.y ?? 0, state) };
  const seen = new Set([key(start.x, start.z, start.y)]);
  const queue = [start];
  let head = 0;
  while (head < queue.length && seen.size < limit) {
    const p = queue[head++];
    if (Math.hypot(p.x - to.x, p.z - to.z) < 1.5 && (to.y === undefined || Math.abs(p.y - to.y) < 1.5)) return true;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const x = p.x + dx;
      const z = p.z + dz;
      if (!level.walkable(x, z, p.y, state)) continue;
      const y = level.heightAt(x, z, p.y, state);
      if (blocked(level.colliders(state, y), x, z)) continue;
      const k = key(x, z, y);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ x, z, y });
    }
  }
  return false;
}
