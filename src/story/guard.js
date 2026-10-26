// 霧に侵された衛兵の頭脳（three.js も DOM も使わない。時間は dt だけで進む）。
// 立ったまま眠っている → 主人公が近くに見えたら目覚める → 追う → 予備動作 → 斬る（一度だけ当たる）→ 隙 → …
// 見通しが通らない相手は追わず、攻撃も出さない。持ち場から離れすぎたら戻る。
export const GUARD = {
  hp: 50,
  notice: 9,        // 気づく距離
  awaken: 1.1,      // 目覚めるのにかかる時間
  speed: 2.4,       // 追う速さ
  returnSpeed: 2,
  range: 1.7,       // この距離まで来たら斬りかかる
  reach: 1.8,       // 斬撃の届く距離
  spread: (100 * Math.PI) / 180,
  windup: 0.7,
  strike: 0.15,
  recover: 0.9,
  stun: 0.35,
  damage: 15,
  turnSpeed: Math.PI * 1.5, // 予備動作の間は、ゆっくりしか向きを変えない（避けられるように）
  spacing: 1.2,
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const loop = (name, timeScale = 1) => ({ name, loop: true, timeScale });
const once = (name, timeScale = 1) => ({ name, loop: false, timeScale });

// post = { id, x, z, facing, leash }
export function createGuard(post) {
  let x;
  let z;
  let facing;
  let hp;
  let phase;
  let timer;

  function reset() {
    x = post.x;
    z = post.z;
    facing = post.facing;
    hp = GUARD.hp;
    phase = 'dormant';
    timer = 0;
  }

  function turnToward(tx, tz, maxTurn) {
    const target = Math.atan2(tx - x, tz - z);
    const diff = wrap(target - facing);
    facing = wrap(facing + Math.sign(diff) * Math.min(Math.abs(diff), maxTurn));
  }

  function moveToward(tx, tz, speed, dt, step) {
    const dx = tx - x;
    const dz = tz - z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return;
    const next = step({ x, z }, { x: dx / d, z: dz / d }, Math.min(d, speed * dt));
    x = next.x;
    z = next.z;
  }

  // ほかの衛兵と近すぎたら、少し離れる
  function keepApart(others, step, dt) {
    for (const other of others) {
      const dx = x - other.x;
      const dz = z - other.z;
      const d = Math.hypot(dx, dz);
      if (d >= GUARD.spacing) continue;
      const nx = d > 1e-6 ? dx / d : -1;
      const nz = d > 1e-6 ? dz / d : 0;
      const next = step({ x, z }, { x: nx, z: nz }, Math.min(GUARD.spacing - d, 2 * dt + 0.01));
      x = next.x;
      z = next.z;
    }
  }

  // 斬られたとき。倒れたら true
  function takeDamage(amount) {
    if (phase === 'dead') return false;
    hp = Math.max(0, hp - amount);
    if (hp <= 0) {
      phase = 'dead';
      timer = 0;
      return true;
    }
    if (phase === 'dormant') {
      phase = 'awaken';
      timer = 0;
    } else if (phase !== 'awaken' && phase !== 'strike') {
      // のけぞり（予備動作は中断される）
      phase = 'stun';
      timer = 0;
    }
    return false;
  }

  function frame(extra = {}) {
    return { id: post.id, phase, x, z, facing, hp, strike: null, telegraph: phase === 'windup', events: [], animation: loop('Idle'), ...extra };
  }

  // input = { player: {x, z}, canSee(fromX, fromZ, toX, toZ), step(pos, dir, distance) -> pos, others: [{x, z}] }
  function update(dt, { player, canSee, step, others = [] }) {
    timer += dt;
    const distance = Math.hypot(player.x - x, player.z - z);
    const fromHome = Math.hypot(player.x - post.x, player.z - post.z);
    const visible = () => canSee(x, z, player.x, player.z);
    const events = [];

    if (phase === 'dead') return frame({ animation: once('Death_A') });

    if (phase === 'dormant') {
      if (distance <= GUARD.notice && visible()) {
        phase = 'awaken';
        timer = 0;
        events.push({ type: 'noticed', id: post.id });
      } else {
        return frame({ animation: once('Skeleton_Inactive_Standing_Pose') });
      }
    }

    if (phase === 'awaken') {
      turnToward(player.x, player.z, GUARD.turnSpeed * dt);
      if (timer < GUARD.awaken) return frame({ events, animation: once('Skeletons_Awaken_Standing') });
      phase = 'chase';
      timer = 0;
    }

    if (phase === 'stun') {
      if (timer < GUARD.stun) return frame({ animation: once('Hit_A') });
      phase = 'chase';
      timer = 0;
    }

    // 持ち場から離れすぎた相手や、見えなくなった相手は追わない
    if ((phase === 'chase' || phase === 'idle') && (fromHome > post.leash || !visible())) {
      phase = 'return';
      timer = 0;
    }

    if (phase === 'return') {
      if (fromHome <= post.leash - 2 && distance <= GUARD.notice && visible()) {
        phase = 'chase';
        timer = 0;
      } else {
        moveToward(post.x, post.z, GUARD.returnSpeed, dt, step);
        turnToward(post.x, post.z, GUARD.turnSpeed * 2 * dt);
        if (Math.hypot(x - post.x, z - post.z) < 0.05) {
          phase = 'idle';
          timer = 0;
          return frame({ events, animation: loop('Idle') });
        }
        return frame({ events, animation: loop('Walking_A') });
      }
    }

    if (phase === 'idle') {
      if (distance <= GUARD.notice && visible() && fromHome <= post.leash) {
        phase = 'chase';
        timer = 0;
      } else {
        return frame({ events, animation: loop('Idle') });
      }
    }

    if (phase === 'chase') {
      turnToward(player.x, player.z, GUARD.turnSpeed * 2 * dt);
      if (distance <= GUARD.range) {
        phase = 'windup';
        timer = 0;
      } else {
        moveToward(player.x, player.z, GUARD.speed, dt, step);
        keepApart(others, step, dt);
        return frame({ events, animation: loop('Walking_A', 1.3) });
      }
    }

    if (phase === 'windup') {
      turnToward(player.x, player.z, GUARD.turnSpeed * dt);
      keepApart(others, step, dt);
      // 振り下ろしのアニメーション（約1秒）を、予備動作＋当たる時間に合わせて伸び縮みさせる
      const swing = once('1H_Melee_Attack_Chop', 1.07 / (GUARD.windup + GUARD.strike + 0.2));
      if (!visible()) {
        phase = 'recover';
        timer = 0;
        return frame({ events, animation: swing });
      }
      if (timer < GUARD.windup) return frame({ events, telegraph: true, animation: swing });
      phase = 'strike';
      timer = 0;
      return frame({
        events,
        animation: swing,
        strike: { type: 'sector', x, z, angle: facing, radius: GUARD.reach, spread: GUARD.spread, damage: GUARD.damage },
      });
    }

    if (phase === 'strike') {
      if (timer < GUARD.strike) return frame({ events, animation: once('1H_Melee_Attack_Chop', 1.07 / (GUARD.windup + GUARD.strike + 0.2)) });
      phase = 'recover';
      timer = 0;
    }

    if (phase === 'recover') {
      keepApart(others, step, dt);
      if (timer < GUARD.recover) return frame({ events, animation: loop('Idle_Combat') });
      phase = 'chase';
      timer = 0;
    }

    return frame({ events, animation: loop('Idle_Combat') });
  }

  reset();
  return { update, takeDamage, reset, id: post.id, position: () => ({ x, z }), alive: () => phase !== 'dead' };
}
