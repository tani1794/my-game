# 依頼：戦いの状態から「鳴らす音の一覧」を作る（src/audio/soundCues.js）

音は鳴らしません。前の frame と今の frame の戦いの状態を比べて、この frame に鳴らす音の名前の一覧を返すだけの、純粋な JavaScript です（three.js も DOM も使わない）。

## 作るファイル
- `src/audio/soundCues.js`
- `tests/soundCues.test.js`

## 渡されるもの（battle.update の戻り値。読み取り専用で src/combat/battle.js などを読めます）
```js
{
  player: { mode: 'free'|'attack'|'dodge'|'hit'|'dead', animation: { name, loop, timeScale }, move: { x, z, speed }, ... },
  beast: { phase: 'idle'|'approach'|'telegraph'|'strike'|'recover'|'stagger'|'dead', position: { x, z }, strikeKind: null|'slam'|'charge'|'spin'|'rain', strikes: Shape[], ... },
  events: [{ type: 'beastHit'|'playerHit'|'shake'|'stagger'|'enraged'|'won'|'lost', ... }],
  outcome: 'fighting'|'won'|'lost',
}
```

## 公開する関数（名前と引数は変えないでください）
```js
export function createSoundCues()
// -> { update(dt, prev /* 前の frame か null */, next /* 今の frame */, playerPos /* {x, z} */) -> Cue[], reset() }
// Cue = { name: string, group: 'player' | 'beast' | 'ui', distance?: number }
```

## 鳴らす音（きっかけ → 名前・群）
- 主人公のアニメーションが攻撃に**変わった瞬間**：`1H_Melee_Attack_Slice_Diagonal`→`swing1`、`1H_Melee_Attack_Slice_Horizontal`→`swing2`、`1H_Melee_Attack_Chop`→`swing3`（player）
- 主人公の mode が `dodge` に**なった瞬間**：`dodge`（player）
- events：`beastHit`→`hit`（beast）、`playerHit`→`hurt`（player）、`stagger`→`stagger`（beast）、`enraged`→`enrage`（beast）、`won`→`win`（ui）、`lost`→`lose`（ui）。`shake` は音なし
- 結晶獣の phase が `telegraph` に**なった瞬間**：`warn`（beast）
- `next.beast.strikeKind`：`slam`→`slam`、`charge`→`charge`、`spin`→`spin`、`rain`→`crystal`（すべて beast）。同じ frame に同じ名前は1つにまとめる
- 結晶獣の phase が `dead` に**なった瞬間**：`shatter`（beast）
- 足音：主人公の mode が `free` で `move.speed > 0` の間、`speed <= 3` なら 0.5 秒、それより速ければ 0.32 秒おきに `step`（player）。止まったら時計を 0 に戻す（動き出して最初の足音は1間隔後）
- 群が beast の音には、主人公と結晶獣の距離 `distance`（m）を付ける
- `prev` が null の frame は、足音以外何も鳴らさない（最初の frame）
- `reset()`：足音の時計と内部の状態を忘れる。やり直しの直後に、前の戦いの勝ち負けの音などが二度鳴らないように

## 必ず通るテスト
```js
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
```
