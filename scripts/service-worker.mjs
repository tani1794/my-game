// 一度開いたら通信なしでも遊べるよう、公開するファイルをすべて iPhone に保存する Service Worker を作る。
// vite.config.js がビルドの最後に dist/sw.js を書き出す。
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

// 出力フォルダの中のファイルを、相対パスで並べる（sw.js 自身と隠しファイルは除く）
export function listFiles(root, dir = root) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...listFiles(root, full));
    else if (relative(root, full) !== 'sw.js') files.push(relative(root, full).split(sep).join('/'));
  }
  return files;
}

// 中身が変わったら版も変わる（新しい版は次に通信できたときに入れ替わる）
export function versionOf(root, files) {
  const hash = createHash('sha256');
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update(readFileSync(join(root, file)));
  }
  return hash.digest('hex').slice(0, 12);
}

export function buildServiceWorker(files, version) {
  const cacheName = `oblivion-arena-${version}`;
  const precache = JSON.stringify(['./', ...files], null, 2);
  return `// 自動生成（scripts/service-worker.mjs）。手で編集しない
const CACHE = '${cacheName}';
const FILES = ${precache};

// 入れるとき：すべてのファイルを保存する
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// 新しい版になったら、古い版の保存を消す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('oblivion-arena-') && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// 保存してあればそれを使い、なければ通信する（?debug などの URL の後ろは無視）
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((hit) => hit || fetch(event.request)),
  );
});
`;
}
