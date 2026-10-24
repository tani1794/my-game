// 戦いの長さを確かめるための、自動の操作役（画面なしで戦う）
import { createBattle, bodyColliders } from '../../src/combat/battle.js';
import { shapeContains } from '../../src/combat/shapes.js';
import { stepPosition } from '../../src/player.js';

const DT = 1 / 60;
const ARENA = 22;
const KEEP_DISTANCE = 7;
const DODGE_LEAD = 0.25;

const length = (v) => Math.hypot(v.x, v.z);
const normalize = (v) => {
  const l = length(v);
  return l > 1e-6 ? { x: v.x / l, z: v.z / l } : { x: 0, z: 0 };
};

// 形の外へ出る向き（円と扇は中心から外へ、帯は横へ）
function escapeDirection(shape, pos) {
  if (shape.type === 'band') {
    const side = { x: Math.cos(shape.angle), z: -Math.sin(shape.angle) };
    const offset = (pos.x - shape.x) * side.x + (pos.z - shape.z) * side.z;
    return offset >= 0 ? side : { x: -side.x, z: -side.z };
  }
  const out = normalize({ x: pos.x - shape.x, z: pos.z - shape.z });
  return length(out) > 0 ? out : { x: 1, z: 0 };
}

function distanceToBody(pos, beast) {
  return Math.min(...bodyColliders(beast.position, beast.facing).map((c) => Math.hypot(pos.x - c.x, pos.z - c.z) - c.radius));
}

export function simulateFight(seed, { maxSeconds = 900, ...options } = {}) {
  const battle = createBattle({ seed, ...options });
  let pos = { x: 0, z: 6 };
  let result = battle.update(0, { intent: { move: { x: 0, z: 0 }, run: false, attack: false, dodge: false, facing: Math.PI }, playerPos: pos });
  let lastProgress = 0;
  let progressRate = 1;
  let attackCooldown = 0;

  for (let t = 0; t < maxSeconds; t += DT) {
    const { beast, player } = result;
    const intent = { move: { x: 0, z: 0 }, run: false, attack: false, dodge: false, facing: Math.PI };
    const toBeast = normalize({ x: beast.position.x - pos.x, z: beast.position.z - pos.z });

    const threat = beast.attack && !beast.attack.impact
      ? beast.attack.shapes.find((shape) => shapeContains(shape, pos))
      : null;

    if (beast.attack && !beast.attack.impact) {
      const p = beast.attack.progress;
      if (p > lastProgress) progressRate = (p - lastProgress) / DT;
      lastProgress = p;
    } else {
      lastProgress = 0;
    }

    if (threat) {
      // 予告の中にいる：塗りつぶしの直前に外へ回避。スタミナが足りなければ走って出る
      const timeLeft = (1 - beast.attack.progress) / Math.max(progressRate, 1e-3);
      intent.move = escapeDirection(threat, pos);
      if (timeLeft <= DODGE_LEAD && player.stamina >= 20 && player.mode !== 'dodge') intent.dodge = true;
      else intent.run = true;
    } else if (beast.phase === 'recover' || beast.phase === 'stagger') {
      // 動けない間だけ近づいて攻撃
      if (distanceToBody(pos, beast) > 1.0) {
        intent.move = toBeast;
        intent.run = true;
      } else if (attackCooldown <= 0) {
        intent.attack = true;
        attackCooldown = 0.1;
      }
    } else {
      // ふだんは 7m を保って回る
      const distance = Math.hypot(beast.position.x - pos.x, beast.position.z - pos.z);
      if (distance < KEEP_DISTANCE - 0.5) intent.move = { x: -toBeast.x, z: -toBeast.z };
      else if (distance > KEEP_DISTANCE + 1) intent.move = toBeast;
      else intent.move = { x: -toBeast.z, z: toBeast.x };
    }
    attackCooldown -= DT;

    result = battle.update(DT, { intent, playerPos: pos });
    if (result.outcome !== 'fighting') return { outcome: result.outcome, time: result.time };

    const move = result.player.move;
    if (move.speed > 0) {
      const next = stepPosition(pos, move, move.speed * DT, bodyColliders(result.beast.position, result.beast.facing), ARENA);
      pos = { x: next.x, z: next.z };
    }
  }
  return { outcome: 'timeout', time: maxSeconds };
}
