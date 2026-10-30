import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const glbJson = (path) => {
  const b = readFileSync(path);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};

test('騎士に戦闘のアニメーション12本が入っている', () => {
  const names = glbJson('public/models/knight.glb').animations.map((a) => a.name);
  for (const n of ['Idle', 'Walking_A', 'Running_A', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal',
    '1H_Melee_Attack_Chop', 'Dodge_Forward', 'Dodge_Backward', 'Dodge_Left', 'Dodge_Right', 'Hit_A', 'Death_A']) {
    expect(names).toContain(n);
  }
});

// glTF には alphaMap が無く、書き出し（GLTFExporter）で捨てられる。破れた裾は、マントの色の画像の透明として入っていること
import sharp from 'sharp';

async function baseColorPixels(path, materialName) {
  const b = readFileSync(path);
  const length = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + length).toString());
  const bin = b.subarray(20 + length + 8);
  const material = json.materials.find((m) => m.name === materialName);
  const texture = json.textures[material.pbrMetallicRoughness.baseColorTexture.index];
  const view = json.bufferViews[json.images[texture.source ?? texture.extensions.EXT_texture_webp.source].bufferView];
  const image = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  return sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
const clearRows = ({ data, info }) => {
  // 透明（alpha < 128）の画素が、画像の上半分と下半分にいくつあるか
  const rows = { top: 0, bottom: 0 };
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) rows[Math.floor((i - 3) / 4 / info.width) < info.height / 2 ? 'top' : 'bottom'] += 1;
  return rows;
};

test('王冠の騎士のマントは裾が破れている（色の画像の透明）、頭巾は透けない', async () => {
  const cloak = clearRows(await baseColorPixels('public/models/knight-crowned.glb', 'cloak'));
  // 裾（uv の v = 0 の側。glTF の画像では上端）だけが欠ける
  expect(cloak.top).toBeGreaterThan(1000);
  expect(cloak.bottom).toBe(0);
  const hood = clearRows(await baseColorPixels('public/models/knight-crowned.glb', 'hood'));
  expect(hood.top + hood.bottom).toBe(0);
});
