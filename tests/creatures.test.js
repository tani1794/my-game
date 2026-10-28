import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createCreature, CREATURE_LOOKS } from '../src/areas/creatures.js';

const box = (object) => { object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object); };
const worldOf = (node) => { node.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(node.matrixWorld); };
const walk = { phase: 'chase', height: 0 };
const still = { phase: 'idle', height: 0 };

test('4種類とも作れて、足は地面に着いている（浮かない・沈まない）', () => {
  expect(CREATURE_LOOKS).toEqual(['hound', 'bat', 'beetle', 'spider']);
  for (const look of CREATURE_LOOKS) {
    const creature = createCreature(look);
    const b = box(creature.body);
    expect(b.min.y, look).toBeGreaterThan(-0.04);
    expect(b.min.y, look).toBeLessThan(0.04);
  }
});

test('同じ種類の2体は形を共有し、関節は別々に動く', () => {
  const a = createCreature('hound');
  const b = createCreature('hound');
  const meshes = (c) => { const list = []; c.body.traverse((o) => { if (o.isMesh) list.push(o); }); return list; };
  expect(meshes(a)[0].geometry).toBe(meshes(b)[0].geometry);
  a.animate(walk, 0.1, 1, 4);
  expect(a.joints.legs[0].upper.rotation.x).not.toBe(0);
  expect(b.joints.legs[0].upper.rotation.x).toBeCloseTo(0, 6);
});

test('ハウンド：走ると対角の脚（前左と後右）が同じに振れ、止まると脚はそろう', () => {
  const hound = createCreature('hound');
  const leg = (hind, sign) => hound.joints.legs.find((l) => l.hind === hind && l.sign === sign);
  for (let i = 0; i < 5; i++) hound.animate(walk, 0.07, i * 0.07, 4.4);
  expect(leg(0, 1).upper.rotation.x).toBeCloseTo(leg(1, -1).upper.rotation.x, 5);
  expect(leg(0, 1).upper.rotation.x).toBeCloseTo(-leg(0, -1).upper.rotation.x, 5);
  expect(Math.abs(leg(0, 1).upper.rotation.x)).toBeGreaterThan(0.05);
  // 止まると、振り幅は1秒ほどで0へ（いきなり固まらない）
  hound.animate(still, 0.05, 1, 0);
  expect(Math.max(...hound.joints.legs.map((l) => Math.abs(l.upper.rotation.x)))).toBeGreaterThan(0);
  for (let i = 0; i < 20; i++) hound.animate(still, 0.05, 1 + i * 0.05, 0);
  for (const l of hound.joints.legs) expect(Math.abs(l.upper.rotation.x)).toBeLessThan(0.01);
});

test('ハウンド：予兆であごが開き、身を低くする', () => {
  const hound = createCreature('hound');
  for (let i = 0; i < 20; i++) hound.animate({ phase: 'windup', height: 0 }, 0.05, i * 0.05, 0);
  expect(hound.joints.jaw.rotation.x).toBeGreaterThan(0.3);
  expect(hound.joints.body.position.y).toBeLessThan(0.75);
});

test('甲虫：6本の脚。歩くと3本ずつ交互に持ち上がり、残り3本は地面に着いたまま', () => {
  const beetle = createCreature('beetle');
  expect(beetle.joints.legs).toHaveLength(6);
  let checked = 0;
  for (let i = 0; i < 60; i++) {
    beetle.animate(walk, 0.03, i * 0.03, 2.1);
    const lifted = beetle.joints.legs.filter((l) => Math.abs(l.upper.rotation.z) > 0.02);
    if (i < 15) continue; // 動き出しの振り幅がそろうまで待つ
    if (!lifted.length) continue;
    checked += 1;
    expect(lifted).toHaveLength(3);
    expect(new Set(lifted.map((l) => l.group)).size).toBe(1);
    for (const l of lifted) expect(Math.sign(l.upper.rotation.z)).toBe(l.sign); // 上へ（地面へめり込まない）
  }
  expect(checked).toBeGreaterThan(5);
  expect(beetle.parts).toHaveLength(1); // 背中の継ぎ目（弱点）
});

test('蜘蛛：8本の脚。歩いても、同じ側の隣の脚の先は前後が入れ替わらない', () => {
  const spider = createCreature('spider');
  expect(spider.joints.legs).toHaveLength(8);
  for (let i = 0; i < 60; i++) {
    spider.animate(walk, 0.025, i * 0.025, 2.6);
    for (const sign of [1, -1]) {
      const z = spider.joints.legs.filter((l) => l.sign === sign).map((l) => worldOf(l.foot).z);
      for (let k = 0; k < 3; k++) expect(z[k]).toBeGreaterThan(z[k + 1] + 0.05);
    }
  }
});

test('蝙蝠：羽ばたいても、翼膜は手首と脇腹に付いたまま（離れない）', () => {
  const bat = createCreature('bat');
  const [membrane] = bat.membranes;
  const wing = bat.joints.wings[0];
  for (const [frame, t] of [[{ phase: 'chase', height: 2.8 }, 0.13], [{ phase: 'chase', height: 2.8 }, 0.31], [{ phase: 'idle', height: 0 }, 0.5]]) {
    bat.animate(frame, t, t, 3);
    bat.body.updateMatrixWorld(true);
    const position = membrane.geometry.getAttribute('position');
    const wrist = worldOf(wing.hand);
    expect(new THREE.Vector3().fromBufferAttribute(position, 0).distanceTo(wrist)).toBeLessThan(1e-4);
  }
  // 飛んでいる間は付け根から先へ、少し遅れて動く（3つの関節が別々の角度）
  bat.animate({ phase: 'chase', height: 2.8 }, 0.1, 1, 3);
  const { upper, lower, hand } = wing;
  expect(new Set([upper.rotation.z, lower.rotation.z, hand.rotation.z].map((v) => v.toFixed(3))).size).toBe(3);
});
