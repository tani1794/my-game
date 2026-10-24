// 元素材（assets-src/）を、スマホ向けに軽くして public/ に書き出す
// 使い方: npm run optimize
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const manifest = JSON.parse(readFileSync('assets-src/manifest.json', 'utf8'));
const bin = 'node_modules/.bin/gltf-transform';

for (const asset of manifest) {
  mkdirSync(dirname(asset.out), { recursive: true });

  const simplifyRatio = asset.simplifyRatio ?? 1;
  const args = [
    'optimize', asset.src, asset.out,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(asset.textureSize ?? 1024),
    '--simplify', String(simplifyRatio < 1),
  ];
  if (simplifyRatio < 1) args.push('--simplify-ratio', String(simplifyRatio));

  console.log(`→ ${asset.out}`);
  execFileSync(bin, args, { stdio: 'inherit' });
}
