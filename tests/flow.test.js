import { test, expect } from 'vitest';
import { nextState } from '../src/game/flow.js';

test('許される切り替え', () => {
  expect(nextState('title', 'start')).toBe('playing');
  expect(nextState('playing', 'pause')).toBe('paused');
  expect(nextState('playing', 'finish')).toBe('result');
  expect(nextState('paused', 'resume')).toBe('playing');
  expect(nextState('paused', 'retry')).toBe('playing');
  expect(nextState('paused', 'title')).toBe('title');
  expect(nextState('result', 'retry')).toBe('playing');
  expect(nextState('result', 'title')).toBe('title');
});

test('許されない切り替えは null', () => {
  expect(nextState('title', 'pause')).toBe(null);
  expect(nextState('result', 'pause')).toBe(null);
  expect(nextState('paused', 'finish')).toBe(null);
  expect(nextState('playing', 'start')).toBe(null);
  expect(nextState('title', 'retry')).toBe(null);
});

test('第一章：タイトルから物語へ。物語の中で一時停止・再開・やり直し・タイトルへ', () => {
  expect(nextState('title', 'story')).toBe('story');
  expect(nextState('story', 'pause')).toBe('storyPaused');
  expect(nextState('storyPaused', 'resume')).toBe('story');
  expect(nextState('storyPaused', 'retry')).toBe('story');
  expect(nextState('storyPaused', 'title')).toBe('title');
});

test('第一章の終わりから結晶獣戦へ（物語から直接）', () => {
  expect(nextState('story', 'battle')).toBe('playing');
  expect(nextState('title', 'battle')).toBe(null);
  expect(nextState('story', 'finish')).toBe(null);
  expect(nextState('storyPaused', 'battle')).toBe(null);
});
