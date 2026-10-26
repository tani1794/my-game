import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createDragon, dragonPose, placeDragon, WINGSPAN_UNITS } from '../src/title/dragon.js';
import { flapAt, flightAt, wingspanFraction } from '../src/title/dragonFlight.js';
import { imageToScreen } from '../src/title/framing.js';

const masks = new THREE.Texture();

test('胴・首・尾は厚みのある立体（1枚の板ではない）', () => {
  const dragon = createDragon({ masks });
  dragon.update(0);
  const body = dragon.group.getObjectByName('dragon-body');
  body.geometry.computeBoundingBox();
  const size = body.geometry.boundingBox.getSize(new THREE.Vector3());
  expect(size.x).toBeGreaterThan(4);
  expect(size.y).toBeGreaterThan(0.3);
  expect(size.z).toBeGreaterThan(0.3);
  dragon.dispose();
});

test('左右の翼：骨（腕と4本の指）は太さのある筒、膜は表と裏の2層', () => {
  const dragon = createDragon({ masks });
  for (const side of ['left', 'right']) {
    const wing = dragon.group.getObjectByName(`dragon-wing-${side}`);
    const bones = wing.children.filter((child) => child.name === 'dragon-wing-bone');
    expect(bones).toHaveLength(6);
    const membrane = wing.getObjectByName('dragon-wing-membrane');
    const count = membrane.geometry.getAttribute('position').count;
    expect(count % 2).toBe(0);
    expect(count).toBeGreaterThanOrEqual(2 * 3 * 10);
  }
  expect(dragon.group.getObjectByName('dragon-head')).toBeDefined();
  expect(dragon.group.getObjectsByProperty('name', 'dragon-horn')).toHaveLength(2);
  dragon.dispose();
});

test('翼は付け根から動き、肘・翼端へ少し遅れて伝わる', () => {
  for (const time of [3.1, 9.4, 30.7]) {
    const pose = dragonPose(time);
    expect(pose.shoulder).toBeCloseTo(flapAt(time).angle, 6);
    expect(pose.elbow).toBeCloseTo(flapAt(time - 0.18).angle, 6);
    expect(pose.wrist).toBeCloseTo(flapAt(time - 0.34).angle, 6);
  }
});

test('羽ばたくと翼端が上下する（左右とも同じ向き）', () => {
  const dragon = createDragon({ masks });
  const tipY = (side) => {
    const wing = dragon.group.getObjectByName(`dragon-wing-${side}`);
    return wing.userData.joints.tips[0].y;
  };
  dragon.setPose({ shoulder: 1, elbow: 1, wrist: 1, neckBend: 0, tailBend: 0, tailWave: 0 });
  const up = [tipY('left'), tipY('right')];
  dragon.setPose({ shoulder: -1, elbow: -1, wrist: -1, neckBend: 0, tailBend: 0, tailWave: 0 });
  const down = [tipY('left'), tipY('right')];
  expect(up[0]).toBeGreaterThan(down[0] + 0.5);
  expect(up[1]).toBeGreaterThan(down[1] + 0.5);
  dragon.dispose();
});

test('旋回すると首は先に曲がり、尾は遅れて逆に曲がる', () => {
  let checked = 0;
  for (let time = 0; time < 46; time += 1) {
    const pose = dragonPose(time);
    if (Math.abs(pose.neckBend) > 0.02 && Math.abs(pose.tailBend) > 0.02) {
      expect(Math.sign(pose.neckBend)).toBe(-Math.sign(pose.tailBend));
      checked += 1;
    }
  }
  expect(checked).toBeGreaterThan(10);
});

test('画面での大きさ：翼幅が画面幅の決めた割合になる', () => {
  const view = { x: 0.5, y: 0.5, zoom: 1.06 };
  const flight = flightAt(12);
  const placed = placeDragon(flight, view, 844 / 390, 1672 / 941);
  // 正射影のカメラは横幅が 2 × 画面の縦横比
  expect((WINGSPAN_UNITS * placed.scale) / (2 * (844 / 390))).toBeCloseTo(wingspanFraction(flight), 6);
  const screen = imageToScreen(flight, view, 844 / 390, 1672 / 941);
  expect(placed.x).toBeCloseTo(screen.x * (844 / 390), 6);
  expect(placed.y).toBeCloseTo(screen.y, 6);
});
