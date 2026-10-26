// タイトル画面「THE SILENT CROWN」の背景（2.5D）。
// 1枚の絵と奥行きの地図から、遠景（空・城・谷）と近景（人物・木・地面）を視差でずらして立体的に見せる。
// 絵の上で、枝葉とマントだけを小さく揺らし、空の雲・光の柱・谷の霧・地表の霧をコードで描き足す。
// 城の左手前の岩山に止まる鎖のドラゴンは、絵に描き込んである（動かさない）。その上に、光の中を漂う埃を重ねる。
import * as THREE from 'three';
import { mulberry32 } from '../world/random.js';
import { cameraAt, IMAGE_ASPECT, PARALLAX } from './framing.js';

// 動きを減らす設定のときに止めておく時刻
const STILL_TIME = 8;

const PICTURE_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const PICTURE_FRAGMENT = `
  uniform sampler2D art;
  uniform sampler2D depthMap;
  uniform sampler2D masks;
  uniform float screenAspect;
  uniform float imageAspect;
  uniform vec3 view;
  uniform vec2 look;
  uniform float time;
  uniform int octaves;
  uniform vec3 fogColor;
  varying vec2 vUv;

  const float PARALLAX = ${PARALLAX.toFixed(4)};
  // 光の柱：画面の上の外（城の左上）から、左下へ扇形に差す
  const vec2 LIGHT_SOURCE = vec2(0.62, -0.08);
  const float RAY_ANGLE = -0.38;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  // 大きさの違う模様を重ねる（霧や雲が同じ模様の繰り返しに見えないように）
  float fbm(vec2 p, int count) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      if (i >= count) break;
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(17.0, 9.0);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 size = screenAspect > imageAspect
      ? vec2(1.0, imageAspect / screenAspect)
      : vec2(screenAspect / imageAspect, 1.0);
    size /= view.z;
    // 絵の座標（上が 0）と、テクスチャの座標（下が 0）
    vec2 point = vec2(view.x + (vUv.x - 0.5) * size.x, view.y - (vUv.y - 0.5) * size.y);
    vec2 uv = vec2(point.x, 1.0 - point.y);

    // 枝葉：風の向きは同じで、場所ごとに間合いと強さを変える（幹・地面・建物は masks.r が 0 なので動かない）
    vec3 motion = texture2D(masks, uv).rgb;
    float phase = noise(uv * 7.0) * 6.2832;
    float gust = 0.65 + 0.35 * sin(time * 0.37);
    float sway = (sin(time * 1.25 + phase) * 0.65 + sin(time * 2.05 + phase * 1.9) * 0.35) * gust;
    uv += vec2(0.0016, 0.0006) * sway * motion.r;
    // マント：肩は動かさず、腰から裾へ向かって重い波がゆっくり下りていく
    uv.x += motion.g * 0.0010 * sin(time * 0.85 - point.y * 22.0);

    // 視差：奥行きを読み直しながら、ずらした位置と奥行きが合う所を探す
    vec2 base = uv;
    vec2 sampleUv = uv;
    for (int i = 0; i < 6; i++) {
      float d = texture2D(depthMap, sampleUv).r;
      sampleUv = mix(sampleUv, base + look * PARALLAX * (d - 0.5) / view.z, 0.65);
    }
    uv = clamp(sampleUv, vec2(0.0), vec2(1.0));

    vec3 color = texture2D(art, uv).rgb;
    float depth = texture2D(depthMap, uv).r;
    float sky = texture2D(masks, uv).b;
    vec2 p = vec2(uv.x, 1.0 - uv.y);

    // 雲：空の中だけで、明るさの模様がゆっくり流れる（城や枝の輪郭は動かさない）
    float cloud = mix(fbm(vec2(p.x * 3.0 - time * 0.010, p.y * 7.0), octaves),
                      fbm(vec2(p.x * 6.0 - time * 0.017 + 3.1, p.y * 11.0), octaves), 0.4);
    color *= mix(1.0, 0.86 + 0.32 * cloud, sky * 0.75);

    // 光の柱：光源は動かさず、筋の幅と明るさだけがごくゆっくり変わる。近くの木や人物の手前には差さない
    vec2 toPoint = p - LIGHT_SOURCE;
    float angle = atan(toPoint.x, toPoint.y);
    float shafts = noise(vec2(angle * 16.0, time * 0.05)) * noise(vec2(angle * 41.0 + 1.7, time * 0.031 + 4.0));
    float cone = smoothstep(0.55, 0.0, abs(angle - RAY_ANGLE));
    float reach = smoothstep(0.0, 0.12, length(toPoint)) * smoothstep(0.75, 0.15, p.y);
    float behind = 1.0 - smoothstep(0.22, 0.42, depth);
    color += vec3(0.95, 0.93, 0.86) * shafts * shafts * 2.0 * cone * reach * behind * (0.10 + 0.03 * sin(time * 0.21));

    // 谷の霧：遠い谷（奥行き 0.02〜0.3、絵の高さ 0.27〜0.64）を、2つの大きさの模様で流す。城や山は隠しきらない
    float valley = smoothstep(0.02, 0.08, depth) * (1.0 - smoothstep(0.22, 0.34, depth))
      * smoothstep(0.26, 0.36, p.y) * (1.0 - smoothstep(0.55, 0.66, p.y));
    float mist = fbm(vec2(p.x * 4.0 + time * 0.016, p.y * 14.0), octaves) * 0.6
      + fbm(vec2(p.x * 9.0 - time * 0.025, p.y * 20.0 + 2.0), octaves) * 0.4;
    color = mix(color, fogColor, valley * smoothstep(0.35, 0.85, mist) * 0.42);

    // 地表の霧：手前の地面の低い所を、反対向きにうすく流す
    float ground = smoothstep(0.66, 0.8, p.y) * smoothstep(0.3, 0.5, depth);
    float low = fbm(vec2(p.x * 3.0 - time * 0.012, p.y * 9.0), octaves);
    color = mix(color, fogColor * 0.85, ground * smoothstep(0.45, 0.9, low) * 0.16);

    // 周辺をわずかに暗く
    vec2 edge = vUv - 0.5;
    color *= 1.0 - 0.28 * smoothstep(0.16, 0.5, dot(edge, edge));

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function createPicture({ art, depth, masks, lite }) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      art: { value: art },
      depthMap: { value: depth },
      masks: { value: masks },
      screenAspect: { value: 2 },
      imageAspect: { value: IMAGE_ASPECT },
      view: { value: new THREE.Vector3(0.5, 0.5, 1) },
      look: { value: new THREE.Vector2() },
      time: { value: 0 },
      octaves: { value: lite ? 2 : 4 },
      fogColor: { value: new THREE.Color(0.5, 0.53, 0.57) },
    },
    vertexShader: PICTURE_VERTEX,
    fragmentShader: PICTURE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.name = 'silent-picture';
  mesh.frustumCulled = false;
  return mesh;
}

// 光を受けて漂う埃や花粉。少なく、ゆっくり。位置は時刻の周期的な関数なので、どれだけ流しても散らばったままにならない
function createDust(count) {
  const random = mulberry32(11);
  const motes = Array.from({ length: count }, () => ({
    x: -0.55 + random() * 1.2,
    y: -0.35 + random() * 1.15,
    ax: 0.02 + random() * 0.05,
    ay: 0.015 + random() * 0.04,
    wx: 0.05 + random() * 0.08,
    wy: 0.04 + random() * 0.07,
    phase: random() * Math.PI * 2,
    size: 1.2 + random() * 1.6,
    glow: 0.35 + random() * 0.5,
  }));
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(motes.map((mote) => mote.size));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('moteSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pointScale: { value: 1 } },
    vertexShader: `
      attribute float alpha;
      attribute float moteSize;
      uniform float pointScale;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, moteSize * pointScale);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.85), vAlpha * (1.0 - d * d));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'silent-dust';
  points.frustumCulled = false;
  points.renderOrder = 2;

  function update(time, screenAspect) {
    motes.forEach((mote, i) => {
      positions[i * 3] = (mote.x + mote.ax * Math.sin(time * mote.wx * 6.2832 + mote.phase)) * screenAspect;
      positions[i * 3 + 1] = mote.y + mote.ay * Math.sin(time * mote.wy * 6.2832 + mote.phase * 1.3);
      positions[i * 3 + 2] = 1;
      // 光の中を通るときだけ、ふっと明るく見える
      alphas[i] = mote.glow * (0.35 + 0.65 * Math.max(0, Math.sin(time * mote.wx * 3.1 + mote.phase * 2)));
    });
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('alpha').needsUpdate = true;
  }

  return { points, update, dispose: () => { geometry.dispose(); material.dispose(); } };
}

// lite：スマートフォンなど。霧の模様の重ね数と、埃の数を減らす
export function createSilentScene({ art, depth, masks, lite = false }) {
  const pictureScene = new THREE.Scene();
  const pictureCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const picture = createPicture({ art, depth, masks, lite });
  pictureScene.add(picture);

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(-2, 2, 1, -1, -20, 20);
  const dust = createDust(lite ? 36 : 70);
  overlayScene.add(dust.points);

  let reducedMotion = false;
  let screenAspect = 2;
  let pixelRatio = 1;
  let lastTime = 0;

  function apply(time, width, height) {
    screenAspect = width / height;
    const camera = reducedMotion ? cameraAt(0) : cameraAt(time);
    const { uniforms } = picture.material;
    uniforms.screenAspect.value = screenAspect;
    uniforms.view.value.set(camera.x, camera.y, camera.zoom);
    uniforms.look.value.set(camera.lookX, camera.lookY);
    uniforms.time.value = time;

    overlayCamera.left = -screenAspect;
    overlayCamera.right = screenAspect;
    overlayCamera.updateProjectionMatrix();

    dust.points.material.uniforms.pointScale.value = (height / 390) * pixelRatio;
    dust.update(time, screenAspect);
  }

  // time 秒の姿に合わせる。width・height は CSS ピクセル、ratio は canvas の実ピクセルの倍率
  function update(time, width, height, ratio = 1) {
    lastTime = Number.isFinite(time) && time >= 0 ? time : 0;
    pixelRatio = ratio;
    apply(reducedMotion ? STILL_TIME : lastTime, Math.max(1, width), Math.max(1, height));
  }

  // 背景の絵を描き、その上に埃を重ねる（UIは HTML なので、ここでは描かない）
  function render(renderer) {
    renderer.render(pictureScene, pictureCamera);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(overlayScene, overlayCamera);
    renderer.autoClear = autoClear;
  }

  function setReducedMotion(on) {
    reducedMotion = Boolean(on);
  }

  function dispose() {
    picture.geometry.dispose();
    picture.material.dispose();
    dust.dispose();
  }

  return {
    pictureScene, overlayScene, dust: dust.points,
    update, render, setReducedMotion, dispose,
    time: () => lastTime,
  };
}
