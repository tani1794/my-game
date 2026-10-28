// 敵「晶槍の亡兵」の GLB を作る：開発サーバー（npx vite --host --port 5173）が動いている状態で
//   node scripts/build-spear-revenant.mjs [確認画像の出力先]
// public/models/skeleton_warrior.glb（元のまま残す。ほかの人型の敵が使う）を読み、scripts/models/spearRevenant.js で組み立て、
// public/models/revenant-spear.glb に書き出す（meshopt と webp で圧縮）。
// 圧縮したものを読み直して、確認画像（正面・横・後ろ・動作の途中）を保存する。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public/models/revenant-spear.glb');
const SHOTS = process.argv[2] ?? path.join(ROOT, 'docs/models');
const PORT = process.env.PORT ?? 5173;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGE', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`http://localhost:${PORT}/?debug`, { waitUntil: 'load' });
// 1) 組み立てて、圧縮前の GLB を受け取る
const raw = await page.evaluate(async () => {
  const { loadGLTF } = await import('/src/assets.js');
  const { buildSpearRevenant } = await import('/scripts/models/spearRevenant.js');
  const { exportGLB, toBase64 } = await import('/scripts/models/exportGlb.js');
  const gltf = await loadGLTF('/models/skeleton_warrior.glb');
  const built = buildSpearRevenant(gltf);
  return toBase64(await exportGLB(built.scene, built.animations));
});
// 2) 圧縮（頂点の結合 → 画像を webp → 形を meshopt）
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'revenant-'));
const step = (name) => path.join(work, name);
fs.writeFileSync(step('raw.glb'), Buffer.from(raw, 'base64'));
const cli = path.join(ROOT, 'node_modules/.bin/gltf-transform');
execFileSync(cli, ['weld', step('raw.glb'), step('weld.glb')], { stdio: 'ignore' });
execFileSync(cli, ['webp', step('weld.glb'), step('webp.glb')], { stdio: 'ignore' });
execFileSync(cli, ['meshopt', step('webp.glb'), OUT], { stdio: 'ignore' });
// 3) 書き出したファイルをゲームと同じ読み込み方で読み直し、確かめて撮る
const result = await page.evaluate(async () => {
  const { loadGLTF } = await import('/src/assets.js');
  const { renderViews, rememberRest, THREE } = await import('/scripts/models/exportGlb.js');
  const back = await loadGLTF(`/models/revenant-spear.glb?${Date.now()}`);
  const box = new THREE.Box3().setFromObject(back.scene);
  let meshes = 0;
  let triangles = 0;
  const materials = new Set();
  back.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    materials.add(o.material.name);
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  let info = null;
  back.scene.traverse((o) => { if (o.userData?.nativeScale) info = o.userData; });
  rememberRest(back.scene);
  const views = [
    { angle: 0 }, { angle: Math.PI / 2 }, { angle: Math.PI },
    { clip: 'Idle_Combat', time: 0.4, angle: 0.5 }, { clip: 'Walking_A', time: 0.3, angle: Math.PI / 2 }, { clip: '1H_Melee_Attack_Chop', time: 0.35, angle: 0.8 },
    { clip: 'Skeleton_Inactive_Standing_Pose', time: 0.2, angle: 0.6 }, { clip: 'Hit_A', time: 0.2, angle: 0.4 }, { clip: 'Death_A', time: 1.5, angle: 0.9 },
  ];
  const shots = renderViews(back.scene, { animations: back.animations, views, height: 2.4 });
  return {
    check: {
      size: box.getSize(new THREE.Vector3()).toArray().map((n) => +n.toFixed(3)),
      min: box.min.toArray().map((n) => +n.toFixed(3)),
      clips: back.animations.map((c) => c.name),
      meshes,
      triangles: Math.round(triangles),
      materials: [...materials],
      userData: info,
    },
    shots,
    names: views.map((v) => v.clip ?? `rest-${Math.round((v.angle ?? 0) * 57)}`),
  };
});
fs.mkdirSync(SHOTS, { recursive: true });
result.shots.forEach((data, i) => fs.writeFileSync(path.join(SHOTS, `revenant-spear-${i}-${result.names[i]}.png`), Buffer.from(data.split(',')[1], 'base64')));
console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, ...result.check }));
await browser.close();
