// 蒼響の洞穴の台本・目的・調べた反応（three.js も DOM も使わない）。
import { REFLECTOR_GOAL } from './layout.js';

const ELIA = 'エリア';
const NARRATION = '';
const DIRECTIONS = ['北', '東', '南', '西'];


// 残響の碑：まだそこに保存していなければ、会話に割り込んですぐ保存する（会話は同じ行から続く）
const SAVE_NOW = { once: false, urgent: true };
export const CAVE_OBJECTIVES = {
  light: '反射器で光を導き、石扉を開く',
  river: '下層の水門を開き、対岸へ渡る道を作る',
  cross: '渡り板を渡り、出口へ登る',
  exit: '洞窟を抜け、晶冠峡谷へ',
};

export const CAVE_SCENES = {
  arrive: [
    { say: [ELIA, '……音が、よく響きます。'] },
    { say: [NARRATION, '天井の裂け目から一筋の光が落ち、広間の反射器を照らしている。'] },
    { objective: true },
  ],
  alcoveRunes: [
    { say: [NARRATION, '古い刻印：「三日月の結晶にのみ、光は道を開く」'] },
    { say: [ELIA, '三日月……あの東の結晶に、同じ形が刻まれていました。'] },
  ],
  receptor: [
    { say: [NARRATION, '受光結晶には、三日月の刻印がある。反射器の板にも、同じ三日月が彫られている。'] },
  ],
  decoy: [
    { say: [NARRATION, 'こちらの結晶の刻印は、丸い輪。光を当てても、何も起こらなさそうだ。'] },
  ],
  lightOpen: [
    { action: 'openDoor' },
    { set: 'lightOpen' },
    { say: [NARRATION, '光が受光結晶に満ち、北の石扉が低く唸って開いた。'] },
    { say: [ELIA, '……開きました。下へ続いています。'] },
    { objective: true },
  ],
  midStone: [
    { checkpoint: 'caveMid' },
    { set: 'midStoneLit' },
    { toast: '残響の碑に触れた（保存しました）' },
  ],
  river: [
    { say: [ELIA, '水の音……川が、道を分けています。'] },
    { say: [NARRATION, '岸の西に水門と、大きな水車。水車から鎖が渡り板へ延びている。'] },
  ],
  sluice: [
    { action: 'openSluice' },
    { set: 'planksSet' },
    { say: [NARRATION, '水門を開くと、水が水車へ流れ込む。鎖が巻かれ、渡り板が対岸へ動いていく。'] },
    { wait: 1.5 },
    { say: [ELIA, '道が、できました。'] },
    { objective: true },
  ],
  vista: [
    { action: 'toCrystal' },
  ],
};

export function caveObjective(progress) {
  if (progress.flag('planksSet')) return CAVE_OBJECTIVES.cross;
  if (progress.flag('lightOpen')) return CAVE_OBJECTIVES.river;
  return CAVE_OBJECTIVES.light;
}

export function caveInteractables(progress) {
  const list = ['alcoveRunes', 'midStone', 'receptor', 'decoy'];
  if (!progress.flag('lightOpen')) list.push('reflector');
  if (progress.flag('lightOpen') && !progress.flag('planksSet')) list.push('sluice');
  return list;
}

// reflector：反射器の今の向き（0 北〜3 西）。回すたびに時計回り
// 最初は南（光の来る側）を向いていて、西（偽の結晶）→ 北 → 東（正解）の順に回る
export const REFLECTOR_START = 2;

export function createCaveRules() {
  let reflector = REFLECTOR_START;
  return {
    scenes: CAVE_SCENES,
    blocking: new Set(),
    objectiveFor: caveObjective,
    interactablesFor: caveInteractables,
    reflector: () => reflector,
    // 倒れて戻ったとき：合わせ途中の向きは最初に戻す（見た目も最初に戻るため）
    respawn() { reflector = REFLECTOR_START; },
    begin: ({ play }) => {
      play('arrive');
      return { control: true };
    },
    react(signals, { play, progress, action }) {
      const zones = new Set(signals.zones);
      if (zones.has('midStone') && progress.flag('lightOpen') && progress.checkpoint() !== 'caveMid') play('midStone', SAVE_NOW);
      if (zones.has('river') && progress.flag('lightOpen')) play('river');
      if (zones.has('vista') && progress.flag('planksSet')) play('vista', { once: false });

      const id = signals.interact;
      if (!id) return;
      const now = { urgent: true, resume: false };
      if (id === 'reflector') {
        reflector = (reflector + 1) % 4;
        action(`reflector:${reflector}`);
        action(`toast:光は${DIRECTIONS[reflector]}へ`);
        if (reflector === REFLECTOR_GOAL) play('lightOpen', now);
      }
      if (id === 'alcoveRunes') play('alcoveRunes', { ...now, once: false });
      if (id === 'receptor') play('receptor', { ...now, once: false });
      if (id === 'decoy') play('decoy', { ...now, once: false });
      if (id === 'sluice') play('sluice', now);
      if (id === 'midStone') action('rest');
    },
  };
}
