import { test, expect } from 'vitest';
import { CRYSTAL_FOES } from '../src/areas/crystal/foes.js';
import { VERGRAS } from '../src/areas/crystal/boss.js';
import { createEnemy } from '../src/story/enemy.js';

const list = Object.values(CRYSTAL_FOES);

test('晶冠峡谷の敵は通常7種・精鋭2種、ボスを入れて10種類', () => {
  expect(list.filter((f) => !f.elite)).toHaveLength(7);
  expect(list.filter((f) => f.elite)).toHaveLength(2);
  expect(VERGRAS.name).toBe('晶冠の守護獣ヴェルグラス');
  expect(new Set(list.map((f) => f.name)).size).toBe(9);
});

test('色違いではない：見た目の形・役割・対処法がそれぞれ違う', () => {
  expect(new Set(list.map((f) => f.look)).size).toBe(9);
  expect(new Set(list.map((f) => f.role)).size).toBe(9);
  expect(new Set(list.map((f) => f.counter)).size).toBe(9);
});

test('それぞれの役割の仕組みを持っている', () => {
  const f = CRYSTAL_FOES;
  expect(f.hound.flank).toBeGreaterThan(0);
  expect(f.bat.flyer.height).toBeGreaterThan(2);
  expect(f.bat.attacks[0].landAfter).toBeGreaterThan(1);
  expect(f.beetle.frontArmor && f.beetle.backWeak).toBeTruthy();
  expect(f.spear.attacks[0].track).toBe(false);
  expect(f.shield.guard).toBeTruthy();
  expect(f.caster.attacks.some((a) => a.buff)).toBe(true);
  expect(f.spider.attacks.some((a) => a.spawn?.type === 'web')).toBe(true);
  expect(f.charger.wallStun).toBeGreaterThan(0);
  expect(f.giant.weakParts.count).toBe(2);
});

test('どの攻撃にも予兆（0.6秒以上）と隙がある', () => {
  for (const foe of list) {
    for (const attack of foe.attacks) {
      expect(attack.windup, `${foe.name} ${attack.name}`).toBeGreaterThanOrEqual(0.6);
      expect(attack.recover, `${foe.name} ${attack.name}`).toBeGreaterThanOrEqual(0.5);
    }
  }
});

test('硝子羽の蝙蝠：急降下のあと、剣の届く低さ・近さに1秒以上いる（飛ぶ敵にも近接で攻撃できる）', () => {
  const free = (pos, dir, distance) => ({ x: pos.x + dir.x * distance, z: pos.z + dir.z * distance });
  const bat = createEnemy(CRYSTAL_FOES.bat, { id: 'b', x: 0, z: 0, facing: 0 }, { random: () => 0.9 });
  const player = { x: 0, z: 4 };
  let struck = false;
  let reachable = 0;
  for (let t = 0; t < 6; t += 1 / 60) {
    const frame = bat.update(1 / 60, { player, canSee: () => true, step: free, allies: [] });
    if (frame.strikes.length) struck = true;
    const close = Math.hypot(frame.x - player.x, frame.z - player.z) - CRYSTAL_FOES.bat.radius <= 1.6;
    if (struck && bat.height() < 0.8 && close) reachable += 1 / 60;
    if (struck && bat.height() > 2) break;
  }
  expect(struck).toBe(true);
  expect(reachable).toBeGreaterThan(1);
});
