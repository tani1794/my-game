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
import { createBattleMusic, playTitleMusic, MUSIC_TRACKS } from './audio/music.js';
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
import { createTitleScreen } from './ui/titleScreen.js';
import { createSilentScene } from './title/silentScene.js';
import { createStoryHud } from './ui/storyHud.js';
import { createChapterRunner } from './chapter/runner.js';
import { createAreaRunner } from './areas/runner.js';
import { AREA_MODULES } from './areas/index.js';
import { createProgress } from './story/progress.js';
import { createPauseMenu } from './ui/pauseMenu.js';
import { createTutorial, createTutorialView } from './ui/tutorial.js';
import { nextState } from './game/flow.js';
import { createRecords } from './game/records.js';
import { asset } from './paths.js';

// 結晶獣の位置（ミニマップ・土ぼこり・ロックオンが読む。毎 frame、結晶獣の今の位置を書き写す）
const BEAST_POSITION = { x: 0, z: -6 };

// ── 画面：3Dを描くcanvasと、その上に重ねるUI ──
const app = document.querySelector('#app');
app.innerHTML = '<canvas id="game"></canvas>';
const hud = createHud(app);
const combatHud = createCombatHud(app);
const minimap = createMinimap(hud.minimapCanvas);
const tutorialView = createTutorialView(app);
const pauseMenu = createPauseMenu(app);
const storyHud = createStoryHud(app);
const titleScreen = createTitleScreen(app, {
  image: asset('textures/silent-art.webp'),
  logo: asset('textures/silent-title.webp'),
});

// ── 3Dの基本設定 ──
const canvas = document.querySelector('#game');
// WebGL が使えない端末では、止まったタイトル画面だけを出し、開始できない理由を伝えて止める
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
} catch (error) {
  titleScreen.show(null);
  titleScreen.reveal();
  titleScreen.onStart(() => titleScreen.showNotice('この端末では3Dを表示できないため、遊べません'));
  throw error;
}

renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

// ── タイトル「THE SILENT CROWN」：絵・奥行きの地図・動かす場所の地図が読めたら、2.5D の背景を使う ──
let titleScene = null;
let titleTime = 0;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const titleLoader = new THREE.TextureLoader();
Promise.all(['silent-art.webp', 'silent-depth.png', 'silent-masks.png']
  .map((file) => titleLoader.loadAsync(asset(`textures/${file}`))))
  .then(([art, depth, masks]) => {
    art.colorSpace = THREE.SRGBColorSpace;
    // スマートフォン（指で操作する端末）では、霧の模様と埃を減らす
    const lite = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    titleScene = createSilentScene({ art, depth, masks, lite });
    titleScene.setReducedMotion(Boolean(reducedMotion?.matches));
    reducedMotion?.addEventListener?.('change', (event) => titleScene.setReducedMotion(event.matches));
    titleScreen.setDepthMode(true);
    // 背景を描き始めてから、題字を出す
    requestAnimationFrame(() => titleScreen.reveal());
    // ?debug のときだけ、時刻を外から合わせられるようにする（画面の確認用）
    if (quality.debug) window.__titleTime = (seconds) => { titleTime = seconds; };
  })
  .catch((error) => {
    // 読めないときは止まった絵のまま、題字と開始ボタンを出す
    console.warn('タイトルの背景を準備できませんでした。止まった絵で続けます', error);
    titleScreen.reveal();
  });
const lighting = createLighting(scene, renderer);
const terrain = createTerrain(scene);
const ruins = createRuins(scene, terrain.heightAt);
const colliders = [...terrain.colliders, ...ruins.colliders];

// 地面の画像：読めないときは、頂点色だけの地面のまま続ける
new THREE.TextureLoader()
  .loadAsync(asset('textures/ground.webp'))
  .then((texture) => terrain.setGroundTexture(texture))
  .catch((error) => console.warn('地面の画像を読み込めませんでした', error));

// 遠景：画像が無い・読めないときは、コードで作る空と山にする
withFallback(
  createBackdrop(scene, asset('textures/backdrop.webp')),
  () => createFallbackBackdrop(scene),
);
const player = createPlayer(scene);
// 開始位置：道の手前から、奥の結晶獣を向く
player.object.position.set(0, 0, 6);
player.object.rotation.y = Math.PI;
player.load(asset('models/knight-crowned.glb'));

// 結晶獣：読み込めたら当たり判定に加える（失敗時はコードで作る獣になる）
let beast = null;
createBeast(scene, asset('models/beast.glb'), terrain.heightAt).then((loaded) => {
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
const battleMusic = createBattleMusic(sound);
let previousResult = null;
sound.load([...SOUND_NAMES, ...Object.keys(MUSIC_TRACKS)]);
sound.startAmbient('wind');
hud.setMutedIcon(sound.muted());

// タッチのたびに呼ぶ（iPhone で通話などのあと止まった音も、次のタッチで再開する）
// iPhone の Safari は指を離したときでないと音を有効にできないので、押したときと離したときの両方で試す
function unlockSound() {
  sound.unlock();
}
window.addEventListener('pointerdown', unlockSound);
window.addEventListener('pointerup', unlockSound);
window.addEventListener('touchend', unlockSound);
window.addEventListener('keydown', unlockSound);

function clickSound() {
  sound.play({ name: 'click', group: 'ui' });
}

// 消音：左上のボタンと一時停止メニューのどちらで変えても、両方の表示を合わせる
function toggleMute() {
  sound.setMuted(!sound.muted());
  hud.setMutedIcon(sound.muted());
  pauseMenu.setMuted(sound.muted());
  clickSound();
}

hud.muteButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  toggleMute();
});
const followCamera = createFollowCamera(canvas);

// ── 画質：URLで固定されていなければ、fpsを見て自動で下げる（一時停止メニューで選んだら、それ以降は下げない） ──
const quality = resolveQuality(window.location.search);
let autoDowngrade = quality.locked ? null : createAutoDowngrade(quality.tier);
const post = createPost(renderer, scene, followCamera.camera, QUALITY_PRESETS[quality.tier]);
const effects = createEffects(scene, QUALITY_PRESETS[quality.tier], BEAST_POSITION);

// 木・岩・草：読み込めたら当たり判定に加え、その時点の画質に草の量を合わせる
let vegetation = null;
createVegetation(scene, QUALITY_PRESETS[quality.tier], terrain.heightAt).then((loaded) => {
  vegetation = loaded;
  colliders.push(...loaded.colliders);
  loaded.setGrassCount(QUALITY_PRESETS[quality.tier].grass);
});

// 第一章の画質は、物語パートを作ったあとで合わせる（applyQuality が先に呼ばれるため）
let chapterQuality = null;

function applyQuality(preset) {
  chapterQuality?.(preset);
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

  hud.setFps(`${Math.round(fpsFrames / fpsTime)} fps · ${quality.tier} · 音 ${sound.loaded()}/${SOUND_NAMES.length + Object.keys(MUSIC_TRACKS).length}`);
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

// ── 画面の流れ：タイトル → 物語（第一章）→ 結晶獣戦 ⇄ 一時停止、戦い → 結果 → 戦い／タイトル ──
const TUTORIAL_PLAYS = 3;
const records = createRecords();
const tutorial = createTutorial();
let state = 'title';

// ── 第一章「霧の向こうの声」：森と礼拝堂。章の終わりの巡礼路から結晶獣戦へ ──
const storyProgress = createProgress();
const chapter = createChapterRunner({
  renderer,
  followCamera,
  input,
  stick,
  hud,
  combatHud,
  storyHud,
  sound,
  preset: QUALITY_PRESETS[quality.tier],
  lite: Boolean(window.matchMedia?.('(pointer: coarse)').matches),
  // 礼拝堂の裏の巡礼路から、第二章（白薔薇の迷宮橋）へ
  onToCrystal: () => {
    chapter.stop();
    storyProgress.enterArea('rose', 'roseEntry');
    activeStory = areaRunner;
    areaRunner.start(storyProgress);
  },
});

// ── 第二章「古竜の谷」：白薔薇の迷宮橋・洞穴・4つの谷（エリアごとに読み込む） ──
const areaRunner = createAreaRunner({
  renderer,
  followCamera,
  input,
  stick,
  hud,
  combatHud,
  storyHud,
  sound,
  preset: QUALITY_PRESETS[quality.tier],
  lite: Boolean(window.matchMedia?.('(pointer: coarse)').matches),
  areas: AREA_MODULES,
  root: app,
});
// 今動いている物語（第一章か、第二章のエリア）
let activeStory = chapter;
// ?legacy：今までの結晶獣戦（旧版）をタイトルから直接遊ぶ
const LEGACY_BATTLE = new URLSearchParams(window.location.search).has('legacy');
if (quality.debug) {
  window.__chapter = chapter;
  window.__areas = areaRunner;
  window.__setYaw = (yaw) => followCamera.setYaw(yaw);
  window.__setPitch = (pitch) => followCamera.setPitch(pitch);
}
chapterQuality = (preset) => { chapter.setQuality(preset); areaRunner.setQuality(preset); };

// 切り替えは必ずここを通す。その状態で許されない操作なら false
function go(action) {
  const next = nextState(state, action);
  if (next === null) return false;
  state = next;
  pauseMenu.setButtonVisible(state === 'playing' || state === 'story');
  // 物語の間は、結晶獣戦の表示（右上のクエスト・地図・体力バー）を隠す
  app.classList.toggle('story-mode', state === 'story' || state === 'storyPaused');
  return true;
}

// 物語に入る：保存があれば続きから、なければ森で目覚めるところから
function beginStory() {
  resetFight();
  sound.stopMusic(1.5);
  combatHud.setBeastVisible(false);
  autoDowngrade?.reset();
  clickSound();
  activeStory = storyProgress.area() === 'chapter1' ? chapter : areaRunner;
  activeStory.start(storyProgress);
}

// 主人公・結晶獣・予告・画面・ロックオン・入力を最初に戻す
function resetFight() {
  sound.stopAll();
  battleMusic.stop();
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
  tutorialView.show(null);
}

// 戦いに入る：最初の3回は遊び方の説明を出す
function beginFight() {
  resetFight();
  tutorial.start(records.countPlay() <= TUTORIAL_PLAYS);
  battleMusic.start();
  autoDowngrade?.reset();
  clickSound();
}

function showTitle() {
  chapter.stop();
  areaRunner.stop();
  app.classList.remove('story-mode');
  if (beast) combatHud.setBeastVisible(true);
  resetFight();
  playTitleMusic(sound);
  titleScreen.show(records.best());
  titleScreen.setNewGame(storyProgress.hasSave());
}

function pause() {
  if (!go('pause')) return;
  sound.suspend();
  clearInput();
  pauseMenu.show({ muted: sound.muted(), quality: quality.tier });
}

// 一時停止メニューを閉じて、action（続ける・やり直す・タイトルへ）に進む
function leavePause(action) {
  if (!go(action)) return false;
  pauseMenu.hide();
  sound.resume();
  return true;
}

titleScreen.onStart(() => {
  if (LEGACY_BATTLE) {
    if (!go('start')) return;
    titleScreen.hide();
    sound.unlock();
    beginFight();
    return;
  }
  if (!go('story')) return;
  titleScreen.hide();
  sound.unlock();
  beginStory();
});

combatHud.onRetry(() => {
  if (go('retry')) beginFight();
});

combatHud.onTitle(() => {
  if (!go('title')) return;
  clickSound();
  showTitle();
});

pauseMenu.on('pause', pause);
pauseMenu.on('resume', () => {
  if (leavePause('resume')) clickSound();
});
pauseMenu.on('retry', () => {
  // 物語ではチェックポイントから、結晶獣戦では最初から
  const inStory = state === 'storyPaused';
  if (!leavePause('retry')) return;
  if (inStory) activeStory.respawn();
  else beginFight();
});
pauseMenu.on('title', () => {
  if (leavePause('title')) showTitle();
});
pauseMenu.on('mute', toggleMute);
pauseMenu.on('tutorial', () => {
  tutorial.start(true);
  if (leavePause('resume')) clickSound();
});
pauseMenu.on('quality', (tier) => {
  quality.tier = tier;
  autoDowngrade = null;
  applyQuality(QUALITY_PRESETS[tier]);
  pauseMenu.setQuality(tier);
});

// パソコンでは Esc で一時停止・再開
window.addEventListener('keydown', (event) => {
  // 押しっぱなしの繰り返しは数えない（止めたつもりが再開しないように）
  if (event.code !== 'Escape' || event.repeat) return;
  if (state === 'playing' || state === 'story') pause();
  else if ((state === 'paused' || state === 'storyPaused') && leavePause('resume')) clickSound();
});

// アプリが裏に回ったら音を止める。戦いの途中なら一時停止にして、戻っても止めたままにする
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'playing' || state === 'story') pause();
    sound.suspend();
  } else if (state !== 'paused' && state !== 'storyPaused') {
    sound.resume();
  }
});

// 開いた直後のタイトル：1回目のタップで音を有効にしてタイトル曲を流し、2回目で開始する
playTitleMusic(sound);
titleScreen.setPrelude(true);
titleScreen.onAwaken(() => sound.unlock());
titleScreen.onNewGame(() => storyProgress.newGame());
titleScreen.show(records.best());
titleScreen.setNewGame(storyProgress.hasSave());

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
      go('finish');
      hud.setQuest(true);
      combatHud.showResult('won', time, records.submit(time));
      battleMusic.finish();
      setLock(false);
      tutorialView.show(null);
    } else if (event.type === 'lost') {
      outcome = 'lost';
      go('finish');
      combatHud.showResult('lost');
      battleMusic.finish();
      setLock(false);
      tutorialView.show(null);
    }
  }
}

// 1 frame 分の戦い：入力 → ルール → 見た目
function stepCombat(dt, time) {
  const presses = input.takePresses();
  const control = input.read();
  const move = moveToWorld(control.moveX, control.moveZ, followCamera.yaw());
  const moving = Math.hypot(move.x, move.z) > 0;

  if (!beast) {
    const frame = walkOnly.update(dt, {
      move, run: control.run, attack: false, dodge: false,
      target: null, self: player.object.position, facing: player.object.rotation.y, lockOn: false,
    });
    player.drive(dt, frame, colliders, terrain.heightAt);
    if (state === 'playing') {
      tutorialView.show(tutorial.update(dt, { moving, hit: false, telegraph: false, lock: presses.has('lock') }));
    }
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
  battleMusic.update(result.beast.hp / BEAST_MAX_HP);
  followCamera.setLag(result.player.mode === 'dodge');
  handleEvents(result.events, result.time);

  for (const cue of soundCues.update(dt, previousResult, result, player.object.position)) sound.play(cue);
  previousResult = result;

  if (state === 'playing') {
    tutorialView.show(tutorial.update(dt, {
      moving,
      hit: result.events.some((event) => event.type === 'beastHit'),
      telegraph: result.beast.phase === 'telegraph',
      lock: presses.has('lock'),
    }));
  }

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

const FAST_DEBUG = quality.debug && new URLSearchParams(window.location.search).has('fast');
let lastTime = performance.now();
let warmedUp = false;

function renderTitle() {
  titleScene.update(titleTime, window.innerWidth, window.innerHeight, renderer.getPixelRatio());
  titleScene.render(renderer);
}

// 結晶獣と木々が読めたら、戦いの絵を1回だけ実際に描いて準備を済ませる（始めた瞬間に引っかからないように）。
// 同じ frame のうちにタイトルを上から描くので、画面には出ない
function warmUp() {
  if (warmedUp || !beast || !vegetation) return;
  warmedUp = true;
  post.render();
}

function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = (now - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.05);
  // 止めている間も時刻は進めておく（再開した瞬間に大きく進まないように）
  lastTime = now;

  if (state === 'paused' || state === 'storyPaused') return;
  if (state === 'story') {
    const loweredInStory = autoDowngrade?.update(rawDt);
    if (loweredInStory) {
      quality.tier = loweredInStory;
      applyQuality(QUALITY_PRESETS[loweredInStory]);
    }
    if (quality.debug) updateFps(rawDt);
    // ?debug&fast：遅い確認用ブラウザでも、ゲームの時間が実際の時間と同じ速さで進むようにする
    activeStory.update(FAST_DEBUG ? Math.min(rawDt, 0.3) : dt, now / 1000);
    return;
  }
  if (state === 'title') {
    warmUp();
    if (titleScene) {
      titleTime += dt;
      renderTitle();
    }
    return;
  }

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
  chapter.resize(window.innerWidth, window.innerHeight);
  areaRunner.resize(window.innerWidth, window.innerHeight);
  // 大きさを変えると絵が消えるので、止めている間も1回描き直す
  if (state === 'title' && titleScene) renderTitle();
  else post.render();
}

// iPhone の Safari は、アドレスバーの出入りで visualViewport だけが変わることがあるので両方を見る
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
window.visualViewport?.addEventListener('resize', resize);

// 公開版では、一度開いたら通信なしでも遊べるようにする
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(asset('sw.js')).catch((error) => console.warn('オフライン対応を有効にできませんでした', error));
}

requestAnimationFrame(animate);
