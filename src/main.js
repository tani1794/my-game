import * as THREE from 'three';

// ── 画面と操作ボタン ──
document.querySelector('#app').innerHTML = `
  <canvas id="game"></canvas>

  <div id="info">
    <strong>ECHO HUNT — 移動テスト</strong>
    <span>PC：WASD / 矢印キーで移動・Shiftで走る</span>
    <span>画面をドラッグしてカメラを回転</span>
  </div>

  <div id="pad">
    <button data-key="up" class="up">▲</button>
    <button data-key="left" class="left">◀</button>
    <button data-key="down" class="down">▼</button>
    <button data-key="right" class="right">▶</button>
  </div>

  <button id="run">走る</button>
`;

const style = document.createElement('style');
style.textContent = `
  * { box-sizing: border-box; }
  html, body, #app {
    width: 100%; height: 100%; margin: 0; overflow: hidden;
    background: #101b26; font-family: sans-serif;
    overscroll-behavior: none;
  }
  #game {
    display: block; width: 100%; height: 100%;
    touch-action: none;
  }
  #info {
    position: fixed;
    top: max(16px, env(safe-area-inset-top));
    left: max(16px, env(safe-area-inset-left));
    color: white; pointer-events: none;
    padding: 12px 16px; border-radius: 12px;
    background: #07131dcc;
  }
  #info strong, #info span { display: block; }
  #info strong { color: #7de5ff; margin-bottom: 6px; }
  #info span { font-size: 12px; line-height: 1.7; }
  button {
    border: 1px solid #ffffff55; color: white;
    background: #102d42cc; border-radius: 14px;
    font-size: 22px; touch-action: none;
    user-select: none; -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  button.active { background: #2389aa; }
  #pad {
    position: fixed;
    left: max(20px, env(safe-area-inset-left));
    bottom: max(20px, env(safe-area-inset-bottom));
    display: grid;
    grid-template-columns: repeat(3, 54px);
    grid-template-rows: repeat(3, 54px);
    gap: 5px;
  }
  .up { grid-area: 1 / 2; }
  .left { grid-area: 2 / 1; }
  .down { grid-area: 2 / 2; }
  .right { grid-area: 2 / 3; }
  #run {
    position: fixed;
    right: max(24px, env(safe-area-inset-right));
    bottom: max(34px, env(safe-area-inset-bottom));
    width: 76px; height: 76px; font-size: 18px;
  }
`;
document.head.appendChild(style);

// ── 3Dの基本設定 ──
const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#172b3b');
scene.fog = new THREE.Fog('#172b3b', 24, 65);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);

scene.add(new THREE.HemisphereLight(0xc5eaff, 0x394536, 2.5));

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(8, 15, 5);
scene.add(sun);

// ── フィールド ──
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({
    color: '#354c46',
    roughness: 1,
  }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const grid = new THREE.GridHelper(60, 30, 0x608b88, 0x405e59);
grid.position.y = 0.01;
scene.add(grid);

// 岩の見た目と簡易衝突判定を共通のデータで管理
const rocks = [];
const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
const rockMaterial = new THREE.MeshStandardMaterial({
  color: '#677b85',
  roughness: 0.95,
});

for (let i = 0; i < 18; i++) {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 10 + (i % 3) * 3;
  const radius = 0.7 + (i % 4) * 0.2;

  const rock = new THREE.Mesh(rockGeometry, rockMaterial);
  rock.scale.set(radius, radius * 1.4, radius);
  rock.position.set(
    Math.cos(angle) * distance,
    radius * 0.8,
    Math.sin(angle) * distance,
  );
  scene.add(rock);

  rocks.push({
    x: rock.position.x,
    z: rock.position.z,
    radius,
  });
}

// ── 仮プレイヤー：青い胴体＋頭＋正面の目印 ──
const player = new THREE.Group();

const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.32, 0.65, 4, 8),
  new THREE.MeshStandardMaterial({ color: '#37a5d5' }),
);
body.position.y = 0.85;
player.add(body);

const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 12, 8),
  new THREE.MeshStandardMaterial({ color: '#e3c1a1' }),
);
head.position.y = 1.6;
player.add(head);

const front = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.12, 0.18),
  new THREE.MeshStandardMaterial({ color: '#f7d67c' }),
);
front.position.set(0, 1.6, 0.25);
player.add(front);

scene.add(player);

// ── 入力：キーボードとタッチを合流 ──
const keys = new Set();
const touches = new Map();
const keyMap = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

window.addEventListener('keydown', (event) => {
  if (keyMap[event.code]) {
    event.preventDefault();
    keys.add(event.code);
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

function held(action) {
  return (
    [...keys].some((code) => keyMap[code] === action) ||
    [...touches.values()].some((value) => value === action)
  );
}

function bindButton(button, action) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touches.set(event.pointerId, action);
    button.classList.add('active');
  });

  const release = (event) => {
    touches.delete(event.pointerId);
    if (![...touches.values()].includes(action)) {
      button.classList.remove('active');
    }
  };

  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

document.querySelectorAll('[data-key]').forEach((button) => {
  bindButton(button, button.dataset.key);
});
bindButton(document.querySelector('#run'), 'run');

// ── カメラ：ボタン以外の画面をドラッグ ──
let yaw = 0;
let pitch = 0.4;
let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  if (drag !== null) return;
  canvas.setPointerCapture(event.pointerId);
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;

  yaw -= (event.clientX - drag.x) * 0.006;
  pitch = THREE.MathUtils.clamp(
    pitch + (event.clientY - drag.y) * 0.004,
    0.15,
    0.9,
  );

  drag.x = event.clientX;
  drag.y = event.clientY;
});

function releaseCamera(event) {
  if (drag?.id === event.pointerId) drag = null;
}

canvas.addEventListener('pointerup', releaseCamera);
canvas.addEventListener('pointercancel', releaseCamera);
canvas.addEventListener('lostpointercapture', releaseCamera);

function clearInput() {
  keys.clear();
  touches.clear();
  drag = null;
  document.querySelectorAll('button').forEach((button) => {
    button.classList.remove('active');
  });
}

window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);

// ── 移動と衝突 ──
function canMove(x, z) {
  if (Math.abs(x) > 28 || Math.abs(z) > 28) return false;

  return rocks.every((rock) => {
    return Math.hypot(x - rock.x, z - rock.z) > rock.radius + 0.4;
  });
}

const direction = new THREE.Vector3();
const target = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const horizontal = Number(held('right')) - Number(held('left'));
  const forward = Number(held('up')) - Number(held('down'));

  direction.set(
    horizontal * Math.cos(yaw) - forward * Math.sin(yaw),
    0,
    -horizontal * Math.sin(yaw) - forward * Math.cos(yaw),
  );

  if (direction.lengthSq() > 0) {
    direction.normalize();
    const speed = held('run') ? 6 : 3;

    const nextX = player.position.x + direction.x * speed * dt;
    if (canMove(nextX, player.position.z)) player.position.x = nextX;

    const nextZ = player.position.z + direction.z * speed * dt;
    if (canMove(player.position.x, nextZ)) player.position.z = nextZ;

    player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  target.copy(player.position);
  target.y += 1.1;

  const distance = 6;
  desiredCamera.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    target.y + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );

  camera.position.copy(desiredCamera);
  camera.lookAt(target);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(animate);