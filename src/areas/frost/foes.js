// 霜葬峡谷の敵（通常7種・精鋭2種・ボス）。頭脳は共通の src/story/enemy.js。
// 数値の考え方は晶冠峡谷と同じ（主人公の3段の平均は防御45へ約36、体力100）。凍えた谷なので、少し速く・少し硬い
export const FROST_FOES = {
  wolf: {
    kind: 'wolf', name: '霜牙狼', look: 'wolf', footprints: true,
    role: '群れで左右に回り込み、雪に足跡を残して跳びかかる',
    counter: '足跡で回り込む向きを読み、跳びかかりを横へかわして背後を斬る',
    hp: 140, defense: 30, speed: 4.6, radius: 0.6, flank: 3.5, notice: 13,
    attacks: [
      { name: 'pounce', range: [2.2, 6], windup: 0.65, active: 0.3, recover: 1.2, cooldown: 2.4, damage: 11, shape: 'band', length: 4.5, width: 1.3, dash: 11, track: false },
    ],
  },
  owl: {
    kind: 'owl', name: '氷羽の梟', look: 'owl',
    role: '高い所から氷片を撃ち、そのまま低く滑空して襲う',
    counter: '氷片の印から出る。滑空のあと地面にいる間に斬る',
    hp: 120, defense: 20, speed: 3.4, radius: 0.5, notice: 15,
    flyer: { height: 3.2, dropOnHit: 1.4 },
    attacks: [
      { name: 'shard', range: [3, 12], windup: 1.0, active: 0.15, recover: 0.2, cooldown: 4, damage: 9, shape: 'circle', radius: 1.3, aim: 'target', next: 'swoop' },
      { name: 'swoop', range: [99, 100], windup: 0.5, active: 0.35, recover: 1.0, cooldown: 1, damage: 10, shape: 'circle', radius: 1.4, offset: 1, dash: 9, landAfter: 2.2 },
    ],
  },
  burrower: {
    kind: 'burrower', name: '雪潜り', look: 'burrower', startHidden: true, ambush: 3.5,
    role: '雪の下で待ち伏せし、近づくと足もとから飛び出す',
    counter: '雪の盛り上がりを見つけたら、回り込むか、飛び出しの隙を斬る',
    hp: 180, defense: 35, speed: 3, radius: 0.7,
    attacks: [
      { name: 'burst', range: [0, 2.6], windup: 0.6, active: 0.25, recover: 1.4, cooldown: 2.2, damage: 14, shape: 'circle', radius: 2.2 },
    ],
  },
  iceSpear: {
    kind: 'iceSpear', name: '凍槍の亡兵', look: 'iceSpear',
    role: '離れた所から長い氷槍を一直線に放ち、近くでは突く',
    counter: '氷槍の帯から横へ出る。投げたあとの隙に詰める',
    hp: 200, defense: 45, speed: 2.4, radius: 0.5, keepDistance: 4,
    attacks: [
      { name: 'lance', range: [3.5, 10], windup: 1.1, active: 0.2, recover: 1.3, cooldown: 3.5, damage: 15, shape: 'band', length: 10, width: 1.2, track: false },
      { name: 'thrust', range: [0, 3.5], windup: 0.8, active: 0.2, recover: 1.0, cooldown: 1.8, damage: 14, shape: 'band', length: 3.8, width: 1.0, track: false },
    ],
  },
  frostShield: {
    kind: 'frostShield', name: '霜盾の墓守', look: 'frostShield',
    role: '大盾を構えたまま近づく。盾は強攻撃でも崩れない',
    counter: '重い一撃を待ち、振り下ろしたあと盾を下げている間に斬る',
    hp: 300, defense: 60, speed: 1.6, radius: 0.7, turnSpeed: Math.PI * 0.8,
    guard: { breakStun: 1.5, unbreakable: true },
    attacks: [
      { name: 'chop', range: [0, 2.2], windup: 1.0, active: 0.25, recover: 1.8, cooldown: 2.2, damage: 18, shape: 'sector', radius: 2.3, spread: 1.4 },
    ],
  },
  frostCaster: {
    kind: 'frostCaster', name: '白息の詠唱者', look: 'frostCaster',
    role: '主人公の足もとに局所的な吹雪を起こし、視界と足を奪う',
    counter: '吹雪の印が出たら離れる。詠唱の途中で斬れば止まる',
    hp: 150, defense: 30, speed: 2.2, radius: 0.5, keepDistance: 7, notice: 15,
    attacks: [
      { name: 'blizzard', range: [3, 14], windup: 1.6, active: 0.2, recover: 1.2, cooldown: 7, damage: 4, shape: 'circle', radius: 3, aim: 'target', spawn: { type: 'blizzard', radius: 3.2, life: 8 } },
      { name: 'push', range: [0, 1.8], windup: 0.7, active: 0.2, recover: 0.8, cooldown: 2, damage: 8, shape: 'sector', radius: 1.8, spread: 1.6 },
    ],
  },
  mantis: {
    kind: 'mantis', name: '氷鎌の蟷螂', look: 'mantis',
    role: '跳びかかってから、両手の鎌で続けて斬る',
    counter: '跳びかかりを避ければ、連撃のあと着地の隙が長い',
    hp: 170, defense: 35, speed: 3.2, radius: 0.6,
    attacks: [
      { name: 'leap', range: [3, 7], windup: 0.7, active: 0.35, recover: 0.1, cooldown: 3.5, damage: 12, shape: 'circle', radius: 1.5, offset: 1, dash: 10, track: false, next: 'scythe' },
      { name: 'scythe', range: [99, 100], windup: 0.35, active: 0.2, recover: 1.8, cooldown: 1, damage: 10, shape: 'sector', radius: 2.1, spread: 2 },
      { name: 'slash', range: [0, 2.4], windup: 0.6, active: 0.2, recover: 1.0, cooldown: 1.8, damage: 10, shape: 'sector', radius: 2.1, spread: 1.6 },
    ],
  },
  // ── 精鋭 ──
  yeti: {
    kind: 'yeti', name: '雪崩の巨人', look: 'yeti', elite: true,
    role: '雪を崩して、まわり一帯に落とす。落ちる所は地面に印が出る',
    counter: '印のすき間（安全な所）へ入る。落とし終えた隙に足もとを斬る',
    hp: 1300, defense: 60, speed: 1.8, radius: 1.3, superArmor: true, notice: 16, leash: 18,
    attacks: [
      { name: 'stomp', range: [0, 3], windup: 1.0, active: 0.25, recover: 1.6, cooldown: 2.6, damage: 20, shape: 'circle', radius: 3.2 },
      { name: 'avalanche', range: [0, 14], windup: 1.6, active: 0.25, recover: 1.8, cooldown: 7, damage: 22, shape: 'circle', radius: 1.8, scatter: { count: 7, spread: 6 } },
      { name: 'punch', range: [0, 3.2], windup: 0.9, active: 0.2, recover: 1.2, cooldown: 2, damage: 18, shape: 'sector', radius: 2.9, spread: 1.2 },
    ],
  },
  duelist: {
    kind: 'duelist', name: '氷鏡の双剣士', look: 'duelist', elite: true, footprints: true,
    role: '自分の分身を作り、二刀で続けて斬る',
    counter: '本体だけが雪に足跡と影を残す。分身は一太刀で消える',
    hp: 1000, defense: 50, speed: 3.4, radius: 0.6, superArmor: true, stun: 0.6, notice: 15, leash: 16,
    attacks: [
      { name: 'mirror', range: [0, 14], windup: 0.8, active: 0.1, recover: 0.6, cooldown: 12, damage: 0, shape: 'circle', radius: 0.1, spawn: { type: 'clone', count: 2, life: 12 } },
      { name: 'twin', range: [0, 2.3], windup: 0.6, active: 0.2, recover: 0.2, cooldown: 2.4, damage: 14, shape: 'sector', radius: 2.3, spread: 1.8, next: 'twin2' },
      { name: 'twin2', range: [99, 100], windup: 0.3, active: 0.2, recover: 1.3, cooldown: 1, damage: 12, shape: 'sector', radius: 2.3, spread: 1.8 },
    ],
    // 分身：一太刀で消え、当たりは弱い。足跡も影もない
    clone: {
      kind: 'duelist', hp: 1, defense: 0, speed: 3.4, radius: 0.6, awaken: 0.2, footprints: false,
      attacks: [{ name: 'twin', range: [0, 2.3], windup: 0.7, active: 0.2, recover: 1.2, cooldown: 2.4, damage: 6, shape: 'sector', radius: 2.3, spread: 1.8 }],
    },
  },
  // ── ボス ──
  isval: {
    kind: 'stag', name: '霜葬の白角王イスヴァル', look: 'stag', elite: true, boss: true,
    role: '巨大な白い鹿。角で薙ぎ、突進し、氷の壁で戦場を区切る',
    counter: '突進は氷の壁や外周にぶつけると長くよろめく。氷の棘は印のすき間へ',
    hp: 9600, defense: 45, speed: 3, radius: 2.2, superArmor: true, startHidden: true, ambush: 0,
    turnSpeed: Math.PI * 0.7, wallStun: 2.8, notice: 40, leash: 60,
    enrage: { below: 0.5, tempo: 0.8 },
    attacks: [
      { name: 'stomp', range: [0, 3.4], windup: 1.0, active: 0.25, recover: 1.4, cooldown: 3, damage: 22, shape: 'circle', radius: 3.4 },
      { name: 'antlers', range: [0, 4.2], windup: 1.2, active: 0.25, recover: 1.6, cooldown: 2.5, damage: 24, shape: 'sector', radius: 4.4, spread: 2.0, track: false },
      { name: 'charge', range: [6, 24], windup: 1.3, active: 1.0, recover: 1.8, cooldown: 6, damage: 30, shape: 'circle', radius: 2.2, offset: 1.5, dash: 13, continuous: true, track: false },
      { name: 'iceWall', range: [4, 20], windup: 0.9, active: 0.2, recover: 1.0, cooldown: 9, damage: 15, shape: 'circle', radius: 1.6, aim: 'target', spawn: { type: 'wall', length: 7, life: 10 } },
      { name: 'spikes', range: [0, 18], windup: 1.4, active: 0.25, recover: 1.2, cooldown: 8, damage: 20, shape: 'circle', radius: 1.7, scatter: { count: 6, spread: 7 } },
    ],
  },
};
