import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildServiceWorker, listFiles, versionOf } from './scripts/service-worker.mjs';

// ビルドの最後に、オフライン用の Service Worker（dist/sw.js）を書き出す
function serviceWorker() {
  let outDir = 'dist';
  return {
    name: 'oblivion-arena-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir);
      writeFileSync(join(outDir, 'sw.js'), buildServiceWorker(files, versionOf(outDir, files)));
    },
  };
}

export default defineConfig({
  // どこに置いても動くよう、ファイルの場所はページからの相対にする（GitHub Pages は /my-game/ の下）
  base: './',
  plugins: [serviceWorker()],
});
