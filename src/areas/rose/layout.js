// 白薔薇の迷宮橋（と、その先の誓剣の門前）の地図。x が東、z が南、y が上、1 = 1m。
// 城へつながる本橋は崩れていて渡れない。橋の西の階段から白薔薇の中央庭園（生け垣の迷路）へ降り、
// 水門で下層通路を排水 → 東の機室で巻き上げ機の留め具を外す → 上の踊り場のレバーで昇降橋を降ろす → 誓剣の門前へ。
import { createLevel } from '../kit.js';

const GARDEN_Y = -4;
const LOW_Y = -9;

const hedge = (from, to) => ({ from, to, thickness: 0.9, height: 2.4, base: GARDEN_Y, hedge: true });
const stone = (from, to, base, height = 3.4) => ({ from, to, thickness: 0.8, height, base });

export const ROSE_FLOORS = [
  // A：礼拝堂側の橋の入口と、崩れた本橋（先は落ちている）
  { id: 'entry', type: 'rect', x0: -10, x1: 10, z0: 42, z1: 62, y: 0 },
  { id: 'mainBridge', type: 'rect', x0: -4, x1: 4, z0: 24, z1: 42, y: 0 },
  // 橋の西の降り口 → 階段 → 庭園の入口
  { id: 'westLanding', type: 'path', points: [[-9, 52, 0], [-18, 52, 0]], width: 3.2 },
  { id: 'westStairs', type: 'path', points: [[-18, 52, 0], [-26, 52, -2], [-26, 44, GARDEN_Y]], width: 3 },
  { id: 'gardenPath', type: 'path', points: [[-26, 44, GARDEN_Y], [-34, 44, GARDEN_Y], [-34, 33, GARDEN_Y]], width: 3.2 },
  // 枝道1：白薔薇のあずまやと像（寄り道）
  { id: 'arborPath', type: 'path', points: [[-34, 44, GARDEN_Y], [-46, 44, GARDEN_Y], [-49, 50, GARDEN_Y]], width: 2.8 },
  { id: 'arbor', type: 'circle', x: -50, z: 53, radius: 4.2, y: GARDEN_Y },
  // B：白薔薇の中央庭園（生け垣の迷路）
  { id: 'garden', type: 'rect', x0: -54, x1: -22, z0: 4, z1: 34, y: GARDEN_Y },
  // 近道：庭園の東から入口へ（閂を外すまで閉じている）
  { id: 'shortcut', type: 'path', points: [[-22, 25, GARDEN_Y], [-15, 25, GARDEN_Y], [-12, 35, -1.6], [-9, 44, 0]], width: 2.6 },
  // C：西の排水通路（階段で下層へ。通路は排水するまで水の下）
  { id: 'drainStairs', type: 'rect', x0: -54, x1: -48, z0: -6, z1: 4, y: LOW_Y, toY: GARDEN_Y, axis: 'z' },
  { id: 'drainTunnel', type: 'path', points: [[-51, -4, LOW_Y], [-20, -4, LOW_Y], [0, -4, LOW_Y], [24, -4, LOW_Y]], width: 3.2, when: 'drained' },
  // D：東の巻き上げ機室（橋脚の中）
  { id: 'machine', type: 'rect', x0: 22, x1: 36, z0: -12, z1: 4, y: LOW_Y },
  // 機室から上の踊り場への折り返し階段
  { id: 'machineStairs', type: 'path', points: [[30, 3, LOW_Y], [30, 10, -7], [42, 10, -3], [42, 21, 0]], width: 3 },
  // E：昇降橋の踊り場と、昇降橋（降ろすまで渡れない）
  { id: 'landing', type: 'rect', x0: 38, x1: 50, z0: 20, z1: 30, y: 0 },
  { id: 'liftBridge', type: 'path', points: [[50, 25, 0], [75, 25, 0]], width: 4, when: 'bridgeLowered' },
  // 誓剣の門前：王冠の石碑と、洞窟の入口
  { id: 'oathPlaza', type: 'rect', x0: 74, x1: 100, z0: 12, z1: 38, y: 0 },
  { id: 'caveMouth', type: 'path', points: [[92, 13, 0], [92, -6, 0]], width: 4.4 },
];

export const ROSE_WALLS = [
  // 生け垣：蛇行する迷路（入口は南、水門は北西の奥）
  hedge([-54, 28], [-36, 28]),
  hedge([-40, 22], [-22, 22]),
  hedge([-54, 16], [-30, 16]),
  hedge([-46, 10], [-22, 10]),
  // 迷路の中の短い行き止まり（噴水と紋章）
  hedge([-46, 19], [-46, 22]),
  // 巻き上げ機室の壁（西に通路の入口、南に階段の出口）
  stone([22, -12], [36, -12], LOW_Y),
  stone([36, -12], [36, 4], LOW_Y),
  stone([22, -12], [22, -5.6], LOW_Y),
  stone([22, -2.4], [22, 4], LOW_Y),
  stone([22, 4], [28.4, 4], LOW_Y),
  stone([31.6, 4], [36, 4], LOW_Y),
];

export const ROSE_COLLIDERS = [
  // 近道の閂つきの鉄柵（外すまで閉じている）
  { type: 'box', x: -20, z: 25, hx: 0.25, hz: 1.6, angle: 0, y0: GARDEN_Y, y1: GARDEN_Y + 3, unless: 'shortcutOpen' },
  // 庭園の噴水・水門・碑、機室の巻き上げ機、踊り場のレバー台、石碑
  { x: -42, z: 19, radius: 1.3, y0: GARDEN_Y, y1: GARDEN_Y + 2 },
  { type: 'box', x: -50, z: 6, hx: 1, hz: 0.4, angle: 0, y0: GARDEN_Y, y1: GARDEN_Y + 2 },
  { x: -28, z: 31, radius: 0.5, y0: GARDEN_Y, y1: GARDEN_Y + 2 },
  { type: 'box', x: 31, z: -9, hx: 1.6, hz: 1, angle: 0, y0: LOW_Y, y1: LOW_Y + 3 },
  { x: 47, z: 22.5, radius: 0.4, y0: 0, y1: 2 },
  { type: 'box', x: 88, z: 24, hx: 1.2, hz: 0.5, angle: 0, y0: 0, y1: 3 },
  { x: 82, z: 31, radius: 0.5, y0: 0, y1: 2 },
];

export const ROSE = {
  id: 'rose',
  level: createLevel({ floors: ROSE_FLOORS, walls: ROSE_WALLS, colliders: ROSE_COLLIDERS }),
  checkpoints: {
    roseEntry: { x: 0, z: 57, y: 0, facing: Math.PI },
    garden: { x: -30, z: 31, y: GARDEN_Y, facing: Math.PI },
    oath: { x: 84, z: 30, y: 0, facing: Math.PI },
  },
  zones: {
    collapse: { x: 0, z: 27, radius: 4, y: 0 },
    garden: { x: -34, z: 31, radius: 4, y: GARDEN_Y },
    gardenStone: { x: -28, z: 31, radius: 3, y: GARDEN_Y },
    tunnel: { x: -30, z: -4, radius: 4, y: LOW_Y },
    machine: { x: 26, z: -4, radius: 4, y: LOW_Y },
    landing: { x: 42, z: 24, radius: 4, y: 0 },
    oath: { x: 88, z: 27, radius: 4.5, y: 0 },
    oathStone: { x: 82, z: 31, radius: 3, y: 0 },
    caveMouth: { x: 92, z: -3, radius: 2.6, y: 0 },
  },
  interactables: {
    roseStatue: { x: -50, z: 54.5, y: GARDEN_Y, radius: 2.6, label: '像を調べる' },
    fountain: { x: -42, z: 20.8, y: GARDEN_Y, radius: 2.6, label: '噴水の紋章を調べる' },
    waterLever: { x: -50, z: 7.4, y: GARDEN_Y, radius: 2.2, label: '水門のレバーを引く' },
    shortcutGate: { x: -21.4, z: 25, y: GARDEN_Y, radius: 2, label: '閂を外す' },
    gardenStone: { x: -28, z: 31, y: GARDEN_Y, radius: 2, label: '残響の碑で休む' },
    clamp: { x: 31, z: -7.2, y: LOW_Y, radius: 2.2, label: '留め具を外す' },
    liftLever: { x: 47, z: 23.6, y: 0, radius: 2, label: '昇降橋のレバーを引く' },
    oathStone: { x: 82, z: 31, y: 0, radius: 2, label: '残響の碑で休む' },
    caveMouth: { x: 92, z: -3, y: 0, radius: 2.6, label: '洞窟へ進む' },
  },
  enemies: [
    { id: 'rose-g1', type: 'mistGuard', x: -36, z: 19, y: GARDEN_Y, facing: Math.PI / 2, leash: 12 },
    { id: 'rose-g2', type: 'mistGuard', x: -6, z: -4, y: LOW_Y, facing: Math.PI / 2, leash: 12 },
    { id: 'rose-g3', type: 'mistGuard', x: 44, z: 27, y: 0, facing: Math.PI, leash: 9 },
  ],
  mood: 'rose',
};

export const ROSE_HEIGHTS = { GARDEN_Y, LOW_Y };
