// ダメージの計算（three.js も DOM も使わない）。
// ダメージ ＝ 攻撃力 × 技の倍率 × 防御の係数 × 弱点 × 会心 × 防御中
// 進化前の攻撃力 10・防御 0 なら、3段攻撃は今までと同じ 10・12・22 になる。
export const BASE_ATTACK = 10;
export const EVOLVED_ATTACK = 35; // 誓剣ルーメン
// 3段攻撃の倍率。3段目を強攻撃とする
export const COMBO_POWER = [1, 1.2, 2.2];
// 標準の敵の防御（進化後の3段の平均が 30〜40 になる値）
export const STANDARD_DEFENSE = 45;
const WEAK = 1.5;
const CRITICAL = 1.5;
const GUARDING = 0.3;

// 攻撃力は保存の印（進化したか）から毎回決める。足し算をしないので重ならない
export function attackPower({ evolved }) {
  return evolved ? EVOLVED_ATTACK : BASE_ATTACK;
}

export function computeDamage({ attack, power = 1, defense = 0, weak = false, critical = false, guarding = false }) {
  let value = attack * power * (100 / (100 + Math.max(0, defense)));
  if (weak) value *= WEAK;
  if (critical) value *= CRITICAL;
  if (guarding) value *= GUARDING;
  return Math.max(1, Math.round(value));
}
