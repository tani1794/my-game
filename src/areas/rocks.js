// 岩の塊（12面体）と、歩ける床が重なっていないかを調べる（three.js も DOM も使わない）。
// 岩は見た目だけで当たり判定がないので、床の上に岩があると、主人公は岩の中を歩き、カメラも岩の中に入る。
// 岩：{ x, y, z, s, sy }（s は 12面体の外接球の半径、sy は縦の倍率）。
// 見た目どおりに調べる：12面体はどう回しても外接球の内側に収まるので、外接球（s）が主人公の体（太さ radius）にかからなければよい。
import { floorHeight } from './kit.js';

function active(item, state) {
  if (item.when && !state[item.when]) return false;
  if (item.unless && state[item.unless]) return false;
  return true;
}

// 床の上の点（step m おき）。四角・円・道のそれぞれの範囲を格子で調べ、床の上の点だけを残す。
// near：{ x0, x1, z0, z1 }（その範囲だけ調べる。岩のまわりだけを速く調べるため）
function floorSamples(floor, step, near = null) {
  let x0;
  let x1;
  let z0;
  let z1;
  if (floor.type === 'rect') ({ x0, x1, z0, z1 } = floor);
  else if (floor.type === 'circle') { x0 = floor.x - floor.radius; x1 = floor.x + floor.radius; z0 = floor.z - floor.radius; z1 = floor.z + floor.radius; }
  else {
    const xs = floor.points.map((p) => p[0]);
    const zs = floor.points.map((p) => p[1]);
    const half = floor.width / 2;
    x0 = Math.min(...xs) - half; x1 = Math.max(...xs) + half; z0 = Math.min(...zs) - half; z1 = Math.max(...zs) + half;
  }
  if (near) {
    // 格子の位置は床ごとに同じにする（範囲を絞っても、調べる点が変わらない）
    const from = (a, b) => a + Math.max(0, Math.ceil((b - a) / step - 1e-9)) * step;
    if (near.x1 < x0 || near.x0 > x1 || near.z1 < z0 || near.z0 > z1) return [];
    const nx0 = from(x0, near.x0);
    const nz0 = from(z0, near.z0);
    x1 = Math.min(x1, near.x1); z1 = Math.min(z1, near.z1);
    x0 = nx0; z0 = nz0;
  }
  const points = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    for (let z = z0; z <= z1 + 1e-6; z += step) {
      const y = floorHeight(floor, x, z);
      if (y !== null) points.push([x, y, z]);
    }
  }
  return points;
}

// 岩 rock が、床の上の点 (x, y, z) に立つ主人公の体にかかるか
function touches(rock, [x, y, z], radius, heights) {
  const r = rock.s;
  const ry = r * (rock.sy ?? 1);
  return heights.some((h) => {
    const dx = (x - rock.x) / (r + radius);
    const dy = (y + h - rock.y) / (ry + radius);
    const dz = (z - rock.z) / (r + radius);
    return dx * dx + dy * dy + dz * dz < 1;
  });
}

// 主人公の体（太さ radius、足もとから heights の高さ）が岩にかかる、床の上の点の一覧
export function rockIntrusions(rocks, floors, { state = {}, radius = 0.3, heights = [0.4, 1.0, 1.6], step = 0.5 } = {}) {
  const found = [];
  for (const floor of floors) {
    if (!active(floor, state)) continue;
    for (const point of floorSamples(floor, step)) {
      const rock = rocks.find((r) => touches(r, point, radius, heights));
      if (rock) found.push({ floor: floor.id, at: point, rock });
    }
  }
  return found;
}

// ひとつの岩にかかる床の上の点（岩のまわりだけ調べる）
function pointsUnder(rock, floors, { radius, heights, step }) {
  const reach = rock.s + radius;
  const near = { x0: rock.x - reach, x1: rock.x + reach, z0: rock.z - reach, z1: rock.z + reach };
  const points = [];
  for (const floor of floors) for (const point of floorSamples(floor, step, near)) if (touches(rock, point, radius, heights)) points.push(point);
  return points;
}

// 岩を床から離す：床にかかる岩は、かかる点の重心から離れる向きへ少しずつずらす（最大 maxPush m）。
// それでもかかるなら、かからなくなるまで小さくする。床にかからない岩は、そのまま返す。
// 仕掛けで出る床（when）も、いつか歩くので調べる（state を省くと、すべての when を満たした床で調べる）
export function clearRocks(rocks, floors, { state = null, radius = 0.3, heights = [0.4, 1.0, 1.6], step = 0.5, push = 0.25, maxPush = 4, shrink = 0.92 } = {}) {
  const all = state ?? Object.fromEntries(floors.filter((f) => f.when).map((f) => [f.when, true]));
  const walkable = floors.filter((f) => active(f, all));
  const options = { radius, heights, step };
  return rocks.map((original) => {
    let points = pointsUnder(original, walkable, options);
    if (points.length === 0) return original;
    const rock = { ...original };
    for (let moved = 0; points.length > 0 && moved < maxPush - 1e-9; moved += push) {
      let dx = 0;
      let dz = 0;
      for (const [x, , z] of points) { dx += rock.x - x; dz += rock.z - z; }
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) break;
      rock.x += (dx / length) * push;
      rock.z += (dz / length) * push;
      points = pointsUnder(rock, walkable, options);
    }
    while (points.length > 0 && rock.s > 0.3) {
      rock.s *= shrink;
      points = pointsUnder(rock, walkable, options);
    }
    return rock;
  });
}
