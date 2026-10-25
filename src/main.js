import * as THREE from 'three';
import { createInput } from './input.js';
import { createPlayer, moveToWorld, pushOut } from './player.js';
import { createPlayerActions } from './combat/playerActions.js';
import { createBattle } from './combat/battle.js';
import { BEAST_MAX_HP } from './combat/beastBrain.js';
import { createTelegraphs } from './world/telegraph.js';
import { createCombatHud } from './ui/combatHud.js';
import { createSound } from './audio/sound.js';
import { createSoundCues } from './audio/soundCues.js';
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

// 結晶獣の位置（ミニマップ・土ぼこり・ロックオンが読む。毎 frame、結晶獣の今の位置を書き写す）
const BEAST_POSITION = { x: 0, z: -6 };

// ── 画面：3Dを描くcanvasと、その上に重ねるUI ──
const app = document.querySelector('#app');
app.innerHTML = '<canvas id="game"></canvas>';
const hud = createHud(app);
const combatHud = createCombatHud(app);
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
  // 結晶獣の当たり判定は、動くたびに中身が書き換わる（同じ配列のまま）
  colliders.push(...loaded.colliders);
  combatHud.setBeastVisible(true);
  combatHud.setBeast(1, false);
});

// ── 戦い：ルールは battle、見た目は各部品。やり直しのたびに乱数の種を変える ──
const START = { x: 0, z: 6, facing: Math.PI };
const LOCK_RANGE = 40;
let seed = 1;
let lockOn = false;
let outcome = 'fighting';
const battle = createBattle({ seed });
const telegraphs = createTelegraphs(scene, terrain.heightAt);
// 結晶獣の読み込み前は戦いを始めず、歩くだけにする
const walkOnly = createPlayerActions();

// ── 音：最初のタッチかキー入力で鳴らせるようにし、風を流す ──
const SOUND_NAMES = ['swing1', 'swing2', 'swing3', 'hit', 'dodge', 'hurt', 'step', 'warn', 'slam', 'crystal',
  'charge', 'spin', 'stagger', 'enrage', 'shatter', 'win', 'lose', 'click', 'wind'];
const sound = createSound();
const soundCues = createSoundCues();
let previousResult = null;
sound.load(SOUND_NAMES);
sound.startAmbient('wind');
hud.setMutedIcon(sound.muted());

function unlockSound() {
  sound.unlock();
  window.removeEventListener('pointerdown', unlockSound);
  window.removeEventListener('keydown', unlockSound);
}
window.addEventListener('pointerdown', unlockSound);
window.addEventListener('keydown', unlockSound);

hud.muteButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  sound.setMuted(!sound.muted());
  hud.setMutedIcon(sound.muted());
  sound.play({ name: 'click', group: 'ui' });
});

// アプリが裏に回ったら音を止め、戻ったら再開する
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.suspend();
  else sound.resume();
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

  hud.setFps(`${Math.round(fpsFrames / fpsTime)} fps · ${quality.tier} · 音 ${sound.loaded()}/${SOUND_NAMES.length}`);
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
input.bindTap(hud.actionButtons.attack, 'attack');
input.bindTap(hud.actionButtons.dodge, 'dodge');
input.bindTap(hud.actionButtons.lock, 'lock');

function setLock(on) {
  lockOn = on;
  followCamera.setLock(on ? BEAST_POSITION : null);
  if (!on) combatHud.setReticle(null);
}

// 3D の点を画面の座標（CSSピクセル）に。カメラの後ろなら null
const projected = new THREE.Vector3();
function toScreen(x, y, z) {
  projected.set(x, y, z).project(followCamera.camera);
  if (projected.z > 1 || projected.z < -1) return null;
  return { x: (projected.x + 1) / 2 * window.innerWidth, y: (1 - projected.y) / 2 * window.innerHeight };
}

// 「もう一度」：主人公・結晶獣・予告・画面・ロックオンを最初に戻す
combatHud.onRetry(() => {
  sound.play({ name: 'click', group: 'ui' });
  soundCues.reset();
  previousResult = null;
  seed += 1;
  battle.reset({ seed });
  outcome = 'fighting';
  player.object.position.set(START.x, terrain.heightAt(START.x, START.z), START.z);
  player.object.rotation.y = START.facing;
  telegraphs.clear();
  combatHud.clear();
  combatHud.hideResult();
  combatHud.setBeast(1, false);
  hud.setQuest(false);
  setLock(false);
  input.clear();
  stick.reset();
});

function handleEvents(events, time) {
  for (const event of events) {
    if (event.type === 'beastHit') {
      beast.hitFlash(event);
      const point = toScreen(event.x, terrain.heightAt(event.x, event.z) + 2.8, event.z);
      if (point) combatHud.showDamage(point, event.damage);
    } else if (event.type === 'shake') {
      followCamera.shake(event.strength);
    } else if (event.type === 'won') {
      outcome = 'won';
      hud.setQuest(true);
      combatHud.showResult('won', time);
      setLock(false);
    } else if (event.type === 'lost') {
      outcome = 'lost';
      combatHud.showResult('lost');
      setLock(false);
    }
  }
}

// 1 frame 分の戦い：入力 → ルール → 見た目
function stepCombat(dt, time) {
  const presses = input.takePresses();
  const control = input.read();
  const move = moveToWorld(control.moveX, control.moveZ, followCamera.yaw());

  if (!beast) {
    const frame = walkOnly.update(dt, {
      move, run: control.run, attack: false, dodge: false,
      target: null, self: player.object.position, facing: player.object.rotation.y, lockOn: false,
    });
    player.drive(dt, frame, colliders, terrain.heightAt);
    return;
  }

  if (presses.has('lock') && outcome === 'fighting') setLock(!lockOn);

  const result = battle.update(dt, {
    intent: {
      move,
      run: control.run,
      attack: presses.has('attack'),
      dodge: presses.has('dodge'),
      facing: player.object.rotation.y,
      lockOn,
    },
    playerPos: { x: player.object.position.x, z: player.object.position.z },
    beastColliders: beast.colliders,
  });

  if (quality.debug) window.__combat = { result, player: player.object.position, beast: beast.position, colliders: beast.colliders };
  player.drive(dt, result.player, colliders, terrain.heightAt);
  beast.apply(result.beast, time);
  const freed = pushOut(player.object.position, beast.colliders);
  player.object.position.x = freed.x;
  player.object.position.z = freed.z;
  BEAST_POSITION.x = beast.position.x;
  BEAST_POSITION.z = beast.position.z;

  telegraphs.sync(result.beast.attack, result.beast.enraged);
  hud.setVitals(result.player.hp, result.player.stamina);
  combatHud.setBeast(result.beast.hp / BEAST_MAX_HP, result.beast.enraged);
  followCamera.setLag(result.player.mode === 'dodge');
  handleEvents(result.events, result.time);

  for (const cue of soundCues.update(dt, previousResult, result, player.object.position)) sound.play(cue);
  previousResult = result;

  // ロックオン：結晶獣を追い続け、照準を出す。離れすぎたら解除
  if (lockOn) {
    const distance = Math.hypot(BEAST_POSITION.x - player.object.position.x, BEAST_POSITION.z - player.object.position.z);
    if (distance > LOCK_RANGE) setLock(false);
    else {
      followCamera.setLock(BEAST_POSITION);
      combatHud.setReticle(toScreen(BEAST_POSITION.x, terrain.heightAt(BEAST_POSITION.x, BEAST_POSITION.z) + 2.5, BEAST_POSITION.z));
    }
  }
  combatHud.update(dt);
}

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

  stepCombat(dt, now / 1000);
  ruins.update(now / 1000);
  vegetation?.update(now / 1000);
  effects.update(dt, now / 1000, player.object.position);
  lighting.update(player.object.position);
  followCamera.update(player.object.position, dt);
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
