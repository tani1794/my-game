import { test, expect } from 'vitest';
import { buildServiceWorker, listFiles } from '../scripts/service-worker.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('公開するファイルをすべて保存する Service Worker を作る（版が変わると別の保存場所）', () => {
  const source = buildServiceWorker(['index.html', 'assets/index-abc.js', 'models/beast.glb'], 'v123');
  expect(source).toContain("'oblivion-arena-v123'");
  expect(source).toContain('"./"');
  expect(source).toContain('"assets/index-abc.js"');
  expect(source).toContain('"models/beast.glb"');
  expect(source).toContain("addEventListener('fetch'");
  expect(buildServiceWorker(['index.html'], 'v124')).not.toBe(buildServiceWorker(['index.html'], 'v123'));
});

test('出力フォルダのファイルを並べる（Service Worker 自身と隠しファイルは除く）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), 'x');
  writeFileSync(join(dir, 'assets', 'a.js'), 'y');
  writeFileSync(join(dir, 'sw.js'), 'z');
  writeFileSync(join(dir, '.DS_Store'), 'w');
  expect(listFiles(dir).sort()).toEqual(['assets/a.js', 'index.html']);
});
