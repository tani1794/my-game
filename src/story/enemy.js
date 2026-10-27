// 敵の共通の頭脳（three.js も DOM も使わない。時間は dt だけで進む）。
// 種類ごとの違いは定義（def）のデータで決める：攻撃の形と時間、回り込み、飛行（攻撃のあとは地上に降りる）、
// 正面の装甲、盾、味方を強める詠唱、糸を張る、壁に当たると止まる突進、腕の弱点。
// 流れ：眠る → 気づく → 追う → 予兆（足もとに印）→ 攻撃（当たる時間）→ 隙 → …
import { computeDamage } from '../combat/damage.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const DEFAULTS = {
  hp: 120, defense: 45, radius: 0.5, speed: 2.4, notice: 10, awaken: 0.6, turnSpeed: Math.PI * 1.6,
  stun: 0.35, leash: 14,
};

// 攻撃の当たる形（向き facing、自分の位置から）
export function attackShape(attack, x, z, facing) {
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  const ox = x + fx * (attack.offset ?? 0);
  const oz = z + fz * (attack.offset ?? 0);
  if (attack.shape === 'circle') return { type: 'circle', x: ox, z: oz, radius: attack.radius };
  if (attack.shape === 'band') {
    const length = attack.length;
    return { type: 'band', x: ox + fx * length / 2, z: oz + fz * length / 2, angle: facing, length, width: attack.width };
  }
  return { type: 'sector', x: ox, z: oz, angle: facing, radius: attack.radius, spread: attack.spread ?? Math.PI / 2 };
}

// def：種類の定義。post：{ id, x, z, facing, leash }
export function createEnemy(defInput, post, { random = Math.random } = {}) {
  const def = { ...DEFAULTS, ...defInput };
  let x; let z; let facing; let hp; let phase; let timer; let cooldowns; let attack; let height; let defense;
  let buffedFor; let landed; let partsHp; let partsBroken; let flankSide; let dashBlocked; let woke; let struck; let attackCount; let aim;

  function reset() {
    x = post.x;
    z = post.z;
    facing = post.facing ?? 0;
    hp = def.hp;
    defense = def.defense;
    phase = def.startHidden ? 'hidden' : 'dormant';
    timer = 0;
    cooldowns = def.attacks.map(() => 0);
    attack = null;
    height = def.flyer ? def.flyer.height : 0;
    buffedFor = 0;
    landed = 0;
    partsHp = def.weakParts ? Array.from({ length: def.weakParts.count }, () => def.weakParts.hp) : [];
    partsBroken = 0;
    flankSide = random() < 0.5 ? -1 : 1;
    dashBlocked = false;
    woke = false;
    struck = false;
    attackCount = 0;
    aim = null;
  }

  const leash = post.leash ?? def.leash;
  const position = () => ({ x, z });

  function turnToward(tx, tz, maxTurn) {
    const target = Math.atan2(tx - x, tz - z);
    const diff = wrap(target - facing);
    facing = wrap(facing + Math.sign(diff) * Math.min(Math.abs(diff), maxTurn));
  }

  function moveToward(tx, tz, speed, dt, step) {
    const dx = tx - x;
    const dz = tz - z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return 0;
    const want = Math.min(d, speed * dt);
    const next = step({ x, z }, { x: dx / d, z: dz / d }, want);
    const moved = Math.hypot(next.x - x, next.z - z);
    x = next.x;
    z = next.z;
    return want > 1e-6 ? moved / want : 1;
  }

  // 斬られた。hit = { attack, power, critical, from: {x, z} }
  function hit({ attack: attackStat, power = 1, critical = false, from }) {
    if (phase === 'dead' || phase === 'hidden') return { damage: 0, dead: false, blocked: true };
    // 飛んでいる間は剣が届かない
    if (def.flyer && height > 0.8) return { damage: 0, dead: false, blocked: true, airborne: true };
    const fromAngle = Math.atan2(from.x - x, from.z - z);
    const front = Math.abs(wrap(fromAngle - facing)) < (def.frontArmor?.angle ?? 0);
    const guarding = shieldUp() && Math.abs(wrap(fromAngle - facing)) < Math.PI / 2;
    // 盾は強攻撃（倍率2以上）で崩れる
    if (guarding && power >= 2) {
      const damage = computeDamage({ attack: attackStat, power, defense, critical });
      hp = Math.max(0, hp - damage);
      if (hp <= 0) { phase = 'dead'; timer = 0; return { damage, dead: true, guardBreak: true }; }
      phase = 'stun';
      timer = -def.guard.breakStun;
      return { damage, dead: false, guardBreak: true };
    }
    let effectiveDefense = defense;
    if (front) effectiveDefense = def.frontArmor.defense;
    const exposed = def.weakParts && phase === 'recover' && partsBroken < partsHp.length;
    const damage = computeDamage({ attack: attackStat, power, defense: effectiveDefense, critical, guarding, weak: exposed || (def.backWeak && !front && Math.abs(wrap(fromAngle - facing)) > Math.PI * 0.6) });
    if (exposed) {
      // 腕の結晶を削る。割れるたびに防御が下がり、よろめく
      const index = partsHp.findIndex((value) => value > 0);
      partsHp[index] -= damage;
      if (partsHp[index] <= 0) {
        partsBroken += 1;
        defense = Math.max(5, defense - def.weakParts.defenseDrop);
        phase = 'stun';
        timer = -def.weakParts.stun;
      }
    }
    hp = Math.max(0, hp - damage);
    if (hp <= 0) {
      phase = 'dead';
      timer = 0;
      return { damage, dead: true, weak: exposed };
    }
    if (phase === 'dormant') { phase = 'awaken'; timer = 0; }
    // 詠唱は当たると中断される。飛ぶ敵は低いところで斬られると地面に落ちる
    if (def.flyer) { landed = Math.max(landed, def.flyer.dropOnHit ?? 1.2); height = 0; }
    if (phase === 'channel') { phase = 'stun'; timer = 0; }
    else if (!def.superArmor && !guarding && phase !== 'strike' && phase !== 'awaken' && phase !== 'stun') { phase = 'stun'; timer = 0; }
    return { damage, dead: false, blocked: guarding, front, weak: exposed };
  }

  const shieldUp = () => Boolean(def.guard) && (phase === 'chase' || phase === 'idle' || phase === 'windup');

  function chooseAttack(distance, allies) {
    let best = -1;
    def.attacks.forEach((candidate, i) => {
      if (cooldowns[i] > 0) return;
      const [min, max] = candidate.range;
      if (distance < min || distance > max) return;
      if (candidate.buff && !allies.some((a) => a.alive && a.id !== post.id && Math.hypot(a.x - x, a.z - z) <= candidate.buff.radius)) return;
      if (best < 0) best = i;
    });
    return best;
  }

  function frame(extra = {}) {
    return {
      id: post.id, kind: def.kind, x, z, height, facing, hp, maxHp: def.hp, phase, timer,
      telegraph: [], strikes: [], spawns: [], buffs: [], events: [],
      buffed: buffedFor > 0, guarding: shieldUp(),
      exposed: Boolean(def.weakParts && phase === 'recover' && partsBroken < partsHp.length),
      partsBroken, attackName: attack?.name ?? null, ...extra,
    };
  }

  // ctx = { player: {x, z}, canSee(ax, az, bx, bz), step(pos, dir, distance), allies: [{id, x, z, alive}] }
  function update(dt, { player, canSee, step, allies = [] }) {
    timer += dt;
    cooldowns = cooldowns.map((c) => Math.max(0, c - dt));
    buffedFor = Math.max(0, buffedFor - dt);
    const distance = Math.hypot(player.x - x, player.z - z);
    const fromHome = Math.hypot(player.x - post.x, player.z - post.z);
    const visible = () => canSee(x, z, player.x, player.z);
    const speed = def.speed * (buffedFor > 0 ? 1.2 : 1);
    const events = [];

    if (phase === 'dead') return frame();
    // 地中・雪の下に隠れて待つ（盛り上がりで場所は分かる）
    if (phase === 'hidden') {
      if (distance <= (def.ambush ?? 4) && visible()) { phase = 'awaken'; timer = 0; events.push({ type: 'noticed', id: post.id }); }
      return frame({ events });
    }
    if (phase === 'dormant') {
      if (distance <= def.notice && visible()) { phase = 'awaken'; timer = 0; events.push({ type: 'noticed', id: post.id }); }
      else return frame();
    }
    if (phase === 'awaken') {
      turnToward(player.x, player.z, def.turnSpeed * dt);
      if (timer < def.awaken) return frame({ events });
      woke = true;
      phase = 'chase';
      timer = 0;
    }
    if (phase === 'stun') {
      if (timer < def.stun) return frame({ events });
      phase = 'chase';
      timer = 0;
    }
    // 飛ぶ敵：攻撃のあと（や斬られて落ちたあと）しばらく地上にいる。それ以外は空へ戻る
    if (def.flyer) {
      if (landed > 0) { landed -= dt; height = 0; }
      else if (phase !== 'windup' && phase !== 'strike') height = def.flyer.height;
    }

    if ((phase === 'chase' || phase === 'idle') && (fromHome > leash || !visible())) { phase = 'return'; timer = 0; }
    if (phase === 'return') {
      if (fromHome <= leash - 2 && distance <= def.notice && visible()) { phase = 'chase'; timer = 0; }
      else {
        moveToward(post.x, post.z, speed * 0.8, dt, step);
        turnToward(post.x, post.z, def.turnSpeed * dt);
        if (Math.hypot(x - post.x, z - post.z) < 0.1) { phase = 'idle'; timer = 0; }
        return frame({ events });
      }
    }
    if (phase === 'idle') {
      if (distance <= def.notice && visible() && fromHome <= leash) { phase = 'chase'; timer = 0; }
      else return frame({ events });
    }

    if (phase === 'chase') {
      turnToward(player.x, player.z, def.turnSpeed * dt);
      const index = chooseAttack(distance, allies);
      if (index >= 0) {
        attack = def.attacks[index];
        cooldowns[index] = attack.cooldown ?? 1;
        phase = attack.buff ? 'channel' : 'windup';
        timer = 0;
        dashBlocked = false;
        struck = false;
        attackCount += 1;
        // 狙い撃ちは、予兆を出した時の主人公の場所に落ちる
        aim = attack.aim === 'target' ? { x: player.x, z: player.z } : null;
      } else {
        // 近づく。回り込む敵は横へずれた点へ、距離を保つ敵は離れる
        let tx = player.x;
        let tz = player.z;
        const keep = def.keepDistance ?? 0;
        if (def.flank && distance < def.flank * 2.2) {
          const side = Math.atan2(x - player.x, z - player.z) + flankSide * 0.9;
          tx = player.x + Math.sin(side) * def.flank;
          tz = player.z + Math.cos(side) * def.flank;
        }
        if (keep > 0 && distance < keep) {
          const away = Math.atan2(x - player.x, z - player.z);
          tx = x + Math.sin(away) * 2;
          tz = z + Math.cos(away) * 2;
        }
        if (distance > Math.max(0.8, keep * 0.9) || keep > 0) moveToward(tx, tz, speed, dt, step);
        return frame({ events });
      }
    }

    // 味方を強める詠唱（予兆の円が出る。斬ると中断）
    if (phase === 'channel') {
      const telegraph = [{ type: 'circle', x, z, radius: attack.buff.radius }];
      if (timer < attack.windup) return frame({ events, telegraph });
      const buffs = allies.filter((a) => a.alive && a.id !== post.id && Math.hypot(a.x - x, a.z - z) <= attack.buff.radius)
        .map((a) => ({ id: a.id, seconds: attack.buff.seconds }));
      phase = 'recover';
      timer = 0;
      return frame({ events, buffs });
    }

    if (phase === 'windup') {
      if (attack.track !== false) turnToward(player.x, player.z, def.turnSpeed * 0.5 * dt);
      if (!visible() && !attack.blind) { phase = 'recover'; timer = 0; return frame({ events }); }
      if (def.flyer) height = Math.max(0.6, def.flyer.height * (1 - timer / attack.windup));
      const telegraph = [shapeNow()];
      if (timer < attack.windup) return frame({ events, telegraph });
      phase = 'strike';
      timer = 0;
    }

    if (phase === 'strike') {
      let strikes = [];
      // 突進：向きのまま走る。壁や障害物に当たると、長くよろめく（大きな隙）
      if (attack.dash) {
        const fx = Math.sin(facing);
        const fz = Math.cos(facing);
        const moved = moveToward(x + fx * 10, z + fz * 10, attack.dash, dt, step);
        if (moved < 0.5 && def.wallStun) { dashBlocked = true; events.push({ type: 'wallHit', id: post.id, x, z }); }
      }
      // 同じ攻撃は一度しか当たらない（key で runner が重ねて当てない）
      strikes = [{ key: `${post.id}:${attackCount}`, shape: shapeNow(), damage: Math.round(attack.damage * (buffedFor > 0 ? 1.3 : 1)) }];
      const first = !struck;
      struck = true;
      const spawns = first && attack.spawn ? [{ ...attack.spawn, ...spawnPoint(attack) }] : [];
      if (dashBlocked) {
        phase = 'stun';
        timer = -def.wallStun;
        return frame({ events, strikes: [], spawns });
      }
      if (timer < attack.active) return frame({ events, strikes: first || attack.continuous ? strikes : [], spawns });
      phase = 'recover';
      timer = 0;
      if (def.flyer) { landed = attack.landAfter ?? 1.6; height = 0; }
    }

    if (phase === 'recover') {
      if (timer < (attack?.recover ?? 0.8)) return frame({ events });
      phase = 'chase';
      timer = 0;
    }
    return frame({ events });
  }

  function shapeNow() {
    if (aim) return { type: 'circle', x: aim.x, z: aim.z, radius: attack.radius };
    return attackShape(attack, x, z, facing);
  }

  function spawnPoint(attackDef) {
    if (aim) return { x: aim.x, z: aim.z };
    return { x: x + Math.sin(facing) * (attackDef.spawnDistance ?? 3), z: z + Math.cos(facing) * (attackDef.spawnDistance ?? 3) };
  }

  // 詠唱で強められた
  function buff(seconds) {
    buffedFor = Math.max(buffedFor, seconds);
  }

  function kill() {
    hp = 0;
    phase = 'dead';
    timer = 0;
  }

  reset();
  return {
    id: post.id, def, update, hit, reset, buff, kill, position,
    alive: () => phase !== 'dead',
    hidden: () => phase === 'hidden',
    awake: () => woke,
    elite: Boolean(def.elite),
    radius: def.radius,
    height: () => height,
  };
}

