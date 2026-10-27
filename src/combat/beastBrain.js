// 結晶獣の頭脳：向き直り・接近・予告・攻撃・動けない時間・よろめき・怒り状態・倒れる。
// three.js にも DOM にも依存しない。時間は update の dt だけで進む。
import { angleTo, angleDiff } from './shapes.js';
import { mulberry32 } from '../world/random.js';

// 体力は、自動の操作役で戦いの長さが3〜5分に入るように調整した値（tests/balance.test.js）
export const BEAST_MAX_HP = 2800;
const MAX_HP = BEAST_MAX_HP;
const ENRAGE_BELOW = MAX_HP / 2;
const STAGGER_EVERY = 300;
const STAGGER_TIME = 2;
const DEATH_TIME = 1.5;

const NEAR = 6;
const FAR = 12;
const FRONT_HALF_ANGLE = Math.PI / 3;
const TURN_SPEED = Math.PI / 2; // 1秒に90度
const APPROACH_SPEED = 2.5;

const TELEGRAPH = { slam: 0.9, charge: 1.1, spin: 0.8, rain: 1.3 };
const ENRAGE_FACTOR = 0.75;
const MIN_TELEGRAPH = 0.7;
const IMPACT_TIME = 0.15;

const SLAM = { reachFromCenter: 2.5, radius: 5, spread: (100 * Math.PI) / 180 };
const SPIN_RADIUS = 6;
const CHARGE = { width: 4, maxLength: 14, overshoot: 4, speed: 14 / 0.9 };
// 体は中心から前後に約5.35m。どの向きに回っても頭の先が木の輪（半径14.5m）に入らないよう、中心は半径9.15m以内
const BODY_HALF_LENGTH = 5.35;
const TREE_LINE = 14.5;
const CENTER_BOUNDS = TREE_LINE - BODY_HALF_LENGTH;
// 怒り状態の2回目の突進：主人公との角度差がこれ以下になるまで向き直る（最長2.5秒）
const ALIGN_TOLERANCE = 0.15;
const ALIGN_MAX_TIME = 2.5;
const RAIN = { count: 5, radius: 1.6, scatter: 3, spacing: 2.4, interval: 0.15 };
const CUE_TIME = { slam: 0.5, spin: 0.6, rain: RAIN.interval * (RAIN.count - 1) + IMPACT_TIME };

export function createBeastBrain({ seed = 1, start = { x: 0, z: -6, facing: 0 }, bounds = CENTER_BOUNDS, maxHp = MAX_HP, staggerEvery = STAGGER_EVERY } = {}) {
  // 怒り状態は体力が半分を切ったとき（既定の1600なら800）
  const enrageBelow = maxHp * (ENRAGE_BELOW / MAX_HP);
  let random;
  let position;
  let facing;
  let hp;
  let enraged;
  let phase;
  let timer;
  let waitTime; // idle の向き直り時間・recover の長さ
  let attack; // { kind, shapes, telegraphTime, cueTime, struck, dropsDone, chargeFrom }
  let lastKind;
  let staggerAccum;
  let secondCharge; // 怒り状態の突進の2回目を出すか

  function reset(options = {}) {
    random = mulberry32(options.seed ?? seed);
    position = { x: start.x, z: start.z };
    facing = start.facing;
    hp = maxHp;
    enraged = false;
    phase = 'idle';
    timer = 0;
    waitTime = between(0.6, 0.8);
    attack = null;
    lastKind = null;
    staggerAccum = 0;
    secondCharge = false;
  }

  function between(min, max) {
    return min + (max - min) * random();
  }

  // ── 攻撃の選び方：距離と向きで候補を決め、直前と同じなら別の候補に ──
  function chooseKind(player) {
    const distance = Math.hypot(player.x - position.x, player.z - position.z);
    const inFront = Math.abs(angleDiff(facing, angleTo(position, player))) <= FRONT_HALF_ANGLE;

    let kind;
    let other;
    if (distance <= NEAR) {
      kind = inFront ? 'slam' : 'spin';
      other = inFront ? 'spin' : 'slam';
    } else {
      // 中くらいは雨が多め、遠いときは突進が多め
      const rainChance = distance <= FAR ? 0.65 : 0.35;
      kind = random() < rainChance ? 'rain' : 'charge';
      other = kind === 'rain' ? 'charge' : 'rain';
    }
    return kind === lastKind ? other : kind;
  }

  // 突進の長さ：主人公までの距離 + 4m と 14m の短いほう。動ける範囲（半径 bounds）の端で止まる
  function chargeLength(player) {
    const distance = Math.hypot(player.x - position.x, player.z - position.z);
    let length = Math.min(CHARGE.maxLength, distance + CHARGE.overshoot);

    const dx = Math.sin(facing);
    const dz = Math.cos(facing);
    const b = position.x * dx + position.z * dz;
    const c = position.x ** 2 + position.z ** 2 - bounds ** 2;
    const toEdge = -b + Math.sqrt(Math.max(0, b * b - c));
    length = Math.max(0, Math.min(length, toEdge));
    return length;
  }

  // 結晶の雨：主人公の位置に1つ、周り3m以内に4つ。円どうしは2.4m以上離す
  function rainCircles(player) {
    const centers = [{ x: player.x, z: player.z }];
    for (let tries = 0; centers.length < RAIN.count && tries < 400; tries++) {
      const angle = random() * Math.PI * 2;
      const radius = RAIN.spacing + random() * (RAIN.scatter - RAIN.spacing);
      const candidate = { x: player.x + Math.sin(angle) * radius, z: player.z + Math.cos(angle) * radius };
      if (centers.every((c) => Math.hypot(c.x - candidate.x, c.z - candidate.z) >= RAIN.spacing)) centers.push(candidate);
    }
    // 乱数で埋まらなかったときは、周りの輪に等間隔で置く
    for (let i = centers.length; i < RAIN.count; i++) {
      const angle = (i / (RAIN.count - 1)) * Math.PI * 2;
      centers.push({ x: player.x + Math.sin(angle) * RAIN.scatter, z: player.z + Math.cos(angle) * RAIN.scatter });
    }
    return centers.map((c) => ({ type: 'circle', x: c.x, z: c.z, radius: RAIN.radius }));
  }

  function shapesFor(kind, player) {
    if (kind === 'slam') {
      return [{
        type: 'sector',
        x: position.x + Math.sin(facing) * SLAM.reachFromCenter,
        z: position.z + Math.cos(facing) * SLAM.reachFromCenter,
        angle: facing,
        radius: SLAM.radius,
        spread: SLAM.spread,
      }];
    }
    if (kind === 'spin') return [{ type: 'circle', x: position.x, z: position.z, radius: SPIN_RADIUS }];
    if (kind === 'charge') {
      return [{ type: 'band', x: position.x, z: position.z, angle: facing, width: CHARGE.width, length: chargeLength(player) }];
    }
    return rainCircles(player);
  }

  function startTelegraph(kind, player) {
    const base = TELEGRAPH[kind] * (enraged ? ENRAGE_FACTOR : 1);
    const shapes = shapesFor(kind, player);
    attack = {
      kind,
      shapes,
      telegraphTime: Math.max(MIN_TELEGRAPH, base),
      cueTime: kind === 'charge' ? shapes[0].length / CHARGE.speed : CUE_TIME[kind],
      dropsDone: 0,
      chargeFrom: { ...position },
    };
    lastKind = kind;
    phase = 'telegraph';
    timer = 0;
  }

  function goIdle(turnTime) {
    phase = 'idle';
    timer = 0;
    waitTime = turnTime;
    attack = null;
  }

  function turnToward(player, dt) {
    const diff = angleDiff(facing, angleTo(position, player));
    const step = Math.max(-TURN_SPEED * dt, Math.min(TURN_SPEED * dt, diff));
    facing = Math.atan2(Math.sin(facing + step), Math.cos(facing + step));
  }

  function update(dt, player) {
    const strikes = [];
    let cue = null;
    timer += dt;

    if (phase === 'dead') {
      cue = { kind: 'death', t: Math.min(1, timer / DEATH_TIME) };
    } else if (phase === 'stagger') {
      cue = { kind: 'stagger', t: Math.min(1, timer / STAGGER_TIME) };
      if (timer >= STAGGER_TIME) goIdle(between(0.6, 0.8));
    } else if (phase === 'idle' || phase === 'approach') {
      turnToward(player, dt);
      const distance = Math.hypot(player.x - position.x, player.z - position.z);
      if (distance > FAR) {
        phase = 'approach';
        const toward = angleTo(position, player);
        const nx = position.x + Math.sin(toward) * APPROACH_SPEED * dt;
        const nz = position.z + Math.cos(toward) * APPROACH_SPEED * dt;
        if (Math.hypot(nx, nz) <= bounds) position = { x: nx, z: nz };
      } else {
        phase = 'idle';
      }
      const aligned = Math.abs(angleDiff(facing, angleTo(position, player))) <= ALIGN_TOLERANCE;
      const ready = secondCharge ? aligned || timer >= ALIGN_MAX_TIME : timer >= waitTime;
      if (ready) startTelegraph(secondCharge ? 'charge' : chooseKind(player), player);
    } else if (phase === 'telegraph') {
      if (timer >= attack.telegraphTime) {
        phase = 'strike';
        timer = 0;
        if (attack.kind === 'rain') {
          strikes.push(attack.shapes[0]);
          attack.dropsDone = 1;
        } else {
          strikes.push(...attack.shapes);
        }
      }
    } else if (phase === 'strike') {
      cue = { kind: attack.kind, t: Math.min(1, timer / attack.cueTime) };

      if (attack.kind === 'charge') {
        const band = attack.shapes[0];
        const along = Math.min(band.length, CHARGE.speed * timer);
        position = {
          x: attack.chargeFrom.x + Math.sin(band.angle) * along,
          z: attack.chargeFrom.z + Math.cos(band.angle) * along,
        };
      }

      if (attack.kind === 'rain') {
        // 0.15 秒おきに1つずつ落ちる
        while (attack.dropsDone < RAIN.count && timer >= attack.dropsDone * RAIN.interval) {
          strikes.push(attack.shapes[attack.dropsDone]);
          attack.dropsDone += 1;
        }
      }

      if (timer >= attack.cueTime) {
        // 怒り状態の突進は、向き直ってからもう一度
        if (attack.kind === 'charge' && enraged && !secondCharge) {
          secondCharge = true;
          goIdle(0.4);
        } else {
          secondCharge = false;
          phase = 'recover';
          timer = 0;
          waitTime = between(1.0, 1.6) * (enraged ? ENRAGE_FACTOR : 1);
        }
      }
    } else if (phase === 'recover') {
      if (timer >= waitTime) goIdle(between(0.6, 0.8));
    }

    // 予告中と、塗りつぶし後 0.15 秒（rain は落ち終わるまで）は形を見せる
    let shownAttack = null;
    if (attack && phase === 'telegraph') {
      shownAttack = { kind: attack.kind, shapes: attack.shapes, progress: Math.min(1, timer / attack.telegraphTime), impact: false };
    } else if (attack && (phase === 'strike' || phase === 'recover' || phase === 'idle') && strikeAge() <= IMPACT_TIME) {
      shownAttack = { kind: attack.kind, shapes: attack.shapes, progress: 1, impact: true };
    }

    return {
      phase,
      position: { ...position },
      facing,
      attack: shownAttack,
      strikes,
      strikeKind: strikes.length > 0 ? attack.kind : null,
      cue,
      enraged,
      hp,
    };
  }

  // 最後に当たってからの時間（rain は最後の1つから）
  function strikeAge() {
    if (phase === 'strike') {
      if (attack.kind === 'rain') return attack.dropsDone < RAIN.count ? 0 : timer - RAIN.interval * (RAIN.count - 1);
      return timer;
    }
    return Infinity;
  }

  function takeDamage(amount) {
    if (phase === 'dead') return { stagger: false, enraged: false, dead: false };

    hp = Math.max(0, hp - amount);
    if (hp === 0) {
      phase = 'dead';
      timer = 0;
      attack = null;
      secondCharge = false;
      return { stagger: false, enraged: false, dead: true };
    }

    const newlyEnraged = !enraged && hp < enrageBelow;
    if (newlyEnraged) enraged = true;

    staggerAccum += amount;
    const stagger = staggerAccum >= staggerEvery;
    if (stagger) {
      // 300 を超えた分は捨てる。出していた予告は消える
      staggerAccum = 0;
      phase = 'stagger';
      timer = 0;
      attack = null;
      secondCharge = false;
    }
    return { stagger, enraged: newlyEnraged, dead: false };
  }

  reset();
  return { update, takeDamage, reset };
}
