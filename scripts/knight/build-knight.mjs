// 王冠の騎士 public/models/knight-crown.glb を作る（元の public/models/knight.glb は比較・復元用にそのまま残す）
//   1. public/models/knight.glb（KayKit の騎士、CC0）を圧縮なしの .glb に戻す（骨格と12本の動きの元）
//   2. Blender（bpy）で骨格を成人の比率へ組み直し、鎧・王冠・マント・剣を作って、模様を画像へ焼き付ける（build.py）
//   3. 焼き付けた画像を材質へ付け、スマホ向けに圧縮して書き出す
// 使い方: BPY_PYTHON=<bpy を入れた Python> npm run build:knight
//   bpy は `pip install bpy==5.1.2`（Python 3.13）で入る。途中のファイルは assets-src/packs/knight-crown/（リポジトリ外）
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = 'public/models/knight.glb';
const WORK = 'assets-src/packs/knight-crown';
const OUT = 'public/models/knight-crown.glb';
const python = process.env.BPY_PYTHON ?? 'python3';
const skipBlender = process.argv.includes('--skip-blender');

mkdirSync(WORK, { recursive: true });
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

// 1. 圧縮を解いた元（Blender の読み込みは meshopt と webp に対応していないため）
if (!skipBlender) {
  const doc = await io.read(SRC);
  await doc.transform(dequantize());
  for (const texture of doc.getRoot().listTextures()) {
    texture.setImage(await sharp(Buffer.from(texture.getImage())).png().toBuffer()).setMimeType('image/png');
  }
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();
  await io.write(join(WORK, 'knight-src.glb'), doc);

  // 2. Blender
  execFileSync(python, ['scripts/knight/build.py', '--', join(WORK, 'knight-src.glb'), WORK], { stdio: 'inherit' });
}

// 3. 画像を材質へ。金属の映り込みは player.js の環境マップで補う
const doc = await io.read(join(WORK, 'knight-crown-raw.glb'));
// 布の粗さと凹凸はほぼ一様なので 512px に縮めて、GPU のメモリを節約する
const SMALL = new Set(['Knight_Cloth_orm', 'Knight_Cloth_normal']);
const png = async (name) => {
  let image = readFileSync(join(WORK, `${name}.png`));
  if (SMALL.has(name)) image = await sharp(image).resize(512, 512).png().toBuffer();
  return doc.createTexture(name).setImage(image).setMimeType('image/png');
};
for (const material of doc.getRoot().listMaterials()) {
  const name = material.getName();
  const orm = await png(`${name}_orm`);
  material
    .setBaseColorFactor([1, 1, 1, 1])
    .setBaseColorTexture(await png(`${name}_color`))
    .setMetallicRoughnessTexture(orm)
    .setOcclusionTexture(orm)
    .setNormalTexture(await png(`${name}_normal`))
    .setMetallicFactor(1)
    .setRoughnessFactor(1)
    .setDoubleSided(name === 'Knight_Cloth');
}
await io.write(join(WORK, 'knight-crown-textured.glb'), doc);

execFileSync('node_modules/.bin/gltf-transform', [
  'optimize', join(WORK, 'knight-crown-textured.glb'), OUT,
  '--compress', 'meshopt',
  '--texture-compress', 'webp',
  '--texture-size', '1024',
  '--simplify', 'false',
  // 骨格で動くキャラクターなので、部品をまとめたり平らにしたりしない
  '--join', 'false', '--flatten', 'false', '--instance', 'false',
], { stdio: 'inherit' });
console.log(`→ ${OUT}`);
