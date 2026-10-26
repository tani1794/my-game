// 第一章の進み具合と保存（three.js も DOM も使わない）。
// 段階・復帰地点・印（花を見た、門を開けた…）・一度きりの会話・倒した敵を覚え、変わるたびに保存する。
export const PHASES = ['TITLE', 'PROLOGUE', 'FOREST', 'CHAPEL_APPROACH', 'CHAPEL_INTERIOR', 'CHAPTER_COMPLETE', 'CRYSTAL_BATTLE'];
export const CHECKPOINT_NAMES = ['start', 'gate', 'chapel'];
export const SAVE_KEY = 'oa-story';
const VERSION = 1;

function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fresh() {
  return { phase: 'PROLOGUE', checkpoint: 'start', flags: {}, seen: [], defeated: [] };
}

const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

// 版が違う・形がおかしい保存は、はじめからにする
function read(storage) {
  try {
    const data = JSON.parse(storage?.getItem(SAVE_KEY));
    if (!data || typeof data !== 'object' || data.version !== VERSION) return null;
    if (!PHASES.includes(data.phase) || data.phase === 'TITLE') return null;
    if (!CHECKPOINT_NAMES.includes(data.checkpoint)) return null;
    if (!data.flags || typeof data.flags !== 'object' || !isStringList(data.seen) || !isStringList(data.defeated)) return null;
    return { phase: data.phase, checkpoint: data.checkpoint, flags: { ...data.flags }, seen: data.seen, defeated: data.defeated };
  } catch {
    return null;
  }
}

export function createProgress(storage = defaultStorage()) {
  const loaded = read(storage);
  let saved = loaded !== null;
  let state = loaded ?? fresh();

  function save() {
    saved = true;
    try {
      storage?.setItem(SAVE_KEY, JSON.stringify({ version: VERSION, ...state }));
    } catch {
      // 保存できない環境では、その起動の間だけ覚えておく
    }
  }

  // 段階は先へだけ進む
  function advance(phase) {
    if (PHASES.indexOf(phase) <= PHASES.indexOf(state.phase)) return;
    state.phase = phase;
    save();
  }

  function set(name, value = true) {
    if (state.flags[name] === value) return;
    state.flags[name] = value;
    save();
  }

  function markSeen(id) {
    if (state.seen.includes(id)) return;
    state.seen = [...state.seen, id];
    save();
  }

  function defeat(id) {
    if (state.defeated.includes(id)) return;
    state.defeated = [...state.defeated, id];
    save();
  }

  function reach(checkpoint) {
    state.checkpoint = checkpoint;
    save();
  }

  function newGame() {
    state = fresh();
    saved = false;
    try {
      storage?.removeItem(SAVE_KEY);
    } catch {
      // 消せない環境でも、この起動の間ははじめから
    }
  }

  return {
    phase: () => state.phase,
    checkpoint: () => state.checkpoint,
    flag: (name) => state.flags[name] === true,
    seen: (id) => state.seen.includes(id),
    defeated: (id) => state.defeated.includes(id),
    hasSave: () => saved,
    advance,
    set,
    markSeen,
    defeat,
    reach,
    newGame,
  };
}
