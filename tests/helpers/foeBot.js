// 共通の敵の頭脳でできたボスと、自動の操作役が戦う（体力を決めるため）。
// 主人公は今までと同じ playerActions（3段攻撃・回避・スタミナ）。予兆の形に入っていたら、当たる直前に回避する。
// 隙（recover・stun）か、自分が予兆の外にいるときに近づいて斬る。氷の壁は主人公を止めない（簡略化）
import { createEnemy } from '../../src/story/enemy.js';
import { createPlayerActions } from '../../src/combat/playerActions.js';
import { computeDamage } from '../../src/combat/damage.js';
import { shapeContains, sectorHitsCircle } from '../../src/combat/shapes.js';

const DT = 1 / 30;
const SWORD = { radius: 1.6, spread: (120 * Math.PI) / 180 };
const ARENA = 26;
const DODGE_LEAD = 0.3;

export function simulateFoeFight(def, seed, { attack = 35, maxSeconds = 900, onHit = () => {} } = {}) {
  let n = seed;
  const random = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
  const boss = createEnemy(def, { id: 'boss', x: 0, z: -10, facing: 0 }, { random });
  boss.wake();
  const actions = createPlayerActions({ attack });
  let pos = { x: 0, z: 8 };
  let facing = Math.PI;
  const hit = new Set();
  const struck = new Set();
  let frame = boss.update(0, { player: pos, canSee: () => true, step: (p, d, s) => clampStep(p, d, s) });
  for (let t = 0; t < maxSeconds; t += DT) {
    const b = boss.position();
    const toBoss = { x: b.x - pos.x, z: b.z - pos.z };
    const distance = Math.hypot(toBoss.x, toBoss.z) - boss.radius;
    const danger = frame.phase === 'windup' && frame.telegraph.some((shape) => shapeContains(shape, pos));
    const late = frame.timer > frame.windupTime - DODGE_LEAD;
    const opening = ['recover', 'stun', 'awaken'].includes(frame.phase) || (frame.phase === 'windup' && !danger);
    let move = { x: 0, z: 0 };
    let dodge = false;
    let swing = false;
    if (danger && late) {
      // 形の外へ（中心から離れる向き）
      const shape = frame.telegraph.find((s) => shapeContains(s, pos));
      const away = Math.atan2(pos.x - shape.x, pos.z - shape.z) + (random() - 0.5);
      move = { x: Math.sin(away), z: Math.cos(away) };
      dodge = true;
    } else if (danger) {
      const shape = frame.telegraph.find((s) => shapeContains(s, pos));
      const away = Math.atan2(pos.x - shape.x, pos.z - shape.z);
      move = { x: Math.sin(away), z: Math.cos(away) };
    } else if (opening && distance > 1.2) {
      const l = Math.hypot(toBoss.x, toBoss.z);
      move = { x: toBoss.x / l, z: toBoss.z / l };
    } else if (opening) {
      swing = true;
    } else if (distance < 5) {
      const l = Math.hypot(toBoss.x, toBoss.z);
      move = { x: -toBoss.x / l, z: -toBoss.z / l };
    }
    const out = actions.update(DT, { move, run: true, attack: swing, dodge, target: b, self: pos, facing, lockOn: true });
    if (out.face !== null) facing = out.face;
    else if (out.move.speed > 0) facing = Math.atan2(out.move.x, out.move.z);
    pos = clampStep(pos, { x: out.move.x, z: out.move.z }, out.move.speed * DT);
    if (out.swing && !hit.has(out.swing.id)) {
      const sword = { type: 'sector', x: pos.x, z: pos.z, angle: facing, ...SWORD };
      if (sectorHitsCircle(sword, { ...b, radius: boss.radius })) {
        hit.add(out.swing.id);
        const result = boss.hit({ attack, power: out.swing.power, from: pos });
        if (result.dead) return { outcome: 'won', time: t };
      }
    }
    frame = boss.update(DT, { player: pos, canSee: () => true, step: (p, d, s) => clampStep(p, d, s) });
    for (const strike of frame.strikes) {
      if (struck.has(strike.key) || !shapeContains(strike.shape, pos)) continue;
      struck.add(strike.key);
      if (actions.takeHit(strike.damage)) onHit(frame.attackName);
    }
    if (actions.hp() <= 0) return { outcome: 'lost', time: t, bossHp: boss.hp() };
  }
  return { outcome: 'timeout', time: maxSeconds };
}

function clampStep(p, d, s) {
  const x = p.x + d.x * s;
  const z = p.z + d.z * s;
  const r = Math.hypot(x, z);
  return r > ARENA ? { x: (x / r) * ARENA, z: (z / r) * ARENA } : { x, z };
}
