// 蒼響の洞穴の壁の岩（12面体）の位置と大きさ（three.js を使わない）。build.js がこの順に置き、向きだけ乱数で回す。
// 岩には当たり判定がないので、歩ける床（layout.js）の上には置かない。並べたあと clearRocks で、床にかかる岩を床から離す
// （tests/caveRocks.test.js で確かめる）。
// 下層は、低い壁の上に2段目の岩を積み、天井との間から外の景色（出口の先の遠景）がのぞかないようにする。
import { CAVE_HEIGHTS, CAVE_FLOORS } from './layout.js';
import { clearRocks, rockIntrusions } from '../rocks.js';

const { UP, LOW } = CAVE_HEIGHTS;
// すべての仕掛けが動いたあとの床（渡り板あり）で調べる
const OPEN = { lightOpen: true, planksSet: true };

// 道の両脇に沿って岩を並べる：道の中心線から gap だけ外へ。高さは道の高さ + lift
function alongPath(add, points, gap, s, spacing, lift) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az, ay] = points[i];
    const [bx, bz, by] = points[i + 1];
    const length = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / length;
    const nz = (bx - ax) / length;
    const count = Math.max(1, Math.round(length / spacing));
    for (let k = 0; k <= count; k++) {
      const t = k / count;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = ay + (by - ay) * t + lift;
      for (const side of [-1, 1]) add(x + nx * gap * side, y, z + nz * gap * side, s);
    }
  }
}

export function caveRocks() {
  const rocks = [];
  const add = (x, y, z, s, sy = 1.4) => rocks.push({ x, y, z, s, sy });
  // 広間のまわり：西の壁は小部屋への道（z 30）を、北の壁は入口の通路を空ける。南の壁は石扉（x 0）を空ける
  for (let z = 14; z <= 40; z += 4.5) { if (Math.abs(z - 30) > 3) add(-19, 3, z, 3.6); add(19, 3, z, 3.6); }
  for (let x = -14; x <= 14; x += 4.5) { if (x < -3 || x > 6) add(x, 3, 44, 3.4); if (Math.abs(x) > 3) add(x, 3.6, 8, 3.4); }
  add(7.5, 3, 44.5, 3.2);
  // 入口の通路の両脇
  for (let z = 44; z <= 66; z += 4) { add(-5.5, 3, z, 2.8); add(z < 50 ? 6.2 : 5.5, 3, z, 2.8); }
  // 下層：南の壁（石扉からの階段の降り口は空ける）、北の壁（出口への登りの入口は空ける）、東西の壁。上に2段目
  for (let x = -26; x <= 26; x += 5) {
    if (x < -3) add(x, LOW + 3, 6, 3.2);
    if (x < -3 || x > 18) add(x, LOW + 2, -36, 3.4);
    add(x, LOW + 9, -37, 3.8, 1.2);
  }
  add(16.5, LOW + 3, 6, 3.2);
  for (let z = -34; z <= 4; z += 5) {
    add(-27, LOW + 3, z, 3.4); add(27, LOW + 3, z, 3.4);
    add(-28, LOW + 9, z, 3.8, 1.2); add(28, LOW + 9, z, 3.8, 1.2);
  }
  // 出口への登り：道の両脇を岩で囲む（坂の途中から外の景色が横にのぞかないように）。
  // 曲がり角の内側や岸の上にかかる岩は、歩ける床に入るので置かない
  const side = [];
  alongPath((x, y, z, s) => side.push({ x, y, z, s, sy: 1.4 }), [[0, -32, LOW], [12, -38, -3], [12, -50, 1], [0, -58, 3]], 4.6, 2.8, 4, 1.8);
  // 中身（外接球の 0.79 倍）まで床に入る岩だけを除き、縁がかかる岩は下の clearRocks で床から離す（除きすぎると、横に隙間ができる）
  for (const rock of side) if (rockIntrusions([{ ...rock, s: rock.s * 0.79 }], CAVE_FLOORS, { state: OPEN, radius: 0.45 }).length === 0) rocks.push(rock);
  return clearRocks(rocks, CAVE_FLOORS, { state: OPEN });
}

export { UP, LOW };
