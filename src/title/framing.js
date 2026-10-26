// タイトルの絵の置き方と、ゆっくり呼吸するようなカメラ（どれも純粋な関数）
// 絵の座標は x が左から、y が上から 0〜1。画面の座標は中心が 0、右と上が +1
export const IMAGE_ASPECT = 1672 / 941;
// 視差で絵の端が見えないよう、少し寄っておく
export const BASE_ZOOM = 1.06;
// カメラの揺れの周期（秒）。周期の違う波を重ね、同じ動きの繰り返しに見せない
export const CAMERA_PERIODS = [37, 53, 61];
// 視差の強さ（奥行き 0 と 1 のずれの差。絵の幅に対する割合）
export const PARALLAX = 0.016;

// 画面に見えている絵の範囲（絵の幅・高さに対する割合）。画面を覆う大きさで、zoom 倍に寄る
export function visibleSize(screenAspect, imageAspect, zoom) {
  const size = screenAspect > imageAspect
    ? { x: 1, y: imageAspect / screenAspect }
    : { x: screenAspect / imageAspect, y: 1 };
  return { x: size.x / zoom, y: size.y / zoom };
}

// 絵の中の点 → 画面の座標。view = { x, y, zoom }（画面の中心に来る絵の点と、寄り具合）
export function imageToScreen(point, view, screenAspect, imageAspect) {
  const size = visibleSize(screenAspect, imageAspect, view.zoom);
  return {
    x: ((point.x - view.x) / size.x) * 2,
    y: ((view.y - point.y) / size.y) * 2,
  };
}

const wave = (time, period) => Math.sin((time / period) * Math.PI * 2);

// time 秒のカメラ。中心と寄り具合はごく小さく、視差のための向き（lookX, lookY）は -1〜1
export function cameraAt(time) {
  const [a, b, c] = CAMERA_PERIODS;
  return {
    x: 0.5 + 0.006 * wave(time, a),
    y: 0.5 + 0.004 * wave(time, b),
    zoom: BASE_ZOOM + 0.01 * wave(time, c),
    lookX: wave(time, a),
    lookY: 0.4 * wave(time, b),
  };
}
