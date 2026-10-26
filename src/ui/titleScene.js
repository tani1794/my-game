import * as THREE from 'three';
import { mulberry32 } from '../world/random.js';

export const SHOT_SECONDS = 5;
export const FADE_SECONDS = 0.8;

export const TITLE_SHOTS = [
  {
    name: 'wide',
    from: { x: 0.50, y: 0.45, zoom: 1.00, lookX: -1.0, lookY: 0.0 },
    to: { x: 0.52, y: 0.45, zoom: 1.06, lookX: 1.0, lookY: 0.2 },
  },
  {
    name: 'beast',
    from: { x: 0.74, y: 0.45, zoom: 1.80, lookX: 0.6, lookY: -0.3 },
    to: { x: 0.72, y: 0.46, zoom: 2.10, lookX: -0.4, lookY: 0.2 },
  },
  {
    name: 'hero',
    from: { x: 0.30, y: 0.55, zoom: 1.70, lookX: -0.5, lookY: -0.6 },
    to: { x: 0.30, y: 0.36, zoom: 1.85, lookX: 0.3, lookY: 0.5 },
  },
  {
    name: 'final',
    from: { x: 0.50, y: 0.42, zoom: 1.15, lookX: 0.5, lookY: 0.3 },
    to: { x: 0.50, y: 0.45, zoom: 1.00, lookX: -0.3, lookY: 0.0 },
  },
];

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

export function shotAt(time, shots = TITLE_SHOTS) {
  const sequence = Array.isArray(shots) && shots.length > 0
    ? shots
    : TITLE_SHOTS;
  const safeTime = Number.isFinite(time) && time >= 0 ? time : 0;
  const totalDuration = SHOT_SECONDS * sequence.length;
  const cycleTime = safeTime % totalDuration;
  const index = Math.floor(cycleTime / SHOT_SECONDS);
  const shotTime = cycleTime - index * SHOT_SECONDS;
  const shot = sequence[index];

  const progress = easeInOut(shotTime / SHOT_SECONDS);
  const a = interpolateCamera(shot.from, shot.to, progress);

  const fadeStart = SHOT_SECONDS - FADE_SECONDS;
  if (shotTime < fadeStart) {
    return { a, b: a, mix: 0 };
  }

  const nextShot = sequence[(index + 1) % sequence.length];
  const fadeProgress = easeInOut((shotTime - fadeStart) / FADE_SECONDS);

  return {
    a,
    b: { ...nextShot.from },
    mix: fadeProgress,
  };
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

function createPictureMaterial(image, depth) {
  return new THREE.ShaderMaterial({
    uniforms: {
      imageTexture: { value: image },
      depthTexture: { value: depth },
      imageAspect: { value: getTextureAspect(image) },
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
      uniform sampler2D imageTexture;
      uniform sampler2D depthTexture;
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

      vec2 parallaxUv(vec2 baseUv, vec2 look, float zoom) {
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
      vec4 sampleCamera(vec3 view, vec2 look) {
        vec2 baseUv = framedUv(vUv, view);
        vec2 sampleUv = parallaxUv(baseUv, look, view.z);
        vec3 color = texture2D(imageTexture, sampleUv).rgb;
        float crystal = texture2D(depthTexture, sampleUv).g;

        return vec4(color, crystal);
      }

      void main() {
        vec4 sampleA = sampleCamera(viewA, lookA);
        vec4 sampleB = sampleCamera(viewB, lookB);
        vec4 picture = mix(sampleA, sampleB, cameraMix);

        float crystalStrength =
          0.30 + 0.15 * sin(time * 6.28318530718 / 2.5);
        vec3 color =
          picture.rgb + crystalColor * picture.a * crystalStrength;

        vec2 vignetteUv = vUv - 0.5;
        float edgeDistance = dot(vignetteUv, vignetteUv);
        float vignette =
          1.0 - 0.32 * smoothstep(0.18, 0.50, edgeDistance);
        color *= vignette;

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

export function createTitleScene({ image, depth }) {
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
  const pictureMaterial = createPictureMaterial(image, depth);
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

  function applyCameraState(state) {
    const { uniforms } = pictureMaterial;

    uniforms.viewA.value.set(
      state.a.x,
      state.a.y,
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
    applyCameraState({
      a: fixed,
      b: fixed,
      mix: 0,
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
    uniforms.imageAspect.value = getTextureAspect(image);
    embers.material.uniforms.pointScale.value =
      (safeHeight / 390) * (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1);

    if (reducedMotion) {
      applyReducedMotionCamera();
      return;
    }

    applyCameraState(shotAt(safeTime));
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
