// 効果音・環境音・曲を鳴らす係（Web Audio）。
// iPhone では最初のタッチまで音を出せないので、unlock() されるまで鳴らさない。
import { mulberry32 } from '../world/random.js';
import { asset } from '../paths.js';

const MASTER = 0.8;
const GROUP = { player: 0.7, beast: 0.9, ui: 0.4 };
// 曲と風：耳の聞こえ方（A 特性）で、風が曲の 40% になるように合わせた値
const AMBIENT = 0.15;
const MUSIC = 0.5;
// 音ごとの大きさの調整（負けた音は、曲と同じくらいまで下げる）
const VOICE = { lose: 0.45 };
// 結晶獣の音は離れるほど小さく：6m 以内は 1、25m で 0.4（その先も 0.4）
const NEAR = 6;
const FAR = 25;
const FAR_GAIN = 0.4;
const MAX_VOICES = 16;
const REPEAT_GAP = 0.04;
const PITCH_SPREAD = 0.06;
const STORAGE_KEY = 'oa-muted';

export function distanceGain(distance) {
  if (distance === undefined || distance <= NEAR) return 1;
  if (distance >= FAR) return FAR_GAIN;
  return 1 - ((distance - NEAR) / (FAR - NEAR)) * (1 - FAR_GAIN);
}

function readMuted(storage) {
  try {
    return storage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createSound({
  context = () => new AudioContext(),
  fetch = (...args) => window.fetch(...args),
  storage = (() => { try { return window.localStorage; } catch { return null; } })(),
  base = asset('sounds/'),
} = {}) {
  const buffers = new Map();
  const lastPlayed = new Map();
  const voices = [];
  const random = mulberry32(29);

  let ctx = null;
  let master = null;
  let unlocked = false;
  let suspended = false;
  let isMuted = readMuted(storage);
  let ambientName = null;
  let ambientSource = null;
  // 流したい曲（読み込みやタッチがまだなら、準備ができたときに始める）と、今流れている曲
  let wantedMusic = null;
  let music = null;

  // AudioContext はタッチ前でも作れる（止まった状態で）。読み込みのために先に作る
  function ensureContext() {
    if (ctx) return ctx;
    ctx = context();
    master = ctx.createGain();
    master.gain.value = isMuted ? 0 : MASTER;
    master.connect(ctx.destination);
    return ctx;
  }

  async function loadOne(name) {
    try {
      const response = await fetch(`${base}${name}.m4a`);
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.arrayBuffer();
      buffers.set(name, await ensureContext().decodeAudioData(data));
      // 待っている曲なら、ほかの音の読み込みを待たずにすぐ始める
      if (!music && wantedMusic?.name === name) startWantedMusic(1);
    } catch (error) {
      // 読めない音は鳴らさずに続ける
      console.warn(`効果音を読み込めませんでした: ${name}`, error);
    }
  }

  async function load(names) {
    ensureContext();
    await Promise.all(names.map(loadOne));
    if (unlocked && ambientName && !ambientSource) startAmbient(ambientName);
    if (!music) startWantedMusic(1);
  }

  // 最初のタッチ・キー入力の中で呼ぶ
  // iPhone では通話や Siri のあと 'interrupted' のまま止まることがあるので、タッチのたびに呼んで再開を試みる
  function unlock() {
    ensureContext();
    unlocked = true;
    if (!suspended && ctx.state !== 'running') ctx.resume();
    if (ambientName && !ambientSource) startAmbient(ambientName);
    if (!music) startWantedMusic(1);
  }

  function play(cue) {
    // 実際に音が動いているときだけ鳴らす（止まっている間に予約すると、再開時にまとめて鳴る）
    if (!unlocked || suspended || isMuted || ctx.state !== 'running') return;
    const buffer = buffers.get(cue.name);
    if (!buffer) return;

    const now = ctx.currentTime;
    const last = lastPlayed.get(cue.name);
    if (last !== undefined && now - last < REPEAT_GAP) return;
    lastPlayed.set(cue.name, now);

    // 同時に鳴る数を超えたら、一番古い音を止める
    if (voices.length >= MAX_VOICES) {
      const oldest = voices.shift();
      oldest.stop();
    }

    const gain = ctx.createGain();
    gain.gain.value = (GROUP[cue.group] ?? 1) * (VOICE[cue.name] ?? 1) * distanceGain(cue.distance);
    gain.connect(master);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = (cue.rate ?? 1) * (1 + (random() * 2 - 1) * PITCH_SPREAD);
    source.connect(gain);
    // 鳴り終わったら切り離す（長い戦いで音の部品が溜まらないように）
    source.onended = () => {
      const index = voices.indexOf(source);
      if (index >= 0) voices.splice(index, 1);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    voices.push(source);
  }

  // やり直しのとき：鳴っている効果音を止める（環境音はそのまま）
  function stopAll() {
    for (const voice of voices.splice(0)) voice.stop();
    lastPlayed.clear();
  }

  // 繰り返し流す環境音。読み込みやタッチがまだなら、準備ができたときに始める
  function startAmbient(name) {
    ambientName = name;
    const buffer = buffers.get(name);
    if (!unlocked || !buffer || ambientSource) return;

    const gain = ctx.createGain();
    gain.gain.value = AMBIENT;
    gain.connect(master);
    ambientSource = ctx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;
    ambientSource.connect(gain);
    ambientSource.start();
  }

  function startWantedMusic(fade) {
    if (!unlocked || !wantedMusic) return;
    const buffer = buffers.get(wantedMusic.name);
    if (!buffer) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MUSIC, now + fade);
    gain.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // 繰り返す範囲は秒で指定する（m4a の最後に付く短い無音を飛ばし、継ぎ目で途切れないように）
    source.loopStart = wantedMusic.loopStart;
    source.loopEnd = wantedMusic.loopEnd;
    source.connect(gain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    music = { source, gain };
  }

  function fadeOutMusic(fade) {
    if (!music) return;
    const now = ctx.currentTime;
    const { gain } = music.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + fade);
    music.source.stop(now + fade);
    music = null;
  }

  // 曲を流す（繰り返し）。別の曲が流れていれば fade 秒かけて入れ替える。同じ曲なら何もしない
  function playMusic(name, { loopStart = 0, loopEnd = 0, fade = 1.5 } = {}) {
    if (wantedMusic?.name === name) return;
    wantedMusic = { name, loopStart, loopEnd };
    fadeOutMusic(fade);
    startWantedMusic(fade);
  }

  function stopMusic(fade = 1.5) {
    wantedMusic = null;
    fadeOutMusic(fade);
  }

  // 遠くで鳴る鐘（記憶の場面）。素材がないので、倍音の違う正弦波を重ね、ゆっくり消えるように合成する
  function bell() {
    if (!unlocked || suspended || isMuted || ctx.state !== 'running' || !ctx.createOscillator) return;
    const now = ctx.currentTime;
    const base = 196;
    for (const [ratio, level, decay] of [[1, 0.5, 4.5], [2.01, 0.25, 3], [2.76, 0.18, 2.2], [5.4, 0.08, 1.2]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level * 0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime?.(0.0001, now + decay);
      osc.connect(gain);
      gain.connect(master);
      osc.onended = () => {
        const index = voices.indexOf(osc);
        if (index >= 0) voices.splice(index, 1);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + decay + 0.1);
      // stopAll で止められるよう、鳴っている音の一覧に入れる
      voices.push(osc);
    }
  }

  function setMuted(value) {
    isMuted = value;
    if (master) master.gain.value = isMuted ? 0 : MASTER;
    try {
      storage?.setItem(STORAGE_KEY, isMuted ? '1' : '0');
    } catch {
      // 保存できない環境では、今回だけ切り替える
    }
  }

  // アプリが裏に回ったとき。戻るまでの音は溜めずに捨てる
  function suspend() {
    suspended = true;
    ctx?.suspend();
  }

  function resume() {
    suspended = false;
    if (unlocked) ctx?.resume();
  }

  return { unlock, load, play, bell, stopAll, startAmbient, playMusic, stopMusic, setMuted, muted: () => isMuted, suspend, resume, loaded: () => buffers.size };
}
