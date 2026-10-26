// 第一章「霧の向こうの声」の台本。出来事ごとの手順（会話・目的・印・段階・演出の合図）を並べる。
// 手順の種類：
//   { say: [話す人, 文], block?: true }  字幕。block の行はタップで送る（冒頭と記憶だけ）
//   { wait: 秒 }                          間
//   { objective: 文 }                     現在の目的
//   { set: 印 }  { phase: 段階 }  { checkpoint: 名前 }  { toast: 文 }
//   { action: 名前 }                      描画側への合図（暗転明け・見回し・門を開く・記憶の始まり など）
//   { skipTo: 'memoryEnd' } は使わず、記憶は label: 'memoryEnd' の手順まで飛ばせる
const ELIA = 'エリア';
const NARRATION = '';

export const CHAPTER_TITLE = '第一章　霧の向こうの声';

export const OBJECTIVES = {
  forest: '霧の森を進む',
  gatehouse: '北の旧門衛所へ向かう',
  eastGate: '東の門へ向かう',
  winch: '門衛所の巻き上げ機を動かす',
  toChapel: '東の門を抜け、礼拝堂へ',
  enterChapel: '礼拝堂の中へ入る',
  mural: '祭壇の左の壁画を調べる',
  altar: '祭壇を調べる',
  next: '結晶の谷を越え、古城への道を探す',
};

export const SCENES = {
  // 森での目覚め：最初の3行だけタップで送り、すぐ歩けるようにする
  wake: [
    { action: 'wakeIntro' },
    { wait: 1.2 },
    { say: [ELIA, '……聞こえますか？'], block: true },
    { wait: 0.9 },
    { say: [ELIA, 'よかった。今度は、届いた。'], block: true },
    { action: 'lookAround' },
    { wait: 1.6 },
    { say: [ELIA, 'ここです。あなたがかぶっている、その王冠から。'], block: true },
    { action: 'control' },
    { phase: 'FOREST' },
    { wait: 0.6 },
    { say: [ELIA, '私はエリア。……城へ帰らなければいけないんです。'] },
    { say: [ELIA, 'あの尖塔まで行けば、道が分かるかもしれません。'] },
    { objective: OBJECTIVES.forest },
    { action: 'chapterTitle' },
  ],
  plaza: [
    { say: [ELIA, 'この広場……北に、古い門衛所があったはずです。'] },
    { say: [ELIA, 'その先の橋を渡れば、礼拝堂へ行けます。'] },
    { objective: OBJECTIVES.gatehouse },
  ],
  flowers: [
    { say: [ELIA, 'その花……まだ咲いていたんですね。'] },
    { say: [ELIA, '昔、礼拝堂の人に叱られました。摘みすぎてしまって。'] },
    { wait: 1.4 },
    { say: [ELIA, '……誰と一緒だったのかは、思い出せません。'] },
    { set: 'flowers' },
  ],
  afterFirstFight: [
    { wait: 0.8 },
    { say: [ELIA, '怪我は……？'] },
    { say: [ELIA, '私には、剣を持つこともできない。でも、見ていることはできます。'] },
    { say: [ELIA, '次は、近づいてくる前に知らせます。'] },
  ],
  bridgeGone: [
    { say: [ELIA, 'この先に橋が……'] },
    { wait: 1.2 },
    { say: [ELIA, '……ごめんなさい。私の知っている道と、違う。'] },
    { wait: 0.6 },
    { say: [ELIA, '東に、礼拝堂へ続く門があります。そこからなら……。'] },
    { objective: OBJECTIVES.eastGate },
  ],
  gateLocked: [
    { say: [NARRATION, '鉄の門は固く閉ざされている。錆びた鎖が、北の門衛所へ延びている。'] },
    { set: 'gateInspected' },
    { objective: OBJECTIVES.winch },
  ],
  winchJammed: [
    { say: [NARRATION, '巻き上げ機の歯車に、崩れた瓦礫が噛んでいる。'] },
    { action: 'clearRubble' },
    { wait: 0.8 },
    { say: [NARRATION, '瓦礫を取り除いた。これで鎖を巻き上げられる。'] },
    { set: 'winchFreed' },
  ],
  leverStuck: [
    { say: [NARRATION, 'レバーは動かない。巻き上げ機のどこかが引っかかっている。'] },
  ],
  leverPulled: [
    { action: 'openGate' },
    { set: 'gateOpen' },
    { toast: '東の門が開いた' },
    { checkpoint: 'gate' },
    { wait: 1 },
    { say: [ELIA, '……門の音。開いたみたいです。'] },
    { objective: OBJECTIVES.toChapel },
  ],
  warnTwo: [
    { say: [ELIA, '二人います。……気をつけて。'] },
  ],
  memorial: [
    { say: [NARRATION, '苔むした記念碑。「霧の森に眠る、名もなき守り手たちへ」と刻まれている。'] },
    { say: [ELIA, '……守り手。この森にも、いたんですね。'] },
  ],
  chapelArrive: [
    { phase: 'CHAPEL_APPROACH' },
    { checkpoint: 'chapel' },
    { toast: 'チェックポイント' },
    { say: [ELIA, 'ここは……覚えています。'] },
    { say: [ELIA, '雨の日は、あの軒下で待っていました。'] },
    { objective: OBJECTIVES.enterChapel },
  ],
  nave: [
    { phase: 'CHAPEL_INTERIOR' },
    { say: [ELIA, '奥へ。左の壁に、絵があったはずです。'] },
    { objective: OBJECTIVES.mural },
  ],
  // 壁画の記憶：短く、タップで送れ、スキップできる（memoryEnd まで飛ぶ）
  memory: [
    { action: 'memoryStart' },
    { wait: 1 },
    { say: [NARRATION, 'まだ割れていない窓から、やわらかな光が差している。'], block: true },
    { say: [NARRATION, '白い花を持つ、小さな手。'], block: true },
    { say: [NARRATION, 'その隣に、騎士の影が立っている。'], block: true },
    { action: 'bell' },
    { say: [NARRATION, '遠くで、鐘が鳴った。'], block: true },
    { label: 'memoryEnd', action: 'memoryEnd' },
    { set: 'memorySeen' },
    { wait: 0.8 },
    { say: [ELIA, '私は……ここに来たことがある。'] },
    { say: [ELIA, '誰かが、いつも隣にいたんです。'] },
    { sayIf: { flag: 'flowers', yes: [ELIA, 'さっきの花。あのときも、持っていました。'], no: [ELIA, '白い花を……持っていた気がします。'] } },
    { objective: OBJECTIVES.altar },
  ],
  altar: [
    { say: [NARRATION, '祭壇に、古い巡礼路の案内が刻まれている。'] },
    { say: [NARRATION, '「結晶の谷を越え、王の城へ」'] },
    { say: [ELIA, '結晶の谷……その向こうに、城があるんですね。'] },
    { phase: 'CHAPTER_COMPLETE' },
    { objective: OBJECTIVES.next },
    { action: 'chapterComplete' },
    { wait: 1.5 },
    { say: [ELIA, '谷の入口に……大きな気配がします。気をつけて。'] },
    { say: [NARRATION, '巡礼路は、礼拝堂の裏から続いている。'] },
  ],
};
