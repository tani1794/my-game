// 画面の流れ：タイトル → 物語 → 戦い ⇄ 一時停止、戦い → 結果 → 戦い／タイトル
// 第一章：タイトル → 物語（森と礼拝堂）⇄ 物語の一時停止、物語 → 結晶獣戦
const TRANSITIONS = {
  title: { start: 'playing', story: 'story' },
  story: { pause: 'storyPaused', battle: 'playing' },
  storyPaused: { resume: 'story', retry: 'story', title: 'title' },
  playing: { pause: 'paused', finish: 'result' },
  paused: { resume: 'playing', retry: 'playing', title: 'title' },
  result: { retry: 'playing', title: 'title' },
};

// 次の状態。その状態で許されない操作なら null
export function nextState(state, action) {
  return TRANSITIONS[state]?.[action] ?? null;
}
