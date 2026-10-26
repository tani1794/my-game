import { test, expect } from 'vitest';
import { createGuard, GUARD } from '../src/story/guard.js';

const post = { id: 'g', x: 0, z: 0, facing: 0, leash: 14 };
const free = (pos, dir, distance) => ({ x: pos.x + dir.x * distance, z: pos.z + dir.z * distance });
const see = () => true;
const blind = () => false;

function run(guard, seconds, player, options = {}) {
  let frame;
  const strikes = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    frame = guard.update(1 / 60, { player, canSee: options.canSee ?? see, step: options.step ?? free, others: [] });
    if (frame.strike) strikes.push(frame.strike);
  }
  return { frame, strikes };
}

test('遠くの主人公には気づかない（立ったまま眠っている）', () => {
  const guard = createGuard(post);
  const { frame } = run(guard, 2, { x: 0, z: 20 });
  expect(frame.phase).toBe('dormant');
  expect(frame.x).toBe(0);
});

test('近づくと目覚めてから追ってくる（いきなり襲わない）', () => {
  const guard = createGuard(post);
  const first = guard.update(1 / 60, { player: { x: 0, z: 7 }, canSee: see, step: free, others: [] });
  expect(first.phase).toBe('awaken');
  expect(first.events).toContainEqual({ type: 'noticed', id: 'g' });
  const { frame } = run(guard, GUARD.awaken + 0.5, { x: 0, z: 7 });
  expect(frame.phase).toBe('chase');
  expect(frame.z).toBeGreaterThan(0);
});

test('壁の向こう（見通しが通らない）では気づかない', () => {
  const guard = createGuard(post);
  const { frame } = run(guard, 2, { x: 0, z: 5 }, { canSee: blind });
  expect(frame.phase).toBe('dormant');
});

test('攻撃は予備動作のあと、当たる時間に一度だけ前の扇を出し、そのあと隙がある', () => {
  const guard = createGuard(post);
  // 目覚めさせて、まだ斬りかかれない距離にいる状態から始める
  run(guard, GUARD.awaken + 0.1, { x: 0, z: 3 });
  const phases = [];
  let strikeCount = 0;
  let strikeAt = null;
  let windupAt = null;
  let time = 0;
  for (; time < 3; time += 1 / 60) {
    const frame = guard.update(1 / 60, { player: { x: 0, z: 1.2 }, canSee: see, step: free, others: [] });
    phases.push(frame.phase);
    if (frame.phase === 'windup') windupAt ??= time;
    if (frame.strike) {
      strikeCount += 1;
      strikeAt ??= time;
      expect(frame.strike).toMatchObject({ type: 'sector', radius: GUARD.reach });
    }
  }
  expect(phases).toContain('windup');
  expect(phases).toContain('recover');
  // 予備動作が始まってから、少なくとも windup 秒たってから当たる
  expect(strikeAt - windupAt).toBeGreaterThanOrEqual(GUARD.windup - 0.05);
  // 3秒で、予備動作と隙を挟んだ攻撃が何度も出ても、1回の振りにつき1回だけ
  expect(strikeCount).toBeLessThanOrEqual(2);
  expect(strikeCount).toBeGreaterThanOrEqual(1);
});

test('予備動作の途中で見通しが切れたら、攻撃を出さずにやめる', () => {
  const guard = createGuard(post);
  run(guard, GUARD.awaken + 0.1, { x: 0, z: 1.2 });
  run(guard, 0.3, { x: 0, z: 1.2 });
  const { strikes } = run(guard, GUARD.windup, { x: 0, z: 1.2 }, { canSee: blind });
  expect(strikes).toHaveLength(0);
});

test('持ち場から離れすぎると追うのをやめて戻る（どこまでも追ってこない）', () => {
  const guard = createGuard(post);
  run(guard, GUARD.awaken + 0.1, { x: 0, z: 8 });
  const { frame } = run(guard, 10, { x: 0, z: 30 });
  expect(frame.phase).toMatch(/return|idle/);
  expect(Math.hypot(frame.x, frame.z)).toBeLessThan(post.leash);
  const back = run(guard, 15, { x: 0, z: 60 }).frame;
  expect(Math.hypot(back.x, back.z)).toBeLessThan(1);
});

test('体力 50。0 で倒れ、倒れた後は何もしない', () => {
  const guard = createGuard(post);
  run(guard, GUARD.awaken + 0.1, { x: 0, z: 3 });
  expect(guard.takeDamage(22)).toBe(false);
  expect(guard.takeDamage(22)).toBe(false);
  expect(guard.takeDamage(10)).toBe(true);
  const { frame, strikes } = run(guard, 2, { x: 0, z: 1 });
  expect(frame.phase).toBe('dead');
  expect(strikes).toHaveLength(0);
  expect(guard.takeDamage(10)).toBe(false);
});

test('眠っている衛兵を斬ると、目覚める', () => {
  const guard = createGuard(post);
  guard.takeDamage(10);
  const frame = guard.update(1 / 60, { player: { x: 0, z: 20 }, canSee: see, step: free, others: [] });
  expect(frame.phase).toBe('awaken');
});

test('reset で持ち場・体力・眠りに戻る', () => {
  const guard = createGuard(post);
  run(guard, GUARD.awaken + 1, { x: 0, z: 5 });
  guard.takeDamage(30);
  guard.reset();
  const frame = guard.update(1 / 60, { player: { x: 0, z: 30 }, canSee: see, step: free, others: [] });
  expect(frame).toMatchObject({ phase: 'dormant', x: 0, z: 0, hp: GUARD.hp });
});

test('ほかの衛兵と重ならないよう、少し離れる', () => {
  const guard = createGuard(post);
  run(guard, GUARD.awaken + 0.1, { x: 0, z: 1.2 });
  const frame = guard.update(1 / 60, { player: { x: 0, z: 1.2 }, canSee: see, step: free, others: [{ x: 0.2, z: 0 }] });
  expect(frame.x).toBeLessThan(0);
});
