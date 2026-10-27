import { test, expect } from 'vitest';
import { FROST_FOES } from '../src/areas/frost/foes.js';
import { createEnemy } from '../src/story/enemy.js';

const list = Object.values(FROST_FOES);
const chained = new Set(list.flatMap((f) => f.attacks.map((a) => a.next).filter(Boolean)));

test('霜葬峡谷の敵は通常7種・精鋭2種・ボス1種の10種類', () => {
  expect(list.filter((f) => !f.elite)).toHaveLength(7);
  expect(list.filter((f) => f.elite && !f.boss)).toHaveLength(2);
  expect(list.filter((f) => f.boss).map((f) => f.name)).toEqual(['霜葬の白角王イスヴァル']);
  expect(new Set(list.map((f) => f.name)).size).toBe(10);
});

test('色違いではない：見た目の形・役割・対処法がそれぞれ違う', () => {
  expect(new Set(list.map((f) => f.look)).size).toBe(10);
  expect(new Set(list.map((f) => f.role)).size).toBe(10);
  expect(new Set(list.map((f) => f.counter)).size).toBe(10);
});

test('どの攻撃にも予兆と隙がある（続けて出す技の2撃目は、1撃目から続く短い予兆）', () => {
  for (const foe of list) {
    for (const attack of foe.attacks) {
      const min = chained.has(attack.name) ? 0.3 : 0.6;
      expect(attack.windup, `${foe.name} ${attack.name}`).toBeGreaterThanOrEqual(min);
      // 連撃の途中（next がある技）は隙が短くてよい。最後の技には隙がある
      if (!attack.next) expect(attack.recover, `${foe.name} ${attack.name}`).toBeGreaterThanOrEqual(0.6);
    }
  }
});

test('それぞれの役割の仕組みを持っている', () => {
  const f = FROST_FOES;
  expect(f.wolf.flank && f.wolf.footprints).toBeTruthy();
  expect(f.owl.flyer && f.owl.attacks[0].next === 'swoop').toBeTruthy();
  expect(f.burrower.startHidden).toBe(true);
  expect(f.iceSpear.attacks[0].length).toBeGreaterThanOrEqual(9);
  expect(f.frostShield.guard.unbreakable).toBe(true);
  expect(f.frostCaster.attacks[0].spawn.type).toBe('blizzard');
  expect(f.mantis.attacks[0].next).toBe('scythe');
  expect(f.yeti.attacks.some((a) => a.scatter)).toBe(true);
  expect(f.duelist.attacks.some((a) => a.spawn?.type === 'clone')).toBe(true);
  expect(f.duelist.clone.footprints).toBe(false);
  expect(f.isval.attacks.some((a) => a.spawn?.type === 'wall')).toBe(true);
});

test('氷羽の梟：滑空のあと、剣の届く低さ・近さに1秒以上いる', () => {
  const free = (pos, dir, distance) => ({ x: pos.x + dir.x * distance, z: pos.z + dir.z * distance });
  const owl = createEnemy(FROST_FOES.owl, { id: 'o', x: 0, z: 0, facing: 0 }, { random: () => 0.9 });
  const player = { x: 0, z: 6 };
  let swooped = false;
  let reachable = 0;
  for (let t = 0; t < 10; t += 1 / 60) {
    const frame = owl.update(1 / 60, { player, canSee: () => true, step: free, allies: [] });
    if (frame.attackName === 'swoop' && frame.strikes.length) swooped = true;
    const close = Math.hypot(frame.x - player.x, frame.z - player.z) - FROST_FOES.owl.radius <= 1.6;
    if (swooped && owl.height() < 0.8 && close) reachable += 1 / 60;
    if (swooped && owl.height() > 2) break;
  }
  expect(swooped).toBe(true);
  expect(reachable).toBeGreaterThan(1);
});
