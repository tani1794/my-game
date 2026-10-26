import { test, expect, vi } from 'vitest';
import { createSound } from '../src/audio/sound.js';

// Web Audio の代わり：作られた音源と音量の値を記録する
function fakeAudio() {
  const sources = [];
  const gains = [];
  const ctx = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    suspend: vi.fn(async () => { ctx.state = 'suspended'; }),
    createGain() {
      const node = {
        gain: {
          value: 1,
          ramps: [],
          setValueAtTime: vi.fn((value) => { node.gain.value = value; }),
          linearRampToValueAtTime: vi.fn((value, time) => { node.gain.ramps.push({ value, time }); }),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(() => node),
        disconnect: vi.fn(),
      };
      gains.push(node);
      return node;
    },
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        playbackRate: { value: 1 },
        connect: vi.fn(() => source),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
      };
      sources.push(source);
      return source;
    },
    decodeAudioData: vi.fn(async () => ({ duration: 1 })),
  };
  return { ctx, sources, gains };
}

const okFetch = async (url) => {
  if (url.includes('missing')) return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
};

function memoryStorage() {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } };
}

async function ready(names = ['hit', 'swing1', 'wind']) {
  const audio = fakeAudio();
  const sound = createSound({ context: () => audio.ctx, fetch: okFetch, storage: memoryStorage() });
  await sound.load(names);
  sound.unlock();
  return { ...audio, sound };
}

const started = (sources) => sources.filter((s) => s.start.mock.calls.length > 0);
// 1つの音で作られる音量の節（最後に作られたもの）
const voiceGain = (gains) => gains[gains.length - 1].gain.value;

test('最初のタッチ（unlock）より前は鳴らさず、エラーにもしない', async () => {
  const audio = fakeAudio();
  const sound = createSound({ context: () => audio.ctx, fetch: okFetch, storage: memoryStorage() });
  await sound.load(['hit']);
  expect(() => sound.play({ name: 'hit', group: 'beast', distance: 1 })).not.toThrow();
  expect(started(audio.sources)).toHaveLength(0);
});

test('音ごとの音量は 群 × 距離（全体の0.8は全体の節で掛ける）', async () => {
  const { sound, gains, ctx } = await ready();
  sound.play({ name: 'hit', group: 'beast', distance: 3 });
  expect(voiceGain(gains)).toBeCloseTo(0.9);
  expect(gains[0].gain.value).toBeCloseTo(0.8);
  ctx.currentTime += 1;
  sound.play({ name: 'hit', group: 'beast', distance: 25 });
  expect(voiceGain(gains)).toBeCloseTo(0.9 * 0.4);
  ctx.currentTime += 1;
  sound.play({ name: 'hit', group: 'beast', distance: 15.5 });
  expect(voiceGain(gains)).toBeCloseTo(0.9 * 0.7);
  ctx.currentTime += 1;
  sound.play({ name: 'swing1', group: 'player' });
  expect(voiceGain(gains)).toBeCloseTo(0.7);
});

test('高さは 0.94〜1.06 の範囲でずらす', async () => {
  const { sound, sources, ctx } = await ready();
  for (let i = 0; i < 20; i++) {
    ctx.currentTime += 0.1;
    sound.play({ name: 'swing1', group: 'player' });
  }
  for (const s of started(sources)) {
    expect(s.playbackRate.value).toBeGreaterThanOrEqual(0.94);
    expect(s.playbackRate.value).toBeLessThanOrEqual(1.06);
  }
});

test('同じ音は 0.04 秒以内に重ねない', async () => {
  const { sound, sources, ctx } = await ready();
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  ctx.currentTime += 0.03;
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  expect(started(sources)).toHaveLength(1);
  ctx.currentTime += 0.02;
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  expect(started(sources)).toHaveLength(2);
});

test('同時に鳴るのは最大16。超えたら一番古い音を止める', async () => {
  const { sound, sources, ctx } = await ready();
  for (let i = 0; i < 17; i++) {
    ctx.currentTime += 0.05;
    sound.play({ name: 'hit', group: 'beast', distance: 1 });
  }
  const playing = started(sources);
  expect(playing).toHaveLength(17);
  expect(playing[0].stop).toHaveBeenCalled();
  expect(playing[1].stop).not.toHaveBeenCalled();
});

test('裏に回っている間（suspend）は鳴らさず、溜めもしない', async () => {
  const { sound, sources, ctx } = await ready();
  sound.suspend();
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  sound.resume();
  expect(started(sources)).toHaveLength(0);
  ctx.currentTime += 1;
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  expect(started(sources)).toHaveLength(1);
});

test('読めなかった音は鳴らさずに続ける', async () => {
  const { sound, sources } = await ready(['missing']);
  expect(() => sound.play({ name: 'missing', group: 'ui' })).not.toThrow();
  expect(started(sources)).toHaveLength(0);
});

test('消音を保存し、次回も覚えている。保存できない環境ではエラーにせず音ありで始まる', async () => {
  const storage = memoryStorage();
  const a = createSound({ context: () => fakeAudio().ctx, fetch: okFetch, storage });
  a.setMuted(true);
  expect(storage.getItem('oa-muted')).toBe('1');
  const b = createSound({ context: () => fakeAudio().ctx, fetch: okFetch, storage });
  expect(b.muted()).toBe(true);

  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const c = createSound({ context: () => fakeAudio().ctx, fetch: okFetch, storage: broken });
  expect(c.muted()).toBe(false);
  expect(() => c.setMuted(true)).not.toThrow();
});

test('消音中は効果音を鳴らさず、環境音は音量0にする', async () => {
  const { sound, sources, gains, ctx } = await ready();
  sound.startAmbient('wind');
  const wind = started(sources)[0];
  expect(wind.loop).toBe(true);
  sound.setMuted(true);
  ctx.currentTime += 1;
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  expect(started(sources)).toHaveLength(1);
  // 全体の音量の節（最初に作られたもの）が 0
  expect(gains[0].gain.value).toBe(0);
  sound.setMuted(false);
  expect(gains[0].gain.value).toBeCloseTo(0.8);
});

test('iPhone で音が止められている（interrupted）間は鳴らさず、次のタッチで再開を試みる', async () => {
  const { sound, sources, ctx } = await ready();
  ctx.state = 'interrupted';
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  expect(started(sources)).toHaveLength(0);
  ctx.resume.mockClear();
  sound.unlock();
  expect(ctx.resume).toHaveBeenCalled();
  ctx.currentTime += 1;
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  expect(started(sources)).toHaveLength(1);
});

test('鳴り終わった音は、音源も音量の節も切り離す（長い戦いで溜まらない）', async () => {
  const { sound, sources, gains } = await ready();
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  const source = started(sources)[0];
  const gain = gains[gains.length - 1];
  source.onended();
  expect(source.disconnect).toHaveBeenCalled();
  expect(gain.disconnect).toHaveBeenCalled();
});

test('stopAll で鳴っている効果音を止める（環境音は止めない）', async () => {
  const { sound, sources, ctx } = await ready();
  sound.startAmbient('wind');
  sound.play({ name: 'hit', group: 'beast', distance: 1 });
  ctx.currentTime += 1;
  sound.play({ name: 'swing1', group: 'player' });
  sound.stopAll();
  const [wind, hit, swing] = started(sources);
  expect(hit.stop).toHaveBeenCalled();
  expect(swing.stop).toHaveBeenCalled();
  expect(wind.stop).not.toHaveBeenCalled();
});

// ── 曲 ──
test('曲は繰り返し再生し、繰り返す範囲を指定できる。音量は 0 から上げる', async () => {
  const audio = fakeAudio();
  const sound = createSound({ context: () => audio.ctx, fetch: okFetch, storage: memoryStorage() });
  await sound.load(['music-d']);
  sound.unlock();
  audio.ctx.currentTime = 10;
  sound.playMusic('music-d', { loopStart: 39.7, loopEnd: 66.2, fade: 1 });
  const source = audio.sources[audio.sources.length - 1];
  expect(source.loop).toBe(true);
  expect(source.loopStart).toBe(39.7);
  expect(source.loopEnd).toBe(66.2);
  expect(source.start).toHaveBeenCalled();
  const gain = audio.gains[audio.gains.length - 1];
  expect(gain.gain.value).toBe(0);
  expect(gain.gain.ramps).toContainEqual({ value: 0.5, time: 11 });
});

test('別の曲へ切り替えると、前の曲は fade 秒で消えて止まる', async () => {
  const { ctx, sources, gains, sound } = await ready(['music-d', 'music-c']);
  ctx.currentTime = 5;
  sound.playMusic('music-d', { fade: 0.3 });
  const first = sources[sources.length - 1];
  const firstGain = gains[gains.length - 1];
  ctx.currentTime = 20;
  sound.playMusic('music-c', { fade: 1.5 });
  expect(firstGain.gain.ramps).toContainEqual({ value: 0, time: 21.5 });
  expect(first.stop).toHaveBeenCalledWith(21.5);
  const second = sources[sources.length - 1];
  expect(second).not.toBe(first);
  expect(second.loop).toBe(true);
});

test('同じ曲をもう一度指定しても、最初からにはしない', async () => {
  const { sources, sound } = await ready(['music-d']);
  sound.playMusic('music-d');
  const count = sources.length;
  sound.playMusic('music-d');
  expect(sources.length).toBe(count);
});

test('stopMusic で曲を fade 秒で消して止める', async () => {
  const { ctx, sources, gains, sound } = await ready(['music-a']);
  sound.playMusic('music-a');
  const source = sources[sources.length - 1];
  const gain = gains[gains.length - 1];
  ctx.currentTime = 30;
  sound.stopMusic(2.5);
  expect(gain.gain.ramps).toContainEqual({ value: 0, time: 32.5 });
  expect(source.stop).toHaveBeenCalledWith(32.5);
});

test('タッチ前や読み込み前に頼まれた曲は、準備ができたときに始める', async () => {
  const audio = fakeAudio();
  const sound = createSound({ context: () => audio.ctx, fetch: okFetch, storage: memoryStorage() });
  sound.playMusic('music-d', { loopStart: 1, loopEnd: 2 });
  expect(started(audio.sources)).toHaveLength(0);
  await sound.load(['music-d']);
  expect(started(audio.sources)).toHaveLength(0);
  sound.unlock();
  const source = audio.sources.find((s) => s.loop && s.start.mock.calls.length > 0 && s.loopEnd === 2);
  expect(source).toBeDefined();
});

test('曲を止めたあとは、準備ができても始めない', async () => {
  const audio = fakeAudio();
  const sound = createSound({ context: () => audio.ctx, fetch: okFetch, storage: memoryStorage() });
  sound.playMusic('music-d');
  sound.stopMusic();
  await sound.load(['music-d']);
  sound.unlock();
  expect(audio.sources.filter((s) => s.loop && s.start.mock.calls.length > 0)).toHaveLength(0);
});

test('曲は、ほかの音の読み込みを待たず、その曲が読めたらすぐ始める', async () => {
  const audio = fakeAudio();
  let releaseSlow;
  const slow = new Promise((resolve) => { releaseSlow = resolve; });
  const fetch = async (url) => {
    if (url.includes('slow')) await slow;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  const sound = createSound({ context: () => audio.ctx, fetch, storage: memoryStorage() });
  sound.unlock();
  sound.playMusic('music-d', { loopStart: 1, loopEnd: 2 });
  const loading = sound.load(['slow-effect', 'music-d']);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(audio.sources.some((s) => s.loop && s.loopEnd === 2 && s.start.mock.calls.length > 0)).toBe(true);
  releaseSlow();
  await loading;
});

test('風は曲の 40% の聞こえ方：音量 0.15（曲は 0.5）', async () => {
  const { sources, gains, sound } = await ready(['wind']);
  sound.startAmbient('wind');
  expect(sources.some((s) => s.loop && s.start.mock.calls.length > 0)).toBe(true);
  expect(gains[gains.length - 1].gain.value).toBeCloseTo(0.15);
});

test('負けた音（lose）は、ほかの画面の音より小さく鳴らす', async () => {
  const { gains, sound, ctx } = await ready(['lose', 'click']);
  sound.play({ name: 'click', group: 'ui' });
  const click = voiceGain(gains);
  ctx.currentTime = 1;
  sound.play({ name: 'lose', group: 'ui' });
  expect(voiceGain(gains)).toBeCloseTo(click * 0.45);
});

test('鐘：素材なしで合成して鳴らす（音が動いているときだけ）', async () => {
  const { ctx, sound } = await ready(['hit']);
  const oscillators = [];
  ctx.createOscillator = () => {
    const osc = { type: 'sine', frequency: { value: 0 }, connect: vi.fn(() => osc), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
    oscillators.push(osc);
    return osc;
  };
  ctx.state = 'suspended';
  sound.bell();
  expect(oscillators).toHaveLength(0);
  ctx.state = 'running';
  sound.bell();
  expect(oscillators.length).toBeGreaterThanOrEqual(3);
  expect(oscillators.every((o) => o.start.mock.calls.length === 1 && o.stop.mock.calls.length === 1)).toBe(true);
});

test('鐘も stopAll で止まる（タイトルへ戻ったら鳴り続けない）', async () => {
  const { ctx, sound } = await ready(['hit']);
  const oscillators = [];
  ctx.createOscillator = () => {
    const osc = { type: 'sine', frequency: { value: 0 }, connect: vi.fn(() => osc), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
    oscillators.push(osc);
    return osc;
  };
  ctx.state = 'running';
  sound.bell();
  sound.stopAll();
  expect(oscillators.every((o) => o.stop.mock.calls.length === 2)).toBe(true);
});
