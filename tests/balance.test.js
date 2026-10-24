import { test, expect } from 'vitest';
import { simulateFight } from './helpers/bot.js';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

test('自動の操作役で20戦：勝率60%以上、勝った戦いの時間の中央値が3〜5分', () => {
  const results = Array.from({ length: 20 }, (_, i) => simulateFight(i + 1));
  const wins = results.filter((r) => r.outcome === 'won');
  const summary = {
    wins: wins.length,
    lost: results.filter((r) => r.outcome === 'lost').length,
    timeout: results.filter((r) => r.outcome === 'timeout').length,
    medianWinSeconds: wins.length ? Math.round(median(wins.map((r) => r.time))) : null,
  };
  console.info('balance', JSON.stringify(summary));
  expect(wins.length / results.length).toBeGreaterThanOrEqual(0.6);
  expect(summary.medianWinSeconds).toBeGreaterThanOrEqual(180);
  expect(summary.medianWinSeconds).toBeLessThanOrEqual(300);
}, 120000);
