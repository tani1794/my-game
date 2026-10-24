import { test, expect } from 'vitest';
import { moveToWorld, speedFor, stepPosition } from '../src/player.js';

test('yaw 0 で前進すると -z へ進む', () => {
  const d = moveToWorld(0, 1, 0);
  expect(d.x).toBeCloseTo(0);
  expect(d.z).toBeCloseTo(-1);
});

test('速さ：走りは6、スティック半分は1.5、倒し量は1で頭打ち', () => {
  expect(speedFor({ moveX: 0, moveZ: 1, run: true })).toBe(6);
  expect(speedFor({ moveX: 0, moveZ: 0.5, run: false })).toBeCloseTo(1.5);
  expect(speedFor({ moveX: 1, moveZ: 1, run: false })).toBeCloseTo(3);
});

test('岩に正面からぶつかると止まり、斜めなら壁沿いに滑る', () => {
  const rock = [{ x: 0, z: -1, radius: 0.5 }];
  expect(stepPosition({ x: 0, z: 0 }, { x: 0, z: -1 }, 0.2, rock)).toEqual({ x: 0, z: 0 });
  const slid = stepPosition({ x: 0, z: 0 }, { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, 0.2, rock);
  expect(slid.x).toBeGreaterThan(0);
  expect(slid.z).toBe(0);
});

test('移動範囲 28 の外には出ない', () => {
  expect(stepPosition({ x: 27.9, z: 0 }, { x: 1, z: 0 }, 1, []).x).toBe(27.9);
});

// ── 主人公のキャラクター（Task 10） ──
import * as THREE from 'three';
import { createPlayer } from '../src/player.js';

const still = { moveX: 0, moveZ: 0, run: false };
const walk = { moveX: 0, moveZ: 0.5, run: false };
const run = { moveX: 0, moveZ: 1, run: true };
const flat = () => 0;

// 高さ2.4の箱を「キャラクター」の代わりにし、3つのアニメーションを持たせる
function fakeKnight() {
  const scene = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), new THREE.MeshStandardMaterial());
  body.name = 'Knight_Body';
  body.position.y = 1.2;
  const cape = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), new THREE.MeshStandardMaterial());
  cape.name = 'Knight_Cape';
  scene.add(body, cape);
  const animations = ['Idle', 'Walking_A', 'Running_A'].map((name) => new THREE.AnimationClip(name, 1, []));
  return { scene, animations };
}

function heightOf(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  return box.max.y - box.min.y;
}

test('キャラクターを読み込むと、身長1.8mにそろえて仮の体を隠す', async () => {
  const player = createPlayer(new THREE.Scene());
  await player.load('/models/knight.glb', async () => fakeKnight());
  expect(player.object.getObjectByName('placeholder').visible).toBe(false);
  expect(heightOf(player.object.getObjectByName('character'))).toBeCloseTo(1.8, 1);
});

test('止まっていれば待機、ゆっくりなら歩き、速ければ走り', async () => {
  const player = createPlayer(new THREE.Scene());
  await player.load('/models/knight.glb', async () => fakeKnight());
  player.update(0.016, still, 0, [], flat);
  expect(player.currentAnimation()).toBe('Idle');
  player.update(0.016, walk, 0, [], flat);
  expect(player.currentAnimation()).toBe('Walking_A');
  player.update(0.016, run, 0, [], flat);
  expect(player.currentAnimation()).toBe('Running_A');
});

test('マントを青く染める', async () => {
  const player = createPlayer(new THREE.Scene());
  await player.load('/models/knight.glb', async () => fakeKnight());
  const cape = player.object.getObjectByName('Knight_Cape');
  expect(cape.material.color.b).toBeGreaterThan(cape.material.color.r);
});

test('読み込みに失敗しても、仮の体のまま動ける', async () => {
  const player = createPlayer(new THREE.Scene());
  await player.load('/missing.glb', async () => { throw new Error('404'); });
  expect(player.object.getObjectByName('placeholder').visible).toBe(true);
  expect(player.currentAnimation()).toBeNull();
  expect(() => player.update(0.016, run, 0, [], flat)).not.toThrow();
});

test('中身が空のキャラクターは読み込み失敗として扱い、仮の体のまま', async () => {
  const player = createPlayer(new THREE.Scene());
  await player.load('/models/knight.glb', async () => ({ scene: new THREE.Group(), animations: [] }));
  expect(player.object.getObjectByName('placeholder').visible).toBe(true);
});

test('当たり判定の中に入り込んでいても、外へ向かう方向には動ける（後から読み込まれた木に閉じ込められない）', () => {
  const tree = [{ x: 0, z: 0, radius: 0.5 }];
  const out = stepPosition({ x: 0.2, z: 0 }, { x: 1, z: 0 }, 0.1, tree);
  expect(out.x).toBeCloseTo(0.3);
  const deeper = stepPosition({ x: 0.2, z: 0 }, { x: -1, z: 0 }, 0.1, tree);
  expect(deeper.x).toBeCloseTo(0.2);
});
