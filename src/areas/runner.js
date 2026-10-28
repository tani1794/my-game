// 第二章のエリア（白薔薇の迷宮橋・洞穴・谷）を動かすまとめ役。第一章の runner と同じ流れで、
// 地図は kit.js（重なる床・仕掛けで変わる床）、決まりはエリアごとの rules、見た目はエリアごとの build を使う。
// 同時に読み込むのは1エリア分だけ。次のエリアへ移るときは、前のエリアの見た目と敵を捨ててから作る。
import * as THREE from 'three';
import { createPlayer, moveToWorld, pushOut, stepPosition } from '../player.js';
import { createPlayerActions } from '../combat/playerActions.js';
import { sectorHitsCircle, shapeContains } from '../combat/shapes.js';
import { attackPower, computeDamage } from '../combat/damage.js';
import { createPost } from '../world/post.js';
import { createGuard } from '../story/guard.js';
import { createDirector } from '../story/director.js';
import { createMaterials } from '../chapter/materials.js';
import { createGuardViews } from '../chapter/guards.js';
import { createConfirmDialog } from '../ui/confirmDialog.js';
import { asset } from '../paths.js';
import { playableStart } from '../story/world.js';
import { createFoes } from './foes.js';
import { createFoeViews } from './foeViews.js';
import { createBossLogic } from './bossLogic.js';
import { createBeast } from '../world/beast.js';
import { createTelegraphs } from '../world/telegraph.js';
import { createBattleMusic } from '../audio/music.js';

const SWORD = { radius: 1.6, spread: (120 * Math.PI) / 180 };
const LOCK_RANGE = 12;
const FACE_RANGE = 5;
const RESPAWN_DELAY = 1.8;
const SWING_SOUND = {
  '1H_Melee_Attack_Slice_Diagonal': 'swing1',
  '1H_Melee_Attack_Slice_Horizontal': 'swing2',
  '1H_Melee_Attack_Chop': 'swing3',
};
const CRIT_CHANCE = 0.08;

const MOODS = {
  rose: { fog: '#9aa3a6', density: 0.0095, sky: '#d6dde0', ground: '#3d3f3a', hemi: 1.9, sun: '#f2efe6', sunIntensity: 2.2 },
  tunnel: { fog: '#2f3638', density: 0.03, sky: '#8a949a', ground: '#25272a', hemi: 0.7, sun: '#f2efe6', sunIntensity: 0.4, lantern: 4 },
  cave: { fog: '#101a22', density: 0.026, sky: '#6d8fae', ground: '#14181c', hemi: 0.9, sun: '#9fd8ff', sunIntensity: 0.25, lantern: 7 },
  crystal: { fog: '#8fb0c2', density: 0.0095, sky: '#d4ecf7', ground: '#3a4652', hemi: 1.7, sun: '#eef8ff', sunIntensity: 2.3 },
  frost: { fog: '#c3d0d8', density: 0.013, sky: '#eef4f8', ground: '#7d8b95', hemi: 1.8, sun: '#f4f8ff', sunIntensity: 1.9 },
};
const RESONATE = { low: { rate: 0.6, shake: 0.15 }, mid: { rate: 1, shake: 0.35 }, high: { rate: 1.6, shake: 0.6 } };
const RISE_TIME = 2;

const smooth = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export function createAreaRunner({ renderer, followCamera, input, stick, hud, combatHud, storyHud, sound, preset, lite = false, areas, root }) {
  const scene = new THREE.Scene();
  const camera = followCamera.camera;
  const post = createPost(renderer, scene, camera, preset);
  const confirm = createConfirmDialog(root);
  const materials = createMaterials();

  scene.fog = new THREE.FogExp2(new THREE.Color(MOODS.rose.fog), MOODS.rose.density);
  scene.background = scene.fog.color.clone();
  const hemi = new THREE.HemisphereLight(MOODS.rose.sky, MOODS.rose.ground, MOODS.rose.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(MOODS.rose.sun, MOODS.rose.sunIntensity);
  const SUN_OFFSET = new THREE.Vector3(-20, 38, 16);
  for (const side of ['left', 'bottom']) sun.shadow.camera[side] = -16;
  for (const side of ['right', 'top']) sun.shadow.camera[side] = 16;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.castShadow = preset.shadows;
  sun.shadow.mapSize.set(preset.shadowMapSize || 1024, preset.shadowMapSize || 1024);
  scene.add(sun, sun.target);
  // 暗い所では、主人公のまわりだけ淡く照らす（洞窟・トンネル）
  const lantern = new THREE.PointLight('#ffe2b8', 0, 9, 1.6);
  scene.add(lantern);

  // ── 主人公（同じモデル・同じ行動）。武器の進化は剣の色と光だけ変える ──
  const player = createPlayer(scene);
  player.load(asset('models/knight.glb'));
  const actions = createPlayerActions();
  let facing = Math.PI;
  const hitSwings = new Set();
  let lastAnimation = null;
  let stepTimer = 0;
  let random = 1;
  const nextRandom = () => { random = (random * 16807) % 2147483647; return random / 2147483647; };

  let swordMaterial = null;
  let swordEvolved = null;
  function applyWeapon(evolved) {
    if (!swordMaterial) {
      player.object.traverse((part) => {
        if (part.isMesh && part.name === '1H_Sword' && !swordMaterial) {
          part.material = part.material.clone();
          swordMaterial = part.material;
        }
      });
      if (!swordMaterial) return;
    }
    if (swordEvolved === evolved) return;
    swordEvolved = evolved;
    // 進化前：くすんだ錆色。誓剣ルーメン：銀に、細い青い光
    swordMaterial.color.set(evolved ? '#e6eef6' : '#8a7f72');
    swordMaterial.emissive = new THREE.Color(evolved ? '#4aa8ff' : '#000000');
    swordMaterial.emissiveIntensity = evolved ? 0.45 : 0;
    swordMaterial.metalness = evolved ? 0.6 : 0.2;
    swordMaterial.roughness = evolved ? 0.35 : 0.8;
  }

  // 錆が光の粒になって剥がれる（進化の演出）
  const sparkCount = 90;
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkCount * 3), 3));
  const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({ color: '#bfe6ff', size: 0.07, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkTime = -1;
  const sparkSeeds = Array.from({ length: sparkCount }, () => [nextRandom(), nextRandom(), nextRandom()]);
  function updateSparks(dt) {
    if (sparkTime < 0) return;
    sparkTime += dt;
    const p = player.object.position;
    const position = sparkGeometry.getAttribute('position');
    sparkSeeds.forEach(([a, b, c], i) => {
      const t = (sparkTime * (0.4 + a * 0.6) + b) % 1;
      position.setXYZ(i, p.x + Math.sin(facing + 0.6) * 0.5 + (a - 0.5) * 0.8 * t, p.y + 0.8 + c * 0.9 + t * 1.8, p.z + Math.cos(facing + 0.6) * 0.5 + (c - 0.5) * 0.8 * t);
    });
    position.needsUpdate = true;
    sparks.material.opacity = sparkTime < 6 ? 0.9 : Math.max(0, 0.9 - (sparkTime - 6));
    if (sparkTime > 7) sparkTime = -1;
  }

  // ── エリア ──
  let area = null;     // 登録された1つ（data・createRules・build）
  let built = null;    // build の結果
  let guards = [];
  let guardViews = null;
  // 谷の敵（共通の頭脳）、斬って壊す物、ボス
  let foes = null;
  let foeViews = null;
  let breakables = [];
  let boss = null;      // { logic, view, telegraphs, data }。共通の敵の頭脳のボスは { foe: true, logic, data }（見た目は foeViews）
  let bossRise = -1;    // 登場で立ち上がる途中（0〜1）。-1 は待機
  let tremor = 0;
  const battleMusic = createBattleMusic(sound);
  let progress = null;
  let director = null;
  let flags = {};
  let out = { control: true, blocking: false, waitingTap: false, inMemory: false, subtitle: null, objective: null, interactables: [], actions: [] };
  let shownSubtitle = null;
  let shownObjective;
  let active = false;
  let loading = false;
  let dying = 0;
  let respawning = false;
  let lockTarget = null;
  let advanceRequested = false;
  let skipRequested = false;
  let interactRequested = false;
  let modalOpen = false;
  const raycaster = new THREE.Raycaster();
  const headPoint = new THREE.Vector3();

  storyHud.onAdvance(() => { if (active) advanceRequested = true; });
  storyHud.onSkip(() => { if (active) skipRequested = true; });
  storyHud.onInteract(() => { if (active) interactRequested = true; });
  window.addEventListener('keydown', (event) => {
    if (active && event.key === 'Enter' && out.waitingTap) advanceRequested = true;
  });

  const level = () => area.data.level;
  const py = () => player.object.position.y;
  // 今の高さ・仕掛けの状態から、歩ける場所と高さを決める
  const walkableHere = (x, z) => level().walkable(x, z, py(), flags);
  const heightHere = (x, z) => level().heightAt(x, z, py(), flags);

  function readFlags() {
    flags = {};
    for (const name of area.data.flagNames ?? []) flags[name] = progress.flag(name);
  }

  function enemyPostY(id) {
    return area.data.enemies.find((e) => e.id === id)?.y ?? 0;
  }

  function placeAtCheckpoint() {
    const point = area.data.checkpoints[progress.checkpoint()] ?? Object.values(area.data.checkpoints)[0];
    player.object.position.set(point.x, point.y ?? 0, point.z);
    player.object.position.y = level().heightAt(point.x, point.z, point.y ?? 0, flags);
    player.object.rotation.y = point.facing;
    facing = point.facing;
    followCamera.setYaw(point.facing - Math.PI);
    followCamera.setLock(null);
    lockTarget = null;
    actions.reset();
    hitSwings.clear();
    dying = 0;
  }

  // 通常の敵は、休むか読み込み直すと持ち場に戻る。精鋭とボスは倒した記録が残る
  function resetEnemies() {
    for (const guard of guards) {
      guard.reset();
      const post = area.data.enemies.find((e) => e.id === guard.id);
      if (post?.elite && progress.defeated(guard.id)) {
        guard.takeDamage(1e9);
        guardViews?.hide(guard.id);
      }
    }
    if (foes) {
      foes.reset((id) => progress.defeated(id));
      for (const enemy of foes.list()) if (!enemy.alive()) foeViews.hide(enemy.id);
    }
    breakables = (area.data.breakables ?? []).filter((b) => !progress.flag(b.flag)).map((b) => ({ ...b, left: b.hp }));
    resetBoss();
  }

  function showBossBar(visible) {
    combatHud.setBeastVisible(visible);
    root.classList.toggle('story-boss', visible);
  }

  // 共通の敵の頭脳でできたボス（霜葬峡谷のイスヴァルなど）を、結晶獣のボスと同じ形で扱う
  function foeBossLogic(id) {
    const enemy = () => foes.list().find((e) => e.id === id);
    const def = area.data.foes[area.data.enemies.find((e) => e.id === id).type];
    return {
      maxHp: def.hp,
      radius: def.radius,
      active: () => Boolean(enemy()?.alive() && !enemy().hidden()),
      down: () => !enemy()?.alive(),
      frame: () => ({ hp: enemy()?.hp() ?? 0, position: enemy()?.position() ?? { x: 0, z: 0 }, enraged: Boolean(def.enrage) && (enemy()?.hp() ?? 0) < def.hp * def.enrage.below }),
      start: () => foes.wake(id),
      reset: () => {},
      weaken: (left) => api.weakenFoe(id, left),
    };
  }

  // ボス：倒れて戻ったら、待つ状態から（登場の演出は、王座に入り直すと流れる。スキップできる）
  function resetBoss() {
    if (!boss) return;
    boss.logic.reset();
    boss.telegraphs?.clear();
    const beaten = progress.defeated(boss.data.id);
    if (boss.view) boss.view.object.visible = !beaten;
    else foeViews?.reveal(boss.data.id, false);
    bossRise = -1;
    tremor = 0;
    showBossBar(false);
    battleMusic.stop();
  }

  // エリアの読み込みは一つずつ（重なると、片方が捨てた見た目をもう片方が使ってしまう）
  let pendingLoad = Promise.resolve();
  function loadArea(id) {
    const run = pendingLoad.then(() => loadAreaNow(id));
    pendingLoad = run.catch(() => {});
    return run;
  }

  // 物語を始めるたび・やめるたびに変わる番号。待っている間に変わったら、残りの手順はしない
  let session = 0;

  function disposeObject(object) {
    object.traverse((part) => {
      part.geometry?.dispose();
      for (const material of [part.material].flat()) {
        if (!material) continue;
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    });
  }

  async function loadAreaNow(id) {
    loading = true;
    built?.dispose();
    guardViews?.dispose();
    foeViews?.dispose();
    if (boss?.view) {
      scene.remove(boss.view.object);
      disposeObject(boss.view.object);
      boss.telegraphs.dispose();
    }
    if (boss) {
      battleMusic.stop();
      showBossBar(false);
    }
    built = null;
    guardViews = null;
    foes = null;
    foeViews = null;
    boss = null;
    area = areas[id];
    readFlags();
    built = await area.build(scene, materials, { lite });
    const posts = area.data.enemies.filter((e) => e.type === 'mistGuard');
    guards = posts.map((post) => createGuard(post));
    guardViews = await createGuardViews(scene, posts, (x, z, gid) => level().heightAt(x, z, enemyPostY(gid), flags));
    const defs = area.data.foes ?? {};
    const foePosts = area.data.enemies.filter((e) => defs[e.type]);
    if (foePosts.length) {
      foes = createFoes(foePosts, defs);
      foeViews = await createFoeViews(scene, foePosts, defs, (x, z, y) => level().heightAt(x, z, y, flags), { lite });
    }
    if (area.data.boss?.kind === 'foe') {
      boss = { data: area.data.boss, foe: true, logic: foeBossLogic(area.data.boss.id) };
      combatHud.setBeastName(area.data.boss.name);
    } else if (area.data.boss) {
      const groundAt = (x, z) => level().heightAt(x, z, 0, flags);
      const view = await createBeast(scene, asset('models/beast.glb'), groundAt);
      boss = { data: area.data.boss, logic: createBossLogic(area.data.boss), view, telegraphs: createTelegraphs(scene, groundAt) };
      combatHud.setBeastName(area.data.boss.name);
    }
    built.applyState(flags);
    scene.updateMatrixWorld(true);
    loading = false;
  }

  async function start(nextProgress) {
    progress = nextProgress;
    active = true;
    const mine = ++session;
    // まだ作っていないエリアの保存は、作ってある最後のエリアの最後の碑から
    const fallback = playableStart(progress.area(), Object.keys(areas));
    if (fallback) progress.enterArea(fallback.area, fallback.checkpoint);
    storyHud.setVisible(true);
    storyHud.setObjective(null);
    storyHud.clearSubtitle();
    await storyHud.fade('black', 0.01);
    await loadArea(progress.area());
    if (mine !== session) return;
    placeAtCheckpoint();
    resetEnemies();
    swordEvolved = null;
    director = createDirector(progress, area.createRules());
    shownObjective = undefined;
    out = director.begin();
    applyOutput(out);
    storyHud.toast(area.data.name);
    storyHud.fade(null, 1.2);
  }

  function stop() {
    active = false;
    session += 1;
    respawning = false;
    confirm.close();
    battleMusic.stop();
    // 旧版の結晶獣戦の表示に戻す（物語の外では、体力バーは結晶獣戦が出す）
    root.classList.remove('story-boss');
    combatHud.setBeastVisible(true);
    combatHud.setBeastName('結晶獣');
    storyHud.setVisible(false);
    storyHud.setAdvance(false);
    storyHud.showInteract(null);
    combatHud.setReticle(null);
    followCamera.setLock(null);
    sound.stopAll();
  }

  // 次のエリアへ（読み込みに失敗したら、元の安全な場所へ戻して、もう一度選べるようにする）
  async function travel(nextArea, checkpoint) {
    if (loading || respawning) return;
    const mine = session;
    respawning = true;
    await storyHud.fade('black', 0.8);
    if (mine !== session) return;
    const before = { area: progress.area(), checkpoint: progress.checkpoint() };
    try {
      if (!areas[nextArea]) throw new Error(`エリア ${nextArea} はまだありません`);
      progress.enterArea(nextArea, checkpoint);
      await loadArea(nextArea);
      if (mine !== session) return;
      placeAtCheckpoint();
      resetEnemies();
      director = createDirector(progress, area.createRules());
      shownObjective = undefined;
      out = director.begin();
      applyOutput(out);
      storyHud.toast(area.data.name);
    } catch (error) {
      console.warn('次のエリアを読み込めませんでした', error);
      progress.enterArea(before.area, before.checkpoint);
      if (area?.data.id !== before.area) await loadArea(before.area);
      if (mine !== session) return;
      placeAtCheckpoint();
      resetEnemies();
      director = createDirector(progress, area.createRules());
      out = director.begin();
      applyOutput(out);
      storyHud.toast(areas[nextArea] ? '読み込みに失敗しました。もう一度試してください' : 'この先は、まだ準備中です');
    }
    respawning = false;
    await storyHud.fade(null, 1);
  }

  async function respawn() {
    if (respawning || loading) return;
    const mine = session;
    respawning = true;
    await storyHud.fade('black', 0.6);
    if (mine !== session) return;
    director.respawn();
    readFlags();
    built.applyState(flags);
    placeAtCheckpoint();
    resetEnemies();
    out = director.update(0, { zones: [], interact: null, noticed: [], defeated: [], advance: false, skip: false });
    applyOutput(out);
    respawning = false;
    await storyHud.fade(null, 0.8);
  }

  async function askCave() {
    if (modalOpen) return;
    modalOpen = true;
    input.clear();
    stick.reset();
    const yes = await confirm.ask({ title: '晶冠峡谷〈結晶の谷〉へ進みますか？', note: 'この先は、蒼響の洞穴を通る巡礼路です。' });
    modalOpen = false;
    input.clear();
    if (yes) travel('cave', 'caveEntry');
  }

  function handleAction(name) {
    if (name.startsWith('toast:')) {
      storyHud.toast(name.slice(6));
      return;
    }
    if (name.startsWith('resonate:')) {
      // 共鳴器：音の高さと震えの強さで、どれか分かる
      const cue = RESONATE[name.split(':')[2]];
      built?.handleAction(name);
      sound.play({ name: 'crystal', group: 'ui', rate: cue.rate });
      followCamera.shake(cue.shake);
      return;
    }
    if (name.startsWith('beam:') || name.startsWith('reflector')) sound.play({ name: 'crystal', group: 'ui' });
    if (built?.handleAction(name)) {
      if (['divertWater', 'lowerBridge', 'unclamp'].includes(name)) {
        sound.play({ name: 'charge', group: 'beast' });
        followCamera.shake(0.3);
      }
    }
    switch (name) {
      case 'rest':
        actions.reset();
        // 振りの番号も最初からになるので、当たった記録も消す（消さないと休んだあと斬っても当たらない）
        hitSwings.clear();
        resetEnemies();
        storyHud.toast('残響の碑で休んだ（体力が戻った）');
        sound.play({ name: 'crystal', group: 'ui' });
        break;
      case 'askCave':
        askCave();
        break;
      case 'toCrystal':
        travel('crystal', 'crystalEntry');
        break;
      case 'toFrost':
        travel('frost', 'frostEntry');
        break;
      case 'toAsh':
        travel('ash', 'ashEntry');
        break;
      case 'calmWind':
      case 'memoryLight':
        sound.play({ name: 'crystal', group: 'ui' });
        break;
      case 'fitPlate':
        sound.play({ name: 'crystal', group: 'ui' });
        break;
      case 'raiseShutters':
      case 'thawSluice':
      case 'drainWater':
      case 'breakPortcullis':
      case 'dropChain':
      case 'pushTimber':
      case 'bridgeForm':
      case 'raiseLift':
      case 'openCrownGate':
        sound.play({ name: 'charge', group: 'beast' });
        followCamera.shake(0.4);
        break;
      case 'song':
        sound.play({ name: 'crystal', group: 'ui', rate: 1.5 });
        break;
      case 'resonatorReset':
        sound.play({ name: 'shatter', group: 'ui', rate: 0.7 });
        break;
      // ボスの登場：足もとの震え → 奥の結晶が順に光る（build）→ 立ち上がる → 名前 → 戦い
      case 'bossTremor':
        tremor = 1.6;
        sound.play({ name: 'slam', group: 'beast', rate: 0.6 });
        break;
      case 'bossCrystals':
        sound.play({ name: 'crystal', group: 'beast', rate: 0.8 });
        break;
      case 'bossRise':
        if (boss?.view) { bossRise = 0; boss.view.object.visible = true; }
        else if (boss) foeViews.reveal(boss.data.id);
        sound.play({ name: 'enrage', group: 'beast' });
        break;
      case 'bossReady':
        tremor = 0;
        if (boss?.view) { bossRise = 1; boss.view.object.visible = true; }
        else if (boss) foeViews.reveal(boss.data.id);
        break;
      case 'bossName':
        storyHud.showChapterTitle(boss?.data.name ?? '', 3);
        break;
      case 'bossStart':
        if (boss && !boss.logic.active()) {
          boss.logic.start();
          showBossBar(true);
          battleMusic.start();
        }
        break;
      case 'bossFade':
        battleMusic.finish();
        break;
      case 'voiceCut':
        // エリアの声が一瞬だけ途切れる
        storyHud.say({ speaker: 'エリア', text: '――' });
        sound.play({ name: 'crystal', group: 'ui', rate: 0.5 });
        break;
      case 'evolveStart':
        sound.play({ name: 'enrage', group: 'beast' });
        break;
      case 'evolveRust':
        sparkTime = 0;
        sound.play({ name: 'shatter', group: 'beast' });
        break;
      case 'evolveRunes':
        sound.play({ name: 'crystal', group: 'beast' });
        break;
      case 'evolveEnd':
        applyWeapon(true);
        actions.setAttack(attackPower({ evolved: true }));
        break;
      case 'weaponName':
        storyHud.showChapterTitle('誓剣ルーメン', 3.4);
        sound.play({ name: 'win', group: 'ui' });
        break;
      default:
        break;
    }
  }

  function applyOutput(next) {
    for (const name of next.actions) handleAction(name);
    if (next.objective !== shownObjective) {
      storyHud.setObjective(next.objective);
      shownObjective = next.objective;
    }
    if (next.subtitle !== shownSubtitle) {
      if (next.subtitle) storyHud.say(next.subtitle);
      else storyHud.clearSubtitle();
      shownSubtitle = next.subtitle;
    }
    storyHud.setAdvance(next.waitingTap || next.inMemory);
    storyHud.setSkip(next.inMemory);
  }

  function canSee(colliders) {
    const boxes = colliders.filter((c) => c.type === 'box');
    return (ax, az, bx, bz) => {
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
      for (let i = 1; i < steps; i++) {
        const x = ax + ((bx - ax) * i) / steps;
        const z = az + ((bz - az) * i) / steps;
        for (const c of boxes) {
          const dx = x - c.x;
          const dz = z - c.z;
          const lx = dx * Math.cos(c.angle) - dz * Math.sin(c.angle);
          const lz = dx * Math.sin(c.angle) + dz * Math.cos(c.angle);
          if (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) return false;
        }
      }
      return true;
    };
  }

  const toCamera = new THREE.Vector3();
  function limitCamera(lookAt, position) {
    toCamera.subVectors(position, lookAt);
    const full = toCamera.length();
    raycaster.set(lookAt, toCamera.normalize());
    raycaster.far = full;
    const hit = raycaster.intersectObjects(built?.occluders ?? [], false)[0];
    return hit ? hit.distance - 0.35 : Infinity;
  }

  let debugView = null;
  function updateCamera(dt) {
    if (debugView) {
      camera.position.set(...debugView.position);
      camera.lookAt(...debugView.look);
      return;
    }
    // 地面：歩ける床と、エリアの地形（丘や斜面）のうち高い方より下へカメラを潜らせない
    const terrainAt = built?.groundAt;
    followCamera.update(player.object.position, dt, {
      limit: limitCamera,
      ground: (x, z) => {
        const floor = Math.min(heightHere(x, z), py() + 0.5);
        return terrainAt ? Math.max(floor, terrainAt(x, z) + 0.35) : floor;
      },
    });
  }

  // エリアの空気（霧と光）：エリアの mood と、トンネルの中かどうか
  function updateMood() {
    const base = MOODS[area.data.mood] ?? MOODS.rose;
    const inside = area.data.indoor?.(player.object.position) ? 1 : 0;
    const target = inside ? MOODS.tunnel : base;
    scene.fog.color.lerp(new THREE.Color(target.fog), 0.06);
    scene.background.copy(scene.fog.color);
    scene.fog.density += (target.density - scene.fog.density) * 0.06;
    hemi.color.lerp(new THREE.Color(target.sky), 0.06);
    hemi.groundColor.lerp(new THREE.Color(target.ground), 0.06);
    hemi.intensity += (target.hemi - hemi.intensity) * 0.06;
    sun.color.lerp(new THREE.Color(target.sun), 0.06);
    sun.intensity += (target.sunIntensity - sun.intensity) * 0.06;
    sun.position.copy(player.object.position).add(SUN_OFFSET);
    sun.target.position.copy(player.object.position);
    lantern.intensity += ((target.lantern ?? 0) - lantern.intensity) * 0.06;
    lantern.position.copy(player.object.position).add(headPoint.set(0, 2.2, 0));
  }

  // ボスを、ロックオン・向き直りの相手として扱う（衛兵・谷の敵と同じ形）
  const bossTarget = {
    id: 'boss',
    alive: () => Boolean(boss?.view && boss.logic.active()),
    position: () => boss.logic.frame().position,
  };

  // 近い相手（霧の衛兵・谷の敵・ボス）
  function nearestGuard(range) {
    const p = player.object.position;
    let best = null;
    for (const guard of guards) {
      if (!guard.alive()) continue;
      const g = guard.position();
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d <= range && Math.abs(enemyPostY(guard.id) - p.y) < 2 && (!best || d < best.d)) best = { guard, d };
    }
    const foe = foes?.nearest({ x: p.x, z: p.z, y: p.y }, range);
    if (foe && (!best || foe.d < best.d)) best = { guard: foe.enemy, d: foe.d };
    if (bossTarget.alive()) {
      // 体の中心から、胴の長さの分だけ近くに数える
      const b = bossTarget.position();
      const d = Math.max(0, Math.hypot(b.x - p.x, b.z - p.z) - 4);
      if (d <= range && (!best || d < best.d)) best = { guard: bossTarget, d };
    }
    return best?.guard ?? null;
  }

  function hurtPlayer(damage) {
    if (!actions.takeHit(damage)) return false;
    sound.play({ name: 'hurt', group: 'player' });
    followCamera.shake(0.8);
    return true;
  }

  const projected = new THREE.Vector3();
  function toScreen(x, y, z) {
    projected.set(x, y, z).project(camera);
    if (projected.z > 1 || projected.z < -1) return null;
    return { x: ((projected.x + 1) / 2) * window.innerWidth, y: ((1 - projected.y) / 2) * window.innerHeight };
  }

  function nearestInteractable(x, z, y, available) {
    let best = null;
    for (const id of available) {
      const spot = area.data.interactables[id];
      if (!spot || Math.abs((spot.y ?? 0) - y) > 1.6) continue;
      const d = Math.hypot(x - spot.x, z - spot.z);
      if (d <= spot.radius && (!best || d < best.d)) best = { id, d };
    }
    return best?.id ?? null;
  }

  // 谷の敵・壊せる物・ボスを斬る（1回の振りで、それぞれ一度だけ）
  function swingAtFoes(sword, swing, signals) {
    const p = player.object.position;
    const stat = { attack: actions.attack(), power: swing.power, critical: nextRandom() < CRIT_CHANCE, y: p.y };
    let landed = false;
    for (const result of foes?.swordHit(sword, stat) ?? []) {
      landed = true;
      if (result.web) { sound.play({ name: 'shatter', group: 'ui', rate: 1.4 }); continue; }
      if (result.airborne) continue;
      foeViews.hitFlash(result.id, result.blocked ? '#7fc8ff' : '#ffffff');
      sound.play({ name: result.blocked ? 'click' : 'hit', group: 'beast' });
      if (result.guardBreak) { storyHud.toast('盾を崩した！'); followCamera.shake(0.4); }
      const point = toScreen(result.x, result.y + 2.1, result.z);
      if (point && result.damage) combatHud.showDamage(point, result.damage);
    }
    for (const b of breakables) {
      if (b.left <= 0 || Math.abs(b.y - p.y) > 2 || !sectorHitsCircle(sword, b)) continue;
      landed = true;
      b.left -= computeDamage({ attack: stat.attack, power: stat.power });
      sound.play({ name: 'shatter', group: 'beast', rate: b.left > 0 ? 1.3 : 0.9 });
      if (b.left <= 0) {
        progress.set(b.flag);
        signals.broken.push(b.id);
      }
    }
    if (boss?.view) {
      const result = boss.logic.swordHit(sword, stat, boss.view.colliders);
      if (result) {
        landed = true;
        boss.view.hitFlash({ x: p.x + Math.sin(facing) * 1.2, z: p.z + Math.cos(facing) * 1.2 });
        sound.play({ name: 'hit', group: 'beast' });
        if (result.stagger) sound.play({ name: 'stagger', group: 'beast' });
        if (result.enraged) sound.play({ name: 'enrage', group: 'beast' });
        const b = boss.logic.frame().position;
        const point = toScreen(b.x, 2.8, b.z);
        if (point) combatHud.showDamage(point, result.damage);
      }
    }
    if (landed) hitSwings.add(swing.id);
  }

  // 谷の敵：はじめて出会った種類は、名前と対処法を短く知らせる
  function updateFoes(dt, time, playerPos, sight, signals) {
    if (!foes) return;
    const p = player.object.position;
    const out = foes.update(dt, {
      player: { ...playerPos, y: p.y },
      canSee: sight,
      stepFor: (y) => (pos, dir, distance) => stepPosition(pos, dir, distance, [...level().colliders(flags, y), ...foes.wallColliders(y), { x: p.x, z: p.z, radius: 0.35 }], (x, z) => level().walkable(x, z, y, flags)),
      hitPlayer: (damage) => hurtPlayer(damage),
    });
    signals.noticed.push(...out.noticed);
    for (const id of out.noticed) {
      const def = area.data.foes[foes.postOf(id).type];
      const key = `foe:${def.kind}`;
      if (!progress.seen(key)) {
        progress.markSeen(key);
        storyHud.toast(`${def.elite ? '精鋭　' : ''}${def.name}：${def.counter}`);
      }
    }
    for (const frameOf of out.frames) for (const event of frameOf.events) if (event.type === 'wallHit') followCamera.shake(0.5);
    signals.defeated.push(...foes.takeDefeated());
    foeViews.update(dt, out.frames, time, { hazards: foes.hazards(), walls: foes.walls() });
  }

  // ボス：登場の間は立ち上がる動きだけ、戦いが始まったら頭脳を進める
  function updateBoss(dt, time, playerPos, signals, playerDead) {
    if (!boss) return;
    if (tremor > 0) {
      tremor = Math.max(0, tremor - dt);
      followCamera.shake(0.12);
    }
    // 共通の頭脳のボス：動きと当たりは foes が進める。ここでは体力のバーと曲だけ
    if (boss.foe) {
      const f = boss.logic.frame();
      if (boss.logic.active()) {
        combatHud.setBeast(f.hp / boss.logic.maxHp, f.enraged);
        battleMusic.update(f.hp / boss.logic.maxHp);
      } else if (boss.logic.down() && root.classList.contains('story-boss')) {
        showBossBar(false);
      }
      return;
    }
    const fighting = boss.logic.active() || boss.logic.down();
    const result = boss.logic.update(dt, playerDead ? { x: 1e4, z: 1e4 } : playerPos, (damage) => hurtPlayer(damage));
    boss.view.apply(result, time);
    if (!fighting) {
      // 待機：奥で伏せている。登場で地面からせり上がる
      if (bossRise >= 0 && bossRise < 1) bossRise = Math.min(1, bossRise + dt / RISE_TIME);
      const t = bossRise < 0 ? 0 : smooth(bossRise);
      boss.view.object.position.y -= (1 - t) * 3.2;
      boss.view.object.visible = bossRise >= 0;
    }
    boss.telegraphs.sync(result.attack, result.enraged);
    for (const event of result.events) {
      if (event.type === 'shake') followCamera.shake(event.strength);
      if (event.type === 'defeated') {
        signals.defeated.push(boss.data.id);
        showBossBar(false);
      }
    }
    if (boss.logic.active()) {
      combatHud.setBeast(result.hp / boss.logic.maxHp, result.enraged);
      battleMusic.update(result.hp / boss.logic.maxHp);
    }
  }

  function update(dt, time) {
    if (!active || !director || !built || loading) return;
    const presses = input.takePresses();
    const control = input.read();
    const frozen = !out.control || out.blocking || dying > 0 || respawning || modalOpen;
    applyWeapon(progress.flag('evolved'));
    if (actions.attack() !== attackPower({ evolved: progress.flag('evolved') })) actions.setAttack(attackPower({ evolved: progress.flag('evolved') }));

    if (!frozen && presses.has('lock')) {
      lockTarget = lockTarget ? null : nearestGuard(LOCK_RANGE);
      followCamera.setLock(lockTarget ? lockTarget.position() : null);
      if (!lockTarget) combatHud.setReticle(null);
    }
    if (lockTarget && !lockTarget.alive()) {
      lockTarget = null;
      followCamera.setLock(null);
      combatHud.setReticle(null);
    }

    const p = player.object.position;
    const move = frozen ? { x: 0, z: 0 } : moveToWorld(control.moveX, control.moveZ, followCamera.yaw());
    // 蜘蛛の糸の中では遅くなる
    const slow = foes ? foes.slowAt(p.x, p.z, p.y) : 1;
    move.x *= slow;
    move.z *= slow;
    const near = lockTarget ?? nearestGuard(FACE_RANGE);
    const frame = actions.update(dt, {
      move,
      run: !frozen && control.run,
      attack: !frozen && presses.has('attack'),
      dodge: !frozen && presses.has('dodge'),
      target: near ? near.position() : null,
      self: { x: p.x, z: p.z },
      facing,
      lockOn: Boolean(lockTarget),
    });
    if (frame.face !== null) facing = frame.face;
    else if (frame.move.speed > 0) facing = Math.atan2(frame.move.x, frame.move.z);

    const world = level().colliders(flags, p.y);
    const guardCircles = guards.filter((g) => g.alive() && Math.abs(enemyPostY(g.id) - p.y) < 2).map((g) => ({ ...g.position(), radius: 0.45 }));
    if (foes) guardCircles.push(...foes.colliders(p.y));
    if (boss?.view?.object.visible && !boss.logic.down()) guardCircles.push(...boss.view.colliders);
    if (foes) guardCircles.push(...foes.wallColliders(p.y));
    player.drive(dt, frame, [...world, ...guardCircles], heightHere, walkableHere);
    const freed = pushOut(p, guardCircles);
    if (walkableHere(freed.x, freed.z)) {
      p.x = freed.x;
      p.z = freed.z;
    }

    const animation = player.currentAnimation();
    if (animation !== lastAnimation) {
      if (SWING_SOUND[animation]) sound.play({ name: SWING_SOUND[animation], group: 'player' });
      if (animation?.startsWith('Dodge')) sound.play({ name: 'dodge', group: 'player' });
      lastAnimation = animation;
    }
    if (frame.mode === 'free' && frame.move.speed > 0) {
      stepTimer -= dt;
      if (stepTimer <= 0) {
        sound.play({ name: 'step', group: 'player' });
        stepTimer = frame.move.speed > 4 ? 0.32 : 0.5;
      }
    } else {
      stepTimer = 0;
    }

    // ── 斬撃：防御・会心を計算（霧の衛兵は防御 0） ──
    const signals = { zones: [], interact: null, noticed: [], defeated: [], broken: [], advance: false, skip: false, bossActive: Boolean(boss?.logic.active()) };
    if (frame.swing && !hitSwings.has(frame.swing.id)) {
      const sword = { type: 'sector', x: p.x, z: p.z, angle: facing, ...SWORD };
      swingAtFoes(sword, frame.swing, signals);
      for (const guard of guards) {
        if (!guard.alive() || Math.abs(enemyPostY(guard.id) - p.y) > 2) continue;
        const g = guard.position();
        if (!sectorHitsCircle(sword, { x: g.x, z: g.z, radius: 0.45 })) continue;
        hitSwings.add(frame.swing.id);
        const critical = nextRandom() < CRIT_CHANCE;
        const damage = computeDamage({ attack: actions.attack(), power: frame.swing.power, defense: 0, critical });
        if (guard.takeDamage(damage)) signals.defeated.push(guard.id);
        guardViews.hitFlash(guard.id);
        sound.play({ name: 'hit', group: 'beast' });
        const point = toScreen(g.x, enemyPostY(guard.id) + 2.1, g.z);
        if (point) combatHud.showDamage(point, damage);
      }
    }

    const sight = canSee(world);
    const playerPos = frame.mode === 'dead' ? { x: 1e4, z: 1e4 } : { x: p.x, z: p.z };
    const frames = guards.map((guard) => {
      const others = guards.filter((o) => o !== guard && o.alive()).map((o) => o.position());
      const gy = enemyPostY(guard.id);
      const step = (pos, dir, distance) => stepPosition(pos, dir, distance, [...level().colliders(flags, gy), { x: p.x, z: p.z, radius: 0.35 }], (x, z) => level().walkable(x, z, gy, flags));
      const sameLevel = Math.abs(gy - p.y) < 2;
      const g = guard.update(dt, { player: sameLevel ? playerPos : { x: 1e4, z: 1e4 }, canSee: sight, step, others });
      signals.noticed.push(...g.events.filter((e) => e.type === 'noticed').map((e) => e.id));
      if (sameLevel && g.strike && shapeContains(g.strike, p) && actions.takeHit(g.strike.damage)) {
        sound.play({ name: 'hurt', group: 'player' });
        followCamera.shake(0.8);
      }
      return g;
    });
    guardViews.update(dt, frames, time);
    updateFoes(dt, time, playerPos, sight, signals);
    updateBoss(dt, time, playerPos, signals, frame.mode === 'dead');

    for (const [id, zone] of Object.entries(area.data.zones)) {
      if (Math.hypot(p.x - zone.x, p.z - zone.z) <= zone.radius && Math.abs((zone.y ?? 0) - p.y) < 2) signals.zones.push(id);
    }
    const target = frozen ? null : nearestInteractable(p.x, p.z, p.y, out.interactables);
    storyHud.showInteract(target ? area.data.interactables[target].label : null);
    if (target && (interactRequested || presses.has('interact'))) signals.interact = target;
    signals.advance = advanceRequested;
    signals.skip = skipRequested;
    interactRequested = false;
    advanceRequested = false;
    skipRequested = false;

    out = director.update(dt, signals);
    readFlags();
    applyOutput(out);

    if (frame.mode === 'dead') {
      dying += dt;
      if (dying >= RESPAWN_DELAY) respawn();
    }

    updateCamera(dt);
    if (lockTarget) {
      const g = lockTarget.position();
      followCamera.setLock(g);
      combatHud.setReticle(toScreen(g.x, enemyPostY(lockTarget.id) + 1.4, g.z));
    }
    if (!out.inMemory) player.object.visible = camera.position.distanceTo(headPoint.set(p.x, p.y + 1.3, p.z)) > 0.9;
    updateMood();
    updateSparks(dt);
    built.update(time, dt, flags);
    hud.setVitals(frame.hp, frame.stamina);
    combatHud.update(dt);
    post.render();
  }

  function render() {
    if (built) post.render();
  }

  function setQuality(nextPreset) {
    post.setQuality(nextPreset);
    sun.castShadow = nextPreset.shadows;
    if (nextPreset.shadows && sun.shadow.mapSize.x !== nextPreset.shadowMapSize) {
      sun.shadow.mapSize.set(nextPreset.shadowMapSize, nextPreset.shadowMapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    scene.traverse((object) => { if (object.material) object.material.needsUpdate = true; });
  }

  const api = {
    start,
    stop,
    update,
    render,
    respawn,
    setQuality,
    resize: (w, h) => post.setSize(w, h),
    teleport: (x, z, y, face) => {
      player.object.position.set(x, y ?? player.object.position.y, z);
      player.object.position.y = level().heightAt(x, z, y ?? player.object.position.y, flags);
      if (face !== undefined) { facing = face; player.object.rotation.y = face; }
    },
    weakenBoss: (left) => boss?.logic.weaken(left),
    // 確認用（?debug）：谷の敵の体力を left 近くまで減らす（最後は本当に斬って倒す）
    weakenFoe: (id, left) => {
      const enemy = foes?.list().find((e) => e.id === id);
      if (!enemy || enemy.hp() <= left) return;
      const p = enemy.position();
      enemy.hit({ attack: ((enemy.hp() - left) * (100 + enemy.def.defense)) / 100, power: 1, from: { x: p.x, z: p.z - 1 } });
    },
    view: (position, look) => { debugView = position ? { position, look } : null; },
    debug: () => ({ scene, area: area?.data.id, player: player.object.position, out, progress, flags, attack: actions.attack(), hp: actions.hp(), guards: guards.map((g) => ({ id: g.id, ...g.position(), alive: g.alive() })), foes: foes?.list().map((e) => ({ id: e.id, kind: e.def.kind, ...e.position(), alive: e.alive(), height: e.height(), hp: e.hp() })) ?? [], breakables: breakables.map((b) => ({ id: b.id, left: b.left })), boss: boss ? { active: boss.logic.active(), down: boss.logic.down(), hp: boss.logic.frame().hp, ...boss.logic.frame().position, body: boss.view ? boss.view.colliders.map((c) => ({ ...c })) : [{ ...boss.logic.frame().position, radius: boss.logic.radius }] } : null }),
    modalOpen: () => modalOpen,
  };
  return api;
}
