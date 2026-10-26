// タイトルの空を飛ぶ古龍（three.js の立体）。
// 胴・首・尾は太さのある筒、頭と角は立体、翼は骨（腕と4本の指）を筒で作り、骨の間に表と裏の2層の膜を張る。
// 形は毎フレーム計算し直す（頂点数が少ないので軽い）。光の当たり方と遠くの霞は自前のシェーダーで付け、
// 城や山の向こうに隠れるよう、空の場所（masks の B）だけに描く。
import * as THREE from 'three';
import { flapAt, flightAt, wingspanFraction } from './dragonFlight.js';
import { imageToScreen } from './framing.js';

const TAU = Math.PI * 2;
const RING_SIDES = 8;

// 背骨：前（+x）が頭。x と太さ。首と尾はここから曲げる
const SPINE = [
  [-3.4, 0.02], [-3.0, 0.04], [-2.6, 0.06], [-2.2, 0.08], [-1.8, 0.1], [-1.4, 0.13], [-1.0, 0.17],
  [-0.6, 0.22], [-0.25, 0.27], [0.1, 0.3], [0.45, 0.29], [0.75, 0.22], [1.0, 0.16], [1.25, 0.13],
  [1.5, 0.12], [1.7, 0.12],
];
const NECK_START = 0.6;
const TAIL_START = -0.5;

// 翼の付け根（胸）と、膜の後ろの付け根（腰）
const SHOULDER = new THREE.Vector3(0.3, 0.16, 0.22);
const HIP = new THREE.Vector3(-1.0, 0.05, 0.15);
// 骨の長さと、滑空しているときの向き（右の翼。左は z を逆に）
const UPPER_ARM = { length: 1.0, dir: new THREE.Vector3(0.18, 0, 1) };
const FOREARM = { length: 1.15, dir: new THREE.Vector3(0.5, 0, 0.85) };
const FINGERS = [
  { length: 1.4, dir: new THREE.Vector3(0.05, 0, 1) },
  { length: 1.5, dir: new THREE.Vector3(-0.45, 0, 0.9) },
  { length: 1.5, dir: new THREE.Vector3(-0.85, 0, 0.5) },
  { length: 1.4, dir: new THREE.Vector3(-1, 0, 0.1) },
];
const DIHEDRAL = 0.12;
const MEMBRANE_THICKNESS = 0.012;

const COLORS = {
  body: new THREE.Color(0.06, 0.06, 0.07),
  membrane: new THREE.Color(0.07, 0.065, 0.07),
  bone: new THREE.Color(0.16, 0.15, 0.15),
  horn: new THREE.Color(0.36, 0.34, 0.31),
};

function rotateX(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new THREE.Vector3(vector.x, vector.y * cos - vector.z * sin, vector.y * sin + vector.z * cos);
}

// 翼の関節の位置（体の座標）。side は右 1・左 -1。shoulder・elbow・wrist は -1〜1 の振り
function wingJoints(side, shoulder, elbow, wrist) {
  const mirror = (v) => new THREE.Vector3(v.x, v.y, v.z * side);
  const raise = (v, angle) => rotateX(v, -side * angle);
  const a1 = DIHEDRAL + 0.6 * shoulder;
  const a2 = a1 + 0.35 * elbow;
  const a3 = a2 + 0.25 * wrist;
  const s = mirror(SHOULDER);
  const e = s.clone().add(raise(mirror(UPPER_ARM.dir).normalize().multiplyScalar(UPPER_ARM.length), a1));
  const w = e.clone().add(raise(mirror(FOREARM.dir).normalize().multiplyScalar(FOREARM.length), a2));
  const tips = FINGERS.map((finger) => w.clone().add(raise(mirror(finger.dir).normalize().multiplyScalar(finger.length), a3)));
  return { shoulder: s, elbow: e, wrist: w, tips, hip: mirror(HIP) };
}

// 翼幅（体の座標の単位）：滑空の姿勢での左右の翼端の幅
export const WINGSPAN_UNITS = (() => {
  const tips = wingJoints(1, 0, 0, 0).tips;
  return 2 * Math.max(...tips.map((tip) => tip.z));
})();

function turnRate(time) {
  const a = flightAt(time - 0.25).heading;
  const b = flightAt(time + 0.25).heading;
  let delta = b - a;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta / 0.5;
}

// time 秒の姿勢（純粋な関数）。翼は付け根→肘→翼端の順に少し遅れて動く。首は旋回の先へ、尾は遅れて逆へ曲がる
export function dragonPose(time) {
  return {
    shoulder: flapAt(time).angle,
    elbow: flapAt(time - 0.18).angle,
    wrist: flapAt(time - 0.34).angle,
    neckBend: 2.2 * turnRate(time + 0.4),
    tailBend: -2.6 * turnRate(time - 0.8),
    tailWave: Math.sin((time / 4.6) * TAU),
  };
}

// 画面での置き場所と大きさ（正射影のカメラ：横は ±画面の縦横比、縦は ±1）
export function placeDragon(flight, view, screenAspect, imageAspect) {
  const screen = imageToScreen(flight, view, screenAspect, imageAspect);
  return {
    x: screen.x * screenAspect,
    y: screen.y,
    scale: (wingspanFraction(flight) * 2 * screenAspect) / WINGSPAN_UNITS,
  };
}

function createMaterial(masks) {
  return new THREE.ShaderMaterial({
    uniforms: {
      masks: { value: masks },
      resolution: { value: new THREE.Vector2(1, 1) },
      view: { value: new THREE.Vector3(0.5, 0.5, 1) },
      screenAspect: { value: 2 },
      imageAspect: { value: 1672 / 941 },
      lightDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
      hazeColor: { value: new THREE.Color(0.13, 0.14, 0.16) },
      haze: { value: 0.3 },
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vNormal;
      varying vec3 vColor;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D masks;
      uniform vec2 resolution;
      uniform vec3 view;
      uniform float screenAspect;
      uniform float imageAspect;
      uniform vec3 lightDir;
      uniform vec3 hazeColor;
      uniform float haze;
      varying vec3 vNormal;
      varying vec3 vColor;

      void main() {
        // 画面のこの場所に写っている絵の点を求め、空でなければ（城・山・木の向こうなら）描かない
        vec2 screenUv = gl_FragCoord.xy / resolution;
        vec2 size = screenAspect > imageAspect
          ? vec2(1.0, imageAspect / screenAspect)
          : vec2(screenAspect / imageAspect, 1.0);
        size /= view.z;
        vec2 imagePoint = vec2(view.x + (screenUv.x - 0.5) * size.x, view.y - (screenUv.y - 0.5) * size.y);
        float sky = texture2D(masks, vec2(imagePoint.x, 1.0 - imagePoint.y)).b;
        if (sky < 0.02) discard;

        vec3 normal = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        float light = 0.35 + 0.8 * max(dot(normal, lightDir), 0.0);
        vec3 color = mix(vColor * light, hazeColor, haze);
        gl_FragColor = vec4(color, sky);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });
}

function colorAttribute(count, color) {
  const array = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) color.toArray(array, i * 3);
  return new THREE.BufferAttribute(array, 3);
}

function paint(geometry, color) {
  geometry.setAttribute('color', colorAttribute(geometry.getAttribute('position').count, color));
  return geometry;
}

// 背骨に沿った筒（輪を並べる）。頂点の位置は毎フレーム updateBody で計算する
function createBodyGeometry() {
  const rings = SPINE.length;
  const positions = new Float32Array(rings * RING_SIDES * 3);
  const indices = [];
  for (let r = 0; r < rings - 1; r += 1) {
    for (let s = 0; s < RING_SIDES; s += 1) {
      const a = r * RING_SIDES + s;
      const b = r * RING_SIDES + ((s + 1) % RING_SIDES);
      const c = (r + 1) * RING_SIDES + s;
      const d = (r + 1) * RING_SIDES + ((s + 1) % RING_SIDES);
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  return paint(geometry, COLORS.body);
}

// 背骨の各点（体の座標）。首と尾を曲げ、尾は少し波打たせる
function spinePoints(pose) {
  return SPINE.map(([x]) => {
    let z = 0;
    let y = 0;
    if (x > NECK_START) {
      const k = x - NECK_START;
      z += pose.neckBend * 0.35 * k * k;
      y += 0.18 * k;
    }
    if (x < TAIL_START) {
      const k = TAIL_START - x;
      z += pose.tailBend * 0.12 * k * k + pose.tailWave * 0.06 * k;
      y += 0.03 * k;
    }
    return new THREE.Vector3(x, y, z);
  });
}

function updateBody(geometry, points) {
  const position = geometry.getAttribute('position');
  const up = new THREE.Vector3(0, 1, 0);
  for (let r = 0; r < points.length; r += 1) {
    const prev = points[Math.max(0, r - 1)];
    const next = points[Math.min(points.length - 1, r + 1)];
    const tangent = next.clone().sub(prev).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const radius = SPINE[r][1];
    for (let s = 0; s < RING_SIDES; s += 1) {
      const angle = (s / RING_SIDES) * TAU;
      // 少し縦長の断面（背が高く、横が細い）
      const offset = normal.clone().multiplyScalar(Math.cos(angle) * radius * 1.1)
        .add(side.clone().multiplyScalar(Math.sin(angle) * radius * 0.9));
      const p = points[r].clone().add(offset);
      position.setXYZ(r * RING_SIDES + s, p.x, p.y, p.z);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function createHead(material) {
  const head = new THREE.Group();
  head.name = 'dragon-head';
  const skull = new THREE.Mesh(paint(new THREE.SphereGeometry(0.17, 10, 8), COLORS.body), material);
  skull.scale.set(1.3, 0.85, 0.9);
  const snout = new THREE.Mesh(paint(new THREE.ConeGeometry(0.11, 0.55, 8), COLORS.body), material);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(0.32, -0.03, 0);
  snout.scale.set(1, 1, 0.8);
  head.add(skull, snout);
  // 控えめな角：後ろへ反る2本
  for (const side of [1, -1]) {
    const horn = new THREE.Mesh(paint(new THREE.ConeGeometry(0.035, 0.38, 6), COLORS.horn), material);
    horn.name = 'dragon-horn';
    horn.position.set(-0.12, 0.12, 0.08 * side);
    horn.rotation.set(0.25 * side, 0, Math.PI / 2 + 0.5);
    head.add(horn);
  }
  return head;
}

const BONE_RADIUS = [0.05, 0.04, 0.022, 0.02, 0.018, 0.016];

function createWing(name, material) {
  const wing = new THREE.Group();
  wing.name = name;
  const boneGeometries = BONE_RADIUS.map((radius) => paint(new THREE.CylinderGeometry(radius * 0.7, radius, 1, 6), COLORS.bone));
  for (const geometry of boneGeometries) {
    const bone = new THREE.Mesh(geometry, material);
    bone.name = 'dragon-wing-bone';
    wing.add(bone);
  }
  // 膜：手首を中心に、指の間と最後の指から腰までを張る。後ろの縁は指の間で内側へ弧を描く
  const triangles = 11;
  const positions = new Float32Array(triangles * 3 * 3 * 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  paint(geometry, COLORS.membrane);
  const membrane = new THREE.Mesh(geometry, material);
  membrane.name = 'dragon-wing-membrane';
  wing.add(membrane);
  return wing;
}

const UP = new THREE.Vector3(0, 1, 0);

function placeBone(bone, from, to) {
  const direction = to.clone().sub(from);
  const length = direction.length();
  bone.position.copy(from).add(to).multiplyScalar(0.5);
  bone.quaternion.setFromUnitVectors(UP, direction.normalize());
  bone.scale.set(1, length, 1);
}

function updateWing(wing, joints) {
  wing.userData.joints = joints;
  const bones = wing.children.filter((child) => child.name === 'dragon-wing-bone');
  placeBone(bones[0], joints.shoulder, joints.elbow);
  placeBone(bones[1], joints.elbow, joints.wrist);
  joints.tips.forEach((tip, i) => placeBone(bones[2 + i], joints.wrist, tip));

  const w = joints.wrist;
  const scallop = (a, b, pull) => a.clone().lerp(b, 0.5).lerp(w, pull);
  const [f1, f2, f3, f4] = joints.tips;
  const m12 = scallop(f1, f2, 0.16);
  const m23 = scallop(f2, f3, 0.16);
  const m34 = scallop(f3, f4, 0.16);
  const m4h = scallop(f4, joints.hip, 0.12);
  const tris = [
    [joints.shoulder, joints.elbow, w], [joints.shoulder, w, joints.hip],
    [w, f1, m12], [w, m12, f2], [w, f2, m23], [w, m23, f3], [w, f3, m34], [w, m34, f4],
    [w, f4, m4h], [w, m4h, joints.hip], [joints.elbow, f1, w],
  ];
  const membrane = wing.getObjectByName('dragon-wing-membrane');
  const position = membrane.geometry.getAttribute('position');
  let i = 0;
  // 表と裏の2層（わずかな厚み）
  for (const offset of [MEMBRANE_THICKNESS, -MEMBRANE_THICKNESS]) {
    for (const tri of tris) {
      for (const p of tri) {
        position.setXYZ(i, p.x, p.y + offset, p.z);
        i += 1;
      }
    }
  }
  position.needsUpdate = true;
  membrane.geometry.computeVertexNormals();
  membrane.geometry.computeBoundingSphere();
}

export function createDragon({ masks }) {
  const material = createMaterial(masks);
  // root：画面での位置と大きさ / tilt：下から見上げる角度 / yaw：進む向き / bank：旋回の傾き
  const root = new THREE.Group();
  root.name = 'dragon';
  const tilt = new THREE.Group();
  // 地上から見上げる角度。浅いと翼が真横からの細い線になるので、翼の形が読める程度に下から見る
  tilt.rotation.x = -0.8;
  const yaw = new THREE.Group();
  const bank = new THREE.Group();
  root.add(tilt);
  tilt.add(yaw);
  yaw.add(bank);

  const bodyGeometry = createBodyGeometry();
  const body = new THREE.Mesh(bodyGeometry, material);
  body.name = 'dragon-body';
  body.frustumCulled = false;
  const head = createHead(material);
  const wings = { right: createWing('dragon-wing-right', material), left: createWing('dragon-wing-left', material) };
  bank.add(body, head, wings.right, wings.left);
  root.traverse((object) => { object.frustumCulled = false; });

  function setPose(pose) {
    const points = spinePoints(pose);
    updateBody(bodyGeometry, points);
    // 頭は背骨の先に、首の向きに合わせて付ける
    const end = points[points.length - 1];
    const before = points[points.length - 2];
    head.position.copy(end);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), end.clone().sub(before).normalize());
    updateWing(wings.right, wingJoints(1, pose.shoulder, pose.elbow, pose.wrist));
    updateWing(wings.left, wingJoints(-1, pose.shoulder, pose.elbow, pose.wrist));
  }

  // time 秒の飛び方に合わせる。view などは絵の置き方（遠くの層として視差でずらしたもの）
  function update(time, { view = { x: 0.5, y: 0.5, zoom: 1 }, screenAspect = 2, imageAspect = 1672 / 941, resolution = null } = {}) {
    const flight = flightAt(time);
    const placed = placeDragon(flight, view, screenAspect, imageAspect);
    root.position.set(placed.x, placed.y, 0);
    root.scale.setScalar(placed.scale);
    yaw.rotation.y = flight.heading;
    bank.rotation.x = -flight.bank;
    setPose(dragonPose(time));

    const { uniforms } = material;
    uniforms.view.value.set(view.x, view.y, view.zoom);
    uniforms.screenAspect.value = screenAspect;
    uniforms.imageAspect.value = imageAspect;
    // 奥へ行くほど霞む（空気遠近法）
    uniforms.haze.value = 0.26 + 0.1 * flight.far;
    if (resolution) uniforms.resolution.value.copy(resolution);
  }

  function dispose() {
    root.traverse((object) => object.geometry?.dispose());
    material.dispose();
  }

  setPose(dragonPose(0));
  return { group: root, material, update, setPose, dispose };
}

