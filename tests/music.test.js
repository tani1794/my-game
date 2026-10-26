import { test, expect, vi } from 'vitest';
import { musicFor, createBattleMusic, playTitleMusic, MUSIC_TRACKS } from '../src/audio/music.js';

test('結晶獣の体力：半分より多い D、半分以下で C、3分の1以下で A', () => {
  expect(musicFor(1)).toBe('music-d');
  expect(musicFor(0.51)).toBe('music-d');
  expect(musicFor(0.5)).toBe('music-c');
  expect(musicFor(0.34)).toBe('music-c');
  expect(musicFor(1 / 3)).toBe('music-a');
  expect(musicFor(0)).toBe('music-a');
});

test('曲ごとの繰り返しの範囲：D は前奏のあと、C と A は全体', () => {
  expect(MUSIC_TRACKS['music-d'].loopStart).toBeCloseTo(1751835 / 44100, 4);
  expect(MUSIC_TRACKS['music-d'].loopEnd).toBeCloseTo(2919725 / 44100, 4);
  expect(MUSIC_TRACKS['music-c']).toEqual({ loopStart: 0, loopEnd: 836352 / 44100 });
  expect(MUSIC_TRACKS['music-a']).toEqual({ loopStart: 0, loopEnd: 4762800 / 44100 });
});

function fakeSound() {
  return { playMusic: vi.fn(), stopMusic: vi.fn() };
}

test('戦いの始まりは D から', () => {
  const sound = fakeSound();
  const music = createBattleMusic(sound);
  music.start();
  expect(sound.playMusic).toHaveBeenCalledWith('music-d', expect.objectContaining({ ...MUSIC_TRACKS['music-d'] }));
});

test('体力が減るたびに一度だけ切り替え、戻らない', () => {
  const sound = fakeSound();
  const music = createBattleMusic(sound);
  music.start();
  music.update(0.8);
  music.update(0.5);
  music.update(0.45);
  expect(sound.playMusic).toHaveBeenCalledTimes(2);
  expect(sound.playMusic).toHaveBeenLastCalledWith('music-c', expect.objectContaining({ ...MUSIC_TRACKS['music-c'] }));
  music.update(0.3);
  expect(sound.playMusic).toHaveBeenLastCalledWith('music-a', expect.objectContaining({ ...MUSIC_TRACKS['music-a'] }));
  music.update(0.9);
  expect(sound.playMusic).toHaveBeenCalledTimes(3);
});

test('一気に減って 3分の1 以下になったら、C を飛ばして A へ', () => {
  const sound = fakeSound();
  const music = createBattleMusic(sound);
  music.start();
  music.update(0.2);
  expect(sound.playMusic).toHaveBeenLastCalledWith('music-a', expect.anything());
  expect(sound.playMusic).toHaveBeenCalledTimes(2);
});

test('勝ち負けが決まったらゆっくり消し、そのあとは切り替えない', () => {
  const sound = fakeSound();
  const music = createBattleMusic(sound);
  music.start();
  music.finish();
  expect(sound.stopMusic).toHaveBeenCalledWith(2.5);
  music.update(0.1);
  expect(sound.playMusic).toHaveBeenCalledTimes(1);
});

test('やり直し・タイトルへ：すぐ止め、次の start でまた D から', () => {
  const sound = fakeSound();
  const music = createBattleMusic(sound);
  music.start();
  music.update(0.2);
  music.stop();
  expect(sound.stopMusic).toHaveBeenLastCalledWith(0.3);
  music.start();
  expect(sound.playMusic).toHaveBeenLastCalledWith('music-d', expect.anything());
});

test('タイトル曲：全体を繰り返し、2秒かけて入る', () => {
  expect(MUSIC_TRACKS['music-title']).toEqual({ loopStart: 0, loopEnd: 3941627 / 44100 });
  const sound = fakeSound();
  playTitleMusic(sound);
  expect(sound.playMusic).toHaveBeenCalledWith('music-title', { ...MUSIC_TRACKS['music-title'], fade: 2 });
});
