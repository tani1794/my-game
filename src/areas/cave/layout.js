// 蒼響の洞穴の地図。南の入口から北の出口へ。上層の広間（反射器）→ 石扉 → 下層（地下水路・水車・渡り板）→ 出口への登り。
import { createLevel } from '../kit.js';

const UP = 0;
const LOW = -6;

export const CAVE_FLOORS = [
  // 入口の通路（少し下る）
  { id: 'mouth', type: 'path', points: [[0, 64, 1], [0, 52, 0.5], [2, 40, UP]], width: 4.2 },
  // 上層の広間
  { id: 'hall', type: 'rect', x0: -15, x1: 15, z0: 12, z1: 40, y: UP },
  // 寄り道：西の結晶の小部屋（古い刻印の手がかり）
  { id: 'alcovePath', type: 'path', points: [[-15, 30, UP], [-24, 30, UP]], width: 3 },
  { id: 'alcove', type: 'circle', x: -28, z: 30, radius: 4.5, y: UP },
  // 石扉の先の階段（扉が開くまで閉じている）
  { id: 'stairsDown', type: 'path', points: [[0, 12, UP], [0, 6, -2], [10, 6, -4], [10, 0, LOW]], width: 3 },
  // 下層の岸（南）
  { id: 'southBank', type: 'rect', x0: -22, x1: 22, z0: -8, z1: 3, y: LOW },
  // 渡り板（水車で定位置へ動くまで渡れない）
  { id: 'planks', type: 'path', points: [[0, -8, LOW], [0, -19, LOW]], width: 2.6, when: 'planksSet' },
  // 下層の岸（北）
  { id: 'northBank', type: 'rect', x0: -12, x1: 12, z0: -32, z1: -19, y: LOW },
  // 出口への登り
  { id: 'climb', type: 'path', points: [[0, -32, LOW], [12, -38, -3], [12, -50, 1], [0, -58, 3], [0, -64, 3]], width: 3.2 },
  { id: 'vista', type: 'circle', x: 0, z: -68, radius: 5, y: 3 },
];

export const CAVE_COLLIDERS = [
  // 石扉（光が受光結晶に届くまで閉じている）
  { type: 'box', x: 0, z: 12, hx: 1.8, hz: 0.4, angle: 0, y0: UP, y1: UP + 4, unless: 'lightOpen' },
  // 反射器・受光結晶・偽の結晶・光の差す台
  { x: -6, z: 24, radius: 0.7, y0: UP, y1: UP + 2 },
  { x: 11, z: 24, radius: 0.8, y0: UP, y1: UP + 3 },
  { x: -13, z: 24, radius: 0.8, y0: UP, y1: UP + 3 },
  // 水門と水車の台、碑
  { type: 'box', x: -18, z: -6, hx: 1, hz: 0.5, angle: 0, y0: LOW, y1: LOW + 2.5 },
  { x: 6, z: -2, radius: 0.5, y0: LOW, y1: LOW + 2 },
];

export const CAVE = {
  id: 'cave',
  level: createLevel({ floors: CAVE_FLOORS, colliders: CAVE_COLLIDERS }),
  checkpoints: {
    caveEntry: { x: 0, z: 60, y: 1, facing: Math.PI },
    caveMid: { x: 6, z: 0, y: LOW, facing: Math.PI },
  },
  zones: {
    hall: { x: 0, z: 34, radius: 5, y: UP },
    alcove: { x: -28, z: 30, radius: 3.5, y: UP },
    midStone: { x: 6, z: -2, radius: 2.8, y: LOW },
    river: { x: 0, z: -4, radius: 4, y: LOW },
    vista: { x: 0, z: -66, radius: 4.5, y: 3 },
  },
  interactables: {
    reflector: { x: -6, z: 25.4, y: UP, radius: 2.2, label: '反射器を回す' },
    receptor: { x: 11, z: 25.6, y: UP, radius: 2.2, label: '受光結晶を調べる' },
    decoy: { x: -13, z: 25.6, y: UP, radius: 2.2, label: '結晶を調べる' },
    alcoveRunes: { x: -30, z: 30, y: UP, radius: 2.4, label: '刻印を調べる' },
    sluice: { x: -18, z: -4.6, y: LOW, radius: 2.2, label: '水門を開く' },
    midStone: { x: 6, z: -2, y: LOW, radius: 2, label: '残響の碑で休む' },
  },
  enemies: [
    { id: 'cave-g1', type: 'mistGuard', x: 8, z: 18, y: UP, facing: 0, leash: 10 },
    { id: 'cave-g2', type: 'mistGuard', x: -6, z: -26, y: LOW, facing: 0, leash: 9 },
  ],
  mood: 'cave',
};

// 反射器の向き（光が進む向き）：0 北、1 東、2 南、3 西。東の受光結晶に向けると正解
export const REFLECTOR_GOAL = 1;
export const CAVE_HEIGHTS = { UP, LOW };
