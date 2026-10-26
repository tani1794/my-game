// 古龍の飛ぶ道筋（純粋な関数）。城の奥の空を、大きな楕円を描いてゆっくり回る。
// 奥へ行くほど小さく、地平線に近く（低く）見え、城や山の向こうに隠れる。
export const FLIGHT_PERIOD = 46;
// 羽ばたきの1回の長さ（秒）。FLIGHT_PERIOD を割り切れる値にして、何周しても同じ動きにする
const FLAP_SECONDS = 2.3;
// 翼幅：画面幅に対する割合の基準。奥行きで ±17% 変わる（12〜18% に収まる）
const WINGSPAN = 0.152;
const DEPTH_SCALE = 0.17;

const TAU = Math.PI * 2;

// time 秒の位置と向き
// -> { x, y（絵の座標）, far（-1 手前〜1 奥）, scale（大きさの倍率）, heading（進む向き、ラジアン）, bank（傾き） }
export function flightAt(time) {
  const theta = (time / FLIGHT_PERIOD) * TAU;
  const far = Math.sin(theta);
  // 横の進み方：手前を通るときは速く、奥では遅く見える（楕円を斜め下から見ている）
  const dx = -Math.sin(theta);
  const dz = 0.6 * Math.cos(theta);
  return {
    // 城のまわりの空（絵の左から 51〜91%）。主人公の頭の近くへは来ない
    x: 0.71 + 0.2 * Math.cos(theta),
    // iPhone の横長の画面でも上が切れない高さ（絵の上から 18〜31%）。奥を通るときは城の塔の後ろへ下がる
    y: 0.24 + 0.05 * far + 0.015 * Math.sin(theta * 2),
    far,
    scale: 1 - DEPTH_SCALE * far,
    heading: Math.atan2(dz, dx),
    // 旋回の内側へ傾く。手前を通るときに少し深く
    bank: 0.55 - 0.15 * far,
  };
}

export function wingspanFraction(flight) {
  return WINGSPAN * flight.scale;
}

// 0 から 1 へなめらかに上がって下がる山（中心 center、幅 width、どちらも周期に対する割合）
function bump(phase, center, width) {
  let distance = Math.abs(phase - center);
  distance = Math.min(distance, 1 - distance);
  if (distance >= width / 2) return 0;
  return Math.cos((distance / (width / 2)) * (Math.PI / 2)) ** 2;
}

// 羽ばたき：1周のうち2回だけ、数回ゆっくり羽ばたく。ほかは滑空
// -> { strength（0〜1、羽ばたきの強さ）, angle（-1〜1、今の翼の振り） }
export function flapAt(time) {
  const phase = (((time / FLIGHT_PERIOD) % 1) + 1) % 1;
  const strength = bump(phase, 0.2, 0.16) + bump(phase, 0.66, 0.16);
  return { strength, angle: strength * Math.sin((time / FLAP_SECONDS) * TAU) };
}
