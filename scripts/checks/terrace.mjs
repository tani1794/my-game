import puppeteer from 'puppeteer-core';
const S = process.argv[2];
const PART = process.argv[3] ?? 'all';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGE ' + e.stack));
page.on('console', (m) => { if (['error'].includes(m.type())) errors.push(m.text().slice(0, 160)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.setViewport({ width: 640, height: 300 });
await page.goto(`http://localhost:${process.env.PORT ?? 4173}/?q=low&debug&fast`, { waitUntil: 'load' });
const saves = {
  all: { version: 2, area: 'cave', phase: 'CHAPTER_COMPLETE', checkpoint: 'caveMid', flags: { gateOpen: true, evolved: true, lightOpen: true, planksSet: true, midStoneLit: true }, seen: ['wake', 'arrive'], defeated: [] },
  boss: { version: 2, area: 'crystal', phase: 'CHAPTER_COMPLETE', checkpoint: 'crystalMid', flags: { gateOpen: true, evolved: true, metOrun: true, webCut1: true, webCut2: true, reflectorA: true, reflectorB: true, bridgeOn: true, midStoneLit: true, winchA: true, winchB: true, winchC: true, liftUp: true }, seen: ['wake', 'arrive'], defeated: ['cr-giant'] },
};
await page.evaluate((save) => localStorage.setItem('oa-story', JSON.stringify(save)), saves[PART === 'boss' ? 'boss' : 'all']);
await page.reload({ waitUntil: 'load' });
await sleep(4000);
await page.mouse.click(320, 150); await sleep(800);
await page.mouse.click(320, 150);
await sleep(14000);
const info = () => page.evaluate(() => { const d = window.__areas.debug(); return { area: d.area, pos: [d.player.x, d.player.y, d.player.z].map((v) => Math.round(v * 10) / 10), hp: d.hp, obj: d.out.objective, sub: d.out.subtitle?.text ?? null, cp: d.progress.checkpoint(), flags: Object.entries(d.flags).filter(([, v]) => v).map(([k]) => k).join(','), interact: document.querySelector('.story-interact:not([hidden])')?.textContent?.trim() ?? null, toast: document.querySelector('.story-toast:not([hidden])')?.textContent ?? null, boss: d.boss }; });
const log = async (label) => { const i = await info(); if (i.boss) delete i.boss.body; console.log(label.padEnd(14), JSON.stringify(i)); };
const tp = (x, z, y, face) => page.evaluate(([x, z, y, face]) => window.__areas.teleport(x, z, y, face ?? undefined), [x, z, y, face ?? null]);
const press = async (code) => { await page.keyboard.down(code); await sleep(250); await page.keyboard.up(code); };
const foe = (id) => page.evaluate((k) => window.__areas.debug().foes.find((f) => f.id === k), id);
const flag = (name) => page.evaluate((n) => window.__areas.debug().flags[n], name);
// 敵の横 1.2m に立って斬り続ける（飛んでいる間は待つ）
const kill = async (id, y = 0, limit = 140, elite = false) => {
  for (let i = 0; i < limit; i++) {
    // 精鋭：確認用の命令で毎回体力を少しにする（倒れて戻ると、精鋭は元の体力に戻るため）
    if (elite) await page.evaluate((k) => window.__areas.weakenFoe(k, 60), id);
    const f = await foe(id);
    if (!f.alive) return `${id} down after ${i}`;
    await tp(f.x, f.z + 1.4, y, Math.PI);
    await press('KeyJ');
    await sleep(150);
  }
  return `${id} STILL ALIVE ${JSON.stringify(await foe(id))}`;
};
const cut = async (x, z, y, face, name, tries = 24) => {
  for (let i = 0; i < tries; i++) {
    if (await flag(name)) return `${name} after ${i}`;
    await tp(x, z, y, face);
    await press('KeyJ');
    await sleep(700);
  }
  return `${name} NOT BROKEN`;
};

await tp(-22, 72, 4); await sleep(1500);
await tp(-22, 63, 8); await sleep(4000); await log('terrace');
for (const id of ['cr-spider2', 'cr-bat2', 'cr-spear2', 'cr-beetle2']) console.log(await kill(id, 8));
await log('terrace clear');
console.log('errors', JSON.stringify(errors.slice(0, 4)));
await browser.close();
