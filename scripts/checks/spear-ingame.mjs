// node foes-ingame.mjs PORT OUTDIR PREFIX
import puppeteer from 'puppeteer-core';
const [port, S, prefix] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGE ' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('403')) errors.push(m.text().slice(0, 200)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.setViewport({ width: 960, height: 440 });
await page.goto(`http://localhost:${port}/?q=low&debug&fast`, { waitUntil: 'load' });
const save = { version: 2, area: 'crystal', phase: 'CHAPTER_COMPLETE', checkpoint: 'crystalEntry', flags: { gateOpen: true, evolved: true, metOrun: true, webCut1: true, webCut2: true, reflectorA: true, reflectorB: true, bridgeOn: true, midStoneLit: true, winchA: true, winchB: true, winchC: true, liftUp: true }, seen: ['wake', 'arrive'], defeated: [] };
await page.evaluate((s) => localStorage.setItem('oa-story', JSON.stringify(s)), save);
await page.reload({ waitUntil: 'load' });
await sleep(4000);
await page.mouse.click(480, 220); await sleep(800);
await page.mouse.click(480, 220);
await sleep(14000);
const tp = (x, z, y, face) => page.evaluate(([x, z, y, face]) => window.__areas.teleport(x, z, y, face ?? undefined), [x, z, y, face ?? null]);
const foes = () => page.evaluate(() => window.__areas.debug().foes.map((f) => ({ id: f.id, x: +f.x.toFixed(1), z: +f.z.toFixed(1), phase: f.phase, hp: f.hp, alive: f.alive })));
const shot = (name) => page.screenshot({ path: `${S}/${prefix}-${name}.png` });
const look = async (id, dist, y, name, waits = [1200]) => {
  const f = (await foes()).find((o) => o.id === id);
  const sx = f.x;
  const sz = f.z - dist;
  await tp(sx, sz, y, Math.atan2(f.x - sx, f.z - sz));
  for (let i = 0; i < waits.length; i++) { await sleep(waits[i]); await shot(`${name}-${i}`); }
};
await look('cr-spear2', -8, 8, 'spear', [300, 700, 1100, 1500]);
console.log(JSON.stringify((await foes()).filter((f) => /spear2/.test(f.id))));
console.log('errors', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
