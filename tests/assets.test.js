import { test, expect } from 'vitest';
import { withFallback } from '../src/assets.js';

test('読み込みに失敗したら代わりを返す', async () => {
  await expect(withFallback(Promise.reject(new Error('404')), () => 'fb')).resolves.toBe('fb');
});

test('成功したらそのまま返す', async () => {
  await expect(withFallback(Promise.resolve('ok'), () => 'fb')).resolves.toBe('ok');
});
