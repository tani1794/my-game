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

// 王冠の騎士（scripts/knight/build-knight.mjs で作る）
const crown = () => glbJson('public/models/knight-crown.glb');

test('王冠の騎士にも、行動が使う12本の動きが入っている', () => {
  const names = crown().animations.map((a) => a.name);
  for (const n of ['Idle', 'Walking_A', 'Running_A', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal',
    '1H_Melee_Attack_Chop', 'Dodge_Forward', 'Dodge_Backward', 'Dodge_Left', 'Dodge_Right', 'Hit_A', 'Death_A']) {
    expect(names).toContain(n);
  }
});

test('王冠の騎士：握りの骨とマントの骨9本があり、材質は鎧と布の2つだけ', () => {
  const json = crown();
  const nodes = json.nodes.map((n) => n.name);
  expect(nodes).toContain('handslot.r');
  for (const chain of ['l', 'c', 'r']) for (let k = 1; k <= 3; k++) expect(nodes).toContain(`cape_${chain}_${k}`);
  expect(json.materials.map((m) => m.name).sort()).toEqual(['Knight_Armor', 'Knight_Cloth']);
  expect(json.meshes.length).toBe(2);
});

test('王冠の騎士：スマホ向けの上限（画像は1024px以下が6枚まで）', () => {
  const json = crown();
  expect(json.images.length).toBeLessThanOrEqual(6);
  expect(json.textures.length).toBeLessThanOrEqual(6);
});

test('王冠の騎士：ゲームが移動を受け持つので、回避の動きに腰の前後左右のずれ（ルートモーション）が無い', async () => {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder } = await import('meshoptimizer');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read('public/models/knight-crown.glb');
  const dodges = doc.getRoot().listAnimations().filter((a) => a.getName().startsWith('Dodge_'));
  expect(dodges.length).toBe(4);
  for (const anim of dodges) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== 'translation') continue;
      const name = ch.getTargetNode().getName();
      if (name !== 'hips' && name !== 'root') continue;
      const out = ch.getSampler().getOutput();
      const values = [];
      for (let i = 0; i < out.getCount(); i++) values.push(out.getElement(i, []));
      // root は全く動かない。腰は上下（y）だけ動いてよい
      for (const axis of name === 'root' ? [0, 1, 2] : [0, 2]) {
        const xs = values.map((v) => v[axis]);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.01);
      }
    }
  }
});
