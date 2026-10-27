// 霜葬峡谷の地図。南（+z）の入口から、北の「白角の静庭」の戦場へ。
// 入口 → 灯守の野営地（風除け・炉・熱の導管の分かれ目）→ 凍った水門が解けると、崩れた橋の下の水路へ
// → 北岸の白灯の避難所（中間の碑・王女の記録）→ 排水すると現れる中庭（氷鏡の双剣士）→ 尾根へ登る
// → 2つの風向板で吹雪を止め、最後の鎖を外す → 氷の門 → 白角の静庭（ボス前の碑）→ 戦場 → 北の出口
import { createLevel } from '../kit.js';

const GROUND = 0;
const CHANNEL = -4;
const YARD = -2;
const RIDGE = 8;
export const FROST_ARENA = { x: 0, z: -6, radius: 26 };

export const FROST_FLOORS = [
  // 入口と道
  { id: 'entryPath', type: 'path', points: [[0, 214, 1], [0, 200, GROUND]], width: 5 },
  { id: 'entry', type: 'circle', x: 0, z: 194, radius: 8, y: GROUND },
  { id: 'road', type: 'path', points: [[0, 188, GROUND], [0, 175, GROUND]], width: 5 },
  // 灯守の野営地（炉・風除け・導管の分かれ目・灯守の小屋）
  { id: 'camp', type: 'rect', x0: -16, x1: 16, z0: 150, z1: 176, y: GROUND },
  // 崩れた橋（上は途中で途切れている）
  { id: 'bridgeSouth', type: 'path', points: [[0, 150, GROUND], [0, 143, GROUND]], width: 4 },
  { id: 'bridgeNorth', type: 'path', points: [[0, 132, GROUND], [0, 128, GROUND]], width: 4 },
  // 橋の下の水路：凍った水門が解けて水が引くまで、氷の水で通れない
  { id: 'downStairs', type: 'path', points: [[-12, 150, GROUND], [-12, 146, CHANNEL]], width: 3, when: 'sluiceThawed' },
  { id: 'channel', type: 'rect', x0: -18, x1: 18, z0: 132, z1: 146, y: CHANNEL, when: 'sluiceThawed' },
  { id: 'upStairs', type: 'path', points: [[14, 132, CHANNEL], [14, 128, GROUND]], width: 3, when: 'sluiceThawed' },
  // 北岸：白灯の避難所
  { id: 'northBank', type: 'rect', x0: -14, x1: 14, z0: 106, z1: 128, y: GROUND },
  // 中庭：排水するまで、薄い氷の張った水の下
  { id: 'yardStairs', type: 'path', points: [[0, 106, GROUND], [0, 103, YARD]], width: 4, when: 'drainOpen' },
  { id: 'yard', type: 'rect', x0: -18, x1: 18, z0: 72, z1: 103, y: YARD, when: 'drainOpen' },
  // 尾根への登り（双剣士を倒すまで、凍った落とし格子が塞ぐ）と尾根
  { id: 'climb', type: 'path', points: [[-12, 72, YARD], [-18, 64, 3], [-18, 56, RIDGE]], width: 3.4 },
  { id: 'ridge', type: 'rect', x0: -24, x1: 24, z0: 34, z1: 56, y: RIDGE },
  // 氷の門から静庭へ下る階段と、静庭（ボス前の碑）
  { id: 'gateStairs', type: 'path', points: [[0, 34, RIDGE], [0, 26, GROUND]], width: 5 },
  { id: 'gatePlaza', type: 'rect', x0: -8, x1: 8, z0: 20, z1: 26, y: GROUND },
  // 白角の静庭の戦場
  { id: 'arena', type: 'circle', x: FROST_ARENA.x, z: FROST_ARENA.z, radius: FROST_ARENA.radius, y: GROUND },
  // 撃破後に開く北の出口（灰燼峡谷へ）
  { id: 'exit', type: 'path', points: [[0, -31, GROUND], [0, -54, GROUND]], width: 4.5, when: 'isvalDefeated' },
];

export const FROST_COLLIDERS = [
  // 炉・風除けのレバー・導管の分かれ目・灯守の小屋
  { x: 8, z: 162, radius: 1.6, y0: GROUND, y1: GROUND + 3 },
  { type: 'box', x: -9, z: 169, hx: 3, hz: 2.4, angle: 0, y0: GROUND, y1: GROUND + 3.5 },
  { x: 0, z: 154, radius: 0.8, y0: GROUND, y1: GROUND + 2 },
  // 凍った水門（解けるまで、水路の西の口を塞ぐ）
  { type: 'box', x: -20, z: 139, hx: 0.8, hz: 4, angle: 0, y0: CHANNEL, y1: GROUND + 2, unless: 'sluiceThawed' },
  // 水路の柱（橋脚）
  { x: -3, z: 138, radius: 1, y0: CHANNEL, y1: GROUND },
  { x: 3, z: 138, radius: 1, y0: CHANNEL, y1: GROUND },
  // 避難所の小屋と排水の輪
  { type: 'box', x: -8, z: 117, hx: 3.4, hz: 3, angle: 0, y0: GROUND, y1: GROUND + 3.5 },
  { x: 11, z: 108, radius: 0.9, y0: GROUND, y1: GROUND + 2 },
  // 登り口の凍った落とし格子（双剣士を倒すと砕ける）
  { type: 'box', x: -12.5, z: 71, hx: 2, hz: 0.4, angle: 0.6, y0: YARD - 1, y1: YARD + 4, unless: 'duelistDown' },
  // 尾根の風向板と、鎖の柱
  { x: -18, z: 46, radius: 0.8, y0: RIDGE, y1: RIDGE + 3 },
  { x: -3, z: 38, radius: 0.8, y0: RIDGE, y1: RIDGE + 3 },
  { x: 20, z: 37, radius: 0.7, y0: RIDGE, y1: RIDGE + 3 },
  // 尾根の吹雪の壁（2つの風向板が風を逸らすまで、東へ進めない）
  { type: 'box', x: 4, z: 45, hx: 0.6, hz: 11, angle: 0, y0: RIDGE - 1, y1: RIDGE + 6, unless: 'windCalm' },
  // 氷の門（最後の鎖を外すまで閉じている）
  { type: 'box', x: 0, z: 34.5, hx: 3, hz: 0.5, angle: 0, y0: RIDGE - 2, y1: RIDGE + 5, unless: 'iceGateOpen' },
  // 北の出口を塞ぐ氷（撃破後に崩れる）
  { type: 'box', x: 0, z: -31.6, hx: 3, hz: 0.6, angle: 0, y0: GROUND, y1: GROUND + 6, unless: 'isvalDefeated' },
];

export const FROST = {
  id: 'frost',
  level: createLevel({ floors: FROST_FLOORS, colliders: FROST_COLLIDERS }),
  checkpoints: {
    frostEntry: { x: 0, z: 197, y: GROUND, facing: Math.PI },
    frostMid: { x: 2, z: 116, y: GROUND, facing: Math.PI },
    frostGate: { x: 0, z: 23, y: GROUND, facing: Math.PI },
    frostAfter: { x: 0, z: -24, y: GROUND, facing: Math.PI },
  },
  zones: {
    camp: { x: 0, z: 172, radius: 6, y: GROUND },
    brokenBridge: { x: 0, z: 145, radius: 2.5, y: GROUND },
    channel: { x: -12, z: 142, radius: 4, y: CHANNEL },
    shelter: { x: 2, z: 116, radius: 5, y: GROUND },
    yard: { x: 0, z: 98, radius: 6, y: YARD },
    ridge: { x: -16, z: 52, radius: 5, y: RIDGE },
    gate: { x: 0, z: 23, radius: 3.5, y: GROUND },
    arena: { x: FROST_ARENA.x, z: FROST_ARENA.z, radius: 19, y: GROUND },
    exit: { x: 0, z: -50, radius: 4, y: GROUND },
  },
  interactables: {
    mirei: { x: -5, z: 166.4, y: GROUND, radius: 2.6, label: '灯守に話しかける' },
    entryStone: { x: 5, z: 193, y: GROUND, radius: 2, label: '残響の碑で休む' },
    windbreak: { x: 12.5, z: 167.5, y: GROUND, radius: 2.2, label: '風除けのレバーを引く' },
    valve: { x: 0, z: 155.8, y: GROUND, radius: 2.2, label: '導管の弁を回す' },
    duct: { x: -14, z: 152, y: GROUND, radius: 2.4, label: '導管の刻印を調べる' },
    sluice: { x: -15, z: 151.5, y: GROUND, radius: 2.4, label: '凍った水門を調べる' },
    midStone: { x: 5, z: 114, y: GROUND, radius: 2, label: '残響の碑で休む' },
    record: { x: -4.2, z: 113.5, y: GROUND, radius: 2.2, label: '古い記録を読む' },
    mireiShelter: { x: -2, z: 121, y: GROUND, radius: 2.4, label: '灯守に話しかける' },
    drain: { x: 11, z: 109.8, y: GROUND, radius: 2.4, label: '排水の輪を回す' },
    banner: { x: -22, z: 52, y: RIDGE, radius: 2.4, label: '裂けた旗を見る' },
    vaneA: { x: -18, z: 47.8, y: RIDGE, radius: 2.2, label: '風向板を回す' },
    vaneB: { x: -3, z: 39.8, y: RIDGE, radius: 2.2, label: '風向板を回す' },
    chain: { x: 18.5, z: 37.5, y: RIDGE, radius: 2.4, label: '最後の鎖を外す' },
    gateStone: { x: 5, z: 22, y: GROUND, radius: 2, label: '残響の碑で休む' },
    afterStone: { x: 5, z: -24, y: GROUND, radius: 2, label: '残響の碑で休む' },
  },
  breakables: [],
  // 序盤は1種ずつ（狼の群れ → 梟 → 雪潜り → 槍）、水路で盾と詠唱者、中庭で蟷螂と精鋭の双剣士、尾根で組み合わせと精鋭の巨人
  enemies: [
    { id: 'fr-wolf1', type: 'wolf', x: -1.5, z: 181, y: GROUND, facing: 0, leash: 16 },
    { id: 'fr-wolf2', type: 'wolf', x: 1.5, z: 184, y: GROUND, facing: 0, leash: 16 },
    { id: 'fr-owl1', type: 'owl', x: 8, z: 152, y: GROUND, facing: 0, leash: 16 },
    { id: 'fr-burrower1', type: 'burrower', x: -6, z: 157, y: GROUND, facing: 0, leash: 10 },
    { id: 'fr-spear1', type: 'iceSpear', x: 0, z: 129.5, y: GROUND, facing: 0, leash: 6 },
    { id: 'fr-shield1', type: 'frostShield', x: -6, z: 138, y: CHANNEL, facing: 0, leash: 12 },
    { id: 'fr-caster1', type: 'frostCaster', x: 10, z: 136, y: CHANNEL, facing: 0, leash: 12 },
    { id: 'fr-mantis1', type: 'mantis', x: -8, z: 92, y: YARD, facing: 0, leash: 14 },
    { id: 'fr-wolf3', type: 'wolf', x: 9, z: 96, y: YARD, facing: 0, leash: 14 },
    { id: 'fr-duelist', type: 'duelist', x: 0, z: 82, y: YARD, facing: 0, leash: 16, elite: true },
    { id: 'fr-owl2', type: 'owl', x: -10, z: 46, y: RIDGE, facing: 0, leash: 14 },
    { id: 'fr-burrower2', type: 'burrower', x: -6, z: 40, y: RIDGE, facing: 0, leash: 10 },
    { id: 'fr-caster2', type: 'frostCaster', x: 14, z: 52, y: RIDGE, facing: 0, leash: 12 },
    { id: 'fr-mantis2', type: 'mantis', x: 12, z: 40, y: RIDGE, facing: 0, leash: 12 },
    { id: 'fr-spear2', type: 'iceSpear', x: -18, z: 38, y: RIDGE, facing: 0, leash: 12 },
    { id: 'fr-yeti', type: 'yeti', x: 10, z: 46, y: RIDGE, facing: Math.PI, leash: 18, elite: true },
    { id: 'fr-isval', type: 'isval', x: 0, z: -18, y: GROUND, facing: 0, leash: 60, elite: true },
  ],
  mirei: [
    { id: 'mirei', x: -5, z: 168, y: GROUND, facing: Math.PI * 0.9 },
    { id: 'mireiShelter', x: -2, z: 122.5, y: GROUND, facing: Math.PI },
  ],
  boss: { id: 'fr-isval', kind: 'foe' },
  mood: 'frost',
};

// 導管の弁：熱の行き先。0 東（灯守の小屋・灯の刻印）、1 北（崩れた橋・矢じり）、2 西（凍った水門・波の刻印）。最初は東
export const VALVE = { start: 0, goal: 2, names: ['東の小屋', '北の橋', '西の水門'] };
// 風向板：0 北・1 東・2 南・3 西。風は北から吹く（裂けた旗が南へなびく）。板を北へ向けると風を逸らす
export const VANES = {
  vaneA: { start: 1, goal: 0 },
  vaneB: { start: 2, goal: 0 },
};
export const FROST_HEIGHTS = { GROUND, CHANNEL, YARD, RIDGE };
