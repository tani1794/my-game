// 物語のエリアの一覧（three.js も DOM も使わない）。進む順番と、それぞれの復帰地点（残響の碑など）。
// 保存の読み込みで「エリアと復帰地点が合っているか」を確かめるのにも使う。
export const AREA_ORDER = ['chapter1', 'rose', 'cave', 'crystal', 'frost', 'ash', 'swords'];

const valley = (id, name) => ({ name, checkpoints: [`${id}Entry`, `${id}Mid`, `${id}Gate`, `${id}After`] });

export const AREAS = {
  chapter1: { name: '霧の森', checkpoints: ['start', 'gate', 'chapel'] },
  // 白薔薇の迷宮橋（誓剣の門前を含む）
  rose: { name: '白薔薇の迷宮橋', checkpoints: ['roseEntry', 'garden', 'oath'] },
  cave: { name: '蒼響の洞穴', checkpoints: ['caveEntry', 'caveMid'] },
  crystal: valley('crystal', '晶冠峡谷'),
  frost: valley('frost', '霜葬峡谷'),
  ash: valley('ash', '灰燼峡谷'),
  swords: valley('swords', '千剣葬峡'),
};

export function areaOf(checkpoint) {
  return AREA_ORDER.find((id) => AREAS[id].checkpoints.includes(checkpoint)) ?? null;
}

export function isCheckpoint(area, checkpoint) {
  return Boolean(AREAS[area]?.checkpoints.includes(checkpoint));
}
