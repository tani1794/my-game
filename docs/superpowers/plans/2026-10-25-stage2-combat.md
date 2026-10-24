# OBLIVION ARENA 第2段階：戦闘 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 結晶獣との1対1の戦い（主人公の3連続攻撃と回避、結晶獣の予告つき4種の攻撃、ロックオン、体力、勝ち負け、すぐやり直し）を、最初から決着まで遊べるようにする。

**Architecture:** 戦いのルールは `src/combat/` に、three.js にも DOM にも依存しない純粋なロジックとして書く（主人公の行動、結晶獣の頭脳、当たり判定の形、全体のまとめ役）。見た目の側（主人公・結晶獣・予告・カメラ・画面表示）は、まとめ役が毎フレーム返す「状態」と「出来事」を受け取って描くだけにする。乱数は種を指定できる `mulberry32` を使い、自動の操作役で戦いの長さを検証する。

**Tech Stack:** three.js 0.186、Vite 8、Vitest 5（happy-dom）、@gltf-transform（アニメーションの追加）、Codex 経由の ChatGPT（`shapes.js`、`telegraph.js`、`combatHud.js` を担当）

**Spec:** `docs/superpowers/specs/2026-10-25-stage2-combat-design.md`

## Global Constraints

- iPhone 14 の Safari（横向き）で 60fps 前後。ダウンロード量の合計は 15MB 以内
- 戦いのルール（`src/combat/`）は three.js と DOM を import しない。時間はすべて引数の `dt`（秒）で進める
- 向きの決まり：角度 `a` の向きは `(sin a, cos a)`（three.js の `rotation.y` と同じ）。北は −z
- 乱数は `mulberry32(seed)`（`src/world/random.js`）のみ。`Math.random` は戦いのルールで使わない
- 主人公：体力100、スタミナ最大100。結晶獣：体力1600。数値は設計書4章・5章のとおりで、変える場合は台帳に記録する
- ChatGPT のコードは Codex（`/Applications/ChatGPT.app/Contents/Resources/codex exec -s read-only`）で受け取り、Claude がテスト・確認してから組み込む。コードとテストが同時に届くため、わざとコードを壊してテストが失敗することを確かめる
- 画面の文言は日本語

## Review Focus

1. **攻撃の途中で回避を連打**：スタミナが足りない回避は出ず、攻撃も止まらずに最後まで振る（入力が消えない・二重にならない） → Task 4 のテスト
2. **予告が出ている途中で「もう一度」を押す**：予告・揺れ・ダメージの数字・ロックオンが残らず、最初の状態に戻る → Task 6 と Task 13 のテスト
3. **結晶獣が崖や木の近くで突進する**：突進の終点が遊べる範囲の外や木の中にならない → Task 5 のテスト
4. **アプリを裏に回して戻る**：長いフレームで予告が一瞬で終わって当たる、ということが起きない（`dt` は 0.05 秒で頭打ち） → Task 6 のテスト
5. **ロックオン中にカメラをドラッグし続ける**：見回しは左右30度で止まり、指を離すと戻る。結晶獣が倒れたらロックオンは解除される → Task 12 のテスト

---

## ファイル構成

| ファイル | 役割 | タスク | 担当 |
|---|---|---|---|
| `scripts/optimize-assets.mjs`、`assets-src/manifest.json` | 騎士のアニメーションを追加で残す | 1 | Claude |
| `src/combat/shapes.js` | 円・扇・帯の当たり判定 | 2 | ChatGPT |
| `src/input.js` | 「押した瞬間」の入力（攻撃・回避・ロック） | 3 | Claude |
| `src/combat/playerActions.js` | 主人公の状態の移り変わり、スタミナ、無敵時間 | 4 | Claude |
| `src/combat/beastBrain.js` | 結晶獣の状態の移り変わりと攻撃の選び方 | 5 | Claude |
| `src/combat/battle.js` | 当たり・体力・勝ち負け・やり直し | 6 | Claude |
| `tests/helpers/bot.js`、`tests/balance.test.js` | 自動の操作役と、戦いの長さの検証 | 7 | Claude |
| `src/world/telegraph.js` | 予告の扇・帯・円の見た目 | 8 | ChatGPT |
| `src/ui/combatHud.js`、`src/ui/combatHud.css` | 結晶獣の体力バー、照準マーク、ダメージの数字、勝ち負けの画面 | 9 | ChatGPT |
| `src/player.js` | 状態に合わせた移動とアニメーション | 10 | Claude |
| `src/world/beast.js` | 動く位置と当たり判定、体全体の動き、光、かけら、崩れ落ち | 11 | Claude |
| `src/camera.js` | ロックオン、揺れ、回避時の遅れ | 12 | Claude |
| `src/main.js`、`src/ui/hud.js` | 組み込み、体力とスタミナのバー、クエスト表示、やり直し | 13 | Claude |

**ChatGPT の担当（2、8、9）は、下の Interfaces だけで作れるようにしてある。** Task 1 が終わったらすぐ、3つまとめて Codex に依頼文を送り、返事を待つ間に Claude の担当を進める。

---

## 共通の形（全タスク共通）

```js
// 当たり判定の形（shapes.js が扱う）。角度 angle は向き (sin, cos)
{ type: 'circle', x, z, radius }
{ type: 'sector', x, z, angle, radius, spread }   // spread は扇の全体の角度（ラジアン）
{ type: 'band',   x, z, angle, width, length }    // (x, z) から angle の向きへ length 伸びる、幅 width の帯

// 主人公の行動の出力（playerActions.update の戻り値）
{
  mode: 'free' | 'attack' | 'dodge' | 'hit' | 'dead',
  animation: { name: string, loop: boolean, timeScale: number },
  move: { x, z, speed },          // この frame の移動の向きと速さ（m/秒）。向きは長さ1か0
  face: number | null,            // 向くべき角度（null なら移動方向を向く）
  swing: null | { id: number, damage: number },  // 当たる時間の間だけ。id は1回の振りごとに変わる
  invulnerable: boolean,
  hp: number, stamina: number,
}

// 結晶獣の頭脳の出力（beastBrain.update の戻り値）
{
  phase: 'idle' | 'approach' | 'telegraph' | 'strike' | 'recover' | 'stagger' | 'dead',
  position: { x, z }, facing: number,
  attack: null | { kind: 'slam' | 'charge' | 'spin' | 'rain', shapes: Shape[], progress: number },  // 予告中は 0→1
  strikes: Shape[],               // この frame に当たる形（予告が塗りつぶされた瞬間だけ）
  cue: null | { kind: 'slam' | 'charge' | 'spin' | 'rain' | 'stagger' | 'death', t: number }, // 体の動きの再生位置（0→1）
  enraged: boolean, hp: number,
}

// まとめ役の出来事（battle.update の戻り値 events）
{ type: 'beastHit', damage, x, z } | { type: 'playerHit', damage } | { type: 'shake', strength }
| { type: 'enraged' } | { type: 'stagger' } | { type: 'won', time } | { type: 'lost' }
```

---

### Task 1: 騎士のアニメーションを追加する

**Files:**
- Modify: `assets-src/manifest.json`（knight の `keepAnimations`）
- Test: `tests/assets-knight.test.js`

**Interfaces:**
- Produces: `public/models/knight.glb` に `Idle, Walking_A, Running_A, 1H_Melee_Attack_Slice_Diagonal, 1H_Melee_Attack_Slice_Horizontal, 1H_Melee_Attack_Chop, Dodge_Forward, Dodge_Backward, Dodge_Left, Dodge_Right, Hit_A, Death_A` の12本

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/assets-knight.test.js
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
```

- [ ] **Step 2:** `npm test` を実行し、FAIL することを確認する
- [ ] **Step 3:** manifest の `keepAnimations` に9本を足して、`npm run optimize` を実行する
- [ ] **Step 4:** `npm test` を実行し、PASS することを確認する。`ls -la public/models/knight.glb` が 600KB 以下であることも確認する
- [ ] **Step 5:** ChatGPT への依頼文3つ（Task 2・8・9）を `docs/handoff/` に書き、Codex で3つ並行して送る（各タスクの Interfaces と Step 1 のテストをそのまま入れる）
- [ ] **Step 6: コミット** `git commit -m "feat: keep combat animations for the knight"`

### Task 2: 当たり判定の形（ChatGPT）

**Files:**
- Create: `src/combat/shapes.js`
- Test: `tests/shapes.test.js`

**Interfaces:**
- Produces:
  - `shapeContains(shape, point: {x, z}) -> boolean`（境目は含む）
  - `sectorHitsCircle(sector, circle: {x, z, radius}) -> boolean`（扇と円が少しでも重なれば true）
  - `angleTo(from: {x,z}, to: {x,z}) -> number`（from から to を向く角度）
  - `angleDiff(a, b) -> number`（a から b への差。−π〜π）

- [ ] **Step 1: 失敗するテストを書く**（依頼文に必ず入れる）

```js
// tests/shapes.test.js
import { test, expect } from 'vitest';
import { shapeContains, sectorHitsCircle, angleTo, angleDiff } from '../src/combat/shapes.js';
const P = (x, z) => ({ x, z });
test('円', () => {
  const c = { type: 'circle', x: 0, z: 0, radius: 2 };
  expect(shapeContains(c, P(2, 0))).toBe(true);
  expect(shapeContains(c, P(2.01, 0))).toBe(false);
});
test('扇：+z 向き、半径5、100度', () => {
  const s = { type: 'sector', x: 0, z: 0, angle: 0, radius: 5, spread: (100 * Math.PI) / 180 };
  expect(shapeContains(s, P(0, 4))).toBe(true);
  expect(shapeContains(s, P(0, -1))).toBe(false);
  expect(shapeContains(s, P(4, 1))).toBe(false); // 76度ずれ
  expect(shapeContains(s, P(0, 5.1))).toBe(false);
});
test('帯：-z 向き、幅4、長さ14', () => {
  const b = { type: 'band', x: 0, z: 0, angle: Math.PI, width: 4, length: 14 };
  expect(shapeContains(b, P(1.9, -13))).toBe(true);
  expect(shapeContains(b, P(2.1, -5))).toBe(false);
  expect(shapeContains(b, P(0, 0.5))).toBe(false);
});
test('扇と円の重なり（円の中心が扇の外でも、縁が入れば当たる）', () => {
  const s = { type: 'sector', x: 0, z: 0, angle: 0, radius: 2.2, spread: (120 * Math.PI) / 180 };
  expect(sectorHitsCircle(s, { x: 0, z: 4, radius: 2 })).toBe(true);
  expect(sectorHitsCircle(s, { x: 0, z: -3, radius: 0.5 })).toBe(false);
});
test('角度', () => {
  expect(angleTo(P(0, 0), P(1, 0))).toBeCloseTo(Math.PI / 2);
  expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
});
```

- [ ] **Step 2:** Codex の返事を `src/combat/shapes.js` と `tests/shapes.test.js` に置き、`npm test` を実行して PASS を確認する
- [ ] **Step 3:** わざと扇の角度判定を壊し、テストが FAIL することを確かめて元に戻す
- [ ] **Step 4: コミット** `git commit -m "feat: combat hit shapes"`（本文に ChatGPT 作であることを書く）

### Task 3: 押した瞬間の入力

**Files:**
- Modify: `src/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Produces:
  - `input.bindTap(el, action: 'attack' | 'dodge' | 'lock')`：押した瞬間に1回だけ記録する
  - キーボード：J＝攻撃、K と Space＝回避、L＝ロック
  - `input.takePresses() -> Set<'attack' | 'dodge' | 'lock'>`：前回から押されたものを返して空にする
  - `input.clear()` は押した記録も消す

- [ ] **Step 1: 失敗するテストを書く**：`bindTap` した要素に `pointerdown` を送ると `takePresses()` に1回だけ入る。2回目の `takePresses()` は空。`clear()` 後は空。`keydown` の `KeyJ` で `'attack'` が入る。押しっぱなしのキーの繰り返し（`event.repeat`）は数えない
- [ ] **Step 2:** FAIL を確認 → **Step 3:** 実装 → **Step 4:** PASS を確認
- [ ] **Step 5: コミット** `git commit -m "feat: tap input for attack, dodge, lock"`

### Task 4: 主人公の行動

**Files:**
- Create: `src/combat/playerActions.js`
- Test: `tests/playerActions.test.js`

**Interfaces:**
- Consumes: なし（純粋なロジック）
- Produces: `createPlayerActions()` → `{ update(dt, intent) -> PlayerFrame, takeHit(damage) -> boolean, reset() }`
  - `intent = { move: {x, z}, run: boolean, attack: boolean, dodge: boolean, target: {x, z} | null, self: {x, z}, lockOn: boolean }`
    - `move` は世界の向き（長さ0〜1）。`attack`・`dodge` はこの frame に押されたか
    - `target` は結晶獣の位置。5m 以内かロックオン中なら、攻撃の出だしで `face` を結晶獣に向ける
  - `takeHit` は無敵中・倒れた後は false を返し、何もしない

**数値（設計書4章）**

| 項目 | 値 |
|---|---|
| 1段目 / 2段目 / 3段目 | 全体の長さ 0.5 / 0.5 / 0.6 秒。当たる時間は 0.15〜0.30 / 0.12〜0.27 / 0.25〜0.42 秒。威力 10 / 12 / 22 |
| つながる受付 | 各段の当たる時間の終わりから 0.4 秒以内に attack。受付中の押下は次の段の予約になり、今の段が終わったら出る |
| 回避 | 0.55 秒、最初の 0.35 秒が無敵、速さ 7m/秒、スタミナ 20。どの状態からでも出せる（`dead` を除く）。スタミナが 20 未満なら出ず、予約もしない |
| 回避の向き | 押したときの `move` の向き。0 なら主人公の後ろ。アニメーションは主人公の向きとの差で前・後・左・右を選ぶ |
| のけぞり | 0.4 秒動けない。回避は出せる |
| 移動の速さ | 歩き 3m/秒（倒し量を掛ける）、走り 6m/秒（動いているときだけスタミナ 1秒に15、0 なら歩き）。攻撃中は動かない。のけぞり中は回避だけ出せる |
| スタミナ回復 | 最後に使ってから 0.5 秒後から、1秒に 30 |
| 向き | 攻撃の各段の出だしで1回だけ `face` を出す。ロックオン中でも移動では移動方向を向く |

- [ ] **Step 1: 失敗するテストを書く**（主なもの）

```js
// tests/playerActions.test.js（抜粋）
import { test, expect } from 'vitest';
import { createPlayerActions } from '../src/combat/playerActions.js';
const idle = { move: { x: 0, z: 0 }, run: false, attack: false, dodge: false, target: null, self: { x: 0, z: 0 }, lockOn: false };
const step = (a, dt, over = {}) => a.update(dt, { ...idle, ...over });

test('攻撃1段目は 0.15〜0.30 秒だけ当たり、1回の振りで同じ id', () => {
  const a = createPlayerActions();
  step(a, 0.01, { attack: true });
  const ids = new Set();
  for (let t = 0; t < 0.5; t += 0.01) { const f = step(a, 0.01); if (f.swing) ids.add(f.swing.id); }
  expect(ids.size).toBe(1);
});
test('空振りでも、当たる時間の終わりから 0.4 秒は次の段を受け付ける。早押しは予約になる', () => {});
test('のけぞり中は攻撃も移動もできず、回避はできる', () => {});
test('受付時間内に押すと 2段目、遅れると 1段目に戻る', () => { /* 2段目の swing.damage が 12、遅れた場合は 10 */ });
test('攻撃中でも回避できる。無敵中は takeHit が false', () => { /* attack → 0.1秒後 dodge → mode が dodge、takeHit(30) が false、hp 100 */ });
test('スタミナ 20 未満では回避が出ず、予約もされない', () => { /* 回避6回目が出ない。回復後も勝手に出ない */ });
test('回避の連打で入力が二重にならない', () => { /* 回避中にもう一度 dodge を押しても、スタミナは20しか減らない */ });
test('スタミナは 0.5 秒休むと 1秒に30回復。止まって走るボタンを押しても減らない', () => {});
test('体力0で dead になり、以後の入力を受け付けない', () => {});
test('reset で体力・スタミナ・状態が最初に戻る', () => {});
```

- [ ] **Step 2:** FAIL を確認 → **Step 3:** 実装 → **Step 4:** PASS を確認
- [ ] **Step 5: コミット** `git commit -m "feat: player combat actions"`

### Task 5: 結晶獣の頭脳

**Files:**
- Create: `src/combat/beastBrain.js`
- Test: `tests/beastBrain.test.js`

**Interfaces:**
- Consumes: `shapes.js` の `angleTo`、`angleDiff`（Task 2）、`mulberry32`
- Produces: `createBeastBrain({ seed = 1, start = { x: 0, z: -6, facing: 0 }, bounds = 13 })` → `{ update(dt, player: {x, z}) -> BeastFrame, takeDamage(n) -> { stagger: boolean, enraged: boolean, dead: boolean }, reset() }`

**決め事（設計書5章＋ここで決める値）**
- 区分：近い ≤6m、中 6〜12m、遠い >12m。正面は向きから ±60 度
- 選び方：近い・正面→slam、近い・横後ろ→spin、中→rain か charge、遠い→charge か rain。直前と同じなら、その場面のもう一方。近い場面でもう一方が無いときは、もう一方の近い攻撃
- 予告：slam 0.9、charge 1.1、spin 0.8、rain 1.3 秒（怒り状態は 0.75 倍。ただし 0.7 秒未満にしない）。rain は塗りつぶし後 0.15 秒おきに5つ
- 予告の位置と向きは、出した瞬間に固定する。塗りつぶし後 0.15 秒は `attack` を残し `attack.impact = true` にする（見せるだけで判定しない）
- rain の円：出した瞬間の主人公の位置に1つ、周り3m以内に4つ。円どうしは 2.4m 以上離す（`strikes` は1つずつ出す。1回の雨で当たる上限はまとめ役が2つに制限する）
- 動けない時間：1.0〜1.6 秒の乱数（怒り状態は 0.75 倍）。そのあと 0.6〜0.8 秒向き直ってから次の予告
- 体の動き（`cue`）の長さ：slam 0.5、charge 0.9（7m/秒の2倍＝14m を 0.9 秒で）、spin 0.6、rain 0.2 秒
- 突進の長さ：`min(14, 主人公までの距離 + 4)`。終点が動ける範囲（中心から半径 `bounds`）の外なら、端で止まるよう帯ごと短くする
- 向き直り：1秒に 90 度まで。approach は 12m より遠いとき 1秒に 2.5m
- よろめき：受けたダメージが 300 たまるごとに 2 秒。怒り状態への切り替えは体力 800 未満になった瞬間
- 怒り状態の charge は、終わったら向き直って2回目の charge（予告あり）を出す。途中でよろめくか倒れたら取り消す
- 怒り状態は次の攻撃から適用する。よろめくと出していた予告は消える。300 を超えた分のダメージは捨てる

- [ ] **Step 1: 失敗するテストを書く**（主なもの）：
  - 正面 4m にいると slam の予告、後ろ 4m だと spin
  - 予告の `progress` が 0→1 に進み、1 になった frame だけ `strikes` に形が入る
  - 同じ攻撃が2回続かない（20回分の選択で隣り合う同種がない）
  - 怒り状態で予告と動けない時間が 0.75 倍、charge の後にもう一度 charge
  - 300 ダメージでよろめき（2秒 phase が stagger）、たまりは 0 に戻る
  - 突進の終点が半径 13m の内側。主人公が 5m 先にいれば突進の長さは 9m
  - rain の円どうしが 2.4m 以上離れている
  - よろめくと予告が消え、その攻撃は当たらない
  - 怒り状態の予告が 0.7 秒未満にならない（spin は 0.7 秒）
  - 体力0で dead になり、以後は攻撃しない。`reset()` で最初に戻る
- [ ] **Step 2:** FAIL を確認 → **Step 3:** 実装 → **Step 4:** PASS を確認
- [ ] **Step 5: コミット** `git commit -m "feat: crystal beast combat brain"`

### Task 6: まとめ役

**Files:**
- Create: `src/combat/battle.js`
- Test: `tests/battle.test.js`

**Interfaces:**
- Consumes: `createPlayerActions`（Task 4）、`createBeastBrain`（Task 5）、`shapeContains`・`sectorHitsCircle`（Task 2）
- Produces: `createBattle({ seed })` → `{ update(dt, { intent, playerPos: {x,z}, beastColliders: Circle[] }) -> { player: PlayerFrame, beast: BeastFrame, events: Event[], outcome: 'fighting' | 'won' | 'lost', time: number }, reset() }`
  - 主人公の `swing` が出ている間、まだ当てていない `swing.id` で `beastColliders` のどれかに重なれば、1回だけ beastHit
  - 主人公の攻撃の扇：主人公の位置から、主人公の向きに半径 1.6m・120 度（向きは `player.face` か、なければ移動の向き。まとめ役が最後の向きを覚える）
  - 1回の rain で主人公に当たるのは最大2つ
  - 同じ frame に両方の体力が0になったら `won`
  - 戦いは、最初に `intent.move` が0でないか `attack` が押された frame から始まり、それまでは結晶獣も動かない
  - `beast.strikes` の形に `playerPos` が入っていて、主人公が無敵でなければ playerHit。結晶の雨は1つずつ判定する
  - `dt` は内部で 0.05 秒で頭打ち
  - 勝ち・負けのあとは update しても体力が変わらない。残っている予告は消す
  - `reset({ seed })` で乱数の種を差し替えられる（やり直しのたびに種を変える）

- [ ] **Step 1: 失敗するテストを書く**：
  - 1回の振りで、結晶獣の当たり判定に何frame重なっても、ダメージは1回
  - 主人公の中心が結晶獣の体から 1.6m より離れていると当たらない
  - 1回の rain で受けるダメージは最大 40
  - 同時に体力0なら `won`
  - 最初に動くまで、結晶獣は予告を出さない
  - 予告の塗りつぶしの瞬間に形の中にいると hp が減り、shake の出来事が出る。無敵中は減らない
  - 結晶獣の体力0で `won` と time、主人公の体力0で `lost`
  - **`reset()` で、予告中の状態も含めてすべて最初に戻る**（Review Focus 2）
  - **`update(5, …)` を1回呼んでも、予告が一気に終わって当たらない**（Review Focus 4）
- [ ] **Step 2:** FAIL を確認 → **Step 3:** 実装 → **Step 4:** PASS を確認
- [ ] **Step 5: コミット** `git commit -m "feat: battle orchestration"`

### Task 7: 自動の操作役と、戦いの長さの検証

**Files:**
- Create: `tests/helpers/bot.js`、`tests/balance.test.js`

**Interfaces:**
- Consumes: `createBattle`（Task 6）、`shapeContains`（Task 2）
- Produces: `simulateFight(seed) -> { outcome, time }`（画面なし、1/60 秒刻みで最長 15 分）
  - 操作役：予告が出たら、自分が形の中にいれば、塗りつぶし 0.25 秒前に形の外へ向けて回避（スタミナが足りなければ走って出る）。結晶獣が recover か stagger の間だけ近づいて攻撃を連打。それ以外は結晶獣から 7m を保って回る
  - 主人公の移動は `PlayerFrame.move` をそのまま積分し、遊べる範囲（半径 22m）で止める

- [ ] **Step 1: テストを書く**：種 1〜20 の 20 回で、勝ちの割合が 60% 以上、勝った戦いの時間の中央値が 180〜300 秒
- [ ] **Step 2:** 実行し、結果を台帳に記録する。外れたら、結晶獣の体力 → 主人公の威力 → 動けない時間、の順に1つずつ調整して再実行。変えた数値は設計書の該当箇所も更新する
- [ ] **Step 3: コミット** `git commit -m "test: balance simulation for fight length"`

### Task 8: 予告の見た目（ChatGPT）

**Files:**
- Create: `src/world/telegraph.js`
- Test: `tests/telegraph.test.js`

**Interfaces:**
- Consumes: 共通の形（Shape）
- Produces: `createTelegraphs(scene, heightAt)` → `{ sync(attack: BeastFrame['attack'] | null, enraged: boolean), clear() }`
  - `attack.shapes` の形ごとに、地面から 0.04m 浮かせた「縁」（明るいオレンジ `#ffb347`、不透明度 0.9、太さ 0.12m）と「塗りつぶし」（`#ff8a2b`、不透明度 0.35）を出す
  - 塗りつぶしは `progress` に合わせて広がる（扇と円は中心から外へ、帯は根元から先へ）
  - 怒り状態では縁を `#ff5a3c` にする
  - 同時に出る形は最大5つ。メッシュは使い回し、毎 frame 作り直さない
  - `sync(null)` と `clear()` ですべて隠す
  - `depthWrite: false`、`fog: false`。地面の起伏に合わせ、形の中心の `heightAt` に置く

- [ ] **Step 1: 失敗するテストを書く**：扇・帯・円それぞれで縁と塗りつぶしの2つのメッシュが見える。`progress` 0.5 で塗りつぶしの大きさが半分。5つ出した後に2つにすると3つ隠れる。`clear()` で全部隠れる。同じ形を2回 sync してもメッシュの数が増えない
- [ ] **Step 2:** Codex の返事を置いて PASS を確認 → **Step 3:** わざと壊して FAIL を確認
- [ ] **Step 4: コミット**

### Task 9: 戦闘の画面表示（ChatGPT）

**Files:**
- Create: `src/ui/combatHud.js`、`src/ui/combatHud.css`
- Test: `tests/combatHud.test.js`（`// @vitest-environment happy-dom`）

**Interfaces:**
- Produces: `createCombatHud(root)` → `{ setBeast(hpRatio, enraged), setReticle(point: {x, y} | null), showDamage(point: {x, y}, value), showResult(kind: 'won' | 'lost', timeSeconds?), hideResult(), onRetry(callback), update(dt), clear() }`
  - 結晶獣の体力バー：上部中央。「結晶獣」の文字と赤いバー（`#c8423a`）。怒り状態で `#8e1f1a` に
  - 照準マーク：金色 `#c9a96a` の直径 28px の円。`null` で隠す
  - ダメージの数字：0.6 秒で 30px 上に流れて消える。同時に最大 8 個（古いものから消す）
  - 勝ち：「討伐完了」と「時間 m:ss」。負け：「力尽きた」。どちらも「もう一度」ボタン
  - 見た目は既存 HUD（`src/ui/hud.css`）に合わせる（半透明の濃紺、金の縁、斜めに切った角）
  - `clear()` はダメージの数字・照準・結果画面を消す

- [ ] **Step 1: 失敗するテストを書く**：`setBeast(0.5)` でバーの幅が 50%。`showResult('won', 245)` で「4:05」が表示され、ボタンを押すと onRetry が呼ばれる。ダメージの数字は 9 個目で最古が消え、`update(0.7)` で全部消える。`clear()` で全部消える
- [ ] **Step 2:** Codex の返事を置いて PASS を確認 → **Step 3:** わざと壊して FAIL を確認
- [ ] **Step 4: コミット**

### Task 10: 主人公を状態で動かす

**Files:**
- Modify: `src/player.js`
- Test: `tests/player.test.js`

**Interfaces:**
- Consumes: `PlayerFrame`（Task 4）
- Produces: `player.drive(dt, frame: PlayerFrame, colliders, heightAt)`（既存の `update` は `drive` に置き換え、`moveToWorld` と `speedFor` は main 側で使う）
  - `frame.move` の向きと速さで `stepPosition` する。`frame.face` が null でなければその角度へ 0.08 秒で向く（なければ移動の向き）
  - `frame.animation` の名前・ループ・速さで再生。ループしないもの（攻撃・回避・のけぞり・倒れる）は `LoopOnce` と `clampWhenFinished` で最後の姿勢を保つ。同じ名前でも新しい振り（`swing.id` が変わる、回避をもう一度）なら頭から再生
  - 切り替えのフェードは、攻撃と回避への切り替えは 0.06 秒、それ以外は 0.2 秒
  - 倒れた後は動かない

- [ ] **Step 1: 失敗するテストを書く**：dodge の frame で 0.1 秒動かすと 0.7m 進む。face を与えると向きがそちらへ回る。攻撃の2段目に移るとアニメーションが Slice_Horizontal に変わる。dead では位置が変わらない
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** `git commit -m "feat: drive player from combat frames"`

### Task 11: 結晶獣の動きと演出

**Files:**
- Modify: `src/world/beast.js`
- Test: `tests/beast.test.js`

**Interfaces:**
- Consumes: `BeastFrame`（Task 5）
- Produces: 戻り値に `apply(frame: BeastFrame, time)`、`hitFlash()`、`position: {x, z}`（ミニマップと土ぼこりが読む。中身を書き換える同じオブジェクト）を追加
  - `apply` は位置・向きを frame に合わせ、`colliders` の中身も書き換える（配列は同じものを使い続ける＝main の当たり判定の配列に入れたまま追従させる）
  - `cue` ごとの体の動き：slam は前半で頭側を 25 度持ち上げ、後半で振り下ろして 3 度沈む。charge は前傾 8 度。spin は1回転。stagger は左右に 6 度揺れる。death は横に 70 度倒れて 0.6m 沈み、結晶を消す
  - 怒り状態で結晶の色を赤寄り（`#ff7a6a` を 40% 混ぜる）にし、発光を 1.3 倍
  - `hitFlash()`：0.12 秒、全体を白く光らせる（発光色に白を足す）
  - かけら：当たるたびに、当たった位置から結晶の色の小さな破片 12 個を飛ばす（`Points` 1つを使い回す）

- [ ] **Step 1: 失敗するテストを書く**：`apply` で位置が変わると colliders の中身も同じだけ動く（配列は同じ参照のまま）。slam の t=0.25 で頭側が持ち上がっている（rotation.x が負）。death で結晶のメッシュが見えない。怒り状態で結晶の色の赤みが増える
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** `git commit -m "feat: beast motions, hit flash, shards"`

### Task 12: ロックオンとカメラ

**Files:**
- Modify: `src/camera.js`
- Test: `tests/camera.test.js`

**Interfaces:**
- Produces:
  - `lockYaw(player: {x,z}, beast: {x,z}) -> number`：主人公の後ろから結晶獣を見る yaw
  - `followCamera.setLock(beast: {x, z} | null)`：null で解除
  - `followCamera.shake(strength)`：0.2 秒、最大 `0.15 * strength` m
  - `followCamera.update(target, dt)`（dt を追加）
  - 自由視点の yaw と、ロック中の見回し（±30 度）は別の変数にする。ロック中：yaw を `lockYaw` へ 1秒に 180 度まで回す。指を離すと見回しは 0.5 秒で 0 に戻る。縦のドラッグはロック中も有効。解除したらその時点の yaw のまま
  - 回避中の遅れ：`update` の target を、0.2 秒で追いつく速さで追う（`followCamera.setLag(true/false)`）

- [ ] **Step 1: 失敗するテストを書く**：`lockYaw({0,6},{0,-6})` が 0（+z 側から −z を見る）。ロック中にドラッグ 100 度分しても見回しは 30 度で止まる。shake の後 0.25 秒で揺れが 0
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** `git commit -m "feat: lock-on camera, shake, dodge lag"`

### Task 13: 組み込み・やり直し・仕上げ

**Files:**
- Modify: `src/main.js`、`src/ui/hud.js`（`setVitals(hp, stamina)`、`setQuest(done)` を追加）
- Test: `tests/hud.test.js`（`setVitals`・`setQuest`）

**Interfaces:**
- Consumes: Task 3〜12 のすべて
- 毎 frame の流れ：
  1. `input.takePresses()`。'lock' でロックの切り替え（結晶獣が倒れていたら無視）
  2. `intent` を作る（`moveToWorld` で世界の向きに、`run`、押下、`target` に結晶獣の位置、`self` に主人公の位置）
  3. `battle.update(dt, …)` → `player.drive`、`beast.apply`、`telegraphs.sync`、`combatHud`、`hud.setVitals`、`followCamera`
  4. 出来事：beastHit → `beast.hitFlash()` とダメージの数字（当たった場所の、結晶獣の高さを画面座標に変換。カメラの後ろなら出さない）。照準もカメラの後ろなら隠す、shake → `followCamera.shake`、won → `hud.setQuest(true)`・`showResult('won', time)`・ロック解除、lost → `showResult('lost')`
  5. 「もう一度」：`battle.reset({ seed: 前回 + 1 })`、主人公の位置を (0, 6) と向き π に戻す、`beast.apply` を初期 frame で、`telegraphs.clear()`、`combatHud.clear()`・`hideResult()`、`hud.setQuest(false)`、ロック解除
- 結晶獣の読み込み前は戦いを始めない（`beast` が null の間は battle を進めない）

- [ ] **Step 1: 失敗するテストを書く**（hud）：`setVitals(50, 25)` で緑のバーが 50%、黄色が 25%。`setQuest(true)` で「1 / 1」
- [ ] **Step 2:** FAIL → **Step 3:** 実装と組み込み → **Step 4:** `npm test` が全部 PASS
- [ ] **Step 5:** ブラウザ（`?debug`）で、J・K・L とクリックで一通り戦い、勝ち・負け・もう一度が動くことを確かめる。スクリーンショットで予告が見えることを確かめる
- [ ] **Step 6:** `npm run build` で合計 15MB 以内を確認
- [ ] **Step 7: コミット** `git commit -m "feat: wire up combat"`
- [ ] **Step 8:** 全体のレビューを ChatGPT（Codex、読み取り専用）に依頼し、Critical と Important を直す
- [ ] **Step 9:** iPhone 14 での確認項目をユーザーに渡す（手触り、予告の見やすさ、揺れの強さ、60fps）
