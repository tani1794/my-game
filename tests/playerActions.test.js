import { test, expect } from 'vitest';
import { createPlayerActions } from '../src/combat/playerActions.js';

const idle = {
  move: { x: 0, z: 0 },
  run: false,
  attack: false,
  dodge: false,
  target: null,
  self: { x: 0, z: 0 },
  facing: 0,
  lockOn: false,
};
const step = (a, dt, over = {}) => a.update(dt, { ...idle, ...over });
// 一定時間、同じ入力で進め、最後の frame と、途中の frame をすべて返す
const run = (a, seconds, over = {}, dt = 0.01) => {
  const frames = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) frames.push(step(a, dt, over));
  return frames;
};

test('攻撃1段目は 0.15〜0.30 秒だけ当たり、1回の振りで同じ id、威力10', () => {
  const a = createPlayerActions();
  const frames = [step(a, 0.01, { attack: true }), ...run(a, 0.5)];
  const swings = frames.filter((f) => f.swing);
  expect(new Set(swings.map((f) => f.swing.id)).size).toBe(1);
  expect(swings[0].swing.damage).toBe(10);
  expect(swings.length).toBeGreaterThanOrEqual(13);
  expect(swings.length).toBeLessThanOrEqual(17);
  expect(frames[0].animation.name).toBe('1H_Melee_Attack_Slice_Diagonal');
});

test('受付時間内に押すと2段目（威力12）、遅れると1段目に戻る', () => {
  const a = createPlayerActions();
  step(a, 0.01, { attack: true });
  run(a, 0.55); // 1段目が終わり、受付の残り時間内
  const second = [step(a, 0.01, { attack: true }), ...run(a, 0.3)].find((f) => f.swing);
  expect(second.swing.damage).toBe(12);

  const b = createPlayerActions();
  step(b, 0.01, { attack: true });
  run(b, 1.2); // 受付を過ぎる
  const again = [step(b, 0.01, { attack: true }), ...run(b, 0.3)].find((f) => f.swing);
  expect(again.swing.damage).toBe(10);
});

test('空振りでも、振っている途中の早押しは予約になり、3段目まで続く', () => {
  const a = createPlayerActions();
  step(a, 0.01, { attack: true });
  step(a, 0.01, { attack: true }); // 1段目の途中で2段目を予約
  const frames = run(a, 0.6);
  step(a, 0.01, { attack: true }); // 2段目の途中で3段目を予約
  const later = run(a, 1.0);
  const damages = [...frames, ...later].filter((f) => f.swing).map((f) => f.swing.damage);
  // 1段目（10）から、予約で2段目（12）・3段目（22）までつながる
  expect(new Set(damages)).toEqual(new Set([10, 12, 22]));
  expect(later.some((f) => f.animation.name === '1H_Melee_Attack_Chop')).toBe(true);
});

test('攻撃中は動かない。出だしで5m以内の結晶獣のほうを向く', () => {
  const a = createPlayerActions();
  const f = step(a, 0.01, { attack: true, move: { x: 1, z: 0 }, target: { x: 3, z: 0 } });
  expect(f.move.speed).toBe(0);
  expect(f.face).toBeCloseTo(Math.PI / 2);

  const far = createPlayerActions();
  const g = step(far, 0.01, { attack: true, target: { x: 30, z: 0 }, facing: 0.3 });
  expect(g.face).toBeCloseTo(0.3);
  const locked = createPlayerActions();
  const h = step(locked, 0.01, { attack: true, target: { x: 30, z: 0 }, lockOn: true });
  expect(h.face).toBeCloseTo(Math.PI / 2);
});

test('攻撃中でも回避できる。回避は 0.55 秒、最初の 0.35 秒は無敵で takeHit が false', () => {
  const a = createPlayerActions();
  step(a, 0.01, { attack: true });
  run(a, 0.1);
  const f = step(a, 0.01, { dodge: true, move: { x: 1, z: 0 } });
  expect(f.mode).toBe('dodge');
  expect(f.invulnerable).toBe(true);
  expect(f.move.speed).toBe(7);
  expect(a.takeHit(30)).toBe(false);
  run(a, 0.35);
  expect(a.takeHit(30)).toBe(true);
  expect(step(a, 0.01).hp).toBe(70);
});

test('回避の向き：スティックの向き。倒していなければ後ろ。向きとの差でアニメーションを選ぶ', () => {
  const back = createPlayerActions();
  const f = step(back, 0.01, { dodge: true, facing: 0 });
  expect(f.move.z).toBeCloseTo(-1);
  expect(f.animation.name).toBe('Dodge_Backward');
  expect(f.face).toBeCloseTo(0); // 向きは変えない

  const left = createPlayerActions();
  expect(step(left, 0.01, { dodge: true, facing: 0, move: { x: 1, z: 0 } }).animation.name).toBe('Dodge_Left');
  const right = createPlayerActions();
  expect(step(right, 0.01, { dodge: true, facing: 0, move: { x: -1, z: 0 } }).animation.name).toBe('Dodge_Right');
  const fwd = createPlayerActions();
  expect(step(fwd, 0.01, { dodge: true, facing: 0, move: { x: 0, z: 1 } }).animation.name).toBe('Dodge_Forward');
});

test('回避の連打で入力が二重にならない（スタミナは20しか減らない）', () => {
  const a = createPlayerActions();
  step(a, 0.01, { dodge: true });
  step(a, 0.01, { dodge: true });
  const f = step(a, 0.01, { dodge: true });
  expect(f.stamina).toBe(80);
});

test('スタミナ 20 未満では回避が出ず、予約もされない', () => {
  const a = createPlayerActions();
  for (let i = 0; i < 5; i++) {
    step(a, 0.01, { dodge: true });
    run(a, 0.6);
  }
  expect(step(a, 0.001).stamina).toBeLessThan(20);
  const f = step(a, 0.01, { dodge: true });
  expect(f.mode).toBe('free');
  const later = run(a, 2);
  expect(later.every((g) => g.mode === 'free')).toBe(true);
});

test('スタミナは 0.5 秒休むと 1秒に30回復。止まって走るボタンを押しても減らない', () => {
  const a = createPlayerActions();
  step(a, 0.01, { dodge: true });
  run(a, 0.55);
  const s0 = step(a, 0.001).stamina; // 80
  run(a, 0.4);
  expect(step(a, 0.001).stamina).toBeCloseTo(s0, 0);
  run(a, 0.5);
  expect(step(a, 0.001).stamina).toBeGreaterThan(s0 + 10);

  const b = createPlayerActions();
  run(b, 1, { run: true });
  expect(step(b, 0.001).stamina).toBe(100);
  run(b, 1, { run: true, move: { x: 0, z: 1 } });
  expect(step(b, 0.001).stamina).toBeCloseTo(85, 0);
});

test('走り 6m/秒、歩きは倒し量×3m/秒。スタミナ0なら走れない', () => {
  const a = createPlayerActions();
  expect(step(a, 0.01, { run: true, move: { x: 0, z: 1 } }).move.speed).toBe(6);
  expect(step(a, 0.01, { move: { x: 0, z: 0.5 } }).move.speed).toBeCloseTo(1.5);
  run(a, 8, { run: true, move: { x: 0, z: 1 } });
  expect(step(a, 0.01, { run: true, move: { x: 0, z: 1 } }).move.speed).toBe(3);
});

test('のけぞり中は攻撃も移動もできず、回避はできる', () => {
  const a = createPlayerActions();
  expect(a.takeHit(10)).toBe(true);
  const f = step(a, 0.01, { attack: true, move: { x: 1, z: 0 } });
  expect(f.mode).toBe('hit');
  expect(f.move.speed).toBe(0);
  expect(f.swing).toBeNull();
  expect(step(a, 0.01, { dodge: true }).mode).toBe('dodge');
});

test('体力0で dead になり、以後の入力を受け付けない', () => {
  const a = createPlayerActions();
  a.takeHit(60);
  run(a, 0.5);
  a.takeHit(60);
  const f = step(a, 0.01, { attack: true, dodge: true, move: { x: 1, z: 0 } });
  expect(f.mode).toBe('dead');
  expect(f.hp).toBe(0);
  expect(f.animation).toMatchObject({ name: 'Death_A', loop: false });
  expect(a.takeHit(10)).toBe(false);
});

test('reset で体力・スタミナ・状態が最初に戻る', () => {
  const a = createPlayerActions();
  a.takeHit(50);
  step(a, 0.01, { dodge: true });
  a.reset();
  const f = step(a, 0.001);
  expect(f).toMatchObject({ mode: 'free', hp: 100, stamina: 100, swing: null });
  expect(f.animation.name).toBe('Idle');
});

test('連打しても3段目の後は必ず一度止まる（4段目はない）', () => {
  const a = createPlayerActions();
  const names = [];
  for (let t = 0; t < 3; t += 0.01) {
    const f = step(a, 0.01, { attack: true });
    names.push(f.mode === 'free' ? 'free' : f.animation.name);
  }
  // 最初の3段目（Chop）が終わった直後の frame
  const chopStart = names.indexOf('1H_Melee_Attack_Chop');
  let chopEnd = chopStart;
  while (names[chopEnd] === '1H_Melee_Attack_Chop') chopEnd++;
  expect(chopStart).toBeGreaterThan(0);
  expect(names[chopEnd]).toBe('free');
});

test('攻撃の再生速度：剣先がいちばん速い瞬間を当たる時間に合わせるため、3段とも速めに再生する', () => {
  const a = createPlayerActions();
  const scales = [];
  for (let k = 0; k < 3; k++) {
    const f = step(a, 0.01, { attack: true });
    scales.push(f.animation.timeScale);
    run(a, 0.62);
  }
  expect(scales).toEqual([1.7, 1.5, 1.75]);
});

test('歩き・走りの再生速度は移動の速さに比例し、歩きは上限 1.8 で止まる', () => {
  const a = createPlayerActions();
  const slow = step(a, 0.01, { move: { x: 0, z: 0.4 } });
  expect(slow.animation.name).toBe('Walking_A');
  expect(slow.animation.timeScale).toBeCloseTo(1.2 / 1.4);
  const full = step(a, 0.01, { move: { x: 0, z: 1 } });
  expect(full.animation.timeScale).toBe(1.8);
  const running = step(a, 0.01, { move: { x: 0, z: 1 }, run: true });
  expect(running.animation.name).toBe('Running_A');
  expect(running.animation.timeScale).toBeCloseTo(6 / 5.36);
});

test('回避は短いクリップを回避の時間いっぱいに広げる（再生速度 0.7）', () => {
  const a = createPlayerActions();
  const f = step(a, 0.01, { dodge: true, move: { x: 0, z: 1 } });
  expect(f.mode).toBe('dodge');
  expect(f.animation.timeScale).toBe(0.7);
});
