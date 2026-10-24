// 戦い全体のまとめ役：主人公と結晶獣を進め、当たりを判定して体力を減らし、勝ち負けを決める。
// three.js にも DOM にも依存しない。
import { createPlayerActions } from './playerActions.js';
import { createBeastBrain } from './beastBrain.js';
import { shapeContains, sectorHitsCircle } from './shapes.js';

const MAX_DT = 0.05;
const SWORD = { radius: 1.6, spread: (120 * Math.PI) / 180 };
const STRIKE_DAMAGE = { slam: 30, charge: 35, spin: 25, rain: 20 };
const RAIN_HIT_CAP = 2;
// 結晶獣の体：胴の前・中・後の円（全長約10.7m、幅約5.2m）
const BODY = { radius: 2.6, reach: 2.75 };

export function bodyColliders(position, facing) {
  const dx = Math.sin(facing) * BODY.reach;
  const dz = Math.cos(facing) * BODY.reach;
  return [
    { x: position.x + dx, z: position.z + dz, radius: BODY.radius },
    { x: position.x, z: position.z, radius: BODY.radius },
    { x: position.x - dx, z: position.z - dz, radius: BODY.radius },
  ];
}

// 同じ瞬間に両方の体力が0なら勝ち
export function decideOutcome(beastHp, playerHp) {
  if (beastHp <= 0) return 'won';
  if (playerHp <= 0) return 'lost';
  return 'fighting';
}

export function createBattle({ seed = 1, beastHp, playerHp } = {}) {
  const actions = createPlayerActions(playerHp === undefined ? {} : { maxHp: playerHp });
  const brain = createBeastBrain({ seed, ...(beastHp === undefined ? {} : { maxHp: beastHp }) });

  let started;
  let outcome;
  let time;
  let facing; // 主人公の今の向き（攻撃の扇の向き）
  let hitSwings;
  let rainHits;
  let lastBeast;
  let lastPhase;

  function reset(options = {}) {
    actions.reset();
    brain.reset(options);
    started = false;
    outcome = 'fighting';
    time = 0;
    facing = null;
    hitSwings = new Set();
    rainHits = 0;
    lastPhase = null;
    lastBeast = brain.update(0, { x: 0, z: 0 });
  }

  function update(rawDt, { intent, playerPos, beastColliders }) {
    const dt = Math.min(rawDt, MAX_DT);
    const events = [];

    if (facing === null) facing = intent.facing ?? Math.PI;
    if (!started && (Math.hypot(intent.move.x, intent.move.z) > 0 || intent.attack)) started = true;

    // ── 主人公 ──
    const player = actions.update(dt, {
      ...intent,
      facing,
      self: playerPos,
      target: outcome === 'won' ? null : lastBeast.position,
    });
    if (player.face !== null) facing = player.face;
    else if (player.move.speed > 0) facing = Math.atan2(player.move.x, player.move.z);

    // ── 主人公の攻撃：1回の振りで1回だけ ──
    if (outcome === 'fighting' && player.swing && !hitSwings.has(player.swing.id)) {
      const sword = { type: 'sector', x: playerPos.x, z: playerPos.z, angle: facing, ...SWORD };
      const body = beastColliders ?? bodyColliders(lastBeast.position, lastBeast.facing);
      if (body.some((circle) => sectorHitsCircle(sword, circle))) {
        hitSwings.add(player.swing.id);
        const result = brain.takeDamage(player.swing.damage);
        events.push({
          type: 'beastHit',
          damage: player.swing.damage,
          x: playerPos.x + Math.sin(facing) * 1.2,
          z: playerPos.z + Math.cos(facing) * 1.2,
        });
        if (result.stagger) events.push({ type: 'stagger' });
        if (result.enraged) events.push({ type: 'enraged' });
      }
    }

    // ── 結晶獣：戦いが始まるまで、決着の後は動かさない ──
    let beast = lastBeast;
    if (started && outcome === 'fighting') {
      beast = brain.update(dt, playerPos);
      if (beast.phase === 'telegraph' && lastPhase !== 'telegraph') rainHits = 0;
      lastPhase = beast.phase;

      const kind = beast.strikeKind;
      for (const shape of beast.strikes) {
        // 地面に落ちる攻撃は、当たらなくても揺れる
        if (kind === 'slam' || kind === 'rain') events.push({ type: 'shake', strength: 0.5 });
        if (!shapeContains(shape, playerPos)) continue;
        if (kind === 'rain' && rainHits >= RAIN_HIT_CAP) continue;
        if (actions.takeHit(STRIKE_DAMAGE[kind])) {
          if (kind === 'rain') rainHits += 1;
          events.push({ type: 'playerHit', damage: STRIKE_DAMAGE[kind] });
          events.push({ type: 'shake', strength: 1 });
        }
      }
    }
    lastBeast = beast;

    // ── 勝ち負け ──
    const playerHpNow = actions.hp();
    if (outcome === 'fighting') {
      const next = decideOutcome(beast.hp, playerHpNow);
      if (next !== 'fighting') {
        outcome = next;
        events.push(next === 'won' ? { type: 'won', time } : { type: 'lost' });
      }
    }
    if (started && outcome === 'fighting') time += dt;

    // 決着の後は、残っている予告を消し、当たりも出さない
    const shownBeast = outcome === 'fighting' ? beast : { ...beast, attack: null, strikes: [] };
    return { player: { ...player, hp: playerHpNow }, beast: shownBeast, events, outcome, time };
  }

  reset();
  return { update, reset };
}
