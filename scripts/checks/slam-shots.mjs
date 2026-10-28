import puppeteer from 'puppeteer-core';
const [port, S, prefix] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGE ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('403')) errors.push(m.text().slice(0, 200)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.setViewport({ width: 960, height: 440 });
await page.goto(`http://localhost:${port}/?q=low&debug&fast`, { waitUntil: 'load' });
const save = { version: 2, area: 'crystal', phase: 'CHAPTER_COMPLETE', checkpoint: 'crystalGate', flags: { gateOpen: true, evolved: true, metOrun: true, webCut1: true, webCut2: true, reflectorA: true, reflectorB: true, bridgeOn: true, midStoneLit: true, winchA: true, winchB: true, winchC: true, liftUp: true, crownGateOpen: true, gateStoneLit: true }, seen: ['wake', 'arrive'], defeated: ['cr-giant'] };
await page.evaluate((s) => localStorage.setItem('oa-story', JSON.stringify(s)), save);
await page.reload({ waitUntil: 'load' });
await sleep(4000);
await page.mouse.click(480, 220); await sleep(800); await page.mouse.click(480, 220);
await sleep(12000);
const tp = (x, z, y, face) => page.evaluate(([x, z, y, face]) => window.__areas.teleport(x, z, y, face ?? undefined), [x, z, y, face ?? null]);
await tp(0, 33, 0); await sleep(2000);
await tp(0, 19, 0, Math.PI); await sleep(11000);
await page.screenshot({ path: `${S}/${prefix}-fight.png` }); await sleep(10000);
// ボスの正面、少し横から（横から姿勢が見える）
const boss = async () => page.evaluate(() => { const d = window.__areas.debug(); const o = d.scene.getObjectByName('CrystalBeast').parent.parent; return { x: d.boss.x, z: d.boss.z, facing: o.rotation.y, pitch: o.rotation.x, y: o.position.y }; });
let n = 0;
for (let i = 0; i < 260 && n < 18; i++) {
  const b = await boss();
  const f = b.facing ?? 0;
  // 正面 6m、そこから横へ 3m ずらして立つ
  const px = b.x + Math.sin(f) * 4.5 + Math.cos(f) * 2.5;
  const pz = b.z + Math.cos(f) * 4.5 - Math.sin(f) * 2.5;
  if (i % 25 === 0) await tp(px, pz, 0, Math.atan2(b.x - px, b.z - pz));
  const now = await boss();
  const ph = JSON.stringify([+now.pitch.toFixed(3), +now.y.toFixed(2), +now.x.toFixed(1), +now.z.toFixed(1)]); if (i % 400 === 0) await page.screenshot({ path: `${S}/${prefix}-probe-${i}.png` }); if (i % 20 === 0) console.log("s", i, ph, JSON.stringify(await page.evaluate(() => { const d = window.__areas.debug(); return { a: d.boss.active, hp: d.boss.hp, p: [d.player.x, d.player.z].map((v) => +v.toFixed(1)), sub: d.out.subtitle?.text ?? null }; })));
  if (Math.abs(now.pitch) > 0.02) { await page.screenshot({ path: `${S}/${prefix}-slam-${n}.png` }); console.log(n, ph); n++; }
  await sleep(120);
}
console.log('errors', errors.length, errors.slice(0, 3).join('\n'));
await browser.close();
