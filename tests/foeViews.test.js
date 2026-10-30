import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createFoeViews } from '../src/areas/foeViews.js';

// 人型の模型の代わり：骨（右手の取り付け先）と箱、動作は名前だけ
function fakeHuman({ height, native = null }) {
  const scene = new THREE.Group();
  const holder = new THREE.Group();
  if (native) holder.userData = { ...native };
  scene.add(holder);
  const slot = new THREE.Bone();
  slot.name = 'handslotr';
  slot.position.set(0.3, 1, 0);
  holder.add(slot);
  // 専用の模型には外套の骨（cape0〜4）がある
  if (native) {
    let parent = holder;
    for (let i = 0; i < 5; i++) { const cape = new THREE.Bone(); cape.name = `cape${i}`; cape.position.y = i ? -0.3 : 1.5; parent.add(cape); parent = cape; }
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, height, 0.3), new THREE.MeshStandardMaterial({ name: native ? 'revenant_iron' : 'skeleton' }));
  body.position.y = height / 2;
  holder.add(body);
  // 歩き：右手の取り付け先が、1秒に x を 1 だけ動く
  const walk = new THREE.AnimationClip('Walking_A', 2, [new THREE.VectorKeyframeTrack('handslotr.position', [0, 2], [0, 1, 0, 2, 1, 0])]);
  const animations = [walk, ...['Idle_Combat', '1H_Melee_Attack_Chop'].map((name) => new THREE.AnimationClip(name, 1, []))];
  return { scene, animations };
}
const DEFS = {
  spear: { look: 'spear', radius: 0.5, attacks: [] },
  shield: { look: 'shield', radius: 0.6, attacks: [] },
  hound: { look: 'hound', radius: 0.6, attacks: [] },
};
const frame = (id, phase = 'chase', x = 0) => ({ id, x, z: 0, facing: 0, phase, height: 0, telegraph: [] });

async function setup(types, { revenant = true } = {}) {
  const loaded = [];
  const load = async (url) => {
    loaded.push(url);
    if (url.includes('revenant-spear-v2')) {
      if (!revenant) throw new Error('missing');
      return fakeHuman({ height: 1.95, native: { nativeScale: true, animationSpeed: { Walking_A: 0.62 }, model: 'spear-revenant' } });
    }
    return fakeHuman({ height: 1.1 });
  };
  const scene = new THREE.Scene();
  const posts = types.map((type, i) => ({ id: `${type}${i}`, type, x: 0, z: 0 }));
  const views = await createFoeViews(scene, posts, DEFS, () => 0, { load });
  return { views, loaded };
}
const countMeshes = (object) => { let n = 0; object.traverse((o) => { if (o.isMesh) n += 1; }); return n; };
const heightOf = (object) => { object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y; };
// 体だけの高さ（手の持ち物は除く）
const bodyHeightOf = (object) => {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  object.traverse((o) => {
    let held = false;
    for (let p = o; p; p = p.parent) if (p.name === 'handslotr') held = true;
    if (o.isMesh && !held) box.expandByObject(o);
  });
  return box.getSize(new THREE.Vector3()).y;
};

test('晶槍の亡兵は専用の模型（原寸・槍も模型の中）を使い、ほかの人型は今までの骸骨兵のまま', async () => {
  const { views, loaded } = await setup(['spear', 'shield']);
  expect(loaded.some((u) => u.includes('revenant-spear-v2.glb'))).toBe(true);
  const spear = views.object('spear0');
  let model = null;
  spear.traverse((o) => { if (o.userData?.model) model = o.userData.model; });
  expect(model).toBe('spear-revenant');
  // 原寸のまま（1.9m に合わせ直さない）、持ち物の槍を重ねて足さない（模型の箱1つだけ）
  expect(heightOf(spear)).toBeCloseTo(1.95, 2);
  expect(countMeshes(spear)).toBe(1);
  // 盾の骸骨兵は今までどおり：1.9m に合わせる
  expect(bodyHeightOf(views.object('shield1'))).toBeCloseTo(1.9 * 1.12, 2);
});

test('晶槍の亡兵の歩きは、脚が長くなった分ゆっくり再生する（足の滑りを抑える）', async () => {
  const { views } = await setup(['spear', 'shield']);
  for (const dt of [0.016, 0.5]) views.update(dt, [frame('spear0'), frame('shield1')], 0);
  const slotX = (id) => views.object(id).getObjectByName('handslotr').position.x;
  expect(slotX('shield1')).toBeCloseTo(0.516, 2);
  expect(slotX('spear0')).toBeCloseTo(0.516 * 0.62, 2);
});

test('専用の模型が読めないときは、今までの骸骨兵と槍で代わりに表示する', async () => {
  const { views } = await setup(['spear'], { revenant: false });
  const spear = views.object('spear0');
  let model = null;
  spear.traverse((o) => { if (o.userData?.model) model = o.userData.model; });
  expect(model).toBe(null);
  // 今までどおり、骸骨兵を 1.9m に合わせて表示する
  expect(bodyHeightOf(spear)).toBeCloseTo(1.9, 2);
});

test('晶牙ハウンドは関節で作った体（脚の付け根の関節がある）', async () => {
  const { views } = await setup(['hound']);
  expect(views.object('hound0').getObjectByName('fore_l_upper')).toBeDefined();
});

test('晶槍の亡兵の外套は、歩く速さに合わせて後ろへなびき、止まると垂れ下がる（骨ごとに動く）', async () => {
  const { views } = await setup(['spear']);
  const cape = (i) => views.object('spear0').getObjectByName(`cape${i}`);
  let x = 0;
  for (let i = 0; i < 40; i++) { x += 2.4 * 0.05; views.update(0.05, [frame('spear0', 'chase', x)], i * 0.05); }
  expect(cape(1).rotation.x).toBeGreaterThan(0.1);
  expect(cape(2).rotation.x).toBeGreaterThan(0);
  expect(cape(1).rotation.x).not.toBeCloseTo(cape(2).rotation.x, 3);
  for (let i = 0; i < 60; i++) views.update(0.05, [frame('spear0', 'idle', x)], 2 + i * 0.05);
  expect(Math.abs(cape(1).rotation.x)).toBeLessThan(0.08);
});

// 読み込み（GLTFLoader）は骨の名前から「.」を取り除く（'handslot.r' → 'handslotr'）。その名前で手を探さないと、持ち物が付かない
test('骸骨兵の人型は、持ち物（槍・盾）を手に持つ', async () => {
  const { views } = await setup(['spear', 'shield'], { revenant: false });
  const gearIn = (id) => countMeshes(views.object(id).getObjectByName('handslotr'));
  expect(gearIn('spear0')).toBeGreaterThan(0);
  expect(gearIn('shield1')).toBeGreaterThan(0);
});
