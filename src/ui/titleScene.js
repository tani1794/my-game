import * as THREE from 'three';
import { mulberry32 } from '../world/random.js';

// スライドに使う4枚の絵（calm・glow・surge は同じ構図で、力がたまっていく順。clash は衝突の瞬間）
export const TITLE_PICTURES = ['calm', 'glow', 'surge', 'clash'];

const CALM_START = { x: 0.50, y: 0.45, zoom: 1.04, lookX: -1.0, lookY: 0.0 };
const CALM_END = { x: 0.56, y: 0.44, zoom: 1.18, lookX: 0.2, lookY: 0.1 };
const GLOW_END = { x: 0.64, y: 0.44, zoom: 1.42, lookX: 0.8, lookY: 0.1 };
const SURGE_END = { x: 0.70, y: 0.46, zoom: 1.70, lookX: 1.0, lookY: -0.2 };

// 場面。x, y は絵の中の「画面の中心に来る点」（0〜1、x は左から、y は上から）
// zoom：1 = 絵が画面をちょうど覆う大きさ。lookX, lookY：カメラの横・縦のずれ（-1〜1）
// seconds：場面の長さ。fade：場面の最後の、次の場面へ移る時間
// transition：'fade' は溶けて変わる、'flash' は閃光のいちばん明るい所で切り替わり、次の場面の始めに一度揺れる
// calm → glow → surge は、前の場面の to を次の from にして、同じカメラのまま絵だけが変わって見えるようにする
export const TITLE_SHOTS = [
  { picture: 'calm', seconds: 4, fade: 1.2, transition: 'fade', from: CALM_START, to: CALM_END },
  { picture: 'glow', seconds: 4, fade: 1.0, transition: 'fade', from: CALM_END, to: GLOW_END },
  { picture: 'surge', seconds: 3, fade: 0.5, transition: 'flash', from: GLOW_END, to: SURGE_END },
  {
    picture: 'clash', seconds: 4.5, fade: 1.0, transition: 'fade',
    from: { x: 0.50, y: 0.55, zoom: 1.06, lookX: -0.6, lookY: 0.0 },
    to: { x: 0.52, y: 0.50, zoom: 1.30, lookX: 0.6, lookY: 0.2 },
  },
];

// 閃光のあと、次の場面の始めに揺れている時間
const SHAKE_SECONDS = 0.4;

const IMAGE_ASPECT = 1672 / 941;
const EMBER_COUNT = 70;
const TAU = Math.PI * 2;

function easeInOut(value) {
  const p = THREE.MathUtils.clamp(value, 0, 1);
  return p * p * (3 - 2 * p);
}

function interpolateCamera(from, to, amount) {
  return {
    x: THREE.MathUtils.lerp(from.x, to.x, amount),
    y: THREE.MathUtils.lerp(from.y, to.y, amount),
    zoom: THREE.MathUtils.lerp(from.zoom, to.zoom, amount),
    lookX: THREE.MathUtils.lerp(from.lookX, to.lookX, amount),
    lookY: THREE.MathUtils.lerp(from.lookY, to.lookY, amount),
  };
}

// time 秒のときのカメラと絵。純粋な関数
// -> { a, b: Camera, mix, pictureA, pictureB, flash（0〜1）, shake（0〜1） }
export function shotAt(time, shots = TITLE_SHOTS) {
  const sequence = Array.isArray(shots) && shots.length > 0
    ? shots
    : TITLE_SHOTS;
  const safeTime = Number.isFinite(time) && time >= 0 ? time : 0;
  const totalDuration = sequence.reduce((sum, shot) => sum + shot.seconds, 0);
  let shotTime = safeTime % totalDuration;
  let index = 0;
  while (shotTime >= sequence[index].seconds) {
    shotTime -= sequence[index].seconds;
    index += 1;
  }
  const shot = sequence[index];
  const previous = sequence[(index - 1 + sequence.length) % sequence.length];
  const nextShot = sequence[(index + 1) % sequence.length];

  const a = interpolateCamera(shot.from, shot.to, easeInOut(shotTime / shot.seconds));
  const shake = previous.transition === 'flash' && shotTime < SHAKE_SECONDS
    ? 1 - shotTime / SHAKE_SECONDS
    : 0;
  const state = { a, b: a, mix: 0, pictureA: shot.picture, pictureB: shot.picture, flash: 0, shake };

  const fadeStart = shot.seconds - shot.fade;
  if (shotTime < fadeStart) return state;

  const progress = (shotTime - fadeStart) / shot.fade;
  state.b = { ...nextShot.from };
  state.pictureB = nextShot.picture;
  if (shot.transition === 'flash') {
    state.mix = progress >= 0.5 ? 1 : 0;
    state.flash = easeInOut(1 - Math.abs(progress * 2 - 1));
  } else {
    state.mix = easeInOut(progress);
  }
  return state;
}

function getTextureAspect(texture) {
  const source = texture?.image;
  const width = source?.naturalWidth || source?.videoWidth || source?.width;
  const height = source?.naturalHeight || source?.videoHeight || source?.height;

  if (
    Number.isFinite(width)
    && Number.isFinite(height)
    && width > 0
    && height > 0
  ) {
    return width / height;
  }

  return IMAGE_ASPECT;
}

function createPictureMaterial(first) {
  return new THREE.ShaderMaterial({
    uniforms: {
      imageA: { value: first.image },
      depthA: { value: first.depth },
      imageB: { value: first.image },
      depthB: { value: first.depth },
      flash: { value: 0 },
      imageAspect: { value: getTextureAspect(first.image) },
      screenAspect: { value: 844 / 390 },
      viewA: { value: new THREE.Vector3() },
      lookA: { value: new THREE.Vector2() },
      viewB: { value: new THREE.Vector3() },
      lookB: { value: new THREE.Vector2() },
      cameraMix: { value: 0 },
      time: { value: 0 },
      crystalColor: { value: new THREE.Color('#5ef2ff') },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix
          * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D imageA;
      uniform sampler2D depthA;
      uniform sampler2D imageB;
      uniform sampler2D depthB;
      uniform float flash;
      uniform float imageAspect;
      uniform float screenAspect;
      uniform vec3 viewA;
      uniform vec2 lookA;
      uniform vec3 viewB;
      uniform vec2 lookB;
      uniform float cameraMix;
      uniform float time;
      uniform vec3 crystalColor;

      varying vec2 vUv;

      const float PARALLAX_STRENGTH = 0.03;

      vec2 framedUv(vec2 screenUv, vec3 view) {
        vec2 visibleSize;

        if (screenAspect > imageAspect) {
          visibleSize = vec2(1.0, imageAspect / screenAspect);
        } else {
          visibleSize = vec2(screenAspect / imageAspect, 1.0);
        }

        visibleSize /= max(view.z, 0.0001);

        // view.y は画像の上端から測るので、テクスチャ座標に変換する。
        vec2 center = vec2(view.x, 1.0 - view.y);
        return clamp(
          center + (screenUv - 0.5) * visibleSize,
          vec2(0.0),
          vec2(1.0)
        );
      }

      vec2 parallaxUv(sampler2D depthTexture, vec2 baseUv, vec2 look, float zoom) {
        vec2 sampleUv = baseUv;

        // 奥行きを読み直しながら、ずらした位置と奥行きが合う場所を探す。
        for (int i = 0; i < 8; i++) {
          float depth = texture2D(depthTexture, sampleUv).r;
          vec2 targetUv = baseUv
            + look * PARALLAX_STRENGTH * (depth - 0.5)
            / max(zoom, 0.0001);

          sampleUv = mix(
            sampleUv,
            clamp(targetUv, vec2(0.0), vec2(1.0)),
            0.65
          );
        }

        return clamp(sampleUv, vec2(0.0), vec2(1.0));
      }

      // rgb は絵の色、a は同じ場所の結晶マスク。
      vec4 sampleCamera(sampler2D imageTexture, sampler2D depthTexture, vec3 view, vec2 look) {
        vec2 baseUv = framedUv(vUv, view);
        vec2 sampleUv = parallaxUv(depthTexture, baseUv, look, view.z);
        vec3 color = texture2D(imageTexture, sampleUv).rgb;
        float crystal = texture2D(depthTexture, sampleUv).g;

        return vec4(color, crystal);
      }

      void main() {
        // 切り替えの途中だけ2つ目のカメラを読む（ふだんは1回分で済ませる）
        vec4 picture;
        if (cameraMix >= 1.0) {
          picture = sampleCamera(imageB, depthB, viewB, lookB);
        } else {
          picture = sampleCamera(imageA, depthA, viewA, lookA);
          if (cameraMix > 0.0) {
            picture = mix(picture, sampleCamera(imageB, depthB, viewB, lookB), cameraMix);
          }
        }

        float crystalStrength =
          0.16 + 0.10 * sin(time * 6.28318530718 / 2.5);
        vec3 color =
          picture.rgb + crystalColor * picture.a * crystalStrength;

        vec2 vignetteUv = vUv - 0.5;
        float edgeDistance = dot(vignetteUv, vignetteUv);
        float vignette =
          1.0 - 0.32 * smoothstep(0.18, 0.50, edgeDistance);
        color *= vignette;
        // 衝突の閃光：青白く明るくする（形が読める程度にとどめる）
        color = mix(color, vec3(0.92, 0.98, 1.0) * 1.15, flash * 0.8);

        gl_FragColor = vec4(color, 1.0);

        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function createEmbers() {
  const random = mulberry32(7);
  const positions = new Float32Array(EMBER_COUNT * 3);
  const colors = new Float32Array(EMBER_COUNT * 3);
  const sizes = new Float32Array(EMBER_COUNT);
  const alphas = new Float32Array(EMBER_COUNT);
  const particles = [];

  const darkOrange = new THREE.Color('#ff9a3c');
  const paleOrange = new THREE.Color('#ffd27a');
  const color = new THREE.Color();

  for (let i = 0; i < EMBER_COUNT; i++) {
    particles.push({
      x: -1.05 + random() * 2.1,
      start: random(),
      speed: 0.025 + random() * 0.035,
      phase: random() * TAU,
      sway: 0.01 + random() * 0.035,
      swaySpeed: 0.45 + random() * 0.65,
      alpha: 0.45 + random() * 0.5,
    });

    sizes[i] = 3 + random() * 3;

    color.copy(darkOrange).lerp(paleOrange, random());
    color.toArray(colors, i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  alphaAttribute.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(colors, 3),
  );
  geometry.setAttribute(
    'emberSize',
    new THREE.BufferAttribute(sizes, 1),
  );
  geometry.setAttribute('emberAlpha', alphaAttribute);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      pointScale: { value: 1 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float emberSize;
      attribute float emberAlpha;

      uniform float pointScale;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        vAlpha = emberAlpha;

        gl_Position = projectionMatrix * modelViewMatrix
          * vec4(position, 1.0);
        gl_PointSize = max(1.0, emberSize * pointScale);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float distanceFromCenter =
          length(gl_PointCoord - vec2(0.5)) * 2.0;

        if (distanceFromCenter > 1.0) {
          discard;
        }

        float softEdge =
          1.0 - smoothstep(0.30, 1.0, distanceFromCenter);
        float core = pow(
          max(1.0 - distanceFromCenter, 0.0),
          1.8
        );
        float brightness = 0.35 + core * 0.65;

        gl_FragColor = vec4(
          vColor * brightness,
          vAlpha * softEdge
        );

        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  function update(time) {
    for (let i = 0; i < EMBER_COUNT; i++) {
      const particle = particles[i];
      const progress =
        (particle.start + time * particle.speed) % 1;
      const offset = i * 3;

      positions[offset] =
        particle.x
        + Math.sin(
          time * particle.swaySpeed + particle.phase,
        ) * particle.sway;
      positions[offset + 1] = -1.15 + progress * 2.3;
      positions[offset + 2] = 0.6;

      const fadeIn = Math.min(1, progress / 0.08);
      alphas[i] =
        particle.alpha * fadeIn * (1 - progress);
    }

    positionAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
  }

  update(0);

  const points = new THREE.Points(geometry, material);
  points.name = 'title-embers';
  points.renderOrder = 1;
  points.frustumCulled = false;

  return {
    points,
    geometry,
    material,
    update,
  };
}

// pictures：{ calm: { image, depth }, glow: …, surge: …, clash: … }（TITLE_PICTURES の名前ごと）
export function createTitleScene({ pictures }) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -1,
    1,
    1,
    -1,
    0,
    1,
  );
  camera.position.z = 1;

  const pictureGeometry = new THREE.PlaneGeometry(2, 2);
  const pictureMaterial = createPictureMaterial(pictures[TITLE_SHOTS[0].picture]);
  const picture = new THREE.Mesh(
    pictureGeometry,
    pictureMaterial,
  );

  picture.name = 'title-picture';
  picture.position.z = 0.5;
  picture.renderOrder = 0;
  picture.frustumCulled = false;
  scene.add(picture);

  const embers = createEmbers();
  scene.add(embers.points);

  let reducedMotion = false;
  let disposed = false;

  // 閃光のあとの揺れ：カメラの中心を細かくずらす（time は揺れの向きを変えるためだけに使う）
  function applyCameraState(state, time = 0) {
    const { uniforms } = pictureMaterial;
    const jitter = state.shake * 0.006;

    uniforms.imageA.value = pictures[state.pictureA].image;
    uniforms.depthA.value = pictures[state.pictureA].depth;
    uniforms.imageB.value = pictures[state.pictureB].image;
    uniforms.depthB.value = pictures[state.pictureB].depth;
    uniforms.flash.value = state.flash;
    uniforms.viewA.value.set(
      state.a.x + Math.sin(time * 61) * jitter,
      state.a.y + Math.cos(time * 53) * jitter,
      state.a.zoom,
    );
    uniforms.lookA.value.set(
      state.a.lookX,
      state.a.lookY,
    );
    uniforms.viewB.value.set(
      state.b.x,
      state.b.y,
      state.b.zoom,
    );
    uniforms.lookB.value.set(
      state.b.lookX,
      state.b.lookY,
    );
    uniforms.cameraMix.value = state.mix;
  }

  function applyReducedMotionCamera() {
    const fixed = TITLE_SHOTS[0].from;
    const picture = TITLE_SHOTS[0].picture;
    applyCameraState({
      a: fixed,
      b: fixed,
      mix: 0,
      pictureA: picture,
      pictureB: picture,
      flash: 0,
      shake: 0,
    });
  }

  applyReducedMotionCamera();

  // pixelRatio：canvas の1 CSSピクセルあたりの実ピクセル数（火の粉の大きさを画面に合わせる）
  function update(time, width, height, pixelRatio = 1) {
    const safeTime =
      Number.isFinite(time) && time >= 0 ? time : 0;
    const safeWidth =
      Number.isFinite(width) && width > 0 ? width : 844;
    const safeHeight =
      Number.isFinite(height) && height > 0 ? height : 390;
    const { uniforms } = pictureMaterial;

    uniforms.screenAspect.value = safeWidth / safeHeight;
    uniforms.imageAspect.value = getTextureAspect(pictures[TITLE_SHOTS[0].picture].image);
    embers.material.uniforms.pointScale.value =
      (safeHeight / 390) * (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1);

    if (reducedMotion) {
      applyReducedMotionCamera();
      return;
    }

    applyCameraState(shotAt(safeTime), safeTime);
    uniforms.time.value = safeTime;
    embers.update(safeTime);
  }

  function setReducedMotion(on) {
    reducedMotion = Boolean(on);

    if (reducedMotion) {
      applyReducedMotionCamera();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    pictureGeometry.dispose();
    pictureMaterial.dispose();
    embers.geometry.dispose();
    embers.material.dispose();
  }

  return {
    scene,
    camera,
    update,
    setReducedMotion,
    dispose,
  };
}
