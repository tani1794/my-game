// 晶冠峡谷の岩（12面体）の位置・大きさ・向き（three.js を使わない）。build.js がこの順に置く。
// 崖は位置にも乱数を使うので、build.js と同じ乱数を同じ順で使う（位置 → 向き）。
// 岩には当たり判定がないので、歩ける床（layout.js）の上には置かない。並べたあと clearRocks で、床にかかる岩を床から離す
// （tests/crystalRocks.test.js で確かめる）。
import { CRYSTAL_HEIGHTS, CRYSTAL_FLOORS } from './layout.js';
import { clearRocks } from '../rocks.js';

const { MINE } = CRYSTAL_HEIGHTS;

// 両側の崖（谷の壁）、入口の後ろ、東の岩棚のまわり
export function valleyRocks(random) {
  const rocks = [];
  const add = (x, y, z, s, sy = 1.6) => rocks.push({ x, y, z, s, sy, rot: [random() * 3, random() * 3, random() * 3] });
  for (let z = -60; z <= 225; z += 11) {
    const westX = z > 140 ? -34 : z > 70 ? -42 : -46;
    // 東は旧坑道（x 42〜76）の外側まで崖を下げる
    const eastX = z > 140 && z < 194 ? 82 : z > 140 ? 32 : z > 70 ? 30 : 46;
    // 東の岩棚と旧坑道の出口（z 144〜154）の手前の崖は、少し南へずらして小さめに（道へはみ出さない）
    const nearLedge = z > 125 && z <= 140;
    add(westX - 6 - random() * 6, 2 + random() * 6, z + random() * 4, 9 + random() * 5);
    add(eastX + 6 + random() * 6, 2 + random() * 6, z + random() * 4 - (nearLedge ? 6 : 0), Math.min(nearLedge ? 10 : Infinity, 9 + random() * 5));
  }
  for (let x = -30; x <= 30; x += 10) add(x, 4, 224 + random() * 4, 9);
  for (const [x, z] of [[30, 178], [27.2, 156], [32.5, 155.8], [46, 140], [36, 140]]) add(x, 0, z, 5, 1.4);
  return clearRocks(rocks, CRYSTAL_FLOORS);
}

// 旧坑道の岩の壁（向きは build.js が乱数で回す）
export function mineRocks() {
  const rocks = [];
  const add = (x, z, s = 2.6) => rocks.push({ x, y: MINE + 1.6, z, s, sy: 1.3 });
  for (let x = 54; x <= 70; x += 3.5) add(x, 188);
  for (let z = 172; z <= 186; z += 3.5) { add(72, z); if (z > 179) add(52, z); }
  for (const x of [54, 57.5, 61, 68.5, 72]) add(x, 170.5);
  for (let z = 161; z <= 169; z += 3) { add(62.2, z, 1.8); add(69.2, z, 1.8); }
  for (const x of [58, 61.5, 70, 73.5, 77]) add(x, 162);
  for (let z = 146; z <= 160; z += 3.5) add(78.2, z);
  for (let x = 58; x <= 76; x += 3.5) add(x, 144);
  for (const z of [154, 157.5, 161]) add(56.2, z);
  for (const [x, z] of [[49, 152], [52, 152.4], [49, 144.6], [53, 145.2], [46, 172], [48, 180], [52, 172.2], [45, 179]]) add(x, z, 2.2);
  return clearRocks(rocks, CRYSTAL_FLOORS);
}

// 旧坑道の低い天井（中心 x, z、幅、奥行き）。高さは MINE + 4.6。
// 地上へ上がる坂（坑道への下り・出口の上り）の上には張らない：坂の上の方では、天井が体を横切ってしまう（下の床から 2.4m 以上あける）
export const MINE_CEILINGS = [[62, 179, 20, 18], [65.5, 165.5, 9, 13], [67, 153, 22, 18], [56, 148, 8, 8], [51.75, 175, 6.5, 9]];

// 天井の上に載せる岩（丘に見せる）。床にかかれば、床から離す
export function mineCeilingRocks() {
  const rocks = MINE_CEILINGS.map(([x, z, w, d]) => ({ x, y: MINE + 9, z, s: Math.max(w, d) * 0.45, sy: 0.6 }));
  return clearRocks(rocks, CRYSTAL_FLOORS);
}
