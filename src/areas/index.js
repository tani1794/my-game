// 第二章のエリアの登録。runner はここから、地図・決まり・見た目を受け取る。
import { ROSE } from './rose/layout.js';
import { createRoseRules } from './rose/rules.js';
import { buildRose } from './rose/build.js';
import { CAVE } from './cave/layout.js';
import { createCaveRules } from './cave/rules.js';
import { buildCave } from './cave/build.js';
import { CRYSTAL } from './crystal/layout.js';
import { createCrystalRules } from './crystal/rules.js';
import { buildCrystal } from './crystal/build.js';
import { CRYSTAL_FOES } from './crystal/foes.js';
import { VERGRAS } from './crystal/boss.js';
import { FROST } from './frost/layout.js';
import { createFrostRules } from './frost/rules.js';
import { buildFrost } from './frost/build.js';
import { FROST_FOES } from './frost/foes.js';

export const AREA_MODULES = {
  rose: {
    data: {
      ...ROSE,
      name: '白薔薇の迷宮橋',
      flagNames: ['drained', 'shortcutOpen', 'clampFreed', 'bridgeLowered', 'evolved', 'gardenStoneLit'],
      // 下層通路と機室の中は、暗く閉じた空気にする
      indoor: (p) => p.y < -6,
    },
    createRules: createRoseRules,
    build: buildRose,
  },
  cave: {
    data: {
      ...CAVE,
      name: '蒼響の洞穴',
      flagNames: ['lightOpen', 'planksSet', 'midStoneLit', 'evolved'],
      indoor: () => false,
    },
    createRules: createCaveRules,
    build: buildCave,
  },
  crystal: {
    data: {
      ...CRYSTAL,
      name: '晶冠峡谷',
      flagNames: ['metOrun', 'webCut1', 'webCut2', 'plateFound', 'timberDown', 'plateFit', 'reflectorA', 'reflectorB', 'bridgeOn', 'crystalMidLit', 'winchA', 'winchB', 'winchC', 'liftUp', 'crownGateOpen', 'gateStoneLit', 'vergrasDefeated', 'evolved'],
      // 旧坑道の中は、暗く閉じた空気にする
      indoor: (p) => p.y < -2,
      foes: CRYSTAL_FOES,
      boss: { ...CRYSTAL.boss, ...VERGRAS },
    },
    createRules: createCrystalRules,
    build: buildCrystal,
  },
  frost: {
    data: {
      ...FROST,
      name: '霜葬峡谷',
      flagNames: ['metMirei', 'windGuard', 'sluiceThawed', 'frostMidLit', 'recordRead', 'drainOpen', 'duelistDown', 'windCalm', 'iceGateOpen', 'frostGateLit', 'isvalDefeated', 'evolved'],
      indoor: () => false,
      foes: FROST_FOES,
      boss: { ...FROST.boss, name: FROST_FOES.isval.name },
    },
    createRules: createFrostRules,
    build: buildFrost,
  },
};
