// 曲：タイトルは Vampire's Piano。戦闘曲は結晶獣の体力に合わせて、D（Boss Battle #2）→ C（Heavy Battle Music）→ A（Determined Pursuit）と切り替える。
// 鳴らすのは sound.js。ここは「今どの曲か」を決めるだけ。
const SR = 44100;

// 繰り返す範囲（秒）。数字は scripts/build-music.py が書き出したときのサンプル数
export const MUSIC_TRACKS = {
  'music-d': { loopStart: 1751835 / SR, loopEnd: 2919725 / SR },
  'music-c': { loopStart: 0, loopEnd: 836352 / SR },
  'music-a': { loopStart: 0, loopEnd: 4762800 / SR },
  'music-title': { loopStart: 0, loopEnd: 3941627 / SR },
};

const ORDER = ['music-d', 'music-c', 'music-a'];
const START_FADE = 0.3;
const SWITCH_FADE = 1.5;
const FINISH_FADE = 2.5;
const STOP_FADE = 0.3;
const TITLE_FADE = 2;

// タイトル画面の曲。iPhone では最初のタッチまで音を出せないので、それまでは待っていて、鳴らせるようになったら始まる
export function playTitleMusic(sound) {
  sound.playMusic('music-title', { ...MUSIC_TRACKS['music-title'], fade: TITLE_FADE });
}

// 体力の割合（0〜1）から曲を選ぶ：半分より多い D、半分以下 C、3分の1以下 A
export function musicFor(hpRatio) {
  if (hpRatio <= 1 / 3) return 'music-a';
  if (hpRatio <= 0.5) return 'music-c';
  return 'music-d';
}

export function createBattleMusic(sound) {
  let current = null;

  function play(name, fade) {
    current = name;
    sound.playMusic(name, { ...MUSIC_TRACKS[name], fade });
  }

  // 戦いに入ったとき
  function start() {
    play('music-d', START_FADE);
  }

  // 毎 frame。体力は戻らないので、曲も先へ進むだけにする
  function update(hpRatio) {
    if (current === null) return;
    const next = musicFor(hpRatio);
    if (ORDER.indexOf(next) > ORDER.indexOf(current)) play(next, SWITCH_FADE);
  }

  // 勝ち負けが決まったとき：ゆっくり消す
  function finish() {
    current = null;
    sound.stopMusic(FINISH_FADE);
  }

  // やり直し・タイトルへ：すぐ止める
  function stop() {
    current = null;
    sound.stopMusic(STOP_FADE);
  }

  return { start, update, finish, stop };
}
