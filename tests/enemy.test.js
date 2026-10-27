import { test, expect } from 'vitest';
import { createEnemy, attackShape } from '../src/story/enemy.js';

const free = (pos, dir, distance) => ({ x: pos.x + dir.x * distance, z: pos.z + dir.z * distance });
const see = () => true;
const post = { id: 'e', x: 0, z: 0, facing: 0 };
const swipe = { name: 'swipe', range: [0, 2], windup: 0.6, active: 0.2, recover: 0.8, cooldown: 1, damage: 10, shape: 'sector', radius: 2 };
const base = { kind: 'test', hp: 100, defense: 0, awaken: 0.2, attacks: [swipe] };
const fixed = { random: () => 0.9 };

function run(enemy, seconds, player, extra = {}) {
  const frames = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    frames.push(enemy.update(1 / 60, { player, canSee: see, step: free, allies: [], ...extra }));
  }
  return frames;
}
const front = { attack: 10, power: 1, from: { x: 0, z: 1 } };
const back = { attack: 10, power: 1, from: { x: 0, z: -1 } };

test('予兆 → 攻撃 → 隙 の順で、ひとつの攻撃は一度しか当たらない', () => {
  const enemy = createEnemy(base, post, fixed);
  const frames = run(enemy, 3, { x: 0, z: 1.5 });
  const firstStrike = frames.findIndex((f) => f.strikes.length > 0);
  const firstWindup = frames.findIndex((f) => f.phase === 'windup');
  expect(firstWindup).toBeGreaterThan(-1);
  expect(firstStrike).toBeGreaterThan(firstWindup);
  // 予兆の間は足もとに印が出ている
  expect(frames[firstWindup].telegraph.length).toBe(1);
  // 予兆はおよそ 0.6 秒
  expect((firstStrike - firstWindup) / 60).toBeCloseTo(0.6, 1);
  const keys = frames.flatMap((f) => f.strikes.map((s) => s.key));
  const firstKey = keys[0];
  expect(keys.filter((k) => k === firstKey)).toHaveLength(1);
  // 攻撃のあとは隙がある
  expect(frames.slice(firstStrike).some((f) => f.phase === 'recover')).toBe(true);
});

test('遠くでは眠ったまま、近づくと目覚める', () => {
  const enemy = createEnemy(base, post, fixed);
  expect(run(enemy, 1, { x: 0, z: 30 }).at(-1).phase).toBe('dormant');
  expect(run(enemy, 1, { x: 0, z: 5 }).at(-1).phase).toBe('chase');
});

test('隠れている敵は、すぐ近くに来るまで斬れないし動かない', () => {
  const enemy = createEnemy({ ...base, startHidden: true, ambush: 3 }, post, fixed);
  expect(run(enemy, 1, { x: 0, z: 6 }).at(-1).phase).toBe('hidden');
  expect(enemy.hit(front).blocked).toBe(true);
  expect(run(enemy, 0.1, { x: 0, z: 2 }).at(-1).phase).toBe('awaken');
});

test('飛ぶ敵は飛んでいる間は斬れないが、攻撃のあとは地上に降りて斬れる', () => {
  const dive = { ...swipe, range: [0, 6], windup: 0.8, landAfter: 1.6 };
  const enemy = createEnemy({ ...base, flyer: { height: 2.5 }, attacks: [dive] }, post, fixed);
  run(enemy, 0.3, { x: 0, z: 4 });
  expect(enemy.height()).toBeGreaterThan(2);
  expect(enemy.hit(front)).toMatchObject({ damage: 0, airborne: true });
  // 予兆 → 攻撃 → 着地
  const frames = run(enemy, 1.2, { x: 0, z: 4 });
  expect(frames.some((f) => f.strikes.length > 0)).toBe(true);
  expect(enemy.height()).toBe(0);
  const result = enemy.hit(front);
  expect(result.damage).toBeGreaterThan(0);
  // 着地はおよそ 1.6 秒続き、そのあと空へ戻る
  run(enemy, 2.2, { x: 0, z: 30 });
  expect(enemy.height()).toBeGreaterThan(2);
});

test('正面の装甲：前からは硬く、横や後ろからは通る', () => {
  const def = { ...base, frontArmor: { angle: Math.PI / 3, defense: 300 } };
  const a = createEnemy(def, post, fixed);
  const b = createEnemy(def, post, fixed);
  const fromFront = a.hit(front).damage;
  const fromBack = b.hit(back).damage;
  expect(fromBack).toBeGreaterThan(fromFront * 2);
});

test('背中が弱点の敵は、後ろから斬ると多く入る', () => {
  const def = { ...base, backWeak: true };
  expect(createEnemy(def, post, fixed).hit(back).damage).toBe(15);
  expect(createEnemy(def, post, fixed).hit(front).damage).toBe(10);
});

test('盾：構えている前からは弱い攻撃が通りにくく、強攻撃で崩れて長くよろめく', () => {
  const def = { ...base, guard: { breakStun: 1.5 } };
  const enemy = createEnemy(def, post, fixed);
  run(enemy, 0.5, { x: 0, z: 5 });
  expect(enemy.update(1 / 60, { player: { x: 0, z: 5 }, canSee: see, step: free }).guarding).toBe(true);
  const light = enemy.hit({ ...front, from: { x: 0, z: 5 } });
  expect(light.blocked).toBe(true);
  expect(light.damage).toBe(3);
  const before = enemy.update(1 / 60, { player: { x: 0, z: 5 }, canSee: see, step: free }).hp;
  const heavy = enemy.hit({ ...front, power: 2.2, from: { x: 0, z: 5 } });
  expect(heavy.guardBreak).toBe(true);
  const after = run(enemy, 1, { x: 0, z: 5 }).at(-1);
  expect(after.hp).toBe(before - heavy.damage);
  expect(after.phase).toBe('stun');
});

test('詠唱：近くの仲間を強める。途中で斬れば中断される', () => {
  const chant = { name: 'chant', range: [0, 12], windup: 1.5, recover: 1, cooldown: 6, buff: { radius: 6, seconds: 8 } };
  // よろめかない敵でも、詠唱だけは中断できる
  const def = { ...base, superArmor: true, attacks: [chant] };
  const allies = [{ id: 'friend', x: 2, z: 0, alive: true }, { id: 'far', x: 20, z: 0, alive: true }];
  const enemy = createEnemy(def, post, fixed);
  const frames = run(enemy, 2.2, { x: 0, z: 8 }, { allies });
  const buffs = frames.flatMap((f) => f.buffs);
  expect(buffs).toEqual([{ id: 'friend', seconds: 8 }]);

  const other = createEnemy(def, post, fixed);
  run(other, 0.6, { x: 0, z: 8 }, { allies });
  expect(other.update(1 / 60, { player: { x: 0, z: 8 }, canSee: see, step: free, allies }).phase).toBe('channel');
  other.hit(front);
  const after = run(other, 2, { x: 0, z: 8 }, { allies });
  expect(after.flatMap((f) => f.buffs)).toEqual([]);
});

test('強められた敵は速く、攻撃も重い', () => {
  const enemy = createEnemy(base, post, fixed);
  enemy.buff(5);
  const strikes = run(enemy, 2, { x: 0, z: 1.5 }).flatMap((f) => f.strikes);
  expect(strikes[0].damage).toBe(13);
});

test('突進：壁に当たると長くよろめく（大きな隙）', () => {
  const charge = { name: 'charge', range: [3, 12], windup: 0.8, active: 1.2, recover: 0.6, cooldown: 3, damage: 20, shape: 'circle', radius: 1.2, dash: 9 };
  const def = { ...base, attacks: [charge], wallStun: 2.5 };
  const wall = (pos, dir, distance) => (pos.z + dir.z * distance > 2 ? { x: pos.x, z: pos.z } : free(pos, dir, distance));
  const enemy = createEnemy(def, { ...post, z: -4 }, fixed);
  const frames = run(enemy, 2, { x: 0, z: 4 }, { step: wall });
  expect(frames.some((f) => f.events.some((e) => e.type === 'wallHit'))).toBe(true);
  const stunned = frames.findIndex((f) => f.phase === 'stun');
  const stunFrames = frames.slice(stunned).filter((f) => f.phase === 'stun').length;
  expect(stunFrames / 60).toBeGreaterThan(Math.min(2.5, (frames.length - stunned) / 60) - 0.1);
});

test('腕の結晶：攻撃の隙にだけ弱点として出て、割ると防御が下がる', () => {
  const slam = { ...swipe, recover: 2 };
  const def = { ...base, hp: 2000, defense: 60, superArmor: true, attacks: [slam], weakParts: { count: 2, hp: 30, defenseDrop: 25, stun: 1.5 } };
  const enemy = createEnemy(def, post, fixed);
  const normal = createEnemy(def, post, fixed).hit(front).damage;
  // 攻撃させて隙へ
  let frame;
  for (let i = 0; i < 300; i += 1) {
    frame = enemy.update(1 / 60, { player: { x: 0, z: 1.5 }, canSee: see, step: free });
    if (frame.phase === 'recover') break;
  }
  expect(frame.exposed).toBe(true);
  const weakHit = enemy.hit(front);
  expect(weakHit.weak).toBe(true);
  expect(weakHit.damage).toBeGreaterThan(normal);
  while (enemy.update(0, { player: { x: 0, z: 1.5 }, canSee: see, step: free }).partsBroken === 0) {
    const result = enemy.hit(front);
    if (!result.weak) break;
  }
  const broken = enemy.update(1 / 60, { player: { x: 0, z: 1.5 }, canSee: see, step: free });
  expect(broken.partsBroken).toBe(1);
  expect(broken.phase).toBe('stun');
});

test('縄張りから遠く離れると、元の場所へ戻る', () => {
  const enemy = createEnemy({ ...base, leash: 6, speed: 3 }, post, fixed);
  run(enemy, 1, { x: 0, z: 5 });
  const frames = run(enemy, 8, { x: 0, z: 20 });
  expect(frames.some((f) => f.phase === 'return')).toBe(true);
  const last = frames.at(-1);
  expect(Math.hypot(last.x, last.z)).toBeLessThan(0.2);
});

test('倒した敵は動かず、reset で元に戻る', () => {
  const enemy = createEnemy({ ...base, hp: 5 }, post, fixed);
  expect(enemy.hit(front).dead).toBe(true);
  expect(enemy.alive()).toBe(false);
  expect(run(enemy, 1, { x: 0, z: 1 }).at(-1).strikes).toEqual([]);
  enemy.reset();
  expect(enemy.alive()).toBe(true);
});

test('攻撃の形：帯は向きの前に伸びる', () => {
  const band = attackShape({ shape: 'band', length: 6, width: 1 }, 0, 0, 0);
  expect(band).toMatchObject({ type: 'band', x: 0, z: 3, length: 6 });
});
