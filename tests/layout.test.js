import { test, expect } from 'vitest';
import {
  walkable, heightAt, collidersFor, CHECKPOINTS, ZONES, INTERACTABLES, GUARD_POSTS, BRIDGE, RAVINE,
} from '../src/chapter/layout.js';
import { pushOut } from '../src/player.js';

// 歩ける範囲を 1m 刻みの格子で塗り、from から to へ行けるか（当たり判定の箱と円は通れない）
function reachable(from, to, { gateOpen }) {
  const colliders = collidersFor({ gateOpen });
  const blocked = (x, z) => !walkable(x, z) || colliders.some((c) => {
    if (c.type === 'box') {
      const dx = x - c.x; const dz = z - c.z;
      const cos = Math.cos(-c.angle); const sin = Math.sin(-c.angle);
      const lx = dx * cos + dz * sin; const lz = -dx * sin + dz * cos;
      return Math.abs(lx) < c.hx + 0.3 && Math.abs(lz) < c.hz + 0.3;
    }
    return Math.hypot(x - c.x, z - c.z) < c.radius + 0.3;
  });
  const key = (x, z) => `${x},${z}`;
  const start = [Math.round(from.x), Math.round(from.z)];
  const seen = new Set([key(...start)]);
  const queue = [start];
  while (queue.length) {
    const [x, z] = queue.shift();
    if (Math.hypot(x - to.x, z - to.z) < 1.5) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const nz = z + dz;
      if (seen.has(key(nx, nz)) || blocked(nx, nz)) continue;
      seen.add(key(nx, nz));
      queue.push([nx, nz]);
    }
  }
  return false;
}

test('開始・広場・門衛所・西の沢は、門を開けなくても歩いて行ける', () => {
  const s = CHECKPOINTS.start;
  for (const place of [ZONES.plaza, ZONES.overlook, INTERACTABLES.winch, INTERACTABLES.lever, INTERACTABLES.memorial, INTERACTABLES.flowers, INTERACTABLES.gate]) {
    expect(reachable(s, place, { gateOpen: false })).toBe(true);
  }
});

test('礼拝堂へは、門が閉じていると行けず、開けると行ける', () => {
  const s = CHECKPOINTS.start;
  expect(reachable(s, ZONES.chapelFront, { gateOpen: false })).toBe(false);
  expect(reachable(s, ZONES.chapelFront, { gateOpen: true })).toBe(true);
  expect(reachable(s, INTERACTABLES.mural, { gateOpen: true })).toBe(true);
  expect(reachable(s, INTERACTABLES.altar, { gateOpen: true })).toBe(true);
  expect(reachable(s, INTERACTABLES.pilgrimPath, { gateOpen: true })).toBe(true);
});

test('礼拝堂の外をぐるりと一周できる（正面→東→裏→西→正面）', () => {
  const around = [{ x: 36, z: -66 }, { x: 48, z: -84 }, { x: 36, z: -105 }, { x: 24, z: -84 }];
  for (let i = 0; i < around.length; i++) {
    expect(reachable(around[i], around[(i + 1) % around.length], { gateOpen: true })).toBe(true);
  }
});

test('谷は歩けない（橋の上だけ渡れる）', () => {
  expect(walkable(0, -44)).toBe(false);
  expect(walkable(20, -44)).toBe(false);
  expect(walkable(BRIDGE.x, -44)).toBe(true);
  expect(walkable(BRIDGE.x + BRIDGE.halfWidth + 0.5, -44)).toBe(false);
});

test('谷は深く、橋は谷の上に架かっている', () => {
  expect(heightAt(10, (RAVINE.north + RAVINE.south) / 2)).toBeLessThan(-5);
  const deck = heightAt(BRIDGE.x, -44);
  expect(deck).toBeGreaterThan(heightAt(BRIDGE.x, RAVINE.south + 1) - 0.8);
});

test('復帰地点と衛兵の持ち場は、どれも歩ける場所で、当たり判定の外', () => {
  const colliders = collidersFor({ gateOpen: true });
  for (const point of [...Object.values(CHECKPOINTS), ...GUARD_POSTS]) {
    expect(walkable(point.x, point.z)).toBe(true);
    const out = pushOut(point, colliders.filter((c) => c.type !== 'box'));
    expect(Math.hypot(out.x - point.x, out.z - point.z)).toBeLessThan(0.01);
  }
});

test('地面の高さは、歩ける場所で急に跳ばない（1m 進んで 0.7m 以内）', () => {
  for (let x = -50; x <= 50; x += 1) {
    for (let z = -106; z <= 64; z += 1) {
      if (!walkable(x, z) || !walkable(x + 1, z) || !walkable(x, z + 1)) continue;
      expect(Math.abs(heightAt(x + 1, z) - heightAt(x, z))).toBeLessThan(0.7);
      expect(Math.abs(heightAt(x, z + 1) - heightAt(x, z))).toBeLessThan(0.7);
    }
  }
});
