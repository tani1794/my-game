import { test, expect } from 'vitest';
import { createFoes } from '../src/areas/foes.js';

const swipe = { name: 'swipe', range: [0, 2], windup: 0.5, active: 0.2, recover: 0.8, cooldown: 1, damage: 10, shape: 'sector', radius: 2 };
const defs = {
  grunt: { kind: 'grunt', hp: 100, defense: 0, awaken: 0.1, attacks: [swipe] },
  boss: { kind: 'boss', hp: 100, defense: 0, awaken: 0.1, elite: true, attacks: [swipe] },
  webber: {
    kind: 'webber', hp: 100, defense: 0, awaken: 0.1, keepDistance: 4,
    attacks: [{ name: 'web', range: [2, 10], windup: 0.5, active: 0.2, recover: 1, cooldown: 6, damage: 2, shape: 'circle', radius: 1.5, aim: 'target', spawn: { type: 'web', radius: 1.5, life: 5 } }],
  },
  priest: { kind: 'priest', hp: 100, defense: 0, awaken: 0.1, attacks: [{ name: 'chant', range: [0, 20], windup: 0.5, recover: 1, cooldown: 30, buff: { radius: 8, seconds: 6 } }] },
};
const free = () => (pos, dir, distance) => ({ x: pos.x + dir.x * distance, z: pos.z + dir.z * distance });
const ctx = (player, extra = {}) => ({ player, canSee: () => true, stepFor: free, hitPlayer: () => true, ...extra });
function run(foes, seconds, player, extra) {
  const outs = [];
  for (let t = 0; t < seconds; t += 1 / 30) outs.push(foes.update(1 / 30, ctx(player, extra)));
  return outs;
}
const sword = (x, z, angle) => ({ type: 'sector', x, z, angle, radius: 1.6, spread: (120 * Math.PI) / 180 });

test('敵の攻撃は主人公に一度だけ当たる（当たり続ける突進でも、回避で外れても）', () => {
  const rush = { name: 'rush', range: [0, 3], windup: 0.4, active: 1, recover: 1, cooldown: 9, damage: 20, shape: 'circle', radius: 2, continuous: true };
  const foes = createFoes([{ id: 'r', type: 'rusher', x: 0, z: 0, y: 0 }], { ...defs, rusher: { kind: 'rusher', hp: 100, defense: 0, awaken: 0.1, attacks: [rush] } });
  let calls = 0;
  run(foes, 2.5, { x: 0, z: 1.2, y: 0 }, { hitPlayer: () => { calls += 1; return false; } });
  expect(calls).toBe(1);
});

test('高さの違う敵（上の段・下の段）は、主人公に気づかず当たらない', () => {
  const foes = createFoes([{ id: 'a', type: 'grunt', x: 0, z: 0, y: 8 }], defs);
  let calls = 0;
  const outs = run(foes, 2, { x: 0, z: 1.2, y: 0 }, { hitPlayer: () => { calls += 1; return true; } });
  expect(calls).toBe(0);
  expect(outs.at(-1).frames[0].phase).toBe('dormant');
});

test('剣の扇に入った敵だけが斬られ、倒すと defeated に出る', () => {
  const foes = createFoes([{ id: 'a', type: 'grunt', x: 0, z: 1, y: 0 }, { id: 'b', type: 'grunt', x: 0, z: -3, y: 0 }], defs);
  const results = foes.swordHit(sword(0, 0, 0), { attack: 100, power: 1, critical: false, y: 0 });
  expect(results.map((r) => r.id)).toEqual(['a']);
  expect(results[0].dead).toBe(true);
  expect(foes.takeDefeated()).toEqual(['a']);
  expect(foes.takeDefeated()).toEqual([]);
});

test('蜘蛛の糸：主人公の足もとに張られ、中では遅くなり、斬ると消える', () => {
  const foes = createFoes([{ id: 'w', type: 'webber', x: 0, z: 0, y: 0 }], defs);
  const player = { x: 0, z: 6, y: 0 };
  run(foes, 1.5, player);
  expect(foes.webs()).toHaveLength(1);
  expect(foes.slowAt(0, 6, 0)).toBeLessThan(1);
  expect(foes.slowAt(5, 6, 0)).toBe(1);
  const results = foes.swordHit(sword(0, 4.6, 0), { attack: 10, power: 1, critical: false, y: 0 });
  expect(results.some((r) => r.web)).toBe(true);
  expect(foes.webs()).toHaveLength(0);
});

test('糸は時間がたつと消える', () => {
  const foes = createFoes([{ id: 'w', type: 'webber', x: 0, z: 0, y: 0 }], defs);
  run(foes, 1.5, { x: 0, z: 6, y: 0 });
  expect(foes.webs()).toHaveLength(1);
  run(foes, 6, { x: 0, z: 30, y: 0 });
  expect(foes.webs()).toHaveLength(0);
});

test('祈り手の詠唱が終わると、近くの仲間が強まる', () => {
  const foes = createFoes([{ id: 'p', type: 'priest', x: 0, z: 0, y: 0 }, { id: 'g', type: 'grunt', x: 3, z: 0, y: 0 }], defs);
  const outs = run(foes, 1.5, { x: 0, z: 9, y: 0 });
  expect(outs.some((o) => o.frames.find((f) => f.id === 'g').buffed)).toBe(true);
});

test('reset：通常の敵は戻り、倒した記録のある精鋭は倒れたまま', () => {
  const foes = createFoes([{ id: 'g', type: 'grunt', x: 0, z: 1, y: 0 }, { id: 'e', type: 'boss', x: 0, z: 1.2, y: 0, elite: true }], defs);
  foes.swordHit(sword(0, 0, 0), { attack: 1000, power: 1, critical: false, y: 0 });
  foes.reset((id) => id === 'e');
  const alive = Object.fromEntries(foes.list().map((f) => [f.id, f.alive()]));
  expect(alive).toEqual({ g: true, e: false });
});

test('当たり判定の円は、生きていて同じ高さの敵だけ', () => {
  const foes = createFoes([{ id: 'a', type: 'grunt', x: 0, z: 1, y: 0 }, { id: 'b', type: 'grunt', x: 5, z: 1, y: 8 }], defs);
  expect(foes.colliders(0).map((c) => c.x)).toEqual([0]);
});
