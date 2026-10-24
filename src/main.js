import * as THREE from 'three';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createFollowCamera } from './camera.js';
import { createTerrain } from './world/terrain.js';
import { createLighting } from './world/lighting.js';
import { createRuins } from './world/ruins.js';
import { createPost } from './world/post.js';
import { createEffects } from './world/effects.js';
import { createBackdrop, createFallbackBackdrop } from './world/backdrop.js';
import { withFallback } from './assets.js';
import { createBeast } from './world/beast.js';
import { createVegetation } from './world/vegetation.js';
import { QUALITY_PRESETS, resolveQuality, createAutoDowngrade } from './quality.js';
import { createStick } from './ui/stick.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';

// 結晶獣の位置（ミニマップと土ぼこりで使う。beast.js の配置と同じ）
const BEAST_POSITION = { x: 0, z: -6 };

// ── 画面：3Dを描くcanvasと、その上に重ねるUI ──
const app = document.querySelector('#app');
app.innerHTML = '<canvas id="game"></canvas>';
const hud = createHud(app);
const minimap = createMinimap(hud.minimapCanvas);

// ── 3Dの基本設定 ──
const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const lighting = createLighting(scene, renderer);
const terrain = createTerrain(scene);
const ruins = createRuins(scene, terrain.heightAt);
const colliders = [...terrain.colliders, ...ruins.colliders];

// 地面の画像：読めないときは、頂点色だけの地面のまま続ける
new THREE.TextureLoader()
  .loadAsync('/textures/ground.webp')
  .then((texture) => terrain.setGroundTexture(texture))
  .catch((error) => console.warn('地面の画像を読み込めませんでした', error));

// 遠景：画像が無い・読めないときは、コードで作る空と山にする
withFallback(
  createBackdrop(scene, '/textures/backdrop.webp'),
  () => createFallbackBackdrop(scene),
);
const player = createPlayer(scene);
// 開始位置：道の手前から、奥の結晶獣を向く
player.object.position.set(0, 0, 6);
player.object.rotation.y = Math.PI;
player.load('/models/knight.glb');

// 結晶獣：読み込めたら当たり判定に加える（失敗時はコードで作る獣になる）
let beast = null;
createBeast(scene, '/models/beast.glb', terrain.heightAt).then((loaded) => {
  beast = loaded;
  colliders.push(...loaded.colliders);
});
const followCamera = createFollowCamera(canvas);

// ── 画質：URLで固定されていなければ、fpsを見て自動で下げる ──
const quality = resolveQuality(window.location.search);
const autoDowngrade = quality.locked ? null : createAutoDowngrade(quality.tier);
const post = createPost(renderer, scene, followCamera.camera, QUALITY_PRESETS[quality.tier]);
const effects = createEffects(scene, QUALITY_PRESETS[quality.tier], BEAST_POSITION);

// 木・岩・草：読み込めたら当たり判定に加え、その時点の画質に草の量を合わせる
let vegetation = null;
createVegetation(scene, QUALITY_PRESETS[quality.tier], terrain.heightAt).then((loaded) => {
  vegetation = loaded;
  colliders.push(...loaded.colliders);
  loaded.setGrassCount(QUALITY_PRESETS[quality.tier].grass);
});

function applyQuality(preset) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
  lighting.setQuality(preset);
  post.setQuality(preset);
  vegetation?.setGrassCount(preset.grass);
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

  player.update(dt, input.read(), followCamera.yaw(), colliders, terrain.heightAt);
  ruins.update(now / 1000);
  beast?.update(now / 1000);
  vegetation?.update(now / 1000);
  effects.update(dt, now / 1000, player.object.position);
  lighting.update(player.object.position);
  followCamera.update(player.object.position);
  minimap.draw(
    {
      x: player.object.position.x,
      z: player.object.position.z,
      rotationY: player.object.rotation.y,
    },
    BEAST_POSITION,
  );
  post.render();
}

function resize() {
  followCamera.resize(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
}

// iPhone の Safari は、アドレスバーの出入りで visualViewport だけが変わることがあるので両方を見る
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
window.visualViewport?.addEventListener('resize', resize);

requestAnimationFrame(animate);
