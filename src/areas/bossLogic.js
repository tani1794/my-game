// エリアのボス戦の決まり（three.js も DOM も使わない）。頭脳は今までの結晶獣（beastBrain）、
// 当たり・ダメージは battle.js と同じ考え方（主人公の攻撃力と防御で計算、結晶の雨は1回で2発まで）。
import { createBeastBrain } from '../combat/beastBrain.js';
import { STRIKE_DAMAGE, RAIN_HIT_CAP, bodyColliders } from '../combat/battle.js';
import { shapeContains, sectorHitsCircle } from '../combat/shapes.js';
import { computeDamage } from '../combat/damage.js';

const MAX_DT = 0.05;

// boss = { start, bounds, hp, defense, seed? }
export function createBossLogic(boss) {
  const brain = createBeastBrain({ seed: boss.seed ?? 7, start: boss.start, bounds: boss.bounds, maxHp: boss.hp });
  let active = false;
  let down = false;
  let reported = false;
  let rainHits = 0;
  let lastPhase = null;
  let frame = brain.update(0, { x: boss.start.x, z: boss.start.z + 10 });

  // hitPlayer(damage) → 当たったか（回避の無敵なら false）
  function update(rawDt, player, hitPlayer) {
    const dt = Math.min(rawDt, MAX_DT);
    const events = [];
    if (!active && !down) return { ...frame, attack: null, strikes: [], events };
    frame = brain.update(dt, player);
    if (frame.phase === 'telegraph' && lastPhase !== 'telegraph') rainHits = 0;
    lastPhase = frame.phase;
    const kind = frame.strikeKind;
    for (const shape of frame.strikes) {
      if (kind === 'slam' || kind === 'rain') events.push({ type: 'shake', strength: 0.5 });
      if (!shapeContains(shape, player)) continue;
      if (kind === 'rain' && rainHits >= RAIN_HIT_CAP) continue;
      if (hitPlayer(STRIKE_DAMAGE[kind])) {
        if (kind === 'rain') rainHits += 1;
        events.push({ type: 'shake', strength: 1 });
      }
    }
    if (down && !reported) {
      reported = true;
      events.push({ type: 'defeated' });
    }
    // 倒れたあとは予告も当たりも出さない（崩れ落ちる動きだけ進める）
    return down ? { ...frame, attack: null, strikes: [], events } : { ...frame, events };
  }

  // 剣で斬る（体の3つの円のどれかに扇が届けば当たり）。戦っていなければ null
  function swordHit(sword, { attack, power, critical }, colliders = bodyColliders(frame.position, frame.facing)) {
    if (!active || down) return null;
    if (!colliders.some((circle) => sectorHitsCircle(sword, circle))) return null;
    const damage = computeDamage({ attack, power, defense: boss.defense, critical });
    const result = brain.takeDamage(damage);
    if (result.dead) down = true;
    return { damage, ...result };
  }

  function reset() {
    brain.reset();
    active = false;
    down = false;
    reported = false;
    rainHits = 0;
    lastPhase = null;
    frame = brain.update(0, { x: boss.start.x, z: boss.start.z + 10 });
  }

  // 確認用（?debug）：体力を left まで減らす。最後の一撃は本当に斬って倒す
  function weaken(left) {
    if (frame.hp > left) brain.takeDamage(frame.hp - left);
    frame = { ...frame, hp: Math.min(frame.hp, left) };
  }

  return {
    update, swordHit, reset, weaken,
    start: () => { active = true; },
    active: () => active && !down,
    down: () => down,
    frame: () => frame,
    maxHp: boss.hp,
  };
}
