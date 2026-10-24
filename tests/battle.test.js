import { test, expect } from 'vitest';
import { createBattle, decideOutcome, bodyColliders } from '../src/combat/battle.js';
import { BEAST_MAX_HP } from '../src/combat/beastBrain.js';

const noInput = { move: { x: 0, z: 0 }, run: false, attack: false, dodge: false, facing: Math.PI, lockOn: false };
const nudge = { ...noInput, move: { x: 0.01, z: 0 } }; // 戦いを始めるための、ほぼ0の移動
const BEAST_FRONT = { x: 0, z: -2 }; // 結晶獣（0, -6、+z 向き）の正面 4m

function step(battle, dt, playerPos, over = {}) {
  return battle.update(dt, { intent: { ...noInput, ...over }, playerPos });
}

function runUntil(battle, playerPos, predicate, limit = 10, dt = 0.01, over = {}) {
  for (let t = 0; t < limit; t += dt) {
    const result = step(battle, dt, playerPos, over);
    if (predicate(result)) return result;
  }
  throw new Error('条件に達しなかった');
}

test('結晶獣の体の当たり判定は、胴の前・中・後の3つの円', () => {
  const circles = bodyColliders({ x: 0, z: -6 }, 0);
  expect(circles).toHaveLength(3);
  expect(circles.map((c) => c.z).sort((a, b) => a - b)).toEqual([-8.75, -6, -3.25]);
  expect(circles.every((c) => c.radius === 2.6)).toBe(true);
});

test('1回の振りで、何 frame 重なってもダメージは1回（威力10）', () => {
  const battle = createBattle();
  const pos = { x: 0, z: 0.5 }; // 体（前の円の縁 -0.65）まで 1.15m
  const events = [];
  events.push(...step(battle, 0.01, pos, { attack: true }).events);
  for (let t = 0; t < 0.5; t += 0.01) events.push(...step(battle, 0.01, pos).events);
  const hits = events.filter((e) => e.type === 'beastHit');
  expect(hits).toHaveLength(1);
  expect(hits[0].damage).toBe(10);
});

test('体から 1.6m より離れていると当たらない', () => {
  const battle = createBattle();
  const pos = { x: 0, z: 1.2 }; // 縁まで 1.85m
  const events = [];
  events.push(...step(battle, 0.01, pos, { attack: true }).events);
  for (let t = 0; t < 0.5; t += 0.01) events.push(...step(battle, 0.01, pos).events);
  expect(events.some((e) => e.type === 'beastHit')).toBe(false);
});

test('最初に動くか攻撃するまで、結晶獣は予告を出さない', () => {
  const battle = createBattle();
  for (let t = 0; t < 3; t += 0.05) {
    const r = step(battle, 0.05, BEAST_FRONT);
    expect(r.beast.attack).toBeNull();
    expect(r.time).toBe(0);
  }
});

test('塗りつぶしの瞬間に形の中にいると体力が減り、揺れの出来事が出る', () => {
  const battle = createBattle();
  step(battle, 0.01, BEAST_FRONT, nudge);
  const hit = runUntil(battle, BEAST_FRONT, (r) => r.events.some((e) => e.type === 'playerHit'));
  expect(hit.player.hp).toBe(70);
  expect(hit.events.some((e) => e.type === 'shake')).toBe(true);
});

test('回避の無敵中は当たらない', () => {
  const battle = createBattle();
  step(battle, 0.01, BEAST_FRONT, nudge);
  runUntil(battle, BEAST_FRONT, (r) => r.beast.attack && r.beast.attack.progress > 0.85);
  step(battle, 0.01, BEAST_FRONT, { dodge: true });
  const after = runUntil(battle, BEAST_FRONT, (r) => r.beast.phase === 'recover');
  expect(after.player.hp).toBe(100);
});

test('1回の結晶の雨で受けるダメージは最大40（落ちる場所に毎回立っていても）', () => {
  for (let seed = 1; seed < 40; seed++) {
    const battle = createBattle({ seed });
    const mid = { x: 0, z: 3 };
    step(battle, 0.01, mid, nudge);
    const t = runUntil(battle, mid, (r) => r.beast.phase === 'telegraph');
    if (t.beast.attack.kind !== 'rain') continue;

    const drops = t.beast.attack.shapes;
    let next = 0;
    let hp = 100;
    for (let time = 0; time < 3; time += 0.01) {
      const pos = drops[Math.min(next, drops.length - 1)];
      const r = step(battle, 0.01, { x: pos.x, z: pos.z });
      next += r.beast.strikes.length;
      hp = r.player.hp;
      if (next >= drops.length && r.beast.phase === 'recover') break;
    }
    expect(hp).toBe(60);
    return;
  }
  throw new Error('結晶の雨が選ばれなかった');
});

test('結晶獣の体力0で won と時間、主人公の体力0で lost。決着後は体力が変わらず、予告も消える', () => {
  const won = createBattle({ beastHp: 10 });
  const pos = { x: 0, z: 0.5 };
  step(won, 0.01, pos, { attack: true });
  const w = runUntil(won, pos, (r) => r.outcome === 'won', 2);
  expect(w.time).toBeGreaterThan(0);
  expect(w.events.some((e) => e.type === 'won')).toBe(true);

  const lost = createBattle({ playerHp: 20 });
  step(lost, 0.01, BEAST_FRONT, nudge);
  const l = runUntil(lost, BEAST_FRONT, (r) => r.outcome === 'lost');
  expect(l.events.some((e) => e.type === 'lost')).toBe(true);
  for (let t = 0; t < 5; t += 0.05) {
    const r = step(lost, 0.05, BEAST_FRONT);
    expect(r.player.hp).toBe(0);
    expect(r.beast.attack).toBeNull();
    expect(r.outcome).toBe('lost');
  }
});

test('同時に体力0になったら勝ち', () => {
  expect(decideOutcome(0, 0)).toBe('won');
  expect(decideOutcome(0, 50)).toBe('won');
  expect(decideOutcome(10, 0)).toBe('lost');
  expect(decideOutcome(10, 50)).toBe('fighting');
});

test('予告の途中で reset すると、すべて最初に戻る（乱数の種も差し替えられる）', () => {
  const battle = createBattle();
  step(battle, 0.01, BEAST_FRONT, nudge);
  runUntil(battle, BEAST_FRONT, (r) => r.beast.phase === 'telegraph');
  battle.reset({ seed: 2 });
  const r = step(battle, 0.01, BEAST_FRONT);
  expect(r.outcome).toBe('fighting');
  expect(r.time).toBe(0);
  expect(r.player.hp).toBe(100);
  expect(r.beast.hp).toBe(BEAST_MAX_HP);
  expect(r.beast.attack).toBeNull();
  expect(r.beast.position).toEqual({ x: 0, z: -6 });
});

test('長いフレーム（5秒）を1回渡しても、予告が一気に終わって当たることはない', () => {
  const battle = createBattle();
  step(battle, 0.01, BEAST_FRONT, nudge);
  const r = step(battle, 5, BEAST_FRONT);
  expect(r.player.hp).toBe(100);
  expect(r.time).toBeLessThanOrEqual(0.07);
});
