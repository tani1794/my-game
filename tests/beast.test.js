import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createBeast, createFallbackBeast, slamBody } from '../src/world/beast.js';

const flat = () => 0;

function heightOf(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  return box.max.y - box.min.y;
}

// 細長い箱を「AIで作った獣」の代わりにする
function fakeGltf() {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 1.8),
    new THREE.MeshStandardMaterial({ map: new THREE.Texture() }),
  ));
  return { scene: root };
}

test('読み込んだ獣は高さ5mにそろえて (0, -6) に置く', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  expect(heightOf(beast.object)).toBeCloseTo(5, 1);
  expect(beast.object.position.x).toBeCloseTo(0);
  expect(beast.object.position.z).toBeCloseTo(-6);
  expect(beast.collider).toEqual({ x: 0, z: -6, radius: 2.6 });
});

test('足元を地面の高さに合わせる', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', () => 0.4, async () => fakeGltf());
  beast.object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(beast.object);
  expect(box.min.y).toBeCloseTo(0.4, 2);
});

test('読み込みに失敗したら、コードで作る獣で続ける', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/missing.glb', flat, async () => { throw new Error('404'); });
  expect(beast.object.name).toBe('beast-fallback');
  expect(scene.getObjectByName('beast-fallback')).toBe(beast.object);
});

test('代わりの獣は高さ5mで、光る結晶が20本ほどある', () => {
  const beast = createFallbackBeast(flat);
  expect(heightOf(beast.object)).toBeGreaterThan(4);
  expect(heightOf(beast.object)).toBeLessThan(6);
  let crystals = 0;
  beast.object.traverse((o) => { if (o.name === 'beast-crystals') crystals = o.count; });
  expect(crystals).toBeGreaterThanOrEqual(18);
  expect(beast.collider).toEqual({ x: 0, z: -6, radius: 2.6 });
});

test('update(time) で呼吸し、結晶が明滅する', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  beast.update(0);
  const y0 = beast.object.scale.y;
  const glow0 = beast.glow();
  beast.update(0.5);
  expect(beast.object.scale.y).not.toBeCloseTo(y0, 5);
  expect(beast.glow()).not.toBeCloseTo(glow0, 5);
});

test('AIの獣は、テクスチャの青緑色の部分を発光させるシェーダーを持つ', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  let material;
  beast.object.traverse((o) => { if (o.isMesh) material = o.material; });
  const shader = {
    uniforms: {},
    fragmentShader: 'void main() {\n#include <emissivemap_fragment>\n}',
  };
  material.onBeforeCompile(shader);
  expect(shader.fragmentShader).toContain('uCrystalGlow');
  expect(shader.uniforms.uCrystalGlow).toBeDefined();
});

test('胴が長い獣は、前後にも当たり判定の円を並べて頭や尻尾をすり抜けない', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  // 箱は高さ0.8・奥行き1.8 → 高さ5mにそろえると奥行き約11m
  expect(beast.colliders.length).toBeGreaterThanOrEqual(3);
  expect(beast.colliders).toContainEqual(beast.collider);
  const zs = beast.colliders.map((c) => c.z);
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(5);
});

test('中身が空の獣モデルは、コードで作る獣に切り替え、当たり判定も正常な数値', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => ({ scene: new THREE.Group() }));
  expect(beast.object.name).toBe('beast-fallback');
  expect(beast.colliders.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.radius))).toBe(true);
});

test('逆光でも岩肌が見えるよう、AIの獣の色を明るく持ち上げ、ほんのり自ら光らせる', async () => {
  const scene = new THREE.Scene();
  const beast = await createBeast(scene, '/models/beast.glb', flat, async () => fakeGltf());
  let material;
  beast.object.traverse((o) => { if (o.isMesh) material = o.material; });
  expect(material.color.r).toBeCloseTo(1.4);
  expect(material.emissive.getHex()).not.toBe(0);
});

// ── 戦いの状態で動かす（Task 11） ──
const beastFrame = (over = {}) => ({
  phase: 'idle',
  position: { x: 0, z: -6 },
  facing: 0,
  attack: null,
  strikes: [],
  strikeKind: null,
  cue: null,
  enraged: false,
  hp: 2800,
  ...over,
});

test('apply で位置が変わると、当たり判定も同じだけ動く（配列は同じもののまま）', async () => {
  const beast = await createBeast(new THREE.Scene(), '/models/beast.glb', flat, async () => fakeGltf());
  const colliders = beast.colliders;
  const before = colliders.map((c) => ({ ...c }));
  beast.apply(beastFrame({ position: { x: 3, z: -2 } }), 1);
  expect(beast.colliders).toBe(colliders);
  colliders.forEach((c, i) => {
    expect(c.x - before[i].x).toBeCloseTo(3);
    expect(c.z - before[i].z).toBeCloseTo(4);
  });
  expect(beast.position).toEqual({ x: 3, z: -2 });
  expect(beast.object.position.x).toBeCloseTo(3);
});

test('向きが変わると、胴の前後の当たり判定も回る', async () => {
  const beast = await createBeast(new THREE.Scene(), '/models/beast.glb', flat, async () => fakeGltf());
  beast.apply(beastFrame({ facing: Math.PI / 2 }), 1);
  const xs = beast.colliders.map((c) => c.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5);
});

test('叩きつけは予告の間に頭側を持ち上げ、当たる瞬間（攻撃の始まり）に振り下ろして沈む', async () => {
  const beast = await createBeast(new THREE.Scene(), '/models/beast.glb', flat, async () => fakeGltf());
  beast.apply(beastFrame({ phase: 'telegraph', attack: { kind: 'slam', progress: 0.8, shapes: [] } }), 1);
  expect(beast.object.rotation.x).toBeLessThan(-0.1);
  beast.apply(beastFrame({ phase: 'strike', cue: { kind: 'slam', t: 0.05 } }), 1.1);
  expect(beast.object.rotation.x).toBeGreaterThan(0);
  beast.apply(beastFrame({ phase: 'strike', cue: { kind: 'slam', t: 1 } }), 1.6);
  expect(Math.abs(beast.object.rotation.x)).toBeLessThan(0.01);
});

test('倒れると横に倒れて沈み、結晶が消える（代わりの獣は結晶のメッシュを隠す。AIの獣は発光が0）', async () => {
  const fallback = createFallbackBeast(flat);
  fallback.apply(beastFrame({ phase: 'dead', cue: { kind: 'death', t: 1 } }), 1);
  expect(fallback.object.getObjectByName('beast-crystals').visible).toBe(false);
  expect(Math.abs(fallback.object.rotation.z)).toBeGreaterThan(1);

  const ai = await createBeast(new THREE.Scene(), '/models/beast.glb', flat, async () => fakeGltf());
  ai.apply(beastFrame({ phase: 'dead', cue: { kind: 'death', t: 1 } }), 1);
  expect(ai.glow()).toBe(0);
});

test('怒り状態では結晶の色が赤寄りになり、強く光る', async () => {
  const beast = await createBeast(new THREE.Scene(), '/models/beast.glb', flat, async () => fakeGltf());
  beast.apply(beastFrame(), 0);
  const calm = { color: beast.crystalColor().clone(), glow: beast.glow() };
  beast.apply(beastFrame({ enraged: true }), 0);
  expect(beast.crystalColor().r).toBeGreaterThan(calm.color.r + 0.1);
  expect(beast.glow()).toBeGreaterThan(calm.glow * 1.2);
});

test('hitFlash で一瞬白く光り、0.12 秒後には戻る。かけらが飛ぶ', async () => {
  const beast = await createBeast(new THREE.Scene(), '/models/beast.glb', flat, async () => fakeGltf());
  beast.apply(beastFrame(), 1);
  const base = beast.flashLevel();
  beast.hitFlash({ x: 0, z: -3 });
  beast.apply(beastFrame(), 1.01);
  expect(beast.flashLevel()).toBeGreaterThan(base + 0.5);
  expect(beast.object.getObjectByName('beast-shards').visible).toBe(true);
  beast.apply(beastFrame(), 1.2);
  expect(beast.flashLevel()).toBeCloseTo(0);
});

test('倒れた後に「もう一度」で戻ると、結晶がまた見える', () => {
  const beast = createFallbackBeast(flat);
  beast.apply(beastFrame({ phase: 'dead', cue: { kind: 'death', t: 1 } }), 1);
  beast.apply(beastFrame(), 2);
  expect(beast.object.getObjectByName('beast-crystals').visible).toBe(true);
  expect(beast.object.rotation.z).toBeCloseTo(0);
});

test('回転攻撃の間は、当たり判定も見えている体と同じ向きに回る', async () => {
  const beast = await createBeast(new THREE.Scene(), '/models/beast.glb', flat, async () => fakeGltf());
  beast.apply(beastFrame({ phase: 'strike', cue: { kind: 'spin', t: 0.5 } }), 1);
  const yaw = beast.object.rotation.y;
  const front = beast.colliders[1];
  const angle = Math.atan2(front.x - beast.position.x, front.z - beast.position.z);
  expect(Math.abs(Math.atan2(Math.sin(angle - yaw), Math.cos(angle - yaw)))).toBeLessThan(0.01);
});

// ── 関節のある結晶獣（beast-crystal.glb） ──
import { jointPose } from '../src/world/beast.js';

test('歩くと、左右の前脚が逆向きに振れる。止まっていれば振れない', () => {
  const walking = jointPose({ gait: Math.PI / 2, stride: 1, cue: null, phase: 'approach', time: 0 });
  expect(walking.fore_l_upper.x).toBeLessThan(-0.1);
  expect(walking.fore_r_upper.x).toBeGreaterThan(0.1);
  const still = jointPose({ gait: Math.PI / 2, stride: 0, cue: null, phase: 'idle', time: 0 });
  expect(Math.abs(still.fore_l_upper.x)).toBeLessThan(0.02);
});

test('叩きつけは予告の間に前脚を振り上げ、攻撃の終わりには地面へ戻す', () => {
  const raise = jointPose({ gait: 0, stride: 0, cue: null, slam: 0.4, phase: 'telegraph', time: 0 });
  const land = jointPose({ gait: 0, stride: 0, cue: { kind: 'slam', t: 1 }, slam: 1, phase: 'strike', time: 0 });
  expect(raise.fore_l_upper.x).toBeLessThan(-0.6);
  expect(Math.abs(land.fore_l_upper.x)).toBeLessThan(0.1);
});

test('予告の間はあごが開き、倒れると脚を崩して頭を垂れる', () => {
  expect(jointPose({ gait: 0, stride: 0, cue: null, phase: 'telegraph', time: 0 }).jaw.x).toBeGreaterThan(0.2);
  const dead = jointPose({ gait: 0, stride: 0, cue: { kind: 'death', t: 1 }, phase: 'dead', time: 0 });
  expect(Math.abs(dead.fore_l_upper.z)).toBeGreaterThan(0.3);
  expect(dead.head.x).toBeGreaterThan(0.2);
});

// 関節のある獣の代わり：体と、前脚・後脚の節（名前で見つける）
function fakeJointed() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  const rock = new THREE.MeshStandardMaterial({ name: 'beast_rock' });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 10), rock);
  torso.position.y = 3.5;
  body.add(torso);
  for (const name of ['fore_l_upper', 'fore_r_upper', 'hind_l_upper', 'hind_r_upper']) {
    const leg = new THREE.Group();
    leg.name = name;
    const limb = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), rock);
    limb.position.y = 1;
    leg.add(limb);
    body.add(leg);
  }
  const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5), new THREE.MeshStandardMaterial({ name: 'beast_crystal' }));
  crystal.position.y = 5.75;
  body.add(crystal);
  return { scene: root };
}

test('関節のある獣は、大きさを合わせ直さず（メートルのまま）、動くと脚の関節が振れる', async () => {
  const beast = await createBeast(new THREE.Scene(), '/beast-crystal.glb', flat, async () => fakeJointed());
  expect(heightOf(beast.object)).toBeCloseTo(6.5, 1);
  const frame = (z) => ({ position: { x: 0, z }, facing: 0, phase: 'approach', cue: null, enraged: false });
  for (let i = 0; i <= 30; i++) beast.apply(frame(-6 + i * 0.05), i / 30);
  const leg = beast.object.getObjectByName('fore_l_upper');
  const other = beast.object.getObjectByName('fore_r_upper');
  expect(Math.abs(leg.rotation.x) + Math.abs(other.rotation.x)).toBeGreaterThan(0.1);
});

// 叩きつけの重さ：身を沈める溜め → 後ろ足を地面に残して前を持ち上げる → 叩きつけて沈む → 反動 → 戻る
test('叩きつけ：はじめに身を沈め（頭が下がる）、持ち上げる間も後ろ足は地面に残る', () => {
  const crouch = slamBody(0.08, 2.6);
  expect(crouch.pitch).toBeGreaterThan(0);
  expect(crouch.sink).toBeGreaterThan(0.1);
  const rear = slamBody(0.4, 2.6);
  expect(rear.pitch).toBeLessThan(-15 * Math.PI / 180);
  // 体の回転（x 軸）で後ろ足の位置 (0, 0, -2.6) がどれだけ上下するか：持ち上げ分で打ち消す
  const footY = (b) => -(-2.6) * Math.sin(b.pitch) + b.lift - b.sink;
  expect(Math.abs(footY(rear))).toBeLessThan(0.05);
});

test('叩きつけ：振り下ろした直後は前へ沈み込み（反動）、最後は元の姿勢に戻る', () => {
  const impact = slamBody(0.53, 2.6);
  expect(impact.pitch).toBeGreaterThan(0);
  expect(impact.sink).toBeGreaterThan(0.1);
  const end = slamBody(1, 2.6);
  expect(Math.abs(end.pitch)).toBeLessThan(1e-6);
  expect(Math.abs(end.lift)).toBeLessThan(1e-6);
  expect(Math.abs(end.sink)).toBeLessThan(1e-6);
});
