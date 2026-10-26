// 画面の流れ：タイトル → 戦い ⇄ 一時停止、戦い → 結果 → 戦い／タイトル
const TRANSITIONS = {
  title: { start: 'playing' },
  playing: { pause: 'paused', finish: 'result' },
  paused: { resume: 'playing', retry: 'playing', title: 'title' },
  result: { retry: 'playing', title: 'title' },
};

// 次の状態。その状態で許されない操作なら null
export function nextState(state, action) {
  return TRANSITIONS[state]?.[action] ?? null;
}
