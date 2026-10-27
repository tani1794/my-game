// 第二章のエリアの登録。runner はここから、地図・決まり・見た目を受け取る。
import { ROSE } from './rose/layout.js';
import { createRoseRules } from './rose/rules.js';
import { buildRose } from './rose/build.js';

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
};
