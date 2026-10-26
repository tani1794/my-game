// 効果音と環境音を鳴らす係（Web Audio）。
// iPhone では最初のタッチまで音を出せないので、unlock() されるまで鳴らさない。
import { mulberry32 } from '../world/random.js';
import { asset } from '../paths.js';

const MASTER = 0.8;
const GROUP = { player: 0.7, beast: 0.9, ui: 0.4 };
const AMBIENT = 0.25;
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
    } catch (error) {
      // 読めない音は鳴らさずに続ける
      console.warn(`効果音を読み込めませんでした: ${name}`, error);
    }
  }

  async function load(names) {
    ensureContext();
    await Promise.all(names.map(loadOne));
    if (unlocked && ambientName && !ambientSource) startAmbient(ambientName);
  }

  // 最初のタッチ・キー入力の中で呼ぶ
  // iPhone では通話や Siri のあと 'interrupted' のまま止まることがあるので、タッチのたびに呼んで再開を試みる
  function unlock() {
    ensureContext();
    unlocked = true;
    if (!suspended && ctx.state !== 'running') ctx.resume();
    if (ambientName && !ambientSource) startAmbient(ambientName);
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
    gain.gain.value = (GROUP[cue.group] ?? 1) * distanceGain(cue.distance);
    gain.connect(master);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (random() * 2 - 1) * PITCH_SPREAD;
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

  return { unlock, load, play, stopAll, startAmbient, setMuted, muted: () => isMuted, suspend, resume, loaded: () => buffers.size };
}
