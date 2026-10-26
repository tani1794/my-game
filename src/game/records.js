// 最速記録と遊んだ回数を iPhone の中に保存する。保存できない環境では、その起動の間だけ覚えておく
const BEST_KEY = 'oa-best';
const PLAYS_KEY = 'oa-plays';

function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readPositive(storage, key) {
  try {
    const value = Number.parseFloat(storage?.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage?.setItem(key, String(value));
  } catch {
    // 保存できない環境では、今回の起動の間だけ覚えておく
  }
}

export function createRecords(storage = defaultStorage()) {
  let bestTime = readPositive(storage, BEST_KEY);
  let playCount = Math.floor(readPositive(storage, PLAYS_KEY) ?? 0);

  // 勝ったときの時間（秒）。今の記録より速ければ保存する
  function submit(seconds) {
    const isNew = bestTime === null || seconds < bestTime;
    if (isNew) {
      bestTime = seconds;
      write(storage, BEST_KEY, seconds);
    }
    return { best: bestTime, isNew };
  }

  // 戦いに入るたびに呼ぶ。今回を含めた回数を返す
  function countPlay() {
    playCount += 1;
    write(storage, PLAYS_KEY, playCount);
    return playCount;
  }

  return { best: () => bestTime, submit, plays: () => playCount, countPlay };
}
