import * as THREE from 'three';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createFollowCamera } from './camera.js';
import { createTerrain } from './world/terrain.js';
import { createLighting } from './world/lighting.js';
import { QUALITY_PRESETS, resolveQuality, createAutoDowngrade } from './quality.js';
import { createStick } from './ui/stick.js';
import { createHud } from './ui/hud.js';

// ── 画面：3Dを描くcanvasと、その上に重ねるUI ──
const app = document.querySelector('#app');
app.innerHTML = '<canvas id="game"></canvas>';
const hud = createHud(app);

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

// ?debug のときだけ fps を表示
let fpsFrames = 0;
let fpsTime = 0;

function updateFps(dt) {
  fpsFrames += 1;
  fpsTime += dt;
  if (fpsTime < 0.5) return;

  hud.setFps(`${Math.round(fpsFrames / fpsTime)} fps · ${quality.tier}`);
  fpsFrames = 0;
  fpsTime = 0;
}

// iOS でメモリ不足などにより描画できなくなったときの案内
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  hud.showNotice('描画が止まりました。再読み込みしてください');
});

const input = createInput();
const stick = createStick(hud.stickArea, input.setStick);
input.bindButton(hud.runButton, 'run');

function clearInput() {
  input.clear();
  stick.reset();
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
