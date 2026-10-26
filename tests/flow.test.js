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
