// 霜葬峡谷の台本・目的・調べた反応（three.js も DOM も使わない）。
// 仕掛け：風除けで炉の火を守る → 導管の弁を西（波の刻印）へ → 凍った水門が解けて水路の水が引く
// → 橋の下を通って白灯の避難所 → 排水の輪で中庭の水を抜く → 氷鏡の双剣士を倒すと登り口が開く
// → 2つの風向板を北へ向けて吹雪を逸らす → 最後の鎖を外す → 氷の門 → 白角の静庭
import { VALVE, VANES } from './layout.js';

const ELIA = 'エリア';
const MIREI = '灯守ミレイ';
const NARRATION = '';
const DIRECTIONS = ['北', '東', '南', '西'];
const BOSS_ID = 'fr-isval';


// 残響の碑：まだそこに保存していなければ、会話に割り込んですぐ保存する（会話は同じ行から続く）
const SAVE_NOW = { once: false, urgent: true };
export const FROST_OBJECTIVES = {
  mirei: '灯の見える野営地で、灯守に話を聞く',
  thaw: '風除けで炉の火を守り、導管の熱を凍った水門へ送る',
  under: '橋の下の水路を抜け、北岸の避難所へ',
  drain: '排水の輪を回し、中庭の水を抜く',
  duelist: '中庭の双剣士を倒し、尾根への登り口を開く',
  vanes: '2つの風向板で吹雪を逸らし、最後の鎖を外す',
  gate: '氷の門をくぐり、白角の静庭へ',
  exit: '北の出口から、灰燼峡谷へ',
};

export const FROST_SCENES = {
  arrive: [
    { say: [NARRATION, '息が白い。谷は雪と氷に閉ざされ、遠くに小さな灯がひとつ揺れている。'] },
    { say: [ELIA, '……寒い。でも、あの灯は、誰かが守っているみたいです。'] },
    { objective: true },
  ],
  mirei: [
    { say: [MIREI, '……生きてる人？ 珍しい。こっちへ、火のそばへ。'] },
    { say: [MIREI, 'あたしはミレイ。この巡礼路の灯を守ってる。'] },
    { say: [MIREI, '北へ行くなら、橋は落ちた。下の水路を通るしかないけど、水門が凍りついてる。'] },
    { say: [MIREI, '炉の熱は導管で送れる。弁を回して、波の印の管へ。……ただ、風が火を食ってしまう。'] },
    { say: [MIREI, '先に東の風除けを上げて。それから弁。熱が細いうちは、氷は解けない。'] },
    { set: 'metMirei' },
    { objective: true },
  ],
  duct: [
    { say: [NARRATION, '分かれ目から3本の管。西の管には波、北の管には矢じり、東の管には灯の刻印。'] },
  ],
  sluice: [
    { say: [NARRATION, '水門は厚い氷に覆われ、水路は凍える水で満ちている。'] },
  ],
  windbreak: [
    { action: 'raiseShutters' },
    { set: 'windGuard' },
    { say: [NARRATION, '鉄の風除けが上がり、炉の火が大きく息をついた。'] },
  ],
  weakFire: [
    { say: [MIREI, '火が細すぎる。先に風除けを。'] },
  ],
  thaw: [
    { action: 'thawSluice' },
    { set: 'sluiceThawed' },
    { say: [NARRATION, '熱が西の管を走り、水門の氷が音を立てて割れる。水路の水が引いていく。'] },
    { say: [MIREI, '……開いた。橋の下へ降りられる。気をつけて、下は墓守がうろついてる。'] },
    { objective: true },
  ],
  brokenBridge: [
    { say: [ELIA, '橋が、ここで途切れています。下を通るしか……。'] },
  ],
  midStone: [
    { checkpoint: 'frostMid' },
    { set: 'frostMidLit' },
    { toast: '白灯の避難所（保存しました）' },
  ],
  shelter: [
    { say: [NARRATION, '小屋には小さな白い灯。壁際に、古い記録が積まれている。'] },
  ],
  record: [
    { action: 'memoryLight' },
    { say: [NARRATION, '記録：「王女殿下の御帰還を待つ。灯は絶やさぬこと」'], block: true },
    { say: [NARRATION, '「今年もお戻りにならず。それでも、灯は絶やさぬこと」'], block: true },
    { label: 'memoryEnd', set: 'recordRead' },
    { wait: 0.6 },
    { say: [ELIA, '……王女を、ずっと待っていた人たちが、いたんですね。'] },
    { say: [ELIA, '誰かが待っていたのは……私？'] },
    { say: [ELIA, '……ごめんなさい。少し、わからなくなりました。'] },
  ],
  mireiShelter: [
    { say: [MIREI, '中庭は水の下。東の排水の輪を回せば、水が抜ける。'] },
    { say: [MIREI, '……ただ、あそこには鏡みたいな剣士が居ついてる。二人にも三人にも見える。'] },
    { say: [MIREI, '本物は雪に足跡を残す。影もある。偽物は、斬れば消えるよ。'] },
  ],
  drain: [
    { action: 'drainWater' },
    { set: 'drainOpen' },
    { say: [NARRATION, '重い輪が回り、中庭の水が渦を巻いて引いていく。石畳が現れた。'] },
    { objective: true },
  ],
  duelistDown: [
    { action: 'breakPortcullis' },
    { set: 'duelistDown' },
    { say: [NARRATION, '双剣士が砕けると、尾根への登り口を塞いでいた氷の格子も崩れ落ちた。'] },
    { objective: true },
  ],
  ridge: [
    { say: [NARRATION, '尾根は吹雪に覆われている。2つの風向板と、裂けた旗。'] },
    { say: [ELIA, '吹雪の向こうに、鎖のついた柱が見えます。'] },
  ],
  banner: [
    { say: [NARRATION, '裂けた旗は、まっすぐ南へなびいている。風は北から吹きつけている。'] },
    { say: [ELIA, '風向板を、風の来る方へ向ければ……。'] },
  ],
  calm: [
    { action: 'calmWind' },
    { set: 'windCalm' },
    { say: [NARRATION, '2つの風向板が風を受け止め、尾根の吹雪が裂けるように止んだ。'] },
    { objective: true },
  ],
  chain: [
    { action: 'dropChain' },
    { set: 'iceGateOpen' },
    { say: [NARRATION, '最後の鎖が外れ、氷に閉ざされた門が、軋みながら開いた。'] },
    { objective: true },
  ],
  gateStone: [
    { checkpoint: 'frostGate' },
    { set: 'frostGateLit' },
    { toast: '白角の静庭（保存しました）' },
  ],
  gateWarn: [
    { say: [ELIA, '……静かすぎます。雪が、音を吸っているみたい。'] },
  ],
  bossIntro: [
    { action: 'bossTremor' },
    { wait: 1.6 },
    { action: 'bossCrystals' },
    { wait: 2.0 },
    { action: 'bossRise' },
    { wait: 2.0 },
    { label: 'memoryEnd', action: 'bossReady' },
    { action: 'bossName' },
    { wait: 1.6 },
    { action: 'bossStart' },
  ],
  bossDown: [
    { action: 'bossFade' },
    { set: 'isvalDefeated' },
    { checkpoint: 'frostAfter' },
    { wait: 1.6 },
    { action: 'voiceCut' },
    { wait: 1.2 },
    { say: [ELIA, '……寒くない。少しだけ、あたたかい気がします。'] },
    { toast: '残響の碑が灯った（保存しました）' },
    { objective: true },
  ],
  exit: [
    { action: 'toAsh' },
  ],
};

export function frostObjective(progress) {
  if (progress.flag('isvalDefeated')) return FROST_OBJECTIVES.exit;
  if (progress.flag('iceGateOpen')) return FROST_OBJECTIVES.gate;
  if (progress.flag('duelistDown')) return FROST_OBJECTIVES.vanes;
  if (progress.flag('drainOpen')) return FROST_OBJECTIVES.duelist;
  if (progress.flag('sluiceThawed')) return progress.flag('frostMidLit') ? FROST_OBJECTIVES.drain : FROST_OBJECTIVES.under;
  if (progress.flag('metMirei')) return FROST_OBJECTIVES.thaw;
  return FROST_OBJECTIVES.mirei;
}

export function frostInteractables(progress) {
  const list = ['mirei', 'entryStone', 'duct', 'midStone', 'record', 'mireiShelter', 'banner', 'gateStone', 'afterStone'];
  if (!progress.flag('windGuard')) list.push('windbreak');
  if (!progress.flag('sluiceThawed')) list.push('valve', 'sluice');
  if (progress.flag('sluiceThawed') && !progress.flag('drainOpen')) list.push('drain');
  if (progress.flag('duelistDown') && !progress.flag('windCalm')) list.push('vaneA', 'vaneB');
  if (progress.flag('windCalm') && !progress.flag('iceGateOpen')) list.push('chain');
  return list;
}

export function createFrostRules() {
  let valve = VALVE.start;
  const vanes = Object.fromEntries(Object.entries(VANES).map(([id, v]) => [id, v.start]));
  const vanesSet = () => Object.entries(VANES).every(([id, v]) => vanes[id] === v.goal);
  return {
    scenes: FROST_SCENES,
    blocking: new Set(),
    objectiveFor: frostObjective,
    interactablesFor: frostInteractables,
    valve: () => valve,
    vane: (id) => vanes[id],
    begin: ({ play }) => {
      play('arrive');
      return { control: true };
    },
    // 倒れて戻ったとき：保存しない途中の状態（弁・風向板の向き）は最初から。見た目も最初に戻る
    respawn() {
      valve = VALVE.start;
      for (const [id, v] of Object.entries(VANES)) vanes[id] = v.start;
    },
    react(signals, { play, progress, action }) {
      const zones = new Set(signals.zones);
      if (zones.has('brokenBridge') && !progress.flag('sluiceThawed')) play('brokenBridge');
      if (zones.has('shelter') && progress.flag('sluiceThawed')) {
        if (progress.checkpoint() !== 'frostMid') play('midStone', SAVE_NOW);
        play('shelter');
      }
      if (zones.has('ridge') && progress.flag('duelistDown')) play('ridge');
      if (zones.has('gate') && progress.flag('iceGateOpen')) {
        if (progress.checkpoint() !== 'frostGate') play('gateStone', SAVE_NOW);
        play('gateWarn');
      }
      if (zones.has('arena') && progress.flag('iceGateOpen') && !progress.flag('isvalDefeated') && !signals.bossActive) {
        play('bossIntro', { once: false, urgent: true, resume: false });
      }
      if (zones.has('exit') && progress.flag('isvalDefeated')) play('exit', { once: false });

      for (const id of signals.defeated) {
        if (id === 'fr-duelist') {
          // 登り口の印はすぐ保存する（台詞の途中で閉じても詰まらない）
          progress.set('duelistDown');
          play('duelistDown', { urgent: true, resume: false });
        }
        if (id === BOSS_ID) play('bossDown', { urgent: true, resume: false });
      }

      const id = signals.interact;
      if (!id) return;
      const now = { urgent: true, resume: false };
      if (id === 'valve') {
        valve = (valve + 1) % VALVE.names.length;
        action(`valve:${valve}`);
        action(`toast:熱は${VALVE.names[valve]}へ`);
        if (valve === VALVE.goal) {
          if (progress.flag('windGuard')) {
            progress.set('sluiceThawed');
            play('thaw', now);
          } else {
            play('weakFire', { ...now, once: false });
          }
        }
      }
      if (VANES[id]) {
        vanes[id] = (vanes[id] + 1) % 4;
        action(`${id}:${vanes[id]}`);
        action(`toast:風向板は${DIRECTIONS[vanes[id]]}へ`);
        if (vanesSet()) {
          progress.set('windCalm');
          play('calm', now);
        }
      }
      if (id === 'windbreak') play('windbreak', now);
      if (id === 'mirei') play('mirei', { ...now, once: false });
      if (id === 'mireiShelter') play('mireiShelter', { ...now, once: false });
      if (id === 'duct') play('duct', { ...now, once: false });
      if (id === 'sluice') play('sluice', { ...now, once: false });
      if (id === 'record') play('record', { ...now, once: false });
      if (id === 'banner') play('banner', { ...now, once: false });
      if (id === 'drain') {
        progress.set('drainOpen');
        play('drain', now);
      }
      if (id === 'chain') {
        progress.set('iceGateOpen');
        play('chain', now);
      }
      if (id.endsWith('Stone')) action('rest');
    },
  };
}
