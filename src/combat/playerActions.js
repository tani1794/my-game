// 主人公の行動：連続攻撃・回避・のけぞり・倒れる、スタミナと無敵時間。
// three.js にも DOM にも依存しない。時間は update の dt だけで進む。

const MAX_HP = 100;
const MAX_STAMINA = 100;

const WALK_SPEED = 3;
const RUN_SPEED = 6;
const RUN_COST = 15; // 1秒あたり
const STAMINA_REGEN = 30; // 1秒あたり
const REGEN_DELAY = 0.5;

const DODGE_TIME = 0.55;
const DODGE_INVULNERABLE = 0.35;
const DODGE_SPEED = 7;
const DODGE_COST = 20;
// 回避のクリップ（0.375秒）を回避の時間いっぱいに広げる
const DODGE_TIME_SCALE = 0.7;

const HIT_STUN = 0.4;
const COMBO_WINDOW = 0.4; // 当たる時間の終わりから
const FACE_RANGE = 5;

// timeScale：剣先がいちばん速く動く瞬間（クリップの 0.41・0.29・0.59 秒）を、当たる時間の中ほどに合わせる再生速度
const ATTACKS = [
  { animation: '1H_Melee_Attack_Slice_Diagonal', duration: 0.5, hitStart: 0.15, hitEnd: 0.3, damage: 10, timeScale: 1.7 },
  { animation: '1H_Melee_Attack_Slice_Horizontal', duration: 0.5, hitStart: 0.12, hitEnd: 0.27, damage: 12, timeScale: 1.5 },
  { animation: '1H_Melee_Attack_Chop', duration: 0.6, hitStart: 0.25, hitEnd: 0.42, damage: 22, timeScale: 1.75 },
];

// 歩き・走りのクリップが timeScale 1 で地面を蹴って進む速さ（m/s、王冠の騎士で接地中の足の速さを測った値）。
// 移動の速さをこれで割った再生速度にすると、足が地面を滑らない
const WALK_ANIM_SPEED = 1.4;
const RUN_ANIM_SPEED = 5.36;
// 歩きは速く回しすぎるとせわしないので、上限で止める（そのぶん少し滑る）
const WALK_MAX_TIME_SCALE = 1.8;

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// 回避の向きと、主人公の向きとの差から、前・後・左・右のアニメーションを選ぶ
function dodgeAnimation(facing, direction) {
  const rel = wrapAngle(direction - facing);
  if (Math.abs(rel) <= Math.PI / 4) return 'Dodge_Forward';
  if (Math.abs(rel) >= (Math.PI * 3) / 4) return 'Dodge_Backward';
  return rel > 0 ? 'Dodge_Left' : 'Dodge_Right';
}

const once = (name, timeScale = 1) => ({ name, loop: false, timeScale });

export function createPlayerActions({ maxHp = MAX_HP } = {}) {
  let hp;
  let stamina;
  let sinceStaminaUse;
  let mode;
  let timer;
  let stage; // 振っている段（0〜2）
  let nextStage; // 次に出す段
  let comboLeft; // 受付の残り時間（free のとき）
  let reserved; // 振っている途中の早押し
  let swingId;
  let swingFace;
  let dodge; // { x, z, face, animation }

  function reset() {
    hp = maxHp;
    stamina = MAX_STAMINA;
    sinceStaminaUse = REGEN_DELAY;
    mode = 'free';
    timer = 0;
    stage = 0;
    nextStage = 0;
    comboLeft = 0;
    reserved = false;
    swingId = 0;
    swingFace = null;
    dodge = null;
  }

  function useStamina(amount) {
    stamina = Math.max(0, stamina - amount);
    sinceStaminaUse = 0;
  }

  function startAttack(intent) {
    mode = 'attack';
    timer = 0;
    stage = nextStage;
    nextStage = (stage + 1) % ATTACKS.length;
    reserved = false;
    swingId += 1;

    // 出だしで1回だけ、近くの結晶獣（ロックオン中は距離を問わず）を向く
    const { target, self } = intent;
    const near = target && Math.hypot(target.x - self.x, target.z - self.z) <= FACE_RANGE;
    swingFace = target && (near || intent.lockOn)
      ? Math.atan2(target.x - self.x, target.z - self.z)
      : intent.facing;
  }

  function startDodge(intent) {
    useStamina(DODGE_COST);
    const length = Math.hypot(intent.move.x, intent.move.z);
    const direction = length > 0.1
      ? Math.atan2(intent.move.x, intent.move.z)
      : wrapAngle(intent.facing + Math.PI);

    mode = 'dodge';
    timer = 0;
    reserved = false;
    nextStage = 0;
    comboLeft = 0;
    dodge = {
      x: Math.sin(direction),
      z: Math.cos(direction),
      face: intent.facing,
      animation: dodgeAnimation(intent.facing, direction),
    };
  }

  function frame(extra) {
    return {
      mode,
      hp,
      stamina,
      swing: null,
      invulnerable: false,
      face: null,
      move: { x: 0, z: 0, speed: 0 },
      animation: { name: 'Idle', loop: true, timeScale: 1 },
      ...extra,
    };
  }

  function update(dt, intent) {
    if (mode === 'dead') return frame({ animation: once('Death_A') });

    // ── 入力 ──
    if (intent.dodge && mode !== 'dodge' && stamina >= DODGE_COST) startDodge(intent);

    if (intent.attack) {
      if (mode === 'free') {
        if (comboLeft <= 0) nextStage = 0;
        startAttack(intent);
      } else if (mode === 'attack') {
        reserved = true;
      }
    }

    // ── 時間を進める（回避中はスタミナを使っている扱い。回復は回避が終わってから数える） ──
    sinceStaminaUse = mode === 'dodge' ? 0 : sinceStaminaUse + dt;
    timer += dt;

    if (mode === 'attack') {
      const attack = ATTACKS[stage];
      if (timer >= attack.duration) {
        const finisher = stage === ATTACKS.length - 1;
        // 3段目のあとは、早押しがあっても一度止まる（4段目はない）
        if (reserved && !finisher) {
          startAttack(intent);
        } else {
          reserved = false;
          mode = 'free';
          comboLeft = COMBO_WINDOW - (attack.duration - attack.hitEnd);
          if (stage === ATTACKS.length - 1) nextStage = 0;
        }
      }
    } else if (mode === 'dodge' && timer >= DODGE_TIME) {
      mode = 'free';
      dodge = null;
    } else if (mode === 'hit' && timer >= HIT_STUN) {
      mode = 'free';
    } else if (mode === 'free') {
      comboLeft -= dt;
    }

    // ── 出力 ──
    const out = output(dt, intent);
    if (sinceStaminaUse >= REGEN_DELAY) stamina = Math.min(MAX_STAMINA, stamina + STAMINA_REGEN * dt);
    out.stamina = stamina;
    return out;
  }

  function output(dt, intent) {
    if (mode === 'attack') {
      const attack = ATTACKS[stage];
      const hitting = timer >= attack.hitStart && timer <= attack.hitEnd;
      return frame({
        animation: once(attack.animation, attack.timeScale),
        face: swingFace,
        swing: hitting ? { id: swingId, damage: attack.damage } : null,
      });
    }

    if (mode === 'dodge') {
      return frame({
        animation: once(dodge.animation, DODGE_TIME_SCALE),
        face: dodge.face,
        invulnerable: timer < DODGE_INVULNERABLE,
        move: { x: dodge.x, z: dodge.z, speed: DODGE_SPEED },
      });
    }

    if (mode === 'hit') return frame({ animation: once('Hit_A') });

    // free：歩き・走り。走りは動いているときだけスタミナを使う
    const length = Math.min(1, Math.hypot(intent.move.x, intent.move.z));
    const moving = length > 0;
    const running = moving && intent.run && stamina > 0;

    if (running) useStamina(RUN_COST * dt);

    const speed = running ? RUN_SPEED : WALK_SPEED * length;
    let animation = { name: 'Idle', loop: true, timeScale: 1 };
    if (running) animation = { name: 'Running_A', loop: true, timeScale: speed / RUN_ANIM_SPEED };
    else if (moving) animation = { name: 'Walking_A', loop: true, timeScale: Math.min(WALK_MAX_TIME_SCALE, Math.max(0.5, speed / WALK_ANIM_SPEED)) };

    return frame({
      animation,
      move: moving
        ? { x: intent.move.x / Math.hypot(intent.move.x, intent.move.z), z: intent.move.z / Math.hypot(intent.move.x, intent.move.z), speed }
        : { x: 0, z: 0, speed: 0 },
    });
  }

  // 攻撃を受ける。無敵中・倒れた後は何もしない
  function takeHit(damage) {
    if (mode === 'dead') return false;
    if (mode === 'dodge' && timer < DODGE_INVULNERABLE) return false;

    hp = Math.max(0, hp - damage);
    timer = 0;
    reserved = false;
    nextStage = 0;
    comboLeft = 0;
    dodge = null;
    mode = hp === 0 ? 'dead' : 'hit';
    return true;
  }

  reset();
  return { update, takeHit, reset, hp: () => hp };
}
