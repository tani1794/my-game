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
      const node = { gain: { value: 1 }, connect: vi.fn(() => node) };
      gains.push(node);
      return node;
    },
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        connect: vi.fn(() => source),
        start: vi.fn(),
        stop: vi.fn(),
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
