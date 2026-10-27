// 晶冠峡谷の地図。南（+z）の洞窟の出口から、北の「共鳴の王座」（原点の円い戦場）へ。
// 入口 → 盆地（反射器A）→ 東の側道（結晶糸）→ 東の岩棚（反射器B）→ 光の橋 → 共鳴の休み場（中間の碑）
// → 昇降路の広場（巻き上げ機・巨兵）→ 昇降路の階段 → 上の段（3つの共鳴器）→ 晶冠の門（ボス前の碑）→ 共鳴の王座 → 北の出口
import { createLevel } from '../kit.js';

const GROUND = 0;
const TERRACE = 8;
export const ARENA = { x: 0, z: 0, radius: 27.5 };

export const CRYSTAL_FLOORS = [
  // 洞窟の出口からの下り道と入口の広場
  { id: 'entryPath', type: 'path', points: [[0, 214, 1.5], [0, 200, GROUND]], width: 5 },
  { id: 'entry', type: 'circle', x: 0, z: 192, radius: 9, y: GROUND },
  { id: 'road', type: 'path', points: [[0, 186, GROUND], [0, 176, GROUND]], width: 5 },
  // 盆地（反射器A・受光器）
  { id: 'basin', type: 'rect', x0: -22, x1: 22, z0: 146, z1: 178, y: GROUND },
  // 東の側道と岩棚（反射器B）
  { id: 'sidePath', type: 'path', points: [[20, 166, GROUND], [32, 166, GROUND], [38, 156, GROUND], [40, 152, GROUND]], width: 3.4 },
  { id: 'ledge', type: 'circle', x: 40, z: 149, radius: 5, y: GROUND },
  // 光の橋（2本の光が受光器に届くまで現れない）
  { id: 'bridge', type: 'path', points: [[0, 147, GROUND], [0, 127, GROUND]], width: 4, when: 'bridgeOn' },
  // 共鳴の休み場
  { id: 'rest', type: 'rect', x0: -12, x1: 12, z0: 108, z1: 128, y: GROUND },
  // 昇降路の広場
  { id: 'yard', type: 'rect', x0: -30, x1: 14, z0: 78, z1: 108, y: GROUND },
  // 昇降路の階段（籠が上がるまで、籠が入口を塞いでいる）
  { id: 'liftStairs', type: 'path', points: [[-22, 79, GROUND], [-22, 72, 3.5], [-22, 66, TERRACE], [-22, 62, TERRACE]], width: 3.2 },
  // 上の段（3つの共鳴器）
  { id: 'terrace', type: 'rect', x0: -30, x1: 30, z0: 46, z1: 70, y: TERRACE },
  // 晶冠の門への下り階段と、門の前
  { id: 'gateStairs', type: 'path', points: [[0, 46, TERRACE], [0, 36, GROUND]], width: 5 },
  { id: 'gatePlaza', type: 'rect', x0: -8, x1: 8, z0: 26, z1: 36, y: GROUND },
  // 共鳴の王座（直径 55m）
  { id: 'arena', type: 'circle', x: ARENA.x, z: ARENA.z, radius: ARENA.radius, y: GROUND },
  // 撃破後に開く北の出口（次の氷の谷へ）
  { id: 'exit', type: 'path', points: [[0, -26, GROUND], [0, -50, GROUND]], width: 4.5, when: 'vergrasDefeated' },
];

export const CRYSTAL_COLLIDERS = [
  // 結晶糸（斬ると切れる）
  { type: 'box', x: 26, z: 166, hx: 0.3, hz: 1.9, angle: 0, y0: GROUND, y1: GROUND + 3, unless: 'webCut1' },
  { type: 'box', x: 39, z: 154, hx: 2.3, hz: 0.3, angle: -0.46, y0: GROUND, y1: GROUND + 3, unless: 'webCut2' },
  // 反射器・受光器
  { x: -14, z: 149, radius: 0.8, y0: GROUND, y1: GROUND + 2.5 },
  { x: 40, z: 149, radius: 0.8, y0: GROUND, y1: GROUND + 2.5 },
  { x: 8, z: 149, radius: 1, y0: GROUND, y1: GROUND + 3.5 },
  // 巻き上げ機と、絡んだ結晶（斬ると砕ける）
  { type: 'box', x: -14, z: 84, hx: 1.6, hz: 1, angle: 0, y0: GROUND, y1: GROUND + 2.5 },
  { x: -16.5, z: 86.2, radius: 0.8, y0: GROUND, y1: GROUND + 2, unless: 'winchA' },
  { x: -11.5, z: 86.2, radius: 0.8, y0: GROUND, y1: GROUND + 2, unless: 'winchB' },
  { x: -14, z: 81.5, radius: 0.8, y0: GROUND, y1: GROUND + 2, unless: 'winchC' },
  // 落ちて止まった昇降路の籠（巻き上げ機を動かすと上がる）
  { type: 'box', x: -22, z: 76.5, hx: 2, hz: 1.5, angle: 0, y0: GROUND - 1, y1: GROUND + 3.5, unless: 'liftUp' },
  // 共鳴器の台
  { x: -14, z: 58, radius: 1, y0: TERRACE, y1: TERRACE + 3 },
  { x: 0, z: 63, radius: 1, y0: TERRACE, y1: TERRACE + 3 },
  { x: 14, z: 58, radius: 1, y0: TERRACE, y1: TERRACE + 3 },
  // 晶冠の門（3つの共鳴器が順に鳴るまで閉じている）
  { type: 'box', x: 0, z: 46.5, hx: 3, hz: 0.5, angle: 0, y0: TERRACE - 2, y1: TERRACE + 5, unless: 'crownGateOpen' },
  // 王座の北の結晶の壁（撃破後に崩れる）
  { type: 'box', x: 0, z: -27.6, hx: 3, hz: 0.6, angle: 0, y0: GROUND, y1: GROUND + 6, unless: 'vergrasDefeated' },
];

export const CRYSTAL = {
  id: 'crystal',
  level: createLevel({ floors: CRYSTAL_FLOORS, colliders: CRYSTAL_COLLIDERS }),
  checkpoints: {
    crystalEntry: { x: 0, z: 196, y: GROUND, facing: Math.PI },
    crystalMid: { x: 0, z: 118, y: GROUND, facing: Math.PI },
    crystalGate: { x: 0, z: 33, y: GROUND, facing: Math.PI },
    crystalAfter: { x: 0, z: -18, y: GROUND, facing: Math.PI },
  },
  zones: {
    basin: { x: 0, z: 170, radius: 7, y: GROUND },
    sidePath: { x: 32, z: 166, radius: 3, y: GROUND },
    rest: { x: 0, z: 118, radius: 6, y: GROUND },
    yard: { x: -4, z: 98, radius: 7, y: GROUND },
    terrace: { x: -18, z: 62, radius: 5, y: TERRACE },
    gate: { x: 0, z: 33, radius: 4, y: GROUND },
    arena: { x: 0, z: 0, radius: 21, y: GROUND },
    exit: { x: 0, z: -46, radius: 4, y: GROUND },
  },
  interactables: {
    orunEntry: { x: -6, z: 187, y: GROUND, radius: 2.6, label: '鉱夫の残響に話しかける' },
    entryStone: { x: 5, z: 191, y: GROUND, radius: 2, label: '残響の碑で休む' },
    reflectorA: { x: -14, z: 150.6, y: GROUND, radius: 2.2, label: '反射器を回す' },
    reflectorB: { x: 40, z: 150.8, y: GROUND, radius: 2.2, label: '反射器を回す' },
    receptor: { x: 8, z: 151, y: GROUND, radius: 2.4, label: '受光器を調べる' },
    midStone: { x: 6, z: 116, y: GROUND, radius: 2, label: '残響の碑で休む' },
    orunYard: { x: 6, z: 102, y: GROUND, radius: 2.6, label: '鉱夫の残響に話しかける' },
    winch: { x: -14, z: 85.6, y: GROUND, radius: 2.8, label: '巻き上げ機を動かす' },
    tablet: { x: -24, z: 56, y: TERRACE, radius: 2.4, label: '石板を読む' },
    resonatorL: { x: -14, z: 59.4, y: TERRACE, radius: 2.3, label: '共鳴器を鳴らす' },
    resonatorC: { x: 0, z: 64.4, y: TERRACE, radius: 2.3, label: '共鳴器を鳴らす' },
    resonatorR: { x: 14, z: 59.4, y: TERRACE, radius: 2.3, label: '共鳴器を鳴らす' },
    gateStone: { x: 5, z: 32, y: GROUND, radius: 2, label: '残響の碑で休む' },
    afterStone: { x: 5, z: -18, y: GROUND, radius: 2, label: '残響の碑で休む' },
  },
  // 斬ると壊れる物（壊すと印が立つ）
  breakables: [
    { id: 'web1', x: 26, z: 166, y: GROUND, radius: 1.6, hp: 30, flag: 'webCut1', look: 'web' },
    { id: 'web2', x: 39, z: 154, y: GROUND, radius: 1.6, hp: 30, flag: 'webCut2', look: 'web' },
    { id: 'winchA', x: -16.5, z: 86.2, y: GROUND, radius: 1.1, hp: 90, flag: 'winchA', look: 'crystal' },
    { id: 'winchB', x: -11.5, z: 86.2, y: GROUND, radius: 1.1, hp: 90, flag: 'winchB', look: 'crystal' },
    { id: 'winchC', x: -14, z: 81.5, y: GROUND, radius: 1.1, hp: 90, flag: 'winchC', look: 'crystal' },
  ],
  // 敵：序盤は1種ずつ紹介し、中盤から組み合わせる。精鋭は中盤（巨兵）とボス前（突貫獣）
  enemies: [
    { id: 'cr-hound1', type: 'hound', x: 6, z: 172, y: GROUND, facing: 0, leash: 16 },
    { id: 'cr-bat1', type: 'bat', x: -8, z: 160, y: GROUND, facing: 0, leash: 16 },
    { id: 'cr-beetle1', type: 'beetle', x: -12, z: 154, y: GROUND, facing: 0, leash: 10 },
    { id: 'cr-hound2', type: 'hound', x: 14, z: 152, y: GROUND, facing: 0, leash: 14 },
    { id: 'cr-spider1', type: 'spider', x: 40, z: 146, y: GROUND, facing: 0, leash: 9 },
    { id: 'cr-spear1', type: 'spear', x: 6, z: 96, y: GROUND, facing: Math.PI * 0.1, leash: 14 },
    { id: 'cr-shield1', type: 'shield', x: -6, z: 92, y: GROUND, facing: 0, leash: 12 },
    { id: 'cr-caster1', type: 'caster', x: 4, z: 86, y: GROUND, facing: 0, leash: 14 },
    { id: 'cr-giant', type: 'giant', x: -8, z: 86, y: GROUND, facing: 0, leash: 14, elite: true },
    { id: 'cr-spider2', type: 'spider', x: 18, z: 60, y: TERRACE, facing: 0, leash: 10 },
    { id: 'cr-bat2', type: 'bat', x: -6, z: 54, y: TERRACE, facing: 0, leash: 14 },
    { id: 'cr-spear2', type: 'spear', x: -16, z: 52, y: TERRACE, facing: 0, leash: 12 },
    { id: 'cr-beetle2', type: 'beetle', x: 22, z: 52, y: TERRACE, facing: 0, leash: 10 },
    { id: 'cr-charger', type: 'charger', x: 8, z: 50, y: TERRACE, facing: 0, leash: 20, elite: true },
  ],
  orun: [
    { id: 'orunEntry', x: -6, z: 188, y: GROUND, facing: Math.PI * 0.85 },
    { id: 'orunYard', x: 6, z: 103.5, y: GROUND, facing: Math.PI },
  ],
  boss: { id: 'vergras', start: { x: 0, z: -14, facing: 0 }, bounds: 15 },
  mood: 'crystal',
};

// 反射器の向き（光が進む向き）：0 北、1 東、2 南、3 西。受光器は A の東・B の西
export const REFLECTORS = {
  reflectorA: { start: 2, goal: 1, flag: 'reflectorA' },
  reflectorB: { start: 0, goal: 3, flag: 'reflectorB' },
};
// 3つの共鳴器：形・音の高さ・震え・刻印の線の数。鳴らす順は低い音（一本線の輪）→ 二本線の双刃 → 三本線の王冠
export const RESONATORS = {
  resonatorR: { shape: '輪', lines: 1, pitch: 'low', order: 0 },
  resonatorL: { shape: '双刃', lines: 2, pitch: 'mid', order: 1 },
  resonatorC: { shape: '王冠', lines: 3, pitch: 'high', order: 2 },
};
export const CRYSTAL_HEIGHTS = { GROUND, TERRACE };
