import { test, expect } from 'vitest';
import { createBeastBrain, BEAST_MAX_HP } from '../src/combat/beastBrain.js';

const START = { x: 0, z: -6, facing: 0 }; // +z（主人公の開始位置の方向）を向いている
const front = (d) => ({ x: 0, z: -6 + d });
const behind = (d) => ({ x: 0, z: -6 - d });

// 予告が出るまで進めて、その最初の frame を返す
function untilTelegraph(brain, player, limit = 10, dt = 0.01) {
  for (let t = 0; t < limit; t += dt) {
    const f = brain.update(dt, player);
    if (f.phase === 'telegraph') return f;
  }
  throw new Error('予告が出なかった');
}

// 次に攻撃が当たる frame（strikes が空でない）まで進める
function untilStrike(brain, player, limit = 10, dt = 0.01) {
  for (let t = 0; t < limit; t += dt) {
    const f = brain.update(dt, player);
    if (f.strikes.length > 0) return { frame: f, time: t };
  }
  throw new Error('攻撃が当たらなかった');
}

test('正面の近くにいると叩きつけ（前方の扇）、真後ろの近くだと尻尾の回転（周りの円）', () => {
  const a = untilTelegraph(createBeastBrain({ start: START }), front(4));
  expect(a.attack.kind).toBe('slam');
  expect(a.attack.shapes[0]).toMatchObject({ type: 'sector', radius: 5 });

  const b = untilTelegraph(createBeastBrain({ start: START }), behind(4));
  expect(b.attack.kind).toBe('spin');
  expect(b.attack.shapes[0]).toMatchObject({ type: 'circle', radius: 6, x: 0, z: -6 });
});

test('予告の progress は 0→1 に進み、塗りつぶしの瞬間の frame だけ strikes に形が入る', () => {
  const brain = createBeastBrain({ start: START });
  const first = untilTelegraph(brain, front(4));
  expect(first.attack.progress).toBeLessThan(0.05);
  let mid = null;
  let strikeFrames = 0;
  for (let t = 0; t < 1.2; t += 0.01) {
    const f = brain.update(0.01, front(4));
    if (!mid && f.attack && f.attack.progress > 0.45 && f.attack.progress < 0.55) mid = f;
    if (f.strikes.length) strikeFrames++;
  }
  expect(mid).not.toBeNull();
  expect(strikeFrames).toBe(1);
});

test('叩きつけの予告は 0.9 秒。塗りつぶし後 0.15 秒は impact として形を残す', () => {
  const brain = createBeastBrain({ start: START });
  untilTelegraph(brain, front(4));
  const { time } = untilStrike(brain, front(4));
  expect(time).toBeCloseTo(0.9, 1);
  const after = brain.update(0.1, front(4));
  expect(after.attack).toMatchObject({ impact: true });
  brain.update(0.1, front(4));
  expect(brain.update(0.01, front(4)).attack).toBeNull();
});

test('予告の位置と向きは、出した瞬間に固定する（主人公が動いても追いかけない）', () => {
  const brain = createBeastBrain({ start: START });
  const first = untilTelegraph(brain, front(4));
  const shape = { ...first.attack.shapes[0] };
  const later = brain.update(0.3, { x: 5, z: -2 });
  expect(later.attack.shapes[0]).toEqual(shape);
});

test('同じ攻撃が2回続けて来ない（いろいろな位置で20回）', () => {
  const brain = createBeastBrain({ start: START, seed: 7 });
  const spots = [front(4), behind(4), front(9), front(20), { x: 5, z: -6 }];
  const kinds = [];
  for (let i = 0; i < 20; i++) {
    const spot = spots[i % spots.length];
    kinds.push(untilTelegraph(brain, spot).attack.kind);
    untilStrike(brain, spot);
  }
  for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
});

test('中くらい・遠いときは、結晶の雨か突進', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const kind = untilTelegraph(createBeastBrain({ start: START, seed }), front(9)).attack.kind;
    expect(['rain', 'charge']).toContain(kind);
  }
});

test('結晶の雨：主人公の位置に1つと周り3m以内に4つ、円どうしは2.4m以上離れ、0.15秒おきに1つずつ当たる', () => {
  let found = null;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const brain = createBeastBrain({ start: START, seed });
    const f = untilTelegraph(brain, front(9));
    if (f.attack.kind === 'rain') found = { brain, f };
  }
  const { brain, f } = found;
  const circles = f.attack.shapes;
  expect(circles).toHaveLength(5);
  expect(circles[0]).toMatchObject({ x: 0, z: 3, radius: 1.6 });
  for (const c of circles) expect(Math.hypot(c.x - 0, c.z - 3)).toBeLessThanOrEqual(3.0001);
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      expect(Math.hypot(circles[i].x - circles[j].x, circles[i].z - circles[j].z)).toBeGreaterThanOrEqual(2.4);
    }
  }
  const times = [];
  for (let t = 0; t < 3; t += 0.01) {
    const g = brain.update(0.01, front(9));
    if (g.strikes.length) times.push(t);
    if (times.length === 5) break;
  }
  expect(times).toHaveLength(5);
  expect(times[1] - times[0]).toBeCloseTo(0.15, 1);
});

test('突進の長さは「主人公までの距離 + 4m」と14mの短いほう。終点は半径13mの内側', () => {
  // 主人公が5m先 → 長さ9m
  const brain = createBeastBrain({ start: START, seed: 3 });
  let f = null;
  for (let seed = 1; seed < 40 && !f; seed++) {
    const b = createBeastBrain({ start: { x: 0, z: -6, facing: 0 }, seed });
    // 正面 7m（中くらい）で突進を探す
    const g = untilTelegraph(b, front(7));
    if (g.attack.kind === 'charge') f = g;
  }
  expect(f.attack.shapes[0]).toMatchObject({ type: 'band', width: 4 });
  expect(f.attack.shapes[0].length).toBeCloseTo(11);
  expect(brain).toBeDefined();

  // 端に寄った位置からの突進は、半径13mで止まる
  for (let seed = 1; seed < 40; seed++) {
    const b = createBeastBrain({ start: { x: 0, z: 8, facing: 0 }, seed });
    const g = untilTelegraph(b, { x: 0, z: 22 });
    if (g.attack.kind !== 'charge') continue;
    const band = g.attack.shapes[0];
    const endZ = band.z + Math.cos(band.angle) * band.length;
    const endX = band.x + Math.sin(band.angle) * band.length;
    expect(Math.hypot(endX, endZ)).toBeLessThanOrEqual(13.0001);
    return;
  }
  throw new Error('突進が選ばれなかった');
});

test('300ダメージでよろめき（2秒）、予告は消えて当たらない。300を超えた分は捨てる', () => {
  const brain = createBeastBrain({ start: START });
  untilTelegraph(brain, front(4));
  const result = brain.takeDamage(350);
  expect(result.stagger).toBe(true);
  const f = brain.update(0.01, front(4));
  expect(f.phase).toBe('stagger');
  expect(f.attack).toBeNull();
  let struck = false;
  for (let t = 0; t < 1.9; t += 0.01) if (brain.update(0.01, front(4)).strikes.length) struck = true;
  expect(struck).toBe(false);
  // 捨てた50はたまっていないので、あと250ではよろめかない
  expect(brain.takeDamage(250).stagger).toBe(false);
});

test('体力が半分を切ると怒り状態。次の攻撃から予告が0.75倍（叩きつけ 0.675→0.7秒で下限）', () => {
  const brain = createBeastBrain({ start: START, maxHp: 1600 });
  for (let i = 0; i < 4; i++) brain.takeDamage(200); // 合計800 → 体力800（半分）、まだ
  expect(brain.update(0.01, front(4)).enraged).toBe(false);
  const r = brain.takeDamage(10);
  expect(r.enraged).toBe(true);
  // よろめき（300ごと）を抜けてから、次の叩きつけの予告を測る
  for (let t = 0; t < 2.1; t += 0.01) brain.update(0.01, front(4));
  untilTelegraph(brain, front(4));
  const { time } = untilStrike(brain, front(4));
  // 0.9 × 0.75 = 0.675 秒だが、下限の 0.7 秒より短くしない
  expect(time).toBeGreaterThanOrEqual(0.685);
  expect(time).toBeLessThan(0.72);
});

test('怒り状態では、突進のあとにもう一度突進（2回目も予告あり）', () => {
  for (let seed = 1; seed < 60; seed++) {
    const brain = createBeastBrain({ start: START, seed, maxHp: 1600 });
    brain.takeDamage(299);
    brain.takeDamage(299);
    brain.takeDamage(299);
    brain.takeDamage(10); // 体力 1600-907=693 → 怒り。よろめきはしない（たまり 299+... の扱いに注意）
    for (let t = 0; t < 2.5; t += 0.01) brain.update(0.01, front(8));
    const f = untilTelegraph(brain, front(8));
    if (f.attack.kind !== 'charge') continue;
    untilStrike(brain, front(8));
    const second = untilTelegraph(brain, front(8));
    expect(second.attack.kind).toBe('charge');
    return;
  }
  throw new Error('怒り状態の突進が選ばれなかった');
});

test('体力0で dead。以後は攻撃しない。reset で最初に戻る', () => {
  const brain = createBeastBrain({ start: START });
  const r = brain.takeDamage(BEAST_MAX_HP);
  expect(r.dead).toBe(true);
  for (let t = 0; t < 5; t += 0.05) {
    const f = brain.update(0.05, front(4));
    expect(f.phase).toBe('dead');
    expect(f.strikes).toHaveLength(0);
  }
  brain.reset();
  const f = brain.update(0.01, front(4));
  expect(f.hp).toBe(BEAST_MAX_HP);
  expect(f.phase).not.toBe('dead');
  expect(f.position).toEqual({ x: 0, z: -6 });
});

test('遠いときは主人公へ近づき、向きは1秒に90度までしか変わらない', () => {
  const brain = createBeastBrain({ start: START });
  const far = { x: 20, z: -6 }; // 真横、20m
  const f = brain.update(0.5, far);
  expect(Math.abs(f.facing)).toBeLessThanOrEqual(Math.PI / 4 + 1e-6);
  let g = f;
  for (let t = 0; t < 0.5; t += 0.01) g = brain.update(0.01, far);
  expect(Math.hypot(g.position.x, g.position.z + 6)).toBeGreaterThan(0.5);
});

test('怒り状態の2回目の突進は、主人公のほうへ向き直ってから出す', () => {
  for (let seed = 1; seed < 80; seed++) {
    const brain = createBeastBrain({ start: START, seed, maxHp: 1600 });
    brain.takeDamage(299); brain.takeDamage(299); brain.takeDamage(299); brain.takeDamage(10);
    for (let t = 0; t < 2.5; t += 0.01) brain.update(0.01, front(8));
    const first = untilTelegraph(brain, front(8));
    if (first.attack.kind !== 'charge') continue;
    // 主人公は (0, 2)。1回目の突進で獣はその先まで進む
    untilStrike(brain, front(8));
    const second = untilTelegraph(brain, front(8));
    expect(second.attack.kind).toBe('charge');
    const band = second.attack.shapes[0];
    const toPlayer = Math.atan2(0 - band.x, 2 - band.z);
    expect(Math.abs(Math.atan2(Math.sin(band.angle - toPlayer), Math.cos(band.angle - toPlayer)))).toBeLessThan(0.3);
    return;
  }
  throw new Error('怒り状態の突進が選ばれなかった');
});

test('突進しても近づいても、頭の先（中心から5.35m）は木の輪（半径14.5m）の内側にとどまる', () => {
  const spots = [{ x: 0, z: 22 }, { x: 20, z: 0 }, { x: -15, z: -15 }, { x: 0, z: -22 }];
  for (const spot of spots) {
    for (let seed = 1; seed < 6; seed++) {
      const brain = createBeastBrain({ start: START, seed });
      for (let t = 0; t < 20; t += 0.02) {
        const f = brain.update(0.02, spot);
        const tip = { x: f.position.x + Math.sin(f.facing) * 5.35, z: f.position.z + Math.cos(f.facing) * 5.35 };
        expect(Math.hypot(tip.x, tip.z)).toBeLessThanOrEqual(14.5001);
      }
    }
  }
});
