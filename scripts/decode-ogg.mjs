// Kenney の効果音（OGG）を、Chrome の音声デコーダーで WAV（モノラル 44.1kHz）に変換する。
// macOS の afconvert は OGG を読めないため。使い方：
//   npm i --no-save puppeteer-core@23
//   node scripts/decode-ogg.mjs <出力フォルダ> <ogg ファイル...>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import puppeteer from 'puppeteer-core';

const [outDir, ...files] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
});
const page = await browser.newPage();
await page.goto('about:blank');

function wav(samples, rate) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * 32767))), 44 + i * 2));
  return buffer;
}

for (const file of files) {
  const base64 = readFileSync(file).toString('base64');
  const samples = await page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const context = new OfflineAudioContext(1, 1, 44100);
    const decoded = await context.decodeAudioData(bytes.buffer);
    // 44.1kHz・モノラルに描き直す
    const render = new OfflineAudioContext(1, Math.ceil(decoded.duration * 44100), 44100);
    const source = render.createBufferSource();
    source.buffer = decoded;
    source.connect(render.destination);
    source.start();
    const result = await render.startRendering();
    return Array.from(result.getChannelData(0));
  }, base64);
  const out = `${outDir}/${basename(file, '.ogg')}.wav`;
  writeFileSync(out, wav(samples, 44100));
  console.log(`→ ${out} (${(samples.length / 44100).toFixed(2)}s)`);
}
await browser.close();
