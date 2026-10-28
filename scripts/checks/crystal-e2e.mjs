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
  boss: { version: 2, area: 'crystal', phase: 'CHAPTER_COMPLETE', checkpoint: 'crystalGate', flags: { gateOpen: true, evolved: true, metOrun: true, webCut1: true, webCut2: true, reflectorA: true, reflectorB: true, bridgeOn: true, midStoneLit: true, winchA: true, winchB: true, winchC: true, liftUp: true, crownGateOpen: true, gateStoneLit: true }, seen: ['wake', 'arrive'], defeated: ['cr-giant'] },
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

if (PART === 'all') {
  await tp(0, -66, 3); await sleep(9000); await log('arrived');
  await page.screenshot({ path: `${S}/cr-entry.png` });
  await tp(-4.4, 188.6, 0); await sleep(1500); await log('orun?');
  await press('KeyE'); await sleep(26000); await log('orun told');
  console.log(await kill('cr-hound1'));
  console.log(await kill('cr-bat1'));
  console.log(await kill('cr-beetle1'));
  await log('basin clear');
  await tp(-14, 151.8, 0); await sleep(1500); await log('reflectorA');
  for (let i = 0; i < 3; i++) { await press('KeyE'); await sleep(1800); }
  await sleep(5000); await log('A aligned');
  await page.screenshot({ path: `${S}/cr-reflector.png` });
  console.log(await kill('cr-hound2'));
  await tp(31, 166, 0); await sleep(3000); await log('side path');
  console.log(await cut(24.6, 166, 0, Math.PI / 2, 'webCut1'));
  await tp(44, 173, -0.6); await sleep(1500);
  await tp(58, 177, -4); await sleep(4000); await log('mine');
  await page.screenshot({ path: `${S}/cr-mine.png` });
  for (const id of ['cr-hound3', 'cr-hound4', 'cr-bat3']) console.log(await kill(id, -4));
  console.log(await cut(65, 167.8, -4, Math.PI, 'webCut2'));
  await tp(65, 160, -4); await sleep(1500);
  console.log(await kill('cr-spider1', -4));
  await tp(73, 151.2, -4); await sleep(1500); await log('plate?'); await press('KeyE'); await sleep(14000); await log('plate');
  await tp(59.5, 152.6, -4); await sleep(1500); await log('timber?'); await press('KeyE'); await sleep(6000); await log('timber');
  await tp(50, 148, -1.6); await sleep(1000);
  await tp(42, 149, 0); await sleep(6000); await log('ledge');
  await tp(40, 151.9, 0); await sleep(1500); await log('reflectorB');
  for (let i = 0; i < 3; i++) { await press('KeyE'); await sleep(1800); }
  await sleep(12000); await log('bridge?');
  await tp(0, 152, 0, Math.PI); await sleep(2500);
  await page.screenshot({ path: `${S}/cr-bridge.png` });
  await tp(0, 137, 0); await sleep(1500); await log('on bridge');
  await tp(0, 118, 0); await sleep(20000); await log('rest');
  await page.screenshot({ path: `${S}/cr-rest.png` });
  await tp(6, 101, 0); await sleep(1500); await press('KeyE'); await sleep(16000); await log('orun yard');
  for (const id of ['cr-spear1', 'cr-shield1', 'cr-caster1']) console.log(await kill(id));
  await log('yard clear');
  console.log(await kill('cr-giant', 0, 60, true));
  await log('giant');
  await page.screenshot({ path: `${S}/cr-yard.png` });
  console.log(await cut(-16.5, 88, 0, Math.PI, 'winchA'));
  console.log(await cut(-11.5, 88, 0, Math.PI, 'winchB'));
  console.log(await cut(-14, 79.6, 0, 0, 'winchC'));
  await tp(-14, 87.6, 0); await sleep(1500); await log('winch'); await press('KeyE'); await sleep(9000); await log('lift');
  await tp(-22, 72, 4); await sleep(1500); await log('stairs');
  await tp(-22, 63, 8); await sleep(4000); await log('terrace');
  for (const id of ['cr-spider2', 'cr-bat2', 'cr-spear2', 'cr-beetle2']) console.log(await kill(id, 8));
  console.log(await kill('cr-charger', 8, 60, true));
  await tp(-22.6, 56, 8); await sleep(1500); await log('tablet'); await press('KeyE'); await sleep(12000);
  // 間違い → 正しい順
  await tp(0, 65.6, 8); await sleep(1200); await press('KeyE'); await sleep(1500); await log('C first');
  await tp(14, 60.6, 8); await sleep(1200); await press('KeyE'); await sleep(1500); await log('R');
  await tp(-14, 60.6, 8); await sleep(1200); await press('KeyE'); await sleep(1500); await log('L');
  await tp(0, 65.6, 8); await sleep(1200); await press('KeyE'); await sleep(8000); await log('C');
  await page.screenshot({ path: `${S}/cr-terrace.png` });
  await tp(0, 44, 7); await sleep(1500); await log('gate stairs');
  await tp(0, 33, 0); await sleep(4000); await log('gate');
}

// 胴の円のうち主人公に近いものの縁から 0.9m 外に立ち、円の中心を向いて斬る
const strikeBoss = async () => {
  const d = await page.evaluate(() => { const g = window.__areas.debug(); return { player: { x: g.player.x, z: g.player.z }, boss: g.boss }; });
  const p = d.player;
  const c = d.boss.body.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b));
  const away = Math.atan2(p.x - c.x, p.z - c.z);
  const sx = c.x + Math.sin(away) * (c.radius + 0.9);
  const sz = c.z + Math.cos(away) * (c.radius + 0.9);
  await tp(sx, sz, 0, Math.atan2(c.x - sx, c.z - sz));
  await press('KeyJ');
  await sleep(300);
};
// ── ボス ──
await tp(0, 33, 0); await sleep(2000); await log('boss front');
await tp(0, 19, 0, Math.PI); await sleep(2000); await log('intro');
await page.screenshot({ path: `${S}/cr-intro.png` });
await sleep(9000); await log('fight');
await page.screenshot({ path: `${S}/cr-fight.png` });
// 実際に何度か斬る
for (let i = 0; i < 12; i++) {
  await strikeBoss();
}
await log('hits');
// 倒れて戻る → 王座に入り直すと、登場をスキップして再戦
await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__areas.debug(); });
const hpBefore = (await info()).boss.hp;
console.log('boss hp after real hits', hpBefore);
await page.evaluate(() => window.__areas.respawn()); await sleep(4000); await log('respawned');
await tp(0, 19, 0, Math.PI); await sleep(1500);
await page.evaluate(() => document.querySelector('.story-skip:not([hidden]), [data-skip]')?.click()); await sleep(5000); await log('retry skip');
// 体力を少しにして、最後は本当に斬って倒す
await page.evaluate(() => window.__areas.weakenBoss(40));
for (let i = 0; i < 40; i++) {
  if ((await info()).boss.down) break;
  await strikeBoss();
}
await sleep(12000); await log('defeated');
await page.screenshot({ path: `${S}/cr-after.png` });
await tp(0, -40, 0); await sleep(1500); await log('exit path');
await tp(0, -46, 0); await sleep(9000); await log('to frost');
console.log('save', await page.evaluate(() => localStorage.getItem('oa-story')));
console.log('errors', JSON.stringify(errors.slice(0, 4)));
await browser.close();
