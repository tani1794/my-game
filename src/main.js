import * as THREE from 'three';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createFollowCamera } from './camera.js';
import { createTerrain } from './world/terrain.js';
import { createLighting } from './world/lighting.js';
import { QUALITY_PRESETS, resolveQuality, createAutoDowngrade } from './quality.js';

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

renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const lighting = createLighting(scene);
const terrain = createTerrain(scene);
const player = createPlayer(scene);
const followCamera = createFollowCamera(canvas);

// ── 画質：URLで固定されていなければ、fpsを見て自動で下げる ──
const quality = resolveQuality(window.location.search);
const autoDowngrade = quality.locked ? null : createAutoDowngrade(quality.tier);

function applyQuality(preset) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
  lighting.setQuality(preset);
}

applyQuality(QUALITY_PRESETS[quality.tier]);

// ?debug のときだけ fps を表示（Task 4 で HUD に移す）
const fpsLabel = document.createElement('div');
fpsLabel.style.cssText = `
  position: fixed; top: max(8px, env(safe-area-inset-top)); left: 50%;
  transform: translateX(-50%); color: #e8e2d0; font: 12px monospace;
  padding: 2px 8px; border-radius: 6px; background: #07131dcc;
  pointer-events: none;
`;
fpsLabel.hidden = !quality.debug;
document.body.appendChild(fpsLabel);

let fpsFrames = 0;
let fpsTime = 0;

function updateFps(dt) {
  fpsFrames += 1;
  fpsTime += dt;
  if (fpsTime < 0.5) return;

  fpsLabel.textContent = `${Math.round(fpsFrames / fpsTime)} fps · ${quality.tier}`;
  fpsFrames = 0;
  fpsTime = 0;
}

// iOS でメモリ不足などにより描画できなくなったときの案内
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  const notice = document.createElement('div');
  notice.textContent = '描画が止まりました。再読み込みしてください';
  notice.style.cssText = `
    position: fixed; inset: 0; display: grid; place-items: center;
    color: white; font: 16px sans-serif; background: #07131dee;
  `;
  document.body.appendChild(notice);
});

const input = createInput();
document.querySelectorAll('[data-key]').forEach((button) => {
  input.bindButton(button, button.dataset.key);
});
input.bindButton(document.querySelector('#run'), 'run');

function clearInput() {
  input.clear();
  followCamera.clear();
  autoDowngrade?.reset();
}

window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = (now - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.05);
  lastTime = now;

  // 計測には切り詰める前の時間を使う（切り詰めると fps が実際より高く見える）
  const lowered = autoDowngrade?.update(rawDt);
  if (lowered) {
    quality.tier = lowered;
    applyQuality(QUALITY_PRESETS[lowered]);
  }
  if (quality.debug) updateFps(rawDt);

  player.update(dt, input.read(), followCamera.yaw(), terrain.colliders, terrain.heightAt);
  lighting.update(player.object.position);
  followCamera.update(player.object.position);
  renderer.render(scene, followCamera.camera);
}

window.addEventListener('resize', () => {
  followCamera.resize(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(animate);
