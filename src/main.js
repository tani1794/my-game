import * as THREE from 'three';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createFollowCamera } from './camera.js';
import { createTerrain } from './world/terrain.js';
import { createLighting } from './world/lighting.js';

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
const lighting = createLighting(scene);
const terrain = createTerrain(scene);
const player = createPlayer(scene);
const followCamera = createFollowCamera(canvas);

const input = createInput();
document.querySelectorAll('[data-key]').forEach((button) => {
  input.bindButton(button, button.dataset.key);
});
input.bindButton(document.querySelector('#run'), 'run');

function clearInput() {
  input.clear();
  followCamera.clear();
}

window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

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
