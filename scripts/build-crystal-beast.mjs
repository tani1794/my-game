// 結晶獣の GLB を作る：開発サーバー（npx vite --host --port 5173）が動いている状態で
//   node scripts/build-crystal-beast.mjs [確認画像の出力先]
// scripts/models/crystalBeast.js で組み立て、public/models/beast-crystal-v2.glb に書き出す（元の beast.glb は残す）。
// 圧縮（webp・meshopt）してから読み直し、確認画像（正面寄り・横・後ろ）を保存する。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public/models/beast-crystal-v2.glb');
const SHOTS = process.argv[2] ?? path.join(ROOT, 'docs/models');
const PORT = process.env.PORT ?? 5173;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGE', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`http://localhost:${PORT}/?debug`, { waitUntil: 'load' });
const raw = await page.evaluate(async () => {
  const { buildCrystalBeast } = await import('/scripts/models/crystalBeast.js');
  const { exportGLB, toBase64 } = await import('/scripts/models/exportGlb.js');
  const built = buildCrystalBeast();
  return toBase64(await exportGLB(built.scene, []));
});
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'beast-'));
const step = (name) => path.join(work, name);
fs.writeFileSync(step('raw.glb'), Buffer.from(raw, 'base64'));
const cli = path.join(ROOT, 'node_modules/.bin/gltf-transform');
execFileSync(cli, ['webp', step('raw.glb'), step('webp.glb')], { stdio: 'ignore' });
execFileSync(cli, ['meshopt', step('webp.glb'), OUT], { stdio: 'ignore' });
const result = await page.evaluate(async () => {
  const { loadGLTF } = await import('/src/assets.js');
  const { renderViews, THREE } = await import('/scripts/models/exportGlb.js');
  const back = await loadGLTF(`/models/beast-crystal-v2.glb?${Date.now()}`);
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
  const joints = [];
  back.scene.traverse((o) => { if (o.userData?.joints) joints.push(...o.userData.joints); });
  const views = [{ angle: 0.5 }, { angle: Math.PI / 2 }, { angle: Math.PI + 0.45 }];
  const shots = renderViews(back.scene, { views, height: 7.2, size: [640, 480] });
  return { check: { size: box.getSize(new THREE.Vector3()).toArray().map((n) => +n.toFixed(2)), min: box.min.toArray().map((n) => +n.toFixed(2)), meshes, triangles: Math.round(triangles), materials: [...materials], joints: joints.length }, shots };
});
fs.mkdirSync(SHOTS, { recursive: true });
result.shots.forEach((data, i) => fs.writeFileSync(path.join(SHOTS, `beast-crystal-${i}.png`), Buffer.from(data.split(',')[1], 'base64')));
console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, ...result.check }));
await browser.close();
