// 元素材（assets-src/）を、スマホ向けに軽くして public/ に書き出す
// 使い方: npm run optimize
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const manifest = JSON.parse(readFileSync('assets-src/manifest.json', 'utf8'));
const bin = 'node_modules/.bin/gltf-transform';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const work = mkdtempSync(join(tmpdir(), 'optimize-assets-'));

// 使わないアニメーションと部品（盾・予備の武器など）を取り除いた一時ファイルを作る
async function trim(asset) {
  if (!asset.keepAnimations && !asset.removeNodes) return asset.src;

  const document = await io.read(asset.src);
  const root = document.getRoot();

  if (asset.keepAnimations) {
    for (const animation of root.listAnimations()) {
      if (!asset.keepAnimations.includes(animation.getName())) animation.dispose();
    }
  }
  for (const node of root.listNodes()) {
    if (asset.removeNodes?.includes(node.getName())) node.dispose();
  }
  await document.transform(prune());

  const trimmed = join(work, `${root.listScenes()[0]?.getName() || 'asset'}-${Date.now()}.glb`);
  await io.write(trimmed, document);
  return trimmed;
}

for (const asset of manifest) {
  mkdirSync(dirname(asset.out), { recursive: true });

  const simplifyRatio = asset.simplifyRatio ?? 1;
  const args = [
    'optimize', await trim(asset), asset.out,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(asset.textureSize ?? 1024),
    '--simplify', String(simplifyRatio < 1),
  ];
  if (simplifyRatio < 1) args.push('--simplify-ratio', String(simplifyRatio));
  // 骨格で動くキャラクターは、部品をまとめると武器の付け替えができなくなるので結合しない
  if (asset.keepNodes) args.push('--join', 'false', '--flatten', 'false', '--instance', 'false');

  console.log(`→ ${asset.out}`);
  execFileSync(bin, args, { stdio: 'inherit' });
}

rmSync(work, { recursive: true, force: true });
