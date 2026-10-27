// 晶冠峡谷の敵（通常7種・精鋭2種）。ボス（ヴェルグラス）は boss.js。
// 数値の考え方：主人公（誓剣ルーメン）の3段の平均は、防御45の敵へ約36。通常の敵は 4〜8 回、精鋭は 30〜45 回で倒れる。
// 主人公の体力は 100。通常の敵の一撃は 8〜16、精鋭は 20〜28。
// look は見た目（foeViews.js）、role・counter は役割と対処法（図鑑や確認用）
export const CRYSTAL_FOES = {
  hound: {
    kind: 'hound', name: '晶牙ハウンド', look: 'hound',
    role: '横へ回り込んでから、まっすぐ突進する',
    counter: '突進の線から横へ外れる。突進のあとは長い隙',
    hp: 160, defense: 30, speed: 4.4, radius: 0.6, flank: 4, notice: 12,
    attacks: [
      { name: 'lunge', range: [2.5, 6.5], windup: 0.7, active: 0.35, recover: 1.3, cooldown: 2.2, damage: 12, shape: 'band', length: 5.5, width: 1.3, dash: 12, track: false },
    ],
  },
  bat: {
    kind: 'bat', name: '硝子羽の蝙蝠', look: 'bat',
    role: '高いところから急降下する',
    counter: '急降下の円から出る。降りたあと地面にいる間に斬る',
    hp: 110, defense: 20, speed: 3.6, radius: 0.5, notice: 13,
    flyer: { height: 2.8, dropOnHit: 1.4 },
    attacks: [
      { name: 'dive', range: [0, 3.4], windup: 0.9, active: 0.25, recover: 0.9, cooldown: 2.5, damage: 10, shape: 'circle', radius: 1.4, offset: 1.2, landAfter: 2.0, dash: 8 },
    ],
  },
  beetle: {
    kind: 'beetle', name: '結晶甲虫', look: 'beetle',
    role: '正面の殻がとても硬い',
    counter: '回り込んで背中を斬る（背中は弱点）',
    hp: 220, defense: 45, speed: 2.1, radius: 0.8, turnSpeed: Math.PI * 0.55,
    frontArmor: { angle: Math.PI / 3, defense: 400 }, backWeak: true,
    attacks: [
      { name: 'horn', range: [0, 2.2], windup: 0.8, active: 0.2, recover: 1.0, cooldown: 1.6, damage: 14, shape: 'sector', radius: 2.3, spread: 1.2 },
    ],
  },
  spear: {
    kind: 'spear', name: '晶槍の亡兵', look: 'spear',
    role: '長い突き。予兆のあとは向きを変えない',
    counter: '横へ回避する。突きのあとに懐へ入る',
    hp: 200, defense: 45, speed: 2.4, radius: 0.5, keepDistance: 3,
    attacks: [
      { name: 'thrust', range: [1.5, 4.4], windup: 0.9, active: 0.2, recover: 1.1, cooldown: 1.8, damage: 16, shape: 'band', length: 4.8, width: 1.0, track: false },
    ],
  },
  shield: {
    kind: 'shield', name: '鉱殻の盾衛', look: 'shield',
    role: '盾で道を塞ぎ、前からの弱い攻撃を受け止める',
    counter: '3段目（強攻撃）で盾を崩すか、背後へ回る',
    hp: 260, defense: 60, speed: 1.8, radius: 0.6, turnSpeed: Math.PI * 0.9,
    guard: { breakStun: 1.8 },
    attacks: [
      { name: 'bash', range: [0, 1.9], windup: 0.8, active: 0.2, recover: 0.9, cooldown: 1.8, damage: 14, shape: 'sector', radius: 1.9, spread: 1.4 },
    ],
  },
  caster: {
    kind: 'caster', name: '共鳴の祈り手', look: 'caster',
    role: '詠唱で周りの敵を強める（速く・重く）',
    counter: '光の輪が出たら、詠唱の途中で斬って止める',
    hp: 150, defense: 30, speed: 2.2, radius: 0.5, keepDistance: 6, notice: 14, superArmor: false,
    attacks: [
      { name: 'chant', range: [0, 14], windup: 2.2, recover: 1.2, cooldown: 9, buff: { radius: 9, seconds: 10 } },
      { name: 'push', range: [0, 1.8], windup: 0.7, active: 0.2, recover: 0.8, cooldown: 2, damage: 8, shape: 'sector', radius: 1.8, spread: 1.6 },
    ],
  },
  spider: {
    kind: 'spider', name: '晶糸の蜘蛛', look: 'spider',
    role: '足もとへ結晶糸を張って動きを鈍らせる',
    counter: '糸は斬れば切れる。糸を吐いたあとに近づく',
    hp: 170, defense: 35, speed: 2.6, radius: 0.7, keepDistance: 4,
    attacks: [
      { name: 'web', range: [2.5, 10], windup: 1.0, active: 0.2, recover: 1.0, cooldown: 4.5, damage: 4, shape: 'circle', radius: 1.5, aim: 'target', spawn: { type: 'web', radius: 1.5, life: 14 } },
      { name: 'bite', range: [0, 1.7], windup: 0.6, active: 0.2, recover: 0.9, cooldown: 1.5, damage: 12, shape: 'sector', radius: 1.7, spread: 1.2 },
    ],
  },
  // ── 精鋭 ──
  charger: {
    kind: 'charger', name: '晶角の突貫獣', look: 'charger', elite: true,
    role: '長い突進。結晶の柱を壊しながら走る',
    counter: '壁や岩の前で突進を誘い、ぶつかってよろめいた所を斬る',
    hp: 1100, defense: 50, speed: 2.6, radius: 1.3, superArmor: true, wallStun: 3.0, notice: 16, leash: 20,
    attacks: [
      { name: 'charge', range: [4, 16], windup: 1.1, active: 1.4, recover: 1.2, cooldown: 3.5, damage: 26, shape: 'circle', radius: 1.5, offset: 1.2, dash: 11, continuous: true, track: false },
      { name: 'stomp', range: [0, 3.2], windup: 0.9, active: 0.25, recover: 1.4, cooldown: 2.5, damage: 20, shape: 'circle', radius: 3.2 },
    ],
  },
  giant: {
    kind: 'giant', name: '砕晶の巨兵', look: 'giant', elite: true,
    role: '重い叩きつけ。腕の結晶が体を守っている',
    counter: '叩きつけの隙に光る腕の結晶を斬る。割るたびに防御が下がり、よろめく',
    hp: 1500, defense: 75, speed: 1.6, radius: 1.2, superArmor: true, notice: 14, leash: 16,
    weakParts: { count: 2, hp: 160, defenseDrop: 30, stun: 2.2 },
    attacks: [
      { name: 'slam', range: [0, 3.3], windup: 1.2, active: 0.25, recover: 2.0, cooldown: 2.6, damage: 28, shape: 'sector', radius: 3.4, spread: 1.6 },
      { name: 'sweep', range: [0, 2.6], windup: 1.0, active: 0.3, recover: 1.6, cooldown: 5, damage: 22, shape: 'circle', radius: 3.6 },
    ],
  },
};
