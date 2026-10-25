import { test, expect } from 'vitest';
import { createSoundCues } from '../src/audio/soundCues.js';

const frame = (over = {}) => ({
  player: { mode: 'free', animation: { name: 'Idle', loop: true, timeScale: 1 }, move: { x: 0, z: 0, speed: 0 }, ...(over.player ?? {}) },
  beast: { phase: 'idle', position: { x: 0, z: -6 }, strikeKind: null, strikes: [], ...(over.beast ?? {}) },
  events: over.events ?? [],
  outcome: over.outcome ?? 'fighting',
});
const here = { x: 0, z: 2 };
const names = (cues) => cues.map((c) => c.name);

test('攻撃の段ごとに swing1〜3。同じアニメーションが続く間は鳴らない', () => {
  const c = createSoundCues();
  const a1 = frame({ player: { mode: 'attack', animation: { name: '1H_Melee_Attack_Slice_Diagonal' } } });
  const a2 = frame({ player: { mode: 'attack', animation: { name: '1H_Melee_Attack_Slice_Horizontal' } } });
  const a3 = frame({ player: { mode: 'attack', animation: { name: '1H_Melee_Attack_Chop' } } });
  expect(names(c.update(0.01, frame(), a1, here))).toEqual(['swing1']);
  expect(names(c.update(0.01, a1, a1, here))).toEqual([]);
  expect(names(c.update(0.01, a1, a2, here))).toEqual(['swing2']);
  expect(names(c.update(0.01, a2, a3, here))).toEqual(['swing3']);
});

test('回避の始まりで dodge', () => {
  const c = createSoundCues();
  const d = frame({ player: { mode: 'dodge', animation: { name: 'Dodge_Left' } } });
  expect(names(c.update(0.01, frame(), d, here))).toEqual(['dodge']);
  expect(names(c.update(0.01, d, d, here))).toEqual([]);
});

test('出来事の音。結晶獣の音には距離が付く', () => {
  const c = createSoundCues();
  const cues = c.update(0.01, frame(), frame({ events: [{ type: 'beastHit', damage: 10 }, { type: 'playerHit' }, { type: 'shake' }, { type: 'stagger' }, { type: 'enraged' }] }), here);
  expect(names(cues)).toEqual(['hit', 'hurt', 'stagger', 'enrage']);
  expect(cues.find((q) => q.name === 'hit')).toMatchObject({ group: 'beast', distance: 8 });
  expect(cues.find((q) => q.name === 'hurt').group).toBe('player');
  expect(names(c.update(0.01, frame(), frame({ events: [{ type: 'won', time: 200 }] }), here))).toEqual(['win']);
  expect(names(c.update(0.01, frame(), frame({ events: [{ type: 'lost' }] }), here))).toEqual(['lose']);
});

test('予告の始まりで warn、攻撃の種類ごとの音、結晶の雨は同じ frame で1つ', () => {
  const c = createSoundCues();
  const t = frame({ beast: { phase: 'telegraph' } });
  expect(names(c.update(0.01, frame(), t, here))).toEqual(['warn']);
  expect(names(c.update(0.01, t, t, here))).toEqual([]);
  expect(names(c.update(0.01, t, frame({ beast: { phase: 'strike', strikeKind: 'slam' } }), here))).toEqual(['slam']);
  expect(names(c.update(0.01, t, frame({ beast: { phase: 'strike', strikeKind: 'rain', strikes: [{}, {}] } }), here))).toEqual(['crystal']);
  expect(names(c.update(0.01, t, frame({ beast: { phase: 'strike', strikeKind: 'charge' } }), here))).toEqual(['charge']);
  expect(names(c.update(0.01, t, frame({ beast: { phase: 'strike', strikeKind: 'spin' } }), here))).toEqual(['spin']);
});

test('結晶獣が倒れた瞬間に shatter（1回だけ）', () => {
  const c = createSoundCues();
  const dead = frame({ beast: { phase: 'dead' } });
  expect(names(c.update(0.01, frame(), dead, here))).toEqual(['shatter']);
  expect(names(c.update(0.01, dead, dead, here))).toEqual([]);
});

test('足音：歩きは0.5秒、走りは0.32秒おき。止まると時計が戻る', () => {
  const walk = createSoundCues();
  const w = frame({ player: { move: { x: 0, z: 1, speed: 3 } } });
  let steps = 0;
  for (let t = 0; t < 1.0 - 1e-9; t += 0.01) steps += names(walk.update(0.01, w, w, here)).filter((n) => n === 'step').length;
  expect(steps).toBe(2);

  const run = createSoundCues();
  const r = frame({ player: { move: { x: 0, z: 1, speed: 6 } } });
  steps = 0;
  for (let t = 0; t < 1.0 - 1e-9; t += 0.01) steps += names(run.update(0.01, r, r, here)).filter((n) => n === 'step').length;
  expect(steps).toBe(3);

  const stop = createSoundCues();
  for (let t = 0; t < 0.4; t += 0.01) stop.update(0.01, w, w, here);
  stop.update(0.01, w, frame(), here);
  expect(names(stop.update(0.15, frame(), w, here))).toEqual([]);
});

test('最初の frame（prev が null）は何も鳴らさない。reset の後も前の戦いの音は鳴らない', () => {
  const c = createSoundCues();
  expect(c.update(0.01, null, frame({ events: [{ type: 'won', time: 1 }] }), here)).toEqual([]);
  c.reset();
  expect(names(c.update(0.01, null, frame(), here))).toEqual([]);
});
