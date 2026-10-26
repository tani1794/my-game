// 第一章（物語パート）をまとめて動かす：入力 → 主人公 → 衛兵 → 進行役（会話・出来事）→ 見た目 → 描画。
// 主人公は結晶獣戦と同じ knight.glb・同じ playerActions（移動・3段攻撃・回避）。
import * as THREE from 'three';
import { createPlayer, moveToWorld, pushOut, stepPosition } from '../player.js';
import { createPlayerActions } from '../combat/playerActions.js';
import { sectorHitsCircle, shapeContains } from '../combat/shapes.js';
import { createPost } from '../world/post.js';
import { createGuard, GUARD } from '../story/guard.js';
import { createDirector } from '../story/director.js';
import { CHAPTER_TITLE } from '../story/script.js';
import { createMaterials } from './materials.js';
import { createForest } from './forest.js';
import { createChapel } from './chapel.js';
import { createGuardViews } from './guards.js';
import {
  heightAt, walkable, collidersFor, nearestInteractable, inZone,
  CHECKPOINTS, ZONES, INTERACTABLES, GUARD_POSTS, CHAPEL,
} from './layout.js';
import { asset } from '../paths.js';

const SWORD = { radius: 1.6, spread: (120 * Math.PI) / 180 };
const GUARD_RADIUS = 0.45;
const LOCK_RANGE = 12;
const FACE_RANGE = 5;
const RESPAWN_DELAY = 1.8;
const SWING_SOUND = {
  '1H_Melee_Attack_Slice_Diagonal': 'swing1',
  '1H_Melee_Attack_Slice_Horizontal': 'swing2',
  '1H_Melee_Attack_Chop': 'swing3',
};

const MOODS = {
  forest: { fog: new THREE.Color('#7f8d82'), density: 0.026, sky: new THREE.Color('#c8d4c2'), ground: new THREE.Color('#3a3a2c'), hemi: 2.1, sun: new THREE.Color('#f2f4e6'), sunIntensity: 2.2 },
  chapel: { fog: new THREE.Color('#959ca2'), density: 0.022, sky: new THREE.Color('#ccd3da'), ground: new THREE.Color('#38393b'), hemi: 1.8, sun: new THREE.Color('#e2e8ef'), sunIntensity: 1.6 },
  interior: { fog: new THREE.Color('#596067'), density: 0.02, sky: new THREE.Color('#a6b0ba'), ground: new THREE.Color('#2c2d31'), hemi: 0.75, sun: new THREE.Color('#dde4ec'), sunIntensity: 1.2 },
  memory: { fog: new THREE.Color('#a99474'), density: 0.02, sky: new THREE.Color('#f2dcc0'), ground: new THREE.Color('#4a3c2e'), hemi: 1.1, sun: new THREE.Color('#ffd9a8'), sunIntensity: 1.6 },
};

const smooth = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

function insideChapel(x, z) {
  return x > CHAPEL.x - CHAPEL.halfWidth && x < CHAPEL.x + CHAPEL.halfWidth && z < CHAPEL.front && z > CHAPEL.back - CHAPEL.apseRadius;
}

export function createChapterRunner({ renderer, followCamera, input, stick, hud, combatHud, storyHud, sound, preset, lite = false, onToCrystal }) {
  const scene = new THREE.Scene();
  const camera = followCamera.camera;
  const post = createPost(renderer, scene, camera, preset);

  // ── 光と霧 ──
  scene.fog = new THREE.FogExp2(MOODS.forest.fog.clone(), MOODS.forest.density);
  scene.background = MOODS.forest.fog.clone();
  const hemi = new THREE.HemisphereLight(MOODS.forest.sky.clone(), MOODS.forest.ground.clone(), MOODS.forest.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(MOODS.forest.sun.clone(), MOODS.forest.sunIntensity);
  const SUN_OFFSET = new THREE.Vector3(-18, 40, 12);
  for (const side of ['left', 'bottom']) sun.shadow.camera[side] = -16;
  for (const side of ['right', 'top']) sun.shadow.camera[side] = 16;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.castShadow = preset.shadows;
  sun.shadow.mapSize.set(preset.shadowMapSize || 1024, preset.shadowMapSize || 1024);
  scene.add(sun, sun.target);
  let memoryAmount = 0;

  // ── 主人公（結晶獣戦と同じモデル・同じ行動） ──
  const player = createPlayer(scene);
  player.load(asset('models/knight.glb'));
  const actions = createPlayerActions();
  let facing = Math.PI;
  const hitSwings = new Set();
  let lastAnimation = null;
  let stepTimer = 0;

  // ── 衛兵 ──
  const guards = GUARD_POSTS.map((post) => createGuard(post));
  let guardViews = null;

  // ── 世界（読み込みは最初の一度だけ） ──
  let forest = null;
  let chapel = null;
  let occluders = [];
  let building = null;
  function build() {
    building ??= (async () => {
      const materials = createMaterials();
      chapel = createChapel(scene, materials);
      forest = await createForest(scene, materials, { lite });
      guardViews = await createGuardViews(scene, GUARD_POSTS, heightAt);
      occluders = [...forest.occluders, ...chapel.occluders];
      scene.updateMatrixWorld(true);
    })();
    return building;
  }

  // ── 進行 ──
  let progress = null;
  let director = null;
  let out = { control: true, blocking: false, waitingTap: false, inMemory: false, subtitle: null, objective: null, interactables: [], actions: [] };
  let shownSubtitle = null;
  let shownObjective;
  let active = false;
  let dying = 0;
  let respawning = false;
  let lockTarget = null;
  let advanceRequested = false;
  let skipRequested = false;
  let interactRequested = false;
  let cinematic = null; // { kind: 'wake' | 'blend', t }
  const raycaster = new THREE.Raycaster();

  storyHud.onAdvance(() => { advanceRequested = true; });
  storyHud.onSkip(() => { skipRequested = true; });
  storyHud.onInteract(() => { interactRequested = true; });
  window.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.key === 'Enter' && out.waitingTap) advanceRequested = true;
  });

  // 保存から、門・巻き上げ機・倒した衛兵の状態を作り直す
  function applyWorld() {
    forest.gate.setOpen(progress.flag('gateOpen'), false);
    if (progress.flag('winchFreed')) forest.winch.clearRubble(false);
    if (progress.flag('gateOpen')) forest.winch.pullLever(false);
    for (const guard of guards) {
      guard.reset();
      if (progress.defeated(guard.id)) {
        guard.takeDamage(GUARD.hp);
        guardViews.hide(guard.id);
      }
    }
  }

  function placeAtCheckpoint() {
    const point = CHECKPOINTS[progress.checkpoint()] ?? CHECKPOINTS.start;
    player.object.position.set(point.x, heightAt(point.x, point.z), point.z);
    player.object.rotation.y = point.facing;
    facing = point.facing;
    followCamera.setYaw(point.facing - Math.PI);
    followCamera.setLock(null);
    lockTarget = null;
    actions.reset();
    hitSwings.clear();
    dying = 0;
  }

  async function start(nextProgress) {
    progress = nextProgress;
    active = true;
    storyHud.setVisible(true);
    storyHud.clearLog();
    storyHud.setObjective(null);
    storyHud.clearSubtitle();
    await storyHud.fade('black', 0.01);
    await build();
    applyWorld();
    placeAtCheckpoint();
    director = createDirector(progress);
    out = director.begin();
    shownObjective = undefined;
    applyOutput(out);
    if (!out.control) {
      cinematic = { kind: 'wake', t: 0 };
    } else {
      storyHud.fade(null, 1.2);
    }
  }

  function stop() {
    active = false;
    storyHud.setVisible(false);
    storyHud.setAdvance(false);
    storyHud.showInteract(null);
    combatHud.setReticle(null);
    followCamera.setLock(null);
  }

  // 倒れたとき・やり直すとき：直前の復帰地点へ。出来事の結果はそのまま
  async function respawn() {
    if (respawning) return;
    respawning = true;
    await storyHud.fade('black', 0.6);
    director.respawn();
    applyWorld();
    placeAtCheckpoint();
    out = director.update(0, { zones: [], interact: null, noticed: [], defeated: [], advance: false, skip: false });
    applyOutput(out);
    cinematic = null;
    respawning = false;
    await storyHud.fade(null, 0.8);
  }

  function handleAction(name) {
    if (name.startsWith('toast:')) {
      storyHud.toast(name.slice(6));
      return;
    }
    switch (name) {
      case 'wakeIntro':
        cinematic = { kind: 'wake', t: 0 };
        storyHud.fade(null, 2.6);
        break;
      case 'lookAround':
        if (cinematic) cinematic.look = 0;
        break;
      case 'control':
        if (cinematic) cinematic = { kind: 'blend', t: 0, from: { position: camera.position.clone(), quaternion: camera.quaternion.clone() } };
        break;
      case 'chapterTitle':
        storyHud.showChapterTitle(CHAPTER_TITLE);
        break;
      case 'clearRubble':
        forest.winch.clearRubble(true);
        sound.play({ name: 'stagger', group: 'beast' });
        break;
      case 'openGate':
        forest.winch.pullLever(true);
        forest.gate.setOpen(true, true);
        sound.play({ name: 'charge', group: 'beast' });
        followCamera.shake(0.4);
        break;
      case 'memoryStart':
        storyHud.fade('white', 0.8).then(() => { memoryAmount = 1; chapel.setMemory(1); storyHud.fade(null, 1.2); });
        break;
      case 'bell':
        sound.bell();
        break;
      case 'memoryEnd':
        storyHud.fade('white', 0.5).then(() => { memoryAmount = 0; chapel.setMemory(0); storyHud.fade(null, 1); });
        break;
      case 'chapterComplete':
        storyHud.showChapterTitle(`${CHAPTER_TITLE}　― 完 ―`, 4.2);
        break;
      case 'toCrystal':
        onToCrystal?.();
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

  // 見通し：途中に壁（箱の当たり判定）があれば見えない
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

  // 注視点からカメラまでで、壁・幹・屋根に当たる手前の距離
  const toCamera = new THREE.Vector3();
  function limitCamera(lookAt, position) {
    toCamera.subVectors(position, lookAt);
    const full = toCamera.length();
    raycaster.set(lookAt, toCamera.normalize());
    raycaster.far = full;
    const hit = raycaster.intersectObjects(occluders, false)[0];
    return hit ? hit.distance - 0.35 : Infinity;
  }

  // 目覚めの演出のカメラ：地面 → 手 → 王冠（頭）へ視線を上げる
  const cinPosition = new THREE.Vector3();
  const cinLook = new THREE.Vector3();
  const wakeKeys = [
    { t: 0, pos: [1.6, 2.6, 1.2], look: [1.2, 0.1, 0] },
    { t: 3.2, pos: [2.6, 1.5, 1.4], look: [0, 1.0, 0] },
    { t: 6.4, pos: [3.2, 1.9, 1.1], look: [0, 1.7, 0] },
  ];
  function wakePose(t) {
    const p = player.object.position;
    const f = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    const r = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing));
    let a = wakeKeys[0];
    let b = wakeKeys[0];
    for (let i = 0; i < wakeKeys.length; i++) {
      if (t >= wakeKeys[i].t) { a = wakeKeys[i]; b = wakeKeys[Math.min(i + 1, wakeKeys.length - 1)]; }
    }
    const k = b.t > a.t ? smooth((t - a.t) / (b.t - a.t)) : 1;
    const mix = (u, v) => u + (v - u) * k;
    const [pf, py, pr] = [0, 1, 2].map((i) => mix(a.pos[i], b.pos[i]));
    const [lf, ly, lr] = [0, 1, 2].map((i) => mix(a.look[i], b.look[i]));
    cinPosition.copy(p).addScaledVector(f, pf).addScaledVector(r, pr);
    cinPosition.y += py;
    cinLook.copy(p).addScaledVector(f, lf).addScaledVector(r, lr);
    cinLook.y += ly;
  }

  let debugView = null;
  function updateCamera(dt) {
    const options = { limit: limitCamera, ground: heightAt };
    if (debugView) {
      camera.position.set(...debugView.position);
      camera.lookAt(...debugView.look);
      return;
    }
    // 記憶の場面：身廊の中から、祭壇脇の壁画を映す
    if (out.inMemory) {
      const floorY = heightAt(CHAPEL.x, -88);
      followCamera.update(player.object.position, dt, options);
      camera.position.set(CHAPEL.x - 1.6, floorY + 2.1, INTERACTABLES.mural.z + 3.6);
      camera.lookAt(CHAPEL.x - CHAPEL.halfWidth + 0.8, floorY + 2.4, INTERACTABLES.mural.z);
      return;
    }
    if (cinematic?.kind === 'wake') {
      cinematic.t += dt;
      wakePose(cinematic.t);
      camera.position.copy(cinPosition);
      camera.lookAt(cinLook);
      followCamera.update(player.object.position, 0, options);
      camera.position.copy(cinPosition);
      camera.lookAt(cinLook);
      return;
    }
    followCamera.update(player.object.position, dt, options);
    if (cinematic?.kind === 'blend') {
      cinematic.t += dt / 1.4;
      const k = smooth(cinematic.t);
      camera.position.lerpVectors(cinematic.from.position, camera.position, k);
      camera.quaternion.slerpQuaternions(cinematic.from.quaternion, camera.quaternion.clone(), k);
      if (cinematic.t >= 1) cinematic = null;
    }
  }

  // 森 → 礼拝堂の前 → 中、で霧と光の色を変える
  const moodFog = new THREE.Color();
  function updateMood() {
    const { x, z } = player.object.position;
    const toChapel = smooth((-48 - z) / 14);
    const inside = insideChapel(x, z) ? 1 : 0;
    const blend = (key) => {
      const color = MOODS.forest[key].clone().lerp(MOODS.chapel[key], toChapel);
      if (key === 'density' || key === 'hemi' || key === 'sunIntensity') return null;
      return color.lerp(MOODS.interior[key], inside).lerp(MOODS.memory[key], memoryAmount);
    };
    const number = (key) => {
      const a = MOODS.forest[key] + (MOODS.chapel[key] - MOODS.forest[key]) * toChapel;
      const b = a + (MOODS.interior[key] - a) * inside;
      return b + (MOODS.memory[key] - b) * memoryAmount;
    };
    moodFog.copy(blend('fog'));
    scene.fog.color.lerp(moodFog, 0.08);
    scene.background.copy(scene.fog.color);
    scene.fog.density += (number('density') - scene.fog.density) * 0.08;
    hemi.color.lerp(blend('sky'), 0.08);
    hemi.groundColor.lerp(blend('ground'), 0.08);
    hemi.intensity += (number('hemi') - hemi.intensity) * 0.08;
    sun.color.lerp(blend('sun'), 0.08);
    sun.intensity += (number('sunIntensity') - sun.intensity) * 0.08;
    sun.position.copy(player.object.position).add(SUN_OFFSET);
    sun.target.position.copy(player.object.position);
  }

  function nearestGuard(range) {
    const p = player.object.position;
    let best = null;
    for (const guard of guards) {
      if (!guard.alive()) continue;
      const g = guard.position();
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d <= range && (!best || d < best.d)) best = { guard, d };
    }
    return best?.guard ?? null;
  }

  const projected = new THREE.Vector3();
  function toScreen(x, y, z) {
    projected.set(x, y, z).project(camera);
    if (projected.z > 1 || projected.z < -1) return null;
    return { x: ((projected.x + 1) / 2) * window.innerWidth, y: ((1 - projected.y) / 2) * window.innerHeight };
  }

  function update(dt, time) {
    if (!active || !director || !forest) return;
    const presses = input.takePresses();
    const control = input.read();
    const frozen = !out.control || out.blocking || dying > 0 || respawning || cinematic?.kind === 'wake';

    // 目覚めの演出中：見回す（主人公の向きを左右にゆっくり）
    if (cinematic?.kind === 'wake' && cinematic.look !== undefined) {
      cinematic.look += dt;
      player.object.rotation.y = facing + 0.55 * Math.sin(Math.min(cinematic.look, 2.4) * (Math.PI / 1.2));
    }

    // ── ロックオン ──
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

    // ── 主人公 ──
    const move = frozen ? { x: 0, z: 0 } : moveToWorld(control.moveX, control.moveZ, followCamera.yaw());
    const p = player.object.position;
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

    const world = collidersFor({ gateOpen: progress.flag('gateOpen') });
    const guardCircles = guards.filter((g) => g.alive()).map((g) => ({ ...g.position(), radius: GUARD_RADIUS, id: g.id }));
    if (cinematic?.kind !== 'wake') player.drive(dt, frame, [...world, ...guardCircles], heightAt, walkable);
    else player.drive(dt, { ...frame, move: { x: 0, z: 0, speed: 0 }, face: null }, world, heightAt, walkable);
    const freed = pushOut(p, guardCircles);
    p.x = freed.x;
    p.z = freed.z;

    // 音：振り始め・回避・足音
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

    // ── 斬撃：1回の振りで、当たった衛兵に1回だけ ──
    const signals = { zones: [], interact: null, noticed: [], defeated: [], advance: false, skip: false };
    if (frame.swing && !hitSwings.has(frame.swing.id)) {
      const sword = { type: 'sector', x: p.x, z: p.z, angle: facing, ...SWORD };
      for (const guard of guards) {
        if (!guard.alive()) continue;
        const g = guard.position();
        if (!sectorHitsCircle(sword, { x: g.x, z: g.z, radius: GUARD_RADIUS })) continue;
        hitSwings.add(frame.swing.id);
        if (guard.takeDamage(frame.swing.damage)) signals.defeated.push(guard.id);
        guardViews.hitFlash(guard.id);
        sound.play({ name: 'hit', group: 'beast' });
        const point = toScreen(g.x, heightAt(g.x, g.z) + 2.1, g.z);
        if (point) combatHud.showDamage(point, frame.swing.damage);
      }
    }

    // ── 衛兵 ──
    const sight = canSee(world);
    const playerPos = frame.mode === 'dead' ? { x: 1e4, z: 1e4 } : { x: p.x, z: p.z };
    const frames = guards.map((guard) => {
      const others = guards.filter((o) => o !== guard && o.alive()).map((o) => o.position());
      const step = (pos, dir, distance) => stepPosition(pos, dir, distance, [...world, { x: p.x, z: p.z, radius: 0.35 }], walkable);
      const g = guard.update(dt, { player: playerPos, canSee: sight, step, others });
      signals.noticed.push(...g.events.filter((e) => e.type === 'noticed').map((e) => e.id));
      if (g.strike && shapeContains(g.strike, p) && actions.takeHit(g.strike.damage)) {
        sound.play({ name: 'hurt', group: 'player' });
        followCamera.shake(0.8);
      }
      return g;
    });
    guardViews.update(dt, frames, time);

    // ── 場所・調べる・会話送り ──
    for (const [id, zone] of Object.entries(ZONES)) if (inZone(p.x, p.z, zone)) signals.zones.push(id);
    const target = frozen ? null : nearestInteractable(p.x, p.z, out.interactables);
    storyHud.showInteract(target ? INTERACTABLES[target].label : null);
    if (target && (interactRequested || presses.has('interact'))) signals.interact = target;
    signals.advance = advanceRequested;
    signals.skip = skipRequested;
    interactRequested = false;
    advanceRequested = false;
    skipRequested = false;

    out = director.update(dt, signals);
    applyOutput(out);

    // ── 倒れたら、少し待って復帰地点へ ──
    if (frame.mode === 'dead') {
      dying += dt;
      if (dying >= RESPAWN_DELAY) respawn();
    }

    // ── 見た目 ──
    updateCamera(dt);
    if (lockTarget) {
      const g = lockTarget.position();
      followCamera.setLock(g);
      combatHud.setReticle(toScreen(g.x, heightAt(g.x, g.z) + 1.4, g.z));
    }
    updateMood();
    forest.update(time, dt);
    chapel.update(time);
    hud.setVitals(frame.hp, frame.stamina);
    combatHud.update(dt);
    post.render();
  }

  // 止めている間・読み込み中の描き直し
  function render() {
    if (forest) post.render();
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

  // ?debug 用：カメラを好きな位置に置く（画面の確認用）。null で元に戻す
  function view(position, look) {
    debugView = position ? { position, look } : null;
  }

  // ?debug 用：主人公をその場所へ
  function teleport(x, z) {
    player.object.position.set(x, heightAt(x, z), z);
  }

  return {
    start,
    stop,
    update,
    render,
    respawn,
    setQuality,
    resize: (w, h) => post.setSize(w, h),
    preload: build,
    teleport,
    view,
    debug: () => ({ player: player.object.position, out, progress, guards: guards.map((g) => ({ id: g.id, ...g.position(), alive: g.alive() })) }),
    clearInput: () => { stick.reset(); },
  };
}
