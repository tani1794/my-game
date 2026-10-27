// 晶冠峡谷の台本・目的・調べた反応（three.js も DOM も使わない）。
// 仕掛け：反射器2基（東は旧坑道で鏡板を拾ってはめる）→ 受光器 → 光の橋、結晶糸を斬る、巻き上げ機の結晶を砕く＋巨兵 → 籠が上がる、
// 3つの共鳴器を「低い音（輪・一本線）→ 双刃（二本線）→ 王冠（三本線）」の順に鳴らす → 晶冠の門。
import { REFLECTORS, RESONATORS } from './layout.js';
import { VERGRAS } from './boss.js';

const ELIA = 'エリア';
const ORUN = '残響の鉱夫オルン';
const NARRATION = '';
const DIRECTIONS = ['北', '東', '南', '西'];
const PITCH = { low: '低い音', mid: '中ほどの音', high: '高い音' };
const SHAKE = { low: 'かすかな震え', mid: 'はっきりした震え', high: '強い震え' };

export const CRYSTAL_OBJECTIVES = {
  orun: '結晶の光る人影に話を聞く',
  plate: '西の反射器を回し、旧坑道で東の反射器の鏡板を探す',
  reflectors: '2つの反射器で、光を中央の受光器へ導く',
  winch: '巻き上げ機に絡んだ結晶を砕き、昇降路の籠を上げる',
  resonate: '3つの共鳴器を、正しい順に鳴らす',
  gate: '晶冠の門をくぐり、共鳴の王座へ',
  exit: '北の出口から、霜葬峡谷へ',
};

export const CRYSTAL_SCENES = {
  arrive: [
    { say: [NARRATION, '谷の底まで、青い結晶が根を張っている。上の段へ続く昇降路は、籠ごと落ちていた。'] },
    { say: [ELIA, '……きれい。でも、少し冷たい光です。'] },
    { objective: true },
  ],
  orunEntry: [
    { say: [ORUN, '……おや、生きた足音だ。久しぶりに聞いた。'] },
    { say: [ORUN, 'わしは、この谷で結晶を掘っていた者の……残り香みたいなものさ。'] },
    { say: [ORUN, '昇降路は落ちた。上へ行くなら、まず谷の奥の橋を起こすことだ。'] },
    { say: [ORUN, '橋は光で動く。反射器が2基。光を2本とも、真ん中の受光器へ向けてやれ。'] },
    { say: [ORUN, '東の反射器は鏡板が外れて、旧坑道に落ちたままだ。東の側道から降りられる。'] },
    { say: [ORUN, '坑道は蜘蛛の糸だらけだがね。あれは剣で切れる。'] },
    { set: 'metOrun' },
    { objective: true },
  ],
  receptor: [
    { say: [NARRATION, '受光器の左右に、矢じりの刻印がある。西からと、東から――2本の光を受ける形だ。'] },
  ],
  webs: [
    { say: [ELIA, '糸が道を塞いでいます。……結晶でできているみたい。斬れそうです。'] },
  ],
  mine: [
    { say: [ELIA, '……暗い。足音が、奥まで響いています。'] },
    { say: [ELIA, '何かが、こちらを見ている気がします。'] },
  ],
  plateFound: [
    { set: 'plateFound' },
    { say: [NARRATION, '割れたトロッコの陰に、矢じりの刻まれた鏡板が落ちていた。'] },
    { say: [ELIA, '西の壁の支柱……傾いています。押せば、外へ抜けられるかもしれません。'] },
    { objective: true },
  ],
  timberDown: [
    { action: 'pushTimber' },
    { set: 'timberDown' },
    { say: [NARRATION, '支柱が倒れ、岩棚へ続く古い抜け道が開いた。'] },
  ],
  reflectorEmpty: [
    { say: [NARRATION, '反射器の枠だけが残っている。鏡板が外れて、光を返せない。'] },
  ],
  plateFit: [
    { action: 'fitPlate' },
    { set: 'plateFit' },
    { say: [NARRATION, '拾った鏡板を、反射器の枠にはめ込んだ。'] },
  ],
  reflectorADone: [
    { action: 'beam:reflectorA' },
    { set: 'reflectorA' },
    { say: [NARRATION, '一本目の光が、受光器の西の刻印に届いた。'] },
  ],
  reflectorBDone: [
    { action: 'beam:reflectorB' },
    { set: 'reflectorB' },
    { say: [NARRATION, '二本目の光が、受光器の東の刻印に届いた。'] },
  ],
  bridgeOn: [
    { wait: 0.8 },
    { action: 'bridgeForm' },
    { set: 'bridgeOn' },
    { say: [NARRATION, '受光器が鳴り、谷を渡る結晶の橋が、光の中から組み上がっていく。'] },
    { say: [ELIA, '橋が……。行きましょう。'] },
    { objective: true },
  ],
  midStone: [
    { checkpoint: 'crystalMid' },
    { set: 'crystalMidLit' },
    { toast: '共鳴の休み場（保存しました）' },
  ],
  song: [
    { action: 'song' },
    { wait: 1.2 },
    { say: [NARRATION, '結晶が、かすかに鳴っている。子どもの歌のような、細い節。'] },
    { say: [ELIA, '……この歌。'] },
    { say: [ELIA, '……私、ここで歌ったことがある。'] },
    { say: [ELIA, 'いつだったのかは……思い出せません。'] },
  ],
  orunYard: [
    { say: [ORUN, '昇降路の巻き上げ機に、結晶が絡みついてしまってな。3つ、砕いてくれ。'] },
    { say: [ORUN, '……それと、あの大きいのだ。腕の結晶が鎧になっている。'] },
    { say: [ORUN, '叩きつけたあと、腕が光る。そこを狙え。割れるたびに、あれは脆くなる。'] },
  ],
  winchGuarded: [
    { say: [ELIA, '巨兵が、巻き上げ機を守っています。先に……あれを。'] },
  ],
  liftUp: [
    { action: 'raiseLift' },
    { set: 'liftUp' },
    { say: [NARRATION, '巻き上げ機が回り、鎖が籠を引き上げる。昇降路の階段が現れた。'] },
    { objective: true },
  ],
  terrace: [
    { say: [NARRATION, '上の段に、形の違う3つの共鳴器。奥の門は、結晶で固く閉ざされている。'] },
    { say: [ELIA, '西の端に、石板があります。'] },
  ],
  tablet: [
    { say: [NARRATION, '石板：「輪は低く、双つの刃は中ほどに、冠は高く鳴る」'] },
    { say: [NARRATION, '「低きより高きへ。線ひとつより、線みっつへ。冠に至りて、門は開く」'] },
    { say: [ELIA, '音だけじゃなく、刻まれた線の数と……震えの強さでも、分かりそうです。'] },
  ],
  crownGate: [
    { action: 'openCrownGate' },
    { set: 'crownGateOpen' },
    { say: [NARRATION, '3つの音が重なり、門を塞いでいた結晶が砕け落ちた。'] },
    { objective: true },
  ],
  gateStone: [
    { checkpoint: 'crystalGate' },
    { set: 'gateStoneLit' },
    { toast: '晶冠の門（保存しました）' },
  ],
  gateWarn: [
    { say: [ELIA, '……この先に、大きな何かがいます。結晶が、ずっと震えている。'] },
  ],
  // ボスの登場（再戦でもスキップできる）。memoryEnd までは操作を止める
  bossIntro: [
    { action: 'bossTremor' },
    { wait: 1.6 },
    { action: 'bossCrystals' },
    { wait: 2.2 },
    { action: 'bossRise' },
    { wait: 2.0 },
    { label: 'memoryEnd', action: 'bossReady' },
    { action: 'bossName' },
    { wait: 1.6 },
    { action: 'bossStart' },
  ],
  bossDown: [
    { action: 'bossFade' },
    { set: 'vergrasDefeated' },
    { checkpoint: 'crystalAfter' },
    { wait: 1.6 },
    { action: 'voiceCut' },
    { wait: 1.4 },
    { say: [ELIA, '……大丈夫。少し、遠くにいた気がしただけ。'] },
    { toast: '残響の碑が灯った（保存しました）' },
    { objective: true },
  ],
  exit: [
    { action: 'toFrost' },
  ],
};

export function crystalObjective(progress) {
  if (progress.flag('vergrasDefeated')) return CRYSTAL_OBJECTIVES.exit;
  if (progress.flag('crownGateOpen')) return CRYSTAL_OBJECTIVES.gate;
  if (progress.flag('liftUp')) return CRYSTAL_OBJECTIVES.resonate;
  if (progress.flag('bridgeOn')) return CRYSTAL_OBJECTIVES.winch;
  if (progress.flag('metOrun')) return progress.flag('plateFound') ? CRYSTAL_OBJECTIVES.reflectors : CRYSTAL_OBJECTIVES.plate;
  return CRYSTAL_OBJECTIVES.orun;
}

const winchFree = (progress) => progress.flag('winchA') && progress.flag('winchB') && progress.flag('winchC');

export function crystalInteractables(progress) {
  const list = ['orunEntry', 'entryStone', 'receptor', 'midStone', 'orunYard', 'tablet', 'gateStone', 'afterStone'];
  if (!progress.flag('reflectorA')) list.push('reflectorA');
  if (progress.flag('plateFit') && !progress.flag('reflectorB')) list.push('reflectorB');
  if (!progress.flag('plateFit')) list.push('reflectorEmpty');
  if (!progress.flag('plateFound')) list.push('mirrorPlate');
  if (!progress.flag('timberDown')) list.push('timber');
  if (winchFree(progress) && !progress.flag('liftUp')) list.push('winch');
  if (progress.flag('liftUp') && !progress.flag('crownGateOpen')) list.push('resonatorL', 'resonatorC', 'resonatorR');
  return list;
}

export function createCrystalRules() {
  const reflectors = Object.fromEntries(Object.entries(REFLECTORS).map(([id, r]) => [id, r.start]));
  let nextResonator = 0;
  return {
    scenes: CRYSTAL_SCENES,
    blocking: new Set(),
    objectiveFor: crystalObjective,
    interactablesFor: crystalInteractables,
    reflector: (id) => reflectors[id],
    begin: ({ play, progress }) => {
      // 古い保存の直し：反射器が2基とも合っていれば、橋は出ている
      if (progress.flag('reflectorA') && progress.flag('reflectorB') && !progress.flag('bridgeOn')) progress.set('bridgeOn');
      play('arrive');
      return { control: true };
    },
    // 倒れて戻ったとき：保存しない途中の状態（反射器の向き・共鳴器の順番）は最初から。見た目も最初に戻る
    respawn() {
      for (const [id, r] of Object.entries(REFLECTORS)) reflectors[id] = r.start;
      nextResonator = 0;
    },
    react(signals, { play, progress, action }) {
      const zones = new Set(signals.zones);
      if (zones.has('sidePath') && !progress.flag('webCut1')) play('webs');
      if (zones.has('mine')) play('mine');
      if (zones.has('ledge') && progress.flag('plateFound') && !progress.flag('plateFit')) play('plateFit');
      if (zones.has('rest') && progress.flag('bridgeOn')) {
        play('midStone', { once: false });
        play('song');
      }
      if (zones.has('terrace') && progress.flag('liftUp')) play('terrace');
      if (zones.has('gate') && progress.flag('crownGateOpen')) {
        play('gateStone', { once: false });
        play('gateWarn');
      }
      if (zones.has('arena') && progress.flag('crownGateOpen') && !progress.flag('vergrasDefeated') && !signals.bossActive) {
        play('bossIntro', { once: false, urgent: true, resume: false });
      }
      if (zones.has('exit') && progress.flag('vergrasDefeated')) play('exit', { once: false });

      // 斬って壊した物（結晶糸・巻き上げ機の結晶）
      for (const id of signals.broken ?? []) {
        if (id === 'web1' || id === 'web2') action('toast:結晶糸を断ち切った');
        if (id.startsWith('winch')) {
          const left = ['winchA', 'winchB', 'winchC'].filter((flag) => !progress.flag(flag)).length;
          action(left ? `toast:絡んだ結晶を砕いた（あと${left}つ）` : 'toast:巻き上げ機の結晶を、すべて砕いた');
        }
      }
      for (const id of signals.defeated) {
        if (id === 'vergras') play('bossDown', { urgent: true, resume: false });
      }

      const id = signals.interact;
      if (!id) return;
      const now = { urgent: true, resume: false };
      if (REFLECTORS[id]) {
        reflectors[id] = (reflectors[id] + 1) % 4;
        action(`${id}:${reflectors[id]}`);
        action(`toast:光は${DIRECTIONS[reflectors[id]]}へ`);
        if (reflectors[id] === REFLECTORS[id].goal) {
          play(`${id}Done`, now);
          const other = id === 'reflectorA' ? 'reflectorB' : 'reflectorA';
          // 橋の印はすぐ保存する（台詞の途中で閉じても、橋が出ないまま詰まらないように）
          if (progress.flag(other)) {
            progress.set('bridgeOn');
            play('bridgeOn');
          }
        }
      }
      if (RESONATORS[id]) {
        const r = RESONATORS[id];
        action(`resonate:${id}:${r.pitch}`);
        action(`toast:${r.shape}の刻印（線${'一二三'[r.lines - 1]}本）── ${PITCH[r.pitch]}、${SHAKE[r.pitch]}`);
        if (r.order === nextResonator) {
          nextResonator += 1;
          action(`resonatorLit:${id}`);
          if (nextResonator === 3) play('crownGate', now);
        } else {
          nextResonator = 0;
          action('resonatorReset');
          action('toast:音が濁り、共鳴が消えた……');
        }
      }
      if (id === 'mirrorPlate') play('plateFound', now);
      if (id === 'timber') play('timberDown', now);
      if (id === 'reflectorEmpty') {
        if (progress.flag('plateFound')) play('plateFit', now);
        else play('reflectorEmpty', { ...now, once: false });
      }
      if (id === 'orunEntry') play('orunEntry', { ...now, once: false });
      if (id === 'orunYard') play('orunYard', { ...now, once: false });
      if (id === 'receptor') play('receptor', { ...now, once: false });
      if (id === 'tablet') play('tablet', { ...now, once: false });
      if (id === 'winch') {
        if (progress.defeated('cr-giant')) play('liftUp', now);
        else play('winchGuarded', { ...now, once: false });
      }
      if (id.endsWith('Stone')) action('rest');
    },
  };
}

export { VERGRAS };
