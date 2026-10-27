// 白薔薇の迷宮橋と誓剣の門前の台本・目的・調べた反応（three.js も DOM も使わない）。
// 手順の書き方は src/story/script.js と同じ。label 'memoryEnd' の手前はタップで送れてスキップできる。
const ELIA = 'エリア';
const NARRATION = '';

export const ROSE_OBJECTIVES = {
  bridge: '崩れた橋の先へ進む',
  detour: '迂回路を探す（橋の西の階段）',
  waterGate: '庭園の奥で水門を探す',
  machine: '排水した下層通路から、東の機室へ',
  lift: '上の踊り場で、昇降橋のレバーを引く',
  cross: '昇降橋を渡る',
  cave: '洞窟の巡礼路から、晶冠峡谷へ',
};

export const WEAPON_NAME = '誓剣ルーメン';

export const ROSE_SCENES = {
  arrive: [
    { say: [ELIA, '……風が変わりました。橋の向こうに、城が見えます。'] },
    { objective: true },
  ],
  collapse: [
    { say: [ELIA, '城は……すぐそこなのに。'] },
    { say: [NARRATION, '本橋は途中で崩れ落ちている。城の外壁の門も、固く閉ざされたままだ。'] },
    { say: [ELIA, '橋の西に、下へ降りる階段があります。そちらから回れるかもしれません。'] },
    { objective: true },
  ],
  garden: [
    { say: [ELIA, '白い薔薇……この橋にも、咲いていたんですね。'] },
    { say: [ELIA, '誰かが、帰ってくる人のために植えたと聞きました。'] },
    { objective: true },
  ],
  stone: [
    { checkpoint: 'garden' },
    { set: 'gardenStoneLit' },
    { toast: '残響の碑に触れた（保存しました）' },
  ],
  roseStatue: [
    { say: [NARRATION, '白薔薇を抱く騎士の像。台座の紋章は、王冠に重なる一本の剣。'] },
    { say: [ELIA, '……この紋章、どこかで。'] },
  ],
  fountain: [
    { say: [NARRATION, '噴水の縁に、水路の図が刻まれている。北西の水門が、下の通路の水を庭へ引くらしい。'] },
  ],
  waterGate: [
    { action: 'divertWater' },
    { set: 'drained' },
    { say: [NARRATION, '水門が開き、水が庭の水路へ流れ込んでいく。'] },
    { say: [ELIA, '下の通路……水が引いていきます。'] },
    { objective: true },
  ],
  shortcut: [
    { action: 'openShortcut' },
    { set: 'shortcutOpen' },
    { say: [NARRATION, '錆びた閂を外した。橋の入口への近道が開いた。'] },
  ],
  clamp: [
    { action: 'unclamp' },
    { set: 'clampFreed' },
    { say: [NARRATION, '巻き上げ機の留め具を外した。上で、太い鎖が緩む音がする。'] },
    { objective: true },
  ],
  liftLocked: [
    { say: [NARRATION, 'レバーは留め具で固定されている。下の機室で外す必要がありそうだ。'] },
  ],
  liftLever: [
    { action: 'lowerBridge' },
    { set: 'bridgeLowered' },
    { toast: '昇降橋が降りた' },
    { wait: 2.6 },
    { say: [ELIA, '道が……つながりました。'] },
    { objective: true },
  ],
  // 誓剣の門前：剣が本来の力を取り戻す（約10秒。スキップしても結果は同じ）
  oath: [
    { action: 'evolveStart' },
    { wait: 1.2 },
    { say: [NARRATION, '王冠と石碑の紋章が、同じ光で共鳴している。'], block: true },
    { action: 'evolveRust' },
    { say: [NARRATION, '剣を覆っていた鈍い錆が、光の粒になって剥がれていく。'], block: true },
    { action: 'evolveRunes' },
    { say: [NARRATION, '刀身に、細い銀青色の紋様が浮かび上がる。'], block: true },
    { label: 'memoryEnd', action: 'evolveEnd' },
    { set: 'evolved' },
    { checkpoint: 'oath' },
    { action: 'weaponName' },
    { wait: 1.6 },
    { say: [ELIA, 'その剣……初めて見るはずなのに。'] },
    { say: [ELIA, '……名前だけ、覚えています。ルーメン。'] },
    { objective: true },
  ],
  oathStone: [
    { checkpoint: 'oath' },
    { toast: '残響の碑に触れた（保存しました）' },
  ],
};

export function roseObjective(progress) {
  if (progress.flag('evolved') || progress.flag('bridgeLowered')) return progress.flag('evolved') ? ROSE_OBJECTIVES.cave : ROSE_OBJECTIVES.cross;
  if (progress.flag('clampFreed')) return ROSE_OBJECTIVES.lift;
  if (progress.flag('drained')) return ROSE_OBJECTIVES.machine;
  if (progress.seen('garden')) return ROSE_OBJECTIVES.waterGate;
  if (progress.seen('collapse')) return ROSE_OBJECTIVES.detour;
  return ROSE_OBJECTIVES.bridge;
}

export function roseInteractables(progress) {
  const list = ['roseStatue', 'fountain', 'gardenStone'];
  if (!progress.flag('drained')) list.push('waterLever');
  if (!progress.flag('shortcutOpen')) list.push('shortcutGate');
  if (!progress.flag('clampFreed')) list.push('clamp');
  if (!progress.flag('bridgeLowered')) list.push('liftLever');
  if (progress.flag('evolved')) list.push('oathStone', 'caveMouth');
  return list;
}

// エリアに入るたびに作る（洞窟の入口の「出入り」を覚えておくため）
export function createRoseRules() {
  let insideCave = false;
  return {
    scenes: ROSE_SCENES,
    blocking: new Set(['oath']),
    objectiveFor: roseObjective,
    interactablesFor: roseInteractables,
    begin: ({ play }) => {
      play('arrive');
      return { control: true };
    },
    react(signals, { play, progress, action }) {
      const zones = new Set(signals.zones);
      if (zones.has('collapse')) play('collapse');
      if (zones.has('garden')) play('garden');
      if (zones.has('gardenStone')) play('stone', { once: false });
      if (zones.has('oath') && !progress.flag('evolved')) play('oath', { urgent: true, resume: false });
      if (zones.has('oathStone') && progress.flag('evolved')) play('oathStone', { once: false });
      // 洞窟の入口：入った瞬間に一度だけ確認する。「いいえ」のあとは、一度出て入り直すか、調べると出る
      const inCave = zones.has('caveMouth');
      if (inCave && !insideCave && progress.flag('evolved')) action('askCave');
      insideCave = inCave;

      const id = signals.interact;
      if (!id) return;
      const now = { urgent: true, resume: false };
      if (id === 'roseStatue') play('roseStatue', { ...now, once: false });
      if (id === 'fountain') play('fountain', { ...now, once: false });
      if (id === 'waterGate' || id === 'waterLever') play('waterGate', now);
      if (id === 'shortcutGate') play('shortcut', now);
      if (id === 'clamp') play('clamp', now);
      if (id === 'liftLever') {
        if (progress.flag('clampFreed')) play('liftLever', now);
        else play('liftLocked', { ...now, once: false });
      }
      if (id === 'gardenStone' || id === 'oathStone') action('rest');
      if (id === 'caveMouth') action('askCave');
    },
  };
}
