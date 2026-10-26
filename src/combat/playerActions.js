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

const HIT_STUN = 0.4;
const COMBO_WINDOW = 0.4; // 当たる時間の終わりから
const FACE_RANGE = 5;

// power：技の倍率（src/combat/damage.js の COMBO_POWER と同じ）。攻撃力 10 で 10・12・22
const ATTACKS = [
  { animation: '1H_Melee_Attack_Slice_Diagonal', duration: 0.5, hitStart: 0.15, hitEnd: 0.3, power: 1 },
  { animation: '1H_Melee_Attack_Slice_Horizontal', duration: 0.5, hitStart: 0.12, hitEnd: 0.27, power: 1.2 },
  { animation: '1H_Melee_Attack_Chop', duration: 0.6, hitStart: 0.25, hitEnd: 0.42, power: 2.2 },
];

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

const once = (name) => ({ name, loop: false, timeScale: 1 });

// attack：攻撃力（進化前 10、誓剣ルーメン 35）。振りのダメージは攻撃力 × 技の倍率（防御は相手の側で計算する）
export function createPlayerActions({ maxHp = MAX_HP, attack: attackStat = 10 } = {}) {
  let attack = attackStat;
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
      const move = ATTACKS[stage];
      if (timer >= move.duration) {
        const finisher = stage === ATTACKS.length - 1;
        // 3段目のあとは、早押しがあっても一度止まる（4段目はない）
        if (reserved && !finisher) {
          startAttack(intent);
        } else {
          reserved = false;
          mode = 'free';
          comboLeft = COMBO_WINDOW - (move.duration - move.hitEnd);
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
      const move = ATTACKS[stage];
      const hitting = timer >= move.hitStart && timer <= move.hitEnd;
      return frame({
        animation: once(move.animation),
        face: swingFace,
        swing: hitting ? { id: swingId, damage: Math.round(attack * move.power), power: move.power, stage } : null,
      });
    }

    if (mode === 'dodge') {
      return frame({
        animation: once(dodge.animation),
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
    if (running) animation = { name: 'Running_A', loop: true, timeScale: 1 };
    else if (moving) animation = { name: 'Walking_A', loop: true, timeScale: Math.max(0.5, speed / WALK_SPEED) };

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
  return { update, takeHit, reset, hp: () => hp, attack: () => attack, setAttack: (value) => { attack = value; } };
}
